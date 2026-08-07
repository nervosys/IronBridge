// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only
//! VS Code storage (SQLite database) operations

use crate::error::{CsmError, Result};
use crate::models::{
    extract_response_text, ChatRequest, ChatSession, ChatSessionIndex, ChatSessionIndexEntry,
    ChatSessionTiming, ModelCacheEntry, StateCacheEntry,
};
use crate::workspace::{get_empty_window_sessions_path, get_workspace_storage_path};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use once_cell::sync::Lazy;
use regex::Regex;
use rusqlite::Connection;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use sysinfo::System;

/// A single issue detected during workspace session diagnostics
#[derive(Debug, Clone)]
pub struct SessionIssue {
    /// The session file stem (UUID)
    pub session_id: String,
    /// Category of issue
    pub kind: SessionIssueKind,
    /// Human-readable description
    pub detail: String,
}

/// Categories of session issues that can be detected and auto-fixed
#[derive(Debug, Clone, PartialEq)]
pub enum SessionIssueKind {
    /// JSONL file has multiple lines (operations not compacted)
    MultiLineJsonl,
    /// JSONL first line contains concatenated JSON objects (missing newlines)
    ConcatenatedJsonl,
    /// Index entry has lastResponseState = 2 (Cancelled), blocks VS Code loading
    CancelledState,
    /// Last request's modelState.value is 2 (Cancelled) or missing in file content
    CancelledModelState,
    /// File exists on disk but is not in the VS Code index
    OrphanedSession,
    /// Index entry references a file that no longer exists on disk
    StaleIndexEntry,
    /// Session is missing required VS Code compat fields
    MissingCompatFields,
    /// Both .json and .jsonl exist for the same session ID
    DuplicateFormat,
    /// Legacy .json file is corrupted — contains only structural chars ({}, whitespace)
    SkeletonJson,
    /// JSONL session has many requests but message/response content has been stripped
    GuttedSession,
}

impl std::fmt::Display for SessionIssueKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SessionIssueKind::MultiLineJsonl => write!(f, "multi-line JSONL"),
            SessionIssueKind::ConcatenatedJsonl => write!(f, "concatenated JSONL"),
            SessionIssueKind::CancelledState => write!(f, "cancelled state"),
            SessionIssueKind::CancelledModelState => write!(f, "cancelled modelState in file"),
            SessionIssueKind::OrphanedSession => write!(f, "orphaned session"),
            SessionIssueKind::StaleIndexEntry => write!(f, "stale index entry"),
            SessionIssueKind::MissingCompatFields => write!(f, "missing compat fields"),
            SessionIssueKind::DuplicateFormat => write!(f, "duplicate .json/.jsonl"),
            SessionIssueKind::SkeletonJson => write!(f, "skeleton .json (corrupt)"),
            SessionIssueKind::GuttedSession => write!(f, "gutted session (content stripped)"),
        }
    }
}

/// Summary of issues found in a single workspace
#[derive(Debug, Clone, Default)]
pub struct WorkspaceDiagnosis {
    /// Project path (if known)
    pub project_path: Option<String>,
    /// Workspace hash
    pub workspace_hash: String,
    /// Total sessions on disk
    pub sessions_on_disk: usize,
    /// Total sessions in index
    pub sessions_in_index: usize,
    /// All detected issues
    pub issues: Vec<SessionIssue>,
}

impl WorkspaceDiagnosis {
    pub fn is_healthy(&self) -> bool {
        self.issues.is_empty()
    }

    pub fn issue_count_by_kind(&self, kind: &SessionIssueKind) -> usize {
        self.issues.iter().filter(|i| &i.kind == kind).count()
    }
}

/// Diagnose a workspace for session issues without modifying anything.
/// Returns a structured report of all detected problems.
pub fn diagnose_workspace_sessions(
    workspace_id: &str,
    chat_sessions_dir: &Path,
) -> Result<WorkspaceDiagnosis> {
    let mut diagnosis = WorkspaceDiagnosis {
        workspace_hash: workspace_id.to_string(),
        ..Default::default()
    };

    if !chat_sessions_dir.exists() {
        return Ok(diagnosis);
    }

    // Collect session files on disk
    let mut jsonl_sessions: HashSet<String> = HashSet::new();
    let mut json_sessions: HashSet<String> = HashSet::new();
    let mut all_session_ids: HashSet<String> = HashSet::new();

    for entry in std::fs::read_dir(chat_sessions_dir)? {
        let entry = entry?;
        let path = entry.path();
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        let stem = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();

        match ext {
            "jsonl" => {
                jsonl_sessions.insert(stem.clone());
                all_session_ids.insert(stem);
            }
            "json" if !path.to_string_lossy().ends_with(".bak") => {
                json_sessions.insert(stem.clone());
                all_session_ids.insert(stem);
            }
            _ => {}
        }
    }
    diagnosis.sessions_on_disk = all_session_ids.len();

    // Check for duplicate .json/.jsonl files
    for id in &jsonl_sessions {
        if json_sessions.contains(id) {
            diagnosis.issues.push(SessionIssue {
                session_id: id.clone(),
                kind: SessionIssueKind::DuplicateFormat,
                detail: format!("Both {id}.json and {id}.jsonl exist"),
            });
        }
    }

    // Check JSONL files for content issues
    for id in &jsonl_sessions {
        let path = chat_sessions_dir.join(format!("{id}.jsonl"));
        if let Ok(content) = std::fs::read_to_string(&path) {
            let line_count = content.lines().count();

            if line_count > 1 {
                let size_mb = content.len() / (1024 * 1024);
                diagnosis.issues.push(SessionIssue {
                    session_id: id.clone(),
                    kind: SessionIssueKind::MultiLineJsonl,
                    detail: format!("{line_count} lines, ~{size_mb} MB — needs compaction"),
                });
            }

            // Check first line for concatenation
            if let Some(first_line) = content.lines().next() {
                if first_line.contains("}{\"kind\":") {
                    diagnosis.issues.push(SessionIssue {
                        session_id: id.clone(),
                        kind: SessionIssueKind::ConcatenatedJsonl,
                        detail: "First line has concatenated JSON objects".to_string(),
                    });
                }
            }

            // Check for missing compat fields (only single-line files worth checking)
            if line_count == 1 {
                if let Some(first_line) = content.lines().next() {
                    if let Ok(obj) = serde_json::from_str::<serde_json::Value>(first_line) {
                        let is_kind_0 = obj
                            .get("kind")
                            .and_then(|k| k.as_u64())
                            .map(|k| k == 0)
                            .unwrap_or(false);

                        if is_kind_0 {
                            if let Some(v) = obj.get("v") {
                                let missing_fields: Vec<&str> = [
                                    "hasPendingEdits",
                                    "pendingRequests",
                                    "inputState",
                                    "sessionId",
                                    "version",
                                ]
                                .iter()
                                .filter(|f| v.get(**f).is_none())
                                .copied()
                                .collect();

                                if !missing_fields.is_empty() {
                                    diagnosis.issues.push(SessionIssue {
                                        session_id: id.clone(),
                                        kind: SessionIssueKind::MissingCompatFields,
                                        detail: format!("Missing: {}", missing_fields.join(", ")),
                                    });
                                }

                                // Check for cancelled modelState in file content
                                if let Some(requests) = v.get("requests").and_then(|r| r.as_array())
                                {
                                    if let Some(last_req) = requests.last() {
                                        let model_state_value = last_req
                                            .get("modelState")
                                            .and_then(|ms| ms.get("value"))
                                            .and_then(|v| v.as_u64());
                                        match model_state_value {
                                            Some(1) => {} // Complete — valid
                                            Some(v) => {
                                                diagnosis.issues.push(SessionIssue {
                                                    session_id: id.clone(),
                                                    kind: SessionIssueKind::CancelledModelState,
                                                    detail: format!("Last request modelState.value={} (not Complete) in file content", v),
                                                });
                                            }
                                            None => {
                                                diagnosis.issues.push(SessionIssue {
                                                    session_id: id.clone(),
                                                    kind: SessionIssueKind::CancelledModelState,
                                                    detail: "Last request missing modelState in file content".to_string(),
                                                });
                                            }
                                        }
                                    }
                                }

                                // Check hasPendingEdits — true blocks session loading
                                if v.get("hasPendingEdits")
                                    .and_then(|v| v.as_bool())
                                    .unwrap_or(false)
                                {
                                    diagnosis.issues.push(SessionIssue {
                                        session_id: id.clone(),
                                        kind: SessionIssueKind::MissingCompatFields,
                                        detail: "hasPendingEdits is true (blocks session loading)"
                                            .to_string(),
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Check .json files for skeleton corruption
    for id in &json_sessions {
        // Skip if a .jsonl already exists (it takes precedence)
        if jsonl_sessions.contains(id) {
            continue;
        }
        let path = chat_sessions_dir.join(format!("{id}.json"));
        if let Ok(content) = std::fs::read_to_string(&path) {
            if is_skeleton_json(&content) {
                diagnosis.issues.push(SessionIssue {
                    session_id: id.clone(),
                    kind: SessionIssueKind::SkeletonJson,
                    detail: format!(
                        "Legacy .json is corrupt — only structural chars remain ({} bytes)",
                        content.len()
                    ),
                });
            }
        }
    }

    // Check JSONL files for gutted content (many requests but stripped messages)
    for id in &jsonl_sessions {
        let path = chat_sessions_dir.join(format!("{id}.jsonl"));
        if let Some((req_count, total_chars)) = is_gutted_session(&path) {
            diagnosis.issues.push(SessionIssue {
                session_id: id.clone(),
                kind: SessionIssueKind::GuttedSession,
                detail: format!(
                    "{} requests but only {} chars of content — message/response text stripped",
                    req_count, total_chars
                ),
            });
        }
    }

    // Check index for stale entries, orphans, and cancelled state
    let db_path = get_workspace_storage_db(workspace_id)?;
    if db_path.exists() {
        if let Ok(index) = read_chat_session_index(&db_path) {
            diagnosis.sessions_in_index = index.entries.len();

            // Stale index entries (in index but no file on disk)
            for id in index.entries.keys() {
                if !all_session_ids.contains(id) {
                    diagnosis.issues.push(SessionIssue {
                        session_id: id.clone(),
                        kind: SessionIssueKind::StaleIndexEntry,
                        detail: "In index but no file on disk".to_string(),
                    });
                }
            }

            // Cancelled state entries
            for (id, entry) in &index.entries {
                if entry.last_response_state == 2 {
                    diagnosis.issues.push(SessionIssue {
                        session_id: id.clone(),
                        kind: SessionIssueKind::CancelledState,
                        detail: "lastResponseState=2 (Cancelled) — blocks VS Code loading"
                            .to_string(),
                    });
                }
            }

            // Orphaned sessions (on disk but not in index)
            let indexed_ids: HashSet<&String> = index.entries.keys().collect();
            for id in &all_session_ids {
                if !indexed_ids.contains(id) {
                    diagnosis.issues.push(SessionIssue {
                        session_id: id.clone(),
                        kind: SessionIssueKind::OrphanedSession,
                        detail: "File on disk but not in VS Code index".to_string(),
                    });
                }
            }
        }
    }

    Ok(diagnosis)
}

/// Regex to match any Unicode escape sequence (valid or not)
static UNICODE_ESCAPE_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"\\u[0-9a-fA-F]{4}").unwrap());

/// VS Code session format version - helps identify which parsing strategy to use
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VsCodeSessionFormat {
    /// Legacy JSON format (VS Code < 1.109.0)
    /// Single JSON object with ChatSession structure
    LegacyJson,
    /// JSONL format (VS Code >= 1.109.0, January 2026+)
    /// JSON Lines with event sourcing: kind 0 (initial), kind 1 (delta), kind 2 (replace/splice)
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
    /// Array replace/splice operation (kind: 2)
    /// Optional 'i' field specifies splice index (truncate at i, then extend)
    ArraySplice = 2,
}

/// Parse a JSONL (JSON Lines) session file (VS Code 1.109.0+ format)
/// Each line is a JSON object with 'kind' field indicating the type:
/// - kind 0: Initial session metadata with 'v' containing ChatSession-like structure
/// - kind 1: Delta update with 'k' (keys path) and 'v' (value)
/// - kind 2: Array replace/splice with 'k' (path), 'v' (items), optional 'i' (splice index)
pub fn parse_session_jsonl(content: &str) -> std::result::Result<ChatSession, serde_json::Error> {
    // Pre-process: split concatenated JSON objects that lack newline separators
    let content = split_concatenated_jsonl(content);

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
                            if let Some(latest_ts) =
                                session.requests.iter().filter_map(|r| r.timestamp).max()
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
                                // Auto-grow requests array to accommodate the referenced index.
                                // VS Code emits events for request indices before a formal
                                // kind:2 k=["requests"] append, so we must create placeholder
                                // requests as needed.
                                while idx >= session.requests.len() {
                                    session.requests.push(ChatRequest::default());
                                }
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
                                    "modelState" => {
                                        session.requests[idx].model_state = Some(value.clone());
                                    }
                                    "modelId" => {
                                        session.requests[idx].model_id =
                                            value.as_str().map(|s| s.to_string());
                                    }
                                    "agent" => {
                                        session.requests[idx].agent = Some(value.clone());
                                    }
                                    "variableData" => {
                                        session.requests[idx].variable_data = Some(value.clone());
                                    }
                                    _ => {} // Ignore unknown request fields
                                }
                            }
                        }
                    }
                }
            }
            2 => {
                // Array splice operation - 'k' is the key path, 'v' is the new array items
                // Optional 'i' field is the splice start index (truncate at i, then extend)
                // Without 'i', items are appended to the end of the array
                if let (Some(keys), Some(value)) = (entry.get("k"), entry.get("v")) {
                    let splice_index = entry.get("i").and_then(|i| i.as_u64()).map(|i| i as usize);
                    if let Some(keys_arr) = keys.as_array() {
                        // Top-level requests: k=["requests"], v=[requests_array]
                        if keys_arr.len() == 1 {
                            if let Some("requests") = keys_arr[0].as_str() {
                                if let Some(items) = value.as_array() {
                                    if let Some(idx) = splice_index {
                                        // Splice: truncate at index i, then extend with new items
                                        session.requests.truncate(idx);
                                    }
                                    // Without 'i': append to end (no truncation)
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
                        // Nested array replace/splice: k=["requests", idx, "response"], v=[parts]
                        else if keys_arr.len() == 3 {
                            if let (Some("requests"), Some(req_idx), Some(field)) = (
                                keys_arr[0].as_str(),
                                keys_arr[1].as_u64().map(|i| i as usize),
                                keys_arr[2].as_str(),
                            ) {
                                // Auto-grow requests array for the referenced index
                                while req_idx >= session.requests.len() {
                                    session.requests.push(ChatRequest::default());
                                }
                                match field {
                                    "response" => {
                                        // Response is stored as a JSON Value (array)
                                        if let Some(idx) = splice_index {
                                            // Splice: keep items before index i, replace rest
                                            if let Some(existing) =
                                                session.requests[req_idx].response.as_ref()
                                            {
                                                if let Some(existing_arr) = existing.as_array() {
                                                    let mut new_arr: Vec<serde_json::Value> =
                                                        existing_arr[..idx.min(existing_arr.len())]
                                                            .to_vec();
                                                    if let Some(new_items) = value.as_array() {
                                                        new_arr.extend(new_items.iter().cloned());
                                                    }
                                                    session.requests[req_idx].response =
                                                        Some(serde_json::Value::Array(new_arr));
                                                } else {
                                                    session.requests[req_idx].response =
                                                        Some(value.clone());
                                                }
                                            } else {
                                                session.requests[req_idx].response =
                                                    Some(value.clone());
                                            }
                                        } else {
                                            // No splice index: append to existing response array
                                            if let Some(existing) =
                                                session.requests[req_idx].response.as_ref()
                                            {
                                                if let Some(existing_arr) = existing.as_array() {
                                                    let mut new_arr = existing_arr.clone();
                                                    if let Some(new_items) = value.as_array() {
                                                        new_arr.extend(new_items.iter().cloned());
                                                    }
                                                    session.requests[req_idx].response =
                                                        Some(serde_json::Value::Array(new_arr));
                                                } else {
                                                    session.requests[req_idx].response =
                                                        Some(value.clone());
                                                }
                                            } else {
                                                session.requests[req_idx].response =
                                                    Some(value.clone());
                                            }
                                        }
                                    }
                                    "contentReferences" => {
                                        session.requests[req_idx].content_references =
                                            serde_json::from_value(value.clone()).ok();
                                    }
                                    _ => {} // Ignore unknown fields
                                }
                            }
                        }
                    }
                }
            }
            _ => {} // Unknown kind, skip
        }
    }

    Ok(session)
}

/// Check if a file extension indicates a session file (.json, .jsonl, or .backup)
pub fn is_session_file_extension(ext: &std::ffi::OsStr) -> bool {
    ext == "json" || ext == "jsonl" || ext == "backup"
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

// ── Generic DB key read/write ──────────────────────────────────────────────

/// Read a JSON value from the VS Code state DB by key
pub fn read_db_json(db_path: &Path, key: &str) -> Result<Option<serde_json::Value>> {
    let conn = Connection::open(db_path)?;
    let result: std::result::Result<String, rusqlite::Error> =
        conn.query_row("SELECT value FROM ItemTable WHERE key = ?", [key], |row| {
            row.get(0)
        });
    match result {
        Ok(json_str) => {
            let v = serde_json::from_str(&json_str)
                .map_err(|e| CsmError::InvalidSessionFormat(e.to_string()))?;
            Ok(Some(v))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(CsmError::SqliteError(e)),
    }
}

/// Write a JSON value to the VS Code state DB (upsert)
fn write_db_json(db_path: &Path, key: &str, value: &serde_json::Value) -> Result<()> {
    let conn = Connection::open(db_path)?;
    let json_str = serde_json::to_string(value)?;
    conn.execute(
        "INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)",
        rusqlite::params![key, json_str],
    )?;
    Ok(())
}

// ── Session resource URI helpers ───────────────────────────────────────────

/// Build the `vscode-chat-session://local/{base64(sessionId)}` resource URI
/// that VS Code uses to identify sessions in model cache and state cache.
pub fn session_resource_uri(session_id: &str) -> String {
    let b64 = BASE64.encode(session_id.as_bytes());
    format!("vscode-chat-session://local/{}", b64)
}

/// Extract a session ID from a `vscode-chat-session://` resource URI.
/// Returns `None` if the URI doesn't match the expected format.
pub fn session_id_from_resource_uri(uri: &str) -> Option<String> {
    let prefix = "vscode-chat-session://local/";
    if let Some(b64) = uri.strip_prefix(prefix) {
        BASE64
            .decode(b64)
            .ok()
            .and_then(|bytes| String::from_utf8(bytes).ok())
    } else {
        None
    }
}

// ── Model cache (agentSessions.model.cache) ────────────────────────────────

const MODEL_CACHE_KEY: &str = "agentSessions.model.cache";

/// Read the `agentSessions.model.cache` from VS Code storage.
/// Returns an empty Vec if the key doesn't exist.
pub fn read_model_cache(db_path: &Path) -> Result<Vec<ModelCacheEntry>> {
    match read_db_json(db_path, MODEL_CACHE_KEY)? {
        Some(v) => serde_json::from_value(v)
            .map_err(|e| CsmError::InvalidSessionFormat(format!("model cache: {}", e))),
        None => Ok(Vec::new()),
    }
}

/// Write the `agentSessions.model.cache` to VS Code storage.
pub fn write_model_cache(db_path: &Path, cache: &[ModelCacheEntry]) -> Result<()> {
    let v = serde_json::to_value(cache)?;
    write_db_json(db_path, MODEL_CACHE_KEY, &v)
}

/// Rebuild the model cache from the session index. This makes sessions visible
/// in the Chat panel sidebar. Only non-empty sessions get entries (VS Code
/// hides empty ones).
pub fn rebuild_model_cache(db_path: &Path, index: &ChatSessionIndex) -> Result<usize> {
    let mut cache: Vec<ModelCacheEntry> = Vec::new();

    for (session_id, entry) in &index.entries {
        // Only include non-empty sessions — empty ones are hidden in the sidebar
        if entry.is_empty {
            continue;
        }

        let timing = entry.timing.clone().unwrap_or(ChatSessionTiming {
            created: entry.last_message_date,
            last_request_started: Some(entry.last_message_date),
            last_request_ended: Some(entry.last_message_date),
        });

        cache.push(ModelCacheEntry {
            provider_type: "local".to_string(),
            provider_label: "Local".to_string(),
            resource: session_resource_uri(session_id),
            icon: "vm".to_string(),
            label: entry.title.clone(),
            status: 1,
            timing,
            initial_location: entry.initial_location.clone(),
            has_pending_edits: false,
            is_empty: false,
            is_external: entry.is_external.unwrap_or(false),
            last_response_state: 1, // Complete
        });
    }

    let count = cache.len();
    write_model_cache(db_path, &cache)?;
    Ok(count)
}

// ── State cache (agentSessions.state.cache) ────────────────────────────────

const STATE_CACHE_KEY: &str = "agentSessions.state.cache";

/// Read the `agentSessions.state.cache` from VS Code storage.
pub fn read_state_cache(db_path: &Path) -> Result<Vec<StateCacheEntry>> {
    match read_db_json(db_path, STATE_CACHE_KEY)? {
        Some(v) => serde_json::from_value(v)
            .map_err(|e| CsmError::InvalidSessionFormat(format!("state cache: {}", e))),
        None => Ok(Vec::new()),
    }
}

/// Write the `agentSessions.state.cache` to VS Code storage.
pub fn write_state_cache(db_path: &Path, cache: &[StateCacheEntry]) -> Result<()> {
    let v = serde_json::to_value(cache)?;
    write_db_json(db_path, STATE_CACHE_KEY, &v)
}

/// Remove state cache entries whose resource URIs reference sessions that no
/// longer exist on disk. Returns the number of stale entries removed.
pub fn cleanup_state_cache(db_path: &Path, valid_session_ids: &HashSet<String>) -> Result<usize> {
    let entries = read_state_cache(db_path)?;
    let valid_resources: HashSet<String> = valid_session_ids
        .iter()
        .map(|id| session_resource_uri(id))
        .collect();

    let before = entries.len();
    let cleaned: Vec<StateCacheEntry> = entries
        .into_iter()
        .filter(|e| valid_resources.contains(&e.resource))
        .collect();
    let removed = before - cleaned.len();

    if removed > 0 {
        write_state_cache(db_path, &cleaned)?;
    }

    Ok(removed)
}

// ── Memento (memento/interactive-session-view-copilot) ──────────────────────

const MEMENTO_KEY: &str = "memento/interactive-session-view-copilot";

/// Read the Copilot Chat memento (tracks the last-active session).
pub fn read_session_memento(db_path: &Path) -> Result<Option<serde_json::Value>> {
    read_db_json(db_path, MEMENTO_KEY)
}

/// Write the Copilot Chat memento.
pub fn write_session_memento(db_path: &Path, value: &serde_json::Value) -> Result<()> {
    write_db_json(db_path, MEMENTO_KEY, value)
}

/// Fix the memento so it points to a session that actually exists.
/// If the current memento references a deleted/non-existent session, update it
/// to the most recently active valid session. Returns `true` if the memento was
/// changed.
pub fn fix_session_memento(
    db_path: &Path,
    valid_session_ids: &HashSet<String>,
    preferred_session_id: Option<&str>,
) -> Result<bool> {
    let memento = read_session_memento(db_path)?;

    let current_sid = memento
        .as_ref()
        .and_then(|v| v.get("sessionId"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Check if current memento already points to a valid session
    if let Some(ref sid) = current_sid {
        if valid_session_ids.contains(sid) {
            return Ok(false); // Already valid
        }
    }

    // Pick a session to point to: prefer the explicit choice, otherwise pick any valid one
    let target = preferred_session_id
        .filter(|id| valid_session_ids.contains(*id))
        .or_else(|| valid_session_ids.iter().next().map(|s| s.as_str()));

    if let Some(target_id) = target {
        let mut new_memento = memento.unwrap_or(serde_json::json!({}));
        if let Some(obj) = new_memento.as_object_mut() {
            obj.insert(
                "sessionId".to_string(),
                serde_json::Value::String(target_id.to_string()),
            );
        }
        write_session_memento(db_path, &new_memento)?;
        Ok(true)
    } else {
        Ok(false) // No valid sessions to point to
    }
}

// ── View state fix ─────────────────────────────────────────────────────────

const VIEW_STATE_KEY: &str = "workbench.view.chat.sessions.state";

/// Fix broken view state where all chat sections are hidden in the sidebar.
///
/// VS Code stores `workbench.view.chat.sessions.state` as a JSON object whose
/// values are section descriptors with an `isHidden` boolean. If every section
/// has `isHidden: true`, chat sessions become invisible in the sidebar even
/// though they exist on disk and in the index. This function detects that
/// condition and deletes the key so VS Code regenerates it with default
/// (visible) state.
///
/// Returns `Ok(true)` if the key was deleted, `Ok(false)` if the view state
/// was healthy or absent.
pub fn fix_broken_view_state(db_path: &Path) -> Result<bool> {
    let view_state = match read_db_json(db_path, VIEW_STATE_KEY)? {
        Some(v) => v,
        None => return Ok(false), // No view state key — nothing to fix
    };

    let obj = match view_state.as_object() {
        Some(o) => o,
        None => return Ok(false), // Not a JSON object — leave it alone
    };

    if obj.is_empty() {
        return Ok(false);
    }

    // Check whether every section descriptor has "isHidden": true
    let all_hidden = obj.values().all(|v| {
        v.as_object()
            .and_then(|section| section.get("isHidden"))
            .and_then(|h| h.as_bool())
            .unwrap_or(false)
    });

    if !all_hidden {
        return Ok(false); // At least one section is visible — view state is fine
    }

    // All sections hidden — delete the key so VS Code regenerates defaults
    let conn = Connection::open(db_path)?;
    conn.execute("DELETE FROM ItemTable WHERE key = ?", [VIEW_STATE_KEY])?;
    Ok(true)
}

// ── .json.bak recovery ─────────────────────────────────────────────────────

/// Count the number of requests in a session's `v.requests` array from a JSONL
/// file (reads only the first kind:0 line).
fn count_jsonl_requests(path: &Path) -> Result<usize> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| CsmError::InvalidSessionFormat(format!("Read error: {}", e)))?;
    let first_line = content.lines().next().unwrap_or("");
    let parsed: serde_json::Value = serde_json::from_str(first_line)
        .map_err(|e| CsmError::InvalidSessionFormat(format!("Parse error: {}", e)))?;

    let count = parsed
        .get("v")
        .or(Some(&parsed)) // bare JSON (non-JSONL) may not have "v" wrapper
        .and_then(|v| v.get("requests"))
        .and_then(|r| r.as_array())
        .map(|a| a.len())
        .unwrap_or(0);

    Ok(count)
}

/// Count the number of requests in a `.json.bak` (or `.json`) file.
fn count_json_bak_requests(path: &Path) -> Result<usize> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| CsmError::InvalidSessionFormat(format!("Read error: {}", e)))?;
    let parsed: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| CsmError::InvalidSessionFormat(format!("Parse error: {}", e)))?;

    let count = parsed
        .get("requests")
        .and_then(|r| r.as_array())
        .map(|a| a.len())
        .unwrap_or(0);

    Ok(count)
}

/// Migrate old-format inputState fields from top-level to a nested `inputState`
/// object. VS Code version 3 expects `inputState` as a sub-object with keys
/// `attachments`, `mode`, `inputText`, `selections`, `contrib`.
///
/// Old format (pre-v3): `{ "attachments": [...], "mode": {...}, "inputText": "...", ... }`
/// New format (v3):     `{ "inputState": { "attachments": [...], "mode": {...}, ... } }`
pub fn migrate_old_input_state(state: &mut serde_json::Value) {
    if let Some(obj) = state.as_object_mut() {
        // Only migrate if inputState doesn't already exist AND old top-level fields do
        if obj.contains_key("inputState") {
            return;
        }

        let old_keys = [
            "attachments",
            "mode",
            "inputText",
            "selections",
            "contrib",
            "selectedModel",
        ];
        let has_old = old_keys.iter().any(|k| obj.contains_key(*k));

        if has_old {
            let mut input_state = serde_json::Map::new();

            // Move each old key into the nested object (with defaults)
            input_state.insert(
                "attachments".to_string(),
                obj.remove("attachments").unwrap_or(serde_json::json!([])),
            );
            input_state.insert(
                "mode".to_string(),
                obj.remove("mode")
                    .unwrap_or(serde_json::json!({"id": "agent", "kind": "agent"})),
            );
            input_state.insert(
                "inputText".to_string(),
                obj.remove("inputText").unwrap_or(serde_json::json!("")),
            );
            input_state.insert(
                "selections".to_string(),
                obj.remove("selections").unwrap_or(serde_json::json!([])),
            );
            input_state.insert(
                "contrib".to_string(),
                obj.remove("contrib").unwrap_or(serde_json::json!({})),
            );

            // selectedModel is optional, only include if present
            if let Some(model) = obj.remove("selectedModel") {
                input_state.insert("selectedModel".to_string(), model);
            }

            obj.insert(
                "inputState".to_string(),
                serde_json::Value::Object(input_state),
            );
        }
    }
}

/// Recover sessions from `.json.bak` files when the corresponding `.jsonl` has
/// fewer requests (indicating a truncated migration/compaction). For each .jsonl
/// that has a co-located .json.bak with more requests, rebuilds the .jsonl from
/// the backup data.
///
/// Returns the number of sessions recovered from backups.
pub fn recover_from_json_bak(chat_sessions_dir: &Path) -> Result<usize> {
    if !chat_sessions_dir.exists() {
        return Ok(0);
    }

    let mut recovered = 0;

    // Collect all .json.bak files
    let mut bak_files: Vec<PathBuf> = Vec::new();
    for entry in std::fs::read_dir(chat_sessions_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.to_string_lossy().ends_with(".json.bak") {
            bak_files.push(path);
        }
    }

    for bak_path in &bak_files {
        // Derive session ID and .jsonl path
        let bak_name = bak_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let session_id = bak_name.trim_end_matches(".json.bak");
        let jsonl_path = chat_sessions_dir.join(format!("{}.jsonl", session_id));

        // Get request counts
        let bak_count = match count_json_bak_requests(bak_path) {
            Ok(c) => c,
            Err(_) => continue, // Skip unparseable backups
        };

        if bak_count == 0 {
            continue; // Backup has no data, skip
        }

        let jsonl_count = if jsonl_path.exists() {
            count_jsonl_requests(&jsonl_path).unwrap_or(0)
        } else {
            0 // No .jsonl at all — definitely recover from backup
        };

        if bak_count <= jsonl_count {
            continue; // .jsonl already has equal or more data
        }

        // .json.bak has more requests — recover from it
        println!(
            "   [*] .json.bak has {} requests vs .jsonl has {} for {}",
            bak_count, jsonl_count, session_id
        );

        // Read the full backup
        let bak_content = match std::fs::read_to_string(bak_path) {
            Ok(c) => c,
            Err(e) => {
                println!("   [WARN] Failed to read .json.bak {}: {}", session_id, e);
                continue;
            }
        };
        let mut full_data: serde_json::Value = match serde_json::from_str(&bak_content) {
            Ok(v) => v,
            Err(e) => {
                println!("   [WARN] Failed to parse .json.bak {}: {}", session_id, e);
                continue;
            }
        };

        // Clean up: build ISerializableChatData3 format
        if let Some(obj) = full_data.as_object_mut() {
            // Ensure version 3
            obj.insert("version".to_string(), serde_json::json!(3));

            // Ensure sessionId
            if !obj.contains_key("sessionId") {
                obj.insert("sessionId".to_string(), serde_json::json!(session_id));
            }

            // Force safe values
            obj.insert("hasPendingEdits".to_string(), serde_json::json!(false));
            obj.insert("pendingRequests".to_string(), serde_json::json!([]));

            // Ensure responderUsername
            if !obj.contains_key("responderUsername") {
                obj.insert(
                    "responderUsername".to_string(),
                    serde_json::json!("GitHub Copilot"),
                );
            }

            // Migrate old inputState format
            migrate_old_input_state(&mut full_data);

            // Fix modelState values in requests
            fix_request_model_states(&mut full_data);
        }

        // Backup existing .jsonl if present
        if jsonl_path.exists() {
            let pre_fix_bak = jsonl_path.with_extension("jsonl.pre_bak_recovery");
            if let Err(e) = std::fs::copy(&jsonl_path, &pre_fix_bak) {
                println!(
                    "   [WARN] Failed to backup .jsonl before recovery {}: {}",
                    session_id, e
                );
                continue;
            }
        }

        // Write new JSONL kind:0
        let jsonl_obj = serde_json::json!({"kind": 0, "v": full_data});
        let jsonl_str = serde_json::to_string(&jsonl_obj).map_err(|e| {
            CsmError::InvalidSessionFormat(format!("Failed to serialize recovered session: {}", e))
        })?;
        std::fs::write(&jsonl_path, format!("{}\n", jsonl_str))?;

        println!(
            "   [OK] Recovered {} from .json.bak ({} → {} requests)",
            session_id, jsonl_count, bak_count
        );
        recovered += 1;
    }

    Ok(recovered)
}

/// Recover sessions from `.jsonl.bak` files when the backup is larger than the
/// corresponding `.jsonl` file — indicating the live session was truncated.
///
/// For each `.jsonl.bak` whose byte size exceeds the active `.jsonl`:
/// 1. Backs up the active file to `.jsonl.pre-restore`
/// 2. Copies the `.jsonl.bak` over the active `.jsonl`
///
/// This handles the common scenario where VS Code or compaction overwrites a
/// session with a truncated version while the backup retains the full data.
///
/// Returns `(restored_count, total_bytes_recovered)`.
pub fn recover_from_jsonl_bak(chat_sessions_dir: &Path, dry_run: bool) -> Result<(usize, u64)> {
    if !chat_sessions_dir.exists() {
        return Ok((0, 0));
    }

    let mut restored = 0usize;
    let mut bytes_recovered = 0u64;

    // Collect all .jsonl.bak files
    let mut bak_files: Vec<PathBuf> = Vec::new();
    for entry in std::fs::read_dir(chat_sessions_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.to_string_lossy().ends_with(".jsonl.bak") {
            bak_files.push(path);
        }
    }

    for bak_path in &bak_files {
        let bak_name = bak_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let session_id = bak_name.trim_end_matches(".jsonl.bak");
        let jsonl_path = chat_sessions_dir.join(format!("{}.jsonl", session_id));

        // Only act when the .jsonl exists AND the backup is strictly larger
        if !jsonl_path.exists() {
            continue;
        }

        let orig_size = match std::fs::metadata(&jsonl_path) {
            Ok(m) => m.len(),
            Err(_) => continue,
        };
        let bak_size = match std::fs::metadata(bak_path) {
            Ok(m) => m.len(),
            Err(_) => continue,
        };

        if bak_size <= orig_size {
            continue; // Backup is not larger, nothing to recover
        }

        let delta = bak_size - orig_size;
        let orig_kb = orig_size as f64 / 1024.0;
        let bak_kb = bak_size as f64 / 1024.0;

        if dry_run {
            println!(
                "   [*] Would restore {} ({:.1}KB → {:.1}KB, +{:.1}KB)",
                session_id,
                orig_kb,
                bak_kb,
                delta as f64 / 1024.0
            );
        } else {
            // Safety backup of current file
            let pre_restore = jsonl_path.with_extension("jsonl.pre-restore");
            if let Err(e) = std::fs::copy(&jsonl_path, &pre_restore) {
                println!(
                    "   [WARN] Failed to create safety backup for {}: {}",
                    session_id, e
                );
                continue;
            }

            // Restore from backup
            if let Err(e) = std::fs::copy(bak_path, &jsonl_path) {
                println!(
                    "   [WARN] Failed to restore {} from .jsonl.bak: {}",
                    session_id, e
                );
                // Try to roll back
                let _ = std::fs::copy(&pre_restore, &jsonl_path);
                continue;
            }

            println!(
                "   [OK] Restored {} from .jsonl.bak ({:.1}KB → {:.1}KB, +{:.1}KB recovered)",
                session_id,
                orig_kb,
                bak_kb,
                delta as f64 / 1024.0
            );
        }

        restored += 1;
        bytes_recovered += delta;
    }

    Ok((restored, bytes_recovered))
}

/// Detail about a single session backup recovery action.
#[derive(Debug, Clone)]
pub struct BackupRecoveryAction {
    /// Session ID (UUID portion of filename)
    pub session_id: String,
    /// Source file used for recovery (the backup with more requests)
    pub source_file: String,
    /// Number of requests in the current .jsonl
    pub current_requests: usize,
    /// Number of requests in the best backup
    pub recovered_requests: usize,
    /// Size of the current .jsonl in bytes
    pub current_size: u64,
    /// Size of the best backup in bytes
    pub recovered_size: u64,
    /// Whether the source was a different format (e.g. .json → .jsonl conversion)
    pub converted: bool,
}

/// Comprehensive session recovery from ALL backup file variants.
///
/// For each session ID found in `chat_sessions_dir`, examines:
/// - `.jsonl.bak` (VS Code JSONL backup)
/// - `.jsonl.pre-restore` (chasm safety backup)
/// - `.jsonl.pre_bak_recovery` (earlier chasm recovery backup)
/// - `.json` (old JSON format — may contain more requests than current JSONL)
/// - `.json.bak` (old JSON format backup)
///
/// Selects the file with the **most requests** (not just largest size) and
/// restores it as the active `.jsonl`, converting from JSON format if needed.
///
/// Returns a list of recovery actions taken (or that would be taken in dry-run).
pub fn recover_from_all_backups(
    chat_sessions_dir: &Path,
    dry_run: bool,
) -> Result<Vec<BackupRecoveryAction>> {
    use std::collections::HashMap;

    if !chat_sessions_dir.exists() {
        return Ok(Vec::new());
    }

    // Collect all files grouped by session ID (first 36 chars = UUID)
    let mut session_files: HashMap<String, Vec<(String, PathBuf)>> = HashMap::new();
    for entry in std::fs::read_dir(chat_sessions_dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let fname = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        // Skip markdown, non-session files
        if fname.ends_with(".md") || fname.len() < 36 {
            continue;
        }
        // Session ID is the first 36 characters (UUID format)
        let sid = fname[..36].to_string();
        // Only include JSON/JSONL files (including .bak, .pre-restore variants)
        if fname.contains(".json") {
            session_files.entry(sid).or_default().push((fname, path));
        }
    }

    let mut actions = Vec::new();

    for (sid, files) in &session_files {
        // Find the current active .jsonl file
        let current_jsonl_name = format!("{}.jsonl", sid);
        let current_jsonl_path = chat_sessions_dir.join(&current_jsonl_name);

        // Parse the current .jsonl to get its request count
        let current_requests = if current_jsonl_path.exists() {
            match parse_session_file(&current_jsonl_path) {
                Ok(session) => session.requests.len(),
                Err(_) => 0,
            }
        } else {
            0
        };
        let current_size = if current_jsonl_path.exists() {
            std::fs::metadata(&current_jsonl_path)
                .map(|m| m.len())
                .unwrap_or(0)
        } else {
            0
        };

        // Find the backup with the most requests (or most content when equal)
        let mut best_requests = current_requests;
        let mut best_size = current_size;
        let mut best_file: Option<(&str, &Path)> = None;

        for (fname, fpath) in files {
            // Skip the current active file
            if fname == &current_jsonl_name {
                continue;
            }
            // Skip files that are clearly recovery markers (tiny files)
            let size = std::fs::metadata(fpath).map(|m| m.len()).unwrap_or(0);
            if size < 100 {
                continue;
            }
            // Parse to count requests
            match parse_session_file(fpath) {
                Ok(session) => {
                    let req_count = session.requests.len();
                    if req_count > best_requests {
                        best_requests = req_count;
                        best_size = size;
                        best_file = Some((fname.as_str(), fpath.as_path()));
                    } else if req_count == best_requests && req_count > 0 && size > best_size * 2 {
                        // Same request count but backup is >2x larger — likely the
                        // active file is gutted (content stripped but structure kept)
                        best_size = size;
                        best_file = Some((fname.as_str(), fpath.as_path()));
                    }
                }
                Err(_) => {
                    // Can't parse — skip
                }
            }
        }

        if let Some((best_name, best_path)) = best_file {
            let best_size = std::fs::metadata(best_path).map(|m| m.len()).unwrap_or(0);
            let is_json_source = !best_name.contains(".jsonl");

            if !dry_run {
                // Safety backup of current file
                if current_jsonl_path.exists() {
                    let pre_restore = current_jsonl_path.with_extension("jsonl.pre-restore");
                    // Don't overwrite existing pre-restore (keep earliest backup)
                    if !pre_restore.exists() {
                        if let Err(e) = std::fs::copy(&current_jsonl_path, &pre_restore) {
                            eprintln!(
                                "   [WARN] Failed to create safety backup for {}: {}",
                                sid, e
                            );
                            continue;
                        }
                    }
                }

                if is_json_source {
                    // Convert JSON → JSONL: parse and re-serialize as kind:0 JSONL entry
                    match parse_session_file(best_path) {
                        Ok(session) => {
                            // Read the raw JSON to preserve all fields
                            let raw_content =
                                std::fs::read_to_string(best_path).unwrap_or_default();
                            let raw_value: serde_json::Value =
                                serde_json::from_str(&raw_content).unwrap_or_default();
                            let jsonl_entry = serde_json::json!({"kind": 0, "v": raw_value});
                            if let Err(e) = std::fs::write(
                                &current_jsonl_path,
                                serde_json::to_string(&jsonl_entry).unwrap_or_default() + "\n",
                            ) {
                                eprintln!(
                                    "   [WARN] Failed to write converted JSONL for {}: {}",
                                    sid, e
                                );
                                continue;
                            }
                            // Update the session_id if missing in the converted file
                            let _ = session;
                        }
                        Err(e) => {
                            eprintln!("   [WARN] Failed to parse JSON backup for {}: {}", sid, e);
                            continue;
                        }
                    }
                } else {
                    // JSONL → JSONL: direct copy
                    if let Err(e) = std::fs::copy(best_path, &current_jsonl_path) {
                        eprintln!(
                            "   [WARN] Failed to restore {} from {}: {}",
                            sid, best_name, e
                        );
                        continue;
                    }
                }
            }

            actions.push(BackupRecoveryAction {
                session_id: sid.clone(),
                source_file: best_name.to_string(),
                current_requests,
                recovered_requests: best_requests,
                current_size,
                recovered_size: best_size,
                converted: is_json_source,
            });
        }
    }

    // Sort by session ID for deterministic output
    actions.sort_by(|a, b| a.session_id.cmp(&b.session_id));

    Ok(actions)
}

/// Fix modelState values in a session's requests array.
/// - Pending (value=0) or Cancelled (value=2) → set to Cancelled (3) with completedAt
/// - Terminal states (1, 3, 4) without completedAt → add completedAt from request timestamp
fn fix_request_model_states(session_data: &mut serde_json::Value) {
    let requests = match session_data
        .get_mut("requests")
        .and_then(|r| r.as_array_mut())
    {
        Some(r) => r,
        None => return,
    };

    for req in requests.iter_mut() {
        let timestamp = req
            .get("timestamp")
            .and_then(|t| t.as_i64())
            .unwrap_or_else(|| {
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as i64
            });

        if let Some(ms) = req.get_mut("modelState") {
            if let Some(val) = ms.get("value").and_then(|v| v.as_u64()) {
                match val {
                    0 | 2 => {
                        // Pending or Cancelled → force to Cancelled with completedAt
                        *ms = serde_json::json!({
                            "value": 3,
                            "completedAt": timestamp
                        });
                    }
                    1 | 3 | 4
                        // Terminal states — ensure completedAt exists
                        if ms.get("completedAt").is_none() => {
                            if let Some(ms_obj) = ms.as_object_mut() {
                                ms_obj.insert(
                                    "completedAt".to_string(),
                                    serde_json::json!(timestamp),
                                );
                            }
                        }
                    _ => {}
                }
            }
        }
    }
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
            is_imported: Some(_is_imported),
            has_pending_edits: Some(false),
            is_external: Some(false),
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
    for path in session_files.values() {
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
                    is_imported: Some(false),
                    has_pending_edits: Some(false),
                    is_external: Some(false),
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
    // sysinfo 0.37 requires saying which processes to refresh, and whether to
    // remove ones that have exited.
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    for process in sys.processes().values() {
        // `name()` returns an `&OsStr` since 0.31; a name that is not valid
        // Unicode should read as "no match" rather than panic.
        let name = process.name().to_string_lossy().to_lowercase();
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
        RefreshKind::nothing().with_processes(ProcessRefreshKind::everything()),
    );
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    let mut signaled = 0u32;
    // The key is read only by the Windows `taskkill` branch below, so on other
    // platforms it is genuinely unused. The underscore silences
    // `unused_variables` there (an underscore-prefixed binding is still usable
    // by name, which is what the Windows branch does), and `for_kv_map` is
    // allowed because switching to `.values()` would drop the pid that Windows
    // needs.
    #[allow(clippy::for_kv_map)]
    for (_pid, process) in sys.processes() {
        let name = process.name().to_string_lossy().to_lowercase();
        if name.contains("code") && !name.contains("codec") {
            // On Windows, kill() sends TerminateProcess; there's no graceful
            // SIGTERM equivalent via sysinfo. But the main electron process
            // handles WM_CLOSE. We use the `taskkill` approach on Windows for
            // a graceful close.
            #[cfg(windows)]
            {
                let _ = std::process::Command::new("taskkill")
                    .args(["/PID", &_pid.as_u32().to_string()])
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
                RefreshKind::nothing().with_processes(ProcessRefreshKind::everything()),
            );
            sys2.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
            for process in sys2.processes().values() {
                let name = process.name().to_string_lossy().to_lowercase();
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
    sessions.sort_by_key(|s| std::cmp::Reverse(s.last_message_date));

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
///
/// Handles a common corruption pattern where VS Code appends delta operations
/// to line 0 without newline separators (e.g., `}{"kind":1,...}{"kind":2,...}`).
pub fn compact_session_jsonl(path: &Path) -> Result<PathBuf> {
    let content = std::fs::read_to_string(path).map_err(|e| {
        CsmError::InvalidSessionFormat(format!("Failed to read {}: {}", path.display(), e))
    })?;

    // Pre-process: split concatenated JSON objects that lack newline separators.
    // VS Code sometimes appends delta ops to line 0 without a \n, producing:
    //   {"kind":0,"v":{...}}{"kind":1,...}{"kind":2,...}\n{"kind":1,...}\n...
    // We fix this by inserting newlines at every `}{"kind":` boundary.
    let content = split_concatenated_jsonl(&content);

    let mut lines = content.lines();

    // First line must be kind:0 (initial snapshot)
    let first_line = lines
        .next()
        .ok_or_else(|| CsmError::InvalidSessionFormat("Empty JSONL file".to_string()))?;

    let first_entry: serde_json::Value = match serde_json::from_str(first_line.trim()) {
        Ok(v) => v,
        Err(_) => {
            // Try sanitizing Unicode (lone surrogates, etc.)
            let sanitized = sanitize_json_unicode(first_line.trim());
            serde_json::from_str(&sanitized).map_err(|e| {
                CsmError::InvalidSessionFormat(format!("Invalid JSON on line 1: {}", e))
            })?
        }
    };

    let kind = first_entry
        .get("kind")
        .and_then(|k| k.as_u64())
        .unwrap_or(99);
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
                // Array replace/splice: k=["path","to","array"], v=[items], i=splice_index
                if let (Some(keys), Some(value)) = (entry.get("k"), entry.get("v")) {
                    let splice_index = entry.get("i").and_then(|i| i.as_u64()).map(|i| i as usize);
                    if let Some(keys_arr) = keys.as_array() {
                        apply_splice(&mut state, keys_arr, value.clone(), splice_index);
                    }
                }
            }
            _ => {} // Skip unknown kinds
        }
    }

    // Inject any missing fields that VS Code's latest format requires
    let session_id = path
        .file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.to_string());
    ensure_vscode_compat_fields(&mut state, session_id.as_deref());

    // Write the compacted file: single kind:0 line with the final state
    let compact_entry = serde_json::json!({"kind": 0, "v": state});
    let compact_content = serde_json::to_string(&compact_entry)
        .map_err(|e| CsmError::InvalidSessionFormat(format!("Failed to serialize: {}", e)))?;

    // Backup the original file
    let backup_path = path.with_extension("jsonl.bak");
    std::fs::rename(path, &backup_path)?;

    // Write the compacted file (trailing newline prevents concatenation
    // if VS Code later appends delta operations)
    std::fs::write(path, format!("{}\n", compact_content))?;

    Ok(backup_path)
}

/// Trim a session JSONL file by keeping only the last `keep` requests.
///
/// Very long chat sessions (100+ requests) can grow to 50-100+ MB, causing VS Code
/// to fail loading them. This function compacts the session first (if needed), then
/// removes old requests from the `requests` array, keeping only the most recent ones.
///
/// The full session is preserved as a `.jsonl.bak` backup. A trimmed summary is
/// injected as the first request message so the user knows context was archived.
///
/// Returns `(original_count, kept_count, original_mb, new_mb)`.
pub fn trim_session_jsonl(path: &Path, keep: usize) -> Result<(usize, usize, f64, f64)> {
    let content = std::fs::read_to_string(path).map_err(|e| {
        CsmError::InvalidSessionFormat(format!("Failed to read {}: {}", path.display(), e))
    })?;

    let original_size = content.len() as f64 / (1024.0 * 1024.0);

    // Always handle concatenated JSON objects first, then check line count
    let content = split_concatenated_jsonl(&content);
    let line_count = content.lines().filter(|l| !l.trim().is_empty()).count();

    // If multi-line (concatenated objects or delta ops), compact first
    let content = if line_count > 1 {
        // Write the split content so compact can process it
        std::fs::write(path, &content)?;
        compact_session_jsonl(path)?;
        std::fs::read_to_string(path).map_err(|e| {
            CsmError::InvalidSessionFormat(format!("Failed to read compacted file: {}", e))
        })?
    } else {
        content
    };

    let first_line = content
        .lines()
        .next()
        .ok_or_else(|| CsmError::InvalidSessionFormat("Empty JSONL file".to_string()))?;

    let mut entry: serde_json::Value = serde_json::from_str(first_line.trim())
        .map_err(|_| {
            let sanitized = sanitize_json_unicode(first_line.trim());
            serde_json::from_str::<serde_json::Value>(&sanitized)
                .map_err(|e| CsmError::InvalidSessionFormat(format!("Invalid JSON: {}", e)))
        })
        .unwrap_or_else(|e| e.unwrap());

    let kind = entry.get("kind").and_then(|k| k.as_u64()).unwrap_or(99);
    if kind != 0 {
        return Err(CsmError::InvalidSessionFormat(
            "First JSONL line must be kind:0".to_string(),
        ));
    }

    // Get the requests array
    let requests = match entry
        .get("v")
        .and_then(|v| v.get("requests"))
        .and_then(|r| r.as_array())
    {
        Some(r) => r.clone(),
        None => {
            return Err(CsmError::InvalidSessionFormat(
                "Session has no requests array".to_string(),
            ));
        }
    };

    let original_count = requests.len();

    if original_count <= keep {
        // Still strip bloated content even if not reducing request count
        strip_bloated_content(&mut entry);

        let trimmed_content = serde_json::to_string(&entry)
            .map_err(|e| CsmError::InvalidSessionFormat(format!("Failed to serialize: {}", e)))?;
        let new_size = trimmed_content.len() as f64 / (1024.0 * 1024.0);

        // Only rewrite if we actually reduced size
        if new_size < original_size * 0.9 {
            let backup_path = path.with_extension("jsonl.bak");
            if !backup_path.exists() {
                std::fs::copy(path, &backup_path)?;
            }
            std::fs::write(path, format!("{}\n", trimmed_content))?;
        }

        return Ok((original_count, original_count, original_size, new_size));
    }

    // Keep only the last `keep` requests
    let kept_requests: Vec<serde_json::Value> = requests[original_count - keep..].to_vec();

    // Use only the kept requests — no injected trim notice.
    // Injecting synthetic requests with non-standard agent/structure fields
    // can cause VS Code's session deserializer to reject the entire session.
    let final_requests = kept_requests;

    // Replace the requests array in the entry
    if let Some(v) = entry.get_mut("v") {
        if let Some(obj) = v.as_object_mut() {
            obj.insert("requests".to_string(), serde_json::json!(final_requests));
        }
    }

    // Strip bloated metadata, tool invocations, textEditGroups, thinking tokens
    strip_bloated_content(&mut entry);

    // Ensure compat fields
    let session_id = path
        .file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.to_string());
    if let Some(v) = entry.get_mut("v") {
        ensure_vscode_compat_fields(v, session_id.as_deref());
    }

    let trimmed_content = serde_json::to_string(&entry)
        .map_err(|e| CsmError::InvalidSessionFormat(format!("Failed to serialize: {}", e)))?;

    let new_size = trimmed_content.len() as f64 / (1024.0 * 1024.0);

    // Backup original (if not already backed up by compact)
    let backup_path = path.with_extension("jsonl.bak");
    if !backup_path.exists() {
        std::fs::copy(path, &backup_path)?;
    }

    // Write the trimmed file (trailing newline prevents concatenation)
    std::fs::write(path, format!("{}\n", trimmed_content))?;

    Ok((original_count, keep, original_size, new_size))
}

/// Strip bloated content from a session entry to reduce file size.
///
/// VS Code sessions accumulate large metadata that isn't needed for session display:
/// - `result.metadata`: Can be 100KB-1.5MB per request (Copilot internal state)
/// - `editedFileEvents`: Redundant file edit tracking
/// - `chatEdits`: File edit diffs
/// - `textEditGroup` response items: 80-120KB each with full file diffs
/// - `thinking` response items: Model thinking tokens (can be 400+ per request)
/// - `toolInvocationSerialized`: Tool call metadata (usually already stripped by compact)
/// - `toolSpecificData`: Duplicate data in tool invocations
///
/// This function strips or truncates all of these while preserving the conversation
/// content (markdownContent responses and user messages).
fn strip_bloated_content(entry: &mut serde_json::Value) {
    let requests = match entry
        .get_mut("v")
        .and_then(|v| v.get_mut("requests"))
        .and_then(|r| r.as_array_mut())
    {
        Some(r) => r,
        None => return,
    };

    for req in requests.iter_mut() {
        let obj = match req.as_object_mut() {
            Some(o) => o,
            None => continue,
        };

        // Strip result.metadata (100KB-1.5MB per request)
        if let Some(result) = obj.get_mut("result") {
            if let Some(result_obj) = result.as_object_mut() {
                if let Some(meta) = result_obj.get("metadata") {
                    let meta_str = serde_json::to_string(meta).unwrap_or_default();
                    if meta_str.len() > 1000 {
                        result_obj.insert(
                            "metadata".to_string(),
                            serde_json::Value::Object(serde_json::Map::new()),
                        );
                    }
                }
            }
        }

        // Strip editedFileEvents
        obj.remove("editedFileEvents");

        // Strip chatEdits
        obj.remove("chatEdits");

        // Truncate contentReferences to max 3
        if let Some(refs) = obj.get_mut("contentReferences") {
            if let Some(arr) = refs.as_array_mut() {
                if arr.len() > 3 {
                    arr.truncate(3);
                }
            }
        }

        // Process response items
        if let Some(response) = obj.get_mut("response") {
            if let Some(resp_arr) = response.as_array_mut() {
                // Remove non-essential response kinds
                resp_arr.retain(|r| {
                    let kind = r.get("kind").and_then(|k| k.as_str()).unwrap_or("");
                    !matches!(
                        kind,
                        "toolInvocationSerialized"
                            | "progressMessage"
                            | "confirmationWidget"
                            | "codeblockUri"
                            | "progressTaskSerialized"
                            | "undoStop"
                            | "mcpServersStarting"
                            | "confirmation"
                    )
                });

                // Truncate textEditGroup items (strip edit diffs, keep URI ref)
                for r in resp_arr.iter_mut() {
                    let kind = r
                        .get("kind")
                        .and_then(|k| k.as_str())
                        .unwrap_or("")
                        .to_string();

                    if kind == "textEditGroup" {
                        if let Some(edits) = r.get_mut("edits") {
                            if let Some(arr) = edits.as_array_mut() {
                                if serde_json::to_string(arr).unwrap_or_default().len() > 2000 {
                                    arr.clear();
                                }
                            }
                        }
                    }

                    // Truncate thinking tokens
                    if kind == "thinking" {
                        if let Some(val) = r.get_mut("value") {
                            if let Some(s) = val.as_str() {
                                if s.chars().count() > 500 {
                                    *val = serde_json::Value::String(format!(
                                        "{}... [truncated]",
                                        crate::text::head(s, 500)
                                    ));
                                }
                            }
                        }
                        if let Some(thought) = r.get_mut("thought") {
                            if let Some(thought_val) = thought.get_mut("value") {
                                if let Some(s) = thought_val.as_str() {
                                    if s.chars().count() > 500 {
                                        *thought_val = serde_json::Value::String(format!(
                                            "{}... [truncated]",
                                            crate::text::head(s, 500)
                                        ));
                                    }
                                }
                            }
                        }
                    }

                    // Truncate large markdownContent
                    if kind == "markdownContent" {
                        if let Some(content) = r.get_mut("content") {
                            if let Some(val) = content.get_mut("value") {
                                if let Some(s) = val.as_str() {
                                    if s.chars().count() > 20000 {
                                        *val = serde_json::Value::String(format!(
                                            "{}\n\n---\n*[Chasm: Content truncated for loading performance]*",
                                            crate::text::head(s, 20000)
                                        ));
                                    }
                                }
                            }
                        }
                    }
                }

                // Limit thinking items to last 5 per request
                let mut thinking_count = 0;
                let mut indices_to_remove = Vec::new();
                for (i, r) in resp_arr.iter().enumerate().rev() {
                    let kind = r.get("kind").and_then(|k| k.as_str()).unwrap_or("");
                    if kind == "thinking" {
                        thinking_count += 1;
                        if thinking_count > 5 {
                            indices_to_remove.push(i);
                        }
                    }
                }
                for idx in indices_to_remove {
                    resp_arr.remove(idx);
                }

                // Strip toolSpecificData from any remaining tool invocations
                for r in resp_arr.iter_mut() {
                    if let Some(obj) = r.as_object_mut() {
                        obj.remove("toolSpecificData");
                    }
                }

                // Fix response items missing `kind` field — wrap raw MarkdownString
                // objects as proper markdownContent response items.
                // VS Code sometimes serializes MarkdownString directly instead of
                // wrapping it in { kind: "markdownContent", content: MarkdownString }.
                // Without the `kind` discriminator, VS Code's deserializer fails.
                let fixed: Vec<serde_json::Value> = resp_arr
                    .drain(..)
                    .map(|item| {
                        if item.get("kind").is_none() {
                            // Check if it looks like a MarkdownString (has `value` or `supportHtml`)
                            if item.get("value").is_some() || item.get("supportHtml").is_some() {
                                serde_json::json!({
                                    "kind": "markdownContent",
                                    "content": item
                                })
                            } else {
                                item
                            }
                        } else {
                            item
                        }
                    })
                    .collect();
                *resp_arr = fixed;
            }
        }
    }
}

/// Split concatenated JSON objects in JSONL content that lack newline separators.
///
/// VS Code sometimes appends delta operations (kind:1, kind:2) onto the end of
/// a JSONL line without inserting a newline first. This produces invalid JSONL like:
///   `{"kind":0,"v":{...}}{"kind":1,...}{"kind":2,...}`
///
/// This function inserts newlines at every `}{"kind":` boundary to restore valid JSONL.
/// The pattern `}{"kind":` cannot appear inside JSON string values because `{"kind":`
/// would need to be escaped as `{\"kind\":` within a JSON string.
pub fn split_concatenated_jsonl(content: &str) -> String {
    // Fast path: if content has no concatenated objects, return as-is
    if !content.contains("}{\"kind\":") {
        return content.to_string();
    }

    content.replace("}{\"kind\":", "}\n{\"kind\":")
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
            if current.get(k).is_none() {
                current[k] = serde_json::Value::Object(serde_json::Map::new());
            }
            current = &mut current[k];
        } else if let Some(idx) = key.as_u64() {
            if let Some(arr) = current.as_array_mut() {
                // Auto-grow array with null placeholders if index is beyond current length.
                // VS Code's event sourcing may reference indices before they are formally
                // added via a kind:2 splice.
                while (idx as usize) >= arr.len() {
                    arr.push(serde_json::Value::Object(serde_json::Map::new()));
                }
                current = &mut arr[idx as usize];
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
                while (idx as usize) >= arr.len() {
                    arr.push(serde_json::Value::Null);
                }
                arr[idx as usize] = value;
            }
        }
    }
}

/// Apply an array replace/splice operation (kind:2) to a JSON value at the given key path.
/// When `splice_index` is `Some(i)`, truncates the target array at index `i` before extending.
/// When `splice_index` is `None`, replaces the entire array with the new items.
fn apply_splice(
    root: &mut serde_json::Value,
    keys: &[serde_json::Value],
    items: serde_json::Value,
    splice_index: Option<usize>,
) {
    if keys.is_empty() {
        return;
    }

    // Navigate to the target array
    let mut current = root;
    for key in keys {
        if let Some(k) = key.as_str() {
            if current.get(k).is_none() {
                current[k] = serde_json::json!([]);
            }
            current = &mut current[k];
        } else if let Some(idx) = key.as_u64() {
            if let Some(arr) = current.as_array_mut() {
                // Auto-grow array if index is beyond current length
                while (idx as usize) >= arr.len() {
                    arr.push(serde_json::Value::Object(serde_json::Map::new()));
                }
                current = &mut arr[idx as usize];
            } else {
                return;
            }
        }
    }

    // Splice or replace items in the target array
    if let Some(target_arr) = current.as_array_mut() {
        if let Some(idx) = splice_index {
            // Splice: truncate at index, then extend with new items
            target_arr.truncate(idx);
        } else {
            // Full replacement: clear the array
            target_arr.clear();
        }
        if let Some(new_items) = items.as_array() {
            target_arr.extend(new_items.iter().cloned());
        }
    }
}

/// Ensure a JSONL `kind:0` snapshot's `v` object has all fields required by
/// VS Code's latest session format (1.109.0+ / version 3). Missing fields are
/// injected with sensible defaults so sessions load reliably after recovery,
/// conversion, or compaction.
///
/// Required fields that VS Code now expects:
/// - `version` (u32, default 3)
/// - `sessionId` (string, extracted from filename or generated)
/// - `responderUsername` (string, default "GitHub Copilot")
/// - `hasPendingEdits` (bool, default false)
/// - `pendingRequests` (array, default [])
/// - `inputState` (object with mode, attachments, etc.)
pub fn ensure_vscode_compat_fields(state: &mut serde_json::Value, session_id: Option<&str>) {
    // Migrate old-format inputState (top-level attachments/mode/etc.) to nested object.
    // Must run BEFORE the inputState existence check below.
    migrate_old_input_state(state);

    if let Some(obj) = state.as_object_mut() {
        // version
        if !obj.contains_key("version") {
            obj.insert("version".to_string(), serde_json::json!(3));
        }

        // sessionId — use provided ID, or try to read from existing field
        if !obj.contains_key("sessionId") {
            if let Some(id) = session_id {
                obj.insert("sessionId".to_string(), serde_json::json!(id));
            }
        }

        // responderUsername
        if !obj.contains_key("responderUsername") {
            obj.insert(
                "responderUsername".to_string(),
                serde_json::json!("GitHub Copilot"),
            );
        }

        // hasPendingEdits — ALWAYS force to false for recovered/compacted sessions.
        // Sessions with hasPendingEdits:true cause VS Code to attempt restoring
        // stale file edits on load, which fails if files have changed since the
        // original session, preventing the session from loading entirely.
        obj.insert("hasPendingEdits".to_string(), serde_json::json!(false));

        // pendingRequests — ALWAYS force to empty for recovered/compacted sessions.
        // Stale pending requests can also block session loading.
        obj.insert("pendingRequests".to_string(), serde_json::json!([]));

        // inputState — VS Code expects this to exist with at least mode + attachments
        if !obj.contains_key("inputState") {
            obj.insert(
                "inputState".to_string(),
                serde_json::json!({
                    "attachments": [],
                    "mode": { "id": "agent", "kind": "agent" },
                    "inputText": "",
                    "selections": [],
                    "contrib": { "chatDynamicVariableModel": [] }
                }),
            );
        }
    }
}

/// Detect whether a legacy .json file is a "skeleton" — corrupted to contain only
/// structural characters ({}, [], commas, colons, whitespace) with all actual data stripped.
/// These files parse as valid JSON but contain no useful session content.
pub fn is_skeleton_json(content: &str) -> bool {
    // Must be non-trivial size to be a skeleton (tiny files might just be empty sessions)
    if content.len() < 100 {
        return false;
    }

    // Count structural vs data characters
    let structural_chars: usize = content
        .chars()
        .filter(|c| {
            matches!(
                c,
                '{' | '}' | '[' | ']' | ',' | ':' | ' ' | '\n' | '\r' | '\t' | '"'
            )
        })
        .count();

    let total_chars = content.len();
    let structural_ratio = structural_chars as f64 / total_chars as f64;

    // A skeleton file is >80% structural characters. Normal sessions have lots of
    // text content (messages, code, etc.) so the ratio is much lower.
    if structural_ratio < 0.80 {
        return false;
    }

    // Additionally verify: parse as JSON and check that requests array is empty or
    // contains only empty objects
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(content) {
        // Check if requests exist and are all empty
        if let Some(requests) = parsed.get("requests").and_then(|r| r.as_array()) {
            let all_empty = requests.iter().all(|req| {
                // A skeleton request has no "message" text or empty message content
                let msg = req
                    .get("message")
                    .and_then(|m| m.get("text"))
                    .and_then(|t| t.as_str());
                msg.map_or(true, |s| s.is_empty())
            });
            return all_empty;
        }
        // No requests array at all — also skeleton-like
        return true;
    }

    // Couldn't parse but high structural ratio — still likely skeleton
    structural_ratio > 0.85
}

/// Detect whether a session file (JSONL or JSON) is "gutted" — has multiple requests
/// but message/response content has been stripped, leaving only structural stubs.
///
/// A gutted session typically has >5 requests but <200 total characters of actual
/// message text + response text. This happens when VS Code or extensions corrupt
/// session data by preserving request structure while stripping content.
///
/// Returns `Some((request_count, total_content_chars))` if gutted, `None` if healthy.
pub fn is_gutted_session(path: &Path) -> Option<(usize, usize)> {
    let session = parse_session_file(path).ok()?;
    let request_count = session.requests.len();

    if request_count < 5 {
        return None; // Too few requests to be meaningfully gutted
    }

    let total_message_chars: usize = session
        .requests
        .iter()
        .filter_map(|req| req.message.as_ref().and_then(|m| m.text.as_ref()))
        .map(|text| text.len())
        .sum();

    let total_response_chars: usize = session
        .requests
        .iter()
        .filter_map(|req| req.response.as_ref().and_then(extract_response_text))
        .map(|text| text.len())
        .sum();

    let total_content = total_message_chars + total_response_chars;

    // Heuristic: a session with many requests should have substantial content.
    // Average at least 20 chars per request to be considered healthy.
    let min_expected = request_count * 20;
    if total_content < min_expected.min(200) {
        Some((request_count, total_content))
    } else {
        None
    }
}

/// Convert a skeleton .json file to a valid minimal .jsonl file.
/// Preserves title and timestamp from the index entry if available.
/// The original .json file is renamed to `.json.corrupt` (non-destructive).
/// Returns the path to the new .jsonl file, or None if conversion was skipped.
pub fn convert_skeleton_json_to_jsonl(
    json_path: &Path,
    title: Option<&str>,
    last_message_date: Option<i64>,
) -> Result<Option<PathBuf>> {
    let content = std::fs::read_to_string(json_path)
        .map_err(|e| CsmError::InvalidSessionFormat(format!("Read error: {}", e)))?;

    if !is_skeleton_json(&content) {
        return Ok(None);
    }

    let session_id = json_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();

    let title = title.unwrap_or("Recovered Session");
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    let timestamp = last_message_date.unwrap_or(now);

    // Build a valid minimal kind:0 JSONL entry
    let jsonl_entry = serde_json::json!({
        "kind": 0,
        "v": {
            "sessionId": session_id,
            "title": title,
            "lastMessageDate": timestamp,
            "requests": [],
            "version": 4,
            "hasPendingEdits": false,
            "pendingRequests": [],
            "inputState": {
                "attachments": [],
                "mode": { "id": "agent", "kind": "agent" },
                "inputText": "",
                "selections": [],
                "contrib": { "chatDynamicVariableModel": [] }
            },
            "responderUsername": "GitHub Copilot",
            "isImported": false,
            "initialLocation": "panel"
        }
    });

    let jsonl_path = json_path.with_extension("jsonl");
    let corrupt_path = json_path.with_extension("json.corrupt");

    // Don't overwrite an existing .jsonl
    if jsonl_path.exists() {
        // Just rename the skeleton to .corrupt
        std::fs::rename(json_path, &corrupt_path)?;
        return Ok(None);
    }

    // Write the new .jsonl file
    std::fs::write(
        &jsonl_path,
        serde_json::to_string(&jsonl_entry)
            .map_err(|e| CsmError::InvalidSessionFormat(format!("Serialize error: {}", e)))?,
    )?;

    // Rename original to .json.corrupt (non-destructive)
    std::fs::rename(json_path, &corrupt_path)?;

    Ok(Some(jsonl_path))
}

/// Fix cancelled `modelState` values in a compacted (single-line) JSONL session file.
///
/// VS Code determines `lastResponseState` from the file content, not the index.
/// If the last request's `modelState.value` is `2` (Cancelled) or missing entirely,
/// VS Code refuses to load the session. This function:
/// 1. Finds the last request in the `requests` array
/// 2. If `modelState.value` is `2` (Cancelled), changes it to `1` (Complete)
/// 3. If `modelState` is missing entirely, adds `{"value":1,"completedAt":<now>}`
///
/// Returns `true` if the file was modified.
pub fn fix_cancelled_model_state(path: &Path) -> Result<bool> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| CsmError::InvalidSessionFormat(format!("Read error: {}", e)))?;

    let lines: Vec<&str> = content.lines().collect();

    if lines.is_empty() {
        return Ok(false);
    }

    // For multi-line JSONL, we need to scan all lines to find the LAST modelState
    // delta for the highest request index. For single-line (compacted), we modify
    // the kind:0 snapshot directly.
    if lines.len() == 1 {
        // Compacted single-line JSONL: modify the kind:0 snapshot
        let mut entry: serde_json::Value = serde_json::from_str(lines[0].trim())
            .map_err(|e| CsmError::InvalidSessionFormat(format!("Invalid JSON: {}", e)))?;

        let is_kind_0 = entry
            .get("kind")
            .and_then(|k| k.as_u64())
            .map(|k| k == 0)
            .unwrap_or(false);

        if !is_kind_0 {
            return Ok(false);
        }

        let requests = match entry
            .get_mut("v")
            .and_then(|v| v.get_mut("requests"))
            .and_then(|r| r.as_array_mut())
        {
            Some(r) if !r.is_empty() => r,
            _ => return Ok(false),
        };

        let last_req = requests.last_mut().unwrap();
        let model_state = last_req.get("modelState");

        let needs_fix = match model_state {
            Some(ms) => {
                // Any value other than 1 (Complete) needs repair:
                // 0 = NotStarted/Unknown, 2 = Cancelled, 4 = InProgress
                ms.get("value").and_then(|v| v.as_u64()) != Some(1)
            }
            None => true, // Missing modelState = never completed
        };

        if !needs_fix {
            return Ok(false);
        }

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        last_req.as_object_mut().unwrap().insert(
            "modelState".to_string(),
            serde_json::json!({"value": 1, "completedAt": now}),
        );

        let patched = serde_json::to_string(&entry)
            .map_err(|e| CsmError::InvalidSessionFormat(format!("Serialize error: {}", e)))?;
        // Trailing newline prevents concatenation if VS Code appends deltas
        std::fs::write(path, format!("{}\n", patched))?;
        return Ok(true);
    }

    // Multi-line JSONL: find the highest request index referenced across all lines,
    // then check if the last modelState delta for that index has value=2 or is missing.
    // If so, append a corrective delta.
    let mut highest_req_idx: Option<usize> = None;
    let mut last_model_state_value: Option<u64> = None;

    // Check kind:0 snapshot for request count
    if let Ok(first_entry) = serde_json::from_str::<serde_json::Value>(lines[0].trim()) {
        if let Some(requests) = first_entry
            .get("v")
            .and_then(|v| v.get("requests"))
            .and_then(|r| r.as_array())
        {
            if !requests.is_empty() {
                let last_idx = requests.len() - 1;
                highest_req_idx = Some(last_idx);
                // Check modelState in the snapshot's last request
                if let Some(ms) = requests[last_idx].get("modelState") {
                    last_model_state_value = ms.get("value").and_then(|v| v.as_u64());
                }
            }
        }
    }

    // Scan deltas for higher request indices and modelState updates
    static REQ_IDX_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r#""k":\["requests",(\d+)"#).unwrap());

    for line in &lines[1..] {
        if let Some(caps) = REQ_IDX_RE.captures(line) {
            if let Ok(idx) = caps[1].parse::<usize>() {
                if highest_req_idx.is_none() || idx > highest_req_idx.unwrap() {
                    highest_req_idx = Some(idx);
                    last_model_state_value = None; // Reset for new highest
                }
                // Track modelState for the highest request index
                if Some(idx) == highest_req_idx && line.contains("\"modelState\"") {
                    if let Ok(entry) = serde_json::from_str::<serde_json::Value>(line.trim()) {
                        last_model_state_value = entry
                            .get("v")
                            .and_then(|v| v.get("value"))
                            .and_then(|v| v.as_u64());
                    }
                }
            }
        }
    }

    let req_idx = match highest_req_idx {
        Some(idx) => idx,
        None => return Ok(false),
    };

    let needs_fix = match last_model_state_value {
        Some(1) => false, // Already complete
        _ => true,        // 0=NotStarted, 2=Cancelled, 4=InProgress, None=missing
    };

    if !needs_fix {
        return Ok(false);
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let fix_delta = format!(
        "\n{{\"kind\":1,\"k\":[\"requests\",{},\"modelState\"],\"v\":{{\"value\":1,\"completedAt\":{}}}}}",
        req_idx, now
    );

    use std::io::Write;
    let mut file = std::fs::OpenOptions::new().append(true).open(path)?;
    file.write_all(fix_delta.as_bytes())?;

    Ok(true)
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
    let mut fields_fixed = 0;

    if chat_sessions_dir.exists() {
        // Pass 0.5a: Recover from .json.bak when .jsonl has fewer requests
        match recover_from_json_bak(chat_sessions_dir) {
            Ok(n) if n > 0 => {
                println!("   [OK] Recovered {} session(s) from .json.bak backups", n);
            }
            _ => {}
        }

        // Pass 0.5b: Recover from .jsonl.bak when backup is larger than active file
        match recover_from_jsonl_bak(chat_sessions_dir, false) {
            Ok((n, bytes)) if n > 0 => {
                println!(
                    "   [OK] Restored {} session(s) from .jsonl.bak ({:.1}MB recovered)",
                    n,
                    bytes as f64 / (1024.0 * 1024.0)
                );
            }
            _ => {}
        }

        // Pass 0.5c: Detect gutted sessions and recover from any available backup
        // (catches cases where request count matches but content was stripped)
        match recover_from_all_backups(chat_sessions_dir, false) {
            Ok(actions) if !actions.is_empty() => {
                for action in &actions {
                    println!(
                        "   [OK] Restored {} from {} ({} → {} requests, {:.1}KB → {:.1}KB)",
                        action.session_id,
                        action.source_file,
                        action.current_requests,
                        action.recovered_requests,
                        action.current_size as f64 / 1024.0,
                        action.recovered_size as f64 / 1024.0,
                    );
                }
            }
            _ => {}
        }

        // Pass 1: Compact large JSONL files and fix missing fields
        for entry in std::fs::read_dir(chat_sessions_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().is_some_and(|e| e == "jsonl") {
                let metadata = std::fs::metadata(&path)?;
                let size_mb = metadata.len() / (1024 * 1024);

                let raw_content = std::fs::read_to_string(&path)
                    .map_err(|e| CsmError::InvalidSessionFormat(format!("Read error: {}", e)))?;

                // Pre-process: split concatenated JSON objects that lack newline
                // separators. VS Code sometimes appends delta ops to line 0 without
                // a \n, producing: {"kind":0,...}{"kind":1,...}
                // If splitting changes the content, rewrite the file first.
                let content = split_concatenated_jsonl(&raw_content);
                if content != raw_content {
                    std::fs::write(&path, content.as_bytes())?;
                    let stem = path
                        .file_stem()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_default();
                    println!("   [OK] Fixed concatenated JSONL objects: {}", stem);
                }
                let line_count = content.lines().count();

                if line_count > 1 {
                    // Compact multi-line JSONL (has operations to replay)
                    let stem = path
                        .file_stem()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_default();
                    println!(
                        "   Compacting {} ({} lines, {}MB)...",
                        stem, line_count, size_mb
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
                                backup_path
                                    .file_name()
                                    .unwrap_or_default()
                                    .to_string_lossy()
                            );
                            compacted += 1;
                        }
                        Err(e) => {
                            println!("   [WARN] Failed to compact {}: {}", stem, e);
                        }
                    }
                } else {
                    // Single-line JSONL — check for missing VS Code fields
                    if let Some(first_line) = content.lines().next() {
                        if let Ok(mut obj) = serde_json::from_str::<serde_json::Value>(first_line) {
                            let is_kind_0 = obj
                                .get("kind")
                                .and_then(|k| k.as_u64())
                                .map(|k| k == 0)
                                .unwrap_or(false);

                            if is_kind_0 {
                                if let Some(v) = obj.get("v") {
                                    // Check if fields are missing OR have wrong values.
                                    // hasPendingEdits must be false — true prevents session loading
                                    // because VS Code tries to restore stale file edits that fail.
                                    let needs_fix = v.get("inputState").is_none()
                                        || v.get("sessionId").is_none()
                                        || v.get("hasPendingEdits")
                                            .and_then(|v| v.as_bool())
                                            .unwrap_or(true)
                                        || v.get("pendingRequests")
                                            .and_then(|v| v.as_array())
                                            .map(|a| !a.is_empty())
                                            .unwrap_or(true);

                                    if needs_fix {
                                        let session_id = path
                                            .file_stem()
                                            .and_then(|s| s.to_str())
                                            .map(|s| s.to_string());
                                        if let Some(v_mut) = obj.get_mut("v") {
                                            ensure_vscode_compat_fields(
                                                v_mut,
                                                session_id.as_deref(),
                                            );
                                        }
                                        let patched = serde_json::to_string(&obj).map_err(|e| {
                                            CsmError::InvalidSessionFormat(format!(
                                                "Failed to serialize: {}",
                                                e
                                            ))
                                        })?;
                                        // Trailing newline prevents concatenation
                                        std::fs::write(&path, format!("{}\n", patched))?;
                                        let stem = path
                                            .file_stem()
                                            .map(|s| s.to_string_lossy().to_string())
                                            .unwrap_or_default();
                                        println!("   [OK] Fixed VS Code compat fields: {}", stem);
                                        fields_fixed += 1;
                                    } else if !content.ends_with('\n') {
                                        // All compat fields correct but missing trailing newline
                                        std::fs::write(&path, format!("{}\n", first_line))?;
                                        let stem = path
                                            .file_stem()
                                            .map(|s| s.to_string_lossy().to_string())
                                            .unwrap_or_default();
                                        println!(
                                            "   [OK] Fixed missing trailing newline: {}",
                                            stem
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Pass 1.5: Convert skeleton .json files to valid .jsonl.
    // Skeleton files are legacy .json files where all data has been stripped,
    // leaving only structural characters ({}, [], whitespace). We convert them
    // to valid minimal .jsonl, preserving title/timestamp from the index,
    // and rename the original to .json.corrupt (non-destructive).
    let mut skeletons_converted = 0;
    if chat_sessions_dir.exists() {
        // Read current index to get titles/timestamps for converted sessions
        let index_entries: std::collections::HashMap<String, (String, Option<i64>)> =
            if let Ok(index) = read_chat_session_index(&db_path) {
                index
                    .entries
                    .iter()
                    .map(|(id, e)| (id.clone(), (e.title.clone(), Some(e.last_message_date))))
                    .collect()
            } else {
                std::collections::HashMap::new()
            };

        // Collect .json files that don't have a corresponding .jsonl
        let mut jsonl_stems: HashSet<String> = HashSet::new();
        for entry in std::fs::read_dir(chat_sessions_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().is_some_and(|e| e == "jsonl") {
                if let Some(stem) = path.file_stem() {
                    jsonl_stems.insert(stem.to_string_lossy().to_string());
                }
            }
        }

        for entry in std::fs::read_dir(chat_sessions_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().is_some_and(|e| e == "json")
                && !path.to_string_lossy().ends_with(".bak")
                && !path.to_string_lossy().ends_with(".corrupt")
            {
                let stem = path
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();

                // Skip if .jsonl already exists
                if jsonl_stems.contains(&stem) {
                    continue;
                }

                let (title, timestamp) = index_entries
                    .get(&stem)
                    .map(|(t, ts)| (t.as_str(), *ts))
                    .unwrap_or(("Recovered Session", None));

                match convert_skeleton_json_to_jsonl(&path, Some(title), timestamp) {
                    Ok(Some(jsonl_path)) => {
                        println!(
                            "   [OK] Converted skeleton .json → .jsonl: {} (\"{}\")",
                            stem, title
                        );
                        // Track the new .jsonl so subsequent passes process it
                        jsonl_stems.insert(stem);
                        skeletons_converted += 1;
                        let _ = jsonl_path; // used implicitly via jsonl_stems
                    }
                    Ok(None) => {} // Not a skeleton or skipped
                    Err(e) => {
                        println!("   [WARN] Failed to convert skeleton {}: {}", stem, e);
                    }
                }
            }
        }
    }

    // Pass 2: Fix cancelled modelState in all JSONL files.
    // VS Code reads modelState from file content (not the index) to determine
    // lastResponseState. If the last request has modelState.value=2 (Cancelled)
    // or is missing entirely, VS Code refuses to load the session.
    let mut cancelled_fixed = 0;
    if chat_sessions_dir.exists() {
        for entry in std::fs::read_dir(chat_sessions_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().is_some_and(|e| e == "jsonl") {
                match fix_cancelled_model_state(&path) {
                    Ok(true) => {
                        let stem = path
                            .file_stem()
                            .map(|s| s.to_string_lossy().to_string())
                            .unwrap_or_default();
                        println!("   [OK] Fixed cancelled modelState: {}", stem);
                        cancelled_fixed += 1;
                    }
                    Ok(false) => {} // No fix needed
                    Err(e) => {
                        let stem = path
                            .file_stem()
                            .map(|s| s.to_string_lossy().to_string())
                            .unwrap_or_default();
                        println!("   [WARN] Failed to fix modelState for {}: {}", stem, e);
                    }
                }
            }
        }
    }

    // Pass 3: Rebuild the index with correct metadata
    let (index_fixed, _) = sync_session_index(workspace_id, chat_sessions_dir, force)?;

    if fields_fixed > 0 {
        println!(
            "   [OK] Injected missing VS Code fields into {} session(s)",
            fields_fixed
        );
    }
    if skeletons_converted > 0 {
        println!(
            "   [OK] Converted {} skeleton .json file(s) to .jsonl",
            skeletons_converted
        );
    }
    if cancelled_fixed > 0 {
        println!(
            "   [OK] Fixed cancelled modelState in {} session(s)",
            cancelled_fixed
        );
    }

    Ok((compacted, index_fixed))
}

#[cfg(test)]
mod truncation_tests {
    use super::strip_bloated_content;

    fn entry_with(kind: &str, field: &str, value: String) -> serde_json::Value {
        serde_json::json!({
            "v": { "requests": [ { "response": [ { "kind": kind, field: value } ] } ] }
        })
    }

    /// The reason this module exists. These fields hold model output, which
    /// routinely contains emoji and non-Latin script, and the truncation used
    /// to slice **bytes**: `&s[..500]` lands mid-character and panics. Every
    /// session carrying a long non-ASCII "thinking" block was unreadable.
    #[test]
    fn multibyte_thinking_content_is_truncated_without_panicking() {
        let mut entry = entry_with("thinking", "value", "考".repeat(600));
        strip_bloated_content(&mut entry);

        let out = entry["v"]["requests"][0]["response"][0]["value"]
            .as_str()
            .expect("value should still be a string");
        assert!(out.ends_with("... [truncated]"), "{out}");
        assert_eq!(out.trim_end_matches("... [truncated]").chars().count(), 500);
    }

    #[test]
    fn multibyte_markdown_content_is_truncated_without_panicking() {
        let mut entry = serde_json::json!({
            "v": { "requests": [ { "response": [ {
                "kind": "markdownContent",
                "content": { "value": "🎉".repeat(20_050) }
            } ] } ] }
        });
        strip_bloated_content(&mut entry);

        let out = entry["v"]["requests"][0]["response"][0]["content"]["value"]
            .as_str()
            .expect("value should still be a string");
        assert!(out.contains("Content truncated"), "{out}");
        assert_eq!(out.chars().filter(|c| *c == '🎉').count(), 20_000);
    }

    /// Content already under the limit must be left exactly as it was --
    /// truncation that rewrites short values would corrupt every session.
    #[test]
    fn short_content_is_left_alone() {
        let original = "短いテキスト".to_string();
        let mut entry = entry_with("thinking", "value", original.clone());
        strip_bloated_content(&mut entry);

        assert_eq!(
            entry["v"]["requests"][0]["response"][0]["value"]
                .as_str()
                .unwrap(),
            original
        );
    }

    /// A boundary case the char/byte confusion hides: exactly at the limit is
    /// not "over" it.
    #[test]
    fn content_exactly_at_the_limit_is_not_truncated() {
        let exact = "あ".repeat(500);
        let mut entry = entry_with("thinking", "value", exact.clone());
        strip_bloated_content(&mut entry);
        assert_eq!(
            entry["v"]["requests"][0]["response"][0]["value"]
                .as_str()
                .unwrap(),
            exact
        );
    }
}
