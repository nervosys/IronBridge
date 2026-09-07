//! iOS build targets and the compiler/linker flags each one implies.
//!
//! Apple ships three relevant ABIs: real devices (`arm64`), the Apple-silicon
//! simulator (`arm64` with a `-simulator` environment), and the Intel simulator
//! (`x86_64`). They map to distinct Rust target triples and distinct clang
//! `-target` values; getting the simulator environment suffix wrong is the
//! classic "works on device, link-fails on simulator" mistake, so it is encoded
//! here once.

use crate::error::{Error, Result};
use std::fmt;

/// A supported iOS build target.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Target {
    /// 64-bit ARM, physical devices (iPhone/iPad).
    Arm64Device,
    /// 64-bit ARM, Apple-silicon simulator.
    Arm64Simulator,
    /// x86-64, Intel-Mac simulator.
    X86_64Simulator,
}

impl Target {
    /// Every target this tool understands.
    pub const ALL: [Target; 3] = [
        Target::Arm64Device,
        Target::Arm64Simulator,
        Target::X86_64Simulator,
    ];

    /// Parse the short name used on the CLI.
    pub fn parse(s: &str) -> Result<Target> {
        match s.trim().to_ascii_lowercase().as_str() {
            "device" | "arm64" | "aarch64" | "aarch64-apple-ios" => Ok(Target::Arm64Device),
            "sim" | "simulator" | "arm64-sim" | "aarch64-apple-ios-sim" => {
                Ok(Target::Arm64Simulator)
            }
            "x86_64-sim" | "x86_64" | "x86_64-apple-ios" => Ok(Target::X86_64Simulator),
            other => Err(Error::InvalidInput(format!(
                "unknown target `{other}` (expected one of: device, sim, x86_64-sim)"
            ))),
        }
    }

    /// The Rust target triple to pass to `cargo build --target`.
    pub fn rust_triple(self) -> &'static str {
        match self {
            Target::Arm64Device => "aarch64-apple-ios",
            Target::Arm64Simulator => "aarch64-apple-ios-sim",
            Target::X86_64Simulator => "x86_64-apple-ios",
        }
    }

    /// The clang/LLVM `-target` value (the LLVM triple, which differs from the
    /// Rust triple: the simulator environment is spelled `-simulator`).
    pub fn llvm_target(self, min_os: &str) -> String {
        match self {
            Target::Arm64Device => format!("arm64-apple-ios{min_os}"),
            Target::Arm64Simulator => format!("arm64-apple-ios{min_os}-simulator"),
            Target::X86_64Simulator => format!("x86_64-apple-ios{min_os}-simulator"),
        }
    }

    /// True for the two simulator targets.
    pub fn is_simulator(self) -> bool {
        matches!(self, Target::Arm64Simulator | Target::X86_64Simulator)
    }

    /// The SDK subdirectory name Apple uses for this target's platform.
    pub fn platform_sdk_name(self) -> &'static str {
        if self.is_simulator() {
            "iPhoneSimulator"
        } else {
            "iPhoneOS"
        }
    }

    /// The Mach-O CPU the produced slice targets, for logging.
    pub fn arch(self) -> &'static str {
        match self {
            Target::Arm64Device | Target::Arm64Simulator => "arm64",
            Target::X86_64Simulator => "x86_64",
        }
    }
}

impl fmt::Display for Target {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.rust_triple())
    }
}

/// Validate a minimum-OS version string (e.g. `13.0`). Apple accepts
/// `major` or `major.minor`; anything else produces broken `-target` flags, so
/// reject it early with a clear message.
pub fn validate_min_os(v: &str) -> Result<()> {
    let v = v.trim();
    if v.is_empty() {
        return Err(Error::InvalidInput("minimum iOS version is empty".into()));
    }
    let parts: Vec<&str> = v.split('.').collect();
    if parts.len() > 3 {
        return Err(Error::InvalidInput(format!(
            "minimum iOS version `{v}` has too many components"
        )));
    }
    for p in parts {
        if p.is_empty() || !p.bytes().all(|b| b.is_ascii_digit()) {
            return Err(Error::InvalidInput(format!(
                "minimum iOS version `{v}` is not numeric"
            )));
        }
    }
    Ok(())
}
