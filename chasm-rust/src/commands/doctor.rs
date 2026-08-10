// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
//! `chasm doctor` — Environment diagnostics and health checks

use anyhow::Result;
use colored::Colorize;
use std::path::PathBuf;

use crate::storage::{
    diagnose_workspace_sessions, repair_workspace_sessions, SessionIssueKind, WorkspaceDiagnosis,
};
use crate::workspace::discover_workspaces;

/// Status of a single health check
#[derive(Debug, Clone)]
enum CheckStatus {
    Pass,
    Warn(String),
    Fail(String),
}

/// A single diagnostic check result
#[derive(Debug, Clone)]
struct CheckResult {
    name: String,
    category: String,
    status: CheckStatus,
    detail: Option<String>,
}

impl CheckResult {
    fn pass(category: &str, name: &str) -> Self {
        Self {
            name: name.to_string(),
            category: category.to_string(),
            status: CheckStatus::Pass,
            detail: None,
        }
    }

    fn warn(category: &str, name: &str, msg: &str) -> Self {
        Self {
            name: name.to_string(),
            category: category.to_string(),
            status: CheckStatus::Warn(msg.to_string()),
            detail: None,
        }
    }

    fn fail(category: &str, name: &str, msg: &str) -> Self {
        Self {
            name: name.to_string(),
            category: category.to_string(),
            status: CheckStatus::Fail(msg.to_string()),
            detail: None,
        }
    }

    fn with_detail(mut self, detail: &str) -> Self {
        self.detail = Some(detail.to_string());
        self
    }
}

/// Run all diagnostic checks
///
/// Results stream to the terminal as each check finishes. They used to be
/// accumulated into a `Vec` and printed only at the very end, which meant that
/// on a machine with a large session store — 224 VS Code workspaces was enough
/// — `chasm doctor` sat silent for over ten minutes and was indistinguishable
/// from a hang. The first command a new user runs must not look broken.
#[allow(clippy::vec_init_then_push)]
pub fn doctor(full: bool, format: &str, fix: bool, quick: bool) -> Result<()> {
    // JSON has to be a single document, so it still buffers; text streams.
    let streaming = format != "json";
    let mut printer = Printer::new(streaming);
    let mut results: Vec<CheckResult> = Vec::new();

    if streaming {
        println!();
        println!("  {}", "Chasm Doctor".bold().cyan());
        println!("  {}", "─".repeat(50).bright_black());
    }

    let record = |printer: &mut Printer, results: &mut Vec<CheckResult>, r: CheckResult| {
        printer.emit(&r);
        results.push(r);
    };

    // ── System checks ──────────────────────────────────────────────
    record(&mut printer, &mut results, check_version());
    record(&mut printer, &mut results, check_rust_version());
    record(&mut printer, &mut results, check_os());

    // ── Storage checks ─────────────────────────────────────────────
    record(&mut printer, &mut results, check_vscode_storage());
    record(&mut printer, &mut results, check_cursor_storage());
    record(&mut printer, &mut results, check_harvest_db());

    // ── Provider checks ────────────────────────────────────────────
    record(&mut printer, &mut results, check_copilot_chat());
    record(&mut printer, &mut results, check_claude_code());
    record(&mut printer, &mut results, check_codex_cli());
    record(&mut printer, &mut results, check_gemini_cli());
    for r in check_agent_home_dirs() {
        record(&mut printer, &mut results, r);
    }

    // ── Tool checks ────────────────────────────────────────────────
    record(&mut printer, &mut results, check_git());
    record(&mut printer, &mut results, check_sqlite());

    // ── Network checks (only with --full) ──────────────────────────
    if full {
        record(&mut printer, &mut results, check_ollama());
        record(&mut printer, &mut results, check_lm_studio());
        record(&mut printer, &mut results, check_api_server());
    }

    // ── Session health checks ──────────────────────────────────────
    // By far the most expensive part: it parses every session file in every
    // workspace. `--quick` skips it; otherwise it runs in parallel and reports
    // progress, because silence for minutes reads as a crash.
    let diagnoses = if quick {
        let r = CheckResult::pass("sessions", "Session health")
            .with_detail("skipped (--quick); drop the flag to scan session files");
        record(&mut printer, &mut results, r);
        Vec::new()
    } else {
        let mut session_results = Vec::new();
        let d = check_all_workspace_sessions(&mut session_results, streaming);
        for r in session_results {
            record(&mut printer, &mut results, r);
        }
        d
    };

    // ── Output ─────────────────────────────────────────────────────
    if !streaming {
        print_json(&results);
    }

    // Summary
    let pass_count = results
        .iter()
        .filter(|r| matches!(r.status, CheckStatus::Pass))
        .count();
    let warn_count = results
        .iter()
        .filter(|r| matches!(r.status, CheckStatus::Warn(_)))
        .count();
    let fail_count = results
        .iter()
        .filter(|r| matches!(r.status, CheckStatus::Fail(_)))
        .count();

    if format != "json" {
        println!();
        println!(
            "  {} {} passed, {} warnings, {} failures",
            "Summary:".bold(),
            pass_count.to_string().green(),
            warn_count.to_string().yellow(),
            fail_count.to_string().red(),
        );

        if !full {
            println!(
                "  {} Run {} for network connectivity checks",
                "Tip:".bright_black(),
                "chasm doctor --full".cyan(),
            );
        }
        if !quick {
            println!(
                "  {} Run {} to skip the session-file scan",
                "Tip:".bright_black(),
                "chasm doctor --quick".cyan(),
            );
        }
    }

    // ── Auto-fix with --fix ────────────────────────────────────────
    if fix {
        let unhealthy: Vec<&WorkspaceDiagnosis> =
            diagnoses.iter().filter(|d| !d.is_healthy()).collect();

        if unhealthy.is_empty() {
            if format != "json" {
                println!(
                    "\n  {} All workspaces are healthy — nothing to fix.",
                    "✓".green()
                );
            }
        } else {
            if format != "json" {
                println!(
                    "\n  {} Auto-fixing {} workspace(s) with issues...\n",
                    "[FIX]".cyan().bold(),
                    unhealthy.len()
                );
            }

            let mut total_compacted = 0usize;
            let mut total_synced = 0usize;
            let mut succeeded = 0usize;
            let mut failed = 0usize;

            for diag in &unhealthy {
                let display_name = diag.project_path.as_deref().unwrap_or(&diag.workspace_hash);

                if format != "json" {
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
                        "  {} {} ({} issue{}): {}",
                        "[*]".yellow(),
                        display_name.cyan(),
                        diag.issues.len(),
                        if diag.issues.len() == 1 { "" } else { "s" },
                        issue_kinds.join(", ")
                    );
                }

                let chat_sessions_dir = get_vscode_storage_path()
                    .unwrap_or_default()
                    .join(&diag.workspace_hash)
                    .join("chatSessions");

                match repair_workspace_sessions(&diag.workspace_hash, &chat_sessions_dir, true) {
                    Ok((compacted, synced)) => {
                        total_compacted += compacted;
                        total_synced += synced;
                        succeeded += 1;
                        if format != "json" {
                            println!(
                                "      {} {} compacted, {} index entries synced",
                                "[OK]".green(),
                                compacted,
                                synced
                            );
                        }
                    }
                    Err(e) => {
                        failed += 1;
                        if format != "json" {
                            println!("      {} {}", "[ERR]".red(), e);
                        }
                    }
                }
            }

            if format != "json" {
                println!(
                    "\n  {} Auto-fix complete: {}/{} workspaces repaired, {} compacted, {} synced",
                    "[OK]".green().bold(),
                    succeeded.to_string().green(),
                    unhealthy.len(),
                    total_compacted.to_string().cyan(),
                    total_synced.to_string().cyan()
                );
                if failed > 0 {
                    println!(
                        "  {} {} workspace(s) had errors",
                        "[!]".yellow(),
                        failed.to_string().red()
                    );
                }
            }
        }
    } else if diagnoses.iter().any(|d| !d.is_healthy()) && format != "json" {
        let total_issues: usize = diagnoses.iter().map(|d| d.issues.len()).sum();
        println!(
            "  {} Run {} to automatically fix {} issue(s)",
            "Tip:".bright_black(),
            "chasm doctor --fix".cyan(),
            total_issues.to_string().yellow(),
        );
    }

    Ok(())
}

// ─── Session health check ──────────────────────────────────────────

/// Scan all VS Code workspaces for session issues and add results to the check list.
/// Returns the full diagnosis list for use by --fix.
fn check_all_workspace_sessions(
    results: &mut Vec<CheckResult>,
    show_progress: bool,
) -> Vec<WorkspaceDiagnosis> {
    let workspaces = match discover_workspaces() {
        Ok(ws) => ws,
        Err(e) => {
            results.push(CheckResult::fail(
                "sessions",
                "Workspace scan",
                &format!("Failed to discover workspaces: {}", e),
            ));
            return Vec::new();
        }
    };

    let ws_with_sessions: Vec<_> = workspaces
        .iter()
        .filter(|w| w.has_chat_sessions && w.chat_session_count > 0)
        .collect();

    if ws_with_sessions.is_empty() {
        results.push(
            CheckResult::pass("sessions", "Session health")
                .with_detail("No workspaces with chat sessions found"),
        );
        return Vec::new();
    }

    // Each workspace is an independent parse of independent files, so this
    // fans out. Serially it took over ten minutes across 224 workspaces.
    use rayon::prelude::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    let total = ws_with_sessions.len();
    let done = AtomicUsize::new(0);

    if show_progress {
        println!();
        println!("  {} {}", "▸".bright_black(), "SESSIONS".bold());
    }

    // Type left to inference: `diagnose_workspace_sessions` returns the
    // crate's own error type, not anyhow's.
    let scanned: Vec<_> = ws_with_sessions
        .par_iter()
        .map(|ws| {
            let chat_dir = ws.workspace_path.join("chatSessions");
            let outcome = diagnose_workspace_sessions(&ws.hash, &chat_dir);

            let n = done.fetch_add(1, Ordering::Relaxed) + 1;
            if show_progress {
                // Carriage return, no newline: one line that counts up rather
                // than N lines of scrollback.
                print!("\r    scanning workspaces… {n}/{total}");
                let _ = std::io::Write::flush(&mut std::io::stdout());
            }

            (ws.project_path.clone(), ws.hash.clone(), outcome)
        })
        .collect();

    if show_progress {
        // Blank the progress line so it does not collide with the results.
        print!("\r{}\r", " ".repeat(40));
        let _ = std::io::Write::flush(&mut std::io::stdout());
    }

    let mut diagnoses = Vec::new();
    let mut total_issues = 0usize;
    let mut workspaces_with_issues = 0usize;
    let mut issue_counts: std::collections::HashMap<String, usize> =
        std::collections::HashMap::new();

    for (project_path, hash, outcome) in scanned {
        match outcome {
            Ok(mut diag) => {
                diag.project_path = project_path;
                if !diag.is_healthy() {
                    workspaces_with_issues += 1;
                    for issue in &diag.issues {
                        total_issues += 1;
                        *issue_counts.entry(format!("{}", issue.kind)).or_default() += 1;
                    }
                }
                diagnoses.push(diag);
            }
            Err(e) => {
                let display = project_path.unwrap_or(hash);
                results.push(CheckResult::warn(
                    "sessions",
                    &format!("Scan: {}", display),
                    &format!("Failed: {}", e),
                ));
            }
        }
    }

    if total_issues == 0 {
        results.push(
            CheckResult::pass("sessions", "Session health").with_detail(&format!(
                "All {} workspace(s) with sessions are healthy",
                ws_with_sessions.len()
            )),
        );
    } else {
        // Add one summary result
        let breakdown: Vec<String> = issue_counts
            .iter()
            .map(|(kind, count)| format!("{count} {kind}"))
            .collect();

        results.push(CheckResult::fail(
            "sessions",
            "Session health",
            &format!(
                "{} issue(s) in {}/{} workspace(s): {}",
                total_issues,
                workspaces_with_issues,
                ws_with_sessions.len(),
                breakdown.join(", ")
            ),
        ));

        // Add per-workspace detail results for unhealthy workspaces
        for diag in &diagnoses {
            if !diag.is_healthy() {
                let display = diag.project_path.as_deref().unwrap_or(&diag.workspace_hash);
                let issue_summary: Vec<String> = diag
                    .issues
                    .iter()
                    .map(|i| format!("{}: {}", &i.session_id[..8.min(i.session_id.len())], i.kind))
                    .collect();

                results.push(CheckResult::warn(
                    "sessions",
                    &format!("  {}", truncate_path(display, 45)),
                    &issue_summary.join("; ").to_string(),
                ));
            }
        }
    }

    diagnoses
}

/// Truncate a path for display, keeping the last N characters
fn truncate_path(path: &str, max_len: usize) -> String {
    if path.len() <= max_len {
        path.to_string()
    } else {
        format!("...{}", &path[path.len() - max_len + 3..])
    }
}

// ─── Check implementations ─────────────────────────────────────────

fn check_version() -> CheckResult {
    let version = env!("CARGO_PKG_VERSION");
    CheckResult::pass("system", "Chasm version").with_detail(&format!("v{version}"))
}

fn check_rust_version() -> CheckResult {
    let msrv = "1.75";
    CheckResult::pass("system", "Minimum Rust version").with_detail(&format!("MSRV {msrv}"))
}

fn check_os() -> CheckResult {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    CheckResult::pass("system", "Operating system").with_detail(&format!("{os}/{arch}"))
}

fn check_vscode_storage() -> CheckResult {
    let path = get_vscode_storage_path();
    match path {
        Some(p) if p.exists() => {
            let count = count_workspaces(&p);
            CheckResult::pass("storage", "VS Code workspace storage").with_detail(&format!(
                "{} workspaces found at {}",
                count,
                p.display()
            ))
        }
        Some(p) => CheckResult::warn(
            "storage",
            "VS Code workspace storage",
            &format!("Path not found: {}", p.display()),
        ),
        None => CheckResult::warn(
            "storage",
            "VS Code workspace storage",
            "Could not determine default path",
        ),
    }
}

fn check_cursor_storage() -> CheckResult {
    let path = get_cursor_storage_path();
    match path {
        Some(p) if p.exists() => {
            let count = count_workspaces(&p);
            CheckResult::pass("storage", "Cursor workspace storage").with_detail(&format!(
                "{} workspaces found at {}",
                count,
                p.display()
            ))
        }
        Some(p) => CheckResult::pass("storage", "Cursor workspace storage")
            .with_detail(&format!("Not installed ({})", p.display())),
        None => {
            CheckResult::pass("storage", "Cursor workspace storage").with_detail("Not installed")
        }
    }
}

fn check_harvest_db() -> CheckResult {
    let db_path = get_harvest_db_path();
    match db_path {
        Some(p) if p.exists() => {
            let size = std::fs::metadata(&p)
                .map(|m| format_bytes(m.len()))
                .unwrap_or_else(|_| "unknown size".to_string());
            CheckResult::pass("storage", "Harvest database").with_detail(&format!(
                "{} at {}",
                size,
                p.display()
            ))
        }
        Some(p) => CheckResult::warn(
            "storage",
            "Harvest database",
            &format!(
                "Not found at {}. Run `chasm harvest run` to create it.",
                p.display()
            ),
        ),
        None => CheckResult::warn("storage", "Harvest database", "Could not determine path"),
    }
}

fn check_copilot_chat() -> CheckResult {
    match crate::copilot_version::detect_installed_versions() {
        Ok(installs) if installs.is_empty() => CheckResult::warn(
            "provider",
            "Copilot Chat",
            "Not installed — no github.copilot-chat-* extension found",
        ),
        Ok(installs) => {
            let active = installs.iter().find(|i| i.is_active);
            let latest = installs.iter().max_by(|a, b| a.version.cmp(&b.version));
            let picked = active.or(latest).unwrap();

            let mut detail = format!("v{}", picked.version);
            if installs.len() > 1 {
                detail.push_str(&format!(" ({} versions installed)", installs.len()));
            }
            if !picked.required_vscode_version.is_empty() {
                detail.push_str(&format!(
                    ", requires VS Code {}",
                    picked.required_vscode_version
                ));
            }

            // Warn if using a very old version (pre-JSONL)
            if picked.version < semver::Version::new(0, 37, 0) {
                CheckResult::warn(
                    "provider",
                    "Copilot Chat",
                    &format!(
                        "v{} is pre-JSONL (< 0.37). Session recovery may use legacy format.",
                        picked.version
                    ),
                )
            } else {
                CheckResult::pass("provider", "Copilot Chat").with_detail(&detail)
            }
        }
        Err(e) => CheckResult::warn(
            "provider",
            "Copilot Chat",
            &format!("Detection failed: {}", e),
        ),
    }
}

fn check_claude_code() -> CheckResult {
    let home = dirs::home_dir();
    match home {
        Some(h) => {
            let claude_dir = h.join(".claude");
            if claude_dir.exists() {
                CheckResult::pass("provider", "Claude Code")
                    .with_detail(&format!("Detected at {}", claude_dir.display()))
            } else {
                CheckResult::pass("provider", "Claude Code").with_detail("Not installed")
            }
        }
        None => CheckResult::warn(
            "provider",
            "Claude Code",
            "Could not determine home directory",
        ),
    }
}

fn check_codex_cli() -> CheckResult {
    let home = dirs::home_dir();
    match home {
        Some(h) => {
            let codex_dir = h.join(".codex");
            if codex_dir.exists() {
                CheckResult::pass("provider", "Codex CLI")
                    .with_detail(&format!("Detected at {}", codex_dir.display()))
            } else {
                CheckResult::pass("provider", "Codex CLI").with_detail("Not installed")
            }
        }
        None => CheckResult::warn(
            "provider",
            "Codex CLI",
            "Could not determine home directory",
        ),
    }
}

fn check_gemini_cli() -> CheckResult {
    let home = dirs::home_dir();
    match home {
        Some(h) => {
            let gemini_dir = h.join(".gemini");
            if gemini_dir.exists() {
                CheckResult::pass("provider", "Gemini CLI")
                    .with_detail(&format!("Detected at {}", gemini_dir.display()))
            } else {
                CheckResult::pass("provider", "Gemini CLI").with_detail("Not installed")
            }
        }
        None => CheckResult::warn(
            "provider",
            "Gemini CLI",
            "Could not determine home directory",
        ),
    }
}

/// Detect agent tools that keep session data in a home-relative directory.
fn check_agent_home_dirs() -> Vec<CheckResult> {
    // (display name, home-relative session/config dir)
    const AGENT_DIRS: &[(&str, &[&str])] = &[
        ("Antigravity CLI", &[".gemini", "antigravity"]),
        ("Cursor CLI", &[".cursor", "chats"]),
        ("GitHub Copilot CLI", &[".copilot"]),
        ("Qwen Code", &[".qwen"]),
        ("Pi", &[".pi", "agent"]),
        ("Goose", &[".local", "share", "goose"]),
        ("OpenCode", &[".opencode"]),
        ("Droid CLI", &[".factory"]),
    ];

    let Some(home) = dirs::home_dir() else {
        return vec![CheckResult::warn(
            "provider",
            "Agent CLIs",
            "Could not determine home directory",
        )];
    };

    AGENT_DIRS
        .iter()
        .map(|(name, segments)| {
            let dir = segments.iter().fold(home.clone(), |p, s| p.join(s));
            if dir.exists() {
                CheckResult::pass("provider", name)
                    .with_detail(&format!("Detected at {}", dir.display()))
            } else {
                CheckResult::pass("provider", name).with_detail("Not installed")
            }
        })
        .collect()
}

fn check_git() -> CheckResult {
    match std::process::Command::new("git").arg("--version").output() {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            CheckResult::pass("tools", "Git").with_detail(&version)
        }
        _ => CheckResult::warn(
            "tools",
            "Git",
            "Not found in PATH (optional, needed for `chasm git`)",
        ),
    }
}

fn check_sqlite() -> CheckResult {
    // We use bundled rusqlite, so this always passes
    CheckResult::pass("tools", "SQLite (bundled)").with_detail("rusqlite with bundled SQLite")
}

fn check_ollama() -> CheckResult {
    let url = std::env::var("OLLAMA_HOST").unwrap_or_else(|_| "http://localhost:11434".to_string());

    match reqwest::blocking::Client::new()
        .get(format!("{url}/api/tags"))
        .timeout(std::time::Duration::from_secs(3))
        .send()
    {
        Ok(resp) if resp.status().is_success() => {
            CheckResult::pass("network", "Ollama").with_detail(&format!("Running at {url}"))
        }
        Ok(resp) => CheckResult::warn(
            "network",
            "Ollama",
            &format!("Responded with status {} at {url}", resp.status()),
        ),
        Err(_) => {
            CheckResult::pass("network", "Ollama").with_detail(&format!("Not running at {url}"))
        }
    }
}

fn check_lm_studio() -> CheckResult {
    let url =
        std::env::var("LM_STUDIO_URL").unwrap_or_else(|_| "http://localhost:1234".to_string());

    match reqwest::blocking::Client::new()
        .get(format!("{url}/v1/models"))
        .timeout(std::time::Duration::from_secs(3))
        .send()
    {
        Ok(resp) if resp.status().is_success() => {
            CheckResult::pass("network", "LM Studio").with_detail(&format!("Running at {url}"))
        }
        _ => {
            CheckResult::pass("network", "LM Studio").with_detail(&format!("Not running at {url}"))
        }
    }
}

fn check_api_server() -> CheckResult {
    match reqwest::blocking::Client::new()
        .get("http://localhost:8787/api/health")
        .timeout(std::time::Duration::from_secs(3))
        .send()
    {
        Ok(resp) if resp.status().is_success() => CheckResult::pass("network", "Chasm API server")
            .with_detail("Running at http://localhost:8787"),
        _ => CheckResult::pass("network", "Chasm API server")
            .with_detail("Not running (start with `chasm api serve`)"),
    }
}

// ─── Output formatting ─────────────────────────────────────────────

/// Prints check results as they arrive, emitting a category heading the first
/// time it sees each category.
///
/// Holding the whole run in memory before printing anything was the reason a
/// slow scan was indistinguishable from a hang; this exists so a result is on
/// screen the moment it is known.
struct Printer<W: std::io::Write = std::io::Stdout> {
    enabled: bool,
    current_category: String,
    out: W,
}

impl Printer<std::io::Stdout> {
    fn new(enabled: bool) -> Self {
        Self {
            enabled,
            current_category: String::new(),
            out: std::io::stdout(),
        }
    }
}

impl<W: std::io::Write> Printer<W> {
    fn emit(&mut self, result: &CheckResult) {
        if !self.enabled {
            return;
        }

        if result.category != self.current_category {
            self.current_category = result.category.clone();
            let _ = writeln!(self.out);
            let _ = writeln!(
                self.out,
                "  {} {}",
                "▸".bright_black(),
                self.current_category.to_uppercase().bold()
            );
        }

        let (icon, msg) = match &result.status {
            CheckStatus::Pass => ("✓".green(), String::new()),
            CheckStatus::Warn(m) => ("!".yellow(), format!(" — {}", m.yellow())),
            CheckStatus::Fail(m) => ("✗".red(), format!(" — {}", m.red())),
        };

        let detail = result
            .detail
            .as_ref()
            .map(|d| format!(" {}", d.bright_black()))
            .unwrap_or_default();

        let _ = writeln!(self.out, "    {} {}{}{}", icon, result.name, detail, msg);
        // Checks can be seconds apart; an unflushed line helps nobody.
        let _ = self.out.flush();
    }
}

fn print_json(results: &[CheckResult]) {
    let json_results: Vec<serde_json::Value> = results
        .iter()
        .map(|r| {
            let (status, message) = match &r.status {
                CheckStatus::Pass => ("pass", None),
                CheckStatus::Warn(m) => ("warn", Some(m.as_str())),
                CheckStatus::Fail(m) => ("fail", Some(m.as_str())),
            };
            serde_json::json!({
                "category": r.category,
                "name": r.name,
                "status": status,
                "message": message,
                "detail": r.detail,
            })
        })
        .collect();

    println!(
        "{}",
        serde_json::to_string_pretty(&json_results).unwrap_or_default()
    );
}

// ─── Helpers ────────────────────────────────────────────────────────

fn get_vscode_storage_path() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        dirs::config_dir().map(|p| p.join("Code").join("User").join("workspaceStorage"))
    }
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir().map(|p| {
            p.join("Library")
                .join("Application Support")
                .join("Code")
                .join("User")
                .join("workspaceStorage")
        })
    }
    #[cfg(target_os = "linux")]
    {
        dirs::config_dir().map(|p| p.join("Code").join("User").join("workspaceStorage"))
    }
}

fn get_cursor_storage_path() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        dirs::config_dir().map(|p| p.join("Cursor").join("User").join("workspaceStorage"))
    }
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir().map(|p| {
            p.join("Library")
                .join("Application Support")
                .join("Cursor")
                .join("User")
                .join("workspaceStorage")
        })
    }
    #[cfg(target_os = "linux")]
    {
        dirs::config_dir().map(|p| p.join("Cursor").join("User").join("workspaceStorage"))
    }
}

fn get_harvest_db_path() -> Option<PathBuf> {
    dirs::data_dir().map(|p| p.join("chasm").join("harvest.db"))
}

fn count_workspaces(path: &PathBuf) -> usize {
    std::fs::read_dir(path)
        .map(|entries| {
            entries
                .filter_map(|e| e.ok())
                .filter(|e| e.path().is_dir())
                .count()
        })
        .unwrap_or(0)
}

fn format_bytes(bytes: u64) -> String {
    if bytes < 1024 {
        format!("{bytes} B")
    } else if bytes < 1024 * 1024 {
        format!("{:.1} KB", bytes as f64 / 1024.0)
    } else if bytes < 1024 * 1024 * 1024 {
        format!("{:.1} MB", bytes as f64 / (1024.0 * 1024.0))
    } else {
        format!("{:.2} GB", bytes as f64 / (1024.0 * 1024.0 * 1024.0))
    }
}

#[cfg(test)]
mod printer_tests {
    use super::*;

    fn drain(enabled: bool, results: &[CheckResult]) -> String {
        let mut printer = Printer {
            enabled,
            current_category: String::new(),
            out: Vec::new(),
        };
        for r in results {
            printer.emit(r);
        }
        String::from_utf8(printer.out).unwrap()
    }

    /// The whole point of the rewrite: a result must be written the moment it
    /// is emitted, not held until the run ends. If `emit` ever goes back to
    /// buffering, the first call produces nothing and this fails.
    #[test]
    fn a_result_is_written_as_soon_as_it_is_emitted() {
        let mut printer = Printer {
            enabled: true,
            current_category: String::new(),
            out: Vec::new(),
        };
        printer.emit(&CheckResult::pass("system", "Chasm version"));

        let written = String::from_utf8(printer.out.clone()).unwrap();
        assert!(
            written.contains("Chasm version"),
            "nothing was written after the first emit: {written:?}"
        );
    }

    /// A category heading prints once, not before every result under it.
    #[test]
    fn a_category_heading_prints_once() {
        let out = drain(
            true,
            &[
                CheckResult::pass("system", "one"),
                CheckResult::pass("system", "two"),
                CheckResult::pass("storage", "three"),
            ],
        );

        assert_eq!(out.matches("SYSTEM").count(), 1, "{out}");
        assert_eq!(out.matches("STORAGE").count(), 1, "{out}");
        assert!(out.contains("one") && out.contains("two") && out.contains("three"));
    }

    /// JSON mode builds one document at the end, so the streaming printer must
    /// stay completely silent or it would corrupt that document.
    #[test]
    fn a_disabled_printer_writes_nothing() {
        let out = drain(
            false,
            &[
                CheckResult::pass("system", "one"),
                CheckResult::fail("storage", "two", "broken"),
            ],
        );
        assert!(out.is_empty(), "expected silence, got {out:?}");
    }

    /// Warnings and failures must carry their message through, not just an icon.
    #[test]
    fn a_failure_message_survives_formatting() {
        let out = drain(
            true,
            &[CheckResult::fail("storage", "Harvest db", "missing")],
        );
        assert!(out.contains("Harvest db"), "{out}");
        assert!(out.contains("missing"), "{out}");
    }
}
