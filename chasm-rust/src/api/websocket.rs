// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
//! WebSocket Handler for bidirectional real-time communication
//!
//! This module provides WebSocket-based communication for scenarios requiring
//! bidirectional messaging, such as live chat streaming, agent control, and
//! collaborative editing.
//!
//! Note: For simpler use cases, the SSE-based sync (in sync.rs) may be preferred
//! as it has better HTTP/2 compatibility and doesn't require connection upgrades.

use actix_web::{web, Error, HttpRequest, HttpResponse};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::RwLock;
use std::time::{Duration, Instant};
use tokio::sync::broadcast;
use uuid::Uuid;

// =============================================================================
// WebSocket Configuration
// =============================================================================

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(30);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(60);

// =============================================================================
// WebSocket Message Types
// =============================================================================

/// Messages sent from client to server
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsClientMessage {
    /// Subscribe to a channel
    Subscribe { channel: String },
    /// Unsubscribe from a channel
    Unsubscribe { channel: String },

    /// Start streaming response for a session
    StreamStart { session_id: String, model: String },
    /// Cancel streaming for a session
    StreamCancel { session_id: String },
    /// Send input during streaming
    StreamInput { session_id: String, content: String },

    /// Send command to an agent
    AgentCommand {
        agent_id: String,
        command: String,
        params: Option<serde_json::Value>,
    },

    /// Request sync delta from version
    SyncRequest { from_version: u64 },

    /// Ping message for keepalive
    Ping { timestamp: i64 },
}

/// Messages sent from server to client
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsServerMessage {
    /// Connection established
    Connected { client_id: String, version: u64 },
    /// Error occurred
    Error { code: String, message: String },

    /// Successfully subscribed to channel
    Subscribed { channel: String },
    /// Successfully unsubscribed from channel
    Unsubscribed { channel: String },

    /// Streaming token received
    StreamToken { session_id: String, token: String },
    /// Streaming completed
    StreamComplete {
        session_id: String,
        message_id: String,
    },
    /// Streaming error occurred
    StreamError { session_id: String, error: String },

    /// Agent event received
    AgentEvent {
        agent_id: String,
        event: String,
        data: Option<serde_json::Value>,
    },

    /// Sync event for real-time updates
    SyncEvent {
        entity_type: String,
        entity_id: String,
        operation: String,
        data: Option<serde_json::Value>,
        version: u64,
    },

    /// Pong response to ping
    Pong { timestamp: i64 },
}

// =============================================================================
// WebSocket State Management
// =============================================================================

/// Information about a connected client
#[derive(Debug, Clone)]
pub struct ClientInfo {
    pub id: String,
    pub connected_at: Instant,
    pub last_heartbeat: Instant,
    pub subscriptions: Vec<String>,
}

/// Global WebSocket state shared across connections
pub struct WebSocketState {
    /// Broadcast channel for server-wide messages
    pub broadcast_tx: broadcast::Sender<WsServerMessage>,
    /// Per-channel broadcast senders
    pub channel_senders: RwLock<HashMap<String, broadcast::Sender<WsServerMessage>>>,
    /// Connected clients info
    pub clients: RwLock<HashMap<String, ClientInfo>>,
    /// Current sync version
    pub version: std::sync::atomic::AtomicU64,
}

impl WebSocketState {
    pub fn new() -> Self {
        let (broadcast_tx, _) = broadcast::channel(1024);
        Self {
            broadcast_tx,
            channel_senders: RwLock::new(HashMap::new()),
            clients: RwLock::new(HashMap::new()),
            version: std::sync::atomic::AtomicU64::new(1),
        }
    }

    /// Get or create a channel sender
    pub fn get_channel_sender(&self, channel: &str) -> broadcast::Sender<WsServerMessage> {
        {
            let channels = self.channel_senders.read().unwrap();
            if let Some(sender) = channels.get(channel) {
                return sender.clone();
            }
        }

        let mut channels = self.channel_senders.write().unwrap();
        let entry = channels
            .entry(channel.to_string())
            .or_insert_with(|| broadcast::channel(256).0);
        entry.clone()
    }

    /// Broadcast to all clients
    pub fn broadcast(&self, msg: WsServerMessage) {
        let _ = self.broadcast_tx.send(msg);
    }

    /// Broadcast to a specific channel
    pub fn broadcast_to_channel(&self, channel: &str, msg: WsServerMessage) {
        let channels = self.channel_senders.read().unwrap();
        if let Some(sender) = channels.get(channel) {
            let _ = sender.send(msg);
        }
    }

    /// Increment version and return new value
    pub fn increment_version(&self) -> u64 {
        self.version
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed)
            + 1
    }

    /// Get current version
    pub fn current_version(&self) -> u64 {
        self.version.load(std::sync::atomic::Ordering::Relaxed)
    }

    /// Register a new client
    pub fn register_client(&self, id: &str) {
        let mut clients = self.clients.write().unwrap();
        clients.insert(
            id.to_string(),
            ClientInfo {
                id: id.to_string(),
                connected_at: Instant::now(),
                last_heartbeat: Instant::now(),
                subscriptions: Vec::new(),
            },
        );
    }

    /// Unregister a client
    pub fn unregister_client(&self, id: &str) {
        let mut clients = self.clients.write().unwrap();
        clients.remove(id);
    }

    /// Get client count
    pub fn client_count(&self) -> usize {
        self.clients.read().unwrap().len()
    }
}

impl Default for WebSocketState {
    fn default() -> Self {
        Self::new()
    }
}

// =============================================================================
// WebSocket Handler
// =============================================================================

/// The code returned for a message this server understands but will not act on.
///
/// Distinct from `invalid_message`, which means the frame did not parse. A
/// client seeing `unsupported` sent something well-formed; retrying it will not
/// help, and it should stop waiting.
const UNSUPPORTED: &str = "unsupported";

/// Turn a `sync::SyncEvent` into its WebSocket form.
///
/// The two structs carry the same information in different shapes -- `sync.rs`
/// uses typed enums, the wire protocol here uses strings. Serialising the enum
/// and taking the string keeps the two spellings in step: if a variant is
/// renamed, both sides move together rather than drifting apart.
fn to_ws_sync_event(event: &crate::api::sync::SyncEvent) -> WsServerMessage {
    fn as_str(value: &impl Serialize) -> String {
        serde_json::to_value(value)
            .ok()
            .and_then(|v| v.as_str().map(str::to_string))
            .unwrap_or_else(|| "unknown".to_string())
    }

    WsServerMessage::SyncEvent {
        entity_type: as_str(&event.entity_type),
        entity_id: event.entity_id.clone(),
        operation: as_str(&event.operation),
        data: event.data.clone(),
        version: event.version,
    }
}

/// Answer a `sync_request` from the event history in [`crate::api::sync`].
///
/// This is the same delta `GET /sync/delta?from=N` returns, pushed over the
/// socket instead. Two cases are errors rather than an empty result, because
/// silently sending nothing would leave the client believing it is current when
/// it is not:
///
/// * **The history no longer reaches back that far.** `SyncState` trims to
///   `max_history` events, so a client that has been away long enough asks for
///   a version that has been discarded. The events between are gone; only a
///   full snapshot can recover, and the client has to be told that.
/// * **The client is ahead of the server.** That means the server's history was
///   reset underneath it. An empty delta would read as "nothing changed" when
///   in truth everything did.
fn handle_sync_request(
    from_version: u64,
    sync: Option<&crate::api::sync::SharedSyncState>,
) -> Vec<WsServerMessage> {
    let Some(sync) = sync else {
        return vec![WsServerMessage::Error {
            code: "sync_unavailable".to_string(),
            message: "this server was started without sync state".to_string(),
        }];
    };

    let Ok(state) = sync.read() else {
        return vec![WsServerMessage::Error {
            code: "sync_unavailable".to_string(),
            message: "sync state is poisoned".to_string(),
        }];
    };

    if from_version > state.version {
        return vec![WsServerMessage::Error {
            code: "version_ahead".to_string(),
            message: format!(
                "client is at version {from_version} but the server is at {}; \
                 the server history was reset -- request a full snapshot",
                state.version
            ),
        }];
    }

    // Versions are contiguous: `add_event` increments by one and pushes every
    // event, so the first retained version tells us exactly what was trimmed.
    if let Some(oldest) = state.events.first().map(|e| e.version) {
        if from_version + 1 < oldest {
            return vec![WsServerMessage::Error {
                code: "history_truncated".to_string(),
                message: format!(
                    "changes from version {from_version} are no longer retained \
                     (history starts at {oldest}); request a full snapshot",
                ),
            }];
        }
    }

    let delta = state.get_delta(from_version);

    // One message per change, in version order. `get_delta` sorts by operation,
    // which would replay a delete before the create it follows.
    let mut events: Vec<_> = delta
        .created
        .iter()
        .chain(&delta.updated)
        .chain(&delta.deleted)
        .collect();
    events.sort_by_key(|e| e.version);

    events.into_iter().map(to_ws_sync_event).collect()
}

/// Handle incoming WebSocket message.
///
/// Returns every message to send back, in order. Most requests answer with one;
/// a sync request answers with one per change, and an unsupported request
/// answers with an error rather than nothing -- see [`UNSUPPORTED`].
fn handle_client_message(
    client_id: &str,
    msg: WsClientMessage,
    state: &WebSocketState,
    sync: Option<&crate::api::sync::SharedSyncState>,
) -> Vec<WsServerMessage> {
    match msg {
        WsClientMessage::Subscribe { channel } => {
            // Update client subscriptions
            if let Ok(mut clients) = state.clients.write() {
                if let Some(client) = clients.get_mut(client_id) {
                    if !client.subscriptions.contains(&channel) {
                        client.subscriptions.push(channel.clone());
                    }
                }
            }
            vec![WsServerMessage::Subscribed { channel }]
        }

        WsClientMessage::Unsubscribe { channel } => {
            // Update client subscriptions
            if let Ok(mut clients) = state.clients.write() {
                if let Some(client) = clients.get_mut(client_id) {
                    client.subscriptions.retain(|c| c != &channel);
                }
            }
            vec![WsServerMessage::Unsubscribed { channel }]
        }

        WsClientMessage::Ping { timestamp } => vec![WsServerMessage::Pong { timestamp }],

        // The three stream operations and `agent_command` have no
        // implementation behind them. They used to return `None`, which put
        // nothing on the wire at all: a client called `stream_start` and waited
        // for a token that was never coming, with no way to tell a slow model
        // from an unimplemented feature. Answering with an error is not the
        // feature, but it is the truth, and it unblocks the caller.
        WsClientMessage::StreamStart { session_id, model } => {
            log::info!("Client {client_id} requested stream start for {session_id} ({model})");
            vec![WsServerMessage::StreamError {
                session_id,
                error: "streaming is not implemented on this server; \
                        use the REST API to append messages"
                    .to_string(),
            }]
        }

        WsClientMessage::StreamCancel { session_id } => {
            log::info!("Client {client_id} requested stream cancel for {session_id}");
            vec![WsServerMessage::StreamError {
                session_id,
                error: "streaming is not implemented on this server, so there is \
                        nothing to cancel"
                    .to_string(),
            }]
        }

        WsClientMessage::StreamInput {
            session_id,
            content,
        } => {
            log::info!(
                "Client {client_id} sent input for {session_id}: {} bytes",
                content.len()
            );
            vec![WsServerMessage::StreamError {
                session_id,
                error: "streaming is not implemented on this server; \
                        the input was discarded"
                    .to_string(),
            }]
        }

        WsClientMessage::AgentCommand {
            agent_id,
            command,
            params,
        } => {
            log::info!("Client {client_id} sent agent command {command} to {agent_id}: {params:?}");
            vec![WsServerMessage::Error {
                code: UNSUPPORTED.to_string(),
                message: format!(
                    "agent commands are not served over this socket; \
                     `{command}` for agent `{agent_id}` was discarded"
                ),
            }]
        }

        WsClientMessage::SyncRequest { from_version } => {
            log::info!("Client {client_id} requested sync from version {from_version}");
            handle_sync_request(from_version, sync)
        }
    }
}

/// WebSocket endpoint handler using actix-ws
///
/// `sync_state` is optional on purpose. It is registered by `start_server`, but
/// a test harness or an embedder mounting only `/ws` need not provide it; a
/// required extractor would turn that into a 500 on connect. Absent it, sync
/// requests answer `sync_unavailable` and everything else still works.
pub async fn ws_handler(
    req: HttpRequest,
    body: web::Payload,
    state: web::Data<WebSocketState>,
    sync_state: Option<web::Data<crate::api::sync::SharedSyncState>>,
) -> Result<HttpResponse, Error> {
    // Perform WebSocket handshake
    let (mut response, mut session, mut msg_stream) = actix_ws::handle(&req, body)?;

    // If the client authenticated via the `bearer` subprotocol (the log-safe
    // alternative to a `?token=` URL), echo the selected subprotocol so the
    // browser's handshake completes cleanly. We never echo the token itself.
    if req
        .headers()
        .get("Sec-WebSocket-Protocol")
        .and_then(|h| h.to_str().ok())
        .map(|v| {
            v.split(',')
                .next()
                .map(|s| s.trim().eq_ignore_ascii_case("bearer"))
                .unwrap_or(false)
        })
        .unwrap_or(false)
    {
        if let Ok(val) = actix_web::http::header::HeaderValue::from_str("bearer") {
            response.headers_mut().insert(
                actix_web::http::header::SEC_WEBSOCKET_PROTOCOL,
                val,
            );
        }
    }

    let client_id = Uuid::new_v4().to_string();
    let state_clone = state.clone();

    // Register client
    state.register_client(&client_id);

    // Send connected message
    let connected_msg = WsServerMessage::Connected {
        client_id: client_id.clone(),
        version: state.current_version(),
    };
    if let Ok(json) = serde_json::to_string(&connected_msg) {
        let _ = session.text(json).await;
    }

    log::info!("WebSocket client {} connected", client_id);

    // Subscribe to broadcast channel
    let mut broadcast_rx = state.broadcast_tx.subscribe();

    // Spawn handler task
    let client_id_clone = client_id.clone();
    let sync_for_task = sync_state.map(|d| d.into_inner());
    actix_web::rt::spawn(async move {
        let mut heartbeat_interval = tokio::time::interval(HEARTBEAT_INTERVAL);
        let mut last_heartbeat = Instant::now();

        loop {
            tokio::select! {
                // Handle incoming messages
                Some(msg_result) = msg_stream.next() => {
                    match msg_result {
                        Ok(actix_ws::Message::Text(text)) => {
                            last_heartbeat = Instant::now();
                            if let Ok(client_msg) = serde_json::from_str::<WsClientMessage>(&text) {
                                let responses = handle_client_message(
                                    &client_id_clone,
                                    client_msg,
                                    &state_clone,
                                    sync_for_task.as_deref(),
                                );
                                for response in responses {
                                    if let Ok(json) = serde_json::to_string(&response) {
                                        let _ = session.text(json).await;
                                    }
                                }
                            } else {
                                let error_msg = WsServerMessage::Error {
                                    code: "invalid_message".to_string(),
                                    message: "Failed to parse message".to_string(),
                                };
                                if let Ok(json) = serde_json::to_string(&error_msg) {
                                    let _ = session.text(json).await;
                                }
                            }
                        }
                        Ok(actix_ws::Message::Ping(data)) => {
                            last_heartbeat = Instant::now();
                            let _ = session.pong(&data).await;
                        }
                        Ok(actix_ws::Message::Pong(_)) => {
                            last_heartbeat = Instant::now();
                        }
                        Ok(actix_ws::Message::Close(_)) => {
                            log::info!("WebSocket client {} requested close", client_id_clone);
                            break;
                        }
                        _ => {}
                    }
                }

                // Handle broadcast messages
                Ok(msg) = broadcast_rx.recv() => {
                    if let Ok(json) = serde_json::to_string(&msg) {
                        let _ = session.text(json).await;
                    }
                }

                // Heartbeat check
                _ = heartbeat_interval.tick() => {
                    if Instant::now().duration_since(last_heartbeat) > CLIENT_TIMEOUT {
                        log::warn!("WebSocket client {} timed out", client_id_clone);
                        break;
                    }
                    let _ = session.ping(b"").await;
                }
            }
        }

        // Cleanup
        state_clone.unregister_client(&client_id_clone);
        let _ = session.close(None).await;
        log::info!("WebSocket client {} disconnected", client_id_clone);
    });

    Ok(response)
}

/// Configure WebSocket routes
pub fn configure_websocket_routes(cfg: &mut web::ServiceConfig, state: web::Data<WebSocketState>) {
    cfg.app_data(state).route("/ws", web::get().to(ws_handler));
}

// =============================================================================
// Helper Functions for Broadcasting
// =============================================================================

/// Broadcast a sync event to all clients
pub fn broadcast_sync_event(
    state: &WebSocketState,
    entity_type: &str,
    entity_id: &str,
    operation: &str,
    data: Option<serde_json::Value>,
) {
    let version = state.increment_version();
    let msg = WsServerMessage::SyncEvent {
        entity_type: entity_type.to_string(),
        entity_id: entity_id.to_string(),
        operation: operation.to_string(),
        data,
        version,
    };
    state.broadcast(msg);
}

/// Broadcast a stream token to a specific session channel
pub fn broadcast_stream_token(state: &WebSocketState, session_id: &str, token: &str) {
    let msg = WsServerMessage::StreamToken {
        session_id: session_id.to_string(),
        token: token.to_string(),
    };
    state.broadcast_to_channel(&format!("session:{}", session_id), msg);
}

/// Broadcast stream completion
pub fn broadcast_stream_complete(state: &WebSocketState, session_id: &str, message_id: &str) {
    let msg = WsServerMessage::StreamComplete {
        session_id: session_id.to_string(),
        message_id: message_id.to_string(),
    };
    state.broadcast_to_channel(&format!("session:{}", session_id), msg);
}

/// Broadcast an agent event
pub fn broadcast_agent_event(
    state: &WebSocketState,
    agent_id: &str,
    event: &str,
    data: Option<serde_json::Value>,
) {
    let msg = WsServerMessage::AgentEvent {
        agent_id: agent_id.to_string(),
        event: event.to_string(),
        data,
    };
    state.broadcast_to_channel(&format!("agent:{}", agent_id), msg);
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::sync::{
        create_sync_state, SharedSyncState, SyncEntityType, SyncEvent, SyncOperation,
    };

    fn state_with_client(id: &str) -> WebSocketState {
        let state = WebSocketState::new();
        state.register_client(id);
        state
    }

    fn event(entity_id: &str, operation: SyncOperation) -> SyncEvent {
        SyncEvent {
            id: format!("evt-{entity_id}"),
            entity_type: SyncEntityType::Session,
            operation,
            entity_id: entity_id.to_string(),
            data: None,
            timestamp: 0,
            client_id: "seed".to_string(),
            version: 0, // assigned by `add_event`
        }
    }

    /// A sync state holding `n` events, versions 1..=n.
    fn sync_with(n: usize) -> SharedSyncState {
        let sync = create_sync_state();
        {
            let mut s = sync.write().unwrap();
            for i in 1..=n {
                s.add_event(event(&format!("s{i}"), SyncOperation::Update));
            }
        }
        sync
    }

    fn ask(msg: WsClientMessage, sync: Option<&SharedSyncState>) -> Vec<WsServerMessage> {
        let state = state_with_client("c1");
        handle_client_message("c1", msg, &state, sync)
    }

    #[test]
    fn a_sync_request_returns_one_message_per_change() {
        let sync = sync_with(3);
        let out = ask(
            WsClientMessage::SyncRequest { from_version: 1 },
            Some(&sync),
        );

        assert_eq!(out.len(), 2, "versions 2 and 3 are newer than 1");
        let versions: Vec<u64> = out
            .iter()
            .map(|m| match m {
                WsServerMessage::SyncEvent { version, .. } => *version,
                other => panic!("expected a sync_event, got {other:?}"),
            })
            .collect();
        assert_eq!(versions, vec![2, 3]);
    }

    #[test]
    fn changes_replay_in_version_order_not_grouped_by_operation() {
        // `get_delta` buckets by operation, so a delete at version 2 would
        // otherwise arrive before a create at version 3 -- replaying the
        // history in an order that never happened.
        let sync = create_sync_state();
        {
            let mut s = sync.write().unwrap();
            s.add_event(event("a", SyncOperation::Create)); // v1
            s.add_event(event("b", SyncOperation::Delete)); // v2
            s.add_event(event("c", SyncOperation::Create)); // v3
            s.add_event(event("d", SyncOperation::Update)); // v4
        }

        let out = ask(
            WsClientMessage::SyncRequest { from_version: 0 },
            Some(&sync),
        );
        let versions: Vec<u64> = out
            .iter()
            .map(|m| match m {
                WsServerMessage::SyncEvent { version, .. } => *version,
                other => panic!("expected a sync_event, got {other:?}"),
            })
            .collect();

        assert_eq!(versions, vec![1, 2, 3, 4]);
    }

    #[test]
    fn an_up_to_date_client_gets_nothing_and_that_is_correct() {
        let sync = sync_with(2);
        let out = ask(
            WsClientMessage::SyncRequest { from_version: 2 },
            Some(&sync),
        );
        assert!(out.is_empty(), "no changes since version 2: {out:?}");
    }

    #[test]
    fn a_client_ahead_of_the_server_is_told_so() {
        let sync = sync_with(2);
        let out = ask(
            WsClientMessage::SyncRequest { from_version: 99 },
            Some(&sync),
        );

        match out.as_slice() {
            [WsServerMessage::Error { code, message }] => {
                assert_eq!(code, "version_ahead");
                assert!(message.contains("snapshot"), "unhelpful: {message}");
            }
            other => panic!("expected one error, got {other:?}"),
        }
    }

    #[test]
    fn a_trimmed_history_is_an_error_rather_than_a_partial_delta() {
        // Silently returning what survives would leave the client believing it
        // is current while the trimmed events are gone for good.
        let sync = create_sync_state();
        {
            let mut s = sync.write().unwrap();
            s.max_history = 3;
            for i in 1..=6 {
                s.add_event(event(&format!("s{i}"), SyncOperation::Update));
            }
            assert_eq!(s.events.first().unwrap().version, 4, "history should trim");
        }

        let out = ask(
            WsClientMessage::SyncRequest { from_version: 1 },
            Some(&sync),
        );

        match out.as_slice() {
            [WsServerMessage::Error { code, message }] => {
                assert_eq!(code, "history_truncated");
                assert!(message.contains("snapshot"), "unhelpful: {message}");
            }
            other => panic!("expected one error, got {other:?}"),
        }
    }

    #[test]
    fn the_oldest_still_retained_version_is_not_treated_as_a_gap() {
        // A client at version 3 asks for 4 onward, and 4 is the oldest kept.
        // Nothing is missing; this is the boundary the truncation check must
        // not fire on.
        let sync = create_sync_state();
        {
            let mut s = sync.write().unwrap();
            s.max_history = 3;
            for i in 1..=6 {
                s.add_event(event(&format!("s{i}"), SyncOperation::Update));
            }
        }

        let out = ask(
            WsClientMessage::SyncRequest { from_version: 3 },
            Some(&sync),
        );
        assert_eq!(out.len(), 3, "versions 4, 5 and 6: {out:?}");
    }

    #[test]
    fn sync_without_a_configured_state_says_so() {
        let out = ask(WsClientMessage::SyncRequest { from_version: 0 }, None);
        match out.as_slice() {
            [WsServerMessage::Error { code, .. }] => assert_eq!(code, "sync_unavailable"),
            other => panic!("expected one error, got {other:?}"),
        }
    }

    #[test]
    fn entity_type_and_operation_survive_the_crossing() {
        let sync = create_sync_state();
        {
            let mut s = sync.write().unwrap();
            s.add_event(SyncEvent {
                entity_type: SyncEntityType::Workspace,
                operation: SyncOperation::Delete,
                data: Some(serde_json::json!({"kept": true})),
                ..event("w1", SyncOperation::Delete)
            });
        }

        let out = ask(
            WsClientMessage::SyncRequest { from_version: 0 },
            Some(&sync),
        );
        match out.as_slice() {
            [WsServerMessage::SyncEvent {
                entity_type,
                entity_id,
                operation,
                data,
                ..
            }] => {
                assert_eq!(entity_type, "workspace");
                assert_eq!(operation, "delete");
                assert_eq!(entity_id, "w1");
                assert_eq!(data.as_ref().unwrap()["kept"], true);
            }
            other => panic!("expected one sync_event, got {other:?}"),
        }
    }

    #[test]
    fn every_unimplemented_request_answers_instead_of_going_quiet() {
        // The bug this replaced: these returned `None`, so a caller waited
        // forever with no way to distinguish a slow model from a missing
        // feature. Whatever else is true, the client must hear something back.
        let requests = vec![
            WsClientMessage::StreamStart {
                session_id: "s1".to_string(),
                model: "gpt-4".to_string(),
            },
            WsClientMessage::StreamCancel {
                session_id: "s1".to_string(),
            },
            WsClientMessage::StreamInput {
                session_id: "s1".to_string(),
                content: "hello".to_string(),
            },
            WsClientMessage::AgentCommand {
                agent_id: "a1".to_string(),
                command: "run".to_string(),
                params: None,
            },
        ];

        for request in requests {
            let out = ask(request.clone(), None);
            assert_eq!(out.len(), 1, "{request:?} answered {out:?}");
            assert!(
                matches!(
                    out[0],
                    WsServerMessage::StreamError { .. } | WsServerMessage::Error { .. }
                ),
                "{request:?} answered {:?}, which a client would read as success",
                out[0]
            );
        }
    }

    #[test]
    fn subscribe_and_unsubscribe_still_answer_once() {
        let state = state_with_client("c1");

        let out = handle_client_message(
            "c1",
            WsClientMessage::Subscribe {
                channel: "sessions".to_string(),
            },
            &state,
            None,
        );
        assert!(matches!(
            out.as_slice(),
            [WsServerMessage::Subscribed { .. }]
        ));
        assert_eq!(
            state.clients.read().unwrap()["c1"].subscriptions,
            vec!["sessions"]
        );

        let out = handle_client_message(
            "c1",
            WsClientMessage::Unsubscribe {
                channel: "sessions".to_string(),
            },
            &state,
            None,
        );
        assert!(matches!(
            out.as_slice(),
            [WsServerMessage::Unsubscribed { .. }]
        ));
        assert!(state.clients.read().unwrap()["c1"].subscriptions.is_empty());
    }

    #[test]
    fn a_ping_comes_back_with_its_own_timestamp() {
        let out = ask(WsClientMessage::Ping { timestamp: 1234 }, None);
        assert!(matches!(
            out.as_slice(),
            [WsServerMessage::Pong { timestamp: 1234 }]
        ));
    }
}
