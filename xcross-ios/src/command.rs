//! Builds the compiler/linker command lines.
//!
//! Kept as pure functions returning argument vectors so the exact flags are
//! unit-testable without running a compiler — the flags are where iOS
//! cross-compilation actually goes wrong (missing `-isysroot`, wrong
//! `-target` environment, forgetting the `mach-o` linker).

use crate::sdk::Sdk;
use crate::target::Target;

/// The clang argument vector to compile+link a single C/ObjC source into an iOS
/// executable, cross-targeting from any host.
pub fn clang_link_args(
    target: Target,
    sdk: &Sdk,
    min_os: &str,
    sources: &[String],
    output: &str,
) -> Vec<String> {
    let mut args = vec![
        "-target".to_string(),
        target.llvm_target(min_os),
        "-isysroot".to_string(),
        sdk.sysroot().to_string_lossy().into_owned(),
        // Use LLVM's Mach-O linker explicitly; the host's default `ld` cannot
        // produce Mach-O.
        "-fuse-ld=lld".to_string(),
        // Objective-C runtime + ARC, the common case for app glue code.
        "-fobjc-arc".to_string(),
    ];
    for s in sources {
        args.push(s.clone());
    }
    args.push("-o".to_string());
    args.push(output.to_string());
    args
}

/// The `cargo build` argument vector to build a Rust crate for the iOS target.
pub fn cargo_build_args(target: Target, release: bool, extra: &[String]) -> Vec<String> {
    let mut args = vec![
        "build".to_string(),
        "--target".to_string(),
        target.rust_triple().to_string(),
    ];
    if release {
        args.push("--release".to_string());
    }
    args.extend_from_slice(extra);
    args
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sdk() -> Sdk {
        // Build a syntactically valid Sdk without touching the filesystem by
        // going through the crate-internal constructor path used in tests.
        Sdk::for_test("/opt/iPhoneOS17.4.sdk")
    }

    #[test]
    fn device_link_flags_carry_sysroot_target_and_macho_linker() {
        let args = clang_link_args(
            Target::Arm64Device,
            &sdk(),
            "13.0",
            &["main.m".into()],
            "Chasm",
        );
        let joined = args.join(" ");
        assert!(joined.contains("-target arm64-apple-ios13.0"));
        assert!(!joined.contains("-simulator"), "device build is not a sim");
        assert!(joined.contains("-isysroot /opt/iPhoneOS17.4.sdk"));
        assert!(joined.contains("-fuse-ld=lld"));
        assert!(joined.ends_with("-o Chasm"));
    }

    #[test]
    fn simulator_link_flags_use_the_simulator_environment() {
        let args = clang_link_args(
            Target::Arm64Simulator,
            &sdk(),
            "13.0",
            &["main.m".into()],
            "Chasm",
        );
        assert!(args.join(" ").contains("-target arm64-apple-ios13.0-simulator"));
    }

    #[test]
    fn cargo_args_select_the_right_triple_and_release() {
        let args = cargo_build_args(Target::Arm64Device, true, &["--features".into(), "ios".into()]);
        assert_eq!(args[0], "build");
        assert!(args.contains(&"aarch64-apple-ios".to_string()));
        assert!(args.contains(&"--release".to_string()));
        assert!(args.contains(&"--features".to_string()));
    }
}
