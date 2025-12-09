//! History commands (show, fetch, merge)

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use colored::*;
use std::path::Path;
use uuid::Uuid;

use crate::models::{ChatRequest, ChatSession};
use crate::storage::{
    add_session_to_index, backup_workspace_sessions, get_workspace_storage_db,
    is_vscode_running, register_all_sessions_from_directory,
};
use crate::workspace::{
    find_all_workspaces_for_project, find_workspace_by_path,
    get_chat_sessions_from_workspace,
};

/// Show all chat sessions across workspaces for current project
pub fn history_show(project_path: Option<&str>) -> Result<()> {
    let project_path = project_path
        .map(|p| p.to_string())
        .unwrap_or_else(|| std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string()));
    
    let project_name = Path::new(&project_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| project_path.clone());
    
    println!("\n{} Chat History for: {}", "[*]".blue(), project_name.cyan());
    println!("{}", "=".repeat(70));
    
    // Find all workspaces for this project
    let all_workspaces = find_all_workspaces_for_project(&project_name)?;
    
    if all_workspaces.is_empty() {
        println!("\n{} No workspaces found matching '{}'", "[!]".yellow(), project_name);
        return Ok(());
    }
    
    // Find current workspace
    let current_ws = find_workspace_by_path(&project_path)?;
    let current_ws_id = current_ws.as_ref().map(|(id, _, _)| id.clone());
    
    let mut total_sessions = 0;
    let mut total_requests = 0;
    
    for (ws_id, ws_dir, folder_path, last_mod) in &all_workspaces {
        let is_current = current_ws_id.as_ref() == Some(ws_id);
        let marker = if is_current { "-> " } else { "   " };
        let label = if is_current { " (current)".green().to_string() } else { "".to_string() };
        
        let mod_date: DateTime<Utc> = (*last_mod).into();
        let mod_str = mod_date.format("%Y-%m-%d %H:%M").to_string();
        
        let sessions = get_chat_sessions_from_workspace(ws_dir)?;
        
        println!("\n{}Workspace: {}...{}", 
            marker.cyan(),
            &ws_id[..16.min(ws_id.len())],
            label
        );
        println!("   Path: {}", folder_path.as_deref().unwrap_or("(none)"));
        println!("   Modified: {}", mod_str);
        println!("   Sessions: {}", sessions.len());
        
        if !sessions.is_empty() {
            for session_with_path in &sessions {
                let session = &session_with_path.session;
                let title = session.title();
                let request_count = session.request_count();
                
                // Get timestamp range
                let date_range = if let Some((first, last)) = session.timestamp_range() {
                    let first_date = timestamp_to_date(first);
                    let last_date = timestamp_to_date(last);
                    if first_date == last_date {
                        first_date
                    } else {
                        format!("{} -> {}", first_date, last_date)
                    }
                } else {
                    "empty".to_string()
                };
                
                println!("     {} {:<40} ({:3} msgs) [{}]",
                    "[-]".blue(),
                    truncate(&title, 40),
                    request_count,
                    date_range
                );
                
                total_requests += request_count;
                total_sessions += 1;
            }
        }
    }
    
    println!("\n{}", "=".repeat(70));
    println!("Total: {} sessions, {} messages across {} workspace(s)",
        total_sessions, total_requests, all_workspaces.len());
    
    Ok(())
}

/// Fetch chat sessions from other workspaces into current workspace
pub fn history_fetch(project_path: Option<&str>, force: bool, no_register: bool) -> Result<()> {
    let project_path = project_path
        .map(|p| p.to_string())
        .unwrap_or_else(|| std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string()));
    
    let project_name = Path::new(&project_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| project_path.clone());
    
    println!("\n{} Fetching Chat History for: {}", "[<]".blue(), project_name.cyan());
    println!("{}", "=".repeat(70));
    
    // Find current workspace
    let current_ws = find_workspace_by_path(&project_path)?
        .context("Current workspace not found. Make sure the project is opened in VS Code")?;
    let (current_ws_id, current_ws_dir, _) = current_ws;
    
    // Find all workspaces for this project
    let all_workspaces = find_all_workspaces_for_project(&project_name)?;
    let historical_workspaces: Vec<_> = all_workspaces
        .into_iter()
        .filter(|(id, _, _, _)| *id != current_ws_id)
        .collect();
    
    if historical_workspaces.is_empty() {
        println!("{} No historical workspaces found for '{}'", "[!]".yellow(), project_name);
        println!("   Only the current workspace exists.");
        return Ok(());
    }
    
    println!("Found {} historical workspace(s)\n", historical_workspaces.len());
    
    // Create chatSessions directory
    let chat_sessions_dir = current_ws_dir.join("chatSessions");
    std::fs::create_dir_all(&chat_sessions_dir)?;
    
    let mut fetched_count = 0;
    let mut skipped_count = 0;
    
    for (_, ws_dir, _, _) in &historical_workspaces {
        let sessions = get_chat_sessions_from_workspace(ws_dir)?;
        
        for session_with_path in sessions {
            // Get session ID from filename if not in data
            let session_id = session_with_path.session.session_id.clone()
                .unwrap_or_else(|| {
                    session_with_path.path.file_stem()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string())
                });
            let dest_file = chat_sessions_dir.join(format!("{}.json", session_id));
            
            if dest_file.exists() && !force {
                println!("   {} Skipped (exists): {}...", "[>]".yellow(), &session_id[..16.min(session_id.len())]);
                skipped_count += 1;
            } else {
                std::fs::copy(&session_with_path.path, &dest_file)?;
                let title = session_with_path.session.title();
                println!("   {} Fetched: {} ({}...)", "[OK]".green(), truncate(&title, 40), &session_id[..16.min(session_id.len())]);
                fetched_count += 1;
            }
        }
    }
    
    println!("\n{}", "=".repeat(70));
    println!("Fetched: {} sessions", fetched_count);
    if skipped_count > 0 {
        println!("Skipped: {} (use --force to overwrite)", skipped_count);
    }
    
    // Register sessions in VS Code index
    if fetched_count > 0 && !no_register {
        println!("\n{} Registering sessions in VS Code index...", "[#]".blue());
        
        if is_vscode_running() && !force {
            println!("{} VS Code is running. Sessions may not appear until restart.", "[!]".yellow());
            println!("   Run 'csm history fetch --force' after closing VS Code to register.");
        } else {
            let registered = register_all_sessions_from_directory(&current_ws_id, &chat_sessions_dir, true)?;
            println!("{} Registered {} sessions in index", "[OK]".green(), registered);
        }
    }
    
    println!("\n{} Reload VS Code (Ctrl+R) and check Chat history dropdown", "[i]".cyan());
    
    Ok(())
}

/// Merge all chat sessions into a single unified chat ordered by timestamp
pub fn history_merge(
    project_path: Option<&str>,
    title: Option<&str>,
    force: bool,
    no_backup: bool,
) -> Result<()> {
    let project_path = project_path
        .map(|p| p.to_string())
        .unwrap_or_else(|| std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| ".".to_string()));
    
    let project_name = Path::new(&project_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| project_path.clone());
    
    println!("\n{} Merging Chat History for: {}", "[M]".blue(), project_name.cyan());
    println!("{}", "=".repeat(70));
    
    // Find current workspace
    let current_ws = find_workspace_by_path(&project_path)?
        .context("Current workspace not found. Make sure the project is opened in VS Code")?;
    let (current_ws_id, current_ws_dir, _) = current_ws;
    
    // Find all workspaces for this project
    let all_workspaces = find_all_workspaces_for_project(&project_name)?;
    
    // Collect ALL sessions from ALL workspaces
    println!("\n{} Collecting sessions from {} workspace(s)...", "[D]".blue(), all_workspaces.len());
    
    let mut all_sessions = Vec::new();
    for (ws_id, ws_dir, _, _) in &all_workspaces {
        let sessions = get_chat_sessions_from_workspace(ws_dir)?;
        if !sessions.is_empty() {
            println!("   {} {}... ({} sessions)", "[d]".blue(), &ws_id[..16.min(ws_id.len())], sessions.len());
            all_sessions.extend(sessions);
        }
    }
    
    if all_sessions.is_empty() {
        println!("\n{} No chat sessions found in any workspace", "[X]".red());
        return Ok(());
    }
    
    println!("\n   Total: {} sessions collected", all_sessions.len());
    
    // Collect all requests with timestamps
    println!("\n{} Extracting and sorting messages...", "[*]".blue());
    
    let mut all_requests: Vec<ChatRequest> = Vec::new();
    for session_with_path in &all_sessions {
        let session = &session_with_path.session;
        let session_title = session.title();
        
        for req in &session.requests {
            let mut req = req.clone();
            // Add source session info
            req.source_session = Some(session_title.clone());
            if req.timestamp.is_some() {
                all_requests.push(req);
            }
        }
    }
    
    if all_requests.is_empty() {
        println!("\n{} No messages found in any session", "[X]".red());
        return Ok(());
    }
    
    // Sort by timestamp
    all_requests.sort_by_key(|r| r.timestamp.unwrap_or(0));
    
    // Get timeline info
    let first_time = all_requests.first().and_then(|r| r.timestamp).unwrap_or(0);
    let last_time = all_requests.last().and_then(|r| r.timestamp).unwrap_or(0);
    
    let first_date = timestamp_to_date(first_time);
    let last_date = timestamp_to_date(last_time);
    let days_span = if first_time > 0 && last_time > 0 {
        ((last_time - first_time) / (1000 * 60 * 60 * 24)) as i64
    } else {
        0
    };
    
    println!("   Messages: {}", all_requests.len());
    println!("   Timeline: {} -> {} ({} days)", first_date, last_date, days_span);
    
    // Create merged session
    println!("\n{} Creating merged session...", "[+]".blue());
    
    let merged_session_id = Uuid::new_v4().to_string();
    let merged_title = title
        .map(|t| t.to_string())
        .unwrap_or_else(|| format!("Merged History ({} sessions, {} days)", all_sessions.len(), days_span));
    
    let merged_session = ChatSession {
        version: 3,
        session_id: Some(merged_session_id.clone()),
        creation_date: first_time,
        last_message_date: last_time,
        is_imported: false,
        initial_location: "panel".to_string(),
        custom_title: Some(merged_title.clone()),
        requester_username: Some("User".to_string()),
        requester_avatar_icon_uri: None, // Optional - VS Code will use default
        responder_username: Some("GitHub Copilot".to_string()),
        responder_avatar_icon_uri: Some(serde_json::json!({"id": "copilot"})),
        requests: all_requests.clone(),
    };
    
    // Create backup if requested
    let chat_sessions_dir = current_ws_dir.join("chatSessions");
    
    if !no_backup {
        if let Some(backup_dir) = backup_workspace_sessions(&current_ws_dir)? {
            println!("   {} Backup: {}", "[B]".blue(), backup_dir.file_name().unwrap().to_string_lossy());
        }
    }
    
    // Write merged session
    std::fs::create_dir_all(&chat_sessions_dir)?;
    let merged_file = chat_sessions_dir.join(format!("{}.json", merged_session_id));
    
    let json = serde_json::to_string_pretty(&merged_session)?;
    std::fs::write(&merged_file, json)?;
    
    println!("   {} File: {}", "[F]".blue(), merged_file.file_name().unwrap().to_string_lossy());
    
    // Register in VS Code index
    println!("\n{} Registering in VS Code index...", "[#]".blue());
    
    if is_vscode_running() && !force {
        println!("{} VS Code is running. Close it and run again, or use --force", "[!]".yellow());
    } else {
        let db_path = get_workspace_storage_db(&current_ws_id)?;
        add_session_to_index(
            &db_path,
            &merged_session_id,
            &merged_title,
            last_time,
            false,
            "panel",
            false,
        )?;
        println!("   {} Registered in index", "[OK]".green());
    }
    
    println!("\n{}", "=".repeat(70));
    println!("{} MERGE COMPLETE!", "[OK]".green().bold());
    println!("\n{} Summary:", "[=]".blue());
    println!("   - Sessions merged: {}", all_sessions.len());
    println!("   - Total messages: {}", all_requests.len());
    println!("   - Timeline: {} days", days_span);
    println!("   - Title: {}", merged_title);
    
    println!("\n{} Next Steps:", "[i]".cyan());
    println!("   1. Reload VS Code (Ctrl+R)");
    println!("   2. Open Chat history dropdown");
    println!("   3. Select: '{}'", merged_title);
    
    Ok(())
}

/// Convert millisecond timestamp to date string
fn timestamp_to_date(timestamp: i64) -> String {
    if timestamp == 0 {
        return "unknown".to_string();
    }
    
    // Handle both milliseconds and seconds
    let secs = if timestamp > 1_000_000_000_000 {
        timestamp / 1000
    } else {
        timestamp
    };
    
    DateTime::from_timestamp(secs, 0)
        .map(|dt| dt.format("%Y-%m-%d").to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

/// Truncate string to max length
fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len - 3])
    }
}
