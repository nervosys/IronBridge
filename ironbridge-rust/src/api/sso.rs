// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
//! SSO/SAML Authentication Module
//!
//! Provides enterprise Single Sign-On support with SAML 2.0 protocol.
//! Supports integration with identity providers like Okta, Azure AD, OneLogin, etc.

use actix_web::{web, HttpRequest, HttpResponse};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::{DateTime, Duration, Utc};
use flate2::read::DeflateDecoder;
use regex::Regex;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::Read;
use std::sync::OnceLock;
use uuid::Uuid;

use super::audit::Database;
use super::auth::{AuthResponse, Claims, PublicUser, SubscriptionTier, User};

// =============================================================================
// SSO Configuration
// =============================================================================

/// SAML Identity Provider configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SamlIdpConfig {
    /// Unique identifier for this IdP
    pub id: String,
    /// Display name (e.g., "Okta", "Azure AD")
    pub name: String,
    /// Entity ID of the Identity Provider
    pub entity_id: String,
    /// SSO URL for SAML requests
    pub sso_url: String,
    /// Single Logout URL (optional)
    pub slo_url: Option<String>,
    /// X.509 certificate for signature validation (PEM format)
    pub certificate: String,
    /// Whether this IdP is enabled
    pub enabled: bool,
    /// Email domains routed to this IdP (e.g. `["example.com"]`).
    ///
    /// `handle_callback` resolves an IdP from the assertion's email domain, so
    /// without this there is nothing to match on. Defaulted so existing stored
    /// configurations continue to deserialize.
    #[serde(default)]
    pub domains: Vec<String>,
    /// Organization/tenant ID this IdP is associated with
    pub organization_id: Option<String>,
    /// Attribute mappings (IdP attribute -> IronBridge field)
    pub attribute_mappings: AttributeMappings,
    /// Default subscription tier for users from this IdP
    pub default_tier: SubscriptionTier,
    /// Whether to auto-provision users on first login
    pub auto_provision: bool,
    /// Created timestamp
    pub created_at: i64,
    /// Updated timestamp
    pub updated_at: i64,
}

/// Attribute mappings from IdP to IronBridge user fields
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AttributeMappings {
    /// Attribute containing the user's email
    pub email: String,
    /// Attribute containing the user's display name
    pub display_name: String,
    /// Attribute containing the user's first name (optional)
    pub first_name: Option<String>,
    /// Attribute containing the user's last name (optional)
    pub last_name: Option<String>,
    /// Attribute containing the user's groups (optional)
    pub groups: Option<String>,
    /// Attribute containing the user's department (optional)
    pub department: Option<String>,
}

impl Default for SamlIdpConfig {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name: String::new(),
            entity_id: String::new(),
            sso_url: String::new(),
            slo_url: None,
            certificate: String::new(),
            enabled: false,
            domains: Vec::new(),
            organization_id: None,
            attribute_mappings: AttributeMappings {
                email: "email".to_string(),
                display_name: "displayName".to_string(),
                first_name: Some("firstName".to_string()),
                last_name: Some("lastName".to_string()),
                groups: Some("groups".to_string()),
                department: None,
            },
            default_tier: SubscriptionTier::Enterprise,
            auto_provision: true,
            created_at: Utc::now().timestamp(),
            updated_at: Utc::now().timestamp(),
        }
    }
}

// =============================================================================
// SAML Service Provider Configuration
// =============================================================================

/// Service Provider (IronBridge) configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SamlSpConfig {
    /// Entity ID of IronBridge as a Service Provider
    pub entity_id: String,
    /// Assertion Consumer Service URL
    pub acs_url: String,
    /// Single Logout URL
    pub slo_url: String,
    /// X.509 certificate for signing (PEM format)
    pub certificate: String,
    /// Private key for signing (PEM format, encrypted)
    #[serde(skip_serializing)]
    pub private_key: String,
    /// Name ID format preference
    pub name_id_format: NameIdFormat,
    /// Whether to sign authentication requests
    pub sign_requests: bool,
    /// Whether to require signed assertions
    pub require_signed_assertions: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
pub enum NameIdFormat {
    #[default]
    EmailAddress,
    Persistent,
    Transient,
    Unspecified,
}

impl NameIdFormat {
    pub fn as_urn(&self) -> &'static str {
        match self {
            Self::EmailAddress => "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
            Self::Persistent => "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
            Self::Transient => "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
            Self::Unspecified => "urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified",
        }
    }
}

// =============================================================================
// SAML Request/Response Types
// =============================================================================

/// SAML Authentication Request
#[derive(Debug, Clone)]
pub struct SamlAuthnRequest {
    pub id: String,
    pub issue_instant: String,
    pub destination: String,
    pub issuer: String,
    pub acs_url: String,
    pub name_id_format: NameIdFormat,
}

impl SamlAuthnRequest {
    pub fn new(sp_config: &SamlSpConfig, idp_config: &SamlIdpConfig) -> Self {
        Self {
            id: format!("_{}", Uuid::new_v4()),
            issue_instant: Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
            destination: idp_config.sso_url.clone(),
            issuer: sp_config.entity_id.clone(),
            acs_url: sp_config.acs_url.clone(),
            name_id_format: sp_config.name_id_format,
        }
    }

    /// Generate SAML AuthnRequest XML
    pub fn to_xml(&self) -> String {
        format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest
    xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
    ID="{id}"
    Version="2.0"
    IssueInstant="{issue_instant}"
    Destination="{destination}"
    AssertionConsumerServiceURL="{acs_url}"
    ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
    <saml:Issuer>{issuer}</saml:Issuer>
    <samlp:NameIDPolicy
        Format="{name_id_format}"
        AllowCreate="true"/>
</samlp:AuthnRequest>"#,
            id = self.id,
            issue_instant = self.issue_instant,
            destination = self.destination,
            acs_url = self.acs_url,
            issuer = self.issuer,
            name_id_format = self.name_id_format.as_urn(),
        )
    }

    /// Encode request for HTTP-Redirect binding (deflate + base64 + URL encode)
    pub fn encode_redirect(&self) -> String {
        use flate2::write::DeflateEncoder;
        use flate2::Compression;
        use std::io::Write;

        let xml = self.to_xml();
        let mut encoder = DeflateEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(xml.as_bytes()).unwrap();
        let compressed = encoder.finish().unwrap();
        let encoded = BASE64.encode(&compressed);
        urlencoding::encode(&encoded).to_string()
    }
}

/// Parsed SAML Response
#[derive(Debug, Clone)]
pub struct SamlResponse {
    pub id: String,
    pub in_response_to: String,
    pub status: SamlStatus,
    pub issuer: String,
    pub assertion: Option<SamlAssertion>,
}

#[derive(Debug, Clone)]
pub struct SamlAssertion {
    pub id: String,
    pub issuer: String,
    pub subject: SamlSubject,
    pub conditions: SamlConditions,
    pub attributes: HashMap<String, Vec<String>>,
    pub authn_statement: SamlAuthnStatement,
}

#[derive(Debug, Clone)]
pub struct SamlSubject {
    pub name_id: String,
    pub name_id_format: String,
}

#[derive(Debug, Clone)]
pub struct SamlConditions {
    pub not_before: String,
    pub not_on_or_after: String,
    pub audience: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct SamlAuthnStatement {
    pub authn_instant: String,
    pub session_index: Option<String>,
    pub session_not_on_or_after: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum SamlStatus {
    Success,
    Requester,
    Responder,
    VersionMismatch,
    AuthnFailed,
    Unknown(String),
}

// =============================================================================
// SSO Session State
// =============================================================================

/// Pending SSO request state (stored temporarily during auth flow)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SsoRequestState {
    pub request_id: String,
    pub idp_id: String,
    pub relay_state: Option<String>,
    pub created_at: i64,
    pub expires_at: i64,
}

/// SSO Session (linked to user session)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SsoSession {
    pub id: String,
    pub user_id: String,
    pub idp_id: String,
    pub name_id: String,
    pub session_index: Option<String>,
    pub created_at: i64,
    pub expires_at: i64,
}

// =============================================================================
// API Request/Response Types
// =============================================================================

#[derive(Debug, Deserialize)]
pub struct InitiateSsoRequest {
    /// IdP ID or organization identifier
    pub idp_id: Option<String>,
    /// Email domain for IdP discovery
    pub email_domain: Option<String>,
    /// Relay state (return URL after auth)
    pub relay_state: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct InitiateSsoResponse {
    /// URL to redirect user to for SSO
    pub redirect_url: String,
    /// Request ID for tracking
    pub request_id: String,
}

#[derive(Debug, Deserialize)]
pub struct SamlCallbackRequest {
    /// Base64-encoded SAML Response
    #[serde(rename = "SAMLResponse")]
    pub saml_response: String,
    /// Relay state from original request
    #[serde(rename = "RelayState")]
    pub relay_state: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateIdpRequest {
    pub name: String,
    pub entity_id: String,
    pub sso_url: String,
    pub slo_url: Option<String>,
    pub certificate: String,
    pub organization_id: Option<String>,
    pub attribute_mappings: Option<AttributeMappings>,
    pub auto_provision: Option<bool>,
    /// Email domains to route to this IdP. Optional so existing callers keep
    /// working, but an IdP with none can only be reached by explicit id.
    #[serde(default)]
    pub domains: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateIdpRequest {
    pub name: Option<String>,
    pub sso_url: Option<String>,
    pub slo_url: Option<String>,
    pub certificate: Option<String>,
    pub enabled: Option<bool>,
    pub attribute_mappings: Option<AttributeMappings>,
    pub auto_provision: Option<bool>,
}

// =============================================================================
// SSO Service
// =============================================================================

pub struct SsoService {
    db: Database,
    sp_config: SamlSpConfig,
}

impl SsoService {
    pub fn new(db: Database, base_url: &str) -> Self {
        let sp_config = SamlSpConfig {
            entity_id: format!("{}/saml/metadata", base_url),
            acs_url: format!("{}/api/sso/callback", base_url),
            slo_url: format!("{}/api/sso/logout", base_url),
            certificate: String::new(), // Would be loaded from config
            private_key: String::new(), // Would be loaded from config
            name_id_format: NameIdFormat::EmailAddress,
            sign_requests: false,
            require_signed_assertions: true,
        };

        Self { db, sp_config }
    }

    /// Get IdP configuration by ID
    pub async fn get_idp(&self, idp_id: &str) -> Result<Option<SamlIdpConfig>, String> {
        self.db
            .get_sso_idp(idp_id)
            .map_err(|e| format!("Database error: {}", e))
    }

    /// Get IdP by email domain (for domain-based discovery)
    pub async fn get_idp_by_domain(&self, domain: &str) -> Result<Option<SamlIdpConfig>, String> {
        self.db
            .get_sso_idp_by_domain(domain)
            .map_err(|e| format!("Database error: {}", e))
    }

    /// List all configured IdPs
    pub async fn list_idps(
        &self,
        organization_id: Option<&str>,
    ) -> Result<Vec<SamlIdpConfig>, String> {
        self.db
            .list_sso_idps(organization_id)
            .map_err(|e| format!("Database error: {}", e))
    }

    /// Create a new IdP configuration
    pub async fn create_idp(&self, request: CreateIdpRequest) -> Result<SamlIdpConfig, String> {
        let idp = SamlIdpConfig {
            id: Uuid::new_v4().to_string(),
            name: request.name,
            entity_id: request.entity_id,
            sso_url: request.sso_url,
            slo_url: request.slo_url,
            certificate: request.certificate,
            enabled: true,
            domains: request.domains.unwrap_or_default(),
            organization_id: request.organization_id,
            attribute_mappings: request.attribute_mappings.unwrap_or_default(),
            default_tier: SubscriptionTier::Enterprise,
            auto_provision: request.auto_provision.unwrap_or(true),
            created_at: Utc::now().timestamp(),
            updated_at: Utc::now().timestamp(),
        };

        self.db
            .create_sso_idp(&idp)
            .map_err(|e| format!("Failed to create IdP: {}", e))?;

        Ok(idp)
    }

    /// Update an IdP configuration
    pub async fn update_idp(
        &self,
        idp_id: &str,
        request: UpdateIdpRequest,
    ) -> Result<SamlIdpConfig, String> {
        let mut idp = self.get_idp(idp_id).await?.ok_or("IdP not found")?;

        if let Some(name) = request.name {
            idp.name = name;
        }
        if let Some(sso_url) = request.sso_url {
            idp.sso_url = sso_url;
        }
        if let Some(slo_url) = request.slo_url {
            idp.slo_url = Some(slo_url);
        }
        if let Some(certificate) = request.certificate {
            idp.certificate = certificate;
        }
        if let Some(enabled) = request.enabled {
            idp.enabled = enabled;
        }
        if let Some(attribute_mappings) = request.attribute_mappings {
            idp.attribute_mappings = attribute_mappings;
        }
        if let Some(auto_provision) = request.auto_provision {
            idp.auto_provision = auto_provision;
        }

        idp.updated_at = Utc::now().timestamp();

        self.db
            .update_sso_idp(&idp)
            .map_err(|e| format!("Failed to update IdP: {}", e))?;

        Ok(idp)
    }

    /// Delete an IdP configuration
    pub async fn delete_idp(&self, idp_id: &str) -> Result<(), String> {
        self.db
            .delete_sso_idp(idp_id)
            .map_err(|e| format!("Failed to delete IdP: {}", e))
    }

    /// Initiate SSO login flow
    pub async fn initiate_sso(
        &self,
        request: InitiateSsoRequest,
    ) -> Result<InitiateSsoResponse, String> {
        // Find the IdP
        let idp = if let Some(idp_id) = &request.idp_id {
            self.get_idp(idp_id).await?
        } else if let Some(domain) = &request.email_domain {
            self.get_idp_by_domain(domain).await?
        } else {
            return Err("Must provide either idp_id or email_domain".to_string());
        };

        let idp = idp.ok_or("IdP not found")?;

        if !idp.enabled {
            return Err("IdP is disabled".to_string());
        }

        // Generate SAML AuthnRequest
        let authn_request = SamlAuthnRequest::new(&self.sp_config, &idp);
        let encoded_request = authn_request.encode_redirect();

        // Store request state
        let state = SsoRequestState {
            request_id: authn_request.id.clone(),
            idp_id: idp.id.clone(),
            relay_state: request.relay_state.clone(),
            created_at: Utc::now().timestamp(),
            expires_at: (Utc::now() + Duration::minutes(10)).timestamp(),
        };

        self.db
            .store_sso_request_state(&state)
            .map_err(|e| format!("Failed to store request state: {}", e))?;

        // Build redirect URL
        let mut redirect_url = idp.sso_url.clone();
        redirect_url.push_str(if redirect_url.contains('?') { "&" } else { "?" });
        redirect_url.push_str("SAMLRequest=");
        redirect_url.push_str(&encoded_request);

        if let Some(relay_state) = &request.relay_state {
            redirect_url.push_str("&RelayState=");
            redirect_url.push_str(&urlencoding::encode(relay_state));
        }

        Ok(InitiateSsoResponse {
            redirect_url,
            request_id: authn_request.id,
        })
    }

    /// Handle SAML callback (Assertion Consumer Service)
    pub async fn handle_callback(
        &self,
        request: SamlCallbackRequest,
    ) -> Result<AuthResponse, String> {
        // Decode SAML Response
        let response_xml = BASE64
            .decode(&request.saml_response)
            .map_err(|e| format!("Invalid base64: {}", e))?;

        let response_str =
            String::from_utf8(response_xml).map_err(|e| format!("Invalid UTF-8: {}", e))?;

        // Selecting which IdP to check against necessarily reads the untrusted
        // document, because the certificate is not known until the issuer is.
        // This is safe on its own: naming an IdP only chooses whose public key
        // must validate the signature, and a wrong or attacker-chosen guess
        // makes verification fail below. Nothing from `unverified` is allowed
        // to reach the session.
        // Status lives in the response envelope, which assertion-level signing
        // leaves outside the signed region. Read it here, from the document
        // that still has it; see `extract_status` for why that is safe.
        let status = Self::extract_status(&response_str);

        let unverified = self.parse_saml_response(&response_str, status.clone())?;
        let unverified_assertion = unverified
            .assertion
            .as_ref()
            .ok_or("No assertion in response")?;

        let idp = self
            .get_idp_by_domain(&self.extract_domain(&unverified_assertion.subject.name_id))
            .await?
            .ok_or("IdP not found")?;

        // Authenticity boundary. Everything above is attacker-supplied. The
        // reduced document contains only what the IdP actually signed, so the
        // response is re-parsed from it and `unverified` is dropped -- see
        // `verify_and_reduce` for why re-reading the original would reintroduce
        // an XML Signature Wrapping bypass.
        // `InResponseTo` lives in the Response envelope, which some IdPs sign
        // and some leave outside the signed Assertion -- so it is read from the
        // envelope here, before verification reduces the document. That is safe
        // for anti-replay: its only use is to look up a stored `request_id`, a
        // random UUID an attacker cannot produce, and the assertion's contents
        // are still authenticated by the signature below.
        let in_response_to = unverified.in_response_to.clone();

        let verified_xml = Self::verify_and_reduce(&response_str, &idp)?;
        drop(unverified);

        let saml_response = self.parse_saml_response(&verified_xml, status)?;

        if saml_response.status != SamlStatus::Success {
            return Err(format!(
                "SAML authentication failed: {:?}",
                saml_response.status
            ));
        }

        let assertion = saml_response.assertion.ok_or("No signed assertion")?;

        // Validate the signed assertion's time window.
        Self::validate_assertion(&assertion)?;

        // Anti-replay / solicited-response binding. The response must name a
        // request this SP actually issued (`InResponseTo` == a stored
        // `request_id`), and consuming that state makes acceptance one-time: a
        // replayed response finds it already gone, and an unsolicited one names
        // an id that was never stored. The `request_id` is an unguessable random
        // UUID, so even though `InResponseTo` rides in the response envelope, an
        // attacker cannot fabricate one that matches a pending request.
        if in_response_to.is_empty() {
            return Err(
                "SAML response has no InResponseTo; unsolicited responses are refused".into(),
            );
        }
        if self
            .db
            .take_sso_request_state(&in_response_to)
            .map_err(|e| format!("Failed to consume SSO request state: {}", e))?
            .is_none()
        {
            return Err(
                "SAML response does not match a pending request (replayed, expired or unsolicited)"
                    .into(),
            );
        }

        // Extract user attributes
        let email = self
            .get_attribute(&assertion, &idp.attribute_mappings.email)
            .or_else(|| Some(assertion.subject.name_id.clone()))
            .ok_or("Email not found in assertion")?;

        let display_name = self
            .get_attribute(&assertion, &idp.attribute_mappings.display_name)
            .unwrap_or_else(|| email.split('@').next().unwrap_or(&email).to_string());

        // Find or create user
        let user = self
            .find_or_create_user(&idp, &email, &display_name)
            .await?;

        // Create SSO session
        let sso_session = SsoSession {
            id: Uuid::new_v4().to_string(),
            user_id: user.id.clone(),
            idp_id: idp.id.clone(),
            name_id: assertion.subject.name_id.clone(),
            session_index: assertion.authn_statement.session_index.clone(),
            created_at: Utc::now().timestamp(),
            expires_at: (Utc::now() + Duration::hours(24)).timestamp(),
        };

        self.db
            .store_sso_session(&sso_session)
            .map_err(|e| format!("Failed to store SSO session: {}", e))?;

        // Generate JWT tokens
        let access_token = super::auth::generate_access_token(&user)
            .ok_or_else(|| "Failed to generate access token".to_string())?;
        let refresh_token = super::auth::generate_refresh_token(&user)
            .ok_or_else(|| "Failed to generate refresh token".to_string())?;

        Ok(AuthResponse {
            user: user.into(),
            access_token,
            refresh_token,
            expires_in: 24 * 60 * 60, // 24 hours
        })
    }

    /// Generate SP metadata XML
    pub fn generate_metadata(&self) -> String {
        format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor
    xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
    entityID="{entity_id}">
    <SPSSODescriptor
        AuthnRequestsSigned="{sign_requests}"
        WantAssertionsSigned="{require_signed}"
        protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
        <NameIDFormat>{name_id_format}</NameIDFormat>
        <AssertionConsumerService
            Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
            Location="{acs_url}"
            index="0"
            isDefault="true"/>
        <SingleLogoutService
            Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
            Location="{slo_url}"/>
    </SPSSODescriptor>
    <Organization>
        <OrganizationName xml:lang="en">IronBridge</OrganizationName>
        <OrganizationDisplayName xml:lang="en">IronBridge - Chat Session Manager</OrganizationDisplayName>
        <OrganizationURL xml:lang="en">https://github.com/nervosys/IronBridge</OrganizationURL>
    </Organization>
</EntityDescriptor>"#,
            entity_id = self.sp_config.entity_id,
            sign_requests = self.sp_config.sign_requests,
            require_signed = self.sp_config.require_signed_assertions,
            name_id_format = self.sp_config.name_id_format.as_urn(),
            acs_url = self.sp_config.acs_url,
            slo_url = self.sp_config.slo_url,
        )
    }

    // Helper methods

    /// Read the `<samlp:Status>` code out of a response envelope.
    ///
    /// Separated from [`Self::parse_saml_response`] because the two are read
    /// from *different documents*, and conflating them broke every login
    /// against an IdP that signs the assertion rather than the whole response
    /// -- which is Okta's and Entra's default.
    ///
    /// When the signature covers only the `<saml:Assertion>`, the reduced
    /// document handed back by [`Self::verify_and_reduce`] is that assertion,
    /// and `<samlp:Status>` sits outside it in the envelope that was discarded.
    /// Reading status from the reduced document therefore found nothing and
    /// yielded `Unknown`, which the caller rejects.
    ///
    /// Taking it from the unverified envelope is sound because status is not
    /// what authenticates anyone. The assertion is: it must still be present
    /// and must still have survived signature verification. An attacker who
    /// rewrites `Status` to Success without a validly signed assertion gets
    /// "No signed assertion"; one who *has* a validly signed assertion did not
    /// need to touch `Status` at all.
    fn extract_status(xml: &str) -> SamlStatus {
        if xml.contains("urn:oasis:names:tc:SAML:2.0:status:Success") {
            SamlStatus::Success
        } else if xml.contains("urn:oasis:names:tc:SAML:2.0:status:Requester") {
            SamlStatus::Requester
        } else if xml.contains("urn:oasis:names:tc:SAML:2.0:status:Responder") {
            SamlStatus::Responder
        } else if xml.contains("AuthnFailed") {
            SamlStatus::AuthnFailed
        } else {
            SamlStatus::Unknown("Unknown status".to_string())
        }
    }

    /// Extract the fields IronBridge needs from a SAML document.
    ///
    /// Deliberately a narrow string scan rather than a full XML parse. It runs
    /// on the signature-reduced document -- see [`Self::verify_and_reduce`] --
    /// where every element is one the IdP signed, so there are no unsigned
    /// siblings to be confused by and no wrapping attack to defend against
    /// here. The defence lives at the reduction step, not in this function.
    ///
    /// Note that `status` is *not* read here; see [`Self::extract_status`].
    fn parse_saml_response(&self, xml: &str, status: SamlStatus) -> Result<SamlResponse, String> {
        let id = Self::extract_xml_attr(xml, "Response", "ID").unwrap_or_default();
        let in_response_to =
            Self::extract_xml_attr(xml, "Response", "InResponseTo").unwrap_or_default();
        let issuer = Self::extract_xml_element(xml, "Issuer").unwrap_or_default();

        // Parse assertion if present
        let assertion = if xml.contains("<saml:Assertion") || xml.contains("<Assertion") {
            Some(self.parse_assertion(xml)?)
        } else {
            None
        };

        Ok(SamlResponse {
            id,
            in_response_to,
            status,
            issuer,
            assertion,
        })
    }

    fn parse_assertion(&self, xml: &str) -> Result<SamlAssertion, String> {
        let id = Self::extract_xml_attr(xml, "Assertion", "ID").unwrap_or_default();
        let issuer = Self::extract_xml_element(xml, "Issuer").unwrap_or_default();

        // Extract NameID
        let name_id = Self::extract_xml_element(xml, "NameID").ok_or("NameID not found")?;
        let name_id_format = Self::extract_xml_attr(xml, "NameID", "Format").unwrap_or_default();

        // Extract conditions
        let not_before = Self::extract_xml_attr(xml, "Conditions", "NotBefore").unwrap_or_default();
        let not_on_or_after =
            Self::extract_xml_attr(xml, "Conditions", "NotOnOrAfter").unwrap_or_default();

        // Extract attributes (simplified)
        let attributes = Self::parse_attributes(xml);

        // Extract authn statement
        let authn_instant =
            Self::extract_xml_attr(xml, "AuthnStatement", "AuthnInstant").unwrap_or_default();
        let session_index = Self::extract_xml_attr(xml, "AuthnStatement", "SessionIndex");

        Ok(SamlAssertion {
            id,
            issuer,
            subject: SamlSubject {
                name_id,
                name_id_format,
            },
            conditions: SamlConditions {
                not_before,
                not_on_or_after,
                audience: vec![],
            },
            attributes,
            authn_statement: SamlAuthnStatement {
                authn_instant,
                session_index,
                session_not_on_or_after: None,
            },
        })
    }

    /// Extract `<Attribute Name="...">` elements and their `<AttributeValue>`
    /// children into a name -> values map.
    ///
    /// Namespace prefixes (`saml:Attribute`, `saml2:AttributeValue`, ...) are
    /// tolerated. This is a pragmatic extractor, not a conforming XML parser;
    /// it is only ever reached for content that [`Self::verify_and_reduce`] has
    /// already cut down to signed material, so a hostile document cannot reach
    /// it with unsigned elements intact.
    fn parse_attributes(xml: &str) -> HashMap<String, Vec<String>> {
        static ATTRIBUTE_BLOCK: OnceLock<Regex> = OnceLock::new();
        static ATTRIBUTE_VALUE: OnceLock<Regex> = OnceLock::new();

        let block_re = ATTRIBUTE_BLOCK.get_or_init(|| {
            Regex::new(
                r#"(?is)<(?:[A-Za-z0-9_.-]+:)?Attribute\b[^>]*\bName="([^"]*)"[^>]*>(.*?)</(?:[A-Za-z0-9_.-]+:)?Attribute>"#,
            )
            .expect("static Attribute regex is valid")
        });
        let value_re = ATTRIBUTE_VALUE.get_or_init(|| {
            Regex::new(
                r#"(?is)<(?:[A-Za-z0-9_.-]+:)?AttributeValue\b[^>]*>(.*?)</(?:[A-Za-z0-9_.-]+:)?AttributeValue>"#,
            )
            .expect("static AttributeValue regex is valid")
        });

        let mut attributes: HashMap<String, Vec<String>> = HashMap::new();
        for block in block_re.captures_iter(xml) {
            let name = block[1].to_string();
            let values: Vec<String> = value_re
                .captures_iter(&block[2])
                .map(|v| v[1].trim().to_string())
                .collect();
            attributes.entry(name).or_default().extend(values);
        }
        attributes
    }

    /// Verify the XML signature on a SAML response against the IdP certificate.
    ///
    /// Returns the *reduced* document: the subset of `response_xml` that
    /// xmlsec actually verified, with every unsigned element removed.
    ///
    /// Callers must parse the returned string and discard the input. That is
    /// the defence against XML Signature Wrapping: an attacker who wraps a
    /// legitimately signed assertion alongside a forged one still produces a
    /// valid signature over the genuine fragment, so a checker that verifies
    /// the document and then re-reads the *original* will happily consume the
    /// forgery. Reducing to signed content makes the forged elements cease to
    /// exist before parsing.
    ///
    /// The reduction is what closes the hole: `verify_and_extract_signed`
    /// returns the signed element itself, so there is no original document
    /// left for a caller to re-read and no second assertion to be confused by.
    fn verify_and_reduce(response_xml: &str, idp: &SamlIdpConfig) -> Result<String, String> {
        let cert = Self::certificate_der(&idp.certificate)?;

        ironbridge_sso::saml::signature::verify_and_extract_signed(response_xml, &cert)
            .map_err(|e| format!("SAML signature verification failed: {}", e))
    }

    /// Decode the IdP's configured X.509 certificate to DER.
    ///
    /// Accepts either a PEM block or a bare base64 body, since IdP metadata
    /// exports differ on whether they include the armour.
    fn certificate_der(certificate: &str) -> Result<Vec<u8>, String> {
        if certificate.trim().is_empty() {
            return Err("IdP certificate is empty".to_string());
        }

        ironbridge_sso::saml::SamlConfig::certificate_from_pem(certificate)
            .map_err(|e| format!("Invalid IdP certificate: {}", e))
    }

    /// Validate the assertion's time window.
    ///
    /// Fails closed: a missing or unparseable `NotBefore`/`NotOnOrAfter` is
    /// treated as invalid rather than skipped, so a stripped condition cannot
    /// buy an attacker an unbounded validity window.
    fn validate_assertion(assertion: &SamlAssertion) -> Result<(), String> {
        let now = Utc::now();

        let parse = |label: &str, raw: &str| -> Result<DateTime<Utc>, String> {
            if raw.is_empty() {
                return Err(format!("Assertion is missing {}", label));
            }
            chrono::DateTime::parse_from_rfc3339(raw)
                .map(|t| t.with_timezone(&Utc))
                .map_err(|e| format!("Assertion has an unparseable {}: {}", label, e))
        };

        let not_before = parse("NotBefore", &assertion.conditions.not_before)?;
        if now < not_before {
            return Err("Assertion not yet valid".to_string());
        }

        let not_on_or_after = parse("NotOnOrAfter", &assertion.conditions.not_on_or_after)?;
        if now >= not_on_or_after {
            return Err("Assertion has expired".to_string());
        }

        if not_on_or_after <= not_before {
            return Err("Assertion validity window is empty".to_string());
        }

        Ok(())
    }

    fn get_attribute(&self, assertion: &SamlAssertion, name: &str) -> Option<String> {
        assertion
            .attributes
            .get(name)
            .and_then(|v| v.first())
            .cloned()
    }

    fn extract_domain(&self, email: &str) -> String {
        email.split('@').next_back().unwrap_or("").to_string()
    }

    async fn find_or_create_user(
        &self,
        idp: &SamlIdpConfig,
        email: &str,
        display_name: &str,
    ) -> Result<User, String> {
        // Try to find existing user
        if let Some(user) = self
            .db
            .get_user_by_email(email)
            .map_err(|e| e.to_string())?
        {
            // Update last login
            self.db
                .update_user_login(&user.id)
                .map_err(|e| e.to_string())?;
            return Ok(user);
        }

        // Auto-provision if enabled
        if !idp.auto_provision {
            return Err("User not found and auto-provisioning is disabled".to_string());
        }

        // Create new user
        let user = User {
            id: Uuid::new_v4().to_string(),
            email: email.to_string(),
            display_name: display_name.to_string(),
            password_hash: String::new(), // SSO users don't have passwords
            subscription_tier: idp.default_tier,
            subscription_expires_at: None,
            created_at: Utc::now().timestamp(),
            updated_at: Utc::now().timestamp(),
            last_login_at: Some(Utc::now().timestamp()),
            email_verified: true, // SSO users are pre-verified
            avatar_url: None,
            metadata: Some(format!(r#"{{"sso_idp":"{}"}}"#, idp.id)),
        };

        self.db.create_user(&user).map_err(|e| e.to_string())?;

        Ok(user)
    }

    // XML helper methods.
    //
    // These are deliberately regex-based rather than backed by a full XML
    // parser. They are sufficient for reading well-formed IdP responses, but
    // they are NOT a security boundary: a hostile document can defeat them.
    // Authenticity must come from [`Self::verify_and_reduce`], which is applied
    // before any of these run.

    /// Read `attr` off the first `element` start tag, tolerating namespace
    /// prefixes (`<saml:Conditions NotBefore="..."/>` matches `"Conditions"`).
    fn extract_xml_attr(xml: &str, element: &str, attr: &str) -> Option<String> {
        let pattern = format!(
            r#"(?is)<(?:[A-Za-z0-9_.-]+:)?{}\b[^>]*?\b{}="([^"]*)""#,
            regex::escape(element),
            regex::escape(attr),
        );
        let re = Regex::new(&pattern).ok()?;
        re.captures(xml).map(|c| c[1].to_string())
    }

    /// Read the text content of the first `element`, tolerating namespace
    /// prefixes (`<saml:Issuer>` matches `"Issuer"`).
    fn extract_xml_element(xml: &str, element: &str) -> Option<String> {
        let name = regex::escape(element);
        let pattern = format!(
            r#"(?is)<(?:[A-Za-z0-9_.-]+:)?{}\b[^>]*>(.*?)</(?:[A-Za-z0-9_.-]+:)?{}>"#,
            name, name,
        );
        let re = Regex::new(&pattern).ok()?;
        re.captures(xml).map(|c| c[1].trim().to_string())
    }
}

// =============================================================================
// HTTP Handlers
// =============================================================================

/// GET /api/sso/metadata - Return SP metadata XML
pub async fn get_metadata(sso_service: web::Data<SsoService>) -> HttpResponse {
    HttpResponse::Ok()
        .content_type("application/xml")
        .body(sso_service.generate_metadata())
}

/// POST /api/sso/initiate - Initiate SSO login
pub async fn initiate_sso(
    sso_service: web::Data<SsoService>,
    request: web::Json<InitiateSsoRequest>,
) -> HttpResponse {
    match sso_service.initiate_sso(request.into_inner()).await {
        Ok(response) => HttpResponse::Ok().json(response),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({ "error": e })),
    }
}

/// POST /api/sso/callback - Handle SAML callback (ACS)
pub async fn sso_callback(
    sso_service: web::Data<SsoService>,
    form: web::Form<SamlCallbackRequest>,
) -> HttpResponse {
    match sso_service.handle_callback(form.into_inner()).await {
        Ok(response) => HttpResponse::Ok().json(response),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({ "error": e })),
    }
}

/// GET /api/sso/idps - List IdP configurations (admin only)
pub async fn list_idps(
    sso_service: web::Data<SsoService>,
    query: web::Query<HashMap<String, String>>,
) -> HttpResponse {
    let org_id = query.get("organization_id").map(|s| s.as_str());
    match sso_service.list_idps(org_id).await {
        Ok(idps) => HttpResponse::Ok().json(idps),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({ "error": e })),
    }
}

/// POST /api/sso/idps - Create IdP configuration (admin only)
pub async fn create_idp(
    sso_service: web::Data<SsoService>,
    request: web::Json<CreateIdpRequest>,
) -> HttpResponse {
    match sso_service.create_idp(request.into_inner()).await {
        Ok(idp) => HttpResponse::Created().json(idp),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({ "error": e })),
    }
}

/// PUT /api/sso/idps/{idp_id} - Update IdP configuration (admin only)
pub async fn update_idp(
    sso_service: web::Data<SsoService>,
    path: web::Path<String>,
    request: web::Json<UpdateIdpRequest>,
) -> HttpResponse {
    let idp_id = path.into_inner();
    match sso_service.update_idp(&idp_id, request.into_inner()).await {
        Ok(idp) => HttpResponse::Ok().json(idp),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({ "error": e })),
    }
}

/// DELETE /api/sso/idps/{idp_id} - Delete IdP configuration (admin only)
pub async fn delete_idp(
    sso_service: web::Data<SsoService>,
    path: web::Path<String>,
) -> HttpResponse {
    let idp_id = path.into_inner();
    match sso_service.delete_idp(&idp_id).await {
        Ok(()) => HttpResponse::NoContent().finish(),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({ "error": e })),
    }
}

/// Configure SSO routes
pub fn configure_sso_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/sso")
            .route("/metadata", web::get().to(get_metadata))
            .route("/initiate", web::post().to(initiate_sso))
            .route("/callback", web::post().to(sso_callback))
            .route("/idps", web::get().to(list_idps))
            .route("/idps", web::post().to(create_idp))
            .route("/idps/{idp_id}", web::put().to(update_idp))
            .route("/idps/{idp_id}", web::delete().to(delete_idp)),
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    const RESPONSE: &str = r#"<?xml version="1.0"?>
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_resp1" InResponseTo="_req9">
  <saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">https://idp.example.com</saml:Issuer>
  <samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>
  <saml:Assertion ID="_assert7">
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">alice@example.com</saml:NameID>
    </saml:Subject>
    <saml:Conditions NotBefore="2026-01-01T00:00:00Z" NotOnOrAfter="2026-01-01T01:00:00Z"/>
    <saml:AttributeStatement>
      <saml:Attribute Name="email">
        <saml:AttributeValue>alice@example.com</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="groups">
        <saml:AttributeValue>admins</saml:AttributeValue>
        <saml:AttributeValue>engineering</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
    <saml:AuthnStatement AuthnInstant="2026-01-01T00:00:05Z" SessionIndex="_sess3"/>
  </saml:Assertion>
</samlp:Response>"#;

    fn conditions(not_before: &str, not_on_or_after: &str) -> SamlAssertion {
        SamlAssertion {
            id: "a".into(),
            issuer: "i".into(),
            subject: SamlSubject {
                name_id: "alice@example.com".into(),
                name_id_format: String::new(),
            },
            conditions: SamlConditions {
                not_before: not_before.into(),
                not_on_or_after: not_on_or_after.into(),
                audience: vec![],
            },
            attributes: HashMap::new(),
            authn_statement: SamlAuthnStatement {
                authn_instant: String::new(),
                session_index: None,
                session_not_on_or_after: None,
            },
        }
    }

    // -- XML extraction ----------------------------------------------------

    #[test]
    fn extracts_attributes_through_namespace_prefixes() {
        assert_eq!(
            SsoService::extract_xml_attr(RESPONSE, "Response", "ID").as_deref(),
            Some("_resp1")
        );
        assert_eq!(
            SsoService::extract_xml_attr(RESPONSE, "Assertion", "ID").as_deref(),
            Some("_assert7")
        );
        assert_eq!(
            SsoService::extract_xml_attr(RESPONSE, "Conditions", "NotOnOrAfter").as_deref(),
            Some("2026-01-01T01:00:00Z")
        );
        assert_eq!(
            SsoService::extract_xml_attr(RESPONSE, "AuthnStatement", "SessionIndex").as_deref(),
            Some("_sess3")
        );
    }

    #[test]
    fn missing_attribute_yields_none() {
        assert_eq!(
            SsoService::extract_xml_attr(RESPONSE, "Conditions", "Nope"),
            None
        );
        assert_eq!(SsoService::extract_xml_attr(RESPONSE, "Absent", "ID"), None);
    }

    #[test]
    fn extracts_element_text_through_namespace_prefixes() {
        assert_eq!(
            SsoService::extract_xml_element(RESPONSE, "Issuer").as_deref(),
            Some("https://idp.example.com")
        );
        assert_eq!(
            SsoService::extract_xml_element(RESPONSE, "NameID").as_deref(),
            Some("alice@example.com")
        );
    }

    #[test]
    fn parses_multi_valued_attribute_statements() {
        let attrs = SsoService::parse_attributes(RESPONSE);
        assert_eq!(
            attrs.get("email").map(Vec::as_slice),
            Some(["alice@example.com".to_string()].as_slice())
        );
        assert_eq!(
            attrs.get("groups").map(Vec::as_slice),
            Some(["admins".to_string(), "engineering".to_string()].as_slice())
        );
    }

    // -- Assertion validity window: fails closed ---------------------------

    #[test]
    fn rejects_assertion_with_missing_conditions() {
        // Regression: empty conditions used to skip the check and return Ok,
        // giving a stripped-condition assertion an unbounded validity window.
        let err = SsoService::validate_assertion(&conditions("", "")).unwrap_err();
        assert!(err.contains("NotBefore"), "unexpected error: {err}");
    }

    #[test]
    fn rejects_assertion_with_unparseable_conditions() {
        let err =
            SsoService::validate_assertion(&conditions("not-a-date", "also-not")).unwrap_err();
        assert!(err.contains("unparseable"), "unexpected error: {err}");
    }

    #[test]
    fn rejects_expired_assertion() {
        let err = SsoService::validate_assertion(&conditions(
            "2020-01-01T00:00:00Z",
            "2020-01-01T01:00:00Z",
        ))
        .unwrap_err();
        assert_eq!(err, "Assertion has expired");
    }

    #[test]
    fn rejects_not_yet_valid_assertion() {
        let start = Utc::now() + Duration::hours(1);
        let end = Utc::now() + Duration::hours(2);
        let err =
            SsoService::validate_assertion(&conditions(&start.to_rfc3339(), &end.to_rfc3339()))
                .unwrap_err();
        assert_eq!(err, "Assertion not yet valid");
    }

    #[test]
    fn accepts_assertion_inside_validity_window() {
        let start = Utc::now() - Duration::minutes(5);
        let end = Utc::now() + Duration::minutes(5);
        assert!(SsoService::validate_assertion(&conditions(
            &start.to_rfc3339(),
            &end.to_rfc3339()
        ))
        .is_ok());
    }

    #[test]
    fn rejects_empty_validity_window() {
        let t = Utc::now() - Duration::minutes(5);
        let err = SsoService::validate_assertion(&conditions(&t.to_rfc3339(), &t.to_rfc3339()))
            .unwrap_err();
        // NotOnOrAfter == NotBefore means the window is already closed.
        assert_eq!(err, "Assertion has expired");
    }
}

/// Signature-verification tests.
///
/// These cover the authentication boundary in `handle_callback`: a SAML
/// response is only trustworthy after `verify_and_reduce` has cut it down to
/// what the IdP actually signed. They use a throwaway RSA keypair generated by
/// `tests/fixtures/genkeys.sh` -- test-only credentials that grant nothing.
#[cfg(test)]
mod signature_tests {
    use super::*;

    const TEST_KEY_B64: &str = include_str!("../../tests/fixtures/saml_test_key.b64");
    const TEST_CERT_B64: &str = include_str!("../../tests/fixtures/saml_test_cert.b64");
    /// An unrelated IdP certificate, for proving the trust anchor is enforced.
    const OTHER_CERT_B64: &str = include_str!("../../tests/fixtures/saml_other_cert.b64");

    fn private_key_der() -> Vec<u8> {
        BASE64
            .decode(TEST_KEY_B64.trim())
            .expect("test key fixture is valid base64")
    }

    /// The same fixture key, as something that can sign.
    ///
    /// The fixtures are unchanged by the move off samael: the certificate and
    /// key are the same bytes as before, so these tests still exercise the
    /// signature format a real IdP produces, only verified by a different
    /// implementation.
    fn test_key() -> rsa::RsaPrivateKey {
        ironbridge_sso::saml::sign::private_key_from_der(&private_key_der())
            .expect("test key fixture is a usable RSA key")
    }

    fn idp() -> SamlIdpConfig {
        SamlIdpConfig {
            id: "test".into(),
            name: "Test IdP".into(),
            entity_id: "https://idp.example.com".into(),
            sso_url: "https://idp.example.com/sso".into(),
            slo_url: None,
            certificate: TEST_CERT_B64.trim().to_string(),
            enabled: true,
            organization_id: None,
            auto_provision: true,
            ..Default::default()
        }
    }

    /// A SAML response whose Assertion carries an enveloped-signature template
    /// for xmlsec to fill in.
    fn unsigned_response(email: &str) -> String {
        // `r##"..."##`: the signature template contains `URI="#_assert7"`, and
        // the `"#` in that would close an `r#"..."#` literal early.
        format!(
            r##"<?xml version="1.0"?>
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="_resp1">
  <saml:Issuer>https://idp.example.com</saml:Issuer>
  <samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>
  <saml:Assertion ID="_assert7">
    <saml:Issuer>https://idp.example.com</saml:Issuer>
    <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
      <ds:SignedInfo>
        <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
        <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
        <ds:Reference URI="#_assert7">
          <ds:Transforms>
            <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
            <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
          </ds:Transforms>
          <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
          <ds:DigestValue></ds:DigestValue>
        </ds:Reference>
      </ds:SignedInfo>
      <ds:SignatureValue></ds:SignatureValue>
      <ds:KeyInfo><ds:X509Data><ds:X509Certificate></ds:X509Certificate></ds:X509Data></ds:KeyInfo>
    </ds:Signature>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">{email}</saml:NameID>
    </saml:Subject>
    <saml:Conditions NotBefore="2020-01-01T00:00:00Z" NotOnOrAfter="2099-01-01T00:00:00Z"/>
    <saml:AttributeStatement>
      <saml:Attribute Name="email">
        <saml:AttributeValue>{email}</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>"##
        )
    }

    fn signed_response(email: &str) -> String {
        // `_assert7`, not `_resp1`: the fixture's template carries
        // `Reference URI="#_assert7"`, so the assertion is what the signature
        // claims to cover. Signing the enclosing Response instead produces a
        // digest over the wrong element and fails verification -- correctly.
        ironbridge_sso::saml::sign::sign_enveloped(&unsigned_response(email), "_assert7", &test_key())
            .expect("signing the test response should succeed")
    }

    #[test]
    fn accepts_a_correctly_signed_response() {
        let signed = signed_response("alice@example.com");

        let reduced = SsoService::verify_and_reduce(&signed, &idp())
            .expect("a response signed by the IdP key must verify");

        assert!(
            reduced.contains("alice@example.com"),
            "verified content should retain the signed subject"
        );
    }

    #[test]
    fn rejects_a_tampered_response() {
        // Flip the email after signing. The digest over the assertion no longer
        // matches, so verification must fail rather than trust the content.
        let tampered =
            signed_response("alice@example.com").replace("alice@example.com", "attacker@evil.com");

        assert!(
            SsoService::verify_and_reduce(&tampered, &idp()).is_err(),
            "content modified after signing must not verify"
        );
    }

    #[test]
    fn rejects_a_signature_that_does_not_match_the_configured_certificate() {
        // The trust anchor is the certificate configured for the IdP. A
        // response signed by a different (also valid) key must be rejected,
        // otherwise anyone able to sign anything could impersonate this IdP.
        //
        // This needs a genuinely different keypair. Perturbing a byte of the
        // real certificate does not work: it corrupts that certificate's own
        // signature while leaving the embedded public key unchanged, so
        // verification still legitimately succeeds.
        let signed = signed_response("alice@example.com");

        let mut wrong = idp();
        wrong.certificate = OTHER_CERT_B64.trim().to_string();

        assert!(
            SsoService::verify_and_reduce(&signed, &wrong).is_err(),
            "a signature not matching the configured certificate must be rejected"
        );
    }

    #[test]
    fn strips_a_wrapped_forged_assertion() {
        // XML Signature Wrapping: keep the IdP's genuinely signed assertion so
        // the signature still validates, and splice in an unsigned forged one.
        // A checker that verifies the document and then re-reads the *original*
        // would find the forged assertion and authenticate the attacker.
        let signed = signed_response("alice@example.com");

        let forged = concat!(
            "<saml:Assertion ID=\"_forged\">",
            "<saml:Subject><saml:NameID>attacker@evil.com</saml:NameID></saml:Subject>",
            "<saml:Conditions NotBefore=\"2020-01-01T00:00:00Z\" ",
            "NotOnOrAfter=\"2099-01-01T00:00:00Z\"/>",
            "<saml:AttributeStatement><saml:Attribute Name=\"email\">",
            "<saml:AttributeValue>attacker@evil.com</saml:AttributeValue>",
            "</saml:Attribute></saml:AttributeStatement>",
            "</saml:Assertion>"
        );

        let anchor = "<saml:Assertion ID=\"_assert7\">";
        let wrapped = signed.replace(anchor, &format!("{forged}{anchor}"));
        assert!(
            wrapped.contains("attacker@evil.com"),
            "precondition: the wrapped document contains the forgery"
        );

        match SsoService::verify_and_reduce(&wrapped, &idp()) {
            // Either outcome is safe. What must never happen is verification
            // succeeding with the forged assertion still reachable.
            Err(_) => {}
            Ok(reduced) => {
                assert!(
                    !reduced.contains("attacker@evil.com"),
                    "reduction must drop the unsigned forged assertion; got: {reduced}"
                );
                assert!(
                    reduced.contains("alice@example.com"),
                    "reduction should keep the genuinely signed assertion"
                );
            }
        }
    }

    #[test]
    fn rejects_an_unsigned_response() {
        assert!(
            SsoService::verify_and_reduce(&unsigned_response("alice@example.com"), &idp()).is_err(),
            "a response with an unfilled signature template must not verify"
        );
    }

    #[test]
    fn rejects_an_empty_certificate() {
        let mut broken = idp();
        broken.certificate = String::new();

        let err = SsoService::verify_and_reduce(&signed_response("alice@example.com"), &broken)
            .unwrap_err();

        assert!(
            err.contains("certificate is empty"),
            "unexpected error: {err}"
        );
    }

    #[test]
    fn accepts_a_pem_armoured_certificate() {
        // IdP metadata exports differ on whether the armour is included.
        let der = BASE64.decode(TEST_CERT_B64.trim()).unwrap();
        let encoded = BASE64.encode(&der);

        let mut pem = String::from("-----BEGIN CERTIFICATE-----\n");
        for chunk in encoded.as_bytes().chunks(64) {
            pem.push_str(std::str::from_utf8(chunk).unwrap());
            pem.push('\n');
        }
        pem.push_str("-----END CERTIFICATE-----\n");

        let mut armoured = idp();
        armoured.certificate = pem;

        assert!(
            SsoService::verify_and_reduce(&signed_response("alice@example.com"), &armoured).is_ok(),
            "a PEM-armoured certificate should be accepted"
        );
    }

    /// The status check must survive signature reduction.
    ///
    /// Every other test here stops at `verify_and_reduce`. The production path
    /// keeps going: it re-parses the *reduced* document and rejects anything
    /// whose status is not Success. When the IdP signs the Assertion rather
    /// than the whole Response -- which Okta and Entra do by default -- the
    /// reduced document is the Assertion, and `<samlp:Status>` lives outside
    /// it. A status read from the reduced document is therefore absent, and a
    /// naive `contains("...Success")` fails every real login.
    #[test]
    fn status_is_read_from_the_response_not_the_reduced_assertion() {
        let signed = signed_response("alice@example.com");
        let reduced = SsoService::verify_and_reduce(&signed, &idp()).unwrap();

        assert!(
            !reduced.contains("status:Success"),
            "precondition: the signed assertion should not carry the response status"
        );

        // What the old code computed, reading status from the reduced
        // document. Anything other than Success is rejected by the caller, so
        // this is the shape of the bug: a correctly signed, entirely valid
        // login refused as "SAML authentication failed".
        assert_ne!(
            SsoService::extract_status(&reduced),
            SamlStatus::Success,
            "if this ever becomes Success the regression guard below is vacuous"
        );

        // What it computes now, reading from the envelope.
        assert_eq!(
            SsoService::extract_status(&signed),
            SamlStatus::Success,
            "status comes from the response envelope"
        );
    }

    /// Moving the status read must not weaken the thing that authenticates.
    #[test]
    fn a_success_status_without_a_signed_assertion_is_still_refused() {
        // An attacker rewriting Status to Success gains nothing: the assertion
        // is the credential, and this one is unsigned.
        let forged = unsigned_response("mallory@example.com");

        assert_eq!(
            SsoService::extract_status(&forged),
            SamlStatus::Success,
            "the forged envelope does claim success"
        );
        assert!(
            SsoService::verify_and_reduce(&forged, &idp()).is_err(),
            "but it must not survive signature verification"
        );
    }

    #[test]
    fn a_failed_authentication_is_reported_as_such() {
        let failure = r#"<?xml version="1.0"?>
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_r1">
  <samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Requester"/></samlp:Status>
</samlp:Response>"#;

        assert_eq!(SsoService::extract_status(failure), SamlStatus::Requester);
    }
}
