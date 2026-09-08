//! Assembles a `.xcframework` — Apple's multi-platform distribution artifact —
//! from per-slice frameworks or static libraries.
//!
//! `xcodebuild -create-xcframework` does this on a Mac, but the operation is
//! pure filesystem layout plus an `Info.plist`: create a directory per slice
//! (keyed by a *library identifier* like `ios-arm64` or
//! `ios-arm64_x86_64-simulator`), copy each slice's library in, and write a
//! root `Info.plist` enumerating them. None of that needs Xcode, so it is done
//! here directly and is verifiable off a Mac — the same approach as this crate's
//! `.ipa` packager.
//!
//! The one thing this does *not* do is create the individual slices — those come
//! from cross-compiling (see [`crate::command`]) or from Xcode. This takes
//! already-built slices and unifies them.

use crate::error::{Error, Result};
use crate::ontology::{Arch, Platform};
use crate::plist::xml_escape;
use crate::bundle::copy_recursive;
use std::fs;
use std::path::{Path, PathBuf};

/// A library within one slice: either a dynamic `.framework` or a static `.a`
/// (with an optional headers directory).
#[derive(Debug, Clone)]
pub enum Library {
    /// A `Name.framework` directory.
    Framework(PathBuf),
    /// A static archive plus optional public headers.
    StaticLib {
        /// Path to the `.a`.
        lib: PathBuf,
        /// Optional directory of public headers.
        headers: Option<PathBuf>,
    },
}

impl Library {
    /// The file/bundle name that becomes `LibraryPath` in the plist.
    fn library_path_name(&self) -> Result<String> {
        let p = match self {
            Library::Framework(p) => p,
            Library::StaticLib { lib, .. } => lib,
        };
        p.file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .ok_or_else(|| Error::InvalidInput("library has no file name".into()))
    }
}

/// One architecture slice of the `.xcframework`.
#[derive(Debug, Clone)]
pub struct Slice {
    /// The platform this slice targets.
    pub platform: Platform,
    /// The architectures fused into this slice's library (order-insensitive;
    /// sorted for the identifier).
    pub archs: Vec<Arch>,
    /// The framework or static library.
    pub library: Library,
}

impl Slice {
    /// The library identifier Apple uses for the slice directory and plist key,
    /// e.g. `ios-arm64`, `ios-arm64_x86_64-simulator`, `ios-arm64-maccatalyst`.
    pub fn identifier(&self) -> String {
        let mut archs: Vec<&str> = self.archs.iter().map(|a| a.as_str()).collect();
        archs.sort_unstable();
        archs.dedup();
        let mut id = format!("{}-{}", platform_token(self.platform), archs.join("_"));
        if let Some(variant) = platform_variant(self.platform) {
            id.push('-');
            id.push_str(variant);
        }
        id
    }

    /// Validate the slice before assembly (non-empty archs, all valid for the
    /// platform, existing library on disk).
    pub fn validate(&self) -> Result<()> {
        if self.archs.is_empty() {
            return Err(Error::InvalidInput("slice has no architectures".into()));
        }
        for a in &self.archs {
            if !self.platform.supports(*a) {
                return Err(Error::InvalidInput(format!(
                    "arch {a} is not valid for platform {}",
                    self.platform
                )));
            }
        }
        match &self.library {
            Library::Framework(p) if !p.is_dir() => Err(Error::InvalidInput(format!(
                "framework {} does not exist",
                p.display()
            ))),
            Library::StaticLib { lib, .. } if !lib.is_file() => Err(Error::InvalidInput(
                format!("static library {} does not exist", lib.display()),
            )),
            _ => Ok(()),
        }
    }
}

/// Assemble `slices` into `<out_dir>/<name>.xcframework` and return its path.
pub fn assemble(name: &str, slices: &[Slice], out_dir: &Path) -> Result<PathBuf> {
    if name.trim().is_empty() {
        return Err(Error::InvalidInput("xcframework name is empty".into()));
    }
    if slices.is_empty() {
        return Err(Error::InvalidInput("no slices to assemble".into()));
    }
    // Reject duplicate identifiers up front — two slices in the same directory
    // would silently clobber and produce an invalid xcframework.
    let mut seen = std::collections::BTreeSet::new();
    for s in slices {
        s.validate()?;
        let id = s.identifier();
        if !seen.insert(id.clone()) {
            return Err(Error::InvalidInput(format!(
                "duplicate slice identifier `{id}` — each platform/arch/variant \
                 combination may appear once"
            )));
        }
    }

    let root = out_dir.join(format!("{name}.xcframework"));
    if root.exists() {
        fs::remove_dir_all(&root)
            .map_err(|e| Error::io(format!("clearing {}", root.display()), e))?;
    }
    fs::create_dir_all(&root)
        .map_err(|e| Error::io(format!("creating {}", root.display()), e))?;

    for s in slices {
        let id = s.identifier();
        let slice_dir = root.join(&id);
        fs::create_dir_all(&slice_dir)
            .map_err(|e| Error::io(format!("creating {}", slice_dir.display()), e))?;
        match &s.library {
            Library::Framework(p) => {
                let name = p.file_name().unwrap();
                copy_recursive(p, &slice_dir.join(name))?;
            }
            Library::StaticLib { lib, headers } => {
                let name = lib.file_name().unwrap();
                copy_recursive(lib, &slice_dir.join(name))?;
                if let Some(h) = headers {
                    copy_recursive(h, &slice_dir.join("Headers"))?;
                }
            }
        }
    }

    let plist = render_info_plist(slices)?;
    fs::write(root.join("Info.plist"), plist)
        .map_err(|e| Error::io("writing xcframework Info.plist", e))?;
    Ok(root)
}

/// Render the root `Info.plist` describing every available library.
pub fn render_info_plist(slices: &[Slice]) -> Result<String> {
    let mut libs = String::new();
    // Deterministic order by identifier.
    let mut ordered: Vec<&Slice> = slices.iter().collect();
    ordered.sort_by_key(|s| s.identifier());

    for s in ordered {
        let mut archs: Vec<&str> = s.archs.iter().map(|a| a.as_str()).collect();
        archs.sort_unstable();
        archs.dedup();
        let arch_items: String = archs
            .iter()
            .map(|a| format!("        <string>{}</string>\n", xml_escape(a)))
            .collect();
        let headers_key = match &s.library {
            Library::StaticLib {
                headers: Some(_), ..
            } => "      <key>HeadersPath</key>\n      <string>Headers</string>\n".to_string(),
            _ => String::new(),
        };
        let variant_key = match platform_variant(s.platform) {
            Some(v) => format!(
                "      <key>SupportedPlatformVariant</key>\n      <string>{}</string>\n",
                xml_escape(v)
            ),
            None => String::new(),
        };
        libs.push_str(&format!(
            "    <dict>\n\
             \x20     <key>LibraryIdentifier</key>\n      <string>{id}</string>\n\
             \x20     <key>LibraryPath</key>\n      <string>{path}</string>\n\
             \x20     <key>SupportedArchitectures</key>\n      <array>\n{archs}      </array>\n\
             \x20     <key>SupportedPlatform</key>\n      <string>{platform}</string>\n\
             {variant}{headers}    </dict>\n",
            id = xml_escape(&s.identifier()),
            path = xml_escape(&s.library.library_path_name()?),
            archs = arch_items,
            platform = xml_escape(platform_token(s.platform)),
            variant = variant_key,
            headers = headers_key,
        ));
    }

    Ok(format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
         <!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \
         \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n\
         <plist version=\"1.0\">\n  <dict>\n\
         \x20   <key>AvailableLibraries</key>\n    <array>\n{libs}    </array>\n\
         \x20   <key>CFBundlePackageType</key>\n    <string>XFWK</string>\n\
         \x20   <key>XCFrameworkFormatVersion</key>\n    <string>1.0</string>\n\
         \x20 </dict>\n</plist>\n"
    ))
}

/// The xcframework platform token (`ios`, `macos`, `tvos`, `watchos`, `xros`).
/// Simulator and Mac Catalyst share the base token and are distinguished by a
/// `SupportedPlatformVariant`.
fn platform_token(p: Platform) -> &'static str {
    match p {
        Platform::IOS | Platform::IOSSimulator | Platform::MacCatalyst => "ios",
        Platform::MacOS => "macos",
        Platform::TvOS | Platform::TvOSSimulator => "tvos",
        Platform::WatchOS | Platform::WatchOSSimulator => "watchos",
        Platform::VisionOS | Platform::VisionOSSimulator => "xros",
    }
}

/// The platform variant suffix, if any.
fn platform_variant(p: Platform) -> Option<&'static str> {
    if p.is_simulator() {
        Some("simulator")
    } else if p == Platform::MacCatalyst {
        Some("maccatalyst")
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn static_slice(platform: Platform, archs: Vec<Arch>) -> Slice {
        Slice {
            platform,
            archs,
            library: Library::StaticLib {
                lib: PathBuf::from("libchasm.a"),
                headers: None,
            },
        }
    }

    #[test]
    fn identifier_encodes_platform_archs_and_variant() {
        assert_eq!(
            static_slice(Platform::IOS, vec![Arch::Arm64]).identifier(),
            "ios-arm64"
        );
        assert_eq!(
            static_slice(Platform::IOSSimulator, vec![Arch::X86_64, Arch::Arm64]).identifier(),
            "ios-arm64_x86_64-simulator"
        );
        assert_eq!(
            static_slice(Platform::MacCatalyst, vec![Arch::Arm64]).identifier(),
            "ios-arm64-maccatalyst"
        );
    }

    #[test]
    fn plist_lists_available_libraries_with_variant() {
        let slices = vec![
            static_slice(Platform::IOS, vec![Arch::Arm64]),
            static_slice(Platform::IOSSimulator, vec![Arch::Arm64, Arch::X86_64]),
        ];
        let xml = render_info_plist(&slices).unwrap();
        assert!(xml.contains("<key>AvailableLibraries</key>"));
        assert!(xml.contains("<string>ios-arm64</string>"));
        assert!(xml.contains("<string>ios-arm64_x86_64-simulator</string>"));
        assert!(xml.contains("<key>SupportedPlatformVariant</key>"));
        assert!(xml.contains("<string>simulator</string>"));
        assert!(xml.contains("<string>XFWK</string>"));
        assert!(xml.contains("<string>libchasm.a</string>"));
    }

    #[test]
    fn a_slice_with_a_wrong_arch_for_the_platform_is_rejected() {
        // x86_64 is not valid for an iOS *device* slice.
        let s = static_slice(Platform::IOS, vec![Arch::X86_64]);
        assert!(s.validate().is_err());
    }
}
