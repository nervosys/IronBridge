//! Git integration commands

use anyhow::{Context, Result};
use colored::*;
use std::path::Path;
use std::process::Command;

use crate::workspace::get_workspace_by_path;

/// Configure git settings for chat sessions
pub fn git_config(name: Option<&str>, email: Option<&str>, path: Option<&str>) -> Result<()> {
    let project_dir = path.map(Path::new).unwrap_or_else(|| Path::new("."));
    
    // Check if git repo exists
    if !project_dir.join(".git").exists() {
        anyhow::bail!("Not a git repository: {}", project_dir.display());
    }
    
    // If no options provided, show current config
    if name.is_none() && email.is_none() {
        println!("Git configuration for: {}", project_dir.display());
        
        let output = Command::new("git")
            .current_dir(project_dir)
            .args(["config", "--local", "user.name"])
            .output()?;
        let current_name = String::from_utf8_lossy(&output.stdout).trim().to_string();
        
        let output = Command::new("git")
            .current_dir(project_dir)
            .args(["config", "--local", "user.email"])
            .output()?;
        let current_email = String::from_utf8_lossy(&output.stdout).trim().to_string();
        
        println!("  Name:  {}", if current_name.is_empty() { "(not set)".to_string() } else { current_name });
        println!("  Email: {}", if current_email.is_empty() { "(not set)".to_string() } else { current_email });
        return Ok(());
    }
    
    // Set name if provided
    if let Some(n) = name {
        let output = Command::new("git")
            .current_dir(project_dir)
            .args(["config", "--local", "user.name", n])
            .output()?;
        
        if !output.status.success() {
            anyhow::bail!("Failed to set git user.name: {}", String::from_utf8_lossy(&output.stderr));
        }
        println!("{} Set git user.name = {}", "[OK]".green(), n);
    }
    
    // Set email if provided
    if let Some(e) = email {
        let output = Command::new("git")
            .current_dir(project_dir)
            .args(["config", "--local", "user.email", e])
            .output()?;
        
        if !output.status.success() {
            anyhow::bail!("Failed to set git user.email: {}", String::from_utf8_lossy(&output.stderr));
        }
        println!("{} Set git user.email = {}", "[OK]".green(), e);
    }
    
    Ok(())
}

/// Initialize git versioning for chat sessions
pub fn git_init(project_path: &str) -> Result<()> {
    let workspace = get_workspace_by_path(project_path)?
        .context(format!("Workspace not found for path: {}", project_path))?;
    
    let project_dir = Path::new(project_path);
    let vscode_dir = project_dir.join(".vscode");
    let symlink_path = vscode_dir.join("chat-sessions");
    
    // Create .vscode directory if needed
    std::fs::create_dir_all(&vscode_dir)?;
    
    // Create symlink to chat sessions
    if symlink_path.exists() {
        println!("{} Chat versioning already initialized", "[!]".yellow());
        println!("   Symlink: {}", symlink_path.display());
        return Ok(());
    }
    
    #[cfg(unix)]
    std::os::unix::fs::symlink(&workspace.chat_sessions_path, &symlink_path)?;
    
    #[cfg(windows)]
    std::os::windows::fs::symlink_dir(&workspace.chat_sessions_path, &symlink_path)?;
    
    println!("{} Initialized git versioning for chat sessions", "[OK]".green());
    println!("   Symlink: {}", symlink_path.display());
    println!("   Target: {}", workspace.chat_sessions_path.display());
    println!("\nNext steps:");
    println!("  1. Add .vscode/chat-sessions to your .gitignore if you want to exclude them");
    println!("  2. Or commit them: csm add {} --commit -m 'Add chat sessions'", project_path);
    
    Ok(())
}

/// Add chat sessions to git
pub fn git_add(project_path: &str, commit: bool, message: Option<&str>) -> Result<()> {
    let project_dir = Path::new(project_path);
    let chat_sessions_path = project_dir.join(".vscode").join("chat-sessions");
    
    if !chat_sessions_path.exists() {
        anyhow::bail!("Chat versioning not initialized. Run 'csm init {}' first", project_path);
    }
    
    // Stage files
    let output = Command::new("git")
        .current_dir(project_dir)
        .args(["add", ".vscode/chat-sessions"])
        .output()?;
    
    if !output.status.success() {
        anyhow::bail!("Failed to stage chat sessions: {}", String::from_utf8_lossy(&output.stderr));
    }
    
    println!("{} Staged chat sessions for commit", "[OK]".green());
    
    // Commit if requested
    if commit {
        let msg = message.unwrap_or("Update chat sessions");
        
        let output = Command::new("git")
            .current_dir(project_dir)
            .args(["commit", "-m", msg])
            .output()?;
        
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if stderr.contains("nothing to commit") {
                println!("{} Nothing to commit", "[i]".blue());
            } else {
                anyhow::bail!("Failed to commit: {}", stderr);
            }
        } else {
            // Get commit hash
            let output = Command::new("git")
                .current_dir(project_dir)
                .args(["rev-parse", "--short", "HEAD"])
                .output()?;
            
            let hash = String::from_utf8_lossy(&output.stdout).trim().to_string();
            println!("{} Committed: {}", "[OK]".green(), hash);
        }
    }
    
    Ok(())
}

/// Show git status of chat sessions
pub fn git_status(project_path: &str) -> Result<()> {
    let project_dir = Path::new(project_path);
    
    // Check if it's a git repo
    let is_git_repo = project_dir.join(".git").exists();
    
    // Check if versioning is enabled
    let chat_sessions_path = project_dir.join(".vscode").join("chat-sessions");
    let versioning_enabled = chat_sessions_path.exists();
    
    // Get workspace info
    let workspace = get_workspace_by_path(project_path)?;
    let session_count = workspace.map(|w| w.chat_session_count).unwrap_or(0);
    
    println!("Project: {}", project_path);
    println!("Git repository: {}", if is_git_repo { "Yes" } else { "No" });
    println!("Chat versioning: {}", if versioning_enabled { "Enabled" } else { "Disabled" });
    println!("Total sessions: {}", session_count);
    
    if versioning_enabled && is_git_repo {
        // Get git status for chat sessions
        let output = Command::new("git")
            .current_dir(project_dir)
            .args(["status", "--porcelain", ".vscode/chat-sessions"])
            .output()?;
        
        let status = String::from_utf8_lossy(&output.stdout);
        let lines: Vec<&str> = status.lines().collect();
        
        let modified: Vec<_> = lines.iter().filter(|l| l.starts_with(" M") || l.starts_with("M ")).collect();
        let untracked: Vec<_> = lines.iter().filter(|l| l.starts_with("??")).collect();
        let staged: Vec<_> = lines.iter().filter(|l| l.starts_with("A ") || l.starts_with("M ")).collect();
        
        println!("\nGit status:");
        println!("  Modified: {}", modified.len());
        println!("  Untracked: {}", untracked.len());
        println!("  Staged: {}", staged.len());
        
        if !modified.is_empty() {
            println!("\n  Modified files:");
            for (_i, f) in modified.iter().take(5).enumerate() {
                println!("    - {}", f.trim_start_matches(|c: char| c.is_whitespace() || c == 'M'));
            }
            if modified.len() > 5 {
                println!("    ... and {} more", modified.len() - 5);
            }
        }
    }
    
    Ok(())
}

/// Create a git tag snapshot of chat sessions
pub fn git_snapshot(project_path: &str, tag: Option<&str>, message: Option<&str>) -> Result<()> {
    let project_dir = Path::new(project_path);
    let chat_sessions_path = project_dir.join(".vscode").join("chat-sessions");
    
    if !chat_sessions_path.exists() {
        anyhow::bail!("Chat versioning not initialized. Run 'csm init {}' first", project_path);
    }
    
    // Generate tag name if not provided
    let timestamp = chrono::Utc::now().format("%Y%m%d-%H%M%S").to_string();
    let tag_name = tag
        .map(|t| t.to_string())
        .unwrap_or_else(|| format!("chat-snapshot-{}", timestamp));
    
    let msg = message.unwrap_or("Chat session snapshot");
    
    // Stage and commit
    let _ = Command::new("git")
        .current_dir(project_dir)
        .args(["add", ".vscode/chat-sessions"])
        .output()?;
    
    let _ = Command::new("git")
        .current_dir(project_dir)
        .args(["commit", "-m", &format!("Snapshot: {}", msg)])
        .output()?;
    
    // Create tag
    let output = Command::new("git")
        .current_dir(project_dir)
        .args(["tag", "-a", &tag_name, "-m", msg])
        .output()?;
    
    if !output.status.success() {
        anyhow::bail!("Failed to create tag: {}", String::from_utf8_lossy(&output.stderr));
    }
    
    // Get commit hash
    let output = Command::new("git")
        .current_dir(project_dir)
        .args(["rev-parse", "--short", "HEAD"])
        .output()?;
    
    let hash = String::from_utf8_lossy(&output.stdout).trim().to_string();
    
    println!("{} Created snapshot", "[OK]".green());
    println!("   Tag: {}", tag_name);
    println!("   Commit: {}", hash);
    
    Ok(())
}
