// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only
//
// Build script: increase the main-thread stack size for the `chasm` binary on
// Windows. The CLI built with clap has deeply nested subcommand definitions
// that exceed the Windows default 1 MiB main-thread stack during `Cli::parse()`
// (including `--help`). Bumping to 8 MiB matches the default on Linux/macOS.

fn main() {
    println!("cargo:rerun-if-changed=build.rs");

    let target = std::env::var("TARGET").unwrap_or_default();
    if !target.contains("windows") {
        return;
    }

    // 8 MiB stack
    let stack_bytes: usize = 8 * 1024 * 1024;

    if target.contains("msvc") {
        // MSVC linker flag
        println!(
            "cargo:rustc-link-arg-bin=chasm=/STACK:{stack}",
            stack = stack_bytes
        );
        println!(
            "cargo:rustc-link-arg-bin=csm-mcp=/STACK:{stack}",
            stack = stack_bytes
        );
    } else if target.contains("gnu") {
        // GNU ld / lld
        println!(
            "cargo:rustc-link-arg-bin=chasm=-Wl,--stack,{stack}",
            stack = stack_bytes
        );
        println!(
            "cargo:rustc-link-arg-bin=csm-mcp=-Wl,--stack,{stack}",
            stack = stack_bytes
        );
    }
}
