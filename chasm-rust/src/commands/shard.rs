// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only
//! Shard command — split oversized chat sessions into linked shard files
//!
//! Sharding can be driven by request count (`--max-requests N`) or by file
//! size (`--max-size 10MB`). Each output shard is written as a VS Code–
//! compatible JSONL file with `_shardInfo` metadata that links shards in a
//! doubly-linked list so agents can traverse the full session history.

use anyhow::{Context, Result};
use colored::Colorize;
use std::path::{Path, PathBuf};

use crate::models::{ChatSession, ChatSessionTiming};
use crate::storage::{
    add_session_to_index, ensure_vscode_compat_fields, get_workspace_storage_db,
    parse_session_auto, read_chat_session_index, write_chat_session_index,
};

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/// Shard a single session file.
///
/// `max_requests` and `max_size` are mutually exclusive; if both are `None`
/// the default is 50 requests per shard.
pub fn shard_session(
    file: &str,
    max_requests: Option<usize>,
    max_size: Option<String>,
    output_dir: Option<&str>,
    update_index: bool,
    workspace: Option<&str>,
    dry_run: bool,
    no_backup: bool,
) -> Result<()> {
    let file_path = PathBuf::from(file);
    if !file_path.exists() {
        anyhow::bail!("Session file not found: {}", file_path.display());
    }

    // Parse the split strategy
    let strategy = parse_strategy(max_requests, max_size)?;

    // Read and parse the session
    let content = std::fs::read_to_string(&file_path)
        .context(format!("Failed to read {}", file_path.display()))?;
    let (session, _format_info) =
        parse_session_auto(&content).context("Failed to parse session file")?;

    let request_count = session.requests.len();
    if request_count == 0 {
        println!("{}", "Session has no requests, nothing to shard.".yellow());
        return Ok(());
    }

    // Determine session ID from filename (strip extension)
    let session_id = file_path
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    // Split into shards
    let shards = split_session(&session, &strategy, &content);
    if shards.len() <= 1 {
        println!(
            "{}",
            format!(
                "Session has {} requests and does not exceed the shard threshold — no sharding needed.",
                request_count
            )
            .yellow()
        );
        return Ok(());
    }

    let title = session.title();
    println!(
        "{}",
        format!(
            "Sharding \"{}\" ({} requests) into {} parts",
            title,
            request_count,
            shards.len()
        )
        .cyan()
        .bold()
    );

    // Compute deterministic shard UUIDs
    let shard_uuids: Vec<String> = (0..shards.len())
        .map(|i| deterministic_uuid(&session_id, i))
        .collect();

    // Output directory — either explicit, or same directory as the input file
    let out_dir = match output_dir {
        Some(d) => PathBuf::from(d),
        None => file_path
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .to_path_buf(),
    };
    if !out_dir.exists() {
        if dry_run {
            println!("  Would create directory: {}", out_dir.display());
        } else {
            std::fs::create_dir_all(&out_dir)?;
        }
    }

    // Write each shard
    for (i, shard) in shards.iter().enumerate() {
        let uuid = &shard_uuids[i];
        let shard_title = if shards.len() > 1 {
            format!("{} (Part {}/{})", title, i + 1, shards.len())
        } else {
            title.clone()
        };

        let prev_shard_id = if i > 0 {
            Some(shard_uuids[i - 1].as_str())
        } else {
            None
        };
        let next_shard_id = if i < shards.len() - 1 {
            Some(shard_uuids[i + 1].as_str())
        } else {
            None
        };

        let jsonl = build_shard_jsonl(
            &session,
            &shard.requests,
            uuid,
            &shard_title,
            &session_id,
            i,
            shards.len(),
            prev_shard_id,
            next_shard_id,
            shard.start_idx,
            shard.end_idx,
        )?;

        let shard_path = out_dir.join(format!("{}.jsonl", uuid));
        let size_mb = jsonl.len() as f64 / 1024.0 / 1024.0;

        if dry_run {
            println!(
                "  {} Part {}/{}: {} — {} requests ({:.1} MB)",
                "[dry-run]".bright_black(),
                i + 1,
                shards.len(),
                &uuid[..8],
                shard.requests.len(),
                size_mb
            );
        } else {
            std::fs::write(&shard_path, &jsonl)
                .context(format!("Failed to write shard {}", shard_path.display()))?;
            println!(
                "  Part {}/{}: {} — {} requests ({:.1} MB)",
                i + 1,
                shards.len(),
                &uuid[..8],
                shard.requests.len(),
                size_mb
            );
        }
    }

    // Backup the original
    if !no_backup {
        let backup_path = PathBuf::from(format!("{}.oversized", file_path.display()));
        if dry_run {
            println!(
                "  {} Would backup original → {}",
                "[dry-run]".bright_black(),
                backup_path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
            );
        } else {
            std::fs::copy(&file_path, &backup_path).context("Failed to create backup")?;
            println!(
                "  Backed up original → {}",
                backup_path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
            );
        }
    }

    // Replace original with the last (most recent) shard
    {
        let last_shard = shards.last().unwrap();
        let latest_title = if shards.len() > 1 {
            format!(
                "{} (Latest — Part {}/{})",
                title,
                shards.len(),
                shards.len()
            )
        } else {
            title.clone()
        };

        let prev_shard_id = if shards.len() > 1 {
            Some(shard_uuids[shards.len() - 2].as_str())
        } else {
            None
        };

        let latest_jsonl = build_shard_jsonl(
            &session,
            &last_shard.requests,
            &session_id, // keep original session ID for the replacement
            &latest_title,
            &session_id,
            shards.len() - 1,
            shards.len(),
            prev_shard_id,
            None,
            last_shard.start_idx,
            last_shard.end_idx,
        )?;

        // Always write as .jsonl
        let target_path = if file_path.extension().map_or(false, |e| e == "json") {
            file_path.with_extension("jsonl")
        } else {
            file_path.clone()
        };

        if dry_run {
            let size_mb = latest_jsonl.len() as f64 / 1024.0 / 1024.0;
            println!(
                "  {} Would replace original with latest shard ({} requests, {:.1} MB)",
                "[dry-run]".bright_black(),
                last_shard.requests.len(),
                size_mb
            );
        } else {
            std::fs::write(&target_path, &latest_jsonl)?;
            let size_mb = latest_jsonl.len() as f64 / 1024.0 / 1024.0;
            println!(
                "  Replaced original with latest shard ({} requests, {:.1} MB)",
                last_shard.requests.len(),
                size_mb
            );
        }
    }

    // Update VS Code session index
    if update_index {
        let ws_hash = match workspace {
            Some(w) => w.to_string(),
            None => infer_workspace_hash(&file_path)?,
        };

        if dry_run {
            println!(
                "  {} Would update session index for workspace {}",
                "[dry-run]".bright_black(),
                &ws_hash[..8]
            );
        } else {
            update_shard_index(&ws_hash, &session_id, &shards, &shard_uuids, &session)?;
            println!("  Updated session index ({} shard entries)", shards.len());
        }
    }

    if dry_run {
        println!(
            "\n{}",
            "Dry run complete — no files were modified.".bright_black()
        );
    } else {
        println!(
            "\n{}",
            format!(
                "Done — {} shards created with linked-list chain.",
                shards.len()
            )
            .green()
            .bold()
        );
    }

    Ok(())
}

/// Shard all oversized sessions in a workspace.
pub fn shard_workspace(
    workspace: Option<&str>,
    max_requests: Option<usize>,
    max_size: Option<String>,
    dry_run: bool,
    no_backup: bool,
) -> Result<()> {
    let strategy = parse_strategy(max_requests, max_size.clone())?;

    // Discover workspace
    let (ws_hash, chat_sessions_dir) = resolve_workspace(workspace)?;

    if !chat_sessions_dir.exists() {
        println!("{}", "No chatSessions directory found.".yellow());
        return Ok(());
    }

    // Scan for session files
    let mut candidates: Vec<PathBuf> = Vec::new();
    for entry in std::fs::read_dir(&chat_sessions_dir)? {
        let entry = entry?;
        let path = entry.path();
        let ext = path
            .extension()
            .map(|e| e.to_string_lossy().to_string())
            .unwrap_or_default();

        if ext != "json" && ext != "jsonl" {
            continue;
        }

        // Skip backup/oversized files
        let name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        if name.contains(".oversized") || name.contains(".bak") || name.contains(".backup") {
            continue;
        }

        candidates.push(path);
    }

    if candidates.is_empty() {
        println!("{}", "No session files found.".yellow());
        return Ok(());
    }

    println!(
        "Scanning {} session files in workspace {}...",
        candidates.len(),
        &ws_hash[..8]
    );

    let mut sharded_count = 0;
    for candidate in &candidates {
        let content = match std::fs::read_to_string(candidate) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let (session, _) = match parse_session_auto(&content) {
            Ok(s) => s,
            Err(_) => continue,
        };

        let needs_shard = match &strategy {
            ShardStrategy::ByRequests(max) => session.requests.len() > *max,
            ShardStrategy::BySize(max_bytes) => content.len() > *max_bytes,
        };

        if !needs_shard {
            continue;
        }

        let file_str = candidate.to_string_lossy().to_string();
        println!();
        shard_session(
            &file_str,
            max_requests,
            max_size.clone(),
            None,
            true,
            Some(&ws_hash),
            dry_run,
            no_backup,
        )?;
        sharded_count += 1;
    }

    if sharded_count == 0 {
        println!(
            "{}",
            "No sessions exceed the shard threshold.".bright_black()
        );
    } else {
        println!(
            "\n{}",
            format!("Sharded {} session(s).", sharded_count)
                .green()
                .bold()
        );
    }

    Ok(())
}

/// Show information about shards of a session.
pub fn shard_info(file: &str) -> Result<()> {
    let file_path = PathBuf::from(file);
    if !file_path.exists() {
        anyhow::bail!("Session file not found: {}", file_path.display());
    }

    let content = std::fs::read_to_string(&file_path)?;
    let (session, _) = parse_session_auto(&content)?;

    // Check for _shardInfo in the raw JSON
    let raw: serde_json::Value = if content.trim_start().starts_with('{') {
        // Could be legacy JSON or JSONL — detect
        if let Some(first_line) = content.lines().next() {
            let parsed: serde_json::Value = serde_json::from_str(first_line)?;
            if let Some(v) = parsed.get("v") {
                v.clone()
            } else {
                parsed
            }
        } else {
            serde_json::Value::Null
        }
    } else {
        serde_json::Value::Null
    };

    let title = session.title();
    let req_count = session.requests.len();

    println!("{}", format!("Session: {}", title).cyan().bold());
    println!("  Requests: {}", req_count);
    println!(
        "  File:     {}",
        file_path.file_name().unwrap_or_default().to_string_lossy()
    );

    if let Some(shard_info) = raw.get("_shardInfo") {
        println!();
        println!("{}", "Shard Info:".cyan());
        if let Some(orig) = shard_info.get("originalSessionId") {
            println!("  Original Session: {}", orig);
        }
        if let Some(idx) = shard_info.get("shardIndex") {
            let total = shard_info
                .get("totalShards")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            println!(
                "  Position:         Part {}/{}",
                idx.as_u64().unwrap_or(0) + 1,
                total
            );
        }
        if let Some(prev) = shard_info.get("prevShardId") {
            if !prev.is_null() {
                println!("  Previous Shard:   {}", prev);
            } else {
                println!("  Previous Shard:   (none — this is the first shard)");
            }
        }
        if let Some(next) = shard_info.get("nextShardId") {
            if !next.is_null() {
                println!("  Next Shard:       {}", next);
            } else {
                println!("  Next Shard:       (none — this is the last shard)");
            }
        }
        if let Some(range) = shard_info.get("requestRange") {
            let start = range.get("start").and_then(|v| v.as_u64()).unwrap_or(0);
            let end = range.get("end").and_then(|v| v.as_u64()).unwrap_or(0);
            println!("  Request Range:    {}-{}", start, end);
        }
    } else {
        println!(
            "\n{}",
            "This session is not a shard (no _shardInfo metadata).".bright_black()
        );
    }

    Ok(())
}

// ────────────────────────────────────────────────────────────────────────────
// Internal types & helpers
// ────────────────────────────────────────────────────────────────────────────

/// How to split a session.
enum ShardStrategy {
    ByRequests(usize),
    BySize(usize),
}

/// Intermediate representation of a shard before writing.
struct Shard {
    requests: Vec<serde_json::Value>,
    start_idx: usize,
    end_idx: usize,
}

/// Parse user-provided `--max-requests` / `--max-size` into a strategy.
fn parse_strategy(max_requests: Option<usize>, max_size: Option<String>) -> Result<ShardStrategy> {
    match (max_requests, max_size) {
        (Some(_), Some(_)) => {
            anyhow::bail!("Cannot specify both --max-requests and --max-size");
        }
        (Some(n), None) => {
            if n == 0 {
                anyhow::bail!("--max-requests must be > 0");
            }
            Ok(ShardStrategy::ByRequests(n))
        }
        (None, Some(s)) => {
            let bytes = parse_size_string(&s)?;
            Ok(ShardStrategy::BySize(bytes))
        }
        (None, None) => {
            // Default: 50 requests per shard
            Ok(ShardStrategy::ByRequests(50))
        }
    }
}

/// Parse a human-readable size string like "10MB", "500KB", "1GB" into bytes.
fn parse_size_string(s: &str) -> Result<usize> {
    let s = s.trim().to_uppercase();

    // Try to split into numeric part and suffix
    let (num_str, multiplier) = if s.ends_with("GB") {
        (&s[..s.len() - 2], 1024 * 1024 * 1024)
    } else if s.ends_with("MB") {
        (&s[..s.len() - 2], 1024 * 1024)
    } else if s.ends_with("KB") {
        (&s[..s.len() - 2], 1024)
    } else if s.ends_with('B') {
        (&s[..s.len() - 1], 1)
    } else {
        // Assume MB
        (s.as_str(), 1024 * 1024)
    };

    let num: f64 = num_str
        .trim()
        .parse()
        .context(format!("Invalid size: {}", s))?;

    if num <= 0.0 {
        anyhow::bail!("--max-size must be > 0");
    }

    Ok((num * multiplier as f64) as usize)
}

/// Split a session's requests according to the chosen strategy.
///
/// We work with raw `serde_json::Value` to preserve all fields (including
/// any provider-specific extensions) without needing them in the typed model.
fn split_session(session: &ChatSession, strategy: &ShardStrategy, raw_content: &str) -> Vec<Shard> {
    // Re-parse the raw content to get requests as Value (preserves all fields)
    let raw_requests = extract_raw_requests(raw_content);
    let requests = if raw_requests.len() == session.requests.len() {
        raw_requests
    } else {
        // Fallback: serialize from the typed model
        session
            .requests
            .iter()
            .map(|r| serde_json::to_value(r).unwrap_or(serde_json::Value::Null))
            .collect()
    };

    match strategy {
        ShardStrategy::ByRequests(max) => split_by_requests(&requests, *max),
        ShardStrategy::BySize(max_bytes) => split_by_size(&requests, *max_bytes),
    }
}

fn split_by_requests(requests: &[serde_json::Value], max: usize) -> Vec<Shard> {
    let mut shards = Vec::new();
    let mut start = 0;

    while start < requests.len() {
        let end = std::cmp::min(start + max, requests.len());
        shards.push(Shard {
            requests: requests[start..end].to_vec(),
            start_idx: start,
            end_idx: end - 1,
        });
        start = end;
    }

    shards
}

fn split_by_size(requests: &[serde_json::Value], max_bytes: usize) -> Vec<Shard> {
    let mut shards = Vec::new();
    let mut current: Vec<serde_json::Value> = Vec::new();
    let mut current_size: usize = 0;
    let mut start_idx: usize = 0;

    for (i, req) in requests.iter().enumerate() {
        let req_size = serde_json::to_string(req).map(|s| s.len()).unwrap_or(0);

        // Always include at least one request per shard
        if !current.is_empty() && current_size + req_size > max_bytes {
            shards.push(Shard {
                requests: std::mem::take(&mut current),
                start_idx,
                end_idx: i - 1,
            });
            current_size = 0;
            start_idx = i;
        }

        current.push(req.clone());
        current_size += req_size;
    }

    if !current.is_empty() {
        shards.push(Shard {
            requests: current,
            start_idx,
            end_idx: requests.len() - 1,
        });
    }

    shards
}

/// Extract raw request values from session content, preserving all fields.
fn extract_raw_requests(content: &str) -> Vec<serde_json::Value> {
    let trimmed = content.trim();

    // JSONL format: first line has kind:0 with v.requests
    if let Some(first_line) = trimmed.lines().next() {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(first_line) {
            if parsed.get("kind").and_then(|k| k.as_u64()) == Some(0) {
                if let Some(requests) = parsed
                    .get("v")
                    .and_then(|v| v.get("requests"))
                    .and_then(|r| r.as_array())
                {
                    // For JSONL, we also need to apply deltas (kind:1, kind:2)
                    // For simplicity, just use parse_session_auto and re-serialize
                    // But first try using the kind:0 requests directly if there are
                    // no delta lines
                    let line_count = trimmed.lines().count();
                    if line_count == 1 {
                        return requests.clone();
                    }
                }
            }
        }
    }

    // Legacy JSON format
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(trimmed) {
        if let Some(requests) = parsed.get("requests").and_then(|r| r.as_array()) {
            return requests.clone();
        }
    }

    Vec::new()
}

/// Generate a deterministic UUID from session ID and shard index.
fn deterministic_uuid(session_id: &str, shard_index: usize) -> String {
    let input = format!("{}-shard-{}", session_id, shard_index);
    let digest = md5::compute(input.as_bytes());
    let hex = format!("{:x}", digest);
    format!(
        "{}-{}-{}-{}-{}",
        &hex[0..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..32]
    )
}

/// Build a JSONL string for a single shard.
fn build_shard_jsonl(
    session: &ChatSession,
    requests: &[serde_json::Value],
    shard_session_id: &str,
    shard_title: &str,
    original_session_id: &str,
    shard_index: usize,
    total_shards: usize,
    prev_shard_id: Option<&str>,
    next_shard_id: Option<&str>,
    start_idx: usize,
    end_idx: usize,
) -> Result<String> {
    let mut initial = serde_json::json!({
        "kind": 0,
        "v": {
            "version": session.version,
            "sessionId": shard_session_id,
            "creationDate": session.creation_date,
            "customTitle": shard_title,
            "initialLocation": session.initial_location,
            "responderUsername": session.responder_username,
            "requests": requests,
            "_shardInfo": {
                "originalSessionId": original_session_id,
                "shardIndex": shard_index,
                "totalShards": total_shards,
                "prevShardId": prev_shard_id,
                "nextShardId": next_shard_id,
                "requestRange": {
                    "start": start_idx,
                    "end": end_idx,
                },
            }
        }
    });

    // Ensure all VS Code–required compat fields are present
    if let Some(v) = initial.get_mut("v") {
        ensure_vscode_compat_fields(v, Some(shard_session_id));
    }

    let line = serde_json::to_string(&initial)?;
    Ok(format!("{}\n", line))
}

/// Try to infer the workspace hash from a session file path.
///
/// Expected path pattern:
/// `…/workspaceStorage/<hash>/chatSessions/<uuid>.jsonl`
fn infer_workspace_hash(file_path: &Path) -> Result<String> {
    // Walk up looking for "chatSessions" parent, then one more up for the hash
    let mut current = file_path.parent();
    while let Some(dir) = current {
        if dir.file_name().map_or(false, |n| n == "chatSessions") {
            if let Some(ws_dir) = dir.parent() {
                if let Some(hash) = ws_dir.file_name() {
                    return Ok(hash.to_string_lossy().to_string());
                }
            }
        }
        current = dir.parent();
    }
    anyhow::bail!(
        "Cannot infer workspace hash from path: {}. Use --workspace to specify it.",
        file_path.display()
    );
}

/// Resolve a workspace hash (explicit or from current directory) to the
/// workspace hash and chatSessions directory path.
fn resolve_workspace(workspace: Option<&str>) -> Result<(String, PathBuf)> {
    if let Some(ws) = workspace {
        // Could be a hash or a project path
        if ws.len() == 32 && ws.chars().all(|c| c.is_ascii_hexdigit()) {
            // It's a hash
            let storage = crate::workspace::get_workspace_storage_path()?;
            let chat_dir = storage.join(ws).join("chatSessions");
            return Ok((ws.to_string(), chat_dir));
        }

        // Try to find workspace by project path
        match crate::workspace::find_workspace_by_path(ws) {
            Ok(Some((hash, ws_dir, _folder))) => {
                let chat_dir = ws_dir.join("chatSessions");
                Ok((hash, chat_dir))
            }
            Ok(None) => anyhow::bail!("No workspace found for path: {}", ws),
            Err(e) => anyhow::bail!("Error finding workspace: {}", e),
        }
    } else {
        // Use current directory
        let cwd = std::env::current_dir()?;
        let cwd_str = cwd.to_string_lossy().to_string();
        match crate::workspace::find_workspace_by_path(&cwd_str) {
            Ok(Some((hash, ws_dir, _folder))) => {
                let chat_dir = ws_dir.join("chatSessions");
                Ok((hash, chat_dir))
            }
            Ok(None) => anyhow::bail!(
                "No VS Code workspace found for current directory. Use --workspace to specify one."
            ),
            Err(e) => anyhow::bail!("Error finding workspace: {}", e),
        }
    }
}

/// Update the VS Code session index with shard entries.
fn update_shard_index(
    workspace_hash: &str,
    original_session_id: &str,
    shards: &[Shard],
    shard_uuids: &[String],
    session: &ChatSession,
) -> Result<()> {
    let db_path = get_workspace_storage_db(workspace_hash)?;
    if !db_path.exists() {
        anyhow::bail!("Workspace database not found: {}", db_path.display());
    }

    let mut index = read_chat_session_index(&db_path)?;
    let title = session.title();

    // Add entries for each shard (except the last, which reuses the original session ID)
    for (i, shard) in shards.iter().enumerate() {
        // Skip the last shard — it replaces the original session file with the original ID
        if i == shards.len() - 1 {
            // Update the original entry with the latest shard title
            if let Some(entry) = index.entries.get_mut(original_session_id) {
                entry.title = if shards.len() > 1 {
                    format!(
                        "{} (Latest — Part {}/{})",
                        title,
                        shards.len(),
                        shards.len()
                    )
                } else {
                    title.clone()
                };
            }
            continue;
        }

        let uuid = &shard_uuids[i];
        let shard_title = format!("{} (Part {}/{})", title, i + 1, shards.len());

        // Get timing from requests
        let last_req = shard.requests.last();
        let first_req = shard.requests.first();
        let last_ts = last_req
            .and_then(|r| r.get("timestamp"))
            .and_then(|t| t.as_i64())
            .unwrap_or(session.last_message_date);
        let first_ts = first_req
            .and_then(|r| r.get("timestamp"))
            .and_then(|t| t.as_i64())
            .unwrap_or(session.creation_date);

        index.entries.insert(
            uuid.clone(),
            crate::models::ChatSessionIndexEntry {
                session_id: uuid.clone(),
                title: shard_title,
                last_message_date: last_ts,
                timing: Some(ChatSessionTiming {
                    created: first_ts,
                    last_request_started: Some(last_ts),
                    last_request_ended: Some(last_ts),
                }),
                last_response_state: 1,
                initial_location: "panel".to_string(),
                is_empty: false,
                is_imported: Some(false),
                has_pending_edits: Some(false),
                is_external: Some(false),
            },
        );
    }

    write_chat_session_index(&db_path, &index)?;
    Ok(())
}
