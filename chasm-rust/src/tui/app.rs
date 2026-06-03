// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only
//! Application state for the TUI

use crate::models::{extract_response_text, ChatSession, Workspace};
use crate::workspace::{discover_workspaces, get_chat_sessions_from_workspace};
use std::path::PathBuf;

/// Current view mode in the TUI
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppMode {
    /// Viewing list of workspaces
    Workspaces,
    /// Viewing sessions within a workspace
    Sessions,
    /// Viewing details of a session
    SessionDetail,
    /// Global search results
    SearchResults,
    /// Help overlay
    Help,
}

/// How to sort sessions
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SortOrder {
    DateDesc,
    DateAsc,
    NameAsc,
    NameDesc,
    MessagesDesc,
    MessagesAsc,
}

impl SortOrder {
    pub fn label(self) -> &'static str {
        match self {
            Self::DateDesc => "Date ↓",
            Self::DateAsc => "Date ↑",
            Self::NameAsc => "Name A-Z",
            Self::NameDesc => "Name Z-A",
            Self::MessagesDesc => "Msgs ↓",
            Self::MessagesAsc => "Msgs ↑",
        }
    }

    pub fn next(self) -> Self {
        match self {
            Self::DateDesc => Self::DateAsc,
            Self::DateAsc => Self::NameAsc,
            Self::NameAsc => Self::NameDesc,
            Self::NameDesc => Self::MessagesDesc,
            Self::MessagesDesc => Self::MessagesAsc,
            Self::MessagesAsc => Self::DateDesc,
        }
    }
}

/// Export format for sessions
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExportFormat {
    Json,
    Jsonl,
    Markdown,
    Text,
}

impl ExportFormat {
    pub fn label(self) -> &'static str {
        match self {
            Self::Json => "JSON",
            Self::Jsonl => "JSONL",
            Self::Markdown => "Markdown",
            Self::Text => "Plain Text",
        }
    }

    pub fn extension(self) -> &'static str {
        match self {
            Self::Json => "json",
            Self::Jsonl => "jsonl",
            Self::Markdown => "md",
            Self::Text => "txt",
        }
    }

    pub fn all() -> &'static [ExportFormat] {
        &[Self::Json, Self::Jsonl, Self::Markdown, Self::Text]
    }
}

/// A search result referencing a session in a workspace
#[derive(Debug, Clone)]
pub struct SearchResult {
    pub workspace_hash: String,
    pub workspace_project: String,
    pub session_info: SessionInfo,
}

/// Session info for display
#[derive(Debug, Clone)]
pub struct SessionInfo {
    pub filename: String,
    pub path: PathBuf,
    pub session: ChatSession,
    pub last_modified: String,
    pub message_count: usize,
}

/// Application state
pub struct App {
    /// Current mode/view
    pub mode: AppMode,
    /// Previous mode (for returning from help)
    pub previous_mode: AppMode,
    /// All discovered workspaces
    pub workspaces: Vec<Workspace>,
    /// Currently selected workspace index
    pub workspace_index: usize,
    /// Sessions for the currently selected workspace
    pub sessions: Vec<SessionInfo>,
    /// Currently selected session index
    pub session_index: usize,
    /// Scroll offset for session detail view
    pub detail_scroll: usize,
    /// Search/filter query
    pub filter_query: String,
    /// Is filter input active
    pub filter_active: bool,
    /// Filtered workspace indices
    pub filtered_indices: Vec<usize>,
    /// Status message to display
    pub status_message: Option<String>,

    // --- New fields ---
    /// Session sort order
    pub sort_order: SortOrder,
    /// Session filter query (within sessions view)
    pub session_filter_query: String,
    /// Is session filter active
    pub session_filter_active: bool,
    /// Filtered session indices
    pub filtered_session_indices: Vec<usize>,
    /// Global search query
    pub search_query: String,
    /// Is search input active
    pub search_active: bool,
    /// Global search results
    pub search_results: Vec<SearchResult>,
    /// Selected search result index
    pub search_index: usize,
    /// Export format picker visible
    pub export_picker_active: bool,
    /// Selected export format index
    pub export_format_index: usize,
    /// Confirm delete dialog
    pub confirm_delete: bool,
    /// Yank (copy) message
    pub yank_message: Option<String>,
}

impl App {
    /// Create a new App instance and load workspaces
    pub fn new() -> anyhow::Result<Self> {
        let workspaces = discover_workspaces()?;
        let filtered_indices: Vec<usize> = (0..workspaces.len()).collect();

        let app = Self {
            mode: AppMode::Workspaces,
            previous_mode: AppMode::Workspaces,
            workspaces,
            workspace_index: 0,
            sessions: Vec::new(),
            session_index: 0,
            detail_scroll: 0,
            filter_query: String::new(),
            filter_active: false,
            filtered_indices,
            status_message: None,
            sort_order: SortOrder::DateDesc,
            session_filter_query: String::new(),
            session_filter_active: false,
            filtered_session_indices: Vec::new(),
            search_query: String::new(),
            search_active: false,
            search_results: Vec::new(),
            search_index: 0,
            export_picker_active: false,
            export_format_index: 0,
            confirm_delete: false,
            yank_message: None,
        };

        Ok(app)
    }

    /// Get the currently selected workspace (if any)
    pub fn current_workspace(&self) -> Option<&Workspace> {
        if self.filtered_indices.is_empty() {
            return None;
        }
        let actual_index = self.filtered_indices.get(self.workspace_index)?;
        self.workspaces.get(*actual_index)
    }

    /// Get the currently selected session (if any), respecting filter
    pub fn current_session(&self) -> Option<&SessionInfo> {
        if self.filtered_session_indices.is_empty() {
            return self.sessions.get(self.session_index);
        }
        let actual = self.filtered_session_indices.get(self.session_index)?;
        self.sessions.get(*actual)
    }

    /// Get visible session count
    pub fn visible_session_count(&self) -> usize {
        if self.filtered_session_indices.is_empty() && self.session_filter_query.is_empty() {
            self.sessions.len()
        } else {
            self.filtered_session_indices.len()
        }
    }

    /// Load sessions for the currently selected workspace
    pub fn load_sessions_for_current_workspace(&mut self) {
        self.sessions.clear();
        self.session_index = 0;
        self.session_filter_query.clear();
        self.session_filter_active = false;

        if let Some(ws) = self.current_workspace() {
            if let Ok(session_list) = get_chat_sessions_from_workspace(&ws.workspace_path) {
                for swp in session_list {
                    let modified = swp
                        .path
                        .metadata()
                        .ok()
                        .and_then(|m| m.modified().ok())
                        .map(|t| {
                            let datetime: chrono::DateTime<chrono::Utc> = t.into();
                            datetime.format("%Y-%m-%d %H:%M").to_string()
                        })
                        .unwrap_or_else(|| "unknown".to_string());

                    let msg_count = swp.session.request_count();
                    let filename = swp
                        .path
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| "unknown".to_string());

                    self.sessions.push(SessionInfo {
                        filename,
                        path: swp.path,
                        session: swp.session,
                        last_modified: modified,
                        message_count: msg_count,
                    });
                }
            }
        }

        self.sort_sessions();
        self.apply_session_filter();
    }

    /// Sort sessions according to current sort order
    pub fn sort_sessions(&mut self) {
        match self.sort_order {
            SortOrder::DateDesc => self
                .sessions
                .sort_by(|a, b| b.last_modified.cmp(&a.last_modified)),
            SortOrder::DateAsc => self
                .sessions
                .sort_by(|a, b| a.last_modified.cmp(&b.last_modified)),
            SortOrder::NameAsc => {
                self.sessions.sort_by(|a, b| {
                    a.session
                        .title()
                        .to_lowercase()
                        .cmp(&b.session.title().to_lowercase())
                });
            }
            SortOrder::NameDesc => {
                self.sessions.sort_by(|a, b| {
                    b.session
                        .title()
                        .to_lowercase()
                        .cmp(&a.session.title().to_lowercase())
                });
            }
            SortOrder::MessagesDesc => self
                .sessions
                .sort_by_key(|s| std::cmp::Reverse(s.message_count)),
            SortOrder::MessagesAsc => self.sessions.sort_by_key(|a| a.message_count),
        }
    }

    /// Cycle to next sort order
    pub fn cycle_sort(&mut self) {
        self.sort_order = self.sort_order.next();
        self.sort_sessions();
        self.apply_session_filter();
        self.session_index = 0;
        self.status_message = Some(format!("Sort: {}", self.sort_order.label()));
    }

    /// Apply session filter
    pub fn apply_session_filter(&mut self) {
        if self.session_filter_query.is_empty() {
            self.filtered_session_indices = (0..self.sessions.len()).collect();
        } else {
            let query = self.session_filter_query.to_lowercase();
            self.filtered_session_indices = self
                .sessions
                .iter()
                .enumerate()
                .filter(|(_, s)| {
                    s.session.title().to_lowercase().contains(&query)
                        || s.filename.to_lowercase().contains(&query)
                        || s.session.collect_all_text().to_lowercase().contains(&query)
                })
                .map(|(i, _)| i)
                .collect();
        }

        if self.session_index >= self.filtered_session_indices.len() {
            self.session_index = 0;
        }
    }

    /// Start session filter input
    pub fn start_session_filter(&mut self) {
        self.session_filter_active = true;
        self.session_filter_query.clear();
    }

    /// Handle session filter character input
    pub fn session_filter_input(&mut self, c: char) {
        self.session_filter_query.push(c);
        self.apply_session_filter();
    }

    /// Handle session filter backspace
    pub fn session_filter_backspace(&mut self) {
        self.session_filter_query.pop();
        self.apply_session_filter();
    }

    /// Confirm session filter
    pub fn confirm_session_filter(&mut self) {
        self.session_filter_active = false;
    }

    /// Cancel session filter
    pub fn cancel_session_filter(&mut self) {
        self.session_filter_active = false;
        self.session_filter_query.clear();
        self.apply_session_filter();
    }

    /// Apply filter to workspaces
    pub fn apply_filter(&mut self) {
        if self.filter_query.is_empty() {
            self.filtered_indices = (0..self.workspaces.len()).collect();
        } else {
            let query = self.filter_query.to_lowercase();
            self.filtered_indices = self
                .workspaces
                .iter()
                .enumerate()
                .filter(|(_, ws)| {
                    ws.project_path
                        .as_ref()
                        .map(|p| p.to_lowercase().contains(&query))
                        .unwrap_or(false)
                        || ws.hash.to_lowercase().contains(&query)
                })
                .map(|(i, _)| i)
                .collect();
        }

        if self.workspace_index >= self.filtered_indices.len() {
            self.workspace_index = 0;
        }

        self.load_sessions_for_current_workspace();
    }

    /// Start global search
    pub fn start_search(&mut self) {
        self.search_active = true;
        self.search_query.clear();
    }

    /// Handle search character input
    pub fn search_input(&mut self, c: char) {
        self.search_query.push(c);
    }

    /// Handle search backspace
    pub fn search_backspace(&mut self) {
        self.search_query.pop();
    }

    /// Execute global search across all workspaces
    pub fn execute_search(&mut self) {
        self.search_active = false;
        if self.search_query.is_empty() {
            return;
        }

        let query = self.search_query.to_lowercase();
        self.search_results.clear();
        self.search_index = 0;

        for ws in &self.workspaces {
            let project = ws
                .project_path
                .clone()
                .unwrap_or_else(|| ws.hash[..8.min(ws.hash.len())].to_string());

            if let Ok(session_list) = get_chat_sessions_from_workspace(&ws.workspace_path) {
                for swp in session_list {
                    let title = swp.session.title().to_lowercase();
                    let content = swp.session.collect_all_text().to_lowercase();

                    if title.contains(&query) || content.contains(&query) {
                        let modified = swp
                            .path
                            .metadata()
                            .ok()
                            .and_then(|m| m.modified().ok())
                            .map(|t| {
                                let datetime: chrono::DateTime<chrono::Utc> = t.into();
                                datetime.format("%Y-%m-%d %H:%M").to_string()
                            })
                            .unwrap_or_else(|| "unknown".to_string());

                        let msg_count = swp.session.request_count();
                        let filename = swp
                            .path
                            .file_name()
                            .map(|n| n.to_string_lossy().to_string())
                            .unwrap_or_else(|| "unknown".to_string());

                        self.search_results.push(SearchResult {
                            workspace_hash: ws.hash.clone(),
                            workspace_project: project.clone(),
                            session_info: SessionInfo {
                                filename,
                                path: swp.path,
                                session: swp.session,
                                last_modified: modified,
                                message_count: msg_count,
                            },
                        });
                    }
                }
            }
        }

        let count = self.search_results.len();
        self.previous_mode = self.mode;
        self.mode = AppMode::SearchResults;
        self.status_message = Some(format!(
            "Found {} result{} for \"{}\"",
            count,
            if count == 1 { "" } else { "s" },
            self.search_query
        ));
    }

    /// Cancel search
    pub fn cancel_search(&mut self) {
        self.search_active = false;
        self.search_query.clear();
    }

    /// Navigate up in the current list
    pub fn navigate_up(&mut self) {
        match self.mode {
            AppMode::Workspaces => {
                if self.workspace_index > 0 {
                    self.workspace_index -= 1;
                }
            }
            AppMode::Sessions => {
                if self.session_index > 0 {
                    self.session_index -= 1;
                }
            }
            AppMode::SearchResults => {
                if self.search_index > 0 {
                    self.search_index -= 1;
                }
            }
            AppMode::SessionDetail => {
                if self.detail_scroll > 0 {
                    self.detail_scroll -= 1;
                }
            }
            AppMode::Help => {}
        }
    }

    /// Navigate down in the current list
    pub fn navigate_down(&mut self) {
        match self.mode {
            AppMode::Workspaces => {
                if self.workspace_index + 1 < self.filtered_indices.len() {
                    self.workspace_index += 1;
                }
            }
            AppMode::Sessions => {
                if self.session_index + 1 < self.visible_session_count() {
                    self.session_index += 1;
                }
            }
            AppMode::SearchResults => {
                if self.search_index + 1 < self.search_results.len() {
                    self.search_index += 1;
                }
            }
            AppMode::SessionDetail => {
                self.detail_scroll += 1;
            }
            AppMode::Help => {}
        }
    }

    /// Page up (jump 10 items)
    pub fn page_up(&mut self) {
        match self.mode {
            AppMode::Workspaces => {
                self.workspace_index = self.workspace_index.saturating_sub(10);
            }
            AppMode::Sessions => {
                self.session_index = self.session_index.saturating_sub(10);
            }
            AppMode::SearchResults => {
                self.search_index = self.search_index.saturating_sub(10);
            }
            AppMode::SessionDetail => {
                self.detail_scroll = self.detail_scroll.saturating_sub(10);
            }
            AppMode::Help => {}
        }
    }

    /// Page down (jump 10 items)
    pub fn page_down(&mut self) {
        match self.mode {
            AppMode::Workspaces => {
                let max = self.filtered_indices.len().saturating_sub(1);
                self.workspace_index = (self.workspace_index + 10).min(max);
            }
            AppMode::Sessions => {
                let max = self.visible_session_count().saturating_sub(1);
                self.session_index = (self.session_index + 10).min(max);
            }
            AppMode::SearchResults => {
                let max = self.search_results.len().saturating_sub(1);
                self.search_index = (self.search_index + 10).min(max);
            }
            AppMode::SessionDetail => {
                self.detail_scroll += 10;
            }
            AppMode::Help => {}
        }
    }

    /// Go to top of list
    pub fn go_to_top(&mut self) {
        match self.mode {
            AppMode::Workspaces => self.workspace_index = 0,
            AppMode::Sessions => self.session_index = 0,
            AppMode::SearchResults => self.search_index = 0,
            AppMode::SessionDetail => self.detail_scroll = 0,
            AppMode::Help => {}
        }
    }

    /// Go to bottom of list
    pub fn go_to_bottom(&mut self) {
        match self.mode {
            AppMode::Workspaces => {
                self.workspace_index = self.filtered_indices.len().saturating_sub(1);
            }
            AppMode::Sessions => {
                self.session_index = self.visible_session_count().saturating_sub(1);
            }
            AppMode::SearchResults => {
                self.search_index = self.search_results.len().saturating_sub(1);
            }
            AppMode::SessionDetail => {
                self.detail_scroll = usize::MAX;
            }
            AppMode::Help => {}
        }
    }

    /// Enter/select current item
    pub fn enter(&mut self) {
        match self.mode {
            AppMode::Workspaces => {
                self.load_sessions_for_current_workspace();
                if !self.sessions.is_empty() {
                    self.mode = AppMode::Sessions;
                    self.session_index = 0;
                } else {
                    self.status_message = Some("No sessions in this workspace".to_string());
                }
            }
            AppMode::Sessions => {
                if self.current_session().is_some() {
                    self.mode = AppMode::SessionDetail;
                    self.detail_scroll = 0;
                }
            }
            AppMode::SearchResults => {
                if let Some(result) = self.search_results.get(self.search_index) {
                    // Load this session into the detail view
                    self.sessions = vec![result.session_info.clone()];
                    self.filtered_session_indices = vec![0];
                    self.session_index = 0;
                    self.mode = AppMode::SessionDetail;
                    self.detail_scroll = 0;
                }
            }
            AppMode::SessionDetail | AppMode::Help => {}
        }
    }

    /// Go back to previous view
    pub fn back(&mut self) {
        match self.mode {
            AppMode::Workspaces => {}
            AppMode::Sessions => {
                self.mode = AppMode::Workspaces;
                self.session_filter_query.clear();
                self.session_filter_active = false;
            }
            AppMode::SessionDetail => {
                if self.previous_mode == AppMode::SearchResults {
                    self.mode = AppMode::SearchResults;
                } else {
                    self.mode = AppMode::Sessions;
                }
            }
            AppMode::SearchResults => {
                self.mode = self.previous_mode;
                if self.mode == AppMode::SearchResults {
                    self.mode = AppMode::Workspaces;
                }
            }
            AppMode::Help => {
                self.mode = self.previous_mode;
            }
        }
    }

    /// Toggle help overlay
    pub fn toggle_help(&mut self) {
        if self.mode == AppMode::Help {
            self.mode = self.previous_mode;
        } else {
            self.previous_mode = self.mode;
            self.mode = AppMode::Help;
        }
    }

    /// Start filter input (for current view)
    pub fn start_filter(&mut self) {
        match self.mode {
            AppMode::Workspaces => {
                self.filter_active = true;
                self.filter_query.clear();
            }
            AppMode::Sessions => {
                self.start_session_filter();
            }
            _ => {}
        }
    }

    /// Handle filter character input
    pub fn filter_input(&mut self, c: char) {
        if self.filter_active {
            self.filter_query.push(c);
            self.apply_filter();
        }
    }

    /// Handle backspace in filter
    pub fn filter_backspace(&mut self) {
        if self.filter_active {
            self.filter_query.pop();
            self.apply_filter();
        }
    }

    /// Confirm filter
    pub fn confirm_filter(&mut self) {
        self.filter_active = false;
    }

    /// Cancel filter
    pub fn cancel_filter(&mut self) {
        self.filter_active = false;
        self.filter_query.clear();
        self.apply_filter();
    }

    /// Refresh data
    pub fn refresh(&mut self) {
        if let Ok(workspaces) = discover_workspaces() {
            self.workspaces = workspaces;
            self.apply_filter();
            self.status_message = Some("Refreshed workspace data".to_string());
        }
    }

    /// Get count of workspaces with chats
    pub fn workspaces_with_chats(&self) -> usize {
        self.workspaces
            .iter()
            .filter(|w| w.has_chat_sessions)
            .count()
    }

    /// Get total session count
    pub fn total_sessions(&self) -> usize {
        self.workspaces.iter().map(|w| w.chat_session_count).sum()
    }

    /// Show export format picker
    pub fn show_export_picker(&mut self) {
        self.export_picker_active = true;
        self.export_format_index = 0;
    }

    /// Select export format and export
    pub fn confirm_export(&mut self) {
        self.export_picker_active = false;
        let format = ExportFormat::all()[self.export_format_index];
        self.export_session_as(format);
    }

    /// Cancel export picker
    pub fn cancel_export(&mut self) {
        self.export_picker_active = false;
    }

    /// Export the currently viewed session in the given format
    pub fn export_session_as(&mut self, format: ExportFormat) {
        let session_info = if self.mode == AppMode::SearchResults {
            self.search_results
                .get(self.search_index)
                .map(|r| &r.session_info)
        } else {
            self.current_session()
        };

        let Some(session_info) = session_info else {
            self.status_message = Some("No session selected".to_string());
            return;
        };

        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let filename = format!("chasm_export_{}.{}", timestamp, format.extension());

        let content = match format {
            ExportFormat::Json => serde_json::to_string_pretty(&session_info.session).ok(),
            ExportFormat::Jsonl => {
                let lines: Vec<String> = session_info
                    .session
                    .requests
                    .iter()
                    .filter_map(|req| serde_json::to_string(req).ok())
                    .collect();
                Some(lines.join("\n"))
            }
            ExportFormat::Markdown => {
                let title = session_info.session.title();
                let mut md = format!("# {}\n\n", title);
                md.push_str(&format!(
                    "> Exported: {} · Messages: {}\n\n",
                    session_info.last_modified, session_info.message_count
                ));
                for (i, req) in session_info.session.requests.iter().enumerate() {
                    if let Some(msg) = &req.message {
                        let text = msg.get_text();
                        if !text.is_empty() {
                            md.push_str(&format!("## Message {}\n\n", i + 1));
                            md.push_str(&format!("**User:**\n\n{}\n\n", text));
                        }
                    }
                    if let Some(resp) = &req.response {
                        if let Some(result) = extract_response_text(resp) {
                            md.push_str(&format!("**Assistant:**\n\n{}\n\n---\n\n", result));
                        }
                    }
                }
                Some(md)
            }
            ExportFormat::Text => {
                let title = session_info.session.title();
                let mut txt = format!("{}\n{}\n\n", title, "=".repeat(title.len()));
                for (i, req) in session_info.session.requests.iter().enumerate() {
                    if let Some(msg) = &req.message {
                        let text = msg.get_text();
                        if !text.is_empty() {
                            txt.push_str(&format!("[{}] User:\n{}\n\n", i + 1, text));
                        }
                    }
                    if let Some(resp) = &req.response {
                        if let Some(result) = extract_response_text(resp) {
                            txt.push_str(&format!("[{}] Assistant:\n{}\n\n", i + 1, result));
                        }
                    }
                }
                Some(txt)
            }
        };

        match content {
            Some(data) => match std::fs::write(&filename, &data) {
                Ok(_) => {
                    self.status_message =
                        Some(format!("Exported {} to {}", format.label(), filename));
                }
                Err(e) => {
                    self.status_message = Some(format!("Export failed: {e}"));
                }
            },
            None => {
                self.status_message = Some("Serialization failed".to_string());
            }
        }
    }

    /// Export the currently viewed session (quick JSON export)
    pub fn export_current_session(&mut self) {
        self.show_export_picker();
    }

    /// Delete the currently selected session file
    pub fn delete_current_session(&mut self) {
        if !self.confirm_delete {
            self.confirm_delete = true;
            self.status_message =
                Some("Press d again to confirm delete, Esc to cancel".to_string());
            return;
        }

        self.confirm_delete = false;

        let path = if let Some(session_info) = self.current_session() {
            session_info.path.clone()
        } else {
            self.status_message = Some("No session selected".to_string());
            return;
        };

        match std::fs::remove_file(&path) {
            Ok(_) => {
                let name = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                self.status_message = Some(format!("Deleted {}", name));
                self.load_sessions_for_current_workspace();
            }
            Err(e) => {
                self.status_message = Some(format!("Delete failed: {e}"));
            }
        }
    }

    /// Cancel delete confirmation
    pub fn cancel_delete(&mut self) {
        self.confirm_delete = false;
        self.status_message = None;
    }

    /// Yank (copy) session text content to clipboard-like buffer and show confirmation
    pub fn yank_session(&mut self) {
        let session_info = if self.mode == AppMode::SearchResults {
            self.search_results
                .get(self.search_index)
                .map(|r| &r.session_info)
        } else {
            self.current_session()
        };

        if let Some(session_info) = session_info {
            let text = session_info.session.collect_all_text();
            let char_count = text.len();
            self.yank_message = Some(text);
            self.status_message = Some(format!("Yanked {} chars to buffer", char_count));
        } else {
            self.status_message = Some("No session selected".to_string());
        }
    }

    /// Get the breadcrumb path for current navigation
    pub fn breadcrumb(&self) -> String {
        match self.mode {
            AppMode::Workspaces => "◆ Workspaces".to_string(),
            AppMode::Sessions => {
                let ws_name = self
                    .current_workspace()
                    .and_then(|ws| ws.project_path.as_ref())
                    .map(|p| p.split(['/', '\\']).next_back().unwrap_or(p).to_string())
                    .unwrap_or_else(|| "workspace".to_string());
                format!("◆ Workspaces › {}", ws_name)
            }
            AppMode::SessionDetail => {
                let ws_name = self
                    .current_workspace()
                    .and_then(|ws| ws.project_path.as_ref())
                    .map(|p| p.split(['/', '\\']).next_back().unwrap_or(p).to_string())
                    .unwrap_or_else(|| "workspace".to_string());
                let session_title = self
                    .current_session()
                    .map(|s| {
                        let t = s.session.title();
                        if t.len() > 30 {
                            format!("{}...", &t[..27])
                        } else {
                            t
                        }
                    })
                    .unwrap_or_else(|| "session".to_string());
                format!("◆ Workspaces › {} › {}", ws_name, session_title)
            }
            AppMode::SearchResults => {
                format!("◆ Search: \"{}\"", self.search_query)
            }
            AppMode::Help => "◆ Help".to_string(),
        }
    }
}
