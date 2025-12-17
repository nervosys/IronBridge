//! HTTP API Server for Chat System Manager
//!
//! Provides a REST API for the web frontend and mobile app to interact with CSM.
//! Uses Actix-web for the HTTP server.

mod handlers_simple;
mod state;

pub use state::AppState;

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
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "0.0.0.0".to_string(),  // Bind to all interfaces
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
        }
    }
}

/// Configure API routes
fn configure_routes(cfg: &mut web::ServiceConfig) {
    use handlers_simple::*;
    
    cfg.service(
        web::scope("/api")
            .route("/health", web::get().to(health_check))
            // Workspaces
            .route("/workspaces", web::get().to(list_workspaces))
            .route("/workspaces/{id}", web::get().to(get_workspace))
            // Sessions
            .route("/sessions", web::get().to(list_sessions))
            .route("/sessions/search", web::get().to(search_sessions))
            .route("/sessions/{id}", web::get().to(get_session))
            // Providers
            .route("/providers", web::get().to(list_providers))
            // Stats
            .route("/stats", web::get().to(get_stats))
            // MCP Tools (for introspective chat)
            .route("/mcp/tools", web::get().to(list_mcp_tools))
            .route("/mcp/call", web::post().to(call_mcp_tool))
            .route("/mcp/batch", web::post().to(call_mcp_tools_batch))
            .route("/mcp/system-prompt", web::get().to(get_csm_system_prompt))
    );
}

/// Start the API server
pub async fn start_server(config: ServerConfig) -> Result<()> {
    // Ensure database directory exists
    let db_path = PathBuf::from(&config.database_path);
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Open database
    let db = ChatDatabase::open(&db_path)?;
    let state = web::Data::new(AppState::new(db, db_path));
    let cors_origins = config.cors_origins.clone();

    println!("🚀 CSM API Server starting...");
    println!("   Address: http://{}:{}", config.host, config.port);
    println!("   Database: {}", config.database_path);
    println!();
    println!("📱 Mobile app endpoints:");
    println!("   GET /api/workspaces     - List workspaces");
    println!("   GET /api/sessions       - List sessions");
    println!("   GET /api/sessions/:id   - Get session details");
    println!("   GET /api/stats          - Database statistics");
    println!();
    println!("Press Ctrl+C to stop the server...");
    println!();

    HttpServer::new(move || {
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
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .configure(configure_routes)
    })
    .bind((config.host.as_str(), config.port))?
    .run()
    .await?;

    Ok(())
}
