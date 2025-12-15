//! Application state for the API server

use std::sync::Arc;
use tokio::sync::RwLock;

use crate::database::ChatDatabase;

/// Shared application state
pub struct AppState {
    pub db: Arc<RwLock<ChatDatabase>>,
}

impl AppState {
    pub fn new(db: Arc<RwLock<ChatDatabase>>) -> Self {
        Self { db }
    }
}
