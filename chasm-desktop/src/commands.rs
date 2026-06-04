// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Chasm Desktop - Tauri Commands
// Copyright 2025 Nervosys LLC

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};

#[derive(Debug, Serialize, Deserialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub tauri_version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiHealth {
    pub healthy: bool,
    pub message: String,
    pub api_url: String,
}

/// Get application info
#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        name: "Chasm".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        tauri_version: tauri::VERSION.to_string(),
    }
}

/// Get current platform
#[tauri::command]
pub fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

/// Open developer tools (debug only)
#[tauri::command]
pub fn open_devtools<R: Runtime>(#[allow(unused_variables)] app: AppHandle<R>) {
    #[cfg(debug_assertions)]
    if let Some(window) = app.get_webview_window("main") {
        window.open_devtools();
    }
}

/// Minimize window to system tray
#[tauri::command]
pub fn minimize_to_tray<R: Runtime>(app: AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

/// Check if the chasm API is healthy
#[tauri::command]
pub async fn check_api_health(api_url: String) -> ApiHealth {
    let health_url = format!("{}/health", api_url);

    match reqwest::get(&health_url).await {
        Ok(response) => {
            if response.status().is_success() {
                ApiHealth {
                    healthy: true,
                    message: "API is healthy".to_string(),
                    api_url,
                }
            } else {
                ApiHealth {
                    healthy: false,
                    message: format!("API returned status: {}", response.status()),
                    api_url,
                }
            }
        }
        Err(e) => ApiHealth {
            healthy: false,
            message: format!("Failed to connect: {}", e),
            api_url,
        },
    }
}
