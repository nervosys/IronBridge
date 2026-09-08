// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
//! Watch command for file-system monitoring of AI agent session directories
//!
//! Monitors agent session storage paths for new or modified files and
//! automatically harvests them into the ironbridge database.

use anyhow::{Context, Result};
use colored::Colorize;
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::mpsc;
use std::time::{Duration, Instant};

use super::run::{auto_harvest_sessions, resolve_agent, resolve_storage_path, AGENTS};

/// Run the watch command — monitor agent session directories for changes
pub fn watch_cli(
    agent: Option<&str>,
    path: Option<&str>,
    debounce_secs: u64,
    no_harvest: bool,
    verbose: bool,
) -> Result<()> {
    let home = dirs::home_dir().context("Cannot determine home directory")?;

    // Determine which paths to watch
    let mut watch_paths: Vec<(String, PathBuf)> = Vec::new();

    if let Some(custom_path) = path {
        // User specified an explicit path
        let p = PathBuf::from(custom_path);
        if !p.exists() {
            anyhow::bail!("Path does not exist: {}", custom_path);
        }
        watch_paths.push(("custom".to_string(), p));
    } else if let Some(alias) = agent {
        // Watch a specific agent
        let config = resolve_agent(alias).ok_or_else(|| {
            anyhow::anyhow!(
                "Unknown agent '{}'. Run 'ironbridge list agents' to see available agents.",
                alias
            )
        })?;
        if let Some(p) = resolve_storage_path(&home, config) {
            if p.exists() {
                watch_paths.push((config.name.to_string(), p));
            } else {
                println!(
                    "{} {} storage path does not exist yet: {}",
                    "[!]".yellow(),
                    config.name,
                    config.storage_hint.dimmed()
                );
                println!(
                    "{} Launch the agent first with 'ironbridge run {}'",
                    "[i]".blue(),
                    alias
                );
                anyhow::bail!("No watchable paths found");
            }
        }
    } else {
        // Watch ALL agent session directories that exist
        for config in AGENTS {
            if config.harvestable {
                if let Some(p) = resolve_storage_path(&home, config) {
                    if p.exists() {
                        watch_paths.push((config.name.to_string(), p));
                    } else if verbose {
                        println!(
                            "  {} {} path not found: {}",
                            "~".dimmed(),
                            config.name,
                            config.storage_hint.dimmed()
                        );
                    }
                }
            }
        }
    }

    if watch_paths.is_empty() {
        println!(
            "{} No agent session directories found to watch.",
            "[!]".yellow()
        );
        println!(
            "{} Launch an agent first with 'ironbridge run <agent>', or specify a path with --path.",
            "[i]".blue()
        );
        return Ok(());
    }

    // Header
    println!("{}", "=".repeat(70).cyan());
    println!(
        "{} Watching {} path(s) for session changes",
        "[W]".magenta().bold(),
        watch_paths.len()
    );
    println!("{}", "=".repeat(70).cyan());
    println!();

    for (name, path) in &watch_paths {
        println!(
            "  {} {} → {}",
            "◉".green(),
            name.bold(),
            path.display().to_string().dimmed()
        );
    }
    println!();

    if no_harvest {
        println!(
            "{} Dry-run mode — changes detected but not harvested",
            "[i]".blue()
        );
    }
    println!("{} Debounce interval: {}s", "[i]".blue(), debounce_secs);
    println!(
        "{} Press {} to stop watching",
        "[i]".blue(),
        "Ctrl+C".bold()
    );
    println!();

    // Set up file watcher
    let (tx, rx) = mpsc::channel::<notify::Result<Event>>();

    let mut watcher: RecommendedWatcher = Watcher::new(
        tx,
        Config::default().with_poll_interval(Duration::from_secs(2)),
    )
    .context("Failed to create file system watcher")?;

    // Register all paths
    for (name, path) in &watch_paths {
        match watcher.watch(path, RecursiveMode::Recursive) {
            Ok(()) => {
                if verbose {
                    println!(
                        "  {} Registered watcher for {} ({})",
                        "+".green(),
                        name,
                        path.display()
                    );
                }
            }
            Err(e) => {
                println!(
                    "{} Failed to watch {} ({}): {}",
                    "[!]".yellow(),
                    name,
                    path.display(),
                    e
                );
            }
        }
    }

    // Event processing loop with debouncing
    let debounce = Duration::from_secs(debounce_secs);
    let mut pending_files: HashSet<PathBuf> = HashSet::new();
    let mut last_event_time: Option<Instant> = None;
    let mut total_harvested: usize = 0;

    println!("{} Watching for changes...", "[*]".blue());
    println!();

    loop {
        match rx.recv_timeout(Duration::from_millis(500)) {
            Ok(Ok(event)) => {
                // Filter for create/modify events on files
                let dominated = matches!(event.kind, EventKind::Create(_) | EventKind::Modify(_));

                if dominated {
                    for path in event.paths {
                        if path.is_file() {
                            // Filter out non-session files (temp files, lock files, etc.)
                            if should_watch_file(&path) {
                                if verbose {
                                    println!(
                                        "  {} {:?} → {}",
                                        "△".yellow(),
                                        event.kind,
                                        path.display().to_string().dimmed()
                                    );
                                }
                                pending_files.insert(path);
                                last_event_time = Some(Instant::now());
                            }
                        }
                    }
                }
            }
            Ok(Err(e)) => {
                if verbose {
                    println!("{} Watcher error: {}", "[!]".yellow(), e);
                }
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                // Check if we have pending files past the debounce window
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                println!("{} Watcher disconnected, stopping...", "[!]".yellow());
                break;
            }
        }

        // Process pending files if debounce period has elapsed
        if !pending_files.is_empty() {
            if let Some(last) = last_event_time {
                if last.elapsed() >= debounce {
                    let files: Vec<PathBuf> = pending_files.drain().collect();
                    let count = files.len();
                    last_event_time = None;

                    let now = chrono::Local::now().format("%H:%M:%S");
                    println!(
                        "{} [{}] Detected {} new/modified file(s):",
                        "[+]".green().bold(),
                        now,
                        count
                    );

                    for f in &files {
                        if let Some(name) = f.file_name() {
                            println!("   {} {}", "+".green(), name.to_string_lossy().dimmed());
                        }
                    }

                    if !no_harvest {
                        match auto_harvest_sessions(&files) {
                            Ok(n) => {
                                total_harvested += n;
                                println!(
                                    "{} Harvested {} session(s) (total: {})",
                                    "[+]".green().bold(),
                                    n,
                                    total_harvested
                                );
                            }
                            Err(e) => {
                                println!("{} Harvest failed: {}", "[!]".yellow(), e);
                            }
                        }
                    } else {
                        println!("{} Dry-run — skipping harvest", "[i]".blue());
                    }
                    println!();
                }
            }
        }
    }

    Ok(())
}

/// Determine if a file is a session-related file worth watching
fn should_watch_file(path: &std::path::Path) -> bool {
    let name = match path.file_name() {
        Some(n) => n.to_string_lossy().to_lowercase(),
        None => return false,
    };

    // Skip temp/lock files
    if name.starts_with('.')
        || name.ends_with(".tmp")
        || name.ends_with(".lock")
        || name.ends_with(".swp")
        || name.ends_with(".swo")
        || name == "desktop.ini"
        || name == "thumbs.db"
    {
        return false;
    }

    // Accept session-like files
    name.ends_with(".json")
        || name.ends_with(".jsonl")
        || name.ends_with(".md")
        || name.ends_with(".txt")
        || name.ends_with(".yaml")
        || name.ends_with(".yml")
        || name.ends_with(".log")
        || name.ends_with(".db")
        || name.ends_with(".sqlite")
        // Claude Code uses extensionless JSONL files in some cases
        || !name.contains('.')
}
