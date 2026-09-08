// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
//! Audit Logging Module
//!
//! Provides comprehensive audit logging for enterprise compliance requirements.
//! Tracks all user actions, API calls, and system events with full context.

use actix_web::{dev::ServiceRequest, web, HttpMessage, HttpRequest, HttpResponse};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

// Domain types referenced by the `DatabaseOps` contract below.
use super::auth::User;
use super::oidc::{OidcLoginState, OidcProviderConfig};
use super::retention::{ExpiredItem, ResourceType, RetentionPolicy};
use super::sso::{SamlIdpConfig, SsoRequestState, SsoSession};

// use crate::mcp::db::Database;
// TODO: Database abstraction for Q1 2027
pub type Database = std::sync::Arc<dyn DatabaseOps + Send + Sync>;

/// Persistence contract for the enterprise API surface.
///
/// This trait is the complete set of storage operations that the audit,
/// retention, and SSO services depend on. It has two layers:
///
/// * a generic table-oriented CRUD layer (`create`/`get_by_id`/...), and
/// * domain-typed operations used directly by the enterprise services.
///
/// The domain operations are synchronous because the services call them from
/// inside otherwise-async methods without awaiting; implementors are expected
/// to be backed by a blocking store (SQLite) or to bridge internally.
///
/// [`super::SqliteEnterpriseStore`] is the in-tree implementor, and is what
/// `ironbridge api serve` runs on in an enterprise build. The trait is the seam:
/// services take an injected `Database`, so an embedder can supply their own
/// store without touching the handlers.
#[allow(dead_code)]
#[async_trait::async_trait]
pub trait DatabaseOps {
    // -- Generic table operations ------------------------------------------
    async fn create(
        &self,
        table: &str,
        data: serde_json::Value,
    ) -> Result<serde_json::Value, String>;
    async fn get_by_id(&self, table: &str, id: &str) -> Result<Option<serde_json::Value>, String>;
    async fn query(
        &self,
        table: &str,
        filter: serde_json::Value,
    ) -> Result<Vec<serde_json::Value>, String>;
    async fn count(&self, table: &str, filter: serde_json::Value) -> Result<i64, String>;
    async fn update(&self, table: &str, id: &str, data: serde_json::Value) -> Result<(), String>;
    async fn delete(&self, table: &str, id: &str) -> Result<(), String>;

    // -- Audit log ----------------------------------------------------------
    fn insert_audit_events(&self, events: &[AuditEvent]) -> Result<(), String>;
    fn query_audit_events(&self, query: &AuditQuery) -> Result<AuditQueryResult, String>;
    fn get_audit_event(&self, event_id: &str) -> Result<Option<AuditEvent>, String>;
    fn get_audit_events_for_resource(
        &self,
        resource_type: &str,
        resource_id: &str,
        limit: usize,
    ) -> Result<Vec<AuditEvent>, String>;
    fn get_audit_events_for_user(
        &self,
        user_id: &str,
        from: Option<DateTime<Utc>>,
        to: Option<DateTime<Utc>>,
        limit: usize,
    ) -> Result<Vec<AuditEvent>, String>;

    // -- Retention policies -------------------------------------------------
    fn list_retention_policies(
        &self,
        organization_id: Option<&str>,
    ) -> Result<Vec<RetentionPolicy>, String>;
    fn get_retention_policy(&self, policy_id: &str) -> Result<Option<RetentionPolicy>, String>;
    fn create_retention_policy(&self, policy: &RetentionPolicy) -> Result<(), String>;
    fn update_retention_policy(&self, policy: &RetentionPolicy) -> Result<(), String>;
    fn delete_retention_policy(&self, policy_id: &str) -> Result<(), String>;
    fn update_retention_policy_execution(
        &self,
        policy_id: &str,
        last_run_at: i64,
        next_run_at: Option<i64>,
    ) -> Result<(), String>;
    fn get_due_retention_policies(&self, now: i64) -> Result<Vec<RetentionPolicy>, String>;

    // -- Retention actions on expired items ---------------------------------
    fn get_expired_items(
        &self,
        resource_type: ResourceType,
        expiry_threshold: DateTime<Utc>,
    ) -> Result<Vec<ExpiredItem>, String>;
    fn delete_item(&self, resource_type: ResourceType, id: &str) -> Result<(), String>;
    fn archive_item(&self, resource_type: ResourceType, id: &str) -> Result<(), String>;
    fn soft_delete_item(&self, resource_type: ResourceType, id: &str) -> Result<(), String>;
    fn anonymize_item(&self, resource_type: ResourceType, id: &str) -> Result<(), String>;
    fn export_item(&self, resource_type: ResourceType, id: &str) -> Result<(), String>;

    // -- SSO identity providers ---------------------------------------------
    fn get_sso_idp(&self, idp_id: &str) -> Result<Option<SamlIdpConfig>, String>;
    fn get_sso_idp_by_domain(&self, domain: &str) -> Result<Option<SamlIdpConfig>, String>;
    fn list_sso_idps(&self, organization_id: Option<&str>) -> Result<Vec<SamlIdpConfig>, String>;
    fn create_sso_idp(&self, idp: &SamlIdpConfig) -> Result<(), String>;
    fn update_sso_idp(&self, idp: &SamlIdpConfig) -> Result<(), String>;
    fn delete_sso_idp(&self, idp_id: &str) -> Result<(), String>;

    // -- SSO flow state and sessions ----------------------------------------
    fn store_sso_request_state(&self, state: &SsoRequestState) -> Result<(), String>;
    /// Fetch a pending SAML request state by its `request_id` **and delete it**,
    /// atomically -- the same single-use contract as [`Self::take_oidc_login_state`].
    ///
    /// A SAML Response is only accepted if it names a request this SP actually
    /// made (`InResponseTo`), and consuming the state here is what makes that a
    /// one-time acceptance: a replayed response finds the state already gone,
    /// and an unsolicited one names a `request_id` that was never stored.
    /// Implementors must not offer a non-consuming read.
    fn take_sso_request_state(&self, request_id: &str) -> Result<Option<SsoRequestState>, String>;
    fn store_sso_session(&self, session: &SsoSession) -> Result<(), String>;

    // -- OIDC identity providers --------------------------------------------
    fn get_oidc_provider(&self, id: &str) -> Result<Option<OidcProviderConfig>, String>;
    fn get_oidc_provider_by_domain(
        &self,
        domain: &str,
    ) -> Result<Option<OidcProviderConfig>, String>;
    fn list_oidc_providers(
        &self,
        organization_id: Option<&str>,
    ) -> Result<Vec<OidcProviderConfig>, String>;
    fn create_oidc_provider(&self, provider: &OidcProviderConfig) -> Result<(), String>;
    fn update_oidc_provider(&self, provider: &OidcProviderConfig) -> Result<(), String>;
    fn delete_oidc_provider(&self, id: &str) -> Result<(), String>;

    // -- OIDC pending logins -------------------------------------------------
    fn store_oidc_login_state(&self, state: &OidcLoginState) -> Result<(), String>;
    /// Fetch a pending login **and delete it**, atomically.
    ///
    /// Take, not get: the `state` is a single-use CSRF token, and a callback
    /// that can be replayed is a callback an attacker can replay. Implementors
    /// must not offer a non-consuming read of this.
    fn take_oidc_login_state(&self, state: &str) -> Result<Option<OidcLoginState>, String>;

    // -- Users provisioned through SSO --------------------------------------
    fn get_user_by_email(&self, email: &str) -> Result<Option<User>, String>;
    fn create_user(&self, user: &User) -> Result<(), String>;
    fn update_user_login(&self, user_id: &str) -> Result<(), String>;
}

// =============================================================================
// Audit Event Types
// =============================================================================

/// Categories of auditable events
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AuditCategory {
    /// Authentication events (login, logout, token refresh)
    Authentication,
    /// Authorization events (permission checks, access denied)
    Authorization,
    /// User management (create, update, delete users)
    UserManagement,
    /// Session operations (harvest, view, export, delete)
    SessionManagement,
    /// Workspace operations
    WorkspaceManagement,
    /// Team/organization operations
    TeamManagement,
    /// Configuration changes
    Configuration,
    /// Data export/import operations
    DataTransfer,
    /// Administrative actions
    Administration,
    /// System events (startup, shutdown, errors)
    System,
    /// API access events
    ApiAccess,
    /// SSO/SAML events
    Sso,
}

impl AuditCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Authentication => "authentication",
            Self::Authorization => "authorization",
            Self::UserManagement => "user_management",
            Self::SessionManagement => "session_management",
            Self::WorkspaceManagement => "workspace_management",
            Self::TeamManagement => "team_management",
            Self::Configuration => "configuration",
            Self::DataTransfer => "data_transfer",
            Self::Administration => "administration",
            Self::System => "system",
            Self::ApiAccess => "api_access",
            Self::Sso => "sso",
        }
    }
}

/// Specific audit event actions
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AuditAction {
    // Authentication
    Login,
    LoginFailed,
    Logout,
    TokenRefresh,
    PasswordChange,
    PasswordReset,
    MfaEnabled,
    MfaDisabled,

    // Authorization
    AccessGranted,
    AccessDenied,
    PermissionChanged,

    // User Management
    UserCreated,
    UserUpdated,
    UserDeleted,
    UserSuspended,
    UserActivated,
    UserInvited,
    InviteAccepted,
    SubscriptionChanged,

    // Session Management
    SessionHarvested,
    SessionViewed,
    SessionExported,
    SessionDeleted,
    SessionArchived,
    SessionShared,
    SessionUnshared,
    BulkExport,
    BulkDelete,

    // Workspace Management
    WorkspaceCreated,
    WorkspaceUpdated,
    WorkspaceDeleted,
    WorkspaceLinked,
    WorkspaceUnlinked,

    // Team Management
    TeamCreated,
    TeamUpdated,
    TeamDeleted,
    MemberAdded,
    MemberRemoved,
    RoleChanged,

    // Configuration
    SettingsUpdated,
    ProviderConfigured,
    ProviderDisabled,
    IdpConfigured,
    IdpUpdated,
    IdpDeleted,

    // Data Transfer
    DataExported,
    DataImported,
    BackupCreated,
    BackupRestored,

    // Administration
    AdminActionPerformed,
    SystemConfigChanged,
    RetentionPolicyApplied,
    DataPurged,

    // System
    ServiceStarted,
    ServiceStopped,
    ErrorOccurred,
    MaintenanceStarted,
    MaintenanceCompleted,

    // SSO
    SsoLoginInitiated,
    SsoLoginCompleted,
    SsoLoginFailed,
    SloInitiated,
    SloCompleted,

    // Generic
    Created,
    Updated,
    Deleted,
    Viewed,
    Listed,
    Searched,
}

impl AuditAction {
    /// snake_case name of the action.
    ///
    /// Derived from the serde representation so it can never drift from the
    /// wire format emitted by `Serialize`.
    pub fn as_str(&self) -> String {
        serde_json::to_value(self)
            .ok()
            .and_then(|v| v.as_str().map(str::to_owned))
            .unwrap_or_else(|| format!("{:?}", self).to_lowercase())
    }
}

/// Outcome of an audited action
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum AuditOutcome {
    #[default]
    Success,
    Failure,
    Partial,
    Denied,
    Error,
}

// =============================================================================
// Audit Event Model
// =============================================================================

/// Complete audit log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    /// Unique event identifier
    pub id: String,
    /// Event timestamp (UTC)
    pub timestamp: DateTime<Utc>,
    /// Event category
    pub category: AuditCategory,
    /// Specific action performed
    pub action: AuditAction,
    /// Outcome of the action
    pub outcome: AuditOutcome,
    /// User who performed the action (if authenticated)
    pub actor: Option<AuditActor>,
    /// Resource that was affected
    pub resource: Option<AuditResource>,
    /// Request context
    pub request: Option<AuditRequest>,
    /// Additional event details
    pub details: HashMap<String, serde_json::Value>,
    /// Human-readable description
    pub description: String,
    /// Error message (if outcome is failure/error)
    pub error: Option<String>,
    /// Organization/tenant context
    pub organization_id: Option<String>,
    /// Correlation ID for tracing related events
    pub correlation_id: Option<String>,
    /// Tags for filtering
    pub tags: Vec<String>,
}

/// Information about the actor (user) who triggered the event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditActor {
    /// User ID
    pub user_id: String,
    /// User email
    pub email: String,
    /// Display name
    pub display_name: Option<String>,
    /// Subscription tier
    pub tier: Option<String>,
    /// Auth method used (password, sso, api_key, etc.)
    pub auth_method: Option<String>,
    /// Session ID
    pub session_id: Option<String>,
}

/// Information about the affected resource
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditResource {
    /// Resource type (session, workspace, user, etc.)
    pub resource_type: String,
    /// Resource ID
    pub resource_id: String,
    /// Resource name (if applicable)
    pub name: Option<String>,
    /// Parent resource (e.g., workspace for a session)
    pub parent: Option<Box<AuditResource>>,
}

/// HTTP request context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditRequest {
    /// HTTP method
    pub method: String,
    /// Request path
    pub path: String,
    /// Query string (sanitized)
    pub query: Option<String>,
    /// Client IP address
    pub ip_address: Option<String>,
    /// User agent
    pub user_agent: Option<String>,
    /// Request ID for tracing
    pub request_id: String,
    /// Response status code
    pub status_code: Option<u16>,
    /// Response time in milliseconds
    pub duration_ms: Option<u64>,
}

// =============================================================================
// Audit Event Builder
// =============================================================================

/// Builder for constructing audit events
#[derive(Default)]
pub struct AuditEventBuilder {
    category: Option<AuditCategory>,
    action: Option<AuditAction>,
    outcome: AuditOutcome,
    actor: Option<AuditActor>,
    resource: Option<AuditResource>,
    request: Option<AuditRequest>,
    details: HashMap<String, serde_json::Value>,
    description: Option<String>,
    error: Option<String>,
    organization_id: Option<String>,
    correlation_id: Option<String>,
    tags: Vec<String>,
}

impl AuditEventBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn category(mut self, category: AuditCategory) -> Self {
        self.category = Some(category);
        self
    }

    pub fn action(mut self, action: AuditAction) -> Self {
        self.action = Some(action);
        self
    }

    pub fn outcome(mut self, outcome: AuditOutcome) -> Self {
        self.outcome = outcome;
        self
    }

    pub fn success(mut self) -> Self {
        self.outcome = AuditOutcome::Success;
        self
    }

    pub fn failure(mut self, error: impl Into<String>) -> Self {
        self.outcome = AuditOutcome::Failure;
        self.error = Some(error.into());
        self
    }

    pub fn denied(mut self) -> Self {
        self.outcome = AuditOutcome::Denied;
        self
    }

    pub fn actor(mut self, actor: AuditActor) -> Self {
        self.actor = Some(actor);
        self
    }

    pub fn actor_from_user(mut self, user_id: &str, email: &str) -> Self {
        self.actor = Some(AuditActor {
            user_id: user_id.to_string(),
            email: email.to_string(),
            display_name: None,
            tier: None,
            auth_method: None,
            session_id: None,
        });
        self
    }

    pub fn resource(mut self, resource_type: &str, resource_id: &str) -> Self {
        self.resource = Some(AuditResource {
            resource_type: resource_type.to_string(),
            resource_id: resource_id.to_string(),
            name: None,
            parent: None,
        });
        self
    }

    pub fn resource_with_name(
        mut self,
        resource_type: &str,
        resource_id: &str,
        name: &str,
    ) -> Self {
        self.resource = Some(AuditResource {
            resource_type: resource_type.to_string(),
            resource_id: resource_id.to_string(),
            name: Some(name.to_string()),
            parent: None,
        });
        self
    }

    pub fn request(mut self, request: AuditRequest) -> Self {
        self.request = Some(request);
        self
    }

    pub fn request_from_http(mut self, req: &HttpRequest) -> Self {
        let connection_info = req.connection_info();
        self.request = Some(AuditRequest {
            method: req.method().to_string(),
            path: req.path().to_string(),
            query: if req.query_string().is_empty() {
                None
            } else {
                Some(req.query_string().to_string())
            },
            ip_address: connection_info.realip_remote_addr().map(|s| s.to_string()),
            user_agent: req
                .headers()
                .get("user-agent")
                .and_then(|h| h.to_str().ok())
                .map(|s| s.to_string()),
            request_id: Uuid::new_v4().to_string(),
            status_code: None,
            duration_ms: None,
        });
        self
    }

    pub fn detail<V: Serialize>(mut self, key: &str, value: V) -> Self {
        if let Ok(json_value) = serde_json::to_value(value) {
            self.details.insert(key.to_string(), json_value);
        }
        self
    }

    pub fn description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    pub fn organization(mut self, organization_id: &str) -> Self {
        self.organization_id = Some(organization_id.to_string());
        self
    }

    pub fn correlation(mut self, correlation_id: &str) -> Self {
        self.correlation_id = Some(correlation_id.to_string());
        self
    }

    pub fn tag(mut self, tag: impl Into<String>) -> Self {
        self.tags.push(tag.into());
        self
    }

    pub fn tags(mut self, tags: Vec<String>) -> Self {
        self.tags.extend(tags);
        self
    }

    pub fn build(self) -> Result<AuditEvent, String> {
        let category = self.category.ok_or("Category is required")?;
        let action = self.action.ok_or("Action is required")?;

        let description = self
            .description
            .unwrap_or_else(|| format!("{:?} - {:?}", category, action));

        Ok(AuditEvent {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            category,
            action,
            outcome: self.outcome,
            actor: self.actor,
            resource: self.resource,
            request: self.request,
            details: self.details,
            description,
            error: self.error,
            organization_id: self.organization_id,
            correlation_id: self.correlation_id,
            tags: self.tags,
        })
    }
}

// =============================================================================
// Audit Service
// =============================================================================

/// Audit logging service
pub struct AuditService {
    db: Database,
    /// In-memory buffer for batch writes
    buffer: Arc<RwLock<Vec<AuditEvent>>>,
    /// Buffer flush threshold
    buffer_size: usize,
    /// Whether audit logging is enabled
    enabled: bool,
    /// Categories to log (empty = all)
    categories_filter: Vec<AuditCategory>,
    /// Minimum severity to log
    log_failures_only: bool,
}

impl AuditService {
    pub fn new(db: Database) -> Self {
        Self {
            db,
            buffer: Arc::new(RwLock::new(Vec::new())),
            buffer_size: 100,
            enabled: true,
            categories_filter: vec![],
            log_failures_only: false,
        }
    }

    pub fn with_buffer_size(mut self, size: usize) -> Self {
        self.buffer_size = size;
        self
    }

    pub fn disabled(mut self) -> Self {
        self.enabled = false;
        self
    }

    pub fn categories(mut self, categories: Vec<AuditCategory>) -> Self {
        self.categories_filter = categories;
        self
    }

    pub fn failures_only(mut self) -> Self {
        self.log_failures_only = true;
        self
    }

    /// Log an audit event
    pub async fn log(&self, event: AuditEvent) {
        if !self.enabled {
            return;
        }

        // Apply category filter
        if !self.categories_filter.is_empty() && !self.categories_filter.contains(&event.category) {
            return;
        }

        // Apply outcome filter
        if self.log_failures_only && event.outcome == AuditOutcome::Success {
            return;
        }

        // Add to buffer
        let mut buffer = self.buffer.write().await;
        buffer.push(event);

        // Flush if buffer is full
        if buffer.len() >= self.buffer_size {
            let events: Vec<_> = buffer.drain(..).collect();
            drop(buffer); // Release lock before DB write

            if let Err(e) = self.flush_events(events).await {
                eprintln!("Failed to flush audit events: {}", e);
            }
        }
    }

    /// Log an event using the builder pattern
    pub async fn log_builder(&self, builder: AuditEventBuilder) {
        match builder.build() {
            Ok(event) => self.log(event).await,
            Err(e) => eprintln!("Failed to build audit event: {}", e),
        }
    }

    /// Flush buffered events to database
    pub async fn flush(&self) {
        let mut buffer = self.buffer.write().await;
        if buffer.is_empty() {
            return;
        }

        let events: Vec<_> = buffer.drain(..).collect();
        drop(buffer);

        if let Err(e) = self.flush_events(events).await {
            eprintln!("Failed to flush audit events: {}", e);
        }
    }

    async fn flush_events(&self, events: Vec<AuditEvent>) -> Result<(), String> {
        self.db
            .insert_audit_events(&events)
            .map_err(|e| format!("Database error: {}", e))
    }

    /// Query audit events
    pub async fn query(&self, query: AuditQuery) -> Result<AuditQueryResult, String> {
        self.db
            .query_audit_events(&query)
            .map_err(|e| format!("Database error: {}", e))
    }

    /// Get audit event by ID
    pub async fn get_event(&self, event_id: &str) -> Result<Option<AuditEvent>, String> {
        self.db
            .get_audit_event(event_id)
            .map_err(|e| format!("Database error: {}", e))
    }

    /// Get events for a specific resource
    pub async fn get_resource_history(
        &self,
        resource_type: &str,
        resource_id: &str,
        limit: Option<usize>,
    ) -> Result<Vec<AuditEvent>, String> {
        self.db
            .get_audit_events_for_resource(resource_type, resource_id, limit.unwrap_or(100))
            .map_err(|e| format!("Database error: {}", e))
    }

    /// Get events for a specific user
    pub async fn get_user_activity(
        &self,
        user_id: &str,
        from: Option<DateTime<Utc>>,
        to: Option<DateTime<Utc>>,
        limit: Option<usize>,
    ) -> Result<Vec<AuditEvent>, String> {
        self.db
            .get_audit_events_for_user(user_id, from, to, limit.unwrap_or(100))
            .map_err(|e| format!("Database error: {}", e))
    }

    /// Export audit events (for compliance)
    pub async fn export(&self, query: AuditQuery, format: ExportFormat) -> Result<Vec<u8>, String> {
        let result = self.query(query).await?;

        match format {
            ExportFormat::Json => serde_json::to_vec_pretty(&result.events)
                .map_err(|e| format!("JSON serialization error: {}", e)),
            ExportFormat::Csv => self.events_to_csv(&result.events),
            ExportFormat::JsonLines => {
                let mut output = Vec::new();
                for event in &result.events {
                    let line = serde_json::to_vec(event)
                        .map_err(|e| format!("JSON serialization error: {}", e))?;
                    output.extend(line);
                    output.push(b'\n');
                }
                Ok(output)
            }
        }
    }

    fn events_to_csv(&self, events: &[AuditEvent]) -> Result<Vec<u8>, String> {
        let mut output = String::new();

        // Header
        output.push_str("id,timestamp,category,action,outcome,actor_id,actor_email,resource_type,resource_id,description,error\n");

        // Rows
        for event in events {
            let actor_id = event.actor.as_ref().map_or("", |a| a.user_id.as_str());
            let actor_email = event.actor.as_ref().map_or("", |a| a.email.as_str());
            let resource_type = event
                .resource
                .as_ref()
                .map_or("", |r| r.resource_type.as_str());
            let resource_id = event
                .resource
                .as_ref()
                .map_or("", |r| r.resource_id.as_str());
            let error = event.error.as_deref().unwrap_or("");

            output.push_str(&format!(
                "{},{},{},{:?},{:?},{},{},{},{},{},{}\n",
                event.id,
                event.timestamp.to_rfc3339(),
                event.category.as_str(),
                event.action,
                event.outcome,
                csv_escape(actor_id),
                csv_escape(actor_email),
                csv_escape(resource_type),
                csv_escape(resource_id),
                csv_escape(&event.description),
                csv_escape(error),
            ));
        }

        Ok(output.into_bytes())
    }
}

fn csv_escape(s: &str) -> String {
    // Neutralise spreadsheet formula injection. A cell a spreadsheet would
    // evaluate -- one starting `=`, `+`, `-`, `@`, or a tab/CR that can smuggle
    // a formula past a naive check -- is prefixed with a quote so it is read as
    // text. Audit rows carry attacker-influenced strings (an actor email, a
    // description, an error message), and a CSV is opened in Excel, so this is
    // the realistic exposure.
    let leads_formula = s
        .chars()
        .next()
        .is_some_and(|c| matches!(c, '=' | '+' | '-' | '@' | '\t' | '\r'));
    let guarded = if leads_formula {
        format!("'{s}")
    } else {
        s.to_string()
    };

    // RFC 4180 quoting for the field separators, plus the formula-guarded case
    // (which must be quoted so the leading quote is preserved literally).
    if leads_formula || guarded.contains(',') || guarded.contains('"') || guarded.contains('\n') {
        format!("\"{}\"", guarded.replace('"', "\"\""))
    } else {
        guarded
    }
}

// =============================================================================
// Query Types
// =============================================================================

/// Query parameters for audit log search
#[derive(Debug, Clone, Deserialize, Default)]
pub struct AuditQuery {
    /// Filter by category
    pub category: Option<AuditCategory>,
    /// Filter by action
    pub action: Option<AuditAction>,
    /// Filter by outcome
    pub outcome: Option<AuditOutcome>,
    /// Filter by actor user ID
    pub actor_id: Option<String>,
    /// Filter by actor email
    pub actor_email: Option<String>,
    /// Filter by resource type
    pub resource_type: Option<String>,
    /// Filter by resource ID
    pub resource_id: Option<String>,
    /// Filter by organization
    pub organization_id: Option<String>,
    /// Filter by correlation ID
    pub correlation_id: Option<String>,
    /// Search in description
    pub search: Option<String>,
    /// Start timestamp (inclusive)
    pub from: Option<DateTime<Utc>>,
    /// End timestamp (exclusive)
    pub to: Option<DateTime<Utc>>,
    /// Filter by tags
    pub tags: Option<Vec<String>>,
    /// Pagination offset
    pub offset: Option<usize>,
    /// Page size (max 1000)
    pub limit: Option<usize>,
    /// Sort order (asc/desc)
    pub sort_order: Option<String>,
}

/// Result of an audit query
#[derive(Debug, Clone, Serialize)]
pub struct AuditQueryResult {
    pub events: Vec<AuditEvent>,
    pub total: usize,
    pub offset: usize,
    pub limit: usize,
    pub has_more: bool,
}

/// Export format for audit logs
#[derive(Debug, Clone, Copy, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    #[default]
    Json,
    Csv,
    JsonLines,
}

// =============================================================================
// HTTP Handlers
// =============================================================================

/// GET /api/audit - Query audit logs
pub async fn query_audit_logs(
    audit_service: web::Data<AuditService>,
    query: web::Query<AuditQuery>,
) -> HttpResponse {
    match audit_service.query(query.into_inner()).await {
        Ok(result) => HttpResponse::Ok().json(result),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "error": e })),
    }
}

/// GET /api/audit/{event_id} - Get single audit event
pub async fn get_audit_event(
    audit_service: web::Data<AuditService>,
    path: web::Path<String>,
) -> HttpResponse {
    let event_id = path.into_inner();
    match audit_service.get_event(&event_id).await {
        Ok(Some(event)) => HttpResponse::Ok().json(event),
        Ok(None) => {
            HttpResponse::NotFound().json(serde_json::json!({ "error": "Event not found" }))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "error": e })),
    }
}

/// GET /api/audit/resource/{type}/{id} - Get resource history
pub async fn get_resource_audit_history(
    audit_service: web::Data<AuditService>,
    path: web::Path<(String, String)>,
    query: web::Query<HashMap<String, String>>,
) -> HttpResponse {
    let (resource_type, resource_id) = path.into_inner();
    let limit = query.get("limit").and_then(|s| s.parse().ok());

    match audit_service
        .get_resource_history(&resource_type, &resource_id, limit)
        .await
    {
        Ok(events) => HttpResponse::Ok().json(events),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "error": e })),
    }
}

/// GET /api/audit/user/{user_id} - Get user activity
pub async fn get_user_audit_history(
    audit_service: web::Data<AuditService>,
    path: web::Path<String>,
    query: web::Query<HashMap<String, String>>,
) -> HttpResponse {
    let user_id = path.into_inner();
    let from = query
        .get("from")
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&Utc));
    let to = query
        .get("to")
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&Utc));
    let limit = query.get("limit").and_then(|s| s.parse().ok());

    match audit_service
        .get_user_activity(&user_id, from, to, limit)
        .await
    {
        Ok(events) => HttpResponse::Ok().json(events),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "error": e })),
    }
}

#[derive(Debug, Deserialize)]
pub struct ExportQuery {
    #[serde(flatten)]
    pub query: AuditQuery,
    pub format: Option<ExportFormat>,
}

/// POST /api/audit/export - Export audit logs
pub async fn export_audit_logs(
    audit_service: web::Data<AuditService>,
    request: web::Json<ExportQuery>,
) -> HttpResponse {
    let format = request.format.unwrap_or_default();
    let content_type = match format {
        ExportFormat::Json => "application/json",
        ExportFormat::Csv => "text/csv",
        ExportFormat::JsonLines => "application/x-ndjson",
    };

    match audit_service
        .export(request.into_inner().query, format)
        .await
    {
        Ok(data) => HttpResponse::Ok()
            .content_type(content_type)
            .append_header((
                "Content-Disposition",
                "attachment; filename=\"audit-log.export\"",
            ))
            .body(data),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "error": e })),
    }
}

/// Configure audit routes
pub fn configure_audit_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/audit")
            .route("", web::get().to(query_audit_logs))
            .route("/{event_id}", web::get().to(get_audit_event))
            .route(
                "/resource/{type}/{id}",
                web::get().to(get_resource_audit_history),
            )
            .route("/user/{user_id}", web::get().to(get_user_audit_history))
            .route("/export", web::post().to(export_audit_logs)),
    );
}

// =============================================================================
// Convenience Macros
// =============================================================================

/// Macro for quick audit logging
#[macro_export]
macro_rules! audit {
    ($service:expr, $category:expr, $action:expr, $description:expr) => {
        $service.log_builder(
            $crate::api::audit::AuditEventBuilder::new()
                .category($category)
                .action($action)
                .description($description)
                .success()
        ).await
    };
    ($service:expr, $category:expr, $action:expr, $description:expr, $($key:expr => $value:expr),*) => {
        $service.log_builder(
            $crate::api::audit::AuditEventBuilder::new()
                .category($category)
                .action($action)
                .description($description)
                .success()
                $(.detail($key, $value))*
        ).await
    };
}

#[cfg(test)]
mod csv_tests {
    use super::csv_escape;

    #[test]
    fn csv_escape_quotes_separators() {
        assert_eq!(csv_escape("plain"), "plain");
        assert_eq!(csv_escape("a,b"), "\"a,b\"");
        assert_eq!(csv_escape("she said \"hi\""), "\"she said \"\"hi\"\"\"");
    }

    #[test]
    fn csv_escape_neutralises_formula_injection() {
        // A cell a spreadsheet would evaluate is prefixed with a quote and
        // wrapped, so it is text, not a formula.
        for payload in ["=1+1", "+cmd", "-2", "@SUM(A1)", "\t=evil"] {
            let out = csv_escape(payload);
            assert!(out.starts_with("\"'"), "not guarded: {payload:?} -> {out}");
        }
    }
}
