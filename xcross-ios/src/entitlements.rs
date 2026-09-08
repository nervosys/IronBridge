//! Compare an app's requested entitlements against what a provisioning profile
//! grants.
//!
//! A signed app fails to install (or is rejected at submission) when it requests
//! an entitlement the embedded profile does not authorize — the infamous
//! "Provisioning profile doesn't include the … entitlement" and
//! "application-identifier … doesn't match" errors. Those are pure comparisons
//! of two plists, so they can be caught *before* a build off a Mac.
//!
//! The rules mirror how the OS actually checks: most entitlements must match
//! exactly, but a few identifier-shaped ones let the profile carry a trailing
//! `*` wildcard (`application-identifier`, `keychain-access-groups`, the
//! application-groups array), which the app's value must be a prefix-match of.

use crate::plist_read::Plist;

/// One way an app's entitlement is not satisfied by the profile.
#[derive(Debug, Clone, PartialEq)]
pub enum Finding {
    /// The app requests a key the profile does not grant at all.
    Missing {
        /// The entitlement key.
        key: String,
    },
    /// The key is present but the profile's value does not cover the app's.
    Mismatch {
        /// The entitlement key.
        key: String,
        /// What the app requests (rendered).
        app: String,
        /// What the profile grants (rendered).
        profile: String,
    },
}

impl Finding {
    /// A human-readable one-line explanation.
    pub fn explain(&self) -> String {
        match self {
            Finding::Missing { key } => {
                format!("`{key}`: requested by the app but the profile does not grant it")
            }
            Finding::Mismatch { key, app, profile } => {
                format!("`{key}`: app wants `{app}` but profile grants `{profile}`")
            }
        }
    }
}

/// The result of comparing app entitlements to a profile's.
#[derive(Debug, Clone, PartialEq)]
pub struct Report {
    /// Every unsatisfied entitlement.
    pub findings: Vec<Finding>,
    /// How many app entitlement keys were checked.
    pub checked: usize,
}

impl Report {
    /// True when the profile satisfies every entitlement the app requests.
    pub fn is_satisfiable(&self) -> bool {
        self.findings.is_empty()
    }
}

/// Diff the app's requested entitlements (`app`) against the profile's granted
/// entitlements (`profile`); both must be `Dict` plists.
pub fn diff(app: &Plist, profile: &Plist) -> Report {
    let mut findings = Vec::new();
    let app_kvs = match app {
        Plist::Dict(kvs) => kvs.as_slice(),
        _ => &[],
    };
    for (key, app_val) in app_kvs {
        match profile.get(key) {
            None => findings.push(Finding::Missing { key: key.clone() }),
            Some(profile_val) => {
                if !covers(profile_val, app_val) {
                    findings.push(Finding::Mismatch {
                        key: key.clone(),
                        app: render(app_val),
                        profile: render(profile_val),
                    });
                }
            }
        }
    }
    Report {
        findings,
        checked: app_kvs.len(),
    }
}

/// Whether the profile's granted value `p` covers the app's requested value `a`.
fn covers(p: &Plist, a: &Plist) -> bool {
    match (p, a) {
        (Plist::String(ps), Plist::String(as_)) => string_covers(ps, as_),
        (Plist::Bool(pb), Plist::Bool(ab)) => pb == ab,
        (Plist::Integer(pi), Plist::Integer(ai)) => pi == ai,
        (Plist::Array(pa), Plist::Array(aa)) => {
            // Every requested element must be covered by some granted element
            // (e.g. app-groups, keychain-access-groups).
            aa.iter().all(|ae| pa.iter().any(|pe| covers(pe, ae)))
        }
        // A profile value of `<string>*</string>` grants anything of that shape.
        (Plist::String(ps), _) if ps == "*" => true,
        // Structurally identical values match.
        _ => p == a,
    }
}

/// Wildcard-aware string cover: a profile string ending in `*` covers any app
/// string sharing the prefix; otherwise an exact match is required.
fn string_covers(profile: &str, app: &str) -> bool {
    if profile == "*" {
        return true;
    }
    if let Some(prefix) = profile.strip_suffix('*') {
        app.starts_with(prefix)
    } else {
        profile == app
    }
}

/// Render a plist scalar/array for a finding message.
fn render(v: &Plist) -> String {
    match v {
        Plist::String(s) => s.clone(),
        Plist::Bool(b) => b.to_string(),
        Plist::Integer(i) => i.to_string(),
        Plist::Real(r) => r.to_string(),
        Plist::Array(a) => {
            let items: Vec<String> = a.iter().map(render).collect();
            format!("[{}]", items.join(", "))
        }
        Plist::Dict(_) => "{…}".to_string(),
        Plist::Date(s) | Plist::Data(s) => s.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn plist(xml: &str) -> Plist {
        Plist::parse(xml).unwrap()
    }

    #[test]
    fn a_wildcard_application_identifier_covers_a_concrete_one() {
        let app = plist(
            "<dict><key>application-identifier</key>\
             <string>TEAM12345.com.nervosys.csm</string></dict>",
        );
        let profile = plist(
            "<dict><key>application-identifier</key>\
             <string>TEAM12345.*</string></dict>",
        );
        assert!(diff(&app, &profile).is_satisfiable());
    }

    #[test]
    fn a_missing_entitlement_is_reported() {
        let app = plist(
            "<dict><key>aps-environment</key><string>production</string>\
             <key>com.apple.developer.healthkit</key><true/></dict>",
        );
        let profile = plist("<dict><key>aps-environment</key><string>production</string></dict>");
        let r = diff(&app, &profile);
        assert!(!r.is_satisfiable());
        assert_eq!(r.checked, 2);
        assert_eq!(
            r.findings,
            vec![Finding::Missing {
                key: "com.apple.developer.healthkit".into()
            }]
        );
    }

    #[test]
    fn a_value_mismatch_is_reported() {
        // The classic: app wants production APNs, profile only grants development.
        let app = plist("<dict><key>aps-environment</key><string>production</string></dict>");
        let profile =
            plist("<dict><key>aps-environment</key><string>development</string></dict>");
        let r = diff(&app, &profile);
        assert_eq!(
            r.findings,
            vec![Finding::Mismatch {
                key: "aps-environment".into(),
                app: "production".into(),
                profile: "development".into(),
            }]
        );
    }

    #[test]
    fn app_groups_are_covered_element_wise_with_wildcards() {
        let app = plist(
            "<dict><key>com.apple.security.application-groups</key>\
             <array><string>group.com.nervosys.csm</string></array></dict>",
        );
        // Profile grants the group via a wildcard.
        let profile = plist(
            "<dict><key>com.apple.security.application-groups</key>\
             <array><string>group.com.nervosys.*</string></array></dict>",
        );
        assert!(diff(&app, &profile).is_satisfiable());

        // A group outside the wildcard is not covered.
        let app2 = plist(
            "<dict><key>com.apple.security.application-groups</key>\
             <array><string>group.com.other.app</string></array></dict>",
        );
        assert!(!diff(&app2, &profile).is_satisfiable());
    }
}
