// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
//! Register commands - Add sessions to VS Code's session index
//!
//! VS Code only displays sessions that are registered in the `chat.ChatSessionStore.index`
//! stored in `state.vscdb`. Sessions can exist on disk but be invisible to VS Code if
//! they're not in this index. These commands help register orphaned sessions.

use anyhow::Result;
use colored::*;
use std::collections::HashSet;
use std::io::Write;
use std::path::{Path, PathBuf};

use crate::error::IronBridgeError;
use crate::models::ChatSession;
use crate::storage::{
    add_session_to_index, cleanup_state_cache, close_vscode_and_wait, diagnose_workspace_sessions,
    fix_broken_view_state, fix_session_memento, get_workspace_storage_db,
    is_session_file_extension, is_vscode_running, parse_session_file, parse_session_json,
    read_chat_session_index, rebuild_model_cache, recover_from_json_bak, recover_from_jsonl_bak,
    register_all_sessions_from_directory, reopen_vscode, repair_workspace_sessions,
    trim_session_jsonl,
};
use crate::workspace::{
    discover_workspaces, find_workspace_by_path, normalize_path,
    recover_orphaned_sessions_from_old_hashes,
};

/// Prompt the user to confirm closing VS Code. Returns true if confirmed, false if declined.
/// When `force` is true, skips the prompt and returns true immediately.
fn confirm_close_vscode(force: bool) -> bool {
    if force {
        return true;
    }
    print!(
        "{} VS Code will be closed. Continue? [y/N] ",
        "[?]".yellow()
    );
    std::io::stdout().flush().ok();
    let mut input = String::new();
    if std::io::stdin().read_line(&mut input).is_err() {
        return false;
    }
    matches!(input.trim().to_lowercase().as_str(), "y" | "yes")
}

/// Resolve a path option to an absolute PathBuf, handling "." and relative paths
pub fn resolve_path(path: Option<&str>) -> PathBuf {
    match path {
        Some(p) => {
            let path = PathBuf::from(p);
            path.canonicalize().unwrap_or(path)
        }
        None => std::env::current_dir().unwrap_or_default(),
    }
}

/// Register all sessions from a workspace into VS Code's index
pub fn register_all(
    project_path: Option<&str>,
    merge: bool,
    force: bool,
    close_vscode: bool,
    reopen: bool,
    write_only: bool,
) -> Result<()> {
    let path = resolve_path(project_path);
    // --reopen implies --close-vscode
    let should_close = close_vscode || reopen;

    if merge {
        println!(
            "{} Merging and registering all sessions for: {}",
            "[IRONBRIDGE]".cyan().bold(),
            path.display()
        );

        // Use the existing merge functionality
        let path_str = path.to_string_lossy().to_string();
        return crate::commands::history_merge(
            Some(&path_str),
            None,  // title
            force, // force
            false, // no_backup
        );
    }

    println!(
        "{} Registering all sessions for: {}",
        "[IRONBRIDGE]".cyan().bold(),
        path.display()
    );

    // Find the workspace
    let path_str = path.to_string_lossy().to_string();
    let (ws_id, ws_path, _folder) = find_workspace_by_path(&path_str)?
        .ok_or_else(|| IronBridgeError::WorkspaceNotFound(path.display().to_string()))?;

    let chat_sessions_dir = ws_path.join("chatSessions");

    if !chat_sessions_dir.exists() {
        println!(
            "{} No chatSessions directory found at: {}",
            "[!]".yellow(),
            chat_sessions_dir.display()
        );
        return Ok(());
    }

    // Detect if running from VS Code's integrated terminal
    let in_vscode_terminal = std::env::var("TERM_PROGRAM")
        .map(|v| v.to_lowercase().contains("vscode"))
        .unwrap_or(false);

    // Handle VS Code lifecycle
    let vscode_was_running = is_vscode_running();
    let mut will_reopen = reopen;
    if vscode_was_running {
        if write_only {
            // Explicit --write-only: write to DB directly, spawn watchdog to
            // re-apply after VS Code exits (since VS Code's in-memory cache
            // will overwrite on shutdown)
            println!(
                "   {} VS Code is running. Writing to index with shutdown watchdog.",
                "[*]".yellow()
            );
        } else if should_close {
            // Explicit --close-vscode or --reopen
            if in_vscode_terminal && !force {
                println!(
                    "{} Cannot close VS Code from its integrated terminal.",
                    "[!]".yellow()
                );
                println!(
                    "   Use {} to write to the index now (a background watchdog will",
                    "--write-only".cyan()
                );
                println!("   re-apply after VS Code exits to survive shutdown).");
                println!(
                    "   Or run this command from an {} with {}.",
                    "external terminal".cyan(),
                    "--reopen".cyan()
                );
                return Err(IronBridgeError::VSCodeRunning.into());
            }
            if !confirm_close_vscode(force) {
                println!("{} Aborted.", "[!]".yellow());
                return Ok(());
            }
            println!("   {} Closing VS Code (saving state)...", "[*]".yellow());
            close_vscode_and_wait(30)?;
            println!("   {} VS Code closed.", "[OK]".green());
        } else if force {
            // --force from external terminal: close and reopen automatically
            if in_vscode_terminal {
                // Can't close VS Code from inside it; fall back to write-only + watchdog
                println!(
                    "   {} VS Code is running (in its terminal). Writing with shutdown watchdog.",
                    "[*]".yellow()
                );
            } else {
                // External terminal: --force means "just make it work"
                println!("   {} Closing VS Code (saving state)...", "[*]".yellow());
                close_vscode_and_wait(30)?;
                println!("   {} VS Code closed.", "[OK]".green());
                will_reopen = true;
            }
        } else {
            // No flags: show helpful guidance
            println!(
                "{} VS Code is running. Its in-memory cache will overwrite index changes on shutdown.",
                "[!]".yellow()
            );
            if in_vscode_terminal {
                println!(
                    "   Use {} to write now (a background watchdog ensures persistence).",
                    "--write-only".cyan()
                );
            } else {
                println!(
                    "   Use {} to close VS Code first, register, and reopen.",
                    "--reopen".cyan()
                );
                println!(
                    "   Use {} to skip the confirmation prompt.",
                    "--force".cyan()
                );
            }
            return Err(IronBridgeError::VSCodeRunning.into());
        }
    }

    // Count sessions on disk
    let sessions_on_disk = count_sessions_in_directory(&chat_sessions_dir)?;
    println!(
        "   Found {} session files on disk",
        sessions_on_disk.to_string().green()
    );

    // Recover truncated sessions from backups before registering
    match recover_from_json_bak(&chat_sessions_dir) {
        Ok(0) => {}
        Ok(n) => {
            println!(
                "{} Recovered {} session(s) from .json.bak backups",
                "[OK]".green().bold(),
                n.to_string().cyan()
            );
        }
        Err(e) => {
            println!("{} .json.bak recovery: {}", "[WARN]".yellow(), e);
        }
    }
    match recover_from_jsonl_bak(&chat_sessions_dir, false) {
        Ok((0, _)) => {}
        Ok((n, bytes)) => {
            println!(
                "{} Restored {} session(s) from .jsonl.bak ({:.1}MB recovered)",
                "[OK]".green().bold(),
                n.to_string().cyan(),
                bytes as f64 / (1024.0 * 1024.0)
            );
        }
        Err(e) => {
            println!("{} .jsonl.bak recovery: {}", "[WARN]".yellow(), e);
        }
    }

    // Register all sessions (rebuild index from disk)
    let registered = register_all_sessions_from_directory(&ws_id, &chat_sessions_dir, true)?;

    println!(
        "\n{} Registered {} sessions in VS Code's index",
        "[OK]".green().bold(),
        registered.to_string().cyan()
    );

    // Rebuild model cache (makes sessions visible in Chat sidebar)
    let db_path = get_workspace_storage_db(&ws_id)?;
    match read_chat_session_index(&db_path) {
        Ok(index) => match rebuild_model_cache(&db_path, &index) {
            Ok(n) => {
                println!(
                    "{} Rebuilt model cache with {} entries",
                    "[OK]".green().bold(),
                    n.to_string().cyan()
                );
            }
            Err(e) => {
                println!("{} Failed to rebuild model cache: {}", "[WARN]".yellow(), e);
            }
        },
        Err(e) => {
            println!(
                "{} Failed to read index for model cache rebuild: {}",
                "[WARN]".yellow(),
                e
            );
        }
    }

    // Cleanup state cache
    {
        let mut valid_ids: HashSet<String> = HashSet::new();
        if chat_sessions_dir.exists() {
            for entry in std::fs::read_dir(&chat_sessions_dir)? {
                let entry = entry?;
                let p = entry.path();
                if p.extension().is_some_and(|e| e == "jsonl") {
                    if let Some(stem) = p.file_stem() {
                        valid_ids.insert(stem.to_string_lossy().to_string());
                    }
                }
            }
        }
        if let Ok(n) = cleanup_state_cache(&db_path, &valid_ids) {
            if n > 0 {
                println!(
                    "{} Cleaned {} stale state cache entries",
                    "[OK]".green().bold(),
                    n.to_string().cyan()
                );
            }
        }
    }

    // Fix broken view state (sessions hidden in sidebar)
    match fix_broken_view_state(&db_path) {
        Ok(true) => {
            println!(
                "{} Fixed broken view state (sessions were hidden in sidebar)",
                "[OK]".green().bold()
            );
        }
        Ok(false) => {} // View state is fine
        Err(e) => {
            println!("{} Failed to check view state: {}", "[WARN]".yellow(), e);
        }
    }

    // If VS Code was running and we didn't close it (write-only or --force from vscode terminal),
    // spawn a watchdog to re-apply the index after VS Code exits
    let wrote_while_running = vscode_was_running && is_vscode_running();
    if wrote_while_running {
        match spawn_registration_watchdog(&ws_id, &chat_sessions_dir, Some(&path_str)) {
            Ok(()) => {
                println!(
                    "\n{} Background watchdog spawned to re-apply index after VS Code exits.",
                    "[OK]".green()
                );
                println!(
                    "   Sessions will {} across VS Code restarts.",
                    "persist".green().bold()
                );
                println!(
                    "   To see them now, press {} and run {}",
                    "Ctrl+Shift+P".cyan(),
                    "Developer: Reload Window".cyan()
                );
            }
            Err(e) => {
                println!("\n{} Could not spawn watchdog: {}", "[!]".yellow(), e);
                println!(
                    "   {} VS Code's in-memory cache may overwrite these changes on shutdown.",
                    "[!]".red()
                );
                println!(
                    "   Use {} and run {} to pick up the changes NOW",
                    "Ctrl+Shift+P".cyan(),
                    "Developer: Reload Window".cyan()
                );
                println!(
                    "   {} Do NOT restart VS Code — that will lose the registered sessions.",
                    "[!]".red().bold()
                );
            }
        }
    }

    // Reopen VS Code if requested (or if --force from external terminal closed it)
    if will_reopen && !is_vscode_running() {
        println!("   {} Reopening VS Code...", "[*]".yellow());
        reopen_vscode(Some(&path_str))?;
        println!(
            "   {} VS Code launched. Sessions should appear in Copilot Chat history.",
            "[OK]".green()
        );
    } else if should_close && vscode_was_running && !is_vscode_running() && !will_reopen {
        println!(
            "\n{} VS Code was closed. Reopen it to see the recovered sessions.",
            "[!]".yellow()
        );
        println!("   Run: {}", format!("code {}", path.display()).cyan());
    }

    Ok(())
}

/// Spawn a detached watchdog process that waits for VS Code to exit, then re-applies
/// the session index to state.vscdb. This ensures registrations survive VS Code's
/// shutdown flush of its in-memory IStorageService cache.
fn spawn_registration_watchdog(
    ws_id: &str,
    chat_sessions_dir: &Path,
    _project_path: Option<&str>,
) -> Result<()> {
    // Write pending registration info to a temp file
    let pending_file = std::env::temp_dir().join(format!("ironbridge_pending_{}.json", ws_id));
    let pending = serde_json::json!({
        "workspace_id": ws_id,
        "chat_sessions_dir": chat_sessions_dir.to_string_lossy(),
    });
    std::fs::write(&pending_file, serde_json::to_string_pretty(&pending)?)?;

    // Spawn ourselves with the hidden `internal apply-pending` command
    let exe = std::env::current_exe()?;

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const DETACHED_PROCESS: u32 = 0x00000008;

        std::process::Command::new(&exe)
            .args(["internal", "apply-pending", &pending_file.to_string_lossy()])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .stdin(std::process::Stdio::null())
            .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS)
            .spawn()?;
    }

    #[cfg(not(windows))]
    {
        std::process::Command::new(&exe)
            .args(["internal", "apply-pending", &pending_file.to_string_lossy()])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .stdin(std::process::Stdio::null())
            .spawn()?;
    }

    Ok(())
}

/// Apply a pending registration after VS Code has exited.
/// Called by the detached watchdog process (via `ironbridge internal apply-pending`).
pub fn apply_pending_index(pending_file: &str) -> Result<()> {
    let content = std::fs::read_to_string(pending_file)?;
    let pending: serde_json::Value = serde_json::from_str(&content)?;

    let ws_id = pending["workspace_id"]
        .as_str()
        .ok_or_else(|| IronBridgeError::InvalidSessionFormat("missing workspace_id".into()))?;
    let chat_sessions_dir =
        PathBuf::from(pending["chat_sessions_dir"].as_str().ok_or_else(|| {
            IronBridgeError::InvalidSessionFormat("missing chat_sessions_dir".into())
        })?);

    // Wait for VS Code to exit (poll every 2 seconds, timeout after 10 minutes)
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(600);
    while is_vscode_running() {
        if std::time::Instant::now() >= deadline {
            // Timed out waiting — clean up and exit
            let _ = std::fs::remove_file(pending_file);
            return Ok(());
        }
        std::thread::sleep(std::time::Duration::from_secs(2));
    }

    // Extra wait for file locks to release
    std::thread::sleep(std::time::Duration::from_secs(2));

    // Re-apply the registration
    if chat_sessions_dir.exists() {
        let _ = register_all_sessions_from_directory(ws_id, &chat_sessions_dir, true);
    }

    // Clean up the pending file
    let _ = std::fs::remove_file(pending_file);

    Ok(())
}

/// Register specific sessions by ID or title
pub fn register_sessions(
    ids: &[String],
    titles: Option<&[String]>,
    project_path: Option<&str>,
    force: bool,
) -> Result<()> {
    let path = resolve_path(project_path);

    // Find the workspace
    let path_str = path.to_string_lossy().to_string();
    let (ws_id, ws_path, _folder) = find_workspace_by_path(&path_str)?
        .ok_or_else(|| IronBridgeError::WorkspaceNotFound(path.display().to_string()))?;

    let chat_sessions_dir = ws_path.join("chatSessions");

    // Check if VS Code is running
    if !force && is_vscode_running() {
        println!(
            "{} VS Code is running. Use {} to register anyway.",
            "[!]".yellow(),
            "--force".cyan()
        );
        return Err(IronBridgeError::VSCodeRunning.into());
    }

    // Get the database path
    let db_path = get_workspace_storage_db(&ws_id)?;

    let mut registered_count = 0;

    if let Some(titles) = titles {
        // Register by title
        println!(
            "{} Registering {} sessions by title:",
            "[IRONBRIDGE]".cyan().bold(),
            titles.len()
        );

        let sessions = find_sessions_by_titles(&chat_sessions_dir, titles)?;

        for (session, session_path) in sessions {
            let session_id = session.session_id.clone().unwrap_or_else(|| {
                session_path
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default()
            });
            let title = session.title();

            add_session_to_index(
                &db_path,
                &session_id,
                &title,
                session.last_message_date,
                session.is_imported,
                &session.initial_location,
                session.is_empty(),
            )?;

            let id_display = crate::text::head(&session_id, 12);
            println!(
                "   {} {} (\"{}\")",
                "[OK]".green(),
                id_display.cyan(),
                title.yellow()
            );
            registered_count += 1;
        }
    } else {
        // Register by ID (default)
        println!(
            "{} Registering {} sessions by ID:",
            "[IRONBRIDGE]".cyan().bold(),
            ids.len()
        );

        for session_id in ids {
            match find_session_file(&chat_sessions_dir, session_id) {
                Ok(session_file) => {
                    let session = parse_session_file(&session_file)?;

                    let title = session.title();
                    let actual_session_id = session
                        .session_id
                        .clone()
                        .unwrap_or_else(|| session_id.to_string());

                    add_session_to_index(
                        &db_path,
                        &actual_session_id,
                        &title,
                        session.last_message_date,
                        session.is_imported,
                        &session.initial_location,
                        session.is_empty(),
                    )?;

                    let id_display = crate::text::head(&actual_session_id, 12);
                    println!(
                        "   {} {} (\"{}\")",
                        "[OK]".green(),
                        id_display.cyan(),
                        title.yellow()
                    );
                    registered_count += 1;
                }
                Err(e) => {
                    println!(
                        "   {} {} - {}",
                        "[ERR]".red(),
                        session_id.cyan(),
                        e.to_string().red()
                    );
                }
            }
        }
    }

    println!(
        "\n{} Registered {} sessions in VS Code's index",
        "[OK]".green().bold(),
        registered_count.to_string().cyan()
    );

    if force && is_vscode_running() {
        println!(
            "   {} Sessions should appear in VS Code immediately",
            "->".cyan()
        );
    }

    Ok(())
}

/// List sessions that exist on disk but are not in VS Code's index
pub fn list_orphaned(project_path: Option<&str>) -> Result<()> {
    let path = resolve_path(project_path);

    println!(
        "{} Finding orphaned sessions for: {}",
        "[IRONBRIDGE]".cyan().bold(),
        path.display()
    );

    // Find the workspace
    let path_str = path.to_string_lossy().to_string();
    let (ws_id, ws_path, _folder) = find_workspace_by_path(&path_str)?
        .ok_or_else(|| IronBridgeError::WorkspaceNotFound(path.display().to_string()))?;

    let chat_sessions_dir = ws_path.join("chatSessions");

    if !chat_sessions_dir.exists() {
        println!("{} No chatSessions directory found", "[!]".yellow());
        return Ok(());
    }

    // Get sessions currently in the index
    let db_path = get_workspace_storage_db(&ws_id)?;
    let index = read_chat_session_index(&db_path)?;
    let indexed_ids: HashSet<String> = index.entries.keys().cloned().collect();

    println!(
        "   {} sessions currently in VS Code's index",
        indexed_ids.len().to_string().cyan()
    );

    // Find sessions on disk
    let mut orphaned_sessions = Vec::new();

    // Collect files, preferring .jsonl over .json for the same session ID
    let mut session_files: std::collections::HashMap<String, PathBuf> =
        std::collections::HashMap::new();
    for entry in std::fs::read_dir(&chat_sessions_dir)? {
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
                if !session_files.contains_key(&stem_str) || is_jsonl {
                    session_files.insert(stem_str, path);
                }
            }
        }
    }

    for path in session_files.values() {
        if let Ok(session) = parse_session_file(path) {
            let session_id = session.session_id.clone().unwrap_or_else(|| {
                path.file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default()
            });

            if !indexed_ids.contains(&session_id) {
                let title = session.title();
                let msg_count = session.requests.len();
                orphaned_sessions.push((session_id, title, msg_count, path.clone()));
            }
        }
    }

    if orphaned_sessions.is_empty() {
        println!(
            "\n{} No orphaned sessions found - all sessions are registered!",
            "[OK]".green().bold()
        );
        return Ok(());
    }

    println!(
        "\n{} Found {} orphaned sessions (on disk but not in index):\n",
        "[!]".yellow().bold(),
        orphaned_sessions.len().to_string().red()
    );

    for (session_id, title, msg_count, _path) in &orphaned_sessions {
        let id_display = crate::text::head(session_id, 12);
        println!(
            "   {} {} ({} messages)",
            id_display.cyan(),
            format!("\"{}\"", title).yellow(),
            msg_count
        );
    }

    println!("\n{} To register all orphaned sessions:", "->".cyan());
    println!("   ironbridge register all --force");
    println!("\n{} To register specific sessions:", "->".cyan());
    println!("   ironbridge register session <ID1> <ID2> ... --force");

    Ok(())
}

/// Count session files in a directory (counts unique session IDs, preferring .jsonl)
fn count_sessions_in_directory(dir: &PathBuf) -> Result<usize> {
    let mut session_ids: HashSet<String> = HashSet::new();
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path
            .extension()
            .map(is_session_file_extension)
            .unwrap_or(false)
        {
            if let Some(stem) = path.file_stem() {
                session_ids.insert(stem.to_string_lossy().to_string());
            }
        }
    }
    Ok(session_ids.len())
}

/// Find a session file by ID (supports partial matches, prefers .jsonl over .json)
fn find_session_file(chat_sessions_dir: &PathBuf, session_id: &str) -> Result<PathBuf> {
    // First try exact match (.jsonl preferred)
    let exact_jsonl = chat_sessions_dir.join(format!("{}.jsonl", session_id));
    if exact_jsonl.exists() {
        return Ok(exact_jsonl);
    }
    let exact_json = chat_sessions_dir.join(format!("{}.json", session_id));
    if exact_json.exists() {
        return Ok(exact_json);
    }

    // Try partial match (prefix), preferring .jsonl
    let mut best_match: Option<PathBuf> = None;
    for entry in std::fs::read_dir(chat_sessions_dir)? {
        let entry = entry?;
        let path = entry.path();

        if path
            .extension()
            .map(is_session_file_extension)
            .unwrap_or(false)
        {
            let filename = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();

            if filename.starts_with(session_id) {
                let is_jsonl = path.extension().is_some_and(|e| e == "jsonl");
                if best_match.is_none() || is_jsonl {
                    best_match = Some(path.clone());
                    if is_jsonl {
                        return Ok(path);
                    }
                }
                continue;
            }

            // Also check session_id inside the file
            if let Ok(session) = parse_session_file(&path) {
                if let Some(ref sid) = session.session_id {
                    if sid.starts_with(session_id) || sid == session_id {
                        let is_jsonl = path.extension().is_some_and(|e| e == "jsonl");
                        if best_match.is_none() || is_jsonl {
                            best_match = Some(path.clone());
                        }
                    }
                }
            }
        }
    }

    best_match.ok_or_else(|| IronBridgeError::SessionNotFound(session_id.to_string()).into())
}

/// Find sessions by title (case-insensitive partial match)
fn find_sessions_by_titles(
    chat_sessions_dir: &PathBuf,
    titles: &[String],
) -> Result<Vec<(ChatSession, PathBuf)>> {
    let mut matches = Vec::new();
    let title_patterns: Vec<String> = titles.iter().map(|t| t.to_lowercase()).collect();

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
                if !session_files.contains_key(&stem_str) || is_jsonl {
                    session_files.insert(stem_str, path);
                }
            }
        }
    }

    for path in session_files.values() {
        if let Ok(session) = parse_session_file(path) {
            let session_title = session.title().to_lowercase();

            for pattern in &title_patterns {
                if session_title.contains(pattern) {
                    matches.push((session, path.clone()));
                    break;
                }
            }
        }
    }

    if matches.is_empty() {
        println!(
            "{} No sessions found matching the specified titles",
            "[!]".yellow()
        );
    }

    Ok(matches)
}

/// Recursively walk directories and register orphaned sessions for all workspaces found.
///
/// Instead of walking the entire filesystem tree (which can be extremely slow for
/// large directory hierarchies), this function discovers all VS Code workspaces upfront
/// and filters them by the root path prefix. This is O(workspaces) instead of
/// O(filesystem entries), making it orders of magnitude faster for deep trees.
pub fn register_recursive(
    root_path: Option<&str>,
    max_depth: Option<usize>,
    force: bool,
    dry_run: bool,
    exclude_patterns: &[String],
) -> Result<()> {
    let root = resolve_path(root_path);
    let root_normalized = normalize_path(&root.to_string_lossy());

    println!(
        "{} Scanning for workspaces under: {}",
        "[IRONBRIDGE]".cyan().bold(),
        root.display()
    );

    if dry_run {
        println!("{} Dry run mode - no changes will be made", "[!]".yellow());
    }

    // Check if VS Code is running
    if !force && !dry_run && is_vscode_running() {
        println!(
            "{} VS Code is running. Use {} to register anyway.",
            "[!]".yellow(),
            "--force".cyan()
        );
        println!("   Note: VS Code uses WAL mode so this is generally safe.");
        return Err(IronBridgeError::VSCodeRunning.into());
    }

    // Get all VS Code workspaces — this is fast (reads workspaceStorage metadata)
    let workspaces = discover_workspaces()?;

    // Compile exclude patterns
    let exclude_matchers: Vec<glob::Pattern> = exclude_patterns
        .iter()
        .filter_map(|p| glob::Pattern::new(p).ok())
        .collect();

    // Default exclusions for common non-project directories
    let default_excludes = [
        "node_modules",
        ".git",
        "target",
        "build",
        "dist",
        ".venv",
        "venv",
        "__pycache__",
        ".cache",
        "vendor",
        ".cargo",
    ];

    // Filter workspaces to those under the root path, applying exclusions and depth limits.
    // This replaces the slow recursive filesystem walk with a fast filter over the
    // already-known workspace list.
    let matching_workspaces: Vec<&crate::models::Workspace> = workspaces
        .iter()
        .filter(|ws| {
            let Some(ref project_path) = ws.project_path else {
                return false;
            };

            // Must be under the root path
            let ws_normalized = normalize_path(project_path);
            if !ws_normalized.starts_with(&root_normalized) {
                return false;
            }

            // Check depth limit: count path components after root
            if let Some(max) = max_depth {
                let suffix = &ws_normalized[root_normalized.len()..];
                let suffix = suffix.trim_start_matches(['/', '\\']);
                let depth = if suffix.is_empty() {
                    0
                } else {
                    suffix.matches(['/', '\\']).count() + 1
                };
                if depth > max {
                    return false;
                }
            }

            // Check exclude patterns against the relative path and directory name
            let relative = &ws_normalized[root_normalized.len()..];
            let relative = relative.trim_start_matches(['/', '\\']);
            let dir_name = project_path
                .rsplit(['/', '\\'])
                .next()
                .unwrap_or("")
                .to_lowercase();

            // Skip default excluded directory names (check each path component)
            for component in relative.split(['/', '\\']) {
                if default_excludes.contains(&component) {
                    return false;
                }
            }

            // Skip user exclude patterns
            for pattern in &exclude_matchers {
                if pattern.matches(relative) || pattern.matches(&dir_name) {
                    return false;
                }
            }

            // Must have chat sessions
            ws.has_chat_sessions
        })
        .collect();

    let total_workspaces = matching_workspaces.len();
    println!(
        "   Found {} workspaces with chat sessions under this path (from {} total)",
        total_workspaces.to_string().cyan(),
        workspaces.len().to_string().white()
    );

    let mut workspaces_processed = 0;
    let mut total_sessions_registered = 0;
    let mut workspaces_with_orphans: Vec<(String, usize, usize)> = Vec::new();

    for (i, ws) in matching_workspaces.iter().enumerate() {
        let display_path = ws.project_path.as_deref().unwrap_or(&ws.hash);
        let chat_sessions_dir = &ws.chat_sessions_path;

        // Progress indicator
        if (i + 1) % 25 == 0 || i + 1 == total_workspaces {
            println!(
                "   ... processing {}/{}",
                (i + 1).to_string().cyan(),
                total_workspaces.to_string().white()
            );
        }

        // Count orphaned sessions
        match count_orphaned_sessions(&ws.hash, chat_sessions_dir) {
            Ok((on_disk, in_index, orphaned_count)) => {
                workspaces_processed += 1;

                if orphaned_count > 0 {
                    if dry_run {
                        println!(
                            "   {} {} - {} sessions on disk, {} in index, {} orphaned",
                            "[DRY]".yellow(),
                            display_path.cyan(),
                            on_disk.to_string().white(),
                            in_index.to_string().white(),
                            orphaned_count.to_string().yellow()
                        );
                        workspaces_with_orphans.push((
                            display_path.to_string(),
                            orphaned_count,
                            orphaned_count,
                        ));
                    } else {
                        // Register the sessions
                        match register_all_sessions_from_directory(
                            &ws.hash,
                            chat_sessions_dir,
                            force,
                        ) {
                            Ok(registered) => {
                                total_sessions_registered += registered;
                                println!(
                                    "   {} {} - registered {} sessions",
                                    "[+]".green(),
                                    display_path.cyan(),
                                    registered.to_string().green()
                                );
                                workspaces_with_orphans.push((
                                    display_path.to_string(),
                                    orphaned_count,
                                    registered,
                                ));
                            }
                            Err(e) => {
                                println!(
                                    "   {} {} - error: {}",
                                    "[!]".red(),
                                    display_path.cyan(),
                                    e
                                );
                            }
                        }
                    }
                }
            }
            Err(e) => {
                println!(
                    "   {} {} - error checking: {}",
                    "[!]".yellow(),
                    display_path,
                    e
                );
            }
        }
    }

    // Print summary
    println!("\n{}", "═".repeat(60).cyan());
    println!("{} Recursive scan complete", "[OK]".green().bold());
    println!("{}", "═".repeat(60).cyan());
    println!(
        "   Workspaces checked:     {}",
        workspaces_processed.to_string().cyan()
    );
    println!(
        "   Sessions registered:    {}",
        total_sessions_registered.to_string().green()
    );

    if !workspaces_with_orphans.is_empty() {
        println!("\n   {} Workspaces with orphaned sessions:", "[+]".green());
        for (path, orphaned, registered) in &workspaces_with_orphans {
            let reg_str = if dry_run {
                format!("would register {}", registered)
            } else {
                format!("registered {}", registered)
            };
            println!(
                "      {} ({} orphaned, {})",
                path.cyan(),
                orphaned.to_string().yellow(),
                reg_str.green()
            );
        }
    }

    if total_sessions_registered > 0 && !dry_run {
        println!(
            "\n{} VS Code caches the session index in memory.",
            "[!]".yellow()
        );
        println!("   To see the new sessions, do one of the following:");
        println!(
            "   * Run: {} (if IRONBRIDGE extension is installed)",
            "code --command ironbridge.reloadAndShowChats".cyan()
        );
        println!(
            "   * Or press {} in VS Code and run {}",
            "Ctrl+Shift+P".cyan(),
            "Developer: Reload Window".cyan()
        );
        println!("   * Or restart VS Code");
    }

    Ok(())
}

/// Count orphaned sessions in a workspace (on disk but not in index)
fn count_orphaned_sessions(
    workspace_id: &str,
    chat_sessions_dir: &Path,
) -> Result<(usize, usize, usize)> {
    // Get sessions in index
    let db_path = get_workspace_storage_db(workspace_id)?;
    let indexed_sessions = read_chat_session_index(&db_path)?;
    let indexed_ids: HashSet<String> = indexed_sessions.entries.keys().cloned().collect();

    // Count unique sessions on disk (preferring .jsonl over .json)
    let mut disk_sessions: HashSet<String> = HashSet::new();

    for entry in std::fs::read_dir(chat_sessions_dir)? {
        let entry = entry?;
        let path = entry.path();

        if path
            .extension()
            .map(is_session_file_extension)
            .unwrap_or(false)
        {
            if let Some(stem) = path.file_stem() {
                disk_sessions.insert(stem.to_string_lossy().to_string());
            }
        }
    }

    let on_disk = disk_sessions.len();
    let orphaned = disk_sessions
        .iter()
        .filter(|id| !indexed_ids.contains(*id))
        .count();

    Ok((on_disk, indexed_ids.len(), orphaned))
}

/// Repair sessions: compact JSONL files and rebuild the index with correct metadata
#[allow(clippy::too_many_arguments)]
pub fn register_repair(
    project_path: Option<&str>,
    all: bool,
    recursive: bool,
    max_depth: Option<usize>,
    exclude_patterns: &[String],
    dry_run: bool,
    force: bool,
    close_vscode: bool,
    reopen: bool,
) -> Result<()> {
    if all {
        return register_repair_all(force, close_vscode, reopen);
    }

    if recursive {
        return register_repair_recursive(
            project_path,
            max_depth,
            exclude_patterns,
            dry_run,
            force,
            close_vscode,
            reopen,
        );
    }

    let path = resolve_path(project_path);
    let should_close = close_vscode || reopen;

    println!(
        "{} Repairing sessions for: {}",
        "[IRONBRIDGE]".cyan().bold(),
        path.display()
    );

    // Find the workspace
    let path_str = path.to_string_lossy().to_string();
    let (ws_id, ws_path, _folder) = find_workspace_by_path(&path_str)?
        .ok_or_else(|| IronBridgeError::WorkspaceNotFound(path.display().to_string()))?;

    let chat_sessions_dir = ws_path.join("chatSessions");

    if !chat_sessions_dir.exists() {
        println!(
            "{} No chatSessions directory found at: {}",
            "[!]".yellow(),
            chat_sessions_dir.display()
        );
        return Ok(());
    }

    // Handle VS Code lifecycle
    let vscode_was_running = is_vscode_running();
    if vscode_was_running {
        if should_close {
            if !confirm_close_vscode(force) {
                println!("{} Aborted.", "[!]".yellow());
                return Ok(());
            }
            println!("   {} Closing VS Code (saving state)...", "[*]".yellow());
            close_vscode_and_wait(30)?;
            println!("   {} VS Code closed.", "[OK]".green());
        } else if !force {
            println!(
                "{} VS Code is running. Its in-memory cache will overwrite index changes.",
                "[!]".yellow()
            );
            println!(
                "   Use {} to close VS Code first, or {} to force.",
                "--reopen".cyan(),
                "--force".cyan()
            );
            return Err(IronBridgeError::VSCodeRunning.into());
        }
    }

    // Pass 0: Recover orphaned sessions from old workspace hashes
    println!(
        "   {} Pass 0: Recovering orphaned sessions from old workspace hashes...",
        "[*]".cyan()
    );
    match recover_orphaned_sessions_from_old_hashes(&path_str) {
        Ok(0) => {}
        Ok(n) => {
            println!(
                "   {} Recovered {} orphaned session(s) from old workspace hashes",
                "[OK]".green(),
                n.to_string().cyan()
            );
        }
        Err(e) => {
            println!(
                "   {} Failed to recover orphaned sessions: {}",
                "[WARN]".yellow(),
                e
            );
        }
    }

    // Run the repair
    // Pass 0.5: Recover from .json.bak when .jsonl has fewer requests (truncated migration)
    println!(
        "   {} Pass 0.5: Recovering sessions from .json.bak files...",
        "[*]".cyan()
    );
    match recover_from_json_bak(&chat_sessions_dir) {
        Ok(0) => {}
        Ok(n) => {
            println!(
                "   {} Recovered {} session(s) from .json.bak backups",
                "[OK]".green(),
                n.to_string().cyan()
            );
        }
        Err(e) => {
            println!(
                "   {} Failed to recover from .json.bak: {}",
                "[WARN]".yellow(),
                e
            );
        }
    }

    println!(
        "   {} Pass 1: Compacting JSONL files & fixing compat fields...",
        "[*]".cyan()
    );
    println!(
        "   {} Pass 1.5: Converting skeleton .json files...",
        "[*]".cyan()
    );
    println!("   {} Pass 2: Fixing cancelled modelState...", "[*]".cyan());
    let (compacted, index_fixed) = repair_workspace_sessions(&ws_id, &chat_sessions_dir, true)?;

    println!("   {} Pass 3: Index rebuilt.", "[*]".cyan());
    println!(
        "\n{} Repair complete: {} files compacted, {} index entries synced",
        "[OK]".green().bold(),
        compacted.to_string().cyan(),
        index_fixed.to_string().cyan()
    );

    // Delete stale .json files when a .jsonl exists for the same session
    let mut deleted_json = 0;
    if chat_sessions_dir.exists() {
        let mut jsonl_sessions: HashSet<String> = HashSet::new();
        for entry in std::fs::read_dir(&chat_sessions_dir)? {
            let entry = entry?;
            let p = entry.path();
            if p.extension().is_some_and(|e| e == "jsonl") {
                if let Some(stem) = p.file_stem() {
                    jsonl_sessions.insert(stem.to_string_lossy().to_string());
                }
            }
        }
        for entry in std::fs::read_dir(&chat_sessions_dir)? {
            let entry = entry?;
            let p = entry.path();
            if p.extension().is_some_and(|e| e == "json") {
                if let Some(stem) = p.file_stem() {
                    if jsonl_sessions.contains(&stem.to_string_lossy().to_string()) {
                        // Rename to .json.bak to preserve as backup
                        let bak = p.with_extension("json.bak");
                        std::fs::rename(&p, &bak)?;
                        println!(
                            "   {} Backed up stale .json: {} → {}",
                            "[*]".yellow(),
                            p.file_name().unwrap_or_default().to_string_lossy(),
                            bak.file_name().unwrap_or_default().to_string_lossy()
                        );
                        deleted_json += 1;
                    }
                }
            }
        }
        if deleted_json > 0 {
            // Re-sync index after removing .json files
            repair_workspace_sessions(&ws_id, &chat_sessions_dir, true)?;
            println!(
                "   {} Removed {} stale .json duplicates (backed up as .json.bak)",
                "[OK]".green(),
                deleted_json
            );
        }
    }

    // Pass 4: Rebuild agentSessions.model.cache (makes sessions visible in Chat sidebar)
    let db_path = get_workspace_storage_db(&ws_id)?;
    println!(
        "   {} Pass 4: Rebuilding model cache (agentSessions.model.cache)...",
        "[*]".cyan()
    );
    match read_chat_session_index(&db_path) {
        Ok(index) => match rebuild_model_cache(&db_path, &index) {
            Ok(n) => {
                println!(
                    "   {} Model cache rebuilt with {} entries",
                    "[OK]".green(),
                    n.to_string().cyan()
                );
            }
            Err(e) => {
                println!(
                    "   {} Failed to rebuild model cache: {}",
                    "[WARN]".yellow(),
                    e
                );
            }
        },
        Err(e) => {
            println!(
                "   {} Failed to read index for model cache rebuild: {}",
                "[WARN]".yellow(),
                e
            );
        }
    }

    // Pass 5: Cleanup agentSessions.state.cache (remove stale entries)
    println!(
        "   {} Pass 5: Cleaning up state cache (agentSessions.state.cache)...",
        "[*]".cyan()
    );
    {
        // Collect valid session IDs from disk
        let mut valid_ids: HashSet<String> = HashSet::new();
        if chat_sessions_dir.exists() {
            for entry in std::fs::read_dir(&chat_sessions_dir)? {
                let entry = entry?;
                let p = entry.path();
                if p.extension().is_some_and(|e| e == "jsonl") {
                    if let Some(stem) = p.file_stem() {
                        valid_ids.insert(stem.to_string_lossy().to_string());
                    }
                }
            }
        }
        match cleanup_state_cache(&db_path, &valid_ids) {
            Ok(0) => {
                println!("   {} State cache: all entries valid", "[OK]".green());
            }
            Ok(n) => {
                println!(
                    "   {} State cache: removed {} stale entries",
                    "[OK]".green(),
                    n.to_string().cyan()
                );
            }
            Err(e) => {
                println!(
                    "   {} Failed to cleanup state cache: {}",
                    "[WARN]".yellow(),
                    e
                );
            }
        }

        // Pass 6: Fix memento (point to a valid session)
        println!(
            "   {} Pass 6: Fixing session memento (last active session)...",
            "[*]".cyan()
        );
        // Pick the most recently active non-empty session as preferred
        let preferred_id = read_chat_session_index(&db_path).ok().and_then(|idx| {
            idx.entries
                .iter()
                .filter(|(_, e)| !e.is_empty)
                .max_by_key(|(_, e)| e.last_message_date)
                .map(|(id, _)| id.clone())
        });
        match fix_session_memento(&db_path, &valid_ids, preferred_id.as_deref()) {
            Ok(true) => {
                println!(
                    "   {} Memento updated to point to: {}",
                    "[OK]".green(),
                    preferred_id
                        .as_deref()
                        .unwrap_or("(first valid session)")
                        .cyan()
                );
            }
            Ok(false) => {
                println!(
                    "   {} Memento already points to a valid session",
                    "[OK]".green()
                );
            }
            Err(e) => {
                println!("   {} Failed to fix memento: {}", "[WARN]".yellow(), e);
            }
        }
    }

    // Pass 7: Fix broken view state (sessions hidden in sidebar)
    println!(
        "   {} Pass 7: Checking view state (workbench.view.chat.sessions.state)...",
        "[*]".cyan()
    );
    match fix_broken_view_state(&db_path) {
        Ok(true) => {
            println!(
                "   {} Removed broken view state (all sections were hidden)",
                "[OK]".green()
            );
        }
        Ok(false) => {
            println!("   {} View state is valid", "[OK]".green());
        }
        Err(e) => {
            println!("   {} Failed to check view state: {}", "[WARN]".yellow(), e);
        }
    }

    // Reopen VS Code if requested
    if reopen && vscode_was_running {
        println!("   {} Reopening VS Code...", "[*]".yellow());
        reopen_vscode(Some(&path_str))?;
        println!(
            "   {} VS Code launched. Sessions should now load correctly.",
            "[OK]".green()
        );
    } else if should_close && vscode_was_running {
        println!(
            "\n{} VS Code was closed. Reopen it to see the repaired sessions.",
            "[!]".yellow()
        );
        println!("   Run: {}", format!("code {}", path.display()).cyan());
    }

    Ok(())
}

/// Recursively scan a directory tree for workspaces and repair all discovered sessions
fn register_repair_recursive(
    root_path: Option<&str>,
    max_depth: Option<usize>,
    exclude_patterns: &[String],
    dry_run: bool,
    force: bool,
    close_vscode: bool,
    reopen: bool,
) -> Result<()> {
    let root = resolve_path(root_path);
    let should_close = close_vscode || reopen;

    println!(
        "{} Recursively scanning for workspaces to repair from: {}",
        "[IRONBRIDGE]".cyan().bold(),
        root.display()
    );

    if dry_run {
        println!("{} Dry run mode — no changes will be made", "[!]".yellow());
    }

    // Handle VS Code lifecycle
    let vscode_was_running = is_vscode_running();
    if vscode_was_running && !dry_run {
        if should_close {
            if !confirm_close_vscode(force) {
                println!("{} Aborted.", "[!]".yellow());
                return Ok(());
            }
            println!("   {} Closing VS Code (saving state)...", "[*]".yellow());
            close_vscode_and_wait(30)?;
            println!("   {} VS Code closed.\n", "[OK]".green());
        } else if !force {
            println!(
                "{} VS Code is running. Its in-memory cache will overwrite index changes.",
                "[!]".yellow()
            );
            println!(
                "   Use {} to close VS Code first, or {} to force.",
                "--reopen".cyan(),
                "--force".cyan()
            );
            return Err(IronBridgeError::VSCodeRunning.into());
        }
    }

    // Get all VS Code workspaces
    let workspaces = discover_workspaces()?;
    println!(
        "   Found {} VS Code workspaces to check",
        workspaces.len().to_string().cyan()
    );

    // Build a map of normalized project paths to workspace info
    let mut workspace_map: std::collections::HashMap<String, Vec<&crate::models::Workspace>> =
        std::collections::HashMap::new();
    for ws in &workspaces {
        if let Some(ref project_path) = ws.project_path {
            let normalized = normalize_path(project_path);
            workspace_map.entry(normalized).or_default().push(ws);
        }
    }

    // Compile exclude patterns
    let exclude_matchers: Vec<glob::Pattern> = exclude_patterns
        .iter()
        .filter_map(|p| glob::Pattern::new(p).ok())
        .collect();

    let default_excludes = [
        "node_modules",
        ".git",
        "target",
        "build",
        "dist",
        ".venv",
        "venv",
        "__pycache__",
        ".cache",
        "vendor",
        ".cargo",
    ];

    let mut total_dirs_scanned = 0usize;
    let mut workspaces_found = 0usize;
    let mut total_compacted = 0usize;
    let mut total_synced = 0usize;
    let mut total_issues_found = 0usize;
    let mut total_issues_fixed = 0usize;
    let mut repair_results: Vec<(String, usize, bool, String)> = Vec::new(); // (path, issues, success, detail)

    // Walk the directory tree looking for known workspaces
    #[allow(clippy::too_many_arguments)]
    fn walk_for_repair(
        dir: &Path,
        current_depth: usize,
        max_depth: Option<usize>,
        workspace_map: &std::collections::HashMap<String, Vec<&crate::models::Workspace>>,
        exclude_matchers: &[glob::Pattern],
        default_excludes: &[&str],
        dry_run: bool,
        force: bool,
        total_dirs_scanned: &mut usize,
        workspaces_found: &mut usize,
        total_compacted: &mut usize,
        total_synced: &mut usize,
        total_issues_found: &mut usize,
        total_issues_fixed: &mut usize,
        repair_results: &mut Vec<(String, usize, bool, String)>,
    ) -> Result<()> {
        if let Some(max) = max_depth {
            if current_depth > max {
                return Ok(());
            }
        }

        *total_dirs_scanned += 1;

        // Check if this directory is a known workspace
        let normalized = normalize_path(&dir.to_string_lossy());
        if let Some(ws_list) = workspace_map.get(&normalized) {
            for ws in ws_list {
                if ws.has_chat_sessions && ws.chat_session_count > 0 {
                    *workspaces_found += 1;

                    let display_name = ws.project_path.as_deref().unwrap_or(&ws.hash);

                    // Diagnose first
                    let chat_dir = ws.workspace_path.join("chatSessions");
                    match crate::storage::diagnose_workspace_sessions(&ws.hash, &chat_dir) {
                        Ok(diag) => {
                            let issue_count = diag.issues.len();
                            *total_issues_found += issue_count;

                            if issue_count == 0 {
                                println!(
                                    "   {} {} — {} sessions, healthy",
                                    "[OK]".green(),
                                    display_name.cyan(),
                                    ws.chat_session_count
                                );
                                repair_results.push((
                                    display_name.to_string(),
                                    0,
                                    true,
                                    "healthy".to_string(),
                                ));
                            } else {
                                let issue_kinds: Vec<String> = {
                                    let mut kinds: Vec<String> = Vec::new();
                                    for issue in &diag.issues {
                                        let s = format!("{}", issue.kind);
                                        if !kinds.contains(&s) {
                                            kinds.push(s);
                                        }
                                    }
                                    kinds
                                };

                                println!(
                                    "   {} {} — {} sessions, {} issue(s): {}",
                                    "[!]".yellow(),
                                    display_name.cyan(),
                                    ws.chat_session_count,
                                    issue_count,
                                    issue_kinds.join(", ")
                                );

                                if !dry_run {
                                    // Recover orphaned sessions from old workspace hashes first
                                    if let Some(ref project_path) = ws.project_path {
                                        match crate::workspace::recover_orphaned_sessions_from_old_hashes(project_path) {
                                            Ok(0) => {}
                                            Ok(n) => {
                                                println!(
                                                    "      {} Recovered {} orphaned session(s) from old hashes",
                                                    "[OK]".green(),
                                                    n
                                                );
                                            }
                                            Err(_) => {} // Non-fatal
                                        }
                                    }

                                    // Always force-repair when issues have been detected
                                    // (the `force` argument controls a separate dry-run gate above).
                                    let _ = force;
                                    match repair_workspace_sessions(&ws.hash, &chat_dir, true) {
                                        Ok((compacted, synced)) => {
                                            *total_compacted += compacted;
                                            *total_synced += synced;
                                            *total_issues_fixed += issue_count;

                                            // Also handle stale .json cleanup
                                            let mut deleted_json = 0;
                                            let mut jsonl_sessions: HashSet<String> =
                                                HashSet::new();
                                            if let Ok(entries) = std::fs::read_dir(&chat_dir) {
                                                for entry in entries.flatten() {
                                                    let p = entry.path();
                                                    if p.extension().is_some_and(|e| e == "jsonl") {
                                                        if let Some(stem) = p.file_stem() {
                                                            jsonl_sessions.insert(
                                                                stem.to_string_lossy().to_string(),
                                                            );
                                                        }
                                                    }
                                                }
                                            }
                                            if let Ok(entries) = std::fs::read_dir(&chat_dir) {
                                                for entry in entries.flatten() {
                                                    let p = entry.path();
                                                    if p.extension().is_some_and(|e| e == "json") {
                                                        if let Some(stem) = p.file_stem() {
                                                            if jsonl_sessions.contains(
                                                                &stem.to_string_lossy().to_string(),
                                                            ) {
                                                                let bak =
                                                                    p.with_extension("json.bak");
                                                                let _ = std::fs::rename(&p, &bak);
                                                                deleted_json += 1;
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                            if deleted_json > 0 {
                                                let _ = repair_workspace_sessions(
                                                    &ws.hash, &chat_dir, true,
                                                );
                                            }

                                            // Repair DB caches (model cache, state cache, memento, .json.bak recovery)
                                            let _ = repair_workspace_db_caches(
                                                &ws.hash, &chat_dir, false,
                                            );

                                            let detail = format!(
                                                "{} compacted, {} synced{}",
                                                compacted,
                                                synced,
                                                if deleted_json > 0 {
                                                    format!(
                                                        ", {} stale .json backed up",
                                                        deleted_json
                                                    )
                                                } else {
                                                    String::new()
                                                }
                                            );
                                            println!("      {} Fixed: {}", "[OK]".green(), detail);
                                            repair_results.push((
                                                display_name.to_string(),
                                                issue_count,
                                                true,
                                                detail,
                                            ));
                                        }
                                        Err(e) => {
                                            println!("      {} Failed: {}", "[ERR]".red(), e);
                                            repair_results.push((
                                                display_name.to_string(),
                                                issue_count,
                                                false,
                                                e.to_string(),
                                            ));
                                        }
                                    }
                                } else {
                                    // Dry run: just list the issues
                                    for issue in &diag.issues {
                                        println!(
                                            "      {} {} — {}",
                                            "→".bright_black(),
                                            &issue.session_id[..8.min(issue.session_id.len())],
                                            issue.kind
                                        );
                                    }
                                    repair_results.push((
                                        display_name.to_string(),
                                        issue_count,
                                        true,
                                        "dry run".to_string(),
                                    ));
                                }
                            }
                        }
                        Err(e) => {
                            println!("   {} {} — scan failed: {}", "[ERR]".red(), display_name, e);
                        }
                    }
                }
            }
        }

        // Recurse into subdirectories
        let entries = match std::fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return Ok(()),
        };

        for entry in entries {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let dir_name = entry.file_name().to_string_lossy().to_string();

            // Skip hidden directories
            if dir_name.starts_with('.') {
                continue;
            }

            // Skip default excludes
            if default_excludes.iter().any(|e| dir_name == *e) {
                continue;
            }

            // Skip user-specified excludes
            if exclude_matchers.iter().any(|p| p.matches(&dir_name)) {
                continue;
            }

            walk_for_repair(
                &path,
                current_depth + 1,
                max_depth,
                workspace_map,
                exclude_matchers,
                default_excludes,
                dry_run,
                force,
                total_dirs_scanned,
                workspaces_found,
                total_compacted,
                total_synced,
                total_issues_found,
                total_issues_fixed,
                repair_results,
            )?;
        }

        Ok(())
    }

    walk_for_repair(
        &root,
        0,
        max_depth,
        &workspace_map,
        &exclude_matchers,
        &default_excludes,
        dry_run,
        force,
        &mut total_dirs_scanned,
        &mut workspaces_found,
        &mut total_compacted,
        &mut total_synced,
        &mut total_issues_found,
        &mut total_issues_fixed,
        &mut repair_results,
    )?;

    // Print summary
    println!("\n{}", "═".repeat(60).cyan());
    println!("{} Recursive repair scan complete", "[OK]".green().bold());
    println!("{}", "═".repeat(60).cyan());
    println!(
        "   Directories scanned:    {}",
        total_dirs_scanned.to_string().cyan()
    );
    println!(
        "   Workspaces found:       {}",
        workspaces_found.to_string().cyan()
    );
    println!(
        "   Issues detected:        {}",
        if total_issues_found > 0 {
            total_issues_found.to_string().yellow()
        } else {
            total_issues_found.to_string().green()
        }
    );
    if !dry_run {
        println!(
            "   Issues fixed:           {}",
            total_issues_fixed.to_string().green()
        );
        println!(
            "   Files compacted:        {}",
            total_compacted.to_string().cyan()
        );
        println!(
            "   Index entries synced:   {}",
            total_synced.to_string().cyan()
        );
    }

    let failed_count = repair_results.iter().filter(|(_, _, ok, _)| !ok).count();
    if failed_count > 0 {
        println!(
            "\n   {} {} workspace(s) had repair errors",
            "[!]".yellow(),
            failed_count.to_string().red()
        );
    }

    // Reopen VS Code if requested
    if reopen && vscode_was_running {
        println!("   {} Reopening VS Code...", "[*]".yellow());
        reopen_vscode(None)?;
        println!(
            "   {} VS Code launched. Sessions should now load correctly.",
            "[OK]".green()
        );
    } else if should_close && vscode_was_running {
        println!(
            "\n{} VS Code was closed. Reopen it to see the repaired sessions.",
            "[!]".yellow()
        );
    }

    Ok(())
}

/// Repair the VS Code DB caches for a single workspace:
/// - `.json.bak` recovery (restore truncated sessions from backups)
/// - `agentSessions.model.cache` rebuild (makes sessions visible in Chat sidebar)
/// - `agentSessions.state.cache` cleanup (removes stale entries for deleted sessions)
/// - `memento/interactive-session-view-copilot` fix (points to a valid session)
///
/// Call this AFTER `repair_workspace_sessions()` and stale .json cleanup.
fn repair_workspace_db_caches(
    workspace_id: &str,
    chat_sessions_dir: &Path,
    verbose: bool,
) -> Result<()> {
    let db_path = get_workspace_storage_db(workspace_id)?;
    if !db_path.exists() {
        return Ok(());
    }

    // .json.bak recovery
    match recover_from_json_bak(chat_sessions_dir) {
        Ok(0) => {}
        Ok(n) => {
            if verbose {
                println!(
                    "      {} Recovered {} session(s) from .json.bak",
                    "[OK]".green(),
                    n
                );
            }
        }
        Err(e) => {
            if verbose {
                println!(
                    "      {} .json.bak recovery failed: {}",
                    "[WARN]".yellow(),
                    e
                );
            }
        }
    }

    // Rebuild model cache
    if let Ok(index) = read_chat_session_index(&db_path) {
        if let Ok(n) = rebuild_model_cache(&db_path, &index) {
            if verbose && n > 0 {
                println!(
                    "      {} Model cache rebuilt ({} entries)",
                    "[OK]".green(),
                    n
                );
            }
        }
    }

    // Collect valid session IDs from disk
    let mut valid_ids: HashSet<String> = HashSet::new();
    if chat_sessions_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(chat_sessions_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.extension().is_some_and(|e| e == "jsonl") {
                    if let Some(stem) = p.file_stem() {
                        valid_ids.insert(stem.to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    // Cleanup state cache
    match cleanup_state_cache(&db_path, &valid_ids) {
        Ok(n) if n > 0 && verbose => {
            println!(
                "      {} State cache: removed {} stale entries",
                "[OK]".green(),
                n
            );
        }
        _ => {}
    }

    // Fix memento
    let preferred_id = read_chat_session_index(&db_path).ok().and_then(|idx| {
        idx.entries
            .iter()
            .filter(|(_, e)| !e.is_empty)
            .max_by_key(|(_, e)| e.last_message_date)
            .map(|(id, _)| id.clone())
    });
    match fix_session_memento(&db_path, &valid_ids, preferred_id.as_deref()) {
        Ok(true) if verbose => {
            println!(
                "      {} Memento updated to: {}",
                "[OK]".green(),
                preferred_id.as_deref().unwrap_or("(first valid)"),
            );
        }
        _ => {}
    }

    // Fix broken view state (sessions hidden in sidebar)
    match fix_broken_view_state(&db_path) {
        Ok(true) if verbose => {
            println!(
                "      {} Removed broken view state (all sections were hidden)",
                "[OK]".green()
            );
        }
        _ => {}
    }

    Ok(())
}

/// Repair all workspaces that have chat sessions
fn register_repair_all(force: bool, close_vscode: bool, reopen: bool) -> Result<()> {
    let should_close = close_vscode || reopen;

    println!(
        "{} Repairing all workspaces with chat sessions...\n",
        "[IRONBRIDGE]".cyan().bold(),
    );

    // Handle VS Code lifecycle once for all workspaces
    let vscode_was_running = is_vscode_running();
    if vscode_was_running {
        if should_close {
            if !confirm_close_vscode(force) {
                println!("{} Aborted.", "[!]".yellow());
                return Ok(());
            }
            println!("   {} Closing VS Code (saving state)...", "[*]".yellow());
            close_vscode_and_wait(30)?;
            println!("   {} VS Code closed.\n", "[OK]".green());
        } else if !force {
            println!(
                "{} VS Code is running. Its in-memory cache will overwrite index changes.",
                "[!]".yellow()
            );
            println!(
                "   Use {} to close VS Code first, or {} to force.",
                "--reopen".cyan(),
                "--force".cyan()
            );
            return Err(IronBridgeError::VSCodeRunning.into());
        }
    }

    let workspaces = discover_workspaces()?;
    let ws_with_sessions: Vec<_> = workspaces
        .iter()
        .filter(|w| w.has_chat_sessions && w.chat_session_count > 0)
        .collect();

    if ws_with_sessions.is_empty() {
        println!("{} No workspaces with chat sessions found.", "[!]".yellow());
        return Ok(());
    }

    println!(
        "   Found {} workspaces with chat sessions\n",
        ws_with_sessions.len().to_string().cyan()
    );

    let mut total_compacted = 0usize;
    let mut total_synced = 0usize;
    let mut succeeded = 0usize;
    let mut failed = 0usize;

    for (i, ws) in ws_with_sessions.iter().enumerate() {
        let display_name = ws.project_path.as_deref().unwrap_or(&ws.hash);
        println!(
            "[{}/{}] {} {}",
            i + 1,
            ws_with_sessions.len(),
            "===".dimmed(),
            display_name.cyan()
        );

        let chat_sessions_dir = ws.workspace_path.join("chatSessions");
        if !chat_sessions_dir.exists() {
            println!(
                "   {} No chatSessions directory, skipping.\n",
                "[!]".yellow()
            );
            continue;
        }

        match repair_workspace_sessions(&ws.hash, &chat_sessions_dir, true) {
            Ok((compacted, index_fixed)) => {
                // Delete stale .json files when a .jsonl exists for the same session
                let mut deleted_json = 0;
                let mut jsonl_sessions: HashSet<String> = HashSet::new();
                for entry in std::fs::read_dir(&chat_sessions_dir)? {
                    let entry = entry?;
                    let p = entry.path();
                    if p.extension().is_some_and(|e| e == "jsonl") {
                        if let Some(stem) = p.file_stem() {
                            jsonl_sessions.insert(stem.to_string_lossy().to_string());
                        }
                    }
                }
                for entry in std::fs::read_dir(&chat_sessions_dir)? {
                    let entry = entry?;
                    let p = entry.path();
                    if p.extension().is_some_and(|e| e == "json") {
                        if let Some(stem) = p.file_stem() {
                            if jsonl_sessions.contains(&stem.to_string_lossy().to_string()) {
                                let bak = p.with_extension("json.bak");
                                std::fs::rename(&p, &bak)?;
                                deleted_json += 1;
                            }
                        }
                    }
                }
                if deleted_json > 0 {
                    repair_workspace_sessions(&ws.hash, &chat_sessions_dir, true)?;
                }

                // Repair DB caches (model cache, state cache, memento, .json.bak recovery)
                let _ = repair_workspace_db_caches(&ws.hash, &chat_sessions_dir, false);

                total_compacted += compacted;
                total_synced += index_fixed;
                succeeded += 1;
                println!(
                    "   {} {} compacted, {} synced{}\n",
                    "[OK]".green(),
                    compacted,
                    index_fixed,
                    if deleted_json > 0 {
                        format!(", {} stale .json backed up", deleted_json)
                    } else {
                        String::new()
                    }
                );
            }
            Err(e) => {
                failed += 1;
                println!("   {} {}\n", "[ERR]".red(), e);
            }
        }
    }

    println!(
        "{} Repair complete: {}/{} workspaces, {} compacted, {} index entries synced",
        "[OK]".green().bold(),
        succeeded.to_string().green(),
        ws_with_sessions.len(),
        total_compacted.to_string().cyan(),
        total_synced.to_string().cyan()
    );
    if failed > 0 {
        println!(
            "   {} {} workspace(s) had errors",
            "[!]".yellow(),
            failed.to_string().red()
        );
    }

    // Reopen VS Code if requested
    if reopen && vscode_was_running {
        println!("   {} Reopening VS Code...", "[*]".yellow());
        reopen_vscode(None)?;
        println!(
            "   {} VS Code launched. Sessions should now load correctly.",
            "[OK]".green()
        );
    } else if should_close && vscode_was_running {
        println!(
            "\n{} VS Code was closed. Reopen it to see the repaired sessions.",
            "[!]".yellow()
        );
    }

    Ok(())
}

/// Trim oversized sessions by keeping only the most recent requests.
///
/// Very long chat sessions (100+ requests) can grow to 50-100+ MB, which causes
/// VS Code to fail loading them. This command trims the requests array to keep
/// only the most recent N entries, dramatically reducing file size. The full
/// session is preserved as a `.jsonl.bak` backup.
pub fn register_trim(
    project_path: Option<&str>,
    keep: usize,
    session_id: Option<&str>,
    all: bool,
    threshold_mb: u64,
    force: bool,
) -> Result<()> {
    let path = resolve_path(project_path);

    println!(
        "{} Trimming oversized sessions for: {}",
        "[IRONBRIDGE]".cyan().bold(),
        path.display()
    );

    // Find the workspace
    let path_str = path.to_string_lossy().to_string();
    let (ws_id, ws_path, _folder) = find_workspace_by_path(&path_str)?
        .ok_or_else(|| IronBridgeError::WorkspaceNotFound(path.display().to_string()))?;

    let chat_sessions_dir = ws_path.join("chatSessions");

    if !chat_sessions_dir.exists() {
        println!(
            "{} No chatSessions directory found at: {}",
            "[!]".yellow(),
            chat_sessions_dir.display()
        );
        return Ok(());
    }

    // Check VS Code
    if !force && is_vscode_running() {
        println!(
            "{} VS Code is running. Use {} to force.",
            "[!]".yellow(),
            "--force".cyan()
        );
        return Err(IronBridgeError::VSCodeRunning.into());
    }

    let mut trimmed_count = 0;

    if let Some(sid) = session_id {
        // Trim a specific session
        let jsonl_path = chat_sessions_dir.join(format!("{}.jsonl", sid));
        if !jsonl_path.exists() {
            return Err(IronBridgeError::InvalidSessionFormat(format!(
                "Session not found: {}",
                sid
            ))
            .into());
        }

        let size_mb = std::fs::metadata(&jsonl_path)?.len() / (1024 * 1024);
        println!(
            "   {} Trimming {} ({}MB, keeping last {} requests)...",
            "[*]".cyan(),
            sid,
            size_mb,
            keep
        );

        match trim_session_jsonl(&jsonl_path, keep) {
            Ok((orig, kept, orig_mb, new_mb)) => {
                println!(
                    "   {} Trimmed: {} → {} requests, {:.1}MB → {:.1}MB",
                    "[OK]".green(),
                    orig,
                    kept,
                    orig_mb,
                    new_mb
                );
                trimmed_count += 1;
            }
            Err(e) => {
                println!("   {} Failed to trim {}: {}", "[ERR]".red(), sid, e);
            }
        }
    } else if all {
        // Trim all sessions over the threshold
        for entry in std::fs::read_dir(&chat_sessions_dir)? {
            let entry = entry?;
            let p = entry.path();
            if p.extension().is_some_and(|e| e == "jsonl") {
                let size = std::fs::metadata(&p)?.len();
                let size_mb_val = size / (1024 * 1024);

                if size_mb_val >= threshold_mb {
                    let stem = p
                        .file_stem()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_default();
                    println!(
                        "   {} Trimming {} ({}MB, keeping last {} requests)...",
                        "[*]".cyan(),
                        stem,
                        size_mb_val,
                        keep
                    );

                    match trim_session_jsonl(&p, keep) {
                        Ok((orig, kept, orig_mb, new_mb)) => {
                            println!(
                                "   {} Trimmed: {} → {} requests, {:.1}MB → {:.1}MB",
                                "[OK]".green(),
                                orig,
                                kept,
                                orig_mb,
                                new_mb
                            );
                            trimmed_count += 1;
                        }
                        Err(e) => {
                            println!("   {} Failed to trim {}: {}", "[WARN]".yellow(), stem, e);
                        }
                    }
                }
            }
        }
    } else {
        // Auto-detect: find the largest session over the threshold
        let mut largest: Option<(PathBuf, u64)> = None;

        for entry in std::fs::read_dir(&chat_sessions_dir)? {
            let entry = entry?;
            let p = entry.path();
            if p.extension().is_some_and(|e| e == "jsonl") {
                let size = std::fs::metadata(&p)?.len();
                let size_mb_val = size / (1024 * 1024);

                if size_mb_val >= threshold_mb && largest.as_ref().map_or(true, |(_, s)| size > *s)
                {
                    largest = Some((p, size));
                }
            }
        }

        match largest {
            Some((p, size)) => {
                let stem = p
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();
                let size_mb_val = size / (1024 * 1024);
                println!(
                    "   {} Trimming largest session: {} ({}MB, keeping last {} requests)...",
                    "[*]".cyan(),
                    stem,
                    size_mb_val,
                    keep
                );

                match trim_session_jsonl(&p, keep) {
                    Ok((orig, kept, orig_mb, new_mb)) => {
                        println!(
                            "   {} Trimmed: {} → {} requests, {:.1}MB → {:.1}MB",
                            "[OK]".green(),
                            orig,
                            kept,
                            orig_mb,
                            new_mb
                        );
                        trimmed_count += 1;
                    }
                    Err(e) => {
                        println!("   {} Failed to trim: {}", "[ERR]".red(), e);
                    }
                }
            }
            None => {
                println!(
                    "   {} No sessions found over {}MB threshold. Use {} to lower the threshold.",
                    "[*]".cyan(),
                    threshold_mb,
                    "--threshold-mb".cyan()
                );
            }
        }
    }

    if trimmed_count > 0 {
        // Re-sync the index
        let _ = repair_workspace_sessions(&ws_id, &chat_sessions_dir, true);
        println!(
            "\n{} Trim complete: {} session(s) trimmed. Full history backed up as .jsonl.bak",
            "[OK]".green().bold(),
            trimmed_count.to_string().cyan()
        );
    }

    Ok(())
}
