// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

//! Browser Module Tests
//!
//! Tests for browser detection and cookie scanning functionality.

// Note: We can't directly import from ironbridge crate in integration tests
// These tests verify the external behavior through the CLI

// =============================================================================
// Browser Detection Tests (via CLI)
// =============================================================================

mod browser_detection {
    use assert_cmd::Command;
    use predicates::prelude::*;

    #[allow(deprecated)] // cargo_bin is still the standard way to test CLI binaries
    fn ironbridge_cmd() -> Command {
        Command::cargo_bin("ironbridge").unwrap()
    }

    #[test]
    fn test_harvest_scan_with_web_flag() {
        // Test that --web flag is recognized
        ironbridge_cmd()
            .args(["harvest", "scan", "--web", "--timeout", "1"])
            .assert()
            .success()
            .stdout(predicate::str::contains("Browser Authentication"));
    }

    #[test]
    fn test_harvest_scan_without_web_flag() {
        // Without --web, browser section should not appear
        ironbridge_cmd()
            .args(["harvest", "scan"])
            .assert()
            .success()
            .stdout(predicate::str::contains("LLM Providers"))
            .stdout(predicate::str::contains("VS Code Workspaces"));
    }

    #[test]
    fn test_harvest_scan_timeout_option() {
        // Test custom timeout
        ironbridge_cmd()
            .args(["harvest", "scan", "--web", "--timeout", "2"])
            .assert()
            .success();
    }

    #[test]
    fn test_harvest_scan_verbose_option() {
        // Test verbose output
        ironbridge_cmd()
            .args(["harvest", "scan", "--verbose"])
            .assert()
            .success();
    }

    #[test]
    fn test_harvest_scan_sessions_option() {
        // Test sessions display
        ironbridge_cmd()
            .args(["harvest", "scan", "--sessions"])
            .assert()
            .success();
    }
}

// =============================================================================
// Web Provider Scanning Tests
// =============================================================================

mod web_provider_scanning {
    use assert_cmd::Command;
    use predicates::prelude::*;

    #[allow(deprecated)] // cargo_bin is still the standard way to test CLI binaries
    fn ironbridge_cmd() -> Command {
        Command::cargo_bin("ironbridge").unwrap()
    }

    #[test]
    fn test_web_scan_includes_summary() {
        ironbridge_cmd()
            .args(["harvest", "scan", "--web", "--timeout", "1"])
            .assert()
            .success()
            .stdout(predicate::str::contains("Summary"))
            .stdout(predicate::str::contains("local providers"))
            .stdout(predicate::str::contains("web providers"));
    }

    #[test]
    fn test_web_scan_shows_endpoint_status() {
        // Should show endpoint status for at least some providers
        ironbridge_cmd()
            .args(["harvest", "scan", "--web", "--timeout", "2"])
            .assert()
            .success()
            .stdout(predicate::str::contains("Web LLM Provider Endpoints"));
    }
}
