// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
//! `ironbridge inspect` — Low-level inspection of VS Code state databases, session
//! indices, mementos, caches, and session file validity.

use anyhow::Result;
use colored::Colorize;
use rusqlite::Connection;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use crate::models::{ChatSessionIndexEntry, ChatSessionTiming};
use crate::storage::{
    cleanup_state_cache, detect_session_format, fix_session_memento, get_workspace_storage_db,
    is_session_file_extension, parse_session_auto, parse_session_file, read_chat_session_index,
    read_db_json, read_model_cache, read_state_cache, rebuild_model_cache,
    session_id_from_resource_uri, session_resource_uri, write_chat_session_index,
    VsCodeSessionFormat,
};
use crate::workspace::{find_workspace_by_path, get_workspace_storage_path};

// ── Helpers ────────────────────────────────────────────────────────────────

/// Resolve a project path (or cwd) to its workspace hash and state.vscdb path.
fn resolve_workspace(path: Option<&str>) -> Result<(String, PathBuf)> {
    let project_path = match path {
        Some(p) => p.to_string(),
        None => std::env::current_dir()?.to_string_lossy().to_string(),
    };

    let (ws_hash, _ws_dir, _folder) = find_workspace_by_path(&project_path)?
        .ok_or_else(|| anyhow::anyhow!("No VS Code workspace found for path: {}", project_path))?;

    let db_path = get_workspace_storage_db(&ws_hash)?;
    if !db_path.exists() {
        anyhow::bail!("state.vscdb not found at {}", db_path.display());
    }

    Ok((ws_hash, db_path))
}

/// Resolve by explicit workspace hash instead of project path.
fn resolve_by_hash(hash: &str) -> Result<(String, PathBuf)> {
    let db_path = get_workspace_storage_db(hash)?;
    if !db_path.exists() {
        anyhow::bail!("state.vscdb not found at {}", db_path.display());
    }
    Ok((hash.to_string(), db_path))
}

/// Format a millisecond epoch timestamp as human-readable UTC datetime.
fn fmt_ts(ms: i64) -> String {
    if ms == 0 {
        return "(none)".to_string();
    }
    let secs = ms / 1000;
    let nanos = ((ms % 1000) * 1_000_000) as u32;
    match chrono::DateTime::from_timestamp(secs, nanos) {
        Some(dt) => dt.format("%Y-%m-%d %H:%M:%S UTC").to_string(),
        None => format!("{}ms", ms),
    }
}

/// Get (ws_hash, db_path) from either --path or --workspace-id.
fn resolve(path: Option<&str>, workspace_id: Option<&str>) -> Result<(String, PathBuf)> {
    if let Some(hash) = workspace_id {
        resolve_by_hash(hash)
    } else {
        resolve_workspace(path)
    }
}

// ── Subcommands ────────────────────────────────────────────────────────────

/// `ironbridge inspect index` — Show the ChatSessionStore index entries.
pub fn inspect_index(path: Option<&str>, workspace_id: Option<&str>, json: bool) -> Result<()> {
    let (ws_hash, db_path) = resolve(path, workspace_id)?;

    if !json {
        println!(
            "\n  {} {} ({})\n",
            "Workspace:".bold(),
            ws_hash.cyan(),
            db_path.display()
        );
    }

    let index = read_chat_session_index(&db_path)?;

    if json {
        println!("{}", serde_json::to_string_pretty(&index)?);
        return Ok(());
    }

    println!("  {} {}", "Index version:".bold(), index.version);
    println!("  {} {}\n", "Entry count:".bold(), index.entries.len());

    if index.entries.is_empty() {
        println!("  (no sessions in index)");
        return Ok(());
    }

    // Sort by lastMessageDate descending
    let mut entries: Vec<_> = index.entries.iter().collect();
    entries.sort_by_key(|e| std::cmp::Reverse(e.1.last_message_date));

    for (id, entry) in &entries {
        let title = if entry.title.chars().count() > 60 {
            crate::text::truncate(&entry.title, 60)
        } else {
            entry.title.clone()
        };

        println!("  {} {}", "ID:".bright_black(), id.yellow());
        println!("    {} {}", "Title:".bright_black(), title);
        println!(
            "    {} {}",
            "Last message:".bright_black(),
            fmt_ts(entry.last_message_date)
        );

        if let Some(timing) = &entry.timing {
            println!(
                "    {} {}",
                "Created:".bright_black(),
                fmt_ts(timing.created)
            );
        }

        let state_label = match entry.last_response_state {
            0 => "Pending",
            1 => "Complete",
            2 => "Cancelled",
            3 => "Failed",
            4 => "NeedsInput",
            _ => "Unknown",
        };
        println!(
            "    {} {}  {} {}  {} {}",
            "State:".bright_black(),
            state_label,
            "Empty:".bright_black(),
            entry.is_empty,
            "Location:".bright_black(),
            entry.initial_location,
        );

        // Check if session file exists on disk
        let storage_path = get_workspace_storage_path()?;
        let chat_dir = storage_path.join(&ws_hash).join("chatSessions");
        let jsonl_path = chat_dir.join(format!("{}.jsonl", id));
        let json_path = chat_dir.join(format!("{}.json", id));

        let file_status = if jsonl_path.exists() {
            let size = std::fs::metadata(&jsonl_path).map(|m| m.len()).unwrap_or(0);
            if size < 500 {
                format!("{} ({} bytes)", ".jsonl STUB".red(), size)
            } else {
                format!("{} ({} bytes)", ".jsonl".green(), size)
            }
        } else if json_path.exists() {
            let size = std::fs::metadata(&json_path).map(|m| m.len()).unwrap_or(0);
            format!("{} ({} bytes)", ".json (legacy)".yellow(), size)
        } else {
            "MISSING".red().to_string()
        };
        println!("    {} {}", "File:".bright_black(), file_status);

        // Check for backup file
        let backup_jsonl = chat_dir.join(format!("{}.jsonl.backup", id));
        let backup_json = chat_dir.join(format!("{}.json.backup", id));
        if backup_jsonl.exists() {
            let size = std::fs::metadata(&backup_jsonl)
                .map(|m| m.len())
                .unwrap_or(0);
            println!(
                "    {} .jsonl.backup ({} bytes)",
                "Backup:".bright_black(),
                size
            );
        } else if backup_json.exists() {
            let size = std::fs::metadata(&backup_json)
                .map(|m| m.len())
                .unwrap_or(0);
            println!(
                "    {} .json.backup ({} bytes)",
                "Backup:".bright_black(),
                size
            );
        }

        println!();
    }

    Ok(())
}

/// `ironbridge inspect memento` — Show session memento (input history and active session state).
pub fn inspect_memento(path: Option<&str>, workspace_id: Option<&str>, json: bool) -> Result<()> {
    let (ws_hash, db_path) = resolve(path, workspace_id)?;

    if !json {
        println!(
            "\n  {} {} ({})\n",
            "Workspace:".bold(),
            ws_hash.cyan(),
            db_path.display()
        );
    }

    // Read memento/interactive-session (input history)
    let history = read_db_json(&db_path, "memento/interactive-session")?;
    // Read memento/interactive-session-view-copilot (active session state)
    let view_state = read_db_json(&db_path, "memento/interactive-session-view-copilot")?;

    if json {
        let output = serde_json::json!({
            "workspace": ws_hash,
            "inputHistory": history,
            "viewState": view_state,
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
        return Ok(());
    }

    // Input history
    println!(
        "  {}",
        "Input History (memento/interactive-session)"
            .bold()
            .underline()
    );
    match &history {
        Some(val) => {
            if let Some(obj) = val.as_object() {
                for (provider, data) in obj {
                    println!("\n  {} {}", "Provider:".bright_black(), provider.cyan());
                    if let Some(arr) = data.as_array() {
                        println!("  {} {} entries", "Entries:".bright_black(), arr.len());
                        // Show last 5 entries
                        let show = arr.len().min(5);
                        let start = arr.len() - show;
                        if start > 0 {
                            println!("  {} (showing last {})", "...".bright_black(), show);
                        }
                        for (i, entry) in arr[start..].iter().enumerate() {
                            let text = entry
                                .as_str()
                                .or_else(|| entry.get("text").and_then(|t| t.as_str()))
                                .unwrap_or("<complex>");
                            let truncated: String = text.chars().take(80).collect();
                            let suffix = if text.len() > 80 { "..." } else { "" };
                            println!(
                                "    {} {}{}",
                                format!("[{}]", start + i + 1).bright_black(),
                                truncated,
                                suffix
                            );
                        }
                    } else {
                        println!("  {} {:?}", "Value:".bright_black(), data);
                    }
                }
            } else {
                println!("  {}", serde_json::to_string_pretty(val)?);
            }
        }
        None => println!("  (not found)"),
    }

    // Active session view state
    println!(
        "\n\n  {}",
        "Active Session State (memento/interactive-session-view-copilot)"
            .bold()
            .underline()
    );
    match &view_state {
        Some(val) => {
            if let Some(obj) = val.as_object() {
                for (key, v) in obj {
                    let display = match v {
                        serde_json::Value::String(s) => {
                            if s.chars().count() > 80 {
                                crate::text::truncate(s, 80)
                            } else {
                                s.clone()
                            }
                        }
                        other => {
                            let s = serde_json::to_string(other).unwrap_or_default();
                            if s.chars().count() > 80 {
                                crate::text::truncate(&s, 80)
                            } else {
                                s
                            }
                        }
                    };
                    println!("  {} {} = {}", "•".bright_black(), key.cyan(), display);
                }
            } else {
                println!("  {}", serde_json::to_string_pretty(val)?);
            }
        }
        None => println!("  (not found)"),
    }

    println!();
    Ok(())
}

/// `ironbridge inspect cache` — Show agentSessions model & state caches.
pub fn inspect_cache(path: Option<&str>, workspace_id: Option<&str>, json: bool) -> Result<()> {
    let (ws_hash, db_path) = resolve(path, workspace_id)?;

    if !json {
        println!(
            "\n  {} {} ({})\n",
            "Workspace:".bold(),
            ws_hash.cyan(),
            db_path.display()
        );
    }

    let model_cache = read_model_cache(&db_path)?;
    let state_cache = read_state_cache(&db_path)?;

    if json {
        let output = serde_json::json!({
            "workspace": ws_hash,
            "modelCache": model_cache,
            "stateCache": state_cache,
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
        return Ok(());
    }

    // Model cache
    println!(
        "  {} ({} entries)\n",
        "Model Cache (agentSessions.model.cache)".bold().underline(),
        model_cache.len()
    );

    for entry in &model_cache {
        let session_id =
            session_id_from_resource_uri(&entry.resource).unwrap_or_else(|| entry.resource.clone());

        let title = if entry.label.chars().count() > 60 {
            crate::text::truncate(&entry.label, 60)
        } else {
            entry.label.clone()
        };

        let status_label = match entry.status {
            0 => "Pending".yellow(),
            1 => "Valid".green(),
            2 => "Cancelled".red(),
            _ => format!("Unknown({})", entry.status).red(),
        };

        println!("  {} {}", "ID:".bright_black(), session_id.yellow());
        println!("    {} {}", "Title:".bright_black(), title);
        println!("    {} {}", "Status:".bright_black(), status_label);
        println!(
            "    {} {}",
            "Created:".bright_black(),
            fmt_ts(entry.timing.created)
        );
        println!(
            "    {} type={}, label={}, location={}, empty={}, external={}",
            "Meta:".bright_black(),
            entry.provider_type,
            entry.provider_label,
            entry.initial_location,
            entry.is_empty,
            entry.is_external,
        );
        println!(
            "    {} {}",
            "Last state:".bright_black(),
            match entry.last_response_state {
                0 => "Pending",
                1 => "Complete",
                2 => "Cancelled",
                3 => "Failed",
                4 => "NeedsInput",
                _ => "Unknown",
            }
        );
        println!();
    }

    // State cache
    println!(
        "\n  {} ({} entries)\n",
        "State Cache (agentSessions.state.cache)".bold().underline(),
        state_cache.len()
    );

    for entry in &state_cache {
        let session_id =
            session_id_from_resource_uri(&entry.resource).unwrap_or_else(|| entry.resource.clone());
        let read_ts = entry.read.map(fmt_ts).unwrap_or("(never)".to_string());

        // Check if this session is in the model cache
        let in_model = model_cache.iter().any(|m| m.resource == entry.resource);

        let model_marker = if in_model {
            "✓".green().to_string()
        } else {
            "✗".red().to_string()
        };

        println!(
            "  {} {}  {} {}  {} {}",
            "ID:".bright_black(),
            session_id.yellow(),
            "Read:".bright_black(),
            read_ts,
            "In model cache:".bright_black(),
            model_marker,
        );
    }

    println!();
    Ok(())
}

/// `ironbridge inspect validate` — Validate session files on disk (format, size, parse).
pub fn inspect_validate(path: Option<&str>, workspace_id: Option<&str>, json: bool) -> Result<()> {
    let (ws_hash, db_path) = resolve(path, workspace_id)?;
    let storage_path = get_workspace_storage_path()?;
    let chat_dir = storage_path.join(&ws_hash).join("chatSessions");

    if !json {
        println!(
            "\n  {} {} ({})\n",
            "Workspace:".bold(),
            ws_hash.cyan(),
            db_path.display()
        );
    }

    let index = read_chat_session_index(&db_path)?;

    if !chat_dir.exists() {
        if json {
            println!(
                "{}",
                serde_json::to_string_pretty(&serde_json::json!({
                    "workspace": ws_hash,
                    "chatDir": chat_dir.display().to_string(),
                    "exists": false,
                    "sessions": [],
                }))?
            );
        } else {
            println!(
                "  {} chatSessions directory does not exist: {}",
                "✗".red(),
                chat_dir.display()
            );
        }
        return Ok(());
    }

    // Collect all session files on disk
    let mut disk_files: std::collections::HashMap<String, PathBuf> =
        std::collections::HashMap::new();
    if let Ok(entries) = std::fs::read_dir(&chat_dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                let ext = p
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_string();
                if ext == "json" || ext == "jsonl" {
                    if let Some(stem) = p.file_stem().and_then(|s| s.to_str()) {
                        disk_files.insert(stem.to_string(), p.clone());
                    }
                }
            }
        }
    }

    let mut results: Vec<serde_json::Value> = Vec::new();
    let mut pass_count = 0usize;
    let mut warn_count = 0usize;
    let mut fail_count = 0usize;

    // Validate indexed sessions
    let mut indexed_ids: Vec<String> = index.entries.keys().cloned().collect();
    indexed_ids.sort();

    for session_id in &indexed_ids {
        let entry = &index.entries[session_id];
        let file_path = disk_files.remove(session_id);

        let (status, issues) =
            validate_session_file(session_id, entry, file_path.as_deref(), &chat_dir);

        match status {
            ValidationStatus::Pass => pass_count += 1,
            ValidationStatus::Warn => warn_count += 1,
            ValidationStatus::Fail => fail_count += 1,
        }

        if json {
            results.push(serde_json::json!({
                "sessionId": session_id,
                "title": entry.title,
                "indexed": true,
                "status": format!("{:?}", status),
                "issues": issues,
                "file": file_path.map(|p| p.display().to_string()),
            }));
        } else {
            let icon = match status {
                ValidationStatus::Pass => "✓".green(),
                ValidationStatus::Warn => "⚠".yellow(),
                ValidationStatus::Fail => "✗".red(),
            };

            let title = if entry.title.chars().count() > 50 {
                crate::text::truncate(&entry.title, 50)
            } else {
                entry.title.clone()
            };

            println!(
                "  {} {} {}",
                icon,
                session_id.yellow(),
                title.bright_black()
            );
            for issue in &issues {
                println!("      {} {}", "→".bright_black(), issue);
            }
        }
    }

    // Check for orphaned files (on disk but not in index)
    let mut orphaned: Vec<(String, PathBuf)> = disk_files.into_iter().collect();
    orphaned.sort_by(|a, b| a.0.cmp(&b.0));

    if !orphaned.is_empty() {
        if !json {
            println!(
                "\n  {} ({} files)\n",
                "Orphaned Files (on disk but not in index)"
                    .bold()
                    .underline(),
                orphaned.len()
            );
        }

        for (stem, file_path) in &orphaned {
            let size = std::fs::metadata(file_path).map(|m| m.len()).unwrap_or(0);

            let (format_str, parse_ok) = match std::fs::read_to_string(file_path) {
                Ok(content) => {
                    let info = detect_session_format(&content);
                    let fmt = match info.format {
                        VsCodeSessionFormat::JsonLines => "JSONL",
                        VsCodeSessionFormat::LegacyJson => "JSON",
                    };
                    let parse_ok = parse_session_auto(&content).is_ok();
                    (fmt.to_string(), parse_ok)
                }
                Err(_) => ("unreadable".to_string(), false),
            };

            warn_count += 1;

            if json {
                results.push(serde_json::json!({
                    "sessionId": stem,
                    "indexed": false,
                    "status": "Warn",
                    "issues": ["Orphaned: file exists but not in index"],
                    "file": file_path.display().to_string(),
                    "size": size,
                    "format": format_str,
                    "parseable": parse_ok,
                }));
            } else {
                let parse_icon = if parse_ok {
                    "parseable".green()
                } else {
                    "CORRUPT".red()
                };
                println!(
                    "  {} {} {} ({} bytes, {}, {})",
                    "⚠".yellow(),
                    stem.yellow(),
                    "orphaned".bright_black(),
                    size,
                    format_str,
                    parse_icon,
                );
            }
        }
    }

    // Check for backup and corrupt files
    let mut special_files: Vec<(String, String, u64)> = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&chat_dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                let name = p
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                if name.ends_with(".backup") || name.ends_with(".corrupt") {
                    let size = p.metadata().map(|m| m.len()).unwrap_or(0);
                    special_files.push((name, p.display().to_string(), size));
                }
            }
        }
    }

    if !special_files.is_empty() && !json {
        special_files.sort();
        println!(
            "\n  {} ({} files)\n",
            "Backup/Corrupt Files".bold().underline(),
            special_files.len()
        );
        for (name, _path, size) in &special_files {
            let icon = if name.ends_with(".backup") {
                "📦".to_string()
            } else {
                "⚠".to_string()
            };
            println!("  {} {} ({} bytes)", icon, name.bright_black(), size);
        }
    }

    // Summary
    if json {
        let output = serde_json::json!({
            "workspace": ws_hash,
            "chatDir": chat_dir.display().to_string(),
            "exists": true,
            "summary": {
                "pass": pass_count,
                "warn": warn_count,
                "fail": fail_count,
            },
            "sessions": results,
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        println!(
            "\n  {} {} passed, {} warnings, {} failures\n",
            "Summary:".bold(),
            pass_count.to_string().green(),
            warn_count.to_string().yellow(),
            fail_count.to_string().red(),
        );
    }

    Ok(())
}

#[derive(Debug)]
enum ValidationStatus {
    Pass,
    Warn,
    Fail,
}

fn validate_session_file(
    session_id: &str,
    _entry: &crate::models::ChatSessionIndexEntry,
    file_path: Option<&Path>,
    chat_dir: &Path,
) -> (ValidationStatus, Vec<String>) {
    let mut issues: Vec<String> = Vec::new();

    // 1. Check file existence
    let file_path = match file_path {
        Some(p) => p.to_path_buf(),
        None => {
            // Try both extensions
            let jsonl = chat_dir.join(format!("{}.jsonl", session_id));
            let json = chat_dir.join(format!("{}.json", session_id));
            if jsonl.exists() {
                jsonl
            } else if json.exists() {
                json
            } else {
                issues.push("File MISSING: no .jsonl or .json found on disk".to_string());
                return (ValidationStatus::Fail, issues);
            }
        }
    };

    // 2. Check file size
    let size = match std::fs::metadata(&file_path) {
        Ok(m) => m.len(),
        Err(e) => {
            issues.push(format!("Cannot read metadata: {}", e));
            return (ValidationStatus::Fail, issues);
        }
    };

    if size == 0 {
        issues.push("File is EMPTY (0 bytes)".to_string());
        return (ValidationStatus::Fail, issues);
    }

    if size < 500 {
        issues.push(format!(
            "File is a STUB ({} bytes) — likely replaced by VS Code shutdown",
            size
        ));
        // Check if backup exists
        let backup = PathBuf::from(format!("{}.backup", file_path.display()));
        if backup.exists() {
            let backup_size = std::fs::metadata(&backup).map(|m| m.len()).unwrap_or(0);
            issues.push(format!(
                "Backup exists ({} bytes) — recoverable with 'ironbridge register repair'",
                backup_size
            ));
        }
        return (ValidationStatus::Warn, issues);
    }

    // 3. Read and detect format
    let content = match std::fs::read_to_string(&file_path) {
        Ok(c) => c,
        Err(e) => {
            issues.push(format!("Cannot read file: {}", e));
            return (ValidationStatus::Fail, issues);
        }
    };

    let format_info = detect_session_format(&content);
    let ext = file_path.extension().and_then(|e| e.to_str()).unwrap_or("");

    // Check extension vs content format mismatch
    let expected_format = match ext {
        "jsonl" => VsCodeSessionFormat::JsonLines,
        "json" => VsCodeSessionFormat::LegacyJson,
        _ => format_info.format,
    };

    if format_info.format != expected_format {
        issues.push(format!(
            "Format mismatch: extension is .{} but content is {:?}",
            ext, format_info.format
        ));
    }

    // 4. Try parsing
    match parse_session_auto(&content) {
        Ok((session, _info)) => {
            let req_count = session.requests.len();
            if req_count == 0 {
                issues.push("Session parses OK but has 0 requests (empty)".to_string());
            }

            // Report format details
            if format_info.confidence < 0.5 {
                issues.push(format!(
                    "Low confidence format detection ({:.0}%, method: {})",
                    format_info.confidence * 100.0,
                    format_info.detection_method
                ));
            }

            if issues.is_empty() {
                // All good — include brief info
                issues.push(format!(
                    "{:?}, {}, {} requests, {} bytes",
                    format_info.format, format_info.schema_version, req_count, size,
                ));
                (ValidationStatus::Pass, issues)
            } else {
                (ValidationStatus::Warn, issues)
            }
        }
        Err(e) => {
            issues.push(format!("Parse FAILED: {}", e));
            (ValidationStatus::Fail, issues)
        }
    }
}

/// `ironbridge inspect keys` — List all session-related keys in state.vscdb with sizes.
pub fn inspect_keys(
    path: Option<&str>,
    workspace_id: Option<&str>,
    all: bool,
    json: bool,
) -> Result<()> {
    let (ws_hash, db_path) = resolve(path, workspace_id)?;

    let conn = Connection::open(&db_path)?;

    // Session-related key patterns
    let session_patterns = [
        "chat.",
        "memento/interactive-session",
        "agentSessions.",
        "chatEditingSessions.",
        "workbench.panel.chat",
    ];

    let query = if all {
        "SELECT key, length(value) as size FROM ItemTable ORDER BY key".to_string()
    } else {
        // Build WHERE clause for session patterns
        let clauses: Vec<String> = session_patterns
            .iter()
            .map(|p| format!("key LIKE '{}%'", p))
            .collect();
        format!(
            "SELECT key, length(value) as size FROM ItemTable WHERE {} ORDER BY key",
            clauses.join(" OR ")
        )
    };

    let mut stmt = conn.prepare(&query)?;
    let rows: Vec<(String, i64)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
        .filter_map(|r| r.ok())
        .collect();

    if json {
        let entries: Vec<serde_json::Value> = rows
            .iter()
            .map(|(key, size)| {
                serde_json::json!({
                    "key": key,
                    "size": size,
                })
            })
            .collect();
        let output = serde_json::json!({
            "workspace": ws_hash,
            "dbPath": db_path.display().to_string(),
            "keys": entries,
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
        return Ok(());
    }

    println!(
        "\n  {} {} ({})\n",
        "Workspace:".bold(),
        ws_hash.cyan(),
        db_path.display()
    );

    let qualifier = if all { "All" } else { "Session-related" };
    println!(
        "  {} ({} keys)\n",
        format!("{} Keys in state.vscdb", qualifier)
            .bold()
            .underline(),
        rows.len()
    );

    for (key, size) in &rows {
        let size_str = if *size > 1024 * 1024 {
            format!("{:.1} MB", *size as f64 / 1024.0 / 1024.0)
        } else if *size > 1024 {
            format!("{:.1} KB", *size as f64 / 1024.0)
        } else {
            format!("{} B", size)
        };

        println!(
            "  {} {} ({})",
            "•".bright_black(),
            key.cyan(),
            size_str.bright_black()
        );
    }

    println!();
    Ok(())
}

/// `ironbridge inspect files` — List all files in the chatSessions directory with details.
pub fn inspect_files(path: Option<&str>, workspace_id: Option<&str>, json: bool) -> Result<()> {
    let (ws_hash, _db_path) = resolve(path, workspace_id)?;
    let storage_path = get_workspace_storage_path()?;
    let chat_dir = storage_path.join(&ws_hash).join("chatSessions");

    if !chat_dir.exists() {
        if json {
            println!(
                "{}",
                serde_json::to_string_pretty(&serde_json::json!({
                    "workspace": ws_hash,
                    "chatDir": chat_dir.display().to_string(),
                    "exists": false,
                    "files": [],
                }))?
            );
        } else {
            println!(
                "\n  {} chatSessions directory does not exist: {}\n",
                "✗".red(),
                chat_dir.display()
            );
        }
        return Ok(());
    }

    let mut files: Vec<(String, u64, String)> = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&chat_dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                let name = p
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                let size = p.metadata().map(|m| m.len()).unwrap_or(0);

                // Detect format for session files
                let format_str = if name.ends_with(".json") || name.ends_with(".jsonl") {
                    match std::fs::read_to_string(&p) {
                        Ok(content) => {
                            let info = detect_session_format(&content);
                            format!(
                                "{:?} {} ({:.0}%)",
                                info.format,
                                info.schema_version,
                                info.confidence * 100.0
                            )
                        }
                        Err(_) => "unreadable".to_string(),
                    }
                } else {
                    let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("unknown");
                    ext.to_string()
                };

                files.push((name, size, format_str));
            }
        }
    }

    files.sort_by(|a, b| a.0.cmp(&b.0));

    if json {
        let entries: Vec<serde_json::Value> = files
            .iter()
            .map(|(name, size, format)| {
                serde_json::json!({
                    "name": name,
                    "size": size,
                    "format": format,
                })
            })
            .collect();
        let output = serde_json::json!({
            "workspace": ws_hash,
            "chatDir": chat_dir.display().to_string(),
            "exists": true,
            "fileCount": files.len(),
            "files": entries,
        });
        println!("{}", serde_json::to_string_pretty(&output)?);
        return Ok(());
    }

    println!(
        "\n  {} {} ({})\n",
        "Workspace:".bold(),
        ws_hash.cyan(),
        chat_dir.display()
    );
    println!(
        "  {} ({} files)\n",
        "chatSessions Directory".bold().underline(),
        files.len()
    );

    let mut total_size: u64 = 0;
    for (name, size, format) in &files {
        total_size += size;
        let size_str = if *size > 1024 * 1024 {
            format!("{:.1} MB", *size as f64 / 1024.0 / 1024.0)
        } else if *size > 1024 {
            format!("{:.1} KB", *size as f64 / 1024.0)
        } else {
            format!("{} B", size)
        };

        let stub_marker = if *size < 500 && (name.ends_with(".json") || name.ends_with(".jsonl")) {
            " STUB".red().to_string()
        } else {
            String::new()
        };

        println!(
            "  {} ({}, {}){}",
            name.cyan(),
            size_str.bright_black(),
            format.bright_black(),
            stub_marker,
        );
    }

    let total_str = if total_size > 1024 * 1024 {
        format!("{:.1} MB", total_size as f64 / 1024.0 / 1024.0)
    } else if total_size > 1024 {
        format!("{:.1} KB", total_size as f64 / 1024.0)
    } else {
        format!("{} B", total_size)
    };

    println!("\n  {} {}\n", "Total size:".bold(), total_str);

    Ok(())
}

// ── Rebuild ────────────────────────────────────────────────────────────────

/// `ironbridge inspect rebuild` — Rebuild session index and model cache from files
/// on disk. Scans chatSessions/, parses each session file, builds the index
/// with full metadata (title, timestamps, request count), overwrites
/// `chat.ChatSessionStore.index` and `agentSessions.model.cache`, cleans up
/// `agentSessions.state.cache`, and fixes the active-session memento.
pub fn inspect_rebuild(
    path: Option<&str>,
    workspace_id: Option<&str>,
    dry_run: bool,
    json: bool,
) -> Result<()> {
    let (ws_hash, db_path) = resolve(path, workspace_id)?;

    // Locate chatSessions directory
    let ws_storage = get_workspace_storage_path()?;
    let chat_dir = ws_storage.join(&ws_hash).join("chatSessions");

    if !chat_dir.exists() {
        if json {
            println!("{{\"error\": \"no chatSessions directory\"}}");
        } else {
            println!(
                "\n  {} No chatSessions directory found for workspace {}",
                "ERROR:".red().bold(),
                ws_hash.cyan()
            );
        }
        return Ok(());
    }

    // Read current state for comparison
    let old_index = read_chat_session_index(&db_path).unwrap_or_default();
    let old_model_cache = read_model_cache(&db_path).unwrap_or_default();

    // Scan session files on disk (prefer .jsonl over .json for same session ID)
    let mut session_files: std::collections::HashMap<String, PathBuf> =
        std::collections::HashMap::new();
    for entry in std::fs::read_dir(&chat_dir)? {
        let entry = entry?;
        let p = entry.path();
        if !p.is_file() {
            continue;
        }
        let ext = p
            .extension()
            .map(|e| e.to_string_lossy().to_string())
            .unwrap_or_default();
        if !is_session_file_extension(std::ffi::OsStr::new(&ext)) {
            continue;
        }
        // Skip backup/recovery files
        let fname = p
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        if fname.contains(".bak") || fname.contains(".pre-restore") || fname.contains(".pre_bak") {
            continue;
        }
        if let Some(stem) = p.file_stem() {
            let stem_str = stem.to_string_lossy().to_string();
            let is_jsonl = ext == "jsonl";
            if !session_files.contains_key(&stem_str) || is_jsonl {
                session_files.insert(stem_str, p);
            }
        }
    }

    // Parse each session file and build index entries
    let mut sessions: Vec<SessionInfo> = Vec::new();
    let mut skipped: Vec<(String, String)> = Vec::new(); // (filename, reason)

    for (stem, fpath) in &session_files {
        let size = std::fs::metadata(fpath).map(|m| m.len()).unwrap_or(0);

        match parse_session_file(fpath) {
            Ok(session) => {
                let session_id = session.session_id.clone().unwrap_or_else(|| stem.clone());
                let title = session.title();
                let is_empty = session.is_empty();
                let request_count = session.requests.len();
                let created = session.creation_date;
                let last_message_date = session.last_message_date;
                let fname = fpath
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();

                sessions.push(SessionInfo {
                    session_id,
                    title,
                    request_count,
                    is_empty,
                    created,
                    last_message_date,
                    file: fname,
                    size,
                });
            }
            Err(e) => {
                let fname = fpath
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                skipped.push((fname, e.to_string()));
            }
        }
    }

    // Sort by last_message_date descending (most recent first)
    sessions.sort_by_key(|s| std::cmp::Reverse(s.last_message_date));

    let non_empty: Vec<&SessionInfo> = sessions.iter().filter(|s| !s.is_empty).collect();
    let empty: Vec<&SessionInfo> = sessions.iter().filter(|s| s.is_empty).collect();

    if json {
        // JSON output
        #[derive(serde::Serialize)]
        struct RebuildResult {
            workspace: String,
            dry_run: bool,
            sessions_total: usize,
            sessions_non_empty: usize,
            sessions_empty: usize,
            sessions_skipped: usize,
            old_index_count: usize,
            old_model_cache_count: usize,
            new_index_count: usize,
            new_model_cache_count: usize,
            sessions: Vec<SessionSummary>,
            skipped: Vec<SkippedFile>,
        }
        #[derive(serde::Serialize)]
        struct SessionSummary {
            session_id: String,
            title: String,
            requests: usize,
            is_empty: bool,
            created: i64,
            last_message_date: i64,
            file: String,
            size: u64,
        }
        #[derive(serde::Serialize)]
        struct SkippedFile {
            file: String,
            reason: String,
        }

        let result = RebuildResult {
            workspace: ws_hash.clone(),
            dry_run,
            sessions_total: sessions.len(),
            sessions_non_empty: non_empty.len(),
            sessions_empty: empty.len(),
            sessions_skipped: skipped.len(),
            old_index_count: old_index.entries.len(),
            old_model_cache_count: old_model_cache.len(),
            new_index_count: sessions.len(),
            new_model_cache_count: non_empty.len(),
            sessions: sessions
                .iter()
                .map(|s| SessionSummary {
                    session_id: s.session_id.clone(),
                    title: s.title.clone(),
                    requests: s.request_count,
                    is_empty: s.is_empty,
                    created: s.created,
                    last_message_date: s.last_message_date,
                    file: s.file.clone(),
                    size: s.size,
                })
                .collect(),
            skipped: skipped
                .iter()
                .map(|(f, r)| SkippedFile {
                    file: f.clone(),
                    reason: r.clone(),
                })
                .collect(),
        };

        println!("{}", serde_json::to_string_pretty(&result)?);

        if !dry_run {
            // Build and write (same logic as below, just no text output)
            let (new_index, valid_ids) = build_index_from_sessions(&sessions);
            write_chat_session_index(&db_path, &new_index)?;
            rebuild_model_cache(&db_path, &new_index)?;
            cleanup_state_cache(&db_path, &valid_ids)?;
            let preferred = preferred_session_id(&new_index);
            let _ = fix_session_memento(&db_path, &valid_ids, preferred.as_deref());
        }

        return Ok(());
    }

    // Text output
    println!(
        "\n  {} {} ({})\n",
        "Workspace:".bold(),
        ws_hash.cyan(),
        db_path.display()
    );

    // Current state summary
    println!("  {}", "Current State".bold().underline());
    println!(
        "  Index:       {} entries",
        old_index.entries.len().to_string().cyan()
    );
    println!(
        "  Model cache: {} entries",
        old_model_cache.len().to_string().cyan()
    );
    println!();

    // Session scan results
    println!("  {}", "Scanned Sessions".bold().underline());
    for s in &sessions {
        let status = if s.is_empty {
            "\u{26A0}".yellow() // ⚠
        } else {
            "\u{2714}".green() // ✔
        };
        let title_display = if s.title.chars().count() > 50 {
            crate::text::truncate(&s.title, 50)
        } else {
            s.title.clone()
        };
        let size_str = if s.size > 1024 * 1024 {
            format!("{:.1} MB", s.size as f64 / 1024.0 / 1024.0)
        } else if s.size > 1024 {
            format!("{:.1} KB", s.size as f64 / 1024.0)
        } else {
            format!("{} B", s.size)
        };
        println!(
            "  {} {} ({} req, {}) \"{}\"",
            status,
            s.session_id[..12.min(s.session_id.len())].bright_black(),
            s.request_count.to_string().cyan(),
            size_str.bright_black(),
            title_display
        );
    }

    if !skipped.is_empty() {
        println!();
        for (fname, reason) in &skipped {
            println!(
                "  {} {} — {}",
                "\u{2717}".red(), // ✗
                fname.bright_black(),
                reason.bright_black()
            );
        }
    }

    println!();
    println!("  {}", "Rebuild Plan".bold().underline());
    println!(
        "  Index:       {} → {} entries",
        old_index.entries.len().to_string().bright_black(),
        sessions.len().to_string().green()
    );
    println!(
        "  Model cache: {} → {} entries (non-empty sessions)",
        old_model_cache.len().to_string().bright_black(),
        non_empty.len().to_string().green()
    );

    if dry_run {
        println!(
            "\n  {} Dry run — no changes written.\n",
            "[DRY RUN]".yellow().bold()
        );
        return Ok(());
    }

    // Build new index
    let (new_index, valid_ids) = build_index_from_sessions(&sessions);

    // Write index
    write_chat_session_index(&db_path, &new_index)?;

    // Rebuild model cache from the new index
    let model_count = rebuild_model_cache(&db_path, &new_index)?;

    // Cleanup state cache
    let state_removed = cleanup_state_cache(&db_path, &valid_ids).unwrap_or(0);

    // Fix memento
    let preferred = preferred_session_id(&new_index);
    let memento_fixed =
        fix_session_memento(&db_path, &valid_ids, preferred.as_deref()).unwrap_or(false);

    println!();
    println!("  {}", "Results".bold().underline());
    println!(
        "  {} Index written: {} entries",
        "\u{2714}".green(),
        new_index.entries.len().to_string().cyan()
    );
    println!(
        "  {} Model cache rebuilt: {} entries",
        "\u{2714}".green(),
        model_count.to_string().cyan()
    );
    if state_removed > 0 {
        println!(
            "  {} State cache: removed {} stale entries",
            "\u{2714}".green(),
            state_removed.to_string().cyan()
        );
    }
    if memento_fixed {
        println!(
            "  {} Memento updated → {}",
            "\u{2714}".green(),
            preferred.as_deref().unwrap_or("(first valid)").cyan()
        );
    }

    println!(
        "\n  {} If VS Code is open, {} it (Alt+F4) and reopen the project.\n",
        "NOTE:".yellow().bold(),
        "quit".bold()
    );

    Ok(())
}

/// Build a `ChatSessionIndex` from parsed session info.
fn build_index_from_sessions(
    sessions: &[SessionInfo],
) -> (crate::models::ChatSessionIndex, HashSet<String>) {
    let mut entries = HashMap::new();
    let mut valid_ids = HashSet::new();

    for s in sessions {
        valid_ids.insert(s.session_id.clone());
        entries.insert(
            s.session_id.clone(),
            ChatSessionIndexEntry {
                session_id: s.session_id.clone(),
                title: s.title.clone(),
                last_message_date: s.last_message_date,
                timing: Some(ChatSessionTiming {
                    created: s.created,
                    last_request_started: Some(s.last_message_date),
                    last_request_ended: Some(s.last_message_date),
                }),
                last_response_state: 1,
                initial_location: "panel".to_string(),
                is_empty: s.is_empty,
                is_imported: Some(false),
                has_pending_edits: Some(false),
                is_external: Some(false),
            },
        );
    }

    (
        crate::models::ChatSessionIndex {
            version: 1,
            entries,
        },
        valid_ids,
    )
}

/// Find the most recently active non-empty session ID from an index.
fn preferred_session_id(index: &crate::models::ChatSessionIndex) -> Option<String> {
    index
        .entries
        .iter()
        .filter(|(_, e)| !e.is_empty)
        .max_by_key(|(_, e)| e.last_message_date)
        .map(|(id, _)| id.clone())
}

// Private helper struct used by inspect_rebuild (not part of models.rs since
// it's purely internal to the rebuild flow).
#[derive(serde::Serialize)]
struct SessionInfo {
    session_id: String,
    title: String,
    request_count: usize,
    is_empty: bool,
    created: i64,
    last_message_date: i64,
    file: String,
    size: u64,
}
