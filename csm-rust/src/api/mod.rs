//! HTTP API Server for Chat System Manager
//!
//! Provides a REST API for the web frontend to interact with CSM.
//! Uses Actix-web for the HTTP server.

mod handlers;
mod routes;
mod state;

pub use routes::configure_routes;
pub use state::AppState;

use actix_cors::Cors;
use actix_web::{middleware, web, App, HttpServer};
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::RwLock;

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
            host: "127.0.0.1".to_string(),
            port: 8787,
            database_path: dirs::data_local_dir()
                .map(|p| p.join("csm").join("csm.db").to_string_lossy().to_string())
                .unwrap_or_else(|| "csm.db".to_string()),
            cors_origins: vec![
                "http://localhost:5173".to_string(),
                "http://localhost:3000".to_string(),
                "http://127.0.0.1:5173".to_string(),
                "http://127.0.0.1:3000".to_string(),
            ],
        }
    }
}

/// Start the API server
pub async fn start_server(config: ServerConfig) -> Result<()> {
    // Ensure database directory exists
    if let Some(parent) = std::path::Path::new(&config.database_path).parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Open database
    let db = ChatDatabase::open(std::path::Path::new(&config.database_path))?;
    let db = Arc::new(RwLock::new(db));

    let state = web::Data::new(AppState::new(db));
    let cors_origins = config.cors_origins.clone();

    println!("🚀 CSM API Server starting...");
    println!("   Address: http://{}:{}", config.host, config.port);
    println!("   Database: {}", config.database_path);
    println!("   CORS origins: {:?}", cors_origins);

    HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin_fn(move |origin, _req_head| {
                let origin_str = origin.to_str().unwrap_or("");
                cors_origins.iter().any(|allowed| allowed == origin_str)
                    || origin_str.starts_with("http://localhost:")
                    || origin_str.starts_with("http://127.0.0.1:")
            })
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
            .allowed_headers(vec!["Content-Type", "Authorization", "Accept"])
            .supports_credentials()
            .max_age(3600);

        App::new()
            .app_data(state.clone())
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .wrap(middleware::Compress::default())
            .configure(configure_routes)
    })
    .bind((config.host.as_str(), config.port))?
    .run()
    .await?;

    Ok(())
}
