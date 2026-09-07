//! The resolved configuration for one build.

use crate::error::{Error, Result};
use crate::plist::AppMetadata;
use crate::target::Target;
use std::path::PathBuf;

/// Everything needed to go from a compiled executable to a signed `.ipa`.
#[derive(Debug, Clone)]
pub struct Config {
    /// The build target (device / simulator).
    pub target: Target,
    /// Path to the iOS SDK sysroot copied off a Mac.
    pub sdk_path: PathBuf,
    /// App identity + version metadata.
    pub meta: AppMetadata,
    /// Where to write the `.app` and `.ipa`.
    pub out_dir: PathBuf,
    /// Optional pre-built Mach-O executable to bundle. When absent, the builder
    /// expects to compile one (Rust crate path in `crate_dir`).
    pub executable: Option<PathBuf>,
    /// Optional Rust crate to `cargo build` for the target.
    pub crate_dir: Option<PathBuf>,
    /// Resources (files/dirs) to copy into the bundle.
    pub resources: Vec<PathBuf>,
    /// Build in release mode.
    pub release: bool,
    /// Skip `ldid` pseudo-signing (produce an unsigned bundle).
    pub skip_sign: bool,
    /// Optional entitlements plist to embed when signing.
    pub entitlements: Option<PathBuf>,
}

impl Config {
    /// Validate the combination of options before doing any work.
    pub fn validate(&self) -> Result<()> {
        self.meta.validate()?;
        if self.executable.is_none() && self.crate_dir.is_none() {
            return Err(Error::InvalidInput(
                "provide either --executable (a prebuilt Mach-O) or --crate (a Rust crate to build)"
                    .into(),
            ));
        }
        if self.executable.is_some() && self.crate_dir.is_some() {
            return Err(Error::InvalidInput(
                "--executable and --crate are mutually exclusive".into(),
            ));
        }
        Ok(())
    }
}
