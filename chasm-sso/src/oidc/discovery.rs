// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

//! Provider metadata from `.well-known/openid-configuration`.

use crate::{Result, SsoError};
use serde::{Deserialize, Serialize};

/// The subset of provider metadata this crate uses.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderMetadata {
    pub issuer: String,
    pub authorization_endpoint: String,
    pub token_endpoint: String,
    pub jwks_uri: String,
    #[serde(default)]
    pub userinfo_endpoint: Option<String>,
    #[serde(default)]
    pub id_token_signing_alg_values_supported: Vec<String>,
}

impl ProviderMetadata {
    /// The metadata's issuer must match the configured one exactly.
    ///
    /// This is the check that makes discovery safe. Without it, an attacker
    /// who can influence which document gets fetched can point every endpoint
    /// at themselves, and the "provider" you verify against becomes theirs.
    /// RFC 8414 requires the comparison be exact -- no normalisation, no
    /// trailing-slash forgiveness.
    pub(crate) fn check_issuer(&self, configured: &str) -> Result<()> {
        if self.issuer == configured {
            return Ok(());
        }
        // Say what happened, since a stray trailing slash is the usual cause
        // and is otherwise baffling.
        Err(SsoError::Config(format!(
            "issuer mismatch: configured {configured:?} but provider metadata says {:?}. \
             These must match exactly, including any trailing slash.",
            self.issuer
        )))
    }

    /// Validate the URLs before they are used to build a redirect.
    pub fn validate(&self) -> Result<()> {
        for (name, value) in [
            ("authorization_endpoint", &self.authorization_endpoint),
            ("token_endpoint", &self.token_endpoint),
            ("jwks_uri", &self.jwks_uri),
        ] {
            let url = url::Url::parse(value)
                .map_err(|e| SsoError::Config(format!("{name} is not a URL: {e}")))?;
            // An IdP reached over plaintext can be rewritten in flight, which
            // defeats the entire protocol. localhost is exempted so the thing
            // can be developed against a local provider.
            let host_is_local = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "::1"));
            if url.scheme() != "https" && !host_is_local {
                return Err(SsoError::Config(format!(
                    "{name} must use https (got {})",
                    url.scheme()
                )));
            }
        }
        Ok(())
    }

    /// The conventional discovery URL for an issuer.
    pub fn discovery_url(issuer: &str) -> String {
        format!(
            "{}/.well-known/openid-configuration",
            issuer.trim_end_matches('/')
        )
    }

    /// Parse a discovery document.
    pub fn from_json(body: &str) -> Result<Self> {
        let meta: Self = serde_json::from_str(body)
            .map_err(|e| SsoError::malformed("discovery document", e.to_string()))?;
        meta.validate()?;
        Ok(meta)
    }
}

#[cfg(feature = "http")]
impl ProviderMetadata {
    /// Fetch and validate the discovery document.
    pub async fn discover(client: &reqwest::Client, issuer: &str) -> Result<Self> {
        let url = Self::discovery_url(issuer);
        let body = client
            .get(&url)
            .send()
            .await
            .map_err(|e| SsoError::Transport(format!("discovery request failed: {e}")))?
            .error_for_status()
            .map_err(|e| SsoError::Transport(format!("discovery returned {e}")))?
            .text()
            .await
            .map_err(|e| SsoError::Transport(format!("discovery body unreadable: {e}")))?;

        let meta = Self::from_json(&body)?;
        meta.check_issuer(issuer)?;
        Ok(meta)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn doc(issuer: &str) -> String {
        format!(
            r#"{{
              "issuer": "{issuer}",
              "authorization_endpoint": "https://idp.example/authorize",
              "token_endpoint": "https://idp.example/token",
              "jwks_uri": "https://idp.example/keys"
            }}"#
        )
    }

    #[test]
    fn parses_a_minimal_document() {
        let m = ProviderMetadata::from_json(&doc("https://idp.example")).unwrap();
        assert_eq!(m.jwks_uri, "https://idp.example/keys");
    }

    /// A trailing slash is the classic discovery bug, and the message should
    /// name it rather than leaving someone guessing.
    #[test]
    fn issuer_must_match_exactly() {
        let m = ProviderMetadata::from_json(&doc("https://idp.example")).unwrap();
        assert!(m.check_issuer("https://idp.example").is_ok());

        let err = m.check_issuer("https://idp.example/").unwrap_err();
        assert!(err.to_string().contains("trailing slash"), "{err}");
        // A configuration problem, not a rejected credential.
        assert!(!err.is_rejection());
    }

    #[test]
    fn plaintext_endpoints_are_refused() {
        let bad = r#"{
          "issuer": "http://idp.example",
          "authorization_endpoint": "http://idp.example/authorize",
          "token_endpoint": "http://idp.example/token",
          "jwks_uri": "http://idp.example/keys"
        }"#;
        let err = ProviderMetadata::from_json(bad).unwrap_err();
        assert!(err.to_string().contains("https"), "{err}");
    }

    #[test]
    fn localhost_may_use_http_for_development() {
        let dev = r#"{
          "issuer": "http://localhost:8080",
          "authorization_endpoint": "http://localhost:8080/authorize",
          "token_endpoint": "http://localhost:8080/token",
          "jwks_uri": "http://localhost:8080/keys"
        }"#;
        assert!(ProviderMetadata::from_json(dev).is_ok());
    }

    #[test]
    fn discovery_url_tolerates_a_trailing_slash() {
        assert_eq!(
            ProviderMetadata::discovery_url("https://idp.example/"),
            "https://idp.example/.well-known/openid-configuration"
        );
        assert_eq!(
            ProviderMetadata::discovery_url("https://idp.example"),
            "https://idp.example/.well-known/openid-configuration"
        );
    }
}
