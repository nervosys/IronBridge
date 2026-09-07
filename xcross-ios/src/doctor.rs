//! `doctor`: report exactly how ready this host is to build for iOS, and what
//! is missing. This is the first thing a user should run.

use crate::target::Target;
use crate::toolchain::{rust_target_installed, Toolchain};
use std::fmt::Write as _;

/// Produce the human-readable readiness report.
pub fn report() -> String {
    let tc = Toolchain::detect();
    let mut out = String::new();
    let _ = writeln!(out, "xcross-ios readiness\n====================");

    let line = |out: &mut String, t: &crate::toolchain::Tool| {
        let mark = if t.found() { "ok  " } else { "MISS" };
        let ver = t.version.as_deref().unwrap_or(t.hint);
        let _ = writeln!(out, "  [{mark}] {:<9} {}", t.name, ver);
    };
    let _ = writeln!(out, "\ntools:");
    line(&mut out, &tc.clang);
    line(&mut out, &tc.linker);
    line(&mut out, &tc.ldid);
    line(&mut out, &tc.rustc);
    line(&mut out, &tc.cargo);

    let _ = writeln!(out, "\nrust targets (rustc support):");
    for t in Target::ALL {
        let ok = rust_target_installed(t.rust_triple());
        let mark = if ok { "ok  " } else { "MISS" };
        let _ = writeln!(out, "  [{mark}] {}", t.rust_triple());
    }

    let _ = writeln!(
        out,
        "\nnote: you must supply an iOS SDK sysroot (copied from Xcode on a Mac).\n\
         Apple's licence restricts that SDK to Apple hardware; this tool never\n\
         bundles or downloads it. Pass it with --sdk <path>.\n\
         \n\
         What this tool CAN do off a Mac: cross-compile Rust/C/ObjC to the iOS\n\
         ABIs, assemble a .app, ad-hoc pseudo-sign with ldid, and package a .ipa.\n\
         What it CANNOT do: mint an App-Store code signature (needs Apple certs\n\
         + keychain on macOS) or compile a full Xcode/Swift project."
    );

    let compile_ready = tc.missing_for_compile().is_empty();
    let _ = writeln!(
        out,
        "\nsummary: {}",
        if compile_ready {
            "compiler + linker present — cross-compilation can be attempted (given an SDK)."
        } else {
            "missing compile-critical tools (see MISS above); install LLVM (clang + lld)."
        }
    );
    out
}
