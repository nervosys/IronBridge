// Copyright (c) 2024-2028 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
//! HTTP API Server for Chat System Manager
//!
//! Provides a REST API for the web frontend and mobile app to interact with CSM.
//! Uses Actix-web for the HTTP server.
//!
//! # The `enterprise` feature
//!
//! The modules behind `#[cfg(feature = "enterprise")]` (audit, retention, sso)
//! are served by [`EnterpriseServices`], which opens a
//! [`SqliteEnterpriseStore`] over the same database file and registers the
//! three scopes with it. Two things are worth knowing before changing them:
//!
//! * [`audit::DatabaseOps`] is the persistence contract all three depend on.
//!   `SqliteEnterpriseStore` is the in-tree implementor; the trait stays in
//!   place so an embedder can substitute their own store.
//! * SAML signature verification is pure Rust, via `chasm-sso`, so the feature
//!   builds everywhere rather than only where libxmlsec1 does. `handle_callback`
//!   verifies the response and then re-parses it from the *reduced* document
//!   containing only signed content, which is what makes it resistant to XML
//!   Signature Wrapping. Preserve that ordering: reading the original document
//!   after verification reintroduces the bypass.

#[cfg(feature = "enterprise")]
mod audit;
mod auth;
pub mod caching;
pub mod datasets;
mod docs;
pub mod documents;
#[cfg(feature = "enterprise")]
mod enterprise_store;
mod graphql;
mod handlers_simple;
mod handlers_swe;
mod handlers_write;
pub mod inbox;
#[cfg(feature = "enterprise")]
mod oidc;
mod recording;
#[cfg(feature = "enterprise")]
mod retention;
pub mod sdk;
#[cfg(feature = "enterprise")]
mod sso;
mod state;
mod sync;
mod webhooks;
mod websocket;

#[cfg(feature = "enterprise")]
pub use audit::{
    configure_audit_routes, AuditAction, AuditCategory, AuditEvent, AuditEventBuilder, AuditService,
};
pub use auth::configure_auth_routes;
pub use datasets::configure_dataset_routes;
pub use docs::configure_docs_routes;
pub use documents::configure_document_routes;
#[cfg(feature = "enterprise")]
pub use enterprise_store::SqliteEnterpriseStore;
pub use graphql::{configure_graphql_routes, create_schema, ChasmSchema};
pub use inbox::{configure_inbox_routes, init_inbox_tables, InboxEmitter};
#[cfg(feature = "enterprise")]
pub use oidc::{configure_oidc_routes, OidcProviderConfig, OidcService};
pub use recording::{configure_recording_routes, create_recording_state};
#[cfg(feature = "enterprise")]
pub use retention::{configure_retention_routes, RetentionPolicy, RetentionService};
#[cfg(feature = "enterprise")]
pub use sso::{configure_sso_routes, SamlIdpConfig, SsoService};
pub use state::AppState;
pub use sync::{configure_sync_routes, create_sync_state};
pub use webhooks::{configure_webhook_routes, WebhookState};
pub use websocket::{configure_websocket_routes, WebSocketState};

use actix_cors::Cors;
use actix_web::{middleware, web, App, HttpServer};
use anyhow::Result;
use std::path::PathBuf;

use crate::database::ChatDatabase;

/// API server configuration
#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub database_path: String,
    pub cors_origins: Vec<String>,
    /// The address clients reach this server on, if it differs from the bind
    /// address. Set from `CHASM_PUBLIC_BASE_URL`.
    ///
    /// Only SAML needs this, and it genuinely needs it: the SP metadata and
    /// the `AssertionConsumerServiceURL` are consumed by the *identity
    /// provider*, which posts the user's browser back to whatever they say.
    /// The bind address is frequently `0.0.0.0`, or a container-internal host
    /// behind a reverse proxy -- neither is somewhere a browser can go.
    pub public_base_url: Option<String>,
}

impl ServerConfig {
    /// The base URL to advertise to external parties.
    ///
    /// Falls back to the bind address, rewriting a wildcard to loopback so a
    /// default local run produces a URL that at least resolves. That fallback
    /// is right for development and wrong for anything else, which is why
    /// [`Self::public_base_url`] exists.
    fn resolved_base_url(&self) -> String {
        if let Some(url) = &self.public_base_url {
            return url.trim_end_matches('/').to_string();
        }
        let host = match self.host.as_str() {
            "0.0.0.0" | "::" | "[::]" | "" => "127.0.0.1",
            other => other,
        };
        format!("http://{}:{}", host, self.port)
    }
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "0.0.0.0".to_string(), // Bind to all interfaces
            port: 8787,
            database_path: dirs::data_local_dir()
                .map(|p| p.join("csm").join("csm.db").to_string_lossy().to_string())
                .unwrap_or_else(|| "csm.db".to_string()),
            cors_origins: vec![
                "http://localhost:5173".to_string(),
                "http://localhost:3000".to_string(),
                "http://127.0.0.1:5173".to_string(),
                "http://127.0.0.1:3000".to_string(),
                "http://localhost:8081".to_string(),  // Expo web
                "http://127.0.0.1:8081".to_string(),  // Expo web
                "http://localhost:19006".to_string(), // Expo web alt
                "http://127.0.0.1:19006".to_string(), // Expo web alt
            ],
            public_base_url: std::env::var("CHASM_PUBLIC_BASE_URL")
                .ok()
                .filter(|s| !s.trim().is_empty()),
        }
    }
}

/// Configure API routes
fn configure_routes(cfg: &mut web::ServiceConfig) {
    use handlers_simple::*;

    eprintln!("[DEBUG] Configuring routes...");

    // Routes for /api
    //
    // The write endpoints join this same scope rather than registering their
    // own: a second `web::scope("/api")` would match the prefix first and
    // shadow everything here.
    cfg.service(handlers_write::attach_write_routes(
        web::scope("/api")
            .route("/health", web::get().to(health_check))
            .route("/workspaces", web::get().to(list_workspaces))
            .route("/workspaces/{id}", web::get().to(get_workspace))
            .route("/sessions", web::get().to(list_sessions))
            .route("/sessions/search", web::get().to(search_sessions))
            .route("/sessions/{id}", web::get().to(get_session))
            .route("/providers", web::get().to(list_providers))
            .route("/providers/{id}", web::put().to(update_provider))
            .route("/stats", web::get().to(get_stats))
            .route("/stats/overview", web::get().to(get_stats))
            // Agent routes
            .route("/agents", web::get().to(list_agents))
            .route("/agents", web::post().to(create_agent))
            .route("/agents/{id}", web::get().to(get_agent))
            .route("/agents/{id}", web::put().to(update_agent))
            .route("/agents/{id}", web::delete().to(delete_agent))
            // Swarm routes
            .route("/swarms", web::get().to(list_swarms))
            .route("/swarms", web::post().to(create_swarm))
            .route("/swarms/{id}", web::get().to(get_swarm))
            .route("/swarms/{id}", web::delete().to(delete_swarm))
            // Settings routes
            .route("/settings", web::get().to(get_settings))
            .route("/settings", web::put().to(update_settings))
            .route("/settings/accounts", web::get().to(list_accounts))
            .route("/settings/accounts", web::post().to(create_account))
            .route("/settings/accounts/{id}", web::delete().to(delete_account))
            // System routes
            .route("/system/info", web::get().to(get_system_info))
            .route("/system/health", web::get().to(get_system_health))
            .route(
                "/system/providers/health",
                web::get().to(get_provider_health),
            )
            // MCP routes
            .route("/mcp/tools", web::get().to(list_mcp_tools))
            .route("/mcp/call", web::post().to(call_mcp_tool))
            .route("/mcp/batch", web::post().to(call_mcp_tools_batch))
            .route("/mcp/system-prompt", web::get().to(get_csm_system_prompt))
            // SWE routes
            .route("/swe/projects", web::get().to(handlers_swe::list_projects))
            .route(
                "/swe/projects",
                web::post().to(handlers_swe::create_project),
            )
            .route(
                "/swe/projects/{id}",
                web::get().to(handlers_swe::get_project),
            )
            .route(
                "/swe/projects/{id}",
                web::delete().to(handlers_swe::delete_project),
            )
            .route(
                "/swe/projects/{id}/open",
                web::post().to(handlers_swe::open_project),
            )
            .route(
                "/swe/projects/{id}/context",
                web::get().to(handlers_swe::get_context),
            )
            .route(
                "/swe/projects/{id}/execute",
                web::post().to(handlers_swe::execute_tool),
            )
            .route(
                "/swe/projects/{project_id}/memory",
                web::get().to(handlers_swe::list_memory),
            )
            .route(
                "/swe/projects/{project_id}/memory",
                web::post().to(handlers_swe::create_memory),
            )
            .route(
                "/swe/projects/{project_id}/memory/{id}",
                web::get().to(handlers_swe::get_memory),
            )
            .route(
                "/swe/projects/{project_id}/memory/{id}",
                web::put().to(handlers_swe::update_memory),
            )
            .route(
                "/swe/projects/{project_id}/memory/{id}",
                web::delete().to(handlers_swe::delete_memory),
            )
            .route(
                "/swe/projects/{project_id}/rules",
                web::get().to(handlers_swe::list_rules),
            )
            .route(
                "/swe/projects/{project_id}/rules",
                web::post().to(handlers_swe::create_rule),
            )
            .route(
                "/swe/projects/{project_id}/rules/{id}",
                web::put().to(handlers_swe::update_rule),
            )
            .route(
                "/swe/projects/{project_id}/rules/{id}",
                web::delete().to(handlers_swe::delete_rule),
            ),
    ));

    eprintln!("[DEBUG] Added /api routes");
}

/// The audit, retention and SSO services, sharing one enterprise store.
#[cfg(feature = "enterprise")]
#[derive(Clone)]
struct EnterpriseServices {
    audit: web::Data<AuditService>,
    retention: web::Data<RetentionService>,
    sso: web::Data<SsoService>,
    oidc: web::Data<OidcService>,
}

#[cfg(feature = "enterprise")]
impl EnterpriseServices {
    /// Open the store and build the three services over it.
    ///
    /// `base_url` is what the SP advertises to identity providers: it ends up
    /// in the SAML metadata and in the `AssertionConsumerServiceURL` the IdP
    /// posts back to, so it must be the address a *browser* can reach, not
    /// necessarily the one the socket is bound to.
    fn open(db_path: &std::path::Path, base_url: &str) -> Result<Self> {
        let store = SqliteEnterpriseStore::open(db_path)
            .map_err(|e| anyhow::anyhow!("failed to open the enterprise store: {}", e))?;
        let store: audit::Database = std::sync::Arc::new(store);

        let audit = web::Data::new(AuditService::new(store.clone()));
        let retention =
            web::Data::new(RetentionService::new(store.clone()).with_audit(audit.clone()));
        let sso = web::Data::new(SsoService::new(store.clone(), base_url));
        let oidc = web::Data::new(OidcService::new(store));

        Ok(Self {
            audit,
            retention,
            sso,
            oidc,
        })
    }

    /// Register the shared state and the routes together.
    ///
    /// Deliberately one method rather than two: routes registered without
    /// their `app_data` compile perfectly and then answer 500 to every
    /// request, which is exactly the failure this pairing exists to prevent
    /// anyone reintroducing.
    fn configure(&self, cfg: &mut web::ServiceConfig) {
        cfg.app_data(self.audit.clone());
        cfg.app_data(self.retention.clone());
        cfg.app_data(self.sso.clone());
        cfg.app_data(self.oidc.clone());
        configure_audit_routes(cfg);
        configure_retention_routes(cfg);
        configure_sso_routes(cfg);
        configure_oidc_routes(cfg);
    }
}

/// Start the API server
pub async fn start_server(config: ServerConfig) -> Result<()> {
    // Ensure database directory exists
    let db_path = PathBuf::from(&config.database_path);
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Before opening: every handler here reads `sessions.session_json`, which
    // only the harvest schema defines. If this runs on a database that has
    // never been harvested into, `ChatDatabase::open` applies `sql/schema.sql`
    // -- a sessions table with no such column -- and the session endpoints
    // fail on every request. Creating the harvest tables first makes `open`
    // take its harvest-compatible branch and leave them alone.
    if let Err(e) = crate::commands::create_harvest_database(&db_path) {
        eprintln!("[WARN] Failed to ensure harvest schema: {}", e);
    }

    // Open database
    let db = ChatDatabase::open(&db_path)?;

    // Initialize SWE tables
    {
        let conn = rusqlite::Connection::open(&db_path)?;
        if let Err(e) = handlers_swe::init_swe_tables(&conn) {
            eprintln!("[WARN] Failed to initialize SWE tables: {}", e);
        }
    }

    // Initialize Auth tables
    {
        let conn = rusqlite::Connection::open(&db_path)?;
        if let Err(e) = auth::init_auth_tables(&conn) {
            eprintln!("[WARN] Failed to initialize Auth tables: {}", e);
        }
        if let Err(e) = inbox::init_inbox_tables(&conn) {
            eprintln!("[WARN] Failed to initialize Inbox tables: {}", e);
        }
    }

    // Built once and shared by every worker rather than per worker: the store
    // owns a connection to the same file, and one per worker would multiply
    // writers contending for the same SQLite lock to no benefit.
    #[cfg(feature = "enterprise")]
    let enterprise = EnterpriseServices::open(&db_path, &config.resolved_base_url())?;

    let state = web::Data::new(AppState::new(db, db_path));
    let sync_state = web::Data::new(create_sync_state());
    let ws_state = web::Data::new(WebSocketState::new());
    let recording_state = web::Data::new(create_recording_state());
    let webhook_state = web::Data::new(std::sync::Arc::new(WebhookState::new()));
    // Built once and cloned into each worker: the schema is immutable and
    // Clone is cheap, but constructing it per worker would be wasteful.
    let graphql_schema = graphql::create_schema(state.clone().into_inner());
    let cors_origins = config.cors_origins.clone();

    println!("[*] CSM API Server starting...");
    println!("   Address: http://{}:{}", config.host, config.port);
    println!("   Database: {}", config.database_path);
    println!();
    println!("[*] Mobile app endpoints:");
    println!("   GET /api/workspaces     - List workspaces");
    println!("   GET /api/sessions       - List sessions");
    println!("   GET /api/sessions/:id   - Get session details");
    println!("   GET /api/stats          - Database statistics");
    println!();
    println!("[*] SWE Mode endpoints:");
    println!("   GET /api/swe/projects   - List SWE projects");
    println!("   POST /api/swe/projects  - Create SWE project");
    println!();
    println!("[*] Recording endpoints:");
    println!("   POST /recording/events    - Send recording events");
    println!("   POST /recording/snapshot  - Store session snapshot");
    println!("   GET /recording/sessions   - List active sessions");
    println!("   GET /recording/status     - Recording status");
    println!("   GET /recording/ws         - WebSocket for real-time recording");
    println!();
    println!("[*] Sync endpoints:");
    println!("   GET /sync/version       - Get current sync version");
    println!("   GET /sync/delta?from=N  - Get changes since version N");
    println!("   POST /sync/event        - Push a sync event");
    println!("   GET /sync/snapshot      - Get full data snapshot");
    println!("   GET /sync/subscribe     - SSE stream for real-time updates");
    println!("   GET /ws                 - WebSocket for bidirectional updates");
    println!();
    println!("Press Ctrl+C to stop the server...");
    println!();

    eprintln!("[DEBUG] Creating HttpServer...");
    let server = HttpServer::new(move || {
        let origins = cors_origins.clone();
        let cors = Cors::default()
            .allowed_origin_fn(move |origin, _req_head| {
                let origin_str = origin.to_str().unwrap_or("");
                origins.iter().any(|allowed| allowed == origin_str)
                    || origin_str.starts_with("http://localhost:")
                    || origin_str.starts_with("http://127.0.0.1:")
                    || origin_str.starts_with("exp://")
            })
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
            .allowed_headers(vec!["Content-Type", "Authorization", "Accept"])
            .supports_credentials()
            .max_age(3600);

        App::new()
            .app_data(state.clone())
            .app_data(sync_state.clone())
            .app_data(ws_state.clone())
            .app_data(recording_state.clone())
            .wrap(cors)
            .wrap(middleware::Logger::default())
            // Ahead of `configure_routes`, whose broad `/api` scope would
            // otherwise match `/api/inbox/...` first and return 404 -- actix
            // resolves scopes in registration order, not by specificity.
            .configure(configure_inbox_routes)
            // Same reason as the inbox above: registered before the broad
            // `/api` scope, which would otherwise match `/api/documents/...`
            // first and answer 404.
            .configure(configure_document_routes)
            .configure(configure_dataset_routes)
            .configure(configure_routes)
            .configure(configure_sync_routes)
            .configure(configure_auth_routes)
            .configure(configure_recording_routes)
            .configure(configure_docs_routes)
            .configure(|cfg| configure_websocket_routes(cfg, ws_state.clone()))
            .configure(|cfg| configure_webhook_routes(cfg, webhook_state.clone()))
            .configure(|cfg| configure_graphql_routes(cfg, graphql_schema.clone()))
            // The enterprise scopes were compiled under `--features
            // enterprise` but never registered here, so /audit, /retention
            // and /sso answered 404 on every build that supposedly had them.
            // The handlers, their tests and their documentation all existed;
            // only the lines that serve them did not.
            .configure({
                #[cfg(feature = "enterprise")]
                let enterprise = enterprise.clone();
                move |cfg: &mut web::ServiceConfig| {
                    #[cfg(feature = "enterprise")]
                    enterprise.configure(cfg);
                    #[cfg(not(feature = "enterprise"))]
                    let _ = cfg;
                }
            })
    });

    eprintln!("[DEBUG] Binding to {}:{}...", config.host, config.port);
    let server = server.bind((config.host.as_str(), config.port))?;

    eprintln!("[DEBUG] Starting server...");
    server.run().await?;

    eprintln!("[DEBUG] Server stopped.");
    Ok(())
}

#[cfg(test)]
mod base_url_tests {
    use super::ServerConfig;

    fn config(host: &str, public: Option<&str>) -> ServerConfig {
        ServerConfig {
            host: host.to_string(),
            port: 8787,
            public_base_url: public.map(str::to_string),
            ..Default::default()
        }
    }

    /// The bind address is not an address anyone can reach. Advertising it in
    /// SAML metadata sends the identity provider's redirect nowhere, so a
    /// wildcard bind must never survive into the base URL.
    #[test]
    fn a_wildcard_bind_never_reaches_the_advertised_url() {
        for wildcard in ["0.0.0.0", "::", "[::]", ""] {
            let url = config(wildcard, None).resolved_base_url();
            assert_eq!(
                url, "http://127.0.0.1:8787",
                "wildcard bind {wildcard:?} leaked into {url}"
            );
        }
    }

    #[test]
    fn a_real_bind_host_is_kept() {
        assert_eq!(
            config("192.168.1.10", None).resolved_base_url(),
            "http://192.168.1.10:8787"
        );
    }

    /// The explicit setting wins over the bind address -- the deployment case,
    /// where the server sits behind a proxy on a different name and scheme.
    #[test]
    fn an_explicit_public_url_overrides_the_bind_address() {
        assert_eq!(
            config("0.0.0.0", Some("https://chasm.example.com")).resolved_base_url(),
            "https://chasm.example.com"
        );
    }

    /// A trailing slash would produce `https://host//api/sso/callback`, which
    /// some identity providers compare literally against their configuration.
    #[test]
    fn a_trailing_slash_is_trimmed() {
        assert_eq!(
            config("0.0.0.0", Some("https://chasm.example.com/")).resolved_base_url(),
            "https://chasm.example.com"
        );
    }
}
