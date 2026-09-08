// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
//! Copilot Chat extension version detection and compatibility analysis
//!
//! Detects installed VS Code Copilot Chat extension versions, extracts version
//! information from session data, and checks compatibility between extension
//! versions and VS Code versions.
//!
//! This module supports the recovery pipeline by identifying version mismatches
//! that can cause session recovery failures.

use anyhow::{Context, Result};
use semver::Version;
use serde::Deserialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

// ============================================================================
// Version Info Structures
// ============================================================================

/// Information about an installed Copilot Chat extension
#[derive(Debug, Clone)]
pub struct CopilotChatInstall {
    /// Extension version (e.g., "0.37.8")
    pub version: Version,
    /// Minimum VS Code version required (from package.json engines.vscode)
    pub required_vscode_version: String,
    /// Required Node.js version (from package.json engines.node)
    pub required_node_version: Option<String>,
    /// Full path to the extension directory
    pub extension_path: PathBuf,
    /// Whether this is the currently active (newest) installation
    pub is_active: bool,
}

/// Comprehensive Copilot Chat version report
#[derive(Debug, Clone)]
pub struct CopilotVersionReport {
    /// All installed Copilot Chat extension versions
    pub installed: Vec<CopilotChatInstall>,
    /// The active (newest) installation, if any
    pub active_version: Option<Version>,
    /// Extension versions found in session data (version string -> count)
    pub session_versions: HashMap<String, usize>,
    /// Detected version mismatches / compatibility issues
    pub issues: Vec<VersionIssue>,
}

/// A version compatibility issue
#[derive(Debug, Clone)]
pub struct VersionIssue {
    /// Severity: "error", "warning", "info"
    pub severity: &'static str,
    /// Human-readable description
    pub message: String,
}

// ============================================================================
// Minimal package.json deserialization
// ============================================================================

#[derive(Deserialize, Debug)]
struct PackageJson {
    version: Option<String>,
    engines: Option<Engines>,
}

#[derive(Deserialize, Debug)]
struct Engines {
    vscode: Option<String>,
    node: Option<String>,
}

// ============================================================================
// Known Version Compatibility Table
// ============================================================================

/// Known Copilot Chat version ranges and their session format characteristics.
/// Derived from the CHANGELOG at <https://github.com/microsoft/vscode-copilot-chat>
///
/// Key format transitions:
///   - 0.25.x  (Feb 2025)  VS Code 1.98  — Agent mode experimental, legacy JSON
///   - 0.26.x  (Mar 2025)  VS Code 1.99  — Unified chat view, MCP support
///   - 0.27.x  (Apr 2025)  VS Code 1.100 — Prompt files, instructions files
///   - 0.28.x  (May 2025)  VS Code 1.101 — Custom chat modes, tool sets
///   - 0.29.x  (Jun 2025)  VS Code 1.102 — Copilot Chat open source release
///   - 0.30.x  (Jul 2025)  VS Code 1.103 — Chat checkpoints, tool picker revamp
///   - 0.31.x  (Aug 2025)  VS Code 1.104 — Auto model selection, todo list tool
///   - 0.32.x  (Sep 2025)  VS Code 1.105 — MCP marketplace, session management
///   - 0.33.x  (Oct 2025)  VS Code 1.106 — Agent Sessions view, plan agent
///   - 0.35.x  (Nov 2025)  VS Code 1.107 — Agent sessions in Chat view, language models editor
///   - 0.36.x  (Dec 2025)  VS Code 1.108 — Agent Skills experimental
///   - 0.37.x  (Jan 2026)  VS Code 1.109 — JSONL format (event-sourced), session type picker
///   - 0.38.x  (Feb 2026)  VS Code 1.110 — Agent plugins, browser tools, Edit Mode deprecated
///   - 0.39.x  (Mar 2026)  VS Code 1.111 — Autopilot, agent permissions, agent-scoped hooks
///   - 0.40.x  (Mar 2026)  VS Code 1.112 — Copilot CLI message steering, image/binary support
///   - 0.41.x  (Mar 2026)  VS Code 1.113 — Claude/CLI MCP support, nested subagents
///   - 0.42.x+ (Apr 2026+) VS Code 1.114+ — see VS Code release notes for current details
///
/// The JSONL format transition happened with VS Code 1.109.0+ (January 2026).
/// Sessions created with 0.37.x and later use JSONL; earlier versions use legacy JSON.
/// No further on-disk session-format breaking changes have been observed through 0.41.x.
pub struct VersionCompatEntry {
    pub extension_min: &'static str,
    pub extension_max: &'static str,
    pub vscode_min: &'static str,
    pub session_format: &'static str,
    pub notes: &'static str,
}

/// Get the known compatibility table
pub fn known_compatibility() -> Vec<VersionCompatEntry> {
    vec![
        VersionCompatEntry {
            extension_min: "0.25.0",
            extension_max: "0.36.99",
            vscode_min: "1.98.0",
            session_format: "json",
            notes: "Legacy JSON format (single object)",
        },
        VersionCompatEntry {
            extension_min: "0.37.0",
            extension_max: "0.37.99",
            vscode_min: "1.109.0",
            session_format: "jsonl",
            notes: "JSONL event-sourced format introduced (kind 0/1/2)",
        },
        VersionCompatEntry {
            extension_min: "0.38.0",
            extension_max: "0.38.99",
            vscode_min: "1.110.0",
            session_format: "jsonl",
            notes: "Agent plugins, agentic browser tools; Edit Mode hidden by default",
        },
        VersionCompatEntry {
            extension_min: "0.39.0",
            extension_max: "0.39.99",
            vscode_min: "1.111.0",
            session_format: "jsonl",
            notes: "Autopilot and agent permissions, agent-scoped hooks",
        },
        VersionCompatEntry {
            extension_min: "0.40.0",
            extension_max: "0.40.99",
            vscode_min: "1.112.0",
            session_format: "jsonl",
            notes: "Copilot CLI steering/queueing, image and binary file support",
        },
        VersionCompatEntry {
            extension_min: "0.41.0",
            extension_max: "0.49.99",
            vscode_min: "1.113.0",
            session_format: "jsonl",
            notes: "MCP support in Copilot CLI & Claude agents, nested subagents \
                    (covers Copilot Chat 0.41+ on VS Code 1.113+ — JSONL format unchanged)",
        },
    ]
}

// ============================================================================
// Extension Detection
// ============================================================================

/// Get the VS Code extensions directory for the current platform
fn get_vscode_extensions_dir() -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    let path = home.join(".vscode").join("extensions");
    if path.exists() {
        Some(path)
    } else {
        None
    }
}

/// Detect all installed Copilot Chat extension versions.
///
/// Scans `~/.vscode/extensions/` for directories matching `github.copilot-chat-*`
/// and reads each one's `package.json` for version and engine requirements.
pub fn detect_installed_versions() -> Result<Vec<CopilotChatInstall>> {
    let extensions_dir = match get_vscode_extensions_dir() {
        Some(d) => d,
        None => return Ok(Vec::new()),
    };

    let mut installs: Vec<CopilotChatInstall> = Vec::new();

    for entry in std::fs::read_dir(&extensions_dir).with_context(|| {
        format!(
            "Failed to read extensions dir: {}",
            extensions_dir.display()
        )
    })? {
        let entry = entry?;
        let dir_name = entry.file_name().to_string_lossy().to_string();

        // Match github.copilot-chat-X.Y.Z pattern
        if !dir_name.starts_with("github.copilot-chat-") {
            continue;
        }

        let version_str = &dir_name["github.copilot-chat-".len()..];
        let version = match Version::parse(version_str) {
            Ok(v) => v,
            Err(_) => continue, // Skip directories with unparseable version
        };

        let ext_path = entry.path();
        let pkg_path = ext_path.join("package.json");

        let (required_vscode, required_node) = if pkg_path.exists() {
            match std::fs::read_to_string(&pkg_path) {
                Ok(content) => match serde_json::from_str::<PackageJson>(&content) {
                    Ok(pkg) => {
                        let vscode = pkg
                            .engines
                            .as_ref()
                            .and_then(|e| e.vscode.as_ref())
                            .cloned()
                            .unwrap_or_else(|| "unknown".to_string());
                        let node = pkg.engines.as_ref().and_then(|e| e.node.clone());
                        (vscode, node)
                    }
                    Err(_) => ("unknown".to_string(), None),
                },
                Err(_) => ("unknown".to_string(), None),
            }
        } else {
            ("unknown".to_string(), None)
        };

        installs.push(CopilotChatInstall {
            version,
            required_vscode_version: required_vscode,
            required_node_version: required_node,
            extension_path: ext_path,
            is_active: false, // Set below
        });
    }

    // Sort by version descending — newest first
    installs.sort_by(|a, b| b.version.cmp(&a.version));

    // Mark the newest as active
    if let Some(first) = installs.first_mut() {
        first.is_active = true;
    }

    Ok(installs)
}

// ============================================================================
// Session Version Extraction
// ============================================================================

/// Extract the `extensionVersion` from JSONL session content.
///
/// Scans through JSONL lines for request entries containing
/// `agent.extensionVersion` fields and collects all unique versions found.
pub fn extract_session_versions(content: &str) -> Vec<String> {
    let mut versions = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for line in content.lines() {
        if line.is_empty() {
            continue;
        }

        // Fast path: skip lines that don't contain extensionVersion
        if !line.contains("extensionVersion") {
            continue;
        }

        if let Ok(obj) = serde_json::from_str::<serde_json::Value>(line) {
            // Walk common paths: v.requests[].agent.extensionVersion (kind:0)
            // or v.extensionVersion / request.agent.extensionVersion (kind:1/2)
            extract_extension_versions_from_value(&obj, &mut versions, &mut seen);
        }
    }

    versions
}

/// Recursively search a JSON value for extensionVersion fields
fn extract_extension_versions_from_value(
    value: &serde_json::Value,
    versions: &mut Vec<String>,
    seen: &mut std::collections::HashSet<String>,
) {
    match value {
        serde_json::Value::Object(map) => {
            if let Some(v) = map.get("extensionVersion").and_then(|v| v.as_str()) {
                if seen.insert(v.to_string()) {
                    versions.push(v.to_string());
                }
            }
            for (_, v) in map {
                extract_extension_versions_from_value(v, versions, seen);
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr {
                extract_extension_versions_from_value(item, versions, seen);
            }
        }
        _ => {}
    }
}

// ============================================================================
// Version Compatibility Analysis
// ============================================================================

/// Build a full version report by detecting installed extensions and optionally
/// scanning session files for embedded version info.
///
/// If `session_dir` is provided, scans JSONL files in that directory for
/// `extensionVersion` fields.
pub fn build_version_report(session_dir: Option<&Path>) -> Result<CopilotVersionReport> {
    let installed = detect_installed_versions()?;

    let active_version = installed
        .iter()
        .find(|i| i.is_active)
        .map(|i| i.version.clone());

    let mut session_versions: HashMap<String, usize> = HashMap::new();

    if let Some(dir) = session_dir {
        if dir.exists() {
            for entry in std::fs::read_dir(dir)? {
                let entry = entry?;
                let path = entry.path();
                if path.extension().is_some_and(|e| e == "jsonl") {
                    if let Ok(content) = std::fs::read_to_string(&path) {
                        for ver in extract_session_versions(&content) {
                            *session_versions.entry(ver).or_default() += 1;
                        }
                    }
                }
            }
        }
    }

    // Analyze for issues
    let mut issues = Vec::new();

    // Check: No Copilot Chat installed
    if installed.is_empty() {
        issues.push(VersionIssue {
            severity: "error",
            message: "No Copilot Chat extension found in ~/.vscode/extensions/".to_string(),
        });
    }

    // Check: Multiple versions installed (stale installs)
    if installed.len() > 1 {
        let old_versions: Vec<String> = installed
            .iter()
            .skip(1)
            .map(|i| i.version.to_string())
            .collect();
        issues.push(VersionIssue {
            severity: "info",
            message: format!(
                "Multiple Copilot Chat versions installed: older {} may be stale",
                old_versions.join(", ")
            ),
        });
    }

    // Check: Session versions that don't match installed version
    if let Some(ref active) = active_version {
        let active_str = active.to_string();
        for (session_ver, count) in &session_versions {
            if session_ver != &active_str {
                // Determine severity based on major.minor difference
                let severity = if let Ok(sv) = Version::parse(session_ver) {
                    if sv.major != active.major || sv.minor != active.minor {
                        // Different minor version — format may differ
                        "warning"
                    } else {
                        "info"
                    }
                } else {
                    "info"
                };

                issues.push(VersionIssue {
                    severity,
                    message: format!(
                        "{} session(s) created with extension v{} (installed: v{})",
                        count, session_ver, active_str
                    ),
                });
            }
        }
    }

    // Check: Sessions from pre-JSONL era (< 0.37.0) still present with JSONL extension installed
    if let Some(ref active) = active_version {
        if active >= &Version::new(0, 37, 0) {
            for (session_ver, count) in &session_versions {
                if let Ok(sv) = Version::parse(session_ver) {
                    if sv < Version::new(0, 37, 0) {
                        issues.push(VersionIssue {
                            severity: "warning",
                            message: format!(
                                "{} session(s) from pre-JSONL era (v{}) — these use legacy JSON format. \
                                Current extension v{} uses JSONL. Consider upgrading with: ironbridge recover upgrade",
                                count, session_ver, active
                            ),
                        });
                    }
                }
            }
        }
    }

    Ok(CopilotVersionReport {
        installed,
        active_version,
        session_versions,
        issues,
    })
}

/// Format the version report for human-readable console output
pub fn format_version_report(report: &CopilotVersionReport) -> String {
    use std::fmt::Write;

    let mut out = String::new();

    writeln!(out, "[*] Copilot Chat Extension Analysis").unwrap();
    writeln!(out).unwrap();

    if report.installed.is_empty() {
        writeln!(
            out,
            "    [!] No Copilot Chat extension found in ~/.vscode/extensions/"
        )
        .unwrap();
    } else {
        writeln!(out, "    Installed versions:").unwrap();
        for install in &report.installed {
            let active_marker = if install.is_active {
                " (active)"
            } else {
                " (stale)"
            };
            writeln!(
                out,
                "      v{}{} — requires VS Code {}",
                install.version, active_marker, install.required_vscode_version,
            )
            .unwrap();
            if let Some(ref node) = install.required_node_version {
                writeln!(out, "        Node.js: {}", node).unwrap();
            }
            writeln!(out, "        Path: {}", install.extension_path.display()).unwrap();
        }
    }

    if !report.session_versions.is_empty() {
        writeln!(out).unwrap();
        writeln!(out, "    Session extension versions:").unwrap();
        let mut sorted: Vec<_> = report.session_versions.iter().collect();
        sorted.sort_by(|a, b| b.1.cmp(a.1));
        for (ver, count) in sorted {
            writeln!(out, "      v{}: {} session(s)", ver, count).unwrap();
        }
    }

    if !report.issues.is_empty() {
        writeln!(out).unwrap();
        writeln!(out, "    Compatibility notes:").unwrap();
        for issue in &report.issues {
            let prefix = match issue.severity {
                "error" => "[!]",
                "warning" => "[?]",
                _ => "[i]",
            };
            writeln!(out, "      {} {}", prefix, issue.message).unwrap();
        }
    }

    // Show expected session format for the active version
    if let Some(ref active) = report.active_version {
        writeln!(out).unwrap();
        let expected_format = if active >= &Version::new(0, 37, 0) {
            "JSONL (event-sourced, kind 0/1/2)"
        } else {
            "Legacy JSON (single object)"
        };
        writeln!(out, "    Expected session format: {}", expected_format).unwrap();

        // Show known compatibility info
        let compat = known_compatibility();
        for entry in &compat {
            if let (Ok(min), Ok(max)) = (
                Version::parse(entry.extension_min),
                Version::parse(entry.extension_max),
            ) {
                if active >= &min && active <= &max {
                    writeln!(
                        out,
                        "    Min VS Code for this extension: {}",
                        entry.vscode_min
                    )
                    .unwrap();
                    writeln!(out, "    Notes: {}", entry.notes).unwrap();
                    break;
                }
            }
        }
    }

    out
}

/// Format the version report as JSON
pub fn format_version_report_json(report: &CopilotVersionReport) -> Result<String> {
    let installed_json: Vec<serde_json::Value> = report
        .installed
        .iter()
        .map(|i| {
            serde_json::json!({
                "version": i.version.to_string(),
                "required_vscode_version": i.required_vscode_version,
                "required_node_version": i.required_node_version,
                "extension_path": i.extension_path.display().to_string(),
                "is_active": i.is_active,
            })
        })
        .collect();

    let issues_json: Vec<serde_json::Value> = report
        .issues
        .iter()
        .map(|i| {
            serde_json::json!({
                "severity": i.severity,
                "message": i.message,
            })
        })
        .collect();

    let result = serde_json::json!({
        "installed": installed_json,
        "active_version": report.active_version.as_ref().map(|v| v.to_string()),
        "session_versions": report.session_versions,
        "issues": issues_json,
        "compatibility_table": known_compatibility().iter().map(|e| {
            serde_json::json!({
                "extension_range": format!("{} - {}", e.extension_min, e.extension_max),
                "vscode_min": e.vscode_min,
                "session_format": e.session_format,
                "notes": e.notes,
            })
        }).collect::<Vec<_>>(),
    });

    Ok(serde_json::to_string_pretty(&result)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_session_versions_from_jsonl() {
        let content =
            r#"{"kind":0,"v":{"version":3,"requests":[{"agent":{"extensionVersion":"0.32.4"}}]}}"#;
        let versions = extract_session_versions(content);
        assert_eq!(versions, vec!["0.32.4"]);
    }

    #[test]
    fn test_extract_multiple_versions() {
        let content = r#"{"kind":0,"v":{"requests":[{"agent":{"extensionVersion":"0.32.3"}},{"agent":{"extensionVersion":"0.32.4"}}]}}
{"kind":1,"v":{"agent":{"extensionVersion":"0.37.8"}}}"#;
        let versions = extract_session_versions(content);
        assert_eq!(versions.len(), 3);
        assert!(versions.contains(&"0.32.3".to_string()));
        assert!(versions.contains(&"0.32.4".to_string()));
        assert!(versions.contains(&"0.37.8".to_string()));
    }

    #[test]
    fn test_extract_no_versions() {
        let content = r#"{"kind":0,"v":{"version":3,"requests":[{"message":{"text":"hello"}}]}}"#;
        let versions = extract_session_versions(content);
        assert!(versions.is_empty());
    }

    #[test]
    fn test_known_compatibility_table() {
        let compat = known_compatibility();
        assert!(!compat.is_empty());
        // The last entry should be JSONL format
        let last = compat.last().unwrap();
        assert_eq!(last.session_format, "jsonl");
    }
}
