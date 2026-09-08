//! Parse `xcodebuild -showBuildSettings` output into a queryable map.
//!
//! After a build you need to know *where the product landed* and *what it is* —
//! the `.app`/`.framework` path to sign or pull back from a remote Mac, the
//! bundle identifier, the executable name. `xcodebuild -showBuildSettings`
//! prints all of that as `KEY = VALUE` lines; this parses them and exposes the
//! handful that matter, with a resolver for the product path. The parsing is
//! pure, so it is tested (and usable via `--file`) off a Mac.

use std::collections::BTreeMap;
use std::path::PathBuf;

/// A parsed set of build settings.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct BuildSettings {
    map: BTreeMap<String, String>,
}

impl BuildSettings {
    /// Parse the textual output of `xcodebuild -showBuildSettings`.
    ///
    /// Recognizes the indented `KEY = VALUE` lines and skips the
    /// `Build settings for action … and target …:` headers and blank lines.
    /// When multiple targets are printed, later values win (callers usually
    /// scope to one target/scheme anyway).
    pub fn parse(text: &str) -> BuildSettings {
        let mut map = BTreeMap::new();
        for line in text.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || !line.starts_with(char::is_whitespace) {
                // Non-indented lines are headers ("Build settings for …:").
                continue;
            }
            // Split on the first " = "; keys are uppercase identifiers, so a
            // '=' inside the value (e.g. a flag) does not confuse the split.
            if let Some(eq) = trimmed.find(" = ") {
                let key = trimmed[..eq].trim();
                let val = &trimmed[eq + 3..];
                if is_setting_key(key) {
                    map.insert(key.to_string(), val.to_string());
                }
            } else if let Some(eq) = trimmed.strip_suffix(" =") {
                // An empty value: "KEY =".
                if is_setting_key(eq.trim()) {
                    map.insert(eq.trim().to_string(), String::new());
                }
            }
        }
        BuildSettings { map }
    }

    /// A raw setting.
    pub fn get(&self, key: &str) -> Option<&str> {
        self.map.get(key).map(String::as_str)
    }

    /// Number of settings parsed.
    pub fn len(&self) -> usize {
        self.map.len()
    }

    /// Whether no settings were parsed.
    pub fn is_empty(&self) -> bool {
        self.map.is_empty()
    }

    /// `PRODUCT_BUNDLE_IDENTIFIER`.
    pub fn bundle_identifier(&self) -> Option<&str> {
        self.get("PRODUCT_BUNDLE_IDENTIFIER")
    }

    /// `FULL_PRODUCT_NAME` (e.g. `Chasm.app`).
    pub fn full_product_name(&self) -> Option<&str> {
        self.get("FULL_PRODUCT_NAME")
    }

    /// `EXECUTABLE_NAME` (the Mach-O inside the bundle).
    pub fn executable_name(&self) -> Option<&str> {
        self.get("EXECUTABLE_NAME")
    }

    /// `WRAPPER_NAME` (bundle directory name).
    pub fn wrapper_name(&self) -> Option<&str> {
        self.get("WRAPPER_NAME")
    }

    /// `CONFIGURATION_BUILD_DIR` (where the product is written).
    pub fn configuration_build_dir(&self) -> Option<&str> {
        self.get("CONFIGURATION_BUILD_DIR")
    }

    /// `BUILT_PRODUCTS_DIR`.
    pub fn built_products_dir(&self) -> Option<&str> {
        self.get("BUILT_PRODUCTS_DIR")
    }

    /// The absolute path of the built product:
    /// `CONFIGURATION_BUILD_DIR`/`FULL_PRODUCT_NAME`.
    ///
    /// These settings come from a Mac, so the components are joined with `/`
    /// (not the host separator) to keep it a valid POSIX path even when this
    /// runs on Windows.
    pub fn product_path(&self) -> Option<PathBuf> {
        let dir = self.configuration_build_dir()?.trim_end_matches('/');
        let name = self.full_product_name()?;
        Some(PathBuf::from(format!("{dir}/{name}")))
    }
}

/// Heuristic: an xcodebuild setting key is an uppercase identifier
/// (`A-Z 0-9 _`), which lets the parser ignore stray non-setting lines.
fn is_setting_key(k: &str) -> bool {
    !k.is_empty()
        && k.bytes()
            .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit() || b == b'_')
}

#[cfg(test)]
mod tests {
    use super::*;

    // NB: the setting lines must keep their leading indentation, so this is
    // written with explicit `\n    ` rather than `\`-newline continuations
    // (which strip the following line's leading whitespace).
    const SAMPLE: &str = concat!(
        "Build settings for action build and target Chasm:\n",
        "    ACTION = build\n",
        "    CONFIGURATION_BUILD_DIR = /Users/ci/DD/Build/Products/Release-iphoneos\n",
        "    PRODUCT_BUNDLE_IDENTIFIER = com.nervosys.csm\n",
        "    FULL_PRODUCT_NAME = Chasm.app\n",
        "    EXECUTABLE_NAME = Chasm\n",
        "    WRAPPER_NAME = Chasm.app\n",
        "    OTHER_LDFLAGS = -ObjC -framework Foundation\n",
        "    EMPTY_SETTING =\n",
    );

    #[test]
    fn parses_keys_and_resolves_the_product_path() {
        let s = BuildSettings::parse(SAMPLE);
        assert_eq!(s.bundle_identifier(), Some("com.nervosys.csm"));
        assert_eq!(s.full_product_name(), Some("Chasm.app"));
        assert_eq!(s.executable_name(), Some("Chasm"));
        assert_eq!(
            s.product_path().unwrap(),
            PathBuf::from("/Users/ci/DD/Build/Products/Release-iphoneos/Chasm.app")
        );
    }

    #[test]
    fn a_value_containing_an_equals_sign_is_preserved() {
        let s = BuildSettings::parse(SAMPLE);
        // The value has its own '=' inside a flag; the split is on the first
        // " = " only, so the whole value survives.
        assert_eq!(s.get("OTHER_LDFLAGS"), Some("-ObjC -framework Foundation"));
    }

    #[test]
    fn header_lines_are_ignored_and_empty_values_kept() {
        let s = BuildSettings::parse(SAMPLE);
        // The "Build settings for …" header must not become a setting.
        assert!(s.get("Build settings for action build and target Chasm").is_none());
        assert_eq!(s.get("EMPTY_SETTING"), Some(""));
    }
}
