// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

//! PKCE (RFC 7636), S256 only.
//!
//! `plain` is also legal and is worthless: the challenge equals the verifier,
//! so anyone who intercepts the authorization request can complete the
//! exchange. Only S256 is generated, and nothing here can be talked down.

use base64::Engine;
use rand::RngCore;
use sha2::{Digest, Sha256};

/// A verifier and the challenge derived from it.
pub struct PkceChallenge {
    /// Held by the client, sent only with the code exchange.
    pub verifier: String,
    /// Sent in the authorization request, safe to expose.
    pub challenge: String,
}

impl PkceChallenge {
    pub fn generate() -> Self {
        // RFC 7636 allows 43-128 characters. 32 random bytes is 43 base64url
        // characters -- the minimum length, and 256 bits of entropy.
        let verifier = random_urlsafe(32);
        let digest = Sha256::digest(verifier.as_bytes());
        let challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(digest);
        Self {
            verifier,
            challenge,
        }
    }
}

/// `n` bytes from the OS random source, base64url without padding.
///
/// Used for the PKCE verifier, `state` and `nonce`. All three are unguessable
/// tokens rather than identifiers, so this reads from the OS CSPRNG rather
/// than a seeded generator.
pub(crate) fn random_urlsafe(n: usize) -> String {
    let mut bytes = vec![0u8; n];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verifier_meets_rfc_length_bounds() {
        let p = PkceChallenge::generate();
        assert!(
            p.verifier.len() >= 43 && p.verifier.len() <= 128,
            "verifier length {} outside RFC 7636 bounds",
            p.verifier.len()
        );
    }

    #[test]
    fn challenge_is_the_sha256_of_the_verifier() {
        let p = PkceChallenge::generate();
        let expected = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .encode(Sha256::digest(p.verifier.as_bytes()));
        assert_eq!(p.challenge, expected);
    }

    /// The RFC's own worked example. If this drifts, the encoding is wrong in
    /// a way that would fail against every real provider.
    #[test]
    fn matches_rfc7636_appendix_b() {
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        let challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .encode(Sha256::digest(verifier.as_bytes()));
        assert_eq!(challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    }

    #[test]
    fn generated_values_do_not_repeat() {
        let a = PkceChallenge::generate();
        let b = PkceChallenge::generate();
        assert_ne!(a.verifier, b.verifier);
        assert_ne!(random_urlsafe(32), random_urlsafe(32));
    }

    #[test]
    fn encoding_is_url_safe_and_unpadded() {
        for _ in 0..20 {
            let s = random_urlsafe(32);
            assert!(!s.contains('+') && !s.contains('/') && !s.contains('='), "{s}");
        }
    }
}
