// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
//! LLM Provider integrations for Chat System Manager
//!
//! Supports multiple chat providers:
//!
//! ## Local Providers
//! - VS Code Copilot Chat (default)
//! - Cursor
//! - Ollama
//! - vLLM
//! - Azure AI Foundry (Foundry Local)
//! - OpenAI API compatible servers
//! - LM Studio
//! - LocalAI
//!
//! ## Cloud Providers (conversation history import)
//! - ChatGPT (OpenAI)
//! - Claude (Anthropic)
//! - Perplexity
//! - DeepSeek
//! - Gemini (Google)
//! - Qwen (Alibaba)
//! - Mistral
//! - Cohere
//! - Groq
//! - Together AI

#[allow(dead_code)]
pub mod cloud;
pub mod config;
pub mod continuedev;
pub mod cursor;
#[allow(dead_code)]
pub mod discovery;
pub mod ollama;
pub mod openai_compat;
#[allow(dead_code)]
pub mod session_format;

#[allow(unused_imports)]
pub use cloud::{CloudConversation, CloudMessage, CloudProvider, FetchOptions};
pub use config::ProviderType;
#[allow(unused_imports)]
pub use config::{IronBridgeConfig, ProviderConfig};
#[allow(unused_imports)]
pub use discovery::discover_all_providers;
#[allow(unused_imports)]
pub use session_format::{GenericMessage, GenericSession};

use crate::models::ChatSession;
use anyhow::Result;
use std::path::PathBuf;

/// How long to wait for a local server to accept a connection.
///
/// Loopback is not always as fast as it sounds: measured on Windows, a
/// connection to a *closed* local port takes about two seconds to be refused,
/// so this timeout is what bounds the cost rather than a rare pathological
/// case. 250ms is far more than a listening socket on the same machine needs.
const PROBE_TIMEOUT: std::time::Duration = std::time::Duration::from_millis(250);

/// Probe results for this process, keyed by endpoint.
///
/// Two things make this worth having. `localhost` resolves to both `::1` and
/// `127.0.0.1`, so a negative answer costs two timeouts; and several providers
/// share an endpoint (LocalAI and Llamafile both default to 8080), so the same
/// address would otherwise be probed twice.
///
/// The cache lives for the process. For the CLI that is a single command, and
/// a consistent view across one run is what a user expects -- a provider that
/// starts halfway through `ironbridge provider list` should not appear in some rows
/// and not others.
fn probe_cache() -> &'static std::sync::Mutex<std::collections::HashMap<String, bool>> {
    static CACHE: std::sync::OnceLock<std::sync::Mutex<std::collections::HashMap<String, bool>>> =
        std::sync::OnceLock::new();
    CACHE.get_or_init(Default::default)
}

/// Split `http://host:port/path` into a host and port.
///
/// Deliberately small: these endpoints come from defaults and environment
/// variables, not user-facing input, and pulling in a URL parser to read two
/// fields off a loopback address is not a trade worth making.
fn host_and_port(endpoint: &str) -> Option<(String, u16)> {
    let rest = endpoint
        .trim()
        .strip_prefix("http://")
        .map(|r| (r, 80u16))
        .or_else(|| {
            endpoint
                .trim()
                .strip_prefix("https://")
                .map(|r| (r, 443u16))
        });

    let (rest, default_port) = rest?;
    let authority = rest.split(['/', '?', '#']).next()?;
    if authority.is_empty() {
        return None;
    }

    // Strip any userinfo, and ignore IPv6 literals -- none of the providers
    // here default to one, and guessing at bracket syntax would be worse than
    // declining to probe.
    let authority = authority.rsplit('@').next()?;
    if authority.starts_with('[') {
        return None;
    }

    match authority.split_once(':') {
        Some((host, port)) => Some((host.to_string(), port.parse().ok()?)),
        None => Some((authority.to_string(), default_port)),
    }
}

/// Whether something is listening at `endpoint`.
///
/// # What this proves, and what it does not
///
/// It opens a TCP connection and closes it. That shows a process accepted a
/// connection at that address; it does not show the process speaks the API we
/// expect, nor that it is the provider we think it is. Two providers sharing a
/// default port -- LocalAI and Llamafile both use 8080 -- will both report
/// available when either is running.
///
/// That is still worth doing, because the alternative it replaces was
/// `!endpoint.is_empty()`, which reported every provider available on every
/// machine whether or not anything was installed.
///
/// A TCP probe rather than an HTTP request on purpose: this runs inside
/// `ProviderRegistry::new`, which is synchronous and reachable from both async
/// and blocking callers. `reqwest::blocking` panics when it finds itself on a
/// Tokio worker, and a liveness check is not worth that risk.
pub fn endpoint_is_listening(endpoint: &str) -> bool {
    if let Ok(cache) = probe_cache().lock() {
        if let Some(&known) = cache.get(endpoint) {
            return known;
        }
    }

    let listening = probe_endpoint(endpoint);

    if let Ok(mut cache) = probe_cache().lock() {
        cache.insert(endpoint.to_string(), listening);
    }
    listening
}

/// The uncached probe. Separated so tests can exercise it without the cache
/// answering for them.
fn probe_endpoint(endpoint: &str) -> bool {
    use std::net::{TcpStream, ToSocketAddrs};

    let Some((host, port)) = host_and_port(endpoint) else {
        return false;
    };

    let Ok(addrs) = (host.as_str(), port).to_socket_addrs() else {
        return false;
    };

    addrs.into_iter().any(|addr| {
        TcpStream::connect_timeout(&addr, PROBE_TIMEOUT)
            .map(|stream| {
                let _ = stream.shutdown(std::net::Shutdown::Both);
            })
            .is_ok()
    })
}

/// Trait for LLM chat providers
pub trait ChatProvider: Send + Sync {
    /// Get the provider type
    fn provider_type(&self) -> ProviderType;

    /// Get the provider name for display
    fn name(&self) -> &str;

    /// Check if this provider is available/configured
    fn is_available(&self) -> bool;

    /// Get the base path where sessions are stored
    fn sessions_path(&self) -> Option<PathBuf>;

    /// List all chat sessions from this provider
    fn list_sessions(&self) -> Result<Vec<ChatSession>>;

    /// Import a session from this provider into IRONBRIDGE format
    fn import_session(&self, session_id: &str) -> Result<ChatSession>;

    /// Export a IRONBRIDGE session to this provider's format
    #[allow(dead_code)]
    fn export_session(&self, session: &ChatSession) -> Result<()>;
}

/// Registry of available providers
pub struct ProviderRegistry {
    providers: Vec<Box<dyn ChatProvider>>,
}

impl ProviderRegistry {
    /// Create a new provider registry with auto-discovered providers
    pub fn new() -> Self {
        let mut registry = Self {
            providers: Vec::new(),
        };
        registry.discover_providers();
        registry
    }

    /// Discover and register available providers
    fn discover_providers(&mut self) {
        // Add Cursor provider
        if let Some(provider) = cursor::CursorProvider::discover() {
            self.providers.push(Box::new(provider));
        }

        // Add Ollama provider
        if let Some(provider) = ollama::OllamaProvider::discover() {
            self.providers.push(Box::new(provider));
        }

        // Add OpenAI-compatible providers (vLLM, LM Studio, LocalAI, etc.)
        for provider in openai_compat::discover_openai_compatible_providers() {
            self.providers.push(Box::new(provider));
        }
    }

    /// Get all registered providers
    pub fn providers(&self) -> &[Box<dyn ChatProvider>] {
        &self.providers
    }

    /// Get available (configured and working) providers
    pub fn available_providers(&self) -> Vec<&dyn ChatProvider> {
        self.providers
            .iter()
            .filter(|p| p.is_available())
            .map(|p| p.as_ref())
            .collect()
    }

    /// Get a provider by type
    pub fn get_provider(&self, provider_type: ProviderType) -> Option<&dyn ChatProvider> {
        self.providers
            .iter()
            .find(|p| p.provider_type() == provider_type)
            .map(|p| p.as_ref())
    }

    /// List all sessions from all providers
    #[allow(dead_code)]
    pub fn list_all_sessions(&self) -> Result<Vec<(ProviderType, ChatSession)>> {
        let mut all_sessions = Vec::new();

        for provider in &self.providers {
            if provider.is_available() {
                if let Ok(sessions) = provider.list_sessions() {
                    for session in sessions {
                        all_sessions.push((provider.provider_type(), session));
                    }
                }
            }
        }

        Ok(all_sessions)
    }
}

impl Default for ProviderRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod probe_tests {
    use super::*;
    use std::net::TcpListener;

    #[test]
    fn a_listening_port_is_detected() {
        // Bound to an ephemeral port so the test cannot collide with a real
        // service, and so it proves detection rather than assuming it.
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();

        assert!(endpoint_is_listening(&format!("http://127.0.0.1:{port}")));
        assert!(endpoint_is_listening(&format!(
            "http://127.0.0.1:{port}/v1"
        )));
    }

    #[test]
    fn a_closed_port_is_not() {
        // Bind then drop: the port was valid a moment ago and is now closed,
        // which is exactly the state a stopped provider leaves behind.
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        drop(listener);

        assert!(!endpoint_is_listening(&format!("http://127.0.0.1:{port}")));
    }

    #[test]
    fn the_old_behaviour_would_have_passed_both() {
        // The check this replaced was `!endpoint.is_empty()`. Keeping the
        // comparison in the suite makes the regression concrete: any future
        // rewrite that reverts to a string test fails the two tests above.
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        drop(listener);

        let dead = format!("http://127.0.0.1:{port}");
        assert!(!dead.is_empty(), "the old check called this available");
        assert!(!endpoint_is_listening(&dead), "the new one does not");
    }

    #[test]
    fn a_malformed_endpoint_is_not_listening() {
        for endpoint in [
            "",
            "localhost:11434", // no scheme
            "ftp://localhost:21",
            "http://",
            "http://host:notaport",
            "http://[::1]:8080", // IPv6 literal: declined rather than guessed
        ] {
            assert!(
                !endpoint_is_listening(endpoint),
                "{endpoint:?} should not report as listening"
            );
        }
    }

    #[test]
    fn host_and_port_reads_the_shapes_these_providers_use() {
        assert_eq!(
            host_and_port("http://localhost:8000/v1"),
            Some(("localhost".to_string(), 8000))
        );
        assert_eq!(
            host_and_port("http://localhost"),
            Some(("localhost".to_string(), 80))
        );
        assert_eq!(
            host_and_port("https://api.example.com/v1"),
            Some(("api.example.com".to_string(), 443))
        );
        assert_eq!(
            host_and_port("http://user:pw@localhost:1234"),
            Some(("localhost".to_string(), 1234))
        );
        assert_eq!(host_and_port("not a url"), None);
    }
}
