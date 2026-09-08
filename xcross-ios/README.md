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

## Xcode ontology & wrapper (`ontology`, `xcode` modules)

For the parts of an iOS build that genuinely require Xcode (a full Swift/Xcode
project, real code signing), the crate also ships a **typed ontology** of the
Apple build domain and a **wrapper** that automates the Xcode command surface.

- `ontology` — host-independent types and their relationships: `Platform`,
  `Arch` (with the platform→arch constraint), `Version` (numerically ordered),
  `InstalledSdk`, `Destination` (renders `xcodebuild -destination`),
  `BuildConfiguration`, `ProductType`, `SigningIdentity`/`SigningKind`,
  `ProvisioningProfile`.
- `xcode` — typed builders (`Xcodebuild`, and wrappers for `xcrun`,
  `xcode-select`, `security`) plus parsers (`-showsdks`, `security
  find-identity`). The command construction and parsing are **pure and tested on
  any host**; only execution needs a Mac.

The split is the point: **author and test the whole pipeline on Windows**, then
run it on a Mac (locally or over SSH). Demonstrate it off a Mac with `--dry-run`:

```sh
xcross-ios xcode-build --workspace App.xcworkspace --scheme App \
  --configuration Release --platform iOS --action archive --dry-run
# -> xcodebuild -workspace App.xcworkspace -scheme App -configuration Release \
#      -destination generic/platform=iOS archive

xcross-ios xcode-sdks         # lists SDKs on a Mac; clean "macOS-only" error otherwise
xcross-ios xcode-identities   # lists signing identities on a Mac
```

## `.xcframework` assembly (`xcframework` module)

Once you have per-platform slices (from cross-compiling, or from Xcode), fuse
them into the single multi-platform artifact Apple distributes. This is pure
filesystem + `Info.plist` layout — the same operation as
`xcodebuild -create-xcframework`, done here **on any host**:

```sh
xcross-ios xcframework --name Chasm --out build/ios \
  --slice "iphoneos;arm64;libchasm.a;include" \
  --slice "iphonesimulator;arm64,x86_64;libchasm-sim.a;include"
# -> build/ios/Chasm.xcframework/
#      Info.plist   (AvailableLibraries: ios-arm64, ios-arm64_x86_64-simulator)
#      ios-arm64/{libchasm.a, Headers/}
#      ios-arm64_x86_64-simulator/{libchasm-sim.a, Headers/}
```

The library identifier (`ios-arm64_x86_64-simulator`), the
`SupportedPlatformVariant`, and the platform→arch validity are all derived from
the `ontology` types. (Slices use `;`, not `:`, so Windows drive-letter paths
survive.)

## Remote Mac over SSH (`remote` module)

The Xcode-only stages (a full Swift build, keychain signing) can be triggered
*from* Windows by driving a Mac over SSH. The `ssh`/`scp` argument construction
and POSIX shell-quoting are pure and tested here; only the runners need a
reachable Mac.

```sh
xcross-ios remote-xcodebuild \
  --host mac.local --user ci --port 2222 --identity ~/.ssh/id_ed25519 \
  --workdir '~/Chasm' --workspace Chasm.xcworkspace --scheme Chasm \
  --configuration Release --platform iOS --action archive --dry-run
# -> ssh -p 2222 -i ~/.ssh/id_ed25519 -o BatchMode=yes ci@mac.local -- \
#      "cd ~/Chasm && xcodebuild -workspace Chasm.xcworkspace -scheme Chasm \
#       -configuration Release -destination generic/platform=iOS archive"
```

`RemoteHost` also builds `scp` push/pull argv to sync the project up and the
`.app`/`.ipa`/`.xcframework` products back. It encodes the classic gotcha that
`ssh` spells the port `-p` while `scp` spells it `-P`, and preserves a leading
`~` in the remote workdir so it still expands to the remote `$HOME`.

## Provisioning profiles (`provision`, `plist_read` modules)

A `.mobileprovision` is a PKCS#7/CMS blob whose content is an XML plist that
Apple stores in cleartext — so the profile's identity, team, expiry,
entitlements, and device list can be read **without any crypto dependency** by
slicing out the embedded `<plist>` and parsing it. (The CMS signature is not
verified; the goal is to *read* a profile, not trust it.)

```sh
xcross-ios provision Chasm.mobileprovision
# Name / UUID / Team / App identifier / Expires / Xcode-managed /
# development-vs-distribution / provisioned-device count / entitlement keys
```

Built on `plist_read`, a small dependency-free reader for the XML property-list
subset Apple emits (`dict`/`array`/`string`/`integer`/`real`/`bool`/`date`/
`data`), reused for any Apple plist the crate needs to read.

## Build settings (`build_settings` module)

After a build, `xcodebuild -showBuildSettings` tells you *where the product
landed* and *what it is*. This parses that output and resolves the product path
— which is exactly what the remote executor needs to know which `.app`/`.ipa` to
pull back.

```sh
# On a Mac:
xcross-ios build-settings --workspace App.xcworkspace --scheme App
# Anywhere, parsing a captured dump:
xcross-ios build-settings --file settings.txt --key SWIFT_VERSION
#   bundle id / product name / executable / build dir / resolved product path
```

Typed accessors: `bundle_identifier`, `full_product_name`, `executable_name`,
`configuration_build_dir`, `built_products_dir`, and `product_path()` (joined
with `/`, since these are Mac paths).

## Entitlements vs. profile (`entitlements` module)

The confusing "Provisioning profile doesn't include the … entitlement" /
"application-identifier doesn't match" signing failures are pure comparisons of
two plists — catch them **before** a build:

```sh
xcross-ios entitlements --app App.entitlements --profile Dev.mobileprovision
#   OK, or a list of missing/mismatched entitlements + non-zero exit (for CI)
```

The rules mirror the OS: most entitlements must match exactly, but the
identifier-shaped ones (`application-identifier`, `keychain-access-groups`, the
application-groups array) let the profile carry a trailing `*` the app value
prefix-matches. Arrays are covered element-wise.

## Simulator control (`simctl` module)

Wrap `xcrun simctl`: parse the device list and build boot/install/launch
commands. The parser and builders are pure (tested on Windows); execution runs
on a Mac.

```sh
xcross-ios simctl list --file devices.txt      # parse a capture anywhere
xcross-ios simctl boot    --udid <UDID> --dry-run
xcross-ios simctl install --udid <UDID> --app Chasm.app --dry-run
xcross-ios simctl launch  --udid <UDID> --bundle-id com.nervosys.csm --dry-run
```

`parse_list_devices` handles the `-- <runtime> --` / `Name (UDID) (State)`
format, including device names that themselves contain parentheses, and
`SimDevice::is_booted()` finds a running simulator.

## Signature inspection (`codesign` module)

Read back what a *signed* bundle actually contains and verify it — closing the
signing loop:

```sh
xcross-ios codesign display --file dvvv.txt     # parse identity/team/authorities anywhere
xcross-ios codesign verify --bundle Chasm.app   # (Mac) verify the signature
xcross-ios codesign entitlements --bundle Chasm.app --profile Dev.mobileprovision
#   (Mac) extract the signed app's REAL entitlements and diff them vs the profile
```

`parse_display` distinguishes a certificate signature (full `Authority=` chain,
`TeamIdentifier`) from an ad-hoc one (no authority, `flags=0x2(adhoc)` — what
`ldid` produces). The `entitlements --profile` form composes with the
`entitlements` diff so you validate the *actually-embedded* entitlements, not
just the `.entitlements` source.

## One-command ship (`pipeline` module)

The capstone: chain the whole release on a remote Mac into one ordered,
inspectable plan — **archive → exportArchive `.ipa` → `scp` pull → `codesign`
verify**.

```sh
xcross-ios ship --host mac.local --user ci --identity ~/.ssh/id_ed25519 \
  --workspace Chasm.xcworkspace --scheme Chasm --workdir '~/Chasm' \
  --verify-bundle build/App.xcarchive/Products/Applications/App.app --dry-run
```

`ShipPlan::plan` is pure — it computes every `Step` (its host, program, and exact
args) without running anything, so `--dry-run` shows the full plan on Windows and
`execute()` runs each step where it belongs. Build paths (`--archive-path`,
`--export-path`, …) default to being **relative to `--workdir`** so they resolve
after the remote `cd` (xcodebuild does not expand a `~` in an argument itself).

## ExportOptions.plist (`export_options` module)

`ship`'s export step needs an `ExportOptions.plist`; generate one from flags
instead of hand-writing it:

```sh
xcross-ios export-options --method app-store --team TEAM12345 --out ExportOptions.plist
xcross-ios export-options --method ad-hoc --team TEAM12345 --manual \
  --certificate "Apple Distribution" --profiles "com.nervosys.csm=Chasm AdHoc"
```

Typed `ExportMethod`/`SigningStyle`; manual signing requires a certificate and at
least one profile (validated before emit). `--method` accepts the classic and
newer Xcode aliases (`app-store-connect`, `release-testing`, `debugging`).

## Notarization (`notarize` module)

For distribution outside the App Store, Apple requires the build to be notarized
and the ticket stapled. This wraps `xcrun notarytool` + `stapler`:

```sh
xcross-ios notarize submit --path Chasm.ipa --keychain-profile chasm --wait
xcross-ios notarize staple --path Chasm.ipa --keychain-profile chasm
```

Credentials: `--keychain-profile` (recommended), App Store Connect API key
(`--key-id/--issuer/--key`), or `--apple-id/--team/--password`. The status parser
(`parse_status`, `parse_submission_id`) reads the `--wait` output, taking the
*final* status. **Secrets are redacted in `--dry-run` output** (an app-specific
password shows as `***`).

## JSON (`json` module)

Several Apple tools emit JSON — `simctl list --json`, `notarytool
--output-format json`, `xcresulttool`, SwiftPM's `Package.resolved`. Parsing the
*structured* output is more robust than scraping the human-readable form, so the
crate ships a small dependency-free JSON reader (full grammar: objects, arrays,
strings with `\u` escapes and surrogate pairs, numbers, literals).

It already backs `simctl list --json`:

```sh
xcross-ios simctl list --file devices.json   # JSON auto-detected
```

`parse_list_devices_json` reads each device's name/udid/state as discrete
fields — so names like `iPhone SE (3rd generation)` are exact — and derives the
readable runtime (`com.apple.CoreSimulator.SimRuntime.iOS-17-4` → `iOS 17.4`).

## Design

Deliberately dependency-free: the toolchain probing, the `Info.plist` emitter,
and the ZIP/`.ipa` writer (with a hand-rolled CRC-32) are all `std`-only, so the
crate builds anywhere Rust does — including the Windows hosts it exists to serve.
The flag-construction, plist, and archive logic are unit-tested without needing a
compiler or an SDK present.

## Licence

MIT OR Apache-2.0.
