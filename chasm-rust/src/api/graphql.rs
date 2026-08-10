// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
//! GraphQL API module
//!
//! Provides a GraphQL endpoint alongside REST for flexible querying.

use actix_web::{web, HttpResponse, Responder};
use async_graphql::{
    Context, EmptySubscription, FieldResult, InputObject, Object, Schema, SimpleObject, ID,
};
use async_graphql_actix_web::{GraphQLRequest, GraphQLResponse};
use chrono::{DateTime, Utc};
use rusqlite::OptionalExtension;
use std::sync::Arc;

use super::state::AppState;

/// GraphQL schema type
pub type ChasmSchema = Schema<QueryRoot, MutationRoot, EmptySubscription>;

// ============================================================================
// GraphQL Types
// ============================================================================

/// Workspace type for GraphQL
#[derive(SimpleObject, Clone)]
pub struct Workspace {
    /// Unique identifier
    pub id: ID,
    /// Workspace name
    pub name: String,
    /// Workspace path
    pub path: String,
    /// Provider (e.g., "vscode", "cursor")
    pub provider: String,
    /// Number of sessions
    pub session_count: i32,
    /// Last harvested timestamp
    pub last_harvested: Option<DateTime<Utc>>,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
}

/// Session type for GraphQL
#[derive(SimpleObject, Clone)]
pub struct Session {
    /// Unique identifier
    pub id: ID,
    /// Session title
    pub title: String,
    /// Workspace ID
    pub workspace_id: Option<ID>,
    /// Provider (e.g., "copilot", "cursor")
    pub provider: String,
    /// Model used
    pub model: Option<String>,
    /// Number of messages
    pub message_count: i32,
    /// Total tokens
    pub token_count: i32,
    /// Whether archived
    pub archived: bool,
    /// Tags
    pub tags: Vec<String>,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
    /// Last updated timestamp
    pub updated_at: DateTime<Utc>,
}

/// Message type for GraphQL
#[derive(SimpleObject, Clone)]
pub struct Message {
    /// Unique identifier
    pub id: ID,
    /// Session ID
    pub session_id: ID,
    /// Message role (user, assistant, system)
    pub role: String,
    /// Message content
    pub content: String,
    /// Model used
    pub model: Option<String>,
    /// Token count
    pub token_count: i32,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
}

/// Provider type for GraphQL
#[derive(SimpleObject, Clone)]
pub struct Provider {
    /// Unique identifier
    pub id: ID,
    /// Provider name
    pub name: String,
    /// Provider type
    pub provider_type: String,
    /// Whether enabled
    pub enabled: bool,
    /// Base URL
    pub base_url: Option<String>,
}

/// Agent type for GraphQL
#[derive(SimpleObject, Clone)]
pub struct Agent {
    /// Unique identifier
    pub id: ID,
    /// Agent name
    pub name: String,
    /// Description
    pub description: Option<String>,
    /// System prompt
    pub system_prompt: Option<String>,
    /// Provider ID
    pub provider_id: Option<ID>,
    /// Model
    pub model: String,
    /// Temperature
    pub temperature: f64,
    /// Creation timestamp
    pub created_at: DateTime<Utc>,
}

/// Statistics overview
#[derive(SimpleObject, Clone)]
pub struct StatsOverview {
    /// Total sessions
    pub total_sessions: i32,
    /// Total messages
    pub total_messages: i32,
    /// Total tokens
    pub total_tokens: i64,
    /// Active providers
    pub active_providers: i32,
    /// Total workspaces
    pub workspaces: i32,
    /// Sessions today
    pub sessions_today: i32,
    /// Messages today
    pub messages_today: i32,
}

/// Search result
#[derive(SimpleObject, Clone)]
pub struct SearchResult {
    /// Sessions matching query
    pub sessions: Vec<Session>,
    /// Messages matching query
    pub messages: Vec<Message>,
    /// Total count
    pub total: i32,
}

// ============================================================================
// Input Types
// ============================================================================

/// Input for creating a session
#[derive(InputObject)]
pub struct CreateSessionInput {
    pub title: String,
    pub workspace_id: Option<ID>,
    pub provider: String,
}

/// Input for updating a session
#[derive(InputObject)]
pub struct UpdateSessionInput {
    pub title: Option<String>,
    pub tags: Option<Vec<String>>,
    pub archived: Option<bool>,
}

/// Input for creating an agent
#[derive(InputObject)]
pub struct CreateAgentInput {
    pub name: String,
    pub description: Option<String>,
    pub system_prompt: Option<String>,
    pub provider_id: Option<ID>,
    pub model: String,
    pub temperature: Option<f64>,
}

/// Filter for sessions
#[derive(InputObject, Default)]
pub struct SessionFilter {
    pub workspace_id: Option<ID>,
    pub provider: Option<String>,
    pub archived: Option<bool>,
    pub search: Option<String>,
}

/// Pagination input
#[derive(InputObject, Default)]
pub struct Pagination {
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

// ============================================================================
// Query Root
// ============================================================================

pub struct QueryRoot;

/// Seconds since epoch -> `DateTime<Utc>`, clamping nonsense to the epoch
/// rather than panicking inside a resolver.
fn ts(seconds: i64) -> DateTime<Utc> {
    chrono::TimeZone::timestamp_opt(&Utc, seconds, 0)
        .single()
        .unwrap_or_else(|| chrono::TimeZone::timestamp_opt(&Utc, 0, 0).unwrap())
}

/// Clamp a caller-supplied page size. GraphQL exposes the same data as REST,
/// so it gets the same protection against one query draining a table.
fn page_size(requested: Option<i32>, default: i32) -> i32 {
    requested.unwrap_or(default).clamp(1, 500)
}

/// Two schemas for `sessions`/`messages` exist in the wild.
///
/// `sql/schema.sql` defines the richer shape (model, token_count, archived).
/// The harvest pipeline in `commands/harvest.rs` defines a narrower one, and
/// because both use `CREATE TABLE IF NOT EXISTS`, a database first written by
/// harvest keeps the narrow tables while still gaining the tables only
/// `schema.sql` declares. Selecting a column that is missing is a runtime
/// error, so the optional ones are probed and substituted with literals.
/// Note the implementation: `PRAGMA table_info`, not a trial `SELECT`.
/// SQLite treats a double-quoted identifier that resolves to no column as a
/// string literal, so `SELECT "model" FROM sessions` *succeeds* on a table
/// with no `model` column and would report every column as present.
fn has_column(conn: &rusqlite::Connection, table: &str, column: &str) -> bool {
    let Ok(mut stmt) = conn.prepare(&format!("PRAGMA table_info(\"{}\")", table)) else {
        return false;
    };
    let Ok(rows) = stmt.query_map([], |row| row.get::<_, String>(1)) else {
        return false;
    };
    // Collected rather than folded inline: the iterator borrows `stmt`, which
    // must be released before returning.
    let names: Vec<String> = rows.filter_map(Result::ok).collect();
    names.iter().any(|name| name.eq_ignore_ascii_case(column))
}

/// SQL fragments for the session columns that only one schema has.
struct SessionCols {
    model: &'static str,
    tokens: &'static str,
    archived: &'static str,
}

impl SessionCols {
    fn probe(conn: &rusqlite::Connection) -> Self {
        Self {
            model: if has_column(conn, "sessions", "model") {
                "model"
            } else {
                "NULL"
            },
            tokens: if has_column(conn, "sessions", "token_count") {
                "COALESCE(token_count, 0)"
            } else {
                "0"
            },
            archived: if has_column(conn, "sessions", "archived") {
                "COALESCE(archived, 0)"
            } else {
                "0"
            },
        }
    }

    /// The ten-column projection every session query shares, in the order the
    /// row mapper expects.
    fn select_list(&self) -> String {
        format!(
            "id, COALESCE(title, ''), workspace_id, provider, {}, \
             COALESCE(message_count, 0), {}, {}, \
             COALESCE(created_at, 0), COALESCE(updated_at, 0)",
            self.model, self.tokens, self.archived
        )
    }
}

fn session_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Session> {
    Ok(Session {
        id: ID::from(row.get::<_, String>(0)?),
        title: row.get(1)?,
        workspace_id: row.get::<_, Option<String>>(2)?.map(ID::from),
        provider: row.get(3)?,
        model: row.get(4)?,
        message_count: row.get::<_, i64>(5)? as i32,
        token_count: row.get::<_, i64>(6)? as i32,
        archived: row.get::<_, i64>(7)? != 0,
        tags: Vec::new(),
        created_at: ts(row.get::<_, i64>(8)?),
        updated_at: ts(row.get::<_, i64>(9)?),
    })
}

/// Message projection, likewise tolerant of the narrower harvest schema.
/// `id` is cast because harvest declares it `INTEGER AUTOINCREMENT`.
fn message_select_list(conn: &rusqlite::Connection) -> String {
    let model = if has_column(conn, "messages", "model") {
        "model"
    } else {
        "NULL"
    };
    let tokens = if has_column(conn, "messages", "token_count") {
        "COALESCE(token_count, 0)"
    } else {
        "0"
    };
    format!(
        "CAST(id AS TEXT), session_id, role, COALESCE(content, ''), {}, {}, \
         COALESCE(created_at, 0)",
        model, tokens
    )
}

fn message_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Message> {
    Ok(Message {
        id: ID::from(row.get::<_, String>(0)?),
        session_id: ID::from(row.get::<_, String>(1)?),
        role: row.get(2)?,
        content: row.get(3)?,
        model: row.get(4)?,
        token_count: row.get::<_, i64>(5)? as i32,
        created_at: ts(row.get::<_, i64>(6)?),
    })
}

#[Object]
impl QueryRoot {
    /// Get all workspaces
    async fn workspaces(
        &self,
        ctx: &Context<'_>,
        pagination: Option<Pagination>,
    ) -> FieldResult<Vec<Workspace>> {
        let state = ctx.data::<Arc<AppState>>()?;
        let pagination = pagination.unwrap_or_default();
        let limit = page_size(pagination.limit, 20);
        let offset = pagination.offset.unwrap_or(0).max(0);

        let db = state.db.lock().map_err(|_| "database lock poisoned")?;
        let mut stmt = db.conn.prepare(
            "SELECT w.id, w.name, COALESCE(w.path, ''), COALESCE(w.provider, ''),
                    COUNT(s.id) AS session_count,
                    COALESCE(w.created_at, 0),
                    COALESCE(MAX(s.updated_at), w.updated_at, 0)
             FROM workspaces w
             LEFT JOIN sessions s ON w.id = s.workspace_id
             GROUP BY w.id
             ORDER BY 7 DESC
             LIMIT ?1 OFFSET ?2",
        )?;
        let rows = stmt
            .query_map([limit as i64, offset as i64], |row| {
                Ok(Workspace {
                    id: ID::from(row.get::<_, String>(0)?),
                    name: row.get(1)?,
                    path: row.get(2)?,
                    provider: row.get(3)?,
                    session_count: row.get::<_, i64>(4)? as i32,
                    last_harvested: None,
                    created_at: ts(row.get::<_, i64>(5)?),
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    }

    /// Get a workspace by ID
    async fn workspace(&self, ctx: &Context<'_>, id: ID) -> FieldResult<Option<Workspace>> {
        let state = ctx.data::<Arc<AppState>>()?;
        let db = state.db.lock().map_err(|_| "database lock poisoned")?;

        let found = db
            .conn
            .query_row(
                "SELECT w.id, w.name, COALESCE(w.path, ''), COALESCE(w.provider, ''),
                        COUNT(s.id), COALESCE(w.created_at, 0)
                 FROM workspaces w
                 LEFT JOIN sessions s ON w.id = s.workspace_id
                 WHERE w.id = ?1
                 GROUP BY w.id",
                [id.to_string()],
                |row| {
                    Ok(Workspace {
                        id: ID::from(row.get::<_, String>(0)?),
                        name: row.get(1)?,
                        path: row.get(2)?,
                        provider: row.get(3)?,
                        session_count: row.get::<_, i64>(4)? as i32,
                        last_harvested: None,
                        created_at: ts(row.get::<_, i64>(5)?),
                    })
                },
            )
            .optional()?;
        Ok(found)
    }

    /// Get all sessions with optional filtering
    async fn sessions(
        &self,
        ctx: &Context<'_>,
        filter: Option<SessionFilter>,
        pagination: Option<Pagination>,
    ) -> FieldResult<Vec<Session>> {
        let state = ctx.data::<Arc<AppState>>()?;
        let filter = filter.unwrap_or_default();
        let pagination = pagination.unwrap_or_default();
        let limit = page_size(pagination.limit, 20);
        let offset = pagination.offset.unwrap_or(0).max(0);

        let db = state.db.lock().map_err(|_| "database lock poisoned")?;
        let cols = SessionCols::probe(&db.conn);
        // NULL-guarded predicates keep this one prepared statement rather than
        // building SQL per filter combination.
        let sql = format!(
            "SELECT {} FROM sessions
             WHERE (?1 IS NULL OR provider = ?1)
               AND (?2 IS NULL OR workspace_id = ?2)
             ORDER BY updated_at DESC
             LIMIT ?3 OFFSET ?4",
            cols.select_list()
        );
        let mut stmt = db.conn.prepare(&sql)?;
        let rows = stmt
            .query_map(
                rusqlite::params![
                    filter.provider,
                    filter.workspace_id.map(|w| w.to_string()),
                    limit as i64,
                    offset as i64
                ],
                session_from_row,
            )?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    }

    /// Get a session by ID
    async fn session(&self, ctx: &Context<'_>, id: ID) -> FieldResult<Option<Session>> {
        let state = ctx.data::<Arc<AppState>>()?;
        let db = state.db.lock().map_err(|_| "database lock poisoned")?;

        let cols = SessionCols::probe(&db.conn);
        let found = db
            .conn
            .query_row(
                &format!("SELECT {} FROM sessions WHERE id = ?1", cols.select_list()),
                [id.to_string()],
                session_from_row,
            )
            .optional()?;
        Ok(found)
    }

    /// Get messages for a session
    async fn messages(
        &self,
        ctx: &Context<'_>,
        session_id: ID,
        pagination: Option<Pagination>,
    ) -> FieldResult<Vec<Message>> {
        let state = ctx.data::<Arc<AppState>>()?;
        let pagination = pagination.unwrap_or_default();
        let limit = page_size(pagination.limit, 100);
        let offset = pagination.offset.unwrap_or(0).max(0);

        let db = state.db.lock().map_err(|_| "database lock poisoned")?;
        let sql = format!(
            "SELECT {} FROM messages
             WHERE session_id = ?1
             ORDER BY created_at ASC, rowid ASC
             LIMIT ?2 OFFSET ?3",
            message_select_list(&db.conn)
        );
        let mut stmt = db.conn.prepare(&sql)?;
        let rows = stmt
            .query_map(
                rusqlite::params![session_id.to_string(), limit as i64, offset as i64],
                message_from_row,
            )?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    }

    /// Get all providers actually present in the harvested data
    async fn providers(&self, ctx: &Context<'_>) -> FieldResult<Vec<Provider>> {
        let state = ctx.data::<Arc<AppState>>()?;
        let db = state.db.lock().map_err(|_| "database lock poisoned")?;

        // Derived from stored sessions rather than a hardcoded list, so the
        // result describes this installation instead of the product brochure.
        let mut stmt = db.conn.prepare(
            "SELECT DISTINCT provider FROM sessions WHERE provider IS NOT NULL ORDER BY provider",
        )?;
        let rows = stmt
            .query_map([], |row| {
                let name: String = row.get(0)?;
                Ok(Provider {
                    id: ID::from(name.clone()),
                    name: name.clone(),
                    provider_type: name,
                    enabled: true,
                    base_url: None,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    }

    /// Get all agents
    async fn agents(&self, ctx: &Context<'_>) -> FieldResult<Vec<Agent>> {
        let state = ctx.data::<Arc<AppState>>()?;
        let db = state.db.lock().map_err(|_| "database lock poisoned")?;

        let mut stmt = db.conn.prepare(
            "SELECT id, name, COALESCE(description, ''), COALESCE(model, ''),
                    instruction, provider, temperature, COALESCE(created_at, 0)
             FROM agents ORDER BY updated_at DESC",
        )?;
        let rows = stmt
            .query_map([], |row| {
                Ok(Agent {
                    id: ID::from(row.get::<_, String>(0)?),
                    name: row.get(1)?,
                    description: Some(row.get::<_, String>(2)?),
                    model: row.get(3)?,
                    system_prompt: row.get::<_, Option<String>>(4)?,
                    provider_id: row.get::<_, Option<String>>(5)?.map(ID::from),
                    temperature: row.get::<_, Option<f64>>(6)?.unwrap_or(0.7),
                    created_at: ts(row.get::<_, i64>(7)?),
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    }

    /// Get an agent by ID
    async fn agent(&self, ctx: &Context<'_>, id: ID) -> FieldResult<Option<Agent>> {
        let state = ctx.data::<Arc<AppState>>()?;
        let db = state.db.lock().map_err(|_| "database lock poisoned")?;

        let found = db
            .conn
            .query_row(
                "SELECT id, name, COALESCE(description, ''), COALESCE(model, ''),
                        instruction, provider, temperature, COALESCE(created_at, 0)
                 FROM agents WHERE id = ?1",
                [id.to_string()],
                |row| {
                    Ok(Agent {
                        id: ID::from(row.get::<_, String>(0)?),
                        name: row.get(1)?,
                        description: Some(row.get::<_, String>(2)?),
                        model: row.get(3)?,
                        system_prompt: row.get::<_, Option<String>>(4)?,
                        provider_id: row.get::<_, Option<String>>(5)?.map(ID::from),
                        temperature: row.get::<_, Option<f64>>(6)?.unwrap_or(0.7),
                        created_at: ts(row.get::<_, i64>(7)?),
                    })
                },
            )
            .optional()?;
        Ok(found)
    }

    /// Get statistics overview
    async fn stats(&self, ctx: &Context<'_>) -> FieldResult<StatsOverview> {
        let state = ctx.data::<Arc<AppState>>()?;
        let db = state.db.lock().map_err(|_| "database lock poisoned")?;

        let scalar =
            |sql: &str| -> rusqlite::Result<i64> { db.conn.query_row(sql, [], |r| r.get(0)) };

        let day_ago = Utc::now().timestamp() - 86_400;
        Ok(StatsOverview {
            total_sessions: scalar("SELECT COUNT(*) FROM sessions")? as i32,
            total_messages: scalar("SELECT COUNT(*) FROM messages")? as i32,
            // Absent from the harvest schema; reported as 0 rather than
            // failing the whole stats query.
            total_tokens: if has_column(&db.conn, "sessions", "token_count") {
                scalar("SELECT COALESCE(SUM(token_count), 0) FROM sessions")?
            } else {
                0
            },
            active_providers: scalar(
                "SELECT COUNT(DISTINCT provider) FROM sessions WHERE provider IS NOT NULL",
            )? as i32,
            workspaces: scalar("SELECT COUNT(*) FROM workspaces")? as i32,
            sessions_today: db.conn.query_row(
                "SELECT COUNT(*) FROM sessions WHERE created_at >= ?1",
                [day_ago],
                |r| r.get::<_, i64>(0),
            )? as i32,
            messages_today: db.conn.query_row(
                "SELECT COUNT(*) FROM messages WHERE created_at >= ?1",
                [day_ago],
                |r| r.get::<_, i64>(0),
            )? as i32,
        })
    }

    /// Search across sessions and messages
    async fn search(
        &self,
        ctx: &Context<'_>,
        query: String,
        limit: Option<i32>,
    ) -> FieldResult<SearchResult> {
        let state = ctx.data::<Arc<AppState>>()?;
        let limit = page_size(limit, 20);

        if query.trim().is_empty() {
            return Ok(SearchResult {
                sessions: vec![],
                messages: vec![],
                total: 0,
            });
        }

        let db = state.db.lock().map_err(|_| "database lock poisoned")?;
        // LIKE with an escaped pattern rather than FTS: the FTS table is
        // optional in this schema, and a missing one would error at runtime.
        let pattern = format!(
            "%{}%",
            query
                .replace('\\', "\\\\")
                .replace('%', "\\%")
                .replace('_', "\\_")
        );

        let cols = SessionCols::probe(&db.conn);
        let sess_sql = format!(
            "SELECT {} FROM sessions
             WHERE title LIKE ?1 ESCAPE '\\'
             ORDER BY updated_at DESC LIMIT ?2",
            cols.select_list()
        );
        let mut sess_stmt = db.conn.prepare(&sess_sql)?;
        let sessions = sess_stmt
            .query_map(rusqlite::params![pattern, limit as i64], session_from_row)?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        let msg_sql = format!(
            "SELECT {} FROM messages
             WHERE content LIKE ?1 ESCAPE '\\'
             ORDER BY created_at DESC LIMIT ?2",
            message_select_list(&db.conn)
        );
        let mut msg_stmt = db.conn.prepare(&msg_sql)?;
        let messages = msg_stmt
            .query_map(rusqlite::params![pattern, limit as i64], message_from_row)?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(SearchResult {
            total: (sessions.len() + messages.len()) as i32,
            sessions,
            messages,
        })
    }
}

// ============================================================================
// Mutation Root
// ============================================================================

pub struct MutationRoot;

#[Object]
impl MutationRoot {
    /// Create a new session
    async fn create_session(
        &self,
        ctx: &Context<'_>,
        input: CreateSessionInput,
    ) -> FieldResult<Session> {
        let state = ctx.data::<Arc<AppState>>()?;
        let db = state.db.lock().map_err(|_| "database lock poisoned")?;

        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now().timestamp();
        db.conn.execute(
            "INSERT INTO sessions (id, workspace_id, provider, title, message_count,
                                   token_count, created_at, updated_at, archived)
             VALUES (?1, ?2, ?3, ?4, 0, 0, ?5, ?5, 0)",
            rusqlite::params![
                id,
                input.workspace_id.as_ref().map(|w| w.to_string()),
                input.provider,
                input.title,
                now
            ],
        )?;

        Ok(Session {
            id: ID::from(id),
            title: input.title,
            workspace_id: input.workspace_id,
            provider: input.provider,
            model: None,
            message_count: 0,
            token_count: 0,
            archived: false,
            tags: Vec::new(),
            created_at: ts(now),
            updated_at: ts(now),
        })
    }

    /// Update a session
    ///
    /// Returns the row as it stands after the write rather than echoing the
    /// input back, so the caller cannot be told a field changed when it did
    /// not.
    async fn update_session(
        &self,
        ctx: &Context<'_>,
        id: ID,
        input: UpdateSessionInput,
    ) -> FieldResult<Session> {
        let state = ctx.data::<Arc<AppState>>()?;
        let sid = id.to_string();

        {
            let db = state.db.lock().map_err(|_| "database lock poisoned")?;
            let changed = db.conn.execute(
                "UPDATE sessions
                 SET title    = COALESCE(?2, title),
                     archived = COALESCE(?3, archived),
                     updated_at = ?4
                 WHERE id = ?1",
                rusqlite::params![
                    sid,
                    input.title,
                    input.archived.map(|a| a as i64),
                    Utc::now().timestamp()
                ],
            )?;
            if changed == 0 {
                return Err(format!("no session '{}'", sid).into());
            }
        }

        // `tags` has no column in this schema; accepting it silently would
        // imply a write that never happens.
        if input.tags.is_some() {
            return Err("session tags are not stored by this schema".into());
        }

        self.session_by_id(state, &sid)
    }

    /// Delete a session
    async fn delete_session(&self, ctx: &Context<'_>, id: ID) -> FieldResult<bool> {
        let state = ctx.data::<Arc<AppState>>()?;
        let db = state.db.lock().map_err(|_| "database lock poisoned")?;

        // Messages cascade via the schema's foreign key.
        let changed = db
            .conn
            .execute("DELETE FROM sessions WHERE id = ?1", [id.to_string()])?;
        Ok(changed > 0)
    }

    /// Archive a session
    async fn archive_session(&self, ctx: &Context<'_>, id: ID) -> FieldResult<Session> {
        let state = ctx.data::<Arc<AppState>>()?;
        let sid = id.to_string();

        {
            let db = state.db.lock().map_err(|_| "database lock poisoned")?;
            let changed = db.conn.execute(
                "UPDATE sessions SET archived = 1, updated_at = ?2 WHERE id = ?1",
                rusqlite::params![sid, Utc::now().timestamp()],
            )?;
            if changed == 0 {
                return Err(format!("no session '{}'", sid).into());
            }
        }

        self.session_by_id(state, &sid)
    }

    /// Create an agent
    async fn create_agent(&self, ctx: &Context<'_>, input: CreateAgentInput) -> FieldResult<Agent> {
        let state = ctx.data::<Arc<AppState>>()?;
        let db = state.db.lock().map_err(|_| "database lock poisoned")?;

        let id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now().timestamp();
        let temperature = input.temperature.unwrap_or(0.7);

        // `instruction` is NOT NULL in the schema.
        let instruction = input.system_prompt.clone().unwrap_or_default();

        db.conn.execute(
            "INSERT INTO agents (id, name, description, instruction, model, provider,
                                 temperature, is_active, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8, ?8)",
            rusqlite::params![
                id,
                input.name,
                input.description,
                instruction,
                input.model,
                input.provider_id.as_ref().map(|p| p.to_string()),
                temperature,
                now
            ],
        )?;

        Ok(Agent {
            id: ID::from(id),
            name: input.name,
            description: input.description,
            system_prompt: input.system_prompt,
            provider_id: input.provider_id,
            model: input.model,
            temperature,
            created_at: ts(now),
        })
    }

    /// Delete an agent
    async fn delete_agent(&self, ctx: &Context<'_>, id: ID) -> FieldResult<bool> {
        let state = ctx.data::<Arc<AppState>>()?;
        let db = state.db.lock().map_err(|_| "database lock poisoned")?;

        let changed = db
            .conn
            .execute("DELETE FROM agents WHERE id = ?1", [id.to_string()])?;
        Ok(changed > 0)
    }

    /// Trigger a harvest
    async fn harvest(
        &self,
        _ctx: &Context<'_>,
        _providers: Option<Vec<String>>,
    ) -> FieldResult<i32> {
        // Harvesting scans provider directories on the host and can run for
        // minutes; it belongs behind the CLI or the REST job endpoint, not a
        // synchronous GraphQL field. Returning 0 here previously looked like a
        // harvest that found nothing.
        Err(
            "harvest is not exposed over GraphQL; use `chasm harvest run` or POST /api/harvest"
                .into(),
        )
    }

    /// Trigger sync
    async fn sync(&self, _ctx: &Context<'_>) -> FieldResult<bool> {
        Err("sync is not exposed over GraphQL; use `chasm sync` or the REST sync endpoints".into())
    }
}

impl MutationRoot {
    /// Re-read a session after a write. Not a GraphQL field: it lives in a
    /// plain `impl` block so `#[Object]` does not expose it.
    fn session_by_id(&self, state: &Arc<AppState>, id: &str) -> FieldResult<Session> {
        let db = state.db.lock().map_err(|_| "database lock poisoned")?;
        let cols = SessionCols::probe(&db.conn);
        let session = db
            .conn
            .query_row(
                &format!("SELECT {} FROM sessions WHERE id = ?1", cols.select_list()),
                [id],
                session_from_row,
            )
            .optional()?
            .ok_or_else(|| format!("no session '{}'", id))?;
        Ok(session)
    }
}

// ============================================================================
// HTTP Handlers
// ============================================================================

/// GraphQL endpoint handler
pub async fn graphql_handler(
    schema: web::Data<ChasmSchema>,
    req: GraphQLRequest,
) -> GraphQLResponse {
    schema.execute(req.into_inner()).await.into()
}

/// GraphQL Playground UI
pub async fn graphql_playground() -> impl Responder {
    HttpResponse::Ok()
        .content_type("text/html")
        .body(GRAPHQL_PLAYGROUND_HTML)
}

/// GraphQL introspection endpoint
pub async fn graphql_sdl(schema: web::Data<ChasmSchema>) -> impl Responder {
    HttpResponse::Ok()
        .content_type("text/plain")
        .body(schema.sdl())
}

/// Create the GraphQL schema
pub fn create_schema(state: Arc<AppState>) -> ChasmSchema {
    Schema::build(QueryRoot, MutationRoot, EmptySubscription)
        .data(state)
        .finish()
}

/// Configure GraphQL routes
pub fn configure_graphql_routes(cfg: &mut web::ServiceConfig, schema: ChasmSchema) {
    cfg.app_data(web::Data::new(schema))
        .service(
            web::resource("/graphql")
                .route(web::get().to(graphql_handler))
                .route(web::post().to(graphql_handler)),
        )
        .route("/graphql/playground", web::get().to(graphql_playground))
        .route("/graphql/sdl", web::get().to(graphql_sdl));
}

/// Embedded GraphQL Playground HTML
const GRAPHQL_PLAYGROUND_HTML: &str = r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chasm GraphQL Playground</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            height: 100vh;
            overflow: hidden;
        }
        .custom-header {
            background: linear-gradient(135deg, #e535ab 0%, #9c27b0 100%);
            color: white;
            padding: 12px 24px;
            display: flex;
            align-items: center;
            gap: 16px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .custom-header h1 {
            margin: 0;
            font-size: 20px;
            font-weight: 600;
        }
        .custom-header .badge {
            background: rgba(255,255,255,0.2);
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
        }
        .custom-header a {
            color: white;
            text-decoration: none;
            margin-left: auto;
            opacity: 0.9;
            font-size: 14px;
        }
        .custom-header a:hover {
            opacity: 1;
        }
        #graphiql {
            height: calc(100vh - 48px);
        }
    </style>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/graphiql@3/graphiql.min.css" />
</head>
<body>
    <div class="custom-header">
        <h1>◈ Chasm GraphQL</h1>
        <span class="badge">v1.3.0</span>
        <a href="/docs">REST API →</a>
    </div>
    <div id="graphiql"></div>
    <script crossorigin src="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js"></script>
    <script crossorigin src="https://cdn.jsdelivr.net/npm/graphiql@3/graphiql.min.js"></script>
    <script>
        const fetcher = GraphiQL.createFetcher({
            url: '/graphql',
        });

        const root = ReactDOM.createRoot(document.getElementById('graphiql'));
        root.render(
            React.createElement(GraphiQL, {
                fetcher,
                defaultEditorToolsVisibility: true,
            })
        );
    </script>
</body>
</html>
"#;
