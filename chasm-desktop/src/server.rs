// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
//! Embedded API server.
//!
//! The desktop app loads `chasm-web`, which talks to the Chasm REST API. On
//! its own that meant launching the app gave you a UI pointed at a server
//! nobody had started -- every panel rendered an error until the user knew to
//! run `chasm api serve` in a terminal. The window was real; the application
//! was not.
//!
//! This runs the same server in-process on a background thread, so the app is
//! self-contained. If a server is already listening -- because the user runs
//! one themselves, or a second window is open -- it is adopted rather than
//! duplicated: two processes writing the same SQLite file is worse than
//! sharing one.

use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

/// Where the embedded server listens.
///
/// Deliberately not 8787, the CLI's default: a developer running
/// `chasm api serve` alongside the app should not have the desktop app
/// silently adopt or collide with it unless they point it there.
const DEFAULT_PORT: u16 = 8788;

/// Loopback only. The CLI binds 0.0.0.0 because serving a network is
/// sometimes the point; a desktop app exposing the user's entire chat history
/// to their local network is never the point.
const HOST: &str = "127.0.0.1";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ServerMode {
    /// Started by this process.
    Embedded,
    /// Already running when we looked; we are sharing it.
    Adopted,
    /// Not running and could not be started.
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerStatus {
    pub running: bool,
    pub mode: ServerMode,
    pub url: String,
    pub port: u16,
    /// Populated when `mode` is `Failed`, so the UI can say why rather than
    /// showing an unexplained disconnected state.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

fn state() -> &'static Mutex<Option<ServerStatus>> {
    static STATE: OnceLock<Mutex<Option<ServerStatus>>> = OnceLock::new();
    STATE.get_or_init(|| Mutex::new(None))
}

pub fn api_url(port: u16) -> String {
    format!("http://{}:{}", HOST, port)
}

/// Whether something is already answering on `port`.
///
/// Checks the health endpoint rather than just opening a socket: another
/// application holding the port is not a Chasm API, and adopting it would
/// point the whole UI at a stranger.
async fn existing_server(port: u16) -> bool {
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_millis(1500))
        .build()
    {
        Ok(c) => c,
        Err(_) => return false,
    };
    matches!(
        client.get(format!("{}/api/health", api_url(port))).send().await,
        Ok(r) if r.status().is_success()
    )
}

/// Start the API server unless one is already running.
///
/// Returns once the server is reachable, or with `Failed` if it never came
/// up. Blocking here is deliberate: the UI loads immediately afterwards and
/// would otherwise race the backend and render errors on first paint.
pub async fn ensure_running(port: u16) -> ServerStatus {
    if existing_server(port).await {
        let status = ServerStatus {
            running: true,
            mode: ServerMode::Adopted,
            url: api_url(port),
            port,
            error: None,
        };
        *state().lock().unwrap() = Some(status.clone());
        return status;
    }

    let config = chasm::api::ServerConfig {
        host: HOST.to_string(),
        port,
        ..Default::default()
    };

    // The server owns its thread and runtime for the life of the process.
    // There is no stop command: the only reason to stop it is quitting, and
    // process exit does that more reliably than a shutdown handshake.
    std::thread::Builder::new()
        .name("chasm-api".to_string())
        .spawn(move || {
            let runtime = match tokio::runtime::Builder::new_multi_thread()
                .enable_all()
                .build()
            {
                Ok(rt) => rt,
                Err(e) => {
                    eprintln!("[ERROR] could not build API runtime: {}", e);
                    return;
                }
            };
            if let Err(e) = runtime.block_on(chasm::api::start_server(config)) {
                eprintln!("[ERROR] API server stopped: {}", e);
            }
        })
        .ok();

    let status = match wait_until_healthy(port).await {
        true => ServerStatus {
            running: true,
            mode: ServerMode::Embedded,
            url: api_url(port),
            port,
            error: None,
        },
        false => ServerStatus {
            running: false,
            mode: ServerMode::Failed,
            url: api_url(port),
            port,
            error: Some(format!(
                "the API server did not become reachable on port {}",
                port
            )),
        },
    };
    *state().lock().unwrap() = Some(status.clone());
    status
}

/// Poll the health endpoint until it answers or the budget runs out.
///
/// Opening the database and building the schema takes a moment on first run,
/// so a single immediate check would report failure on a server that is
/// merely still starting.
async fn wait_until_healthy(port: u16) -> bool {
    for _ in 0..40 {
        if existing_server(port).await {
            return true;
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }
    false
}

pub fn default_port() -> u16 {
    DEFAULT_PORT
}

/// The last known status, or a not-yet-started placeholder.
pub fn current_status() -> ServerStatus {
    state().lock().unwrap().clone().unwrap_or(ServerStatus {
        running: false,
        mode: ServerMode::Failed,
        url: api_url(DEFAULT_PORT),
        port: DEFAULT_PORT,
        error: Some("the API server has not been started yet".to_string()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_url_is_loopback_not_a_wildcard_bind() {
        // Binding 0.0.0.0 would publish the user's chat history to their LAN.
        assert!(api_url(8788).starts_with("http://127.0.0.1:"));
        assert_eq!(HOST, "127.0.0.1");
    }

    #[test]
    fn the_default_port_avoids_the_cli_default() {
        // 8787 is what `chasm api serve` uses; colliding by default would
        // make the two fight over the same database.
        assert_ne!(DEFAULT_PORT, 8787);
    }

    #[test]
    fn status_before_startup_explains_itself() {
        let status = current_status();
        if !status.running {
            assert!(status.error.is_some(), "a stopped server must say why");
        }
    }

    #[tokio::test]
    async fn a_dead_port_is_not_mistaken_for_a_server() {
        // Port 1 refuses immediately.
        assert!(!existing_server(1).await);
    }

    /// Starts the real API server against the real database, so it is not
    /// part of the default run: it binds a fixed port and would be flaky
    /// under parallel CI. Run explicitly with
    /// `cargo test -- --ignored embedded_server_actually_serves`.
    #[tokio::test]
    #[ignore]
    async fn embedded_server_actually_serves() {
        let port = 8799;
        let status = ensure_running(port).await;
        assert!(status.running, "server did not start: {:?}", status.error);
        assert_eq!(status.mode, ServerMode::Embedded);

        // Prove it is really serving Chasm, not merely holding the port.
        let body = reqwest::get(format!("{}/api/health", api_url(port)))
            .await
            .unwrap()
            .text()
            .await
            .unwrap();
        // `/api/health` answers {"status":"ok","version":"..."}.
        assert!(
            body.contains("\"status\":\"ok\""),
            "unexpected health body: {}",
            body
        );

        // A second call adopts rather than starting a duplicate, which is
        // what stops two writers fighting over one SQLite file.
        assert_eq!(ensure_running(port).await.mode, ServerMode::Adopted);
    }

    #[tokio::test]
    async fn a_non_chasm_listener_is_not_adopted() {
        // Something holding the port that is not a Chasm API must not be
        // adopted -- the UI would be pointed at a stranger.
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        tokio::spawn(async move {
            while let Ok((mut socket, _)) = listener.accept().await {
                use tokio::io::AsyncWriteExt;
                let _ = socket
                    .write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n")
                    .await;
            }
        });
        assert!(!existing_server(port).await);
    }
}
