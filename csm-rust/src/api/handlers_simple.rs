//! Simplified API request and response handlers
//! 
//! This implementation works with the harvest database schema.

use actix_web::{web, HttpResponse, Responder};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};

use super::state::AppState;

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
        let content_lines = &lines[1..lines.len()-1];
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
        .filter(|s| !s.is_empty())
        .last()
        .unwrap_or(workspace_id)
        .to_string()
}

/// Look up workspace path from VS Code workspace storage
fn lookup_workspace_path(workspace_hash: &str) -> Option<String> {
    // VS Code stores workspace info in %APPDATA%/Code/User/workspaceStorage/<hash>/workspace.json
    let workspace_storage = dirs::config_dir()?.join("Code/User/workspaceStorage").join(workspace_hash).join("workspace.json");
    
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
            "SELECT w.id, w.name, w.path, w.provider, COUNT(s.id) as session_count
             FROM workspaces w
             LEFT JOIN sessions s ON w.id = s.workspace_id
             GROUP BY w.id
             ORDER BY MAX(s.updated_at) DESC, w.updated_at DESC"
        )?;
        
        let workspaces: Vec<serde_json::Value> = stmt
            .query_map([], |row| {
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
            })?
            .collect::<Result<Vec<_>, _>>()?;
        
        // If workspaces table is empty, derive workspaces from sessions
        if workspaces.is_empty() {
            let mut stmt = db.conn.prepare(
                "SELECT workspace_id, provider, COUNT(*) as session_count
                 FROM sessions
                 WHERE workspace_id IS NOT NULL AND workspace_id != ''
                 GROUP BY workspace_id
                 ORDER BY MAX(updated_at) DESC"
            )?;
            
            let derived: Vec<serde_json::Value> = stmt
                .query_map([], |row| {
                    let id: String = row.get(0)?;
                    let provider: String = row.get(1)?;
                    let count: i64 = row.get(2)?;
                    let (name, path) = get_workspace_info(&id);
                    Ok(serde_json::json!({
                        "id": id,
                        "name": name,
                        "path": path,
                        "provider": provider,
                        "session_count": count,
                    }))
                })?
                .collect::<Result<Vec<_>, _>>()?;
            
            return Ok(derived);
        }
        
        Ok::<_, rusqlite::Error>(workspaces)
    })();
    
    match result {
        Ok(workspaces) => ApiResponse::success(workspaces),
        Err(e) => ApiResponse::<()>::error(&e.to_string()),
    }
}

pub async fn get_workspace(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> impl Responder {
    let db = state.db.lock().unwrap();
    let workspace_id = path.into_inner();
    
    let result: Result<Option<serde_json::Value>, _> = (|| {
        let mut stmt = db.conn.prepare(
            "SELECT w.id, w.name, w.path, w.provider, COUNT(s.id) as session_count
             FROM workspaces w
             LEFT JOIN sessions s ON w.id = s.workspace_id
             WHERE w.id = ?1
             GROUP BY w.id"
        )?;
        
        let workspace = stmt.query_row([&workspace_id], |row| {
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
        }).optional()?;
        
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
             FROM sessions WHERE 1=1"
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
                    let workspace_name = workspace_id.as_ref().map(|id| derive_workspace_name(id));
                    Ok(serde_json::json!({
                        "id": row.get::<_, String>(0)?,
                        "provider": row.get::<_, String>(1)?,
                        "workspace_id": workspace_id,
                        "workspace_name": workspace_name,
                        "title": row.get::<_, String>(3)?,
                        "message_count": row.get::<_, i64>(4)?,
                        "created_at": row.get::<_, i64>(5)?,
                        "updated_at": row.get::<_, i64>(6)?,
                    }))
                },
            )?
            .collect::<Result<Vec<_>, _>>()?;
        
        Ok::<_, rusqlite::Error>(sessions)
    })();
    
    match result {
        Ok(sessions) => ApiResponse::success(sessions),
        Err(e) => ApiResponse::<()>::error(&e.to_string()),
    }
}

pub async fn get_session(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> impl Responder {
    let db = state.db.lock().unwrap();
    let session_id = path.into_inner();
    
    let result: Result<Option<serde_json::Value>, _> = (|| {
        // Get session info
        let mut stmt = db.conn.prepare(
            "SELECT id, provider, workspace_id, title, message_count,
                    created_at, updated_at, session_json
             FROM sessions WHERE id = ?1"
        )?;
        
        let session = stmt.query_row([&session_id], |row| {
            let session_json: String = row.get(7)?;
            let parsed: serde_json::Value = serde_json::from_str(&session_json)
                .unwrap_or(serde_json::json!({}));
            
            // Extract messages from session_json.requests
            let messages = extract_messages_from_session(&parsed);
            
            let workspace_id: Option<String> = row.get(2)?;
            let workspace_name = workspace_id.as_ref().map(|id| derive_workspace_name(id));
            
            Ok((serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "provider": row.get::<_, String>(1)?,
                "workspace_id": workspace_id,
                "workspace_name": workspace_name,
                "title": row.get::<_, String>(3)?,
                "message_count": row.get::<_, i64>(4)?,
                "created_at": row.get::<_, i64>(5)?,
                "updated_at": row.get::<_, i64>(6)?,
            }), messages, session_id.clone()))
        }).optional()?;
        
        if let Some((session, messages, sid)) = session {
            // Try to get enhanced data from messages_v2 and tool_invocations
            let tool_invocations = get_tool_invocations(&db.conn, &sid)?;
            let file_changes = get_file_changes(&db.conn, &sid)?;
            
            Ok::<_, rusqlite::Error>(Some(serde_json::json!({
                "session": session,
                "messages": messages,
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
fn extract_messages_from_session(session_json: &serde_json::Value) -> Vec<serde_json::Value> {
    let mut messages = Vec::new();
    
    if let Some(requests) = session_json.get("requests").and_then(|r| r.as_array()) {
        for (idx, request) in requests.iter().enumerate() {
            let timestamp = request.get("timestamp").and_then(|t| t.as_i64());
            let request_id = request.get("requestId").and_then(|r| r.as_str());
            let response_id = request.get("responseId").and_then(|r| r.as_str());
            let model_id = request.get("modelId").and_then(|m| m.as_str());
            let is_canceled = request.get("isCanceled").and_then(|c| c.as_bool()).unwrap_or(false);
            
            // Extract user message
            if let Some(message) = request.get("message") {
                let text = message.get("text")
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
                    let is_complete = item.get("isComplete").and_then(|c| c.as_bool()).unwrap_or(false);
                    let is_confirmed = item.get("isConfirmed");
                    
                    // Extract tool-specific data (contains file edits, terminal commands, etc.)
                    let tool_data = item.get("toolSpecificData");
                    
                    // Extract presentation data which may contain file paths for edits
                    let presentation = item.get("presentation");
                    
                    // Extract source which may have the tool input
                    let source = item.get("source");
                    
                    // Extract file changes from tool data, presentation, and source
                    let file_changes = extract_file_changes_from_tool(
                        tool_data,
                        presentation,
                        source,
                        tool_name
                    );
                    
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
                if let Some(uri) = data.get("uri").and_then(|u| u.as_str())
                    .or_else(|| data.get("path").and_then(|p| p.as_str())) {
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
            n if n.contains("replaceString") || n.contains("replace_string") 
                || n.contains("multiReplace") || n.contains("multi_replace") => {
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

fn get_tool_invocations(conn: &rusqlite::Connection, session_id: &str) -> Result<Vec<serde_json::Value>, rusqlite::Error> {
    // Check if table exists first
    let table_exists: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='tool_invocations'",
        [],
        |row| row.get(0),
    ).unwrap_or(false);
    
    if !table_exists {
        return Ok(Vec::new());
    }
    
    let mut stmt = conn.prepare(
        "SELECT id, message_id, tool_name, tool_call_id, invocation_index, 
                input_json, output_json, status, is_confirmed, timestamp
         FROM tool_invocations 
         WHERE session_id = ?1 
         ORDER BY message_id, invocation_index"
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

fn get_file_changes(conn: &rusqlite::Connection, session_id: &str) -> Result<Vec<serde_json::Value>, rusqlite::Error> {
    // Check if table exists first
    let table_exists: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='file_changes'",
        [],
        |row| row.get(0),
    ).unwrap_or(false);
    
    if !table_exists {
        return Ok(Vec::new());
    }
    
    let mut stmt = conn.prepare(
        "SELECT id, tool_invocation_id, file_path, change_type, 
                old_content, new_content, diff_unified, line_start, line_end, timestamp
         FROM file_changes 
         WHERE session_id = ?1 
         ORDER BY id"
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
    
    let result: Result<serde_json::Value, _> = (|| {
        let total_sessions: i64 = db.conn.query_row(
            "SELECT COUNT(*) FROM sessions",
            [],
            |row| row.get(0),
        )?;
        
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
            db.conn.query_row("SELECT COUNT(*) FROM messages_v2", [], |row| row.get(0)).unwrap_or(0)
        } else {
            // Fallback: estimate from session message_count
            db.conn.query_row("SELECT COALESCE(SUM(message_count), 0) FROM sessions", [], |row| row.get(0)).unwrap_or(0)
        };
        
        let total_tool_invocations: i64 = if tool_invocations_exists {
            db.conn.query_row("SELECT COUNT(*) FROM tool_invocations", [], |row| row.get(0)).unwrap_or(0)
        } else {
            0
        };
        
        let total_file_changes: i64 = if file_changes_exists {
            db.conn.query_row("SELECT COUNT(*) FROM file_changes", [], |row| row.get(0)).unwrap_or(0)
        } else {
            0
        };
        
        let mut stmt = db.conn.prepare(
            "SELECT provider, COUNT(*) FROM sessions GROUP BY provider ORDER BY COUNT(*) DESC"
        )?;
        
        let by_provider: std::collections::HashMap<String, i64> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .collect::<Result<_, _>>()?;
        
        Ok::<_, rusqlite::Error>(serde_json::json!({
            "total_sessions": total_sessions,
            "total_messages": total_messages,
            "total_tool_invocations": total_tool_invocations,
            "total_file_changes": total_file_changes,
            "tables_enhanced": messages_v2_exists,
            "by_provider": by_provider,
        }))
    })();
    
    match result {
        Ok(stats) => ApiResponse::success(stats),
        Err(e) => ApiResponse::<()>::error(&e.to_string()),
    }
}

// =============================================================================
// Provider Handlers (stub)
// =============================================================================

pub async fn list_providers() -> impl Responder {
    // Return list of known providers
    ApiResponse::success(serde_json::json!([
        { "id": "copilot", "name": "GitHub Copilot" },
        { "id": "cursor", "name": "Cursor" },
        { "id": "chatgpt", "name": "ChatGPT" },
        { "id": "claude", "name": "Claude" },
        { "id": "ollama", "name": "Ollama" },
        { "id": "lm-studio", "name": "LM Studio" },
    ]))
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
        .map(|t| serde_json::json!({
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": t.input_schema,
            }
        }))
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
    let results: Vec<serde_json::Value> = request.calls
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
        .filter(|t| t.name.starts_with("csm_db_"))  // Only database tools for chat
        .map(|t| format!("- {}: {}", t.name, t.description.as_ref().unwrap_or(&String::new())))
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