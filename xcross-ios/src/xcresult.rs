//! Read test results out of an `.xcresult` bundle via `xcrun xcresulttool`.
//!
//! `xcodebuild test` writes an `.xcresult`; the numbers a build report actually
//! needs (how many tests ran, how many failed, and why) live inside it. Xcode 16
//! exposes a clean, stable shape for exactly that:
//!
//! ```text
//! xcrun xcresulttool get test-results summary --path Foo.xcresult --format json
//! ```
//!
//! This parses that summary with the crate's [`crate::json`] reader. As
//! everywhere, parsing is pure and tested on any host; only running
//! `xcresulttool` needs a Mac — so CI can capture the JSON on the Mac and report
//! from anywhere.
//!
//! Note: the *legacy* `xcresulttool get --format json` object graph (with its
//! `_type`/`_value` wrappers) is deliberately not modeled; the summary command
//! supersedes it and is far more stable.

use crate::error::{Error, Result};
use crate::json::Json;
use crate::process;

/// One failing test.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TestFailure {
    /// The test's name (e.g. `testLoginRejectsBadPassword()`).
    pub test_name: String,
    /// The target it belongs to.
    pub target_name: String,
    /// The assertion / failure message.
    pub failure_text: String,
}

/// The parsed test-results summary.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TestSummary {
    /// Apple's overall verdict, e.g. `Passed` / `Failed`.
    pub result: String,
    /// Total tests executed.
    pub total: u64,
    /// Passed count.
    pub passed: u64,
    /// Failed count.
    pub failed: u64,
    /// Skipped count.
    pub skipped: u64,
    /// Expected-failure count (XCTExpectFailure).
    pub expected_failures: u64,
    /// Details of each failure.
    pub failures: Vec<TestFailure>,
}

impl TestSummary {
    /// True when nothing failed. Uses the counts rather than the `result`
    /// string, so an unexpected verdict spelling cannot mask a failure.
    pub fn is_success(&self) -> bool {
        self.failed == 0
    }

    /// A one-line summary suitable for a build log.
    pub fn headline(&self) -> String {
        format!(
            "{} — {} tests, {} passed, {} failed, {} skipped",
            self.result, self.total, self.passed, self.failed, self.skipped
        )
    }
}

/// Parse `xcresulttool get test-results summary --format json` output.
pub fn parse_summary(text: &str) -> Result<TestSummary> {
    let root = Json::parse(text)?;
    // Counts are numbers in the JSON; missing ones default to 0 so a summary
    // from a slightly different Xcode still parses.
    let n = |key: &str| -> u64 {
        root.get(key)
            .and_then(Json::as_f64)
            .map(|f| f.max(0.0) as u64)
            .unwrap_or(0)
    };
    let result = root
        .get("result")
        .and_then(Json::as_str)
        .ok_or_else(|| Error::InvalidInput("xcresult: summary has no `result`".into()))?
        .to_string();

    let mut failures = Vec::new();
    if let Some(items) = root.get("testFailures").and_then(Json::as_array) {
        for f in items {
            let get = |k: &str| f.get(k).and_then(Json::as_str).unwrap_or("").to_string();
            failures.push(TestFailure {
                test_name: get("testName"),
                target_name: get("targetName"),
                failure_text: get("failureText"),
            });
        }
    }

    Ok(TestSummary {
        result,
        total: n("totalTestCount"),
        passed: n("passedTests"),
        failed: n("failedTests"),
        skipped: n("skippedTests"),
        expected_failures: n("expectedFailures"),
        failures,
    })
}

/// `xcresulttool get test-results summary --path <p> --format json` argv
/// (leading `xcresulttool`, to be run via `xcrun`).
pub fn summary_args(path: &str) -> Vec<String> {
    vec![
        "xcresulttool".into(),
        "get".into(),
        "test-results".into(),
        "summary".into(),
        "--path".into(),
        path.into(),
        "--format".into(),
        "json".into(),
    ]
}

/// Run `xcresulttool` on a Mac and parse the summary.
pub fn summary(path: &str) -> Result<TestSummary> {
    let args = summary_args(path);
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = process::capture("xcrun", &refs).map_err(|e| match e {
        Error::Io { source, .. } if source.kind() == std::io::ErrorKind::NotFound => {
            Error::ToolMissing {
                tool: "xcresulttool".into(),
                hint: "xcresulttool is macOS-only; capture its --format json output on the Mac \
                       and parse it anywhere with `xcresult summary --file`."
                    .into(),
            }
        }
        other => other,
    })?;
    parse_summary(&out)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"{
      "title" : "Test - Chasm",
      "result" : "Failed",
      "totalTestCount" : 42,
      "passedTests" : 39,
      "failedTests" : 2,
      "skippedTests" : 1,
      "expectedFailures" : 0,
      "testFailures" : [
        {
          "testName" : "testLoginRejectsBadPassword()",
          "targetName" : "ChasmTests",
          "failureText" : "XCTAssertEqual failed: (\"401\") is not equal to (\"200\")"
        },
        {
          "testName" : "testSyncSnapshotRequiresAuth()",
          "targetName" : "ChasmTests",
          "failureText" : "Expected 401, got 200"
        }
      ]
    }"#;

    #[test]
    fn parses_counts_and_failures() {
        let s = parse_summary(SAMPLE).unwrap();
        assert_eq!(s.result, "Failed");
        assert_eq!(s.total, 42);
        assert_eq!(s.passed, 39);
        assert_eq!(s.failed, 2);
        assert_eq!(s.skipped, 1);
        assert_eq!(s.failures.len(), 2);
        assert_eq!(s.failures[0].target_name, "ChasmTests");
        assert_eq!(s.failures[0].test_name, "testLoginRejectsBadPassword()");
        // The escaped quotes inside the failure text survive JSON decoding.
        assert!(s.failures[0].failure_text.contains("\"401\""));
        assert!(!s.is_success());
    }

    #[test]
    fn a_passing_run_has_no_failures_and_is_success() {
        let json = r#"{ "result":"Passed", "totalTestCount":10, "passedTests":10,
                        "failedTests":0, "skippedTests":0, "expectedFailures":0 }"#;
        let s = parse_summary(json).unwrap();
        assert!(s.is_success());
        assert!(s.failures.is_empty());
        assert_eq!(s.headline(), "Passed — 10 tests, 10 passed, 0 failed, 0 skipped");
    }

    #[test]
    fn success_is_decided_by_counts_not_the_verdict_string() {
        // An unexpected verdict spelling must not mask a real failure.
        let json = r#"{ "result":"Something Else", "totalTestCount":3, "passedTests":2,
                        "failedTests":1 }"#;
        let s = parse_summary(json).unwrap();
        assert!(!s.is_success());
    }

    #[test]
    fn a_summary_without_result_is_rejected() {
        assert!(parse_summary(r#"{"totalTestCount":1}"#).is_err());
        assert!(parse_summary("not json").is_err());
    }

    #[test]
    fn summary_args_target_the_modern_subcommand() {
        let a = summary_args("Chasm.xcresult");
        assert_eq!(a[0], "xcresulttool");
        assert!(a.windows(2).any(|w| w == ["test-results", "summary"]));
        assert!(a.windows(2).any(|w| w == ["--path", "Chasm.xcresult"]));
        assert!(a.windows(2).any(|w| w == ["--format", "json"]));
    }
}
