//! Parse a `.mobileprovision` provisioning profile.
//!
//! A `.mobileprovision` is a PKCS#7 (CMS) SignedData blob whose *content* is an
//! XML property list — and Apple stores that plist as cleartext inside the blob.
//! So without any crypto dependency we can locate the `<plist>…</plist>` span in
//! the file bytes and parse it. (We do not verify the CMS signature; that needs
//! Apple's cert chain and is out of scope — the goal here is to *read* a profile
//! for its identity, team, expiry, entitlements, and device list.)

use crate::error::{Error, Result};
use crate::ontology::{Platform, ProvisioningProfile};
use crate::plist_read::Plist;
use std::path::Path;

/// The fields of interest from a provisioning profile.
#[derive(Debug, Clone, PartialEq)]
pub struct ParsedProfile {
    /// `Name`.
    pub name: String,
    /// `UUID`.
    pub uuid: String,
    /// `TeamIdentifier` (may list more than one).
    pub team_ids: Vec<String>,
    /// `TeamName`.
    pub team_name: Option<String>,
    /// `AppIDName`.
    pub app_id_name: Option<String>,
    /// `Platform` tokens (`iOS`, `xrOS`, …).
    pub platforms: Vec<String>,
    /// `CreationDate` (raw ISO-8601).
    pub creation_date: Option<String>,
    /// `ExpirationDate` (raw ISO-8601).
    pub expiration_date: Option<String>,
    /// `ProvisionedDevices` UDIDs (absent for App Store / enterprise profiles).
    pub provisioned_devices: Vec<String>,
    /// The `application-identifier` entitlement, if present.
    pub application_identifier: Option<String>,
    /// Whether Xcode manages this profile (`IsXcodeManaged`).
    pub xcode_managed: bool,
    /// The entitlement keys present, for a quick capabilities overview.
    pub entitlement_keys: Vec<String>,
}

impl ParsedProfile {
    /// Parse a profile from raw `.mobileprovision` bytes.
    pub fn from_bytes(bytes: &[u8]) -> Result<ParsedProfile> {
        let xml = extract_plist_xml(bytes)?;
        let plist = Plist::parse(&xml)?;
        Self::from_plist(&plist)
    }

    /// Read and parse a profile file.
    pub fn from_file(path: &Path) -> Result<ParsedProfile> {
        let bytes = std::fs::read(path)
            .map_err(|e| Error::io(format!("reading {}", path.display()), e))?;
        Self::from_bytes(&bytes)
    }

    /// Map a parsed plist into the typed profile.
    pub fn from_plist(p: &Plist) -> Result<ParsedProfile> {
        let get_str = |k: &str| p.get(k).and_then(Plist::as_str).map(String::from);
        let name = get_str("Name")
            .ok_or_else(|| Error::InvalidInput("profile has no Name".into()))?;
        let uuid = get_str("UUID")
            .ok_or_else(|| Error::InvalidInput("profile has no UUID".into()))?;

        let entitlements = p.get("Entitlements");
        let entitlement_keys = match entitlements {
            Some(Plist::Dict(kvs)) => kvs.iter().map(|(k, _)| k.clone()).collect(),
            _ => Vec::new(),
        };
        let application_identifier = entitlements
            .and_then(|e| e.get("application-identifier"))
            .and_then(Plist::as_str)
            .map(String::from);

        Ok(ParsedProfile {
            name,
            uuid,
            team_ids: p
                .get("TeamIdentifier")
                .map(Plist::as_str_array)
                .unwrap_or_default(),
            team_name: get_str("TeamName"),
            app_id_name: get_str("AppIDName"),
            platforms: p.get("Platform").map(Plist::as_str_array).unwrap_or_default(),
            creation_date: p.get("CreationDate").and_then(|d| match d {
                Plist::Date(s) => Some(s.clone()),
                _ => None,
            }),
            expiration_date: p.get("ExpirationDate").and_then(|d| match d {
                Plist::Date(s) => Some(s.clone()),
                _ => None,
            }),
            provisioned_devices: p
                .get("ProvisionedDevices")
                .map(Plist::as_str_array)
                .unwrap_or_default(),
            application_identifier,
            xcode_managed: p
                .get("IsXcodeManaged")
                .and_then(Plist::as_bool)
                .unwrap_or(false),
            entitlement_keys,
        })
    }

    /// Distribution profiles have no `ProvisionedDevices` list.
    pub fn is_distribution(&self) -> bool {
        self.provisioned_devices.is_empty()
    }

    /// Map to the ontology's [`ProvisioningProfile`], picking the first team and
    /// mapping the first platform token.
    pub fn to_ontology(&self) -> ProvisioningProfile {
        let platform = self
            .platforms
            .first()
            .and_then(|p| platform_from_token(p))
            .unwrap_or(Platform::IOS);
        ProvisioningProfile {
            name: self.name.clone(),
            uuid: self.uuid.clone(),
            team_id: self.team_ids.first().cloned().unwrap_or_default(),
            platform,
        }
    }
}

/// Locate and slice out the `<plist …>…</plist>` document embedded in the CMS
/// blob.
pub fn extract_plist_xml(bytes: &[u8]) -> Result<String> {
    let start = find(bytes, b"<plist")
        .ok_or_else(|| Error::InvalidInput("no embedded <plist> found in profile".into()))?;
    let end_rel = find(&bytes[start..], b"</plist>")
        .ok_or_else(|| Error::InvalidInput("embedded plist is not terminated".into()))?;
    let end = start + end_rel + "</plist>".len();
    String::from_utf8(bytes[start..end].to_vec())
        .map_err(|_| Error::InvalidInput("embedded plist is not valid UTF-8".into()))
}

/// A profile's `Platform` token to the ontology platform (device variants;
/// profiles do not distinguish simulator).
fn platform_from_token(token: &str) -> Option<Platform> {
    Some(match token.trim().to_ascii_lowercase().as_str() {
        "ios" => Platform::IOS,
        "macos" | "osx" => Platform::MacOS,
        "tvos" => Platform::TvOS,
        "watchos" => Platform::WatchOS,
        "xros" | "visionos" => Platform::VisionOS,
        _ => return None,
    })
}

fn find(hay: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() || needle.len() > hay.len() {
        return None;
    }
    hay.windows(needle.len()).position(|w| w == needle)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A synthetic profile: binary CMS-ish noise wrapping a cleartext plist,
    /// exactly the shape `extract_plist_xml` must cope with.
    fn fake_mobileprovision() -> Vec<u8> {
        let plist = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
<plist version=\"1.0\"><dict>\n\
  <key>Name</key><string>Chasm Dev</string>\n\
  <key>UUID</key><string>DEAD-BEEF-0001</string>\n\
  <key>TeamIdentifier</key><array><string>TEAM12345</string></array>\n\
  <key>TeamName</key><string>Nervosys</string>\n\
  <key>Platform</key><array><string>iOS</string></array>\n\
  <key>ExpirationDate</key><date>2027-01-01T00:00:00Z</date>\n\
  <key>IsXcodeManaged</key><false/>\n\
  <key>ProvisionedDevices</key><array><string>00008030-DEVICEUDID</string></array>\n\
  <key>Entitlements</key><dict>\n\
    <key>application-identifier</key><string>TEAM12345.com.nervosys.csm</string>\n\
    <key>get-task-allow</key><true/>\n\
  </dict>\n\
</dict></plist>";
        let mut bytes = vec![0x30, 0x82, 0x0A, 0xBC]; // fake DER SignedData header
        bytes.extend_from_slice(&[0xDE, 0xAD, 0xBE, 0xEF]);
        bytes.extend_from_slice(plist.as_bytes());
        bytes.extend_from_slice(&[0x00, 0x01, 0x02]); // trailing signature noise
        bytes
    }

    #[test]
    fn extracts_and_parses_an_embedded_profile_plist() {
        let prof = ParsedProfile::from_bytes(&fake_mobileprovision()).unwrap();
        assert_eq!(prof.name, "Chasm Dev");
        assert_eq!(prof.uuid, "DEAD-BEEF-0001");
        assert_eq!(prof.team_ids, vec!["TEAM12345".to_string()]);
        assert_eq!(prof.team_name.as_deref(), Some("Nervosys"));
        assert_eq!(prof.platforms, vec!["iOS".to_string()]);
        assert_eq!(prof.expiration_date.as_deref(), Some("2027-01-01T00:00:00Z"));
        assert!(!prof.xcode_managed);
        assert_eq!(prof.provisioned_devices, vec!["00008030-DEVICEUDID".to_string()]);
        assert_eq!(
            prof.application_identifier.as_deref(),
            Some("TEAM12345.com.nervosys.csm")
        );
        assert!(prof.entitlement_keys.contains(&"get-task-allow".to_string()));
        // Has devices -> a development profile, not distribution.
        assert!(!prof.is_distribution());
    }

    #[test]
    fn maps_to_the_ontology_type() {
        let prof = ParsedProfile::from_bytes(&fake_mobileprovision()).unwrap();
        let onto = prof.to_ontology();
        assert_eq!(onto.team_id, "TEAM12345");
        assert_eq!(onto.platform, Platform::IOS);
        assert_eq!(onto.uuid, "DEAD-BEEF-0001");
    }

    #[test]
    fn a_blob_without_a_plist_is_rejected() {
        let err = ParsedProfile::from_bytes(b"\x30\x82 not a profile").unwrap_err();
        assert!(matches!(err, Error::InvalidInput(_)));
    }
}
