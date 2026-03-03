// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only
//! Session Recovery Commands
//!
//! This module provides commands for recovering lost, corrupted, or orphaned
//! chat sessions from various sources including:
//! - Recording API server state
//! - SQLite database backups
//! - Corrupted JSONL files
//! - Orphaned files in workspaceStorage

use anyhow::{Context, Result};
use colored::Colorize;
use std::fs;
use std::path::{Path, PathBuf};

use crate::storage::{
    detect_session_format, is_vscode_running, parse_session_auto, recover_from_jsonl_bak,
    VsCodeSessionFormat,
};
use crate::workspace::{discover_workspaces, normalize_path};

/// Get workspace storage path for a provider
fn get_provider_storage_path(provider: &str) -> Option<PathBuf> {
    let base = match std::env::consts::OS {
        "windows" => std::env::var("APPDATA").ok().map(PathBuf::from),
        "macos" => dirs::home_dir().map(|p| p.join("Library/Application Support")),
        _ => dirs::home_dir().map(|p| p.join(".config")),
    }?;

    let path = match provider {
        "vscode" => base.join("Code/User/workspaceStorage"),
        "cursor" => base.join("Cursor/User/workspaceStorage"),
        _ => return None,
    };

    if path.exists() {
        Some(path)
    } else {
        None
    }
}

/// Get state database path for a provider
fn get_provider_state_db(provider: &str) -> Option<PathBuf> {
    let base = match std::env::consts::OS {
        "windows" => std::env::var("APPDATA").ok().map(PathBuf::from),
        "macos" => dirs::home_dir().map(|p| p.join("Library/Application Support")),
        _ => dirs::home_dir().map(|p| p.join(".config")),
    }?;

    let path = match provider {
        "vscode" => base.join("Code/User/globalStorage/state.vscdb"),
        "cursor" => base.join("Cursor/User/globalStorage/state.vscdb"),
        _ => return None,
    };

    if path.exists() {
        Some(path)
    } else {
        None
    }
}

/// Get copilot chat history path
fn get_copilot_history_path(provider: &str) -> Option<PathBuf> {
    let base = match std::env::consts::OS {
        "windows" => std::env::var("APPDATA").ok().map(PathBuf::from),
        "macos" => dirs::home_dir().map(|p| p.join("Library/Application Support")),
        _ => dirs::home_dir().map(|p| p.join(".config")),
    }?;

    let path = match provider {
        "vscode" => base.join("Code/User/History/copilot-chat"),
        "cursor" => base.join("Cursor/User/History"),
        _ => return None,
    };

    if path.exists() {
        Some(path)
    } else {
        None
    }
}

/// Scan for recoverable sessions from various sources
pub fn recover_scan(provider: &str, verbose: bool, _include_old: bool) -> Result<()> {
    println!("╔═══════════════════════════════════════════════════════════════════╗");
    println!("║               Session Recovery Scanner v1.3.2                     ║");
    println!("╚═══════════════════════════════════════════════════════════════════╝\n");

    let providers_to_scan = if provider == "all" {
        vec!["vscode", "cursor"]
    } else {
        vec![provider]
    };

    let mut total_recoverable = 0;
    let mut total_corrupted = 0;

    for prov in &providers_to_scan {
        println!("[*] Scanning {} workspaces...", prov);

        // Scan workspace storage
        if let Some(storage_path) = get_provider_storage_path(prov) {
            let mut count = 0;
            if let Ok(entries) = fs::read_dir(&storage_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        // Look for session files
                        let sessions_dir = path.join("state.vscdb");
                        let history_dir = path.join("history");

                        if sessions_dir.exists() || history_dir.exists() {
                            count += 1;
                            if verbose {
                                println!("    [+] Found workspace: {}", path.display());
                            }
                        }
                    }
                }
            }
            println!("    Found {} workspace directories", count);
            total_recoverable += count;
        }

        // Scan for JSONL files with parse errors
        if let Some(copilot_path) = get_copilot_history_path(prov) {
            let mut corrupted_count = 0;
            if let Ok(entries) = fs::read_dir(&copilot_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().is_some_and(|e| e == "jsonl") {
                        // Try to parse the file
                        if let Ok(content) = fs::read_to_string(&path) {
                            let lines: Vec<&str> = content.lines().collect();
                            let mut errors = 0;
                            for line in &lines {
                                if !line.is_empty()
                                    && serde_json::from_str::<serde_json::Value>(line).is_err()
                                {
                                    errors += 1;
                                }
                            }
                            if errors > 0 {
                                corrupted_count += 1;
                                if verbose {
                                    println!(
                                        "    [!] Corrupted JSONL: {} ({} bad lines)",
                                        path.display(),
                                        errors
                                    );
                                }
                            }
                        }
                    }
                }
            }
            if corrupted_count > 0 {
                println!(
                    "    Found {} potentially corrupted JSONL files",
                    corrupted_count
                );
                total_corrupted += corrupted_count;
            }
        }
    }

    println!();
    println!("╔═══════════════════════════════════════════════════════════════════╗");
    println!("║                       Recovery Summary                            ║");
    println!("╠═══════════════════════════════════════════════════════════════════╣");
    println!(
        "║  Workspace directories found: {:>5}                              ║",
        total_recoverable
    );
    println!(
        "║  Corrupted files:             {:>5}                              ║",
        total_corrupted
    );
    println!("╚═══════════════════════════════════════════════════════════════════╝");

    if total_corrupted > 0 {
        println!();
        println!("[i] Use 'chasm recover jsonl <file>' to attempt repair of corrupted files");
    }

    Ok(())
}

/// Recover sessions from the recording API server
pub fn recover_from_recording(
    server: &str,
    session_id: Option<&str>,
    output: Option<&str>,
) -> Result<()> {
    println!("[*] Connecting to recording server: {}", server);

    // Build the recovery URL
    let url = if let Some(sid) = session_id {
        format!("{}/recording/session/{}/recovery", server, sid)
    } else {
        format!("{}/recording/sessions", server)
    };

    // Make HTTP request using blocking reqwest
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;

    let response = client
        .get(&url)
        .send()
        .context("Failed to connect to recording server")?;

    if !response.status().is_success() {
        anyhow::bail!("Server returned error: {}", response.status());
    }

    let body = response.text()?;

    if let Some(sid) = session_id {
        // Single session recovery
        let output_path = output
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(format!("{}_recovered.json", sid)));

        fs::write(&output_path, &body)?;
        println!("[+] Recovered session saved to: {}", output_path.display());
    } else {
        // List all sessions
        let sessions: serde_json::Value = serde_json::from_str(&body)?;

        if let Some(arr) = sessions.get("active_sessions").and_then(|v| v.as_array()) {
            println!();
            println!("╔═══════════════════════════════════════════════════════════════════╗");
            println!("║                    Active Recording Sessions                      ║");
            println!("╠═══════════════════════════════════════════════════════════════════╣");

            for session in arr {
                let id = session
                    .get("session_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("?");
                let provider = session
                    .get("provider")
                    .and_then(|v| v.as_str())
                    .unwrap_or("?");
                let msgs = session
                    .get("message_count")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                let title = session
                    .get("title")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Untitled");

                println!(
                    "║ {:36} {:10} {:>4} msgs  ║",
                    &id[..id.len().min(36)],
                    provider,
                    msgs
                );
                if title != "Untitled" {
                    println!(
                        "║   └─ {}{}║",
                        &title[..title.len().min(55)],
                        " ".repeat(55 - title.len().min(55))
                    );
                }
            }

            println!("╚═══════════════════════════════════════════════════════════════════╝");
            println!();
            println!(
                "[i] Use 'chasm recover recording --session <ID>' to recover a specific session"
            );
        } else {
            println!("[!] No active sessions found on recording server");
        }
    }

    Ok(())
}

/// Recover sessions from a SQLite database backup
pub fn recover_from_database(
    backup_path: &str,
    session_id: Option<&str>,
    output: Option<&str>,
    format: &str,
) -> Result<()> {
    println!("[*] Opening database backup: {}", backup_path);

    let conn = rusqlite::Connection::open(backup_path)?;

    // Check for sessions table
    let table_exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='sessions')",
        [],
        |row| row.get(0),
    )?;

    if !table_exists {
        // Try VS Code state.vscdb format
        let state_format: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='ItemTable')",
            [],
            |row| row.get(0),
        )?;

        if state_format {
            return recover_from_vscdb(&conn, session_id, output, format);
        }

        anyhow::bail!("Database does not contain recognized session tables");
    }

    // Query sessions
    let query = if let Some(sid) = session_id {
        format!(
            "SELECT id, title, provider, created_at, data FROM sessions WHERE id = '{}'",
            sid
        )
    } else {
        "SELECT id, title, provider, created_at, data FROM sessions ORDER BY created_at DESC LIMIT 50".to_string()
    };

    let mut stmt = conn.prepare(&query)?;
    let sessions: Vec<(String, String, String, String, String)> = stmt
        .query_map([], |row| {
            Ok((
                row.get(0)?,
                row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                row.get::<_, Option<String>>(4)?.unwrap_or_default(),
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    if sessions.is_empty() {
        println!("[!] No sessions found in database");
        return Ok(());
    }

    if let Some(sid) = session_id {
        // Export single session
        let session = &sessions[0];
        let output_path = output
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(format!("{}_recovered.{}", sid, format)));

        let content = match format {
            "json" => session.4.clone(),
            "jsonl" => session.4.lines().collect::<Vec<_>>().join("\n"),
            _ => session.4.clone(),
        };

        fs::write(&output_path, content)?;
        println!("[+] Session recovered to: {}", output_path.display());
    } else {
        // List sessions
        println!();
        println!("╔═══════════════════════════════════════════════════════════════════╗");
        println!("║                    Sessions in Database Backup                    ║");
        println!("╠═══════════════════════════════════════════════════════════════════╣");

        for (id, title, provider, created, _) in &sessions {
            let title_display = if title.is_empty() { "Untitled" } else { title };
            println!(
                "║ {:36} {:10} {:16}  ║",
                &id[..id.len().min(36)],
                &provider[..provider.len().min(10)],
                &created[..created.len().min(16)]
            );
            if !title.is_empty() {
                println!(
                    "║   └─ {}{}║",
                    &title_display[..title_display.len().min(55)],
                    " ".repeat(55 - title_display.len().min(55))
                );
            }
        }

        println!("╚═══════════════════════════════════════════════════════════════════╝");
        println!();
        println!(
            "[i] Use 'chasm recover database {} --session <ID>' to export a session",
            backup_path
        );
    }

    Ok(())
}

/// Recover from VS Code state.vscdb format
fn recover_from_vscdb(
    conn: &rusqlite::Connection,
    _session_id: Option<&str>,
    output: Option<&str>,
    _format: &str,
) -> Result<()> {
    println!("[*] Detected VS Code state.vscdb format");

    // Query for chat history keys
    let mut stmt = conn.prepare(
        "SELECT key, value FROM ItemTable WHERE key LIKE '%chat%' OR key LIKE '%copilot%'",
    )?;

    let items: Vec<(String, Vec<u8>)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<Result<Vec<_>, _>>()?;

    if items.is_empty() {
        println!("[!] No chat-related data found in state database");
        return Ok(());
    }

    println!("[+] Found {} chat-related entries", items.len());

    let output_dir = output
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("recovered_vscdb"));
    fs::create_dir_all(&output_dir)?;

    for (key, value) in &items {
        // Try to parse as UTF-8
        if let Ok(text) = String::from_utf8(value.clone()) {
            // Check if it's JSON
            if text.starts_with('{') || text.starts_with('[') {
                let safe_key = key.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
                let output_path = output_dir.join(format!("{}.json", safe_key));
                fs::write(&output_path, &text)?;
                println!("  [+] Extracted: {}", output_path.display());
            }
        }
    }

    println!();
    println!("[+] Recovery output written to: {}", output_dir.display());

    Ok(())
}

/// Recover sessions from corrupted JSONL files
pub fn recover_jsonl(file_path: &str, output: Option<&str>, aggressive: bool) -> Result<()> {
    println!("[*] Attempting to recover JSONL file: {}", file_path);

    let content = fs::read_to_string(file_path)?;
    let lines: Vec<&str> = content.lines().collect();

    let mut recovered_objects: Vec<serde_json::Value> = Vec::new();
    let mut errors = 0;
    let mut recovered = 0;

    for (i, line) in lines.iter().enumerate() {
        if line.is_empty() {
            continue;
        }

        match serde_json::from_str::<serde_json::Value>(line) {
            Ok(obj) => {
                recovered_objects.push(obj);
                recovered += 1;
            }
            Err(e) => {
                errors += 1;
                if aggressive {
                    // Try to fix common issues
                    let fixed = attempt_json_repair(line);
                    if let Ok(obj) = serde_json::from_str::<serde_json::Value>(&fixed) {
                        recovered_objects.push(obj);
                        recovered += 1;
                        println!("  [+] Repaired line {}", i + 1);
                    } else {
                        println!("  [!] Could not repair line {}: {}", i + 1, e);
                    }
                } else {
                    println!("  [!] Error on line {}: {}", i + 1, e);
                }
            }
        }
    }

    println!();
    println!("╔═══════════════════════════════════════════════════════════════════╗");
    println!("║                    JSONL Recovery Summary                         ║");
    println!("╠═══════════════════════════════════════════════════════════════════╣");
    println!(
        "║  Total lines:     {:>5}                                          ║",
        lines.len()
    );
    println!(
        "║  Recovered:       {:>5}                                          ║",
        recovered
    );
    println!(
        "║  Errors:          {:>5}                                          ║",
        errors
    );
    println!("╚═══════════════════════════════════════════════════════════════════╝");

    if recovered > 0 {
        let output_path = output.map(PathBuf::from).unwrap_or_else(|| {
            let p = Path::new(file_path);
            p.with_extension("recovered.jsonl")
        });

        let mut output_content = String::new();
        for obj in &recovered_objects {
            output_content.push_str(&serde_json::to_string(obj)?);
            output_content.push('\n');
        }

        fs::write(&output_path, output_content)?;
        println!();
        println!("[+] Recovered data written to: {}", output_path.display());
    }

    Ok(())
}

/// Attempt to repair malformed JSON
fn attempt_json_repair(line: &str) -> String {
    let mut fixed = line.to_string();

    // Fix unescaped quotes
    // This is a simple heuristic - real repair would need more sophisticated parsing

    // Fix trailing commas
    fixed = fixed.replace(",}", "}").replace(",]", "]");

    // Fix missing closing braces/brackets
    let open_braces = fixed.matches('{').count();
    let close_braces = fixed.matches('}').count();
    if open_braces > close_braces {
        fixed.push_str(&"}".repeat(open_braces - close_braces));
    }

    let open_brackets = fixed.matches('[').count();
    let close_brackets = fixed.matches(']').count();
    if open_brackets > close_brackets {
        fixed.push_str(&"]".repeat(open_brackets - close_brackets));
    }

    fixed
}

/// List orphaned sessions in workspaceStorage
pub fn recover_orphans(provider: &str, unindexed: bool, _verify: bool) -> Result<()> {
    println!("[*] Scanning for orphaned sessions...");

    let providers_to_scan = if provider == "all" {
        vec!["vscode", "cursor"]
    } else {
        vec![provider]
    };

    let mut total_orphans = 0;

    for prov in &providers_to_scan {
        println!("\n[*] Checking {}...", prov);

        if let Some(storage_path) = get_provider_storage_path(prov) {
            // Get list of workspaces from database if checking for unindexed
            let indexed_workspaces: std::collections::HashSet<String> = if unindexed {
                if let Some(db_path) = get_provider_state_db(prov) {
                    if let Ok(conn) = rusqlite::Connection::open(&db_path) {
                        if let Ok(mut stmt) = conn.prepare(
                            "SELECT key FROM ItemTable WHERE key LIKE 'workspaceStorage/%'",
                        ) {
                            stmt.query_map([], |row| row.get::<_, String>(0))
                                .ok()
                                .map(|iter| iter.flatten().collect())
                                .unwrap_or_default()
                        } else {
                            std::collections::HashSet::new()
                        }
                    } else {
                        std::collections::HashSet::new()
                    }
                } else {
                    std::collections::HashSet::new()
                }
            } else {
                std::collections::HashSet::new()
            };

            if let Ok(entries) = fs::read_dir(&storage_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        let dir_name = path
                            .file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string();

                        // Check if this workspace has session data
                        let has_sessions =
                            path.join("state.vscdb").exists() || path.join("history").exists();

                        if !has_sessions {
                            continue;
                        }

                        let is_indexed = !unindexed || indexed_workspaces.contains(&dir_name);

                        if !is_indexed {
                            total_orphans += 1;
                            println!("  [?] Unindexed: {}", dir_name);
                        }
                    }
                }
            }
        }
    }

    println!();
    if total_orphans > 0 {
        println!(
            "[i] Found {} potentially orphaned workspace(s)",
            total_orphans
        );
        println!("[i] Use 'chasm register all' to re-index these workspaces");
    } else {
        println!("[+] No orphaned sessions found");
    }

    Ok(())
}

/// Repair corrupted session files in place
pub fn recover_repair(path: &str, create_backup: bool, dry_run: bool) -> Result<()> {
    use crate::storage::{
        convert_skeleton_json_to_jsonl, fix_cancelled_model_state, is_skeleton_json,
    };

    let path = Path::new(path);

    if dry_run {
        println!("[*] DRY RUN - no changes will be made");
    }

    if path.is_dir() {
        println!(
            "[*] Scanning directory for repairable files: {}",
            path.display()
        );

        let mut repaired = 0;
        let mut skeletons_converted = 0;
        let mut cancelled_fixed = 0;

        for entry in walkdir::WalkDir::new(path).into_iter().flatten() {
            let file_path = entry.path();
            if file_path
                .extension()
                .is_some_and(|e| e == "jsonl" || e == "json")
            {
                if let Ok(content) = fs::read_to_string(file_path) {
                    // Check for skeleton .json files (corrupted, only structural chars remain)
                    if file_path.extension().is_some_and(|e| e == "json")
                        && !file_path.to_string_lossy().ends_with(".bak")
                        && !file_path.to_string_lossy().ends_with(".corrupt")
                    {
                        if is_skeleton_json(&content) {
                            println!(
                                "  [!] Skeleton .json: {} — corrupt, only structural chars",
                                file_path.display()
                            );
                            if !dry_run {
                                match convert_skeleton_json_to_jsonl(file_path, None, None) {
                                    Ok(Some(_)) => {
                                        println!("  [+] Converted to .jsonl, original renamed to .json.corrupt");
                                        skeletons_converted += 1;
                                    }
                                    Ok(None) => {} // Skipped (e.g., .jsonl already exists)
                                    Err(e) => println!("  [!] Failed to convert skeleton: {}", e),
                                }
                            }
                            continue; // Don't try to repair skeleton content
                        }
                    }

                    // Check for corrupted JSON lines
                    let has_corrupt_lines = content.lines().any(|line| {
                        !line.is_empty() && serde_json::from_str::<serde_json::Value>(line).is_err()
                    });

                    // Check for concatenated JSONL (}{"kind": pattern without newlines)
                    let has_concatenated = content.contains("}{\"kind\":");

                    // Check for missing VS Code-required fields in kind:0 lines
                    let missing_fields = if file_path.extension().is_some_and(|e| e == "jsonl") {
                        content
                            .lines()
                            .next()
                            .and_then(|line| serde_json::from_str::<serde_json::Value>(line).ok())
                            .and_then(|obj| {
                                if obj.get("kind")?.as_u64()? == 0 {
                                    let v = obj.get("v")?;
                                    let missing = !v.get("hasPendingEdits").is_some()
                                        || !v.get("pendingRequests").is_some()
                                        || !v.get("inputState").is_some()
                                        || !v.get("sessionId").is_some();
                                    Some(missing)
                                } else {
                                    None
                                }
                            })
                            .unwrap_or(false)
                    } else {
                        false
                    };

                    let needs_repair = has_corrupt_lines || has_concatenated || missing_fields;

                    if needs_repair {
                        let reasons: Vec<&str> = [
                            if has_corrupt_lines {
                                Some("corrupt JSON")
                            } else {
                                None
                            },
                            if has_concatenated {
                                Some("concatenated lines")
                            } else {
                                None
                            },
                            if missing_fields {
                                Some("missing VS Code fields")
                            } else {
                                None
                            },
                        ]
                        .into_iter()
                        .flatten()
                        .collect();

                        println!(
                            "  [!] Needs repair: {} ({})",
                            file_path.display(),
                            reasons.join(", ")
                        );
                        if !dry_run {
                            repair_file(file_path, create_backup)?;
                            repaired += 1;
                        }
                    }

                    // Check for cancelled modelState in JSONL files (after other repairs)
                    if file_path.extension().is_some_and(|e| e == "jsonl") && !dry_run {
                        match fix_cancelled_model_state(file_path) {
                            Ok(true) => {
                                println!(
                                    "  [+] Fixed cancelled modelState: {}",
                                    file_path.display()
                                );
                                cancelled_fixed += 1;
                            }
                            Ok(false) => {}
                            Err(e) => {
                                println!(
                                    "  [!] Failed to fix modelState for {}: {}",
                                    file_path.display(),
                                    e
                                );
                            }
                        }
                    }
                }
            }
        }

        println!();
        if dry_run {
            println!("[i] {} file(s) would be repaired", repaired);
        } else {
            let mut parts = Vec::new();
            if repaired > 0 {
                parts.push(format!("{} repaired", repaired));
            }
            if skeletons_converted > 0 {
                parts.push(format!("{} skeletons converted", skeletons_converted));
            }
            if cancelled_fixed > 0 {
                parts.push(format!("{} cancelled states fixed", cancelled_fixed));
            }
            if parts.is_empty() {
                println!("[+] No issues found");
            } else {
                println!("[+] {}", parts.join(", "));
            }
        }
    } else {
        // Single file
        if !dry_run {
            // Check for skeleton .json first
            if path.extension().is_some_and(|e| e == "json")
                && !path.to_string_lossy().ends_with(".bak")
                && !path.to_string_lossy().ends_with(".corrupt")
            {
                if let Ok(content) = fs::read_to_string(path) {
                    if is_skeleton_json(&content) {
                        match convert_skeleton_json_to_jsonl(path, None, None) {
                            Ok(Some(jsonl_path)) => {
                                println!("[+] Converted skeleton .json → {}", jsonl_path.display());
                                println!("    Original renamed to .json.corrupt");
                                return Ok(());
                            }
                            Ok(None) => println!("[i] Skeleton detected but .jsonl already exists"),
                            Err(e) => println!("[!] Failed to convert skeleton: {}", e),
                        }
                        return Ok(());
                    }
                }
            }

            repair_file(path, create_backup)?;
            println!("[+] File repaired: {}", path.display());

            // Fix cancelled modelState for JSONL files
            if path.extension().is_some_and(|e| e == "jsonl") {
                match fix_cancelled_model_state(path) {
                    Ok(true) => println!("[+] Fixed cancelled modelState"),
                    Ok(false) => {}
                    Err(e) => println!("[!] Failed to fix modelState: {}", e),
                }
            }
        } else {
            println!("[i] Would repair: {}", path.display());
        }
    }

    Ok(())
}

fn repair_file(path: &Path, create_backup: bool) -> Result<()> {
    use crate::storage::{ensure_vscode_compat_fields, split_concatenated_jsonl};

    if create_backup {
        let backup_path = path.with_extension("backup");
        fs::copy(path, &backup_path)?;
    }

    let content = fs::read_to_string(path)?;

    // Pre-process: split concatenated JSON objects that lack newline separators
    let content = if path.extension().is_some_and(|e| e == "jsonl") {
        split_concatenated_jsonl(&content)
    } else {
        content
    };

    let session_id = path
        .file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.to_string());
    let mut output = String::new();

    for line in content.lines() {
        if line.is_empty() {
            output.push('\n');
            continue;
        }

        match serde_json::from_str::<serde_json::Value>(line) {
            Ok(mut parsed) => {
                // For kind:0 lines, ensure all VS Code-required fields are present
                let is_kind_0 = parsed
                    .get("kind")
                    .and_then(|k| k.as_u64())
                    .map(|k| k == 0)
                    .unwrap_or(false);

                if is_kind_0 {
                    if let Some(v) = parsed.get_mut("v") {
                        ensure_vscode_compat_fields(v, session_id.as_deref());
                    }
                    output.push_str(&serde_json::to_string(&parsed).unwrap_or_default());
                } else {
                    output.push_str(line);
                }
                output.push('\n');
            }
            Err(_) => {
                let fixed = attempt_json_repair(line);
                if serde_json::from_str::<serde_json::Value>(&fixed).is_ok() {
                    output.push_str(&fixed);
                    output.push('\n');
                }
                // Skip unrecoverable lines
            }
        }
    }

    fs::write(path, output)?;
    Ok(())
}

/// Show recovery status and recommendations
pub fn recover_status(provider: &str, check_system: bool) -> Result<()> {
    println!("╔═══════════════════════════════════════════════════════════════════╗");
    println!("║                    Recovery Status Report                         ║");
    println!("╚═══════════════════════════════════════════════════════════════════╝\n");

    let providers_to_check = if provider == "all" {
        vec!["vscode", "cursor"]
    } else {
        vec![provider]
    };

    for name in &providers_to_check {
        println!("[*] {} Status:", name.to_uppercase());

        // Check state database
        if let Some(db_path) = get_provider_state_db(name) {
            let size = fs::metadata(&db_path).map(|m| m.len()).unwrap_or(0);
            println!(
                "    Database: {} ({:.1} MB)",
                db_path.display(),
                size as f64 / 1024.0 / 1024.0
            );

            // Check if database is accessible
            match rusqlite::Connection::open(&db_path) {
                Ok(conn) => {
                    if let Ok(count) =
                        conn.query_row::<i64, _, _>("SELECT COUNT(*) FROM ItemTable", [], |r| {
                            r.get(0)
                        })
                    {
                        println!("    Items in database: {}", count);
                    }
                }
                Err(e) => {
                    println!("    [!] Database error: {}", e);
                }
            }
        } else {
            println!("    Database: Not found");
        }

        // Check workspace storage
        if let Some(storage_path) = get_provider_storage_path(name) {
            let count = fs::read_dir(&storage_path).map(|r| r.count()).unwrap_or(0);
            println!("    Workspace folders: {}", count);
        }

        // Check copilot history
        if let Some(history_path) = get_copilot_history_path(name) {
            let count = fs::read_dir(&history_path)
                .map(|r| {
                    r.filter(|e| {
                        e.as_ref()
                            .map(|e| e.path().extension().is_some_and(|ext| ext == "jsonl"))
                            .unwrap_or(false)
                    })
                    .count()
                })
                .unwrap_or(0);
            println!("    JSONL session files: {}", count);
        }

        println!();
    }

    if check_system {
        println!("[*] System Status:");

        // Get available disk space
        #[cfg(windows)]
        {
            // Windows: check C: drive
            if let Ok(output) = std::process::Command::new("wmic")
                .args(["logicaldisk", "get", "freespace,size"])
                .output()
            {
                if let Ok(text) = String::from_utf8(output.stdout) {
                    println!(
                        "    Disk space: {}",
                        text.lines().nth(1).unwrap_or("Unknown")
                    );
                }
            }
        }

        #[cfg(not(windows))]
        {
            if let Ok(output) = std::process::Command::new("df").args(["-h", "/"]).output() {
                if let Ok(text) = String::from_utf8(output.stdout) {
                    if let Some(line) = text.lines().nth(1) {
                        println!("    Disk space: {}", line);
                    }
                }
            }
        }
    }

    // ── Copilot Chat Extension Version Analysis ──────────────────────
    println!();
    match crate::copilot_version::build_version_report(None) {
        Ok(report) => {
            print!("{}", crate::copilot_version::format_version_report(&report));
        }
        Err(e) => {
            println!("[!] Could not detect Copilot Chat version: {}", e);
        }
    }
    println!();

    println!("[*] Recommendations:");
    println!("    1. Run 'chasm recover scan' to find recoverable sessions");
    println!("    2. Use 'chasm harvest run' to consolidate all sessions");
    println!("    3. Consider setting up the recording API for crash protection");
    println!(
        "    4. Run 'chasm recover copilot-info' for detailed extension version analysis"
    );

    Ok(())
}

// ============================================================================
// Convert Command - Convert between JSON and JSONL formats
// ============================================================================

/// Convert session files between JSON and JSONL formats
pub fn recover_convert(
    input: &str,
    output: Option<&str>,
    format: Option<&str>,
    compat: &str,
) -> Result<()> {
    use crate::storage::{detect_session_format, parse_session_auto, VsCodeSessionFormat};

    let input_path = Path::new(input);
    if !input_path.exists() {
        anyhow::bail!("Input file does not exist: {}", input);
    }

    // Read content first for auto-detection
    let content = fs::read_to_string(input_path)
        .with_context(|| format!("Failed to read input file: {}", input))?;

    // Auto-detect format from content (not just extension)
    let format_info = detect_session_format(&content);

    // Determine output format
    let output_format = if let Some(fmt) = format {
        fmt.to_lowercase()
    } else if let Some(out) = output {
        // Infer from output extension
        Path::new(out)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or(match format_info.format {
                VsCodeSessionFormat::JsonLines => "json",
                VsCodeSessionFormat::LegacyJson => "jsonl",
            })
            .to_lowercase()
    } else {
        // Default to opposite of detected input format
        match format_info.format {
            VsCodeSessionFormat::JsonLines => "json".to_string(),
            VsCodeSessionFormat::LegacyJson => "jsonl".to_string(),
        }
    };

    // Determine output path
    let output_path = if let Some(out) = output {
        PathBuf::from(out)
    } else {
        let stem = input_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("converted");
        input_path.with_file_name(format!("{}.{}", stem, output_format))
    };

    println!("[*] Session Format Converter");
    println!("    Input:  {}", input);
    println!(
        "    Output: {} ({})",
        output_path.display(),
        output_format.to_uppercase()
    );
    println!("    Compat: {}", compat);
    println!();
    println!("[*] Auto-detected source format:");
    println!(
        "    Format:     {} ({})",
        format_info.format.short_name(),
        format_info.format
    );
    println!("    Schema:     {}", format_info.schema_version);
    println!("    Confidence: {:.0}%", format_info.confidence * 100.0);
    println!("    Method:     {}", format_info.detection_method);
    println!();

    // Parse using auto-detection
    let (session, _) = parse_session_auto(&content).with_context(|| "Failed to parse session")?;

    println!("[+] Parsed session:");
    println!(
        "    Session ID: {}",
        session.session_id.as_deref().unwrap_or("none")
    );
    println!("    Version:    {}", session.version);
    println!("    Requests:   {}", session.requests.len());
    println!(
        "    Created:    {}",
        format_timestamp(session.creation_date)
    );
    println!();

    // Convert to output format
    let output_content = match output_format.as_str() {
        "json" => {
            // Convert to legacy JSON format (VS Code < 1.109.0)
            serde_json::to_string_pretty(&session).with_context(|| "Failed to serialize to JSON")?
        }
        "jsonl" => {
            // Convert to JSONL format (VS Code >= 1.109.0)
            convert_to_jsonl(&session).with_context(|| "Failed to serialize to JSONL")?
        }
        "md" | "markdown" => {
            // Convert to readable markdown
            convert_to_markdown(&session)
        }
        _ => anyhow::bail!(
            "Unknown output format: {}. Use json, jsonl, or md",
            output_format
        ),
    };

    // Write output
    fs::write(&output_path, &output_content)
        .with_context(|| format!("Failed to write output file: {}", output_path.display()))?;

    println!("[+] Converted successfully!");
    println!("    Output size: {} bytes", output_content.len());

    Ok(())
}

/// Convert ChatSession to JSONL format (VS Code 1.109.0+)
fn convert_to_jsonl(session: &crate::models::ChatSession) -> Result<String> {
    use crate::storage::ensure_vscode_compat_fields;

    let mut lines = Vec::new();

    // Line 1: kind 0 - Initial session state with all VS Code-required fields
    let mut initial = serde_json::json!({
        "kind": 0,
        "v": {
            "version": session.version,
            "sessionId": session.session_id,
            "creationDate": session.creation_date,
            "initialLocation": session.initial_location,
            "responderUsername": session.responder_username,
            "requests": session.requests
        }
    });

    // Inject any missing fields that VS Code's latest format requires
    // (hasPendingEdits, pendingRequests, inputState, etc.)
    if let Some(v) = initial.get_mut("v") {
        ensure_vscode_compat_fields(v, session.session_id.as_deref());
    }

    lines.push(serde_json::to_string(&initial)?);

    // Line 2: kind 1 - lastMessageDate delta
    if session.last_message_date > 0 {
        let delta = serde_json::json!({
            "kind": 1,
            "k": ["lastMessageDate"],
            "v": session.last_message_date
        });
        lines.push(serde_json::to_string(&delta)?);
    }

    // Line 3: kind 1 - customTitle delta (if set)
    if let Some(ref title) = session.custom_title {
        let delta = serde_json::json!({
            "kind": 1,
            "k": ["customTitle"],
            "v": title
        });
        lines.push(serde_json::to_string(&delta)?);
    }

    Ok(format!("{}\n", lines.join("\n")))
}

/// Convert ChatSession to readable markdown
fn convert_to_markdown(session: &crate::models::ChatSession) -> String {
    let mut md = String::new();

    md.push_str("# Chat Session\n\n");

    if let Some(ref title) = session.custom_title {
        md.push_str(&format!("**Title:** {}\n\n", title));
    }

    if let Some(ref session_id) = session.session_id {
        md.push_str(&format!("**Session ID:** `{}`\n\n", session_id));
    }

    md.push_str(&format!(
        "**Created:** {}\n\n",
        format_timestamp(session.creation_date)
    ));
    md.push_str(&format!("**Messages:** {}\n\n", session.requests.len()));
    md.push_str("---\n\n");

    for (i, request) in session.requests.iter().enumerate() {
        md.push_str(&format!("## Turn {}\n\n", i + 1));

        // User message
        md.push_str("### User\n\n");
        if let Some(ref msg) = request.message {
            md.push_str(&format!("{}\n\n", msg.text.as_deref().unwrap_or("")));
        }

        // Assistant response
        if let Some(ref response) = request.response {
            md.push_str("### Assistant\n\n");
            // Response is a serde_json::Value - extract text from 'value' or 'text' field
            let response_text = response
                .get("value")
                .or_else(|| response.get("text"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            md.push_str(&format!("{}\n\n", response_text));
        }

        md.push_str("---\n\n");
    }

    md
}

// ============================================================================
// Extract Command - Extract sessions from a project path
// ============================================================================

/// Extract sessions from a VS Code workspace by project path
pub fn recover_extract(
    project_path: &str,
    output: Option<&str>,
    all_formats: bool,
    include_edits: bool,
) -> Result<()> {
    let project_path = Path::new(project_path);

    // Normalize the path
    let canonical_path = if project_path.exists() {
        let p = project_path
            .canonicalize()
            .with_context(|| format!("Failed to canonicalize path: {}", project_path.display()))?;
        // Strip Windows extended path prefix (\\?\) if present
        let path_str = p.to_string_lossy();
        if path_str.starts_with("\\\\?\\") {
            PathBuf::from(&path_str[4..])
        } else {
            p
        }
    } else {
        PathBuf::from(project_path)
    };

    println!("[*] Session Extractor");
    println!("    Project: {}", canonical_path.display());
    println!();

    // Normalize the path for comparison
    let normalized_path = canonical_path
        .display()
        .to_string()
        .replace('\\', "/")
        .to_lowercase();

    // Search for matching workspace directories by reading workspace.json files
    println!("[*] Searching for workspace matching: {}", normalized_path);
    println!();

    // Search in all providers
    let providers = ["vscode", "cursor"];
    let mut found_sessions = Vec::new();
    let mut matched_workspaces = Vec::new();

    for provider in &providers {
        if let Some(storage_path) = get_provider_storage_path(provider) {
            // Iterate through all workspace directories and check workspace.json
            if let Ok(entries) = fs::read_dir(&storage_path) {
                for entry in entries.flatten() {
                    let workspace_dir = entry.path();
                    if !workspace_dir.is_dir() {
                        continue;
                    }

                    let workspace_json = workspace_dir.join("workspace.json");
                    if let Ok(content) = fs::read_to_string(&workspace_json) {
                        // Parse workspace.json to get folder URI
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                            if let Some(folder) = json.get("folder").and_then(|f| f.as_str()) {
                                // Normalize the folder URI for comparison
                                // file:///c%3A/path -> c:/path
                                let folder_path = folder
                                    .trim_start_matches("file:///")
                                    .trim_start_matches("file://")
                                    .replace("%3A", ":")
                                    .replace("%3a", ":")
                                    .to_lowercase();

                                if folder_path == normalized_path
                                    || folder_path.trim_end_matches('/')
                                        == normalized_path.trim_end_matches('/')
                                {
                                    matched_workspaces
                                        .push((provider.to_string(), workspace_dir.clone()));
                                    println!(
                                        "[+] Found {} workspace: {}",
                                        provider,
                                        workspace_dir.display()
                                    );
                                    println!("    Folder: {}", folder);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Now collect sessions from all matched workspaces
    for (provider, workspace_dir) in &matched_workspaces {
        // Check for JSONL sessions (modern format)
        if let Some(history_path) = get_copilot_history_path(provider) {
            if let Ok(entries) = fs::read_dir(&history_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                    if ext == "jsonl" {
                        found_sessions.push((provider.to_string(), path, "jsonl".to_string()));
                    } else if all_formats && ext == "json" {
                        found_sessions.push((provider.to_string(), path, "json".to_string()));
                    }
                }
            }
        }

        // Check workspace-specific state
        let state_db = workspace_dir.join("state.vscdb");
        if state_db.exists() {
            found_sessions.push((provider.to_string(), state_db.clone(), "sqlite".to_string()));
        }

        // Check for editing sessions if requested
        if include_edits {
            let edits_dir = workspace_dir.join("workspaceEditingSessions");
            if edits_dir.exists() {
                if let Ok(entries) = fs::read_dir(&edits_dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        found_sessions.push((provider.to_string(), path, "edit".to_string()));
                    }
                }
            }
        }
    }

    if found_sessions.is_empty() {
        println!("[-] No sessions found for this project");
        println!();
        println!("[*] Tips:");
        println!("    - Make sure the path matches exactly what VS Code opened");
        println!("    - Try 'chasm recover scan' to see all available sessions");
        return Ok(());
    }

    // Determine output directory
    let output_dir = if let Some(out) = output {
        PathBuf::from(out)
    } else {
        canonical_path.join(".chasm_recovery")
    };

    fs::create_dir_all(&output_dir).with_context(|| {
        format!(
            "Failed to create output directory: {}",
            output_dir.display()
        )
    })?;

    println!();
    println!(
        "[*] Extracting {} items to: {}",
        found_sessions.len(),
        output_dir.display()
    );
    println!();

    let mut total_size = 0u64;
    let mut file_count = 0;
    let mut seen_names: std::collections::HashSet<String> = std::collections::HashSet::new();

    for (provider, source_path, format_type) in &found_sessions {
        // Generate unique filename including workspace hash if needed
        let mut dest_name = format!(
            "{}_{}_{}",
            provider,
            format_type,
            source_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
        );

        // If we've seen this name, add the parent directory name (workspace hash) to make it unique
        if seen_names.contains(&dest_name) {
            if let Some(parent) = source_path.parent() {
                if let Some(parent_name) = parent.file_name() {
                    dest_name = format!(
                        "{}_{}_{}_{}",
                        provider,
                        format_type,
                        parent_name.to_string_lossy(),
                        source_path
                            .file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                    );
                }
            }
        }
        seen_names.insert(dest_name.clone());
        let dest_path = output_dir.join(&dest_name);

        if source_path.is_file() {
            if let Ok(metadata) = fs::metadata(source_path) {
                total_size += metadata.len();
            }

            fs::copy(source_path, &dest_path)
                .with_context(|| format!("Failed to copy: {}", source_path.display()))?;

            file_count += 1;
            println!("    [+] {} -> {}", source_path.display(), dest_name);
        } else if source_path.is_dir() {
            // Copy directory recursively
            copy_dir_recursive(source_path, &dest_path)?;
            file_count += 1;
            println!("    [+] {} (directory)", dest_name);
        }
    }

    println!();
    println!("[+] Extraction complete!");
    println!("    Files:      {}", file_count);
    println!("    Total size: {} bytes", total_size);
    println!("    Output:     {}", output_dir.display());

    Ok(())
}

/// Recursively copy a directory
fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<()> {
    fs::create_dir_all(dst)?;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }

    Ok(())
}

/// Format a Unix timestamp for display
fn format_timestamp(ts: i64) -> String {
    use std::time::{Duration, UNIX_EPOCH};

    if ts <= 0 {
        return "Unknown".to_string();
    }

    // Handle both seconds and milliseconds
    let ts_secs = if ts > 10_000_000_000 { ts / 1000 } else { ts };

    match UNIX_EPOCH.checked_add(Duration::from_secs(ts_secs as u64)) {
        Some(time) => {
            let datetime: chrono::DateTime<chrono::Utc> = time.into();
            datetime.format("%Y-%m-%d %H:%M:%S UTC").to_string()
        }
        None => format!("{}", ts),
    }
}

// ============================================================================
// Detect Command - Detect session format and version
// ============================================================================

/// Detect and display session format and version information
pub fn recover_detect(file: &str, verbose: bool, output_json: bool) -> Result<()> {
    use crate::storage::{detect_session_format, parse_session_auto, VsCodeSessionFormat};

    let file_path = Path::new(file);
    if !file_path.exists() {
        anyhow::bail!("File does not exist: {}", file);
    }

    // Read file content
    let content =
        fs::read_to_string(file_path).with_context(|| format!("Failed to read file: {}", file))?;

    // Detect format
    let format_info = detect_session_format(&content);

    // Try to parse the session
    let parse_result = parse_session_auto(&content);

    if output_json {
        // JSON output
        let mut result = serde_json::json!({
            "file": file,
            "file_size": content.len(),
            "format": {
                "type": format_info.format.short_name(),
                "description": format_info.format.description(),
                "min_vscode_version": format_info.format.min_vscode_version(),
            },
            "schema": {
                "version": format_info.schema_version.version_number(),
                "description": format_info.schema_version.description(),
            },
            "detection": {
                "confidence": format_info.confidence,
                "method": format_info.detection_method,
            },
        });

        if let Ok((session, _)) = &parse_result {
            result["session"] = serde_json::json!({
                "id": session.session_id,
                "version": session.version,
                "requests": session.requests.len(),
                "creation_date": session.creation_date,
                "last_message_date": session.last_message_date,
                "title": session.custom_title,
                "responder": session.responder_username,
            });
            result["parse_success"] = serde_json::json!(true);
        } else {
            result["parse_success"] = serde_json::json!(false);
            if let Err(e) = &parse_result {
                result["parse_error"] = serde_json::json!(e.to_string());
            }
        }

        println!("{}", serde_json::to_string_pretty(&result)?);
    } else {
        // Human-readable output
        println!("[*] Session Format Detection");
        println!("    File: {}", file);
        println!("    Size: {} bytes", content.len());
        println!();

        println!("[*] Detected Format:");
        println!(
            "    Type:        {} ({})",
            format_info.format.short_name().to_uppercase(),
            format_info.format
        );
        println!(
            "    Min VS Code: {}",
            format_info.format.min_vscode_version()
        );
        println!();

        println!("[*] Schema Version:");
        println!("    Version:     {}", format_info.schema_version);
        println!("    Confidence:  {:.0}%", format_info.confidence * 100.0);
        if verbose {
            println!("    Method:      {}", format_info.detection_method);
        }
        println!();

        match &parse_result {
            Ok((session, _)) => {
                println!("[+] Session Parsed Successfully:");
                println!(
                    "    Session ID:  {}",
                    session.session_id.as_deref().unwrap_or("none")
                );
                println!("    Version:     {}", session.version);
                println!("    Requests:    {}", session.requests.len());
                println!(
                    "    Created:     {}",
                    format_timestamp(session.creation_date)
                );
                if session.last_message_date > 0 {
                    println!(
                        "    Last Msg:    {}",
                        format_timestamp(session.last_message_date)
                    );
                }
                if let Some(ref title) = session.custom_title {
                    println!("    Title:       {}", title);
                }
                if let Some(ref responder) = session.responder_username {
                    println!("    Responder:   {}", responder);
                }

                if verbose && !session.requests.is_empty() {
                    println!();
                    println!("[*] Request Summary:");
                    for (i, req) in session.requests.iter().take(5).enumerate() {
                        let msg_preview = req
                            .message
                            .as_ref()
                            .and_then(|m| m.text.as_ref())
                            .map(|t| {
                                let preview: String = t.chars().take(50).collect();
                                if t.len() > 50 {
                                    format!("{}...", preview)
                                } else {
                                    preview
                                }
                            })
                            .unwrap_or_else(|| "[no message]".to_string());
                        println!("    {}. {}", i + 1, msg_preview);
                    }
                    if session.requests.len() > 5 {
                        println!("    ... and {} more requests", session.requests.len() - 5);
                    }
                }
            }
            Err(e) => {
                println!("[-] Parse Error:");
                println!("    {}", e);
                if verbose {
                    // Show first few lines of content for debugging
                    println!();
                    println!("[*] File Preview:");
                    for (i, line) in content.lines().take(5).enumerate() {
                        let preview: String = line.chars().take(100).collect();
                        println!(
                            "    {}: {}{}",
                            i + 1,
                            preview,
                            if line.len() > 100 { "..." } else { "" }
                        );
                    }
                }
            }
        }

        // Show conversion recommendations
        println!();

        // Extract and show extension version from session data
        let session_versions = crate::copilot_version::extract_session_versions(&content);
        if !session_versions.is_empty() {
            println!("[*] Extension Version (from session data):");
            for ver in &session_versions {
                println!("    v{}", ver);
            }
            println!();
        }

        // Show installed extension version for comparison
        if let Ok(installs) = crate::copilot_version::detect_installed_versions() {
            if let Some(active) = installs.iter().find(|i| i.is_active) {
                println!(
                    "[*] Installed Copilot Chat: v{} (requires VS Code {})",
                    active.version, active.required_vscode_version
                );

                // Check for version mismatch
                if !session_versions.is_empty() {
                    let active_str = active.version.to_string();
                    let mismatched: Vec<&String> = session_versions
                        .iter()
                        .filter(|v| v.as_str() != active_str)
                        .collect();
                    if !mismatched.is_empty() {
                        println!(
                            "    [?] Session was created with different extension version(s): {}",
                            mismatched
                                .iter()
                                .map(|v| format!("v{}", v))
                                .collect::<Vec<_>>()
                                .join(", ")
                        );
                        println!("        This may affect recovery compatibility");
                    }
                }
                println!();
            }
        }

        println!("[*] Recommendations:");
        match format_info.format {
            VsCodeSessionFormat::LegacyJson => {
                println!("    - This is legacy JSON format (VS Code < 1.109.0)");
                println!(
                    "    - Convert to JSONL: chasm recover convert \"{}\" --format jsonl",
                    file
                );
            }
            VsCodeSessionFormat::JsonLines => {
                println!("    - This is modern JSONL format (VS Code >= 1.109.0)");
                println!(
                    "    - Convert to JSON: chasm recover convert \"{}\" --format json",
                    file
                );
            }
        }
        println!(
            "    - Export to Markdown: chasm recover convert \"{}\" --format md",
            file
        );
    }

    Ok(())
}

// ============================================================================
// Upgrade Command - Upgrade session files to current provider format
// ============================================================================

/// Upgrade session files for multiple projects to the current provider format
pub fn recover_upgrade(
    project_paths: &[String],
    provider: &str,
    target_format: &str,
    no_backup: bool,
    dry_run: bool,
) -> Result<()> {
    use crate::workspace::get_workspace_by_path;

    println!();
    println!("{} Session Format Upgrade", "=".repeat(60).dimmed());
    println!("{}", "=".repeat(60).dimmed());
    println!();
    println!(
        "  Provider:      {}",
        if provider == "auto" {
            "auto-detect".cyan()
        } else {
            provider.cyan()
        }
    );
    println!("  Target format: {}", target_format.cyan());
    println!(
        "  Backup:        {}",
        if no_backup {
            "disabled".yellow()
        } else {
            "enabled".green()
        }
    );
    println!(
        "  Mode:          {}",
        if dry_run {
            "DRY RUN".yellow().bold()
        } else {
            "LIVE".green().bold()
        }
    );
    println!();
    println!("{}", "=".repeat(60).dimmed());

    let mut total_upgraded = 0;
    let mut total_skipped = 0;
    let mut total_errors = 0;
    let mut total_projects = 0;

    for project_path in project_paths {
        total_projects += 1;
        let project_name = Path::new(project_path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string());

        println!();
        println!("  {} {}", "→".blue().bold(), project_name.bold());

        // Get workspace for this project
        let workspace = match get_workspace_by_path(project_path) {
            Ok(Some(ws)) => ws,
            Ok(None) => {
                println!("    {} Workspace not found", "⚠".yellow());
                continue;
            }
            Err(e) => {
                println!("    {} Error: {}", "✗".red(), e);
                total_errors += 1;
                continue;
            }
        };

        if !workspace.has_chat_sessions {
            println!("    {} No chat sessions", "○".dimmed());
            continue;
        }

        // Process each session file
        let sessions_path = Path::new(&workspace.chat_sessions_path);
        let entries = match std::fs::read_dir(sessions_path) {
            Ok(e) => e,
            Err(e) => {
                println!("    {} Cannot read sessions: {}", "✗".red(), e);
                total_errors += 1;
                continue;
            }
        };

        for entry in entries {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };

            let path = entry.path();
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");

            // Only process session files
            if ext != "json" && ext != "jsonl" {
                continue;
            }

            let file_name = path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            // Read and detect current format
            let content = match std::fs::read_to_string(&path) {
                Ok(c) => c,
                Err(e) => {
                    println!("    {} {} - read error: {}", "✗".red(), file_name, e);
                    total_errors += 1;
                    continue;
                }
            };

            let format_info = detect_session_format(&content);

            // Determine if upgrade is needed
            let needs_upgrade = match target_format {
                "jsonl" => matches!(format_info.format, VsCodeSessionFormat::LegacyJson),
                "json" => matches!(format_info.format, VsCodeSessionFormat::JsonLines),
                _ => false,
            };

            if !needs_upgrade {
                println!(
                    "    {} {} - already {}",
                    "○".dimmed(),
                    file_name,
                    target_format
                );
                total_skipped += 1;
                continue;
            }

            // Parse the session
            let session = match parse_session_auto(&content) {
                Ok((s, _)) => s,
                Err(e) => {
                    println!("    {} {} - parse error: {}", "✗".red(), file_name, e);
                    total_errors += 1;
                    continue;
                }
            };

            // Convert to target format
            let output_content = match target_format {
                "jsonl" => match convert_to_jsonl(&session) {
                    Ok(c) => c,
                    Err(e) => {
                        println!("    {} {} - conversion error: {}", "✗".red(), file_name, e);
                        total_errors += 1;
                        continue;
                    }
                },
                "json" => match serde_json::to_string_pretty(&session) {
                    Ok(c) => c,
                    Err(e) => {
                        println!(
                            "    {} {} - serialization error: {}",
                            "✗".red(),
                            file_name,
                            e
                        );
                        total_errors += 1;
                        continue;
                    }
                },
                _ => {
                    println!(
                        "    {} {} - unsupported target format: {}",
                        "✗".red(),
                        file_name,
                        target_format
                    );
                    total_errors += 1;
                    continue;
                }
            };

            if dry_run {
                println!(
                    "    {} {} - would upgrade ({} → {})",
                    "◉".cyan(),
                    file_name,
                    ext,
                    target_format
                );
                total_upgraded += 1;
                continue;
            }

            // Create backup if requested
            if !no_backup {
                let backup_path = path.with_extension(format!("{}.backup", ext));
                if let Err(e) = std::fs::copy(&path, &backup_path) {
                    println!("    {} {} - backup failed: {}", "✗".red(), file_name, e);
                    total_errors += 1;
                    continue;
                }
            }

            // Determine output file path (change extension if needed)
            let output_path = if ext != target_format {
                path.with_extension(target_format)
            } else {
                path.clone()
            };

            // Write upgraded content
            if let Err(e) = std::fs::write(&output_path, &output_content) {
                println!("    {} {} - write error: {}", "✗".red(), file_name, e);
                total_errors += 1;
                continue;
            }

            // Remove old file if extension changed
            if ext != target_format && path != output_path {
                let _ = std::fs::remove_file(&path);
            }

            println!("    {} {} → .{}", "✓".green(), file_name, target_format);
            total_upgraded += 1;
        }
    }

    // Summary
    println!();
    println!("{}", "=".repeat(60).dimmed());
    println!();
    if dry_run {
        println!(
            "{} Would upgrade {} session(s), skip {} (already {}), {} error(s) across {} project(s)",
            "[DRY RUN]".yellow().bold(),
            total_upgraded,
            total_skipped,
            target_format,
            total_errors,
            total_projects
        );
    } else {
        println!(
            "{} Upgraded {} session(s), skipped {} (already {}), {} error(s) across {} project(s)",
            "[DONE]".green().bold(),
            total_upgraded,
            total_skipped,
            target_format,
            total_errors,
            total_projects
        );
    }

    Ok(())
}

// ============================================================================
// Copilot Info Command - Show Copilot Chat extension version details
// ============================================================================

/// Display comprehensive Copilot Chat extension version information and
/// compatibility analysis with session data.
pub fn recover_copilot_info(
    session_dir: Option<&str>,
    output_json: bool,
) -> Result<()> {
    let session_path = session_dir.map(Path::new);

    let report = crate::copilot_version::build_version_report(session_path)?;

    if output_json {
        let json = crate::copilot_version::format_version_report_json(&report)?;
        println!("{}", json);
    } else {
        println!("╔═══════════════════════════════════════════════════════════════════╗");
        println!("║          Copilot Chat Extension Version Analysis                  ║");
        println!("╚═══════════════════════════════════════════════════════════════════╝\n");

        print!("{}", crate::copilot_version::format_version_report(&report));

        // Show the compatibility table
        println!();
        println!("[*] Known Version Compatibility:");
        println!("    ┌─────────────────────┬──────────────┬─────────┬────────────────────────────────────┐");
        println!("    │ Extension Range      │ VS Code Min  │ Format  │ Notes                              │");
        println!("    ├─────────────────────┼──────────────┼─────────┼────────────────────────────────────┤");
        for entry in crate::copilot_version::known_compatibility() {
            println!(
                "    │ {:>7} - {:<9} │ {:>12} │ {:>7} │ {:<34} │",
                entry.extension_min,
                entry.extension_max,
                entry.vscode_min,
                entry.session_format,
                &entry.notes[..entry.notes.len().min(34)],
            );
        }
        println!("    └─────────────────────┴──────────────┴─────────┴────────────────────────────────────┘");

        // Recommendations
        println!();
        let has_errors = report.issues.iter().any(|i| i.severity == "error");
        let has_warnings = report.issues.iter().any(|i| i.severity == "warning");

        if has_errors || has_warnings {
            println!("[*] Recommendations:");
            if has_errors {
                println!("    [!] Install Copilot Chat from the VS Code marketplace");
            }
            if has_warnings {
                println!("    [?] Run 'chasm recover upgrade' to update legacy sessions to JSONL format");
                println!("    [?] Run 'chasm doctor --fix' to repair any session issues");
            }
        } else {
            println!("[+] No compatibility issues detected");
        }
    }

    Ok(())
}

// ============================================================================
// Backups Command - Restore truncated sessions from all backup file types
// ============================================================================

/// Scan all VS Code workspaces (optionally filtered by path) for backup files
/// (`.jsonl.bak`, `.jsonl.pre-restore`, `.json`, `.json.bak`) that contain more
/// requests than the current `.jsonl` — and restore them.
///
/// After restoration, rebuilds the VS Code session index and model cache for
/// each affected workspace so sessions are immediately visible.
///
/// This is the explicit CLI entry-point for comprehensive backup recovery.
pub fn recover_backups(path: Option<&str>, dry_run: bool, force: bool) -> Result<()> {
    use crate::storage::{
        parse_session_file, rebuild_model_cache,
        recover_from_all_backups, write_chat_session_index, cleanup_state_cache,
        fix_session_memento,
    };
    use std::collections::HashSet;

    if !force && is_vscode_running() {
        println!(
            "{} VS Code is running. Use {} to proceed anyway.",
            "[!]".yellow(),
            "--force".cyan()
        );
        return Ok(());
    }

    println!(
        "\n{} Scanning for truncated sessions with recoverable backups",
        "[R]".cyan().bold()
    );
    println!("{}", "=".repeat(70));

    let workspaces = discover_workspaces()?;

    // Optionally filter by root path
    let root_filter: Option<String> = path.map(|p| {
        let resolved = std::path::Path::new(p)
            .canonicalize()
            .unwrap_or_else(|_| PathBuf::from(p));
        normalize_path(&resolved.to_string_lossy())
    });

    let filtered: Vec<_> = if let Some(ref root) = root_filter {
        workspaces
            .iter()
            .filter(|ws| {
                ws.project_path
                    .as_ref()
                    .map(|p| normalize_path(p).starts_with(root.as_str()))
                    .unwrap_or(false)
            })
            .collect()
    } else {
        workspaces.iter().collect()
    };

    let with_sessions: Vec<_> = filtered
        .iter()
        .filter(|ws| ws.has_chat_sessions)
        .collect();

    if let Some(ref root) = root_filter {
        println!(
            "   Filtering to workspaces under: {}",
            root.bright_white()
        );
    }
    println!(
        "   Found {} workspace(s) with chat sessions",
        with_sessions.len().to_string().cyan()
    );
    println!(
        "   Checking: .jsonl.bak, .jsonl.pre-restore, .json, .json.bak\n",
    );

    let mut total_restored = 0usize;
    let mut total_requests_gained = 0usize;
    let mut workspaces_affected = 0usize;
    let mut workspaces_rebuilt = 0usize;

    for ws in &with_sessions {
        let chat_sessions_dir = ws.chat_sessions_path.clone();
        if !chat_sessions_dir.exists() {
            continue;
        }

        let display = ws.project_path.as_deref().unwrap_or(&ws.hash);

        match recover_from_all_backups(&chat_sessions_dir, dry_run) {
            Ok(actions) if !actions.is_empty() => {
                workspaces_affected += 1;

                for action in &actions {
                    let delta = action.recovered_requests - action.current_requests;
                    let marker = if action.converted { " [json→jsonl]" } else { "" };
                    let src_display = if action.source_file.len() > 40 {
                        format!("...{}", &action.source_file[action.source_file.len() - 37..])
                    } else {
                        action.source_file.clone()
                    };

                    if dry_run {
                        println!(
                            "   {} {} — {} → {} requests (+{}){} from {}",
                            "[*]".yellow(),
                            display.cyan(),
                            action.current_requests.to_string().bright_black(),
                            action.recovered_requests.to_string().green(),
                            delta.to_string().green(),
                            marker.bright_black(),
                            src_display.bright_black(),
                        );
                    } else {
                        println!(
                            "   {} {} — {} → {} requests (+{}){} from {}",
                            "[+]".green(),
                            display.cyan(),
                            action.current_requests.to_string().bright_black(),
                            action.recovered_requests.to_string().green(),
                            delta.to_string().green(),
                            marker.bright_black(),
                            src_display.bright_black(),
                        );
                    }

                    total_restored += 1;
                    total_requests_gained += delta;
                }

                // After restoring files, rebuild index + model cache for this workspace
                if !dry_run {
                    let db_path = ws
                        .workspace_path
                        .join("state.vscdb");

                    if db_path.exists() {
                        // Scan all current session files and rebuild index
                        let mut session_entries = Vec::new();
                        let mut valid_ids = HashSet::new();

                        for entry in std::fs::read_dir(&chat_sessions_dir)
                            .into_iter()
                            .flatten()
                            .filter_map(|e| e.ok())
                        {
                            let p = entry.path();
                            if !p.is_file() {
                                continue;
                            }
                            let fname = p
                                .file_name()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .to_string();
                            // Only process active .jsonl files (not backups)
                            if !fname.ends_with(".jsonl")
                                || fname.contains(".bak")
                                || fname.contains(".pre-restore")
                                || fname.contains(".pre_bak")
                                || fname.contains(".pre_recovery")
                            {
                                continue;
                            }

                            if let Ok(session) = parse_session_file(&p) {
                                let session_id = session
                                    .session_id
                                    .clone()
                                    .unwrap_or_else(|| {
                                        fname.trim_end_matches(".jsonl").to_string()
                                    });
                                valid_ids.insert(session_id.clone());

                                let title = session.title();
                                let is_empty = session.is_empty();

                                session_entries.push(crate::models::ChatSessionIndexEntry {
                                    session_id: session_id.clone(),
                                    title,
                                    last_message_date: session.last_message_date,
                                    timing: Some(crate::models::ChatSessionTiming {
                                        created: session.creation_date,
                                        last_request_started: Some(session.last_message_date),
                                        last_request_ended: Some(session.last_message_date),
                                    }),
                                    last_response_state: 1,
                                    initial_location: "panel".to_string(),
                                    is_empty,
                                    is_imported: Some(false),
                                    has_pending_edits: Some(false),
                                    is_external: Some(false),
                                });
                            }
                        }

                        // Also include .json-only sessions (no corresponding .jsonl)
                        for entry in std::fs::read_dir(&chat_sessions_dir)
                            .into_iter()
                            .flatten()
                            .filter_map(|e| e.ok())
                        {
                            let p = entry.path();
                            if !p.is_file() {
                                continue;
                            }
                            let fname = p
                                .file_name()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .to_string();
                            if !fname.ends_with(".json")
                                || fname.contains(".bak")
                                || fname.contains(".pre-restore")
                            {
                                continue;
                            }
                            let sid = fname.trim_end_matches(".json").to_string();
                            if valid_ids.contains(&sid) {
                                continue; // Already have .jsonl for this session
                            }

                            if let Ok(session) = parse_session_file(&p) {
                                let session_id = session
                                    .session_id
                                    .clone()
                                    .unwrap_or(sid.clone());
                                valid_ids.insert(session_id.clone());

                                session_entries.push(crate::models::ChatSessionIndexEntry {
                                    session_id: session_id.clone(),
                                    title: session.title(),
                                    last_message_date: session.last_message_date,
                                    timing: Some(crate::models::ChatSessionTiming {
                                        created: session.creation_date,
                                        last_request_started: Some(session.last_message_date),
                                        last_request_ended: Some(session.last_message_date),
                                    }),
                                    last_response_state: 1,
                                    initial_location: "panel".to_string(),
                                    is_empty: session.is_empty(),
                                    is_imported: Some(false),
                                    has_pending_edits: Some(false),
                                    is_external: Some(false),
                                });
                            }
                        }

                        // Build the index
                        let mut entries_map = std::collections::HashMap::new();
                        for entry in &session_entries {
                            entries_map.insert(entry.session_id.clone(), entry.clone());
                        }
                        let new_index = crate::models::ChatSessionIndex {
                            version: 1,
                            entries: entries_map,
                        };

                        // Write index + rebuild model cache + cleanup state cache
                        let mut rebuild_ok = true;
                        if let Err(e) = write_chat_session_index(&db_path, &new_index) {
                            eprintln!(
                                "   {} {} — failed to write index: {}",
                                "[!]".red(), display, e
                            );
                            rebuild_ok = false;
                        }
                        if let Err(e) = rebuild_model_cache(&db_path, &new_index) {
                            eprintln!(
                                "   {} {} — failed to rebuild model cache: {}",
                                "[!]".red(), display, e
                            );
                            rebuild_ok = false;
                        }
                        let _ = cleanup_state_cache(&db_path, &valid_ids);
                        let preferred = new_index
                            .entries
                            .iter()
                            .filter(|(_, e)| !e.is_empty)
                            .max_by_key(|(_, e)| e.last_message_date)
                            .map(|(id, _)| id.clone());
                        let _ = fix_session_memento(&db_path, &valid_ids, preferred.as_deref());

                        if rebuild_ok {
                            let non_empty = new_index
                                .entries
                                .values()
                                .filter(|e| !e.is_empty)
                                .count();
                            println!(
                                "   {} {} — rebuilt index ({} entries, {} visible)",
                                "\u{2714}".green(),
                                display.cyan(),
                                new_index.entries.len().to_string().cyan(),
                                non_empty.to_string().green(),
                            );
                            workspaces_rebuilt += 1;
                        }
                    }
                }
            }
            Ok(_) => {} // Nothing to restore for this workspace
            Err(e) => {
                println!(
                    "   {} {} — error: {}",
                    "[!]".red(),
                    display,
                    e
                );
            }
        }
    }

    println!("\n{}", "=".repeat(70));
    if dry_run {
        println!("{} Dry run complete", "[OK]".green());
    } else {
        println!("{} Backup recovery complete", "[OK]".green());
    }
    println!("{}", "=".repeat(70));
    println!("   Workspaces scanned:        {}", with_sessions.len());
    println!(
        "   Workspaces with recoveries: {}",
        workspaces_affected.to_string().cyan()
    );
    println!(
        "   Sessions {}:       {}",
        if dry_run { "to restore" } else { "restored  " },
        total_restored.to_string().green()
    );
    println!(
        "   Requests {}:      {}",
        if dry_run { "to recover" } else { "recovered " },
        total_requests_gained.to_string().green()
    );
    if !dry_run && workspaces_rebuilt > 0 {
        println!(
            "   Indexes rebuilt:            {}",
            workspaces_rebuilt.to_string().green()
        );
    }

    if dry_run && total_restored > 0 {
        println!(
            "\n   {} Run without {} to apply changes.",
            "Tip:".bright_black(),
            "--dry-run".cyan()
        );
    }

    if !dry_run && total_restored > 0 {
        println!(
            "\n   {} Safety backups saved as .jsonl.pre-restore",
            "[i]".bright_black()
        );
        println!(
            "   {} Quit VS Code (Alt+F4) and reopen to see restored sessions.",
            "Tip:".bright_black()
        );
    }

    Ok(())
}