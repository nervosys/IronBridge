//! Export and import commands

use anyhow::{Context, Result};
use colored::*;
use std::path::Path;

use crate::workspace::{get_workspace_by_hash, get_workspace_by_path};

/// Export chat sessions from a workspace
pub fn export_sessions(
    destination: &str,
    hash: Option<&str>,
    path: Option<&str>,
) -> Result<()> {
    let workspace = if let Some(h) = hash {
        get_workspace_by_hash(h)?
            .context(format!("Workspace not found with hash: {}", h))?
    } else if let Some(p) = path {
        get_workspace_by_path(p)?
            .context(format!("Workspace not found for path: {}", p))?
    } else {
        anyhow::bail!("Must specify either --hash or --path");
    };
    
    if !workspace.has_chat_sessions {
        println!("No chat sessions to export.");
        return Ok(());
    }
    
    // Create destination directory
    let dest_path = Path::new(destination);
    std::fs::create_dir_all(dest_path)?;
    
    // Copy all session files
    let mut exported_count = 0;
    for entry in std::fs::read_dir(&workspace.chat_sessions_path)? {
        let entry = entry?;
        let src_path = entry.path();
        
        if src_path.extension().map(|e| e == "json").unwrap_or(false) {
            let dest_file = dest_path.join(entry.file_name());
            std::fs::copy(&src_path, &dest_file)?;
            exported_count += 1;
        }
    }
    
    println!("{} Exported {} chat session(s) to {}", "[OK]".green(), exported_count, destination);
    
    Ok(())
}

/// Import chat sessions into a workspace
pub fn import_sessions(
    source: &str,
    hash: Option<&str>,
    path: Option<&str>,
    force: bool,
) -> Result<()> {
    let src_path = Path::new(source);
    if !src_path.exists() {
        anyhow::bail!("Source path not found: {}", source);
    }
    
    let workspace = if let Some(h) = hash {
        get_workspace_by_hash(h)?
            .context(format!("Workspace not found with hash: {}", h))?
    } else if let Some(p) = path {
        get_workspace_by_path(p)?
            .context(format!("Workspace not found for path: {}", p))?
    } else {
        anyhow::bail!("Must specify either --hash or --path");
    };
    
    // Create chatSessions directory if it doesn't exist
    std::fs::create_dir_all(&workspace.chat_sessions_path)?;
    
    // Import all JSON files
    let mut imported_count = 0;
    let mut skipped_count = 0;
    
    for entry in std::fs::read_dir(src_path)? {
        let entry = entry?;
        let src_file = entry.path();
        
        if src_file.extension().map(|e| e == "json").unwrap_or(false) {
            let dest_file = workspace.chat_sessions_path.join(entry.file_name());
            
            if dest_file.exists() && !force {
                skipped_count += 1;
            } else {
                std::fs::copy(&src_file, &dest_file)?;
                imported_count += 1;
            }
        }
    }
    
    println!("{} Imported {} chat session(s)", "[OK]".green(), imported_count);
    if skipped_count > 0 {
        println!("{} Skipped {} existing session(s). Use --force to overwrite.", "[!]".yellow(), skipped_count);
    }
    
    Ok(())
}

/// Move chat sessions from one workspace to another
pub fn move_sessions(source_hash: &str, target_path: &str) -> Result<()> {
    let source_ws = get_workspace_by_hash(source_hash)?
        .context(format!("Source workspace not found: {}", source_hash))?;
    
    let target_ws = get_workspace_by_path(target_path)?
        .context(format!("Target workspace not found for path: {}", target_path))?;
    
    if !source_ws.has_chat_sessions {
        println!("No chat sessions to move.");
        return Ok(());
    }
    
    // Create chatSessions directory in target if needed
    std::fs::create_dir_all(&target_ws.chat_sessions_path)?;
    
    // Move all session files
    let mut moved_count = 0;
    for entry in std::fs::read_dir(&source_ws.chat_sessions_path)? {
        let entry = entry?;
        let src_file = entry.path();
        
        if src_file.extension().map(|e| e == "json").unwrap_or(false) {
            let dest_file = target_ws.chat_sessions_path.join(entry.file_name());
            std::fs::rename(&src_file, &dest_file)?;
            moved_count += 1;
        }
    }
    
    println!("{} Moved {} chat session(s) to {}", "[OK]".green(), moved_count, target_path);
    
    Ok(())
}
