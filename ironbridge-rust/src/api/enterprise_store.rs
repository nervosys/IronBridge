// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

//! SQLite-backed implementation of [`DatabaseOps`].
//!
//! The audit, retention, and SSO services are written against the
//! [`DatabaseOps`] trait. Until this existed the trait had no implementor, so
//! those services compiled and were unit-tested but persisted nothing.
//!
//! # Storage shape
//!
//! Each table keeps the columns that are actually filtered on as real,
//! indexed columns, plus a `payload` column holding the serialised struct.
//! That avoids hand-mapping deeply nested types (an [`AuditEvent`] carries
//! three optional sub-structs and a free-form detail map) while keeping the
//! query dimensions the services use out of JSON.
//!
//! The trade-off is deliberate: filters must be added as columns to stay
//! indexable. Anything queried by a field not listed here would need a schema
//! change rather than a JSON scan.

use std::path::Path;
use std::sync::{Arc, Mutex};

use chrono::{DateTime, Utc};
use rusqlite::{params, params_from_iter, Connection, OptionalExtension, Row};

use super::audit::{AuditEvent, AuditQuery, AuditQueryResult, DatabaseOps};
use super::auth::User;
use super::oidc::{OidcLoginState, OidcProviderConfig};
use super::retention::{ExpiredItem, ResourceType, RetentionPolicy};
use super::sso::{SamlIdpConfig, SsoRequestState, SsoSession};

/// SQLite-backed enterprise store.
#[derive(Clone)]
pub struct SqliteEnterpriseStore {
    conn: Arc<Mutex<Connection>>,
}

/// Convert any error into the `String` error the trait uses.
fn err<E: std::fmt::Display>(context: &str) -> impl Fn(E) -> String + '_ {
    move |e| format!("{}: {}", context, e)
}

impl SqliteEnterpriseStore {
    /// Open (creating if needed) a store at `path`.
    pub fn open(path: impl AsRef<Path>) -> Result<Self, String> {
        let conn = Connection::open(path).map_err(err("opening enterprise database"))?;
        Self::from_connection(conn)
    }

    /// Create an in-memory store. Intended for tests.
    pub fn in_memory() -> Result<Self, String> {
        let conn = Connection::open_in_memory().map_err(err("opening in-memory database"))?;
        Self::from_connection(conn)
    }

    fn from_connection(conn: Connection) -> Result<Self, String> {
        let store = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        store.init_schema()?;
        Ok(store)
    }

    /// A poisoned mutex means another thread panicked mid-write. Surface it as
    /// an error rather than propagating the panic into an HTTP handler.
    fn lock(&self) -> Result<std::sync::MutexGuard<'_, Connection>, String> {
        self.conn
            .lock()
            .map_err(|_| "enterprise database lock poisoned".to_string())
    }

    fn init_schema(&self) -> Result<(), String> {
        let conn = self.lock()?;
        conn.execute_batch(
            r#"
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS audit_events (
                id              TEXT PRIMARY KEY,
                timestamp       INTEGER NOT NULL,
                category        TEXT NOT NULL,
                action          TEXT NOT NULL,
                outcome         TEXT NOT NULL,
                actor_id        TEXT,
                actor_email     TEXT,
                resource_type   TEXT,
                resource_id     TEXT,
                organization_id TEXT,
                correlation_id  TEXT,
                description     TEXT NOT NULL DEFAULT '',
                tags            TEXT NOT NULL DEFAULT '[]',
                payload         TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp);
            CREATE INDEX IF NOT EXISTS idx_audit_actor    ON audit_events(actor_id);
            CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_events(resource_type, resource_id);
            CREATE INDEX IF NOT EXISTS idx_audit_org      ON audit_events(organization_id);

            CREATE TABLE IF NOT EXISTS retention_policies (
                id              TEXT PRIMARY KEY,
                organization_id TEXT,
                enabled         INTEGER NOT NULL DEFAULT 1,
                next_run_at     INTEGER,
                last_run_at     INTEGER,
                payload         TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_retention_due ON retention_policies(enabled, next_run_at);

            CREATE TABLE IF NOT EXISTS sso_idps (
                id              TEXT PRIMARY KEY,
                organization_id TEXT,
                enabled         INTEGER NOT NULL DEFAULT 0,
                payload         TEXT NOT NULL
            );

            -- Domain -> IdP routing. A separate table rather than a JSON array
            -- so the callback lookup is an indexed equality match.
            CREATE TABLE IF NOT EXISTS sso_idp_domains (
                domain TEXT NOT NULL,
                idp_id TEXT NOT NULL REFERENCES sso_idps(id) ON DELETE CASCADE,
                PRIMARY KEY (domain, idp_id)
            );

            CREATE TABLE IF NOT EXISTS sso_request_states (
                request_id TEXT PRIMARY KEY,
                idp_id     TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                payload    TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sso_sessions (
                id         TEXT PRIMARY KEY,
                user_id    TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                payload    TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_sso_sessions_user ON sso_sessions(user_id);

            CREATE TABLE IF NOT EXISTS oidc_providers (
                id              TEXT PRIMARY KEY,
                organization_id TEXT,
                enabled         INTEGER NOT NULL DEFAULT 0,
                payload         TEXT NOT NULL
            );

            -- Domain -> provider routing, indexed for the same reason as the
            -- SAML equivalent: login discovery is an equality lookup.
            CREATE TABLE IF NOT EXISTS oidc_provider_domains (
                domain      TEXT NOT NULL,
                provider_id TEXT NOT NULL REFERENCES oidc_providers(id) ON DELETE CASCADE,
                PRIMARY KEY (domain, provider_id)
            );

            -- Pending logins. Rows are deleted when consumed, so this table
            -- holds only in-flight logins.
            CREATE TABLE IF NOT EXISTS oidc_login_states (
                state       TEXT PRIMARY KEY,
                provider_id TEXT NOT NULL,
                expires_at  INTEGER NOT NULL,
                payload     TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS users (
                id            TEXT PRIMARY KEY,
                email         TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL DEFAULT '',
                created_at    INTEGER NOT NULL DEFAULT 0,
                last_login_at INTEGER,
                payload       TEXT NOT NULL
            );

            -- Backing store for the generic table operations on the trait.
            CREATE TABLE IF NOT EXISTS generic_documents (
                table_name TEXT NOT NULL,
                id         TEXT NOT NULL,
                payload    TEXT NOT NULL,
                PRIMARY KEY (table_name, id)
            );
            "#,
        )
        .map_err(err("initialising enterprise schema"))?;
        Ok(())
    }
}

// =============================================================================
// Row helpers
// =============================================================================

fn audit_event_from_row(row: &Row<'_>) -> rusqlite::Result<AuditEvent> {
    let payload: String = row.get("payload")?;
    serde_json::from_str(&payload).map_err(|e| {
        rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(e))
    })
}

fn json_from_row<T: serde::de::DeserializeOwned>(row: &Row<'_>) -> rusqlite::Result<T> {
    let payload: String = row.get("payload")?;
    serde_json::from_str(&payload).map_err(|e| {
        rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(e))
    })
}

/// Reassemble a [`User`], restoring the password hash.
///
/// `User::password_hash` is `#[serde(skip_serializing)]`, so it is absent from
/// the stored payload and deserialisation would fail without it. It is kept in
/// its own column and spliced back in here.
fn user_from_row(row: &Row<'_>) -> rusqlite::Result<User> {
    let payload: String = row.get("payload")?;
    let password_hash: String = row.get("password_hash")?;

    let mut value: serde_json::Value = serde_json::from_str(&payload).map_err(|e| {
        rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(e))
    })?;
    if let Some(obj) = value.as_object_mut() {
        obj.insert("password_hash".to_string(), password_hash.into());
    }
    serde_json::from_value(value).map_err(|e| {
        rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(e))
    })
}

fn to_json<T: serde::Serialize>(value: &T, what: &str) -> Result<String, String> {
    serde_json::to_string(value).map_err(|e| format!("serialising {}: {}", what, e))
}

/// Retention operates on resources this store does not own (chat sessions live
/// in the main database, exports and temp files on disk). Returning an empty
/// list for those would make a retention run look successful while deleting
/// nothing, so they are refused explicitly.
fn unsupported(resource_type: ResourceType) -> String {
    format!(
        "retention for resource type '{}' is not backed by the enterprise store; \
         only 'audit_log' and 'user' are owned here",
        resource_type.as_str()
    )
}

// =============================================================================
// DatabaseOps
// =============================================================================

#[async_trait::async_trait]
impl DatabaseOps for SqliteEnterpriseStore {
    // -- Generic table operations ------------------------------------------
    //
    // Present on the trait but unused by the audit/retention/SSO services.
    // Backed by a single document table so they behave predictably rather than
    // silently succeeding.

    async fn create(
        &self,
        table: &str,
        data: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let id = data
            .get("id")
            .and_then(|v| v.as_str())
            .map(str::to_owned)
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

        let mut stored = data;
        if let Some(obj) = stored.as_object_mut() {
            obj.insert("id".to_string(), id.clone().into());
        }

        let conn = self.lock()?;
        conn.execute(
            "INSERT INTO generic_documents (table_name, id, payload) VALUES (?1, ?2, ?3)",
            params![table, id, stored.to_string()],
        )
        .map_err(err("inserting document"))?;
        Ok(stored)
    }

    async fn get_by_id(&self, table: &str, id: &str) -> Result<Option<serde_json::Value>, String> {
        let conn = self.lock()?;
        let payload: Option<String> = conn
            .query_row(
                "SELECT payload FROM generic_documents WHERE table_name = ?1 AND id = ?2",
                params![table, id],
                |row| row.get(0),
            )
            .optional()
            .map_err(err("reading document"))?;

        payload
            .map(|p| serde_json::from_str(&p).map_err(|e| format!("decoding document: {}", e)))
            .transpose()
    }

    async fn query(
        &self,
        table: &str,
        filter: serde_json::Value,
    ) -> Result<Vec<serde_json::Value>, String> {
        let conn = self.lock()?;
        let mut stmt = conn
            .prepare("SELECT payload FROM generic_documents WHERE table_name = ?1")
            .map_err(err("preparing document query"))?;
        let rows = stmt
            .query_map(params![table], |row| row.get::<_, String>(0))
            .map_err(err("querying documents"))?;

        let wanted = filter.as_object();
        let mut out = Vec::new();
        for row in rows {
            let raw = row.map_err(err("reading document row"))?;
            let value: serde_json::Value =
                serde_json::from_str(&raw).map_err(|e| format!("decoding document: {}", e))?;

            // Equality match on every key present in the filter.
            // `map_or(true, ..)` rather than `is_none_or`: the latter is
            // stable only from 1.82 and this crate's MSRV is 1.75.
            #[allow(clippy::unnecessary_map_or)]
            let matches = wanted.map_or(true, |f| {
                f.iter()
                    .all(|(k, v)| value.get(k).map(|actual| actual == v).unwrap_or(false))
            });
            if matches {
                out.push(value);
            }
        }
        Ok(out)
    }

    async fn count(&self, table: &str, filter: serde_json::Value) -> Result<i64, String> {
        Ok(self.query(table, filter).await?.len() as i64)
    }

    async fn update(&self, table: &str, id: &str, data: serde_json::Value) -> Result<(), String> {
        let conn = self.lock()?;
        let changed = conn
            .execute(
                "UPDATE generic_documents SET payload = ?3 WHERE table_name = ?1 AND id = ?2",
                params![table, id, data.to_string()],
            )
            .map_err(err("updating document"))?;
        if changed == 0 {
            return Err(format!("no document '{}' in table '{}'", id, table));
        }
        Ok(())
    }

    async fn delete(&self, table: &str, id: &str) -> Result<(), String> {
        let conn = self.lock()?;
        conn.execute(
            "DELETE FROM generic_documents WHERE table_name = ?1 AND id = ?2",
            params![table, id],
        )
        .map_err(err("deleting document"))?;
        Ok(())
    }

    // -- Audit log ----------------------------------------------------------

    fn insert_audit_events(&self, events: &[AuditEvent]) -> Result<(), String> {
        if events.is_empty() {
            return Ok(());
        }
        let mut conn = self.lock()?;
        // One transaction for the batch: the audit service flushes buffered
        // events together, and a partial write would leave gaps in the log.
        let tx = conn.transaction().map_err(err("starting audit write"))?;
        for event in events {
            tx.execute(
                "INSERT OR REPLACE INTO audit_events (
                     id, timestamp, category, action, outcome, actor_id, actor_email,
                     resource_type, resource_id, organization_id, correlation_id,
                     description, tags, payload
                 ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
                params![
                    event.id,
                    event.timestamp.timestamp(),
                    format!("{:?}", event.category).to_lowercase(),
                    event.action.as_str(),
                    format!("{:?}", event.outcome).to_lowercase(),
                    event.actor.as_ref().map(|a| a.user_id.as_str()),
                    event.actor.as_ref().map(|a| a.email.as_str()),
                    event.resource.as_ref().map(|r| r.resource_type.as_str()),
                    event.resource.as_ref().map(|r| r.resource_id.as_str()),
                    event.organization_id.as_deref(),
                    event.correlation_id.as_deref(),
                    event.description,
                    to_json(&event.tags, "audit tags")?,
                    to_json(event, "audit event")?,
                ],
            )
            .map_err(err("inserting audit event"))?;
        }
        tx.commit().map_err(err("committing audit write"))?;
        Ok(())
    }

    fn query_audit_events(&self, query: &AuditQuery) -> Result<AuditQueryResult, String> {
        let mut where_parts: Vec<String> = Vec::new();
        let mut args: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        let mut push = |sql: &str, value: Box<dyn rusqlite::ToSql>| {
            where_parts.push(format!("{} = ?{}", sql, args.len() + 1));
            args.push(value);
        };

        if let Some(v) = &query.actor_id {
            push("actor_id", Box::new(v.clone()));
        }
        if let Some(v) = &query.actor_email {
            push("actor_email", Box::new(v.clone()));
        }
        if let Some(v) = &query.resource_type {
            push("resource_type", Box::new(v.clone()));
        }
        if let Some(v) = &query.resource_id {
            push("resource_id", Box::new(v.clone()));
        }
        if let Some(v) = &query.organization_id {
            push("organization_id", Box::new(v.clone()));
        }
        if let Some(v) = &query.correlation_id {
            push("correlation_id", Box::new(v.clone()));
        }
        if let Some(v) = &query.category {
            push("category", Box::new(format!("{:?}", v).to_lowercase()));
        }
        if let Some(v) = &query.outcome {
            push("outcome", Box::new(format!("{:?}", v).to_lowercase()));
        }
        if let Some(v) = &query.action {
            push("action", Box::new(v.as_str()));
        }
        if let Some(from) = query.from {
            where_parts.push(format!("timestamp >= ?{}", args.len() + 1));
            args.push(Box::new(from.timestamp()));
        }
        if let Some(to) = query.to {
            where_parts.push(format!("timestamp < ?{}", args.len() + 1));
            args.push(Box::new(to.timestamp()));
        }
        if let Some(search) = &query.search {
            where_parts.push(format!("description LIKE ?{}", args.len() + 1));
            args.push(Box::new(format!("%{}%", search)));
        }

        let where_sql = if where_parts.is_empty() {
            String::new()
        } else {
            format!(" WHERE {}", where_parts.join(" AND "))
        };

        // Cap the page size so a hostile or careless caller cannot ask for the
        // entire log in one response.
        let limit = query.limit.unwrap_or(100).clamp(1, 1000);
        let offset = query.offset.unwrap_or(0);

        let conn = self.lock()?;

        let total: i64 = conn
            .query_row(
                &format!("SELECT COUNT(*) FROM audit_events{}", where_sql),
                params_from_iter(args.iter().map(|a| a.as_ref())),
                |row| row.get(0),
            )
            .map_err(err("counting audit events"))?;

        let sql = format!(
            "SELECT payload FROM audit_events{} ORDER BY timestamp DESC, id DESC LIMIT {} OFFSET {}",
            where_sql, limit, offset
        );
        let mut stmt = conn.prepare(&sql).map_err(err("preparing audit query"))?;
        let events = stmt
            .query_map(
                params_from_iter(args.iter().map(|a| a.as_ref())),
                audit_event_from_row,
            )
            .map_err(err("querying audit events"))?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(err("decoding audit events"))?;

        let total = total as usize;
        Ok(AuditQueryResult {
            has_more: offset + events.len() < total,
            events,
            total,
            offset,
            limit,
        })
    }

    fn get_audit_event(&self, event_id: &str) -> Result<Option<AuditEvent>, String> {
        let conn = self.lock()?;
        conn.query_row(
            "SELECT payload FROM audit_events WHERE id = ?1",
            params![event_id],
            audit_event_from_row,
        )
        .optional()
        .map_err(err("reading audit event"))
    }

    fn get_audit_events_for_resource(
        &self,
        resource_type: &str,
        resource_id: &str,
        limit: usize,
    ) -> Result<Vec<AuditEvent>, String> {
        let conn = self.lock()?;
        let mut stmt = conn
            .prepare(
                "SELECT payload FROM audit_events
                 WHERE resource_type = ?1 AND resource_id = ?2
                 ORDER BY timestamp DESC LIMIT ?3",
            )
            .map_err(err("preparing resource audit query"))?;
        let out = stmt
            .query_map(
                params![resource_type, resource_id, limit as i64],
                audit_event_from_row,
            )
            .map_err(err("querying resource audit events"))?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(err("decoding resource audit events"))?;
        Ok(out)
    }

    fn get_audit_events_for_user(
        &self,
        user_id: &str,
        from: Option<DateTime<Utc>>,
        to: Option<DateTime<Utc>>,
        limit: usize,
    ) -> Result<Vec<AuditEvent>, String> {
        let conn = self.lock()?;
        let mut stmt = conn
            .prepare(
                "SELECT payload FROM audit_events
                 WHERE actor_id = ?1
                   AND (?2 IS NULL OR timestamp >= ?2)
                   AND (?3 IS NULL OR timestamp <  ?3)
                 ORDER BY timestamp DESC LIMIT ?4",
            )
            .map_err(err("preparing user audit query"))?;
        let out = stmt
            .query_map(
                params![
                    user_id,
                    from.map(|d| d.timestamp()),
                    to.map(|d| d.timestamp()),
                    limit as i64
                ],
                audit_event_from_row,
            )
            .map_err(err("querying user audit events"))?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(err("decoding user audit events"))?;
        Ok(out)
    }

    // -- Retention policies -------------------------------------------------

    fn list_retention_policies(
        &self,
        organization_id: Option<&str>,
    ) -> Result<Vec<RetentionPolicy>, String> {
        let conn = self.lock()?;
        let mut stmt = conn
            .prepare(
                "SELECT payload FROM retention_policies
                 WHERE ?1 IS NULL OR organization_id = ?1
                 ORDER BY id",
            )
            .map_err(err("preparing policy list"))?;
        let out = stmt
            .query_map(params![organization_id], json_from_row::<RetentionPolicy>)
            .map_err(err("listing retention policies"))?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(err("decoding retention policies"))?;
        Ok(out)
    }

    fn get_retention_policy(&self, policy_id: &str) -> Result<Option<RetentionPolicy>, String> {
        let conn = self.lock()?;
        conn.query_row(
            "SELECT payload FROM retention_policies WHERE id = ?1",
            params![policy_id],
            json_from_row::<RetentionPolicy>,
        )
        .optional()
        .map_err(err("reading retention policy"))
    }

    fn create_retention_policy(&self, policy: &RetentionPolicy) -> Result<(), String> {
        let conn = self.lock()?;
        conn.execute(
            "INSERT INTO retention_policies
                 (id, organization_id, enabled, next_run_at, last_run_at, payload)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                policy.id,
                policy.organization_id.as_deref(),
                policy.enabled as i64,
                policy.next_run_at,
                policy.last_run_at,
                to_json(policy, "retention policy")?,
            ],
        )
        .map_err(err("creating retention policy"))?;
        Ok(())
    }

    fn update_retention_policy(&self, policy: &RetentionPolicy) -> Result<(), String> {
        let conn = self.lock()?;
        let changed = conn
            .execute(
                "UPDATE retention_policies
                 SET organization_id = ?2, enabled = ?3, next_run_at = ?4,
                     last_run_at = ?5, payload = ?6
                 WHERE id = ?1",
                params![
                    policy.id,
                    policy.organization_id.as_deref(),
                    policy.enabled as i64,
                    policy.next_run_at,
                    policy.last_run_at,
                    to_json(policy, "retention policy")?,
                ],
            )
            .map_err(err("updating retention policy"))?;
        if changed == 0 {
            return Err(format!("no retention policy '{}'", policy.id));
        }
        Ok(())
    }

    fn delete_retention_policy(&self, policy_id: &str) -> Result<(), String> {
        let conn = self.lock()?;
        conn.execute(
            "DELETE FROM retention_policies WHERE id = ?1",
            params![policy_id],
        )
        .map_err(err("deleting retention policy"))?;
        Ok(())
    }

    fn update_retention_policy_execution(
        &self,
        policy_id: &str,
        last_run_at: i64,
        next_run_at: Option<i64>,
    ) -> Result<(), String> {
        let conn = self.lock()?;
        // The payload is the source of truth for the service, so the mirrored
        // timestamps inside it are patched alongside the columns.
        let payload: Option<String> = conn
            .query_row(
                "SELECT payload FROM retention_policies WHERE id = ?1",
                params![policy_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(err("reading retention policy"))?;

        let Some(payload) = payload else {
            return Err(format!("no retention policy '{}'", policy_id));
        };
        let mut value: serde_json::Value =
            serde_json::from_str(&payload).map_err(|e| format!("decoding policy: {}", e))?;
        if let Some(obj) = value.as_object_mut() {
            obj.insert("last_run_at".to_string(), last_run_at.into());
            obj.insert(
                "next_run_at".to_string(),
                match next_run_at {
                    Some(v) => v.into(),
                    None => serde_json::Value::Null,
                },
            );
        }

        conn.execute(
            "UPDATE retention_policies
             SET last_run_at = ?2, next_run_at = ?3, payload = ?4 WHERE id = ?1",
            params![policy_id, last_run_at, next_run_at, value.to_string()],
        )
        .map_err(err("updating policy execution"))?;
        Ok(())
    }

    fn get_due_retention_policies(&self, now: i64) -> Result<Vec<RetentionPolicy>, String> {
        let conn = self.lock()?;
        let mut stmt = conn
            .prepare(
                "SELECT payload FROM retention_policies
                 WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?1
                 ORDER BY next_run_at",
            )
            .map_err(err("preparing due-policy query"))?;
        let out = stmt
            .query_map(params![now], json_from_row::<RetentionPolicy>)
            .map_err(err("querying due policies"))?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(err("decoding due policies"))?;
        Ok(out)
    }

    // -- Retention actions on expired items ---------------------------------

    fn get_expired_items(
        &self,
        resource_type: ResourceType,
        expiry_threshold: DateTime<Utc>,
    ) -> Result<Vec<ExpiredItem>, String> {
        let conn = self.lock()?;
        let cutoff = expiry_threshold.timestamp();

        match resource_type {
            ResourceType::AuditLog => {
                let mut stmt = conn
                    .prepare(
                        "SELECT id, timestamp, actor_id, length(payload)
                         FROM audit_events WHERE timestamp < ?1",
                    )
                    .map_err(err("preparing expired audit query"))?;
                let out = stmt
                    .query_map(params![cutoff], |row| {
                        Ok(ExpiredItem {
                            id: row.get(0)?,
                            created_at: row.get(1)?,
                            owner_id: row.get(2)?,
                            size_bytes: row.get::<_, Option<i64>>(3)?.map(|v| v as u64),
                        })
                    })
                    .map_err(err("querying expired audit events"))?
                    .collect::<rusqlite::Result<Vec<_>>>()
                    .map_err(err("decoding expired audit events"))?;
                Ok(out)
            }
            ResourceType::User => {
                let mut stmt = conn
                    .prepare(
                        "SELECT id, created_at, id, length(payload)
                         FROM users WHERE created_at < ?1",
                    )
                    .map_err(err("preparing expired user query"))?;
                let out = stmt
                    .query_map(params![cutoff], |row| {
                        Ok(ExpiredItem {
                            id: row.get(0)?,
                            created_at: row.get(1)?,
                            owner_id: row.get(2)?,
                            size_bytes: row.get::<_, Option<i64>>(3)?.map(|v| v as u64),
                        })
                    })
                    .map_err(err("querying expired users"))?
                    .collect::<rusqlite::Result<Vec<_>>>()
                    .map_err(err("decoding expired users"))?;
                Ok(out)
            }
            other => Err(unsupported(other)),
        }
    }

    fn delete_item(&self, resource_type: ResourceType, id: &str) -> Result<(), String> {
        let conn = self.lock()?;
        let table = match resource_type {
            ResourceType::AuditLog => "audit_events",
            ResourceType::User => "users",
            other => return Err(unsupported(other)),
        };
        conn.execute(&format!("DELETE FROM {} WHERE id = ?1", table), params![id])
            .map_err(err("deleting item"))?;
        Ok(())
    }

    fn archive_item(&self, resource_type: ResourceType, _id: &str) -> Result<(), String> {
        // No archive tier exists in this store. Refusing is deliberate: a
        // silent success would report archived data that was never written
        // anywhere.
        Err(format!(
            "archiving '{}' is not supported: the enterprise store has no archive tier",
            resource_type.as_str()
        ))
    }

    fn soft_delete_item(&self, resource_type: ResourceType, id: &str) -> Result<(), String> {
        match resource_type {
            ResourceType::User => {
                let conn = self.lock()?;
                let changed = conn
                    .execute(
                        "UPDATE users SET payload = json_set(payload, '$.deleted_at', ?2)
                         WHERE id = ?1",
                        params![id, Utc::now().timestamp()],
                    )
                    .map_err(err("soft deleting user"))?;
                if changed == 0 {
                    return Err(format!("no user '{}'", id));
                }
                Ok(())
            }
            other => Err(unsupported(other)),
        }
    }

    fn anonymize_item(&self, resource_type: ResourceType, id: &str) -> Result<(), String> {
        match resource_type {
            ResourceType::User => {
                let conn = self.lock()?;
                // Overwrite the identifying columns in place. The email is
                // uniquely constrained, so it is replaced with a per-id value
                // rather than a shared placeholder.
                let changed = conn
                    .execute(
                        "UPDATE users
                         SET email = ?2,
                             password_hash = '',
                             payload = json_set(
                                 json_set(payload, '$.email', ?2),
                                 '$.display_name', 'Anonymised user')
                         WHERE id = ?1",
                        params![id, format!("anonymised+{}@invalid", id)],
                    )
                    .map_err(err("anonymising user"))?;
                if changed == 0 {
                    return Err(format!("no user '{}'", id));
                }
                Ok(())
            }
            other => Err(unsupported(other)),
        }
    }

    fn export_item(&self, resource_type: ResourceType, _id: &str) -> Result<(), String> {
        // Export needs a destination (path, bucket, retention archive) that
        // this trait does not carry. Refuse rather than pretend.
        Err(format!(
            "exporting '{}' is not supported: no export destination is configured",
            resource_type.as_str()
        ))
    }

    // -- SSO identity providers ---------------------------------------------

    fn get_sso_idp(&self, idp_id: &str) -> Result<Option<SamlIdpConfig>, String> {
        let conn = self.lock()?;
        conn.query_row(
            "SELECT payload FROM sso_idps WHERE id = ?1",
            params![idp_id],
            json_from_row::<SamlIdpConfig>,
        )
        .optional()
        .map_err(err("reading SSO IdP"))
    }

    fn get_sso_idp_by_domain(&self, domain: &str) -> Result<Option<SamlIdpConfig>, String> {
        let conn = self.lock()?;
        // Only enabled IdPs are eligible: a disabled configuration must not be
        // able to authenticate anyone.
        conn.query_row(
            "SELECT i.payload FROM sso_idps i
             JOIN sso_idp_domains d ON d.idp_id = i.id
             WHERE d.domain = ?1 AND i.enabled = 1",
            params![domain.to_lowercase()],
            json_from_row::<SamlIdpConfig>,
        )
        .optional()
        .map_err(err("reading SSO IdP by domain"))
    }

    fn list_sso_idps(&self, organization_id: Option<&str>) -> Result<Vec<SamlIdpConfig>, String> {
        let conn = self.lock()?;
        let mut stmt = conn
            .prepare(
                "SELECT payload FROM sso_idps
                 WHERE ?1 IS NULL OR organization_id = ?1
                 ORDER BY id",
            )
            .map_err(err("preparing IdP list"))?;
        let out = stmt
            .query_map(params![organization_id], json_from_row::<SamlIdpConfig>)
            .map_err(err("listing SSO IdPs"))?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(err("decoding SSO IdPs"))?;
        Ok(out)
    }

    fn create_sso_idp(&self, idp: &SamlIdpConfig) -> Result<(), String> {
        let payload = to_json(idp, "SSO IdP")?;
        let mut conn = self.lock()?;
        let tx = conn.transaction().map_err(err("starting IdP write"))?;
        tx.execute(
            "INSERT INTO sso_idps (id, organization_id, enabled, payload)
             VALUES (?1, ?2, ?3, ?4)",
            params![
                idp.id,
                idp.organization_id.as_deref(),
                idp.enabled as i64,
                payload
            ],
        )
        .map_err(err("creating SSO IdP"))?;
        for domain in &idp.domains {
            tx.execute(
                "INSERT OR IGNORE INTO sso_idp_domains (domain, idp_id) VALUES (?1, ?2)",
                params![domain.to_lowercase(), idp.id],
            )
            .map_err(err("mapping IdP domain"))?;
        }
        tx.commit().map_err(err("committing IdP write"))?;
        Ok(())
    }

    fn update_sso_idp(&self, idp: &SamlIdpConfig) -> Result<(), String> {
        let payload = to_json(idp, "SSO IdP")?;
        let mut conn = self.lock()?;
        let tx = conn.transaction().map_err(err("starting IdP update"))?;
        let changed = tx
            .execute(
                "UPDATE sso_idps SET organization_id = ?2, enabled = ?3, payload = ?4
                 WHERE id = ?1",
                params![
                    idp.id,
                    idp.organization_id.as_deref(),
                    idp.enabled as i64,
                    payload
                ],
            )
            .map_err(err("updating SSO IdP"))?;
        if changed == 0 {
            return Err(format!("no SSO IdP '{}'", idp.id));
        }
        // Replace the domain set wholesale; removing a domain from the config
        // must stop routing logins to this IdP.
        tx.execute(
            "DELETE FROM sso_idp_domains WHERE idp_id = ?1",
            params![idp.id],
        )
        .map_err(err("clearing IdP domains"))?;
        for domain in &idp.domains {
            tx.execute(
                "INSERT OR IGNORE INTO sso_idp_domains (domain, idp_id) VALUES (?1, ?2)",
                params![domain.to_lowercase(), idp.id],
            )
            .map_err(err("mapping IdP domain"))?;
        }
        tx.commit().map_err(err("committing IdP update"))?;
        Ok(())
    }

    fn delete_sso_idp(&self, idp_id: &str) -> Result<(), String> {
        let conn = self.lock()?;
        conn.execute("DELETE FROM sso_idps WHERE id = ?1", params![idp_id])
            .map_err(err("deleting SSO IdP"))?;
        Ok(())
    }

    // -- SSO flow state and sessions ----------------------------------------

    fn store_sso_request_state(&self, state: &SsoRequestState) -> Result<(), String> {
        let conn = self.lock()?;
        conn.execute(
            "INSERT OR REPLACE INTO sso_request_states (request_id, idp_id, expires_at, payload)
             VALUES (?1, ?2, ?3, ?4)",
            params![
                state.request_id,
                state.idp_id,
                state.expires_at,
                to_json(state, "SSO request state")?
            ],
        )
        .map_err(err("storing SSO request state"))?;

        // Opportunistic cleanup; these are single-use and short-lived.
        conn.execute(
            "DELETE FROM sso_request_states WHERE expires_at < ?1",
            params![Utc::now().timestamp()],
        )
        .map_err(err("pruning SSO request states"))?;
        Ok(())
    }

    fn take_sso_request_state(&self, request_id: &str) -> Result<Option<SsoRequestState>, String> {
        let conn = self.lock()?;
        // `RETURNING` fuses the read and the delete, so a replayed response
        // cannot be served twice: exactly one caller sees the row, and the
        // expiry bound rejects a stale one in the same statement.
        conn.query_row(
            "DELETE FROM sso_request_states WHERE request_id = ?1 AND expires_at > ?2
             RETURNING payload",
            params![request_id, Utc::now().timestamp()],
            json_from_row::<SsoRequestState>,
        )
        .optional()
        .map_err(err("consuming SSO request state"))
    }

    fn store_sso_session(&self, session: &SsoSession) -> Result<(), String> {
        let conn = self.lock()?;
        conn.execute(
            "INSERT OR REPLACE INTO sso_sessions (id, user_id, expires_at, payload)
             VALUES (?1, ?2, ?3, ?4)",
            params![
                session.id,
                session.user_id,
                session.expires_at,
                to_json(session, "SSO session")?
            ],
        )
        .map_err(err("storing SSO session"))?;
        Ok(())
    }

    // -- OIDC identity providers --------------------------------------------

    fn get_oidc_provider(&self, id: &str) -> Result<Option<OidcProviderConfig>, String> {
        let conn = self.lock()?;
        conn.query_row(
            "SELECT payload FROM oidc_providers WHERE id = ?1",
            params![id],
            json_from_row::<OidcProviderConfig>,
        )
        .optional()
        .map_err(err("reading OIDC provider"))
    }

    fn get_oidc_provider_by_domain(
        &self,
        domain: &str,
    ) -> Result<Option<OidcProviderConfig>, String> {
        let conn = self.lock()?;
        // Enabled only, as with SAML: a disabled provider must not be able to
        // authenticate anyone, including by domain discovery.
        conn.query_row(
            "SELECT p.payload FROM oidc_providers p
             JOIN oidc_provider_domains d ON d.provider_id = p.id
             WHERE d.domain = ?1 AND p.enabled = 1",
            params![domain.to_lowercase()],
            json_from_row::<OidcProviderConfig>,
        )
        .optional()
        .map_err(err("reading OIDC provider by domain"))
    }

    fn list_oidc_providers(
        &self,
        organization_id: Option<&str>,
    ) -> Result<Vec<OidcProviderConfig>, String> {
        let conn = self.lock()?;
        let mut stmt = conn
            .prepare(
                "SELECT payload FROM oidc_providers
                 WHERE ?1 IS NULL OR organization_id = ?1
                 ORDER BY id",
            )
            .map_err(err("preparing OIDC provider list"))?;
        let rows = stmt
            .query_map(
                params![organization_id],
                json_from_row::<OidcProviderConfig>,
            )
            .map_err(err("listing OIDC providers"))?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row.map_err(err("decoding OIDC providers"))?);
        }
        Ok(out)
    }

    fn create_oidc_provider(&self, provider: &OidcProviderConfig) -> Result<(), String> {
        let payload = to_json(provider, "OIDC provider")?;
        let mut conn = self.lock()?;
        let tx = conn
            .transaction()
            .map_err(err("starting OIDC provider write"))?;
        tx.execute(
            "INSERT INTO oidc_providers (id, organization_id, enabled, payload)
             VALUES (?1, ?2, ?3, ?4)",
            params![
                provider.id,
                provider.organization_id.as_deref(),
                provider.enabled as i64,
                payload
            ],
        )
        .map_err(err("creating OIDC provider"))?;
        for domain in &provider.domains {
            tx.execute(
                "INSERT OR IGNORE INTO oidc_provider_domains (domain, provider_id)
                 VALUES (?1, ?2)",
                params![domain.to_lowercase(), provider.id],
            )
            .map_err(err("mapping OIDC provider domain"))?;
        }
        tx.commit().map_err(err("committing OIDC provider write"))?;
        Ok(())
    }

    fn update_oidc_provider(&self, provider: &OidcProviderConfig) -> Result<(), String> {
        let payload = to_json(provider, "OIDC provider")?;
        let mut conn = self.lock()?;
        let tx = conn
            .transaction()
            .map_err(err("starting OIDC provider update"))?;
        let changed = tx
            .execute(
                "UPDATE oidc_providers SET organization_id = ?2, enabled = ?3, payload = ?4
                 WHERE id = ?1",
                params![
                    provider.id,
                    provider.organization_id.as_deref(),
                    provider.enabled as i64,
                    payload
                ],
            )
            .map_err(err("updating OIDC provider"))?;
        if changed == 0 {
            return Err(format!("no OIDC provider '{}'", provider.id));
        }
        // Replace the domain set wholesale: removing a domain must stop
        // routing logins here.
        tx.execute(
            "DELETE FROM oidc_provider_domains WHERE provider_id = ?1",
            params![provider.id],
        )
        .map_err(err("clearing OIDC provider domains"))?;
        for domain in &provider.domains {
            tx.execute(
                "INSERT OR IGNORE INTO oidc_provider_domains (domain, provider_id)
                 VALUES (?1, ?2)",
                params![domain.to_lowercase(), provider.id],
            )
            .map_err(err("mapping OIDC provider domain"))?;
        }
        tx.commit()
            .map_err(err("committing OIDC provider update"))?;
        Ok(())
    }

    fn delete_oidc_provider(&self, id: &str) -> Result<(), String> {
        let conn = self.lock()?;
        conn.execute("DELETE FROM oidc_providers WHERE id = ?1", params![id])
            .map_err(err("deleting OIDC provider"))?;
        Ok(())
    }

    // -- OIDC pending logins --------------------------------------------------

    fn store_oidc_login_state(&self, state: &OidcLoginState) -> Result<(), String> {
        let conn = self.lock()?;
        conn.execute(
            "INSERT OR REPLACE INTO oidc_login_states (state, provider_id, expires_at, payload)
             VALUES (?1, ?2, ?3, ?4)",
            params![
                state.state,
                state.provider_id,
                state.expires_at,
                to_json(state, "OIDC login state")?
            ],
        )
        .map_err(err("storing OIDC login state"))?;

        // Opportunistic cleanup. Abandoned logins are the common case -- users
        // close the tab -- and nothing else would ever remove them.
        conn.execute(
            "DELETE FROM oidc_login_states WHERE expires_at < ?1",
            params![Utc::now().timestamp()],
        )
        .map_err(err("pruning OIDC login states"))?;
        Ok(())
    }

    fn take_oidc_login_state(&self, state: &str) -> Result<Option<OidcLoginState>, String> {
        let conn = self.lock()?;
        // `RETURNING` makes the read and the delete one statement, so two
        // concurrent callbacks carrying the same state cannot both be served
        // -- exactly one sees a row. A select-then-delete pair would leave a
        // window where both do.
        conn.query_row(
            "DELETE FROM oidc_login_states WHERE state = ?1 RETURNING payload",
            params![state],
            json_from_row::<OidcLoginState>,
        )
        .optional()
        .map_err(err("consuming OIDC login state"))
    }

    // -- Users provisioned through SSO --------------------------------------

    fn get_user_by_email(&self, email: &str) -> Result<Option<User>, String> {
        let conn = self.lock()?;
        conn.query_row(
            "SELECT payload, password_hash FROM users WHERE email = ?1",
            params![email.to_lowercase()],
            user_from_row,
        )
        .optional()
        .map_err(err("reading user by email"))
    }

    fn create_user(&self, user: &User) -> Result<(), String> {
        let conn = self.lock()?;
        conn.execute(
            "INSERT INTO users (id, email, password_hash, created_at, last_login_at, payload)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                user.id,
                user.email.to_lowercase(),
                user.password_hash,
                user.created_at,
                user.last_login_at,
                to_json(user, "user")?,
            ],
        )
        .map_err(err("creating user"))?;
        Ok(())
    }

    fn update_user_login(&self, user_id: &str) -> Result<(), String> {
        let now = Utc::now().timestamp();
        let conn = self.lock()?;
        let changed = conn
            .execute(
                "UPDATE users
                 SET last_login_at = ?2,
                     payload = json_set(payload, '$.last_login_at', ?2)
                 WHERE id = ?1",
                params![user_id, now],
            )
            .map_err(err("updating user login"))?;
        if changed == 0 {
            return Err(format!("no user '{}'", user_id));
        }
        Ok(())
    }
}

#[cfg(test)]
mod store_tests {
    use super::*;
    use crate::api::audit::{
        AuditAction, AuditActor, AuditCategory, AuditEventBuilder, AuditOutcome,
    };
    use crate::api::auth::SubscriptionTier;
    use crate::api::retention::RetentionSchedule;
    use chrono::TimeZone;

    fn store() -> SqliteEnterpriseStore {
        SqliteEnterpriseStore::in_memory().expect("in-memory store")
    }

    fn event(description: &str) -> AuditEvent {
        AuditEventBuilder::new()
            .category(AuditCategory::Authentication)
            .action(AuditAction::Login)
            .outcome(AuditOutcome::Success)
            .actor_from_user("user-1", "alice@example.com")
            .description(description)
            .build()
            .expect("valid audit event")
    }

    /// A policy with the schedule/rule machinery left empty; these tests
    /// exercise storage, not scheduling.
    fn policy(id: &str, enabled: bool, next_run_at: Option<i64>) -> RetentionPolicy {
        RetentionPolicy {
            id: id.to_string(),
            name: format!("policy {id}"),
            description: None,
            enabled,
            organization_id: None,
            resource_types: vec![ResourceType::AuditLog],
            rules: Vec::new(),
            schedule: RetentionSchedule::Manual,
            expiry_actions: Vec::new(),
            created_at: 0,
            updated_at: 0,
            last_run_at: None,
            next_run_at,
        }
    }

    fn user(id: &str, email: &str) -> User {
        User {
            id: id.to_string(),
            email: email.to_string(),
            display_name: "Alice".to_string(),
            password_hash: "hashed-secret".to_string(),
            subscription_tier: SubscriptionTier::Enterprise,
            subscription_expires_at: None,
            created_at: 1_000,
            updated_at: 1_000,
            last_login_at: None,
            email_verified: true,
            avatar_url: None,
            metadata: None,
        }
    }

    fn idp(id: &str, domains: &[&str], enabled: bool) -> SamlIdpConfig {
        SamlIdpConfig {
            id: id.to_string(),
            name: "Test IdP".to_string(),
            entity_id: "https://idp.example.com".to_string(),
            sso_url: "https://idp.example.com/sso".to_string(),
            certificate: "cert".to_string(),
            enabled,
            domains: domains.iter().map(|d| d.to_string()).collect(),
            ..Default::default()
        }
    }

    // -- Audit ---------------------------------------------------------------

    #[test]
    fn audit_events_survive_a_write_and_read() {
        let s = store();
        s.insert_audit_events(&[event("first"), event("second")])
            .unwrap();

        let result = s.query_audit_events(&AuditQuery::default()).unwrap();

        assert_eq!(result.total, 2);
        assert_eq!(result.events.len(), 2);
    }

    #[test]
    fn audit_query_filters_by_actor() {
        let s = store();
        let mut other = event("other actor");
        other.actor = Some(AuditActor {
            user_id: "user-2".into(),
            email: "bob@example.com".into(),
            display_name: None,
            tier: None,
            auth_method: None,
            session_id: None,
        });
        s.insert_audit_events(&[event("mine"), other]).unwrap();

        let result = s
            .query_audit_events(&AuditQuery {
                actor_id: Some("user-1".into()),
                ..Default::default()
            })
            .unwrap();

        assert_eq!(result.total, 1);
        assert_eq!(result.events[0].description, "mine");
    }

    #[test]
    fn audit_query_paginates_and_reports_has_more() {
        let s = store();
        let events: Vec<_> = (0..5).map(|i| event(&format!("event {i}"))).collect();
        s.insert_audit_events(&events).unwrap();

        let page = s
            .query_audit_events(&AuditQuery {
                limit: Some(2),
                ..Default::default()
            })
            .unwrap();

        assert_eq!(page.events.len(), 2);
        assert_eq!(page.total, 5);
        assert!(page.has_more);

        let last = s
            .query_audit_events(&AuditQuery {
                limit: Some(2),
                offset: Some(4),
                ..Default::default()
            })
            .unwrap();
        assert!(!last.has_more, "the final page must not claim more");
    }

    #[test]
    fn audit_limit_is_capped_so_one_request_cannot_drain_the_log() {
        let s = store();
        s.insert_audit_events(&[event("only")]).unwrap();

        let result = s
            .query_audit_events(&AuditQuery {
                limit: Some(100_000),
                ..Default::default()
            })
            .unwrap();

        assert_eq!(result.limit, 1000);
    }

    #[test]
    fn a_single_bad_event_does_not_half_write_the_batch() {
        // insert_audit_events is transactional; re-inserting a duplicate id
        // must not leave the batch partially applied.
        let s = store();
        let a = event("a");
        s.insert_audit_events(std::slice::from_ref(&a)).unwrap();
        let before = s.query_audit_events(&AuditQuery::default()).unwrap().total;

        // Same id twice in one batch: the second is an upsert, not a failure,
        // so the count should stay stable rather than double.
        s.insert_audit_events(&[a.clone(), a]).unwrap();
        let after = s.query_audit_events(&AuditQuery::default()).unwrap().total;

        assert_eq!(before, after);
    }

    // -- Users ---------------------------------------------------------------

    #[test]
    fn user_password_hash_survives_the_json_round_trip() {
        // User::password_hash is #[serde(skip_serializing)], so a naive
        // payload-only store would lose it and then fail to deserialize.
        let s = store();
        s.create_user(&user("u1", "alice@example.com")).unwrap();

        let got = s.get_user_by_email("alice@example.com").unwrap().unwrap();

        assert_eq!(got.password_hash, "hashed-secret");
        assert_eq!(got.id, "u1");
    }

    #[test]
    fn user_lookup_is_case_insensitive_on_email() {
        let s = store();
        s.create_user(&user("u1", "Alice@Example.com")).unwrap();

        assert!(s.get_user_by_email("alice@example.com").unwrap().is_some());
    }

    #[test]
    fn update_user_login_sets_the_timestamp_in_both_column_and_payload() {
        let s = store();
        s.create_user(&user("u1", "alice@example.com")).unwrap();

        s.update_user_login("u1").unwrap();

        let got = s.get_user_by_email("alice@example.com").unwrap().unwrap();
        assert!(
            got.last_login_at.is_some(),
            "payload must reflect the login"
        );
    }

    #[test]
    fn update_user_login_reports_an_unknown_user() {
        let s = store();
        assert!(s.update_user_login("nobody").is_err());
    }

    // -- SSO -----------------------------------------------------------------

    #[test]
    fn idp_is_resolvable_by_email_domain() {
        let s = store();
        s.create_sso_idp(&idp("idp-1", &["example.com"], true))
            .unwrap();

        let found = s.get_sso_idp_by_domain("example.com").unwrap();

        assert_eq!(found.map(|i| i.id), Some("idp-1".to_string()));
    }

    #[test]
    fn a_disabled_idp_cannot_authenticate_anyone() {
        let s = store();
        s.create_sso_idp(&idp("idp-1", &["example.com"], false))
            .unwrap();

        assert!(
            s.get_sso_idp_by_domain("example.com").unwrap().is_none(),
            "a disabled IdP must not resolve"
        );
    }

    #[test]
    fn domain_lookup_ignores_case() {
        let s = store();
        s.create_sso_idp(&idp("idp-1", &["Example.COM"], true))
            .unwrap();

        assert!(s.get_sso_idp_by_domain("example.com").unwrap().is_some());
    }

    #[test]
    fn removing_a_domain_stops_routing_logins_to_that_idp() {
        let s = store();
        s.create_sso_idp(&idp("idp-1", &["example.com", "old.example.com"], true))
            .unwrap();

        s.update_sso_idp(&idp("idp-1", &["example.com"], true))
            .unwrap();

        assert!(s.get_sso_idp_by_domain("example.com").unwrap().is_some());
        assert!(
            s.get_sso_idp_by_domain("old.example.com")
                .unwrap()
                .is_none(),
            "a domain dropped from the config must stop resolving"
        );
    }

    #[test]
    fn deleting_an_idp_removes_its_domain_routes() {
        let s = store();
        s.create_sso_idp(&idp("idp-1", &["example.com"], true))
            .unwrap();

        s.delete_sso_idp("idp-1").unwrap();

        assert!(s.get_sso_idp_by_domain("example.com").unwrap().is_none());
        assert!(s.get_sso_idp("idp-1").unwrap().is_none());
    }

    #[test]
    fn sso_request_state_and_session_persist() {
        let s = store();
        let now = Utc::now().timestamp();

        s.store_sso_request_state(&SsoRequestState {
            request_id: "req-1".into(),
            idp_id: "idp-1".into(),
            relay_state: None,
            created_at: now,
            expires_at: now + 300,
        })
        .unwrap();

        s.store_sso_session(&SsoSession {
            id: "sess-1".into(),
            user_id: "u1".into(),
            idp_id: "idp-1".into(),
            name_id: "alice@example.com".into(),
            session_index: None,
            created_at: now,
            expires_at: now + 3600,
        })
        .unwrap();
    }

    // -- OIDC ------------------------------------------------------------------

    fn oidc_provider(id: &str, enabled: bool, domains: &[&str]) -> OidcProviderConfig {
        OidcProviderConfig {
            id: id.into(),
            name: "Entra".into(),
            issuer: "https://login.example.com/v2.0".into(),
            client_id: "client-abc".into(),
            client_secret: Some("secret".into()),
            redirect_uri: "https://ironbridge.example.com/oidc/callback".into(),
            scopes: vec![],
            groups_claim: None,
            enabled,
            domains: domains.iter().map(|d| d.to_string()).collect(),
            organization_id: None,
            default_tier: crate::api::auth::SubscriptionTier::Enterprise,
            auto_provision: true,
            created_at: 0,
            updated_at: 0,
        }
    }

    #[test]
    fn oidc_providers_round_trip_and_route_by_domain() {
        let s = store();
        s.create_oidc_provider(&oidc_provider("p1", true, &["Example.COM"]))
            .unwrap();

        assert_eq!(s.get_oidc_provider("p1").unwrap().unwrap().name, "Entra");
        // Domains are stored folded, so the lookup is case-insensitive in
        // practice -- email domains are.
        assert_eq!(
            s.get_oidc_provider_by_domain("example.com")
                .unwrap()
                .unwrap()
                .id,
            "p1"
        );
        assert_eq!(s.list_oidc_providers(None).unwrap().len(), 1);

        s.delete_oidc_provider("p1").unwrap();
        assert!(s.get_oidc_provider("p1").unwrap().is_none());
        assert!(s
            .get_oidc_provider_by_domain("example.com")
            .unwrap()
            .is_none());
    }

    /// A disabled provider must not authenticate anyone, including through
    /// domain discovery, which is the path that does not name it explicitly.
    #[test]
    fn a_disabled_provider_is_not_reachable_by_domain() {
        let s = store();
        s.create_oidc_provider(&oidc_provider("p1", false, &["example.com"]))
            .unwrap();
        assert!(s
            .get_oidc_provider_by_domain("example.com")
            .unwrap()
            .is_none());
        // Still readable by id, so an admin can enable it.
        assert!(s.get_oidc_provider("p1").unwrap().is_some());
    }

    #[test]
    fn removing_a_domain_stops_routing_to_the_provider() {
        let s = store();
        s.create_oidc_provider(&oidc_provider("p1", true, &["old.example", "keep.example"]))
            .unwrap();
        s.update_oidc_provider(&oidc_provider("p1", true, &["keep.example"]))
            .unwrap();

        assert!(s
            .get_oidc_provider_by_domain("old.example")
            .unwrap()
            .is_none());
        assert!(s
            .get_oidc_provider_by_domain("keep.example")
            .unwrap()
            .is_some());
    }

    #[test]
    fn updating_a_provider_that_does_not_exist_is_an_error() {
        let s = store();
        assert!(s
            .update_oidc_provider(&oidc_provider("ghost", true, &[]))
            .is_err());
    }

    /// The `state` is a single-use CSRF token. If a second callback carrying
    /// the same value could be served, an attacker who captured one callback
    /// URL could replay it.
    #[test]
    fn a_login_state_can_only_be_taken_once() {
        let s = store();
        let now = Utc::now().timestamp();
        s.store_oidc_login_state(&OidcLoginState {
            state: "st-1".into(),
            provider_id: "p1".into(),
            nonce: "n".into(),
            verifier: "v".into(),
            return_to: Some("/dashboard".into()),
            created_at: now,
            expires_at: now + 900,
        })
        .unwrap();

        let first = s.take_oidc_login_state("st-1").unwrap();
        assert_eq!(first.expect("first take must find it").verifier, "v");

        assert!(
            s.take_oidc_login_state("st-1").unwrap().is_none(),
            "a replayed callback must find nothing"
        );
    }

    #[test]
    fn an_unknown_login_state_is_absent_not_an_error() {
        let s = store();
        assert!(s.take_oidc_login_state("never-issued").unwrap().is_none());
    }

    /// A SAML request state is consumed exactly once: the first callback finds
    /// it, a replay finds nothing. This is the anti-replay / anti-unsolicited
    /// control -- a response only counts if it names a request that was stored
    /// and has not been spent.
    #[test]
    fn a_sso_request_state_is_single_use() {
        use crate::api::sso::SsoRequestState;
        let s = store();
        let now = Utc::now().timestamp();
        s.store_sso_request_state(&SsoRequestState {
            request_id: "req-1".into(),
            idp_id: "idp1".into(),
            relay_state: Some("/home".into()),
            created_at: now,
            expires_at: now + 600,
        })
        .unwrap();

        assert_eq!(
            s.take_sso_request_state("req-1")
                .unwrap()
                .expect("first take")
                .idp_id,
            "idp1"
        );
        assert!(
            s.take_sso_request_state("req-1").unwrap().is_none(),
            "a replayed SAML response must find nothing"
        );
    }

    #[test]
    fn an_unknown_sso_request_state_is_absent_not_an_error() {
        let s = store();
        assert!(s.take_sso_request_state("never-issued").unwrap().is_none());
    }

    #[test]
    fn an_expired_sso_request_state_is_not_consumable() {
        use crate::api::sso::SsoRequestState;
        let s = store();
        let now = Utc::now().timestamp();
        s.store_sso_request_state(&SsoRequestState {
            request_id: "stale".into(),
            idp_id: "idp1".into(),
            relay_state: None,
            created_at: now - 10_000,
            expires_at: now - 5_000,
        })
        .unwrap();
        assert!(s.take_sso_request_state("stale").unwrap().is_none());
    }

    /// Abandoned logins are the common case -- users close the tab -- and
    /// nothing else prunes them.
    #[test]
    fn storing_a_login_state_prunes_expired_ones() {
        let s = store();
        let now = Utc::now().timestamp();
        s.store_oidc_login_state(&OidcLoginState {
            state: "stale".into(),
            provider_id: "p1".into(),
            nonce: "n".into(),
            verifier: "v".into(),
            return_to: None,
            created_at: now - 10_000,
            expires_at: now - 5_000,
        })
        .unwrap();
        s.store_oidc_login_state(&OidcLoginState {
            state: "fresh".into(),
            provider_id: "p1".into(),
            nonce: "n".into(),
            verifier: "v".into(),
            return_to: None,
            created_at: now,
            expires_at: now + 900,
        })
        .unwrap();

        assert!(s.take_oidc_login_state("stale").unwrap().is_none());
        assert!(s.take_oidc_login_state("fresh").unwrap().is_some());
    }

    // -- Retention -----------------------------------------------------------

    #[test]
    fn only_due_policies_are_returned() {
        let s = store();
        s.create_retention_policy(&policy("due", true, Some(100)))
            .unwrap();
        s.create_retention_policy(&policy("later", true, Some(10_000)))
            .unwrap();
        s.create_retention_policy(&policy("disabled", false, Some(100)))
            .unwrap();

        let ids: Vec<_> = s
            .get_due_retention_policies(500)
            .unwrap()
            .into_iter()
            .map(|p| p.id)
            .collect();

        assert_eq!(ids, vec!["due".to_string()]);
    }

    #[test]
    fn recording_an_execution_updates_the_stored_policy() {
        let s = store();
        s.create_retention_policy(&policy("p1", true, Some(100)))
            .unwrap();

        s.update_retention_policy_execution("p1", 500, Some(900))
            .unwrap();

        let got = s.get_retention_policy("p1").unwrap().unwrap();
        assert_eq!(got.last_run_at, Some(500));
        assert_eq!(got.next_run_at, Some(900));
        // And the change must be visible to the due-policy scan, which reads
        // the column rather than the payload.
        assert!(s.get_due_retention_policies(600).unwrap().is_empty());
    }

    #[test]
    fn expired_audit_events_are_found_by_age() {
        let s = store();
        let mut old = event("old");
        old.timestamp = Utc.timestamp_opt(1_000, 0).unwrap();
        let mut recent = event("recent");
        recent.timestamp = Utc.timestamp_opt(9_000, 0).unwrap();
        s.insert_audit_events(&[old, recent]).unwrap();

        let expired = s
            .get_expired_items(ResourceType::AuditLog, Utc.timestamp_opt(5_000, 0).unwrap())
            .unwrap();

        assert_eq!(expired.len(), 1);
    }

    #[test]
    fn retention_refuses_resource_types_it_does_not_own() {
        // Returning an empty list here would make a retention run look
        // successful while deleting nothing.
        let s = store();

        let result = s.get_expired_items(ResourceType::Session, Utc::now());

        assert!(
            result.is_err(),
            "unowned resource types must not silently no-op"
        );
        assert!(result.unwrap_err().contains("not backed by"));
    }

    #[test]
    fn archive_and_export_refuse_rather_than_silently_succeed() {
        let s = store();

        assert!(s.archive_item(ResourceType::User, "u1").is_err());
        assert!(s.export_item(ResourceType::User, "u1").is_err());
    }

    #[test]
    fn anonymising_a_user_clears_identifying_fields() {
        let s = store();
        s.create_user(&user("u1", "alice@example.com")).unwrap();

        s.anonymize_item(ResourceType::User, "u1").unwrap();

        assert!(
            s.get_user_by_email("alice@example.com").unwrap().is_none(),
            "the original email must no longer resolve"
        );
    }

    #[test]
    fn deleting_an_expired_audit_event_removes_it() {
        let s = store();
        let e = event("doomed");
        let id = e.id.clone();
        s.insert_audit_events(&[e]).unwrap();

        s.delete_item(ResourceType::AuditLog, &id).unwrap();

        assert!(s.get_audit_event(&id).unwrap().is_none());
    }
}
