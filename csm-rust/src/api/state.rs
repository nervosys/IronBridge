//! Application state for the API server

use std::sync::Mutex;
use std::path::PathBuf;

use crate::database::ChatDatabase;

/// Shared application state
pub struct AppState {
    pub db: Mutex<ChatDatabase>,
    #[allow(dead_code)] // Reserved for future use (e.g., reopening database)
    pub db_path: PathBuf,
}

impl AppState {
    pub fn new(db: ChatDatabase, db_path: PathBuf) -> Self {
        Self { 
            db: Mutex::new(db),
            db_path,
        }
    }
}
