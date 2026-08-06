// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

//! Producing an enveloped XML signature.
//!
//! Needed for two things: signing an `AuthnRequest` (some identity providers
//! require it), and generating signed fixtures so verification can be tested
//! against real signatures rather than mocks.
//!
//! This is deliberately the same shape the verifier accepts — exclusive
//! canonicalization, enveloped-signature transform, RSA-SHA256 — so a
//! round-trip through both is a genuine test of the pair.

use super::c14n;
use crate::{Result, SsoError};
use base64::Engine;
use rsa::pkcs1v15::SigningKey;
use rsa::signature::{SignatureEncoding, Signer};
use rsa::RsaPrivateKey;
use sha2::{Digest, Sha256};

const DSIG_NS: &str = "http://www.w3.org/2000/09/xmldsig#";
const EXC_C14N: &str = "http://www.w3.org/2001/10/xml-exc-c14n#";
const ENVELOPED: &str = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";
const RSA_SHA256: &str = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
const SHA256: &str = "http://www.w3.org/2001/04/xmlenc#sha256";

/// Load an RSA private key from DER, accepting PKCS#8 or PKCS#1.
///
/// Both encodings are common in the wild and the difference is invisible to
/// whoever exported the key, so trying both is kinder than demanding one.
pub fn private_key_from_der(der: &[u8]) -> Result<RsaPrivateKey> {
    use rsa::pkcs1::DecodeRsaPrivateKey;
    use rsa::pkcs8::DecodePrivateKey;

    RsaPrivateKey::from_pkcs8_der(der)
        .or_else(|_| RsaPrivateKey::from_pkcs1_der(der))
        .map_err(|e| SsoError::Config(format!("not a usable RSA private key: {e}")))
}

/// Sign the element carrying `id`, inserting the signature into the document.
///
/// The signature is placed immediately after the signed element's `Issuer`
/// child when there is one -- which is where SAML requires it -- and as the
/// first child otherwise.
pub fn sign_enveloped(xml: &str, id: &str, key: &RsaPrivateKey) -> Result<String> {
    let doc = roxmltree::Document::parse(xml)
        .map_err(|e| SsoError::malformed("XML to sign", e.to_string()))?;

    let target = doc
        .descendants()
        .find(|n| {
            n.is_element()
                && n.attributes()
                    .any(|a| a.name() == "ID" && a.value() == id)
        })
        .ok_or_else(|| SsoError::Config(format!("no element with ID {id:?} to sign")))?;

    // A prepared template -- an empty `ds:Signature` already inside the target
    // -- is filled in place rather than having a second signature added beside
    // it. This is how xmlsec works, and a document carrying two signatures is
    // one the verifier refuses outright.
    if let Some(existing) = target.descendants().find(|n| {
        n.is_element() && n.tag_name().name() == "Signature" && n.tag_name().namespace() == Some(DSIG_NS)
    }) {
        return fill_template(xml, target, existing, key);
    }

    // Digest the target as the verifier will see it: canonical, with no
    // signature inside it yet.
    let canonical = c14n::canonicalize(target, &[]);
    let digest = base64::engine::general_purpose::STANDARD.encode(Sha256::digest(canonical.as_bytes()));

    let signed_info = build_signed_info(id, &digest);

    // The SignedInfo is itself signed in canonical form.
    let si_doc = roxmltree::Document::parse(&signed_info)
        .map_err(|e| SsoError::malformed("SignedInfo", e.to_string()))?;
    let si_canonical = c14n::canonicalize(si_doc.root_element(), &[]);

    let signature_value = base64::engine::general_purpose::STANDARD.encode(
        SigningKey::<Sha256>::new(key.clone())
            .sign(si_canonical.as_bytes())
            .to_vec(),
    );

    let signature = [
        "<ds:Signature xmlns:ds=\"",
        DSIG_NS,
        "\">",
        &signed_info,
        "<ds:SignatureValue>",
        &signature_value,
        "</ds:SignatureValue>",
    ]
    .concat()
        + "</ds:Signature>";

    Ok(insert_signature(xml, &signature))
}

/// Fill an empty `ds:Signature` template that is already in the document.
///
/// Works by substituting into the original text rather than reserialising:
/// the surrounding document must reach the verifier byte-for-byte as the
/// signer saw it, and a round trip through a serialiser would risk changing
/// whitespace the digest depends on.
fn fill_template(
    xml: &str,
    target: roxmltree::Node,
    signature: roxmltree::Node,
    key: &RsaPrivateKey,
) -> Result<String> {
    let canonical = c14n::canonicalize_without(target, signature, &[]);
    let digest =
        base64::engine::general_purpose::STANDARD.encode(Sha256::digest(canonical.as_bytes()));

    // Put the digest into the template. The empty element may be written
    // either way round, so both spellings are handled.
    let filled = replace_first_of(
        xml,
        &[
            ("<ds:DigestValue></ds:DigestValue>", format!("<ds:DigestValue>{digest}</ds:DigestValue>")),
            ("<ds:DigestValue/>", format!("<ds:DigestValue>{digest}</ds:DigestValue>")),
        ],
    )
    .ok_or_else(|| SsoError::Config("signature template has no empty DigestValue".into()))?;

    // Now sign the SignedInfo as it stands with the digest in place.
    let doc = roxmltree::Document::parse(&filled)
        .map_err(|e| SsoError::malformed("XML to sign", e.to_string()))?;
    let signed_info = doc
        .descendants()
        .find(|n| {
            n.is_element()
                && n.tag_name().name() == "SignedInfo"
                && n.tag_name().namespace() == Some(DSIG_NS)
        })
        .ok_or_else(|| SsoError::Config("signature template has no SignedInfo".into()))?;

    let si_canonical = c14n::canonicalize(signed_info, &[]);
    let signature_value = base64::engine::general_purpose::STANDARD.encode(
        SigningKey::<Sha256>::new(key.clone())
            .sign(si_canonical.as_bytes())
            .to_vec(),
    );

    replace_first_of(
        &filled,
        &[
            (
                "<ds:SignatureValue></ds:SignatureValue>",
                format!("<ds:SignatureValue>{signature_value}</ds:SignatureValue>"),
            ),
            (
                "<ds:SignatureValue/>",
                format!("<ds:SignatureValue>{signature_value}</ds:SignatureValue>"),
            ),
        ],
    )
    .ok_or_else(|| SsoError::Config("signature template has no empty SignatureValue".into()))
}

fn replace_first_of(haystack: &str, options: &[(&str, String)]) -> Option<String> {
    for (needle, replacement) in options {
        if haystack.contains(needle) {
            return Some(haystack.replacen(needle, replacement, 1));
        }
    }
    None
}

fn build_signed_info(id: &str, digest: &str) -> String {
    // Assembled rather than templated: the URIs are full of `#` next to
    // quotes, which fights with raw string literals.
    [
        "<ds:SignedInfo xmlns:ds=\"",
        DSIG_NS,
        "\"><ds:CanonicalizationMethod Algorithm=\"",
        EXC_C14N,
        "\"></ds:CanonicalizationMethod><ds:SignatureMethod Algorithm=\"",
        RSA_SHA256,
        "\"></ds:SignatureMethod><ds:Reference URI=\"#",
        id,
        "\"><ds:Transforms><ds:Transform Algorithm=\"",
        ENVELOPED,
        "\"></ds:Transform><ds:Transform Algorithm=\"",
        EXC_C14N,
        "\"></ds:Transform></ds:Transforms><ds:DigestMethod Algorithm=\"",
        SHA256,
        "\"></ds:DigestMethod><ds:DigestValue>",
        digest,
        "</ds:DigestValue></ds:Reference></ds:SignedInfo>",
    ]
    .concat()
}

/// Place the signature where SAML expects it.
fn insert_signature(xml: &str, signature: &str) -> String {
    for marker in ["</saml:Issuer>", "</saml2:Issuer>", "</Issuer>"] {
        if let Some(pos) = xml.find(marker) {
            let at = pos + marker.len();
            return format!("{}{}{}", &xml[..at], signature, &xml[at..]);
        }
    }
    // No Issuer: put it directly after the root element's start tag.
    match xml.find('>') {
        Some(pos) => format!("{}{}{}", &xml[..=pos], signature, &xml[pos + 1..]),
        None => xml.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::saml::signature::verify_and_extract_signed;

    /// Signing then verifying must succeed, and the verifier must return the
    /// signed content. This is the round trip that makes both halves
    /// meaningful: a broken canonicaliser fails here even though each half
    /// looks self-consistent.
    #[test]
    fn a_signed_document_verifies_against_its_own_certificate() {
        let mut rng = rand::thread_rng();
        let key = RsaPrivateKey::new(&mut rng, 2048).unwrap();
        let cert = crate::saml::test_support::self_signed_cert(&key);

        let xml = r#"<Root xmlns="urn:test" ID="_x1"><Issuer>me</Issuer><Data>hello</Data></Root>"#;
        let signed = sign_enveloped(xml, "_x1", &key).expect("signing should succeed");

        let extracted = verify_and_extract_signed(&signed, &cert).expect("must verify");
        assert!(extracted.contains("hello"), "{extracted}");
        // The signature must not appear in what the verifier hands back --
        // enveloped means the signature is excluded from its own digest.
        assert!(!extracted.contains("SignatureValue"), "{extracted}");
    }

    #[test]
    fn tampering_after_signing_is_caught() {
        let mut rng = rand::thread_rng();
        let key = RsaPrivateKey::new(&mut rng, 2048).unwrap();
        let cert = crate::saml::test_support::self_signed_cert(&key);

        let xml = r#"<Root xmlns="urn:test" ID="_x1"><Issuer>me</Issuer><Data>hello</Data></Root>"#;
        let signed = sign_enveloped(xml, "_x1", &key).unwrap();
        let tampered = signed.replace("hello", "goodbye");

        assert!(
            verify_and_extract_signed(&tampered, &cert).is_err(),
            "a modified document must not verify"
        );
    }

    #[test]
    fn signing_an_unknown_id_is_a_configuration_error() {
        let mut rng = rand::thread_rng();
        let key = RsaPrivateKey::new(&mut rng, 2048).unwrap();
        let err = sign_enveloped("<Root ID=\"_a\"/>", "_missing", &key).unwrap_err();
        assert!(!err.is_rejection(), "should be a config error: {err}");
    }
}
