// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only
//! Write and query endpoints the web UI depends on.
//!
//! These back the twelve calls `chasm-web` was making against routes that did
//! not exist, so most of the Chat page returned 404 for every action.
//!
//! Everything here targets the *harvest* schema -- `sessions` carrying a
//! `session_json` blob, with messages living inside `session_json.requests` --
//! because that is what the existing read handlers in `handlers_simple` parse.
//! Writing to the normalized `messages` table from `sql/schema.sql` instead
//! would produce rows that `GET /api/sessions/{id}` cannot see, which is worse
//! than not implementing the endpoint at all.

use actix_web::{http::StatusCode, web, HttpResponse, Responder};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::state::AppState;

// =============================================================================
// Response helpers
// =============================================================================

/// Same envelope `handlers_simple` uses -- the client unwraps `{success, data}`
/// -- but with a status code that matches what actually happened. The existing
/// helper answers 500 for everything, which turns "no such session" into "the
/// server is broken".
#[derive(Serialize)]
struct Envelope<T> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
}

fn ok<T: Serialize>(data: T) -> HttpResponse {
    HttpResponse::Ok().json(Envelope {
        success: true,
        data: Some(data),
        error: None,
    })
}

fn created<T: Serialize>(data: T) -> HttpResponse {
    HttpResponse::Created().json(Envelope {
        success: true,
        data: Some(data),
        error: None,
    })
}

fn fail(status: StatusCode, message: impl AsRef<str>) -> HttpResponse {
    HttpResponse::build(status).json(Envelope::<()> {
        success: false,
        data: None,
        error: Some(message.as_ref().to_string()),
    })
}

fn not_found(what: &str) -> HttpResponse {
    fail(StatusCode::NOT_FOUND, format!("{what} not found"))
}

fn db_error(e: impl std::fmt::Display) -> HttpResponse {
    fail(
        StatusCode::INTERNAL_SERVER_ERROR,
        format!("Database error: {e}"),
    )
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

// =============================================================================
// Sessions
// =============================================================================

#[derive(Deserialize)]
pub struct CreateSessionBody {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default, alias = "workspaceId")]
    pub workspace_id: Option<String>,
    #[serde(default, alias = "workspacePath")]
    pub workspace_path: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
}

/// `POST /api/sessions`
pub async fn create_session(
    state: web::Data<AppState>,
    body: web::Json<CreateSessionBody>,
) -> impl Responder {
    let db = state.db.lock().unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    let now = now_secs();
    let title = body.title.clone().unwrap_or_else(|| "New session".into());
    let provider = body.provider.clone().unwrap_or_else(|| "chasm".into());

    // An empty `requests` array is the shape the read path expects; a session
    // with a NULL or absent blob deserializes to no messages and then every
    // append has to special-case it.
    let session_json = json!({
        "requests": [],
        "creationDate": now,
        "model": body.model,
    });

    let inserted = db.conn.execute(
        "INSERT INTO sessions
            (id, provider, workspace_id, workspace_path, title, message_count,
             created_at, updated_at, harvested_at, session_json)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?6, ?6, ?7)",
        params![
            id,
            provider,
            body.workspace_id,
            body.workspace_path,
            title,
            now,
            session_json.to_string(),
        ],
    );

    match inserted {
        Ok(_) => created(json!({
            "id": id,
            "title": title,
            "provider": provider,
            "workspace_id": body.workspace_id,
            "workspace_path": body.workspace_path,
            "message_count": 0,
            "created_at": now,
            "updated_at": now,
            "messages": [],
        })),
        Err(e) => db_error(e),
    }
}

/// `DELETE /api/sessions/{id}`
pub async fn delete_session(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> impl Responder {
    let db = state.db.lock().unwrap();
    let id = path.into_inner();

    // messages_v2 has no ON DELETE CASCADE in the harvest schema, so orphan
    // rows would survive the session and inflate every message count.
    if table_exists(&db.conn, "messages_v2") {
        if let Err(e) = db
            .conn
            .execute("DELETE FROM messages_v2 WHERE session_id = ?1", params![id])
        {
            return db_error(e);
        }
    }

    match db
        .conn
        .execute("DELETE FROM sessions WHERE id = ?1", params![id])
    {
        Ok(0) => not_found("Session"),
        Ok(_) => ok(json!({ "id": id, "deleted": true })),
        Err(e) => db_error(e),
    }
}

#[derive(Deserialize)]
pub struct CreateMessageBody {
    #[serde(default)]
    pub role: Option<String>,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default, alias = "modelId")]
    pub model_id: Option<String>,
}

/// `POST /api/sessions/{id}/messages`
///
/// Appends into `session_json.requests` in the shape
/// `extract_messages_from_session` reads back: one request object holds a user
/// message and the assistant response to it. An assistant message therefore
/// attaches to the trailing request rather than starting a new one.
pub async fn create_message(
    state: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<CreateMessageBody>,
) -> impl Responder {
    let db = state.db.lock().unwrap();
    let session_id = path.into_inner();

    let content = body.content.clone().unwrap_or_default();
    if content.trim().is_empty() {
        return fail(StatusCode::BAD_REQUEST, "content is required");
    }
    let role = body.role.clone().unwrap_or_else(|| "user".into());
    if !matches!(role.as_str(), "user" | "assistant" | "system") {
        return fail(
            StatusCode::BAD_REQUEST,
            format!("unsupported role '{role}'; expected user, assistant or system"),
        );
    }

    let raw: Option<String> = match db
        .conn
        .query_row(
            "SELECT session_json FROM sessions WHERE id = ?1",
            params![session_id],
            |row| row.get(0),
        )
        .optional()
    {
        Ok(v) => v,
        Err(e) => return db_error(e),
    };
    let Some(raw) = raw else {
        return not_found("Session");
    };

    let mut session: Value = serde_json::from_str(&raw).unwrap_or_else(|_| json!({}));
    if !session.get("requests").map(|r| r.is_array()).unwrap_or(false) {
        session["requests"] = json!([]);
    }
    let now = now_secs();
    let message_id = uuid::Uuid::new_v4().to_string();

    {
        let requests = session["requests"].as_array_mut().expect("array above");
        if role == "assistant" {
            // Attach to the last request still lacking a response; otherwise
            // the reader would pair this reply with the wrong prompt.
            let slot = requests
                .iter_mut()
                .rev()
                .find(|r| r.get("response").is_none());
            match slot {
                Some(request) => {
                    request["response"] = json!([{ "value": content }]);
                    request["responseId"] = json!(message_id);
                }
                None => requests.push(json!({
                    "requestId": uuid::Uuid::new_v4().to_string(),
                    "responseId": message_id,
                    "timestamp": now,
                    "modelId": body.model_id,
                    "response": [{ "value": content }],
                })),
            }
        } else {
            requests.push(json!({
                "requestId": message_id,
                "timestamp": now,
                "modelId": body.model_id,
                "message": { "text": content },
            }));
        }
    }

    let count = session["requests"]
        .as_array()
        .map(|r| {
            r.iter()
                .map(|req| {
                    usize::from(req.get("message").is_some())
                        + usize::from(req.get("response").is_some())
                })
                .sum::<usize>()
        })
        .unwrap_or(0) as i64;

    if let Err(e) = db.conn.execute(
        "UPDATE sessions SET session_json = ?1, message_count = ?2, updated_at = ?3
         WHERE id = ?4",
        params![session.to_string(), count, now, session_id],
    ) {
        return db_error(e);
    }

    created(json!({
        "id": message_id,
        "session_id": session_id,
        "role": role,
        "content": content,
        "created_at": now,
        "message_count": count,
    }))
}

// =============================================================================
// Checkpoints
// =============================================================================

/// The harvest database predates checkpoints, so the table is created on
/// demand rather than assumed. Kept to the columns the web client's
/// `Checkpoint` type actually reads.
fn ensure_checkpoints_table(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS api_checkpoints (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            message_id TEXT,
            git_commit TEXT,
            git_branch TEXT,
            created_at INTEGER NOT NULL,
            metadata TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_api_checkpoints_session
            ON api_checkpoints(session_id);",
    )
}

fn checkpoint_json(row: &rusqlite::Row) -> rusqlite::Result<Value> {
    let metadata: Option<String> = row.get(8)?;
    Ok(json!({
        "id": row.get::<_, String>(0)?,
        "sessionId": row.get::<_, String>(1)?,
        "name": row.get::<_, String>(2)?,
        "description": row.get::<_, Option<String>>(3)?,
        "messageId": row.get::<_, Option<String>>(4)?,
        "gitCommit": row.get::<_, Option<String>>(5)?,
        "gitBranch": row.get::<_, Option<String>>(6)?,
        "createdAt": row.get::<_, i64>(7)?,
        "metadata": metadata.and_then(|m| serde_json::from_str::<Value>(&m).ok()),
    }))
}

/// `GET /api/sessions/{id}/checkpoints`
pub async fn list_checkpoints(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> impl Responder {
    let db = state.db.lock().unwrap();
    let session_id = path.into_inner();

    if let Err(e) = ensure_checkpoints_table(&db.conn) {
        return db_error(e);
    }

    let result = (|| -> rusqlite::Result<Vec<Value>> {
        let mut stmt = db.conn.prepare(
            "SELECT id, session_id, name, description, message_id, git_commit,
                    git_branch, created_at, metadata
             FROM api_checkpoints WHERE session_id = ?1 ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map(params![session_id], checkpoint_json)?;
        rows.collect()
    })();

    match result {
        Ok(rows) => ok(rows),
        Err(e) => db_error(e),
    }
}

#[derive(Deserialize)]
pub struct CreateCheckpointBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default, alias = "messageId")]
    pub message_id: Option<String>,
    #[serde(default, alias = "gitCommit")]
    pub git_commit: Option<String>,
    #[serde(default, alias = "gitBranch")]
    pub git_branch: Option<String>,
    #[serde(default)]
    pub metadata: Option<Value>,
}

/// `POST /api/sessions/{id}/checkpoints`
pub async fn create_checkpoint(
    state: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<CreateCheckpointBody>,
) -> impl Responder {
    let db = state.db.lock().unwrap();
    let session_id = path.into_inner();

    let exists: Option<i64> = match db
        .conn
        .query_row(
            "SELECT 1 FROM sessions WHERE id = ?1",
            params![session_id],
            |row| row.get(0),
        )
        .optional()
    {
        Ok(v) => v,
        Err(e) => return db_error(e),
    };
    if exists.is_none() {
        return not_found("Session");
    }

    if let Err(e) = ensure_checkpoints_table(&db.conn) {
        return db_error(e);
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = now_secs();
    let name = body.name.clone().unwrap_or_else(|| format!("Checkpoint {now}"));
    let metadata = body.metadata.as_ref().map(|m| m.to_string());

    if let Err(e) = db.conn.execute(
        "INSERT INTO api_checkpoints
            (id, session_id, name, description, message_id, git_commit, git_branch,
             created_at, metadata)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            id,
            session_id,
            name,
            body.description,
            body.message_id,
            body.git_commit,
            body.git_branch,
            now,
            metadata,
        ],
    ) {
        return db_error(e);
    }

    created(json!({
        "id": id,
        "sessionId": session_id,
        "name": name,
        "description": body.description,
        "messageId": body.message_id,
        "gitCommit": body.git_commit,
        "gitBranch": body.git_branch,
        "createdAt": now,
        "metadata": body.metadata,
    }))
}

// =============================================================================
// Git commits
// =============================================================================

/// `GET /api/sessions/{id}/commits`
///
/// Commits from the workspace the session belongs to. Returns an empty list
/// -- not an error -- when the workspace is not a git repository or `git` is
/// not on PATH: "this session has no commits" is the honest answer there, and
/// the Chat page renders it as an empty panel rather than a failure.
pub async fn session_commits(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> impl Responder {
    let session_id = path.into_inner();

    let workspace_path: Option<Option<String>> = {
        let db = state.db.lock().unwrap();
        match db
            .conn
            .query_row(
                "SELECT workspace_path FROM sessions WHERE id = ?1",
                params![session_id],
                |row| row.get(0),
            )
            .optional()
        {
            Ok(v) => v,
            Err(e) => return db_error(e),
        }
    };

    let Some(workspace_path) = workspace_path else {
        return not_found("Session");
    };
    let Some(dir) = workspace_path.filter(|p| !p.trim().is_empty()) else {
        return ok(Vec::<Value>::new());
    };

    match git_log(&dir, &session_id) {
        Ok(commits) => ok(commits),
        Err(_) => ok(Vec::<Value>::new()),
    }
}

/// Shell out to `git`; there is no git library in the dependency tree.
fn git_log(dir: &str, session_id: &str) -> Result<Vec<Value>, std::io::Error> {
    // Unit separator between fields and record separator between commits, so
    // a commit message containing a newline or a tab cannot corrupt parsing.
    let out = std::process::Command::new("git")
        .args([
            "-C",
            dir,
            "log",
            "-n",
            "50",
            "--format=%H\x1f%h\x1f%s\x1f%an\x1f%ae\x1f%at\x1e",
        ])
        .output()?;

    if !out.status.success() {
        return Ok(Vec::new());
    }

    let branch = std::process::Command::new("git")
        .args(["-C", dir, "rev-parse", "--abbrev-ref", "HEAD"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();

    let stdout = String::from_utf8_lossy(&out.stdout);
    let commits = stdout
        .split('\x1e')
        .filter(|rec| !rec.trim().is_empty())
        .filter_map(|rec| {
            let f: Vec<&str> = rec.trim_start_matches('\n').split('\x1f').collect();
            if f.len() < 6 {
                return None;
            }
            Some(json!({
                "hash": f[0],
                "shortHash": f[1],
                "message": f[2],
                "author": f[3],
                "email": f[4],
                "timestamp": f[5].parse::<i64>().unwrap_or(0),
                "branch": branch,
                "sessionId": session_id,
                "messageId": Value::Null,
            }))
        })
        .collect();

    Ok(commits)
}

// =============================================================================
// Search
// =============================================================================

#[derive(Deserialize)]
pub struct SearchQuery {
    #[serde(default)]
    pub q: String,
    #[serde(default)]
    pub limit: Option<u32>,
}

/// `GET /api/search`
///
/// Returns `SearchResult[]` -- the shape the client's `search.query` declares.
/// This is a title/content substring search, not semantic: there is no
/// embedding index behind the REST API, and pretending otherwise is how the
/// old zero-vector embeddings bug happened.
pub async fn search(state: web::Data<AppState>, query: web::Query<SearchQuery>) -> impl Responder {
    let db = state.db.lock().unwrap();
    let q = query.q.trim();
    if q.is_empty() {
        return ok(Vec::<Value>::new());
    }
    let limit = query.limit.unwrap_or(50).min(500) as i64;
    let term = format!("%{q}%");

    let result = (|| -> rusqlite::Result<Vec<Value>> {
        let mut stmt = db.conn.prepare(
            "SELECT id, title, provider, workspace_id, updated_at
             FROM sessions
             WHERE title LIKE ?1 COLLATE NOCASE
             ORDER BY updated_at DESC LIMIT ?2",
        )?;
        let mut results: Vec<Value> = stmt
            .query_map(params![term, limit], |row| {
                Ok(json!({
                    "type": "session",
                    "id": row.get::<_, String>(0)?,
                    "title": row.get::<_, String>(1)?,
                    "provider": row.get::<_, Option<String>>(2)?,
                    "workspaceId": row.get::<_, Option<String>>(3)?,
                    "timestamp": row.get::<_, Option<i64>>(4)?,
                }))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        // Message hits, when the normalized table is present.
        if table_exists(&db.conn, "messages_v2") && (results.len() as i64) < limit {
            let remaining = limit - results.len() as i64;
            let mut stmt = db.conn.prepare(
                "SELECT m.session_id, s.title, m.content_raw, s.updated_at
                 FROM messages_v2 m JOIN sessions s ON s.id = m.session_id
                 WHERE m.content_raw LIKE ?1 COLLATE NOCASE
                 ORDER BY s.updated_at DESC LIMIT ?2",
            )?;
            let hits = stmt.query_map(params![term, remaining], |row| {
                let content: String = row.get(2)?;
                Ok(json!({
                    "type": "message",
                    "id": row.get::<_, String>(0)?,
                    "sessionId": row.get::<_, String>(0)?,
                    "title": row.get::<_, String>(1)?,
                    "snippet": snippet(&content, 200),
                    "timestamp": row.get::<_, Option<i64>>(3)?,
                }))
            })?;
            for hit in hits {
                results.push(hit?);
            }
        }

        Ok(results)
    })();

    match result {
        Ok(rows) => ok(rows),
        Err(e) => db_error(e),
    }
}

/// Character-wise, because a byte slice would panic in the middle of a
/// multi-byte character.
fn snippet(text: &str, max_chars: usize) -> String {
    let trimmed = text.trim();
    if trimmed.chars().count() <= max_chars {
        return trimmed.to_string();
    }
    let head: String = trimmed.chars().take(max_chars).collect();
    format!("{head}...")
}

// =============================================================================
// Statistics
// =============================================================================

/// `GET /api/stats/providers`
///
/// `Record<provider, {sessions, messages, tokens}>`. Token counts are reported
/// as 0 where the harvest schema stores none, rather than being estimated --
/// an invented number here would show up in the UI as fact.
pub async fn provider_stats(state: web::Data<AppState>) -> impl Responder {
    let db = state.db.lock().unwrap();

    let result = (|| -> rusqlite::Result<Value> {
        let mut stmt = db.conn.prepare(
            "SELECT provider, COUNT(*), COALESCE(SUM(message_count), 0)
             FROM sessions GROUP BY provider ORDER BY provider",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, i64>(2)?,
            ))
        })?;

        let mut out = serde_json::Map::new();
        for row in rows {
            let (provider, sessions, messages) = row?;
            out.insert(
                provider,
                json!({ "sessions": sessions, "messages": messages, "tokens": 0 }),
            );
        }
        Ok(Value::Object(out))
    })();

    match result {
        Ok(stats) => ok(stats),
        Err(e) => db_error(e),
    }
}

// =============================================================================
// Swarms
// =============================================================================

#[derive(Deserialize)]
pub struct UpdateSwarmBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub orchestration: Option<String>,
    #[serde(default)]
    pub agents: Option<Value>,
    #[serde(default, alias = "maxIterations")]
    pub max_iterations: Option<i64>,
    #[serde(default)]
    pub status: Option<String>,
}

/// `PUT /api/swarms/{id}`
pub async fn update_swarm(
    state: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<UpdateSwarmBody>,
) -> impl Responder {
    let db = state.db.lock().unwrap();
    let id = path.into_inner();

    // The swarms table is created on demand by the other swarm handlers, so it
    // may not exist yet; without this an update is a 500 rather than a 404.
    if let Err(e) = super::handlers_simple::init_swarms_table(&db.conn) {
        return db_error(e);
    }

    // COALESCE so an omitted field keeps its stored value instead of being
    // nulled -- the client sends partial updates.
    let agents = body.agents.as_ref().map(|a| a.to_string());
    let updated = db.conn.execute(
        "UPDATE swarms SET
            name = COALESCE(?1, name),
            description = COALESCE(?2, description),
            orchestration = COALESCE(?3, orchestration),
            agents = COALESCE(?4, agents),
            max_iterations = COALESCE(?5, max_iterations),
            status = COALESCE(?6, status),
            updated_at = ?7
         WHERE id = ?8",
        params![
            body.name,
            body.description,
            body.orchestration,
            agents,
            body.max_iterations,
            body.status,
            now_secs(),
            id,
        ],
    );

    match updated {
        Ok(0) => not_found("Swarm"),
        Ok(_) => ok(json!({ "id": id, "updated": true })),
        Err(e) => db_error(e),
    }
}

// =============================================================================
// Providers
// =============================================================================

/// `POST /api/providers/{id}/test`
///
/// Reports reachability, measured. For a locally hosted provider that means an
/// actual HTTP request; for one whose endpoint we cannot know from here it
/// means saying so, rather than returning a cheerful `success: true` that
/// tested nothing.
pub async fn test_provider(path: web::Path<String>) -> impl Responder {
    let id = path.into_inner();

    // Each server exposes a different liveness path; LM Studio has no
    // /api/tags, so probing one shape for both would report it as down.
    let probe = match id.as_str() {
        "ollama" => format!(
            "{}/api/tags",
            std::env::var("OLLAMA_HOST")
                .unwrap_or_else(|_| "http://localhost:11434".into())
                .trim_end_matches('/')
        ),
        "lmstudio" => "http://localhost:1234/v1/models".to_string(),
        _ => {
            return fail(
                StatusCode::NOT_IMPLEMENTED,
                format!(
                    "No connectivity test for '{id}'. Only locally hosted providers \
                     (ollama, lmstudio) expose an endpoint this server can reach."
                ),
            )
        }
    };

    let started = std::time::Instant::now();
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
    {
        Ok(c) => c,
        Err(e) => return db_error(e),
    };

    match client.get(&probe).send().await {
        Ok(resp) if resp.status().is_success() => ok(json!({
            "success": true,
            "latency": started.elapsed().as_millis() as u64,
        })),
        Ok(resp) => fail(
            StatusCode::BAD_GATEWAY,
            format!("{id} answered {}", resp.status()),
        ),
        Err(e) => fail(StatusCode::BAD_GATEWAY, format!("{id} unreachable: {e}")),
    }
}

// =============================================================================
// Chat completions
// =============================================================================

#[derive(Deserialize)]
pub struct CompletionBody {
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub messages: Vec<CompletionMessage>,
    #[serde(default)]
    pub temperature: Option<f32>,
    #[serde(default, alias = "maxTokens")]
    pub max_tokens: Option<u32>,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct CompletionMessage {
    pub role: String,
    pub content: String,
}

/// `POST /api/chat/completions`
///
/// A thin proxy to an OpenAI-compatible endpoint, configured exactly like
/// `chasm analyze`: `OPENAI_API_KEY` and `OPENAI_BASE_URL`. Without a key this
/// returns 503 and says what to set. It does not fall back to a canned reply --
/// a fabricated completion presented as model output is the worst possible
/// failure mode for this endpoint.
pub async fn chat_completion(body: web::Json<CompletionBody>) -> impl Responder {
    if body.messages.is_empty() {
        return fail(StatusCode::BAD_REQUEST, "messages is required");
    }

    let api_key = std::env::var("OPENAI_API_KEY").unwrap_or_default();
    if api_key.trim().is_empty() {
        return fail(
            StatusCode::SERVICE_UNAVAILABLE,
            "No model configured. Set OPENAI_API_KEY (and OPENAI_BASE_URL for a \
             local or self-hosted endpoint) on the server.",
        );
    }
    let base_url = std::env::var("OPENAI_BASE_URL")
        .unwrap_or_else(|_| "https://api.openai.com/v1".into())
        .trim_end_matches('/')
        .to_string();
    let model = body
        .model
        .clone()
        .filter(|m| !m.trim().is_empty())
        .unwrap_or_else(|| "gpt-4o-mini".into());

    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
    {
        Ok(c) => c,
        Err(e) => return db_error(e),
    };

    let mut payload = json!({
        "model": model,
        "messages": body.messages,
        "stream": false,
    });
    if let Some(t) = body.temperature {
        payload["temperature"] = json!(t);
    }
    if let Some(m) = body.max_tokens {
        payload["max_tokens"] = json!(m);
    }

    let response = client
        .post(format!("{base_url}/chat/completions"))
        .bearer_auth(&api_key)
        .json(&payload)
        .send()
        .await;

    let response = match response {
        Ok(r) => r,
        Err(e) => return fail(StatusCode::BAD_GATEWAY, format!("Model unreachable: {e}")),
    };

    let status = response.status();
    let raw = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return fail(
            StatusCode::BAD_GATEWAY,
            format!("Model returned {status}: {}", snippet(&raw, 300)),
        );
    }

    let parsed: Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(e) => {
            return fail(
                StatusCode::BAD_GATEWAY,
                format!("Model returned unparseable JSON: {e}"),
            )
        }
    };

    let content = parsed
        .pointer("/choices/0/message/content")
        .and_then(|c| c.as_str())
        .unwrap_or_default()
        .to_string();
    let finish = parsed
        .pointer("/choices/0/finish_reason")
        .and_then(|f| f.as_str())
        .unwrap_or("stop");

    ok(json!({
        "id": parsed.get("id").and_then(|i| i.as_str()).unwrap_or_default(),
        "model": parsed.get("model").and_then(|m| m.as_str()).unwrap_or(&model),
        "content": content,
        "message": { "role": "assistant", "content": content },
        "finishReason": finish,
        "usage": parsed.get("usage").cloned().unwrap_or(Value::Null),
    }))
}

// =============================================================================
// Harvest
// =============================================================================

/// `POST /api/harvest`
///
/// Runs the same harvest the CLI runs, on a blocking thread -- it walks the
/// filesystem and can take minutes. Counts are measured by differencing the
/// session table around the run, because `harvest_run` reports to stdout and
/// returns nothing this endpoint could relay.
pub async fn run_harvest(state: web::Data<AppState>) -> impl Responder {
    let before = match count_sessions(&state) {
        Ok(n) => n,
        Err(e) => return db_error(e),
    };

    // Against the database this server opened, not the CLI's default. If the
    // server was pointed at a custom path, harvesting into the default one
    // would import sessions the API can never see and report a count of zero.
    let db_path = state.db_path.to_string_lossy().to_string();

    // Incremental: an API-triggered harvest should pick up what is new, not
    // re-walk and re-parse every session on the machine.
    let outcome = web::block(move || {
        crate::commands::harvest_run(Some(&db_path), None, None, true, false, None, false)
    })
    .await;

    let errors = match outcome {
        Ok(Ok(())) => Vec::new(),
        Ok(Err(e)) => vec![e.to_string()],
        Err(e) => vec![format!("harvest thread failed: {e}")],
    };

    let after = match count_sessions(&state) {
        Ok(n) => n,
        Err(e) => return db_error(e),
    };

    ok(json!({
        "success": errors.is_empty(),
        "sessionsImported": (after - before).max(0),
        "messagesImported": 0,
        "errors": errors,
        "warnings": [],
    }))
}

fn count_sessions(state: &web::Data<AppState>) -> rusqlite::Result<i64> {
    let db = state.db.lock().unwrap();
    db.conn
        .query_row("SELECT COUNT(*) FROM sessions", [], |row| row.get(0))
}

// =============================================================================
// Shared helpers
// =============================================================================

fn table_exists(conn: &Connection, name: &str) -> bool {
    conn.query_row(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?1",
        params![name],
        |_| Ok(true),
    )
    .optional()
    .ok()
    .flatten()
    .unwrap_or(false)
}

/// Add these routes to the server's existing `/api` scope.
///
/// Deliberately *not* a second `web::scope("/api")`. Actix matches scopes in
/// registration order, and a scope that matches the prefix handles the request
/// even when no resource inside it matches -- so an extra `/api` scope
/// registered first silently swallowed every read route in `configure_routes`
/// and the whole API 404'd. Sharing one scope is the only arrangement that
/// works. (`/api/inbox` gets away with its own scope because its prefix is
/// narrower and cannot shadow anything else.)
///
/// Routes with a path that the shared scope already registers -- `/sessions`,
/// `/sessions/{id}`, `/swarms/{id}` -- are merged into that resource by actix
/// rather than shadowing it, so the existing `GET` handlers keep working.
pub(super) fn attach_write_routes(scope: actix_web::Scope) -> actix_web::Scope {
    scope
        .route("/sessions", web::post().to(create_session))
        .route("/sessions/{id}", web::delete().to(delete_session))
        .route("/sessions/{id}/messages", web::post().to(create_message))
        .route("/sessions/{id}/checkpoints", web::get().to(list_checkpoints))
        .route(
            "/sessions/{id}/checkpoints",
            web::post().to(create_checkpoint),
        )
        .route("/sessions/{id}/commits", web::get().to(session_commits))
        .route("/search", web::get().to(search))
        .route("/stats/providers", web::get().to(provider_stats))
        .route("/swarms/{id}", web::put().to(update_swarm))
        .route("/providers/{id}/test", web::post().to(test_provider))
        .route("/chat/completions", web::post().to(chat_completion))
        .route("/harvest", web::post().to(run_harvest))
}

/// Test-only: these routes alone, under their own `/api` scope.
///
/// Safe here precisely because nothing else is mounted alongside them.
#[cfg(test)]
fn configure_write_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(attach_write_routes(web::scope("/api")));
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ChatDatabase;
    use actix_web::{test, App};
    use std::path::PathBuf;

    /// Builds the database the way `start_server` does -- harvest schema
    /// first, then open -- so these tests also cover the ordering that makes
    /// every session endpoint work on a machine that never ran a harvest.
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
                    .configure(configure_write_routes),
            )
            .await
        };
    }

    async fn body_json(resp: actix_web::dev::ServiceResponse) -> Value {
        let bytes = test::read_body(resp).await;
        serde_json::from_slice(&bytes).expect("json body")
    }

    async fn make_session<S>(app: &S) -> String
    where
        S: actix_web::dev::Service<
            actix_http::Request,
            Response = actix_web::dev::ServiceResponse,
            Error = actix_web::Error,
        >,
    {
        let resp = test::call_service(
            app,
            test::TestRequest::post()
                .uri("/api/sessions")
                .set_json(json!({ "title": "S" }))
                .to_request(),
        )
        .await;
        body_json(resp).await["data"]["id"]
            .as_str()
            .expect("id")
            .to_string()
    }

    #[tokio::test]
    async fn a_created_session_is_readable_and_starts_empty() {
        let (state, _d) = temp_state("create");
        let app = app!(state);

        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/sessions")
                .set_json(json!({ "title": "Hello", "provider": "copilot" }))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::CREATED);

        let body = body_json(resp).await;
        assert_eq!(body["data"]["title"], "Hello");
        assert_eq!(body["data"]["message_count"], 0);
        assert!(body["data"]["id"].as_str().is_some_and(|s| !s.is_empty()));
    }

    #[tokio::test]
    async fn deleting_a_session_that_does_not_exist_is_404_not_500() {
        let (state, _d) = temp_state("del404");
        let app = app!(state);
        let resp = test::call_service(
            &app,
            test::TestRequest::delete()
                .uri("/api/sessions/nope")
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn a_deleted_session_is_gone() {
        let (state, _d) = temp_state("del");
        let app = app!(state);
        let id = make_session(&app).await;

        let resp = test::call_service(
            &app,
            test::TestRequest::delete()
                .uri(&format!("/api/sessions/{id}"))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::OK);

        let db = state.db.lock().unwrap();
        let remaining: i64 = db
            .conn
            .query_row("SELECT COUNT(*) FROM sessions", [], |r| r.get(0))
            .unwrap();
        assert_eq!(remaining, 0);
    }

    #[tokio::test]
    async fn a_user_message_then_an_assistant_reply_pair_into_one_request() {
        let (state, _d) = temp_state("msg");
        let app = app!(state);
        let id = make_session(&app).await;

        for (role, content) in [("user", "ping"), ("assistant", "pong")] {
            let resp = test::call_service(
                &app,
                test::TestRequest::post()
                    .uri(&format!("/api/sessions/{id}/messages"))
                    .set_json(json!({ "role": role, "content": content }))
                    .to_request(),
            )
            .await;
            assert_eq!(resp.status(), StatusCode::CREATED, "{role} rejected");
        }

        // The reply must attach to the existing request rather than open a new
        // one, or the read path pairs it with the wrong prompt.
        let db = state.db.lock().unwrap();
        let raw: String = db
            .conn
            .query_row(
                "SELECT session_json FROM sessions WHERE id = ?1",
                params![id],
                |r| r.get(0),
            )
            .unwrap();
        let parsed: Value = serde_json::from_str(&raw).unwrap();
        let requests = parsed["requests"].as_array().unwrap();
        assert_eq!(requests.len(), 1, "reply should not create a second request");
        assert_eq!(requests[0]["message"]["text"], "ping");
        assert_eq!(requests[0]["response"][0]["value"], "pong");

        let count: i64 = db
            .conn
            .query_row(
                "SELECT message_count FROM sessions WHERE id = ?1",
                params![id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 2);
    }

    #[tokio::test]
    async fn an_empty_message_is_rejected_rather_than_stored() {
        let (state, _d) = temp_state("empty");
        let app = app!(state);
        let id = make_session(&app).await;

        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri(&format!("/api/sessions/{id}/messages"))
                .set_json(json!({ "role": "user", "content": "   " }))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn an_unknown_role_is_rejected() {
        let (state, _d) = temp_state("role");
        let app = app!(state);
        let id = make_session(&app).await;

        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri(&format!("/api/sessions/{id}/messages"))
                .set_json(json!({ "role": "wizard", "content": "abracadabra" }))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn posting_a_message_to_a_missing_session_is_404() {
        let (state, _d) = temp_state("msg404");
        let app = app!(state);
        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/sessions/ghost/messages")
                .set_json(json!({ "role": "user", "content": "hi" }))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn checkpoints_round_trip() {
        let (state, _d) = temp_state("ckpt");
        let app = app!(state);
        let id = make_session(&app).await;

        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri(&format!("/api/sessions/{id}/checkpoints"))
                .set_json(json!({ "name": "before refactor", "gitBranch": "main" }))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::CREATED);

        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri(&format!("/api/sessions/{id}/checkpoints"))
                .to_request(),
        )
        .await;
        let body = body_json(resp).await;
        let rows = body["data"].as_array().expect("array");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["name"], "before refactor");
        assert_eq!(rows[0]["gitBranch"], "main");
    }

    #[tokio::test]
    async fn listing_checkpoints_on_a_fresh_database_is_empty_not_an_error() {
        // The table is created on demand; a missing one must not read as 500.
        let (state, _d) = temp_state("ckpt-empty");
        let app = app!(state);
        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/sessions/whatever/checkpoints")
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(body_json(resp).await["data"], json!([]));
    }

    #[tokio::test]
    async fn a_checkpoint_on_a_missing_session_is_404() {
        let (state, _d) = temp_state("ckpt404");
        let app = app!(state);
        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/sessions/ghost/checkpoints")
                .set_json(json!({ "name": "x" }))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn search_matches_titles_and_ignores_case() {
        let (state, _d) = temp_state("search");
        let app = app!(state);
        for title in ["Rust Refactor", "unrelated"] {
            test::call_service(
                &app,
                test::TestRequest::post()
                    .uri("/api/sessions")
                    .set_json(json!({ "title": title }))
                    .to_request(),
            )
            .await;
        }

        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/search?q=rust")
                .to_request(),
        )
        .await;
        let body = body_json(resp).await;
        let rows = body["data"].as_array().expect("array");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["title"], "Rust Refactor");
        assert_eq!(rows[0]["type"], "session");
    }

    #[tokio::test]
    async fn an_empty_search_returns_nothing_rather_than_everything() {
        let (state, _d) = temp_state("search-empty");
        let app = app!(state);
        make_session(&app).await;
        let resp = test::call_service(
            &app,
            test::TestRequest::get().uri("/api/search?q=").to_request(),
        )
        .await;
        assert_eq!(body_json(resp).await["data"], json!([]));
    }

    #[tokio::test]
    async fn provider_stats_group_by_provider() {
        let (state, _d) = temp_state("stats");
        let app = app!(state);
        for provider in ["copilot", "copilot", "cursor"] {
            test::call_service(
                &app,
                test::TestRequest::post()
                    .uri("/api/sessions")
                    .set_json(json!({ "title": "t", "provider": provider }))
                    .to_request(),
            )
            .await;
        }

        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/stats/providers")
                .to_request(),
        )
        .await;
        let body = body_json(resp).await;
        assert_eq!(body["data"]["copilot"]["sessions"], 2);
        assert_eq!(body["data"]["cursor"]["sessions"], 1);
    }

    #[tokio::test]
    async fn updating_a_missing_swarm_is_404() {
        let (state, _d) = temp_state("swarm");
        let app = app!(state);
        let resp = test::call_service(
            &app,
            test::TestRequest::put()
                .uri("/api/swarms/ghost")
                .set_json(json!({ "name": "renamed" }))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn a_completion_with_no_messages_is_rejected_before_any_network_call() {
        let (state, _d) = temp_state("chat-empty");
        let app = app!(state);
        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/chat/completions")
                .set_json(json!({ "messages": [] }))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn a_completion_without_a_configured_model_says_so() {
        // Never a canned reply: a fabricated completion presented as model
        // output would be the worst failure this endpoint could have.
        if !std::env::var("OPENAI_API_KEY")
            .unwrap_or_default()
            .trim()
            .is_empty()
        {
            return; // A real key is configured; the no-key contract does not apply.
        }
        let (state, _d) = temp_state("chat");
        let app = app!(state);
        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/chat/completions")
                .set_json(json!({ "messages": [{ "role": "user", "content": "hi" }] }))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
        let body = body_json(resp).await;
        assert!(body["error"]
            .as_str()
            .unwrap_or_default()
            .contains("OPENAI_API_KEY"));
    }

    #[tokio::test]
    async fn an_untestable_provider_says_so_rather_than_reporting_success() {
        let (state, _d) = temp_state("ptest");
        let app = app!(state);
        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/providers/copilot/test")
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::NOT_IMPLEMENTED);
    }

    #[tokio::test]
    async fn commits_for_a_session_without_a_workspace_are_empty() {
        let (state, _d) = temp_state("commits");
        let app = app!(state);
        let id = make_session(&app).await;
        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri(&format!("/api/sessions/{id}/commits"))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(body_json(resp).await["data"], json!([]));
    }

    #[tokio::test]
    async fn commits_for_a_missing_session_are_404() {
        let (state, _d) = temp_state("commits404");
        let app = app!(state);
        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/sessions/ghost/commits")
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn snippet_does_not_split_a_multibyte_character() {
        let text = "\u{3042}".repeat(300);
        let out = snippet(&text, 200);
        assert!(out.ends_with("..."));
        assert_eq!(out.chars().count(), 203);
    }
}
