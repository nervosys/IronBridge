// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
//! Local dataset store (`/api/datasets`)
//!
//! Datasets the user uploads and the server holds: conversations, documents,
//! question/answer pairs, or anything else they want to keep as a labelled
//! collection of records.
//!
//! # One of two things called "dataset"
//!
//! The two clients meant opposite things by the word. `chasm-app`'s Developer
//! screen modelled a dataset as the user's own export, with an **Upload**
//! button. `chasm-web`'s Developer page modelled it as a remote HuggingFace
//! artifact, with a **Download** button, a `source` and a `downloaded` flag.
//! Those are not two views of one thing -- the data flows in opposite
//! directions -- so they are not being merged into one endpoint. This module
//! is the local store, the mobile reading. A remote catalogue, if it is built,
//! is a separate feature with a separate name.
//!
//! # Counts are measured, not accepted
//!
//! `entryCount` and `sizeBytes` are computed from what was actually stored,
//! never taken from the request. A client-supplied size is a number nobody
//! checked, which is the whole category of defect this codebase has been
//! audited for -- and the previous fixtures here reported "12.5 GB" and
//! "4.2M samples" for data that did not exist.

use actix_web::{web, HttpResponse};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;

use super::state::AppState;

type State = web::Data<AppState>;

/// How many entries a single upload may carry.
///
/// Bounded because the whole request is parsed into memory and written in one
/// transaction. A caller with more than this has a file, not a paste, and
/// wants an import path that streams -- which does not exist yet, and is
/// refused rather than half-served.
const MAX_ENTRIES: usize = 50_000;

/// Default page size for reading entries back.
const DEFAULT_PAGE: usize = 50;
const MAX_PAGE: usize = 500;

// =============================================================================
// Schema
// =============================================================================

/// Create the tables if this is the first datasets call of the install.
///
/// Called by every handler, for the reason `delete_account` did not and should
/// have: a handler that assumes another ran first fails with "no such table"
/// on exactly the installs that never used the feature.
fn init_dataset_tables(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS datasets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            dataset_type TEXT NOT NULL,
            format TEXT NOT NULL,
            entry_count INTEGER NOT NULL,
            size_bytes INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS dataset_entries (
            dataset_id TEXT NOT NULL,
            entry_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            PRIMARY KEY (dataset_id, entry_index),
            FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_dataset_entries_ds ON dataset_entries(dataset_id);",
    )
}

// =============================================================================
// Wire types
// =============================================================================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDatasetRequest {
    pub name: String,
    /// `conversations`, `documents`, `qa` or `custom`.
    #[serde(default, rename = "type")]
    pub dataset_type: Option<String>,
    /// Free-form label for how the records are shaped, e.g. `jsonl`.
    #[serde(default)]
    pub format: Option<String>,
    /// The records themselves. Each is stored verbatim as JSON.
    pub entries: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatasetSummary {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub dataset_type: String,
    pub format: String,
    /// Counted from the rows written, not taken from the request.
    pub entry_count: i64,
    /// Summed over the stored JSON, not taken from the request.
    pub size_bytes: i64,
    pub created_at: i64,
    pub updated_at: i64,
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

fn not_found() -> HttpResponse {
    fail(actix_web::http::StatusCode::NOT_FOUND, "Dataset not found")
}

/// The kinds of dataset the clients know how to render.
///
/// A closed set rather than free text: the screens switch on it for their
/// icons and filters, so an unknown value would render as nothing at all.
fn parse_type(name: Option<&str>) -> Result<&'static str, String> {
    match name.unwrap_or("custom") {
        "conversations" => Ok("conversations"),
        "documents" => Ok("documents"),
        "qa" => Ok("qa"),
        "custom" => Ok("custom"),
        other => Err(format!(
            "Unknown dataset type `{other}`. Use one of: conversations, \
             documents, qa, custom."
        )),
    }
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

// =============================================================================
// Handlers
// =============================================================================

/// Store a dataset and its entries.
///
/// One transaction: a dataset whose entries were half written would list with
/// a count it does not have and page past the end of what is there.
pub async fn create_dataset(state: State, body: web::Json<CreateDatasetRequest>) -> HttpResponse {
    let body = body.into_inner();

    if body.name.trim().is_empty() {
        return bad_request("name is required and cannot be empty");
    }
    if body.entries.is_empty() {
        return bad_request("entries is required and cannot be empty");
    }
    if body.entries.len() > MAX_ENTRIES {
        return bad_request(format!(
            "{} entries exceeds the {MAX_ENTRIES} this endpoint accepts in one \
             request. Chasm has no streaming import yet.",
            body.entries.len()
        ));
    }

    let dataset_type = match parse_type(body.dataset_type.as_deref()) {
        Ok(t) => t,
        Err(message) => return bad_request(message),
    };
    let format = body
        .format
        .as_deref()
        .map(str::trim)
        .filter(|f| !f.is_empty())
        .unwrap_or("json")
        .to_string();

    // Serialised up front so the stored bytes and the reported size are the
    // same bytes. Measuring the request instead would report a number that
    // does not describe what is on disk.
    let encoded: Vec<String> = body
        .entries
        .iter()
        .map(|e| serde_json::to_string(e).unwrap_or_else(|_| "null".to_string()))
        .collect();
    let size_bytes: i64 = encoded.iter().map(|e| e.len() as i64).sum();

    let id = uuid::Uuid::new_v4().to_string();
    let now = now_ms();

    let mut db = state.db.lock().unwrap();
    if let Err(e) = init_dataset_tables(&db.conn) {
        return db_error(e);
    }

    let tx = match db.conn.transaction() {
        Ok(t) => t,
        Err(e) => return db_error(e),
    };

    let write = (|| -> rusqlite::Result<()> {
        tx.execute(
            "INSERT INTO datasets
             (id, name, dataset_type, format, entry_count, size_bytes, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
            params![
                id,
                body.name.trim(),
                dataset_type,
                format,
                encoded.len() as i64,
                size_bytes,
                now,
            ],
        )?;
        for (index, content) in encoded.iter().enumerate() {
            tx.execute(
                "INSERT INTO dataset_entries (dataset_id, entry_index, content)
                 VALUES (?1, ?2, ?3)",
                params![id, index as i64, content],
            )?;
        }
        Ok(())
    })();

    if let Err(e) = write {
        return db_error(e);
    }
    if let Err(e) = tx.commit() {
        return db_error(e);
    }

    ok(DatasetSummary {
        id,
        name: body.name.trim().to_string(),
        dataset_type: dataset_type.to_string(),
        format,
        entry_count: encoded.len() as i64,
        size_bytes,
        created_at: now,
        updated_at: now,
    })
}

fn read_summaries(conn: &Connection, id: Option<&str>) -> rusqlite::Result<Vec<DatasetSummary>> {
    let sql = "SELECT id, name, dataset_type, format, entry_count, size_bytes,
                      created_at, updated_at
               FROM datasets";
    let map = |row: &rusqlite::Row| {
        Ok(DatasetSummary {
            id: row.get(0)?,
            name: row.get(1)?,
            dataset_type: row.get(2)?,
            format: row.get(3)?,
            entry_count: row.get(4)?,
            size_bytes: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    };

    match id {
        Some(id) => {
            let mut stmt = conn.prepare(&format!("{sql} WHERE id = ?1"))?;
            let rows = stmt
                .query_map(params![id], map)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(rows)
        }
        None => {
            let mut stmt = conn.prepare(&format!("{sql} ORDER BY created_at DESC"))?;
            let rows = stmt
                .query_map([], map)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(rows)
        }
    }
}

/// List stored datasets, newest first.
///
/// Without their entries: a listing that carried every record would be the
/// whole store in one response, and none of it is shown in a list.
pub async fn list_datasets(state: State) -> HttpResponse {
    let db = state.db.lock().unwrap();
    if let Err(e) = init_dataset_tables(&db.conn) {
        return db_error(e);
    }
    match read_summaries(&db.conn, None) {
        Ok(datasets) => ok(datasets),
        Err(e) => db_error(e),
    }
}

/// One dataset's metadata. Its entries come from the `/entries` page.
pub async fn get_dataset(state: State, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let db = state.db.lock().unwrap();
    if let Err(e) = init_dataset_tables(&db.conn) {
        return db_error(e);
    }
    match read_summaries(&db.conn, Some(&id)) {
        Ok(mut found) if !found.is_empty() => ok(found.remove(0)),
        Ok(_) => not_found(),
        Err(e) => db_error(e),
    }
}

#[derive(Debug, Deserialize)]
pub struct EntriesQuery {
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

/// A page of a dataset's entries, in the order they were uploaded.
///
/// Paged rather than whole: a dataset is allowed 50,000 records and nothing
/// renders that many at once. `total` is reported alongside so a caller can
/// tell a short last page from an empty dataset.
pub async fn list_dataset_entries(
    state: State,
    path: web::Path<String>,
    query: web::Query<EntriesQuery>,
) -> HttpResponse {
    let id = path.into_inner();
    let limit = query.limit.unwrap_or(DEFAULT_PAGE).clamp(1, MAX_PAGE);
    let offset = query.offset.unwrap_or(0);

    let db = state.db.lock().unwrap();
    if let Err(e) = init_dataset_tables(&db.conn) {
        return db_error(e);
    }

    // Checked first: a missing dataset and an out-of-range page both produce
    // an empty list, and they are not the same answer.
    let total: Option<i64> = match db
        .conn
        .query_row(
            "SELECT entry_count FROM datasets WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .optional()
    {
        Ok(t) => t,
        Err(e) => return db_error(e),
    };
    let Some(total) = total else {
        return not_found();
    };

    let entries: rusqlite::Result<Vec<serde_json::Value>> = (|| {
        let mut stmt = db.conn.prepare(
            "SELECT content FROM dataset_entries
             WHERE dataset_id = ?1 ORDER BY entry_index LIMIT ?2 OFFSET ?3",
        )?;
        let rows = stmt
            .query_map(params![id, limit as i64, offset as i64], |row| {
                let raw: String = row.get(0)?;
                // Stored as JSON text; handed back as JSON rather than as a
                // string of JSON, which the clients would have to parse again.
                Ok(serde_json::from_str(&raw).unwrap_or(serde_json::Value::Null))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    })();

    match entries {
        Ok(entries) => ok(json!({
            "datasetId": id,
            "total": total,
            "limit": limit,
            "offset": offset,
            "entries": entries,
        })),
        Err(e) => db_error(e),
    }
}

/// Delete a dataset and its entries.
pub async fn delete_dataset(state: State, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let db = state.db.lock().unwrap();
    if let Err(e) = init_dataset_tables(&db.conn) {
        return db_error(e);
    }

    // Entries explicitly, not by cascade: SQLite has `PRAGMA foreign_keys` off
    // by default, so the declaration on the table does not fire on its own and
    // the rows would be orphaned -- counted against nothing, deleted by
    // nothing.
    if let Err(e) = db.conn.execute(
        "DELETE FROM dataset_entries WHERE dataset_id = ?1",
        params![id],
    ) {
        return db_error(e);
    }

    match db
        .conn
        .execute("DELETE FROM datasets WHERE id = ?1", params![id])
    {
        Ok(0) => not_found(),
        Ok(_) => ok(json!({ "deleted": true })),
        Err(e) => db_error(e),
    }
}

pub fn configure_dataset_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/datasets")
            .route("", web::get().to(list_datasets))
            .route("", web::post().to(create_dataset))
            .route("/{id}", web::get().to(get_dataset))
            .route("/{id}", web::delete().to(delete_dataset))
            .route("/{id}/entries", web::get().to(list_dataset_entries)),
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ChatDatabase;
    use actix_web::{test, App};
    use std::path::PathBuf;

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
                    .configure(configure_dataset_routes),
            )
            .await
        };
    }

    async fn body_json(resp: actix_web::dev::ServiceResponse) -> serde_json::Value {
        serde_json::from_slice(&test::read_body(resp).await).expect("json body")
    }

    async fn create(
        state: &web::Data<AppState>,
        payload: serde_json::Value,
    ) -> actix_web::dev::ServiceResponse {
        let app = app!(state);
        test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/datasets")
                .set_json(payload)
                .to_request(),
        )
        .await
    }

    /// A fresh install answers rather than failing on a missing table.
    #[tokio::test]
    async fn listing_works_before_anything_is_uploaded() {
        let (state, _dir) = temp_state("ds-empty");
        let app = app!(&state);

        let resp = test::call_service(
            &app,
            test::TestRequest::get().uri("/api/datasets").to_request(),
        )
        .await;
        assert_eq!(resp.status(), 200);
        assert_eq!(
            body_json(resp).await["data"].as_array().map(|a| a.len()),
            Some(0)
        );
    }

    /// The reported counts describe what was stored, not what was claimed.
    ///
    /// This is the assertion the module exists for: the fixtures it replaced
    /// reported "12.5 GB" and "4.2M samples" for data that did not exist, and
    /// a client-supplied size would be the same defect with extra steps.
    #[tokio::test]
    async fn counts_are_measured_not_taken_from_the_request() {
        let (state, _dir) = temp_state("ds-counts");

        let resp = create(
            &state,
            json!({
                "name": "Support transcripts",
                "type": "conversations",
                // Deliberately absurd, and deliberately ignored.
                "entryCount": 4_200_000,
                "sizeBytes": 13_421_772_800i64,
                "entries": [{ "q": "a" }, { "q": "bb" }, { "q": "ccc" }],
            }),
        )
        .await;
        assert_eq!(resp.status(), 200);

        let body = body_json(resp).await;
        assert_eq!(body["data"]["entryCount"], 3);

        let reported = body["data"]["sizeBytes"].as_i64().expect("sizeBytes");
        assert!(
            reported > 0 && reported < 1_000,
            "sizeBytes {reported} is not the size of three tiny records"
        );

        // And it matches what is actually on disk.
        let db = state.db.lock().unwrap();
        let stored: i64 = db
            .conn
            .query_row(
                "SELECT SUM(LENGTH(content)) FROM dataset_entries",
                [],
                |r| r.get(0),
            )
            .expect("sum");
        assert_eq!(reported, stored);
    }

    /// Entries come back as JSON, in upload order, with a total.
    #[tokio::test]
    async fn entries_page_in_order_and_report_the_total() {
        let (state, _dir) = temp_state("ds-page");

        let entries: Vec<serde_json::Value> = (0..10).map(|i| json!({ "i": i })).collect();
        let resp = create(&state, json!({ "name": "Ten", "entries": entries })).await;
        let id = body_json(resp).await["data"]["id"]
            .as_str()
            .expect("id")
            .to_string();

        let app = app!(&state);
        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri(&format!("/api/datasets/{id}/entries?limit=3&offset=4"))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 200);

        let body = body_json(resp).await;
        assert_eq!(body["data"]["total"], 10);
        assert_eq!(body["data"]["offset"], 4);

        let page = body["data"]["entries"].as_array().expect("entries");
        assert_eq!(page.len(), 3);
        // JSON, not a string of JSON, and in the order uploaded.
        assert_eq!(page[0]["i"], 4);
        assert_eq!(page[2]["i"], 6);
    }

    /// A missing dataset and an empty page are different answers.
    ///
    /// Both would otherwise render as "no entries", which is the same class of
    /// mistake as an empty inbox that is really an unreachable server.
    #[tokio::test]
    async fn entries_for_an_unknown_dataset_are_a_404_not_an_empty_page() {
        let (state, _dir) = temp_state("ds-404");
        let app = app!(&state);

        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/datasets/nope/entries")
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 404);
    }

    /// A page past the end is empty but still a 200 with the real total.
    #[tokio::test]
    async fn a_page_past_the_end_is_empty_but_reports_the_total() {
        let (state, _dir) = temp_state("ds-past");
        let resp = create(&state, json!({ "name": "One", "entries": [{ "a": 1 }] })).await;
        let id = body_json(resp).await["data"]["id"]
            .as_str()
            .expect("id")
            .to_string();

        let app = app!(&state);
        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri(&format!("/api/datasets/{id}/entries?offset=99"))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 200);

        let body = body_json(resp).await;
        assert_eq!(body["data"]["total"], 1);
        assert_eq!(body["data"]["entries"].as_array().map(|a| a.len()), Some(0));
    }

    #[tokio::test]
    async fn an_empty_or_nameless_upload_is_rejected() {
        let (state, _dir) = temp_state("ds-bad");

        for payload in [
            json!({ "name": "", "entries": [{ "a": 1 }] }),
            json!({ "name": "  ", "entries": [{ "a": 1 }] }),
            json!({ "name": "Fine", "entries": [] }),
        ] {
            let resp = create(&state, payload.clone()).await;
            assert_eq!(resp.status(), 400, "accepted {payload}");
        }

        let db = state.db.lock().unwrap();
        init_dataset_tables(&db.conn).expect("tables");
        let count: i64 = db
            .conn
            .query_row("SELECT COUNT(*) FROM datasets", [], |r| r.get(0))
            .expect("count");
        assert_eq!(count, 0, "a rejected upload still stored a dataset");
    }

    #[tokio::test]
    async fn an_unknown_type_is_rejected_rather_than_stored() {
        let (state, _dir) = temp_state("ds-type");
        let resp = create(
            &state,
            json!({ "name": "X", "type": "embeddings", "entries": [{ "a": 1 }] }),
        )
        .await;
        assert_eq!(resp.status(), 400);
    }

    /// The default type is the one the clients render for anything unlabelled.
    #[tokio::test]
    async fn an_unlabelled_dataset_defaults_to_custom() {
        let (state, _dir) = temp_state("ds-default");
        let resp = create(&state, json!({ "name": "X", "entries": [{ "a": 1 }] })).await;
        let body = body_json(resp).await;
        assert_eq!(body["data"]["type"], "custom");
        assert_eq!(body["data"]["format"], "json");
    }

    /// Deleting a dataset takes its entries with it.
    ///
    /// Explicitly, because SQLite leaves `PRAGMA foreign_keys` off by default,
    /// so the ON DELETE CASCADE on the table never fires on its own.
    #[tokio::test]
    async fn deleting_a_dataset_removes_its_entries() {
        let (state, _dir) = temp_state("ds-cascade");
        let resp = create(
            &state,
            json!({ "name": "Gone", "entries": [{ "a": 1 }, { "b": 2 }] }),
        )
        .await;
        let id = body_json(resp).await["data"]["id"]
            .as_str()
            .expect("id")
            .to_string();

        let app = app!(&state);
        let resp = test::call_service(
            &app,
            test::TestRequest::delete()
                .uri(&format!("/api/datasets/{id}"))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 200);

        let db = state.db.lock().unwrap();
        let left: i64 = db
            .conn
            .query_row("SELECT COUNT(*) FROM dataset_entries", [], |r| r.get(0))
            .expect("count");
        assert_eq!(left, 0, "entries outlived their dataset");
    }

    #[tokio::test]
    async fn deleting_an_unknown_dataset_is_a_404() {
        let (state, _dir) = temp_state("ds-del404");
        let app = app!(&state);
        let resp = test::call_service(
            &app,
            test::TestRequest::delete()
                .uri("/api/datasets/nope")
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 404);
    }

    /// `{id}/entries` must not be captured by the bare `{id}` route.
    #[tokio::test]
    async fn the_entries_sub_path_is_not_captured_by_the_id_route() {
        let (state, _dir) = temp_state("ds-shadow");
        let resp = create(&state, json!({ "name": "S", "entries": [{ "a": 1 }] })).await;
        let id = body_json(resp).await["data"]["id"]
            .as_str()
            .expect("id")
            .to_string();

        let app = app!(&state);
        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri(&format!("/api/datasets/{id}/entries"))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 200);

        // The entries shape, not the summary shape.
        let body = body_json(resp).await;
        assert!(
            body["data"]["entries"].is_array(),
            "the summary handler answered instead: {body}"
        );
    }
}
