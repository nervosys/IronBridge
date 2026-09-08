//! A wrapper for `codesign` — inspect and verify a signed bundle's signature.
//!
//! This closes the signing loop: after a bundle is signed (by `ldid` locally or
//! Xcode on a Mac), read back *what it actually contains* — the signing
//! identity, team, certificate chain, and the embedded entitlements — and verify
//! the signature. Combined with [`crate::entitlements::diff`], you can check a
//! signed app's real entitlements against a profile, not just its `.entitlements`
//! source.
//!
//! As elsewhere, the parsers and command builders are pure and tested on any
//! host; only the runners spawn `codesign` and need a Mac.

use crate::error::{Error, Result};
use crate::plist_read::Plist;
use crate::process;
use std::path::Path;

/// Parsed `codesign -dvvv` display information.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SignInfo {
    /// `Identifier=` — the code-signing identifier (usually the bundle id).
    pub identifier: Option<String>,
    /// `TeamIdentifier=` (`not set` when unsigned/ad-hoc).
    pub team_identifier: Option<String>,
    /// `Format=` — e.g. `app bundle with Mach-O thin (arm64)`.
    pub format: Option<String>,
    /// `Authority=` lines, leaf-first (the certificate chain).
    pub authorities: Vec<String>,
    /// The `CodeDirectory … flags=…` clause, if present.
    pub flags: Option<String>,
}

impl SignInfo {
    /// True when there is a real certificate chain (more than just an ad-hoc
    /// seal). An ad-hoc signature reports no `Authority`.
    pub fn is_certificate_signed(&self) -> bool {
        !self.authorities.is_empty()
    }

    /// The leaf (signing) certificate authority, if any.
    pub fn leaf_authority(&self) -> Option<&str> {
        self.authorities.first().map(String::as_str)
    }
}

/// Parse `codesign -dvvv` output (which Apple prints to stderr).
pub fn parse_display(text: &str) -> SignInfo {
    let mut info = SignInfo::default();
    for line in text.lines() {
        let line = line.trim();
        if let Some(v) = line.strip_prefix("Identifier=") {
            info.identifier = Some(v.to_string());
        } else if let Some(v) = line.strip_prefix("TeamIdentifier=") {
            // codesign prints `not set` when there is no team.
            if v != "not set" {
                info.team_identifier = Some(v.to_string());
            }
        } else if let Some(v) = line.strip_prefix("Format=") {
            info.format = Some(v.to_string());
        } else if let Some(v) = line.strip_prefix("Authority=") {
            info.authorities.push(v.to_string());
        } else if let Some(rest) = line.strip_prefix("CodeDirectory ") {
            // Pull the `flags=…` token out of the CodeDirectory line.
            if let Some(fl) = rest.split_whitespace().find(|t| t.starts_with("flags=")) {
                info.flags = Some(fl.to_string());
            }
        }
    }
    info
}

// ============================================================================
// Command builders (pure)
// ============================================================================

/// `codesign --verify --deep --strict -vvv <bundle>` argv.
pub fn verify_args(bundle: &str) -> Vec<String> {
    vec![
        "--verify".into(),
        "--deep".into(),
        "--strict".into(),
        "-vvv".into(),
        bundle.into(),
    ]
}

/// `codesign -d -vvv <bundle>` argv (display signature info).
pub fn display_args(bundle: &str) -> Vec<String> {
    vec!["-d".into(), "-vvv".into(), bundle.into()]
}

/// `codesign -d --entitlements :- --xml <bundle>` argv (dump entitlements to
/// stdout as XML).
pub fn entitlements_args(bundle: &str) -> Vec<String> {
    vec![
        "-d".into(),
        "--entitlements".into(),
        ":-".into(),
        "--xml".into(),
        bundle.into(),
    ]
}

/// `codesign -s <identity> [--entitlements <file>] -f <bundle>` argv (sign).
pub fn sign_args(identity: &str, entitlements: Option<&str>, bundle: &str) -> Vec<String> {
    let mut a = vec!["-s".into(), identity.into(), "-f".into()];
    if let Some(ent) = entitlements {
        a.push("--entitlements".into());
        a.push(ent.into());
    }
    a.push(bundle.into());
    a
}

// ============================================================================
// Execution (needs a Mac)
// ============================================================================

/// Inspect a signed bundle (`codesign -d -vvv`, which writes to stderr).
pub fn display(bundle: &Path) -> Result<SignInfo> {
    let args = display_args(&bundle.to_string_lossy());
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let (_stdout, stderr, _ok) = process::output("codesign", &refs).map_err(map_missing)?;
    Ok(parse_display(&stderr))
}

/// Extract a signed bundle's embedded entitlements as a [`Plist`].
pub fn entitlements(bundle: &Path) -> Result<Plist> {
    let args = entitlements_args(&bundle.to_string_lossy());
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let (stdout, stderr, ok) = process::output("codesign", &refs).map_err(map_missing)?;
    if !ok && stdout.trim().is_empty() {
        return Err(Error::CommandFailed {
            program: "codesign".into(),
            status: "non-zero".into(),
            stderr: stderr.trim().to_string(),
        });
    }
    Plist::parse(&stdout)
}

/// Verify a bundle's signature (`codesign --verify …`); Err on failure.
pub fn verify(bundle: &Path) -> Result<()> {
    let args = verify_args(&bundle.to_string_lossy());
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let (_o, stderr, ok) = process::output("codesign", &refs).map_err(map_missing)?;
    if ok {
        Ok(())
    } else {
        Err(Error::CommandFailed {
            program: "codesign --verify".into(),
            status: "verification failed".into(),
            stderr: stderr.trim().to_string(),
        })
    }
}

fn map_missing(e: Error) -> Error {
    match e {
        Error::Io { source, .. } if source.kind() == std::io::ErrorKind::NotFound => {
            Error::ToolMissing {
                tool: "codesign".into(),
                hint: "codesign is macOS-only; run on a Mac. The parser and command builders \
                       here work anywhere."
                    .into(),
            }
        }
        other => other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DISPLAY: &str = concat!(
        "Executable=/Users/ci/Build/Chasm.app/Chasm\n",
        "Identifier=com.nervosys.csm\n",
        "Format=app bundle with Mach-O thin (arm64)\n",
        "CodeDirectory v=20400 size=1234 flags=0x10000(runtime) hashes=40+7\n",
        "Signature size=4795\n",
        "Authority=Apple Development: Jane Doe (TEAM12345)\n",
        "Authority=Apple Worldwide Developer Relations Certification Authority\n",
        "Authority=Apple Root CA\n",
        "TeamIdentifier=TEAM12345\n",
        "Sealed Resources version=2 rules=13 files=42\n",
    );

    #[test]
    fn parses_identity_team_authorities_and_flags() {
        let info = parse_display(DISPLAY);
        assert_eq!(info.identifier.as_deref(), Some("com.nervosys.csm"));
        assert_eq!(info.team_identifier.as_deref(), Some("TEAM12345"));
        assert_eq!(info.authorities.len(), 3);
        assert_eq!(
            info.leaf_authority(),
            Some("Apple Development: Jane Doe (TEAM12345)")
        );
        assert_eq!(info.flags.as_deref(), Some("flags=0x10000(runtime)"));
        assert!(info.is_certificate_signed());
    }

    #[test]
    fn an_adhoc_signature_has_no_authority_and_no_team() {
        let adhoc = concat!(
            "Identifier=com.nervosys.csm\n",
            "Format=Mach-O thin (arm64)\n",
            "CodeDirectory v=20400 size=1234 flags=0x2(adhoc) hashes=40+3\n",
            "Signature=adhoc\n",
            "TeamIdentifier=not set\n",
        );
        let info = parse_display(adhoc);
        assert!(!info.is_certificate_signed());
        assert_eq!(info.team_identifier, None);
        assert_eq!(info.flags.as_deref(), Some("flags=0x2(adhoc)"));
    }

    #[test]
    fn command_builders_are_correct() {
        assert_eq!(
            verify_args("Chasm.app"),
            vec!["--verify", "--deep", "--strict", "-vvv", "Chasm.app"]
        );
        assert_eq!(
            entitlements_args("Chasm.app"),
            vec!["-d", "--entitlements", ":-", "--xml", "Chasm.app"]
        );
        assert_eq!(
            sign_args("Apple Development", Some("app.entitlements"), "Chasm.app"),
            vec!["-s", "Apple Development", "-f", "--entitlements", "app.entitlements", "Chasm.app"]
        );
        // No entitlements file -> no --entitlements flag.
        assert_eq!(
            sign_args("Apple Development", None, "Chasm.app"),
            vec!["-s", "Apple Development", "-f", "Chasm.app"]
        );
    }
}
