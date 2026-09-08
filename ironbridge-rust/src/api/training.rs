// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
//! Fine-tuning jobs (`/api/training`)
//!
//! Submits one of the stored datasets to an OpenAI-compatible provider as a
//! fine-tuning job, and reports back what the provider says about it.
//!
//! # IronBridge does not train anything
//!
//! It has no trainer, no GPU handling and no scheduler, and this module does
//! not pretend otherwise. It converts a dataset, hands it to the provider
//! configured with `OPENAI_API_KEY`, and reads that provider's status back.
//! Every status shown came from the provider on the request that displayed it.
//!
//! # What the fixtures claimed, and what a provider actually reports
//!
//! The tables this replaces showed each job at `progress: 67`, an `eta` of
//! "2h 15m", a `gpu` of "RTX 4090", and `metrics` with accuracy and F1.
//!
//! A fine-tuning API reports a **status** -- `validating_files`, `queued`,
//! `running`, `succeeded`, `failed`, `cancelled` -- and, once finished, a
//! trained-token count and the resulting model's name. There is no
//! percentage, no estimated time, no GPU, and no accuracy or F1 anywhere in
//! it. So there is no progress bar here: a bar needs a fraction, and inventing
//! one is how the old page came to show a job 67% through something that had
//! never started.
//!
//! # Costing money is worth a validation pass first
//!
//! Submitting a bad dataset fails after upload, at the provider, having
//! charged for the attempt. [`validate_dataset`] applies the provider's
//! documented rules locally first and reports every problem at once, so a
//! caller can fix them in one pass rather than discovering them one paid
//! round-trip at a time.

use actix_web::{web, HttpResponse};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;

use super::state::AppState;

type State = web::Data<AppState>;

/// The provider's documented minimum for a chat fine-tune.
///
/// Checked locally because the provider checks it after the upload, and the
/// upload is the part that costs.
const MIN_EXAMPLES: usize = 10;

/// Roles a chat fine-tuning example may use.
const ALLOWED_ROLES: [&str; 3] = ["system", "user", "assistant"];

/// How many problems to report before giving up.
///
/// A dataset with a systematic mistake has one problem per row, and ten
/// thousand identical messages help nobody.
const MAX_REPORTED_PROBLEMS: usize = 20;

// =============================================================================
// Schema
// =============================================================================

fn init_training_tables(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS training_jobs (
            id TEXT PRIMARY KEY,
            provider_job_id TEXT NOT NULL,
            provider_file_id TEXT,
            dataset_id TEXT NOT NULL,
            dataset_name TEXT NOT NULL,
            base_model TEXT NOT NULL,
            status TEXT NOT NULL,
            fine_tuned_model TEXT,
            trained_tokens INTEGER,
            error TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            finished_at INTEGER
        )",
        [],
    )?;
    Ok(())
}

// =============================================================================
// Wire types
// =============================================================================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartTrainingRequest {
    pub dataset_id: String,
    /// The provider's identifier for the model to fine-tune.
    pub base_model: String,
    /// Optional label the provider appends to the resulting model's name.
    #[serde(default)]
    pub suffix: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingJob {
    pub id: String,
    /// The provider's own id, so a user can find the job in their dashboard.
    pub provider_job_id: String,
    pub dataset_id: String,
    pub dataset_name: String,
    pub base_model: String,
    /// The provider's status verbatim. Never derived, never simulated.
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fine_tuned_model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trained_tokens: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finished_at: Option<i64>,
    /// Why the last refresh failed, when it did.
    ///
    /// Present means the status above is the last one successfully read, not
    /// the current one. Without this a stale status is indistinguishable from
    /// a fresh one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_error: Option<String>,
}

/// One problem with a dataset, and where it is.
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DatasetProblem {
    /// Index of the offending entry, or `null` for a whole-dataset problem.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entry_index: Option<usize>,
    pub message: String,
}

// =============================================================================
// Helpers
// =============================================================================

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

fn db_error(e: rusqlite::Error) -> HttpResponse {
    fail(
        actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
        format!("Database error: {e}"),
    )
}

fn bad_request(message: impl Into<String>) -> HttpResponse {
    fail(actix_web::http::StatusCode::BAD_REQUEST, message)
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// A status the provider will not move away from.
fn is_terminal(status: &str) -> bool {
    matches!(status, "succeeded" | "failed" | "cancelled")
}

struct Provider {
    client: reqwest::Client,
    base_url: String,
    api_key: String,
}

impl Provider {
    /// `None` when no key is configured, which callers turn into a 503.
    ///
    /// Deliberately the same variables the completion proxy and the embedder
    /// use: one provider configuration for the server, not three.
    fn from_env() -> Option<Self> {
        let api_key = std::env::var("OPENAI_API_KEY").unwrap_or_default();
        if api_key.trim().is_empty() {
            return None;
        }
        Some(Self {
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .build()
                .ok()?,
            base_url: std::env::var("OPENAI_BASE_URL")
                .unwrap_or_else(|_| "https://api.openai.com/v1".into())
                .trim_end_matches('/')
                .to_string(),
            api_key,
        })
    }
}

fn no_provider() -> HttpResponse {
    fail(
        actix_web::http::StatusCode::SERVICE_UNAVAILABLE,
        "No training provider configured. Set OPENAI_API_KEY (and \
         OPENAI_BASE_URL for a compatible endpoint) on the server. IronBridge does \
         not train models itself.",
    )
}

// =============================================================================
// Dataset conversion and validation
// =============================================================================

/// Check a dataset against the provider's documented rules for chat fine-tuning.
///
/// Returns every problem it finds rather than the first, up to
/// [`MAX_REPORTED_PROBLEMS`]: a caller fixing a dataset wants the list, not a
/// sequence of single failures each costing a round trip.
pub(crate) fn validate_dataset(entries: &[serde_json::Value]) -> Vec<DatasetProblem> {
    let mut problems = Vec::new();

    if entries.len() < MIN_EXAMPLES {
        problems.push(DatasetProblem {
            entry_index: None,
            message: format!(
                "A chat fine-tune needs at least {MIN_EXAMPLES} examples; this dataset has {}.",
                entries.len()
            ),
        });
    }

    for (index, entry) in entries.iter().enumerate() {
        if problems.len() >= MAX_REPORTED_PROBLEMS {
            problems.push(DatasetProblem {
                entry_index: None,
                message: format!(
                    "Stopped after {MAX_REPORTED_PROBLEMS} problems; there may be more."
                ),
            });
            break;
        }

        let push = |problems: &mut Vec<DatasetProblem>, message: String| {
            problems.push(DatasetProblem {
                entry_index: Some(index),
                message,
            });
        };

        let Some(messages) = entry.get("messages").and_then(|m| m.as_array()) else {
            push(
                &mut problems,
                "Entry has no `messages` array. A chat fine-tuning example is \
                 `{\"messages\": [{\"role\": ..., \"content\": ...}]}`."
                    .to_string(),
            );
            continue;
        };

        if messages.is_empty() {
            push(&mut problems, "`messages` is empty.".to_string());
            continue;
        }

        let mut has_assistant = false;
        let mut shape_ok = true;

        for message in messages {
            let role = message.get("role").and_then(|r| r.as_str());
            let content = message.get("content").and_then(|c| c.as_str());

            match role {
                None => {
                    push(&mut problems, "A message has no `role`.".to_string());
                    shape_ok = false;
                }
                Some(r) if !ALLOWED_ROLES.contains(&r) => {
                    push(
                        &mut problems,
                        format!("`{r}` is not a usable role. Use system, user or assistant."),
                    );
                    shape_ok = false;
                }
                Some("assistant") => has_assistant = true,
                Some(_) => {}
            }

            if content.is_none() {
                push(
                    &mut problems,
                    "A message has no string `content`.".to_string(),
                );
                shape_ok = false;
            }
        }

        // Only worth saying when the shape was otherwise fine -- on a
        // malformed entry it is a consequence, not a separate problem.
        if shape_ok && !has_assistant {
            push(
                &mut problems,
                "No assistant message. There is nothing for the model to learn \
                 from an example with no reply."
                    .to_string(),
            );
        }
    }

    problems
}

/// Render the entries as the JSONL a provider expects.
///
/// One compact JSON object per line, which is the format's whole definition.
pub(crate) fn to_jsonl(entries: &[serde_json::Value]) -> String {
    entries
        .iter()
        .map(|e| serde_json::to_string(e).unwrap_or_else(|_| "{}".to_string()))
        .collect::<Vec<_>>()
        .join("\n")
}

fn read_dataset(
    conn: &Connection,
    dataset_id: &str,
) -> rusqlite::Result<Option<(String, Vec<serde_json::Value>)>> {
    let name: Option<String> = conn
        .query_row(
            "SELECT name FROM datasets WHERE id = ?1",
            params![dataset_id],
            |r| r.get(0),
        )
        .optional()?;
    let Some(name) = name else { return Ok(None) };

    let mut stmt = conn.prepare(
        "SELECT content FROM dataset_entries WHERE dataset_id = ?1 ORDER BY entry_index",
    )?;
    let entries = stmt
        .query_map(params![dataset_id], |row| {
            let raw: String = row.get(0)?;
            Ok(serde_json::from_str(&raw).unwrap_or(serde_json::Value::Null))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(Some((name, entries)))
}

// =============================================================================
// Handlers
// =============================================================================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateQuery {
    /// `datasetId` on the wire, matching every other query parameter here.
    pub dataset_id: Option<String>,
}

/// Report what would stop a dataset being fine-tuned on.
///
/// Free, local and offline: no provider is contacted, which is the point --
/// the alternative is finding out by paying for a failed upload.
pub async fn validate_training_dataset(
    state: State,
    query: web::Query<ValidateQuery>,
) -> HttpResponse {
    let Some(dataset_id) = query.dataset_id.as_deref().filter(|d| !d.trim().is_empty()) else {
        return bad_request("datasetId is required");
    };

    let db = state.db.lock().unwrap();
    // The datasets module owns these tables; this only reads them, and a
    // caller who has never uploaded a dataset gets the 404 below rather than
    // a missing-table error.
    if super::datasets::init_dataset_tables_for(&db.conn).is_err() {
        return fail(
            actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
            "Could not open the dataset tables",
        );
    }

    match read_dataset(&db.conn, dataset_id.trim()) {
        Ok(Some((name, entries))) => {
            let problems = validate_dataset(&entries);
            ok(json!({
                "datasetId": dataset_id.trim(),
                "datasetName": name,
                "entryCount": entries.len(),
                "usable": problems.is_empty(),
                "problems": problems,
            }))
        }
        Ok(None) => fail(
            actix_web::http::StatusCode::NOT_FOUND,
            "No dataset with that id",
        ),
        Err(e) => db_error(e),
    }
}

/// Submit a dataset to the provider as a fine-tuning job.
///
/// Validated locally first, then uploaded, then submitted. Each step is
/// reported for what it is: an upload that succeeded and a submission that
/// failed are different states, and the file id is kept either way so an
/// orphaned upload can be found.
pub async fn start_training(state: State, body: web::Json<StartTrainingRequest>) -> HttpResponse {
    let body = body.into_inner();
    let dataset_id = body.dataset_id.trim().to_string();
    let base_model = body.base_model.trim().to_string();

    if dataset_id.is_empty() {
        return bad_request("datasetId is required");
    }
    if base_model.is_empty() {
        return bad_request("baseModel is required");
    }

    let Some(provider) = Provider::from_env() else {
        return no_provider();
    };

    let (dataset_name, entries) = {
        let db = state.db.lock().unwrap();
        if super::datasets::init_dataset_tables_for(&db.conn).is_err() {
            return fail(
                actix_web::http::StatusCode::INTERNAL_SERVER_ERROR,
                "Could not open the dataset tables",
            );
        }
        match read_dataset(&db.conn, &dataset_id) {
            Ok(Some(d)) => d,
            Ok(None) => {
                return fail(
                    actix_web::http::StatusCode::NOT_FOUND,
                    "No dataset with that id",
                )
            }
            Err(e) => return db_error(e),
        }
    };

    // Before the upload, because the upload is the part that costs.
    let problems = validate_dataset(&entries);
    if !problems.is_empty() {
        return HttpResponse::BadRequest().json(json!({
            "success": false,
            "data": null,
            "error": format!(
                "`{dataset_name}` cannot be fine-tuned on: {} problem(s). \
                 See /api/training/validate for the list.",
                problems.len()
            ),
            "problems": problems,
        }));
    }

    let jsonl = to_jsonl(&entries);

    // ---- upload ------------------------------------------------------------
    let form = reqwest::multipart::Form::new()
        .text("purpose", "fine-tune")
        .part(
            "file",
            reqwest::multipart::Part::text(jsonl)
                .file_name(format!("{dataset_id}.jsonl"))
                .mime_str("application/jsonl")
                .unwrap_or_else(|_| reqwest::multipart::Part::text(String::new())),
        );

    let upload = provider
        .client
        .post(format!("{}/files", provider.base_url))
        .bearer_auth(&provider.api_key)
        .multipart(form)
        .send()
        .await;

    let file_id = match read_provider_json(upload, "upload the training file").await {
        Ok(v) => match v.get("id").and_then(|i| i.as_str()) {
            Some(id) => id.to_string(),
            None => {
                return fail(
                    actix_web::http::StatusCode::BAD_GATEWAY,
                    "The provider accepted the upload but returned no file id.",
                )
            }
        },
        Err(message) => return fail(actix_web::http::StatusCode::BAD_GATEWAY, message),
    };

    // ---- submit ------------------------------------------------------------
    let mut payload = json!({ "training_file": file_id, "model": base_model });
    if let Some(suffix) = body
        .suffix
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        payload["suffix"] = json!(suffix);
    }

    let submitted = provider
        .client
        .post(format!("{}/fine_tuning/jobs", provider.base_url))
        .bearer_auth(&provider.api_key)
        .json(&payload)
        .send()
        .await;

    let job = match read_provider_json(submitted, "create the fine-tuning job").await {
        Ok(v) => v,
        // The file id is named because it is now sitting at the provider,
        // paid for, with nothing pointing at it.
        Err(message) => {
            return fail(
                actix_web::http::StatusCode::BAD_GATEWAY,
                format!("{message} The uploaded file `{file_id}` is still at the provider."),
            )
        }
    };

    let Some(provider_job_id) = job.get("id").and_then(|i| i.as_str()) else {
        return fail(
            actix_web::http::StatusCode::BAD_GATEWAY,
            "The provider created a job but returned no job id.",
        );
    };
    let status = job
        .get("status")
        .and_then(|s| s.as_str())
        .unwrap_or("queued")
        .to_string();

    let id = uuid::Uuid::new_v4().to_string();
    let now = now_ms();

    {
        let db = state.db.lock().unwrap();
        if let Err(e) = init_training_tables(&db.conn) {
            return db_error(e);
        }
        if let Err(e) = db.conn.execute(
            "INSERT INTO training_jobs
             (id, provider_job_id, provider_file_id, dataset_id, dataset_name,
              base_model, status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
            params![
                id,
                provider_job_id,
                file_id,
                dataset_id,
                dataset_name,
                base_model,
                status,
                now
            ],
        ) {
            return db_error(e);
        }
    }

    ok(TrainingJob {
        id,
        provider_job_id: provider_job_id.to_string(),
        dataset_id,
        dataset_name,
        base_model,
        status,
        fine_tuned_model: None,
        trained_tokens: None,
        error: None,
        created_at: now,
        updated_at: now,
        finished_at: None,
        refresh_error: None,
    })
}

/// Read a provider response, or say what went wrong with it.
async fn read_provider_json(
    result: Result<reqwest::Response, reqwest::Error>,
    what: &str,
) -> Result<serde_json::Value, String> {
    let response = result.map_err(|e| format!("Could not reach the provider to {what}: {e}"))?;
    let status = response.status();
    let text = response.text().await.unwrap_or_default();

    if !status.is_success() {
        // The provider's own message is far more useful than the status --
        // "This model does not support fine-tuning" versus a bare 400.
        let detail = serde_json::from_str::<serde_json::Value>(&text)
            .ok()
            .and_then(|v| {
                v.pointer("/error/message")
                    .and_then(|m| m.as_str())
                    .map(str::to_string)
            })
            .unwrap_or_else(|| text.chars().take(200).collect());
        return Err(format!(
            "The provider returned {status} when asked to {what}: {detail}"
        ));
    }

    serde_json::from_str(&text)
        .map_err(|e| format!("The provider returned unparseable JSON for {what}: {e}"))
}

fn row_to_job(row: &rusqlite::Row) -> rusqlite::Result<TrainingJob> {
    Ok(TrainingJob {
        id: row.get(0)?,
        provider_job_id: row.get(1)?,
        dataset_id: row.get(2)?,
        dataset_name: row.get(3)?,
        base_model: row.get(4)?,
        status: row.get(5)?,
        fine_tuned_model: row.get(6)?,
        trained_tokens: row.get(7)?,
        error: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
        finished_at: row.get(11)?,
        refresh_error: None,
    })
}

const JOB_COLUMNS: &str = "id, provider_job_id, dataset_id, dataset_name, base_model,
                           status, fine_tuned_model, trained_tokens, error,
                           created_at, updated_at, finished_at";

/// Ask the provider about a job and write down what it said.
///
/// Returns the refreshed job. On failure the stored job is returned with
/// `refreshError` set, rather than an error: a list of five jobs should not
/// fail entirely because one of them could not be reached.
async fn refresh(provider: &Provider, db_path: &std::path::Path, job: TrainingJob) -> TrainingJob {
    if is_terminal(&job.status) {
        return job;
    }

    let response = provider
        .client
        .get(format!(
            "{}/fine_tuning/jobs/{}",
            provider.base_url, job.provider_job_id
        ))
        .bearer_auth(&provider.api_key)
        .send()
        .await;

    let remote = match read_provider_json(response, "read the job").await {
        Ok(v) => v,
        Err(message) => {
            return TrainingJob {
                refresh_error: Some(message),
                ..job
            }
        }
    };

    let status = remote
        .get("status")
        .and_then(|s| s.as_str())
        .unwrap_or(&job.status)
        .to_string();
    let fine_tuned_model = remote
        .get("fine_tuned_model")
        .and_then(|m| m.as_str())
        .map(str::to_string);
    let trained_tokens = remote.get("trained_tokens").and_then(|t| t.as_i64());
    let error = remote
        .pointer("/error/message")
        .and_then(|m| m.as_str())
        .map(str::to_string);

    let now = now_ms();
    let finished_at = if is_terminal(&status) {
        Some(job.finished_at.unwrap_or(now))
    } else {
        None
    };

    if let Ok(conn) = Connection::open(db_path) {
        let _ = conn.execute(
            "UPDATE training_jobs
             SET status=?2, fine_tuned_model=?3, trained_tokens=?4, error=?5,
                 updated_at=?6, finished_at=?7
             WHERE id=?1",
            params![
                job.id,
                status,
                fine_tuned_model,
                trained_tokens,
                error,
                now,
                finished_at
            ],
        );
    }

    TrainingJob {
        status,
        fine_tuned_model,
        trained_tokens,
        error,
        updated_at: now,
        finished_at,
        refresh_error: None,
        ..job
    }
}

pub async fn list_training_jobs(state: State) -> HttpResponse {
    let stored: Vec<TrainingJob> = {
        let db = state.db.lock().unwrap();
        if let Err(e) = init_training_tables(&db.conn) {
            return db_error(e);
        }
        let result: rusqlite::Result<Vec<TrainingJob>> = (|| {
            let mut stmt = db.conn.prepare(&format!(
                "SELECT {JOB_COLUMNS} FROM training_jobs ORDER BY created_at DESC"
            ))?;
            let rows = stmt
                .query_map([], row_to_job)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(rows)
        })();
        match result {
            Ok(jobs) => jobs,
            Err(e) => return db_error(e),
        }
    };

    // With no provider configured the stored statuses are all that exist. They
    // are returned as they are, each marked stale, rather than the whole list
    // failing -- a finished job's record is still worth reading.
    let Some(provider) = Provider::from_env() else {
        let jobs: Vec<TrainingJob> = stored
            .into_iter()
            .map(|j| {
                if is_terminal(&j.status) {
                    j
                } else {
                    TrainingJob {
                        refresh_error: Some(
                            "No provider configured, so this status is the last one recorded."
                                .to_string(),
                        ),
                        ..j
                    }
                }
            })
            .collect();
        return ok(jobs);
    };

    let mut jobs = Vec::with_capacity(stored.len());
    for job in stored {
        jobs.push(refresh(&provider, &state.db_path, job).await);
    }
    ok(jobs)
}

pub async fn get_training_job(state: State, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();

    let stored = {
        let db = state.db.lock().unwrap();
        if let Err(e) = init_training_tables(&db.conn) {
            return db_error(e);
        }
        match db.conn.query_row(
            &format!("SELECT {JOB_COLUMNS} FROM training_jobs WHERE id = ?1"),
            params![id],
            row_to_job,
        ) {
            Ok(job) => job,
            Err(rusqlite::Error::QueryReturnedNoRows) => {
                return fail(
                    actix_web::http::StatusCode::NOT_FOUND,
                    "No training job with that id",
                )
            }
            Err(e) => return db_error(e),
        }
    };

    match Provider::from_env() {
        Some(provider) => ok(refresh(&provider, &state.db_path, stored).await),
        None if is_terminal(&stored.status) => ok(stored),
        None => ok(TrainingJob {
            refresh_error: Some(
                "No provider configured, so this status is the last one recorded.".to_string(),
            ),
            ..stored
        }),
    }
}

/// Cancel a running job at the provider, or forget a finished one.
pub async fn cancel_training_job(state: State, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();

    let stored = {
        let db = state.db.lock().unwrap();
        if let Err(e) = init_training_tables(&db.conn) {
            return db_error(e);
        }
        match db.conn.query_row(
            &format!("SELECT {JOB_COLUMNS} FROM training_jobs WHERE id = ?1"),
            params![id],
            row_to_job,
        ) {
            Ok(job) => job,
            Err(rusqlite::Error::QueryReturnedNoRows) => {
                return fail(
                    actix_web::http::StatusCode::NOT_FOUND,
                    "No training job with that id",
                )
            }
            Err(e) => return db_error(e),
        }
    };

    if is_terminal(&stored.status) {
        let db = state.db.lock().unwrap();
        return match db
            .conn
            .execute("DELETE FROM training_jobs WHERE id = ?1", params![id])
        {
            Ok(_) => ok(json!({ "deleted": true })),
            Err(e) => db_error(e),
        };
    }

    let Some(provider) = Provider::from_env() else {
        return no_provider();
    };

    let response = provider
        .client
        .post(format!(
            "{}/fine_tuning/jobs/{}/cancel",
            provider.base_url, stored.provider_job_id
        ))
        .bearer_auth(&provider.api_key)
        .send()
        .await;

    match read_provider_json(response, "cancel the job").await {
        Ok(_) => ok(refresh(&provider, &state.db_path, stored).await),
        Err(message) => fail(actix_web::http::StatusCode::BAD_GATEWAY, message),
    }
}

pub fn configure_training_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/training")
            // Before `/jobs/{id}`, so the literal is not captured as an id.
            .route("/validate", web::get().to(validate_training_dataset))
            .route("/jobs", web::get().to(list_training_jobs))
            .route("/jobs", web::post().to(start_training))
            .route("/jobs/{id}", web::get().to(get_training_job))
            .route("/jobs/{id}", web::delete().to(cancel_training_job)),
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ChatDatabase;
    use actix_web::{test, App};
    use std::path::PathBuf;

    static ENV_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

    struct NoKey;
    impl NoKey {
        fn set() -> Self {
            std::env::remove_var("OPENAI_API_KEY");
            NoKey
        }
    }
    impl Drop for NoKey {
        fn drop(&mut self) {
            std::env::remove_var("OPENAI_API_KEY");
        }
    }

    fn temp_state(tag: &str) -> (web::Data<AppState>, tempfile::TempDir) {
        let dir = tempfile::tempdir().expect("tempdir");
        let path: PathBuf = dir.path().join(format!("{tag}.db"));
        crate::commands::create_harvest_database(&path).expect("harvest schema");
        let db = ChatDatabase::open(&path).expect("open");
        (web::Data::new(AppState::new(db, path)), dir)
    }

    macro_rules! app {
        ($state:expr) => {
            test::init_service(
                App::new()
                    .app_data($state.clone())
                    .configure(configure_training_routes),
            )
            .await
        };
    }

    async fn body_json(resp: actix_web::dev::ServiceResponse) -> serde_json::Value {
        serde_json::from_slice(&test::read_body(resp).await).expect("json body")
    }

    fn example(reply: &str) -> serde_json::Value {
        json!({ "messages": [
            { "role": "user", "content": "hello" },
            { "role": "assistant", "content": reply },
        ]})
    }

    fn seed_dataset(state: &web::Data<AppState>, id: &str, entries: &[serde_json::Value]) {
        let db = state.db.lock().unwrap();
        crate::api::datasets::init_dataset_tables_for(&db.conn).expect("tables");
        db.conn
            .execute(
                "INSERT INTO datasets
                 (id, name, dataset_type, format, entry_count, size_bytes, created_at, updated_at)
                 VALUES (?1, 'Seeded', 'conversations', 'json', ?2, 0, 1, 1)",
                params![id, entries.len() as i64],
            )
            .expect("insert dataset");
        for (i, e) in entries.iter().enumerate() {
            db.conn
                .execute(
                    "INSERT INTO dataset_entries (dataset_id, entry_index, content)
                     VALUES (?1, ?2, ?3)",
                    params![id, i as i64, serde_json::to_string(e).unwrap()],
                )
                .expect("insert entry");
        }
    }

    /// A dataset the provider would accept produces no complaints.
    #[test]
    fn a_well_formed_dataset_validates_clean() {
        let entries: Vec<_> = (0..MIN_EXAMPLES)
            .map(|i| example(&format!("hi {i}")))
            .collect();
        assert_eq!(validate_dataset(&entries), Vec::new());
    }

    /// Too few examples is the provider's own rule, checked before paying.
    #[test]
    fn too_few_examples_is_reported() {
        let entries: Vec<_> = (0..3).map(|i| example(&format!("hi {i}"))).collect();
        let problems = validate_dataset(&entries);
        assert!(problems.iter().any(|p| p.entry_index.is_none()
            && p.message.contains(&MIN_EXAMPLES.to_string())
            && p.message.contains('3')));
    }

    /// Every structural mistake is caught, and pinned to its entry.
    #[test]
    fn malformed_entries_are_each_reported_with_their_index() {
        let mut entries: Vec<_> = (0..MIN_EXAMPLES).map(|_| example("fine")).collect();
        entries[2] = json!({ "prompt": "old format", "completion": "x" });
        entries[4] = json!({ "messages": [] });
        entries[6] = json!({ "messages": [{ "role": "wizard", "content": "x" }] });
        entries[8] = json!({ "messages": [{ "role": "user", "content": "only a question" }] });

        let problems = validate_dataset(&entries);

        let at = |i: usize| {
            problems
                .iter()
                .find(|p| p.entry_index == Some(i))
                .unwrap_or_else(|| panic!("no problem reported for entry {i}"))
        };
        assert!(at(2).message.contains("no `messages`"));
        assert!(at(4).message.contains("empty"));
        assert!(at(6).message.contains("wizard"));
        assert!(at(8).message.contains("assistant"));

        // The well-formed ones are left alone.
        for i in [0, 1, 3, 5, 7, 9] {
            assert!(
                !problems.iter().any(|p| p.entry_index == Some(i)),
                "entry {i} was wrongly flagged"
            );
        }
    }

    /// A message with no content is caught even when its role is fine.
    #[test]
    fn a_message_without_content_is_reported() {
        let mut entries: Vec<_> = (0..MIN_EXAMPLES).map(|_| example("fine")).collect();
        entries[0] = json!({ "messages": [
            { "role": "user" },
            { "role": "assistant", "content": "x" },
        ]});
        let problems = validate_dataset(&entries);
        assert!(problems
            .iter()
            .any(|p| p.entry_index == Some(0) && p.message.contains("content")));
    }

    /// A systematically broken dataset does not produce one message per row.
    #[test]
    fn the_problem_list_is_capped() {
        let entries: Vec<_> = (0..500).map(|_| json!({ "wrong": true })).collect();
        let problems = validate_dataset(&entries);
        assert!(
            problems.len() <= MAX_REPORTED_PROBLEMS + 1,
            "reported {} problems",
            problems.len()
        );
        assert!(problems.last().unwrap().message.contains("Stopped after"));
    }

    /// JSONL is one compact object per line, and nothing else.
    #[test]
    fn jsonl_is_one_object_per_line() {
        let entries = vec![example("a"), example("b"), example("c")];
        let rendered = to_jsonl(&entries);

        let lines: Vec<&str> = rendered.lines().collect();
        assert_eq!(lines.len(), 3);
        for line in lines {
            assert!(!line.contains('\n'));
            let parsed: serde_json::Value = serde_json::from_str(line).expect("each line is JSON");
            assert!(parsed.get("messages").is_some());
        }
    }

    /// Validation needs no provider: it is the cheap check before the paid one.
    #[tokio::test]
    async fn validation_works_without_a_provider_configured() {
        let _guard = ENV_LOCK.lock().await;
        let _no_key = NoKey::set();

        let (state, _dir) = temp_state("tr-validate");
        let entries: Vec<_> = (0..3).map(|_| example("hi")).collect();
        seed_dataset(&state, "ds1", &entries);

        let app = app!(&state);
        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/training/validate?datasetId=ds1")
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 200);

        let body = body_json(resp).await;
        assert_eq!(body["data"]["usable"], false);
        assert_eq!(body["data"]["entryCount"], 3);
        assert!(!body["data"]["problems"].as_array().unwrap().is_empty());
    }

    /// Submitting without a provider is a 503 that says IronBridge does not train.
    #[tokio::test]
    async fn submitting_without_a_provider_is_a_503() {
        let _guard = ENV_LOCK.lock().await;
        let _no_key = NoKey::set();

        let (state, _dir) = temp_state("tr-noprov");
        let app = app!(&state);
        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/training/jobs")
                .set_json(json!({ "datasetId": "ds1", "baseModel": "gpt-4o-mini" }))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 503);

        let body = body_json(resp).await;
        let message = body["error"].as_str().unwrap_or_default();
        assert!(message.contains("OPENAI_API_KEY"), "{message}");
        assert!(message.contains("does not train"), "{message}");
    }

    #[tokio::test]
    async fn validating_an_unknown_dataset_is_a_404() {
        let _guard = ENV_LOCK.lock().await;
        let (state, _dir) = temp_state("tr-404");
        let app = app!(&state);
        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/training/validate?datasetId=nope")
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 404);
    }

    #[tokio::test]
    async fn listing_works_before_anything_is_submitted() {
        let _guard = ENV_LOCK.lock().await;
        let _no_key = NoKey::set();
        let (state, _dir) = temp_state("tr-empty");
        let app = app!(&state);
        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/training/jobs")
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 200);
        assert_eq!(
            body_json(resp).await["data"].as_array().map(|a| a.len()),
            Some(0)
        );
    }

    /// An unfinished job read with no provider says its status is stale.
    ///
    /// Without that, a `running` job recorded weeks ago is indistinguishable
    /// from one running right now.
    #[tokio::test]
    async fn an_unrefreshable_job_is_marked_stale_rather_than_shown_as_current() {
        let _guard = ENV_LOCK.lock().await;
        let _no_key = NoKey::set();

        let (state, _dir) = temp_state("tr-stale");
        {
            let db = state.db.lock().unwrap();
            init_training_tables(&db.conn).expect("tables");
            db.conn
                .execute(
                    "INSERT INTO training_jobs
                     (id, provider_job_id, dataset_id, dataset_name, base_model,
                      status, created_at, updated_at)
                     VALUES ('j1','ftjob-1','ds1','Seeded','gpt-4o-mini','running',1,1),
                            ('j2','ftjob-2','ds1','Seeded','gpt-4o-mini','succeeded',1,1)",
                    [],
                )
                .expect("insert");
        }

        let app = app!(&state);
        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/training/jobs")
                .to_request(),
        )
        .await;
        let body = body_json(resp).await;
        let jobs = body["data"].as_array().expect("jobs");

        let running = jobs.iter().find(|j| j["id"] == "j1").expect("j1");
        assert_eq!(running["status"], "running");
        assert!(
            running["refreshError"].as_str().is_some(),
            "a stale running job was presented as current: {running}"
        );

        // A finished job needs no refresh, so it is not marked.
        let done = jobs.iter().find(|j| j["id"] == "j2").expect("j2");
        assert!(done["refreshError"].is_null(), "{done}");
    }

    /// Deleting a finished job forgets it without contacting anyone.
    #[tokio::test]
    async fn deleting_a_finished_job_needs_no_provider() {
        let _guard = ENV_LOCK.lock().await;
        let _no_key = NoKey::set();

        let (state, _dir) = temp_state("tr-del");
        {
            let db = state.db.lock().unwrap();
            init_training_tables(&db.conn).expect("tables");
            db.conn
                .execute(
                    "INSERT INTO training_jobs
                     (id, provider_job_id, dataset_id, dataset_name, base_model,
                      status, created_at, updated_at)
                     VALUES ('done','ftjob-9','ds1','Seeded','gpt-4o-mini','succeeded',1,1)",
                    [],
                )
                .expect("insert");
        }

        let app = app!(&state);
        let resp = test::call_service(
            &app,
            test::TestRequest::delete()
                .uri("/api/training/jobs/done")
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 200);

        let db = state.db.lock().unwrap();
        let left: i64 = db
            .conn
            .query_row("SELECT COUNT(*) FROM training_jobs", [], |r| r.get(0))
            .expect("count");
        assert_eq!(left, 0);
    }

    /// `/validate` must not be captured by the `/jobs/{id}` route.
    #[tokio::test]
    async fn the_validate_path_is_not_captured_as_a_job_id() {
        let _guard = ENV_LOCK.lock().await;
        let (state, _dir) = temp_state("tr-shadow");
        let app = app!(&state);
        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/training/validate")
                .to_request(),
        )
        .await;
        // 400 for the missing datasetId is the validate handler answering.
        assert_eq!(resp.status(), 400);
    }

    #[test]
    fn terminal_statuses_are_the_ones_a_provider_stops_at() {
        for done in ["succeeded", "failed", "cancelled"] {
            assert!(is_terminal(done), "{done}");
        }
        for going in ["validating_files", "queued", "running"] {
            assert!(!is_terminal(going), "{going}");
        }
    }
}
