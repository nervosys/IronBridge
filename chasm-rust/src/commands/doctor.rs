// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only
//! `chasm doctor` — Environment diagnostics and health checks

use anyhow::Result;
use colored::Colorize;
use std::path::PathBuf;

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
pub fn doctor(full: bool, format: &str, _fix: bool) -> Result<()> {
    let mut results: Vec<CheckResult> = Vec::new();

    // ── System checks ──────────────────────────────────────────────
    results.push(check_version());
    results.push(check_rust_version());
    results.push(check_os());

    // ── Storage checks ─────────────────────────────────────────────
    results.push(check_vscode_storage());
    results.push(check_cursor_storage());
    results.push(check_harvest_db());

    // ── Provider checks ────────────────────────────────────────────
    results.push(check_claude_code());
    results.push(check_codex_cli());
    results.push(check_gemini_cli());

    // ── Tool checks ────────────────────────────────────────────────
    results.push(check_git());
    results.push(check_sqlite());

    // ── Network checks (only with --full) ──────────────────────────
    if full {
        results.push(check_ollama());
        results.push(check_lm_studio());
        results.push(check_api_server());
    }

    // ── Output ─────────────────────────────────────────────────────
    match format {
        "json" => print_json(&results),
        _ => print_text(&results),
    }

    // Summary
    let pass_count = results.iter().filter(|r| matches!(r.status, CheckStatus::Pass)).count();
    let warn_count = results.iter().filter(|r| matches!(r.status, CheckStatus::Warn(_))).count();
    let fail_count = results.iter().filter(|r| matches!(r.status, CheckStatus::Fail(_))).count();

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
    }

    Ok(())
}

// ─── Check implementations ─────────────────────────────────────────

fn check_version() -> CheckResult {
    let version = env!("CARGO_PKG_VERSION");
    CheckResult::pass("system", "Chasm version")
        .with_detail(&format!("v{version}"))
}

fn check_rust_version() -> CheckResult {
    let msrv = "1.75";
    CheckResult::pass("system", "Minimum Rust version")
        .with_detail(&format!("MSRV {msrv}"))
}

fn check_os() -> CheckResult {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    CheckResult::pass("system", "Operating system")
        .with_detail(&format!("{os}/{arch}"))
}

fn check_vscode_storage() -> CheckResult {
    let path = get_vscode_storage_path();
    match path {
        Some(p) if p.exists() => {
            let count = count_workspaces(&p);
            CheckResult::pass("storage", "VS Code workspace storage")
                .with_detail(&format!("{} workspaces found at {}", count, p.display()))
        }
        Some(p) => CheckResult::warn(
            "storage",
            "VS Code workspace storage",
            &format!("Path not found: {}", p.display()),
        ),
        None => CheckResult::warn("storage", "VS Code workspace storage", "Could not determine default path"),
    }
}

fn check_cursor_storage() -> CheckResult {
    let path = get_cursor_storage_path();
    match path {
        Some(p) if p.exists() => {
            let count = count_workspaces(&p);
            CheckResult::pass("storage", "Cursor workspace storage")
                .with_detail(&format!("{} workspaces found at {}", count, p.display()))
        }
        Some(p) => CheckResult::pass("storage", "Cursor workspace storage")
            .with_detail(&format!("Not installed ({})", p.display())),
        None => CheckResult::pass("storage", "Cursor workspace storage")
            .with_detail("Not installed"),
    }
}

fn check_harvest_db() -> CheckResult {
    let db_path = get_harvest_db_path();
    match db_path {
        Some(p) if p.exists() => {
            let size = std::fs::metadata(&p)
                .map(|m| format_bytes(m.len()))
                .unwrap_or_else(|_| "unknown size".to_string());
            CheckResult::pass("storage", "Harvest database")
                .with_detail(&format!("{} at {}", size, p.display()))
        }
        Some(p) => CheckResult::warn(
            "storage",
            "Harvest database",
            &format!("Not found at {}. Run `chasm harvest run` to create it.", p.display()),
        ),
        None => CheckResult::warn("storage", "Harvest database", "Could not determine path"),
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
                CheckResult::pass("provider", "Claude Code")
                    .with_detail("Not installed")
            }
        }
        None => CheckResult::warn("provider", "Claude Code", "Could not determine home directory"),
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
                CheckResult::pass("provider", "Codex CLI")
                    .with_detail("Not installed")
            }
        }
        None => CheckResult::warn("provider", "Codex CLI", "Could not determine home directory"),
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
                CheckResult::pass("provider", "Gemini CLI")
                    .with_detail("Not installed")
            }
        }
        None => CheckResult::warn("provider", "Gemini CLI", "Could not determine home directory"),
    }
}

fn check_git() -> CheckResult {
    match std::process::Command::new("git").arg("--version").output() {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            CheckResult::pass("tools", "Git").with_detail(&version)
        }
        _ => CheckResult::warn("tools", "Git", "Not found in PATH (optional, needed for `chasm git`)"),
    }
}

fn check_sqlite() -> CheckResult {
    // We use bundled rusqlite, so this always passes
    CheckResult::pass("tools", "SQLite (bundled)")
        .with_detail("rusqlite with bundled SQLite")
}

fn check_ollama() -> CheckResult {
    let url = std::env::var("OLLAMA_HOST")
        .unwrap_or_else(|_| "http://localhost:11434".to_string());

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
        Err(_) => CheckResult::pass("network", "Ollama")
            .with_detail(&format!("Not running at {url}")),
    }
}

fn check_lm_studio() -> CheckResult {
    let url = std::env::var("LM_STUDIO_URL")
        .unwrap_or_else(|_| "http://localhost:1234".to_string());

    match reqwest::blocking::Client::new()
        .get(format!("{url}/v1/models"))
        .timeout(std::time::Duration::from_secs(3))
        .send()
    {
        Ok(resp) if resp.status().is_success() => {
            CheckResult::pass("network", "LM Studio").with_detail(&format!("Running at {url}"))
        }
        _ => CheckResult::pass("network", "LM Studio")
            .with_detail(&format!("Not running at {url}")),
    }
}

fn check_api_server() -> CheckResult {
    match reqwest::blocking::Client::new()
        .get("http://localhost:8787/api/health")
        .timeout(std::time::Duration::from_secs(3))
        .send()
    {
        Ok(resp) if resp.status().is_success() => {
            CheckResult::pass("network", "Chasm API server")
                .with_detail("Running at http://localhost:8787")
        }
        _ => CheckResult::pass("network", "Chasm API server")
            .with_detail("Not running (start with `chasm api serve`)"),
    }
}

// ─── Output formatting ─────────────────────────────────────────────

fn print_text(results: &[CheckResult]) {
    println!();
    println!("  {}", "Chasm Doctor".bold().cyan());
    println!("  {}", "─".repeat(50).bright_black());

    let mut current_category = String::new();

    for result in results {
        if result.category != current_category {
            current_category = result.category.clone();
            println!();
            println!("  {} {}", "▸".bright_black(), current_category.to_uppercase().bold());
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

        println!("    {} {}{}{}", icon, result.name, detail, msg);
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

    println!("{}", serde_json::to_string_pretty(&json_results).unwrap_or_default());
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
        .map(|entries| entries.filter_map(|e| e.ok()).filter(|e| e.path().is_dir()).count())
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
