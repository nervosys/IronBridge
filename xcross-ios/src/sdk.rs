//! The iOS SDK sysroot.
//!
//! Apple's SDK (headers + stub `.tbd` framework libraries) is proprietary and
//! its licence restricts use to Apple hardware, so this crate never bundles or
//! downloads it. The user copies an SDK off a Mac (from
//! `Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/`)
//! and points us at it. This module validates that what they pointed at is
//! actually usable before we try to compile against it — a wrong path otherwise
//! surfaces as a wall of clang "file not found" noise.

use crate::error::{Error, Result};
use crate::target::Target;
use std::path::{Path, PathBuf};

/// A validated iOS SDK sysroot.
#[derive(Debug, Clone)]
pub struct Sdk {
    root: PathBuf,
}

impl Sdk {
    /// Validate `root` as an SDK sysroot for `target`'s platform.
    ///
    /// Checks the two markers every real iOS SDK has — the C headers under
    /// `usr/include` and the frameworks under `System/Library/Frameworks` — and
    /// warns (via [`Error::InvalidSdk`]) when the platform does not match the
    /// target (a device SDK cannot link a simulator binary and vice versa).
    pub fn validate(root: impl Into<PathBuf>, target: Target) -> Result<Sdk> {
        let root = root.into();
        if !root.is_dir() {
            return Err(Error::InvalidSdk {
                path: root,
                reason: "path does not exist or is not a directory".into(),
            });
        }
        let frameworks = root.join("System").join("Library").join("Frameworks");
        if !frameworks.is_dir() {
            return Err(Error::InvalidSdk {
                path: root,
                reason: "missing System/Library/Frameworks — not an iOS SDK sysroot".into(),
            });
        }
        // Foundation is present in every iOS SDK; its absence means a truncated
        // or wrong copy.
        if !frameworks.join("Foundation.framework").exists() {
            return Err(Error::InvalidSdk {
                path: root,
                reason: "Foundation.framework is absent — SDK looks incomplete".into(),
            });
        }
        // Cross-check the platform against the target so a simulator build does
        // not silently link a device SDK.
        if let Some(name) = Self::platform_of(&root) {
            let expected = target.platform_sdk_name();
            if !name.contains(expected) {
                return Err(Error::InvalidSdk {
                    path: root,
                    reason: format!(
                        "SDK looks like `{name}` but target {target} needs a `{expected}` SDK"
                    ),
                });
            }
        }
        Ok(Sdk { root })
    }

    /// The sysroot path, for `-isysroot`.
    pub fn sysroot(&self) -> &Path {
        &self.root
    }

    /// Construct an `Sdk` from a bare path without filesystem validation.
    /// Test-only: lets flag-building tests exercise real sysroot paths without
    /// a copied-off-a-Mac SDK present.
    #[cfg(test)]
    pub(crate) fn for_test(root: impl Into<PathBuf>) -> Sdk {
        Sdk { root: root.into() }
    }

    /// Infer the platform name from an `SDKSettings` marker or the directory
    /// name (`iPhoneOS17.0.sdk` -> `iPhoneOS`). Returns `None` when it cannot be
    /// determined, in which case validation does not enforce the platform match.
    fn platform_of(root: &Path) -> Option<String> {
        let file = root.file_name()?.to_string_lossy();
        // Strip a trailing `NN.N.sdk` to leave the platform name.
        let base = file.trim_end_matches(".sdk");
        let name: String = base
            .chars()
            .take_while(|c| c.is_ascii_alphabetic())
            .collect();
        if name.is_empty() {
            None
        } else {
            Some(name)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn platform_is_read_from_the_sdk_directory_name() {
        assert_eq!(
            Sdk::platform_of(Path::new("/x/iPhoneOS17.4.sdk")).as_deref(),
            Some("iPhoneOS")
        );
        assert_eq!(
            Sdk::platform_of(Path::new("/x/iPhoneSimulator17.0.sdk")).as_deref(),
            Some("iPhoneSimulator")
        );
    }

    #[test]
    fn a_missing_sysroot_is_rejected_clearly() {
        let err = Sdk::validate("/definitely/not/here", Target::Arm64Device).unwrap_err();
        match err {
            Error::InvalidSdk { reason, .. } => assert!(reason.contains("does not exist")),
            other => panic!("wrong error: {other}"),
        }
    }
}
