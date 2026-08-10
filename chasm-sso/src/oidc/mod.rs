// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

//! OpenID Connect: authorization code flow with PKCE.
//!
//! # What this supports
//!
//! * Authorization code flow with PKCE (S256). Not implicit, not hybrid --
//!   both hand tokens to the browser, and neither has a reason to exist for a
//!   server-side application.
//! * ID token verification against the provider's JWKS: RS256, RS384, RS512,
//!   ES256, ES384.
//! * Discovery via `.well-known/openid-configuration`.
//!
//! # What it refuses
//!
//! * `alg: none` and HMAC algorithms. HS256 with a shared secret is legal
//!   OIDC, but accepting it alongside RSA is how algorithm-confusion attacks
//!   work: an attacker signs a token with the *public* key as the HMAC secret
//!   and a naive verifier accepts it. This crate only ever verifies with
//!   asymmetric keys.
//! * Tokens whose `alg` disagrees with the key's type.
//! * Unsolicited responses: [`AuthRequest`] carries state and nonce, and both
//!   must be given back to [`OidcClient::verify_id_token`].

mod discovery;
mod jwks;
mod pkce;
// Every function in `token` performs HTTP. Without that feature the module is
// entirely dead, so it is compiled out rather than left as warnings for a
// consumer that only wants the verification logic.
#[cfg(feature = "http")]
mod token;

pub use discovery::ProviderMetadata;
pub use jwks::{Jwk, JwkSet};
pub use pkce::PkceChallenge;

use crate::{Identity, Result, SsoError};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Everything needed to talk to one identity provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OidcConfig {
    /// Issuer URL, e.g. `https://login.microsoftonline.com/<tenant>/v2.0`.
    pub issuer: String,
    pub client_id: String,
    /// Absent for public clients using PKCE alone.
    pub client_secret: Option<String>,
    pub redirect_uri: String,
    /// Defaults to `openid email profile` when empty.
    #[serde(default)]
    pub scopes: Vec<String>,
    /// Claim to read group membership from. Providers disagree: Entra uses
    /// `groups`, Okta is configurable, others use `roles`.
    #[serde(default)]
    pub groups_claim: Option<String>,
}

impl OidcConfig {
    fn scope_string(&self) -> String {
        if self.scopes.is_empty() {
            "openid email profile".to_string()
        } else if self.scopes.iter().any(|s| s == "openid") {
            self.scopes.join(" ")
        } else {
            // `openid` is what makes this OIDC rather than plain OAuth 2. A
            // provider without it may return no ID token at all, which fails
            // much later and more confusingly than adding it here.
            format!("openid {}", self.scopes.join(" "))
        }
    }
}

/// A pending login. The caller must keep this until the browser comes back.
///
/// `state` and `verifier` are secrets in the sense that leaking them enables
/// CSRF and code interception respectively; store them in a server-side
/// session, not in a cookie readable by script.
#[derive(Debug, Clone)]
pub struct AuthRequest {
    /// Send the user here.
    pub authorization_url: String,
    /// Echoed back by the provider; must match or the response is unsolicited.
    pub state: String,
    /// Must appear in the ID token, binding it to this request.
    pub nonce: String,
    /// The PKCE secret, exchanged with the code.
    pub verifier: String,
}

/// Tokens returned by the provider.
#[derive(Debug, Clone, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    #[serde(default)]
    pub id_token: Option<String>,
    #[serde(default)]
    pub refresh_token: Option<String>,
    #[serde(default)]
    pub expires_in: Option<i64>,
    #[serde(default)]
    pub token_type: Option<String>,
}

/// Claims this crate reads. Everything else is carried through in
/// [`Identity::attributes`].
#[derive(Debug, Clone, Deserialize)]
pub struct IdTokenClaims {
    pub iss: String,
    pub sub: String,
    #[serde(default)]
    pub aud: Audience,
    pub exp: i64,
    #[serde(default)]
    pub iat: Option<i64>,
    #[serde(default)]
    pub nonce: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub email_verified: Option<bool>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub preferred_username: Option<String>,
    #[serde(flatten)]
    pub extra: BTreeMap<String, serde_json::Value>,
}

/// `aud` is a string or an array of strings depending on the provider.
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(untagged)]
pub enum Audience {
    One(String),
    Many(Vec<String>),
    #[default]
    Absent,
}

impl Audience {
    fn contains(&self, client_id: &str) -> bool {
        match self {
            Self::One(a) => a == client_id,
            Self::Many(all) => all.iter().any(|a| a == client_id),
            Self::Absent => false,
        }
    }
}

/// An OIDC client for one provider.
pub struct OidcClient {
    config: OidcConfig,
    metadata: ProviderMetadata,
    jwks: JwkSet,
}

impl OidcClient {
    /// Build from already-fetched metadata and keys.
    ///
    /// The plumbing-free constructor: hosts that own their HTTP stack, and
    /// tests, use this. [`OidcClient::discover`] is the convenience wrapper.
    pub fn new(config: OidcConfig, metadata: ProviderMetadata, jwks: JwkSet) -> Result<Self> {
        if config.client_id.trim().is_empty() {
            return Err(SsoError::Config("client_id is empty".into()));
        }
        if config.redirect_uri.trim().is_empty() {
            return Err(SsoError::Config("redirect_uri is empty".into()));
        }
        metadata.check_issuer(&config.issuer)?;
        Ok(Self {
            config,
            metadata,
            jwks,
        })
    }

    pub fn metadata(&self) -> &ProviderMetadata {
        &self.metadata
    }

    // Only the HTTP paths need these; without that feature they are dead.
    #[cfg(feature = "http")]
    pub(crate) fn token_endpoint(&self) -> &str {
        &self.metadata.token_endpoint
    }

    #[cfg(feature = "http")]
    pub(crate) fn client_id(&self) -> &str {
        &self.config.client_id
    }

    #[cfg(feature = "http")]
    pub(crate) fn client_secret(&self) -> Option<&str> {
        self.config.client_secret.as_deref()
    }

    #[cfg(feature = "http")]
    pub(crate) fn redirect_uri(&self) -> &str {
        &self.config.redirect_uri
    }

    /// Begin a login.
    pub fn begin(&self) -> AuthRequest {
        let pkce = PkceChallenge::generate();
        let state = pkce::random_urlsafe(32);
        let nonce = pkce::random_urlsafe(32);

        let mut url = url::Url::parse(&self.metadata.authorization_endpoint)
            .expect("authorization_endpoint validated at construction");
        {
            let mut q = url.query_pairs_mut();
            q.append_pair("response_type", "code");
            q.append_pair("client_id", &self.config.client_id);
            q.append_pair("redirect_uri", &self.config.redirect_uri);
            q.append_pair("scope", &self.config.scope_string());
            q.append_pair("state", &state);
            q.append_pair("nonce", &nonce);
            q.append_pair("code_challenge", &pkce.challenge);
            q.append_pair("code_challenge_method", "S256");
        }

        AuthRequest {
            authorization_url: url.into(),
            state,
            nonce,
            verifier: pkce.verifier,
        }
    }

    /// Check the `state` a redirect came back with.
    ///
    /// Constant-time, because this is a secret comparison and an early-exit
    /// `==` leaks the shared prefix length to anyone who can time it.
    pub fn check_state(expected: &str, returned: &str) -> Result<()> {
        if constant_time_eq(expected.as_bytes(), returned.as_bytes()) {
            Ok(())
        } else {
            Err(SsoError::verification(
                "state mismatch (unsolicited response)",
            ))
        }
    }

    /// Verify an ID token and produce an [`Identity`].
    ///
    /// Checks, in order: header algorithm is asymmetric and known; the signing
    /// key is one the provider published; signature; issuer; audience;
    /// expiry; and nonce.
    pub fn verify_id_token(&self, id_token: &str, expected_nonce: &str) -> Result<Identity> {
        let header = jsonwebtoken::decode_header(id_token)
            .map_err(|e| SsoError::malformed("id_token", e.to_string()))?;

        // Reject symmetric and `none` before touching a key. Accepting HS256
        // beside RS256 is the algorithm-confusion hole: the attacker signs
        // with the RSA *public* key as an HMAC secret, and a verifier that
        // picks the algorithm from the token accepts it.
        use jsonwebtoken::Algorithm::*;
        if !matches!(
            header.alg,
            RS256 | RS384 | RS512 | ES256 | ES384 | PS256 | PS384 | PS512
        ) {
            return Err(SsoError::unsupported(format!(
                "id_token algorithm {:?} is not asymmetric; refusing",
                header.alg
            )));
        }

        let kid = header.kid.as_deref();
        let key = self.jwks.find(kid, header.alg).ok_or_else(|| {
            SsoError::verification(match kid {
                Some(k) => format!("no published key matches kid {k}"),
                None => "token has no kid and no single usable key was published".to_string(),
            })
        })?;

        let decoding_key = key.decoding_key()?;

        let mut validation = jsonwebtoken::Validation::new(header.alg);
        validation.set_issuer(&[&self.config.issuer]);
        // Audience is checked below against our own client_id so the failure
        // message is ours; jsonwebtoken's is opaque.
        validation.validate_aud = false;
        // exp is validated here; `leeway` defaults to 60s, which is the usual
        // allowance for clock skew between us and the IdP.

        let data = jsonwebtoken::decode::<IdTokenClaims>(id_token, &decoding_key, &validation)
            .map_err(|e| SsoError::verification(format!("id_token rejected: {e}")))?;
        let claims = data.claims;

        if !claims.aud.contains(&self.config.client_id) {
            return Err(SsoError::verification(
                "id_token audience does not include this client",
            ));
        }

        // The nonce binds this token to the authorization request we started.
        // Without it a token minted for another session of the same client is
        // replayable here.
        match claims.nonce.as_deref() {
            Some(n) if constant_time_eq(n.as_bytes(), expected_nonce.as_bytes()) => {}
            Some(_) => return Err(SsoError::verification("id_token nonce mismatch")),
            None => return Err(SsoError::verification("id_token has no nonce")),
        }

        Ok(self.identity_from(claims))
    }

    fn identity_from(&self, claims: IdTokenClaims) -> Identity {
        let groups_claim = self.config.groups_claim.as_deref().unwrap_or("groups");
        let groups = claims
            .extra
            .get(groups_claim)
            .map(json_to_strings)
            .unwrap_or_default();

        let mut attributes = BTreeMap::new();
        for (k, v) in &claims.extra {
            let values = json_to_strings(v);
            if !values.is_empty() {
                attributes.insert(k.clone(), values);
            }
        }

        Identity {
            subject: claims.sub,
            issuer: claims.iss,
            email: claims.email,
            // Absent means unverified. Treating a missing claim as "verified"
            // would accept an address the provider never confirmed.
            email_verified: claims.email_verified.unwrap_or(false),
            display_name: claims.name.or(claims.preferred_username),
            groups,
            attributes,
        }
    }
}

fn json_to_strings(v: &serde_json::Value) -> Vec<String> {
    match v {
        serde_json::Value::String(s) => vec![s.clone()],
        serde_json::Value::Array(items) => items
            .iter()
            .filter_map(|i| match i {
                serde_json::Value::String(s) => Some(s.clone()),
                serde_json::Value::Number(n) => Some(n.to_string()),
                serde_json::Value::Bool(b) => Some(b.to_string()),
                _ => None,
            })
            .collect(),
        serde_json::Value::Number(n) => vec![n.to_string()],
        serde_json::Value::Bool(b) => vec![b.to_string()],
        _ => Vec::new(),
    }
}

/// Compare without leaking length or content through timing.
pub(crate) fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scopes_always_include_openid() {
        let mut c = OidcConfig {
            issuer: "https://idp.example".into(),
            client_id: "abc".into(),
            client_secret: None,
            redirect_uri: "https://app.example/cb".into(),
            scopes: vec![],
            groups_claim: None,
        };
        assert_eq!(c.scope_string(), "openid email profile");

        c.scopes = vec!["email".into()];
        assert_eq!(c.scope_string(), "openid email");

        c.scopes = vec!["openid".into(), "groups".into()];
        assert_eq!(c.scope_string(), "openid groups");
    }

    #[test]
    fn audience_accepts_both_shapes() {
        assert!(Audience::One("abc".into()).contains("abc"));
        assert!(Audience::Many(vec!["x".into(), "abc".into()]).contains("abc"));
        assert!(!Audience::Many(vec!["x".into()]).contains("abc"));
        assert!(!Audience::Absent.contains("abc"));
    }

    #[test]
    fn constant_time_eq_still_compares_correctly() {
        assert!(constant_time_eq(b"hello", b"hello"));
        assert!(!constant_time_eq(b"hello", b"hellp"));
        assert!(!constant_time_eq(b"hello", b"hell"));
        assert!(constant_time_eq(b"", b""));
    }

    #[test]
    fn state_mismatch_is_rejected() {
        assert!(OidcClient::check_state("abc", "abc").is_ok());
        let e = OidcClient::check_state("abc", "abd").unwrap_err();
        assert!(e.is_rejection());
    }

    #[test]
    fn json_values_flatten_to_strings() {
        assert_eq!(json_to_strings(&serde_json::json!("a")), vec!["a"]);
        assert_eq!(
            json_to_strings(&serde_json::json!(["a", "b"])),
            vec!["a", "b"]
        );
        assert_eq!(json_to_strings(&serde_json::json!(42)), vec!["42"]);
        assert!(json_to_strings(&serde_json::json!({"k": "v"})).is_empty());
    }
}
