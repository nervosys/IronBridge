// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
//! Document knowledge base (`/api/documents`)
//!
//! Ingests a document, splits it, embeds the pieces and stores them, so they
//! can be retrieved by meaning rather than by substring.
//!
//! # Why this exists here rather than in `agency::memory`
//!
//! `agency::memory` already had the hard parts: five chunking strategies, a
//! vector store with SQLite persistence, an embedding provider. It had no
//! HTTP surface and no consumers anywhere in the tree. Routing it directly
//! would not have worked, though: `KnowledgeBase::add_document` chunks a
//! document and then indexes only the chunks that already carry an embedding,
//! and its own chunker produces every chunk with `embedding: None`. Nothing in
//! that path ever calls an embedding model, so a document added through it is
//! stored and is not searchable.
//!
//! So this module reuses what works -- the chunkers -- and owns the rest:
//! embedding, persistence and retrieval, all on the same machinery
//! `/api/search/semantic` already uses in production. One embedding path in
//! the server, not two that can disagree.
//!
//! # Tables
//!
//! `kb_documents` and `kb_document_chunks`, created on demand. The names are
//! prefixed deliberately: `sql/schema.sql` declares `documents` and
//! `document_chunks` with a different shape, and that file is not applied to
//! the server's database -- `create_harvest_database` builds a different set
//! of tables -- so taking those names would collide with a schema that may
//! yet be applied.
//!
//! # Refusing rather than guessing
//!
//! Ingestion and search both need an embedding model. With none configured
//! they answer 503 naming the variable, the same as `/api/search/semantic`.
//! Neither falls back to substring matching: a keyword hit dressed as a
//! semantic result is worse than an honest refusal.

use actix_web::{web, HttpResponse};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::json;

use super::handlers_write::{cosine, decode_vector, embedding_model, encode_vector, Embedder};
use super::state::AppState;
use crate::agency::memory::{ChunkingConfig, ChunkingStrategy, KnowledgeBase, VectorStoreConfig};

type State = web::Data<AppState>;

// =============================================================================
// Schema
// =============================================================================

/// Create the tables if this is the first documents call of the install.
///
/// Every handler here calls it, for the reason `delete_account` did not and
/// should have: a handler that assumes another one ran first fails with
/// "no such table" on exactly the installs that never used the feature.
fn init_document_tables(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS kb_documents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            source TEXT NOT NULL,
            doc_type TEXT NOT NULL,
            content TEXT NOT NULL,
            chunk_count INTEGER NOT NULL,
            token_count INTEGER NOT NULL,
            embedding_model TEXT NOT NULL,
            chunking_strategy TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS kb_document_chunks (
            document_id TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            token_count INTEGER NOT NULL,
            embedding BLOB NOT NULL,
            PRIMARY KEY (document_id, chunk_index),
            FOREIGN KEY (document_id) REFERENCES kb_documents(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_kb_chunks_doc ON kb_document_chunks(document_id);",
    )
}

// =============================================================================
// Wire types
// =============================================================================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestRequest {
    pub title: String,
    pub content: String,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub doc_type: Option<String>,
    /// One of the module's chunking strategies. Defaults to `semantic`.
    #[serde(default)]
    pub strategy: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentSummary {
    pub id: String,
    pub title: String,
    pub source: String,
    pub doc_type: String,
    pub chunk_count: i64,
    pub token_count: i64,
    pub embedding_model: String,
    pub chunking_strategy: String,
    pub created_at: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChunkMatch {
    pub document_id: String,
    pub document_title: String,
    pub chunk_index: i64,
    pub content: String,
    pub score: f32,
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

/// The 503 both ingestion and search give when no embedding model is set.
///
/// Worded the same as `/api/search/semantic`'s, because it is the same
/// missing configuration and a user hitting both should not have to work out
/// that they are the same problem.
fn no_embedding_model() -> HttpResponse {
    fail(
        actix_web::http::StatusCode::SERVICE_UNAVAILABLE,
        "No embedding model configured. Set OPENAI_API_KEY (and OPENAI_BASE_URL \
         for a local or self-hosted endpoint) on the server.",
    )
}

fn parse_strategy(name: Option<&str>) -> Result<ChunkingStrategy, String> {
    match name.unwrap_or("semantic") {
        "semantic" => Ok(ChunkingStrategy::Semantic),
        "paragraph" => Ok(ChunkingStrategy::Paragraph),
        "sentence" => Ok(ChunkingStrategy::Sentence),
        "fixed_size" => Ok(ChunkingStrategy::FixedSize),
        "code" => Ok(ChunkingStrategy::Code),
        other => Err(format!(
            "Unknown chunking strategy `{other}`. Use one of: semantic, \
             paragraph, sentence, fixed_size, code."
        )),
    }
}

fn strategy_name(strategy: &ChunkingStrategy) -> &'static str {
    match strategy {
        ChunkingStrategy::Semantic => "semantic",
        ChunkingStrategy::Paragraph => "paragraph",
        ChunkingStrategy::Sentence => "sentence",
        ChunkingStrategy::FixedSize => "fixed_size",
        ChunkingStrategy::Code => "code",
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

/// Ingest a document: chunk it, embed the chunks, store both.
///
/// The whole thing is one transaction. A document whose chunks are half
/// written is worse than one that was rejected: it would list with a chunk
/// count it does not have and return partial answers to searches.
pub async fn ingest_document(state: State, body: web::Json<IngestRequest>) -> HttpResponse {
    let body = body.into_inner();

    if body.content.trim().is_empty() {
        return fail(
            actix_web::http::StatusCode::BAD_REQUEST,
            "content is required and cannot be empty",
        );
    }
    if body.title.trim().is_empty() {
        return fail(
            actix_web::http::StatusCode::BAD_REQUEST,
            "title is required and cannot be empty",
        );
    }

    let strategy = match parse_strategy(body.strategy.as_deref()) {
        Ok(s) => s,
        Err(message) => return fail(actix_web::http::StatusCode::BAD_REQUEST, message),
    };

    // Checked before any work: chunking a large document and then discovering
    // there is nothing to embed with wastes the caller's time.
    let Some(embedder) = Embedder::from_env() else {
        return no_embedding_model();
    };

    // Chunking is `agency::memory`'s. A `KnowledgeBase` is built here only to
    // reach it -- nothing is stored in it, because its own indexing path
    // cannot index (see this module's header).
    let mut kb = KnowledgeBase::new(VectorStoreConfig::default());
    kb.set_chunking_config(ChunkingConfig {
        strategy: strategy.clone(),
        ..ChunkingConfig::default()
    });
    let chunks = kb.chunk_document(&body.content);

    if chunks.is_empty() {
        return fail(
            actix_web::http::StatusCode::BAD_REQUEST,
            "content produced no chunks",
        );
    }

    let texts: Vec<String> = chunks.iter().map(|c| c.content.clone()).collect();
    let vectors = match embedder.embed(&texts).await {
        Ok(v) => v,
        Err(e) => return fail(actix_web::http::StatusCode::BAD_GATEWAY, e),
    };

    let id = uuid::Uuid::new_v4().to_string();
    let source = body.source.unwrap_or_else(|| "upload".to_string());
    let doc_type = body.doc_type.unwrap_or_else(|| "text".to_string());
    let token_count: i64 = chunks.iter().map(|c| c.token_count as i64).sum();
    let model = embedding_model();
    let created_at = now_ms();

    let mut db = state.db.lock().unwrap();
    if let Err(e) = init_document_tables(&db.conn) {
        return db_error(e);
    }

    let tx = match db.conn.transaction() {
        Ok(t) => t,
        Err(e) => return db_error(e),
    };

    let write = (|| -> rusqlite::Result<()> {
        tx.execute(
            "INSERT INTO kb_documents
             (id, title, source, doc_type, content, chunk_count, token_count,
              embedding_model, chunking_strategy, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                id,
                body.title.trim(),
                source,
                doc_type,
                body.content,
                chunks.len() as i64,
                token_count,
                model,
                strategy_name(&strategy),
                created_at,
            ],
        )?;

        for (chunk, vector) in chunks.iter().zip(vectors.iter()) {
            tx.execute(
                "INSERT INTO kb_document_chunks
                 (document_id, chunk_index, content, token_count, embedding)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    id,
                    chunk.index as i64,
                    chunk.content,
                    chunk.token_count as i64,
                    encode_vector(vector),
                ],
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

    ok(DocumentSummary {
        id,
        title: body.title.trim().to_string(),
        source,
        doc_type,
        chunk_count: chunks.len() as i64,
        token_count,
        embedding_model: model,
        chunking_strategy: strategy_name(&strategy).to_string(),
        created_at,
    })
}

/// List stored documents, newest first.
///
/// Without their content: a listing that carried every document's full text
/// would grow without bound and none of it is shown in a list.
pub async fn list_documents(state: State) -> HttpResponse {
    let db = state.db.lock().unwrap();
    if let Err(e) = init_document_tables(&db.conn) {
        return db_error(e);
    }

    let result: rusqlite::Result<Vec<DocumentSummary>> = (|| {
        let mut stmt = db.conn.prepare(
            "SELECT id, title, source, doc_type, chunk_count, token_count,
                    embedding_model, chunking_strategy, created_at
             FROM kb_documents ORDER BY created_at DESC",
        )?;
        let rows = stmt
            .query_map([], |row| {
                Ok(DocumentSummary {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    source: row.get(2)?,
                    doc_type: row.get(3)?,
                    chunk_count: row.get(4)?,
                    token_count: row.get(5)?,
                    embedding_model: row.get(6)?,
                    chunking_strategy: row.get(7)?,
                    created_at: row.get(8)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    })();

    match result {
        Ok(documents) => ok(documents),
        Err(e) => db_error(e),
    }
}

/// One document, with its chunk texts.
///
/// The vectors are not returned. They are large, meaningless to a reader, and
/// nothing on the other side has a use for them.
pub async fn get_document(state: State, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let db = state.db.lock().unwrap();
    if let Err(e) = init_document_tables(&db.conn) {
        return db_error(e);
    }

    let document: Option<serde_json::Value> = match db
        .conn
        .query_row(
            "SELECT id, title, source, doc_type, content, chunk_count, token_count,
                    embedding_model, chunking_strategy, created_at
             FROM kb_documents WHERE id = ?1",
            params![id],
            |row| {
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "title": row.get::<_, String>(1)?,
                    "source": row.get::<_, String>(2)?,
                    "docType": row.get::<_, String>(3)?,
                    "content": row.get::<_, String>(4)?,
                    "chunkCount": row.get::<_, i64>(5)?,
                    "tokenCount": row.get::<_, i64>(6)?,
                    "embeddingModel": row.get::<_, String>(7)?,
                    "chunkingStrategy": row.get::<_, String>(8)?,
                    "createdAt": row.get::<_, i64>(9)?,
                }))
            },
        )
        .optional()
    {
        Ok(d) => d,
        Err(e) => return db_error(e),
    };

    let Some(mut document) = document else {
        return fail(actix_web::http::StatusCode::NOT_FOUND, "Document not found");
    };

    let chunks: rusqlite::Result<Vec<serde_json::Value>> = (|| {
        let mut stmt = db.conn.prepare(
            "SELECT chunk_index, content, token_count
             FROM kb_document_chunks WHERE document_id = ?1 ORDER BY chunk_index",
        )?;
        let rows = stmt
            .query_map(params![id], |row| {
                Ok(json!({
                    "index": row.get::<_, i64>(0)?,
                    "content": row.get::<_, String>(1)?,
                    "tokenCount": row.get::<_, i64>(2)?,
                }))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    })();

    match chunks {
        Ok(chunks) => {
            document["chunks"] = json!(chunks);
            ok(document)
        }
        Err(e) => db_error(e),
    }
}

/// Delete a document and its chunks.
pub async fn delete_document(state: State, path: web::Path<String>) -> HttpResponse {
    let id = path.into_inner();
    let db = state.db.lock().unwrap();
    if let Err(e) = init_document_tables(&db.conn) {
        return db_error(e);
    }

    // Chunks explicitly, not by cascade: `PRAGMA foreign_keys` is off by
    // default in SQLite, so the declaration on the table is not enough on its
    // own and the chunks would be orphaned -- still matching searches, for a
    // document that no longer exists.
    if let Err(e) = db.conn.execute(
        "DELETE FROM kb_document_chunks WHERE document_id = ?1",
        params![id],
    ) {
        return db_error(e);
    }

    match db
        .conn
        .execute("DELETE FROM kb_documents WHERE id = ?1", params![id])
    {
        Ok(0) => fail(actix_web::http::StatusCode::NOT_FOUND, "Document not found"),
        Ok(_) => ok(json!({ "deleted": true })),
        Err(e) => db_error(e),
    }
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: Option<String>,
    pub limit: Option<usize>,
}

/// Rank stored chunks against a query by meaning.
///
/// Reports `searched`, the number of chunks compared, for the reason
/// `/api/search/semantic` does: without it an empty knowledge base and a
/// query that genuinely matched nothing are the same empty array.
///
/// Chunks embedded under a different model are skipped rather than compared.
/// Vectors from two models are not in the same space, so the similarity
/// between them is a number with no meaning -- and it would rank.
pub async fn search_documents(state: State, query: web::Query<SearchQuery>) -> HttpResponse {
    let q = query.q.clone().unwrap_or_default();
    if q.trim().is_empty() {
        return fail(
            actix_web::http::StatusCode::BAD_REQUEST,
            "q is required and cannot be empty",
        );
    }
    let limit = query.limit.unwrap_or(10).clamp(1, 100);

    let Some(embedder) = Embedder::from_env() else {
        return no_embedding_model();
    };

    let model = embedding_model();

    // Read the candidates out before awaiting: the database guard is not held
    // across the embedding call, which goes over the network.
    let candidates: Vec<(String, String, i64, String, Vec<f32>)> = {
        let db = state.db.lock().unwrap();
        if let Err(e) = init_document_tables(&db.conn) {
            return db_error(e);
        }
        let rows: rusqlite::Result<Vec<_>> = (|| {
            let mut stmt = db.conn.prepare(
                "SELECT c.document_id, d.title, c.chunk_index, c.content, c.embedding
                 FROM kb_document_chunks c
                 JOIN kb_documents d ON d.id = c.document_id
                 WHERE d.embedding_model = ?1",
            )?;
            let rows = stmt
                .query_map(params![model], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, i64>(2)?,
                        row.get::<_, String>(3)?,
                        decode_vector(&row.get::<_, Vec<u8>>(4)?),
                    ))
                })?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(rows)
        })();
        match rows {
            Ok(r) => r,
            Err(e) => return db_error(e),
        }
    };

    let query_vector = match embedder.embed(std::slice::from_ref(&q)).await {
        Ok(mut v) if !v.is_empty() => v.remove(0),
        Ok(_) => {
            return fail(
                actix_web::http::StatusCode::BAD_GATEWAY,
                "embedding API returned no vector for the query",
            )
        }
        Err(e) => return fail(actix_web::http::StatusCode::BAD_GATEWAY, e),
    };

    let searched = candidates.len();
    let mut matches: Vec<ChunkMatch> = candidates
        .into_iter()
        .map(
            |(document_id, document_title, chunk_index, content, vector)| ChunkMatch {
                score: cosine(&query_vector, &vector),
                document_id,
                document_title,
                chunk_index,
                content,
            },
        )
        .collect();

    matches.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    matches.truncate(limit);

    ok(json!({
        "query": q,
        "searched": searched,
        "results": matches,
    }))
}

pub fn configure_document_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/documents")
            .route("", web::get().to(list_documents))
            .route("", web::post().to(ingest_document))
            // Before `/{id}`, or the literal would be captured as an id.
            .route("/search", web::get().to(search_documents))
            .route("/{id}", web::get().to(get_document))
            .route("/{id}", web::delete().to(delete_document)),
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ChatDatabase;
    use actix_web::{test, App};
    use std::path::PathBuf;

    /// `OPENAI_API_KEY` is process-wide, so these must not overlap.
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
                    .configure(configure_document_routes),
            )
            .await
        };
    }

    async fn body_json(resp: actix_web::dev::ServiceResponse) -> serde_json::Value {
        serde_json::from_slice(&test::read_body(resp).await).expect("json body")
    }

    /// Seed a document without going near an embedding model.
    ///
    /// Ingestion needs a live model and these tests must not need one, so the
    /// rows go in directly -- but through the same tables and the same
    /// `embedding_model()` value the handlers use, so retrieval sees exactly
    /// what ingestion would have written.
    fn seed(state: &web::Data<AppState>, id: &str, title: &str, chunks: &[(&str, Vec<f32>)]) {
        let db = state.db.lock().unwrap();
        init_document_tables(&db.conn).expect("tables");
        db.conn
            .execute(
                "INSERT INTO kb_documents
                 (id, title, source, doc_type, content, chunk_count, token_count,
                  embedding_model, chunking_strategy, created_at)
                 VALUES (?1, ?2, 'test', 'text', ?3, ?4, 0, ?5, 'semantic', 1)",
                params![
                    id,
                    title,
                    chunks.iter().map(|c| c.0).collect::<Vec<_>>().join("\n\n"),
                    chunks.len() as i64,
                    embedding_model(),
                ],
            )
            .expect("insert document");

        for (i, (content, vector)) in chunks.iter().enumerate() {
            db.conn
                .execute(
                    "INSERT INTO kb_document_chunks
                     (document_id, chunk_index, content, token_count, embedding)
                     VALUES (?1, ?2, ?3, 1, ?4)",
                    params![id, i as i64, content, encode_vector(vector)],
                )
                .expect("insert chunk");
        }
    }

    /// A fresh install must answer, not fail on a missing table.
    ///
    /// This is the shape that bit `delete_account`: every handler but one
    /// created its table first, so the one that did not failed only on
    /// databases that had never used the feature.
    #[tokio::test]
    async fn listing_works_before_anything_is_ingested() {
        let _guard = ENV_LOCK.lock().await;
        let (state, _dir) = temp_state("empty");
        let app = app!(&state);

        let resp = test::call_service(
            &app,
            test::TestRequest::get().uri("/api/documents").to_request(),
        )
        .await;
        assert_eq!(resp.status(), 200);
        let body = body_json(resp).await;
        assert_eq!(body["data"].as_array().map(|a| a.len()), Some(0));
    }

    /// With no model configured, ingestion refuses instead of storing a
    /// document that could never be found again.
    #[tokio::test]
    async fn ingest_without_an_embedding_model_is_a_503() {
        let _guard = ENV_LOCK.lock().await;
        let _no_key = NoKey::set();
        let (state, _dir) = temp_state("nomodel");
        let app = app!(&state);

        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/documents")
                .set_json(json!({ "title": "T", "content": "some text" }))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 503);

        let db = state.db.lock().unwrap();
        init_document_tables(&db.conn).expect("tables");
        let count: i64 = db
            .conn
            .query_row("SELECT COUNT(*) FROM kb_documents", [], |r| r.get(0))
            .expect("count");
        assert_eq!(count, 0, "a refused ingest still stored a document");
    }

    /// Search refuses for the same reason rather than falling back.
    ///
    /// A substring fallback dressed as a semantic result is worse than no
    /// answer -- `/api/search/semantic` refuses here too, deliberately.
    #[tokio::test]
    async fn search_without_an_embedding_model_is_a_503() {
        let _guard = ENV_LOCK.lock().await;
        let _no_key = NoKey::set();
        let (state, _dir) = temp_state("nomodelsearch");
        let app = app!(&state);

        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/documents/search?q=anything")
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 503);
    }

    /// An empty query is rejected before anything else happens.
    #[tokio::test]
    async fn search_requires_a_query() {
        let _guard = ENV_LOCK.lock().await;
        let (state, _dir) = temp_state("noquery");
        let app = app!(&state);

        for uri in ["/api/documents/search", "/api/documents/search?q=%20%20"] {
            let resp =
                test::call_service(&app, test::TestRequest::get().uri(uri).to_request()).await;
            assert_eq!(resp.status(), 400, "{uri} was not rejected");
        }
    }

    /// `/search` must not be swallowed by the `/{id}` route.
    ///
    /// Registration order is what keeps them apart, and nothing about the
    /// literal path stops actix matching it as an id -- so if the routes are
    /// ever reordered this is what catches it. A 404 here would mean `search`
    /// was looked up as a document id.
    #[tokio::test]
    async fn search_is_not_captured_as_a_document_id() {
        let _guard = ENV_LOCK.lock().await;
        let _no_key = NoKey::set();
        let (state, _dir) = temp_state("shadow");
        let app = app!(&state);

        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/documents/search?q=hello")
                .to_request(),
        )
        .await;
        // 503 is the search handler refusing for want of a model. 404 would
        // mean `get_document` answered instead.
        assert_eq!(resp.status(), 503, "/search was routed as an id");
    }

    /// A document comes back with its chunks and without its vectors.
    #[tokio::test]
    async fn a_document_reads_back_with_chunks_and_no_vectors() {
        let _guard = ENV_LOCK.lock().await;
        let (state, _dir) = temp_state("readback");
        seed(
            &state,
            "doc-1",
            "Deadlock notes",
            &[("the lock was held across an await", vec![1.0, 0.0, 0.0])],
        );

        let app = app!(&state);
        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/documents/doc-1")
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 200);

        let body = body_json(resp).await;
        assert_eq!(body["data"]["title"], "Deadlock notes");
        assert_eq!(body["data"]["chunks"].as_array().map(|a| a.len()), Some(1));
        assert_eq!(
            body["data"]["chunks"][0]["content"],
            "the lock was held across an await"
        );

        // Checked per chunk rather than by scanning the whole body for
        // "embedding": `embeddingModel` is a model name and legitimately
        // contains it, so a substring test passes or fails for the wrong
        // reason.
        for chunk in body["data"]["chunks"].as_array().expect("chunks") {
            let keys: Vec<&String> = chunk.as_object().expect("object").keys().collect();
            assert!(
                !keys.iter().any(|k| k.as_str() == "embedding"),
                "a chunk carried its vector: {keys:?}"
            );
        }
    }

    #[tokio::test]
    async fn an_unknown_document_is_a_404() {
        let _guard = ENV_LOCK.lock().await;
        let (state, _dir) = temp_state("missing");
        let app = app!(&state);

        for req in [
            test::TestRequest::get()
                .uri("/api/documents/nope")
                .to_request(),
            test::TestRequest::delete()
                .uri("/api/documents/nope")
                .to_request(),
        ] {
            let resp = test::call_service(&app, req).await;
            assert_eq!(resp.status(), 404);
        }
    }

    /// Deleting a document takes its chunks with it.
    ///
    /// Explicitly, because `PRAGMA foreign_keys` is off by default in SQLite,
    /// so the ON DELETE CASCADE on the table does not fire on its own.
    /// Orphaned chunks would keep matching searches for a document that no
    /// longer exists.
    #[tokio::test]
    async fn deleting_a_document_removes_its_chunks() {
        let _guard = ENV_LOCK.lock().await;
        let (state, _dir) = temp_state("cascade");
        seed(
            &state,
            "doc-2",
            "Gone",
            &[("first", vec![1.0, 0.0]), ("second", vec![0.0, 1.0])],
        );

        let app = app!(&state);
        let resp = test::call_service(
            &app,
            test::TestRequest::delete()
                .uri("/api/documents/doc-2")
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 200);

        let db = state.db.lock().unwrap();
        let chunks: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM kb_document_chunks WHERE document_id = 'doc-2'",
                [],
                |r| r.get(0),
            )
            .expect("count");
        assert_eq!(chunks, 0, "chunks outlived their document");
    }

    /// Chunks embedded under another model are not compared.
    ///
    /// Two models do not share a vector space, so a similarity between them is
    /// a number without meaning -- and it would still sort into the results.
    /// `searched` reporting 1 rather than 2 is the observable part.
    #[tokio::test]
    async fn chunks_from_another_model_are_excluded_from_the_candidates() {
        let _guard = ENV_LOCK.lock().await;
        let (state, _dir) = temp_state("models");
        seed(&state, "current", "Current", &[("a", vec![1.0, 0.0])]);

        {
            let db = state.db.lock().unwrap();
            db.conn
                .execute(
                    "INSERT INTO kb_documents
                     (id, title, source, doc_type, content, chunk_count, token_count,
                      embedding_model, chunking_strategy, created_at)
                     VALUES ('other', 'Other', 'test', 'text', 'b', 1, 0,
                             'some-other-embedding-model', 'semantic', 1)",
                    [],
                )
                .expect("insert other-model document");
            db.conn
                .execute(
                    "INSERT INTO kb_document_chunks
                     (document_id, chunk_index, content, token_count, embedding)
                     VALUES ('other', 0, 'b', 1, ?1)",
                    params![encode_vector(&[0.0, 1.0])],
                )
                .expect("insert other-model chunk");
        }

        // Counted through the same predicate the handler uses. The handler
        // itself cannot run here without a live embedding endpoint.
        let db = state.db.lock().unwrap();
        let searched: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM kb_document_chunks c
                 JOIN kb_documents d ON d.id = c.document_id
                 WHERE d.embedding_model = ?1",
                params![embedding_model()],
                |r| r.get(0),
            )
            .expect("count");
        assert_eq!(searched, 1, "a chunk from another model was a candidate");
    }

    /// Every strategy name the spec offers parses, and nothing else does.
    #[test]
    fn strategy_names_round_trip() {
        for name in ["semantic", "paragraph", "sentence", "fixed_size", "code"] {
            let parsed = parse_strategy(Some(name)).expect(name);
            assert_eq!(strategy_name(&parsed), name);
        }
        assert!(parse_strategy(Some("magic")).is_err());
        // The default is what the spec documents.
        assert_eq!(strategy_name(&parse_strategy(None).unwrap()), "semantic");
    }

    /// The chunkers this module borrows actually split something.
    ///
    /// `agency::memory` had no consumers at all, so nothing had ever checked
    /// that its chunking produced usable output from the API's side.
    #[test]
    fn chunking_splits_prose_into_more_than_one_piece() {
        let mut kb = KnowledgeBase::new(VectorStoreConfig::default());
        kb.set_chunking_config(ChunkingConfig {
            strategy: ChunkingStrategy::Paragraph,
            ..ChunkingConfig::default()
        });

        let content = "First paragraph about locks.\n\nSecond paragraph about awaits.";
        let chunks = kb.chunk_document(content);

        assert!(chunks.len() >= 2, "got {} chunks", chunks.len());
        assert!(chunks.iter().all(|c| !c.content.trim().is_empty()));
        // The reason this module embeds them itself.
        assert!(
            chunks.iter().all(|c| c.embedding.is_none()),
            "chunk_document embedded something; it is documented not to"
        );
    }
}
