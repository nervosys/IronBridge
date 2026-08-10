// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

//! Adversarial tests for SAML verification.
//!
//! These are the tests that justify shipping a hand-written XML signature
//! verifier at all. Everything here signs with a real RSA key generated in the
//! test, so a "valid" signature is genuinely valid and a rejection is
//! genuinely a rejection -- no mocked crypto that would pass whatever it is
//! handed.
//!
//! The wrapping cases are the point. Each one presents a document containing a
//! genuinely signed assertion *and* a forged one, arranged so that a verifier
//! which checks the signature and then re-reads the document would authenticate
//! the attacker.

use base64::Engine;
use chasm_sso::saml::{self, SamlConfig};
use rsa::pkcs1v15::SigningKey;
use rsa::signature::{SignatureEncoding, Signer};
use rsa::RsaPrivateKey;
use sha2::{Digest, Sha256};

const ASSERTION_NS: &str = "urn:oasis:names:tc:SAML:2.0:assertion";

struct Idp {
    key: RsaPrivateKey,
    cert_der: Vec<u8>,
}

impl Idp {
    /// A 2048-bit key and a self-signed certificate carrying its public half.
    ///
    /// Generated per-run rather than checked in, so the tests cannot silently
    /// start passing against a key someone replaced with a known one.
    fn new() -> Self {
        let mut rng = rand::thread_rng();
        let key = RsaPrivateKey::new(&mut rng, 2048).expect("generate RSA key");
        let cert_der = self_signed_cert(&key);
        Self { key, cert_der }
    }

    fn sign(&self, data: &[u8]) -> Vec<u8> {
        let signing_key = SigningKey::<Sha256>::new(self.key.clone());
        signing_key.sign(data).to_vec()
    }
}

/// Build a minimal self-signed X.509 certificate around an RSA public key.
///
/// Only the SubjectPublicKeyInfo is ever read by the verifier, so the rest is
/// the smallest structurally valid wrapper that x509-parser will accept.
fn self_signed_cert(key: &RsaPrivateKey) -> Vec<u8> {
    use rsa::pkcs8::EncodePublicKey;
    let spki_der = key
        .to_public_key()
        .to_public_key_der()
        .expect("encode SPKI")
        .as_bytes()
        .to_vec();
    x509_wrapper(&spki_der)
}

/// Hand-rolled DER for a certificate that carries `spki` verbatim.
fn x509_wrapper(spki: &[u8]) -> Vec<u8> {
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
    // version [0] EXPLICIT INTEGER 2
    let version = vec![0xA0, 0x03, 0x02, 0x01, 0x02];
    let serial = vec![0x02, 0x01, 0x01];
    // sha256WithRSAEncryption, NULL params
    let sig_alg = seq(vec![
        0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x01, 0x0B, 0x05, 0x00,
    ]);
    // An empty Name is legal DER and nothing here reads it.
    let name = seq(vec![]);
    // notBefore/notAfter as UTCTime
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
        v.extend(spki.to_vec());
        v
    });

    seq({
        let mut v = Vec::new();
        v.extend(tbs);
        v.extend(sig_alg);
        // BIT STRING, 0 unused bits, dummy signature -- never verified.
        v.extend(vec![0x03, 0x02, 0x00, 0x00]);
        v
    })
}

fn config(idp: &Idp) -> SamlConfig {
    SamlConfig {
        idp_entity_id: "https://idp.example/entity".into(),
        sp_entity_id: "https://sp.example/entity".into(),
        idp_certificate_der: idp.cert_der.clone(),
        groups_attribute: Some("groups".into()),
        clock_skew_seconds: 60,
    }
}

fn assertion_xml(id: &str, subject: &str) -> String {
    format!(
        r#"<saml:Assertion xmlns:saml="{ASSERTION_NS}" ID="{id}" IssueInstant="2026-01-01T00:00:00Z" Version="2.0"><saml:Issuer>https://idp.example/entity</saml:Issuer><saml:Subject><saml:NameID>{subject}</saml:NameID></saml:Subject><saml:Conditions NotBefore="2020-01-01T00:00:00Z" NotOnOrAfter="2099-01-01T00:00:00Z"><saml:AudienceRestriction><saml:Audience>https://sp.example/entity</saml:Audience></saml:AudienceRestriction></saml:Conditions><saml:AttributeStatement><saml:Attribute Name="groups"><saml:AttributeValue>engineering</saml:AttributeValue></saml:Attribute></saml:AttributeStatement></saml:Assertion>"#
    )
}

/// Sign an assertion and return the full signed XML.
fn sign_assertion(idp: &Idp, assertion: &str, id: &str) -> String {
    // Digest the assertion exactly as the verifier will: canonical form, with
    // no signature present yet (this is the enveloped case before insertion).
    let doc = roxmltree::Document::parse(assertion).expect("parse assertion");
    let canonical = chasm_sso::saml::c14n::canonicalize(doc.root_element(), &[]);
    let digest =
        base64::engine::general_purpose::STANDARD.encode(Sha256::digest(canonical.as_bytes()));

    // Assembled from pieces rather than one literal: the XML is full of `#`
    // characters next to quotes, and `"#` terminates an r#".."# string in the
    // middle of a URI.
    let dsig = "http://www.w3.org/2000/09/xmldsig#";
    let exc = "http://www.w3.org/2001/10/xml-exc-c14n#";
    let signed_info = [
        "<ds:SignedInfo xmlns:ds=\"", dsig, "\">",
        "<ds:CanonicalizationMethod Algorithm=\"", exc, "\"></ds:CanonicalizationMethod>",
        "<ds:SignatureMethod Algorithm=\"http://www.w3.org/2001/04/xmldsig-more#rsa-sha256\"></ds:SignatureMethod>",
        "<ds:Reference URI=\"#", id, "\">",
        "<ds:Transforms>",
        "<ds:Transform Algorithm=\"", dsig, "enveloped-signature\"></ds:Transform>",
        "<ds:Transform Algorithm=\"", exc, "\"></ds:Transform>",
        "</ds:Transforms>",
        "<ds:DigestMethod Algorithm=\"http://www.w3.org/2001/04/xmlenc#sha256\"></ds:DigestMethod>",
        "<ds:DigestValue>", &digest, "</ds:DigestValue>",
        "</ds:Reference></ds:SignedInfo>",
    ]
    .concat();

    // The SignedInfo is signed in its own canonical form.
    let si_doc = roxmltree::Document::parse(&signed_info).expect("parse SignedInfo");
    let si_canonical = chasm_sso::saml::c14n::canonicalize(si_doc.root_element(), &[]);
    let signature_value =
        base64::engine::general_purpose::STANDARD.encode(idp.sign(si_canonical.as_bytes()));

    let signature = [
        "<ds:Signature xmlns:ds=\"",
        dsig,
        "\">",
        &signed_info,
        "<ds:SignatureValue>",
        &signature_value,
        "</ds:SignatureValue>",
        "</ds:Signature>",
    ]
    .concat();

    // Insert the signature after Issuer, where SAML puts it.
    assertion.replacen("</saml:Issuer>", &format!("</saml:Issuer>{signature}"), 1)
}

fn b64(s: &str) -> String {
    base64::engine::general_purpose::STANDARD.encode(s)
}

fn now() -> chrono::DateTime<chrono::Utc> {
    chrono::DateTime::parse_from_rfc3339("2026-06-01T00:00:00Z")
        .unwrap()
        .with_timezone(&chrono::Utc)
}

// ---------------------------------------------------------------------------
// The happy path must actually work, or every rejection below is vacuous.
// ---------------------------------------------------------------------------

#[test]
fn a_genuinely_signed_assertion_verifies() {
    let idp = Idp::new();
    let signed = sign_assertion(&idp, &assertion_xml("_a1", "alice@example.com"), "_a1");

    let identity = saml::verify_response(&b64(&signed), &config(&idp), now())
        .expect("a correctly signed assertion must verify");

    assert_eq!(identity.subject, "alice@example.com");
    assert_eq!(identity.issuer, "https://idp.example/entity");
    assert_eq!(identity.groups, vec!["engineering"]);
    // SAML asserts no verification status, so this must not be claimed.
    assert!(!identity.email_verified);
}

// ---------------------------------------------------------------------------
// Signature wrapping
// ---------------------------------------------------------------------------

/// The classic: wrap the signed assertion inside a forged one, so a verifier
/// that finds the signature and then reads the outermost assertion sees the
/// attacker's subject.
#[test]
fn wrapping_a_signed_assertion_inside_a_forged_one_is_rejected() {
    let idp = Idp::new();
    let genuine = sign_assertion(&idp, &assertion_xml("_a1", "alice@example.com"), "_a1");

    let attack = format!(
        r#"<saml:Assertion xmlns:saml="{ASSERTION_NS}" ID="_evil" IssueInstant="2026-01-01T00:00:00Z" Version="2.0"><saml:Issuer>https://idp.example/entity</saml:Issuer><saml:Subject><saml:NameID>attacker@evil.example</saml:NameID></saml:Subject><saml:Conditions NotBefore="2020-01-01T00:00:00Z" NotOnOrAfter="2099-01-01T00:00:00Z"><saml:AudienceRestriction><saml:Audience>https://sp.example/entity</saml:Audience></saml:AudienceRestriction></saml:Conditions>{genuine}</saml:Assertion>"#
    );

    match saml::verify_response(&b64(&attack), &config(&idp), now()) {
        // Rejecting outright is fine.
        Err(e) => assert!(e.is_rejection(), "unexpected error kind: {e}"),
        // Accepting is only acceptable if it returned the GENUINE subject --
        // i.e. it read the signed element, not the wrapper. Returning the
        // attacker's subject is the vulnerability.
        Ok(identity) => assert_eq!(
            identity.subject, "alice@example.com",
            "wrapping attack succeeded: authenticated as the forged subject"
        ),
    }
}

/// The same idea the other way round: forged assertion first, signed one
/// hidden after it. A verifier that takes "the first Assertion" loses.
#[test]
fn a_forged_assertion_preceding_the_signed_one_is_rejected() {
    let idp = Idp::new();
    let genuine = sign_assertion(&idp, &assertion_xml("_a1", "alice@example.com"), "_a1");

    let forged = assertion_xml("_evil", "attacker@evil.example");
    let attack = format!(
        r#"<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="{ASSERTION_NS}" ID="_r1" Version="2.0">{forged}{genuine}</samlp:Response>"#
    );

    match saml::verify_response(&b64(&attack), &config(&idp), now()) {
        Err(e) => assert!(e.is_rejection(), "unexpected error kind: {e}"),
        Ok(identity) => assert_eq!(
            identity.subject, "alice@example.com",
            "authenticated as the forged subject"
        ),
    }
}

/// Two elements sharing the referenced ID makes "which element is signed?"
/// ambiguous. Refusing is the only safe answer.
#[test]
fn a_duplicated_id_is_refused() {
    let idp = Idp::new();
    let genuine = sign_assertion(&idp, &assertion_xml("_a1", "alice@example.com"), "_a1");
    let decoy = assertion_xml("_a1", "attacker@evil.example");

    let attack = format!(
        r#"<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="{ASSERTION_NS}" ID="_r1" Version="2.0">{decoy}{genuine}</samlp:Response>"#
    );

    let err = saml::verify_response(&b64(&attack), &config(&idp), now())
        .expect_err("an ambiguous ID must not verify");
    assert!(err.is_rejection(), "{err}");
}

// ---------------------------------------------------------------------------
// Tampering
// ---------------------------------------------------------------------------

#[test]
fn altering_the_subject_after_signing_is_detected() {
    let idp = Idp::new();
    let signed = sign_assertion(&idp, &assertion_xml("_a1", "alice@example.com"), "_a1");
    let tampered = signed.replace("alice@example.com", "attacker@evil.example");

    let err = saml::verify_response(&b64(&tampered), &config(&idp), now())
        .expect_err("a modified assertion must not verify");
    assert!(err.to_string().contains("digest"), "{err}");
}

#[test]
fn a_signature_from_a_different_idp_is_rejected() {
    let real = Idp::new();
    let other = Idp::new();
    let signed = sign_assertion(&other, &assertion_xml("_a1", "alice@example.com"), "_a1");

    let err = saml::verify_response(&b64(&signed), &config(&real), now())
        .err()
        .unwrap_or_else(|| panic!("must not verify against the wrong certificate"));
    assert!(err.is_rejection(), "{err}");
}

#[test]
fn an_unsigned_assertion_is_rejected() {
    let idp = Idp::new();
    let plain = assertion_xml("_a1", "alice@example.com");
    let err = saml::verify_response(&b64(&plain), &config(&idp), now())
        .expect_err("an unsigned assertion must not verify");
    assert!(err.to_string().contains("no XML signature"), "{err}");
}

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

#[test]
fn an_expired_assertion_is_rejected() {
    let idp = Idp::new();
    let expired = assertion_xml("_a1", "alice@example.com")
        .replace("2099-01-01T00:00:00Z", "2026-01-02T00:00:00Z");
    let signed = sign_assertion(&idp, &expired, "_a1");

    let err = saml::verify_response(&b64(&signed), &config(&idp), now())
        .expect_err("an expired assertion must not verify");
    assert!(err.to_string().contains("expired"), "{err}");
}

/// An assertion minted for a different service provider must not log anyone
/// in here, even though its signature is entirely valid.
#[test]
fn an_assertion_for_another_audience_is_rejected() {
    let idp = Idp::new();
    let other_sp = assertion_xml("_a1", "alice@example.com")
        .replace("https://sp.example/entity", "https://other.example/entity");
    let signed = sign_assertion(&idp, &other_sp, "_a1");

    let err = saml::verify_response(&b64(&signed), &config(&idp), now())
        .expect_err("an assertion for another audience must not verify");
    assert!(err.to_string().contains("audience"), "{err}");
}

#[test]
fn an_assertion_with_no_conditions_is_rejected() {
    let idp = Idp::new();
    let unbounded = assertion_xml("_a1", "alice@example.com");
    let start = unbounded.find("<saml:Conditions").unwrap();
    let end = unbounded.find("</saml:Conditions>").unwrap() + "</saml:Conditions>".len();
    let unbounded = format!("{}{}", &unbounded[..start], &unbounded[end..]);
    let signed = sign_assertion(&idp, &unbounded, "_a1");

    let err = saml::verify_response(&b64(&signed), &config(&idp), now())
        .expect_err("an assertion without Conditions must not verify");
    assert!(err.to_string().contains("Conditions"), "{err}");
}

#[test]
fn an_assertion_from_an_unexpected_issuer_is_rejected() {
    let idp = Idp::new();
    let wrong_issuer = assertion_xml("_a1", "alice@example.com").replace(
        "https://idp.example/entity",
        "https://elsewhere.example/entity",
    );
    let signed = sign_assertion(&idp, &wrong_issuer, "_a1");

    let err = saml::verify_response(&b64(&signed), &config(&idp), now())
        .expect_err("an assertion from another issuer must not verify");
    assert!(err.to_string().contains("issuer"), "{err}");
}
