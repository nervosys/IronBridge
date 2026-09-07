//! Emits the `Info.plist` every iOS `.app` must contain.
//!
//! iOS refuses to install a bundle whose `Info.plist` is missing the identity
//! keys (`CFBundleIdentifier`, `CFBundleExecutable`, `CFBundleVersion`) or a
//! supported-platform entry, so those are always written. The plist is emitted
//! as XML text — the format Apple's tools still accept everywhere — rather than
//! the binary form, which would need a dependency and buys nothing here.

use crate::error::{Error, Result};
use crate::target::Target;

/// The identity + display metadata for the app being packaged.
#[derive(Debug, Clone)]
pub struct AppMetadata {
    /// Reverse-DNS bundle id, e.g. `com.nervosys.csm`.
    pub bundle_id: String,
    /// Display name shown under the icon.
    pub display_name: String,
    /// The executable file name inside the `.app`.
    pub executable: String,
    /// Marketing version (`CFBundleShortVersionString`).
    pub short_version: String,
    /// Build version (`CFBundleVersion`).
    pub build_version: String,
    /// Minimum iOS version (`MinimumOSVersion`).
    pub min_os: String,
}

impl AppMetadata {
    /// Reject the empty/obviously-wrong values that produce an un-installable
    /// bundle, before we spend time compiling.
    pub fn validate(&self) -> Result<()> {
        if self.bundle_id.trim().is_empty() {
            return Err(Error::InvalidInput("bundle id is empty".into()));
        }
        // A bundle id must be reverse-DNS-ish: dot-separated, no spaces.
        if self.bundle_id.contains(char::is_whitespace) || !self.bundle_id.contains('.') {
            return Err(Error::InvalidInput(format!(
                "bundle id `{}` is not a reverse-DNS identifier",
                self.bundle_id
            )));
        }
        if self.executable.trim().is_empty() {
            return Err(Error::InvalidInput("executable name is empty".into()));
        }
        crate::target::validate_min_os(&self.min_os)?;
        Ok(())
    }
}

/// Escape the five XML metacharacters so an app name with `&` or `<` cannot
/// corrupt the plist (or smuggle markup into it).
pub fn xml_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&apos;"),
            _ => out.push(c),
        }
    }
    out
}

/// Render the `Info.plist` XML for `meta` targeting `target`.
pub fn render_info_plist(meta: &AppMetadata, target: Target) -> Result<String> {
    meta.validate()?;
    let platform = if target.is_simulator() {
        "iPhoneSimulator"
    } else {
        "iPhoneOS"
    };
    let k = |key: &str, val: &str| {
        format!(
            "    <key>{}</key>\n    <string>{}</string>\n",
            xml_escape(key),
            xml_escape(val)
        )
    };
    let mut body = String::new();
    body.push_str(&k("CFBundleIdentifier", &meta.bundle_id));
    body.push_str(&k("CFBundleName", &meta.display_name));
    body.push_str(&k("CFBundleDisplayName", &meta.display_name));
    body.push_str(&k("CFBundleExecutable", &meta.executable));
    body.push_str(&k("CFBundleShortVersionString", &meta.short_version));
    body.push_str(&k("CFBundleVersion", &meta.build_version));
    body.push_str(&k("CFBundlePackageType", "APPL"));
    body.push_str(&k("MinimumOSVersion", &meta.min_os));
    body.push_str("    <key>CFBundleSupportedPlatforms</key>\n");
    body.push_str(&format!(
        "    <array>\n      <string>{platform}</string>\n    </array>\n"
    ));
    body.push_str("    <key>UIDeviceFamily</key>\n");
    body.push_str("    <array>\n      <integer>1</integer>\n      <integer>2</integer>\n    </array>\n");

    Ok(format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
         <!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \
         \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n\
         <plist version=\"1.0\">\n  <dict>\n{body}  </dict>\n</plist>\n"
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn meta() -> AppMetadata {
        AppMetadata {
            bundle_id: "com.nervosys.csm".into(),
            display_name: "Chasm & Co".into(),
            executable: "Chasm".into(),
            short_version: "1.0.0".into(),
            build_version: "1".into(),
            min_os: "13.0".into(),
        }
    }

    #[test]
    fn plist_contains_identity_keys_and_escapes_the_name() {
        let xml = render_info_plist(&meta(), Target::Arm64Device).unwrap();
        assert!(xml.contains("<key>CFBundleIdentifier</key>"));
        assert!(xml.contains("<string>com.nervosys.csm</string>"));
        assert!(xml.contains("Chasm &amp; Co"), "name must be XML-escaped");
        assert!(xml.contains("<string>iPhoneOS</string>"));
    }

    #[test]
    fn simulator_target_declares_the_simulator_platform() {
        let xml = render_info_plist(&meta(), Target::Arm64Simulator).unwrap();
        assert!(xml.contains("<string>iPhoneSimulator</string>"));
    }

    #[test]
    fn a_bundle_id_without_a_dot_is_rejected() {
        let mut m = meta();
        m.bundle_id = "notreversedns".into();
        assert!(render_info_plist(&m, Target::Arm64Device).is_err());
    }
}
