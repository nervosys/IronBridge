// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

//! The provider's published signing keys.

use crate::{Result, SsoError};
use jsonwebtoken::{Algorithm, DecodingKey};
use serde::{Deserialize, Serialize};

/// One key from a JWKS document.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Jwk {
    /// `RSA` or `EC`. Symmetric key types are rejected at use.
    pub kty: String,
    #[serde(default)]
    pub kid: Option<String>,
    #[serde(default, rename = "use")]
    pub use_: Option<String>,
    #[serde(default)]
    pub alg: Option<String>,

    // RSA
    #[serde(default)]
    pub n: Option<String>,
    #[serde(default)]
    pub e: Option<String>,

    // EC
    #[serde(default)]
    pub crv: Option<String>,
    #[serde(default)]
    pub x: Option<String>,
    #[serde(default)]
    pub y: Option<String>,
}

impl Jwk {
    /// Turn this into something that can verify a signature.
    pub fn decoding_key(&self) -> Result<DecodingKey> {
        match self.kty.as_str() {
            "RSA" => {
                let (n, e) = match (&self.n, &self.e) {
                    (Some(n), Some(e)) => (n, e),
                    _ => {
                        return Err(SsoError::malformed("jwk", "RSA key missing n or e"));
                    }
                };
                DecodingKey::from_rsa_components(n, e)
                    .map_err(|e| SsoError::malformed("jwk", format!("bad RSA key: {e}")))
            }
            "EC" => {
                let (x, y) = match (&self.x, &self.y) {
                    (Some(x), Some(y)) => (x, y),
                    _ => {
                        return Err(SsoError::malformed("jwk", "EC key missing x or y"));
                    }
                };
                DecodingKey::from_ec_components(x, y)
                    .map_err(|e| SsoError::malformed("jwk", format!("bad EC key: {e}")))
            }
            // oct is a shared secret. A provider publishing one in a JWKS is
            // either confused or hostile; either way it must never be used to
            // verify an ID token here.
            other => Err(SsoError::unsupported(format!(
                "key type {other} cannot verify an ID token"
            ))),
        }
    }

    /// Whether this key could have produced a signature with `alg`.
    fn supports(&self, alg: Algorithm) -> bool {
        // A key that names its algorithm is taken at its word.
        if let Some(declared) = &self.alg {
            return declared == &format!("{alg:?}");
        }
        // Otherwise fall back to the key type, which at least prevents
        // verifying an RSA signature with an EC key.
        match alg {
            Algorithm::RS256
            | Algorithm::RS384
            | Algorithm::RS512
            | Algorithm::PS256
            | Algorithm::PS384
            | Algorithm::PS512 => self.kty == "RSA",
            Algorithm::ES256 | Algorithm::ES384 => self.kty == "EC",
            _ => false,
        }
    }

    /// Keys marked for encryption must not be used to verify signatures.
    fn usable_for_signing(&self) -> bool {
        match self.use_.as_deref() {
            Some("sig") | None => true,
            Some(_) => false,
        }
    }
}

/// A set of published keys.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct JwkSet {
    pub keys: Vec<Jwk>,
}

impl JwkSet {
    pub fn from_json(body: &str) -> Result<Self> {
        serde_json::from_str(body).map_err(|e| SsoError::malformed("jwks document", e.to_string()))
    }

    /// Find the key that signed a token.
    ///
    /// With a `kid`, only that key is considered -- trying every key when one
    /// was named lets an attacker who can add a key to the set (or who is
    /// simply lucky) get a token verified against a key the provider did not
    /// intend for it.
    ///
    /// Without a `kid`, a single usable key is accepted, because some small
    /// providers publish exactly one and omit the identifier. Two or more is
    /// ambiguous and refused.
    pub fn find(&self, kid: Option<&str>, alg: Algorithm) -> Option<&Jwk> {
        let usable = || {
            self.keys
                .iter()
                .filter(|k| k.usable_for_signing() && k.supports(alg))
        };

        match kid {
            Some(kid) => usable().find(|k| k.kid.as_deref() == Some(kid)),
            None => {
                let mut it = usable();
                let first = it.next()?;
                if it.next().is_some() {
                    return None;
                }
                Some(first)
            }
        }
    }
}

#[cfg(feature = "http")]
impl JwkSet {
    pub async fn fetch(client: &reqwest::Client, jwks_uri: &str) -> Result<Self> {
        let body = client
            .get(jwks_uri)
            .send()
            .await
            .map_err(|e| SsoError::Transport(format!("jwks request failed: {e}")))?
            .error_for_status()
            .map_err(|e| SsoError::Transport(format!("jwks returned {e}")))?
            .text()
            .await
            .map_err(|e| SsoError::Transport(format!("jwks body unreadable: {e}")))?;
        Self::from_json(&body)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rsa_key(kid: &str) -> Jwk {
        Jwk {
            kty: "RSA".into(),
            kid: Some(kid.into()),
            use_: Some("sig".into()),
            alg: None,
            n: Some("abc".into()),
            e: Some("AQAB".into()),
            crv: None,
            x: None,
            y: None,
        }
    }

    #[test]
    fn a_named_key_is_selected_by_kid() {
        let set = JwkSet {
            keys: vec![rsa_key("one"), rsa_key("two")],
        };
        assert_eq!(
            set.find(Some("two"), Algorithm::RS256)
                .unwrap()
                .kid
                .as_deref(),
            Some("two")
        );
    }

    /// The important negative: a kid that is not published must not silently
    /// fall back to some other key.
    #[test]
    fn an_unknown_kid_matches_nothing() {
        let set = JwkSet {
            keys: vec![rsa_key("one")],
        };
        assert!(set.find(Some("other"), Algorithm::RS256).is_none());
    }

    #[test]
    fn a_missing_kid_is_only_allowed_when_one_key_is_published() {
        let one = JwkSet {
            keys: vec![rsa_key("a")],
        };
        assert!(one.find(None, Algorithm::RS256).is_some());

        let two = JwkSet {
            keys: vec![rsa_key("a"), rsa_key("b")],
        };
        assert!(
            two.find(None, Algorithm::RS256).is_none(),
            "ambiguous key selection must be refused"
        );
    }

    #[test]
    fn encryption_keys_are_not_used_for_signatures() {
        let mut k = rsa_key("enc");
        k.use_ = Some("enc".into());
        let set = JwkSet { keys: vec![k] };
        assert!(set.find(Some("enc"), Algorithm::RS256).is_none());
    }

    #[test]
    fn key_type_must_match_the_algorithm() {
        let set = JwkSet {
            keys: vec![rsa_key("r")],
        };
        assert!(set.find(Some("r"), Algorithm::RS256).is_some());
        assert!(
            set.find(Some("r"), Algorithm::ES256).is_none(),
            "an RSA key must not verify an ECDSA signature"
        );
    }

    #[test]
    fn a_declared_alg_is_honoured() {
        let mut k = rsa_key("r");
        k.alg = Some("RS512".into());
        let set = JwkSet { keys: vec![k] };
        assert!(set.find(Some("r"), Algorithm::RS512).is_some());
        assert!(set.find(Some("r"), Algorithm::RS256).is_none());
    }

    #[test]
    fn shared_secrets_are_refused_outright() {
        let oct = Jwk {
            kty: "oct".into(),
            kid: Some("s".into()),
            use_: Some("sig".into()),
            alg: None,
            n: None,
            e: None,
            crv: None,
            x: None,
            y: None,
        };
        // `DecodingKey` is not Debug, so unwrap_err is unavailable here.
        let err = match oct.decoding_key() {
            Err(e) => e,
            Ok(_) => panic!("a shared secret must never verify an ID token"),
        };
        assert!(err.to_string().contains("oct"), "{err}");
    }
}
