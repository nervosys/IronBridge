// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

//! XML Signature verification, narrowed to what SAML needs.
//!
//! # The attack this is built around
//!
//! XML Signature Wrapping. An attacker takes a genuinely signed assertion,
//! wraps it somewhere the verifier will not look, and puts a forged assertion
//! where the verifier *will* look. A naive implementation verifies the
//! signature (which covers the genuine fragment, so it passes) and then reads
//! the document again to extract claims (finding the forgery). Signature and
//! claims come from different elements, and the login succeeds as the
//! attacker's chosen user.
//!
//! The defence here is structural rather than a list of patches:
//! [`verify_and_extract_signed`] returns *the signed element itself*. The
//! caller never sees the original document, so there is nothing to re-read and
//! no second element to be confused by. That is the same approach samael takes
//! with `reduce_xml_to_signed`, for the same reason.
//!
//! # What is supported
//!
//! * `Reference` URIs of the form `#id`, resolved against `ID` attributes.
//! * Exclusive canonicalization, with or without an `InclusiveNamespaces`
//!   `PrefixList`.
//! * The enveloped-signature transform.
//! * Digests: SHA-256, SHA-384, SHA-512.
//! * Signatures: RSA-SHA256/384/512 (PKCS#1 v1.5).
//!
//! # What is refused, and why
//!
//! Anything else, loudly. XMLDSig permits XPath and XSLT transforms, arbitrary
//! external references and SHA-1; a verifier that accepts the full grammar has
//! a far larger attack surface than one that accepts the profile every real
//! identity provider actually emits. Refusing is safe: a provider using an
//! unsupported construct fails to log in, visibly, rather than being accepted
//! on weaker terms.

use crate::{Result, SsoError};
use base64::Engine;
use rsa::pkcs1v15::{Signature, VerifyingKey};
use rsa::signature::Verifier;
use rsa::RsaPublicKey;
use sha2::{Digest, Sha256, Sha384, Sha512};

const DSIG_NS: &str = "http://www.w3.org/2000/09/xmldsig#";
const EXC_C14N: &str = "http://www.w3.org/2001/10/xml-exc-c14n#";
const ENVELOPED: &str = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";

/// Digest and signature algorithms this crate accepts.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Digest2 {
    Sha256,
    Sha384,
    Sha512,
}

impl Digest2 {
    fn from_uri(uri: &str) -> Result<Self> {
        match uri {
            "http://www.w3.org/2001/04/xmlenc#sha256" => Ok(Self::Sha256),
            "http://www.w3.org/2001/04/xmldsig-more#sha384" => Ok(Self::Sha384),
            "http://www.w3.org/2001/04/xmlenc#sha512" => Ok(Self::Sha512),
            // SHA-1 is collision-broken. A provider still using it needs to be
            // fixed, not accommodated.
            "http://www.w3.org/2000/09/xmldsig#sha1" => Err(SsoError::unsupported(
                "SHA-1 digests are refused; reconfigure the identity provider for SHA-256",
            )),
            other => Err(SsoError::unsupported(format!("digest algorithm {other}"))),
        }
    }

    fn hash(&self, bytes: &[u8]) -> Vec<u8> {
        match self {
            Self::Sha256 => Sha256::digest(bytes).to_vec(),
            Self::Sha384 => Sha384::digest(bytes).to_vec(),
            Self::Sha512 => Sha512::digest(bytes).to_vec(),
        }
    }
}

/// Verify the signature over a document and return only the signed element.
///
/// The returned string is canonical XML of the element the signature actually
/// covers. Callers must parse *that* and discard the input, which is what
/// makes wrapping attacks structurally impossible rather than merely checked
/// for.
pub fn verify_and_extract_signed(xml: &str, certificate_der: &[u8]) -> Result<String> {
    let doc = roxmltree::Document::parse(xml)
        .map_err(|e| SsoError::malformed("SAML response", e.to_string()))?;

    let signatures: Vec<_> = doc
        .descendants()
        .filter(|n| {
            n.is_element()
                && n.tag_name().name() == "Signature"
                && n.tag_name().namespace() == Some(DSIG_NS)
        })
        .collect();

    // More than one signature means more than one possible answer to "what did
    // the IdP actually assert?". Rather than pick, refuse: multi-signature
    // documents are exactly the shape wrapping attacks take.
    let signature = match signatures.len() {
        0 => return Err(SsoError::verification("no XML signature present")),
        1 => signatures[0],
        n => {
            return Err(SsoError::verification(format!(
                "{n} signatures present; refusing to choose between them"
            )))
        }
    };

    let signed_info = child(signature, "SignedInfo")
        .ok_or_else(|| SsoError::malformed("Signature", "no SignedInfo"))?;

    // --- what the signature covers -------------------------------------
    let reference = child(signed_info, "Reference")
        .ok_or_else(|| SsoError::malformed("SignedInfo", "no Reference"))?;

    let uri = reference
        .attribute("URI")
        .ok_or_else(|| SsoError::malformed("Reference", "no URI"))?;
    // An empty URI means "the whole document", which for SAML would leave the
    // signature covering itself ambiguously; a same-document `#id` is the only
    // form providers emit and the only one whose target is unambiguous.
    let target_id = uri.strip_prefix('#').ok_or_else(|| {
        SsoError::unsupported(format!(
            "Reference URI {uri:?}: only same-document #id references are supported"
        ))
    })?;

    let target = find_by_id(&doc, target_id).ok_or_else(|| {
        SsoError::verification(format!(
            "Reference points at #{target_id}, which does not exist"
        ))
    })?;

    // --- transforms ----------------------------------------------------
    let mut inclusive_prefixes: Vec<String> = Vec::new();
    if let Some(transforms) = child(reference, "Transforms") {
        for t in transforms.children().filter(|c| c.is_element()) {
            let alg = t.attribute("Algorithm").unwrap_or_default();
            match alg {
                ENVELOPED => {}
                EXC_C14N => {
                    if let Some(inc) = t
                        .children()
                        .find(|c| c.is_element() && c.tag_name().name() == "InclusiveNamespaces")
                    {
                        if let Some(list) = inc.attribute("PrefixList") {
                            inclusive_prefixes =
                                list.split_whitespace().map(str::to_string).collect();
                        }
                    }
                }
                other => {
                    let why = format!(
                        "transform {other}: only enveloped-signature \
                         and exclusive c14n are supported"
                    );
                    return Err(SsoError::unsupported(why));
                }
            }
        }
    }

    // --- digest --------------------------------------------------------
    let digest_alg = child(reference, "DigestMethod")
        .and_then(|d| d.attribute("Algorithm"))
        .ok_or_else(|| SsoError::malformed("Reference", "no DigestMethod"))?;
    let digest_alg = Digest2::from_uri(digest_alg)?;

    let expected_digest = child(reference, "DigestValue")
        .and_then(|d| d.text())
        .ok_or_else(|| SsoError::malformed("Reference", "no DigestValue"))?;
    let expected_digest = decode_b64(expected_digest, "DigestValue")?;

    // Canonicalise the target with the signature removed -- that is what
    // "enveloped" means, and forgetting it makes every digest wrong.
    let canonical_target =
        super::c14n::canonicalize_without(target, signature, &inclusive_prefixes);
    let actual_digest = digest_alg.hash(canonical_target.as_bytes());

    if !constant_time_eq(&actual_digest, &expected_digest) {
        return Err(SsoError::verification(
            "digest mismatch: the signed content has been altered",
        ));
    }

    // --- signature over SignedInfo -------------------------------------
    let sig_alg = child(signed_info, "SignatureMethod")
        .and_then(|s| s.attribute("Algorithm"))
        .ok_or_else(|| SsoError::malformed("SignedInfo", "no SignatureMethod"))?;
    let sig_digest =
        match sig_alg {
            "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256" => Digest2::Sha256,
            "http://www.w3.org/2001/04/xmldsig-more#rsa-sha384" => Digest2::Sha384,
            "http://www.w3.org/2001/04/xmldsig-more#rsa-sha512" => Digest2::Sha512,
            "http://www.w3.org/2000/09/xmldsig#rsa-sha1" => return Err(SsoError::unsupported(
                "RSA-SHA1 signatures are refused; reconfigure the identity provider for SHA-256",
            )),
            other => {
                return Err(SsoError::unsupported(format!(
                    "signature algorithm {other}"
                )))
            }
        };

    let signature_value = child(signature, "SignatureValue")
        .and_then(|s| s.text())
        .ok_or_else(|| SsoError::malformed("Signature", "no SignatureValue"))?;
    let signature_bytes = decode_b64(signature_value, "SignatureValue")?;

    let canonical_signed_info = super::c14n::canonicalize(signed_info, &inclusive_prefixes);
    verify_rsa(
        certificate_der,
        sig_digest,
        canonical_signed_info.as_bytes(),
        &signature_bytes,
    )?;

    // Only now is the content trustworthy, and only this content.
    Ok(canonical_target)
}

fn verify_rsa(
    certificate_der: &[u8],
    digest: Digest2,
    message: &[u8],
    signature: &[u8],
) -> Result<()> {
    let (_, cert) = x509_parser::parse_x509_certificate(certificate_der)
        .map_err(|e| SsoError::malformed("certificate", e.to_string()))?;

    let spki = cert.public_key();
    let public_key = RsaPublicKey::try_from(
        rsa::pkcs8::SubjectPublicKeyInfoRef::try_from(spki.raw)
            .map_err(|e| SsoError::malformed("certificate", format!("bad SPKI: {e}")))?,
    )
    .map_err(|e| SsoError::unsupported(format!("certificate public key is not RSA: {e}")))?;

    let sig = Signature::try_from(signature)
        .map_err(|e| SsoError::malformed("SignatureValue", e.to_string()))?;

    let ok = match digest {
        Digest2::Sha256 => VerifyingKey::<Sha256>::new(public_key)
            .verify(message, &sig)
            .is_ok(),
        Digest2::Sha384 => VerifyingKey::<Sha384>::new(public_key)
            .verify(message, &sig)
            .is_ok(),
        Digest2::Sha512 => VerifyingKey::<Sha512>::new(public_key)
            .verify(message, &sig)
            .is_ok(),
    };

    if ok {
        Ok(())
    } else {
        Err(SsoError::verification("signature does not verify"))
    }
}

/// Find an element by its `ID` attribute.
///
/// Deliberately requires the id to be unique. Two elements sharing an id is
/// not valid XML, and it is precisely how a wrapping attack gets a verifier to
/// resolve a reference to the wrong element.
fn find_by_id<'a>(doc: &'a roxmltree::Document, id: &str) -> Option<roxmltree::Node<'a, 'a>> {
    let mut found = None;
    for node in doc.descendants().filter(|n| n.is_element()) {
        let matches = node
            .attributes()
            .any(|a| a.name() == "ID" && a.value() == id);
        if matches {
            if found.is_some() {
                return None; // ambiguous: refuse
            }
            found = Some(node);
        }
    }
    found
}

fn child<'a>(node: roxmltree::Node<'a, 'a>, name: &str) -> Option<roxmltree::Node<'a, 'a>> {
    node.children()
        .find(|c| c.is_element() && c.tag_name().name() == name)
}

fn decode_b64(s: &str, what: &'static str) -> Result<Vec<u8>> {
    let cleaned: String = s.chars().filter(|c| !c.is_whitespace()).collect();
    base64::engine::general_purpose::STANDARD
        .decode(cleaned)
        .map_err(|e| SsoError::malformed(what, format!("not base64: {e}")))
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}
