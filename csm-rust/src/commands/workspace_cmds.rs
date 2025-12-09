//! Workspace listing commands

use anyhow::Result;
use tabled::{Table, Tabled, settings::Style};

use crate::workspace::discover_workspaces;
use crate::models::Workspace;

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
            project_path: ws.project_path.clone().unwrap_or_else(|| "(none)".to_string()),
            sessions: ws.chat_session_count,
            has_chats: if ws.has_chat_sessions { "Yes".to_string() } else { "No".to_string() },
        })
        .collect();
    
    let table = Table::new(rows)
        .with(Style::ascii_rounded())
        .to_string();
    
    println!("{}", table);
    println!("\nTotal workspaces: {}", workspaces.len());
    
    Ok(())
}

/// List all chat sessions
pub fn list_sessions(project_path: Option<&str>) -> Result<()> {
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
    
    let mut rows: Vec<SessionRow> = Vec::new();
    
    for ws in filtered_workspaces {
        if !ws.has_chat_sessions {
            continue;
        }
        
        let sessions = crate::workspace::get_chat_sessions_from_workspace(&ws.workspace_path)?;
        
        for session_with_path in sessions {
            let modified = session_with_path.path
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .map(|t| {
                    let datetime: chrono::DateTime<chrono::Utc> = t.into();
                    datetime.format("%Y-%m-%d %H:%M").to_string()
                })
                .unwrap_or_else(|| "unknown".to_string());
            
            rows.push(SessionRow {
                project_path: ws.project_path.clone().unwrap_or_else(|| "(none)".to_string()),
                session_file: session_with_path.path.file_name()
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
        .with(Style::ascii_rounded())
        .to_string();
    
    println!("{}", table);
    println!("\nTotal sessions: {}", rows.len());
    
    Ok(())
}

/// Find workspaces by search pattern
pub fn find_workspaces(pattern: &str) -> Result<()> {
    let workspaces = discover_workspaces()?;
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
            project_path: ws.project_path.clone().unwrap_or_else(|| "(none)".to_string()),
            sessions: ws.chat_session_count,
            has_chats: if ws.has_chat_sessions { "Yes".to_string() } else { "No".to_string() },
        })
        .collect();
    
    let table = Table::new(rows)
        .with(Style::ascii_rounded())
        .to_string();
    
    println!("{}", table);
    println!("\nFound {} matching workspace(s)", matching.len());
    
    Ok(())
}

/// Find sessions by search pattern
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
            let session_id_matches = session_with_path.session.session_id
                .as_ref()
                .map(|id| id.to_lowercase().contains(&pattern_lower))
                .unwrap_or(false);
            let title_matches = session_with_path.session.title().to_lowercase().contains(&pattern_lower);
            let content_matches = session_with_path.session.requests.iter().any(|r| {
                r.message.as_ref()
                    .map(|m| m.text.as_ref().map(|t| t.to_lowercase().contains(&pattern_lower)).unwrap_or(false))
                    .unwrap_or(false)
            });
            
            if !session_id_matches && !title_matches && !content_matches {
                continue;
            }
            
            let modified = session_with_path.path
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .map(|t| {
                    let datetime: chrono::DateTime<chrono::Utc> = t.into();
                    datetime.format("%Y-%m-%d %H:%M").to_string()
                })
                .unwrap_or_else(|| "unknown".to_string());
            
            rows.push(SessionRow {
                project_path: ws.project_path.clone().unwrap_or_else(|| "(none)".to_string()),
                session_file: session_with_path.path.file_name()
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
        .with(Style::ascii_rounded())
        .to_string();
    
    println!("{}", table);
    println!("\nFound {} matching session(s)", rows.len());
    
    Ok(())
}
