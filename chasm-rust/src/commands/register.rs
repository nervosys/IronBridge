// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only
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

use crate::error::CsmError;
use crate::models::ChatSession;
use crate::storage::{
    add_session_to_index, close_vscode_and_wait, diagnose_workspace_sessions,
    get_workspace_storage_db, is_session_file_extension, is_vscode_running, parse_session_file,
    parse_session_json, read_chat_session_index, register_all_sessions_from_directory,
    reopen_vscode, repair_workspace_sessions, trim_session_jsonl,
};
use crate::workspace::{discover_workspaces, find_workspace_by_path, normalize_path};

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
) -> Result<()> {
    let path = resolve_path(project_path);
    // --reopen implies --close-vscode
    let should_close = close_vscode || reopen;

    if merge {
        println!(
            "{} Merging and registering all sessions for: {}",
            "[CSM]".cyan().bold(),
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
        "[CSM]".cyan().bold(),
        path.display()
    );

    // Find the workspace
    let path_str = path.to_string_lossy().to_string();
    let (ws_id, ws_path, _folder) = find_workspace_by_path(&path_str)?
        .ok_or_else(|| CsmError::WorkspaceNotFound(path.display().to_string()))?;

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
                "   Use {} to close VS Code first, register, and reopen.",
                "--reopen".cyan()
            );
            println!(
                "   Use {} to just close VS Code first.",
                "--close-vscode".cyan()
            );
            println!(
                "   Use {} to write anyway (works after restarting VS Code).",
                "--force".cyan()
            );
            return Err(CsmError::VSCodeRunning.into());
        }
    }

    // Count sessions on disk
    let sessions_on_disk = count_sessions_in_directory(&chat_sessions_dir)?;
    println!(
        "   Found {} session files on disk",
        sessions_on_disk.to_string().green()
    );

    // Register all sessions
    let registered = register_all_sessions_from_directory(&ws_id, &chat_sessions_dir, true)?;

    println!(
        "\n{} Registered {} sessions in VS Code's index",
        "[OK]".green().bold(),
        registered.to_string().cyan()
    );

    // Reopen VS Code if requested (or if we closed it with --reopen)
    if reopen && vscode_was_running {
        println!("   {} Reopening VS Code...", "[*]".yellow());
        reopen_vscode(Some(&path_str))?;
        println!(
            "   {} VS Code launched. Sessions should appear in Copilot Chat history.",
            "[OK]".green()
        );
    } else if should_close && vscode_was_running {
        println!(
            "\n{} VS Code was closed. Reopen it to see the recovered sessions.",
            "[!]".yellow()
        );
        println!("   Run: {}", format!("code {}", path.display()).cyan());
    } else if force && vscode_was_running {
        // VS Code is still running with --force, show reload instructions
        println!(
            "\n{} VS Code caches the session index in memory.",
            "[!]".yellow()
        );
        println!("   To see the new sessions, do one of the following:");
        println!(
            "   * Press {} and run {}",
            "Ctrl+Shift+P".cyan(),
            "Developer: Reload Window".cyan()
        );
        println!("   * Or restart VS Code");
    }

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
        .ok_or_else(|| CsmError::WorkspaceNotFound(path.display().to_string()))?;

    let chat_sessions_dir = ws_path.join("chatSessions");

    // Check if VS Code is running
    if !force && is_vscode_running() {
        println!(
            "{} VS Code is running. Use {} to register anyway.",
            "[!]".yellow(),
            "--force".cyan()
        );
        return Err(CsmError::VSCodeRunning.into());
    }

    // Get the database path
    let db_path = get_workspace_storage_db(&ws_id)?;

    let mut registered_count = 0;

    if let Some(titles) = titles {
        // Register by title
        println!(
            "{} Registering {} sessions by title:",
            "[CSM]".cyan().bold(),
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

            let id_display = if session_id.len() > 12 {
                &session_id[..12]
            } else {
                &session_id
            };
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
            "[CSM]".cyan().bold(),
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

                    let id_display = if actual_session_id.len() > 12 {
                        &actual_session_id[..12]
                    } else {
                        &actual_session_id
                    };
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
        "[CSM]".cyan().bold(),
        path.display()
    );

    // Find the workspace
    let path_str = path.to_string_lossy().to_string();
    let (ws_id, ws_path, _folder) = find_workspace_by_path(&path_str)?
        .ok_or_else(|| CsmError::WorkspaceNotFound(path.display().to_string()))?;

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

    for (_, path) in &session_files {
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
        let id_display = if session_id.len() > 12 {
            &session_id[..12]
        } else {
            session_id
        };
        println!(
            "   {} {} ({} messages)",
            id_display.cyan(),
            format!("\"{}\"", title).yellow(),
            msg_count
        );
    }

    println!("\n{} To register all orphaned sessions:", "->".cyan());
    println!("   csm register all --force");
    println!("\n{} To register specific sessions:", "->".cyan());
    println!("   csm register session <ID1> <ID2> ... --force");

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

    best_match.ok_or_else(|| CsmError::SessionNotFound(session_id.to_string()).into())
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

    for (_, path) in &session_files {
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

/// Recursively walk directories and register orphaned sessions for all workspaces found
pub fn register_recursive(
    root_path: Option<&str>,
    max_depth: Option<usize>,
    force: bool,
    dry_run: bool,
    exclude_patterns: &[String],
) -> Result<()> {
    let root = resolve_path(root_path);

    println!(
        "{} Scanning for workspaces recursively from: {}",
        "[CSM]".cyan().bold(),
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
        return Err(CsmError::VSCodeRunning.into());
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

    let mut total_dirs_scanned = 0;
    let mut workspaces_found = 0;
    let mut total_sessions_registered = 0;
    let mut workspaces_with_orphans: Vec<(String, usize, usize)> = Vec::new();

    // Walk the directory tree
    walk_directory(
        &root,
        &root,
        0,
        max_depth,
        &workspace_map,
        &exclude_matchers,
        &default_excludes,
        force,
        dry_run,
        &mut total_dirs_scanned,
        &mut workspaces_found,
        &mut total_sessions_registered,
        &mut workspaces_with_orphans,
    )?;

    // Print summary
    println!("\n{}", "═".repeat(60).cyan());
    println!("{} Recursive scan complete", "[OK]".green().bold());
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
            "   * Run: {} (if CSM extension is installed)",
            "code --command csm.reloadAndShowChats".cyan()
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

/// Recursively walk a directory and process workspaces
#[allow(clippy::too_many_arguments)]
fn walk_directory(
    current_dir: &Path,
    root: &Path,
    current_depth: usize,
    max_depth: Option<usize>,
    workspace_map: &std::collections::HashMap<String, Vec<&crate::models::Workspace>>,
    exclude_matchers: &[glob::Pattern],
    default_excludes: &[&str],
    force: bool,
    dry_run: bool,
    total_dirs_scanned: &mut usize,
    workspaces_found: &mut usize,
    total_sessions_registered: &mut usize,
    workspaces_with_orphans: &mut Vec<(String, usize, usize)>,
) -> Result<()> {
    // Check depth limit
    if let Some(max) = max_depth {
        if current_depth > max {
            return Ok(());
        }
    }

    *total_dirs_scanned += 1;

    // Get directory name for exclusion checking
    let dir_name = current_dir
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    // Skip default excluded directories
    if default_excludes.contains(&dir_name.as_str()) {
        return Ok(());
    }

    // Skip if matches user exclusion patterns
    let relative_path = current_dir
        .strip_prefix(root)
        .unwrap_or(current_dir)
        .to_string_lossy();
    for pattern in exclude_matchers {
        if pattern.matches(&relative_path) || pattern.matches(&dir_name) {
            return Ok(());
        }
    }

    // Check if this directory is a VS Code workspace
    let normalized_path = normalize_path(&current_dir.to_string_lossy());
    if let Some(workspace_entries) = workspace_map.get(&normalized_path) {
        *workspaces_found += 1;

        for ws in workspace_entries {
            // Check for orphaned sessions in this workspace
            if ws.has_chat_sessions {
                let chat_sessions_dir = &ws.chat_sessions_path;

                // Count orphaned sessions
                match count_orphaned_sessions(&ws.hash, chat_sessions_dir) {
                    Ok((on_disk, in_index, orphaned_count)) => {
                        if orphaned_count > 0 {
                            let display_path = ws.project_path.as_deref().unwrap_or(&ws.hash);

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
                                        *total_sessions_registered += registered;
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
                        let display_path = ws.project_path.as_deref().unwrap_or(&ws.hash);
                        println!(
                            "   {} {} - error checking: {}",
                            "[!]".yellow(),
                            display_path,
                            e
                        );
                    }
                }
            }
        }
    }

    // Recurse into subdirectories
    match std::fs::read_dir(current_dir) {
        Ok(entries) => {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    // Skip hidden directories
                    let name = path
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();
                    if name.starts_with('.') {
                        continue;
                    }

                    walk_directory(
                        &path,
                        root,
                        current_depth + 1,
                        max_depth,
                        workspace_map,
                        exclude_matchers,
                        default_excludes,
                        force,
                        dry_run,
                        total_dirs_scanned,
                        workspaces_found,
                        total_sessions_registered,
                        workspaces_with_orphans,
                    )?;
                }
            }
        }
        Err(e) => {
            // Permission denied or other errors - skip silently
            if e.kind() != std::io::ErrorKind::PermissionDenied {
                eprintln!(
                    "   {} Could not read {}: {}",
                    "[!]".yellow(),
                    current_dir.display(),
                    e
                );
            }
        }
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
        "[CSM]".cyan().bold(),
        path.display()
    );

    // Find the workspace
    let path_str = path.to_string_lossy().to_string();
    let (ws_id, ws_path, _folder) = find_workspace_by_path(&path_str)?
        .ok_or_else(|| CsmError::WorkspaceNotFound(path.display().to_string()))?;

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
            return Err(CsmError::VSCodeRunning.into());
        }
    }

    // Run the repair
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
        "[CSM]".cyan().bold(),
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
            return Err(CsmError::VSCodeRunning.into());
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
    fn walk_for_repair(
        dir: &Path,
        root: &Path,
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
                                    match repair_workspace_sessions(
                                        &ws.hash,
                                        &chat_dir,
                                        force || true,
                                    ) {
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
                                            issue.session_id[..8.min(issue.session_id.len())]
                                                .to_string(),
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
                root,
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

/// Repair all workspaces that have chat sessions
fn register_repair_all(force: bool, close_vscode: bool, reopen: bool) -> Result<()> {
    let should_close = close_vscode || reopen;

    println!(
        "{} Repairing all workspaces with chat sessions...\n",
        "[CSM]".cyan().bold(),
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
            return Err(CsmError::VSCodeRunning.into());
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
        "[CSM]".cyan().bold(),
        path.display()
    );

    // Find the workspace
    let path_str = path.to_string_lossy().to_string();
    let (ws_id, ws_path, _folder) = find_workspace_by_path(&path_str)?
        .ok_or_else(|| CsmError::WorkspaceNotFound(path.display().to_string()))?;

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
        return Err(CsmError::VSCodeRunning.into());
    }

    let mut trimmed_count = 0;

    if let Some(sid) = session_id {
        // Trim a specific session
        let jsonl_path = chat_sessions_dir.join(format!("{}.jsonl", sid));
        if !jsonl_path.exists() {
            return Err(
                CsmError::InvalidSessionFormat(format!("Session not found: {}", sid)).into(),
            );
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

                if size_mb_val >= threshold_mb {
                    if largest.as_ref().map_or(true, |(_, s)| size > *s) {
                        largest = Some((p, size));
                    }
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
