// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only
//! Workspace listing commands

use anyhow::Result;
use tabled::{settings::Style as TableStyle, Table, Tabled};

use crate::models::Workspace;
use crate::storage::{read_empty_window_sessions, VsCodeSessionFormat};
use crate::workspace::discover_workspaces;

#[derive(Tabled)]
struct WorkspaceRow {
    #[tabled(rename = "Hash")]
    hash: String,
    #[tabled(rename = "Project Path")]
    project_path: String,
    #[tabled(rename = "Sessions")]
    sessions: usize,
    #[tabled(rename = "Has Chats")]
    has_chats: String,
}

#[derive(Tabled)]
struct SessionRow {
    #[tabled(rename = "Project Path")]
    project_path: String,
    #[tabled(rename = "Session File")]
    session_file: String,
    #[tabled(rename = "Last Modified")]
    last_modified: String,
    #[tabled(rename = "Messages")]
    messages: usize,
}

#[derive(Tabled)]
struct SessionRowWithSize {
    #[tabled(rename = "Project Path")]
    project_path: String,
    #[tabled(rename = "Session File")]
    session_file: String,
    #[tabled(rename = "Last Modified")]
    last_modified: String,
    #[tabled(rename = "Messages")]
    messages: usize,
    #[tabled(rename = "Size")]
    size: String,
}

/// List all VS Code workspaces
pub fn list_workspaces() -> Result<()> {
    let workspaces = discover_workspaces()?;

    if workspaces.is_empty() {
        println!("No workspaces found.");
        return Ok(());
    }

    let rows: Vec<WorkspaceRow> = workspaces
        .iter()
        .map(|ws| WorkspaceRow {
            hash: format!("{}...", &ws.hash[..12.min(ws.hash.len())]),
            project_path: ws
                .project_path
                .clone()
                .unwrap_or_else(|| "(none)".to_string()),
            sessions: ws.chat_session_count,
            has_chats: if ws.has_chat_sessions {
                "Yes".to_string()
            } else {
                "No".to_string()
            },
        })
        .collect();

    let table = Table::new(rows)
        .with(TableStyle::ascii_rounded())
        .to_string();

    println!("{}", table);
    println!("\nTotal workspaces: {}", workspaces.len());

    // Show empty window sessions count (ALL SESSIONS)
    if let Ok(empty_count) = crate::storage::count_empty_window_sessions() {
        if empty_count > 0 {
            println!("Empty window sessions (ALL SESSIONS): {}", empty_count);
        }
    }

    Ok(())
}

/// Format file size in human-readable format
fn format_file_size(bytes: u64) -> String {
    if bytes < 1024 {
        format!("{} B", bytes)
    } else if bytes < 1024 * 1024 {
        format!("{:.1} KB", bytes as f64 / 1024.0)
    } else if bytes < 1024 * 1024 * 1024 {
        format!("{:.1} MB", bytes as f64 / (1024.0 * 1024.0))
    } else {
        format!("{:.2} GB", bytes as f64 / (1024.0 * 1024.0 * 1024.0))
    }
}

/// List all chat sessions
pub fn list_sessions(
    project_path: Option<&str>,
    show_size: bool,
    provider: Option<&str>,
    all_providers: bool,
) -> Result<()> {
    // If provider filtering is requested, use the multi-provider approach
    if provider.is_some() || all_providers {
        return list_sessions_multi_provider(project_path, show_size, provider, all_providers);
    }

    // Default behavior: VS Code only (backward compatible)
    let workspaces = discover_workspaces()?;

    let filtered_workspaces: Vec<&Workspace> = if let Some(path) = project_path {
        let normalized = crate::workspace::normalize_path(path);
        workspaces
            .iter()
            .filter(|ws| {
                ws.project_path
                    .as_ref()
                    .map(|p| crate::workspace::normalize_path(p) == normalized)
                    .unwrap_or(false)
            })
            .collect()
    } else {
        workspaces.iter().collect()
    };

    if show_size {
        let mut rows: Vec<SessionRowWithSize> = Vec::new();
        let mut total_size: u64 = 0;

        // Add empty window sessions (ALL SESSIONS) if no specific project filter
        if project_path.is_none() {
            if let Ok(empty_sessions) = read_empty_window_sessions() {
                for session in empty_sessions {
                    let modified =
                        chrono::DateTime::from_timestamp_millis(session.last_message_date)
                            .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string())
                            .unwrap_or_else(|| "unknown".to_string());

                    let session_id = session.session_id.as_deref().unwrap_or("unknown");
                    rows.push(SessionRowWithSize {
                        project_path: "(ALL SESSIONS)".to_string(),
                        session_file: format!("{}.json", session_id),
                        last_modified: modified,
                        messages: session.request_count(),
                        size: "N/A".to_string(),
                    });
                }
            }
        }

        for ws in &filtered_workspaces {
            if !ws.has_chat_sessions {
                continue;
            }

            let sessions = crate::workspace::get_chat_sessions_from_workspace(&ws.workspace_path)?;

            for session_with_path in sessions {
                let metadata = session_with_path.path.metadata().ok();
                let file_size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
                total_size += file_size;

                let modified = metadata
                    .and_then(|m| m.modified().ok())
                    .map(|t| {
                        let datetime: chrono::DateTime<chrono::Utc> = t.into();
                        datetime.format("%Y-%m-%d %H:%M").to_string()
                    })
                    .unwrap_or_else(|| "unknown".to_string());

                rows.push(SessionRowWithSize {
                    project_path: ws
                        .project_path
                        .clone()
                        .unwrap_or_else(|| "(none)".to_string()),
                    session_file: session_with_path
                        .path
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| "unknown".to_string()),
                    last_modified: modified,
                    messages: session_with_path.session.request_count(),
                    size: format_file_size(file_size),
                });
            }
        }

        if rows.is_empty() {
            println!("No chat sessions found.");
            return Ok(());
        }

        let table = Table::new(&rows)
            .with(TableStyle::ascii_rounded())
            .to_string();
        println!("{}", table);
        println!(
            "\nTotal sessions: {} ({})",
            rows.len(),
            format_file_size(total_size)
        );
    } else {
        let mut rows: Vec<SessionRow> = Vec::new();

        // Add empty window sessions (ALL SESSIONS) if no specific project filter
        if project_path.is_none() {
            if let Ok(empty_sessions) = read_empty_window_sessions() {
                for session in empty_sessions {
                    let modified =
                        chrono::DateTime::from_timestamp_millis(session.last_message_date)
                            .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string())
                            .unwrap_or_else(|| "unknown".to_string());

                    let session_id = session.session_id.as_deref().unwrap_or("unknown");
                    rows.push(SessionRow {
                        project_path: "(ALL SESSIONS)".to_string(),
                        session_file: format!("{}.json", session_id),
                        last_modified: modified,
                        messages: session.request_count(),
                    });
                }
            }
        }

        for ws in &filtered_workspaces {
            if !ws.has_chat_sessions {
                continue;
            }

            let sessions = crate::workspace::get_chat_sessions_from_workspace(&ws.workspace_path)?;

            for session_with_path in sessions {
                let modified = session_with_path
                    .path
                    .metadata()
                    .ok()
                    .and_then(|m| m.modified().ok())
                    .map(|t| {
                        let datetime: chrono::DateTime<chrono::Utc> = t.into();
                        datetime.format("%Y-%m-%d %H:%M").to_string()
                    })
                    .unwrap_or_else(|| "unknown".to_string());

                rows.push(SessionRow {
                    project_path: ws
                        .project_path
                        .clone()
                        .unwrap_or_else(|| "(none)".to_string()),
                    session_file: session_with_path
                        .path
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| "unknown".to_string()),
                    last_modified: modified,
                    messages: session_with_path.session.request_count(),
                });
            }
        }

        if rows.is_empty() {
            println!("No chat sessions found.");
            return Ok(());
        }

        let table = Table::new(&rows)
            .with(TableStyle::ascii_rounded())
            .to_string();
        println!("{}", table);
        println!("\nTotal sessions: {}", rows.len());
    }

    Ok(())
}

/// List sessions from multiple providers
fn list_sessions_multi_provider(
    project_path: Option<&str>,
    show_size: bool,
    provider: Option<&str>,
    all_providers: bool,
) -> Result<()> {
    // Determine which storage paths to scan
    let storage_paths = if all_providers {
        get_agent_storage_paths(Some("all"))?
    } else if let Some(p) = provider {
        get_agent_storage_paths(Some(p))?
    } else {
        get_agent_storage_paths(None)?
    };

    if storage_paths.is_empty() {
        if let Some(p) = provider {
            println!("No storage found for provider: {}", p);
        } else {
            println!("No workspaces found");
        }
        return Ok(());
    }

    let target_path = project_path.map(crate::workspace::normalize_path);

    #[derive(Tabled)]
    struct SessionRowMulti {
        #[tabled(rename = "Provider")]
        provider: String,
        #[tabled(rename = "Project Path")]
        project_path: String,
        #[tabled(rename = "Session File")]
        session_file: String,
        #[tabled(rename = "Modified")]
        last_modified: String,
        #[tabled(rename = "Msgs")]
        messages: usize,
    }

    #[derive(Tabled)]
    struct SessionRowMultiWithSize {
        #[tabled(rename = "Provider")]
        provider: String,
        #[tabled(rename = "Project Path")]
        project_path: String,
        #[tabled(rename = "Session File")]
        session_file: String,
        #[tabled(rename = "Modified")]
        last_modified: String,
        #[tabled(rename = "Msgs")]
        messages: usize,
        #[tabled(rename = "Size")]
        size: String,
    }

    let mut rows: Vec<SessionRowMulti> = Vec::new();
    let mut rows_with_size: Vec<SessionRowMultiWithSize> = Vec::new();
    let mut total_size: u64 = 0;

    for (provider_name, storage_path) in &storage_paths {
        if !storage_path.exists() {
            continue;
        }

        for entry in std::fs::read_dir(storage_path)?.filter_map(|e| e.ok()) {
            let workspace_dir = entry.path();
            if !workspace_dir.is_dir() {
                continue;
            }

            let chat_sessions_dir = workspace_dir.join("chatSessions");
            if !chat_sessions_dir.exists() {
                continue;
            }

            // Get project path from workspace.json
            let workspace_json = workspace_dir.join("workspace.json");
            let project = std::fs::read_to_string(&workspace_json)
                .ok()
                .and_then(|c| serde_json::from_str::<crate::models::WorkspaceJson>(&c).ok())
                .and_then(|ws| {
                    ws.folder
                        .map(|f| crate::workspace::decode_workspace_folder(&f))
                });

            // Filter by project path if specified
            if let Some(ref target) = target_path {
                if project
                    .as_ref()
                    .map(|p| crate::workspace::normalize_path(p) != *target)
                    .unwrap_or(true)
                {
                    continue;
                }
            }

            let project_display = project.clone().unwrap_or_else(|| "(none)".to_string());

            // List session files
            for session_entry in std::fs::read_dir(&chat_sessions_dir)?.filter_map(|e| e.ok()) {
                let session_path = session_entry.path();
                if !session_path.is_file() {
                    continue;
                }

                let ext = session_path.extension().and_then(|e| e.to_str());
                if ext != Some("json") && ext != Some("jsonl") {
                    continue;
                }

                let metadata = session_path.metadata().ok();
                let file_size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
                total_size += file_size;

                let modified = metadata
                    .and_then(|m| m.modified().ok())
                    .map(|t| {
                        let datetime: chrono::DateTime<chrono::Utc> = t.into();
                        datetime.format("%Y-%m-%d %H:%M").to_string()
                    })
                    .unwrap_or_else(|| "unknown".to_string());

                let session_file = session_path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| "unknown".to_string());

                // Try to get message count from the session file
                let messages = std::fs::read_to_string(&session_path)
                    .ok()
                    .map(|c| c.matches("\"message\":").count())
                    .unwrap_or(0);

                if show_size {
                    rows_with_size.push(SessionRowMultiWithSize {
                        provider: provider_name.clone(),
                        project_path: truncate_string(&project_display, 30),
                        session_file: truncate_string(&session_file, 20),
                        last_modified: modified,
                        messages,
                        size: format_file_size(file_size),
                    });
                } else {
                    rows.push(SessionRowMulti {
                        provider: provider_name.clone(),
                        project_path: truncate_string(&project_display, 30),
                        session_file: truncate_string(&session_file, 20),
                        last_modified: modified,
                        messages,
                    });
                }
            }
        }
    }

    if show_size {
        if rows_with_size.is_empty() {
            println!("No chat sessions found.");
            return Ok(());
        }
        let table = Table::new(&rows_with_size)
            .with(TableStyle::ascii_rounded())
            .to_string();
        println!("{}", table);
        println!(
            "\nTotal sessions: {} ({})",
            rows_with_size.len(),
            format_file_size(total_size)
        );
    } else {
        if rows.is_empty() {
            println!("No chat sessions found.");
            return Ok(());
        }
        let table = Table::new(&rows)
            .with(TableStyle::ascii_rounded())
            .to_string();
        println!("{}", table);
        println!("\nTotal sessions: {}", rows.len());
    }

    Ok(())
}

/// Find workspaces by search pattern
pub fn find_workspaces(pattern: &str) -> Result<()> {
    let workspaces = discover_workspaces()?;

    // Resolve "." to current directory name
    let pattern = if pattern == "." {
        std::env::current_dir()
            .ok()
            .and_then(|p| p.file_name().map(|n| n.to_string_lossy().to_string()))
            .unwrap_or_else(|| pattern.to_string())
    } else {
        pattern.to_string()
    };
    let pattern_lower = pattern.to_lowercase();

    let matching: Vec<&Workspace> = workspaces
        .iter()
        .filter(|ws| {
            ws.project_path
                .as_ref()
                .map(|p| p.to_lowercase().contains(&pattern_lower))
                .unwrap_or(false)
                || ws.hash.to_lowercase().contains(&pattern_lower)
        })
        .collect();

    if matching.is_empty() {
        println!("No workspaces found matching '{}'", pattern);
        return Ok(());
    }

    let rows: Vec<WorkspaceRow> = matching
        .iter()
        .map(|ws| WorkspaceRow {
            hash: format!("{}...", &ws.hash[..12.min(ws.hash.len())]),
            project_path: ws
                .project_path
                .clone()
                .unwrap_or_else(|| "(none)".to_string()),
            sessions: ws.chat_session_count,
            has_chats: if ws.has_chat_sessions {
                "Yes".to_string()
            } else {
                "No".to_string()
            },
        })
        .collect();

    let table = Table::new(rows)
        .with(TableStyle::ascii_rounded())
        .to_string();

    println!("{}", table);
    println!("\nFound {} matching workspace(s)", matching.len());

    // Show session paths for each matching workspace
    for ws in &matching {
        if ws.has_chat_sessions {
            let project = ws.project_path.as_deref().unwrap_or("(none)");
            println!("\nSessions for {}:", project);

            if let Ok(sessions) =
                crate::workspace::get_chat_sessions_from_workspace(&ws.workspace_path)
            {
                for session_with_path in sessions {
                    println!("  {}", session_with_path.path.display());
                }
            }
        }
    }

    Ok(())
}

/// Find sessions by search pattern
#[allow(dead_code)]
pub fn find_sessions(pattern: &str, project_path: Option<&str>) -> Result<()> {
    let workspaces = discover_workspaces()?;
    let pattern_lower = pattern.to_lowercase();

    let filtered_workspaces: Vec<&Workspace> = if let Some(path) = project_path {
        let normalized = crate::workspace::normalize_path(path);
        workspaces
            .iter()
            .filter(|ws| {
                ws.project_path
                    .as_ref()
                    .map(|p| crate::workspace::normalize_path(p) == normalized)
                    .unwrap_or(false)
            })
            .collect()
    } else {
        workspaces.iter().collect()
    };

    let mut rows: Vec<SessionRow> = Vec::new();

    for ws in filtered_workspaces {
        if !ws.has_chat_sessions {
            continue;
        }

        let sessions = crate::workspace::get_chat_sessions_from_workspace(&ws.workspace_path)?;

        for session_with_path in sessions {
            // Check if session matches the pattern
            let session_id_matches = session_with_path
                .session
                .session_id
                .as_ref()
                .map(|id| id.to_lowercase().contains(&pattern_lower))
                .unwrap_or(false);
            let title_matches = session_with_path
                .session
                .title()
                .to_lowercase()
                .contains(&pattern_lower);
            let content_matches = session_with_path.session.requests.iter().any(|r| {
                r.message
                    .as_ref()
                    .map(|m| {
                        m.text
                            .as_ref()
                            .map(|t| t.to_lowercase().contains(&pattern_lower))
                            .unwrap_or(false)
                    })
                    .unwrap_or(false)
            });

            if !session_id_matches && !title_matches && !content_matches {
                continue;
            }

            let modified = session_with_path
                .path
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .map(|t| {
                    let datetime: chrono::DateTime<chrono::Utc> = t.into();
                    datetime.format("%Y-%m-%d %H:%M").to_string()
                })
                .unwrap_or_else(|| "unknown".to_string());

            rows.push(SessionRow {
                project_path: ws
                    .project_path
                    .clone()
                    .unwrap_or_else(|| "(none)".to_string()),
                session_file: session_with_path
                    .path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| "unknown".to_string()),
                last_modified: modified,
                messages: session_with_path.session.request_count(),
            });
        }
    }

    if rows.is_empty() {
        println!("No sessions found matching '{}'", pattern);
        return Ok(());
    }

    let table = Table::new(&rows)
        .with(TableStyle::ascii_rounded())
        .to_string();

    println!("{}", table);
    println!("\nFound {} matching session(s)", rows.len());

    Ok(())
}

/// Read only the first `max_bytes` of a file as a string.
/// Returns None if the file cannot be read.
fn read_file_header(path: &std::path::Path, max_bytes: usize) -> Option<String> {
    use std::io::Read;
    let file = std::fs::File::open(path).ok()?;
    let mut reader = std::io::BufReader::new(file);
    let mut buffer = vec![0u8; max_bytes];
    let bytes_read = reader.read(&mut buffer).ok()?;
    buffer.truncate(bytes_read);
    String::from_utf8(buffer).ok()
}

/// Case-insensitive substring search without allocating a lowercased copy.
/// Uses byte-level comparison for ASCII patterns (which covers all common search terms).
fn contains_case_insensitive(haystack: &str, needle_lower: &str) -> bool {
    if needle_lower.is_empty() {
        return true;
    }
    let needle_bytes = needle_lower.as_bytes();
    let haystack_bytes = haystack.as_bytes();
    if needle_bytes.len() > haystack_bytes.len() {
        return false;
    }
    // Sliding window byte comparison with ASCII lowering
    'outer: for i in 0..=(haystack_bytes.len() - needle_bytes.len()) {
        for j in 0..needle_bytes.len() {
            if haystack_bytes[i + j].to_ascii_lowercase() != needle_bytes[j] {
                continue 'outer;
            }
        }
        return true;
    }
    false
}

/// Optimized session search with filtering
///
/// This function is optimized for speed by:
/// 1. Filtering workspaces first (by name/path)
/// 2. Filtering by file modification date before reading content
/// 3. Title-only search reads only first 4KB of each file (10-100x faster)
/// 4. Case-insensitive search avoids String::to_lowercase() allocation
/// 5. Content search is opt-in (expensive)
/// 6. Parallel file scanning with rayon
#[allow(clippy::too_many_arguments)]
pub fn find_sessions_filtered(
    pattern: &str,
    workspace_filter: Option<&str>,
    title_only: bool,
    search_content: bool,
    after: Option<&str>,
    before: Option<&str>,
    date: Option<&str>,
    all_workspaces: bool,
    provider: Option<&str>,
    all_providers: bool,
    limit: usize,
) -> Result<()> {
    use chrono::{NaiveDate, Utc};
    use rayon::prelude::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    let pattern_lower = pattern.to_lowercase();

    // Parse date filters upfront
    let after_date = after.and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());
    let before_date = before.and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());
    let target_date = date.and_then(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d").ok());

    // Determine which storage paths to scan based on provider filter
    let storage_paths = if all_providers {
        get_agent_storage_paths(Some("all"))?
    } else if let Some(p) = provider {
        get_agent_storage_paths(Some(p))?
    } else {
        // Default to VS Code only
        let vscode_path = crate::workspace::get_workspace_storage_path()?;
        if vscode_path.exists() {
            vec![("vscode".to_string(), vscode_path)]
        } else {
            vec![]
        }
    };

    if storage_paths.is_empty() {
        if let Some(p) = provider {
            println!("No storage found for provider: {}", p);
        } else {
            println!("No workspaces found");
        }
        return Ok(());
    }

    // Collect workspace directories with minimal I/O
    // If --all flag is set, don't filter by workspace
    let ws_filter_lower = if all_workspaces {
        None
    } else {
        workspace_filter.map(|s| s.to_lowercase())
    };

    let workspace_dirs: Vec<_> = storage_paths
        .iter()
        .flat_map(|(provider_name, storage_path)| {
            if !storage_path.exists() {
                return vec![];
            }
            std::fs::read_dir(storage_path)
                .into_iter()
                .flatten()
                .filter_map(|e| e.ok())
                .filter(|e| e.path().is_dir())
                .filter_map(|entry| {
                    let workspace_dir = entry.path();
                    let workspace_json_path = workspace_dir.join("workspace.json");

                    // Quick check: does chatSessions exist?
                    let chat_sessions_dir = workspace_dir.join("chatSessions");
                    if !chat_sessions_dir.exists() {
                        return None;
                    }

                    // Parse workspace.json for project path (needed for filtering)
                    let project_path =
                        std::fs::read_to_string(&workspace_json_path)
                            .ok()
                            .and_then(|content| {
                                serde_json::from_str::<crate::models::WorkspaceJson>(&content)
                                    .ok()
                                    .and_then(|ws| {
                                        ws.folder
                                            .map(|f| crate::workspace::decode_workspace_folder(&f))
                                    })
                            });

                    // Apply workspace filter early
                    if let Some(ref filter) = ws_filter_lower {
                        let hash = entry.file_name().to_string_lossy().to_lowercase();
                        let path_matches = project_path
                            .as_ref()
                            .map(|p| p.to_lowercase().contains(filter))
                            .unwrap_or(false);
                        if !hash.contains(filter) && !path_matches {
                            return None;
                        }
                    }

                    let ws_name = project_path
                        .as_ref()
                        .and_then(|p| std::path::Path::new(p).file_name())
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| {
                            entry.file_name().to_string_lossy()[..8.min(entry.file_name().len())]
                                .to_string()
                        });

                    Some((chat_sessions_dir, ws_name, provider_name.clone()))
                })
                .collect::<Vec<_>>()
        })
        .collect();

    if workspace_dirs.is_empty() {
        if let Some(ws) = workspace_filter {
            println!("No workspaces found matching '{}'", ws);
        } else {
            println!("No workspaces with chat sessions found");
        }
        return Ok(());
    }

    // Collect all session file paths
    let session_files: Vec<_> = workspace_dirs
        .iter()
        .flat_map(|(chat_dir, ws_name, provider_name)| {
            std::fs::read_dir(chat_dir)
                .into_iter()
                .flatten()
                .filter_map(|e| e.ok())
                .filter(|e| {
                    e.path()
                        .extension()
                        .map(|ext| ext == "json" || ext == "jsonl")
                        .unwrap_or(false)
                })
                .map(|e| (e.path(), ws_name.clone(), provider_name.clone()))
                .collect::<Vec<_>>()
        })
        .collect();

    let total_files = session_files.len();
    let scanned = AtomicUsize::new(0);
    let skipped_by_date = AtomicUsize::new(0);

    // Process files in parallel
    let mut results: Vec<_> = session_files
        .par_iter()
        .filter_map(|(path, ws_name, provider_name)| {
            // Date filter using file metadata (very fast)
            if after_date.is_some() || before_date.is_some() {
                if let Ok(metadata) = path.metadata() {
                    if let Ok(modified) = metadata.modified() {
                        let file_date: chrono::DateTime<Utc> = modified.into();
                        let file_naive = file_date.date_naive();

                        if let Some(after) = after_date {
                            if file_naive < after {
                                skipped_by_date.fetch_add(1, Ordering::Relaxed);
                                return None;
                            }
                        }
                        if let Some(before) = before_date {
                            if file_naive > before {
                                skipped_by_date.fetch_add(1, Ordering::Relaxed);
                                return None;
                            }
                        }
                    }
                }
            }

            scanned.fetch_add(1, Ordering::Relaxed);

            // Optimization: for title-only search (no --content flag), read only
            // the first 4KB of the file to extract the title. This is 10-100x
            // faster for large session files (which can be megabytes).
            let (title, content_for_search) = if title_only || !search_content {
                // Fast path: only need the title
                let header = match read_file_header(path, 4096) {
                    Some(h) => h,
                    None => return None,
                };
                let title =
                    extract_title_from_content(&header).unwrap_or_else(|| "Untitled".to_string());
                (title, None)
            } else {
                // Full read path: need content for search
                let content = match std::fs::read_to_string(path) {
                    Ok(c) => c,
                    Err(_) => return None,
                };

                // Check for internal message timestamps if --date filter is used
                if let Some(target) = target_date {
                    let has_matching_timestamp =
                        content.split("\"timestamp\":").skip(1).any(|part| {
                            let num_str: String = part
                                .chars()
                                .skip_while(|c| c.is_whitespace())
                                .take_while(|c| c.is_ascii_digit())
                                .collect();
                            if let Ok(ts_ms) = num_str.parse::<i64>() {
                                if let Some(dt) = chrono::DateTime::from_timestamp_millis(ts_ms) {
                                    return dt.date_naive() == target;
                                }
                            }
                            false
                        });

                    if !has_matching_timestamp {
                        skipped_by_date.fetch_add(1, Ordering::Relaxed);
                        return None;
                    }
                }

                let title =
                    extract_title_from_content(&content).unwrap_or_else(|| "Untitled".to_string());
                (title, Some(content))
            };

            let title_lower = title.to_lowercase();

            // Check session ID from filename
            let session_id = path
                .file_stem()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            let id_matches =
                !pattern_lower.is_empty() && session_id.to_lowercase().contains(&pattern_lower);

            // Check title match
            let title_matches = !pattern_lower.is_empty() && title_lower.contains(&pattern_lower);

            // Content search if requested (uses pre-loaded content_for_search)
            let content_matches = if search_content
                && !title_only
                && !id_matches
                && !title_matches
                && !pattern_lower.is_empty()
            {
                if let Some(ref content) = content_for_search {
                    // Use case-insensitive byte search for speed
                    contains_case_insensitive(content, &pattern_lower)
                } else {
                    // Content wasn't loaded (title-only mode), do a lazy read
                    match std::fs::read_to_string(path) {
                        Ok(c) => contains_case_insensitive(&c, &pattern_lower),
                        Err(_) => false,
                    }
                }
            } else {
                false
            };

            // Empty pattern matches everything (for listing)
            let matches =
                pattern_lower.is_empty() || id_matches || title_matches || content_matches;
            if !matches {
                return None;
            }

            let match_type = if pattern_lower.is_empty() {
                ""
            } else if id_matches {
                "ID"
            } else if title_matches {
                "title"
            } else {
                "content"
            };

            // Count messages from content if available, otherwise estimate from file size
            let message_count = if let Some(ref content) = content_for_search {
                content.matches("\"message\":").count()
            } else {
                // Estimate from file size (avoid reading full file just for count)
                path.metadata()
                    .ok()
                    .map(|m| {
                        // Rough estimate: ~500 bytes per message on average
                        (m.len() / 500).max(1) as usize
                    })
                    .unwrap_or(0)
            };

            // Get modification time
            let modified = path
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .map(|t| {
                    let datetime: chrono::DateTime<chrono::Utc> = t.into();
                    datetime.format("%Y-%m-%d %H:%M").to_string()
                })
                .unwrap_or_else(|| "unknown".to_string());

            Some((
                title,
                ws_name.clone(),
                provider_name.clone(),
                modified,
                message_count,
                match_type.to_string(),
            ))
        })
        .collect();

    let scanned_count = scanned.load(Ordering::Relaxed);
    let skipped_count = skipped_by_date.load(Ordering::Relaxed);

    if results.is_empty() {
        println!("No sessions found matching '{}'", pattern);
        if skipped_count > 0 {
            println!("  ({} sessions skipped due to date filter)", skipped_count);
        }
        return Ok(());
    }

    // Sort by modification date (newest first)
    results.sort_by(|a, b| b.3.cmp(&a.3));

    // Apply limit
    results.truncate(limit);

    // Check if we have multiple providers to show provider column
    let show_provider_column = all_providers || storage_paths.len() > 1;

    #[derive(Tabled)]
    struct SearchResultRow {
        #[tabled(rename = "Title")]
        title: String,
        #[tabled(rename = "Workspace")]
        workspace: String,
        #[tabled(rename = "Modified")]
        modified: String,
        #[tabled(rename = "Msgs")]
        messages: usize,
        #[tabled(rename = "Match")]
        match_type: String,
    }

    #[derive(Tabled)]
    struct SearchResultRowWithProvider {
        #[tabled(rename = "Provider")]
        provider: String,
        #[tabled(rename = "Title")]
        title: String,
        #[tabled(rename = "Workspace")]
        workspace: String,
        #[tabled(rename = "Modified")]
        modified: String,
        #[tabled(rename = "Msgs")]
        messages: usize,
        #[tabled(rename = "Match")]
        match_type: String,
    }

    if show_provider_column {
        let rows: Vec<SearchResultRowWithProvider> = results
            .into_iter()
            .map(
                |(title, workspace, provider, modified, messages, match_type)| {
                    SearchResultRowWithProvider {
                        provider,
                        title: truncate_string(&title, 35),
                        workspace: truncate_string(&workspace, 15),
                        modified,
                        messages,
                        match_type,
                    }
                },
            )
            .collect();

        let table = Table::new(&rows)
            .with(TableStyle::ascii_rounded())
            .to_string();

        println!("{}", table);
        println!(
            "\nFound {} session(s) (scanned {} of {} files{})",
            rows.len(),
            scanned_count,
            total_files,
            if skipped_count > 0 {
                format!(", {} skipped by date", skipped_count)
            } else {
                String::new()
            }
        );
        if rows.len() >= limit {
            println!("  (results limited to {}; use --limit to show more)", limit);
        }
    } else {
        let rows: Vec<SearchResultRow> = results
            .into_iter()
            .map(
                |(title, workspace, _provider, modified, messages, match_type)| SearchResultRow {
                    title: truncate_string(&title, 40),
                    workspace: truncate_string(&workspace, 20),
                    modified,
                    messages,
                    match_type,
                },
            )
            .collect();

        let table = Table::new(&rows)
            .with(TableStyle::ascii_rounded())
            .to_string();

        println!("{}", table);
        println!(
            "\nFound {} session(s) (scanned {} of {} files{})",
            rows.len(),
            scanned_count,
            total_files,
            if skipped_count > 0 {
                format!(", {} skipped by date", skipped_count)
            } else {
                String::new()
            }
        );
        if rows.len() >= limit {
            println!("  (results limited to {}; use --limit to show more)", limit);
        }
    }

    Ok(())
}

/// Extract title from full JSON content (more reliable than header-only)
fn extract_title_from_content(content: &str) -> Option<String> {
    // Look for "customTitle" first (user-set title)
    if let Some(start) = content.find("\"customTitle\"") {
        if let Some(colon) = content[start..].find(':') {
            let after_colon = &content[start + colon + 1..];
            let trimmed = after_colon.trim_start();
            if let Some(stripped) = trimmed.strip_prefix('"') {
                if let Some(end) = stripped.find('"') {
                    let title = &stripped[..end];
                    if !title.is_empty() && title != "null" {
                        return Some(title.to_string());
                    }
                }
            }
        }
    }

    // Fall back to first request's message text
    if let Some(start) = content.find("\"text\"") {
        if let Some(colon) = content[start..].find(':') {
            let after_colon = &content[start + colon + 1..];
            let trimmed = after_colon.trim_start();
            if let Some(stripped) = trimmed.strip_prefix('"') {
                if let Some(end) = stripped.find('"') {
                    let title = &stripped[..end];
                    if !title.is_empty() && title.len() < 100 {
                        return Some(title.to_string());
                    }
                }
            }
        }
    }

    None
}

/// Fast title extraction from JSON header
#[allow(dead_code)]
fn extract_title_fast(header: &str) -> Option<String> {
    extract_title_from_content(header)
}

/// Truncate string to max length with ellipsis
fn truncate_string(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len.saturating_sub(3)])
    }
}

/// Show workspace details
pub fn show_workspace(workspace: &str) -> Result<()> {
    use colored::Colorize;

    let workspaces = discover_workspaces()?;
    let workspace_lower = workspace.to_lowercase();

    // Find workspace by name or hash
    let matching: Vec<&Workspace> = workspaces
        .iter()
        .filter(|ws| {
            ws.hash.to_lowercase().contains(&workspace_lower)
                || ws
                    .project_path
                    .as_ref()
                    .map(|p| p.to_lowercase().contains(&workspace_lower))
                    .unwrap_or(false)
        })
        .collect();

    if matching.is_empty() {
        println!(
            "{} No workspace found matching '{}'",
            "!".yellow(),
            workspace
        );
        return Ok(());
    }

    for ws in matching {
        println!("\n{}", "=".repeat(60).bright_blue());
        println!("{}", "Workspace Details".bright_blue().bold());
        println!("{}", "=".repeat(60).bright_blue());

        println!("{}: {}", "Hash".bright_white().bold(), ws.hash);
        println!(
            "{}: {}",
            "Path".bright_white().bold(),
            ws.project_path.as_ref().unwrap_or(&"(none)".to_string())
        );
        println!(
            "{}: {}",
            "Has Sessions".bright_white().bold(),
            if ws.has_chat_sessions {
                "Yes".green()
            } else {
                "No".red()
            }
        );
        println!(
            "{}: {}",
            "Workspace Path".bright_white().bold(),
            ws.workspace_path.display()
        );

        if ws.has_chat_sessions {
            let sessions = crate::workspace::get_chat_sessions_from_workspace(&ws.workspace_path)?;
            println!(
                "{}: {}",
                "Session Count".bright_white().bold(),
                sessions.len()
            );

            if !sessions.is_empty() {
                println!("\n{}", "Sessions:".bright_yellow());
                for (i, s) in sessions.iter().enumerate() {
                    let title = s.session.title();
                    let msg_count = s.session.request_count();
                    println!(
                        "  {}. {} ({} messages)",
                        i + 1,
                        title.bright_cyan(),
                        msg_count
                    );
                }
            }
        }
    }

    Ok(())
}

/// Show session details
pub fn show_session(session_id: &str, project_path: Option<&str>) -> Result<()> {
    use colored::Colorize;

    let workspaces = discover_workspaces()?;
    let session_id_lower = session_id.to_lowercase();

    let filtered_workspaces: Vec<&Workspace> = if let Some(path) = project_path {
        let normalized = crate::workspace::normalize_path(path);
        workspaces
            .iter()
            .filter(|ws| {
                ws.project_path
                    .as_ref()
                    .map(|p| crate::workspace::normalize_path(p) == normalized)
                    .unwrap_or(false)
            })
            .collect()
    } else {
        workspaces.iter().collect()
    };

    for ws in filtered_workspaces {
        if !ws.has_chat_sessions {
            continue;
        }

        let sessions = crate::workspace::get_chat_sessions_from_workspace(&ws.workspace_path)?;

        for s in sessions {
            let filename = s
                .path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            let matches = s
                .session
                .session_id
                .as_ref()
                .map(|id| id.to_lowercase().contains(&session_id_lower))
                .unwrap_or(false)
                || filename.to_lowercase().contains(&session_id_lower);

            if matches {
                // Detect format from file extension
                let format = VsCodeSessionFormat::from_path(&s.path);

                println!("\n{}", "=".repeat(60).bright_blue());
                println!("{}", "Session Details".bright_blue().bold());
                println!("{}", "=".repeat(60).bright_blue());

                println!(
                    "{}: {}",
                    "Title".bright_white().bold(),
                    s.session.title().bright_cyan()
                );
                println!("{}: {}", "File".bright_white().bold(), filename);
                println!(
                    "{}: {}",
                    "Format".bright_white().bold(),
                    format.to_string().bright_magenta()
                );
                println!(
                    "{}: {}",
                    "Session ID".bright_white().bold(),
                    s.session
                        .session_id
                        .as_ref()
                        .unwrap_or(&"(none)".to_string())
                );
                println!(
                    "{}: {}",
                    "Messages".bright_white().bold(),
                    s.session.request_count()
                );
                println!(
                    "{}: {}",
                    "Workspace".bright_white().bold(),
                    ws.project_path.as_ref().unwrap_or(&"(none)".to_string())
                );

                // Show first few messages as preview
                println!("\n{}", "Preview:".bright_yellow());
                for (i, req) in s.session.requests.iter().take(3).enumerate() {
                    if let Some(msg) = &req.message {
                        if let Some(text) = &msg.text {
                            let preview: String = text.chars().take(100).collect();
                            let truncated = if text.len() > 100 { "..." } else { "" };
                            println!("  {}. {}{}", i + 1, preview.dimmed(), truncated);
                        }
                    }
                }

                return Ok(());
            }
        }
    }

    println!(
        "{} No session found matching '{}'",
        "!".yellow(),
        session_id
    );
    Ok(())
}

/// Get storage paths for agent mode sessions based on provider filter
/// Returns (provider_name, storage_path) tuples
fn get_agent_storage_paths(provider: Option<&str>) -> Result<Vec<(String, std::path::PathBuf)>> {
    let mut paths = Vec::new();

    // VS Code path
    let vscode_path = crate::workspace::get_workspace_storage_path()?;

    // Other provider paths
    let cursor_path = get_cursor_storage_path();
    let claudecode_path = get_claudecode_storage_path();
    let opencode_path = get_opencode_storage_path();
    let openclaw_path = get_openclaw_storage_path();
    let antigravity_path = get_antigravity_storage_path();
    let codexcli_path = get_codexcli_storage_path();
    let droidcli_path = get_droidcli_storage_path();
    let geminicli_path = get_geminicli_storage_path();
    let antigravitycli_path = get_antigravitycli_storage_path();
    let cursorcli_path = get_cursorcli_storage_path();
    let copilotcli_path = get_copilotcli_storage_path();
    let qwencode_path = get_qwencode_storage_path();
    let pi_path = get_pi_storage_path();
    let goose_path = get_goose_storage_path();
    let cline_path = get_cline_storage_path();
    let roocode_path = get_roocode_storage_path();
    let kilocode_path = get_kilocode_storage_path();
    let windsurf_path = get_windsurf_storage_path();
    let trae_path = get_trae_storage_path();

    match provider {
        None => {
            // Default: return VS Code path only for backward compatibility
            if vscode_path.exists() {
                paths.push(("vscode".to_string(), vscode_path));
            }
        }
        Some("all") => {
            // All providers that support agent mode
            if vscode_path.exists() {
                paths.push(("vscode".to_string(), vscode_path));
            }
            if let Some(cp) = cursor_path {
                if cp.exists() {
                    paths.push(("cursor".to_string(), cp));
                }
            }
            if let Some(cc) = claudecode_path {
                if cc.exists() {
                    paths.push(("claudecode".to_string(), cc));
                }
            }
            if let Some(oc) = opencode_path {
                if oc.exists() {
                    paths.push(("opencode".to_string(), oc));
                }
            }
            if let Some(ocl) = openclaw_path {
                if ocl.exists() {
                    paths.push(("openclaw".to_string(), ocl));
                }
            }
            if let Some(ag) = antigravity_path {
                if ag.exists() {
                    paths.push(("antigravity".to_string(), ag));
                }
            }
            if let Some(cx) = codexcli_path {
                if cx.exists() {
                    paths.push(("codexcli".to_string(), cx));
                }
            }
            if let Some(dr) = droidcli_path {
                if dr.exists() {
                    paths.push(("droidcli".to_string(), dr));
                }
            }
            if let Some(gc) = geminicli_path {
                if gc.exists() {
                    paths.push(("geminicli".to_string(), gc));
                }
            }
            for (name, path) in [
                ("antigravitycli", antigravitycli_path),
                ("cursorcli", cursorcli_path),
                ("copilotcli", copilotcli_path),
                ("qwencode", qwencode_path),
                ("pi", pi_path),
                ("goose", goose_path),
                ("cline", cline_path),
                ("roocode", roocode_path),
                ("kilocode", kilocode_path),
                ("windsurf", windsurf_path),
                ("trae", trae_path),
            ] {
                if let Some(p) = path {
                    if p.exists() {
                        paths.push((name.to_string(), p));
                    }
                }
            }
        }
        Some(p) => {
            let p_lower = p.to_lowercase();
            match p_lower.as_str() {
                "vscode" | "vs-code" | "copilot" if vscode_path.exists() => {
                    paths.push(("vscode".to_string(), vscode_path));
                }
                "cursor" => {
                    if let Some(cp) = cursor_path {
                        if cp.exists() {
                            paths.push(("cursor".to_string(), cp));
                        }
                    }
                }
                "claudecode" | "claude-code" | "claude" => {
                    if let Some(cc) = claudecode_path {
                        if cc.exists() {
                            paths.push(("claudecode".to_string(), cc));
                        }
                    }
                }
                "opencode" | "open-code" => {
                    if let Some(oc) = opencode_path {
                        if oc.exists() {
                            paths.push(("opencode".to_string(), oc));
                        }
                    }
                }
                "openclaw" | "open-claw" | "claw" => {
                    if let Some(ocl) = openclaw_path {
                        if ocl.exists() {
                            paths.push(("openclaw".to_string(), ocl));
                        }
                    }
                }
                "antigravity" | "anti-gravity" | "ag" => {
                    if let Some(ag) = antigravity_path {
                        if ag.exists() {
                            paths.push(("antigravity".to_string(), ag));
                        }
                    }
                }
                "codexcli" | "codex-cli" | "codex" => {
                    if let Some(cx) = codexcli_path {
                        if cx.exists() {
                            paths.push(("codexcli".to_string(), cx));
                        }
                    }
                }
                "droidcli" | "droid-cli" | "droid" | "factory" => {
                    if let Some(dr) = droidcli_path {
                        if dr.exists() {
                            paths.push(("droidcli".to_string(), dr));
                        }
                    }
                }
                "geminicli" | "gemini-cli" => {
                    if let Some(gc) = geminicli_path {
                        if gc.exists() {
                            paths.push(("geminicli".to_string(), gc));
                        }
                    }
                }
                "antigravitycli" | "antigravity-cli" | "agy" => {
                    if let Some(agc) = antigravitycli_path {
                        if agc.exists() {
                            paths.push(("antigravitycli".to_string(), agc));
                        }
                    }
                }
                "cursorcli" | "cursor-cli" | "cursor-agent" => {
                    if let Some(cc) = cursorcli_path {
                        if cc.exists() {
                            paths.push(("cursorcli".to_string(), cc));
                        }
                    }
                }
                "copilotcli" | "copilot-cli" => {
                    if let Some(cp) = copilotcli_path {
                        if cp.exists() {
                            paths.push(("copilotcli".to_string(), cp));
                        }
                    }
                }
                "qwencode" | "qwen-code" | "qwen" => {
                    if let Some(qw) = qwencode_path {
                        if qw.exists() {
                            paths.push(("qwencode".to_string(), qw));
                        }
                    }
                }
                "pi" => {
                    if let Some(pp) = pi_path {
                        if pp.exists() {
                            paths.push(("pi".to_string(), pp));
                        }
                    }
                }
                "goose" => {
                    if let Some(gp) = goose_path {
                        if gp.exists() {
                            paths.push(("goose".to_string(), gp));
                        }
                    }
                }
                "cline" => {
                    if let Some(cl) = cline_path {
                        if cl.exists() {
                            paths.push(("cline".to_string(), cl));
                        }
                    }
                }
                "roocode" | "roo-code" | "roo" => {
                    if let Some(rc) = roocode_path {
                        if rc.exists() {
                            paths.push(("roocode".to_string(), rc));
                        }
                    }
                }
                "kilocode" | "kilo-code" | "kilo" => {
                    if let Some(kc) = kilocode_path {
                        if kc.exists() {
                            paths.push(("kilocode".to_string(), kc));
                        }
                    }
                }
                "windsurf" | "codeium" => {
                    if let Some(wp) = windsurf_path {
                        if wp.exists() {
                            paths.push(("windsurf".to_string(), wp));
                        }
                    }
                }
                "trae" => {
                    if let Some(tp) = trae_path {
                        if tp.exists() {
                            paths.push(("trae".to_string(), tp));
                        }
                    }
                }
                _ => {
                    // Unknown provider - return empty to trigger error message
                }
            }
        }
    }

    Ok(paths)
}

/// Get Cursor's workspace storage path
fn get_cursor_storage_path() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        if let Some(appdata) = dirs::data_dir() {
            let cursor_path = appdata.join("Cursor").join("User").join("workspaceStorage");
            if cursor_path.exists() {
                return Some(cursor_path);
            }
        }
        if let Ok(roaming) = std::env::var("APPDATA") {
            let roaming_path = std::path::PathBuf::from(roaming)
                .join("Cursor")
                .join("User")
                .join("workspaceStorage");
            if roaming_path.exists() {
                return Some(roaming_path);
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            let cursor_path = home
                .join("Library")
                .join("Application Support")
                .join("Cursor")
                .join("User")
                .join("workspaceStorage");
            if cursor_path.exists() {
                return Some(cursor_path);
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(config) = dirs::config_dir() {
            let cursor_path = config.join("Cursor").join("User").join("workspaceStorage");
            if cursor_path.exists() {
                return Some(cursor_path);
            }
        }
    }

    None
}

/// Get ClaudeCode's storage path (Anthropic's Claude Code CLI)
fn get_claudecode_storage_path() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        // ClaudeCode stores sessions in AppData
        if let Ok(appdata) = std::env::var("APPDATA") {
            let claude_path = std::path::PathBuf::from(&appdata)
                .join("claude-code")
                .join("sessions");
            if claude_path.exists() {
                return Some(claude_path);
            }
            // Alternative path with different naming
            let alt_path = std::path::PathBuf::from(&appdata)
                .join("ClaudeCode")
                .join("workspaceStorage");
            if alt_path.exists() {
                return Some(alt_path);
            }
        }
        if let Some(local) = dirs::data_local_dir() {
            let local_path = local.join("ClaudeCode").join("sessions");
            if local_path.exists() {
                return Some(local_path);
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            let claude_path = home
                .join("Library")
                .join("Application Support")
                .join("claude-code")
                .join("sessions");
            if claude_path.exists() {
                return Some(claude_path);
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(config) = dirs::config_dir() {
            let claude_path = config.join("claude-code").join("sessions");
            if claude_path.exists() {
                return Some(claude_path);
            }
        }
    }

    None
}

/// Get OpenCode's storage path (open-source coding assistant)
fn get_opencode_storage_path() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let opencode_path = std::path::PathBuf::from(&appdata)
                .join("OpenCode")
                .join("workspaceStorage");
            if opencode_path.exists() {
                return Some(opencode_path);
            }
        }
        if let Some(local) = dirs::data_local_dir() {
            let local_path = local.join("OpenCode").join("sessions");
            if local_path.exists() {
                return Some(local_path);
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            let opencode_path = home
                .join("Library")
                .join("Application Support")
                .join("OpenCode")
                .join("workspaceStorage");
            if opencode_path.exists() {
                return Some(opencode_path);
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(config) = dirs::config_dir() {
            let opencode_path = config.join("opencode").join("workspaceStorage");
            if opencode_path.exists() {
                return Some(opencode_path);
            }
        }
    }

    None
}

/// Get OpenClaw's storage path
fn get_openclaw_storage_path() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let openclaw_path = std::path::PathBuf::from(&appdata)
                .join("OpenClaw")
                .join("workspaceStorage");
            if openclaw_path.exists() {
                return Some(openclaw_path);
            }
        }
        if let Some(local) = dirs::data_local_dir() {
            let local_path = local.join("OpenClaw").join("sessions");
            if local_path.exists() {
                return Some(local_path);
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            let openclaw_path = home
                .join("Library")
                .join("Application Support")
                .join("OpenClaw")
                .join("workspaceStorage");
            if openclaw_path.exists() {
                return Some(openclaw_path);
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(config) = dirs::config_dir() {
            let openclaw_path = config.join("openclaw").join("workspaceStorage");
            if openclaw_path.exists() {
                return Some(openclaw_path);
            }
        }
    }

    None
}

/// Get Antigravity's storage path
fn get_antigravity_storage_path() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let antigrav_path = std::path::PathBuf::from(&appdata)
                .join("Antigravity")
                .join("workspaceStorage");
            if antigrav_path.exists() {
                return Some(antigrav_path);
            }
        }
        if let Some(local) = dirs::data_local_dir() {
            let local_path = local.join("Antigravity").join("sessions");
            if local_path.exists() {
                return Some(local_path);
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            let antigrav_path = home
                .join("Library")
                .join("Application Support")
                .join("Antigravity")
                .join("workspaceStorage");
            if antigrav_path.exists() {
                return Some(antigrav_path);
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(config) = dirs::config_dir() {
            let antigrav_path = config.join("antigravity").join("workspaceStorage");
            if antigrav_path.exists() {
                return Some(antigrav_path);
            }
        }
    }

    None
}

/// Get Codex CLI's storage path (OpenAI Codex CLI)
/// Stores JSONL session files in ~/.codex/sessions/
fn get_codexcli_storage_path() -> Option<std::path::PathBuf> {
    if let Some(home) = dirs::home_dir() {
        let codex_path = home.join(".codex").join("sessions");
        if codex_path.exists() {
            return Some(codex_path);
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let codex_path = std::path::PathBuf::from(&appdata)
                .join("codex")
                .join("sessions");
            if codex_path.exists() {
                return Some(codex_path);
            }
        }
        if let Some(local) = dirs::data_local_dir() {
            let local_path = local.join("codex").join("sessions");
            if local_path.exists() {
                return Some(local_path);
            }
        }
    }

    None
}

/// Get Droid CLI's storage path (Factory Droid CLI)
/// Stores JSONL session files in ~/.factory/sessions/
fn get_droidcli_storage_path() -> Option<std::path::PathBuf> {
    if let Some(home) = dirs::home_dir() {
        let droid_path = home.join(".factory").join("sessions");
        if droid_path.exists() {
            return Some(droid_path);
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let droid_path = std::path::PathBuf::from(&appdata)
                .join("factory")
                .join("sessions");
            if droid_path.exists() {
                return Some(droid_path);
            }
        }
        if let Some(local) = dirs::data_local_dir() {
            let local_path = local.join("factory").join("sessions");
            if local_path.exists() {
                return Some(local_path);
            }
        }
    }

    None
}

/// Get Gemini CLI's storage path (Google Gemini CLI)
/// Stores JSON session files in ~/.gemini/tmp/
fn get_geminicli_storage_path() -> Option<std::path::PathBuf> {
    if let Some(home) = dirs::home_dir() {
        let gemini_path = home.join(".gemini").join("tmp");
        if gemini_path.exists() {
            return Some(gemini_path);
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let gemini_path = std::path::PathBuf::from(&appdata)
                .join("gemini")
                .join("tmp");
            if gemini_path.exists() {
                return Some(gemini_path);
            }
        }
        if let Some(local) = dirs::data_local_dir() {
            let local_path = local.join("gemini").join("tmp");
            if local_path.exists() {
                return Some(local_path);
            }
        }
    }

    None
}

/// Get Antigravity CLI's storage path (Google, successor to Gemini CLI)
/// Stores JSONL conversation transcripts in ~/.gemini/antigravity/brain/<conversation-id>/
fn get_antigravitycli_storage_path() -> Option<std::path::PathBuf> {
    if let Some(home) = dirs::home_dir() {
        let brain_path = home.join(".gemini").join("antigravity").join("brain");
        if brain_path.exists() {
            return Some(brain_path);
        }
        // Early releases used ~/.gemini/antigravity-cli/brain/
        let alt_path = home.join(".gemini").join("antigravity-cli").join("brain");
        if alt_path.exists() {
            return Some(alt_path);
        }
    }

    None
}

/// Get Cursor CLI's storage path (distinct from the Cursor IDE workspaceStorage)
/// Stores per-session chat data in ~/.cursor/chats/
fn get_cursorcli_storage_path() -> Option<std::path::PathBuf> {
    if let Some(home) = dirs::home_dir() {
        let chats_path = home.join(".cursor").join("chats");
        if chats_path.exists() {
            return Some(chats_path);
        }
    }

    None
}

/// Get GitHub Copilot CLI's storage path
/// Stores session files in ~/.copilot/session-state/ (legacy: history-session-state/)
fn get_copilotcli_storage_path() -> Option<std::path::PathBuf> {
    // XDG_CONFIG_HOME override is respected by Copilot CLI
    if let Ok(xdg) = std::env::var("XDG_CONFIG_HOME") {
        let xdg_path = std::path::PathBuf::from(&xdg)
            .join("copilot")
            .join("session-state");
        if xdg_path.exists() {
            return Some(xdg_path);
        }
    }
    if let Some(home) = dirs::home_dir() {
        let session_path = home.join(".copilot").join("session-state");
        if session_path.exists() {
            return Some(session_path);
        }
        // Legacy location (pre v0.0.342)
        let legacy_path = home.join(".copilot").join("history-session-state");
        if legacy_path.exists() {
            return Some(legacy_path);
        }
    }

    None
}

/// Get Qwen Code's storage path (Alibaba)
/// Stores project-scoped chats in ~/.qwen/projects/<sanitized-cwd>/chats/
fn get_qwencode_storage_path() -> Option<std::path::PathBuf> {
    if let Some(home) = dirs::home_dir() {
        let projects_path = home.join(".qwen").join("projects");
        if projects_path.exists() {
            return Some(projects_path);
        }
        // Older releases kept per-project temp storage in ~/.qwen/tmp/
        let tmp_path = home.join(".qwen").join("tmp");
        if tmp_path.exists() {
            return Some(tmp_path);
        }
    }

    None
}

/// Get Pi coding agent's storage path
/// Stores JSONL session trees in ~/.pi/agent/sessions/ (PI_AGENT_DIR override)
fn get_pi_storage_path() -> Option<std::path::PathBuf> {
    if let Ok(custom) = std::env::var("PI_AGENT_DIR") {
        let custom_path = std::path::PathBuf::from(&custom).join("sessions");
        if custom_path.exists() {
            return Some(custom_path);
        }
    }
    if let Some(home) = dirs::home_dir() {
        let pi_path = home.join(".pi").join("agent").join("sessions");
        if pi_path.exists() {
            return Some(pi_path);
        }
    }

    None
}

/// Get Goose's legacy JSONL session path (Block)
/// Pre-1.10 sessions are JSONL files in ~/.local/share/goose/sessions/
/// (1.10+ uses a SQLite sessions.db, which requires a dedicated reader)
fn get_goose_storage_path() -> Option<std::path::PathBuf> {
    if let Some(home) = dirs::home_dir() {
        let goose_path = home
            .join(".local")
            .join("share")
            .join("goose")
            .join("sessions");
        if goose_path.exists() {
            return Some(goose_path);
        }
    }
    if let Some(data) = dirs::data_dir() {
        let data_path = data.join("goose").join("sessions");
        if data_path.exists() {
            return Some(data_path);
        }
    }
    if let Some(local) = dirs::data_local_dir() {
        let local_path = local.join("goose").join("sessions");
        if local_path.exists() {
            return Some(local_path);
        }
    }

    None
}

/// Get a VS Code extension's globalStorage task directory (Cline-family extensions)
fn get_vscode_global_storage_tasks(extension_id: &str) -> Option<std::path::PathBuf> {
    let global_storage = {
        #[cfg(target_os = "windows")]
        {
            std::env::var("APPDATA").ok().map(|appdata| {
                std::path::PathBuf::from(appdata)
                    .join("Code")
                    .join("User")
                    .join("globalStorage")
            })
        }
        #[cfg(target_os = "macos")]
        {
            dirs::home_dir().map(|home| {
                home.join("Library")
                    .join("Application Support")
                    .join("Code")
                    .join("User")
                    .join("globalStorage")
            })
        }
        #[cfg(target_os = "linux")]
        {
            dirs::config_dir().map(|config| config.join("Code").join("User").join("globalStorage"))
        }
    }?;

    let tasks_path = global_storage.join(extension_id).join("tasks");
    if tasks_path.exists() {
        return Some(tasks_path);
    }

    None
}

/// Get Cline's task storage (VS Code extension)
fn get_cline_storage_path() -> Option<std::path::PathBuf> {
    get_vscode_global_storage_tasks("saoudrizwan.claude-dev")
}

/// Get Roo Code's task storage (VS Code extension)
fn get_roocode_storage_path() -> Option<std::path::PathBuf> {
    get_vscode_global_storage_tasks("rooveterinaryinc.roo-cline")
}

/// Get Kilo Code's task storage (VS Code extension)
fn get_kilocode_storage_path() -> Option<std::path::PathBuf> {
    get_vscode_global_storage_tasks("kilocode.kilo-code")
}

/// Get a VS Code fork's workspaceStorage path (Windsurf, Trae)
fn get_vscode_fork_workspace_storage(app_name: &str) -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(roaming) = std::env::var("APPDATA") {
            let fork_path = std::path::PathBuf::from(roaming)
                .join(app_name)
                .join("User")
                .join("workspaceStorage");
            if fork_path.exists() {
                return Some(fork_path);
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            let fork_path = home
                .join("Library")
                .join("Application Support")
                .join(app_name)
                .join("User")
                .join("workspaceStorage");
            if fork_path.exists() {
                return Some(fork_path);
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(config) = dirs::config_dir() {
            let fork_path = config.join(app_name).join("User").join("workspaceStorage");
            if fork_path.exists() {
                return Some(fork_path);
            }
        }
    }

    let _ = app_name;
    None
}

/// Get Windsurf IDE's workspace storage path (VS Code fork)
fn get_windsurf_storage_path() -> Option<std::path::PathBuf> {
    get_vscode_fork_workspace_storage("Windsurf")
}

/// Get Trae IDE's workspace storage path (ByteDance, VS Code fork)
fn get_trae_storage_path() -> Option<std::path::PathBuf> {
    get_vscode_fork_workspace_storage("Trae")
}

/// List agent mode sessions (chatEditingSessions / Copilot Edits)
pub fn list_agents_sessions(
    project_path: Option<&str>,
    show_size: bool,
    provider: Option<&str>,
) -> Result<()> {
    // Get storage paths based on provider filter
    let storage_paths = get_agent_storage_paths(provider)?;

    if storage_paths.is_empty() {
        if let Some(p) = provider {
            println!("No storage found for provider: {}", p);
            println!("\nSupported providers: vscode, cursor, claudecode, opencode, openclaw, antigravity, antigravitycli, codexcli, droidcli, geminicli, cursorcli, copilotcli, qwencode, pi, goose, cline, roocode, kilocode, windsurf, trae");
        } else {
            println!("No workspaces found");
        }
        return Ok(());
    }

    #[derive(Tabled)]
    struct AgentSessionRow {
        #[tabled(rename = "Provider")]
        provider: String,
        #[tabled(rename = "Project")]
        project: String,
        #[tabled(rename = "Session ID")]
        session_id: String,
        #[tabled(rename = "Last Modified")]
        last_modified: String,
        #[tabled(rename = "Files")]
        file_count: usize,
    }

    #[derive(Tabled)]
    struct AgentSessionRowWithSize {
        #[tabled(rename = "Provider")]
        provider: String,
        #[tabled(rename = "Project")]
        project: String,
        #[tabled(rename = "Session ID")]
        session_id: String,
        #[tabled(rename = "Last Modified")]
        last_modified: String,
        #[tabled(rename = "Files")]
        file_count: usize,
        #[tabled(rename = "Size")]
        size: String,
    }

    let target_path = project_path.map(crate::workspace::normalize_path);
    let mut total_size: u64 = 0;
    let mut rows_with_size: Vec<AgentSessionRowWithSize> = Vec::new();
    let mut rows: Vec<AgentSessionRow> = Vec::new();

    for (provider_name, storage_path) in &storage_paths {
        if !storage_path.exists() {
            continue;
        }

        for entry in std::fs::read_dir(storage_path)?.filter_map(|e| e.ok()) {
            let workspace_dir = entry.path();
            if !workspace_dir.is_dir() {
                continue;
            }

            let agent_sessions_dir = workspace_dir.join("chatEditingSessions");
            if !agent_sessions_dir.exists() {
                continue;
            }

            // Get project path from workspace.json
            let workspace_json = workspace_dir.join("workspace.json");
            let project = std::fs::read_to_string(&workspace_json)
                .ok()
                .and_then(|c| serde_json::from_str::<crate::models::WorkspaceJson>(&c).ok())
                .and_then(|ws| {
                    ws.folder
                        .map(|f| crate::workspace::decode_workspace_folder(&f))
                });

            // Filter by project path if specified
            if let Some(ref target) = target_path {
                if project
                    .as_ref()
                    .map(|p| crate::workspace::normalize_path(p) != *target)
                    .unwrap_or(true)
                {
                    continue;
                }
            }

            let project_name = project
                .as_ref()
                .and_then(|p| std::path::Path::new(p).file_name())
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| crate::text::head(&entry.file_name().to_string_lossy(), 8));

            // List agent session directories
            for session_entry in std::fs::read_dir(&agent_sessions_dir)?.filter_map(|e| e.ok()) {
                let session_dir = session_entry.path();
                if !session_dir.is_dir() {
                    continue;
                }

                let session_id = session_entry.file_name().to_string_lossy().to_string();
                let short_id = if session_id.len() > 8 {
                    format!("{}...", crate::text::head(&session_id, 8))
                } else {
                    session_id.clone()
                };

                // Get last modified time and file count
                let mut last_mod = std::time::SystemTime::UNIX_EPOCH;
                let mut file_count = 0;
                let mut session_size: u64 = 0;

                if let Ok(files) = std::fs::read_dir(&session_dir) {
                    for file in files.filter_map(|f| f.ok()) {
                        file_count += 1;
                        if let Ok(meta) = file.metadata() {
                            session_size += meta.len();
                            if let Ok(mod_time) = meta.modified() {
                                if mod_time > last_mod {
                                    last_mod = mod_time;
                                }
                            }
                        }
                    }
                }

                total_size += session_size;

                let modified = if last_mod != std::time::SystemTime::UNIX_EPOCH {
                    let datetime: chrono::DateTime<chrono::Utc> = last_mod.into();
                    datetime.format("%Y-%m-%d %H:%M").to_string()
                } else {
                    "unknown".to_string()
                };

                if show_size {
                    rows_with_size.push(AgentSessionRowWithSize {
                        provider: provider_name.clone(),
                        project: project_name.clone(),
                        session_id: short_id,
                        last_modified: modified,
                        file_count,
                        size: format_file_size(session_size),
                    });
                } else {
                    rows.push(AgentSessionRow {
                        provider: provider_name.clone(),
                        project: project_name.clone(),
                        session_id: short_id,
                        last_modified: modified,
                        file_count,
                    });
                }
            }
        }
    }

    if show_size {
        if rows_with_size.is_empty() {
            println!("No agent mode sessions found.");
            return Ok(());
        }
        let table = Table::new(&rows_with_size)
            .with(TableStyle::ascii_rounded())
            .to_string();
        println!("{}", table);
        println!(
            "\nTotal agent sessions: {} ({})",
            rows_with_size.len(),
            format_file_size(total_size)
        );
    } else {
        if rows.is_empty() {
            println!("No agent mode sessions found.");
            return Ok(());
        }
        let table = Table::new(&rows)
            .with(TableStyle::ascii_rounded())
            .to_string();
        println!("{}", table);
        println!("\nTotal agent sessions: {}", rows.len());
    }

    Ok(())
}

/// Show agent mode session details
pub fn show_agent_session(session_id: &str, project_path: Option<&str>) -> Result<()> {
    use colored::*;

    let storage_path = crate::workspace::get_workspace_storage_path()?;
    let session_id_lower = session_id.to_lowercase();
    let target_path = project_path.map(crate::workspace::normalize_path);

    for entry in std::fs::read_dir(&storage_path)?.filter_map(|e| e.ok()) {
        let workspace_dir = entry.path();
        if !workspace_dir.is_dir() {
            continue;
        }

        let agent_sessions_dir = workspace_dir.join("chatEditingSessions");
        if !agent_sessions_dir.exists() {
            continue;
        }

        // Get project path
        let workspace_json = workspace_dir.join("workspace.json");
        let project = std::fs::read_to_string(&workspace_json)
            .ok()
            .and_then(|c| serde_json::from_str::<crate::models::WorkspaceJson>(&c).ok())
            .and_then(|ws| {
                ws.folder
                    .map(|f| crate::workspace::decode_workspace_folder(&f))
            });

        // Filter by project path if specified
        if let Some(ref target) = target_path {
            if project
                .as_ref()
                .map(|p| crate::workspace::normalize_path(p) != *target)
                .unwrap_or(true)
            {
                continue;
            }
        }

        for session_entry in std::fs::read_dir(&agent_sessions_dir)?.filter_map(|e| e.ok()) {
            let full_id = session_entry.file_name().to_string_lossy().to_string();
            if !full_id.to_lowercase().contains(&session_id_lower) {
                continue;
            }

            let session_dir = session_entry.path();

            println!("\n{}", "=".repeat(60).bright_blue());
            println!("{}", "Agent Session Details".bright_blue().bold());
            println!("{}", "=".repeat(60).bright_blue());

            println!(
                "{}: {}",
                "Session ID".bright_white().bold(),
                full_id.bright_cyan()
            );
            println!(
                "{}: {}",
                "Project".bright_white().bold(),
                project.as_deref().unwrap_or("(none)")
            );
            println!(
                "{}: {}",
                "Path".bright_white().bold(),
                session_dir.display()
            );

            // List files in the session
            println!("\n{}", "Session Files:".bright_yellow());
            let mut total_size: u64 = 0;
            if let Ok(files) = std::fs::read_dir(&session_dir) {
                for file in files.filter_map(|f| f.ok()) {
                    let _path = file.path();
                    let name = file.file_name().to_string_lossy().to_string();
                    let size = file.metadata().map(|m| m.len()).unwrap_or(0);
                    total_size += size;
                    println!("  {} ({})", name.dimmed(), format_file_size(size));
                }
            }
            println!(
                "\n{}: {}",
                "Total Size".bright_white().bold(),
                format_file_size(total_size)
            );

            return Ok(());
        }
    }

    println!(
        "{} No agent session found matching '{}'",
        "!".yellow(),
        session_id
    );
    Ok(())
}

/// Show timeline of session activity with gap visualization
pub fn show_timeline(
    project_path: Option<&str>,
    include_agents: bool,
    provider: Option<&str>,
    all_providers: bool,
) -> Result<()> {
    use colored::*;
    use std::collections::BTreeMap;

    // Determine which storage paths to scan
    let storage_paths = if all_providers {
        get_agent_storage_paths(Some("all"))?
    } else if let Some(p) = provider {
        get_agent_storage_paths(Some(p))?
    } else {
        // Default to VS Code only
        let vscode_path = crate::workspace::get_workspace_storage_path()?;
        if vscode_path.exists() {
            vec![("vscode".to_string(), vscode_path)]
        } else {
            vec![]
        }
    };

    if storage_paths.is_empty() {
        if let Some(p) = provider {
            println!("No storage found for provider: {}", p);
        } else {
            println!("No workspaces found");
        }
        return Ok(());
    }

    let target_path = project_path.map(crate::workspace::normalize_path);

    // Collect all session dates (date -> (chat_count, agent_count, provider))
    let mut date_activity: BTreeMap<chrono::NaiveDate, (usize, usize)> = BTreeMap::new();
    let mut project_name = String::new();
    let mut providers_scanned: Vec<String> = Vec::new();

    for (provider_name, storage_path) in &storage_paths {
        if !storage_path.exists() {
            continue;
        }
        providers_scanned.push(provider_name.clone());

        for entry in std::fs::read_dir(storage_path)?.filter_map(|e| e.ok()) {
            let workspace_dir = entry.path();
            if !workspace_dir.is_dir() {
                continue;
            }

            // Get project path
            let workspace_json = workspace_dir.join("workspace.json");
            let project = std::fs::read_to_string(&workspace_json)
                .ok()
                .and_then(|c| serde_json::from_str::<crate::models::WorkspaceJson>(&c).ok())
                .and_then(|ws| {
                    ws.folder
                        .map(|f| crate::workspace::decode_workspace_folder(&f))
                });

            // Filter by project path if specified
            if let Some(ref target) = target_path {
                if project
                    .as_ref()
                    .map(|p| crate::workspace::normalize_path(p) != *target)
                    .unwrap_or(true)
                {
                    continue;
                }
                if project_name.is_empty() {
                    project_name = std::path::Path::new(target)
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| target.clone());
                }
            }

            // Scan chatSessions
            let chat_sessions_dir = workspace_dir.join("chatSessions");
            if chat_sessions_dir.exists() {
                if let Ok(files) = std::fs::read_dir(&chat_sessions_dir) {
                    for file in files.filter_map(|f| f.ok()) {
                        if let Ok(meta) = file.metadata() {
                            if let Ok(modified) = meta.modified() {
                                let datetime: chrono::DateTime<chrono::Utc> = modified.into();
                                let date = datetime.date_naive();
                                let entry = date_activity.entry(date).or_insert((0, 0));
                                entry.0 += 1;
                            }
                        }
                    }
                }
            }

            // Scan chatEditingSessions (agent mode) if requested
            if include_agents {
                let agent_sessions_dir = workspace_dir.join("chatEditingSessions");
                if agent_sessions_dir.exists() {
                    if let Ok(dirs) = std::fs::read_dir(&agent_sessions_dir) {
                        for dir in dirs.filter_map(|d| d.ok()) {
                            if let Ok(meta) = dir.metadata() {
                                if let Ok(modified) = meta.modified() {
                                    let datetime: chrono::DateTime<chrono::Utc> = modified.into();
                                    let date = datetime.date_naive();
                                    let entry = date_activity.entry(date).or_insert((0, 0));
                                    entry.1 += 1;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if date_activity.is_empty() {
        println!("No session activity found.");
        return Ok(());
    }

    let title = if project_name.is_empty() {
        "All Workspaces".to_string()
    } else {
        project_name
    };

    let provider_info = if providers_scanned.len() > 1 || all_providers {
        format!(" ({})", providers_scanned.join(", "))
    } else {
        String::new()
    };

    println!(
        "\n{} Session Timeline: {}{}",
        "[*]".blue(),
        title.cyan(),
        provider_info.dimmed()
    );
    println!("{}", "=".repeat(60));

    let dates: Vec<_> = date_activity.keys().collect();
    let first_date = **dates.first().unwrap();
    let last_date = **dates.last().unwrap();

    println!(
        "Range: {} to {}",
        first_date.format("%Y-%m-%d"),
        last_date.format("%Y-%m-%d")
    );
    println!();

    // Find gaps (more than 1 day between sessions)
    let mut gaps: Vec<(chrono::NaiveDate, chrono::NaiveDate, i64)> = Vec::new();
    let mut prev_date: Option<chrono::NaiveDate> = None;

    for date in dates.iter() {
        if let Some(prev) = prev_date {
            let diff = (**date - prev).num_days();
            if diff > 1 {
                gaps.push((prev, **date, diff));
            }
        }
        prev_date = Some(**date);
    }

    // Show recent activity (last 14 days worth)
    println!("{}", "Recent Activity:".bright_yellow());
    let recent_dates: Vec<_> = date_activity.iter().rev().take(14).collect();
    for (date, (chats, agents)) in recent_dates.iter().rev() {
        let chat_bar = "█".repeat((*chats).min(20));
        let agent_bar = if include_agents && *agents > 0 {
            format!(" {}", "▓".repeat((*agents).min(10)).bright_magenta())
        } else {
            String::new()
        };
        println!(
            "  {} │ {}{}",
            date.format("%Y-%m-%d"),
            chat_bar.bright_green(),
            agent_bar
        );
    }

    // Show gaps
    if !gaps.is_empty() {
        println!("\n{}", "Gaps (>1 day):".bright_red());
        for (start, end, days) in gaps.iter().take(10) {
            println!(
                "  {} → {} ({} days)",
                start.format("%Y-%m-%d"),
                end.format("%Y-%m-%d"),
                days
            );
        }
        if gaps.len() > 10 {
            println!("  ... and {} more gaps", gaps.len() - 10);
        }
    }

    // Summary
    let total_chats: usize = date_activity.values().map(|(c, _)| c).sum();
    let total_agents: usize = date_activity.values().map(|(_, a)| a).sum();
    let total_days = date_activity.len();
    let total_gap_days: i64 = gaps.iter().map(|(_, _, d)| d - 1).sum();

    println!("\n{}", "Summary:".bright_white().bold());
    println!("  Active days: {}", total_days);
    println!("  Chat sessions: {}", total_chats);
    if include_agents {
        println!("  Agent sessions: {}", total_agents);
    }
    println!("  Total gap days: {}", total_gap_days);

    if include_agents {
        println!(
            "\n{} {} = chat, {} = agent",
            "Legend:".dimmed(),
            "█".bright_green(),
            "▓".bright_magenta()
        );
    }

    Ok(())
}

/// Show the VS Code session index (state.vscdb) for a workspace
pub fn show_index(project_path: Option<&str>, all: bool) -> Result<()> {
    if all {
        return show_index_all();
    }

    use colored::Colorize;
    use tabled::{settings::Style as TableStyle, Table, Tabled};

    let path = crate::commands::register::resolve_path(project_path);
    let path_str = path.to_string_lossy().to_string();

    println!(
        "{} Session index for: {}",
        "[CSM]".cyan().bold(),
        path.display()
    );

    let (ws_id, ws_path, _folder) = crate::workspace::find_workspace_by_path(&path_str)?
        .ok_or_else(|| crate::error::CsmError::WorkspaceNotFound(path.display().to_string()))?;

    let db_path = crate::storage::get_workspace_storage_db(&ws_id)?;
    let index = crate::storage::read_chat_session_index(&db_path)?;

    println!(
        "   Workspace: {} ({})",
        ws_id.bright_yellow(),
        ws_path.display()
    );
    println!(
        "   Index version: {}, entries: {}\n",
        index.version,
        index.entries.len()
    );

    #[derive(Tabled)]
    struct IndexRow {
        #[tabled(rename = "Session ID")]
        session_id: String,
        #[tabled(rename = "Title")]
        title: String,
        #[tabled(rename = "isEmpty")]
        is_empty: String,
        #[tabled(rename = "Last Message")]
        last_message: String,
        #[tabled(rename = "ResponseState")]
        response_state: String,
        #[tabled(rename = "Location")]
        location: String,
    }

    let mut rows: Vec<IndexRow> = Vec::new();
    for entry in index.entries.values() {
        let last_msg = if entry.last_message_date > 0 {
            let secs = entry.last_message_date / 1000;
            chrono::DateTime::from_timestamp(secs, 0)
                .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string())
                .unwrap_or_else(|| entry.last_message_date.to_string())
        } else {
            "0".to_string()
        };

        let state = match entry.last_response_state {
            0 => "Pending",
            1 => "Complete",
            2 => "Cancelled",
            3 => "Failed",
            4 => "NeedsInput",
            _ => "Unknown",
        };

        rows.push(IndexRow {
            session_id: entry.session_id[..12.min(entry.session_id.len())].to_string(),
            title: if entry.title.len() > 40 {
                crate::text::truncate(&entry.title, 40)
            } else {
                entry.title.clone()
            },
            is_empty: if entry.is_empty {
                "true".red().to_string()
            } else {
                "false".green().to_string()
            },
            last_message: last_msg,
            response_state: state.to_string(),
            location: entry.initial_location.clone(),
        });
    }

    // Sort by last message date descending
    rows.sort_by(|a, b| b.last_message.cmp(&a.last_message));

    let table = Table::new(&rows)
        .with(TableStyle::ascii_rounded())
        .to_string();
    println!("{}", table);

    // Also check for files on disk not in index
    let chat_dir = ws_path.join("chatSessions");
    if chat_dir.exists() {
        let mut disk_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
        for entry in std::fs::read_dir(&chat_dir)? {
            let entry = entry?;
            let p = entry.path();
            if p.extension()
                .map(crate::storage::is_session_file_extension)
                .unwrap_or(false)
            {
                if let Some(stem) = p.file_stem() {
                    disk_ids.insert(stem.to_string_lossy().to_string());
                }
            }
        }
        let indexed_ids: std::collections::HashSet<String> =
            index.entries.keys().cloned().collect();
        let orphaned: Vec<_> = disk_ids.difference(&indexed_ids).collect();
        let stale: Vec<_> = indexed_ids.difference(&disk_ids).collect();

        if !orphaned.is_empty() {
            println!(
                "\n{} {} session(s) on disk but NOT in index (orphaned):",
                "[!]".yellow(),
                orphaned.len()
            );
            for id in &orphaned {
                println!("   {}", id.red());
            }
        }
        if !stale.is_empty() {
            println!(
                "\n{} {} index entries with NO file on disk (stale):",
                "[!]".yellow(),
                stale.len()
            );
            for id in &stale {
                println!("   {}", id.red());
            }
        }
        if orphaned.is_empty() && stale.is_empty() {
            println!("\n{} Index is in sync with files on disk.", "[OK]".green());
        }
    }

    Ok(())
}

/// Show index summary for all workspaces with chat sessions
fn show_index_all() -> Result<()> {
    use colored::Colorize;

    println!(
        "{} Scanning all workspace indexes...\n",
        "[CSM]".cyan().bold(),
    );

    let workspaces = crate::workspace::discover_workspaces()?;
    let ws_with_sessions: Vec<_> = workspaces
        .iter()
        .filter(|w| w.has_chat_sessions && w.chat_session_count > 0)
        .collect();

    if ws_with_sessions.is_empty() {
        println!("{} No workspaces with chat sessions found.", "[!]".yellow());
        return Ok(());
    }

    let mut total_entries = 0usize;
    let mut total_non_empty = 0usize;
    let mut total_orphaned = 0usize;
    let mut total_stale = 0usize;
    let mut _sync_ok = 0usize;
    let mut sync_issues = 0usize;

    for (i, ws) in ws_with_sessions.iter().enumerate() {
        let display_name = ws.project_path.as_deref().unwrap_or(&ws.hash);

        let db_path = match crate::storage::get_workspace_storage_db(&ws.hash) {
            Ok(p) => p,
            Err(_) => {
                println!(
                    "[{}/{}] {} {} — {} no state.vscdb",
                    i + 1,
                    ws_with_sessions.len(),
                    display_name.cyan(),
                    "".dimmed(),
                    "[!]".yellow()
                );
                continue;
            }
        };

        let index = match crate::storage::read_chat_session_index(&db_path) {
            Ok(idx) => idx,
            Err(_) => {
                println!(
                    "[{}/{}] {} — {} no index in state.vscdb",
                    i + 1,
                    ws_with_sessions.len(),
                    display_name.cyan(),
                    "[!]".yellow()
                );
                continue;
            }
        };

        let non_empty = index.entries.values().filter(|e| !e.is_empty).count();
        total_entries += index.entries.len();
        total_non_empty += non_empty;

        // Check sync status
        let chat_dir = ws.workspace_path.join("chatSessions");
        let mut orphaned = 0usize;
        let mut stale = 0usize;
        if chat_dir.exists() {
            let mut disk_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
            if let Ok(entries) = std::fs::read_dir(&chat_dir) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.extension()
                        .map(crate::storage::is_session_file_extension)
                        .unwrap_or(false)
                    {
                        if let Some(stem) = p.file_stem() {
                            disk_ids.insert(stem.to_string_lossy().to_string());
                        }
                    }
                }
            }
            let indexed_ids: std::collections::HashSet<String> =
                index.entries.keys().cloned().collect();
            orphaned = disk_ids.difference(&indexed_ids).count();
            stale = indexed_ids.difference(&disk_ids).count();
        }
        total_orphaned += orphaned;
        total_stale += stale;

        let status = if orphaned == 0 && stale == 0 {
            _sync_ok += 1;
            "[OK]".green().to_string()
        } else {
            sync_issues += 1;
            format!(
                "{}{}",
                if orphaned > 0 {
                    format!("{} orphaned ", orphaned).yellow().to_string()
                } else {
                    String::new()
                },
                if stale > 0 {
                    format!("{} stale", stale).yellow().to_string()
                } else {
                    String::new()
                }
            )
        };

        println!(
            "[{:>3}/{}] {} — {} entries ({} with content) {}",
            i + 1,
            ws_with_sessions.len(),
            display_name.cyan(),
            index.entries.len(),
            non_empty.to_string().green(),
            status
        );
    }

    println!(
        "\n{} {} workspaces, {} index entries ({} with content)",
        "[OK]".green().bold(),
        ws_with_sessions.len().to_string().cyan(),
        total_entries.to_string().cyan(),
        total_non_empty.to_string().green()
    );
    if sync_issues > 0 {
        println!(
            "   {} {}/{} workspaces have sync issues ({} orphaned, {} stale)",
            "[!]".yellow(),
            sync_issues,
            ws_with_sessions.len(),
            total_orphaned,
            total_stale
        );
    } else {
        println!(
            "   {} All indexes in sync with files on disk.",
            "[OK]".green()
        );
    }

    Ok(())
}
