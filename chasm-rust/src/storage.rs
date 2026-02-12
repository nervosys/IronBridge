// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only
//! VS Code storage (SQLite database) operations

use crate::error::{CsmError, Result};
use crate::models::{
    ChatRequest, ChatSession, ChatSessionIndex, ChatSessionIndexEntry, ChatSessionTiming,
};
use crate::workspace::{get_empty_window_sessions_path, get_workspace_storage_path};
use once_cell::sync::Lazy;
use regex::Regex;
use rusqlite::Connection;
use std::path::{Path, PathBuf};
use sysinfo::System;

/// Regex to match any Unicode escape sequence (valid or not)
static UNICODE_ESCAPE_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"\\u[0-9a-fA-F]{4}").unwrap());

/// VS Code session format version - helps identify which parsing strategy to use
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VsCodeSessionFormat {
    /// Legacy JSON format (VS Code < 1.109.0)
    /// Single JSON object with ChatSession structure
    LegacyJson,
    /// JSONL format (VS Code >= 1.109.0, January 2026+)
    /// JSON Lines with event sourcing: kind 0 (initial), kind 1 (delta), kind 2 (requests)
    JsonLines,
}

/// Session schema version - tracks the internal structure version
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum SessionSchemaVersion {
    /// Version 1 - Original format (basic fields)
    V1 = 1,
    /// Version 2 - Added more metadata fields
    V2 = 2,
    /// Version 3 - Current format with full request/response structure
    V3 = 3,
    /// Unknown version
    Unknown = 0,
}

impl SessionSchemaVersion {
    /// Create from version number
    pub fn from_version(v: u32) -> Self {
        match v {
            1 => Self::V1,
            2 => Self::V2,
            3 => Self::V3,
            _ => Self::Unknown,
        }
    }

    /// Get version number
    pub fn version_number(&self) -> u32 {
        match self {
            Self::V1 => 1,
            Self::V2 => 2,
            Self::V3 => 3,
            Self::Unknown => 0,
        }
    }

    /// Get description
    pub fn description(&self) -> &'static str {
        match self {
            Self::V1 => "v1 (basic)",
            Self::V2 => "v2 (extended metadata)",
            Self::V3 => "v3 (full structure)",
            Self::Unknown => "unknown",
        }
    }
}

impl std::fmt::Display for SessionSchemaVersion {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.description())
    }
}

/// Result of session format detection
#[derive(Debug, Clone)]
pub struct SessionFormatInfo {
    /// File format (JSON or JSONL)
    pub format: VsCodeSessionFormat,
    /// Schema version detected from content
    pub schema_version: SessionSchemaVersion,
    /// Confidence level (0.0 - 1.0)
    pub confidence: f32,
    /// Detection method used
    pub detection_method: &'static str,
}

impl VsCodeSessionFormat {
    /// Detect format from file path (by extension)
    pub fn from_path(path: &Path) -> Self {
        match path.extension().and_then(|e| e.to_str()) {
            Some("jsonl") => Self::JsonLines,
            _ => Self::LegacyJson,
        }
    }

    /// Detect format from content by analyzing structure
    pub fn from_content(content: &str) -> Self {
        let trimmed = content.trim();

        // JSONL: Multiple lines starting with { or first line has {"kind":
        if trimmed.starts_with("{\"kind\":") || trimmed.starts_with("{ \"kind\":") {
            return Self::JsonLines;
        }

        // Count lines that look like JSON objects
        let mut json_object_lines = 0;
        let mut total_non_empty_lines = 0;

        for line in trimmed.lines().take(10) {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            total_non_empty_lines += 1;

            // Check if line is a JSON object with "kind" field (JSONL marker)
            if line.starts_with('{') && line.contains("\"kind\"") {
                json_object_lines += 1;
            }
        }

        // If multiple lines look like JSONL entries, it's JSONL
        if json_object_lines >= 2
            || (json_object_lines == 1 && total_non_empty_lines == 1 && trimmed.contains("\n{"))
        {
            return Self::JsonLines;
        }

        // Check if it's a single JSON object (legacy format)
        if trimmed.starts_with('{') && trimmed.ends_with('}') {
            // Look for ChatSession structure markers
            if trimmed.contains("\"sessionId\"")
                || trimmed.contains("\"creationDate\"")
                || trimmed.contains("\"requests\"")
            {
                return Self::LegacyJson;
            }
        }

        // Default to legacy JSON if unclear
        Self::LegacyJson
    }

    /// Get minimum VS Code version that uses this format
    pub fn min_vscode_version(&self) -> &'static str {
        match self {
            Self::LegacyJson => "1.0.0",
            Self::JsonLines => "1.109.0",
        }
    }

    /// Get human-readable format description
    pub fn description(&self) -> &'static str {
        match self {
            Self::LegacyJson => "Legacy JSON (single object)",
            Self::JsonLines => "JSON Lines (event-sourced, VS Code 1.109.0+)",
        }
    }

    /// Get short format name
    pub fn short_name(&self) -> &'static str {
        match self {
            Self::LegacyJson => "json",
            Self::JsonLines => "jsonl",
        }
    }
}

impl std::fmt::Display for VsCodeSessionFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.description())
    }
}

/// Sanitize JSON content by replacing lone surrogates with replacement character.
/// VS Code sometimes writes invalid JSON with lone Unicode surrogates (e.g., \udde0).
fn sanitize_json_unicode(content: &str) -> String {
    // Process all \uXXXX sequences and fix lone surrogates
    let mut result = String::with_capacity(content.len());
    let mut last_end = 0;

    // Collect all matches first to avoid borrowing issues
    let matches: Vec<_> = UNICODE_ESCAPE_RE.find_iter(content).collect();

    for (i, mat) in matches.iter().enumerate() {
        let start = mat.start();
        let end = mat.end();

        // Add content before this match
        result.push_str(&content[last_end..start]);

        // Parse the hex value from the match itself (always ASCII \uXXXX)
        let hex_str = &mat.as_str()[2..]; // Skip the \u prefix
        if let Ok(code_point) = u16::from_str_radix(hex_str, 16) {
            // Check if it's a high surrogate (D800-DBFF)
            if (0xD800..=0xDBFF).contains(&code_point) {
                // Check if next match is immediately following and is a low surrogate
                let is_valid_pair = if let Some(next_mat) = matches.get(i + 1) {
                    // Must be immediately adjacent (no gap)
                    if next_mat.start() == end {
                        let next_hex = &next_mat.as_str()[2..];
                        if let Ok(next_cp) = u16::from_str_radix(next_hex, 16) {
                            (0xDC00..=0xDFFF).contains(&next_cp)
                        } else {
                            false
                        }
                    } else {
                        false
                    }
                } else {
                    false
                };

                if is_valid_pair {
                    // Valid surrogate pair, keep the high surrogate
                    result.push_str(mat.as_str());
                } else {
                    // Lone high surrogate - replace with replacement char
                    result.push_str("\\uFFFD");
                }
            }
            // Check if it's a low surrogate (DC00-DFFF)
            else if (0xDC00..=0xDFFF).contains(&code_point) {
                // Check if previous match was immediately before and was a high surrogate
                let is_valid_pair = if i > 0 {
                    if let Some(prev_mat) = matches.get(i - 1) {
                        // Must be immediately adjacent (no gap)
                        if prev_mat.end() == start {
                            let prev_hex = &prev_mat.as_str()[2..];
                            if let Ok(prev_cp) = u16::from_str_radix(prev_hex, 16) {
                                (0xD800..=0xDBFF).contains(&prev_cp)
                            } else {
                                false
                            }
                        } else {
                            false
                        }
                    } else {
                        false
                    }
                } else {
                    false
                };

                if is_valid_pair {
                    // Part of valid surrogate pair, keep it
                    result.push_str(mat.as_str());
                } else {
                    // Lone low surrogate - replace with replacement char
                    result.push_str("\\uFFFD");
                }
            }
            // Normal code point
            else {
                result.push_str(mat.as_str());
            }
        } else {
            // Invalid hex - keep as is
            result.push_str(mat.as_str());
        }
        last_end = end;
    }

    // Add remaining content
    result.push_str(&content[last_end..]);
    result
}

/// Try to parse JSON, sanitizing invalid Unicode if needed
pub fn parse_session_json(content: &str) -> std::result::Result<ChatSession, serde_json::Error> {
    match serde_json::from_str::<ChatSession>(content) {
        Ok(session) => Ok(session),
        Err(e) => {
            // If parsing fails due to Unicode issue, try sanitizing
            if e.to_string().contains("surrogate") || e.to_string().contains("escape") {
                let sanitized = sanitize_json_unicode(content);
                serde_json::from_str::<ChatSession>(&sanitized)
            } else {
                Err(e)
            }
        }
    }
}

/// JSONL entry kinds for VS Code 1.109.0+ session format
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum JsonlKind {
    /// Initial session state (kind: 0)
    Initial = 0,
    /// Delta update to specific keys (kind: 1)  
    Delta = 1,
    /// Full requests array update (kind: 2)
    RequestsUpdate = 2,
}

/// Parse a JSONL (JSON Lines) session file (VS Code 1.109.0+ format)
/// Each line is a JSON object with 'kind' field indicating the type:
/// - kind 0: Initial session metadata with 'v' containing ChatSession-like structure
/// - kind 1: Delta update with 'k' (keys path) and 'v' (value)
/// - kind 2: Full requests array update with 'k' and 'v'
pub fn parse_session_jsonl(content: &str) -> std::result::Result<ChatSession, serde_json::Error> {
    let mut session = ChatSession {
        version: 3,
        session_id: None,
        creation_date: 0,
        last_message_date: 0,
        is_imported: false,
        initial_location: "panel".to_string(),
        custom_title: None,
        requester_username: None,
        requester_avatar_icon_uri: None,
        responder_username: None,
        responder_avatar_icon_uri: None,
        requests: Vec::new(),
    };

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        // Parse each line as a JSON object
        let entry: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => {
                // Try sanitizing Unicode
                let sanitized = sanitize_json_unicode(line);
                serde_json::from_str(&sanitized)?
            }
        };

        let kind = entry.get("kind").and_then(|k| k.as_u64()).unwrap_or(0);

        match kind {
            0 => {
                // Initial state - 'v' contains the session metadata
                if let Some(v) = entry.get("v") {
                    // Parse version
                    if let Some(version) = v.get("version").and_then(|x| x.as_u64()) {
                        session.version = version as u32;
                    }
                    // Parse session ID
                    if let Some(sid) = v.get("sessionId").and_then(|x| x.as_str()) {
                        session.session_id = Some(sid.to_string());
                    }
                    // Parse creation date
                    if let Some(cd) = v.get("creationDate").and_then(|x| x.as_i64()) {
                        session.creation_date = cd;
                    }
                    // Parse initial location
                    if let Some(loc) = v.get("initialLocation").and_then(|x| x.as_str()) {
                        session.initial_location = loc.to_string();
                    }
                    // Parse responder username
                    if let Some(ru) = v.get("responderUsername").and_then(|x| x.as_str()) {
                        session.responder_username = Some(ru.to_string());
                    }
                    // Parse custom title
                    if let Some(title) = v.get("customTitle").and_then(|x| x.as_str()) {
                        session.custom_title = Some(title.to_string());
                    }
                    // Parse hasPendingEdits as imported marker
                    if let Some(imported) = v.get("isImported").and_then(|x| x.as_bool()) {
                        session.is_imported = imported;
                    }
                    // Parse requests array if present
                    if let Some(requests) = v.get("requests") {
                        if let Ok(reqs) =
                            serde_json::from_value::<Vec<ChatRequest>>(requests.clone())
                        {
                            session.requests = reqs;
                            // Compute last_message_date from the latest request timestamp
                            if let Some(latest_ts) = session.requests.iter()
                                .filter_map(|r| r.timestamp)
                                .max()
                            {
                                session.last_message_date = latest_ts;
                            }
                        }
                    }
                    // Fall back to creationDate if no request timestamps found
                    if session.last_message_date == 0 {
                        session.last_message_date = session.creation_date;
                    }
                }
            }
            1 => {
                // Delta update - 'k' is array of key path, 'v' is the value
                if let (Some(keys), Some(value)) = (entry.get("k"), entry.get("v")) {
                    if let Some(keys_arr) = keys.as_array() {
                        // Handle top-level session keys
                        if keys_arr.len() == 1 {
                            if let Some(key) = keys_arr[0].as_str() {
                                match key {
                                    "customTitle" => {
                                        if let Some(title) = value.as_str() {
                                            session.custom_title = Some(title.to_string());
                                        }
                                    }
                                    "lastMessageDate" => {
                                        if let Some(date) = value.as_i64() {
                                            session.last_message_date = date;
                                        }
                                    }
                                    "hasPendingEdits" | "isImported" => {
                                        // Session-level boolean updates, safe to ignore for now
                                    }
                                    _ => {} // Ignore unknown keys
                                }
                            }
                        }
                        // Handle nested request field updates: ["requests", idx, field]
                        else if keys_arr.len() == 3 {
                            if let (Some("requests"), Some(idx), Some(field)) = (
                                keys_arr[0].as_str(),
                                keys_arr[1].as_u64().map(|i| i as usize),
                                keys_arr[2].as_str(),
                            ) {
                                if idx < session.requests.len() {
                                    match field {
                                        "response" => {
                                            session.requests[idx].response = Some(value.clone());
                                        }
                                        "result" => {
                                            session.requests[idx].result = Some(value.clone());
                                        }
                                        "followups" => {
                                            session.requests[idx].followups =
                                                serde_json::from_value(value.clone()).ok();
                                        }
                                        "isCanceled" => {
                                            session.requests[idx].is_canceled = value.as_bool();
                                        }
                                        "contentReferences" => {
                                            session.requests[idx].content_references =
                                                serde_json::from_value(value.clone()).ok();
                                        }
                                        "codeCitations" => {
                                            session.requests[idx].code_citations =
                                                serde_json::from_value(value.clone()).ok();
                                        }
                                        "modelState" | "modelId" | "agent" | "variableData" => {
                                            // Known request fields - update as generic Value
                                            // modelState tracks the request lifecycle
                                        }
                                        _ => {} // Ignore unknown request fields
                                    }
                                }
                            }
                        }
                    }
                }
            }
            2 => {
                // Array append operation - 'k' is the key path, 'v' is array of items to append
                if let (Some(keys), Some(value)) = (entry.get("k"), entry.get("v")) {
                    if let Some(keys_arr) = keys.as_array() {
                        // Top-level requests append: k=["requests"], v=[new_request]
                        if keys_arr.len() == 1 {
                            if let Some("requests") = keys_arr[0].as_str() {
                                if let Some(items) = value.as_array() {
                                    for item in items {
                                        if let Ok(req) =
                                            serde_json::from_value::<ChatRequest>(item.clone())
                                        {
                                            session.requests.push(req);
                                        }
                                    }
                                    // Update last message date from latest request
                                    if let Some(last_req) = session.requests.last() {
                                        if let Some(ts) = last_req.timestamp {
                                            session.last_message_date = ts;
                                        }
                                    }
                                }
                            }
                        }
                        // Nested array append: k=["requests", idx, "response"], v=[parts]
                        // These are response streaming chunks - we can safely ignore them
                        // since the final response is captured via kind:1 updates
                    }
                }
            }
            _ => {} // Unknown kind, skip
        }
    }

    Ok(session)
}

/// Check if a file extension indicates a session file (.json or .jsonl)
pub fn is_session_file_extension(ext: &std::ffi::OsStr) -> bool {
    ext == "json" || ext == "jsonl"
}

/// Detect session format and version from content
pub fn detect_session_format(content: &str) -> SessionFormatInfo {
    let format = VsCodeSessionFormat::from_content(content);
    let trimmed = content.trim();

    // Detect schema version based on format
    let (schema_version, confidence, method) = match format {
        VsCodeSessionFormat::JsonLines => {
            // For JSONL, check the first line's "v" object for version
            if let Some(first_line) = trimmed.lines().next() {
                if let Ok(entry) = serde_json::from_str::<serde_json::Value>(first_line) {
                    if let Some(v) = entry.get("v") {
                        if let Some(ver) = v.get("version").and_then(|x| x.as_u64()) {
                            (
                                SessionSchemaVersion::from_version(ver as u32),
                                0.95,
                                "jsonl-version-field",
                            )
                        } else {
                            // No version field, likely v3 (current default)
                            (SessionSchemaVersion::V3, 0.7, "jsonl-default")
                        }
                    } else {
                        (SessionSchemaVersion::V3, 0.6, "jsonl-no-v-field")
                    }
                } else {
                    (SessionSchemaVersion::Unknown, 0.3, "jsonl-parse-error")
                }
            } else {
                (SessionSchemaVersion::Unknown, 0.2, "jsonl-empty")
            }
        }
        VsCodeSessionFormat::LegacyJson => {
            // For JSON, directly check the version field
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(trimmed) {
                if let Some(ver) = json.get("version").and_then(|x| x.as_u64()) {
                    (
                        SessionSchemaVersion::from_version(ver as u32),
                        0.95,
                        "json-version-field",
                    )
                } else {
                    // Infer from structure
                    if json.get("requests").is_some() && json.get("sessionId").is_some() {
                        (SessionSchemaVersion::V3, 0.8, "json-structure-inference")
                    } else if json.get("messages").is_some() {
                        (SessionSchemaVersion::V1, 0.7, "json-legacy-structure")
                    } else {
                        (SessionSchemaVersion::Unknown, 0.4, "json-unknown-structure")
                    }
                }
            } else {
                // Try sanitizing and parsing again
                let sanitized = sanitize_json_unicode(trimmed);
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&sanitized) {
                    if let Some(ver) = json.get("version").and_then(|x| x.as_u64()) {
                        (
                            SessionSchemaVersion::from_version(ver as u32),
                            0.9,
                            "json-version-after-sanitize",
                        )
                    } else {
                        (SessionSchemaVersion::V3, 0.6, "json-default-after-sanitize")
                    }
                } else {
                    (SessionSchemaVersion::Unknown, 0.2, "json-parse-error")
                }
            }
        }
    };

    SessionFormatInfo {
        format,
        schema_version,
        confidence,
        detection_method: method,
    }
}

/// Parse session content with automatic format detection
pub fn parse_session_auto(
    content: &str,
) -> std::result::Result<(ChatSession, SessionFormatInfo), serde_json::Error> {
    let format_info = detect_session_format(content);

    let session = match format_info.format {
        VsCodeSessionFormat::JsonLines => parse_session_jsonl(content)?,
        VsCodeSessionFormat::LegacyJson => parse_session_json(content)?,
    };

    Ok((session, format_info))
}

/// Parse a session file, automatically detecting format from content (not just extension)
pub fn parse_session_file(path: &Path) -> std::result::Result<ChatSession, serde_json::Error> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| serde_json::Error::io(std::io::Error::other(e.to_string())))?;

    // Use content-based auto-detection
    let (session, _format_info) = parse_session_auto(&content)?;
    Ok(session)
}

/// Get the path to the workspace storage database
pub fn get_workspace_storage_db(workspace_id: &str) -> Result<PathBuf> {
    let storage_path = get_workspace_storage_path()?;
    Ok(storage_path.join(workspace_id).join("state.vscdb"))
}

/// Read the chat session index from VS Code storage
pub fn read_chat_session_index(db_path: &Path) -> Result<ChatSessionIndex> {
    let conn = Connection::open(db_path)?;

    let result: std::result::Result<String, rusqlite::Error> = conn.query_row(
        "SELECT value FROM ItemTable WHERE key = ?",
        ["chat.ChatSessionStore.index"],
        |row| row.get(0),
    );

    match result {
        Ok(json_str) => serde_json::from_str(&json_str)
            .map_err(|e| CsmError::InvalidSessionFormat(e.to_string())),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(ChatSessionIndex::default()),
        Err(e) => Err(CsmError::SqliteError(e)),
    }
}

/// Write the chat session index to VS Code storage
pub fn write_chat_session_index(db_path: &Path, index: &ChatSessionIndex) -> Result<()> {
    let conn = Connection::open(db_path)?;
    let json_str = serde_json::to_string(index)?;

    // Check if the key exists
    let exists: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM ItemTable WHERE key = ?",
        ["chat.ChatSessionStore.index"],
        |row| row.get(0),
    )?;

    if exists {
        conn.execute(
            "UPDATE ItemTable SET value = ? WHERE key = ?",
            [&json_str, "chat.ChatSessionStore.index"],
        )?;
    } else {
        conn.execute(
            "INSERT INTO ItemTable (key, value) VALUES (?, ?)",
            ["chat.ChatSessionStore.index", &json_str],
        )?;
    }

    Ok(())
}

/// Add a session to the VS Code index
pub fn add_session_to_index(
    db_path: &Path,
    session_id: &str,
    title: &str,
    last_message_date_ms: i64,
    _is_imported: bool,
    initial_location: &str,
    is_empty: bool,
) -> Result<()> {
    let mut index = read_chat_session_index(db_path)?;

    index.entries.insert(
        session_id.to_string(),
        ChatSessionIndexEntry {
            session_id: session_id.to_string(),
            title: title.to_string(),
            last_message_date: last_message_date_ms,
            timing: Some(ChatSessionTiming {
                created: last_message_date_ms,
                last_request_started: Some(last_message_date_ms),
                last_request_ended: Some(last_message_date_ms),
            }),
            last_response_state: 1, // ResponseModelState.Complete
            initial_location: initial_location.to_string(),
            is_empty,
        },
    );

    write_chat_session_index(db_path, &index)
}

/// Remove a session from the VS Code index
#[allow(dead_code)]
pub fn remove_session_from_index(db_path: &Path, session_id: &str) -> Result<bool> {
    let mut index = read_chat_session_index(db_path)?;
    let removed = index.entries.remove(session_id).is_some();
    if removed {
        write_chat_session_index(db_path, &index)?;
    }
    Ok(removed)
}

/// Sync the VS Code index with sessions on disk (remove stale entries, add missing ones)
/// When both .json and .jsonl exist for the same session ID, prefers .jsonl.
pub fn sync_session_index(
    workspace_id: &str,
    chat_sessions_dir: &Path,
    force: bool,
) -> Result<(usize, usize)> {
    let db_path = get_workspace_storage_db(workspace_id)?;

    if !db_path.exists() {
        return Err(CsmError::WorkspaceNotFound(format!(
            "Database not found: {}",
            db_path.display()
        )));
    }

    // Check if VS Code is running
    if !force && is_vscode_running() {
        return Err(CsmError::VSCodeRunning);
    }

    // Get current index
    let mut index = read_chat_session_index(&db_path)?;

    // Get session files on disk
    let mut files_on_disk: std::collections::HashSet<String> = std::collections::HashSet::new();
    if chat_sessions_dir.exists() {
        for entry in std::fs::read_dir(chat_sessions_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path
                .extension()
                .map(is_session_file_extension)
                .unwrap_or(false)
            {
                if let Some(stem) = path.file_stem() {
                    files_on_disk.insert(stem.to_string_lossy().to_string());
                }
            }
        }
    }

    // Remove stale entries (in index but not on disk)
    let stale_ids: Vec<String> = index
        .entries
        .keys()
        .filter(|id| !files_on_disk.contains(*id))
        .cloned()
        .collect();

    let removed = stale_ids.len();
    for id in &stale_ids {
        index.entries.remove(id);
    }

    // Add/update sessions from disk
    // Collect files, preferring .jsonl over .json for the same session ID
    let mut session_files: std::collections::HashMap<String, PathBuf> =
        std::collections::HashMap::new();
    for entry in std::fs::read_dir(chat_sessions_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path
            .extension()
            .map(is_session_file_extension)
            .unwrap_or(false)
        {
            if let Some(stem) = path.file_stem() {
                let stem_str = stem.to_string_lossy().to_string();
                let is_jsonl = path.extension().is_some_and(|e| e == "jsonl");
                // Insert if no entry yet, or if this is .jsonl (preferred over .json)
                if !session_files.contains_key(&stem_str) || is_jsonl {
                    session_files.insert(stem_str, path);
                }
            }
        }
    }

    let mut added = 0;
    for (_, path) in &session_files {
        if let Ok(session) = parse_session_file(path) {
            let session_id = session.session_id.clone().unwrap_or_else(|| {
                path.file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_else(|| uuid::Uuid::new_v4().to_string())
            });

            let title = session.title();
            let is_empty = session.is_empty();
            let last_message_date = session.last_message_date;
            let initial_location = session.initial_location.clone();

            index.entries.insert(
                session_id.clone(),
                ChatSessionIndexEntry {
                    session_id,
                    title,
                    last_message_date,
                    timing: Some(ChatSessionTiming {
                        created: session.creation_date,
                        last_request_started: Some(last_message_date),
                        last_request_ended: Some(last_message_date),
                    }),
                    last_response_state: 1, // ResponseModelState.Complete
                    initial_location,
                    is_empty,
                },
            );
            added += 1;
        }
    }

    // Write the synced index
    write_chat_session_index(&db_path, &index)?;

    Ok((added, removed))
}

/// Register all sessions from a directory into the VS Code index
pub fn register_all_sessions_from_directory(
    workspace_id: &str,
    chat_sessions_dir: &Path,
    force: bool,
) -> Result<usize> {
    let db_path = get_workspace_storage_db(workspace_id)?;

    if !db_path.exists() {
        return Err(CsmError::WorkspaceNotFound(format!(
            "Database not found: {}",
            db_path.display()
        )));
    }

    // Check if VS Code is running
    if !force && is_vscode_running() {
        return Err(CsmError::VSCodeRunning);
    }

    // Use sync to ensure index matches disk
    let (added, removed) = sync_session_index(workspace_id, chat_sessions_dir, force)?;

    // Print individual session info
    for entry in std::fs::read_dir(chat_sessions_dir)? {
        let entry = entry?;
        let path = entry.path();

        if path
            .extension()
            .map(is_session_file_extension)
            .unwrap_or(false)
        {
            if let Ok(session) = parse_session_file(&path) {
                let session_id = session.session_id.clone().unwrap_or_else(|| {
                    path.file_stem()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string())
                });

                let title = session.title();

                println!(
                    "[OK] Registered: {} ({}...)",
                    title,
                    &session_id[..12.min(session_id.len())]
                );
            }
        }
    }

    if removed > 0 {
        println!("[OK] Removed {} stale index entries", removed);
    }

    Ok(added)
}

/// Check if VS Code is currently running
pub fn is_vscode_running() -> bool {
    let mut sys = System::new();
    sys.refresh_processes();

    for process in sys.processes().values() {
        let name = process.name().to_lowercase();
        if name.contains("code") && !name.contains("codec") {
            return true;
        }
    }

    false
}

/// Close VS Code gracefully and wait for it to exit.
/// Returns the list of workspace folders that were open (for reopening).
pub fn close_vscode_and_wait(timeout_secs: u64) -> Result<()> {
    use sysinfo::{ProcessRefreshKind, RefreshKind, Signal};

    if !is_vscode_running() {
        return Ok(());
    }

    // Send SIGTERM (graceful close) to all Code processes
    let mut sys = System::new_with_specifics(
        RefreshKind::new().with_processes(ProcessRefreshKind::everything()),
    );
    sys.refresh_processes();

    let mut signaled = 0u32;
    for (pid, process) in sys.processes() {
        let name = process.name().to_lowercase();
        if name.contains("code") && !name.contains("codec") {
            // On Windows, kill() sends TerminateProcess; there's no graceful
            // SIGTERM equivalent via sysinfo. But the main electron process
            // handles WM_CLOSE. We use the `taskkill` approach on Windows for
            // a graceful close.
            #[cfg(windows)]
            {
                let _ = std::process::Command::new("taskkill")
                    .args(["/PID", &pid.as_u32().to_string()])
                    .stdout(std::process::Stdio::null())
                    .stderr(std::process::Stdio::null())
                    .status();
                signaled += 1;
            }
            #[cfg(not(windows))]
            {
                if process.kill_with(Signal::Term).unwrap_or(false) {
                    signaled += 1;
                }
            }
        }
    }

    if signaled == 0 {
        return Ok(());
    }

    // Wait for all Code processes to exit
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(timeout_secs);
    loop {
        std::thread::sleep(std::time::Duration::from_millis(500));
        if !is_vscode_running() {
            // Extra wait for file locks to release
            std::thread::sleep(std::time::Duration::from_secs(1));
            return Ok(());
        }
        if std::time::Instant::now() >= deadline {
            // Force kill remaining processes
            let mut sys2 = System::new_with_specifics(
                RefreshKind::new().with_processes(ProcessRefreshKind::everything()),
            );
            sys2.refresh_processes();
            for (_pid, process) in sys2.processes() {
                let name = process.name().to_lowercase();
                if name.contains("code") && !name.contains("codec") {
                    process.kill();
                }
            }
            std::thread::sleep(std::time::Duration::from_secs(1));
            return Ok(());
        }
    }
}

/// Reopen VS Code, optionally at a specific path.
pub fn reopen_vscode(project_path: Option<&str>) -> Result<()> {
    let mut cmd = std::process::Command::new("code");
    if let Some(path) = project_path {
        cmd.arg(path);
    }
    cmd.stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()?;
    Ok(())
}

/// Backup workspace sessions to a timestamped directory
pub fn backup_workspace_sessions(workspace_dir: &Path) -> Result<Option<PathBuf>> {
    let chat_sessions_dir = workspace_dir.join("chatSessions");

    if !chat_sessions_dir.exists() {
        return Ok(None);
    }

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let backup_dir = workspace_dir.join(format!("chatSessions-backup-{}", timestamp));

    // Copy directory recursively
    copy_dir_all(&chat_sessions_dir, &backup_dir)?;

    Ok(Some(backup_dir))
}

/// Recursively copy a directory
fn copy_dir_all(src: &Path, dst: &Path) -> Result<()> {
    std::fs::create_dir_all(dst)?;

    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_all(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path)?;
        }
    }

    Ok(())
}

// =============================================================================
// Empty Window Sessions (ALL SESSIONS)
// =============================================================================

/// Read all empty window chat sessions (not tied to any workspace)
/// These appear in VS Code's "ALL SESSIONS" panel
pub fn read_empty_window_sessions() -> Result<Vec<ChatSession>> {
    let sessions_path = get_empty_window_sessions_path()?;

    if !sessions_path.exists() {
        return Ok(Vec::new());
    }

    let mut sessions = Vec::new();

    for entry in std::fs::read_dir(&sessions_path)? {
        let entry = entry?;
        let path = entry.path();

        if path.extension().is_some_and(is_session_file_extension) {
            if let Ok(session) = parse_session_file(&path) {
                sessions.push(session);
            }
        }
    }

    // Sort by last message date (most recent first)
    sessions.sort_by(|a, b| b.last_message_date.cmp(&a.last_message_date));

    Ok(sessions)
}

/// Get a specific empty window session by ID
#[allow(dead_code)]
pub fn get_empty_window_session(session_id: &str) -> Result<Option<ChatSession>> {
    let sessions_path = get_empty_window_sessions_path()?;
    let session_path = sessions_path.join(format!("{}.json", session_id));

    if !session_path.exists() {
        return Ok(None);
    }

    let content = std::fs::read_to_string(&session_path)?;
    let session: ChatSession = serde_json::from_str(&content)
        .map_err(|e| CsmError::InvalidSessionFormat(e.to_string()))?;

    Ok(Some(session))
}

/// Write an empty window session
#[allow(dead_code)]
pub fn write_empty_window_session(session: &ChatSession) -> Result<PathBuf> {
    let sessions_path = get_empty_window_sessions_path()?;

    // Create directory if it doesn't exist
    std::fs::create_dir_all(&sessions_path)?;

    let session_id = session.session_id.as_deref().unwrap_or("unknown");
    let session_path = sessions_path.join(format!("{}.json", session_id));
    let content = serde_json::to_string_pretty(session)?;
    std::fs::write(&session_path, content)?;

    Ok(session_path)
}

/// Delete an empty window session
#[allow(dead_code)]
pub fn delete_empty_window_session(session_id: &str) -> Result<bool> {
    let sessions_path = get_empty_window_sessions_path()?;
    let session_path = sessions_path.join(format!("{}.json", session_id));

    if session_path.exists() {
        std::fs::remove_file(&session_path)?;
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Count empty window sessions
pub fn count_empty_window_sessions() -> Result<usize> {
    let sessions_path = get_empty_window_sessions_path()?;

    if !sessions_path.exists() {
        return Ok(0);
    }

    let count = std::fs::read_dir(&sessions_path)?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().is_some_and(is_session_file_extension))
        .count();

    Ok(count)
}

/// Compact a JSONL session file by replaying all operations into a single kind:0 snapshot.
/// This works at the raw JSON level, preserving all fields VS Code expects.
/// Returns the path to the compacted file.
pub fn compact_session_jsonl(path: &Path) -> Result<PathBuf> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| CsmError::InvalidSessionFormat(format!("Failed to read {}: {}", path.display(), e)))?;

    let mut lines = content.lines();

    // First line must be kind:0 (initial snapshot)
    let first_line = lines.next().ok_or_else(|| {
        CsmError::InvalidSessionFormat("Empty JSONL file".to_string())
    })?;

    let first_entry: serde_json::Value = serde_json::from_str(first_line.trim())
        .map_err(|e| CsmError::InvalidSessionFormat(format!("Invalid JSON on line 1: {}", e)))?;

    let kind = first_entry.get("kind").and_then(|k| k.as_u64()).unwrap_or(99);
    if kind != 0 {
        return Err(CsmError::InvalidSessionFormat(
            "First JSONL line must be kind:0".to_string(),
        ));
    }

    // Extract the session state from the "v" field
    let mut state = first_entry
        .get("v")
        .cloned()
        .ok_or_else(|| CsmError::InvalidSessionFormat("kind:0 missing 'v' field".to_string()))?;

    // Replay all subsequent operations
    for line in lines {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let entry: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue, // Skip malformed lines
        };

        let op_kind = entry.get("kind").and_then(|k| k.as_u64()).unwrap_or(99);

        match op_kind {
            1 => {
                // Delta update: k=["path","to","field"], v=value
                if let (Some(keys), Some(value)) = (entry.get("k"), entry.get("v")) {
                    if let Some(keys_arr) = keys.as_array() {
                        apply_delta(&mut state, keys_arr, value.clone());
                    }
                }
            }
            2 => {
                // Array append: k=["path","to","array"], v=[items]
                if let (Some(keys), Some(value)) = (entry.get("k"), entry.get("v")) {
                    if let Some(keys_arr) = keys.as_array() {
                        apply_append(&mut state, keys_arr, value.clone());
                    }
                }
            }
            _ => {} // Skip unknown kinds
        }
    }

    // Write the compacted file: single kind:0 line with the final state
    let compact_entry = serde_json::json!({"kind": 0, "v": state});
    let compact_content = serde_json::to_string(&compact_entry)
        .map_err(|e| CsmError::InvalidSessionFormat(format!("Failed to serialize: {}", e)))?;

    // Backup the original file
    let backup_path = path.with_extension("jsonl.bak");
    std::fs::rename(path, &backup_path)?;

    // Write the compacted file
    std::fs::write(path, &compact_content)?;

    Ok(backup_path)
}

/// Apply a delta update (kind:1) to a JSON value at the given key path.
fn apply_delta(root: &mut serde_json::Value, keys: &[serde_json::Value], value: serde_json::Value) {
    if keys.is_empty() {
        return;
    }

    // Navigate to the parent
    let mut current = root;
    for key in &keys[..keys.len() - 1] {
        if let Some(k) = key.as_str() {
            if !current.get(k).is_some() {
                current[k] = serde_json::Value::Object(serde_json::Map::new());
            }
            current = &mut current[k];
        } else if let Some(idx) = key.as_u64() {
            if let Some(arr) = current.as_array_mut() {
                if (idx as usize) < arr.len() {
                    current = &mut arr[idx as usize];
                } else {
                    return; // Index out of bounds
                }
            } else {
                return;
            }
        }
    }

    // Set the final key
    if let Some(last_key) = keys.last() {
        if let Some(k) = last_key.as_str() {
            current[k] = value;
        } else if let Some(idx) = last_key.as_u64() {
            if let Some(arr) = current.as_array_mut() {
                if (idx as usize) < arr.len() {
                    arr[idx as usize] = value;
                }
            }
        }
    }
}

/// Apply an array append operation (kind:2) to a JSON value at the given key path.
fn apply_append(root: &mut serde_json::Value, keys: &[serde_json::Value], items: serde_json::Value) {
    if keys.is_empty() {
        return;
    }

    // Navigate to the target array
    let mut current = root;
    for key in keys {
        if let Some(k) = key.as_str() {
            if !current.get(k).is_some() {
                current[k] = serde_json::json!([]);
            }
            current = &mut current[k];
        } else if let Some(idx) = key.as_u64() {
            if let Some(arr) = current.as_array_mut() {
                if (idx as usize) < arr.len() {
                    current = &mut arr[idx as usize];
                } else {
                    return;
                }
            } else {
                return;
            }
        }
    }

    // Append items to the target array
    if let (Some(target_arr), Some(new_items)) = (current.as_array_mut(), items.as_array()) {
        target_arr.extend(new_items.iter().cloned());
    }
}

/// Repair workspace sessions: compact large JSONL files and fix the index.
/// Returns (compacted_count, index_fixed_count).
pub fn repair_workspace_sessions(
    workspace_id: &str,
    chat_sessions_dir: &Path,
    force: bool,
) -> Result<(usize, usize)> {
    let db_path = get_workspace_storage_db(workspace_id)?;

    if !db_path.exists() {
        return Err(CsmError::WorkspaceNotFound(format!(
            "Database not found: {}",
            db_path.display()
        )));
    }

    if !force && is_vscode_running() {
        return Err(CsmError::VSCodeRunning);
    }

    let mut compacted = 0;

    if chat_sessions_dir.exists() {
        // Pass 1: Compact large JSONL files
        for entry in std::fs::read_dir(chat_sessions_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().is_some_and(|e| e == "jsonl") {
                let metadata = std::fs::metadata(&path)?;
                let size_mb = metadata.len() / (1024 * 1024);

                // Compact any JSONL file with multiple lines (has operations to replay)
                let content = std::fs::read_to_string(&path)
                    .map_err(|e| CsmError::InvalidSessionFormat(format!("Read error: {}", e)))?;
                let line_count = content.lines().count();

                if line_count > 1 {
                    let stem = path.file_stem().map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_default();
                    println!(
                        "   Compacting {} ({} lines, {}MB)...",
                        stem,
                        line_count,
                        size_mb
                    );

                    match compact_session_jsonl(&path) {
                        Ok(backup_path) => {
                            let new_size = std::fs::metadata(&path)
                                .map(|m| m.len() / (1024 * 1024))
                                .unwrap_or(0);
                            println!(
                                "   [OK] Compacted: {}MB -> {}MB (backup: {})",
                                size_mb,
                                new_size,
                                backup_path.file_name().unwrap_or_default().to_string_lossy()
                            );
                            compacted += 1;
                        }
                        Err(e) => {
                            println!("   [WARN] Failed to compact {}: {}", stem, e);
                        }
                    }
                }
            }
        }
    }

    // Pass 2: Rebuild the index with correct metadata
    let (index_fixed, _) = sync_session_index(workspace_id, chat_sessions_dir, force)?;

    Ok((compacted, index_fixed))
}
