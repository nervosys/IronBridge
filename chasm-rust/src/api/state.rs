// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
//! Application state for the API server

use std::path::PathBuf;
use std::sync::Mutex;

use crate::database::ChatDatabase;

/// Shared application state
pub struct AppState {
    pub db: Mutex<ChatDatabase>,
    /// Used by `POST /api/harvest` so the harvest writes into the database
    /// this server opened rather than the CLI's default path.
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
