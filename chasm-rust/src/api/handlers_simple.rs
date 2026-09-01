// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
//! Simplified API request and response handlers
//!
//! This implementation works with the harvest database schema.

#![allow(dead_code, unused_variables)]

use std::collections::HashMap;

use actix_web::{web, HttpResponse, Responder};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};

use super::state::AppState;
use crate::encryption::EncryptionManager;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};

/// Check if a string is an empty code block marker (just ``` with no content)
fn is_empty_code_block(s: &str) -> bool {
    // Match patterns like "```", "```\n", "```language", "```\n```", "```\n\n```"
    let s = s.trim();
    if s == "```" {
        return true;
    }
    // Check for code block with just a language identifier and no content
    if s.starts_with("```") && !s.contains('\n') {
        return true;
    }
    // Check for empty code block with opening and closing (possibly with whitespace-only lines)
    let lines: Vec<&str> = s.lines().collect();
    if lines.len() >= 2 && lines[0].starts_with("```") && lines.last() == Some(&"```") {
        // Check if all lines between opening and closing are empty or whitespace
        let content_lines = &lines[1..lines.len() - 1];
        if content_lines.iter().all(|line| line.trim().is_empty()) {
            return true;
        }
    }
    false
}

// =============================================================================
// Response Types
// =============================================================================

#[derive(Debug, Serialize)]
struct ApiResponse<T> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
}

impl<T: Serialize> ApiResponse<T> {
    fn success(data: T) -> HttpResponse {
        HttpResponse::Ok().json(Self {
            success: true,
            data: Some(data),
            error: None,
        })
    }

    fn error(message: &str) -> HttpResponse {
        HttpResponse::InternalServerError().json(ApiResponse::<()> {
            success: false,
            data: None,
            error: Some(message.to_string()),
        })
    }
}

// =============================================================================
// Query Parameters
// =============================================================================

#[derive(Debug, Deserialize)]
pub struct SessionQuery {
    pub workspace_id: Option<String>,
    pub provider: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
    pub limit: Option<usize>,
}

// =============================================================================
// Helper Functions
// =============================================================================

/// Derive a human-readable workspace name from a workspace_id (path)
fn derive_workspace_name(workspace_id: &str) -> String {
    // workspace_id is typically a path like "c:\Users\<username>\dev\project"
    // Extract the last path component as the name
    workspace_id
        .replace('\\', "/")
        .split('/')
        .rfind(|s| !s.is_empty())
        .unwrap_or(workspace_id)
        .to_string()
}

/// Look up workspace path from VS Code workspace storage
fn lookup_workspace_path(workspace_hash: &str) -> Option<String> {
    // VS Code stores workspace info in %APPDATA%/Code/User/workspaceStorage/<hash>/workspace.json
    let workspace_storage = dirs::config_dir()?
        .join("Code/User/workspaceStorage")
        .join(workspace_hash)
        .join("workspace.json");

    if workspace_storage.exists() {
        if let Ok(content) = std::fs::read_to_string(&workspace_storage) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                // Extract folder path from workspace.json
                if let Some(folder) = json.get("folder").and_then(|f| f.as_str()) {
                    // Decode file:// URL
                    let path = folder
                        .strip_prefix("file:///")
                        .unwrap_or(folder)
                        .replace("%3A", ":")
                        .replace("%20", " ");
                    return Some(path);
                }
            }
        }
    }
    None
}

/// Get workspace info (name and path) from hash
fn get_workspace_info(workspace_hash: &str) -> (String, String) {
    if let Some(path) = lookup_workspace_path(workspace_hash) {
        let name = derive_workspace_name(&path);
        (name, path)
    } else {
        // Fallback: use hash as both name and path
        (workspace_hash.to_string(), String::new())
    }
}

// =============================================================================
// Health Check
// =============================================================================

pub async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

// =============================================================================
// Workspace Handlers (using harvest schema)
// =============================================================================

pub async fn list_workspaces(state: web::Data<AppState>) -> impl Responder {
    let db = state.db.lock().unwrap();

    // First try to get workspaces from the workspaces table
    let result: Result<Vec<serde_json::Value>, _> = (|| {
        let mut stmt = db.conn.prepare(
            "SELECT w.id, w.name, w.path, w.provider, COUNT(s.id) as session_count,
                    w.created_at, COALESCE(MAX(s.updated_at), w.updated_at) as updated_at
             FROM workspaces w
             LEFT JOIN sessions s ON w.id = s.workspace_id
             GROUP BY w.id
             ORDER BY updated_at DESC",
        )?;

        let workspaces: Vec<serde_json::Value> = stmt
            .query_map([], |row| {
                let id: String = row.get(0)?;
                let name: String = row.get(1)?;
                let path: Option<String> = row.get(2)?;
                let provider: String = row.get(3)?;
                let count: i64 = row.get(4)?;
                let created_at: Option<i64> = row.get(5).ok();
                let updated_at: Option<i64> = row.get(6).ok();
                Ok(serde_json::json!({
                    "id": id,
                    "name": name,
                    "path": path.unwrap_or_default(),
                    "provider": provider,
                    "sessionCount": count,
                    "createdAt": created_at.unwrap_or(0),
                    "updatedAt": updated_at.unwrap_or(0),
                }))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        // If workspaces table is empty, derive workspaces from sessions
        if workspaces.is_empty() {
            let mut stmt = db.conn.prepare(
                "SELECT workspace_id, provider, COUNT(*) as session_count,
                        MIN(created_at) as created_at, MAX(updated_at) as updated_at
                 FROM sessions
                 WHERE workspace_id IS NOT NULL AND workspace_id != ''
                 GROUP BY workspace_id
                 ORDER BY MAX(updated_at) DESC",
            )?;

            let derived: Vec<serde_json::Value> = stmt
                .query_map([], |row| {
                    let id: String = row.get(0)?;
                    let provider: String = row.get(1)?;
                    let count: i64 = row.get(2)?;
                    let created_at: Option<i64> = row.get(3)?;
                    let updated_at: Option<i64> = row.get(4)?;
                    let (name, path) = get_workspace_info(&id);
                    Ok(serde_json::json!({
                        "id": id,
                        "name": name,
                        "path": path,
                        "provider": provider,
                        "sessionCount": count,
                        "createdAt": created_at.unwrap_or(0),
                        "updatedAt": updated_at.unwrap_or(0),
                    }))
                })?
                .collect::<Result<Vec<_>, _>>()?;

            return Ok(derived);
        }

        Ok::<_, rusqlite::Error>(workspaces)
    })();

    match result {
        Ok(workspaces) => {
            let total = workspaces.len();
            ApiResponse::success(serde_json::json!({
                "items": workspaces,
                "total": total,
                "limit": total,
                "offset": 0,
                "hasMore": false
            }))
        }
        Err(e) => ApiResponse::<()>::error(&e.to_string()),
    }
}

pub async fn get_workspace(state: web::Data<AppState>, path: web::Path<String>) -> impl Responder {
    let db = state.db.lock().unwrap();
    let workspace_id = path.into_inner();

    let result: Result<Option<serde_json::Value>, _> = (|| {
        let mut stmt = db.conn.prepare(
            "SELECT w.id, w.name, w.path, w.provider, COUNT(s.id) as session_count
             FROM workspaces w
             LEFT JOIN sessions s ON w.id = s.workspace_id
             WHERE w.id = ?1
             GROUP BY w.id",
        )?;

        let workspace = stmt
            .query_row([&workspace_id], |row| {
                let id: String = row.get(0)?;
                let name: String = row.get(1)?;
                let path: Option<String> = row.get(2)?;
                let provider: String = row.get(3)?;
                let count: i64 = row.get(4)?;
                Ok(serde_json::json!({
                    "id": id,
                    "name": name,
                    "path": path.unwrap_or_default(),
                    "provider": provider,
                    "session_count": count,
                }))
            })
            .optional()?;

        Ok::<_, rusqlite::Error>(workspace)
    })();

    match result {
        Ok(Some(workspace)) => ApiResponse::success(workspace),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "success": false,
            "error": "Workspace not found"
        })),
        Err(e) => ApiResponse::<()>::error(&e.to_string()),
    }
}

// =============================================================================
// Session Handlers (using harvest schema)
// =============================================================================

pub async fn list_sessions(
    state: web::Data<AppState>,
    query: web::Query<SessionQuery>,
) -> impl Responder {
    let db = state.db.lock().unwrap();
    let limit = query.limit.unwrap_or(100) as i64;

    let result: Result<Vec<serde_json::Value>, _> = (|| {
        let mut sql = String::from(
            "SELECT id, provider, workspace_id, title, message_count, 
                    created_at, updated_at
             FROM sessions WHERE 1=1",
        );

        if query.workspace_id.is_some() {
            sql.push_str(" AND workspace_id = ?1");
        }
        if query.provider.is_some() {
            sql.push_str(" AND provider = ?2");
        }
        sql.push_str(" ORDER BY updated_at DESC LIMIT ?3");

        let mut stmt = db.conn.prepare(&sql)?;

        let sessions: Vec<serde_json::Value> = stmt
            .query_map(
                params![
                    query.workspace_id.as_deref().unwrap_or(""),
                    query.provider.as_deref().unwrap_or(""),
                    limit,
                ],
                |row| {
                    let workspace_id: Option<String> = row.get(2)?;
                    let workspace_name = workspace_id.as_ref().map(|id| {
                        let (name, _path) = get_workspace_info(id);
                        name
                    });
                    Ok(serde_json::json!({
                        "id": row.get::<_, String>(0)?,
                        "provider": row.get::<_, String>(1)?,
                        "workspaceId": workspace_id,
                        "workspaceName": workspace_name,
                        "title": row.get::<_, String>(3)?,
                        "messageCount": row.get::<_, i64>(4)?,
                        "createdAt": row.get::<_, i64>(5)?,
                        "updatedAt": row.get::<_, i64>(6)?,
                    }))
                },
            )?
            .collect::<Result<Vec<_>, _>>()?;

        Ok::<_, rusqlite::Error>(sessions)
    })();

    match result {
        Ok(sessions) => {
            let total = sessions.len();
            ApiResponse::success(serde_json::json!({
                "items": sessions,
                "total": total,
                "limit": limit,
                "offset": 0,
                "hasMore": false
            }))
        }
        Err(e) => ApiResponse::<()>::error(&e.to_string()),
    }
}

pub async fn get_session(state: web::Data<AppState>, path: web::Path<String>) -> impl Responder {
    let db = state.db.lock().unwrap();
    let session_id = path.into_inner();

    let result: Result<Option<serde_json::Value>, _> = (|| {
        // Get session info
        let mut stmt = db.conn.prepare(
            "SELECT id, provider, workspace_id, title, message_count,
                    created_at, updated_at, session_json
             FROM sessions WHERE id = ?1",
        )?;

        let session = stmt
            .query_row([&session_id], |row| {
                let session_json: String = row.get(7)?;
                let parsed: serde_json::Value =
                    serde_json::from_str(&session_json).unwrap_or(serde_json::json!({}));

                // Extract messages from session_json.requests
                let messages = extract_messages_from_session(&parsed);

                let workspace_id: Option<String> = row.get(2)?;
                let workspace_name = workspace_id.as_ref().map(|id| {
                    let (name, _path) = get_workspace_info(id);
                    name
                });

                Ok((
                    serde_json::json!({
                        "id": row.get::<_, String>(0)?,
                        "provider": row.get::<_, String>(1)?,
                        "workspaceId": workspace_id,
                        "workspaceName": workspace_name,
                        "title": row.get::<_, String>(3)?,
                        "messageCount": row.get::<_, i64>(4)?,
                        "createdAt": row.get::<_, i64>(5)?,
                        "updatedAt": row.get::<_, i64>(6)?,
                    }),
                    messages,
                    session_id.clone(),
                ))
            })
            .optional()?;

        if let Some((session, messages, sid)) = session {
            // Try to get enhanced data from messages_v2 and tool_invocations
            let tool_invocations = get_tool_invocations(&db.conn, &sid)?;
            let file_changes = get_file_changes(&db.conn, &sid)?;

            // If session_json was compacted (no requests), fall back to messages_v2
            let final_messages = if messages.is_empty() {
                get_messages_v2(&db.conn, &sid)?
            } else {
                messages
            };

            Ok::<_, rusqlite::Error>(Some(serde_json::json!({
                "session": session,
                "messages": final_messages,
                "tool_invocations": tool_invocations,
                "file_changes": file_changes,
            })))
        } else {
            Ok::<_, rusqlite::Error>(None)
        }
    })();

    match result {
        Ok(Some(data)) => ApiResponse::success(data),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "success": false,
            "error": "Session not found"
        })),
        Err(e) => ApiResponse::<()>::error(&e.to_string()),
    }
}

/// Extract messages from session_json.requests array with full markdown and tool invocations
pub(super) fn extract_messages_from_session(
    session_json: &serde_json::Value,
) -> Vec<serde_json::Value> {
    let mut messages = Vec::new();

    if let Some(requests) = session_json.get("requests").and_then(|r| r.as_array()) {
        for (idx, request) in requests.iter().enumerate() {
            let timestamp = request.get("timestamp").and_then(|t| t.as_i64());
            let request_id = request.get("requestId").and_then(|r| r.as_str());
            let response_id = request.get("responseId").and_then(|r| r.as_str());
            let model_id = request.get("modelId").and_then(|m| m.as_str());
            let is_canceled = request
                .get("isCanceled")
                .and_then(|c| c.as_bool())
                .unwrap_or(false);

            // Extract user message
            if let Some(message) = request.get("message") {
                let text = message
                    .get("text")
                    .or_else(|| message.get("content"))
                    .and_then(|t| t.as_str())
                    .unwrap_or("");

                if !text.is_empty() {
                    messages.push(serde_json::json!({
                        "index": idx * 2,
                        "role": "user",
                        "content": text,
                        "content_raw": text,
                        "request_id": request_id,
                        "model_id": model_id,
                        "created_at": timestamp,
                        "variable_data": request.get("variableData"),
                    }));
                }
            }

            // Extract assistant response with full markdown and tool invocations
            if let Some(response) = request.get("response") {
                let (response_text, tool_invocations) = extract_response_with_tools(response);

                if !response_text.is_empty() || !tool_invocations.is_empty() {
                    messages.push(serde_json::json!({
                        "index": idx * 2 + 1,
                        "role": "assistant",
                        "content": response_text,
                        "content_raw": response_text,
                        "response_id": response_id,
                        "model_id": model_id,
                        "created_at": timestamp,
                        "is_canceled": is_canceled,
                        "tool_invocations": tool_invocations,
                        "content_references": request.get("contentReferences"),
                        "code_citations": request.get("codeCitations"),
                    }));
                }
            }
        }
    }

    messages
}

/// Extract text content and tool invocations from a response object
fn extract_response_with_tools(response: &serde_json::Value) -> (String, Vec<serde_json::Value>) {
    let mut text_parts = Vec::new();
    let mut tool_invocations = Vec::new();

    // Response can be an array of items
    if let Some(items) = response.as_array() {
        for item in items {
            // Check item kind
            let kind = item.get("kind").and_then(|k| k.as_str()).unwrap_or("");

            match kind {
                "toolInvocationSerialized" => {
                    // Extract tool invocation details
                    let tool_name = item.get("toolId").and_then(|t| t.as_str()).unwrap_or("");
                    let tool_call_id = item.get("toolCallId").and_then(|t| t.as_str());
                    let is_complete = item
                        .get("isComplete")
                        .and_then(|c| c.as_bool())
                        .unwrap_or(false);
                    let is_confirmed = item.get("isConfirmed");

                    // Extract tool-specific data (contains file edits, terminal commands, etc.)
                    let tool_data = item.get("toolSpecificData");

                    // Extract presentation data which may contain file paths for edits
                    let presentation = item.get("presentation");

                    // Extract source which may have the tool input
                    let source = item.get("source");

                    // Extract file changes from tool data, presentation, and source
                    let file_changes =
                        extract_file_changes_from_tool(tool_data, presentation, source, tool_name);

                    tool_invocations.push(serde_json::json!({
                        "tool_name": tool_name,
                        "tool_call_id": tool_call_id,
                        "is_complete": is_complete,
                        "is_confirmed": is_confirmed,
                        "invocation_message": item.get("invocationMessage"),
                        "tool_specific_data": tool_data,
                        "presentation": presentation,
                        "source": source,
                        "file_changes": file_changes,
                    }));
                }
                "prepareToolInvocation" => {
                    // Tool about to be invoked
                    let tool_name = item.get("toolName").and_then(|t| t.as_str()).unwrap_or("");
                    tool_invocations.push(serde_json::json!({
                        "tool_name": tool_name,
                        "status": "preparing",
                    }));
                }
                "thinking" => {
                    // Skip thinking blocks or include encrypted content reference
                    continue;
                }
                "inlineReference" => {
                    // Inline code reference (method names, file paths, symbols)
                    // These are stored as separate objects with a "name" field
                    if let Some(inline_ref) = item.get("inlineReference") {
                        if let Some(name) = inline_ref.get("name").and_then(|n| n.as_str()) {
                            // Wrap the name in backticks to represent inline code
                            text_parts.push(format!("`{}`", name));
                        }
                    }
                }
                _ => {
                    // Check if this item contains an inlineReference (VS Code stores them without a kind)
                    if let Some(inline_ref) = item.get("inlineReference") {
                        if let Some(name) = inline_ref.get("name").and_then(|n| n.as_str()) {
                            // Wrap the name in backticks to represent inline code
                            text_parts.push(format!("`{}`", name));
                        }
                    } else if let Some(value) = item.get("value").and_then(|v| v.as_str()) {
                        // Text/markdown content - filter out empty code block markers
                        let trimmed = value.trim();
                        if !trimmed.is_empty() && !is_empty_code_block(trimmed) {
                            text_parts.push(value.to_string());
                        }
                    }
                }
            }
        }
    }

    (text_parts.join(""), tool_invocations)
}

/// Extract file changes from tool-specific data, presentation, and source
fn extract_file_changes_from_tool(
    tool_data: Option<&serde_json::Value>,
    presentation: Option<&serde_json::Value>,
    source: Option<&serde_json::Value>,
    tool_name: &str,
) -> Vec<serde_json::Value> {
    let mut file_changes = Vec::new();

    // First, extract from toolSpecificData (terminal commands, etc.)
    if let Some(data) = tool_data {
        let kind = data.get("kind").and_then(|k| k.as_str()).unwrap_or("");

        match kind {
            "terminal" => {
                // Terminal command - extract command info
                if let Some(cmd) = data.get("commandLine") {
                    file_changes.push(serde_json::json!({
                        "type": "terminal_command",
                        "command": cmd.get("original"),
                        "edited": cmd.get("toolEdited"),
                        "output": data.get("terminalCommandOutput"),
                        "exit_code": data.get("terminalCommandState")
                            .and_then(|s| s.get("exitCode")),
                    }));
                }
            }
            "editFile" | "createFile" => {
                // File edit/create from toolSpecificData
                if let Some(uri) = data
                    .get("uri")
                    .and_then(|u| u.as_str())
                    .or_else(|| data.get("path").and_then(|p| p.as_str()))
                {
                    file_changes.push(serde_json::json!({
                        "type": kind,
                        "file_path": uri,
                        "old_string": data.get("oldString"),
                        "new_string": data.get("newString"),
                    }));
                }
            }
            _ => {
                // Other tool types - store raw data if relevant
                if !kind.is_empty() && kind != "thinking" {
                    file_changes.push(serde_json::json!({
                        "type": kind,
                        "data": data,
                    }));
                }
            }
        }
    }

    // If no file changes extracted from toolSpecificData, infer from tool name
    // Note: VS Code Copilot doesn't store file edit parameters in the session JSON
    if file_changes.is_empty() {
        match tool_name {
            n if n.contains("replaceString")
                || n.contains("replace_string")
                || n.contains("multiReplace")
                || n.contains("multi_replace") =>
            {
                file_changes.push(serde_json::json!({
                    "type": "file_edit",
                    "tool_name": tool_name,
                    "note": "File path not stored in session (VS Code limitation)",
                }));
            }
            n if n.contains("createFile") || n.contains("create_file") => {
                file_changes.push(serde_json::json!({
                    "type": "file_create",
                    "tool_name": tool_name,
                    "note": "File path not stored in session (VS Code limitation)",
                }));
            }
            n if n.contains("editNotebook") || n.contains("edit_notebook") => {
                file_changes.push(serde_json::json!({
                    "type": "notebook_edit",
                    "tool_name": tool_name,
                    "note": "File path not stored in session (VS Code limitation)",
                }));
            }
            n if n.contains("delete") || n.contains("remove") => {
                file_changes.push(serde_json::json!({
                    "type": "file_delete",
                    "tool_name": tool_name,
                    "note": "File path not stored in session (VS Code limitation)",
                }));
            }
            _ => {}
        }
    }

    file_changes
}

pub async fn search_sessions(
    state: web::Data<AppState>,
    query: web::Query<SearchQuery>,
) -> impl Responder {
    let db = state.db.lock().unwrap();
    let limit = query.limit.unwrap_or(20) as i64;
    let search_term = format!("%{}%", query.q);

    let result: Result<Vec<serde_json::Value>, _> = (|| {
        let mut stmt = db.conn.prepare(
            "SELECT DISTINCT s.id, s.title, s.provider, s.workspace_id, s.message_count, s.updated_at
             FROM sessions s
             LEFT JOIN messages m ON s.id = m.session_id
             WHERE s.title LIKE ?1 OR m.content LIKE ?1
             ORDER BY s.updated_at DESC
             LIMIT ?2"
        )?;

        let results: Vec<serde_json::Value> = stmt
            .query_map(params![search_term, limit], |row| {
                let workspace_id: Option<String> = row.get(3)?;
                let workspace_name = workspace_id.as_ref().map(|id| derive_workspace_name(id));
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "title": row.get::<_, String>(1)?,
                    "provider": row.get::<_, String>(2)?,
                    "workspace_id": workspace_id,
                    "workspace_name": workspace_name,
                    "message_count": row.get::<_, i64>(4)?,
                    "updated_at": row.get::<_, i64>(5)?,
                }))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok::<_, rusqlite::Error>(results)
    })();

    match result {
        Ok(results) => ApiResponse::success(serde_json::json!({
            "results": results,
            "query": query.q,
        })),
        Err(e) => ApiResponse::<()>::error(&e.to_string()),
    }
}

// =============================================================================
// Helper functions for enhanced message data
// =============================================================================

/// Retrieve messages from the messages_v2 table for a given session.
/// Used as a fallback when session_json has been compacted.
fn get_messages_v2(
    conn: &rusqlite::Connection,
    session_id: &str,
) -> Result<Vec<serde_json::Value>, rusqlite::Error> {
    let table_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='messages_v2'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !table_exists {
        return Ok(Vec::new());
    }

    let mut stmt = conn.prepare(
        "SELECT id, message_index, role, content_raw, content_markdown,
                model_id, timestamp, is_canceled, metadata_json, request_id, response_id
         FROM messages_v2
         WHERE session_id = ?1
         ORDER BY message_index",
    )?;

    let messages: Vec<serde_json::Value> = stmt
        .query_map([session_id], |row| {
            let metadata: Option<String> = row.get(8)?;
            Ok(serde_json::json!({
                "index": row.get::<_, i64>(1)?,
                "role": row.get::<_, String>(2)?,
                "content": row.get::<_, String>(3)?,
                "content_raw": row.get::<_, String>(3)?,
                "content_markdown": row.get::<_, Option<String>>(4)?,
                "model_id": row.get::<_, Option<String>>(5)?,
                "created_at": row.get::<_, Option<i64>>(6)?,
                "is_canceled": row.get::<_, i64>(7)? > 0,
                "metadata": metadata.and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok()),
                "request_id": row.get::<_, Option<String>>(9)?,
                "response_id": row.get::<_, Option<String>>(10)?,
            }))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(messages)
}

fn get_tool_invocations(
    conn: &rusqlite::Connection,
    session_id: &str,
) -> Result<Vec<serde_json::Value>, rusqlite::Error> {
    // Check if table exists first
    let table_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='tool_invocations'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !table_exists {
        return Ok(Vec::new());
    }

    let mut stmt = conn.prepare(
        "SELECT id, message_id, tool_name, tool_call_id, invocation_index, 
                input_json, output_json, status, is_confirmed, timestamp
         FROM tool_invocations 
         WHERE session_id = ?1 
         ORDER BY message_id, invocation_index",
    )?;

    let invocations: Vec<serde_json::Value> = stmt
        .query_map([session_id], |row| {
            let input: Option<String> = row.get(5)?;
            let output: Option<String> = row.get(6)?;

            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "message_id": row.get::<_, i64>(1)?,
                "tool_name": row.get::<_, String>(2)?,
                "tool_call_id": row.get::<_, Option<String>>(3)?,
                "invocation_index": row.get::<_, i64>(4)?,
                "input": input.and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok()),
                "output": output.and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok()),
                "status": row.get::<_, String>(7)?,
                "is_confirmed": row.get::<_, i64>(8)? > 0,
                "timestamp": row.get::<_, Option<i64>>(9)?,
            }))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(invocations)
}

fn get_file_changes(
    conn: &rusqlite::Connection,
    session_id: &str,
) -> Result<Vec<serde_json::Value>, rusqlite::Error> {
    // Check if table exists first
    let table_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='file_changes'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !table_exists {
        return Ok(Vec::new());
    }

    let mut stmt = conn.prepare(
        "SELECT id, tool_invocation_id, file_path, change_type, 
                old_content, new_content, diff_unified, line_start, line_end, timestamp
         FROM file_changes 
         WHERE session_id = ?1 
         ORDER BY id",
    )?;

    let changes: Vec<serde_json::Value> = stmt
        .query_map([session_id], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "tool_invocation_id": row.get::<_, Option<i64>>(1)?,
                "file_path": row.get::<_, String>(2)?,
                "change_type": row.get::<_, String>(3)?,
                "old_content": row.get::<_, Option<String>>(4)?,
                "new_content": row.get::<_, Option<String>>(5)?,
                "diff_unified": row.get::<_, Option<String>>(6)?,
                "line_start": row.get::<_, Option<i64>>(7)?,
                "line_end": row.get::<_, Option<i64>>(8)?,
                "timestamp": row.get::<_, Option<i64>>(9)?,
            }))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(changes)
}

// =============================================================================
// Stats Handler (using harvest schema)
// =============================================================================

pub async fn get_stats(state: web::Data<AppState>) -> impl Responder {
    let db = state.db.lock().unwrap();

    let result: Result<serde_json::Value, _> =
        (|| {
            let total_sessions: i64 =
                db.conn
                    .query_row("SELECT COUNT(*) FROM sessions", [], |row| row.get(0))?;

            // Check if enhanced tables exist and query them safely
            let messages_v2_exists: bool = db.conn.query_row(
            "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='messages_v2'",
            [],
            |row| row.get(0),
        ).unwrap_or(false);

            let tool_invocations_exists: bool = db.conn.query_row(
            "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='tool_invocations'",
            [],
            |row| row.get(0),
        ).unwrap_or(false);

            let file_changes_exists: bool = db.conn.query_row(
            "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='file_changes'",
            [],
            |row| row.get(0),
        ).unwrap_or(false);

            let total_messages: i64 = if messages_v2_exists {
                db.conn
                    .query_row("SELECT COUNT(*) FROM messages_v2", [], |row| row.get(0))
                    .unwrap_or(0)
            } else {
                // Fallback: estimate from session message_count
                db.conn
                    .query_row(
                        "SELECT COALESCE(SUM(message_count), 0) FROM sessions",
                        [],
                        |row| row.get(0),
                    )
                    .unwrap_or(0)
            };

            let total_tool_invocations: i64 = if tool_invocations_exists {
                db.conn
                    .query_row("SELECT COUNT(*) FROM tool_invocations", [], |row| {
                        row.get(0)
                    })
                    .unwrap_or(0)
            } else {
                0
            };

            let total_file_changes: i64 = if file_changes_exists {
                db.conn
                    .query_row("SELECT COUNT(*) FROM file_changes", [], |row| row.get(0))
                    .unwrap_or(0)
            } else {
                0
            };

            let mut stmt = db.conn.prepare(
                "SELECT provider, COUNT(*) FROM sessions GROUP BY provider ORDER BY COUNT(*) DESC",
            )?;

            let by_provider: Vec<(String, i64)> = stmt
                .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
                .collect::<Result<_, _>>()?;

            // Count unique workspaces
            let total_workspaces: i64 = db.conn.query_row(
                "SELECT COUNT(DISTINCT workspace_id) FROM sessions",
                [],
                |row| row.get(0),
            )?;

            // Convert by_provider to expected format
            let sessions_by_provider: Vec<serde_json::Value> = by_provider
                .iter()
                .map(|(provider, count)| {
                    serde_json::json!({
                        "provider": provider,
                        "count": count
                    })
                })
                .collect();

            Ok::<_, rusqlite::Error>(serde_json::json!({
                "totalSessions": total_sessions,
                "totalMessages": total_messages,
                "totalWorkspaces": total_workspaces,
                "totalToolInvocations": total_tool_invocations,
                "totalFileChanges": total_file_changes,
                "tablesEnhanced": messages_v2_exists,
                "sessionsByProvider": sessions_by_provider,
            }))
        })();

    match result {
        Ok(stats) => ApiResponse::success(stats),
        Err(e) => ApiResponse::<()>::error(&e.to_string()),
    }
}

// =============================================================================
// Provider Handlers
// =============================================================================

/// Provider information for the API
#[derive(Debug, Serialize)]
struct ProviderInfo {
    id: String,
    name: String,
    #[serde(rename = "type")]
    provider_type: String,
    status: String,
    icon: String,
    color: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    endpoint: Option<String>,
    models: Vec<String>,
    /// Whether the user has this provider switched on.
    ///
    /// The catalogue below is static, so this is the one field on a provider
    /// that a user can change. It is stored per-id in `provider_settings` and
    /// folded in by `list_providers`; a provider nobody has touched is on.
    /// Nothing on the server consumes it yet -- it is a preference the clients
    /// read -- but it is persisted so it survives a reload, which is what the
    /// switch in the UI has always implied and never did.
    enabled: bool,
}

impl ProviderInfo {
    fn cloud(
        id: &str,
        name: &str,
        icon: &str,
        color: &str,
        endpoint: Option<&str>,
        models: Vec<&str>,
    ) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            provider_type: "cloud".to_string(),
            status: if id == "copilot" {
                "connected".to_string()
            } else {
                "disconnected".to_string()
            },
            icon: icon.to_string(),
            color: color.to_string(),
            endpoint: endpoint.map(|s| s.to_string()),
            models: models.into_iter().map(|s| s.to_string()).collect(),
            // Default on; `list_providers` overrides from `provider_settings`.
            enabled: true,
        }
    }

    fn local(
        id: &str,
        name: &str,
        icon: &str,
        color: &str,
        endpoint: &str,
        models: Vec<&str>,
    ) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            provider_type: "local".to_string(),
            status: "disconnected".to_string(),
            icon: icon.to_string(),
            color: color.to_string(),
            endpoint: Some(endpoint.to_string()),
            models: models.into_iter().map(|s| s.to_string()).collect(),
            // Default on; `list_providers` overrides from `provider_settings`.
            enabled: true,
        }
    }
}

/// Per-provider user settings.
///
/// Keyed by the catalogue id. Only ids that have been explicitly changed get a
/// row, so the table stays empty on a fresh install and an absent row means
/// "default", not "off".
fn init_provider_settings_table(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS provider_settings (
            provider_id TEXT PRIMARY KEY,
            enabled INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;
    Ok(())
}

/// Read the stored on/off overrides, keyed by provider id.
fn provider_overrides(conn: &rusqlite::Connection) -> rusqlite::Result<HashMap<String, bool>> {
    let mut stmt = conn.prepare("SELECT provider_id, enabled FROM provider_settings")?;
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)? != 0))
    })?;
    rows.collect()
}

pub async fn list_providers(state: web::Data<AppState>) -> impl Responder {
    let db = state.db.lock().unwrap();

    if let Err(e) = init_provider_settings_table(&db.conn) {
        return ApiResponse::<()>::error(&format!("Database error: {e}"));
    }

    let overrides = match provider_overrides(&db.conn) {
        Ok(o) => o,
        Err(e) => return ApiResponse::<()>::error(&format!("Database error: {e}")),
    };

    let mut providers = all_providers();
    for p in &mut providers {
        if let Some(&enabled) = overrides.get(&p.id) {
            p.enabled = enabled;
        }
    }

    ApiResponse::success(providers)
}

#[derive(Debug, Deserialize)]
pub struct UpdateProviderRequest {
    pub enabled: bool,
}

/// Switch a provider on or off, persistently.
///
/// The catalogue itself is compiled in and cannot be edited over the API, so
/// this writes only the one mutable bit. An id outside the catalogue is a 404
/// rather than a stored row for a provider that does not exist -- otherwise
/// `provider_settings` would accumulate entries nothing ever reads.
pub async fn update_provider(
    state: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<UpdateProviderRequest>,
) -> impl Responder {
    let id = path.into_inner();

    let mut providers = all_providers();
    let Some(provider) = providers.iter_mut().find(|p| p.id == id) else {
        return HttpResponse::NotFound().json(ApiResponse::<()> {
            success: false,
            data: None,
            error: Some(format!("Unknown provider: {id}")),
        });
    };

    let db = state.db.lock().unwrap();

    if let Err(e) = init_provider_settings_table(&db.conn) {
        return ApiResponse::<()>::error(&format!("Database error: {e}"));
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;

    let result = db.conn.execute(
        "INSERT INTO provider_settings (provider_id, enabled, updated_at)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(provider_id) DO UPDATE SET enabled = ?2, updated_at = ?3",
        params![id, body.enabled as i64, now],
    );

    if let Err(e) = result {
        return ApiResponse::<()>::error(&format!("Failed to update provider: {e}"));
    }

    provider.enabled = body.enabled;
    ApiResponse::success(provider)
}

/// The static provider catalogue.
///
/// Shared with `get_provider_health` so the two endpoints cannot drift into
/// describing different sets of providers.
fn all_providers() -> Vec<ProviderInfo> {
    vec![
        // ===========================================
        // Cloud Providers
        // ===========================================
        ProviderInfo::cloud(
            "copilot",
            "GitHub Copilot",
            "🤖",
            "#000000",
            None,
            vec![
                "gpt-4.1",
                "gpt-4.1-mini",
                "gpt-4o",
                "gpt-4o-mini",
                "o1",
                "o1-mini",
                "o1-preview",
                "o3",
                "o3-mini",
                "o4-mini",
                "claude-sonnet-4",
                "claude-3.5-sonnet",
                "gemini-2.0-flash",
                "gemini-2.5-pro",
            ],
        ),
        ProviderInfo::cloud(
            "openai",
            "OpenAI",
            "🧠",
            "#10a37f",
            Some("https://api.openai.com/v1"),
            vec![
                "gpt-4.1",
                "gpt-4.1-mini",
                "gpt-4.1-nano",
                "gpt-4o",
                "gpt-4o-mini",
                "gpt-4o-audio-preview",
                "gpt-4-turbo",
                "gpt-4",
                "gpt-3.5-turbo",
                "o1",
                "o1-mini",
                "o1-preview",
                "o3",
                "o3-mini",
                "o4-mini",
                "chatgpt-4o-latest",
            ],
        ),
        ProviderInfo::cloud(
            "anthropic",
            "Anthropic",
            "🎭",
            "#d4a574",
            Some("https://api.anthropic.com/v1"),
            vec![
                "claude-opus-4",
                "claude-sonnet-4",
                "claude-3.5-sonnet",
                "claude-3.5-haiku",
                "claude-3-opus",
                "claude-3-sonnet",
                "claude-3-haiku",
            ],
        ),
        ProviderInfo::cloud(
            "google",
            "Google AI",
            "✨",
            "#4285f4",
            Some("https://generativelanguage.googleapis.com/v1beta"),
            vec![
                "gemini-2.5-pro",
                "gemini-2.5-flash",
                "gemini-2.0-flash",
                "gemini-2.0-flash-thinking",
                "gemini-1.5-pro",
                "gemini-1.5-flash",
                "gemini-1.5-flash-8b",
                "gemini-pro",
                "gemini-pro-vision",
            ],
        ),
        ProviderInfo::cloud(
            "azure-openai",
            "Azure OpenAI",
            "☁️",
            "#0078d4",
            None,
            vec![
                "gpt-4o",
                "gpt-4o-mini",
                "gpt-4-turbo",
                "gpt-4",
                "gpt-35-turbo",
                "o1",
                "o1-mini",
            ],
        ),
        ProviderInfo::cloud(
            "ai-foundry",
            "Azure AI Foundry",
            "🏭",
            "#0078d4",
            None,
            vec![
                "gpt-4o",
                "gpt-4o-mini",
                "o1",
                "o1-mini",
                "Phi-4",
                "Phi-3.5-MoE-instruct",
                "Phi-3.5-mini-instruct",
                "Phi-3.5-vision-instruct",
                "Llama-3.3-70B-Instruct",
                "Llama-3.2-90B-Vision-Instruct",
                "Llama-3.1-405B-Instruct",
                "Mistral-large-2411",
                "Mistral-small",
                "Codestral-2501",
                "DeepSeek-R1",
                "DeepSeek-V3",
                "Cohere-command-r-plus",
                "JAIS-30b-chat",
            ],
        ),
        ProviderInfo::cloud(
            "github-models",
            "GitHub Models",
            "🐙",
            "#24292e",
            Some("https://models.inference.ai.azure.com"),
            vec![
                "gpt-4o",
                "gpt-4o-mini",
                "o1",
                "o1-mini",
                "o1-preview",
                "Phi-4",
                "Phi-3.5-MoE-instruct",
                "Llama-3.3-70B-Instruct",
                "Llama-3.2-90B-Vision-Instruct",
                "Meta-Llama-3.1-405B-Instruct",
                "Mistral-large-2411",
                "Mistral-small",
                "Codestral-2501",
                "DeepSeek-R1",
                "Cohere-command-r-plus",
            ],
        ),
        ProviderInfo::cloud(
            "deepseek",
            "DeepSeek",
            "🔍",
            "#4d6bfe",
            Some("https://api.deepseek.com/v1"),
            vec!["deepseek-chat", "deepseek-reasoner", "deepseek-coder"],
        ),
        ProviderInfo::cloud(
            "xai",
            "xAI",
            "🚀",
            "#000000",
            Some("https://api.x.ai/v1"),
            vec![
                "grok-3",
                "grok-3-fast",
                "grok-2",
                "grok-2-mini",
                "grok-2-vision",
                "grok-beta",
            ],
        ),
        ProviderInfo::cloud(
            "mistral",
            "Mistral AI",
            "🌬️",
            "#ff7000",
            Some("https://api.mistral.ai/v1"),
            vec![
                "mistral-large-latest",
                "mistral-large-2411",
                "mistral-medium-latest",
                "mistral-small-latest",
                "mistral-small-2501",
                "codestral-latest",
                "codestral-2501",
                "ministral-3b-latest",
                "ministral-8b-latest",
                "pixtral-large-latest",
                "pixtral-12b",
                "open-mistral-nemo",
                "open-codestral-mamba",
            ],
        ),
        ProviderInfo::cloud(
            "cohere",
            "Cohere",
            "🔗",
            "#39594d",
            Some("https://api.cohere.ai/v1"),
            vec![
                "command-r-plus",
                "command-r",
                "command",
                "command-light",
                "command-nightly",
                "aya-expanse-32b",
                "aya-expanse-8b",
            ],
        ),
        ProviderInfo::cloud(
            "perplexity",
            "Perplexity",
            "🔮",
            "#20808d",
            Some("https://api.perplexity.ai"),
            vec![
                "sonar-pro",
                "sonar",
                "sonar-deep-research",
                "sonar-reasoning-pro",
                "sonar-reasoning",
            ],
        ),
        ProviderInfo::cloud(
            "groq",
            "Groq",
            "⚡",
            "#f55036",
            Some("https://api.groq.com/openai/v1"),
            vec![
                "llama-3.3-70b-versatile",
                "llama-3.1-70b-versatile",
                "llama-3.1-8b-instant",
                "llama3-groq-70b-8192-tool-use-preview",
                "llama3-groq-8b-8192-tool-use-preview",
                "mixtral-8x7b-32768",
                "gemma2-9b-it",
                "deepseek-r1-distill-llama-70b",
            ],
        ),
        ProviderInfo::cloud(
            "together",
            "Together AI",
            "🤝",
            "#0f6fff",
            Some("https://api.together.xyz/v1"),
            vec![
                "meta-llama/Llama-3.3-70B-Instruct-Turbo",
                "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo",
                "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
                "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
                "Qwen/Qwen2.5-72B-Instruct-Turbo",
                "Qwen/QwQ-32B-Preview",
                "deepseek-ai/DeepSeek-R1",
                "deepseek-ai/DeepSeek-V3",
                "mistralai/Mixtral-8x22B-Instruct-v0.1",
                "databricks/dbrx-instruct",
            ],
        ),
        ProviderInfo::cloud(
            "fireworks",
            "Fireworks AI",
            "🎆",
            "#ff6b35",
            Some("https://api.fireworks.ai/inference/v1"),
            vec![
                "accounts/fireworks/models/llama-v3p3-70b-instruct",
                "accounts/fireworks/models/llama-v3p1-405b-instruct",
                "accounts/fireworks/models/qwen2p5-72b-instruct",
                "accounts/fireworks/models/mixtral-8x22b-instruct",
                "accounts/fireworks/models/deepseek-r1",
                "accounts/fireworks/models/deepseek-v3",
            ],
        ),
        ProviderInfo::cloud(
            "replicate",
            "Replicate",
            "🔄",
            "#000000",
            Some("https://api.replicate.com/v1"),
            vec![
                "meta/llama-3.3-70b-instruct",
                "meta/meta-llama-3.1-405b-instruct",
                "mistralai/mixtral-8x7b-instruct-v0.1",
                "anthropic/claude-3.5-sonnet",
            ],
        ),
        ProviderInfo::cloud(
            "openrouter",
            "OpenRouter",
            "🛤️",
            "#6467f2",
            Some("https://openrouter.ai/api/v1"),
            vec![
                "openai/gpt-4o",
                "openai/o1",
                "anthropic/claude-sonnet-4",
                "anthropic/claude-3.5-sonnet",
                "google/gemini-2.0-flash",
                "google/gemini-2.5-pro",
                "meta-llama/llama-3.3-70b-instruct",
                "deepseek/deepseek-r1",
                "deepseek/deepseek-chat",
                "mistralai/mistral-large-2411",
                "qwen/qwq-32b-preview",
            ],
        ),
        ProviderInfo::cloud(
            "aws-bedrock",
            "AWS Bedrock",
            "🪨",
            "#ff9900",
            None,
            vec![
                "anthropic.claude-3-5-sonnet-20241022-v2:0",
                "anthropic.claude-3-5-haiku-20241022-v1:0",
                "anthropic.claude-3-opus-20240229-v1:0",
                "anthropic.claude-3-sonnet-20240229-v1:0",
                "meta.llama3-3-70b-instruct-v1:0",
                "meta.llama3-1-405b-instruct-v1:0",
                "mistral.mistral-large-2411-v1:0",
                "amazon.nova-pro-v1:0",
                "amazon.nova-lite-v1:0",
                "amazon.nova-micro-v1:0",
                "amazon.titan-text-premier-v1:0",
                "cohere.command-r-plus-v1:0",
            ],
        ),
        ProviderInfo::cloud(
            "ai21",
            "AI21 Labs",
            "🧪",
            "#ec4899",
            Some("https://api.ai21.com/studio/v1"),
            vec!["jamba-1.5-large", "jamba-1.5-mini", "jamba-instruct"],
        ),
        ProviderInfo::cloud(
            "cursor",
            "Cursor",
            "📝",
            "#000000",
            None,
            vec![
                "cursor-small",
                "cursor-large",
                "gpt-4",
                "gpt-4o",
                "claude-3.5-sonnet",
            ],
        ),
        ProviderInfo::cloud(
            "m365-copilot",
            "Microsoft 365 Copilot",
            "📊",
            "#0078d4",
            None,
            vec![
                "copilot-chat",
                "copilot-word",
                "copilot-excel",
                "copilot-powerpoint",
                "copilot-outlook",
                "copilot-teams",
            ],
        ),
        // ===========================================
        // Local Providers
        // ===========================================
        ProviderInfo::local(
            "ollama",
            "Ollama",
            "🦙",
            "#ffffff",
            "http://localhost:11434",
            vec![
                "llama3.3:70b",
                "llama3.3:latest",
                "llama3.2:latest",
                "llama3.1:405b",
                "llama3.1:70b",
                "llama3.1:latest",
                "qwen2.5-coder:32b",
                "qwen2.5-coder:14b",
                "qwen2.5-coder:7b",
                "qwen2.5:72b",
                "qwen2.5:32b",
                "qwen2.5:14b",
                "qwen2.5:7b",
                "qwq:32b",
                "deepseek-r1:70b",
                "deepseek-r1:32b",
                "deepseek-r1:14b",
                "deepseek-r1:8b",
                "deepseek-r1:1.5b",
                "deepseek-coder-v2:latest",
                "codellama:70b",
                "codellama:34b",
                "codellama:13b",
                "codellama:7b",
                "mistral:latest",
                "mistral-nemo:latest",
                "mixtral:8x7b",
                "mixtral:8x22b",
                "phi4:latest",
                "phi3.5:latest",
                "phi3:latest",
                "gemma2:27b",
                "gemma2:9b",
                "gemma2:2b",
                "command-r:latest",
                "command-r-plus:latest",
                "yi:34b",
                "yi-coder:9b",
                "starcoder2:15b",
                "starcoder2:7b",
                "starcoder2:3b",
                "nomic-embed-text:latest",
                "mxbai-embed-large:latest",
            ],
        ),
        ProviderInfo::local(
            "lm-studio",
            "LM Studio",
            "🎬",
            "#1a1a2e",
            "http://localhost:1234/v1",
            vec!["loaded-model"],
        ),
        ProviderInfo::local(
            "localai",
            "LocalAI",
            "🏠",
            "#00d4aa",
            "http://localhost:8080/v1",
            vec![
                "gpt4all-j",
                "ggml-gpt4all-j",
                "wizardlm-13b-v1.2",
                "llama-2-7b-chat",
                "codellama-7b-instruct",
            ],
        ),
        ProviderInfo::local(
            "llamafile",
            "llamafile",
            "📁",
            "#fbbf24",
            "http://localhost:8080/v1",
            vec!["loaded-model"],
        ),
        ProviderInfo::local(
            "jan",
            "Jan",
            "💬",
            "#1d4ed8",
            "http://localhost:1337/v1",
            vec!["loaded-model"],
        ),
        ProviderInfo::local(
            "gpt4all",
            "GPT4All",
            "🌐",
            "#4ade80",
            "http://localhost:4891/v1",
            vec![
                "gpt4all-falcon-newbpe-q4_0",
                "gpt4all-mistral-7b-instruct-v0.2",
                "orca-2-7b",
                "nous-hermes-llama2-13b",
                "wizardlm-13b-v1.2",
            ],
        ),
        ProviderInfo::local(
            "text-gen-webui",
            "Text Generation WebUI",
            "🖥️",
            "#a855f7",
            "http://localhost:5000/v1",
            vec!["loaded-model"],
        ),
        ProviderInfo::local(
            "vllm",
            "vLLM",
            "⚙️",
            "#06b6d4",
            "http://localhost:8000/v1",
            vec![
                "meta-llama/Llama-3.3-70B-Instruct",
                "meta-llama/Llama-3.1-8B-Instruct",
                "mistralai/Mistral-7B-Instruct-v0.3",
                "Qwen/Qwen2.5-72B-Instruct",
                "deepseek-ai/DeepSeek-V3",
            ],
        ),
        ProviderInfo::local(
            "mlx",
            "MLX (Apple Silicon)",
            "🍎",
            "#a3a3a3",
            "http://localhost:8080/v1",
            vec![
                "mlx-community/Llama-3.3-70B-Instruct-4bit",
                "mlx-community/Qwen2.5-Coder-32B-Instruct-4bit",
                "mlx-community/Mistral-7B-Instruct-v0.3-4bit",
            ],
        ),
        ProviderInfo::local(
            "koboldcpp",
            "KoboldCpp",
            "🐉",
            "#dc2626",
            "http://localhost:5001/v1",
            vec!["loaded-model"],
        ),
        ProviderInfo::local(
            "tabby",
            "Tabby",
            "🐱",
            "#f59e0b",
            "http://localhost:8080",
            vec![
                "StarCoder-1B",
                "StarCoder-3B",
                "StarCoder-7B",
                "CodeLlama-7B",
                "CodeLlama-13B",
                "DeepSeek-Coder-1.3B",
                "DeepSeek-Coder-6.7B",
            ],
        ),
    ]
}

// =============================================================================
// MCP Tools Handlers (for introspective chat)
// =============================================================================

/// List available MCP tools
pub async fn list_mcp_tools() -> impl Responder {
    use crate::mcp::tools::list_tools;

    let tools = list_tools();

    // Convert to OpenAI-compatible function format for chat completions
    let openai_tools: Vec<serde_json::Value> = tools
        .iter()
        .map(|t| {
            serde_json::json!({
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.input_schema,
                }
            })
        })
        .collect();

    ApiResponse::success(serde_json::json!({
        "tools": openai_tools,
        "mcp_tools": tools,
    }))
}

/// Execute an MCP tool call
#[derive(Debug, Deserialize)]
pub struct ToolCallRequest {
    pub name: String,
    pub arguments: std::collections::HashMap<String, serde_json::Value>,
}

pub async fn call_mcp_tool(body: web::Json<ToolCallRequest>) -> impl Responder {
    use crate::mcp::tools::call_tool;

    let request = body.into_inner();
    let result = call_tool(&request.name, &request.arguments);

    ApiResponse::success(serde_json::json!({
        "tool": request.name,
        "result": result,
    }))
}

/// Execute multiple MCP tool calls
#[derive(Debug, Deserialize)]
pub struct BatchToolCallRequest {
    pub calls: Vec<ToolCallRequest>,
}

pub async fn call_mcp_tools_batch(body: web::Json<BatchToolCallRequest>) -> impl Responder {
    use crate::mcp::tools::call_tool;

    let request = body.into_inner();
    let results: Vec<serde_json::Value> = request
        .calls
        .iter()
        .map(|call| {
            let result = call_tool(&call.name, &call.arguments);
            serde_json::json!({
                "tool": call.name,
                "result": result,
            })
        })
        .collect();

    ApiResponse::success(results)
}

/// Get system prompt with CSM tools context
pub async fn get_csm_system_prompt() -> impl Responder {
    use crate::mcp::tools::list_tools;

    let tools = list_tools();
    let tool_descriptions: Vec<String> = tools
        .iter()
        .filter(|t| t.name.starts_with("csm_db_")) // Only database tools for chat
        .map(|t| {
            format!(
                "- {}: {}",
                t.name,
                t.description.as_ref().unwrap_or(&String::new())
            )
        })
        .collect();

    let system_prompt = format!(
        r#"You are an AI assistant integrated with the Chat Session Manager (CSM) system. You have access to tools that let you introspect and query the user's chat history database.

Available CSM tools:
{}

When the user asks about their chat history, previous conversations, sessions, or workspaces, use these tools to provide accurate information.

Guidelines:
- Use csm_db_list_workspaces to see all projects/workspaces with chat sessions
- Use csm_db_list_sessions to see chat sessions, optionally filtered by workspace or provider
- Use csm_db_get_session to retrieve full conversation history from a specific session
- Use csm_db_search to search across session titles
- Use csm_db_stats to get overview statistics

Always be helpful and provide context when presenting results from these tools."#,
        tool_descriptions.join("\n")
    );

    ApiResponse::success(serde_json::json!({
        "system_prompt": system_prompt,
        "available_tools": tool_descriptions,
    }))
}

// =============================================================================
// Agent Endpoints
// =============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub instruction: String,
    pub role: Option<String>,
    pub model: Option<String>,
    pub provider: Option<String>,
    pub temperature: f32,
    pub max_tokens: Option<i32>,
    pub tools: Vec<String>,
    pub sub_agents: Vec<String>,
    pub is_active: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub metadata: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAgentRequest {
    pub name: String,
    pub description: Option<String>,
    pub instruction: String,
    pub role: Option<String>,
    pub model: Option<String>,
    pub provider: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<i32>,
    pub tools: Option<Vec<String>>,
    pub sub_agents: Option<Vec<String>>,
    pub metadata: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAgentRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub instruction: Option<String>,
    pub role: Option<String>,
    pub model: Option<String>,
    pub provider: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<i32>,
    pub tools: Option<Vec<String>>,
    pub sub_agents: Option<Vec<String>>,
    pub is_active: Option<bool>,
    pub metadata: Option<String>,
}

fn init_agents_table(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS agents (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            instruction TEXT NOT NULL,
            role TEXT DEFAULT 'assistant',
            model TEXT,
            provider TEXT,
            temperature REAL DEFAULT 0.7,
            max_tokens INTEGER,
            tools TEXT DEFAULT '[]',
            sub_agents TEXT,
            is_active INTEGER DEFAULT 1,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            metadata TEXT
        )",
        [],
    )?;
    Ok(())
}

/// List all agents
pub async fn list_agents(state: web::Data<AppState>) -> impl Responder {
    let db = state.db.lock().unwrap();

    // Ensure table exists
    if let Err(e) = init_agents_table(&db.conn) {
        return ApiResponse::<()>::error(&format!("Database error: {}", e));
    }

    let result: Result<Vec<serde_json::Value>, rusqlite::Error> = (|| {
        let mut stmt = db.conn.prepare(
            "SELECT id, name, description, instruction, role, model, provider, 
                    temperature, max_tokens, tools, sub_agents, is_active, 
                    created_at, updated_at, metadata 
             FROM agents ORDER BY updated_at DESC",
        )?;

        let agents: Vec<serde_json::Value> = stmt
            .query_map([], |row| {
                let tools_str: String = row.get::<_, Option<String>>(9)?.unwrap_or_default();
                let tools: Vec<String> = serde_json::from_str(&tools_str).unwrap_or_default();
                let sub_agents_str: String = row.get::<_, Option<String>>(10)?.unwrap_or_default();
                let sub_agents: Vec<String> =
                    serde_json::from_str(&sub_agents_str).unwrap_or_default();
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "description": row.get::<_, Option<String>>(2)?,
                    "instruction": row.get::<_, String>(3)?,
                    "role": row.get::<_, Option<String>>(4)?,
                    "model": row.get::<_, Option<String>>(5)?,
                    "provider": row.get::<_, Option<String>>(6)?,
                    "temperature": row.get::<_, f64>(7)?,
                    "maxTokens": row.get::<_, Option<i32>>(8)?,
                    "tools": tools,
                    "subAgents": sub_agents,
                    "isActive": row.get::<_, i32>(11)? == 1,
                    "createdAt": row.get::<_, i64>(12)?,
                    "updatedAt": row.get::<_, i64>(13)?,
                    "metadata": row.get::<_, Option<String>>(14)?,
                }))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(agents)
    })();

    match result {
        Ok(agents) => ApiResponse::success(agents),
        Err(e) => ApiResponse::<()>::error(&format!("Database error: {}", e)),
    }
}

/// Get a single agent
pub async fn get_agent(state: web::Data<AppState>, path: web::Path<String>) -> impl Responder {
    let id = path.into_inner();
    let db = state.db.lock().unwrap();

    if let Err(e) = init_agents_table(&db.conn) {
        return ApiResponse::<()>::error(&format!("Database error: {}", e));
    }

    let result: Result<Option<serde_json::Value>, rusqlite::Error> = db
        .conn
        .query_row(
            "SELECT id, name, description, instruction, role, model, provider, 
                temperature, max_tokens, tools, sub_agents, is_active, 
                created_at, updated_at, metadata 
         FROM agents WHERE id = ?1",
            params![id],
            |row| {
                let tools_str: String = row.get::<_, Option<String>>(9)?.unwrap_or_default();
                let tools: Vec<String> = serde_json::from_str(&tools_str).unwrap_or_default();
                let sub_agents_str: String = row.get::<_, Option<String>>(10)?.unwrap_or_default();
                let sub_agents: Vec<String> =
                    serde_json::from_str(&sub_agents_str).unwrap_or_default();
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "description": row.get::<_, Option<String>>(2)?,
                    "instruction": row.get::<_, String>(3)?,
                    "role": row.get::<_, Option<String>>(4)?,
                    "model": row.get::<_, Option<String>>(5)?,
                    "provider": row.get::<_, Option<String>>(6)?,
                    "temperature": row.get::<_, f64>(7)?,
                    "maxTokens": row.get::<_, Option<i32>>(8)?,
                    "tools": tools,
                    "subAgents": sub_agents,
                    "isActive": row.get::<_, i32>(11)? == 1,
                    "createdAt": row.get::<_, i64>(12)?,
                    "updatedAt": row.get::<_, i64>(13)?,
                    "metadata": row.get::<_, Option<String>>(14)?,
                }))
            },
        )
        .optional();

    match result {
        Ok(Some(agent)) => ApiResponse::success(agent),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<()> {
            success: false,
            data: None,
            error: Some("Agent not found".to_string()),
        }),
        Err(e) => ApiResponse::<()>::error(&format!("Database error: {}", e)),
    }
}

/// Create a new agent
pub async fn create_agent(
    state: web::Data<AppState>,
    body: web::Json<CreateAgentRequest>,
) -> impl Responder {
    let db = state.db.lock().unwrap();

    if let Err(e) = init_agents_table(&db.conn) {
        return ApiResponse::<()>::error(&format!("Database error: {}", e));
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    let tools_json = serde_json::to_string(&body.tools.clone().unwrap_or_default()).unwrap();
    let sub_agents_json =
        serde_json::to_string(&body.sub_agents.clone().unwrap_or_default()).unwrap();
    let role = body.role.clone().unwrap_or_else(|| "assistant".to_string());

    let result = db.conn.execute(
        "INSERT INTO agents (id, name, description, instruction, role, model, provider, 
                            temperature, max_tokens, tools, sub_agents, is_active, 
                            created_at, updated_at, metadata)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 1, ?12, ?13, ?14)",
        params![
            id,
            body.name,
            body.description,
            body.instruction,
            role,
            body.model,
            body.provider,
            body.temperature.unwrap_or(0.7),
            body.max_tokens,
            tools_json,
            sub_agents_json,
            now,
            now,
            body.metadata
        ],
    );

    match result {
        Ok(_) => ApiResponse::success(serde_json::json!({
            "id": id,
            "name": body.name,
            "description": body.description,
            "instruction": body.instruction,
            "role": role,
            "model": body.model,
            "provider": body.provider,
            "temperature": body.temperature.unwrap_or(0.7),
            "maxTokens": body.max_tokens,
            "tools": body.tools.clone().unwrap_or_default(),
            "subAgents": body.sub_agents.clone().unwrap_or_default(),
            "isActive": true,
            "createdAt": now,
            "updatedAt": now,
            "metadata": body.metadata,
        })),
        Err(e) => ApiResponse::<()>::error(&format!("Failed to create agent: {}", e)),
    }
}

/// Update an agent
pub async fn update_agent(
    state: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<UpdateAgentRequest>,
) -> impl Responder {
    let id = path.into_inner();
    let db = state.db.lock().unwrap();

    if let Err(e) = init_agents_table(&db.conn) {
        return ApiResponse::<()>::error(&format!("Database error: {}", e));
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;

    let result = db.conn.execute(
        "UPDATE agents SET updated_at = ?1, 
         name = COALESCE(?2, name),
         description = COALESCE(?3, description),
         instruction = COALESCE(?4, instruction),
         role = COALESCE(?5, role),
         model = COALESCE(?6, model),
         provider = COALESCE(?7, provider),
         temperature = COALESCE(?8, temperature),
         max_tokens = COALESCE(?9, max_tokens),
         tools = COALESCE(?10, tools),
         sub_agents = COALESCE(?11, sub_agents),
         is_active = COALESCE(?12, is_active),
         metadata = COALESCE(?13, metadata)
         WHERE id = ?14",
        params![
            now,
            body.name,
            body.description,
            body.instruction,
            body.role,
            body.model,
            body.provider,
            body.temperature,
            body.max_tokens,
            body.tools
                .as_ref()
                .map(|t| serde_json::to_string(t).unwrap()),
            body.sub_agents
                .as_ref()
                .map(|t| serde_json::to_string(t).unwrap()),
            body.is_active.map(|b| if b { 1 } else { 0 }),
            body.metadata.clone(),
            id
        ],
    );

    match result {
        Ok(0) => HttpResponse::NotFound().json(ApiResponse::<()> {
            success: false,
            data: None,
            error: Some("Agent not found".to_string()),
        }),
        Ok(_) => {
            // Return success with updated id
            ApiResponse::success(serde_json::json!({ "id": id, "updated": true }))
        }
        Err(e) => ApiResponse::<()>::error(&format!("Failed to update agent: {}", e)),
    }
}

/// Delete an agent
pub async fn delete_agent(state: web::Data<AppState>, path: web::Path<String>) -> impl Responder {
    let id = path.into_inner();
    let db = state.db.lock().unwrap();

    let result = db
        .conn
        .execute("DELETE FROM agents WHERE id = ?1", params![id]);

    match result {
        Ok(0) => HttpResponse::NotFound().json(ApiResponse::<()> {
            success: false,
            data: None,
            error: Some("Agent not found".to_string()),
        }),
        Ok(_) => ApiResponse::success(serde_json::json!({ "deleted": true })),
        Err(e) => ApiResponse::<()>::error(&format!("Failed to delete agent: {}", e)),
    }
}

// =============================================================================
// Swarm Endpoints
// =============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SwarmAgent {
    pub agent_id: String,
    pub role: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateSwarmRequest {
    pub name: String,
    pub description: Option<String>,
    pub orchestration: String, // "sequential", "parallel", "hierarchical", "debate"
    pub agents: Vec<SwarmAgent>,
    pub max_iterations: Option<i32>,
}

pub(super) fn init_swarms_table(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS swarms (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            orchestration TEXT NOT NULL DEFAULT 'sequential',
            agents TEXT NOT NULL DEFAULT '[]',
            max_iterations INTEGER DEFAULT 10,
            status TEXT DEFAULT 'idle',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;
    Ok(())
}

/// List all swarms
pub async fn list_swarms(state: web::Data<AppState>) -> impl Responder {
    let db = state.db.lock().unwrap();

    if let Err(e) = init_swarms_table(&db.conn) {
        return ApiResponse::<()>::error(&format!("Database error: {}", e));
    }

    let result: Result<Vec<serde_json::Value>, rusqlite::Error> = (|| {
        let mut stmt = db.conn.prepare(
            "SELECT id, name, description, orchestration, agents, max_iterations, 
                    status, created_at, updated_at 
             FROM swarms ORDER BY updated_at DESC",
        )?;

        let swarms: Vec<serde_json::Value> = stmt
            .query_map([], |row| {
                let agents_str: String = row.get(4)?;
                let agents: Vec<serde_json::Value> =
                    serde_json::from_str(&agents_str).unwrap_or_default();
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "description": row.get::<_, Option<String>>(2)?,
                    "orchestration": row.get::<_, String>(3)?,
                    "agents": agents,
                    "maxIterations": row.get::<_, Option<i32>>(5)?,
                    "status": row.get::<_, String>(6)?,
                    "createdAt": row.get::<_, i64>(7)?,
                    "updatedAt": row.get::<_, i64>(8)?,
                }))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(swarms)
    })();

    match result {
        Ok(swarms) => ApiResponse::success(swarms),
        Err(e) => ApiResponse::<()>::error(&format!("Database error: {}", e)),
    }
}

/// Get a single swarm
pub async fn get_swarm(state: web::Data<AppState>, path: web::Path<String>) -> impl Responder {
    let id = path.into_inner();
    let db = state.db.lock().unwrap();

    if let Err(e) = init_swarms_table(&db.conn) {
        return ApiResponse::<()>::error(&format!("Database error: {}", e));
    }

    let result: Result<Option<serde_json::Value>, rusqlite::Error> = db
        .conn
        .query_row(
            "SELECT id, name, description, orchestration, agents, max_iterations, 
                status, created_at, updated_at 
         FROM swarms WHERE id = ?1",
            params![id],
            |row| {
                let agents_str: String = row.get(4)?;
                let agents: Vec<serde_json::Value> =
                    serde_json::from_str(&agents_str).unwrap_or_default();
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "description": row.get::<_, Option<String>>(2)?,
                    "orchestration": row.get::<_, String>(3)?,
                    "agents": agents,
                    "maxIterations": row.get::<_, Option<i32>>(5)?,
                    "status": row.get::<_, String>(6)?,
                    "createdAt": row.get::<_, i64>(7)?,
                    "updatedAt": row.get::<_, i64>(8)?,
                }))
            },
        )
        .optional();

    match result {
        Ok(Some(swarm)) => ApiResponse::success(swarm),
        Ok(None) => HttpResponse::NotFound().json(ApiResponse::<()> {
            success: false,
            data: None,
            error: Some("Swarm not found".to_string()),
        }),
        Err(e) => ApiResponse::<()>::error(&format!("Database error: {}", e)),
    }
}

/// Create a new swarm
pub async fn create_swarm(
    state: web::Data<AppState>,
    body: web::Json<CreateSwarmRequest>,
) -> impl Responder {
    let db = state.db.lock().unwrap();

    if let Err(e) = init_swarms_table(&db.conn) {
        return ApiResponse::<()>::error(&format!("Database error: {}", e));
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;
    let agents_json = serde_json::to_string(&body.agents).unwrap();

    let result = db.conn.execute(
        "INSERT INTO swarms (id, name, description, orchestration, agents, max_iterations, 
                            status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'idle', ?7, ?8)",
        params![
            id,
            body.name,
            body.description,
            body.orchestration,
            agents_json,
            body.max_iterations.unwrap_or(10),
            now,
            now
        ],
    );

    match result {
        Ok(_) => ApiResponse::success(serde_json::json!({
            "id": id,
            "name": body.name,
            "description": body.description,
            "orchestration": body.orchestration,
            "agents": body.agents,
            "maxIterations": body.max_iterations.unwrap_or(10),
            "status": "idle",
            "createdAt": now,
            "updatedAt": now,
        })),
        Err(e) => ApiResponse::<()>::error(&format!("Failed to create swarm: {}", e)),
    }
}

/// Delete a swarm
pub async fn delete_swarm(state: web::Data<AppState>, path: web::Path<String>) -> impl Responder {
    let id = path.into_inner();
    let db = state.db.lock().unwrap();

    let result = db
        .conn
        .execute("DELETE FROM swarms WHERE id = ?1", params![id]);

    match result {
        Ok(0) => HttpResponse::NotFound().json(ApiResponse::<()> {
            success: false,
            data: None,
            error: Some("Swarm not found".to_string()),
        }),
        Ok(_) => ApiResponse::success(serde_json::json!({ "deleted": true })),
        Err(e) => ApiResponse::<()>::error(&format!("Failed to delete swarm: {}", e)),
    }
}

/// Add an agent to an existing swarm.
///
/// The web UI has had an "Add Agent to Swarm" dialog since it was written,
/// with a select for the agent and a select for the role. Neither was bound to
/// anything, and its confirm button only closed the dialog -- nothing could
/// have been sent, because no route existed to send it to. `POST /api/swarms`
/// takes a membership list at creation and there was no way to change it
/// afterwards.
///
/// Membership lives in the `agents` column as `{agent_id, role}` records, so
/// this reads the list, edits it and writes it back.
///
/// Adding an agent that is already a member updates its role rather than
/// duplicating it: a swarm cannot hold one agent in two roles, and refusing
/// would make the obvious way to change a role an error.
pub async fn add_swarm_agent(
    state: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<SwarmAgent>,
) -> impl Responder {
    let swarm_id = path.into_inner();
    let member = body.into_inner();

    if member.agent_id.trim().is_empty() {
        return HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            error: Some("agent_id is required".to_string()),
        });
    }
    if member.role.trim().is_empty() {
        return HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            error: Some("role is required".to_string()),
        });
    }

    let db = state.db.lock().unwrap();
    if let Err(e) = init_swarms_table(&db.conn) {
        return ApiResponse::<()>::error(&format!("Database error: {}", e));
    }

    // A membership pointing at an agent that does not exist is a dangling
    // reference that later reads as data. Note that `create_swarm` does not
    // check this -- an asymmetry worth closing, but not by loosening the
    // check that is here.
    let agent_exists: Result<i64, _> = db.conn.query_row(
        "SELECT COUNT(*) FROM agents WHERE id = ?1",
        params![member.agent_id.trim()],
        |row| row.get(0),
    );
    match agent_exists {
        Ok(0) => {
            return HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                error: Some(format!("No agent with id {}", member.agent_id.trim())),
            })
        }
        Err(e) => return ApiResponse::<()>::error(&format!("Database error: {}", e)),
        Ok(_) => {}
    }

    let current: Result<String, _> = db.conn.query_row(
        "SELECT agents FROM swarms WHERE id = ?1",
        params![swarm_id],
        |row| row.get(0),
    );
    let current = match current {
        Ok(json) => json,
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            return HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                error: Some("Swarm not found".to_string()),
            })
        }
        Err(e) => return ApiResponse::<()>::error(&format!("Database error: {}", e)),
    };

    let mut members: Vec<SwarmAgent> = serde_json::from_str(&current).unwrap_or_default();
    let agent_id = member.agent_id.trim().to_string();
    let role = member.role.trim().to_string();
    match members.iter_mut().find(|m| m.agent_id == agent_id) {
        Some(existing) => existing.role = role,
        None => members.push(SwarmAgent { agent_id, role }),
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;
    let encoded = serde_json::to_string(&members).unwrap_or_else(|_| "[]".to_string());

    match db.conn.execute(
        "UPDATE swarms SET agents = ?1, updated_at = ?2 WHERE id = ?3",
        params![encoded, now, swarm_id],
    ) {
        Ok(_) => ApiResponse::success(serde_json::json!({
            "id": swarm_id,
            "agents": members,
            "updatedAt": now,
        })),
        Err(e) => ApiResponse::<()>::error(&format!("Database error: {}", e)),
    }
}

/// Remove an agent from a swarm.
///
/// A 404 when it was not a member: reporting a removal that removed nothing is
/// the failure this whole audit is about.
pub async fn remove_swarm_agent(
    state: web::Data<AppState>,
    path: web::Path<(String, String)>,
) -> impl Responder {
    let (swarm_id, agent_id) = path.into_inner();

    let db = state.db.lock().unwrap();
    if let Err(e) = init_swarms_table(&db.conn) {
        return ApiResponse::<()>::error(&format!("Database error: {}", e));
    }

    let current: Result<String, _> = db.conn.query_row(
        "SELECT agents FROM swarms WHERE id = ?1",
        params![swarm_id],
        |row| row.get(0),
    );
    let current = match current {
        Ok(json) => json,
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            return HttpResponse::NotFound().json(ApiResponse::<()> {
                success: false,
                data: None,
                error: Some("Swarm not found".to_string()),
            })
        }
        Err(e) => return ApiResponse::<()>::error(&format!("Database error: {}", e)),
    };

    let mut members: Vec<SwarmAgent> = serde_json::from_str(&current).unwrap_or_default();
    let before = members.len();
    members.retain(|m| m.agent_id != agent_id);
    if members.len() == before {
        return HttpResponse::NotFound().json(ApiResponse::<()> {
            success: false,
            data: None,
            error: Some("That agent is not in this swarm".to_string()),
        });
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;
    let encoded = serde_json::to_string(&members).unwrap_or_else(|_| "[]".to_string());

    match db.conn.execute(
        "UPDATE swarms SET agents = ?1, updated_at = ?2 WHERE id = ?3",
        params![encoded, now, swarm_id],
    ) {
        Ok(_) => ApiResponse::success(serde_json::json!({
            "id": swarm_id,
            "agents": members,
            "updatedAt": now,
        })),
        Err(e) => ApiResponse::<()>::error(&format!("Database error: {}", e)),
    }
}

// =============================================================================
// Settings Endpoints
// =============================================================================

fn init_settings_table(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;

    // Insert default settings if not exist
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;

    conn.execute(
        "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES 
         ('theme', '\"system\"', ?1),
         ('defaultProvider', '\"copilot\"', ?1),
         ('autoSync', 'true', ?1),
         ('syncInterval', '300000', ?1),
         ('maxHistoryDays', '365', ?1),
         ('enableNotifications', 'true', ?1),
         ('compactMode', 'false', ?1)",
        params![now],
    )?;
    Ok(())
}

/// Get all settings
pub async fn get_settings(state: web::Data<AppState>) -> HttpResponse {
    let db = state.db.lock().unwrap();

    if let Err(e) = init_settings_table(&db.conn) {
        return ApiResponse::<()>::error(&format!("Database error: {}", e));
    }

    let result: Result<serde_json::Value, rusqlite::Error> = (|| {
        let mut stmt = db.conn.prepare("SELECT key, value FROM settings")?;
        let mut settings = serde_json::Map::new();

        stmt.query_map([], |row| {
            let key: String = row.get(0)?;
            let value_str: String = row.get(1)?;
            let value: serde_json::Value =
                serde_json::from_str(&value_str).unwrap_or(serde_json::Value::String(value_str));
            Ok((key, value))
        })?
        .for_each(|r| {
            if let Ok((k, v)) = r {
                settings.insert(k, v);
            }
        });

        Ok(serde_json::Value::Object(settings))
    })();

    match result {
        Ok(settings) => ApiResponse::success(settings),
        Err(e) => ApiResponse::<()>::error(&format!("Database error: {}", e)),
    }
}

/// Update settings
pub async fn update_settings(
    state: web::Data<AppState>,
    body: web::Json<serde_json::Value>,
) -> HttpResponse {
    let db = state.db.lock().unwrap();

    if let Err(e) = init_settings_table(&db.conn) {
        return ApiResponse::<()>::error(&format!("Database error: {}", e));
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;

    if let serde_json::Value::Object(map) = body.into_inner() {
        for (key, value) in map {
            let value_str = serde_json::to_string(&value).unwrap();
            let _ = db.conn.execute(
                "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
                params![key, value_str, now],
            );
        }
    }

    // Return success - re-fetch would require dropping lock
    ApiResponse::success(serde_json::json!({ "updated": true }))
}

// =============================================================================
// Provider Accounts Endpoints
// =============================================================================

fn init_accounts_table(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS provider_accounts (
            id TEXT PRIMARY KEY,
            provider TEXT NOT NULL,
            name TEXT NOT NULL,
            credentials TEXT NOT NULL,
            is_default INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;

    // Added after the table shipped, so existing databases need the column
    // rather than the CREATE above. Rows written before this point are
    // plaintext and say so, which is what lets them still be read.
    if !column_exists(conn, "provider_accounts", "credentials_format")? {
        conn.execute(
            "ALTER TABLE provider_accounts
             ADD COLUMN credentials_format TEXT NOT NULL DEFAULT 'plaintext'",
            [],
        )?;
    }
    Ok(())
}

fn column_exists(conn: &rusqlite::Connection, table: &str, column: &str) -> rusqlite::Result<bool> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        if row.get::<_, String>(1)? == column {
            return Ok(true);
        }
    }
    Ok(false)
}

/// The environment variable holding the credential encryption key.
///
/// Deliberately not a setting in the database: a key stored beside the
/// ciphertext it protects is not a key. The operator decides where it lives.
pub const MASTER_KEY_ENV: &str = "CHASM_MASTER_KEY";

/// Format tag written alongside each credential.
const FORMAT_ENCRYPTED: &str = "aes-256-gcm";
const FORMAT_PLAINTEXT: &str = "plaintext";

fn init_credential_salt_table(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS credential_crypto (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            salt TEXT NOT NULL
        )",
        [],
    )?;
    Ok(())
}

/// The install's credential salt, generated once and kept.
///
/// It has to be stable: the key is derived from the passphrase and this salt
/// together, so a fresh salt would derive a different key and every credential
/// already stored would stop decrypting. A salt is not secret -- it exists to
/// make the derivation unique per install -- so keeping it in the database
/// beside the ciphertext is fine in a way keeping the passphrase there is not.
fn credential_salt(conn: &rusqlite::Connection) -> rusqlite::Result<Vec<u8>> {
    init_credential_salt_table(conn)?;

    let existing: Option<String> = conn
        .query_row("SELECT salt FROM credential_crypto WHERE id = 1", [], |r| {
            r.get(0)
        })
        .optional()?;

    if let Some(encoded) = existing {
        if let Ok(bytes) = BASE64.decode(&encoded) {
            return Ok(bytes);
        }
    }

    let salt: [u8; 16] = rand::random();
    let encoded = BASE64.encode(salt);
    conn.execute(
        "INSERT OR REPLACE INTO credential_crypto (id, salt) VALUES (1, ?1)",
        params![encoded],
    )?;
    Ok(salt.to_vec())
}

/// Build the cipher for this install, or `None` if no key is configured.
///
/// `None` is not "store it in the clear" -- `create_account` refuses the write
/// instead. Writing a secret to disk unprotected because a variable was unset
/// is exactly the kind of quiet substitution this codebase is being audited
/// for.
fn credential_cipher(conn: &rusqlite::Connection) -> rusqlite::Result<Option<EncryptionManager>> {
    let key = match std::env::var(MASTER_KEY_ENV) {
        Ok(k) if !k.trim().is_empty() => k,
        _ => return Ok(None),
    };

    let salt = credential_salt(conn)?;
    match EncryptionManager::new(&key, &salt) {
        Ok(manager) => Ok(Some(manager)),
        // A key that cannot derive is a misconfiguration, not a reason to
        // fall back to plaintext.
        Err(e) => {
            eprintln!("[WARN] accounts: {MASTER_KEY_ENV} is set but unusable: {e}");
            Ok(None)
        }
    }
}

/// Read a stored credential back, whichever format it is in.
///
/// Nothing serves this over the API and nothing should -- the credential is
/// write-only as far as clients are concerned. It exists so the encrypted
/// write has a reader that proves it round-trips, and so whatever eventually
/// uses a credential to call a provider has one path that handles both the
/// rows written before encryption and the rows written after.
#[allow(dead_code)]
fn read_credential(
    conn: &rusqlite::Connection,
    id: &str,
) -> rusqlite::Result<Option<Result<String, String>>> {
    let row: Option<(String, String)> = conn
        .query_row(
            "SELECT credentials, credentials_format FROM provider_accounts WHERE id = ?1",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;

    let Some((stored, format)) = row else {
        return Ok(None);
    };

    if format != FORMAT_ENCRYPTED {
        return Ok(Some(Ok(stored)));
    }

    let Some(cipher) = credential_cipher(conn)? else {
        return Ok(Some(Err(format!(
            "credential is encrypted but {MASTER_KEY_ENV} is not set"
        ))));
    };

    Ok(Some(
        cipher.decrypt_string(&stored).map_err(|e| e.to_string()),
    ))
}

#[derive(Debug, Deserialize)]
pub struct CreateAccountRequest {
    pub provider: String,
    pub credentials: serde_json::Value,
}

/// List provider accounts
pub async fn list_accounts(state: web::Data<AppState>) -> impl Responder {
    let db = state.db.lock().unwrap();

    if let Err(e) = init_accounts_table(&db.conn) {
        return ApiResponse::<()>::error(&format!("Database error: {}", e));
    }

    let result: Result<Vec<serde_json::Value>, rusqlite::Error> = (|| {
        let mut stmt = db.conn.prepare(
            "SELECT id, provider, name, is_default, created_at, updated_at 
             FROM provider_accounts ORDER BY created_at DESC",
        )?;

        let accounts: Vec<serde_json::Value> = stmt
            .query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "provider": row.get::<_, String>(1)?,
                    "name": row.get::<_, String>(2)?,
                    "isDefault": row.get::<_, i32>(3)? == 1,
                    "createdAt": row.get::<_, i64>(4)?,
                    "updatedAt": row.get::<_, i64>(5)?,
                }))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(accounts)
    })();

    match result {
        Ok(accounts) => ApiResponse::success(accounts),
        Err(e) => ApiResponse::<()>::error(&format!("Database error: {}", e)),
    }
}

/// Create a provider account
///
/// The credential is encrypted with AES-256-GCM before it is written, under a
/// key derived from `CHASM_MASTER_KEY` and this install's salt.
///
/// It used to be written as plaintext JSON, because there was no key to
/// encrypt it with. There still is not one unless the operator supplies it, so
/// this refuses the write when the variable is unset rather than storing the
/// secret in the clear and saying nothing: an endpoint that accepts a
/// credential is understood to be protecting it, and a silent downgrade to
/// plaintext is the same defect as a spinner that downloads nothing.
///
/// Rows written before this change are still readable -- they carry
/// `credentials_format = 'plaintext'` and `read_credential` honours it -- but
/// nothing writes that format any more.
pub async fn create_account(
    state: web::Data<AppState>,
    body: web::Json<CreateAccountRequest>,
) -> impl Responder {
    let db = state.db.lock().unwrap();

    if let Err(e) = init_accounts_table(&db.conn) {
        return ApiResponse::<()>::error(&format!("Database error: {}", e));
    }

    let cipher = match credential_cipher(&db.conn) {
        Ok(c) => c,
        Err(e) => return ApiResponse::<()>::error(&format!("Database error: {e}")),
    };

    let id = uuid::Uuid::new_v4().to_string();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;
    let name = format!("{} Account", body.provider);
    let credentials_json = serde_json::to_string(&body.credentials).unwrap();

    let Some(cipher) = cipher else {
        return HttpResponse::BadRequest().json(ApiResponse::<()> {
            success: false,
            data: None,
            error: Some(format!(
                "Refusing to store a credential unencrypted. Set {MASTER_KEY_ENV} \
                 in the server's environment and restart, then try again."
            )),
        });
    };

    let stored = match cipher.encrypt_string(&credentials_json) {
        Ok(c) => c,
        Err(e) => return ApiResponse::<()>::error(&format!("Failed to encrypt credential: {e}")),
    };

    let result = db.conn.execute(
        "INSERT INTO provider_accounts (id, provider, name, credentials, credentials_format, is_default, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?7)",
        params![id, body.provider, name, stored, FORMAT_ENCRYPTED, now, now],
    );

    match result {
        Ok(_) => ApiResponse::success(serde_json::json!({
            "id": id,
            "provider": body.provider,
            "name": name,
            "isDefault": false,
            "createdAt": now,
            "updatedAt": now,
        })),
        Err(e) => ApiResponse::<()>::error(&format!("Failed to create account: {}", e)),
    }
}

/// Delete a provider account
pub async fn delete_account(state: web::Data<AppState>, path: web::Path<String>) -> impl Responder {
    let id = path.into_inner();
    let db = state.db.lock().unwrap();

    // Create the table if this is the first accounts call of the install, the
    // same as the list and create handlers do. Without it, a delete against a
    // database that has never listed accounts fails with "no such table" --
    // reported to the client as a database error rather than as the 404 it is.
    if let Err(e) = init_accounts_table(&db.conn) {
        return HttpResponse::InternalServerError().json(ApiResponse::<()> {
            success: false,
            data: None,
            error: Some(format!("Database error: {}", e)),
        });
    }

    let result = db
        .conn
        .execute("DELETE FROM provider_accounts WHERE id = ?1", params![id]);

    match result {
        Ok(0) => HttpResponse::NotFound().json(ApiResponse::<()> {
            success: false,
            data: None,
            error: Some("Account not found".to_string()),
        }),
        Ok(_) => ApiResponse::success(serde_json::json!({ "deleted": true })),
        Err(e) => ApiResponse::<()>::error(&format!("Failed to delete account: {}", e)),
    }
}

// =============================================================================
// System Endpoints
// =============================================================================

static START_TIME: std::sync::OnceLock<std::time::Instant> = std::sync::OnceLock::new();

/// Get system information
pub async fn get_system_info(state: web::Data<AppState>) -> impl Responder {
    let start = START_TIME.get_or_init(std::time::Instant::now);
    let uptime = start.elapsed().as_secs();

    let db = state.db.lock().unwrap();
    let db_size: i64 = db
        .conn
        .query_row(
            "SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    ApiResponse::success(serde_json::json!({
        "version": env!("CARGO_PKG_VERSION"),
        "status": "healthy",
        "uptime": uptime,
        "database": {
            "path": state.db_path,
            "sizeBytes": db_size,
        },
        "features": {
            "agents": true,
            "swarms": true,
            "mcp": true,
            "chat": true,
        }
    }))
}

/// Get system health
pub async fn get_system_health(state: web::Data<AppState>) -> impl Responder {
    let start = START_TIME.get_or_init(std::time::Instant::now);
    let uptime = start.elapsed().as_secs();

    // Try a simple DB query to verify connection.
    //
    // `query_row`, not `execute`: rusqlite's `execute` is for statements that
    // return no rows and fails with "Execute returned results" on any SELECT.
    // This check therefore always reported the database as broken -- it has
    // never once answered "healthy", on any install, however fine the database
    // was.
    let db = state.db.lock().unwrap();
    let db_ok = db
        .conn
        .query_row("SELECT 1", [], |row| row.get::<_, i64>(0))
        .is_ok();

    ApiResponse::success(serde_json::json!({
        "status": if db_ok { "healthy" } else { "degraded" },
        "version": env!("CARGO_PKG_VERSION"),
        "uptime": uptime,
        "checks": {
            "database": if db_ok { "ok" } else { "error" },
            "api": "ok"
        }
    }))
}

/// Get provider health status  
/// `GET /api/system/providers/health`
///
/// This used to return two hardcoded rows -- "copilot: connected, 45ms" and
/// "ollama: disconnected" -- regardless of what was actually running. Both
/// were invented, and the keys were wrong as well (`provider`/`lastCheck`
/// where the client reads `providerId`/`lastChecked`), so the UI's health map
/// was keyed by `undefined` and the fabrication never even landed.
///
/// Now it measures. Locally hosted providers declare an endpoint, so they get
/// a real request. Cloud providers report `unknown` rather than a guess: this
/// server holds no credentials for them, and an unauthenticated probe would
/// say nothing about whether the user's own access works.
pub async fn get_provider_health() -> impl Responder {
    let providers = all_providers();

    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(2))
        .build()
    {
        Ok(c) => c,
        Err(e) => return ApiResponse::<()>::error(&format!("HTTP client error: {e}")),
    };

    let checked_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);

    // Probed concurrently: serially, a dozen unreachable local providers would
    // each burn the full timeout and the endpoint would take half a minute.
    let checks = providers.iter().map(|p| {
        let client = &client;
        async move {
            match probe_url(p) {
                None => serde_json::json!({
                    "providerId": p.id,
                    "status": "unknown",
                    "latency": null,
                    "lastChecked": checked_at,
                    "error": "Not checked: no endpoint reachable from the server",
                    "models": p.models,
                }),
                Some(url) => {
                    let started = std::time::Instant::now();
                    let (status, error) = match client.get(&url).send().await {
                        Ok(r) if r.status().is_success() => ("connected", None),
                        Ok(r) => ("error", Some(format!("HTTP {}", r.status()))),
                        Err(e) if e.is_connect() || e.is_timeout() => ("disconnected", None),
                        Err(e) => ("error", Some(e.to_string())),
                    };
                    serde_json::json!({
                        "providerId": p.id,
                        "status": status,
                        // Only meaningful when something answered.
                        "latency": if status == "connected" {
                            Some(started.elapsed().as_millis() as u64)
                        } else {
                            None
                        },
                        "lastChecked": checked_at,
                        "error": error,
                        "models": p.models,
                    })
                }
            }
        }
    });

    let results: Vec<serde_json::Value> = futures_util::future::join_all(checks).await;
    ApiResponse::success(results)
}

/// Where to probe a provider, or `None` when it cannot be checked from here.
///
/// Gated on the provider being locally hosted, not merely on it declaring an
/// endpoint: several cloud providers declare one too (`api.openai.com/v1` and
/// friends). Probing those would have this health check fire unauthenticated
/// requests at third-party APIs from the user's machine, and report the
/// resulting 401 as `error` -- which says nothing about whether the user's own
/// credentials work. A health endpoint should not reach off the box.
fn probe_url(provider: &ProviderInfo) -> Option<String> {
    if provider.provider_type != "local" {
        return None;
    }
    let endpoint = provider.endpoint.as_deref()?.trim_end_matches('/');
    if endpoint.is_empty() {
        return None;
    }
    Some(if endpoint.ends_with("/v1") {
        // OpenAI-compatible surface.
        format!("{endpoint}/models")
    } else if provider.id == "ollama" {
        format!("{endpoint}/api/tags")
    } else {
        endpoint.to_string()
    })
}

#[cfg(test)]
mod provider_health_tests {
    use super::*;

    fn provider(id: &str) -> ProviderInfo {
        all_providers()
            .into_iter()
            .find(|p| p.id == id)
            .unwrap_or_else(|| panic!("no provider `{id}` in the catalogue"))
    }

    /// Call the handler and parse its JSON body.
    ///
    /// Matched rather than `expect`ed: the body's error type does not
    /// implement `Debug`, so `expect` will not compile here.
    async fn health_rows() -> Vec<serde_json::Value> {
        use actix_web::{body::to_bytes, Responder};

        let req = actix_web::test::TestRequest::default().to_http_request();
        let resp = get_provider_health().await.respond_to(&req);
        let body = match to_bytes(resp.into_body()).await {
            Ok(b) => b,
            Err(_) => panic!("could not read the response body"),
        };
        let parsed: serde_json::Value = serde_json::from_slice(&body).expect("json");
        parsed["data"].as_array().expect("data is an array").clone()
    }

    /// The database check must be able to succeed.
    ///
    /// It was written with `execute("SELECT 1")`, which rusqlite rejects for
    /// any statement that returns rows, so `db_ok` was always false: the
    /// endpoint reported `degraded` on every install it has ever run on,
    /// however healthy the database. A green-path assertion is the only kind
    /// that catches a check that can never pass.
    #[tokio::test]
    async fn system_health_reports_healthy_against_a_working_database() {
        use crate::api::AppState;
        use crate::ChatDatabase;
        use actix_web::{body::to_bytes, web::Data, Responder};

        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("health.db");
        let db = ChatDatabase::open(&path).unwrap();
        let state = Data::new(AppState::new(db, path));

        let req = actix_web::test::TestRequest::default().to_http_request();
        let resp = get_system_health(state).await.respond_to(&req);
        let body = match to_bytes(resp.into_body()).await {
            Ok(b) => b,
            Err(_) => panic!("could not read the response body"),
        };
        let parsed: serde_json::Value = serde_json::from_slice(&body).unwrap();

        assert_eq!(parsed["data"]["status"], "healthy");
        assert_eq!(parsed["data"]["checks"]["database"], "ok");
    }

    #[test]
    fn the_catalogue_is_shared_by_both_endpoints() {
        let all = all_providers();
        assert!(all.len() > 20, "catalogue looks truncated: {}", all.len());
        assert!(all.iter().any(|p| p.id == "ollama"));
        assert!(all.iter().any(|p| p.id == "copilot"));
    }

    /// Cloud providers must not be probed. This server holds no credentials
    /// for them, so any result would be a guess -- which is exactly what the
    /// old hardcoded `copilot: connected, 45ms` was.
    #[test]
    fn cloud_providers_are_not_probeable() {
        for id in ["copilot", "openai", "anthropic", "google", "cursor"] {
            assert!(
                probe_url(&provider(id)).is_none(),
                "{id} must not be probed from the server"
            );
        }
    }

    #[test]
    fn openai_compatible_endpoints_are_probed_at_models() {
        assert_eq!(
            probe_url(&provider("lm-studio")).as_deref(),
            Some("http://localhost:1234/v1/models")
        );
        assert_eq!(
            probe_url(&provider("jan")).as_deref(),
            Some("http://localhost:1337/v1/models")
        );
    }

    /// Ollama has no `/v1` surface at its declared endpoint; probing
    /// `/v1/models` there would report a running Ollama as down.
    #[test]
    fn ollama_is_probed_at_its_own_tags_endpoint() {
        assert_eq!(
            probe_url(&provider("ollama")).as_deref(),
            Some("http://localhost:11434/api/tags")
        );
    }

    #[test]
    fn an_endpoint_without_a_known_surface_is_probed_at_its_base() {
        assert_eq!(
            probe_url(&provider("tabby")).as_deref(),
            Some("http://localhost:8080")
        );
    }

    #[test]
    fn a_blank_endpoint_is_not_probeable() {
        let mut p = provider("ollama");
        p.endpoint = Some(String::new());
        assert!(probe_url(&p).is_none());
        p.endpoint = None;
        assert!(probe_url(&p).is_none());
    }

    /// Several cloud providers declare an endpoint. Probing them would send
    /// unauthenticated requests to third-party APIs from the user's machine.
    #[test]
    fn a_cloud_provider_is_not_probed_even_when_it_declares_an_endpoint() {
        let all = all_providers();
        let cloud_with_endpoint: Vec<_> = all
            .iter()
            .filter(|p| p.provider_type == "cloud" && p.endpoint.is_some())
            .collect();
        assert!(
            !cloud_with_endpoint.is_empty(),
            "expected at least one cloud provider to declare an endpoint; \
             if that changed, this guard is no longer exercised"
        );
        for p in cloud_with_endpoint {
            assert!(
                probe_url(p).is_none(),
                "{} is cloud-hosted and must not be probed",
                p.id
            );
        }
    }

    #[test]
    fn a_trailing_slash_does_not_produce_a_double_slash() {
        let mut p = provider("ollama");
        p.endpoint = Some("http://localhost:11434/".to_string());
        assert_eq!(
            probe_url(&p).as_deref(),
            Some("http://localhost:11434/api/tags")
        );

        p.endpoint = Some("http://localhost:1234/v1/".to_string());
        assert_eq!(
            probe_url(&p).as_deref(),
            Some("http://localhost:1234/v1/models")
        );
    }

    /// The client reads `providerId` and `lastChecked`. The old handler sent
    /// `provider` and `lastCheck`, so the UI keyed its health map by
    /// `undefined` and no status ever displayed.
    #[tokio::test]
    async fn the_response_uses_the_field_names_the_client_reads() {
        let rows = health_rows().await;
        assert!(!rows.is_empty());
        for row in &rows {
            assert!(row.get("providerId").is_some(), "missing providerId: {row}");
            assert!(
                row.get("lastChecked").is_some(),
                "missing lastChecked: {row}"
            );
            assert!(row.get("provider").is_none(), "stale `provider` key: {row}");
            assert!(
                row.get("lastCheck").is_none(),
                "stale `lastCheck` key: {row}"
            );

            let status = row["status"].as_str().unwrap_or_default();
            assert!(
                matches!(status, "connected" | "disconnected" | "error" | "unknown"),
                "status `{status}` is not in the client's ProviderStatus union"
            );
            // Latency is only reported when something actually answered.
            if status != "connected" {
                assert!(row["latency"].is_null(), "invented latency for {status}");
            }
        }
    }

    /// Nothing may report `connected` without a measurement behind it.
    #[tokio::test]
    async fn cloud_providers_report_unknown_not_connected() {
        let rows = health_rows().await;
        let copilot = rows
            .iter()
            .find(|r| r["providerId"] == "copilot")
            .expect("copilot row");
        assert_eq!(copilot["status"], "unknown");
        assert!(copilot["latency"].is_null());
    }
}

#[cfg(test)]
mod provider_settings_tests {
    use super::*;
    use crate::ChatDatabase;
    use actix_web::{test, App};
    use std::path::PathBuf;

    fn temp_state(tag: &str) -> (web::Data<AppState>, tempfile::TempDir) {
        let dir = tempfile::tempdir().expect("tempdir");
        let path: PathBuf = dir.path().join(format!("{tag}.db"));
        crate::commands::create_harvest_database(&path).expect("harvest schema");
        let db = ChatDatabase::open(&path).expect("open");
        (web::Data::new(AppState::new(db, path)), dir)
    }

    macro_rules! app {
        ($state:expr) => {
            test::init_service(
                App::new().app_data($state.clone()).service(
                    web::scope("/api")
                        .route("/providers", web::get().to(list_providers))
                        .route("/providers/{id}", web::put().to(update_provider)),
                ),
            )
            .await
        };
    }

    async fn body_json(resp: actix_web::dev::ServiceResponse) -> serde_json::Value {
        let bytes = test::read_body(resp).await;
        serde_json::from_slice(&bytes).expect("json body")
    }

    async fn list(state: &web::Data<AppState>) -> Vec<serde_json::Value> {
        let app = app!(state);
        let resp = test::call_service(
            &app,
            test::TestRequest::get().uri("/api/providers").to_request(),
        )
        .await;
        body_json(resp).await["data"]
            .as_array()
            .expect("data is an array")
            .clone()
    }

    /// Every provider carries the field, and it defaults to on.
    ///
    /// It did not exist at all before: the clients read `enabled` off each
    /// provider and the server never sent it, so `enabled ?? false` made the
    /// whole catalogue render as switched off and the screen's "enabled"
    /// count read 0 of 32 on every install.
    #[tokio::test]
    async fn enabled_is_present_and_defaults_on() {
        let (state, _dir) = temp_state("defaults");
        let providers = list(&state).await;

        assert!(!providers.is_empty(), "catalogue is empty");
        for p in &providers {
            assert_eq!(
                p["enabled"].as_bool(),
                Some(true),
                "provider {} has no enabled field, or defaults off",
                p["id"]
            );
        }
    }

    /// The whole point of the endpoint: the setting outlives the request.
    #[tokio::test]
    async fn disabling_a_provider_persists_to_the_next_list() {
        let (state, _dir) = temp_state("persist");
        let app = app!(&state);

        let resp = test::call_service(
            &app,
            test::TestRequest::put()
                .uri("/api/providers/openai")
                .set_json(serde_json::json!({ "enabled": false }))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 200);
        let body = body_json(resp).await;
        assert_eq!(body["data"]["enabled"].as_bool(), Some(false));
        assert_eq!(body["data"]["id"].as_str(), Some("openai"));

        let providers = list(&state).await;
        let openai = providers
            .iter()
            .find(|p| p["id"] == "openai")
            .expect("openai in catalogue");
        assert_eq!(openai["enabled"].as_bool(), Some(false));

        // Only the one that was touched.
        let others_on = providers
            .iter()
            .filter(|p| p["id"] != "openai")
            .all(|p| p["enabled"] == true);
        assert!(others_on, "disabling one provider changed the others");
    }

    /// Off and back on again, so the update is not one-way.
    #[tokio::test]
    async fn re_enabling_restores_the_provider() {
        let (state, _dir) = temp_state("toggle");
        let app = app!(&state);

        for enabled in [false, true] {
            let resp = test::call_service(
                &app,
                test::TestRequest::put()
                    .uri("/api/providers/ollama")
                    .set_json(serde_json::json!({ "enabled": enabled }))
                    .to_request(),
            )
            .await;
            assert_eq!(resp.status(), 200);

            let providers = list(&state).await;
            let ollama = providers.iter().find(|p| p["id"] == "ollama").unwrap();
            assert_eq!(ollama["enabled"].as_bool(), Some(enabled));
        }
    }

    /// An id outside the catalogue is a 404, not a stored row.
    ///
    /// Otherwise `provider_settings` would accumulate rows for providers that
    /// do not exist, and the client would get a 200 for a write that can
    /// never be read back.
    #[tokio::test]
    async fn unknown_provider_is_a_404() {
        let (state, _dir) = temp_state("unknown");
        let app = app!(&state);

        let resp = test::call_service(
            &app,
            test::TestRequest::put()
                .uri("/api/providers/not-a-provider")
                .set_json(serde_json::json!({ "enabled": false }))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 404);

        // and nothing was written
        let db = state.db.lock().unwrap();
        init_provider_settings_table(&db.conn).expect("table");
        let count: i64 = db
            .conn
            .query_row("SELECT COUNT(*) FROM provider_settings", [], |r| r.get(0))
            .expect("count");
        assert_eq!(count, 0, "a 404 still wrote a settings row");
    }

    /// The first call of an install must not fail on a missing table.
    ///
    /// This is the shape that bit `delete_account`: every other handler
    /// created the table first, so the one that did not only failed on a
    /// database that had never seen the feature.
    #[tokio::test]
    async fn update_works_before_any_list() {
        let (state, _dir) = temp_state("cold");
        let app = app!(&state);

        let resp = test::call_service(
            &app,
            test::TestRequest::put()
                .uri("/api/providers/anthropic")
                .set_json(serde_json::json!({ "enabled": false }))
                .to_request(),
        )
        .await;
        assert_eq!(resp.status(), 200, "cold update failed");
    }

    /// The response shape the clients actually read.
    ///
    /// `endpoint`, not `base_url`: the mobile screen read `base_url` and got
    /// undefined every time, which silently disabled its localhost check.
    #[tokio::test]
    async fn local_providers_are_typed_local_and_carry_an_endpoint() {
        let (state, _dir) = temp_state("shape");
        let providers = list(&state).await;

        let ollama = providers.iter().find(|p| p["id"] == "ollama").unwrap();
        assert_eq!(ollama["type"].as_str(), Some("local"));
        assert!(
            ollama["endpoint"].as_str().is_some(),
            "ollama has no endpoint field"
        );
        assert!(ollama["base_url"].is_null(), "base_url is not a field");

        // Copilot is cloud, whatever its id suggests.
        let copilot = providers.iter().find(|p| p["id"] == "copilot").unwrap();
        assert_eq!(copilot["type"].as_str(), Some("cloud"));
    }
}

#[cfg(test)]
mod credential_encryption_tests {
    use super::*;
    use crate::ChatDatabase;
    use actix_web::{test, App};
    use std::path::PathBuf;

    /// `CHASM_MASTER_KEY` is process-wide, so these tests must not run at the
    /// same time as one another. Rust runs tests in threads by default, and a
    /// test that unsets the variable while another is mid-write would flip
    /// that write to the refusal path and fail it for the wrong reason.
    /// Async-aware on purpose: every test below holds this across an `await`
    /// while it drives the handler, which a `std::sync::Mutex` must not be.
    static ENV_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

    struct MasterKey;

    impl MasterKey {
        fn set(value: &str) -> Self {
            std::env::set_var(MASTER_KEY_ENV, value);
            MasterKey
        }
        fn unset() -> Self {
            std::env::remove_var(MASTER_KEY_ENV);
            MasterKey
        }
    }

    impl Drop for MasterKey {
        fn drop(&mut self) {
            std::env::remove_var(MASTER_KEY_ENV);
        }
    }

    fn temp_state(tag: &str) -> (web::Data<AppState>, tempfile::TempDir) {
        let dir = tempfile::tempdir().expect("tempdir");
        let path: PathBuf = dir.path().join(format!("{tag}.db"));
        crate::commands::create_harvest_database(&path).expect("harvest schema");
        let db = ChatDatabase::open(&path).expect("open");
        (web::Data::new(AppState::new(db, path)), dir)
    }

    macro_rules! app {
        ($state:expr) => {
            test::init_service(
                App::new().app_data($state.clone()).service(
                    web::scope("/api")
                        .route("/settings/accounts", web::get().to(list_accounts))
                        .route("/settings/accounts", web::post().to(create_account)),
                ),
            )
            .await
        };
    }

    async fn post_account(
        state: &web::Data<AppState>,
        provider: &str,
    ) -> actix_web::dev::ServiceResponse {
        let app = app!(state);
        test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/settings/accounts")
                .set_json(serde_json::json!({
                    "provider": provider,
                    "credentials": { "apiKey": "sk-do-not-store-me" },
                }))
                .to_request(),
        )
        .await
    }

    /// The secret must not be findable in the database file.
    ///
    /// This is the assertion the feature exists for, so it reads the raw
    /// column rather than trusting the format tag: a row marked encrypted that
    /// still contains the key would pass a tag check and fail this.
    #[tokio::test]
    async fn a_stored_credential_is_not_recoverable_from_the_column() {
        let _guard = ENV_LOCK.lock().await;
        let _key = MasterKey::set("correct horse battery staple");
        let (state, _dir) = temp_state("encrypted");

        let resp = post_account(&state, "anthropic").await;
        assert_eq!(resp.status(), 200);

        let db = state.db.lock().unwrap();
        let (stored, format): (String, String) = db
            .conn
            .query_row(
                "SELECT credentials, credentials_format FROM provider_accounts",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .expect("the account row");

        assert_eq!(format, FORMAT_ENCRYPTED);
        assert!(
            !stored.contains("sk-do-not-store-me"),
            "the credential is still in the column: {stored}"
        );
        assert!(
            stored.contains("ciphertext"),
            "not an EncryptedData envelope: {stored}"
        );
    }

    /// Encrypted in must be the same thing out.
    #[tokio::test]
    async fn an_encrypted_credential_round_trips() {
        let _guard = ENV_LOCK.lock().await;
        let _key = MasterKey::set("correct horse battery staple");
        let (state, _dir) = temp_state("roundtrip");

        let resp = post_account(&state, "openai").await;
        assert_eq!(resp.status(), 200);
        let body: serde_json::Value =
            serde_json::from_slice(&test::read_body(resp).await).expect("json");
        let id = body["data"]["id"].as_str().expect("id").to_string();

        let db = state.db.lock().unwrap();
        let recovered = read_credential(&db.conn, &id)
            .expect("db")
            .expect("row exists")
            .expect("decrypts");
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&recovered).expect("json"),
            serde_json::json!({ "apiKey": "sk-do-not-store-me" })
        );
    }

    /// With no key configured the write is refused, not silently downgraded.
    ///
    /// The whole point: a 200 here would mean the secret went to disk in the
    /// clear while the client was told it was stored safely.
    #[tokio::test]
    async fn without_a_key_the_write_is_refused() {
        let _guard = ENV_LOCK.lock().await;
        let _key = MasterKey::unset();
        let (state, _dir) = temp_state("nokey");

        let resp = post_account(&state, "google").await;
        assert_eq!(resp.status(), 400);

        let db = state.db.lock().unwrap();
        let count: i64 = db
            .conn
            .query_row("SELECT COUNT(*) FROM provider_accounts", [], |r| r.get(0))
            .expect("count");
        assert_eq!(count, 0, "a refused write still stored a row");
    }

    /// Rows written before encryption existed are still readable.
    #[tokio::test]
    async fn a_plaintext_row_still_reads() {
        let _guard = ENV_LOCK.lock().await;
        let _key = MasterKey::set("correct horse battery staple");
        let (state, _dir) = temp_state("legacy");

        {
            let db = state.db.lock().unwrap();
            init_accounts_table(&db.conn).expect("table");
            db.conn
                .execute(
                    "INSERT INTO provider_accounts
                     (id, provider, name, credentials, credentials_format,
                      is_default, created_at, updated_at)
                     VALUES ('old', 'openai', 'OpenAI Account', ?1, 'plaintext', 0, 1, 1)",
                    params![r#"{"apiKey":"sk-written-before-encryption"}"#],
                )
                .expect("insert legacy row");
        }

        let db = state.db.lock().unwrap();
        let recovered = read_credential(&db.conn, "old")
            .expect("db")
            .expect("row exists")
            .expect("plaintext needs no key");
        assert!(recovered.contains("sk-written-before-encryption"));
    }

    /// A different key must not decrypt an existing credential.
    #[tokio::test]
    async fn the_wrong_key_does_not_decrypt() {
        let _guard = ENV_LOCK.lock().await;
        let (state, _dir) = temp_state("wrongkey");

        let id = {
            let _key = MasterKey::set("the right passphrase");
            let resp = post_account(&state, "mistral").await;
            assert_eq!(resp.status(), 200);
            let body: serde_json::Value =
                serde_json::from_slice(&test::read_body(resp).await).expect("json");
            body["data"]["id"].as_str().expect("id").to_string()
        };

        let _key = MasterKey::set("a different passphrase");
        let db = state.db.lock().unwrap();
        let outcome = read_credential(&db.conn, &id).expect("db").expect("row");
        assert!(outcome.is_err(), "the wrong key decrypted the credential");
    }

    /// The salt survives, so a credential outlives the process that wrote it.
    ///
    /// A salt regenerated per call would derive a different key each time and
    /// every stored credential would stop decrypting -- and because nothing
    /// reads credentials back today, that would go unnoticed until something
    /// finally did.
    #[tokio::test]
    async fn the_salt_is_stable_across_reads() {
        let _guard = ENV_LOCK.lock().await;
        let (state, _dir) = temp_state("salt");
        let db = state.db.lock().unwrap();

        let first = credential_salt(&db.conn).expect("salt");
        let second = credential_salt(&db.conn).expect("salt");
        assert_eq!(first, second);
        assert_eq!(first.len(), 16);
    }

    /// The listing still refuses to hand the credential back.
    #[tokio::test]
    async fn listing_accounts_never_returns_the_credential() {
        let _guard = ENV_LOCK.lock().await;
        let _key = MasterKey::set("correct horse battery staple");
        let (state, _dir) = temp_state("listing");

        assert_eq!(post_account(&state, "cohere").await.status(), 200);

        let app = app!(&state);
        let resp = test::call_service(
            &app,
            test::TestRequest::get()
                .uri("/api/settings/accounts")
                .to_request(),
        )
        .await;
        let raw = String::from_utf8(test::read_body(resp).await.to_vec()).expect("utf8");
        assert!(!raw.contains("credential"), "listing leaked a field: {raw}");
        assert!(!raw.contains("sk-do-not-store-me"));
    }
}

#[cfg(test)]
mod swarm_membership_tests {
    use super::*;
    use crate::ChatDatabase;
    use actix_web::{test, App};

    /// A swarm, an agent that really exists, and an app that routes both.
    async fn fixture() -> (tempfile::TempDir, web::Data<AppState>, String, String) {
        let dir = tempfile::tempdir().expect("tempdir");
        let db_path = dir.path().join("swarm-membership.db");
        crate::commands::create_harvest_database(&db_path).expect("schema");
        let db = ChatDatabase::open(&db_path).expect("open");
        let state = web::Data::new(AppState::new(db, db_path));

        let app = test::init_service(
            App::new()
                .app_data(state.clone())
                .configure(crate::api::configure_routes),
        )
        .await;

        let created = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/agents")
                .set_json(serde_json::json!({
                    "name": "a member",
                    "instruction": "do the thing"
                }))
                .to_request(),
        )
        .await;
        let body: serde_json::Value = test::read_body_json(created).await;
        let agent_id = body["data"]["id"].as_str().expect("agent id").to_string();

        let created = test::call_service(
            &app,
            test::TestRequest::post()
                .uri("/api/swarms")
                .set_json(serde_json::json!({
                    "name": "a swarm",
                    "orchestration": "sequential",
                    "agents": []
                }))
                .to_request(),
        )
        .await;
        let body: serde_json::Value = test::read_body_json(created).await;
        let swarm_id = body["data"]["id"].as_str().expect("swarm id").to_string();

        (dir, state, swarm_id, agent_id)
    }

    /// Read membership back through the swarm rather than trusting the
    /// response body: a handler echoing its own input proves no persistence.
    async fn members_of(state: &web::Data<AppState>, swarm_id: &str) -> Vec<serde_json::Value> {
        let app = test::init_service(
            App::new()
                .app_data(state.clone())
                .configure(crate::api::configure_routes),
        )
        .await;
        let swarm = test::call_service(
            &app,
            test::TestRequest::get()
                .uri(&format!("/api/swarms/{swarm_id}"))
                .to_request(),
        )
        .await;
        let body: serde_json::Value = test::read_body_json(swarm).await;
        body["data"]["agents"]
            .as_array()
            .cloned()
            .unwrap_or_default()
    }

    async fn post_member(
        state: &web::Data<AppState>,
        swarm_id: &str,
        body: serde_json::Value,
    ) -> u16 {
        let app = test::init_service(
            App::new()
                .app_data(state.clone())
                .configure(crate::api::configure_routes),
        )
        .await;
        let response = test::call_service(
            &app,
            test::TestRequest::post()
                .uri(&format!("/api/swarms/{swarm_id}/agents"))
                .set_json(body)
                .to_request(),
        )
        .await;
        response.status().as_u16()
    }

    #[tokio::test]
    async fn an_agent_can_be_added_and_is_still_there_afterwards() {
        let (_dir, state, swarm_id, agent_id) = fixture().await;

        let status = post_member(
            &state,
            &swarm_id,
            serde_json::json!({ "agent_id": agent_id, "role": "coordinator" }),
        )
        .await;
        assert_eq!(status, 200);

        let members = members_of(&state, &swarm_id).await;
        assert_eq!(members.len(), 1);
        assert_eq!(members[0]["agent_id"], agent_id.as_str());
        assert_eq!(members[0]["role"], "coordinator");
    }

    /// A swarm cannot hold one agent in two roles, so adding again re-roles it
    /// rather than duplicating it or refusing.
    #[tokio::test]
    async fn adding_the_same_agent_again_changes_its_role() {
        let (_dir, state, swarm_id, agent_id) = fixture().await;

        for role in ["coordinator", "reviewer"] {
            let status = post_member(
                &state,
                &swarm_id,
                serde_json::json!({ "agent_id": agent_id, "role": role }),
            )
            .await;
            assert_eq!(status, 200);
        }

        let members = members_of(&state, &swarm_id).await;
        assert_eq!(members.len(), 1, "the agent was duplicated");
        assert_eq!(members[0]["role"], "reviewer");
    }

    /// A membership pointing at no agent is a dangling reference that later
    /// reads as data.
    #[tokio::test]
    async fn an_agent_that_does_not_exist_is_refused_and_stores_nothing() {
        let (_dir, state, swarm_id, _agent_id) = fixture().await;

        let status = post_member(
            &state,
            &swarm_id,
            serde_json::json!({ "agent_id": "no-such-agent", "role": "coder" }),
        )
        .await;
        assert_eq!(status, 404);
        assert!(members_of(&state, &swarm_id).await.is_empty());
    }

    #[tokio::test]
    async fn a_swarm_that_does_not_exist_is_a_404() {
        let (_dir, state, _swarm_id, agent_id) = fixture().await;

        let status = post_member(
            &state,
            "no-such-swarm",
            serde_json::json!({ "agent_id": agent_id, "role": "coder" }),
        )
        .await;
        assert_eq!(status, 404);
    }

    #[tokio::test]
    async fn a_blank_agent_id_or_role_is_a_400() {
        let (_dir, state, swarm_id, agent_id) = fixture().await;

        for body in [
            serde_json::json!({ "agent_id": "  ", "role": "coder" }),
            serde_json::json!({ "agent_id": agent_id, "role": "" }),
        ] {
            assert_eq!(post_member(&state, &swarm_id, body).await, 400);
        }
    }

    #[tokio::test]
    async fn removing_takes_it_out_and_removing_again_is_404() {
        let (_dir, state, swarm_id, agent_id) = fixture().await;

        post_member(
            &state,
            &swarm_id,
            serde_json::json!({ "agent_id": agent_id, "role": "coder" }),
        )
        .await;

        let app = test::init_service(
            App::new()
                .app_data(state.clone())
                .configure(crate::api::configure_routes),
        )
        .await;

        let removed = test::call_service(
            &app,
            test::TestRequest::delete()
                .uri(&format!("/api/swarms/{swarm_id}/agents/{agent_id}"))
                .to_request(),
        )
        .await;
        assert_eq!(removed.status(), 200);
        assert!(members_of(&state, &swarm_id).await.is_empty());

        // A removal that removed nothing must not report success.
        let again = test::call_service(
            &app,
            test::TestRequest::delete()
                .uri(&format!("/api/swarms/{swarm_id}/agents/{agent_id}"))
                .to_request(),
        )
        .await;
        assert_eq!(again.status(), 404);
    }
}
