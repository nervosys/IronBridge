// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

//! SAML 2.0 Web Browser SSO, service-provider side.
//!
//! **Prefer [`crate::oidc`].** This module exists for buyers whose identity
//! provider only speaks SAML. It is a narrow implementation of a wide
//! specification, and narrowness is the safety argument: see
//! [`signature`] for exactly what is accepted and refused.
//!
//! # Read this before deploying
//!
//! Verification here is pure Rust, which is the point -- but it means the
//! signature checking is *this crate's* rather than xmlsec1's, and xmlsec1 has
//! two decades of adversarial attention behind it. The mitigations are
//! structural (return only signed content, refuse multiple signatures, refuse
//! ambiguous IDs, refuse SHA-1 and exotic transforms) and the tests include
//! signature-wrapping attempts. That is not the same as being battle-tested.
//!
//! If you have a Linux deployment and no Windows constraint, `samael` over
//! xmlsec1 remains the more conservative choice.

pub mod c14n;
pub mod sign;
pub mod signature;

/// Fixtures for the crate's own tests.
///
/// The integration test in `tests/` carries its own copy of this, because a
/// `cfg(test)` item is not visible to a separate test binary. The duplication
/// is deliberate: exposing test scaffolding through a public feature so two
/// test targets can share forty lines is a worse trade than copying them.
#[cfg(test)]
pub(crate) mod test_support {
    use rsa::RsaPrivateKey;

    /// A minimal X.509 wrapper around the key's public half.
    ///
    /// Only the SubjectPublicKeyInfo is ever read by the verifier, so the rest
    /// is the smallest structurally valid certificate x509-parser accepts.
    pub(crate) fn self_signed_cert(key: &RsaPrivateKey) -> Vec<u8> {
        use rsa::pkcs8::EncodePublicKey;
        let spki = key
            .to_public_key()
            .to_public_key_der()
            .expect("encode SPKI")
            .as_bytes()
            .to_vec();

        fn seq(body: Vec<u8>) -> Vec<u8> {
            let mut out = vec![0x30];
            out.extend(len(body.len()));
            out.extend(body);
            out
        }
        fn len(n: usize) -> Vec<u8> {
            if n < 0x80 {
                vec![n as u8]
            } else if n < 0x100 {
                vec![0x81, n as u8]
            } else {
                vec![0x82, (n >> 8) as u8, (n & 0xff) as u8]
            }
        }

        let version = vec![0xA0, 0x03, 0x02, 0x01, 0x02];
        let serial = vec![0x02, 0x01, 0x01];
        let sig_alg = seq(vec![
            0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x01, 0x0B, 0x05, 0x00,
        ]);
        let name = seq(vec![]);
        let validity = seq({
            let mut v = Vec::new();
            for t in ["200101000000Z", "991231235959Z"] {
                v.push(0x17);
                v.push(t.len() as u8);
                v.extend(t.as_bytes());
            }
            v
        });

        let tbs = seq({
            let mut v = Vec::new();
            v.extend(version);
            v.extend(serial);
            v.extend(sig_alg.clone());
            v.extend(name.clone());
            v.extend(validity);
            v.extend(name);
            v.extend(spki);
            v
        });

        seq({
            let mut v = Vec::new();
            v.extend(tbs);
            v.extend(sig_alg);
            v.extend(vec![0x03, 0x02, 0x00, 0x00]);
            v
        })
    }
}

use crate::{Identity, Result, SsoError};
use base64::Engine;
use std::collections::BTreeMap;

const ASSERTION_NS: &str = "urn:oasis:names:tc:SAML:2.0:assertion";
const PROTOCOL_NS: &str = "urn:oasis:names:tc:SAML:2.0:protocol";

/// One identity provider's SAML configuration.
#[derive(Debug, Clone)]
pub struct SamlConfig {
    /// The IdP's `EntityID`; becomes [`Identity::issuer`].
    pub idp_entity_id: String,
    /// Our own entity ID, checked against the assertion's `Audience`.
    pub sp_entity_id: String,
    /// The IdP's signing certificate, DER encoded.
    pub idp_certificate_der: Vec<u8>,
    /// Attribute holding group membership, if the IdP sends one.
    pub groups_attribute: Option<String>,
    /// Tolerance for clock skew when checking assertion validity.
    pub clock_skew_seconds: i64,
}

impl SamlConfig {
    /// Parse a PEM certificate into DER.
    pub fn certificate_from_pem(pem: &str) -> Result<Vec<u8>> {
        // `trim_start` before the armour check: an indented PEM block is
        // common in copied configuration, and without it the BEGIN line is
        // treated as base64 and the whole certificate fails to decode.
        let body: String = pem
            .lines()
            .filter(|l| !l.trim_start().starts_with("-----"))
            .flat_map(|l| l.chars())
            .filter(|c| !c.is_whitespace())
            .collect();
        if body.is_empty() {
            return Err(SsoError::malformed("certificate", "no certificate body"));
        }
        base64::engine::general_purpose::STANDARD
            .decode(body)
            .map_err(|e| SsoError::malformed("certificate", format!("not base64 PEM: {e}")))
    }
}

/// Verify a SAML Response and extract the identity it asserts.
///
/// `response_b64` is the base64 `SAMLResponse` form field.
///
/// The order here is the security property: verify, then parse **only** the
/// bytes the signature covered. The original document is dropped and never
/// consulted again, so an attacker who wrapped a second assertion around the
/// signed one has nothing to gain -- the forged element is not in the string
/// this function goes on to read.
pub fn verify_response(
    response_b64: &str,
    config: &SamlConfig,
    now: chrono::DateTime<chrono::Utc>,
) -> Result<Identity> {
    let cleaned: String = response_b64.chars().filter(|c| !c.is_whitespace()).collect();
    let xml = base64::engine::general_purpose::STANDARD
        .decode(cleaned)
        .map_err(|e| SsoError::malformed("SAMLResponse", format!("not base64: {e}")))?;
    let xml = String::from_utf8(xml)
        .map_err(|e| SsoError::malformed("SAMLResponse", format!("not UTF-8: {e}")))?;

    let signed = signature::verify_and_extract_signed(&xml, &config.idp_certificate_der)?;

    // From here on, `signed` is the only source of truth.
    let doc = roxmltree::Document::parse(&signed)
        .map_err(|e| SsoError::malformed("signed content", e.to_string()))?;
    let root = doc.root_element();

    // The signature may cover the Response or the Assertion; both are legal.
    let assertion = if is(root, "Assertion", ASSERTION_NS) {
        root
    } else if is(root, "Response", PROTOCOL_NS) {
        root.children()
            .find(|c| is(*c, "Assertion", ASSERTION_NS))
            .ok_or_else(|| {
                SsoError::verification("signed Response contains no Assertion")
            })?
    } else {
        return Err(SsoError::verification(format!(
            "signature covers <{}>, which is neither Response nor Assertion",
            root.tag_name().name()
        )));
    };

    check_conditions(assertion, config, now)?;
    identity_from(assertion, config)
}

fn check_conditions(
    assertion: roxmltree::Node,
    config: &SamlConfig,
    now: chrono::DateTime<chrono::Utc>,
) -> Result<()> {
    let issuer = assertion
        .children()
        .find(|c| is(*c, "Issuer", ASSERTION_NS))
        .and_then(|n| n.text())
        .map(str::trim)
        .unwrap_or_default();
    if issuer != config.idp_entity_id {
        return Err(SsoError::verification(format!(
            "assertion issuer {issuer:?} is not the configured provider"
        )));
    }

    let Some(conditions) = assertion
        .children()
        .find(|c| is(*c, "Conditions", ASSERTION_NS))
    else {
        // An assertion with no Conditions never expires and is valid for any
        // audience. That is not something to accept quietly.
        return Err(SsoError::verification(
            "assertion has no Conditions element; refusing an unbounded assertion",
        ));
    };

    let skew = chrono::Duration::seconds(config.clock_skew_seconds.max(0));

    if let Some(not_before) = conditions.attribute("NotBefore") {
        let t = parse_instant(not_before)?;
        if now + skew < t {
            return Err(SsoError::verification("assertion is not yet valid"));
        }
    }
    if let Some(not_on_or_after) = conditions.attribute("NotOnOrAfter") {
        let t = parse_instant(not_on_or_after)?;
        if now - skew >= t {
            return Err(SsoError::verification("assertion has expired"));
        }
    }

    // Audience restriction: an assertion minted for another service provider
    // must not log anyone in here, even though its signature is perfectly
    // valid. This is the check that stops a shared IdP becoming a cross-app
    // replay.
    let mut audiences = Vec::new();
    for restriction in conditions
        .children()
        .filter(|c| is(*c, "AudienceRestriction", ASSERTION_NS))
    {
        for audience in restriction
            .children()
            .filter(|c| is(*c, "Audience", ASSERTION_NS))
        {
            if let Some(v) = audience.text() {
                audiences.push(v.trim().to_string());
            }
        }
    }
    if !audiences.is_empty() && !audiences.iter().any(|a| a == &config.sp_entity_id) {
        return Err(SsoError::verification(format!(
            "assertion audience {audiences:?} does not include {}",
            config.sp_entity_id
        )));
    }

    Ok(())
}

fn identity_from(assertion: roxmltree::Node, config: &SamlConfig) -> Result<Identity> {
    let subject = assertion
        .children()
        .find(|c| is(*c, "Subject", ASSERTION_NS))
        .and_then(|s| s.children().find(|c| is(*c, "NameID", ASSERTION_NS)))
        .and_then(|n| n.text())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| SsoError::verification("assertion has no Subject NameID"))?
        .to_string();

    let mut attributes: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for statement in assertion
        .children()
        .filter(|c| is(*c, "AttributeStatement", ASSERTION_NS))
    {
        for attribute in statement
            .children()
            .filter(|c| is(*c, "Attribute", ASSERTION_NS))
        {
            let Some(name) = attribute.attribute("Name") else {
                continue;
            };
            let values: Vec<String> = attribute
                .children()
                .filter(|c| is(*c, "AttributeValue", ASSERTION_NS))
                .filter_map(|v| v.text())
                .map(|v| v.trim().to_string())
                .filter(|v| !v.is_empty())
                .collect();
            if !values.is_empty() {
                attributes.entry(name.to_string()).or_default().extend(values);
            }
        }
    }

    let groups = config
        .groups_attribute
        .as_ref()
        .and_then(|g| attributes.get(g))
        .cloned()
        .unwrap_or_default();

    let email = first_of(
        &attributes,
        &[
            "email",
            "mail",
            "urn:oid:0.9.2342.19200300.100.1.3",
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
        ],
    );
    let display_name = first_of(
        &attributes,
        &[
            "displayName",
            "name",
            "cn",
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
        ],
    );

    Ok(Identity {
        subject,
        issuer: config.idp_entity_id.clone(),
        email,
        // SAML has no standard "verified" signal. Claiming verified because an
        // address arrived would assert something the IdP never said.
        email_verified: false,
        display_name,
        groups,
        attributes,
    })
}

fn first_of(attrs: &BTreeMap<String, Vec<String>>, names: &[&str]) -> Option<String> {
    names
        .iter()
        .find_map(|n| attrs.get(*n))
        .and_then(|v| v.first())
        .cloned()
}

fn is(node: roxmltree::Node, name: &str, ns: &str) -> bool {
    node.is_element() && node.tag_name().name() == name && node.tag_name().namespace() == Some(ns)
}

fn parse_instant(s: &str) -> Result<chrono::DateTime<chrono::Utc>> {
    chrono::DateTime::parse_from_rfc3339(s)
        .map(|t| t.with_timezone(&chrono::Utc))
        .map_err(|e| SsoError::malformed("timestamp", format!("{s:?}: {e}")))
}
