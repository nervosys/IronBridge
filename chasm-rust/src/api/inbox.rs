// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only
//! Agent Inbox: notifications, agent messages, permission requests, and
//! workflow runs.
//!
//! The web client's `AgentInbox` view previously had no backend at all and
//! rendered empty unless `VITE_ENABLE_DEMO_MODE` was set. The four record
//! types here mirror the TypeScript interfaces in
//! `chasm-web/src/components/AgentInbox.tsx` field for field, and serialize as
//! camelCase so the client needs no translation layer.
//!
//! Events originate in the agency runtime -- it is what starts runs, moves
//! them through steps, and finishes or fails them. [`InboxEmitter`] is the
//! write side it uses; the REST handlers below are the read side plus the
//! user's responses (marking read, starring, approving a permission).

use actix_web::{web, HttpResponse};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// Milliseconds since the epoch. The client's timestamps are JS-style
/// milliseconds, so storing seconds here would silently shift every date by
/// three orders of magnitude.
fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn new_id(prefix: &str) -> String {
    format!("{}_{}_{}", prefix, now_ms(), unique_suffix())
}

/// A short non-cryptographic suffix. Two records created in the same
/// millisecond would otherwise collide on the primary key.
fn unique_suffix() -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{:06x}", n & 0xff_ffff)
}

// =============================================================================
// Records
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentNotification {
    pub id: String,
    pub category: String,
    pub priority: String,
    pub title: String,
    pub body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub run_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub swarm_id: Option<String>,
    pub read: bool,
    pub dismissed: bool,
    pub created_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub read_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InboxMessage {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from_agent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from_agent_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub to_agent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub to_agent_name: Option<String>,
    pub subject: String,
    pub body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thread_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reply_to_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub run_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub swarm_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attachments: Option<serde_json::Value>,
    pub read: bool,
    pub starred: bool,
    pub archived: bool,
    pub requires_response: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_options: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_response: Option<String>,
    pub created_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub responded_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionRequest {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub status: String,
    pub title: String,
    pub description: String,
    pub reason: String,
    pub risk_level: String,
    pub agent_id: String,
    pub agent_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub run_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub swarm_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resource: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_note: Option<String>,
    pub created_at: i64,
    pub expires_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub responded_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowProgress {
    pub run_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub swarm_id: Option<String>,
    pub name: String,
    pub status: String,
    pub progress: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_step: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_steps: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_steps: Option<i64>,
    pub active_agents: serde_json::Value,
    pub tokens_used: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_cost: Option<f64>,
    pub elapsed_time: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_time_remaining: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_event: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_event_time: Option<i64>,
    pub started_at: i64,
    pub updated_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<i64>,
}

// =============================================================================
// Schema
// =============================================================================

/// Create the inbox tables if they are absent.
///
/// Called from `api::start_server` alongside the auth tables. `IF NOT EXISTS`
/// throughout, so this is safe to run against an existing database.
pub fn init_inbox_tables(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS inbox_notifications (
            id TEXT PRIMARY KEY,
            category TEXT NOT NULL,
            priority TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            data TEXT,
            agent_id TEXT,
            agent_name TEXT,
            run_id TEXT,
            swarm_id TEXT,
            is_read INTEGER NOT NULL DEFAULT 0,
            dismissed INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            read_at INTEGER
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS inbox_messages (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            from_agent_id TEXT,
            from_agent_name TEXT,
            to_agent_id TEXT,
            to_agent_name TEXT,
            subject TEXT NOT NULL,
            body TEXT NOT NULL,
            thread_id TEXT,
            reply_to_id TEXT,
            run_id TEXT,
            swarm_id TEXT,
            attachments TEXT,
            is_read INTEGER NOT NULL DEFAULT 0,
            starred INTEGER NOT NULL DEFAULT 0,
            archived INTEGER NOT NULL DEFAULT 0,
            requires_response INTEGER NOT NULL DEFAULT 0,
            response_options TEXT,
            user_response TEXT,
            created_at INTEGER NOT NULL,
            responded_at INTEGER
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS inbox_permissions (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            status TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            reason TEXT NOT NULL,
            risk_level TEXT NOT NULL,
            agent_id TEXT NOT NULL,
            agent_name TEXT NOT NULL,
            run_id TEXT,
            swarm_id TEXT,
            resource TEXT,
            action TEXT,
            scope TEXT,
            response_note TEXT,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            responded_at INTEGER
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS inbox_workflows (
            run_id TEXT PRIMARY KEY,
            swarm_id TEXT,
            name TEXT NOT NULL,
            status TEXT NOT NULL,
            progress REAL NOT NULL DEFAULT 0,
            current_step TEXT,
            total_steps INTEGER,
            completed_steps INTEGER,
            active_agents TEXT,
            tokens_used INTEGER NOT NULL DEFAULT 0,
            estimated_cost REAL,
            elapsed_time INTEGER NOT NULL DEFAULT 0,
            estimated_time_remaining INTEGER,
            last_event TEXT,
            last_event_time INTEGER,
            started_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            completed_at INTEGER
        )",
        [],
    )?;

    // The client sorts newest-first and filters on unread/pending; these are
    // the two access paths worth indexing.
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_inbox_notifications_created
         ON inbox_notifications(created_at DESC)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_inbox_permissions_status
         ON inbox_permissions(status, created_at DESC)",
        [],
    )?;

    Ok(())
}

fn json_from_text(raw: Option<String>) -> Option<serde_json::Value> {
    raw.and_then(|s| serde_json::from_str(&s).ok())
}

// =============================================================================
// Reads
// =============================================================================

fn read_notifications(conn: &Connection) -> rusqlite::Result<Vec<AgentNotification>> {
    let mut stmt = conn.prepare(
        "SELECT id, category, priority, title, body, data, agent_id, agent_name,
                run_id, swarm_id, is_read, dismissed, created_at, read_at
         FROM inbox_notifications ORDER BY created_at DESC LIMIT 500",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(AgentNotification {
            id: row.get(0)?,
            category: row.get(1)?,
            priority: row.get(2)?,
            title: row.get(3)?,
            body: row.get(4)?,
            data: json_from_text(row.get(5)?),
            agent_id: row.get(6)?,
            agent_name: row.get(7)?,
            run_id: row.get(8)?,
            swarm_id: row.get(9)?,
            read: row.get::<_, i64>(10)? != 0,
            dismissed: row.get::<_, i64>(11)? != 0,
            created_at: row.get(12)?,
            read_at: row.get(13)?,
        })
    })?;
    rows.collect()
}

fn read_messages(conn: &Connection) -> rusqlite::Result<Vec<InboxMessage>> {
    let mut stmt = conn.prepare(
        "SELECT id, kind, from_agent_id, from_agent_name, to_agent_id, to_agent_name,
                subject, body, thread_id, reply_to_id, run_id, swarm_id, attachments,
                is_read, starred, archived, requires_response, response_options,
                user_response, created_at, responded_at
         FROM inbox_messages ORDER BY created_at DESC LIMIT 500",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(InboxMessage {
            id: row.get(0)?,
            kind: row.get(1)?,
            from_agent_id: row.get(2)?,
            from_agent_name: row.get(3)?,
            to_agent_id: row.get(4)?,
            to_agent_name: row.get(5)?,
            subject: row.get(6)?,
            body: row.get(7)?,
            thread_id: row.get(8)?,
            reply_to_id: row.get(9)?,
            run_id: row.get(10)?,
            swarm_id: row.get(11)?,
            attachments: json_from_text(row.get(12)?),
            read: row.get::<_, i64>(13)? != 0,
            starred: row.get::<_, i64>(14)? != 0,
            archived: row.get::<_, i64>(15)? != 0,
            requires_response: row.get::<_, i64>(16)? != 0,
            response_options: json_from_text(row.get(17)?),
            user_response: row.get(18)?,
            created_at: row.get(19)?,
            responded_at: row.get(20)?,
        })
    })?;
    rows.collect()
}

fn read_permissions(conn: &Connection) -> rusqlite::Result<Vec<PermissionRequest>> {
    let mut stmt = conn.prepare(
        "SELECT id, kind, status, title, description, reason, risk_level, agent_id,
                agent_name, run_id, swarm_id, resource, action, scope, response_note,
                created_at, expires_at, responded_at
         FROM inbox_permissions ORDER BY created_at DESC LIMIT 500",
    )?;
    let now = now_ms();
    let rows = stmt.query_map([], |row| {
        let stored_status: String = row.get(2)?;
        let expires_at: i64 = row.get(16)?;
        // Expiry is derived rather than stored: a request that lapsed while
        // nobody was looking would otherwise still read as `pending` and
        // invite an approval that is no longer valid.
        let status = if stored_status == "pending" && expires_at <= now {
            "expired".to_string()
        } else {
            stored_status
        };
        Ok(PermissionRequest {
            id: row.get(0)?,
            kind: row.get(1)?,
            status,
            title: row.get(3)?,
            description: row.get(4)?,
            reason: row.get(5)?,
            risk_level: row.get(6)?,
            agent_id: row.get(7)?,
            agent_name: row.get(8)?,
            run_id: row.get(9)?,
            swarm_id: row.get(10)?,
            resource: row.get(11)?,
            action: row.get(12)?,
            scope: row.get(13)?,
            response_note: row.get(14)?,
            created_at: row.get(15)?,
            expires_at,
            responded_at: row.get(17)?,
        })
    })?;
    rows.collect()
}

fn read_workflows(conn: &Connection) -> rusqlite::Result<Vec<WorkflowProgress>> {
    let mut stmt = conn.prepare(
        "SELECT run_id, swarm_id, name, status, progress, current_step, total_steps,
                completed_steps, active_agents, tokens_used, estimated_cost,
                elapsed_time, estimated_time_remaining, last_event, last_event_time,
                started_at, updated_at, completed_at
         FROM inbox_workflows ORDER BY started_at DESC LIMIT 200",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(WorkflowProgress {
            run_id: row.get(0)?,
            swarm_id: row.get(1)?,
            name: row.get(2)?,
            status: row.get(3)?,
            progress: row.get(4)?,
            current_step: row.get(5)?,
            total_steps: row.get(6)?,
            completed_steps: row.get(7)?,
            active_agents: json_from_text(row.get(8)?)
                .unwrap_or_else(|| serde_json::Value::Array(vec![])),
            tokens_used: row.get(9)?,
            estimated_cost: row.get(10)?,
            elapsed_time: row.get(11)?,
            estimated_time_remaining: row.get(12)?,
            last_event: row.get(13)?,
            last_event_time: row.get(14)?,
            started_at: row.get(15)?,
            updated_at: row.get(16)?,
            completed_at: row.get(17)?,
        })
    })?;
    rows.collect()
}

// =============================================================================
// Write side (used by the agency runtime)
// =============================================================================

/// Records inbox events against the Chasm database.
///
/// Held by the agency runtime, which owns no `AppState`, so this opens its own
/// short-lived connection per write rather than sharing the server's mutex.
/// Failures are logged, not propagated: an agent run must not abort because
/// its progress could not be recorded.
#[derive(Debug, Clone)]
pub struct InboxEmitter {
    db_path: PathBuf,
}

impl InboxEmitter {
    pub fn new(db_path: impl AsRef<Path>) -> Self {
        Self {
            db_path: db_path.as_ref().to_path_buf(),
        }
    }

    fn with_conn<F>(&self, what: &str, f: F)
    where
        F: FnOnce(&Connection) -> rusqlite::Result<()>,
    {
        let result = Connection::open(&self.db_path).and_then(|conn| {
            init_inbox_tables(&conn)?;
            f(&conn)
        });
        if let Err(e) = result {
            eprintln!("[WARN] inbox: failed to record {}: {}", what, e);
        }
    }

    /// Record a notification. Returns the id it was stored under.
    pub fn notify(
        &self,
        category: &str,
        priority: &str,
        title: &str,
        body: &str,
        run_id: Option<&str>,
        agent_name: Option<&str>,
    ) -> String {
        let id = new_id("ntf");
        self.with_conn("notification", |conn| {
            conn.execute(
                "INSERT INTO inbox_notifications
                 (id, category, priority, title, body, run_id, agent_name, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                rusqlite::params![
                    id,
                    category,
                    priority,
                    title,
                    body,
                    run_id,
                    agent_name,
                    now_ms()
                ],
            )?;
            Ok(())
        });
        id
    }

    /// Record a message from an agent to the user.
    pub fn message_from_agent(
        &self,
        agent_name: &str,
        subject: &str,
        body: &str,
        run_id: Option<&str>,
    ) -> String {
        let id = new_id("msg");
        self.with_conn("message", |conn| {
            conn.execute(
                "INSERT INTO inbox_messages
                 (id, kind, from_agent_name, subject, body, run_id, created_at)
                 VALUES (?1, 'agent_to_user', ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![id, agent_name, subject, body, run_id, now_ms()],
            )?;
            Ok(())
        });
        id
    }

    /// Open a workflow run, or reset one that is being re-run.
    pub fn workflow_started(&self, run_id: &str, name: &str, swarm_id: Option<&str>) {
        let now = now_ms();
        self.with_conn("workflow start", |conn| {
            conn.execute(
                "INSERT INTO inbox_workflows
                 (run_id, swarm_id, name, status, progress, active_agents,
                  tokens_used, elapsed_time, started_at, updated_at)
                 VALUES (?1, ?2, ?3, 'running', 0, '[]', 0, 0, ?4, ?4)
                 ON CONFLICT(run_id) DO UPDATE SET
                   status='running', progress=0, started_at=?4, updated_at=?4,
                   completed_at=NULL",
                rusqlite::params![run_id, swarm_id, name, now],
            )?;
            Ok(())
        });
    }

    /// Advance a run. `progress` is 0.0-1.0 as the client expects.
    pub fn workflow_progress(&self, run_id: &str, progress: f64, current_step: Option<&str>) {
        self.with_conn("workflow progress", |conn| {
            conn.execute(
                "UPDATE inbox_workflows
                 SET progress=?2, current_step=COALESCE(?3, current_step),
                     last_event=COALESCE(?3, last_event), last_event_time=?4,
                     elapsed_time=?4-started_at, updated_at=?4
                 WHERE run_id=?1",
                rusqlite::params![run_id, progress.clamp(0.0, 1.0), current_step, now_ms()],
            )?;
            Ok(())
        });
    }

    /// Close a run and post the matching notification.
    pub fn workflow_finished(&self, run_id: &str, name: &str, success: bool, tokens_used: i64) {
        let now = now_ms();
        let status = if success { "completed" } else { "failed" };
        self.with_conn("workflow finish", |conn| {
            conn.execute(
                "UPDATE inbox_workflows
                 SET status=?2, progress=?3, tokens_used=?4,
                     elapsed_time=?5-started_at, updated_at=?5, completed_at=?5
                 WHERE run_id=?1",
                rusqlite::params![
                    run_id,
                    status,
                    if success { 1.0 } else { 0.0 },
                    tokens_used,
                    now
                ],
            )?;
            Ok(())
        });
        let (category, priority, title) = if success {
            ("workflow_complete", "normal", format!("{} finished", name))
        } else {
            ("workflow_error", "high", format!("{} failed", name))
        };
        self.notify(category, priority, &title, "", Some(run_id), None);
    }

    /// Raise a permission request and return its id so the caller can poll for
    /// the user's answer.
    #[allow(clippy::too_many_arguments)]
    pub fn request_permission(
        &self,
        kind: &str,
        title: &str,
        description: &str,
        reason: &str,
        risk_level: &str,
        agent_id: &str,
        agent_name: &str,
        run_id: Option<&str>,
        ttl_ms: i64,
    ) -> String {
        let id = new_id("perm");
        let now = now_ms();
        self.with_conn("permission request", |conn| {
            conn.execute(
                "INSERT INTO inbox_permissions
                 (id, kind, status, title, description, reason, risk_level,
                  agent_id, agent_name, run_id, created_at, expires_at)
                 VALUES (?1, ?2, 'pending', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                rusqlite::params![
                    id,
                    kind,
                    title,
                    description,
                    reason,
                    risk_level,
                    agent_id,
                    agent_name,
                    run_id,
                    now,
                    now + ttl_ms
                ],
            )?;
            Ok(())
        });
        self.notify(
            "permission_request",
            "urgent",
            title,
            reason,
            run_id,
            Some(agent_name),
        );
        id
    }

    /// The current status of a permission request, with expiry applied.
    pub fn permission_status(&self, id: &str) -> Option<String> {
        let conn = Connection::open(&self.db_path).ok()?;
        let (status, expires_at): (String, i64) = conn
            .query_row(
                "SELECT status, expires_at FROM inbox_permissions WHERE id=?1",
                rusqlite::params![id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .ok()?;
        if status == "pending" && expires_at <= now_ms() {
            return Some("expired".to_string());
        }
        Some(status)
    }
}

// =============================================================================
// HTTP handlers
// =============================================================================

fn ok<T: Serialize>(payload: T) -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({ "success": true, "data": payload }))
}

fn db_error(e: rusqlite::Error) -> HttpResponse {
    HttpResponse::InternalServerError()
        .json(serde_json::json!({ "success": false, "error": e.to_string() }))
}

type State = web::Data<crate::api::state::AppState>;

async fn list_all(state: State) -> HttpResponse {
    let db = state.db.lock().unwrap();
    let conn = &db.conn;
    let notifications = match read_notifications(conn) {
        Ok(v) => v,
        Err(e) => return db_error(e),
    };
    let messages = match read_messages(conn) {
        Ok(v) => v,
        Err(e) => return db_error(e),
    };
    let permissions = match read_permissions(conn) {
        Ok(v) => v,
        Err(e) => return db_error(e),
    };
    let workflows = match read_workflows(conn) {
        Ok(v) => v,
        Err(e) => return db_error(e),
    };
    ok(serde_json::json!({
        "notifications": notifications,
        "messages": messages,
        "permissions": permissions,
        "workflows": workflows,
    }))
}

async fn list_notifications(state: State) -> HttpResponse {
    let db = state.db.lock().unwrap();
    match read_notifications(&db.conn) {
        Ok(v) => ok(v),
        Err(e) => db_error(e),
    }
}

async fn list_messages(state: State) -> HttpResponse {
    let db = state.db.lock().unwrap();
    match read_messages(&db.conn) {
        Ok(v) => ok(v),
        Err(e) => db_error(e),
    }
}

async fn list_permissions(state: State) -> HttpResponse {
    let db = state.db.lock().unwrap();
    match read_permissions(&db.conn) {
        Ok(v) => ok(v),
        Err(e) => db_error(e),
    }
}

async fn list_workflows(state: State) -> HttpResponse {
    let db = state.db.lock().unwrap();
    match read_workflows(&db.conn) {
        Ok(v) => ok(v),
        Err(e) => db_error(e),
    }
}

/// Report whether a statement matched, so the client can tell "marked read"
/// from "no such id" instead of getting 200 either way.
fn applied(changed: usize) -> HttpResponse {
    if changed == 0 {
        HttpResponse::NotFound().json(serde_json::json!({
            "success": false,
            "error": "not found"
        }))
    } else {
        ok(serde_json::json!({ "updated": changed }))
    }
}

async fn mark_notification_read(state: State, id: web::Path<String>) -> HttpResponse {
    let db = state.db.lock().unwrap();
    match db.conn.execute(
        "UPDATE inbox_notifications SET is_read=1, read_at=?2 WHERE id=?1",
        rusqlite::params![id.as_str(), now_ms()],
    ) {
        Ok(n) => applied(n),
        Err(e) => db_error(e),
    }
}

async fn dismiss_notification(state: State, id: web::Path<String>) -> HttpResponse {
    let db = state.db.lock().unwrap();
    match db.conn.execute(
        "UPDATE inbox_notifications SET dismissed=1 WHERE id=?1",
        rusqlite::params![id.as_str()],
    ) {
        Ok(n) => applied(n),
        Err(e) => db_error(e),
    }
}

async fn mark_all_notifications_read(state: State) -> HttpResponse {
    let db = state.db.lock().unwrap();
    match db.conn.execute(
        "UPDATE inbox_notifications SET is_read=1, read_at=?1 WHERE is_read=0",
        rusqlite::params![now_ms()],
    ) {
        Ok(n) => ok(serde_json::json!({ "updated": n })),
        Err(e) => db_error(e),
    }
}

async fn mark_message_read(state: State, id: web::Path<String>) -> HttpResponse {
    let db = state.db.lock().unwrap();
    match db.conn.execute(
        "UPDATE inbox_messages SET is_read=1 WHERE id=?1",
        rusqlite::params![id.as_str()],
    ) {
        Ok(n) => applied(n),
        Err(e) => db_error(e),
    }
}

/// Flip the star rather than setting it, matching the client's toggle.
async fn toggle_message_star(state: State, id: web::Path<String>) -> HttpResponse {
    let db = state.db.lock().unwrap();
    match db.conn.execute(
        "UPDATE inbox_messages SET starred = 1 - starred WHERE id=?1",
        rusqlite::params![id.as_str()],
    ) {
        Ok(n) => applied(n),
        Err(e) => db_error(e),
    }
}

async fn archive_message(state: State, id: web::Path<String>) -> HttpResponse {
    let db = state.db.lock().unwrap();
    match db.conn.execute(
        "UPDATE inbox_messages SET archived=1 WHERE id=?1",
        rusqlite::params![id.as_str()],
    ) {
        Ok(n) => applied(n),
        Err(e) => db_error(e),
    }
}

#[derive(Debug, Deserialize)]
pub struct MessageResponseBody {
    pub response: String,
}

async fn respond_to_message(
    state: State,
    id: web::Path<String>,
    body: web::Json<MessageResponseBody>,
) -> HttpResponse {
    let db = state.db.lock().unwrap();
    match db.conn.execute(
        "UPDATE inbox_messages SET user_response=?2, responded_at=?3, is_read=1 WHERE id=?1",
        rusqlite::params![id.as_str(), body.response, now_ms()],
    ) {
        Ok(n) => applied(n),
        Err(e) => db_error(e),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionResponseBody {
    pub approved: bool,
    pub scope: Option<String>,
    pub note: Option<String>,
}

async fn respond_to_permission(
    state: State,
    id: web::Path<String>,
    body: web::Json<PermissionResponseBody>,
) -> HttpResponse {
    let db = state.db.lock().unwrap();
    let now = now_ms();

    // An expired request must not be approvable: the agent that raised it has
    // already been told no and may have moved on.
    let expires_at: Option<i64> = db
        .conn
        .query_row(
            "SELECT expires_at FROM inbox_permissions WHERE id=?1 AND status='pending'",
            rusqlite::params![id.as_str()],
            |row| row.get(0),
        )
        .ok();
    match expires_at {
        None => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "success": false,
                "error": "no pending request with that id"
            }))
        }
        Some(exp) if exp <= now => {
            let _ = db.conn.execute(
                "UPDATE inbox_permissions SET status='expired' WHERE id=?1",
                rusqlite::params![id.as_str()],
            );
            return HttpResponse::Conflict().json(serde_json::json!({
                "success": false,
                "error": "request expired"
            }));
        }
        Some(_) => {}
    }

    let status = if body.approved { "approved" } else { "denied" };
    match db.conn.execute(
        "UPDATE inbox_permissions
         SET status=?2, scope=?3, response_note=?4, responded_at=?5 WHERE id=?1",
        rusqlite::params![id.as_str(), status, body.scope, body.note, now],
    ) {
        Ok(n) => applied(n),
        Err(e) => db_error(e),
    }
}

/// Unread and pending counts, for the sidebar badge. Cheaper than fetching
/// every record just to length-filter it in the client.
async fn inbox_counts(state: State) -> HttpResponse {
    let db = state.db.lock().unwrap();
    let conn = &db.conn;
    let scalar = |sql: &str| -> i64 {
        conn.query_row(sql, [], |row| row.get::<_, i64>(0))
            .unwrap_or(0)
    };
    let pending_sql = format!(
        "SELECT COUNT(*) FROM inbox_permissions WHERE status='pending' AND expires_at > {}",
        now_ms()
    );
    ok(serde_json::json!({
        "unreadNotifications": scalar(
            "SELECT COUNT(*) FROM inbox_notifications WHERE is_read=0 AND dismissed=0"),
        "unreadMessages": scalar(
            "SELECT COUNT(*) FROM inbox_messages WHERE is_read=0 AND archived=0"),
        "pendingPermissions": scalar(&pending_sql),
        "activeWorkflows": scalar(
            "SELECT COUNT(*) FROM inbox_workflows WHERE status IN ('running','paused')"),
    }))
}

pub fn configure_inbox_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/inbox")
            .route("", web::get().to(list_all))
            .route("/counts", web::get().to(inbox_counts))
            .route("/notifications", web::get().to(list_notifications))
            .route(
                "/notifications/read-all",
                web::post().to(mark_all_notifications_read),
            )
            .route(
                "/notifications/{id}/read",
                web::post().to(mark_notification_read),
            )
            .route(
                "/notifications/{id}/dismiss",
                web::post().to(dismiss_notification),
            )
            .route("/messages", web::get().to(list_messages))
            .route("/messages/{id}/read", web::post().to(mark_message_read))
            .route("/messages/{id}/star", web::post().to(toggle_message_star))
            .route("/messages/{id}/archive", web::post().to(archive_message))
            .route("/messages/{id}/respond", web::post().to(respond_to_message))
            .route("/permissions", web::get().to(list_permissions))
            .route(
                "/permissions/{id}/respond",
                web::post().to(respond_to_permission),
            )
            .route("/workflows", web::get().to(list_workflows)),
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    fn conn() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        init_inbox_tables(&c).unwrap();
        c
    }

    fn temp_db(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("chasm_inbox_{}_{}", tag, new_id("t")));
        std::fs::create_dir_all(&dir).unwrap();
        dir.join("test.db")
    }

    #[test]
    fn init_is_idempotent() {
        let c = conn();
        init_inbox_tables(&c).unwrap();
    }

    #[test]
    fn empty_inbox_reads_as_empty_not_error() {
        let c = conn();
        assert!(read_notifications(&c).unwrap().is_empty());
        assert!(read_messages(&c).unwrap().is_empty());
        assert!(read_permissions(&c).unwrap().is_empty());
        assert!(read_workflows(&c).unwrap().is_empty());
    }

    #[test]
    fn ids_do_not_collide_within_a_millisecond() {
        assert_ne!(new_id("ntf"), new_id("ntf"));
    }

    #[test]
    fn pending_permission_past_its_expiry_reads_as_expired() {
        let c = conn();
        let past = now_ms() - 1000;
        c.execute(
            "INSERT INTO inbox_permissions
             (id, kind, status, title, description, reason, risk_level, agent_id,
              agent_name, created_at, expires_at)
             VALUES ('p1','shell_command','pending','t','d','r','high','a','A',?1,?2)",
            rusqlite::params![past, past],
        )
        .unwrap();
        assert_eq!(read_permissions(&c).unwrap()[0].status, "expired");
    }

    #[test]
    fn unexpired_pending_permission_keeps_its_status() {
        let c = conn();
        let now = now_ms();
        c.execute(
            "INSERT INTO inbox_permissions
             (id, kind, status, title, description, reason, risk_level, agent_id,
              agent_name, created_at, expires_at)
             VALUES ('p2','file_write','pending','t','d','r','low','a','A',?1,?2)",
            rusqlite::params![now, now + 60_000],
        )
        .unwrap();
        assert_eq!(read_permissions(&c).unwrap()[0].status, "pending");
    }

    #[test]
    fn emitter_records_a_workflow_lifecycle() {
        let path = temp_db("flow");
        let emitter = InboxEmitter::new(&path);

        emitter.workflow_started("run-1", "Research", None);
        emitter.workflow_progress("run-1", 0.5, Some("step two"));
        emitter.workflow_finished("run-1", "Research", true, 1234);

        let c = Connection::open(&path).unwrap();
        let flows = read_workflows(&c).unwrap();
        assert_eq!(flows.len(), 1);
        assert_eq!(flows[0].status, "completed");
        assert_eq!(flows[0].tokens_used, 1234);
        assert_eq!(flows[0].current_step.as_deref(), Some("step two"));

        // Finishing a run also posts a notification the user can see.
        let notes = read_notifications(&c).unwrap();
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].category, "workflow_complete");
    }

    #[test]
    fn a_failed_run_notifies_at_high_priority() {
        let path = temp_db("fail");
        let emitter = InboxEmitter::new(&path);
        emitter.workflow_started("run-f", "Build", None);
        emitter.workflow_finished("run-f", "Build", false, 0);

        let c = Connection::open(&path).unwrap();
        assert_eq!(read_workflows(&c).unwrap()[0].status, "failed");
        let notes = read_notifications(&c).unwrap();
        assert_eq!(notes[0].category, "workflow_error");
        assert_eq!(notes[0].priority, "high");
    }

    #[test]
    fn progress_is_clamped_to_the_range_the_client_expects() {
        let path = temp_db("clamp");
        let emitter = InboxEmitter::new(&path);
        emitter.workflow_started("run-2", "Wide", None);
        emitter.workflow_progress("run-2", 4.2, None);

        let c = Connection::open(&path).unwrap();
        assert_eq!(read_workflows(&c).unwrap()[0].progress, 1.0);
    }

    #[test]
    fn permission_status_reflects_expiry_without_a_write() {
        let path = temp_db("perm");
        let emitter = InboxEmitter::new(&path);
        let id = emitter.request_permission(
            "shell_command",
            "Run a build",
            "cargo build",
            "needs to compile",
            "medium",
            "agent-1",
            "Builder",
            Some("run-3"),
            -1, // already expired
        );
        assert_eq!(emitter.permission_status(&id).as_deref(), Some("expired"));
    }

    #[test]
    fn raising_a_permission_also_notifies() {
        let path = temp_db("permnote");
        let emitter = InboxEmitter::new(&path);
        emitter.request_permission(
            "file_delete",
            "Delete build cache",
            "rm -rf target",
            "reclaiming space",
            "high",
            "agent-2",
            "Janitor",
            None,
            60_000,
        );
        let c = Connection::open(&path).unwrap();
        let notes = read_notifications(&c).unwrap();
        assert_eq!(notes[0].category, "permission_request");
        assert_eq!(notes[0].priority, "urgent");
    }

    #[test]
    fn camel_case_matches_the_typescript_contract() {
        let n = AgentNotification {
            id: "n1".into(),
            category: "system".into(),
            priority: "normal".into(),
            title: "t".into(),
            body: "b".into(),
            data: None,
            agent_id: None,
            agent_name: None,
            run_id: Some("r1".into()),
            swarm_id: None,
            read: false,
            dismissed: false,
            created_at: 1,
            read_at: None,
        };
        let json = serde_json::to_string(&n).unwrap();
        assert!(json.contains("\"createdAt\""));
        assert!(json.contains("\"runId\""));
        // Absent optionals are omitted, not sent as null, so the client's
        // `field?:` checks behave.
        assert!(!json.contains("agentId"));
    }

    #[test]
    fn message_type_serializes_as_type_not_kind() {
        let m = InboxMessage {
            id: "m1".into(),
            kind: "agent_to_user".into(),
            from_agent_id: None,
            from_agent_name: Some("Scout".into()),
            to_agent_id: None,
            to_agent_name: None,
            subject: "s".into(),
            body: "b".into(),
            thread_id: None,
            reply_to_id: None,
            run_id: None,
            swarm_id: None,
            attachments: None,
            read: false,
            starred: false,
            archived: false,
            requires_response: false,
            response_options: None,
            user_response: None,
            created_at: 1,
            responded_at: None,
        };
        let json = serde_json::to_string(&m).unwrap();
        assert!(json.contains("\"type\":\"agent_to_user\""));
        assert!(!json.contains("kind"));
    }
}
