// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

//! OpenID Connect login, service-provider side.
//!
//! The protocol work -- discovery, JWKS, PKCE, ID token verification -- lives
//! in [`chasm_sso::oidc`]. This module is the part that has to exist in the
//! server: provider configuration, the pending-login store, and turning a
//! verified [`chasm_sso::Identity`] into a Chasm user and session.
//!
//! **Prefer this over [`super::sso`].** Both are offered because buyers'
//! identity providers differ, but OIDC is a smaller, better-specified
//! protocol with a much smaller attack surface than SAML's XML signatures.
//!
//! # The two secrets in the flow
//!
//! An [`OidcLoginState`] holds a `state` and a `verifier`, and they defend
//! different things:
//!
//! * `state` proves the callback answers a login *this server* started. It is
//!   consumed on use -- see [`DatabaseOps::take_oidc_login_state`] -- so a
//!   replayed callback finds nothing and is refused.
//! * `verifier` is the PKCE secret. It never leaves the server, so an attacker
//!   who intercepts the authorization code cannot redeem it.
//!
//! Neither is ever returned to the browser. The client gets an opaque
//! `state` handle and the provider URL, nothing else.
//!
//! # The client secret is stored in plaintext
//!
//! [`OidcProviderConfig::client_secret`] is a credential, and it is written to
//! the enterprise database as-is. It never leaves over HTTP -- see
//! [`OidcProviderConfig::redacted`], which the handlers use without exception
//! -- but anyone who can read the database file has it.
//!
//! This is a real exposure and is called out rather than hidden. It differs
//! from SAML, where the stored certificate is public key material and reading
//! it grants nothing. Two things reduce it in practice: a provider configured
//! as a public client has no secret at all (PKCE alone is enough, and is the
//! better configuration), and the file is only as readable as the deployment
//! makes it. Encrypting it at rest needs a key-management story this crate
//! does not yet have.

use actix_web::{web, HttpResponse};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use super::audit::Database;
use super::auth::{AuthResponse, SubscriptionTier, User};

/// How long a started login may sit unanswered.
///
/// Long enough for a password plus MFA prompt, short enough that an
/// abandoned login is not a lasting foothold.
const LOGIN_STATE_TTL_MINUTES: i64 = 15;

/// One identity provider's OIDC configuration.
///
/// `client_secret` is a credential, so it is skipped when this is serialised
/// to a client -- see [`Self::redacted`]. It still round-trips through the
/// database because that path uses a separate representation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OidcProviderConfig {
    pub id: String,
    pub name: String,
    /// Issuer URL. Discovery appends `/.well-known/openid-configuration`.
    pub issuer: String,
    pub client_id: String,
    /// Absent for public clients relying on PKCE alone.
    #[serde(default)]
    pub client_secret: Option<String>,
    pub redirect_uri: String,
    #[serde(default)]
    pub scopes: Vec<String>,
    /// Claim carrying group membership. Entra uses `groups`, others `roles`.
    #[serde(default)]
    pub groups_claim: Option<String>,
    pub enabled: bool,
    /// Email domains routed here. Without one, only an explicit id reaches it.
    #[serde(default)]
    pub domains: Vec<String>,
    #[serde(default)]
    pub organization_id: Option<String>,
    #[serde(default)]
    pub default_tier: SubscriptionTier,
    pub auto_provision: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

impl OidcProviderConfig {
    /// The form safe to return over HTTP.
    ///
    /// Returning the client secret would hand an admin-panel reader a
    /// credential that lets them impersonate this application against the
    /// identity provider. The boolean says whether one is set, which is the
    /// only thing a caller legitimately needs to know.
    pub fn redacted(&self) -> PublicOidcProvider {
        PublicOidcProvider {
            id: self.id.clone(),
            name: self.name.clone(),
            issuer: self.issuer.clone(),
            client_id: self.client_id.clone(),
            has_client_secret: self.client_secret.is_some(),
            redirect_uri: self.redirect_uri.clone(),
            scopes: self.scopes.clone(),
            groups_claim: self.groups_claim.clone(),
            enabled: self.enabled,
            domains: self.domains.clone(),
            organization_id: self.organization_id.clone(),
            default_tier: self.default_tier,
            auto_provision: self.auto_provision,
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }

    fn to_sso_config(&self) -> chasm_sso::oidc::OidcConfig {
        chasm_sso::oidc::OidcConfig {
            issuer: self.issuer.clone(),
            client_id: self.client_id.clone(),
            client_secret: self.client_secret.clone(),
            redirect_uri: self.redirect_uri.clone(),
            scopes: self.scopes.clone(),
            groups_claim: self.groups_claim.clone(),
        }
    }
}

/// An OIDC provider as returned to a client: no `client_secret`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicOidcProvider {
    pub id: String,
    pub name: String,
    pub issuer: String,
    pub client_id: String,
    /// Whether a secret is configured. The secret itself is never sent.
    pub has_client_secret: bool,
    pub redirect_uri: String,
    pub scopes: Vec<String>,
    pub groups_claim: Option<String>,
    pub enabled: bool,
    pub domains: Vec<String>,
    pub organization_id: Option<String>,
    pub default_tier: SubscriptionTier,
    pub auto_provision: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

/// A login that has been started and not yet answered.
///
/// Single-use: the callback consumes it. Storing it server-side rather than
/// in a cookie is what keeps `nonce` and `verifier` out of reach of script.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OidcLoginState {
    /// The opaque handle echoed back by the provider.
    pub state: String,
    pub provider_id: String,
    pub nonce: String,
    pub verifier: String,
    /// Where to send the browser once the login completes.
    pub return_to: Option<String>,
    pub created_at: i64,
    pub expires_at: i64,
}

// =============================================================================
// Request/response types
// =============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateOidcProviderRequest {
    pub name: String,
    pub issuer: String,
    pub client_id: String,
    pub client_secret: Option<String>,
    pub redirect_uri: String,
    #[serde(default)]
    pub scopes: Vec<String>,
    pub groups_claim: Option<String>,
    #[serde(default)]
    pub domains: Vec<String>,
    pub organization_id: Option<String>,
    pub auto_provision: Option<bool>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateOidcProviderRequest {
    pub name: Option<String>,
    pub client_id: Option<String>,
    /// Sending this replaces the stored secret. Omitting it keeps the current
    /// one -- there is deliberately no way to express "clear the secret"
    /// alongside "leave it alone", because the two must not be confusable.
    pub client_secret: Option<String>,
    pub redirect_uri: Option<String>,
    pub scopes: Option<Vec<String>>,
    pub groups_claim: Option<String>,
    pub enabled: Option<bool>,
    pub auto_provision: Option<bool>,
    pub domains: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct BeginOidcLoginRequest {
    /// Explicit provider, or `email_domain` to discover one.
    pub provider_id: Option<String>,
    pub email_domain: Option<String>,
    pub return_to: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BeginOidcLoginResponse {
    /// Send the browser here.
    pub authorization_url: String,
    /// Hand back to the callback. Opaque; the secrets stay on the server.
    pub state: String,
}

#[derive(Debug, Deserialize)]
pub struct OidcCallbackRequest {
    pub code: String,
    pub state: String,
}

// =============================================================================
// Service
// =============================================================================

/// OIDC login, over a [`Database`] and an HTTP client.
pub struct OidcService {
    db: Database,
    http: reqwest::Client,
}

impl OidcService {
    pub fn new(db: Database) -> Self {
        Self {
            db,
            // One client, reused: it pools connections, and discovery plus the
            // token exchange hit the same host twice per login.
            http: reqwest::Client::new(),
        }
    }

    pub async fn list_providers(
        &self,
        organization_id: Option<&str>,
    ) -> Result<Vec<PublicOidcProvider>, String> {
        Ok(self
            .db
            .list_oidc_providers(organization_id)?
            .iter()
            .map(OidcProviderConfig::redacted)
            .collect())
    }

    pub async fn get_provider(&self, id: &str) -> Result<Option<OidcProviderConfig>, String> {
        self.db.get_oidc_provider(id)
    }

    pub async fn create_provider(
        &self,
        request: CreateOidcProviderRequest,
    ) -> Result<PublicOidcProvider, String> {
        if request.issuer.trim().is_empty() {
            return Err("issuer is required".to_string());
        }
        if request.client_id.trim().is_empty() {
            return Err("client_id is required".to_string());
        }
        // An issuer reached over plaintext offers no assurance that the JWKS
        // -- and therefore the signing keys the whole flow trusts -- came from
        // the provider. Localhost is exempt so development works.
        require_secure_issuer(&request.issuer)?;

        let now = Utc::now().timestamp();
        let provider = OidcProviderConfig {
            id: Uuid::new_v4().to_string(),
            name: request.name,
            issuer: request.issuer.trim_end_matches('/').to_string(),
            client_id: request.client_id,
            client_secret: request.client_secret,
            redirect_uri: request.redirect_uri,
            scopes: request.scopes,
            groups_claim: request.groups_claim,
            enabled: request.enabled.unwrap_or(true),
            domains: request
                .domains
                .iter()
                .map(|d| d.trim().to_lowercase())
                .filter(|d| !d.is_empty())
                .collect(),
            organization_id: request.organization_id,
            default_tier: SubscriptionTier::Enterprise,
            auto_provision: request.auto_provision.unwrap_or(false),
            created_at: now,
            updated_at: now,
        };

        self.db.create_oidc_provider(&provider)?;
        Ok(provider.redacted())
    }

    pub async fn update_provider(
        &self,
        id: &str,
        request: UpdateOidcProviderRequest,
    ) -> Result<PublicOidcProvider, String> {
        let mut provider = self
            .db
            .get_oidc_provider(id)?
            .ok_or_else(|| "Provider not found".to_string())?;

        if let Some(v) = request.name {
            provider.name = v;
        }
        if let Some(v) = request.client_id {
            provider.client_id = v;
        }
        if let Some(v) = request.client_secret {
            provider.client_secret = Some(v);
        }
        if let Some(v) = request.redirect_uri {
            provider.redirect_uri = v;
        }
        if let Some(v) = request.scopes {
            provider.scopes = v;
        }
        if let Some(v) = request.groups_claim {
            provider.groups_claim = Some(v);
        }
        if let Some(v) = request.enabled {
            provider.enabled = v;
        }
        if let Some(v) = request.auto_provision {
            provider.auto_provision = v;
        }
        if let Some(v) = request.domains {
            provider.domains = v
                .iter()
                .map(|d| d.trim().to_lowercase())
                .filter(|d| !d.is_empty())
                .collect();
        }
        provider.updated_at = Utc::now().timestamp();

        self.db.update_oidc_provider(&provider)?;
        Ok(provider.redacted())
    }

    pub async fn delete_provider(&self, id: &str) -> Result<(), String> {
        self.db.delete_oidc_provider(id)
    }

    /// Start a login: discover the provider, build the authorization URL, and
    /// remember what the callback will need.
    pub async fn begin_login(
        &self,
        request: BeginOidcLoginRequest,
    ) -> Result<BeginOidcLoginResponse, String> {
        let provider = match (&request.provider_id, &request.email_domain) {
            (Some(id), _) => self.db.get_oidc_provider(id)?,
            (None, Some(domain)) => self
                .db
                .get_oidc_provider_by_domain(&domain.trim().to_lowercase())?,
            (None, None) => {
                return Err("Must provide either provider_id or email_domain".to_string())
            }
        }
        .ok_or_else(|| "Provider not found".to_string())?;

        if !provider.enabled {
            return Err("Provider is disabled".to_string());
        }

        let client = chasm_sso::oidc::OidcClient::discover(provider.to_sso_config(), &self.http)
            .await
            .map_err(|e| format!("OIDC discovery failed: {}", e))?;

        let auth = client.begin();

        let now = Utc::now();
        self.db.store_oidc_login_state(&OidcLoginState {
            state: auth.state.clone(),
            provider_id: provider.id.clone(),
            nonce: auth.nonce,
            verifier: auth.verifier,
            return_to: request.return_to,
            created_at: now.timestamp(),
            expires_at: (now + Duration::minutes(LOGIN_STATE_TTL_MINUTES)).timestamp(),
        })?;

        Ok(BeginOidcLoginResponse {
            authorization_url: auth.authorization_url,
            state: auth.state,
        })
    }

    /// Finish a login: redeem the code and turn the ID token into a session.
    pub async fn complete_login(
        &self,
        request: OidcCallbackRequest,
    ) -> Result<AuthResponse, String> {
        // Consuming rather than reading is the replay defence: a second
        // callback carrying the same state finds nothing here.
        let login = self
            .db
            .take_oidc_login_state(&request.state)?
            .ok_or_else(|| "Unknown or already-used state".to_string())?;

        if Utc::now().timestamp() >= login.expires_at {
            return Err("Login expired; start again".to_string());
        }

        let provider = self
            .db
            .get_oidc_provider(&login.provider_id)?
            .ok_or_else(|| "Provider no longer configured".to_string())?;
        if !provider.enabled {
            return Err("Provider is disabled".to_string());
        }

        let client = chasm_sso::oidc::OidcClient::discover(provider.to_sso_config(), &self.http)
            .await
            .map_err(|e| format!("OIDC discovery failed: {}", e))?;

        // `chasm_sso` does the security-relevant part: it checks the token's
        // signature against the provider's JWKS, its issuer, audience, expiry
        // and the nonce this login was started with.
        let auth_request = chasm_sso::oidc::AuthRequest {
            authorization_url: String::new(),
            state: login.state.clone(),
            nonce: login.nonce.clone(),
            verifier: login.verifier.clone(),
        };
        let (identity, _tokens) = client
            .complete_login(&self.http, &request.code, &auth_request)
            .await
            .map_err(|e| format!("OIDC login failed: {}", e))?;

        let email = identity
            .email
            .clone()
            .ok_or_else(|| "Provider returned no email claim".to_string())?;

        // An unverified address must not select an account. Providers that
        // let a user set an arbitrary email would otherwise be a takeover
        // path into any account with a matching address.
        if !identity.email_verified {
            return Err("Provider did not assert the email address is verified".to_string());
        }

        let display_name = identity
            .display_name
            .clone()
            .unwrap_or_else(|| email.split('@').next().unwrap_or(&email).to_string());

        let user = self.find_or_create_user(&provider, &email, &display_name)?;

        let access_token = super::auth::generate_access_token(&user)
            .ok_or_else(|| "Failed to generate access token".to_string())?;
        let refresh_token = super::auth::generate_refresh_token(&user)
            .ok_or_else(|| "Failed to generate refresh token".to_string())?;

        Ok(AuthResponse {
            user: user.into(),
            access_token,
            refresh_token,
            expires_in: 24 * 60 * 60,
        })
    }

    fn find_or_create_user(
        &self,
        provider: &OidcProviderConfig,
        email: &str,
        display_name: &str,
    ) -> Result<User, String> {
        if let Some(user) = self.db.get_user_by_email(email)? {
            self.db.update_user_login(&user.id)?;
            return Ok(user);
        }

        if !provider.auto_provision {
            return Err("User not found and auto-provisioning is disabled".to_string());
        }

        let now = Utc::now().timestamp();
        let user = User {
            id: Uuid::new_v4().to_string(),
            email: email.to_string(),
            display_name: display_name.to_string(),
            password_hash: String::new(),
            subscription_tier: provider.default_tier,
            subscription_expires_at: None,
            created_at: now,
            updated_at: now,
            last_login_at: Some(now),
            // The provider asserted this, and it was checked above.
            email_verified: true,
            avatar_url: None,
            metadata: Some(format!(r#"{{"oidc_provider":"{}"}}"#, provider.id)),
        };
        self.db.create_user(&user)?;
        Ok(user)
    }
}

/// Refuse an issuer that is not `https`, except on loopback.
///
/// The JWKS fetched from this origin supplies the keys every ID token is
/// checked against. Over plaintext, anyone on the path chooses those keys.
fn require_secure_issuer(issuer: &str) -> Result<(), String> {
    let lower = issuer.trim().to_lowercase();
    if lower.starts_with("https://") {
        return Ok(());
    }
    // The host must *be* a loopback name, not merely start with one:
    // `http://localhost.evil.test` is an ordinary internet host and a prefix
    // check would wave it through.
    if let Some(rest) = lower.strip_prefix("http://") {
        let authority = rest.split(['/', '?', '#']).next().unwrap_or("");
        let host = if let Some(end) = authority.find(']') {
            // Bracketed IPv6: the colons inside are part of the address, so
            // the port can only be what follows the closing bracket.
            &authority[..=end]
        } else {
            authority.split(':').next().unwrap_or("")
        };
        if matches!(host, "localhost" | "127.0.0.1" | "[::1]") {
            return Ok(());
        }
    }
    Err("issuer must be https (loopback may use http for development)".to_string())
}

// =============================================================================
// HTTP handlers
// =============================================================================

/// GET /oidc/providers
pub async fn list_providers(
    service: web::Data<OidcService>,
    query: web::Query<HashMap<String, String>>,
) -> HttpResponse {
    match service
        .list_providers(query.get("organization_id").map(|s| s.as_str()))
        .await
    {
        Ok(providers) => HttpResponse::Ok().json(providers),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "error": e })),
    }
}

/// GET /oidc/providers/{provider_id}
pub async fn get_provider(
    service: web::Data<OidcService>,
    path: web::Path<String>,
) -> HttpResponse {
    match service.get_provider(&path.into_inner()).await {
        Ok(Some(p)) => HttpResponse::Ok().json(p.redacted()),
        Ok(None) => {
            HttpResponse::NotFound().json(serde_json::json!({ "error": "Provider not found" }))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "error": e })),
    }
}

/// POST /oidc/providers
pub async fn create_provider(
    service: web::Data<OidcService>,
    request: web::Json<CreateOidcProviderRequest>,
) -> HttpResponse {
    match service.create_provider(request.into_inner()).await {
        Ok(p) => HttpResponse::Created().json(p),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({ "error": e })),
    }
}

/// PUT /oidc/providers/{provider_id}
pub async fn update_provider(
    service: web::Data<OidcService>,
    path: web::Path<String>,
    request: web::Json<UpdateOidcProviderRequest>,
) -> HttpResponse {
    match service
        .update_provider(&path.into_inner(), request.into_inner())
        .await
    {
        Ok(p) => HttpResponse::Ok().json(p),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({ "error": e })),
    }
}

/// DELETE /oidc/providers/{provider_id}
pub async fn delete_provider(
    service: web::Data<OidcService>,
    path: web::Path<String>,
) -> HttpResponse {
    match service.delete_provider(&path.into_inner()).await {
        Ok(()) => HttpResponse::NoContent().finish(),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({ "error": e })),
    }
}

/// POST /oidc/login
pub async fn begin_login(
    service: web::Data<OidcService>,
    request: web::Json<BeginOidcLoginRequest>,
) -> HttpResponse {
    match service.begin_login(request.into_inner()).await {
        Ok(r) => HttpResponse::Ok().json(r),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({ "error": e })),
    }
}

/// GET /oidc/callback
///
/// A GET because that is how the authorization-code flow returns: the
/// provider redirects the browser with `code` and `state` in the query.
pub async fn callback(
    service: web::Data<OidcService>,
    query: web::Query<OidcCallbackRequest>,
) -> HttpResponse {
    match service.complete_login(query.into_inner()).await {
        Ok(r) => HttpResponse::Ok().json(r),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({ "error": e })),
    }
}

/// Configure OIDC routes
pub fn configure_oidc_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/oidc")
            .route("/providers", web::get().to(list_providers))
            .route("/providers", web::post().to(create_provider))
            .route("/providers/{provider_id}", web::get().to(get_provider))
            .route("/providers/{provider_id}", web::put().to(update_provider))
            .route(
                "/providers/{provider_id}",
                web::delete().to(delete_provider),
            )
            .route("/login", web::post().to(begin_login))
            .route("/callback", web::get().to(callback)),
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    fn provider() -> OidcProviderConfig {
        OidcProviderConfig {
            id: "p1".into(),
            name: "Entra".into(),
            issuer: "https://login.example.com/v2.0".into(),
            client_id: "client-abc".into(),
            client_secret: Some("super-secret-value".into()),
            redirect_uri: "https://chasm.example.com/oidc/callback".into(),
            scopes: vec![],
            groups_claim: Some("groups".into()),
            enabled: true,
            domains: vec!["example.com".into()],
            organization_id: None,
            default_tier: SubscriptionTier::Enterprise,
            auto_provision: true,
            created_at: 0,
            updated_at: 0,
        }
    }

    /// The client secret must not reach a client. This is the whole reason
    /// `PublicOidcProvider` exists rather than returning the stored struct.
    #[test]
    fn the_client_secret_is_never_serialised_to_a_client() {
        let json = serde_json::to_string(&provider().redacted()).unwrap();
        assert!(
            !json.contains("super-secret-value"),
            "the client secret leaked into a response body: {json}"
        );
        assert!(
            json.contains("\"has_client_secret\":true"),
            "callers still need to know whether one is set: {json}"
        );
    }

    #[test]
    fn a_provider_without_a_secret_reports_that() {
        let mut p = provider();
        p.client_secret = None;
        assert!(!p.redacted().has_client_secret);
    }

    /// The JWKS from this origin supplies every key the flow trusts, so a
    /// plaintext issuer means anyone on the path picks the signing keys.
    #[test]
    fn a_plaintext_issuer_is_refused() {
        assert!(require_secure_issuer("http://idp.example.com").is_err());
        assert!(require_secure_issuer("HTTP://IdP.Example.Com").is_err());
        // Hosts that merely *start with* a loopback name are ordinary
        // internet hosts. A prefix check would wave all of these through.
        for impostor in [
            "http://localhost.evil.test",
            "http://127.0.0.1.evil.test",
            "http://localhost@evil.test/",
            "http://localhosts",
        ] {
            assert!(
                require_secure_issuer(impostor).is_err(),
                "{impostor} was accepted as loopback"
            );
        }
    }

    #[test]
    fn https_and_loopback_issuers_are_allowed() {
        for ok in [
            "https://login.example.com/v2.0",
            "http://localhost:8080/realms/x",
            "http://localhost",
            "http://127.0.0.1:8080",
            "http://[::1]:8080/realms/x",
            "http://[::1]",
        ] {
            assert!(require_secure_issuer(ok).is_ok(), "{ok} was refused");
        }
    }

    /// A stored config maps onto the crate's config unchanged; a mismatch here
    /// would send the wrong client_id or redirect_uri to the provider and fail
    /// only at the far end, where the message is someone else's.
    #[test]
    fn the_stored_config_maps_onto_the_sso_crates_config() {
        let p = provider();
        let c = p.to_sso_config();
        assert_eq!(c.issuer, p.issuer);
        assert_eq!(c.client_id, p.client_id);
        assert_eq!(c.client_secret, p.client_secret);
        assert_eq!(c.redirect_uri, p.redirect_uri);
        assert_eq!(c.groups_claim, p.groups_claim);
    }
}
