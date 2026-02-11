// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only
//! Run commands for launching AI coding agents with auto-save
//!
//! Launches terminal CLI agents (Claude Code, Codex CLI, Cursor, etc.)
//! and automatically harvests the resulting session into the chasm database.

use anyhow::{Context, Result};
use colored::Colorize;
use std::process::Command;
use std::time::Instant;

use crate::providers::ProviderType;

/// Agent binary configuration
#[derive(Debug, Clone)]
pub(crate) struct AgentConfig {
    /// Display name
    pub(crate) name: &'static str,
    /// Provider type for harvest
    pub(crate) provider_type: ProviderType,
    /// Command/binary names to try (in order of preference)
    pub(crate) commands: &'static [&'static str],
    /// Default arguments when launching interactively
    pub(crate) default_args: &'static [&'static str],
    /// Whether this agent creates files we can auto-harvest
    pub(crate) harvestable: bool,
    /// Session storage description
    pub(crate) storage_hint: &'static str,
}

/// All supported agent configurations
pub(crate) const AGENTS: &[AgentConfig] = &[
    AgentConfig {
        name: "Claude Code",
        provider_type: ProviderType::Copilot, // uses ClaudeCode internally but maps to file harvester
        commands: &["claude"],
        default_args: &[],
        harvestable: true,
        storage_hint: "~/.claude/projects/",
    },
    AgentConfig {
        name: "OpenCode",
        provider_type: ProviderType::Custom,
        commands: &["opencode"],
        default_args: &[],
        harvestable: true,
        storage_hint: "~/.opencode/conversations/",
    },
    AgentConfig {
        name: "OpenClaw",
        provider_type: ProviderType::Custom,
        commands: &["openclaw", "clawdbot"],
        default_args: &[],
        harvestable: true,
        storage_hint: "~/.openclaw/chat-history/",
    },
    AgentConfig {
        name: "Cursor CLI",
        provider_type: ProviderType::Cursor,
        commands: &["cursor"],
        default_args: &[],
        harvestable: true,
        storage_hint: "~/.cursor/chats/",
    },
    AgentConfig {
        name: "Codex CLI",
        provider_type: ProviderType::CodexCli,
        commands: &["codex"],
        default_args: &[],
        harvestable: true,
        storage_hint: "~/.codex/sessions/",
    },
    AgentConfig {
        name: "Droid CLI",
        provider_type: ProviderType::DroidCli,
        commands: &["droid", "factory"],
        default_args: &[],
        harvestable: true,
        storage_hint: "~/.factory/sessions/",
    },
    AgentConfig {
        name: "Gemini CLI",
        provider_type: ProviderType::GeminiCli,
        commands: &["gemini"],
        default_args: &[],
        harvestable: true,
        storage_hint: "~/.gemini/tmp/",
    },
];

/// Resolve an agent alias to its configuration
pub(crate) fn resolve_agent(alias: &str) -> Option<&'static AgentConfig> {
    let alias_lower = alias.to_lowercase();
    match alias_lower.as_str() {
        "claude" | "claude-code" | "claudecode" => AGENTS.iter().find(|a| a.name == "Claude Code"),
        "open" | "opencode" | "open-code" => AGENTS.iter().find(|a| a.name == "OpenCode"),
        "claw" | "openclaw" | "clawdbot" | "open-claw" => {
            AGENTS.iter().find(|a| a.name == "OpenClaw")
        }
        "cursor" | "cursor-cli" => AGENTS.iter().find(|a| a.name == "Cursor CLI"),
        "codex" | "codex-cli" | "codexcli" => AGENTS.iter().find(|a| a.name == "Codex CLI"),
        "droid" | "droid-cli" | "droidcli" | "factory" => {
            AGENTS.iter().find(|a| a.name == "Droid CLI")
        }
        "gemini" | "gemini-cli" | "geminicli" => AGENTS.iter().find(|a| a.name == "Gemini CLI"),
        _ => None,
    }
}

/// Find the executable path for an agent
fn find_agent_binary(config: &AgentConfig) -> Option<String> {
    for cmd in config.commands {
        // Try `which`/`where` to find the binary
        #[cfg(target_os = "windows")]
        {
            if let Ok(output) = Command::new("where").arg(cmd).output() {
                if output.status.success() {
                    if let Ok(path) = String::from_utf8(output.stdout) {
                        let path = path.lines().next().unwrap_or("").trim();
                        if !path.is_empty() {
                            return Some(path.to_string());
                        }
                    }
                }
            }
            // Also check common npm global paths
            if let Ok(output) = Command::new("where")
                .arg(format!("{}.cmd", cmd))
                .output()
            {
                if output.status.success() {
                    if let Ok(path) = String::from_utf8(output.stdout) {
                        let path = path.lines().next().unwrap_or("").trim();
                        if !path.is_empty() {
                            return Some(path.to_string());
                        }
                    }
                }
            }
        }
        #[cfg(not(target_os = "windows"))]
        {
            if let Ok(output) = Command::new("which").arg(cmd).output() {
                if output.status.success() {
                    if let Ok(path) = String::from_utf8(output.stdout) {
                        let path = path.trim();
                        if !path.is_empty() {
                            return Some(path.to_string());
                        }
                    }
                }
            }
        }
    }
    None
}

/// Snapshot current session files before agent launch (for diff-based auto-save)
fn snapshot_session_dir(config: &AgentConfig) -> Option<std::collections::HashMap<std::path::PathBuf, std::time::SystemTime>> {
    let home = dirs::home_dir()?;
    let storage_path = resolve_storage_path(&home, config)?;

    if !storage_path.exists() {
        return Some(std::collections::HashMap::new());
    }

    let mut snapshot = std::collections::HashMap::new();
    if let Ok(entries) = std::fs::read_dir(&storage_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Ok(metadata) = path.metadata() {
                    if let Ok(modified) = metadata.modified() {
                        snapshot.insert(path, modified);
                    }
                }
            }
        }
    }
    Some(snapshot)
}

/// Resolve the storage path for an agent from its config
pub(crate) fn resolve_storage_path(home: &std::path::Path, config: &AgentConfig) -> Option<std::path::PathBuf> {
    // Parse storage_hint like "~/.claude/projects/" into actual path
    let hint = config.storage_hint.trim_start_matches("~/");
    let path = home.join(hint);
    Some(path)
}

/// Detect new/modified session files after agent exits
fn detect_new_sessions(
    config: &AgentConfig,
    before: &std::collections::HashMap<std::path::PathBuf, std::time::SystemTime>,
) -> Vec<std::path::PathBuf> {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return vec![],
    };
    let storage_path = match resolve_storage_path(&home, config) {
        Some(p) => p,
        None => return vec![],
    };

    if !storage_path.exists() {
        return vec![];
    }

    let mut new_files = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&storage_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                match before.get(&path) {
                    None => {
                        // New file
                        new_files.push(path);
                    }
                    Some(old_time) => {
                        // Check if modified
                        if let Ok(metadata) = path.metadata() {
                            if let Ok(modified) = metadata.modified() {
                                if modified > *old_time {
                                    new_files.push(path);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Also recurse one level for agents that use per-project subdirs (Claude Code)
    if config.storage_hint.contains("projects") {
        if let Ok(entries) = std::fs::read_dir(&storage_path) {
            for entry in entries.flatten() {
                let subdir = entry.path();
                if subdir.is_dir() {
                    if let Ok(sub_entries) = std::fs::read_dir(&subdir) {
                        for sub_entry in sub_entries.flatten() {
                            let path = sub_entry.path();
                            if path.is_file() {
                                match before.get(&path) {
                                    None => new_files.push(path),
                                    Some(old_time) => {
                                        if let Ok(metadata) = path.metadata() {
                                            if let Ok(modified) = metadata.modified() {
                                                if modified > *old_time {
                                                    new_files.push(path);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    new_files
}

/// Run an agent by alias with auto-save
pub fn run_agent_cli(
    agent_alias: Option<&str>,
    args: &[String],
    no_save: bool,
    verbose: bool,
) -> Result<()> {
    // Resolve agent
    let alias = agent_alias.unwrap_or("claude"); // Default to Claude Code
    let config = resolve_agent(alias).ok_or_else(|| {
        anyhow::anyhow!(
            "Unknown agent '{}'. Supported agents:\n\
             \n  {}  claude    → Claude Code\
             \n  {}  open      → OpenCode\
             \n  {}  claw      → OpenClaw (ClawdBot)\
             \n  {}  cursor    → Cursor CLI\
             \n  {}  codex     → Codex CLI (OpenAI)\
             \n  {}  droid     → Droid CLI (Factory)\
             \n  {}  gemini    → Gemini CLI (Google)\
             \n\nRun 'chasm list agents' to see all agents.",
            alias,
            "*".cyan(),
            "*".cyan(),
            "*".cyan(),
            "*".cyan(),
            "*".cyan(),
            "*".cyan(),
            "*".cyan(),
        )
    })?;

    // Find binary
    let binary = find_agent_binary(config).ok_or_else(|| {
        anyhow::anyhow!(
            "{} not found. Tried: {}\n\
             \nInstall it first:\n\
             \n  {} npm install -g {} (if available)\
             \n  {} Or visit the agent's official website",
            config.name,
            config.commands.join(", "),
            "→".cyan(),
            config.commands[0],
            "→".cyan(),
        )
    })?;

    // Header
    println!("{}", "=".repeat(70).cyan());
    println!(
        "{} Launching {} with auto-save",
        "[>]".green().bold(),
        config.name.bold()
    );
    println!("{}", "=".repeat(70).cyan());
    println!();
    println!("  {} {}", "Binary:".dimmed(), binary);
    println!("  {} {}", "Storage:".dimmed(), config.storage_hint);
    if !no_save {
        println!(
            "  {} Sessions will be auto-saved on exit",
            "Auto-save:".dimmed()
        );
    }
    println!();

    // Snapshot session files before launch
    let before_snapshot = if !no_save && config.harvestable {
        snapshot_session_dir(config)
    } else {
        None
    };

    let timer = Instant::now();

    // Build command
    let mut cmd = Command::new(&binary);
    cmd.args(config.default_args);
    if !args.is_empty() {
        cmd.args(args);
    }

    // Inherit stdio for interactive use
    cmd.stdin(std::process::Stdio::inherit())
        .stdout(std::process::Stdio::inherit())
        .stderr(std::process::Stdio::inherit());

    if verbose {
        println!(
            "{} Running: {} {}",
            "[*]".blue(),
            binary,
            args.join(" ")
        );
    }

    // Launch agent (blocking — waits for user to finish)
    let status = cmd
        .status()
        .with_context(|| format!("Failed to launch {}", config.name))?;

    let elapsed = timer.elapsed();
    let elapsed_str = if elapsed.as_secs() >= 3600 {
        format!(
            "{}h {}m {}s",
            elapsed.as_secs() / 3600,
            (elapsed.as_secs() % 3600) / 60,
            elapsed.as_secs() % 60
        )
    } else if elapsed.as_secs() >= 60 {
        format!(
            "{}m {}s",
            elapsed.as_secs() / 60,
            elapsed.as_secs() % 60
        )
    } else {
        format!("{}s", elapsed.as_secs())
    };

    println!();
    println!("{}", "=".repeat(70).cyan());

    if status.success() {
        println!(
            "{} {} exited successfully ({})",
            "[+]".green().bold(),
            config.name,
            elapsed_str.dimmed()
        );
    } else {
        println!(
            "{} {} exited with code {} ({})",
            "[!]".yellow().bold(),
            config.name,
            status.code().unwrap_or(-1),
            elapsed_str.dimmed()
        );
    }

    // Auto-save: detect new sessions and harvest them
    if !no_save && config.harvestable {
        if let Some(ref before) = before_snapshot {
            let new_sessions = detect_new_sessions(config, before);
            if new_sessions.is_empty() {
                println!(
                    "{} No new session files detected",
                    "[i]".blue()
                );
            } else {
                println!(
                    "{} Detected {} new/modified session file(s)",
                    "[+]".green().bold(),
                    new_sessions.len()
                );
                for f in &new_sessions {
                    if let Some(name) = f.file_name() {
                        println!("   {} {}", "+".green(), name.to_string_lossy().dimmed());
                    }
                }

                // Auto-harvest into the database
                println!();
                println!(
                    "{} Auto-saving to harvest database...",
                    "[*]".blue()
                );

                match auto_harvest_sessions(&new_sessions) {
                    Ok(count) => {
                        println!(
                            "{} Saved {} session(s) to harvest database",
                            "[+]".green().bold(),
                            count
                        );
                    }
                    Err(e) => {
                        println!(
                            "{} Auto-save failed: {}",
                            "[!]".yellow(),
                            e
                        );
                        println!(
                            "{} Run 'chasm harvest run' manually to save sessions",
                            "[i]".blue()
                        );
                    }
                }
            }
        }
    }

    println!("{}", "=".repeat(70).cyan());

    Ok(())
}

/// Auto-harvest detected session files into the harvest database
pub(crate) fn auto_harvest_sessions(session_files: &[std::path::PathBuf]) -> Result<usize> {
    use crate::commands::{harvest_init, harvest_run};

    // Check if harvest DB exists, init if needed
    let db_path = if let Ok(p) = std::env::var("CSM_HARVEST_DB") {
        std::path::PathBuf::from(p)
    } else {
        std::env::current_dir()?.join("chat_sessions.db")
    };

    if !db_path.exists() {
        // Auto-init the harvest database
        harvest_init(None, false)?;
    }

    // Run harvest to pick up new session files from all providers
    harvest_run(None, None, None, true, false, Some("Auto-save from chasm run"))?;

    Ok(session_files.len())
}

/// List all available agents and their status
pub fn list_agents_cli() -> Result<()> {
    println!("{}", "=".repeat(70).cyan());
    println!(
        "{} Available Agents",
        "[*]".bold()
    );
    println!("{}", "=".repeat(70).cyan());
    println!();

    println!(
        "  {:<14} {:<18} {:<12} {}",
        "Alias".bold(),
        "Agent".bold(),
        "Status".bold(),
        "Storage".bold()
    );
    println!("  {}", "-".repeat(64));

    let aliases = [
        ("claude", "Claude Code"),
        ("open", "OpenCode"),
        ("claw", "OpenClaw"),
        ("cursor", "Cursor CLI"),
        ("codex", "Codex CLI"),
        ("droid", "Droid CLI"),
        ("gemini", "Gemini CLI"),
    ];

    for (alias, _name) in &aliases {
        if let Some(config) = resolve_agent(alias) {
            let status = if find_agent_binary(config).is_some() {
                "installed".green().to_string()
            } else {
                "not found".red().to_string()
            };

            println!(
                "  {:<14} {:<18} {:<12} {}",
                alias.cyan(),
                config.name,
                status,
                config.storage_hint.dimmed()
            );
        }
    }

    println!();
    println!(
        "{} Usage: {} <agent> [-- <agent-args>...]",
        "[i]".blue(),
        "chasm run".bold()
    );
    println!(
        "{} Default agent: {} (Claude Code)",
        "[i]".blue(),
        "claude".cyan()
    );
    println!();

    Ok(())
}
