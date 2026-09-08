//! Read SwiftPM's `Package.resolved` — the dependency pin file.
//!
//! This is the Swift analogue of `Cargo.lock` / `package-lock.json`: it records
//! the exact revision each dependency resolved to. Reading it lets you audit an
//! Apple project's supply chain from any host — in particular to find pins that
//! track a **branch** rather than a version, which are not reproducible and
//! silently pull new upstream code on every resolve.
//!
//! Three on-disk shapes exist and all are handled:
//! - **v1** (pre-Xcode 14): `{"object":{"pins":[{"package":…,"repositoryURL":…,
//!   "state":{"revision":…,"version":…,"branch":…}}]},"version":1}`
//! - **v2** (Xcode 14+): top-level `pins`, with `identity`/`location`.
//! - **v3** (Xcode 15+): as v2, plus an `originHash`.

use crate::error::{Error, Result};
use crate::json::Json;

/// One resolved dependency.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Pin {
    /// The package identity (v2/v3) or name (v1).
    pub identity: String,
    /// The repository URL.
    pub location: String,
    /// The exact commit it resolved to.
    pub revision: Option<String>,
    /// The semantic version, when pinned to one.
    pub version: Option<String>,
    /// The branch, when tracking one instead of a version.
    pub branch: Option<String>,
}

impl Pin {
    /// True when this pin tracks a branch rather than a released version.
    ///
    /// Branch pins are not reproducible: a later `resolve` can pull entirely new
    /// upstream code under the same declaration, which is exactly the property a
    /// dependency audit wants to flag.
    pub fn tracks_branch(&self) -> bool {
        self.branch.is_some() && self.version.is_none()
    }

    /// True when there is no exact revision recorded — nothing anchors this
    /// dependency at all.
    pub fn is_unanchored(&self) -> bool {
        self.revision.as_deref().unwrap_or("").is_empty()
    }
}

/// A parsed `Package.resolved`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Resolved {
    /// The file-format version (1, 2 or 3).
    pub version: u64,
    /// The pins, in file order.
    pub pins: Vec<Pin>,
}

impl Resolved {
    /// Parse a `Package.resolved` document (any of the three formats).
    pub fn parse(text: &str) -> Result<Resolved> {
        let root = Json::parse(text)?;
        let version = root
            .get("version")
            .and_then(Json::as_f64)
            .map(|f| f as u64)
            .unwrap_or(0);

        // v1 nests the pins under `object`; v2/v3 put them at the top level.
        let pins_value = root
            .get("pins")
            .or_else(|| root.get("object").and_then(|o| o.get("pins")))
            .ok_or_else(|| {
                Error::InvalidInput("Package.resolved: no `pins` array found".into())
            })?;
        let items = pins_value.as_array().ok_or_else(|| {
            Error::InvalidInput("Package.resolved: `pins` is not an array".into())
        })?;

        let mut pins = Vec::with_capacity(items.len());
        for item in items {
            let s = |k: &str| item.get(k).and_then(Json::as_str).map(String::from);
            // v2/v3 use identity/location; v1 uses package/repositoryURL.
            let identity = s("identity")
                .or_else(|| s("package"))
                .ok_or_else(|| {
                    Error::InvalidInput("Package.resolved: pin without identity/package".into())
                })?;
            let location = s("location").or_else(|| s("repositoryURL")).unwrap_or_default();

            let state = item.get("state");
            let sf = |k: &str| {
                state
                    .and_then(|st| st.get(k))
                    .and_then(Json::as_str)
                    .map(String::from)
                    .filter(|v| !v.is_empty())
            };

            pins.push(Pin {
                identity,
                location,
                revision: sf("revision"),
                version: sf("version"),
                branch: sf("branch"),
            });
        }
        Ok(Resolved { version, pins })
    }

    /// Look a pin up by identity (case-insensitive, as SwiftPM identities are).
    pub fn find(&self, identity: &str) -> Option<&Pin> {
        self.pins
            .iter()
            .find(|p| p.identity.eq_ignore_ascii_case(identity))
    }

    /// Pins that track a branch instead of a version.
    pub fn branch_pins(&self) -> Vec<&Pin> {
        self.pins.iter().filter(|p| p.tracks_branch()).collect()
    }

    /// Pins with no recorded revision.
    pub fn unanchored_pins(&self) -> Vec<&Pin> {
        self.pins.iter().filter(|p| p.is_unanchored()).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const V2: &str = r#"{
      "pins" : [
        { "identity" : "alamofire",
          "kind" : "remoteSourceControl",
          "location" : "https://github.com/Alamofire/Alamofire.git",
          "state" : { "revision" : "f455c2975872ccd2d9c81594c658af65716e9b9a", "version" : "5.8.1" } },
        { "identity" : "swift-log",
          "kind" : "remoteSourceControl",
          "location" : "https://github.com/apple/swift-log.git",
          "state" : { "revision" : "532d8b529501fb73a2455b179e0bbb6d49b652ed", "branch" : "main" } }
      ],
      "version" : 2
    }"#;

    const V1: &str = r#"{
      "object" : {
        "pins" : [
          { "package" : "Alamofire",
            "repositoryURL" : "https://github.com/Alamofire/Alamofire.git",
            "state" : { "branch" : null, "revision" : "abc123", "version" : "5.8.1" } }
        ]
      },
      "version" : 1
    }"#;

    #[test]
    fn parses_the_v2_format() {
        let r = Resolved::parse(V2).unwrap();
        assert_eq!(r.version, 2);
        assert_eq!(r.pins.len(), 2);
        let a = r.find("Alamofire").unwrap();
        assert_eq!(a.version.as_deref(), Some("5.8.1"));
        assert_eq!(a.location, "https://github.com/Alamofire/Alamofire.git");
        assert!(!a.tracks_branch());
    }

    #[test]
    fn parses_the_v1_format_with_its_different_key_names() {
        let r = Resolved::parse(V1).unwrap();
        assert_eq!(r.version, 1);
        let a = r.find("alamofire").unwrap();
        assert_eq!(a.identity, "Alamofire");
        assert_eq!(a.location, "https://github.com/Alamofire/Alamofire.git");
        assert_eq!(a.revision.as_deref(), Some("abc123"));
        // `"branch": null` must not read as a branch pin.
        assert!(!a.tracks_branch());
    }

    #[test]
    fn branch_tracking_pins_are_flagged() {
        let r = Resolved::parse(V2).unwrap();
        let branches = r.branch_pins();
        assert_eq!(branches.len(), 1);
        assert_eq!(branches[0].identity, "swift-log");
        assert_eq!(branches[0].branch.as_deref(), Some("main"));
    }

    #[test]
    fn a_pin_without_a_revision_is_unanchored() {
        let json = r#"{"pins":[{"identity":"x","location":"u","state":{}}],"version":2}"#;
        let r = Resolved::parse(json).unwrap();
        assert!(r.pins[0].is_unanchored());
        assert_eq!(r.unanchored_pins().len(), 1);
    }

    #[test]
    fn malformed_documents_are_rejected() {
        assert!(Resolved::parse("not json").is_err());
        assert!(Resolved::parse(r#"{"version":2}"#).is_err());
        assert!(Resolved::parse(r#"{"pins":{},"version":2}"#).is_err());
    }
}
