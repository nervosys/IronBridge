// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
//! Remote catalogue (`/api/catalog`)
//!
//! Search the models and datasets published on the Hugging Face Hub.
//!
//! # The other thing called "dataset"
//!
//! `/api/datasets` is the local store: collections uploaded to this server.
//! This is the catalogue: artifacts published elsewhere that a user might want
//! to fetch. The data flows the other way and the two are kept apart, here and
//! in the clients.
//!
//! # What this does and does not do
//!
//! It searches. It does not download: nothing here writes a file, and the
//! Download buttons in the clients remain disabled and say why. Fetching a
//! multi-gigabyte artifact needs a destination directory, a free-space guard
//! and a background job with progress, none of which exist yet, and a button
//! that appears to start a download and does not would be the exact defect
//! this codebase was audited for.
//!
//! # Fields are what the Hub returns
//!
//! The tables this replaces showed a dataset's size as "12.5 GB", its sample
//! count as "4.2M" and its format as "Parquet"; for models, "6.4 GB", "3B
//! parameters", "GGUF". **The Hub's search API returns none of those.** They
//! were invented, and they are gone rather than derived from a model's name or
//! guessed from its tags. What comes back is what the Hub actually publishes:
//! downloads, likes, tags, the task, and when it last changed.
//!
//! # Not a caller-supplied URL
//!
//! The host is compiled in and only the query string is caller-controlled.
//! An endpoint that fetched a URL chosen by the caller would let anyone on the
//! API reach anything the server can reach, including its own loopback and any
//! metadata service on the network.

use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::json;

/// The only host this module will talk to.
pub(crate) const HUB: &str = "https://huggingface.co";

/// Optional, and only to raise the Hub's anonymous rate limit.
///
/// Public search needs no credential, so its absence is not an error and is
/// not reported as one.
pub(crate) const TOKEN_ENV: &str = "HUGGINGFACE_TOKEN";

const DEFAULT_LIMIT: usize = 20;
const MAX_LIMIT: usize = 100;

#[derive(Debug, Deserialize)]
pub struct CatalogQuery {
    pub q: Option<String>,
    pub limit: Option<usize>,
}

/// One row of the catalogue, in the shape the clients render.
///
/// Every field is present in the Hub's response. There is deliberately no
/// `size`, `samples`, `params` or `downloaded`: the search API reports none of
/// them, and the tables this replaces filled all four with fiction.
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CatalogEntry {
    /// Full Hub id, e.g. `meta-llama/Llama-3.1-8B-Instruct`.
    pub id: String,
    /// The part before the slash, when there is one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    /// The part after the slash: what a list should show.
    pub name: String,
    pub downloads: i64,
    pub likes: i64,
    /// Models only: the task the Hub files it under, e.g. `text-generation`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub task: Option<String>,
    /// Models only, e.g. `transformers`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub library: Option<String>,
    /// Datasets only, and often long; the clients truncate it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Trimmed to the tags a reader can use -- see [`useful_tags`].
    pub tags: Vec<String>,
    /// ISO-8601, straight from the Hub. Absent on rows that carry no date.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
    /// Canonical page, so a client can link out rather than guess the URL.
    pub url: String,
    /// Whether the Hub requires accepting terms before the files are readable.
    pub gated: bool,
}

/// Drop the tags that are machine bookkeeping rather than information.
///
/// The Hub attaches a lot per row -- `region:us`, `endpoints_compatible`,
/// `arxiv:2204.05149`, one `base_model:...` per ancestor. Showing all of them
/// buries the few a person scanning a list actually reads.
fn useful_tags(tags: &[serde_json::Value]) -> Vec<String> {
    const NOISE_PREFIXES: [&str; 6] = [
        "region:",
        "arxiv:",
        "base_model:",
        "doi:",
        "deploy:",
        "autotrain",
    ];
    const NOISE_EXACT: [&str; 4] = [
        "endpoints_compatible",
        "text-generation-inference",
        "eval-results",
        "has_space",
    ];

    tags.iter()
        .filter_map(|t| t.as_str())
        .filter(|t| !NOISE_PREFIXES.iter().any(|p| t.starts_with(p)) && !NOISE_EXACT.contains(t))
        .take(8)
        .map(str::to_string)
        .collect()
}

/// Split `author/name` into its parts.
///
/// Hub ids are usually namespaced but the canonical models (`gpt2`, `bert-base-uncased`)
/// are not, so a missing author is normal rather than a parse failure.
fn split_id(id: &str) -> (Option<String>, String) {
    match id.split_once('/') {
        Some((author, name)) => (Some(author.to_string()), name.to_string()),
        None => (None, id.to_string()),
    }
}

/// Map one Hub row onto a catalogue entry.
///
/// Every absent field becomes `None` or a zero, never a placeholder that reads
/// as a measurement. A row with no id at all is dropped: it cannot be linked
/// to or fetched, so there is nothing to show.
fn to_entry(raw: &serde_json::Value, kind: Kind) -> Option<CatalogEntry> {
    let id = raw.get("id")?.as_str()?.to_string();
    let (author, name) = split_id(&id);

    let string_field = |key: &str| {
        raw.get(key)
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(str::to_string)
    };

    Some(CatalogEntry {
        url: format!("{HUB}/{}{id}", kind.url_segment()),
        author,
        name,
        downloads: raw.get("downloads").and_then(|v| v.as_i64()).unwrap_or(0),
        likes: raw.get("likes").and_then(|v| v.as_i64()).unwrap_or(0),
        task: match kind {
            Kind::Models => string_field("pipeline_tag"),
            Kind::Datasets => None,
        },
        library: match kind {
            Kind::Models => string_field("library_name"),
            Kind::Datasets => None,
        },
        description: match kind {
            Kind::Datasets => string_field("description"),
            Kind::Models => None,
        },
        tags: raw
            .get("tags")
            .and_then(|v| v.as_array())
            .map(|t| useful_tags(t))
            .unwrap_or_default(),
        // Models report `createdAt`, datasets `lastModified`. Neither is
        // guaranteed, so neither is defaulted to "now" -- an invented
        // timestamp reads exactly like a real one.
        updated_at: string_field("lastModified").or_else(|| string_field("createdAt")),
        gated: match raw.get("gated") {
            // The Hub sends `false`, or a string naming the gate type.
            Some(serde_json::Value::Bool(b)) => *b,
            Some(serde_json::Value::String(_)) => true,
            _ => false,
        },
        id,
    })
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub(crate) enum Kind {
    Models,
    Datasets,
}

impl Kind {
    /// Parse the `kind` a caller supplied.
    ///
    /// A closed set: these two map onto the Hub's two repository types and
    /// nothing else does, so an unrecognised value is rejected rather than
    /// silently treated as one of them.
    pub(crate) fn parse(name: &str) -> Option<Self> {
        match name {
            "models" => Some(Kind::Models),
            "datasets" => Some(Kind::Datasets),
            _ => None,
        }
    }

    fn api_path(self) -> &'static str {
        match self {
            Kind::Models => "/api/models",
            Kind::Datasets => "/api/datasets",
        }
    }

    /// Datasets live under `/datasets/<id>`; models at the root.
    fn url_segment(self) -> &'static str {
        match self {
            Kind::Models => "",
            Kind::Datasets => "datasets/",
        }
    }

    pub(crate) fn noun(self) -> &'static str {
        match self {
            Kind::Models => "models",
            Kind::Datasets => "datasets",
        }
    }
}

fn ok<T: Serialize>(payload: T) -> HttpResponse {
    HttpResponse::Ok().json(json!({ "success": true, "data": payload, "error": null }))
}

fn fail(status: actix_web::http::StatusCode, message: impl Into<String>) -> HttpResponse {
    HttpResponse::build(status).json(json!({
        "success": false,
        "data": null,
        "error": message.into(),
    }))
}

async fn search(kind: Kind, query: CatalogQuery) -> HttpResponse {
    let limit = query.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    let q = query.q.unwrap_or_default();

    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return fail(
                actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
                format!("HTTP client error: {e}"),
            )
        }
    };

    // The host is compiled in; only the query string comes from the caller,
    // and it goes through `reqwest`'s encoder rather than into a format string.
    let mut request = client
        .get(format!("{HUB}{}", kind.api_path()))
        .query(&[("limit", limit.to_string())]);
    if !q.trim().is_empty() {
        request = request.query(&[("search", q.trim())]);
    }
    if let Ok(token) = std::env::var(TOKEN_ENV) {
        if !token.trim().is_empty() {
            request = request.bearer_auth(token.trim());
        }
    }

    let response = match request.send().await {
        Ok(r) => r,
        // Reported rather than answered with an empty list: "the Hub is
        // unreachable" and "nothing matched" are different, and an empty table
        // cannot tell them apart.
        Err(e) => {
            return fail(
                actix_web::http::StatusCode::BAD_GATEWAY,
                format!("Could not reach the Hugging Face Hub: {e}"),
            )
        }
    };

    let status = response.status();
    let body = response.text().await.unwrap_or_default();

    match interpret(status.as_u16(), &body, kind) {
        Ok(results) => ok(json!({
            "query": q,
            "source": "huggingface",
            "results": results,
        })),
        Err(message) => fail(actix_web::http::StatusCode::BAD_GATEWAY, message),
    }
}

/// Turn the Hub's raw response into rows, or into the reason it could not be.
///
/// Split out from the request so every failure branch is reachable from a
/// test. They otherwise sit behind a live call to a third party that cannot be
/// made to fail on demand -- a bad token does not do it, because public search
/// ignores the credential entirely and answers anyway.
fn interpret(status: u16, body: &str, kind: Kind) -> Result<Vec<CatalogEntry>, String> {
    if !(200..300).contains(&status) {
        let hint = if status == 429 {
            format!(" This is its anonymous rate limit; set {TOKEN_ENV} on the server to raise it.")
        } else {
            String::new()
        };
        return Err(format!(
            "The Hugging Face Hub returned {status} for {}.{hint}",
            kind.noun()
        ));
    }

    let parsed: serde_json::Value = serde_json::from_str(body)
        .map_err(|e| format!("The Hugging Face Hub returned unparseable JSON: {e}"))?;

    let rows = parsed
        .as_array()
        .ok_or("The Hugging Face Hub returned something other than a list")?;

    Ok(rows.iter().filter_map(|r| to_entry(r, kind)).collect())
}

/// One file in a Hub repository.
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RepoFile {
    /// Path within the repository. May contain `/`.
    pub path: String,
    /// Size in bytes, as the Hub reports it -- real for LFS files too.
    pub size: i64,
}

#[derive(Debug, Deserialize)]
pub struct FilesQuery {
    pub kind: Option<String>,
    pub id: Option<String>,
}

/// Read a repository's file list, with sizes.
///
/// Sizes are what makes a download decidable: without them a client cannot
/// warn about a 5 GB file and the server cannot check the disk before
/// starting. The Hub reports the real size for LFS files here, not the
/// pointer size.
///
/// Directories are dropped -- there is nothing to download about one, and
/// keeping them would put rows in the list that no action applies to.
pub(crate) async fn fetch_repo_files(kind: Kind, id: &str) -> Result<Vec<RepoFile>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    // `id` goes into the path, so it is checked before it gets there: a `..`
    // segment would otherwise walk up and out of the repository namespace.
    if !is_plausible_repo_id(id) {
        return Err(format!(
            "`{id}` is not a repository id. Expected `name` or `author/name`."
        ));
    }

    let mut request = client.get(format!("{HUB}{}/{id}/tree/main", kind.api_path()));
    if let Ok(token) = std::env::var(TOKEN_ENV) {
        if !token.trim().is_empty() {
            request = request.bearer_auth(token.trim());
        }
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Could not reach the Hugging Face Hub: {e}"))?;

    let status = response.status().as_u16();
    let body = response.text().await.unwrap_or_default();
    if !(200..300).contains(&status) {
        return Err(format!(
            "The Hugging Face Hub returned {status} for {} `{id}`.",
            kind.noun()
        ));
    }

    let parsed: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| format!("The Hugging Face Hub returned unparseable JSON: {e}"))?;
    let rows = parsed
        .as_array()
        .ok_or("The Hugging Face Hub returned something other than a list")?;

    Ok(rows
        .iter()
        .filter(|r| r.get("type").and_then(|t| t.as_str()) == Some("file"))
        .filter_map(|r| {
            Some(RepoFile {
                path: r.get("path")?.as_str()?.to_string(),
                size: r.get("size").and_then(|v| v.as_i64()).unwrap_or(0),
            })
        })
        .collect())
}

/// Reject anything that is not `name` or `author/name`.
///
/// This value is interpolated into a URL path. `..` segments, backslashes and
/// leading slashes are all ways to leave the namespace the caller was supposed
/// to be addressing, so the shape is checked rather than trusted.
pub(crate) fn is_plausible_repo_id(id: &str) -> bool {
    if id.is_empty() || id.len() > 200 {
        return false;
    }
    let segments: Vec<&str> = id.split('/').collect();
    if segments.len() > 2 {
        return false;
    }
    segments.iter().all(|s| {
        !s.is_empty()
            && *s != "."
            && *s != ".."
            && s.chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
    })
}

pub async fn list_repo_files(query: web::Query<FilesQuery>) -> HttpResponse {
    let Some(kind) = query.kind.as_deref().and_then(Kind::parse) else {
        return fail(
            actix_web::http::StatusCode::BAD_REQUEST,
            "kind is required and must be `models` or `datasets`",
        );
    };
    let Some(id) = query.id.as_deref().filter(|i| !i.trim().is_empty()) else {
        return fail(
            actix_web::http::StatusCode::BAD_REQUEST,
            "id is required, e.g. `openai-community/gpt2`",
        );
    };

    match fetch_repo_files(kind, id.trim()).await {
        Ok(files) => ok(json!({ "kind": kind.noun(), "id": id.trim(), "files": files })),
        Err(message) if message.contains("not a repository id") => {
            fail(actix_web::http::StatusCode::BAD_REQUEST, message)
        }
        Err(message) => fail(actix_web::http::StatusCode::BAD_GATEWAY, message),
    }
}

pub async fn search_models(query: web::Query<CatalogQuery>) -> HttpResponse {
    search(Kind::Models, query.into_inner()).await
}

pub async fn search_datasets(query: web::Query<CatalogQuery>) -> HttpResponse {
    search(Kind::Datasets, query.into_inner()).await
}

pub fn configure_catalog_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/catalog")
            .route("/models", web::get().to(search_models))
            .route("/datasets", web::get().to(search_datasets))
            .route("/files", web::get().to(list_repo_files)),
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A real row, captured from `GET /api/models?search=llama` on
    /// 2026-08-25. Kept verbatim so the mapping is tested against what the
    /// Hub sends rather than against what this module wishes it sent.
    fn model_row() -> serde_json::Value {
        json!({
            "_id": "6698d8a0653e4babe21e1e7d",
            "id": "meta-llama/Llama-3.1-8B-Instruct",
            "likes": 6668,
            "trendingScore": 24,
            "private": false,
            "downloads": 6423491,
            "tags": [
                "transformers", "safetensors", "llama", "text-generation",
                "conversational", "en", "arxiv:2204.05149",
                "base_model:meta-llama/Llama-3.1-8B",
                "license:llama3.1", "eval-results", "text-generation-inference",
                "endpoints_compatible", "region:us", "deploy:sagemaker"
            ],
            "pipeline_tag": "text-generation",
            "library_name": "transformers",
            "createdAt": "2024-07-18T08:56:00.000Z"
        })
    }

    /// Likewise, from `GET /api/datasets?search=orca`.
    fn dataset_row() -> serde_json::Value {
        json!({
            "id": "Open-Orca/OpenOrca",
            "author": "Open-Orca",
            "gated": false,
            "lastModified": "2025-02-19T07:32:36.000Z",
            "likes": 1586,
            "private": false,
            "description": "The OpenOrca Dataset!",
            "downloads": 20201,
            "tags": ["task_categories:text-classification", "region:us"]
        })
    }

    #[test]
    fn a_model_row_maps_to_what_the_hub_actually_reports() {
        let entry = to_entry(&model_row(), Kind::Models).expect("mapped");

        assert_eq!(entry.id, "meta-llama/Llama-3.1-8B-Instruct");
        assert_eq!(entry.author.as_deref(), Some("meta-llama"));
        assert_eq!(entry.name, "Llama-3.1-8B-Instruct");
        assert_eq!(entry.downloads, 6_423_491);
        assert_eq!(entry.likes, 6668);
        assert_eq!(entry.task.as_deref(), Some("text-generation"));
        assert_eq!(entry.library.as_deref(), Some("transformers"));
        assert_eq!(
            entry.updated_at.as_deref(),
            Some("2024-07-18T08:56:00.000Z")
        );
        assert_eq!(
            entry.url,
            "https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct"
        );
        assert!(!entry.gated);
        // A model row carries no description.
        assert_eq!(entry.description, None);
    }

    /// The fields the old tables invented must not reappear.
    ///
    /// A dataset's size, its sample count and its format were rendered as
    /// measurements -- "12.5 GB", "4.2M", "Parquet" -- and the Hub's search
    /// API reports none of them. This asserts on the serialised shape, since
    /// that is what a client could read.
    #[test]
    fn the_serialised_entry_has_no_size_samples_or_format() {
        let entry = to_entry(&dataset_row(), Kind::Datasets).expect("mapped");
        let value = serde_json::to_value(&entry).expect("serialise");
        let keys: Vec<&String> = value.as_object().expect("object").keys().collect();

        for invented in [
            "size",
            "sizeBytes",
            "samples",
            "params",
            "format",
            "downloaded",
        ] {
            assert!(
                !keys.iter().any(|k| k.as_str() == invented),
                "`{invented}` is back in the catalogue shape: {keys:?}"
            );
        }
    }

    #[test]
    fn a_dataset_row_links_under_the_datasets_path() {
        let entry = to_entry(&dataset_row(), Kind::Datasets).expect("mapped");
        assert_eq!(
            entry.url,
            "https://huggingface.co/datasets/Open-Orca/OpenOrca"
        );
        assert_eq!(entry.description.as_deref(), Some("The OpenOrca Dataset!"));
        // Datasets carry no task or library.
        assert_eq!(entry.task, None);
        assert_eq!(entry.library, None);
    }

    /// Canonical models have no namespace, and that is not an error.
    #[test]
    fn an_unnamespaced_id_keeps_its_whole_name() {
        let entry = to_entry(&json!({ "id": "gpt2" }), Kind::Models).expect("mapped");
        assert_eq!(entry.author, None);
        assert_eq!(entry.name, "gpt2");
        assert_eq!(entry.url, "https://huggingface.co/gpt2");
        // Missing counts read as zero, not as an invented figure.
        assert_eq!(entry.downloads, 0);
        assert_eq!(entry.likes, 0);
        assert_eq!(entry.updated_at, None);
    }

    /// A row with no id cannot be linked to, so it is dropped.
    #[test]
    fn a_row_without_an_id_is_dropped() {
        assert!(to_entry(&json!({ "likes": 5 }), Kind::Models).is_none());
    }

    /// Bookkeeping tags are filtered; the informative ones survive in order.
    #[test]
    fn noisy_tags_are_dropped_and_the_rest_are_capped() {
        let entry = to_entry(&model_row(), Kind::Models).expect("mapped");

        for noise in [
            "region:us",
            "arxiv:2204.05149",
            "base_model:meta-llama/Llama-3.1-8B",
            "endpoints_compatible",
            "text-generation-inference",
            "eval-results",
            "deploy:sagemaker",
        ] {
            assert!(!entry.tags.iter().any(|t| t == noise), "kept `{noise}`");
        }

        assert!(entry.tags.contains(&"transformers".to_string()));
        assert!(entry.tags.contains(&"text-generation".to_string()));
        assert!(entry.tags.len() <= 8, "{:?}", entry.tags);
    }

    /// `gated` arrives as `false` or as a string naming the gate.
    #[test]
    fn a_string_gate_counts_as_gated() {
        let gated = to_entry(&json!({ "id": "a/b", "gated": "auto" }), Kind::Datasets).unwrap();
        assert!(gated.gated);

        let open = to_entry(&json!({ "id": "a/b", "gated": false }), Kind::Datasets).unwrap();
        assert!(!open.gated);

        // Absent entirely, which the models endpoint does.
        let absent = to_entry(&json!({ "id": "a/b" }), Kind::Models).unwrap();
        assert!(!absent.gated);
    }

    /// A non-2xx from the Hub is an error, not an empty result set.
    #[test]
    fn a_failing_status_is_reported_rather_than_read_as_no_matches() {
        let err = interpret(503, "", Kind::Models).expect_err("should fail");
        assert!(err.contains("503"), "{err}");
        assert!(err.contains("models"), "{err}");
    }

    /// The rate limit is the failure a user will actually hit, so it says
    /// what to do about it rather than only what happened.
    #[test]
    fn a_rate_limit_names_the_variable_that_raises_it() {
        let err = interpret(429, "", Kind::Datasets).expect_err("should fail");
        assert!(err.contains("429"), "{err}");
        assert!(err.contains(TOKEN_ENV), "{err}");
    }

    #[test]
    fn a_body_that_is_not_json_is_an_error() {
        let err =
            interpret(200, "<html>maintenance</html>", Kind::Models).expect_err("should fail");
        assert!(err.contains("unparseable"), "{err}");
    }

    /// The Hub answers with a list. Anything else is a 502, not an empty page.
    #[test]
    fn a_json_body_that_is_not_a_list_is_an_error() {
        let err = interpret(200, r#"{"error":"nope"}"#, Kind::Models).expect_err("should fail");
        assert!(err.contains("other than a list"), "{err}");
    }

    /// The success path, through the same function the handler uses.
    #[test]
    fn a_well_formed_body_maps_every_row_it_can() {
        let body = serde_json::to_string(&json!([
            model_row(),
            // No id: unlinkable, so dropped rather than rendered blank.
            { "likes": 3 },
        ]))
        .unwrap();

        let results = interpret(200, &body, Kind::Models).expect("should parse");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "meta-llama/Llama-3.1-8B-Instruct");
    }

    /// An empty list is a real answer and stays one.
    #[test]
    fn an_empty_list_is_success_with_no_rows() {
        assert_eq!(interpret(200, "[]", Kind::Datasets).expect("ok").len(), 0);
    }

    /// The repository id is interpolated into a URL path, so its shape is
    /// checked rather than trusted.
    ///
    /// Every rejected case below is a way to address something other than the
    /// repository the caller named.
    #[test]
    fn only_plausible_repository_ids_are_accepted() {
        for good in [
            "gpt2",
            "openai-community/gpt2",
            "meta-llama/Llama-3.1-8B-Instruct",
            "Open-Orca/OpenOrca",
            "some_org/model.v2",
        ] {
            assert!(is_plausible_repo_id(good), "rejected `{good}`");
        }

        for bad in [
            "",
            "..",
            "../etc/passwd",
            "a/../../b",
            "a/b/c",
            "/absolute",
            "trailing/",
            "back\\slash",
            "has space",
            "query?x=1",
            "frag#ment",
            "colon:port",
            "percent%2e%2e",
        ] {
            assert!(!is_plausible_repo_id(bad), "accepted `{bad}`");
        }
    }

    #[test]
    fn the_kind_is_a_closed_set() {
        assert_eq!(Kind::parse("models"), Some(Kind::Models));
        assert_eq!(Kind::parse("datasets"), Some(Kind::Datasets));
        for bad in ["", "Models", "spaces", "model", "datasets/../x"] {
            assert_eq!(Kind::parse(bad), None, "accepted `{bad}`");
        }
    }

    #[test]
    fn the_limit_is_clamped_into_range() {
        for (asked, expected) in [
            (None, DEFAULT_LIMIT),
            (Some(0), 1),
            (Some(5), 5),
            (Some(10_000), MAX_LIMIT),
        ] {
            let got = asked.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
            assert_eq!(got, expected, "limit {asked:?}");
        }
    }
}
