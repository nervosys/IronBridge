//! # xcross-ios
//!
//! Cross-compile, bundle, pseudo-sign, and package iOS apps from a non-Apple
//! host (Windows or Linux), without Xcode and without a Mac.
//!
//! ## What is genuinely possible off a Mac — and what is not
//!
//! Apple's iOS toolchain is not fully reproducible on other platforms, and this
//! crate is honest about the line:
//!
//! - **Can do:** cross-compile Rust, C, Objective-C and C++ to the three iOS
//!   ABIs (device `arm64`, and the `arm64`/`x86_64` simulators) using `clang`
//!   plus LLVM's Mach-O linker; assemble a `.app` bundle with a valid
//!   `Info.plist`; attach an *ad-hoc* signature and entitlements with
//!   [`ldid`](https://github.com/ProcursusTeam/ldid); and package a store-method
//!   `.ipa`. This is the same mechanism the Theos toolchain uses to build iOS
//!   software on Linux/Windows.
//! - **Cannot do:** produce an App-Store-submittable code signature (that
//!   requires an Apple Developer certificate and Apple's keychain tooling on
//!   macOS), or compile a full Xcode project / Swift app target. The iOS SDK
//!   itself is proprietary and licence-locked to Apple hardware, so the user
//!   must supply a sysroot copied from their own Xcode install; this crate never
//!   bundles or downloads it.
//!
//! The [`doctor`] module reports which pieces the current host has.
//!
//! ## Pipeline
//!
//! [`builder::build`] runs the whole thing from a [`config::Config`]:
//! optionally `cargo build` a Rust crate for the target, assemble the
//! [`bundle::AppBundle`], [`sign`] it, and [`ipa`]-package it. The stages are
//! also exposed individually for `bundle`/`sign`/`package` subcommands.

pub mod builder;
pub mod bundle;
pub mod command;
pub mod config;
pub mod doctor;
pub mod error;
pub mod ipa;
pub mod ontology;
pub mod plist;
pub mod plist_read;
pub mod process;
pub mod provision;
pub mod remote;
pub mod sdk;
pub mod sign;
pub mod target;
pub mod toolchain;
pub mod xcode;
pub mod xcframework;
pub mod zip;

pub use config::Config;
pub use error::{Error, Result};
pub use target::Target;
