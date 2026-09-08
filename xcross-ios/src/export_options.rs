//! Generate the `ExportOptions.plist` that `xcodebuild -exportArchive` requires.
//!
//! The export step in [`crate::pipeline`] otherwise needs a hand-written
//! `ExportOptions.plist`; this emits a correct one from typed options, so the
//! whole `ship` pipeline can be configured from flags. Pure XML-plist emission
//! (like the `Info.plist` writer), tested on any host.

use crate::error::{Error, Result};
use crate::plist_read::Plist;
use crate::plist::xml_escape;

/// The distribution method (`method` key). Apple renamed these in recent Xcode,
/// but the classic values are still accepted and are what most CI uses.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExportMethod {
    /// App Store Connect upload/export.
    AppStore,
    /// Ad-hoc distribution (registered devices).
    AdHoc,
    /// In-house / enterprise distribution.
    Enterprise,
    /// Development distribution.
    Development,
}

impl ExportMethod {
    /// The `method` string.
    pub fn as_str(self) -> &'static str {
        match self {
            ExportMethod::AppStore => "app-store",
            ExportMethod::AdHoc => "ad-hoc",
            ExportMethod::Enterprise => "enterprise",
            ExportMethod::Development => "development",
        }
    }

    /// Parse a method name (accepts the classic and a couple of newer aliases).
    pub fn parse(s: &str) -> Result<ExportMethod> {
        Ok(match s.trim().to_ascii_lowercase().as_str() {
            "app-store" | "app-store-connect" | "appstore" => ExportMethod::AppStore,
            "ad-hoc" | "adhoc" | "release-testing" => ExportMethod::AdHoc,
            "enterprise" => ExportMethod::Enterprise,
            "development" | "debugging" | "dev" => ExportMethod::Development,
            other => {
                return Err(Error::InvalidInput(format!(
                    "unknown export method `{other}` (app-store|ad-hoc|enterprise|development)"
                )))
            }
        })
    }
}

/// How signing is resolved.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SigningStyle {
    /// Xcode-managed automatic signing.
    Automatic,
    /// Explicit certificate + provisioning profiles.
    Manual,
}

impl SigningStyle {
    fn as_str(self) -> &'static str {
        match self {
            SigningStyle::Automatic => "automatic",
            SigningStyle::Manual => "manual",
        }
    }
}

/// Typed `ExportOptions.plist` contents.
#[derive(Debug, Clone)]
pub struct ExportOptions {
    /// Distribution method.
    pub method: ExportMethod,
    /// The Apple team identifier.
    pub team_id: Option<String>,
    /// Automatic vs manual signing.
    pub signing_style: SigningStyle,
    /// For manual signing: `bundle id -> profile name/uuid`.
    pub provisioning_profiles: Vec<(String, String)>,
    /// For manual signing: the signing certificate (e.g. `Apple Distribution`).
    pub signing_certificate: Option<String>,
    /// Upload the app's symbols (App Store).
    pub upload_symbols: bool,
    /// Strip Swift symbols from the exported product.
    pub strip_swift_symbols: bool,
    /// `export` (produce an .ipa locally) or `upload` (send to App Store).
    pub destination_upload: bool,
}

impl ExportOptions {
    /// A minimal set for the given method with automatic signing.
    pub fn new(method: ExportMethod) -> ExportOptions {
        ExportOptions {
            method,
            team_id: None,
            signing_style: SigningStyle::Automatic,
            provisioning_profiles: Vec::new(),
            signing_certificate: None,
            upload_symbols: true,
            strip_swift_symbols: true,
            destination_upload: false,
        }
    }

    /// Validate before emitting: manual signing needs a certificate and at least
    /// one profile.
    pub fn validate(&self) -> Result<()> {
        if self.signing_style == SigningStyle::Manual {
            if self.signing_certificate.is_none() {
                return Err(Error::InvalidInput(
                    "manual signing requires a signing certificate".into(),
                ));
            }
            if self.provisioning_profiles.is_empty() {
                return Err(Error::InvalidInput(
                    "manual signing requires at least one provisioning profile".into(),
                ));
            }
        }
        Ok(())
    }

    /// Render the `ExportOptions.plist` XML.
    pub fn render(&self) -> Result<String> {
        self.validate()?;
        let mut body = String::new();
        let kv_str = |k: &str, v: &str| {
            format!(
                "    <key>{}</key>\n    <string>{}</string>\n",
                xml_escape(k),
                xml_escape(v)
            )
        };
        let kv_bool = |k: &str, v: bool| {
            format!("    <key>{}</key>\n    <{}/>\n", xml_escape(k), if v { "true" } else { "false" })
        };

        body.push_str(&kv_str("method", self.method.as_str()));
        if let Some(team) = &self.team_id {
            body.push_str(&kv_str("teamID", team));
        }
        body.push_str(&kv_str("signingStyle", self.signing_style.as_str()));
        if let Some(cert) = &self.signing_certificate {
            body.push_str(&kv_str("signingCertificate", cert));
        }
        if !self.provisioning_profiles.is_empty() {
            body.push_str("    <key>provisioningProfiles</key>\n    <dict>\n");
            // Deterministic order.
            let mut pp = self.provisioning_profiles.clone();
            pp.sort();
            for (bundle, profile) in pp {
                body.push_str(&format!(
                    "      <key>{}</key>\n      <string>{}</string>\n",
                    xml_escape(&bundle),
                    xml_escape(&profile)
                ));
            }
            body.push_str("    </dict>\n");
        }
        body.push_str(&kv_bool("uploadSymbols", self.upload_symbols));
        body.push_str(&kv_bool("stripSwiftSymbols", self.strip_swift_symbols));
        body.push_str(&kv_str(
            "destination",
            if self.destination_upload { "upload" } else { "export" },
        ));

        Ok(format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
             <!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \
             \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n\
             <plist version=\"1.0\">\n  <dict>\n{body}  </dict>\n</plist>\n"
        ))
    }
}

/// Round-trip check: parse a rendered ExportOptions back to a `Plist` (used by
/// the tests to assert structure without a brittle string compare).
pub fn parse(xml: &str) -> Result<Plist> {
    Plist::parse(xml)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_store_automatic_renders_the_core_keys() {
        let mut o = ExportOptions::new(ExportMethod::AppStore);
        o.team_id = Some("TEAM12345".into());
        let xml = o.render().unwrap();
        let p = parse(&xml).unwrap();
        assert_eq!(p.get("method").and_then(Plist::as_str), Some("app-store"));
        assert_eq!(p.get("teamID").and_then(Plist::as_str), Some("TEAM12345"));
        assert_eq!(
            p.get("signingStyle").and_then(Plist::as_str),
            Some("automatic")
        );
        assert_eq!(p.get("uploadSymbols").and_then(Plist::as_bool), Some(true));
        assert_eq!(p.get("destination").and_then(Plist::as_str), Some("export"));
    }

    #[test]
    fn manual_signing_emits_certificate_and_profiles() {
        let mut o = ExportOptions::new(ExportMethod::AdHoc);
        o.signing_style = SigningStyle::Manual;
        o.signing_certificate = Some("Apple Distribution".into());
        o.provisioning_profiles = vec![("com.nervosys.csm".into(), "Chasm AdHoc".into())];
        let p = parse(&o.render().unwrap()).unwrap();
        assert_eq!(
            p.get("signingCertificate").and_then(Plist::as_str),
            Some("Apple Distribution")
        );
        let profiles = p.get("provisioningProfiles").unwrap();
        assert_eq!(
            profiles.get("com.nervosys.csm").and_then(Plist::as_str),
            Some("Chasm AdHoc")
        );
    }

    #[test]
    fn manual_signing_without_a_certificate_is_rejected() {
        let mut o = ExportOptions::new(ExportMethod::AppStore);
        o.signing_style = SigningStyle::Manual;
        // No certificate, no profiles.
        assert!(o.render().is_err());
    }

    #[test]
    fn method_parse_accepts_classic_and_new_names() {
        assert_eq!(
            ExportMethod::parse("release-testing").unwrap(),
            ExportMethod::AdHoc
        );
        assert_eq!(
            ExportMethod::parse("app-store-connect").unwrap(),
            ExportMethod::AppStore
        );
        assert!(ExportMethod::parse("nonsense").is_err());
    }
}
