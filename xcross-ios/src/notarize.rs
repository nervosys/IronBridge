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

/// Submit for notarization; with `wait`, blocks until Apple finishes and returns
/// the parsed status.
pub fn submit(path: &str, creds: &Credentials, wait: bool) -> Result<(Option<String>, Option<SubmissionStatus>)> {
    let args = submit_args(path, creds, wait);
    let refs: Vec<&str> = args[1..].iter().map(String::as_str).collect();
    let (stdout, stderr, _ok) = process::output("xcrun", &{
        let mut v = vec!["notarytool"];
        v.extend(refs);
        v
    })
    .map_err(map_missing)?;
    let text = format!("{stdout}\n{stderr}");
    Ok((parse_submission_id(&text), parse_status(&text)))
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
}
