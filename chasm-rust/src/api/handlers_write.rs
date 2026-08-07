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
pub async fn delete_session(state: web::Data<AppState>, path: web::Path<String>) -> impl Responder {
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
    if !session
        .get("requests")
        .map(|r| r.is_array())
        .unwrap_or(false)
    {
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
    let name = body
        .name
        .clone()
        .unwrap_or_else(|| format!("Checkpoint {now}"));
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

// =============================================================================
// Timeline statistics
// =============================================================================

#[derive(Deserialize)]
pub struct TimelineQuery {
    #[serde(default)]
    pub days: Option<u32>,
}

/// `GET /api/stats/timeline`
///
/// Sessions and messages per calendar day, oldest first. Days with no
/// activity are omitted rather than zero-filled: the store knows nothing
/// about a day on which nothing happened, and inventing rows would make an
/// empty database look like a quiet one.
pub async fn timeline_stats(
    state: web::Data<AppState>,
    query: web::Query<TimelineQuery>,
) -> impl Responder {
    let db = state.db.lock().unwrap();
    let days = query.days.unwrap_or(30).clamp(1, 365) as i64;
    let cutoff = now_secs() - days * 86_400;

    let result = (|| -> rusqlite::Result<Vec<Value>> {
        let mut stmt = db.conn.prepare(
            "SELECT date(created_at, 'unixepoch') AS day,
                    COUNT(*) AS sessions,
                    COALESCE(SUM(message_count), 0) AS messages
             FROM sessions
             WHERE created_at >= ?1
             GROUP BY day
             ORDER BY day",
        )?;
        let rows = stmt.query_map(params![cutoff], |row| {
            Ok(json!({
                "date": row.get::<_, String>(0)?,
                "sessions": row.get::<_, i64>(1)?,
                "messages": row.get::<_, i64>(2)?,
            }))
        })?;
        rows.collect()
    })();

    match result {
        Ok(rows) => ok(json!({ "days": days, "points": rows })),
        Err(e) => db_error(e),
    }
}

// =============================================================================
// Workspace writes
// =============================================================================

#[derive(Deserialize)]
pub struct WorkspaceBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub provider: Option<String>,
}

/// `POST /api/workspaces`
pub async fn create_workspace(
    state: web::Data<AppState>,
    body: web::Json<WorkspaceBody>,
) -> impl Responder {
    let Some(name) = body.name.clone().filter(|n| !n.trim().is_empty()) else {
        return fail(StatusCode::BAD_REQUEST, "name is required");
    };

    let db = state.db.lock().unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    let now = now_secs();

    let inserted = db.conn.execute(
        "INSERT INTO workspaces (id, name, path, provider, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        params![id, name, body.path, body.provider, now],
    );

    match inserted {
        Ok(_) => created(json!({
            "id": id,
            "name": name,
            "path": body.path,
            "provider": body.provider,
            "created_at": now,
            "updated_at": now,
        })),
        Err(e) => db_error(e),
    }
}

/// `PUT /api/workspaces/{id}`
pub async fn update_workspace(
    state: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<WorkspaceBody>,
) -> impl Responder {
    let db = state.db.lock().unwrap();
    let id = path.into_inner();

    // COALESCE so an omitted field keeps its stored value.
    let updated = db.conn.execute(
        "UPDATE workspaces SET
            name = COALESCE(?1, name),
            path = COALESCE(?2, path),
            provider = COALESCE(?3, provider),
            updated_at = ?4
         WHERE id = ?5",
        params![body.name, body.path, body.provider, now_secs(), id],
    );

    match updated {
        Ok(0) => not_found("Workspace"),
        Ok(_) => ok(json!({ "id": id, "updated": true })),
        Err(e) => db_error(e),
    }
}

/// `DELETE /api/workspaces/{id}`
///
/// Sessions that belonged to it are kept and detached, not deleted. Removing
/// a workspace record is a bookkeeping act; destroying the conversations
/// filed under it is not, and should never be a side effect of one.
pub async fn delete_workspace(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> impl Responder {
    let db = state.db.lock().unwrap();
    let id = path.into_inner();

    if let Err(e) = db.conn.execute(
        "UPDATE sessions SET workspace_id = NULL WHERE workspace_id = ?1",
        params![id],
    ) {
        return db_error(e);
    }

    match db
        .conn
        .execute("DELETE FROM workspaces WHERE id = ?1", params![id])
    {
        Ok(0) => not_found("Workspace"),
        Ok(_) => ok(json!({ "id": id, "deleted": true, "sessionsDetached": true })),
        Err(e) => db_error(e),
    }
}

// =============================================================================
// Fork, merge and export
// =============================================================================

/// Read a session's stored blob and denormalized title.
fn load_session(conn: &Connection, id: &str) -> rusqlite::Result<Option<(String, String, String)>> {
    conn.query_row(
        "SELECT title, provider, session_json FROM sessions WHERE id = ?1",
        params![id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )
    .optional()
}

fn request_count(session: &Value) -> i64 {
    session
        .get("requests")
        .and_then(|r| r.as_array())
        .map(|r| {
            r.iter()
                .map(|req| {
                    i64::from(req.get("message").is_some())
                        + i64::from(req.get("response").is_some())
                })
                .sum()
        })
        .unwrap_or(0)
}

#[derive(Deserialize)]
pub struct ForkBody {
    #[serde(default)]
    pub title: Option<String>,
}

/// `POST /api/sessions/{id}/fork`
///
/// Copies the conversation into a new session. The copy is independent --
/// appending to either afterwards does not affect the other -- and records
/// its origin in `parentSessionId` so the lineage is not lost.
pub async fn fork_session(
    state: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<ForkBody>,
) -> impl Responder {
    let db = state.db.lock().unwrap();
    let source_id = path.into_inner();

    let loaded = match load_session(&db.conn, &source_id) {
        Ok(v) => v,
        Err(e) => return db_error(e),
    };
    let Some((title, provider, raw)) = loaded else {
        return not_found("Session");
    };

    let mut session: Value =
        serde_json::from_str(&raw).unwrap_or_else(|_| json!({ "requests": [] }));
    session["forkedFrom"] = json!(source_id);

    let new_id = uuid::Uuid::new_v4().to_string();
    let new_title = body
        .title
        .clone()
        .filter(|t| !t.trim().is_empty())
        .unwrap_or_else(|| format!("{title} (fork)"));
    let now = now_secs();
    let count = request_count(&session);

    let inserted = db.conn.execute(
        "INSERT INTO sessions
            (id, provider, workspace_id, workspace_path, title, message_count,
             created_at, updated_at, harvested_at, session_json)
         SELECT ?1, ?2, workspace_id, workspace_path, ?3, ?4, ?5, ?5, ?5, ?6
         FROM sessions WHERE id = ?7",
        params![
            new_id,
            provider,
            new_title,
            count,
            now,
            session.to_string(),
            source_id
        ],
    );

    match inserted {
        Ok(_) => created(json!({
            "id": new_id,
            "title": new_title,
            "provider": provider,
            "parentSessionId": source_id,
            "message_count": count,
            "created_at": now,
        })),
        Err(e) => db_error(e),
    }
}

#[derive(Deserialize)]
pub struct MergeBody {
    #[serde(default, alias = "sessionIds")]
    pub session_ids: Vec<String>,
    #[serde(default)]
    pub title: Option<String>,
}

/// `POST /api/sessions/merge`
///
/// Concatenates several sessions into a new one, in the order given. The
/// sources are left untouched: a merge that consumed its inputs would make
/// an accidental merge unrecoverable, and the caller can delete them after
/// checking the result.
pub async fn merge_sessions(
    state: web::Data<AppState>,
    body: web::Json<MergeBody>,
) -> impl Responder {
    if body.session_ids.len() < 2 {
        return fail(
            StatusCode::BAD_REQUEST,
            "sessionIds must name at least two sessions",
        );
    }

    let db = state.db.lock().unwrap();
    let mut requests: Vec<Value> = Vec::new();
    let mut provider = String::from("chasm");

    for (i, id) in body.session_ids.iter().enumerate() {
        let loaded = match load_session(&db.conn, id) {
            Ok(v) => v,
            Err(e) => return db_error(e),
        };
        let Some((_, source_provider, raw)) = loaded else {
            return fail(StatusCode::NOT_FOUND, format!("Session {id} not found"));
        };
        if i == 0 {
            provider = source_provider;
        }
        let session: Value = serde_json::from_str(&raw).unwrap_or_else(|_| json!({}));
        if let Some(rs) = session.get("requests").and_then(|r| r.as_array()) {
            // Tag each turn with where it came from, so a merged transcript
            // can still be traced back.
            for r in rs {
                let mut r = r.clone();
                r["mergedFrom"] = json!(id);
                requests.push(r);
            }
        }
    }

    let merged = json!({ "requests": requests, "mergedFrom": body.session_ids });
    let count = request_count(&merged);
    let new_id = uuid::Uuid::new_v4().to_string();
    let title = body
        .title
        .clone()
        .filter(|t| !t.trim().is_empty())
        .unwrap_or_else(|| format!("Merge of {} sessions", body.session_ids.len()));
    let now = now_secs();

    let inserted = db.conn.execute(
        "INSERT INTO sessions
            (id, provider, title, message_count, created_at, updated_at,
             harvested_at, session_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?5, ?6)",
        params![new_id, provider, title, count, now, merged.to_string()],
    );

    match inserted {
        Ok(_) => created(json!({
            "id": new_id,
            "title": title,
            "provider": provider,
            "message_count": count,
            "mergedFrom": body.session_ids,
            "created_at": now,
        })),
        Err(e) => db_error(e),
    }
}

#[derive(Deserialize)]
pub struct ExportQuery {
    #[serde(default)]
    pub format: Option<String>,
}

/// `GET /api/sessions/{id}/export`
///
/// `format=json` returns the stored blob; `format=markdown` renders the
/// transcript. Served as a download with a filename, because the point of
/// this endpoint is to get a file out.
pub async fn export_session(
    state: web::Data<AppState>,
    path: web::Path<String>,
    query: web::Query<ExportQuery>,
) -> impl Responder {
    let db = state.db.lock().unwrap();
    let id = path.into_inner();

    let loaded = match load_session(&db.conn, &id) {
        Ok(v) => v,
        Err(e) => return db_error(e),
    };
    let Some((title, _, raw)) = loaded else {
        return not_found("Session");
    };

    let format = query.format.clone().unwrap_or_else(|| "json".into());
    let session: Value = serde_json::from_str(&raw).unwrap_or_else(|_| json!({}));

    let (body, mime, ext) = match format.as_str() {
        "json" => (raw, "application/json", "json"),
        "markdown" | "md" => (render_markdown(&title, &session), "text/markdown", "md"),
        other => {
            return fail(
                StatusCode::BAD_REQUEST,
                format!("unsupported format '{other}'; expected json or markdown"),
            )
        }
    };

    HttpResponse::Ok()
        .content_type(mime)
        .insert_header((
            "Content-Disposition",
            format!("attachment; filename=\"{}.{ext}\"", safe_filename(&title)),
        ))
        .body(body)
}

/// Render the transcript the same way the read path reconstructs it, so an
/// export matches what `GET /sessions/{id}` shows.
fn render_markdown(title: &str, session: &Value) -> String {
    let mut out = format!("# {title}\n\n");
    if let Some(requests) = session.get("requests").and_then(|r| r.as_array()) {
        for request in requests {
            if let Some(text) = request
                .pointer("/message/text")
                .and_then(|t| t.as_str())
                .filter(|t| !t.is_empty())
            {
                out.push_str("## User\n\n");
                out.push_str(text);
                out.push_str("\n\n");
            }
            if let Some(response) = request.get("response") {
                let text = response
                    .as_array()
                    .map(|parts| {
                        parts
                            .iter()
                            .filter_map(|p| p.get("value").and_then(|v| v.as_str()))
                            .collect::<Vec<_>>()
                            .join("")
                    })
                    .or_else(|| response.as_str().map(|s| s.to_string()))
                    .unwrap_or_default();
                if !text.is_empty() {
                    out.push_str("## Assistant\n\n");
                    out.push_str(&text);
                    out.push_str("\n\n");
                }
            }
        }
    }
    out
}

/// Strip anything that would make a filename awkward or unsafe on any of the
/// three platforms this runs on.
fn safe_filename(title: &str) -> String {
    let cleaned: String = title
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect();
    let trimmed = cleaned.trim_matches('-');
    if trimmed.is_empty() {
        "session".to_string()
    } else {
        trimmed.chars().take(60).collect()
    }
}

// =============================================================================
// Session sharing
// =============================================================================
//
// A share is a token that grants read access to one session *through this
// server*. Nothing is uploaded anywhere.
//
// That is a deliberate choice, not a shortcut. Chasm holds a person's entire
// chat history on their own machine; making "share" mean "transmit a
// conversation to a third party" is a decision with privacy consequences that
// belongs to whoever runs it, not to the code. A local token is useful for the
// cases that motivated the feature -- opening a session in another tab, handing
// a colleague a URL on the same network, embedding a link in a ticket on an
// internal host -- and it cannot leak anything the server was not already
// serving.
//
// Consequences worth knowing:
//   - A link only works while this server is reachable by the recipient.
//   - Anyone who has the token can read that session. It is a bearer
//     credential, which is why it is 256 bits from the OS random source and
//     why expiry and revocation both exist.

/// Table for outbound share tokens.
///
/// Distinct from the existing `share_links`, which records *inbound* provider
/// URLs (a ChatGPT or Claude share someone imported). Reusing that table would
/// conflate "a link I was given" with "a link I handed out".
fn ensure_shares_table(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS session_shares (
            token TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            expires_at INTEGER,
            revoked INTEGER NOT NULL DEFAULT 0,
            access_count INTEGER NOT NULL DEFAULT 0,
            last_accessed INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_session_shares_session
            ON session_shares(session_id);",
    )
}

/// 256 bits from the OS random source, hex encoded.
///
/// `uuid::Uuid::new_v4` would be 122 bits and is designed for uniqueness, not
/// unguessability. This value is a bearer credential.
fn new_share_token() -> String {
    use rand::RngCore;
    let mut bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

#[derive(Deserialize)]
pub struct CreateShareBody {
    /// Hours until the link stops working. Omit for a link that does not
    /// expire on its own -- revocation is then the only way to close it.
    #[serde(default, alias = "expiresInHours")]
    pub expires_in_hours: Option<i64>,
}

/// `POST /api/sessions/{id}/share`
pub async fn create_share(
    state: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<CreateShareBody>,
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

    if let Err(e) = ensure_shares_table(&db.conn) {
        return db_error(e);
    }

    let hours = body.expires_in_hours;
    if matches!(hours, Some(h) if h <= 0) {
        return fail(
            StatusCode::BAD_REQUEST,
            "expiresInHours must be positive; omit it for a link that does not expire",
        );
    }

    let token = new_share_token();
    let now = now_secs();
    let expires_at = hours.map(|h| now + h * 3600);

    if let Err(e) = db.conn.execute(
        "INSERT INTO session_shares (token, session_id, created_at, expires_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![token, session_id, now, expires_at],
    ) {
        return db_error(e);
    }

    created(json!({
        "token": token,
        "sessionId": session_id,
        "path": format!("/api/shared/{token}"),
        "createdAt": now,
        "expiresAt": expires_at,
        "revoked": false,
        "note": "Readable through this server only; nothing was uploaded.",
    }))
}

/// `GET /api/sessions/{id}/share`
///
/// Lists the links handed out for a session so they can be audited and
/// revoked. The token is returned in full: this is the owner's own view, and
/// a list of links you cannot copy is not much use.
pub async fn list_shares(state: web::Data<AppState>, path: web::Path<String>) -> impl Responder {
    let db = state.db.lock().unwrap();
    let session_id = path.into_inner();

    if let Err(e) = ensure_shares_table(&db.conn) {
        return db_error(e);
    }

    let now = now_secs();
    let result = (|| -> rusqlite::Result<Vec<Value>> {
        let mut stmt = db.conn.prepare(
            "SELECT token, created_at, expires_at, revoked, access_count, last_accessed
             FROM session_shares WHERE session_id = ?1 ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map(params![session_id], |row| {
            let expires_at: Option<i64> = row.get(2)?;
            let revoked: i64 = row.get(3)?;
            // Derived on read, like the inbox's permission expiry: a sweeper
            // that has not run yet must never make a dead link look live.
            let status = if revoked != 0 {
                "revoked"
            } else if expires_at.is_some_and(|e| e <= now) {
                "expired"
            } else {
                "active"
            };
            Ok(json!({
                "token": row.get::<_, String>(0)?,
                "createdAt": row.get::<_, i64>(1)?,
                "expiresAt": expires_at,
                "status": status,
                "accessCount": row.get::<_, i64>(4)?,
                "lastAccessed": row.get::<_, Option<i64>>(5)?,
            }))
        })?;
        rows.collect()
    })();

    match result {
        Ok(rows) => ok(rows),
        Err(e) => db_error(e),
    }
}

/// `DELETE /api/shared/{token}`
///
/// Revokes rather than deletes, so the access count and creation time survive
/// as a record that the link existed.
pub async fn revoke_share(state: web::Data<AppState>, path: web::Path<String>) -> impl Responder {
    let db = state.db.lock().unwrap();
    let token = path.into_inner();

    if let Err(e) = ensure_shares_table(&db.conn) {
        return db_error(e);
    }

    match db.conn.execute(
        "UPDATE session_shares SET revoked = 1 WHERE token = ?1",
        params![token],
    ) {
        Ok(0) => not_found("Share link"),
        Ok(_) => ok(json!({ "revoked": true })),
        Err(e) => db_error(e),
    }
}

/// `GET /api/shared/{token}`
///
/// Read a shared session. Answers 404 for a token that is unknown, revoked or
/// expired -- all three indistinguishable from outside, so a probe cannot use
/// the response to tell a real-but-closed link from a guess.
pub async fn read_shared(state: web::Data<AppState>, path: web::Path<String>) -> impl Responder {
    let db = state.db.lock().unwrap();
    let token = path.into_inner();

    if let Err(e) = ensure_shares_table(&db.conn) {
        return db_error(e);
    }

    let now = now_secs();
    let row: Option<(String, Option<i64>, i64)> = match db
        .conn
        .query_row(
            "SELECT session_id, expires_at, revoked FROM session_shares WHERE token = ?1",
            params![token],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .optional()
    {
        Ok(v) => v,
        Err(e) => return db_error(e),
    };

    let Some((session_id, expires_at, revoked)) = row else {
        return not_found("Share link");
    };
    if revoked != 0 || expires_at.is_some_and(|e| e <= now) {
        return not_found("Share link");
    }

    let loaded = match load_session(&db.conn, &session_id) {
        Ok(v) => v,
        Err(e) => return db_error(e),
    };
    let Some((title, provider, raw)) = loaded else {
        // The session was deleted after the link was made.
        return not_found("Session");
    };

    // Best-effort: a failed bookkeeping update must not deny a valid read.
    let _ = db.conn.execute(
        "UPDATE session_shares
         SET access_count = access_count + 1, last_accessed = ?1
         WHERE token = ?2",
        params![now, token],
    );

    let session: Value = serde_json::from_str(&raw).unwrap_or_else(|_| json!({}));
    ok(json!({
        "id": session_id,
        "title": title,
        "provider": provider,
        "messages": super::handlers_simple::extract_messages_from_session(&session),
        "readOnly": true,
    }))
}

// =============================================================================
// Semantic search
// =============================================================================
//
// Indexing is a separate, explicit step. Embedding every message in a store
// costs money and time proportional to its size, so a query must never
// silently trigger one: `GET /search/semantic` searches whatever has been
// indexed and says how much that was, and `POST /search/semantic/index` is
// what does the work.
//
// Without OPENAI_API_KEY both answer 503 naming the variable, exactly like
// /chat/completions. There is no lexical fallback here on purpose -- returning
// substring matches from an endpoint called "semantic" is how the old
// zero-vector embeddings bug looked from the outside: plausible output that
// silently was not the thing requested. `/search` already does substring
// matching and is the honest place for it.

/// Where vectors live. Shares the `embeddings` table from `sql/schema.sql`,
/// which has existed unused since the schema was written -- nothing in the
/// tree ever inserted a row.
fn ensure_embeddings_table(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS embeddings (
            id TEXT PRIMARY KEY,
            source_type TEXT NOT NULL,
            source_id TEXT NOT NULL,
            model TEXT NOT NULL,
            dimensions INTEGER NOT NULL,
            vector BLOB NOT NULL,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            metadata TEXT,
            UNIQUE(source_type, source_id, model)
        );
        CREATE INDEX IF NOT EXISTS idx_embeddings_source
            ON embeddings(source_type, model);",
    )
}

fn embedding_model() -> String {
    std::env::var("CHASM_EMBEDDING_MODEL").unwrap_or_else(|_| "text-embedding-3-small".to_string())
}

/// Little-endian f32 blob. SQLite has no vector type; this keeps the encoding
/// in one place so the reader cannot disagree with the writer.
fn encode_vector(v: &[f32]) -> Vec<u8> {
    v.iter().flat_map(|f| f.to_le_bytes()).collect()
}

fn decode_vector(bytes: &[u8]) -> Vec<f32> {
    bytes
        .chunks_exact(4)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect()
}

/// Cosine similarity. Returns 0.0 for a zero-magnitude vector rather than
/// NaN, so one degenerate row cannot poison a whole ranking.
fn cosine(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() {
        return 0.0;
    }
    let (mut dot, mut na, mut nb) = (0.0f32, 0.0f32, 0.0f32);
    for (x, y) in a.iter().zip(b.iter()) {
        dot += x * y;
        na += x * x;
        nb += y * y;
    }
    if na == 0.0 || nb == 0.0 {
        return 0.0;
    }
    dot / (na.sqrt() * nb.sqrt())
}

struct Embedder {
    client: reqwest::Client,
    api_key: String,
    base_url: String,
    model: String,
}

impl Embedder {
    /// `None` when no key is configured -- the caller turns that into a 503
    /// rather than proceeding with something that cannot work.
    fn from_env() -> Option<Self> {
        let api_key = std::env::var("OPENAI_API_KEY").unwrap_or_default();
        if api_key.trim().is_empty() {
            return None;
        }
        Some(Self {
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(60))
                .build()
                .ok()?,
            api_key,
            base_url: std::env::var("OPENAI_BASE_URL")
                .unwrap_or_else(|_| "https://api.openai.com/v1".into())
                .trim_end_matches('/')
                .to_string(),
            model: embedding_model(),
        })
    }

    /// One vector per input, in input order.
    ///
    /// The order check is not paranoia: the API returns an `index` per item and
    /// nothing guarantees the array arrives sorted. Trusting position silently
    /// attaches every embedding to the wrong text, which looks like a working
    /// index that returns nonsense.
    async fn embed(&self, inputs: &[String]) -> Result<Vec<Vec<f32>>, String> {
        #[derive(serde::Deserialize)]
        struct Item {
            embedding: Vec<f32>,
            index: usize,
        }
        #[derive(serde::Deserialize)]
        struct Resp {
            data: Vec<Item>,
        }

        let response = self
            .client
            .post(format!("{}/embeddings", self.base_url))
            .bearer_auth(&self.api_key)
            .json(&json!({ "model": self.model, "input": inputs }))
            .send()
            .await
            .map_err(|e| format!("embedding request failed: {e}"))?;

        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(format!(
                "embedding API returned {status}: {}",
                snippet(&text, 200)
            ));
        }

        let parsed: Resp = serde_json::from_str(&text)
            .map_err(|e| format!("embedding API returned unparseable JSON: {e}"))?;
        if parsed.data.len() != inputs.len() {
            return Err(format!(
                "embedding API returned {} vectors for {} inputs",
                parsed.data.len(),
                inputs.len()
            ));
        }

        let mut out = vec![Vec::new(); inputs.len()];
        for item in parsed.data {
            if item.index >= out.len() {
                return Err(format!(
                    "embedding API returned out-of-range index {}",
                    item.index
                ));
            }
            out[item.index] = item.embedding;
        }
        if out.iter().any(|v| v.is_empty()) {
            return Err("embedding API skipped an input".to_string());
        }
        Ok(out)
    }
}

/// Sessions rendered to one text per session, for embedding.
fn indexable_sessions(
    conn: &Connection,
    limit: i64,
) -> rusqlite::Result<Vec<(String, String, String)>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, session_json FROM sessions ORDER BY updated_at DESC LIMIT ?1",
    )?;
    let rows = stmt.query_map(params![limit], |row| {
        let id: String = row.get(0)?;
        let title: String = row.get(1)?;
        let raw: String = row.get(2)?;
        Ok((id, title, raw))
    })?;
    rows.collect()
}

/// Title plus transcript, truncated. Embedding endpoints have token limits and
/// a whole session can exceed them; the head of a conversation is the part
/// that characterises it.
fn session_text(title: &str, raw: &str) -> String {
    let session: Value = serde_json::from_str(raw).unwrap_or_else(|_| json!({}));
    let mut text = String::from(title);
    if let Some(requests) = session.get("requests").and_then(|r| r.as_array()) {
        for request in requests {
            if let Some(t) = request.pointer("/message/text").and_then(|t| t.as_str()) {
                text.push('\n');
                text.push_str(t);
            }
            if let Some(parts) = request.get("response").and_then(|r| r.as_array()) {
                for p in parts {
                    if let Some(v) = p.get("value").and_then(|v| v.as_str()) {
                        text.push('\n');
                        text.push_str(v);
                    }
                }
            }
            if text.chars().count() > 6000 {
                break;
            }
        }
    }
    text.chars().take(6000).collect()
}

#[derive(Deserialize)]
pub struct IndexBody {
    /// How many of the most recently updated sessions to consider.
    #[serde(default)]
    pub limit: Option<i64>,
    /// Re-embed sessions that already have a vector for this model.
    #[serde(default)]
    pub force: Option<bool>,
}

/// `POST /api/search/semantic/index`
///
/// Embeds sessions that have no vector yet and reports what it did. Runs
/// synchronously: it is an explicit administrative action, and a caller that
/// asked to build an index should be told when it finished and what it cost.
pub async fn build_semantic_index(
    state: web::Data<AppState>,
    body: web::Json<IndexBody>,
) -> impl Responder {
    let Some(embedder) = Embedder::from_env() else {
        return fail(
            StatusCode::SERVICE_UNAVAILABLE,
            "No embedding model configured. Set OPENAI_API_KEY (and OPENAI_BASE_URL \
             for a local or self-hosted endpoint) on the server.",
        );
    };

    let limit = body.limit.unwrap_or(200).clamp(1, 2000);
    let force = body.force.unwrap_or(false);
    let model = embedder.model.clone();

    // Collect the work under the lock, then release it: embedding is a network
    // round trip and holding the database mutex across it would stall every
    // other request.
    let pending: Vec<(String, String)> = {
        let db = state.db.lock().unwrap();
        if let Err(e) = ensure_embeddings_table(&db.conn) {
            return db_error(e);
        }
        let sessions = match indexable_sessions(&db.conn, limit) {
            Ok(s) => s,
            Err(e) => return db_error(e),
        };
        let mut pending = Vec::new();
        for (id, title, raw) in sessions {
            if !force {
                let seen: Option<i64> = db
                    .conn
                    .query_row(
                        "SELECT 1 FROM embeddings
                         WHERE source_type = 'session' AND source_id = ?1 AND model = ?2",
                        params![id, model],
                        |r| r.get(0),
                    )
                    .optional()
                    .unwrap_or(None);
                if seen.is_some() {
                    continue;
                }
            }
            pending.push((id, session_text(&title, &raw)));
        }
        pending
    };

    if pending.is_empty() {
        return ok(json!({
            "model": model,
            "indexed": 0,
            "skipped": 0,
            "note": "Everything in range already has a vector for this model. Pass force to rebuild.",
        }));
    }

    // Batched: one request per session would be needlessly slow and costly.
    let mut indexed = 0usize;
    for chunk in pending.chunks(32) {
        let texts: Vec<String> = chunk.iter().map(|(_, t)| t.clone()).collect();
        let vectors = match embedder.embed(&texts).await {
            Ok(v) => v,
            Err(e) => {
                // Report partial progress rather than pretending nothing
                // happened: the rows already written are real.
                return fail(
                    StatusCode::BAD_GATEWAY,
                    format!("{e} (indexed {indexed} before this failure)"),
                );
            }
        };

        let db = state.db.lock().unwrap();
        for ((id, _), vector) in chunk.iter().zip(vectors.iter()) {
            let blob = encode_vector(vector);
            let row_id = uuid::Uuid::new_v4().to_string();
            if let Err(e) = db.conn.execute(
                "INSERT INTO embeddings
                    (id, source_type, source_id, model, dimensions, vector, created_at)
                 VALUES (?1, 'session', ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(source_type, source_id, model)
                 DO UPDATE SET vector = excluded.vector,
                               dimensions = excluded.dimensions,
                               created_at = excluded.created_at",
                params![row_id, id, model, vector.len() as i64, blob, now_secs()],
            ) {
                return db_error(e);
            }
            indexed += 1;
        }
    }

    ok(json!({ "model": model, "indexed": indexed }))
}

#[derive(Deserialize)]
pub struct SemanticQuery {
    #[serde(default)]
    pub q: String,
    #[serde(default)]
    pub limit: Option<usize>,
}

/// `GET /api/search/semantic`
///
/// Ranks indexed sessions by cosine similarity to the query. Reports how many
/// vectors it searched, so an empty result from an empty index is
/// distinguishable from an empty result from a real one -- the difference
/// between "nothing matched" and "nothing to match against".
pub async fn semantic_search(
    state: web::Data<AppState>,
    query: web::Query<SemanticQuery>,
) -> impl Responder {
    let q = query.q.trim().to_string();
    if q.is_empty() {
        return fail(StatusCode::BAD_REQUEST, "q is required");
    }
    let limit = query.limit.unwrap_or(10).clamp(1, 100);

    let Some(embedder) = Embedder::from_env() else {
        return fail(
            StatusCode::SERVICE_UNAVAILABLE,
            "No embedding model configured. Set OPENAI_API_KEY (and OPENAI_BASE_URL \
             for a local or self-hosted endpoint) on the server.",
        );
    };
    let model = embedder.model.clone();

    let rows: Vec<(String, Vec<f32>)> = {
        let db = state.db.lock().unwrap();
        if let Err(e) = ensure_embeddings_table(&db.conn) {
            return db_error(e);
        }
        let collected = (|| -> rusqlite::Result<Vec<(String, Vec<f32>)>> {
            let mut stmt = db.conn.prepare(
                "SELECT source_id, vector FROM embeddings
                 WHERE source_type = 'session' AND model = ?1",
            )?;
            let it = stmt.query_map(params![model], |row| {
                let id: String = row.get(0)?;
                let blob: Vec<u8> = row.get(1)?;
                Ok((id, decode_vector(&blob)))
            })?;
            it.collect()
        })();
        match collected {
            Ok(v) => v,
            Err(e) => return db_error(e),
        }
    };

    if rows.is_empty() {
        return ok(json!({
            "query": q,
            "model": model,
            "searched": 0,
            "results": [],
            "note": "No sessions are indexed for this model. POST /api/search/semantic/index first.",
        }));
    }

    let query_vector = match embedder.embed(std::slice::from_ref(&q)).await {
        Ok(v) => v.into_iter().next().unwrap_or_default(),
        Err(e) => return fail(StatusCode::BAD_GATEWAY, e),
    };

    let mut scored: Vec<(String, f32)> = rows
        .into_iter()
        .map(|(id, v)| {
            let s = cosine(&query_vector, &v);
            (id, s)
        })
        .collect();
    let searched = scored.len();
    scored.sort_by(|a, b| b.1.total_cmp(&a.1));
    scored.truncate(limit);

    // Titles for the winners only.
    let db = state.db.lock().unwrap();
    let results: Vec<Value> = scored
        .into_iter()
        .map(|(id, score)| {
            let title: Option<String> = db
                .conn
                .query_row(
                    "SELECT title FROM sessions WHERE id = ?1",
                    params![id],
                    |r| r.get(0),
                )
                .optional()
                .unwrap_or(None);
            json!({
                "type": "session",
                "id": id,
                "title": title,
                "score": score,
            })
        })
        .collect();

    ok(json!({
        "query": q,
        "model": model,
        "searched": searched,
        "results": results,
    }))
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
        .route(
            "/sessions/{id}/checkpoints",
            web::get().to(list_checkpoints),
        )
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
        .route("/stats/timeline", web::get().to(timeline_stats))
        .route("/workspaces", web::post().to(create_workspace))
        .route("/workspaces/{id}", web::put().to(update_workspace))
        .route("/workspaces/{id}", web::delete().to(delete_workspace))
        .route("/sessions/{id}/fork", web::post().to(fork_session))
        .route("/sessions/merge", web::post().to(merge_sessions))
        .route("/sessions/{id}/export", web::get().to(export_session))
        .route("/sessions/{id}/share", web::post().to(create_share))
        .route("/sessions/{id}/share", web::get().to(list_shares))
        .route("/shared/{token}", web::get().to(read_shared))
        .route("/shared/{token}", web::delete().to(revoke_share))
        .route("/search/semantic", web::get().to(semantic_search))
        .route(
            "/search/semantic/index",
            web::post().to(build_semantic_index),
        )
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
        assert_eq!(
            requests.len(),
            1,
            "reply should not create a second request"
        );
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

    // ---------------------------------------------------------------------
    // Timeline
    // ---------------------------------------------------------------------

    #[tokio::test]
    async fn the_timeline_groups_sessions_by_day() {
        let (state, _d) = temp_state("timeline");
        let app = app!(state);
        for _ in 0..3 {
            make_session(&app).await;
        }

        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/stats/timeline?days=7")
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_json(resp).await;
        let points = body["data"]["points"].as_array().expect("points");
        assert_eq!(points.len(), 1, "three sessions today is one day");
        assert_eq!(points[0]["sessions"], 3);
    }

    /// Quiet days are omitted rather than zero-filled, so an empty store reads
    /// as empty instead of as a run of zeroes it never recorded.
    #[tokio::test]
    async fn an_empty_store_has_no_timeline_points() {
        let (state, _d) = temp_state("timeline-empty");
        let app = app!(state);
        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/stats/timeline")
                .to_request(),
        )
        .await;
        assert_eq!(body_json(resp).await["data"]["points"], json!([]));
    }

    // ---------------------------------------------------------------------
    // Workspaces
    // ---------------------------------------------------------------------

    #[tokio::test]
    async fn a_workspace_round_trips_and_deleting_it_keeps_its_sessions() {
        let (state, _d) = temp_state("ws");
        let app = app!(state);

        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/workspaces")
                .set_json(json!({ "name": "proj", "path": "/tmp/proj" }))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::CREATED);
        let ws_id = body_json(resp).await["data"]["id"]
            .as_str()
            .expect("id")
            .to_string();

        // A session filed under it.
        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/sessions")
                .set_json(json!({ "title": "s", "workspaceId": ws_id }))
                .to_request(),
        )
        .await;
        let session_id = body_json(resp).await["data"]["id"]
            .as_str()
            .expect("id")
            .to_string();

        let resp = test::call_service(
            &app,
            test::TestRequest::delete()
                .uri(&format!("/api/workspaces/{ws_id}"))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::OK);

        // The conversation must survive; only its filing is undone.
        let db = state.db.lock().unwrap();
        let (count, workspace): (i64, Option<String>) = db
            .conn
            .query_row(
                "SELECT COUNT(*), MAX(workspace_id) FROM sessions WHERE id = ?1",
                params![session_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(
            count, 1,
            "deleting a workspace must not delete its sessions"
        );
        assert!(workspace.is_none(), "the session should be detached");
    }

    #[tokio::test]
    async fn a_workspace_needs_a_name() {
        let (state, _d) = temp_state("ws-noname");
        let app = app!(state);
        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/workspaces")
                .set_json(json!({ "path": "/tmp/x" }))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn updating_a_missing_workspace_is_404() {
        let (state, _d) = temp_state("ws-404");
        let app = app!(state);
        let resp = test::call_service(
            &app,
            test::TestRequest::put()
                .uri("/api/workspaces/ghost")
                .set_json(json!({ "name": "x" }))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    // ---------------------------------------------------------------------
    // Fork, merge, export
    // ---------------------------------------------------------------------

    async fn session_with_exchange<S>(app: &S) -> String
    where
        S: actix_web::dev::Service<
            actix_http::Request,
            Response = actix_web::dev::ServiceResponse,
            Error = actix_web::Error,
        >,
    {
        let id = make_session(app).await;
        for (role, content) in [("user", "ping"), ("assistant", "pong")] {
            test::call_service(
                app,
                test::TestRequest::post()
                    .uri(&format!("/api/sessions/{id}/messages"))
                    .set_json(json!({ "role": role, "content": content }))
                    .to_request(),
            )
            .await;
        }
        id
    }

    /// A fork must be independent: appending to the copy must not touch the
    /// original, or "fork" would mean "alias".
    #[tokio::test]
    async fn a_fork_is_independent_of_its_source() {
        let (state, _d) = temp_state("fork");
        let app = app!(state);
        let source = session_with_exchange(&app).await;

        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri(&format!("/api/sessions/{source}/fork"))
                .set_json(json!({}))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::CREATED);
        let body = body_json(resp).await;
        let fork = body["data"]["id"].as_str().expect("id").to_string();
        assert_eq!(body["data"]["parentSessionId"], source);
        assert_eq!(body["data"]["message_count"], 2);

        test::call_service(
            &app,
            test::TestRequest::post()
                .uri(&format!("/api/sessions/{fork}/messages"))
                .set_json(json!({ "role": "user", "content": "only in the fork" }))
                .to_request(),
        )
        .await;

        let db = state.db.lock().unwrap();
        let source_count: i64 = db
            .conn
            .query_row(
                "SELECT message_count FROM sessions WHERE id = ?1",
                params![source],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(source_count, 2, "the source must be untouched");
    }

    #[tokio::test]
    async fn forking_a_missing_session_is_404() {
        let (state, _d) = temp_state("fork404");
        let app = app!(state);
        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/sessions/ghost/fork")
                .set_json(json!({}))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    /// Merging must not consume its inputs -- an accidental merge has to be
    /// recoverable.
    #[tokio::test]
    async fn merging_leaves_the_sources_intact() {
        let (state, _d) = temp_state("merge");
        let app = app!(state);
        let a = session_with_exchange(&app).await;
        let b = session_with_exchange(&app).await;

        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/sessions/merge")
                .set_json(json!({ "sessionIds": [a, b], "title": "combined" }))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::CREATED);
        let body = body_json(resp).await;
        assert_eq!(body["data"]["message_count"], 4);
        assert_eq!(body["data"]["title"], "combined");

        let db = state.db.lock().unwrap();
        let remaining: i64 = db
            .conn
            .query_row(
                "SELECT COUNT(*) FROM sessions WHERE id IN (?1, ?2)",
                params![a, b],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(remaining, 2, "merge must not delete its sources");
    }

    #[tokio::test]
    async fn merging_fewer_than_two_sessions_is_rejected() {
        let (state, _d) = temp_state("merge-one");
        let app = app!(state);
        let a = make_session(&app).await;
        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/sessions/merge")
                .set_json(json!({ "sessionIds": [a] }))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn merging_names_the_session_it_could_not_find() {
        let (state, _d) = temp_state("merge-missing");
        let app = app!(state);
        let a = make_session(&app).await;
        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/sessions/merge")
                .set_json(json!({ "sessionIds": [a, "ghost"] }))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn export_renders_markdown_and_json() {
        let (state, _d) = temp_state("export");
        let app = app!(state);
        let id = session_with_exchange(&app).await;

        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri(&format!("/api/sessions/{id}/export?format=markdown"))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::OK);
        let body = String::from_utf8(test::read_body(resp).await.to_vec()).unwrap();
        assert!(body.contains("## User"), "missing user turn:\n{body}");
        assert!(body.contains("ping"), "missing prompt text");
        assert!(body.contains("pong"), "missing reply text");

        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri(&format!("/api/sessions/{id}/export?format=json"))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn an_unknown_export_format_is_rejected() {
        let (state, _d) = temp_state("export-bad");
        let app = app!(state);
        let id = make_session(&app).await;
        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri(&format!("/api/sessions/{id}/export?format=pdf"))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn a_filename_is_stripped_of_path_characters() {
        assert_eq!(safe_filename("../../etc/passwd"), "etc-passwd");
        assert_eq!(safe_filename("a/b\\c:d"), "a-b-c-d");
        assert_eq!(safe_filename("   "), "session");
        assert!(safe_filename(&"x".repeat(200)).chars().count() <= 60);
    }

    // ---------------------------------------------------------------------
    // Sharing
    // ---------------------------------------------------------------------

    #[tokio::test]
    async fn a_share_link_reads_the_session_then_stops_when_revoked() {
        let (state, _d) = temp_state("share");
        let app = app!(state);
        let id = session_with_exchange(&app).await;

        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri(&format!("/api/sessions/{id}/share"))
                .set_json(json!({}))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::CREATED);
        let body = body_json(resp).await;
        let token = body["data"]["token"].as_str().expect("token").to_string();
        assert_eq!(token.len(), 64, "expected 256 bits of hex");

        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri(&format!("/api/shared/{token}"))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::OK);
        let shared = body_json(resp).await;
        assert_eq!(shared["data"]["id"], id);
        assert_eq!(shared["data"]["readOnly"], true);

        let resp = test::call_service(
            &app,
            test::TestRequest::delete()
                .uri(&format!("/api/shared/{token}"))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::OK);

        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri(&format!("/api/shared/{token}"))
                .to_request(),
        )
        .await;
        assert_eq!(
            resp.status(),
            StatusCode::NOT_FOUND,
            "a revoked link must stop working"
        );
    }

    /// Expiry is derived on read. Without that, a link stays live until some
    /// sweeper runs -- which is exactly the failure the inbox had.
    #[tokio::test]
    async fn an_expired_link_is_dead_without_anything_having_swept_it() {
        let (state, _d) = temp_state("share-exp");
        let app = app!(state);
        let id = make_session(&app).await;

        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri(&format!("/api/sessions/{id}/share"))
                .set_json(json!({ "expiresInHours": 1 }))
                .to_request(),
        )
        .await;
        let token = body_json(resp).await["data"]["token"]
            .as_str()
            .expect("token")
            .to_string();

        // Backdate it rather than sleeping.
        {
            let db = state.db.lock().unwrap();
            db.conn
                .execute(
                    "UPDATE session_shares SET expires_at = ?1 WHERE token = ?2",
                    params![now_secs() - 60, token],
                )
                .unwrap();
        }

        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri(&format!("/api/shared/{token}"))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);

        // And the owner's listing should say so, not show it as active.
        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri(&format!("/api/sessions/{id}/share"))
                .to_request(),
        )
        .await;
        let rows = body_json(resp).await;
        assert_eq!(rows["data"][0]["status"], "expired");
    }

    #[tokio::test]
    async fn an_unknown_share_token_is_404_not_500() {
        let (state, _d) = temp_state("share-unknown");
        let app = app!(state);
        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/shared/deadbeef")
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn sharing_a_missing_session_is_404() {
        let (state, _d) = temp_state("share-404");
        let app = app!(state);
        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/sessions/ghost/share")
                .set_json(json!({}))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn a_non_positive_expiry_is_rejected() {
        let (state, _d) = temp_state("share-badexp");
        let app = app!(state);
        let id = make_session(&app).await;
        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri(&format!("/api/sessions/{id}/share"))
                .set_json(json!({ "expiresInHours": 0 }))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn share_tokens_do_not_repeat() {
        let a = new_share_token();
        let b = new_share_token();
        assert_ne!(a, b);
        assert_eq!(a.len(), 64);
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
    }

    // ---------------------------------------------------------------------
    // Semantic search
    // ---------------------------------------------------------------------

    #[test]
    fn cosine_is_one_for_identical_vectors_and_zero_for_orthogonal() {
        assert!((cosine(&[1.0, 0.0], &[1.0, 0.0]) - 1.0).abs() < 1e-6);
        assert!(cosine(&[1.0, 0.0], &[0.0, 1.0]).abs() < 1e-6);
        assert!((cosine(&[1.0, 0.0], &[-1.0, 0.0]) + 1.0).abs() < 1e-6);
    }

    /// A zero vector must score 0, not NaN -- one degenerate row would
    /// otherwise scramble the whole ranking when sorted.
    #[test]
    fn cosine_handles_degenerate_input() {
        assert_eq!(cosine(&[0.0, 0.0], &[1.0, 1.0]), 0.0);
        assert_eq!(cosine(&[1.0], &[1.0, 2.0]), 0.0, "length mismatch scores 0");
    }

    #[test]
    fn vectors_survive_the_blob_round_trip() {
        let v = vec![0.5f32, -1.25, 0.0, 3.75];
        assert_eq!(decode_vector(&encode_vector(&v)), v);
    }

    #[tokio::test]
    async fn semantic_search_without_a_key_says_what_to_set() {
        if !std::env::var("OPENAI_API_KEY")
            .unwrap_or_default()
            .trim()
            .is_empty()
        {
            return; // a real key is configured; this contract does not apply
        }
        let (state, _d) = temp_state("sem");
        let app = app!(state);
        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/search/semantic?q=hello")
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

    /// It must refuse rather than quietly falling back to substring matching.
    /// `/search` is where that behaviour lives, and an endpoint called
    /// "semantic" returning lexical hits is the failure this codebase already
    /// had once with zero-vector embeddings.
    #[tokio::test]
    async fn semantic_search_does_not_fall_back_to_substring_matching() {
        if !std::env::var("OPENAI_API_KEY")
            .unwrap_or_default()
            .trim()
            .is_empty()
        {
            return;
        }
        let (state, _d) = temp_state("sem-nofallback");
        let app = app!(state);
        test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/sessions")
                .set_json(json!({ "title": "hello world" }))
                .to_request(),
        )
        .await;

        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/search/semantic?q=hello")
                .to_request(),
        )
        .await;
        assert_eq!(
            resp.status(),
            StatusCode::SERVICE_UNAVAILABLE,
            "an exact-title match must not be returned as a semantic result"
        );
    }

    #[tokio::test]
    async fn an_empty_semantic_query_is_rejected_before_any_network_call() {
        let (state, _d) = temp_state("sem-empty");
        let app = app!(state);
        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/search/semantic?q=")
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn indexing_without_a_key_says_what_to_set() {
        if !std::env::var("OPENAI_API_KEY")
            .unwrap_or_default()
            .trim()
            .is_empty()
        {
            return;
        }
        let (state, _d) = temp_state("sem-index");
        let app = app!(state);
        let resp = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/search/semantic/index")
                .set_json(json!({}))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
    }
}
