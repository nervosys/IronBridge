//! Discovery of the external tools an off-Mac iOS build needs.
//!
//! None of these ship with the crate; the point of the type is to tell the user
//! *precisely* which piece is missing and how to get it, instead of failing
//! deep inside a compile with a cryptic message.

use crate::error::{Error, Result};
use std::process::Command;

/// One external tool and whether it was located.
#[derive(Debug, Clone)]
pub struct Tool {
    /// Canonical name.
    pub name: &'static str,
    /// What it is for / where to get it, shown when missing.
    pub hint: &'static str,
    /// The version line captured from the tool, if found.
    pub version: Option<String>,
}

impl Tool {
    /// Whether this tool was found.
    pub fn found(&self) -> bool {
        self.version.is_some()
    }
}

/// The full set of tools, resolved against the current `PATH`.
#[derive(Debug, Clone)]
pub struct Toolchain {
    /// C/C++/ObjC cross compiler.
    pub clang: Tool,
    /// The Mach-O linker (`ld64.lld`, part of LLVM).
    pub linker: Tool,
    /// Pseudo-signer for producing a loadable (non-App-Store) binary.
    pub ldid: Tool,
    /// The Rust compiler.
    pub rustc: Tool,
    /// Cargo, for building Rust staticlibs/binaries for the target.
    pub cargo: Tool,
}

impl Toolchain {
    /// Probe `PATH` for every tool and record versions.
    pub fn detect() -> Toolchain {
        Toolchain {
            clang: probe(
                "clang",
                "the LLVM C/ObjC compiler; install LLVM (it can target Apple ABIs)",
                &["--version"],
            ),
            linker: probe(
                "ld64.lld",
                "LLVM's Mach-O linker; ships with LLVM (lld). Needed to link iOS binaries",
                &["--version"],
            ),
            ldid: probe(
                "ldid",
                "Mach-O pseudo-signer (github.com/ProcursusTeam/ldid); required for a loadable binary off a Mac",
                &["-v"],
            ),
            rustc: probe("rustc", "the Rust compiler", &["--version"]),
            cargo: probe("cargo", "the Rust build tool", &["--version"]),
        }
    }

    /// The subset of tools that must be present for a device build to even be
    /// attempted (compiler + linker). Signing/packaging are checked separately
    /// so a user can compile first and sign later.
    pub fn missing_for_compile(&self) -> Vec<&Tool> {
        [&self.clang, &self.linker]
            .into_iter()
            .filter(|t| !t.found())
            .collect()
    }

    /// Error out unless the compile-critical tools are present.
    pub fn require_for_compile(&self) -> Result<()> {
        if let Some(t) = self.missing_for_compile().first() {
            return Err(Error::ToolMissing {
                tool: t.name.to_string(),
                hint: t.hint.to_string(),
            });
        }
        Ok(())
    }
}

/// Whether `rustc` reports the given target triple as installed.
pub fn rust_target_installed(triple: &str) -> bool {
    // `rustc --print target-list` lists *known* triples (compiler support),
    // which is what we actually need to know before invoking cargo; the std
    // component for it is a separate `rustup` concern surfaced by cargo itself.
    match Command::new("rustc").args(["--print", "target-list"]).output() {
        Ok(out) if out.status.success() => String::from_utf8_lossy(&out.stdout)
            .lines()
            .any(|l| l.trim() == triple),
        _ => false,
    }
}

/// Run `name <args>` and capture its first stdout/stderr line as a version.
fn probe(name: &'static str, hint: &'static str, args: &[&str]) -> Tool {
    let version = Command::new(name)
        .args(args)
        .output()
        .ok()
        .filter(|o| o.status.success() || !o.stdout.is_empty() || !o.stderr.is_empty())
        .and_then(|o| {
            let text = if !o.stdout.is_empty() {
                String::from_utf8_lossy(&o.stdout).into_owned()
            } else {
                String::from_utf8_lossy(&o.stderr).into_owned()
            };
            text.lines().next().map(|l| l.trim().to_string())
        })
        .filter(|s| !s.is_empty());
    Tool {
        name,
        hint,
        version,
    }
}
