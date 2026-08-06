// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

//! Exchanging an authorization code for tokens.

use super::{OidcClient, TokenResponse};
use crate::{Result, SsoError};

impl OidcClient {
    /// Fetch metadata and keys, then build a client.
    #[cfg(feature = "http")]
    pub async fn discover(config: super::OidcConfig, client: &reqwest::Client) -> Result<Self> {
        let metadata = super::ProviderMetadata::discover(client, &config.issuer).await?;
        let jwks = super::JwkSet::fetch(client, &metadata.jwks_uri).await?;
        Self::new(config, metadata, jwks)
    }

    /// Exchange the authorization code for tokens.
    ///
    /// `verifier` is the PKCE secret from the [`super::AuthRequest`] that
    /// started this login. Sending the wrong one, or omitting it, is what an
    /// attacker who intercepted the code would have to do -- so the provider
    /// rejecting it is the protection working.
    #[cfg(feature = "http")]
    pub async fn exchange_code(
        &self,
        client: &reqwest::Client,
        code: &str,
        verifier: &str,
    ) -> Result<TokenResponse> {
        let mut form = vec![
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", self.redirect_uri()),
            ("client_id", self.client_id()),
            ("code_verifier", verifier),
        ];
        if let Some(secret) = self.client_secret() {
            form.push(("client_secret", secret));
        }

        let response = client
            .post(self.token_endpoint())
            .form(&form)
            .send()
            .await
            .map_err(|e| SsoError::Transport(format!("token request failed: {e}")))?;

        let status = response.status();
        let body = response
            .text()
            .await
            .map_err(|e| SsoError::Transport(format!("token response unreadable: {e}")))?;

        if !status.is_success() {
            // The body carries the provider's `error` / `error_description`,
            // which is the only useful diagnostic when a redirect_uri or
            // client_secret is subtly wrong. It contains no user credential.
            return Err(SsoError::Transport(format!(
                "token endpoint returned {status}: {}",
                truncate(&body, 300)
            )));
        }

        serde_json::from_str(&body)
            .map_err(|e| SsoError::malformed("token response", e.to_string()))
    }

    /// Complete a login in one step: exchange the code, then verify the token.
    ///
    /// Refuses a response with no `id_token`. That is a plain OAuth 2 result,
    /// not OIDC -- it carries an access token and no verified identity, and
    /// treating the two as interchangeable is how an access token for another
    /// application ends up logging someone in here.
    #[cfg(feature = "http")]
    pub async fn complete_login(
        &self,
        client: &reqwest::Client,
        code: &str,
        request: &super::AuthRequest,
    ) -> Result<(crate::Identity, TokenResponse)> {
        let tokens = self.exchange_code(client, code, &request.verifier).await?;
        let id_token = tokens.id_token.as_deref().ok_or_else(|| {
            SsoError::verification(
                "provider returned no id_token; this is an OAuth 2 response, not OIDC",
            )
        })?;
        let identity = self.verify_id_token(id_token, &request.nonce)?;
        Ok((identity, tokens))
    }
}

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        return s.to_string();
    }
    s.chars().take(max).collect::<String>() + "..."
}

#[cfg(test)]
mod tests {
    #[test]
    fn truncate_does_not_split_a_multibyte_character() {
        let text = "\u{3042}".repeat(400);
        let out = super::truncate(&text, 300);
        assert!(out.ends_with("..."));
        assert_eq!(out.chars().count(), 303);
    }

    #[test]
    fn short_text_is_unchanged() {
        assert_eq!(super::truncate("short", 300), "short");
    }
}
