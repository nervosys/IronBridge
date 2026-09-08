//! A wrapper for `xcrun notarytool` (+ `stapler`) — Apple notarization.
//!
//! After exporting a build for distribution outside the App Store
//! (Developer ID, or an ad-hoc/enterprise `.ipa`), Apple requires it to be
//! *notarized*: uploaded to Apple, scanned, and — once accepted — have the
//! resulting ticket *stapled* to the artifact. This models that flow:
//! credential and command construction plus a status parser are pure and tested
//! anywhere; the runners spawn `xcrun`/`stapler` and need a Mac.
//!
//! Secrets: prefer `--keychain-profile` (nothing sensitive on the command line)
//! or App Store Connect API keys (a key *path*, not the key). When an
//! app-specific password is used, it is **redacted** in any rendered/dry-run
//! output by [`redact`].

use crate::error::{Error, Result};
use crate::process;

/// How to authenticate to the notary service.
#[derive(Debug, Clone)]
pub enum Credentials {
    /// A `notarytool store-credentials` keychain profile (recommended: no
    /// secret on the command line).
    KeychainProfile(String),
    /// Apple ID + team + an app-specific password.
    AppleId {
        /// The Apple ID email.
        apple_id: String,
        /// The team identifier.
        team_id: String,
        /// An app-specific password (redacted in display).
        password: String,
    },
    /// App Store Connect API key: key id, issuer id, and the `.p8` key path.
    ApiKey {
        /// The key id.
        key_id: String,
        /// The issuer id.
        issuer: String,
        /// Path to the `.p8` private key file.
        key_path: String,
    },
}

impl Credentials {
    /// The credential arguments to append to a notarytool command.
    pub fn args(&self) -> Vec<String> {
        match self {
            Credentials::KeychainProfile(p) => {
                vec!["--keychain-profile".into(), p.clone()]
            }
            Credentials::AppleId {
                apple_id,
                team_id,
                password,
            } => vec![
                "--apple-id".into(),
                apple_id.clone(),
                "--team-id".into(),
                team_id.clone(),
                "--password".into(),
                password.clone(),
            ],
            Credentials::ApiKey {
                key_id,
                issuer,
                key_path,
            } => vec![
                "--key-id".into(),
                key_id.clone(),
                "--issuer".into(),
                issuer.clone(),
                "--key".into(),
                key_path.clone(),
            ],
        }
    }
}

/// The outcome of a notarization submission.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SubmissionStatus {
    /// Still being processed.
    InProgress,
    /// Accepted — ready to staple.
    Accepted,
    /// Rejected: the upload was invalid.
    Invalid,
    /// Rejected for policy reasons.
    Rejected,
    /// Anything else notarytool prints.
    Other(String),
}

impl SubmissionStatus {
    /// Parse a status word.
    pub fn parse(s: &str) -> SubmissionStatus {
        match s.trim() {
            "In Progress" => SubmissionStatus::InProgress,
            "Accepted" => SubmissionStatus::Accepted,
            "Invalid" => SubmissionStatus::Invalid,
            "Rejected" => SubmissionStatus::Rejected,
            other => SubmissionStatus::Other(other.to_string()),
        }
    }

    /// Whether the submission finished (accepted or rejected), i.e. no longer in
    /// progress.
    pub fn is_terminal(&self) -> bool {
        !matches!(self, SubmissionStatus::InProgress)
    }
}

// ============================================================================
// Command builders (pure)
// ============================================================================

/// `notarytool submit <path> <creds> [--wait]` argv (leading `notarytool`).
pub fn submit_args(path: &str, creds: &Credentials, wait: bool) -> Vec<String> {
    let mut a = vec!["notarytool".into(), "submit".into(), path.into()];
    a.extend(creds.args());
    if wait {
        a.push("--wait".into());
    }
    a
}

/// `notarytool info <submission_id> <creds>` argv.
pub fn info_args(submission_id: &str, creds: &Credentials) -> Vec<String> {
    let mut a = vec!["notarytool".into(), "info".into(), submission_id.into()];
    a.extend(creds.args());
    a
}

/// `notarytool log <submission_id> <creds>` argv (the JSON failure log).
pub fn log_args(submission_id: &str, creds: &Credentials) -> Vec<String> {
    let mut a = vec!["notarytool".into(), "log".into(), submission_id.into()];
    a.extend(creds.args());
    a
}

/// `stapler staple <path>` argv (leading `stapler`) — attaches the ticket.
pub fn staple_args(path: &str) -> Vec<String> {
    vec!["staple".into(), path.into()]
}

/// Append `--output-format json` so notarytool emits structured output.
///
/// Preferred over scraping the human-readable form: the JSON carries the id,
/// status and message as discrete fields and is stable across versions.
pub fn with_json_output(mut args: Vec<String>) -> Vec<String> {
    args.push("--output-format".into());
    args.push("json".into());
    args
}

// ============================================================================
// Output parsing (pure)
// ============================================================================

/// Extract the submission `id:` from notarytool output.
pub fn parse_submission_id(text: &str) -> Option<String> {
    field(text, "id:")
}

/// Extract the last `status:` from notarytool output (the final status when
/// `--wait` was used).
pub fn parse_status(text: &str) -> Option<SubmissionStatus> {
    // Take the *last* status line: with --wait, progress lines precede the
    // final one.
    text.lines()
        .filter_map(|l| l.trim().strip_prefix("status:"))
        .map(|v| SubmissionStatus::parse(v.trim()))
        .last()
}

/// A submission as reported by `notarytool --output-format json`.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SubmissionInfo {
    /// The submission UUID.
    pub id: Option<String>,
    /// The current status.
    pub status: Option<SubmissionStatus>,
    /// Apple's human-readable message.
    pub message: Option<String>,
    /// The uploaded file name (present on `info`).
    pub name: Option<String>,
    /// Creation timestamp (present on `info`).
    pub created_date: Option<String>,
}

/// Parse `notarytool submit|info --output-format json` output.
pub fn parse_json_submission(text: &str) -> Result<SubmissionInfo> {
    let v = crate::json::Json::parse(text)?;
    let s = |k: &str| v.get(k).and_then(crate::json::Json::as_str).map(String::from);
    Ok(SubmissionInfo {
        id: s("id"),
        status: s("status").map(|st| SubmissionStatus::parse(&st)),
        message: s("message"),
        name: s("name"),
        created_date: s("createdDate"),
    })
}

/// One issue from the notarization log — why a submission was rejected.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LogIssue {
    /// `error` / `warning`.
    pub severity: String,
    /// The path inside the archive the issue refers to.
    pub path: String,
    /// Apple's explanation.
    pub message: String,
    /// A documentation URL, when Apple supplies one.
    pub doc_url: Option<String>,
}

/// The parsed notarization log (`notarytool log`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NotarizationLog {
    /// Overall status.
    pub status: Option<SubmissionStatus>,
    /// Apple's one-line summary.
    pub status_summary: Option<String>,
    /// Every reported issue — the actionable part.
    pub issues: Vec<LogIssue>,
}

/// Parse `notarytool log <id>` JSON. This is what actually explains a rejection.
pub fn parse_log(text: &str) -> Result<NotarizationLog> {
    use crate::json::Json;
    let v = Json::parse(text)?;
    let s = |k: &str| v.get(k).and_then(Json::as_str).map(String::from);
    let mut issues = Vec::new();
    if let Some(items) = v.get("issues").and_then(Json::as_array) {
        for it in items {
            let g = |k: &str| it.get(k).and_then(Json::as_str).unwrap_or("").to_string();
            issues.push(LogIssue {
                severity: g("severity"),
                path: g("path"),
                message: g("message"),
                doc_url: it
                    .get("docUrl")
                    .and_then(Json::as_str)
                    .map(String::from)
                    .filter(|u| !u.is_empty()),
            });
        }
    }
    Ok(NotarizationLog {
        status: s("status").map(|st| SubmissionStatus::parse(&st)),
        status_summary: s("statusSummary"),
        issues,
    })
}

/// Find the first `key: value` field.
fn field(text: &str, key: &str) -> Option<String> {
    text.lines()
        .find_map(|l| l.trim().strip_prefix(key).map(|v| v.trim().to_string()))
        .filter(|s| !s.is_empty())
}

/// Redact secret-bearing arguments for display (the value after `--password`).
pub fn redact(args: &[String]) -> Vec<String> {
    let mut out = Vec::with_capacity(args.len());
    let mut i = 0;
    while i < args.len() {
        out.push(args[i].clone());
        if args[i] == "--password" && i + 1 < args.len() {
            out.push("***".to_string());
            i += 2;
        } else {
            i += 1;
        }
    }
    out
}

// ============================================================================
// Execution (needs a Mac)
// ============================================================================

/// Submit for notarization; with `wait`, blocks until Apple finishes.
///
/// Requests `--output-format json` and parses that; if the tool emitted no
/// usable JSON (an older notarytool, or an error on stderr) it falls back to
/// scraping the human-readable form, so this stays robust across versions.
pub fn submit(path: &str, creds: &Credentials, wait: bool) -> Result<SubmissionInfo> {
    let args = with_json_output(submit_args(path, creds, wait));
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let (stdout, stderr, _ok) = process::output("xcrun", &refs).map_err(map_missing)?;

    if let Ok(info) = parse_json_submission(stdout.trim()) {
        if info.id.is_some() || info.status.is_some() {
            return Ok(info);
        }
    }
    let text = format!("{stdout}\n{stderr}");
    Ok(SubmissionInfo {
        id: parse_submission_id(&text),
        status: parse_status(&text),
        ..Default::default()
    })
}

/// Fetch and parse the notarization log for a submission (explains rejections).
pub fn log(submission_id: &str, creds: &Credentials) -> Result<NotarizationLog> {
    let args = log_args(submission_id, creds);
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let (stdout, _stderr, _ok) = process::output("xcrun", &refs).map_err(map_missing)?;
    parse_log(stdout.trim())
}

/// Staple the notarization ticket to the artifact.
pub fn staple(path: &str) -> Result<()> {
    let args = staple_args(path);
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    process::run("stapler", &refs).map_err(map_missing)
}

fn map_missing(e: Error) -> Error {
    match e {
        Error::Io { source, .. } if source.kind() == std::io::ErrorKind::NotFound => {
            Error::ToolMissing {
                tool: "notarytool/stapler".into(),
                hint: "Apple notarization tools are macOS-only; run on a Mac. The command \
                       builders and status parser here work anywhere."
                    .into(),
            }
        }
        other => other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn credential_variants_build_the_right_flags() {
        assert_eq!(
            Credentials::KeychainProfile("chasm".into()).args(),
            vec!["--keychain-profile", "chasm"]
        );
        assert_eq!(
            Credentials::ApiKey {
                key_id: "K1".into(),
                issuer: "I1".into(),
                key_path: "AuthKey.p8".into(),
            }
            .args(),
            vec!["--key-id", "K1", "--issuer", "I1", "--key", "AuthKey.p8"]
        );
    }

    #[test]
    fn submit_args_and_wait() {
        let creds = Credentials::KeychainProfile("chasm".into());
        let a = submit_args("Chasm.ipa", &creds, true);
        assert_eq!(a[0], "notarytool");
        assert!(a.contains(&"submit".to_string()));
        assert!(a.contains(&"Chasm.ipa".to_string()));
        assert!(a.contains(&"--keychain-profile".to_string()));
        assert!(a.contains(&"--wait".to_string()));
    }

    #[test]
    fn password_is_redacted_for_display() {
        let creds = Credentials::AppleId {
            apple_id: "dev@nervosys.ai".into(),
            team_id: "TEAM12345".into(),
            password: "abcd-efgh-ijkl-mnop".into(),
        };
        let args = submit_args("Chasm.ipa", &creds, false);
        let shown = redact(&args);
        assert!(shown.contains(&"***".to_string()));
        assert!(!shown.contains(&"abcd-efgh-ijkl-mnop".to_string()));
        // The Apple ID and team are not secret and remain.
        assert!(shown.contains(&"dev@nervosys.ai".to_string()));
    }

    #[test]
    fn parses_id_and_final_status_from_wait_output() {
        let out = concat!(
            "Conducting pre-submission checks...\n",
            "Submission ID received\n",
            "  id: 11111111-2222-3333-4444-555555555555\n",
            "Waiting for processing to complete.\n",
            "  status: In Progress\n",
            "Processing complete\n",
            "  id: 11111111-2222-3333-4444-555555555555\n",
            "  status: Accepted\n",
        );
        assert_eq!(
            parse_submission_id(out).as_deref(),
            Some("11111111-2222-3333-4444-555555555555")
        );
        // The last status wins, not the interim "In Progress".
        assert_eq!(parse_status(out), Some(SubmissionStatus::Accepted));
        assert!(parse_status(out).unwrap().is_terminal());
    }

    #[test]
    fn an_invalid_submission_is_terminal_and_distinct() {
        let out = "  id: X\n  status: Invalid\n";
        assert_eq!(parse_status(out), Some(SubmissionStatus::Invalid));
        assert!(SubmissionStatus::InProgress.is_terminal() == false);
    }

    #[test]
    fn json_output_flag_is_appended() {
        let a = with_json_output(vec!["notarytool".into(), "submit".into()]);
        assert!(a.windows(2).any(|w| w == ["--output-format", "json"]));
    }

    #[test]
    fn parses_structured_submission_output() {
        let json = r#"{
          "id" : "11111111-2222-3333-4444-555555555555",
          "message" : "Successfully received submission info",
          "name" : "Chasm.ipa",
          "createdDate" : "2026-09-08T01:02:03.000Z",
          "status" : "Accepted"
        }"#;
        let info = parse_json_submission(json).unwrap();
        assert_eq!(
            info.id.as_deref(),
            Some("11111111-2222-3333-4444-555555555555")
        );
        assert_eq!(info.status, Some(SubmissionStatus::Accepted));
        assert_eq!(info.name.as_deref(), Some("Chasm.ipa"));
        assert!(info.message.unwrap().contains("Successfully"));
    }

    #[test]
    fn parses_the_rejection_log_issues() {
        let json = r#"{
          "logFormatVersion" : 1,
          "jobId" : "1111",
          "status" : "Invalid",
          "statusSummary" : "Archive contains critical validation errors",
          "issues" : [
            { "severity" : "error",
              "path" : "Chasm.ipa/Payload/Chasm.app/Chasm",
              "message" : "The binary is not signed with a valid Developer ID certificate.",
              "docUrl" : "https://developer.apple.com/documentation/security/notarizing",
              "architecture" : "arm64" },
            { "severity" : "warning",
              "path" : "Chasm.ipa/Payload/Chasm.app",
              "message" : "The signature does not include a secure timestamp.",
              "docUrl" : "" }
          ]
        }"#;
        let log = parse_log(json).unwrap();
        assert_eq!(log.status, Some(SubmissionStatus::Invalid));
        assert!(log.status_summary.unwrap().contains("validation errors"));
        assert_eq!(log.issues.len(), 2);
        assert_eq!(log.issues[0].severity, "error");
        assert!(log.issues[0].message.contains("Developer ID"));
        assert!(log.issues[0].doc_url.is_some());
        // An empty docUrl becomes None rather than an empty string.
        assert_eq!(log.issues[1].doc_url, None);
    }
}
