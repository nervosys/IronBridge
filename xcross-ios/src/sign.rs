//! Pseudo-signing a Mach-O with `ldid`.
//!
//! Honest scope: Apple's real code signature is a CMS blob chained to an Apple
//! certificate and can only be produced with Apple's keychain tooling on macOS.
//! What we can do off a Mac is attach an *ad-hoc* signature and embed
//! entitlements with `ldid` — enough for a jailbroken device, a personal
//! (free-provisioning) resign done later on-device, or a simulator run. It is
//! NOT an App-Store-submittable signature, and this module never pretends
//! otherwise.

use crate::error::{Error, Result};
use crate::process;
use std::path::Path;

/// Default ad-hoc entitlements: `get-task-allow` so a debugger can attach,
/// which is what a development install needs.
pub const DEFAULT_ENTITLEMENTS: &str = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n\
<plist version=\"1.0\">\n  <dict>\n    <key>get-task-allow</key>\n    <true/>\n  </dict>\n</plist>\n";

/// Ad-hoc pseudo-sign `binary` in place with `ldid`, optionally embedding an
/// entitlements plist file.
///
/// Returns [`Error::ToolMissing`] when `ldid` is absent so the caller can tell
/// the user exactly what to install rather than emitting a broken bundle.
pub fn ldid_sign(binary: &Path, entitlements: Option<&Path>) -> Result<()> {
    if !binary.is_file() {
        return Err(Error::InvalidInput(format!(
            "cannot sign missing file {}",
            binary.display()
        )));
    }
    // `ldid -S` ad-hoc signs; `-S<file>` signs with entitlements.
    let sign_flag = match entitlements {
        Some(ent) => format!("-S{}", ent.display()),
        None => "-S".to_string(),
    };
    process::run("ldid", &[sign_flag.as_str(), &binary.to_string_lossy()]).map_err(|e| {
        // Translate a plain "not found" into actionable guidance.
        match e {
            Error::Io { source, .. } if source.kind() == std::io::ErrorKind::NotFound => {
                Error::ToolMissing {
                    tool: "ldid".into(),
                    hint: "install ldid (github.com/ProcursusTeam/ldid) to pseudo-sign the binary"
                        .into(),
                }
            }
            other => other,
        }
    })?;
    Ok(())
}
