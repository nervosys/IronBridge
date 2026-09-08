// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
//
// Build script: increase the main-thread stack size for the `ironbridge` binary on
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
            "cargo:rustc-link-arg-bin=ironbridge=/STACK:{stack}",
            stack = stack_bytes
        );
        println!(
            "cargo:rustc-link-arg-bin=ironbridge-mcp=/STACK:{stack}",
            stack = stack_bytes
        );
    } else if target.contains("gnu") {
        // GNU ld / lld
        println!(
            "cargo:rustc-link-arg-bin=ironbridge=-Wl,--stack,{stack}",
            stack = stack_bytes
        );
        println!(
            "cargo:rustc-link-arg-bin=ironbridge-mcp=-Wl,--stack,{stack}",
            stack = stack_bytes
        );
    }
}
