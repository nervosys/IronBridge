# xcross-ios

Build iOS apps from **Windows or Linux** — no Xcode, no Mac — by orchestrating a
real cross-compilation toolchain: `clang` targeting the Apple ABIs against a
user-supplied iOS SDK sysroot, LLVM's Mach-O linker, `ldid` pseudo-signing, and
a dependency-free `.ipa` packager.

This is the same mechanism the [Theos](https://theos.dev) toolchain and
`cargo-mobile` use to produce iOS binaries on non-Apple hosts. It is packaged
here as a small, **zero-dependency** Rust crate (library + `xcross-ios` CLI).

## What it can and cannot do — read this first

Apple's iOS build is not fully reproducible off a Mac, and this tool does not
pretend otherwise.

**It CAN, on Windows/Linux:**
- Cross-compile **Rust, C, Objective-C, C++** to the three iOS ABIs — device
  `arm64`, and the `arm64` / `x86_64` simulators — with the correct
  `-target`/`-isysroot`/`-fuse-ld=lld` flags (the flags iOS cross-compiles
  usually get wrong).
- Assemble a valid `.app` bundle with a correct `Info.plist`.
- Attach an **ad-hoc** signature and entitlements with `ldid`.
- Package a store-method `.ipa`.

**It CANNOT:**
- Mint an **App-Store-submittable** code signature. That requires an Apple
  Developer certificate and Apple's keychain tooling, which run only on macOS.
  The ad-hoc signature here is for a **jailbroken device, the simulator, or a
  later on-device free-provisioning resign**.
- Compile a full **Xcode / Swift app target**. It builds native code
  (Rust/C/ObjC libraries and executables), not `.xcodeproj` graphs.
- Ship you the **iOS SDK**. That SDK is Apple-proprietary and its licence
  restricts it to Apple hardware, so you must copy a sysroot from your own Xcode
  install and point `--sdk` at it. This tool never bundles or downloads it.

Run `xcross-ios doctor` to see exactly what your host has and what is missing.

## Prerequisites

| Tool | Why | Where |
|------|-----|-------|
| `clang` + `ld64.lld` | cross-compile & link Mach-O | LLVM release for your OS |
| `ldid` | ad-hoc pseudo-signing | github.com/ProcursusTeam/ldid |
| `rustc` + iOS targets | Rust source (`rustup target add aarch64-apple-ios`) | rustup |
| iOS SDK sysroot | headers + framework stubs | copy from `Xcode.app/.../SDKs/iPhoneOS<ver>.sdk` |

## Usage

```sh
# 1. Check readiness
xcross-ios doctor

# 2. Build a Rust crate into a signed .ipa for a device
xcross-ios build \
  --crate ./my-ios-lib \
  --sdk /opt/ios-sdks/iPhoneOS17.4.sdk \
  --target device \
  --name Chasm --bundle-id com.nervosys.csm \
  --version 1.0.0 --min-os 13.0 \
  --release --out build/ios

# Or bundle a prebuilt Mach-O, then package separately
xcross-ios bundle  --executable ./Chasm --sdk <sdk> --name Chasm --bundle-id com.nervosys.csm
xcross-ios package --app build/ios/Chasm.app --out build/ios/Chasm.ipa
```

## Library

```rust
use xcross_ios::{config::Config, target::Target, plist::AppMetadata, builder};

let config = Config {
    target: Target::Arm64Device,
    sdk_path: "/opt/ios-sdks/iPhoneOS17.4.sdk".into(),
    meta: AppMetadata {
        bundle_id: "com.nervosys.csm".into(),
        display_name: "Chasm".into(),
        executable: "Chasm".into(),
        short_version: "1.0.0".into(),
        build_version: "1".into(),
        min_os: "13.0".into(),
    },
    out_dir: "build/ios".into(),
    executable: None,
    crate_dir: Some("./my-ios-lib".into()),
    resources: vec![],
    release: true,
    skip_sign: false,
    entitlements: None,
};
let artifacts = builder::build(&config)?;
println!("{}", artifacts.ipa.unwrap().display());
# Ok::<(), xcross_ios::Error>(())
```

## Design

Deliberately dependency-free: the toolchain probing, the `Info.plist` emitter,
and the ZIP/`.ipa` writer (with a hand-rolled CRC-32) are all `std`-only, so the
crate builds anywhere Rust does — including the Windows hosts it exists to serve.
The flag-construction, plist, and archive logic are unit-tested without needing a
compiler or an SDK present.

## Licence

MIT OR Apache-2.0.
