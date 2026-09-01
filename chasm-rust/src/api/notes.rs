// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
//! Clippings (`/api/notes`)
//!
//! Text selected in a page and sent here by the browser extension's
//! "Save Selection to Chasm" context menu.
//!
//! # Why this exists
//!
//! The extension has posted to `POST /api/notes` since it was written, and
//! nothing has ever routed that path. Every save answered 404.
//!
//! To its credit the extension checked: it inspects `apiResponse.ok` and
//! raises "Save Failed" when the server says no, so the feature was visibly
//! broken rather than quietly so -- the honest failure that most of the code
//! this audit touched did not manage. It was the only unrouted path the
//! extension referenced; `/api/sessions`, `/api/harvest`, `/api/stats` and
//! `/api/health` all exist.
//!
//! # What is stored
//!
//! What the extension sends, and nothing derived from it. A clipping has the
//! selected text, the page it came from, and two times: `capturedAt`, the
//! client's own clock as it sent it, kept verbatim and never treated as
//! authoritative, and `createdAt`, when this server wrote the row.
//!
//! The extension also sends `"type": "note"`, a constant. It is not stored --
//! a column whose every value is the same word records nothing -- and serde
//! drops it along with any other unrecognised field.
//!
//! # Readable, or it is not a store
//!
//! `GET` and `DELETE` exist because a write-only endpoint cannot be shown to
//! work by anything except itself. Nothing in the UI lists clippings yet; the
//! endpoint is what a client would need in order to.

use actix_web::{web, HttpResponse};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::json;

use super::state::AppState;

type State = web::Data<AppState>;

/// A selection is a paragraph or a page, not a book. Past this the caller is
/// sending something a clipping store is the wrong home for, and saying so is
/// better than accepting an unbounded row.
const MAX_CONTENT_CHARS: usize = 100_000;

/// Long enough for any URL a browser will produce.
const MAX_URL_CHARS: usize = 4_096;

const DEFAULT_LIMIT: usize = 100;
const MAX_LIMIT: usize = 500;

// =============================================================================
// Schema
// =============================================================================

pub fn init_notes_tables(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            source TEXT,
            url TEXT,
            captured_at TEXT,
            created_at INTEGER NOT NULL
        )",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC)",
        [],
    )?;
    Ok(())
}

// =============================================================================
// Wire types
// =============================================================================

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    /// The selected text, as it was selected.
    pub content: String,
    /// The hostname the extension read off the tab, e.g. `arxiv.org`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    /// The client's clock when it captured the selection. Kept verbatim and
    /// not parsed -- it is the caller's word, and ordering uses `createdAt`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub captured_at: Option<String>,
    /// When this server wrote the row. Milliseconds since the epoch.
    pub created_at: i64,
}

/// What `POST /api/notes` accepts -- the body the extension already sends.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoteRequest {
    pub content: String,
    pub source: Option<String>,
    pub url: Option<String>,
    /// The extension calls this `timestamp`; it is stored as `capturedAt`.
    #[serde(alias = "capturedAt")]
    pub timestamp: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub limit: Option<usize>,
    /// Substring match over content, source and url. Absent means everything.
    pub q: Option<String>,
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

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Trimmed values ready to store, or the reason the request is a 400.
///
/// Split out from the handler so every rejection is reachable from a test
/// without a database behind it.
type CleanNote = (String, Option<String>, Option<String>, Option<String>);

fn validate(req: &CreateNoteRequest) -> Result<CleanNote, String> {
    let content = req.content.trim();
    if content.is_empty() {
        return Err("content is required".into());
    }
    if content.chars().count() > MAX_CONTENT_CHARS {
        return Err(format!(
            "content is longer than {MAX_CONTENT_CHARS} characters"
        ));
    }

    let clean = |value: &Option<String>, limit: usize| -> Option<String> {
        value
            .as_deref()
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .map(|v| v.chars().take(limit).collect())
    };

    let source = clean(&req.source, 255);
    let url = clean(&req.url, MAX_URL_CHARS);
    let captured_at = clean(&req.timestamp, 64);

    Ok((content.to_string(), source, url, captured_at))
}

fn row_to_note(row: &rusqlite::Row<'_>) -> rusqlite::Result<Note> {
    Ok(Note {
        id: row.get(0)?,
        content: row.get(1)?,
        source: row.get(2)?,
        url: row.get(3)?,
        captured_at: row.get(4)?,
        created_at: row.get(5)?,
    })
}

// =============================================================================
// Handlers
// =============================================================================

/// Save a clipping.
///
/// Not idempotent, and deliberately: selecting the same sentence twice is two
/// clippings, and there is no key on which a second one could be recognised
/// as the first.
pub async fn create_note(state: State, body: web::Json<CreateNoteRequest>) -> HttpResponse {
    let req = body.into_inner();
    let (content, source, url, captured_at) = match validate(&req) {
        Ok(values) => values,
        Err(message) => return fail(actix_web::http::StatusCode::BAD_REQUEST, message),
    };

    let db = state.db.lock().unwrap();
    if let Err(e) = init_notes_tables(&db.conn) {
        return db_error(e);
    }

    let note = Note {
        id: uuid::Uuid::new_v4().to_string(),
        content,
        source,
        url,
        captured_at,
        created_at: now_ms(),
    };

    let result = db.conn.execute(
        "INSERT INTO notes (id, content, source, url, captured_at, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            note.id,
            note.content,
            note.source,
            note.url,
            note.captured_at,
            note.created_at,
        ],
    );

    match result {
        Ok(_) => {
            HttpResponse::Created().json(json!({ "success": true, "data": note, "error": null }))
        }
        Err(e) => db_error(e),
    }
}

/// Clippings, most recent first.
pub async fn list_notes(state: State, query: web::Query<ListQuery>) -> HttpResponse {
    let limit = query.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    let search = query
        .q
        .as_deref()
        .map(str::trim)
        .filter(|q| !q.is_empty())
        .map(|q| format!("%{q}%"));

    let db = state.db.lock().unwrap();
    if let Err(e) = init_notes_tables(&db.conn) {
        return db_error(e);
    }

    let result: rusqlite::Result<Vec<Note>> = (|| match &search {
        Some(pattern) => {
            let mut stmt = db.conn.prepare(
                "SELECT id, content, source, url, captured_at, created_at FROM notes
                 WHERE content LIKE ?1 OR IFNULL(source, '') LIKE ?1
                    OR IFNULL(url, '') LIKE ?1
                 ORDER BY created_at DESC LIMIT ?2",
            )?;
            // Materialized before returning: the rows borrow `stmt`, which
            // does not outlive this arm.
            let rows = stmt
                .query_map(params![pattern, limit as i64], row_to_note)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(rows)
        }
        None => {
            let mut stmt = db.conn.prepare(
                "SELECT id, content, source, url, captured_at, created_at FROM notes
                 ORDER BY created_at DESC LIMIT ?1",
            )?;
            let rows = stmt
                .query_map(params![limit as i64], row_to_note)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(rows)
        }
    })();

    match result {
        Ok(notes) => ok(notes),
        Err(e) => db_error(e),
    }
}

pub async fn get_note(state: State, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let db = state.db.lock().unwrap();
    if let Err(e) = init_notes_tables(&db.conn) {
        return db_error(e);
    }

    let found = db.conn.query_row(
        "SELECT id, content, source, url, captured_at, created_at FROM notes WHERE id = ?1",
        params![id],
        row_to_note,
    );

    match found {
        Ok(note) => ok(note),
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            fail(actix_web::http::StatusCode::NOT_FOUND, "No such note")
        }
        Err(e) => db_error(e),
    }
}

pub async fn delete_note(state: State, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let db = state.db.lock().unwrap();
    if let Err(e) = init_notes_tables(&db.conn) {
        return db_error(e);
    }

    match db
        .conn
        .execute("DELETE FROM notes WHERE id = ?1", params![id])
    {
        Ok(0) => fail(actix_web::http::StatusCode::NOT_FOUND, "No such note"),
        Ok(_) => ok(json!({ "deleted": true })),
        Err(e) => db_error(e),
    }
}

pub fn configure_notes_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/notes")
            .route("", web::get().to(list_notes))
            .route("", web::post().to(create_note))
            .route("/{id}", web::get().to(get_note))
            .route("/{id}", web::delete().to(delete_note)),
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ChatDatabase;
    use actix_web::{test, App};

    fn request(content: &str) -> CreateNoteRequest {
        CreateNoteRequest {
            content: content.to_string(),
            source: None,
            url: None,
            timestamp: None,
        }
    }

    // -- validation, without a database -------------------------------------

    #[test]
    fn empty_content_is_rejected() {
        assert_eq!(
            validate(&request("   \n  ")).unwrap_err(),
            "content is required"
        );
    }

    #[test]
    fn content_past_the_cap_is_rejected() {
        let long = "a".repeat(MAX_CONTENT_CHARS + 1);
        assert!(validate(&request(&long))
            .unwrap_err()
            .contains("longer than"));
    }

    #[test]
    fn content_at_the_cap_is_accepted() {
        let exact = "a".repeat(MAX_CONTENT_CHARS);
        assert!(validate(&request(&exact)).is_ok());
    }

    /// The cap counts characters, not bytes, so a selection of accented or CJK
    /// text is not rejected at a third of the length of an ASCII one.
    #[test]
    fn the_cap_counts_characters_not_bytes() {
        let wide = "\u{4f60}".repeat(MAX_CONTENT_CHARS);
        assert!(wide.len() > MAX_CONTENT_CHARS);
        assert!(validate(&request(&wide)).is_ok());
    }

    #[test]
    fn blank_optional_fields_become_none() {
        let mut req = request("something");
        req.source = Some("   ".into());
        req.url = Some(String::new());
        let (_, source, url, captured) = validate(&req).unwrap();
        assert_eq!(source, None);
        assert_eq!(url, None);
        assert_eq!(captured, None);
    }

    #[test]
    fn an_overlong_url_is_truncated_not_rejected() {
        let mut req = request("something");
        req.url = Some(format!("https://x.test/{}", "a".repeat(MAX_URL_CHARS)));
        let (_, _, url, _) = validate(&req).unwrap();
        assert_eq!(url.unwrap().chars().count(), MAX_URL_CHARS);
    }

    // -- deserialization ----------------------------------------------------

    /// Byte-for-byte what `handleExportSelection` in the extension's service
    /// worker sends. If this stops deserializing, that context menu is broken.
    #[test]
    fn the_body_the_extension_sends_deserializes() {
        let body = r#"{
            "type": "note",
            "content": "a selected sentence",
            "source": "arxiv.org",
            "url": "https://arxiv.org/abs/2201.00978",
            "timestamp": "2026-08-31T10:00:00.000Z"
        }"#;
        let req: CreateNoteRequest = serde_json::from_str(body).expect("deserialize");
        assert_eq!(req.content, "a selected sentence");
        assert_eq!(req.source.as_deref(), Some("arxiv.org"));
        assert_eq!(req.timestamp.as_deref(), Some("2026-08-31T10:00:00.000Z"));
    }

    /// `type` is a constant the extension sends and this server does not keep.
    /// Dropping it must not be an error.
    #[test]
    fn the_constant_type_field_is_ignored() {
        let req: CreateNoteRequest =
            serde_json::from_str(r#"{"type":"note","content":"x"}"#).expect("deserialize");
        assert_eq!(req.content, "x");
    }

    #[test]
    fn a_note_serializes_camel_case_and_omits_absent_fields() {
        let note = Note {
            id: "n1".into(),
            content: "text".into(),
            source: None,
            url: None,
            captured_at: Some("2026-08-31T10:00:00Z".into()),
            created_at: 1_756_600_000_000,
        };
        let json = serde_json::to_value(&note).unwrap();
        assert_eq!(json["capturedAt"], "2026-08-31T10:00:00Z");
        assert_eq!(json["createdAt"], 1_756_600_000_000_i64);
        assert!(json.get("source").is_none());
        assert!(json.get("url").is_none());
    }

    // -- the routes, end to end ---------------------------------------------

    fn state() -> (tempfile::TempDir, web::Data<AppState>) {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("notes.db");
        crate::commands::create_harvest_database(&path).expect("schema");
        let db = ChatDatabase::open(&path).expect("open");
        let state = web::Data::new(AppState::new(db, path));
        (dir, state)
    }

    #[tokio::test]
    async fn a_saved_clipping_comes_back() {
        let (_dir, state) = state();
        let app = test::init_service(
            App::new()
                .app_data(state.clone())
                .configure(configure_notes_routes),
        )
        .await;

        let created = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/notes")
                .set_json(serde_json::json!({
                    "type": "note",
                    "content": "a selected sentence",
                    "source": "arxiv.org",
                    "url": "https://arxiv.org/abs/2201.00978",
                    "timestamp": "2026-08-31T10:00:00.000Z"
                }))
                .to_request(),
        )
        .await;
        assert_eq!(created.status(), 201);
        let body: serde_json::Value = test::read_body_json(created).await;
        let id = body["data"]["id"].as_str().expect("id").to_string();
        assert_eq!(body["data"]["content"], "a selected sentence");
        // The client's clock is kept verbatim.
        assert_eq!(body["data"]["capturedAt"], "2026-08-31T10:00:00.000Z");

        let listed = test::call_service(
            &app,
            test::TestRequest::get().uri("/api/notes").to_request(),
        )
        .await;
        assert_eq!(listed.status(), 200);
        let body: serde_json::Value = test::read_body_json(listed).await;
        let notes = body["data"].as_array().expect("array");
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0]["id"], id.as_str());

        let one = test::call_service(
            &app,
            test::TestRequest::get()
                .uri(&format!("/api/notes/{id}"))
                .to_request(),
        )
        .await;
        assert_eq!(one.status(), 200);
    }

    #[tokio::test]
    async fn empty_content_answers_400_and_stores_nothing() {
        let (_dir, state) = state();
        let app = test::init_service(
            App::new()
                .app_data(state.clone())
                .configure(configure_notes_routes),
        )
        .await;

        let response = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/notes")
                .set_json(serde_json::json!({ "type": "note", "content": "  " }))
                .to_request(),
        )
        .await;
        assert_eq!(response.status(), 400);

        let listed = test::call_service(
            &app,
            test::TestRequest::get().uri("/api/notes").to_request(),
        )
        .await;
        let body: serde_json::Value = test::read_body_json(listed).await;
        assert!(body["data"].as_array().expect("array").is_empty());
    }

    /// Two identical selections are two clippings. There is no key that could
    /// make the second one recognisable as the first, so it does not pretend.
    #[tokio::test]
    async fn saving_the_same_text_twice_makes_two_clippings() {
        let (_dir, state) = state();
        let app = test::init_service(
            App::new()
                .app_data(state.clone())
                .configure(configure_notes_routes),
        )
        .await;

        for _ in 0..2 {
            let response = test::call_service(
                &app,
                test::TestRequest::post()
                    .uri("/api/notes")
                    .set_json(serde_json::json!({ "content": "same words" }))
                    .to_request(),
            )
            .await;
            assert_eq!(response.status(), 201);
        }

        let listed = test::call_service(
            &app,
            test::TestRequest::get().uri("/api/notes").to_request(),
        )
        .await;
        let body: serde_json::Value = test::read_body_json(listed).await;
        assert_eq!(body["data"].as_array().expect("array").len(), 2);
    }

    #[tokio::test]
    async fn search_matches_content_source_and_url() {
        let (_dir, state) = state();
        let app = test::init_service(
            App::new()
                .app_data(state.clone())
                .configure(configure_notes_routes),
        )
        .await;

        for note in [
            serde_json::json!({ "content": "transformers", "source": "arxiv.org" }),
            serde_json::json!({ "content": "rust ownership", "url": "https://doc.rust-lang.org/" }),
        ] {
            test::call_service(
                &app,
                test::TestRequest::post()
                    .uri("/api/notes")
                    .set_json(note)
                    .to_request(),
            )
            .await;
        }

        for (query, expected) in [
            ("transformers", 1),
            ("arxiv", 1),
            ("rust-lang", 1),
            ("zzz", 0),
        ] {
            let response = test::call_service(
                &app,
                test::TestRequest::get()
                    .uri(&format!("/api/notes?q={query}"))
                    .to_request(),
            )
            .await;
            let body: serde_json::Value = test::read_body_json(response).await;
            assert_eq!(
                body["data"].as_array().expect("array").len(),
                expected,
                "query {query}"
            );
        }
    }

    #[tokio::test]
    async fn the_limit_is_honoured_and_capped() {
        let (_dir, state) = state();
        let app = test::init_service(
            App::new()
                .app_data(state.clone())
                .configure(configure_notes_routes),
        )
        .await;

        for i in 0..3 {
            test::call_service(
                &app,
                test::TestRequest::post()
                    .uri("/api/notes")
                    .set_json(serde_json::json!({ "content": format!("note {i}") }))
                    .to_request(),
            )
            .await;
        }

        let response = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/notes?limit=2")
                .to_request(),
        )
        .await;
        let body: serde_json::Value = test::read_body_json(response).await;
        assert_eq!(body["data"].as_array().expect("array").len(), 2);

        // A limit of zero is a client bug, not a request for nothing.
        let response = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/notes?limit=0")
                .to_request(),
        )
        .await;
        let body: serde_json::Value = test::read_body_json(response).await;
        assert_eq!(body["data"].as_array().expect("array").len(), 1);
    }

    #[tokio::test]
    async fn deleting_removes_it_and_deleting_again_is_404() {
        let (_dir, state) = state();
        let app = test::init_service(
            App::new()
                .app_data(state.clone())
                .configure(configure_notes_routes),
        )
        .await;

        let created = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/notes")
                .set_json(serde_json::json!({ "content": "temporary" }))
                .to_request(),
        )
        .await;
        let body: serde_json::Value = test::read_body_json(created).await;
        let id = body["data"]["id"].as_str().expect("id").to_string();

        let deleted = test::call_service(
            &app,
            test::TestRequest::delete()
                .uri(&format!("/api/notes/{id}"))
                .to_request(),
        )
        .await;
        assert_eq!(deleted.status(), 200);

        let again = test::call_service(
            &app,
            test::TestRequest::delete()
                .uri(&format!("/api/notes/{id}"))
                .to_request(),
        )
        .await;
        assert_eq!(again.status(), 404);

        let missing = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/notes/does-not-exist")
                .to_request(),
        )
        .await;
        assert_eq!(missing.status(), 404);
    }

    /// The search pattern is bound as a parameter, never concatenated into
    /// the SQL, so a query that reads like a statement is only ever a query.
    ///
    /// Note what this does *not* claim: `%` and `_` inside `q` are still LIKE
    /// wildcards, because binding a parameter does not escape LIKE
    /// metacharacters. A search for `%` matches everything. That is a
    /// surprising search, not an unsafe one, and it is asserted below so the
    /// behaviour is recorded rather than assumed.
    #[tokio::test]
    async fn a_search_that_looks_like_sql_is_only_ever_a_search() {
        let (_dir, state) = state();
        let app = test::init_service(
            App::new()
                .app_data(state.clone())
                .configure(configure_notes_routes),
        )
        .await;

        for content in ["plain text", "more text"] {
            test::call_service(
                &app,
                test::TestRequest::post()
                    .uri("/api/notes")
                    .set_json(serde_json::json!({ "content": content }))
                    .to_request(),
            )
            .await;
        }

        // `x'; DROP TABLE notes; --`, percent-encoded.
        let response = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/notes?q=x%27%3B%20DROP%20TABLE%20notes%3B%20--")
                .to_request(),
        )
        .await;
        assert_eq!(response.status(), 200);
        let body: serde_json::Value = test::read_body_json(response).await;
        assert!(body["data"].as_array().expect("array").is_empty());

        // The table is still there, with both rows in it.
        let listed = test::call_service(
            &app,
            test::TestRequest::get().uri("/api/notes").to_request(),
        )
        .await;
        let body: serde_json::Value = test::read_body_json(listed).await;
        assert_eq!(body["data"].as_array().expect("array").len(), 2);

        // And the documented wildcard caveat: `%` matches everything.
        let response = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/notes?q=%25")
                .to_request(),
        )
        .await;
        let body: serde_json::Value = test::read_body_json(response).await;
        assert_eq!(body["data"].as_array().expect("array").len(), 2);
    }
}
