//! A Rust wrapper that automates the Xcode / Apple-SDK command surface.
//!
//! Xcode itself is macOS-only, so this module splits cleanly into two halves:
//!
//! - **Pure, host-independent:** typed *command builders* (`xcodebuild`,
//!   `xcrun`, `xcode-select`, `simctl`, `security`) that produce exact argument
//!   vectors, and *parsers* that turn those tools' textual output into the
//!   [`crate::ontology`] types. These compile and are unit-tested on any host —
//!   Windows included — so the automation logic is verifiable off a Mac.
//! - **Execution:** thin runners that invoke the tools. These only succeed where
//!   Xcode is installed (a Mac, whether local or driven over SSH); on a host
//!   without it they return a clear [`Error::ToolMissing`] rather than a cryptic
//!   spawn failure.
//!
//! The division is deliberate: you author and test the whole build pipeline on
//! Windows, then point the execution half at a Mac when it is time to actually
//! run it.

use crate::error::{Error, Result};
use crate::ontology::{
    BuildConfiguration, Destination, InstalledSdk, Platform, SigningIdentity, Version,
};
use crate::process;
use std::path::PathBuf;

// ============================================================================
// xcodebuild
// ============================================================================

/// The `xcodebuild` action to perform.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Action {
    /// `build`
    Build,
    /// `clean`
    Clean,
    /// `test`
    Test,
    /// `archive`
    Archive,
    /// `build-for-testing`
    BuildForTesting,
}

impl Action {
    fn as_str(self) -> &'static str {
        match self {
            Action::Build => "build",
            Action::Clean => "clean",
            Action::Test => "test",
            Action::Archive => "archive",
            Action::BuildForTesting => "build-for-testing",
        }
    }
}

/// Whether the project lives in an `.xcworkspace` or a bare `.xcodeproj`.
#[derive(Debug, Clone)]
pub enum ProjectRef {
    /// `-workspace <path>`
    Workspace(PathBuf),
    /// `-project <path>`
    Project(PathBuf),
}

/// A typed builder for an `xcodebuild` invocation.
#[derive(Debug, Clone)]
pub struct Xcodebuild {
    /// The action.
    pub action: Action,
    /// Workspace or project.
    pub project: Option<ProjectRef>,
    /// Scheme to build.
    pub scheme: Option<String>,
    /// Build configuration.
    pub configuration: Option<BuildConfiguration>,
    /// Destination.
    pub destination: Option<Destination>,
    /// `-derivedDataPath`.
    pub derived_data: Option<PathBuf>,
    /// `-archivePath` (for `archive`).
    pub archive_path: Option<PathBuf>,
    /// Extra `KEY=VALUE` build settings appended verbatim.
    pub build_settings: Vec<(String, String)>,
    /// Disable code signing (`CODE_SIGNING_ALLOWED=NO`) — useful for CI compile
    /// checks that must not touch a keychain.
    pub skip_signing: bool,
}

impl Xcodebuild {
    /// Start a builder for `action`.
    pub fn new(action: Action) -> Self {
        Xcodebuild {
            action,
            project: None,
            scheme: None,
            configuration: None,
            destination: None,
            derived_data: None,
            archive_path: None,
            build_settings: Vec::new(),
            skip_signing: false,
        }
    }

    /// Set the workspace.
    pub fn workspace(mut self, path: impl Into<PathBuf>) -> Self {
        self.project = Some(ProjectRef::Workspace(path.into()));
        self
    }
    /// Set the project.
    pub fn project(mut self, path: impl Into<PathBuf>) -> Self {
        self.project = Some(ProjectRef::Project(path.into()));
        self
    }
    /// Set the scheme.
    pub fn scheme(mut self, s: impl Into<String>) -> Self {
        self.scheme = Some(s.into());
        self
    }
    /// Set the configuration.
    pub fn configuration(mut self, c: BuildConfiguration) -> Self {
        self.configuration = Some(c);
        self
    }
    /// Set the destination.
    pub fn destination(mut self, d: Destination) -> Self {
        self.destination = Some(d);
        self
    }

    /// Render the full argument vector.
    pub fn args(&self) -> Vec<String> {
        let mut a = Vec::new();
        match &self.project {
            Some(ProjectRef::Workspace(p)) => {
                a.push("-workspace".into());
                a.push(p.to_string_lossy().into_owned());
            }
            Some(ProjectRef::Project(p)) => {
                a.push("-project".into());
                a.push(p.to_string_lossy().into_owned());
            }
            None => {}
        }
        if let Some(s) = &self.scheme {
            a.push("-scheme".into());
            a.push(s.clone());
        }
        if let Some(c) = &self.configuration {
            a.push("-configuration".into());
            a.push(c.name().to_string());
        }
        if let Some(d) = &self.destination {
            a.push("-destination".into());
            a.push(d.to_arg());
        }
        if let Some(dd) = &self.derived_data {
            a.push("-derivedDataPath".into());
            a.push(dd.to_string_lossy().into_owned());
        }
        if let Some(ap) = &self.archive_path {
            a.push("-archivePath".into());
            a.push(ap.to_string_lossy().into_owned());
        }
        // The action comes after the options, per xcodebuild's grammar.
        a.push(self.action.as_str().into());
        for (k, v) in &self.build_settings {
            a.push(format!("{k}={v}"));
        }
        if self.skip_signing {
            a.push("CODE_SIGNING_ALLOWED=NO".into());
            a.push("CODE_SIGNING_REQUIRED=NO".into());
        }
        a
    }

    /// Execute (requires a Mac with Xcode). Streams output.
    pub fn run(&self) -> Result<()> {
        let args = self.args();
        let refs: Vec<&str> = args.iter().map(String::as_str).collect();
        run_tool("xcodebuild", &refs)
    }
}

// ============================================================================
// xcrun / xcode-select / simctl / security wrappers
// ============================================================================

/// Resolve the active developer dir (`xcode-select -p`).
pub fn developer_dir() -> Result<PathBuf> {
    let out = capture_tool("xcode-select", &["-p"])?;
    Ok(PathBuf::from(out.trim()))
}

/// The absolute path of an SDK sysroot (`xcrun --sdk <family> --show-sdk-path`).
pub fn sdk_path(platform: Platform) -> Result<PathBuf> {
    let out = capture_tool(
        "xcrun",
        &["--sdk", platform.sdk_family(), "--show-sdk-path"],
    )?;
    Ok(PathBuf::from(out.trim()))
}

/// Locate a tool in the active toolchain (`xcrun --find <tool>`).
pub fn find_tool(name: &str) -> Result<PathBuf> {
    let out = capture_tool("xcrun", &["--find", name])?;
    Ok(PathBuf::from(out.trim()))
}

/// Enumerate installed SDKs by parsing `xcodebuild -showsdks`.
pub fn installed_sdks() -> Result<Vec<InstalledSdk>> {
    let out = capture_tool("xcodebuild", &["-showsdks"])?;
    Ok(parse_showsdks(&out))
}

/// Enumerate code-signing identities via
/// `security find-identity -v -p codesigning`.
pub fn signing_identities() -> Result<Vec<SigningIdentity>> {
    let out = capture_tool("security", &["find-identity", "-v", "-p", "codesigning"])?;
    Ok(parse_find_identity(&out))
}

// ============================================================================
// Parsers (pure, tested off-Mac against captured sample output)
// ============================================================================

/// Parse the `xcodebuild -showsdks` table into [`InstalledSdk`]s.
///
/// The relevant lines look like:
/// `        iOS 17.4                        -sdk iphoneos17.4`
pub fn parse_showsdks(text: &str) -> Vec<InstalledSdk> {
    let mut out = Vec::new();
    for line in text.lines() {
        let Some(idx) = line.find("-sdk ") else {
            continue;
        };
        let canonical = line[idx + 5..].trim().to_string();
        if canonical.is_empty() {
            continue;
        }
        // Split the canonical name into an alphabetic family and trailing
        // version (`iphoneos17.4` -> `iphoneos`, `17.4`).
        let split = canonical
            .find(|c: char| c.is_ascii_digit())
            .unwrap_or(canonical.len());
        let (family, ver) = canonical.split_at(split);
        let Some(platform) = Platform::from_sdk_family(family) else {
            continue;
        };
        let version = Version::parse(ver).unwrap_or(Version { parts: vec![0] });
        out.push(InstalledSdk {
            platform,
            version,
            canonical_name: canonical,
            path: None,
        });
    }
    out
}

/// Parse `security find-identity -v -p codesigning` output.
///
/// Lines look like:
/// `  1) A1B2C3... "Apple Development: Jane Doe (TEAMID)"`
pub fn parse_find_identity(text: &str) -> Vec<SigningIdentity> {
    let mut out = Vec::new();
    for line in text.lines() {
        // Find the quoted common name.
        let Some(open) = line.find('"') else { continue };
        let Some(close_rel) = line[open + 1..].find('"') else {
            continue;
        };
        let name = &line[open + 1..open + 1 + close_rel];
        // The 40-hex SHA-1 precedes the name.
        let sha1 = line[..open]
            .split_whitespace()
            .find(|t| t.len() == 40 && t.bytes().all(|b| b.is_ascii_hexdigit()))
            .map(|s| s.to_string());
        out.push(SigningIdentity {
            kind: SigningIdentity::classify(name),
            name: name.to_string(),
            sha1,
        });
    }
    out
}

// ============================================================================
// Execution helpers
// ============================================================================

/// Whether Xcode appears usable on this host (best-effort: `xcode-select -p`
/// succeeds). Lets callers branch to a remote-Mac strategy off a Mac.
pub fn xcode_available() -> bool {
    developer_dir().is_ok()
}

fn run_tool(program: &str, args: &[&str]) -> Result<()> {
    process::run(program, args).map_err(map_missing)
}

fn capture_tool(program: &str, args: &[&str]) -> Result<String> {
    process::capture(program, args).map_err(map_missing)
}

/// Turn a spawn "not found" into actionable guidance naming macOS/Xcode.
fn map_missing(e: Error) -> Error {
    match e {
        Error::Io { source, .. } if source.kind() == std::io::ErrorKind::NotFound => {
            Error::ToolMissing {
                tool: "xcode".into(),
                hint: "the Xcode command-line tools are macOS-only; run this on a Mac \
                       (or over SSH to one). The builders and parsers here work anywhere; \
                       only execution needs Xcode."
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
    fn xcodebuild_args_follow_the_options_then_action_grammar() {
        let xb = Xcodebuild::new(Action::Build)
            .workspace("Chasm.xcworkspace")
            .scheme("Chasm")
            .configuration(BuildConfiguration::Release)
            .destination(Destination::generic(Platform::IOS));
        let args = xb.args();
        let joined = args.join(" ");
        assert!(joined.contains("-workspace Chasm.xcworkspace"));
        assert!(joined.contains("-scheme Chasm"));
        assert!(joined.contains("-configuration Release"));
        assert!(joined.contains("-destination generic/platform=iOS"));
        // The action must come after the options.
        let action_pos = args.iter().position(|a| a == "build").unwrap();
        let scheme_pos = args.iter().position(|a| a == "-scheme").unwrap();
        assert!(action_pos > scheme_pos);
    }

    #[test]
    fn skip_signing_emits_the_ci_safe_settings() {
        let args = Xcodebuild::new(Action::Build)
            .scheme("Chasm")
            .args_with_skip();
        assert!(args.contains(&"CODE_SIGNING_ALLOWED=NO".to_string()));
    }

    #[test]
    fn showsdks_output_parses_into_platforms_and_versions() {
        let sample = "\
iOS SDKs:
        iOS 17.4                        -sdk iphoneos17.4

iOS Simulator SDKs:
        Simulator - iOS 17.4            -sdk iphonesimulator17.4

macOS SDKs:
        macOS 14.4                      -sdk macosx14.4
";
        let sdks = parse_showsdks(sample);
        assert_eq!(sdks.len(), 3);
        assert_eq!(sdks[0].platform, Platform::IOS);
        assert_eq!(sdks[0].version, Version::parse("17.4").unwrap());
        assert_eq!(sdks[1].platform, Platform::IOSSimulator);
        assert_eq!(sdks[2].platform, Platform::MacOS);
        assert_eq!(sdks[0].canonical_name, "iphoneos17.4");
    }

    #[test]
    fn find_identity_output_parses_names_kinds_and_sha1() {
        let sample = "\
Policy: Code Signing
  Matching identities
  1) A1B2C3D4E5F60718293A4B5C6D7E8F9012345678 \"Apple Development: Jane Doe (TEAM12345)\"
  2) 00112233445566778899AABBCCDDEEFF00112233 \"Apple Distribution: Acme Inc (TEAM12345)\"
     2 identities found
";
        let ids = parse_find_identity(sample);
        assert_eq!(ids.len(), 2);
        assert_eq!(ids[0].name, "Apple Development: Jane Doe (TEAM12345)");
        assert_eq!(
            ids[0].kind,
            crate::ontology::SigningKind::Development
        );
        assert_eq!(
            ids[0].sha1.as_deref(),
            Some("A1B2C3D4E5F60718293A4B5C6D7E8F9012345678")
        );
        assert_eq!(ids[1].kind, crate::ontology::SigningKind::Distribution);
    }
}

// A tiny test-only helper mirroring `.skip_signing = true` then `.args()`,
// kept out of the public builder to avoid a footgun method name.
#[cfg(test)]
impl Xcodebuild {
    fn args_with_skip(mut self) -> Vec<String> {
        self.skip_signing = true;
        self.args()
    }
}
