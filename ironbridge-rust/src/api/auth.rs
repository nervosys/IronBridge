// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
//! Authentication and Authorization Module
//!
//! Provides JWT-based authentication, user management, and subscription handling
//! for the IRONBRIDGE ecosystem (ironbridge-rust, ironbridge-web, ironbridge-app).

use actix_web::{dev::Payload, web, FromRequest, HttpMessage, HttpRequest, HttpResponse};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::future::{ready, Ready};
use uuid::Uuid;

// =============================================================================
// Configuration
// =============================================================================

/// Environment variable that supplies the JWT signing secret.
const JWT_SECRET_ENV: &str = "IRONBRIDGE_JWT_SECRET";

/// The HMAC secret that signs session tokens, resolved once per process.
///
/// - `IRONBRIDGE_JWT_SECRET` if set and at least 32 bytes: tokens then survive a
///   restart and can be shared across instances behind a load balancer.
/// - otherwise a cryptographically random 32-byte secret generated at startup.
///   Tokens are unforgeable but do not outlive the process; a restart makes
///   everyone log in again, which for a local-first tool is an inconvenience,
///   not a hole.
///
/// What it is never again: a constant compiled into the binary. The previous
/// value -- `ironbridge_jwt_secret_key_change_in_production_2024` -- shipped in the
/// public source, so anyone who read the repository could forge a valid token
/// for any user at any subscription tier. A random default closes that even
/// when the operator sets nothing.
fn jwt_secret() -> &'static [u8] {
    use std::sync::OnceLock;
    static SECRET: OnceLock<Vec<u8>> = OnceLock::new();
    SECRET.get_or_init(|| match std::env::var(JWT_SECRET_ENV) {
        Ok(s) if s.len() >= 32 => s.into_bytes(),
        Ok(s) => {
            eprintln!(
                "[WARN] {JWT_SECRET_ENV} is set but only {} bytes; a signing secret must be \
                 at least 32. Ignoring it and using a random per-process secret instead.",
                s.len()
            );
            random_secret()
        }
        Err(_) => {
            eprintln!(
                "[INFO] {JWT_SECRET_ENV} is not set; signing sessions with a random \
                 per-process secret. Sessions will not survive a restart. Set \
                 {JWT_SECRET_ENV} (>=32 bytes) to keep sessions across restarts or share \
                 them across instances."
            );
            random_secret()
        }
    })
}

fn random_secret() -> Vec<u8> {
    use rand::RngCore;
    let mut buf = vec![0u8; 32];
    rand::thread_rng().fill_bytes(&mut buf);
    buf
}

const JWT_EXPIRY_HOURS: i64 = 24;
const REFRESH_TOKEN_EXPIRY_DAYS: i64 = 30;

// =============================================================================
// Login brute-force throttle
// =============================================================================

/// After this many failed logins from one address within the window, further
/// attempts are refused until the window slides past them.
const LOGIN_MAX_FAILURES: usize = 10;
/// The sliding window for counting failures, in seconds (15 minutes).
const LOGIN_WINDOW_SECS: u64 = 900;

fn login_failures(
) -> &'static std::sync::Mutex<std::collections::HashMap<String, Vec<std::time::Instant>>> {
    use std::sync::OnceLock;
    static FAILURES: OnceLock<
        std::sync::Mutex<std::collections::HashMap<String, Vec<std::time::Instant>>>,
    > = OnceLock::new();
    FAILURES.get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()))
}

/// Whether this address has spent its failed-login budget for now.
///
/// Keyed on the socket peer address, not `X-Forwarded-For` or a body field, so
/// it cannot be reset by spoofing a header. An attacker guessing passwords is
/// slowed to `LOGIN_MAX_FAILURES` per window; a legitimate user who mistypes a
/// few times is not affected, and -- because the key is the caller's own
/// address -- no one can lock a victim out by failing *their* login.
fn login_throttled(key: &str) -> bool {
    let mut map = login_failures().lock().unwrap();
    let now = std::time::Instant::now();
    if let Some(times) = map.get_mut(key) {
        times.retain(|t| now.duration_since(*t).as_secs() < LOGIN_WINDOW_SECS);
        times.len() >= LOGIN_MAX_FAILURES
    } else {
        false
    }
}

fn record_login_failure(key: &str) {
    let mut map = login_failures().lock().unwrap();
    let now = std::time::Instant::now();
    let times = map.entry(key.to_string()).or_default();
    times.retain(|t| now.duration_since(*t).as_secs() < LOGIN_WINDOW_SECS);
    times.push(now);
}

fn clear_login_failures(key: &str) {
    login_failures().lock().unwrap().remove(key);
}

/// The throttle key: the connection's peer address (host without port).
fn throttle_key(req: &HttpRequest) -> String {
    req.peer_addr()
        .map(|a| a.ip().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

// =============================================================================
// Subscription Tiers
// =============================================================================

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
#[derive(Default)]
pub enum SubscriptionTier {
    /// Free tier - basic sync, limited features
    #[default]
    Free,
    /// Pro tier - full sync, all features, priority support
    Pro,
    /// Enterprise tier - team features, admin controls, SLA
    Enterprise,
}

impl SubscriptionTier {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Free => "free",
            Self::Pro => "pro",
            Self::Enterprise => "enterprise",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "free" => Some(Self::Free),
            "pro" => Some(Self::Pro),
            "enterprise" => Some(Self::Enterprise),
            _ => None,
        }
    }
}

// =============================================================================
// Subscription Features
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionFeatures {
    /// Maximum number of workspaces
    pub max_workspaces: Option<u32>,
    /// Maximum number of sessions
    pub max_sessions: Option<u32>,
    /// Maximum number of agents
    pub max_agents: Option<u32>,
    /// Maximum number of swarms
    pub max_swarms: Option<u32>,
    /// Real-time sync enabled
    pub realtime_sync: bool,
    /// Cross-device sync enabled
    pub cross_device_sync: bool,
    /// Priority support
    pub priority_support: bool,
    /// Team collaboration features
    pub team_collaboration: bool,
    /// Advanced analytics
    pub analytics: bool,
    /// API access
    pub api_access: bool,
    /// Custom integrations
    pub custom_integrations: bool,
}

impl SubscriptionFeatures {
    pub fn for_tier(tier: SubscriptionTier) -> Self {
        match tier {
            SubscriptionTier::Free => Self {
                max_workspaces: Some(10),
                max_sessions: Some(100),
                max_agents: Some(5),
                max_swarms: Some(1),
                realtime_sync: true,
                cross_device_sync: true,
                priority_support: false,
                team_collaboration: false,
                analytics: false,
                api_access: false,
                custom_integrations: false,
            },
            SubscriptionTier::Pro => Self {
                max_workspaces: Some(100),
                max_sessions: None, // Unlimited
                max_agents: Some(100),
                max_swarms: Some(20),
                realtime_sync: true,
                cross_device_sync: true,
                priority_support: true,
                team_collaboration: false,
                analytics: true,
                api_access: true,
                custom_integrations: false,
            },
            SubscriptionTier::Enterprise => Self {
                max_workspaces: None, // Unlimited
                max_sessions: None,
                max_agents: None,
                max_swarms: None,
                realtime_sync: true,
                cross_device_sync: true,
                priority_support: true,
                team_collaboration: true,
                analytics: true,
                api_access: true,
                custom_integrations: true,
            },
        }
    }
}

// =============================================================================
// User Model
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub email: String,
    pub display_name: String,
    #[serde(skip_serializing)]
    #[allow(dead_code)]
    pub password_hash: String,
    pub subscription_tier: SubscriptionTier,
    pub subscription_expires_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_login_at: Option<i64>,
    pub email_verified: bool,
    pub avatar_url: Option<String>,
    pub metadata: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicUser {
    pub id: String,
    pub email: String,
    pub display_name: String,
    pub subscription_tier: SubscriptionTier,
    pub subscription_expires_at: Option<i64>,
    pub created_at: i64,
    pub email_verified: bool,
    pub avatar_url: Option<String>,
    pub features: SubscriptionFeatures,
}

impl From<User> for PublicUser {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            subscription_tier: user.subscription_tier,
            subscription_expires_at: user.subscription_expires_at,
            created_at: user.created_at,
            email_verified: user.email_verified,
            avatar_url: user.avatar_url,
            features: SubscriptionFeatures::for_tier(user.subscription_tier),
        }
    }
}

// =============================================================================
// JWT Claims
// =============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    /// Subject (user ID)
    pub sub: String,
    /// Email
    pub email: String,
    /// Subscription tier
    pub tier: String,
    /// Issued at
    pub iat: i64,
    /// Expiration
    pub exp: i64,
    /// Token type (access or refresh)
    pub token_type: String,
}

// =============================================================================
// Enforcement middleware
// =============================================================================

/// Opt **out** of `/api` authentication -- for a trusted single-user machine.
pub const DISABLE_AUTH_ENV: &str = "IRONBRIDGE_DISABLE_AUTH";

/// Legacy opt-**in** switch, kept working. Once the default became "on", this
/// is redundant, but a deployment that set it should not suddenly behave
/// differently, so it is still honoured as a no-op-that-confirms-on.
pub const REQUIRE_AUTH_ENV: &str = "IRONBRIDGE_REQUIRE_AUTH";

/// Whether every `/api` route requires a valid Bearer token, resolved once.
///
/// **On by default.** The web and desktop clients present a login screen and
/// attach a token, so an authenticated API is the safe posture to ship. A
/// single-user machine that wants the old open behaviour sets
/// `IRONBRIDGE_DISABLE_AUTH=1` and takes responsibility for it -- appropriate when
/// the server is bound to loopback and nothing else can reach it.
///
/// The precedence is "secure unless explicitly told otherwise": if
/// `IRONBRIDGE_DISABLE_AUTH` is set, auth is off; otherwise it is on, whether or not
/// the old `IRONBRIDGE_REQUIRE_AUTH` is present.
///
/// When on, `require_auth` below rejects any `/api` request (except
/// `/api/health`) that does not carry a valid token.
pub fn auth_required() -> bool {
    use std::sync::OnceLock;
    static REQUIRED: OnceLock<bool> = OnceLock::new();
    *REQUIRED.get_or_init(|| {
        let disabled = std::env::var(DISABLE_AUTH_ENV)
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(false);
        !disabled
    })
}

/// Does this path need a token when enforcement is on?
///
/// Only `/api/*` is gated -- `/auth/login`, `/auth/register` and the root-level
/// scopes must stay reachable, or there would be no way to obtain a token in
/// the first place. `/api/health` is exempt so liveness probes and the client's
/// own "is the server up" check work without credentials.
/// Whether a request to this path needs a token when enforcement is on.
///
/// **Default-deny.** Everything is gated except an explicit open-list. The
/// previous version gated only `/api/`, and that was a real hole: the
/// root-mounted scopes -- `/sync` (which returns every session, workspace and
/// agent in one call), `/recording`, `/audit`, `/retention`, `/webhooks`,
/// `/graphql`, `/ws` -- were reachable with no token even while `/api` itself
/// answered 401. An allowlist cannot grow that kind of hole: a scope added
/// tomorrow is gated until someone deliberately opens it, which is the safe
/// direction to fail.
///
/// Open, and why each has to be:
/// - health/liveness needs no identity;
/// - `/auth/*` is the login handshake -- gating it removes the only way to
///   obtain a token; its own sensitive endpoints self-protect with the
///   `AuthenticatedUser` extractor;
/// - `/sso/*`, `/oidc/*` are the SSO handshake, reached before a session exists;
/// - `/docs*` is the published API reference and carries no user data.
fn path_requires_auth(path: &str) -> bool {
    const OPEN_EXACT: &[&str] = &[
        "/health",
        "/api/health",
        "/api/system/health",
        "/api/system/providers/health",
    ];
    const OPEN_PREFIXES: &[&str] = &["/auth/", "/sso/", "/oidc/", "/docs"];

    if OPEN_EXACT.contains(&path) {
        return false;
    }
    if OPEN_PREFIXES.iter().any(|p| path.starts_with(p)) {
        return false;
    }
    true
}

/// The bearer token on a request, from the `Authorization` header or, failing
/// that, a `token` query parameter.
///
/// The query parameter exists for WebSocket upgrades: a browser cannot set an
/// `Authorization` header on a `WebSocket` connection, so `/ws` has to carry
/// the token in the URL. It is a lesser channel -- URLs are logged in more
/// places than headers -- so the header is tried first and the query parameter
/// is the fallback, not the norm.
/// True when the request targets a WebSocket route -- the only endpoints that
/// legitimately carry the token in the handshake (subprotocol, or the legacy
/// query string) because a browser cannot set an `Authorization` header on a
/// `WebSocket`.
///
/// This is bound to the request *path*, not the client-settable `Upgrade`
/// header: gating on `Upgrade: websocket` would let a caller set that header on
/// an ordinary endpoint (`GET /api/sessions?token=...`) to smuggle the token in
/// the URL and have it logged -- exactly the leak this guard exists to prevent.
/// The path cannot be spoofed into hitting a non-WS handler.
fn is_websocket_route(req: &actix_web::dev::ServiceRequest) -> bool {
    matches!(req.path(), "/ws" | "/recording/ws")
}

/// The bearer token offered in the `Sec-WebSocket-Protocol` handshake header,
/// if any. Format is `bearer, <token>` (from `new WebSocket(url, ['bearer',
/// token])`). Shared with the WS handler's handshake echo so the two never
/// disagree on what counts as a bearer subprotocol.
pub(crate) fn bearer_subprotocol_token(
    headers: &actix_web::http::header::HeaderMap,
) -> Option<String> {
    headers
        .get("Sec-WebSocket-Protocol")
        .and_then(|h| h.to_str().ok())
        .and_then(|v| {
            let mut parts = v.split(',').map(|s| s.trim());
            match (parts.next(), parts.next()) {
                (Some(scheme), Some(tok)) if scheme.eq_ignore_ascii_case("bearer") => {
                    Some(tok.to_string())
                }
                _ => None,
            }
        })
}

fn request_token(req: &actix_web::dev::ServiceRequest) -> Option<AuthenticatedUser> {
    let claims = req
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .and_then(validate_token_claims)
        .or_else(|| {
            // The subprotocol / query-string token channels are *only* for the
            // WebSocket routes, where a browser cannot set an `Authorization`
            // header. Honouring them elsewhere would let a token ride in the URL
            // of an ordinary API call, where it leaks into access logs, proxy
            // logs, browser history, and the `Referer` of anything the response
            // loads. Bound to the route path (not a spoofable header).
            if !is_websocket_route(req) {
                return None;
            }
            // Preferred WS channel: the token rides in the `Sec-WebSocket-
            // Protocol` handshake header, which — unlike the URL — is not
            // written to request-line access logs.
            let from_subprotocol =
                bearer_subprotocol_token(req.headers()).and_then(|t| validate_token_claims(&t));

            from_subprotocol.or_else(|| {
                // Legacy fallback: token in the query string. Still WS-only.
                req.query_string()
                    .split('&')
                    .find_map(|pair| pair.strip_prefix("token="))
                    .and_then(|t| urlencoding::decode(t).ok())
                    .and_then(|t| validate_token_claims(&t))
            })
        })?;

    // Revocation check: the token passed signature and expiry, but may predate
    // a password change. Look up the user's cut-off when the store is reachable.
    if let Some(state) = req.app_data::<web::Data<crate::api::state::AppState>>() {
        if let Ok(db) = state.db.lock() {
            if !token_not_revoked(&db.conn, &claims.sub, claims.iat) {
                return None;
            }
        }
    }

    Some(AuthenticatedUser {
        user_id: claims.sub,
        email: claims.email,
        tier: SubscriptionTier::from_str(&claims.tier).unwrap_or_default(),
    })
}

/// Reject unauthenticated requests to gated paths. On by default;
/// `IRONBRIDGE_DISABLE_AUTH=1` is the only thing that turns it off.
///
/// A `from_fn` middleware rather than a per-handler extractor: gating every
/// route by hand is a chance to forget one on each new endpoint, and the one
/// forgotten is the hole. One default-deny gate in front of the app cannot be
/// bypassed by adding a scope.
pub async fn require_auth(
    req: actix_web::dev::ServiceRequest,
    next: actix_web::middleware::Next<impl actix_web::body::MessageBody + 'static>,
) -> Result<
    actix_web::dev::ServiceResponse<actix_web::body::EitherBody<impl actix_web::body::MessageBody>>,
    actix_web::Error,
> {
    // CORS preflight carries no credentials by design; gating it would 401 the
    // OPTIONS before the browser ever sends the real, authenticated request.
    let preflight = req.method() == actix_web::http::Method::OPTIONS;
    let gated = auth_required() && !preflight && path_requires_auth(req.path());

    let authorized = !gated || request_token(&req).is_some();

    if authorized {
        next.call(req)
            .await
            .map(actix_web::dev::ServiceResponse::map_into_left_body)
    } else {
        let (request, _payload) = req.into_parts();
        let response = HttpResponse::Unauthorized()
            .json(serde_json::json!({
                "success": false,
                "data": null,
                "error": "Authentication required. Send a valid Bearer token.",
            }))
            .map_into_right_body();
        Ok(actix_web::dev::ServiceResponse::new(request, response))
    }
}

// =============================================================================
// Auth State (for middleware)
// =============================================================================

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct AuthenticatedUser {
    pub user_id: String,
    pub email: String,
    pub tier: SubscriptionTier,
}

impl FromRequest for AuthenticatedUser {
    type Error = actix_web::Error;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _payload: &mut Payload) -> Self::Future {
        // Try to get user from request extensions (set by middleware)
        if let Some(user) = req.extensions().get::<AuthenticatedUser>() {
            return ready(Ok(user.clone()));
        }

        // Try to extract from Authorization header directly, honouring
        // revocation: a token that predates the user's last password change is
        // no longer accepted here either, matching the middleware.
        if let Some(auth_header) = req.headers().get("Authorization") {
            if let Ok(auth_str) = auth_header.to_str() {
                if let Some(token) = auth_str.strip_prefix("Bearer ") {
                    if let Some(claims) = validate_token_claims(token) {
                        let current =
                            req.app_data::<web::Data<crate::api::state::AppState>>()
                                .and_then(|state| {
                                    state.db.lock().ok().map(|db| {
                                        token_not_revoked(&db.conn, &claims.sub, claims.iat)
                                    })
                                })
                                .unwrap_or(true);
                        if current {
                            return ready(Ok(AuthenticatedUser {
                                user_id: claims.sub,
                                email: claims.email,
                                tier: SubscriptionTier::from_str(&claims.tier).unwrap_or_default(),
                            }));
                        }
                    }
                }
            }
        }

        ready(Ok(AuthenticatedUser {
            user_id: String::new(),
            email: String::new(),
            tier: SubscriptionTier::Free,
        }))
    }
}

// =============================================================================
// Request/Response Types
// =============================================================================

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub display_name: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct RefreshTokenRequest {
    pub refresh_token: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub user: PublicUser,
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Debug, Deserialize)]
pub struct UpgradeSubscriptionRequest {
    pub tier: String,
    /// Payment token from payment provider (Stripe, etc.)
    #[allow(dead_code)]
    pub payment_token: Option<String>,
}

// =============================================================================
// Helper Functions
// =============================================================================

/// Hash a password using SHA-256 with salt
/// Hash a password for storage as an Argon2id PHC string.
///
/// The algorithm, its parameters and a fresh random salt are all embedded in
/// the returned string, so it is self-describing and needs no separate salt
/// column. This replaces `Sha256(password || salt)` -- a *fast* hash a leaked
/// table could be cracked against at billions of guesses a second. Argon2id is
/// memory-hard and deliberately slow.
pub fn hash_password_argon2(password: &str) -> Result<String, String> {
    use argon2::password_hash::{rand_core::OsRng, PasswordHasher, SaltString};
    use argon2::Argon2;
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| e.to_string())
}

/// The legacy scheme: `Sha256(password || salt)`, hex-encoded.
///
/// Kept only so accounts created before the move to Argon2 can still log in --
/// and be upgraded on that login. Never used to write a new hash.
fn legacy_sha256(password: &str, salt: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hasher.update(salt.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// A length-independent-ish constant-time byte comparison for the legacy path.
///
/// Argon2 verification is already constant-time internally; this is only for
/// comparing the two hex SHA-256 strings, where the naive `==` leaks a timing
/// signal on how many leading characters matched.
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

/// Verify a password against whatever is stored, old scheme or new.
///
/// Returns `(matches, needs_upgrade)`. `needs_upgrade` is true only when the
/// match succeeded against a legacy SHA-256 hash, signalling the caller to
/// rewrite it as Argon2 -- the transparent upgrade that moves an existing
/// account off the weak hash on its next successful login, without a reset.
pub fn verify_password(password: &str, stored_hash: &str, salt: &str) -> (bool, bool) {
    if stored_hash.starts_with("$argon2") {
        use argon2::password_hash::{PasswordHash, PasswordVerifier};
        use argon2::Argon2;
        let parsed = match PasswordHash::new(stored_hash) {
            Ok(p) => p,
            Err(_) => return (false, false),
        };
        let ok = Argon2::default()
            .verify_password(password.as_bytes(), &parsed)
            .is_ok();
        (ok, false)
    } else {
        let ok = constant_time_eq(
            legacy_sha256(password, salt).as_bytes(),
            stored_hash.as_bytes(),
        );
        (ok, ok)
    }
}

/// Generate a JWT access token
pub fn generate_access_token(user: &User) -> Option<String> {
    let now = Utc::now();
    let exp = now + Duration::hours(JWT_EXPIRY_HOURS);

    let claims = Claims {
        sub: user.id.clone(),
        email: user.email.clone(),
        tier: user.subscription_tier.as_str().to_string(),
        iat: now.timestamp(),
        exp: exp.timestamp(),
        token_type: "access".to_string(),
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret()),
    )
    .ok()
}

/// Generate a refresh token
pub fn generate_refresh_token(user: &User) -> Option<String> {
    let now = Utc::now();
    let exp = now + Duration::days(REFRESH_TOKEN_EXPIRY_DAYS);

    let claims = Claims {
        sub: user.id.clone(),
        email: user.email.clone(),
        tier: user.subscription_tier.as_str().to_string(),
        iat: now.timestamp(),
        exp: exp.timestamp(),
        token_type: "refresh".to_string(),
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret()),
    )
    .ok()
}

/// Validate a JWT token and return the authenticated user
/// Verify a token's signature and expiry and return its claims.
///
/// This is the stateless half of validation -- it does not know whether the
/// token has been revoked, because that needs the database. `validate_token`
/// wraps it for callers that only need the identity; the middleware and the
/// `AuthenticatedUser` extractor go one step further and check revocation.
pub fn validate_token_claims(token: &str) -> Option<Claims> {
    let validation = Validation::new(Algorithm::HS256);
    let token_data =
        decode::<Claims>(token, &DecodingKey::from_secret(jwt_secret()), &validation).ok()?;
    let claims = token_data.claims;
    if claims.exp < Utc::now().timestamp() {
        return None;
    }
    Some(claims)
}

pub fn validate_token(token: &str) -> Option<AuthenticatedUser> {
    validate_token_claims(token).map(|claims| AuthenticatedUser {
        user_id: claims.sub,
        email: claims.email,
        tier: SubscriptionTier::from_str(&claims.tier).unwrap_or_default(),
    })
}

/// Whether a table has a column, used to add `tokens_valid_after` to an older
/// `users` table without a full migration.
fn user_column_exists(conn: &rusqlite::Connection, col: &str) -> rusqlite::Result<bool> {
    let mut stmt = conn.prepare("PRAGMA table_info(users)")?;
    let names: Vec<String> = stmt
        .query_map([], |r| r.get::<_, String>(1))?
        .collect::<rusqlite::Result<_>>()?;
    Ok(names.iter().any(|n| n == col))
}

/// Whether a token is still current: issued at or after the point the user's
/// tokens were last invalidated (a password change moves that point forward).
///
/// A missing user or a lookup error is treated as *current*, so this can only
/// ever reject a token, never manufacture access for one that failed signature
/// or expiry checks upstream.
fn token_not_revoked(conn: &rusqlite::Connection, user_id: &str, iat: i64) -> bool {
    let valid_after: i64 = conn
        .query_row(
            "SELECT COALESCE(tokens_valid_after, 0) FROM users WHERE id = ?1",
            [user_id],
            |r| r.get(0),
        )
        .unwrap_or(0);
    iat >= valid_after
}

/// Validate refresh token specifically
pub fn validate_refresh_token(token: &str) -> Option<AuthenticatedUser> {
    let validation = Validation::new(Algorithm::HS256);

    let token_data =
        decode::<Claims>(token, &DecodingKey::from_secret(jwt_secret()), &validation).ok()?;

    let claims = token_data.claims;

    // Must be a refresh token
    if claims.token_type != "refresh" {
        return None;
    }

    // Check if token is expired
    if claims.exp < Utc::now().timestamp() {
        return None;
    }

    Some(AuthenticatedUser {
        user_id: claims.sub,
        email: claims.email,
        tier: SubscriptionTier::from_str(&claims.tier).unwrap_or_default(),
    })
}

// =============================================================================
// Database Operations
// =============================================================================

/// Initialize auth tables in the database
pub fn init_auth_tables(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            display_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            password_salt TEXT NOT NULL,
            subscription_tier TEXT NOT NULL DEFAULT 'free',
            subscription_expires_at INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            last_login_at INTEGER,
            email_verified INTEGER DEFAULT 0,
            avatar_url TEXT,
            metadata TEXT,
            tokens_valid_after INTEGER NOT NULL DEFAULT 0
        )",
        [],
    )?;

    // Added after the table shipped: the unix time before which this user's
    // tokens are no longer accepted. A password change bumps it, so tokens
    // minted before the change stop working. Existing databases need the column
    // added; new ones already have it from the CREATE above.
    if !user_column_exists(conn, "tokens_valid_after")? {
        conn.execute(
            "ALTER TABLE users ADD COLUMN tokens_valid_after INTEGER NOT NULL DEFAULT 0",
            [],
        )?;
    }

    conn.execute(
        "CREATE TABLE IF NOT EXISTS refresh_tokens (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            token_hash TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            revoked INTEGER DEFAULT 0,
            device_info TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS user_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            device_id TEXT,
            device_name TEXT,
            platform TEXT,
            ip_address TEXT,
            last_active_at INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Create indexes
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)",
        [],
    )?;

    Ok(())
}

// =============================================================================
// HTTP Handlers
// =============================================================================

/// Register a new user
pub async fn register(
    app_state: web::Data<crate::api::state::AppState>,
    body: web::Json<RegisterRequest>,
) -> HttpResponse {
    let db = app_state.db.lock().unwrap();

    // Initialize tables if needed
    if let Err(e) = init_auth_tables(&db.conn) {
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "success": false,
            "error": format!("Database error: {}", e)
        }));
    }

    // Validate input
    if body.email.is_empty() || !body.email.contains('@') {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "success": false,
            "error": "Invalid email address"
        }));
    }

    if body.password.len() < 8 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "success": false,
            "error": "Password must be at least 8 characters"
        }));
    }

    if body.display_name.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "success": false,
            "error": "Display name is required"
        }));
    }

    // Check if email already exists
    let existing: rusqlite::Result<Option<String>> = db
        .conn
        .query_row(
            "SELECT id FROM users WHERE email = ?1",
            rusqlite::params![body.email.to_lowercase()],
            |row| row.get(0),
        )
        .optional();

    if let Ok(Some(_)) = existing {
        return HttpResponse::Conflict().json(serde_json::json!({
            "success": false,
            "error": "Email already registered"
        }));
    }

    // Create user
    let user_id = Uuid::new_v4().to_string();
    // Argon2 embeds its own salt in the hash string, so the `password_salt`
    // column is vestigial for new rows. It stays NOT NULL in the schema, so
    // write an empty string rather than dropping it.
    let salt = String::new();
    let password_hash = match hash_password_argon2(&body.password) {
        Ok(h) => h,
        Err(e) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "error": format!("Failed to hash password: {}", e)
            }))
        }
    };
    let now = Utc::now().timestamp();

    let result = db.conn.execute(
        "INSERT INTO users (id, email, display_name, password_hash, password_salt, 
                           subscription_tier, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            user_id,
            body.email.to_lowercase(),
            body.display_name,
            password_hash,
            salt,
            "free",
            now,
            now,
        ],
    );

    if let Err(e) = result {
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "success": false,
            "error": format!("Failed to create user: {}", e)
        }));
    }

    // Create user object for token generation
    let user = User {
        id: user_id,
        email: body.email.to_lowercase(),
        display_name: body.display_name.clone(),
        password_hash,
        subscription_tier: SubscriptionTier::Free,
        subscription_expires_at: None,
        created_at: now,
        updated_at: now,
        last_login_at: None,
        email_verified: false,
        avatar_url: None,
        metadata: None,
    };

    // Generate tokens
    let access_token = match generate_access_token(&user) {
        Some(t) => t,
        None => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "error": "Failed to generate access token"
            }))
        }
    };

    let refresh_token = match generate_refresh_token(&user) {
        Some(t) => t,
        None => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "error": "Failed to generate refresh token"
            }))
        }
    };

    HttpResponse::Created().json(serde_json::json!({
        "success": true,
        "data": AuthResponse {
            user: PublicUser::from(user),
            access_token,
            refresh_token,
            expires_in: JWT_EXPIRY_HOURS * 3600,
        }
    }))
}

/// Login with email and password
pub async fn login(
    req: HttpRequest,
    app_state: web::Data<crate::api::state::AppState>,
    body: web::Json<LoginRequest>,
) -> HttpResponse {
    // Refuse before touching the database or the password hash: an address that
    // has burned its failure budget is answered 429 without an Argon2
    // verification, so the throttle also caps the CPU a guesser can spend.
    let key = throttle_key(&req);
    if login_throttled(&key) {
        return HttpResponse::TooManyRequests().json(serde_json::json!({
            "success": false,
            "error": "Too many failed login attempts. Try again later.",
        }));
    }

    let db = app_state.db.lock().unwrap();

    // Initialize tables if needed
    if let Err(e) = init_auth_tables(&db.conn) {
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "success": false,
            "error": format!("Database error: {}", e)
        }));
    }

    // Find user by email
    let user_result: rusqlite::Result<(
        String,
        String,
        String,
        String,
        String,
        String,
        Option<i64>,
        i64,
        i64,
        Option<i64>,
        i32,
        Option<String>,
    )> = db.conn.query_row(
        "SELECT id, email, display_name, password_hash, password_salt, 
                    subscription_tier, subscription_expires_at, created_at, updated_at,
                    last_login_at, email_verified, avatar_url
             FROM users WHERE email = ?1",
        rusqlite::params![body.email.to_lowercase()],
        |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
                row.get(8)?,
                row.get(9)?,
                row.get(10)?,
                row.get(11)?,
            ))
        },
    );

    let (
        id,
        email,
        display_name,
        stored_hash,
        salt,
        tier_str,
        sub_expires,
        created_at,
        updated_at,
        _last_login,
        verified,
        avatar,
    ) = match user_result {
        Ok(data) => data,
        Err(_) => {
            record_login_failure(&key);
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "success": false,
                "error": "Invalid email or password"
            }));
        }
    };

    // Verify password against whatever scheme it was stored under.
    let (matches, needs_upgrade) = verify_password(&body.password, &stored_hash, &salt);
    if !matches {
        record_login_failure(&key);
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "success": false,
            "error": "Invalid email or password"
        }));
    }

    // A correct password clears this address's failure budget.
    clear_login_failures(&key);

    // A legacy SHA-256 account that just proved its password: rewrite the hash
    // as Argon2 now, while we have the plaintext, so it never has to again.
    if needs_upgrade {
        if let Ok(upgraded) = hash_password_argon2(&body.password) {
            let _ = db.conn.execute(
                "UPDATE users SET password_hash = ?1, password_salt = ?2 WHERE id = ?3",
                rusqlite::params![upgraded, "", id],
            );
        }
    }

    // Update last login time
    let now = Utc::now().timestamp();
    let _ = db.conn.execute(
        "UPDATE users SET last_login_at = ?1 WHERE id = ?2",
        rusqlite::params![now, id],
    );

    let user = User {
        id,
        email,
        display_name,
        password_hash: stored_hash,
        subscription_tier: SubscriptionTier::from_str(&tier_str).unwrap_or_default(),
        subscription_expires_at: sub_expires,
        created_at,
        updated_at,
        last_login_at: Some(now),
        email_verified: verified == 1,
        avatar_url: avatar,
        metadata: None,
    };

    // Generate tokens
    let access_token = match generate_access_token(&user) {
        Some(t) => t,
        None => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "error": "Failed to generate access token"
            }))
        }
    };

    let refresh_token = match generate_refresh_token(&user) {
        Some(t) => t,
        None => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "error": "Failed to generate refresh token"
            }))
        }
    };

    HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "data": AuthResponse {
            user: PublicUser::from(user),
            access_token,
            refresh_token,
            expires_in: JWT_EXPIRY_HOURS * 3600,
        }
    }))
}

/// Refresh access token using refresh token
pub async fn refresh_token(
    app_state: web::Data<crate::api::state::AppState>,
    body: web::Json<RefreshTokenRequest>,
) -> HttpResponse {
    // Validate refresh token: signature, expiry, and that it is a refresh
    // token (not an access token replayed here).
    let claims = match validate_token_claims(&body.refresh_token) {
        Some(c) if c.token_type == "refresh" => c,
        _ => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "success": false,
                "error": "Invalid or expired refresh token"
            }))
        }
    };

    let db = app_state.db.lock().unwrap();

    // Revocation applies to refresh tokens too, or it does not apply at all: a
    // refresh token minted before a password change would otherwise let its
    // holder keep issuing fresh access tokens indefinitely, defeating the point
    // of changing the password.
    if !token_not_revoked(&db.conn, &claims.sub, claims.iat) {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "success": false,
            "error": "Invalid or expired refresh token"
        }));
    }
    let auth_user = AuthenticatedUser {
        user_id: claims.sub,
        email: claims.email,
        tier: SubscriptionTier::from_str(&claims.tier).unwrap_or_default(),
    };

    // Get current user data
    let user_result: rusqlite::Result<(
        String,
        String,
        String,
        String,
        Option<i64>,
        i64,
        i64,
        i32,
        Option<String>,
    )> = db.conn.query_row(
        "SELECT id, email, display_name, subscription_tier, subscription_expires_at,
                    created_at, updated_at, email_verified, avatar_url
             FROM users WHERE id = ?1",
        rusqlite::params![auth_user.user_id],
        |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
                row.get(8)?,
            ))
        },
    );

    let (id, email, display_name, tier_str, sub_expires, created_at, updated_at, verified, avatar) =
        match user_result {
            Ok(data) => data,
            Err(_) => {
                return HttpResponse::NotFound().json(serde_json::json!({
                    "success": false,
                    "error": "User not found"
                }))
            }
        };

    let user = User {
        id,
        email,
        display_name,
        password_hash: String::new(), // Not needed for token generation
        subscription_tier: SubscriptionTier::from_str(&tier_str).unwrap_or_default(),
        subscription_expires_at: sub_expires,
        created_at,
        updated_at,
        last_login_at: None,
        email_verified: verified == 1,
        avatar_url: avatar,
        metadata: None,
    };

    // Generate new tokens
    let access_token = match generate_access_token(&user) {
        Some(t) => t,
        None => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "error": "Failed to generate access token"
            }))
        }
    };

    let new_refresh_token = match generate_refresh_token(&user) {
        Some(t) => t,
        None => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "error": "Failed to generate refresh token"
            }))
        }
    };

    HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "data": AuthResponse {
            user: PublicUser::from(user),
            access_token,
            refresh_token: new_refresh_token,
            expires_in: JWT_EXPIRY_HOURS * 3600,
        }
    }))
}

/// Get current user profile
pub async fn get_profile(
    app_state: web::Data<crate::api::state::AppState>,
    auth_user: AuthenticatedUser,
) -> HttpResponse {
    if auth_user.user_id.is_empty() {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "success": false,
            "error": "Not authenticated"
        }));
    }

    let db = app_state.db.lock().unwrap();

    let user_result: rusqlite::Result<(
        String,
        String,
        String,
        String,
        Option<i64>,
        i64,
        i64,
        i32,
        Option<String>,
    )> = db.conn.query_row(
        "SELECT id, email, display_name, subscription_tier, subscription_expires_at,
                    created_at, updated_at, email_verified, avatar_url
             FROM users WHERE id = ?1",
        rusqlite::params![auth_user.user_id],
        |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
                row.get(8)?,
            ))
        },
    );

    match user_result {
        Ok((
            id,
            email,
            display_name,
            tier_str,
            sub_expires,
            created_at,
            updated_at,
            verified,
            avatar,
        )) => {
            let user = User {
                id,
                email,
                display_name,
                password_hash: String::new(),
                subscription_tier: SubscriptionTier::from_str(&tier_str).unwrap_or_default(),
                subscription_expires_at: sub_expires,
                created_at,
                updated_at,
                last_login_at: None,
                email_verified: verified == 1,
                avatar_url: avatar,
                metadata: None,
            };

            HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "data": PublicUser::from(user)
            }))
        }
        Err(_) => HttpResponse::NotFound().json(serde_json::json!({
            "success": false,
            "error": "User not found"
        })),
    }
}

/// Update user profile
pub async fn update_profile(
    app_state: web::Data<crate::api::state::AppState>,
    auth_user: AuthenticatedUser,
    body: web::Json<UpdateProfileRequest>,
) -> HttpResponse {
    if auth_user.user_id.is_empty() {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "success": false,
            "error": "Not authenticated"
        }));
    }

    // Scope the db lock so it's released before calling get_profile
    {
        let db = app_state.db.lock().unwrap();
        let now = Utc::now().timestamp();

        // Build update query
        let mut updates = Vec::new();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(ref name) = body.display_name {
            updates.push("display_name = ?");
            params.push(Box::new(name.clone()));
        }

        if let Some(ref avatar) = body.avatar_url {
            updates.push("avatar_url = ?");
            params.push(Box::new(avatar.clone()));
        }

        if updates.is_empty() {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "success": false,
                "error": "No fields to update"
            }));
        }

        updates.push("updated_at = ?");
        params.push(Box::new(now));

        let query = format!("UPDATE users SET {} WHERE id = ?", updates.join(", "));
        params.push(Box::new(auth_user.user_id.clone()));

        let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

        if let Err(e) = db.conn.execute(&query, params_refs.as_slice()) {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "error": format!("Failed to update profile: {}", e)
            }));
        }
    } // db lock released here

    // Return updated profile
    get_profile(app_state, auth_user).await
}

/// Change password
pub async fn change_password(
    app_state: web::Data<crate::api::state::AppState>,
    auth_user: AuthenticatedUser,
    body: web::Json<ChangePasswordRequest>,
) -> HttpResponse {
    if auth_user.user_id.is_empty() {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "success": false,
            "error": "Not authenticated"
        }));
    }

    if body.new_password.len() < 8 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "success": false,
            "error": "New password must be at least 8 characters"
        }));
    }

    let db = app_state.db.lock().unwrap();

    // Get current password hash and salt
    let creds: rusqlite::Result<(String, String)> = db.conn.query_row(
        "SELECT password_hash, password_salt FROM users WHERE id = ?1",
        rusqlite::params![auth_user.user_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    );

    let (stored_hash, salt) = match creds {
        Ok(c) => c,
        Err(_) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "success": false,
                "error": "User not found"
            }))
        }
    };

    // Verify current password (old scheme or new).
    let (matches, _) = verify_password(&body.current_password, &stored_hash, &salt);
    if !matches {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "success": false,
            "error": "Current password is incorrect"
        }));
    }

    // Update password. The new hash is always Argon2; the salt column goes
    // empty because Argon2 carries its own.
    let new_salt = String::new();
    let new_hash = match hash_password_argon2(&body.new_password) {
        Ok(h) => h,
        Err(e) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "success": false,
                "error": format!("Failed to hash password: {}", e)
            }))
        }
    };
    let now = Utc::now().timestamp();

    // `tokens_valid_after = now` invalidates every token issued before this
    // change. Changing a password is how you respond to it being compromised;
    // if the old tokens kept working, the response would not actually lock the
    // attacker out. The `- 1` guards a same-second race: a token minted in the
    // same second as the change (iat == now) should still be rejected, and iat
    // >= valid_after is the accept test, so the cut-off sits one second ahead.
    if let Err(e) = db.conn.execute(
        "UPDATE users SET password_hash = ?1, password_salt = ?2, updated_at = ?3,
                tokens_valid_after = ?4 WHERE id = ?5",
        rusqlite::params![new_hash, new_salt, now, now + 1, auth_user.user_id],
    ) {
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "success": false,
            "error": format!("Failed to update password: {}", e)
        }));
    }

    HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "message": "Password updated successfully"
    }))
}

/// Get subscription details
pub async fn get_subscription(
    app_state: web::Data<crate::api::state::AppState>,
    auth_user: AuthenticatedUser,
) -> HttpResponse {
    if auth_user.user_id.is_empty() {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "success": false,
            "error": "Not authenticated"
        }));
    }

    let db = app_state.db.lock().unwrap();

    let result: rusqlite::Result<(String, Option<i64>)> = db.conn.query_row(
        "SELECT subscription_tier, subscription_expires_at FROM users WHERE id = ?1",
        rusqlite::params![auth_user.user_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    );

    match result {
        Ok((tier_str, expires_at)) => {
            let tier = SubscriptionTier::from_str(&tier_str).unwrap_or_default();
            let features = SubscriptionFeatures::for_tier(tier);

            HttpResponse::Ok().json(serde_json::json!({
                "success": true,
                "data": {
                    "tier": tier_str,
                    "expiresAt": expires_at,
                    "features": features,
                    "isActive": expires_at.map(|exp| exp > Utc::now().timestamp()).unwrap_or(true),
                }
            }))
        }
        Err(_) => HttpResponse::NotFound().json(serde_json::json!({
            "success": false,
            "error": "User not found"
        })),
    }
}

/// Upgrade subscription (simulated - in production would integrate with payment provider)
pub async fn upgrade_subscription(
    app_state: web::Data<crate::api::state::AppState>,
    auth_user: AuthenticatedUser,
    body: web::Json<UpgradeSubscriptionRequest>,
) -> HttpResponse {
    if auth_user.user_id.is_empty() {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "success": false,
            "error": "Not authenticated"
        }));
    }

    let new_tier = match SubscriptionTier::from_str(&body.tier) {
        Some(t) => t,
        None => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "success": false,
                "error": "Invalid subscription tier"
            }))
        }
    };

    // In production, this would:
    // 1. Validate the payment token with Stripe/PayPal
    // 2. Create a subscription in the payment provider
    // 3. Set up webhooks for subscription events

    let db = app_state.db.lock().unwrap();
    let now = Utc::now().timestamp();
    let expires_at = if new_tier == SubscriptionTier::Free {
        None
    } else {
        // 1 year subscription
        Some(now + (365 * 24 * 3600))
    };

    if let Err(e) = db.conn.execute(
        "UPDATE users SET subscription_tier = ?1, subscription_expires_at = ?2, updated_at = ?3 WHERE id = ?4",
        rusqlite::params![new_tier.as_str(), expires_at, now, auth_user.user_id],
    ) {
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "success": false,
            "error": format!("Failed to upgrade subscription: {}", e)
        }));
    }

    let features = SubscriptionFeatures::for_tier(new_tier);

    HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "data": {
            "tier": new_tier.as_str(),
            "expiresAt": expires_at,
            "features": features,
            "message": "Subscription upgraded successfully"
        }
    }))
}

/// Logout, invalidating the caller's tokens server-side.
///
/// This moves the user's `tokens_valid_after` forward, the same revocation
/// point a password change uses, so both the access token and the refresh
/// token presented up to now stop being accepted. Until this was wired up,
/// logout only returned 200: the client dropped its copy of the token while
/// the token itself stayed valid until expiry, so anyone who had captured it
/// still had a working credential and "log out" was a false assurance.
///
/// Note the scope. `tokens_valid_after` is a single per-user instant, so this
/// is a global sign-out: every session that user has, on every device, ends
/// here. That is the honest behaviour for the primitive available -- `Claims`
/// carries no `jti`, so there is nothing to revoke an individual token by.
/// Per-device logout would need a token id in the claims plus somewhere to
/// record which ones were withdrawn.
///
/// The `- 1`-style `now + 1` cut-off is the same same-second race guard as in
/// `change_password`: a token minted in the same second as the logout
/// (`iat == now`) must still be rejected, and `iat >= valid_after` is the
/// accept test, so the cut-off sits one second ahead.
pub async fn logout(
    app_state: web::Data<crate::api::state::AppState>,
    auth_user: AuthenticatedUser,
) -> HttpResponse {
    let now = Utc::now().timestamp();
    let db = app_state.db.lock().unwrap();

    if let Err(e) = db.conn.execute(
        "UPDATE users SET tokens_valid_after = ?1 WHERE id = ?2",
        rusqlite::params![now + 1, auth_user.user_id],
    ) {
        // Report the failure rather than answering 200. A client told its
        // logout succeeded will discard the token and stop showing a signed-in
        // state, which would leave a live credential behind with nobody aware.
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "success": false,
            "error": format!("Failed to invalidate session: {}", e)
        }));
    }

    HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "message": "Logged out successfully"
    }))
}

// =============================================================================
// Route Configuration
// =============================================================================

pub fn configure_auth_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/auth")
            .route("/register", web::post().to(register))
            .route("/login", web::post().to(login))
            .route("/refresh", web::post().to(refresh_token))
            .route("/logout", web::post().to(logout))
            .route("/profile", web::get().to(get_profile))
            .route("/profile", web::put().to(update_profile))
            .route("/password", web::put().to(change_password))
            .route("/subscription", web::get().to(get_subscription))
            .route(
                "/subscription/upgrade",
                web::post().to(upgrade_subscription),
            ),
    );
}

#[cfg(test)]
mod security_tests {
    use super::*;

    /// A token is accepted until the user's `tokens_valid_after` moves past its
    /// `iat`, and rejected after -- the mechanism a password change uses to
    /// invalidate outstanding tokens. A missing user is treated as current, so
    /// the check can only reject, never invent access.
    #[test]
    fn a_token_is_revoked_once_valid_after_passes_its_issue_time() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        init_auth_tables(&conn).unwrap();
        conn.execute(
            "INSERT INTO users (id, email, display_name, password_hash, password_salt,
                                created_at, updated_at, tokens_valid_after)
             VALUES ('u1','u1@e.co','U','h','', 0, 0, 0)",
            [],
        )
        .unwrap();

        // Fresh table: cut-off 0, any token is current.
        assert!(token_not_revoked(&conn, "u1", 1000));

        // Password change moves the cut-off to 1500.
        conn.execute(
            "UPDATE users SET tokens_valid_after = 1500 WHERE id = 'u1'",
            [],
        )
        .unwrap();
        assert!(
            !token_not_revoked(&conn, "u1", 1000),
            "old token still current"
        );
        assert!(
            token_not_revoked(&conn, "u1", 1500),
            "cut-off itself accepted"
        );
        assert!(token_not_revoked(&conn, "u1", 2000), "newer token current");

        // Unknown user -> current (reject-only guarantee).
        assert!(token_not_revoked(&conn, "nobody", 1));
    }

    /// Logout has to move the same cut-off a password change moves, and it has
    /// to land *ahead* of a token minted in the same second.
    ///
    /// This is the regression guard for logout having been a no-op: it
    /// answered 200 while the token it "invalidated" kept working until
    /// expiry, so a captured credential survived the one action a user takes
    /// to shut it down. The `now + 1` is what makes the same-second case fail
    /// closed -- `iat >= valid_after` is the accept test, so writing `now`
    /// would leave a token issued that same second still valid.
    #[test]
    fn logout_revokes_tokens_issued_up_to_and_including_that_second() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        init_auth_tables(&conn).unwrap();
        conn.execute(
            "INSERT INTO users (id, email, display_name, password_hash, password_salt,
                                created_at, updated_at, tokens_valid_after)
             VALUES ('u1','u1@e.co','U','h','', 0, 0, 0)",
            [],
        )
        .unwrap();

        let now = 1_000_000i64;
        assert!(
            token_not_revoked(&conn, "u1", now),
            "token is current before logout"
        );

        // Exactly what the logout handler writes.
        conn.execute(
            "UPDATE users SET tokens_valid_after = ?1 WHERE id = ?2",
            rusqlite::params![now + 1, "u1"],
        )
        .unwrap();

        assert!(
            !token_not_revoked(&conn, "u1", now - 60),
            "token from before logout must be rejected"
        );
        assert!(
            !token_not_revoked(&conn, "u1", now),
            "token minted in the same second as logout must be rejected"
        );
        assert!(
            token_not_revoked(&conn, "u1", now + 1),
            "a token issued after logout must still work, or login is broken"
        );
    }

    /// The login throttle blocks an address after its failure budget, and a
    /// success (modelled here as a clear) resets it. Uses a unique key per test
    /// so the process-global map does not couple tests.
    #[test]
    fn login_throttle_blocks_after_the_budget_and_resets_on_success() {
        let key = format!("test-key-{}", uuid::Uuid::new_v4());
        assert!(!login_throttled(&key));
        for _ in 0..LOGIN_MAX_FAILURES {
            record_login_failure(&key);
        }
        assert!(login_throttled(&key), "not throttled after the budget");
        clear_login_failures(&key);
        assert!(
            !login_throttled(&key),
            "a success did not reset the counter"
        );
    }

    /// One failure short of the budget is still allowed -- an ordinary user who
    /// mistypes is not locked out.
    #[test]
    fn login_throttle_allows_up_to_the_budget() {
        let key = format!("test-key-{}", uuid::Uuid::new_v4());
        for _ in 0..(LOGIN_MAX_FAILURES - 1) {
            record_login_failure(&key);
        }
        assert!(!login_throttled(&key));
    }

    /// A token this process signs must verify; a byte-flipped one must not.
    #[test]
    fn a_token_signed_now_round_trips_and_tampering_is_rejected() {
        let user = User {
            id: "u1".into(),
            email: "u1@example.com".into(),
            display_name: "U".into(),
            password_hash: String::new(),
            subscription_tier: SubscriptionTier::Free,
            subscription_expires_at: None,
            created_at: 0,
            updated_at: 0,
            last_login_at: None,
            email_verified: false,
            avatar_url: None,
            metadata: None,
        };
        let token = generate_access_token(&user).expect("signed");
        assert!(validate_token(&token).is_some());

        let mut bad = token.clone();
        bad.pop();
        bad.push(if token.ends_with('a') { 'b' } else { 'a' });
        assert!(validate_token(&bad).is_none(), "a tampered token verified");
    }

    /// The exploit that motivated this: a token signed with the old
    /// compiled-in constant must NOT validate, because that constant is no
    /// longer the signing secret.
    #[test]
    fn a_token_forged_with_the_old_hardcoded_secret_is_rejected() {
        use jsonwebtoken::{encode, EncodingKey, Header};
        const OLD_SECRET: &[u8] = b"ironbridge_jwt_secret_key_change_in_production_2024";
        let claims = Claims {
            sub: "attacker".into(),
            email: "attacker@evil.test".into(),
            tier: "enterprise".into(),
            iat: Utc::now().timestamp(),
            exp: (Utc::now() + Duration::hours(1)).timestamp(),
            token_type: "access".into(),
        };
        let forged = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(OLD_SECRET),
        )
        .expect("forge");
        assert!(
            validate_token(&forged).is_none(),
            "a token forged with the leaked constant still validated"
        );
    }

    /// New passwords are stored as Argon2, never the legacy SHA-256.
    #[test]
    fn new_hashes_are_argon2_and_verify() {
        let hash = hash_password_argon2("correct horse battery staple").expect("hash");
        assert!(
            hash.starts_with("$argon2"),
            "not an argon2 PHC string: {hash}"
        );
        let (ok, upgrade) = verify_password("correct horse battery staple", &hash, "");
        assert!(ok);
        assert!(!upgrade, "an argon2 hash should not ask to be upgraded");
        let (bad, _) = verify_password("wrong password", &hash, "");
        assert!(!bad);
    }

    /// Two hashes of the same password differ (per-hash random salt), so the
    /// store is not a lookup table of equal passwords to equal hashes.
    #[test]
    fn argon2_salts_are_unique_per_hash() {
        let a = hash_password_argon2("same").unwrap();
        let b = hash_password_argon2("same").unwrap();
        assert_ne!(a, b);
    }

    /// A legacy SHA-256 account still logs in, and asks to be upgraded.
    #[test]
    fn a_legacy_hash_verifies_and_requests_upgrade() {
        let salt = "legacy-salt";
        let legacy = legacy_sha256("hunter2", salt);
        assert!(!legacy.starts_with("$argon2"));

        let (ok, upgrade) = verify_password("hunter2", &legacy, salt);
        assert!(ok, "legacy password did not verify");
        assert!(upgrade, "legacy verify did not flag an upgrade");

        let (bad, _) = verify_password("not it", &legacy, salt);
        assert!(!bad);
    }

    /// The legacy comparison is length-checked; a truncated hash never matches.
    #[test]
    fn legacy_compare_rejects_mismatched_lengths() {
        assert!(!constant_time_eq(b"abc", b"abcd"));
        assert!(constant_time_eq(b"abcd", b"abcd"));
        assert!(!constant_time_eq(b"abcd", b"abce"));
    }
}

#[cfg(test)]
mod enforcement_tests {
    use super::*;

    #[test]
    fn the_gate_is_default_deny_with_a_small_open_list() {
        // Gated: the API, and -- the bug this replaced -- every sensitive
        // root-mounted scope that used to be reachable with no token.
        assert!(path_requires_auth("/api/sessions"));
        assert!(path_requires_auth("/api/swarms/x/agents"));
        assert!(path_requires_auth("/sync/snapshot"));
        assert!(path_requires_auth("/recording/sessions"));
        assert!(path_requires_auth("/audit"));
        assert!(path_requires_auth("/retention/policies"));
        assert!(path_requires_auth("/webhooks"));
        assert!(path_requires_auth("/graphql"));
        assert!(path_requires_auth("/ws"));
        // A scope nobody has thought of yet is gated by default.
        assert!(path_requires_auth("/some/future/scope"));

        // Open: liveness, the login handshake, the SSO handshake, the docs.
        assert!(!path_requires_auth("/api/health"));
        assert!(!path_requires_auth("/health"));
        assert!(!path_requires_auth("/api/system/health"));
        assert!(!path_requires_auth("/auth/login"));
        assert!(!path_requires_auth("/auth/register"));
        assert!(!path_requires_auth("/sso/login"));
        assert!(!path_requires_auth("/oidc/callback"));
        assert!(!path_requires_auth("/docs"));
        assert!(!path_requires_auth("/docs/openapi.yaml"));
    }

    /// The middleware, end to end, in both modes.
    ///
    /// A `from_fn` wrap is only meaningful mounted on an app, so this drives it
    /// through one: with enforcement off every route is open; with it on, a
    /// bare `/api` route is 401 without a token, 200 with a freshly signed one,
    /// and `/api/health` stays open either way.
    #[tokio::test]
    async fn the_gate_opens_and_closes_with_a_valid_token() {
        use actix_web::{middleware::from_fn, web, App, HttpResponse};

        async fn ok() -> HttpResponse {
            HttpResponse::Ok().json(serde_json::json!({ "ok": true }))
        }

        let app = actix_web::test::init_service(
            App::new().wrap(from_fn(require_auth)).service(
                web::scope("/api")
                    .route("/health", web::get().to(ok))
                    .route("/sessions", web::get().to(ok)),
            ),
        )
        .await;

        let user = User {
            id: "u1".into(),
            email: "u1@example.com".into(),
            display_name: "U".into(),
            password_hash: String::new(),
            subscription_tier: SubscriptionTier::Free,
            subscription_expires_at: None,
            created_at: 0,
            updated_at: 0,
            last_login_at: None,
            email_verified: false,
            avatar_url: None,
            metadata: None,
        };
        let token = generate_access_token(&user).expect("token");

        let get = |uri: &str, bearer: Option<&str>| {
            let mut r = actix_web::test::TestRequest::get().uri(uri);
            if let Some(b) = bearer {
                r = r.insert_header(("Authorization", format!("Bearer {b}")));
            }
            r.to_request()
        };

        // `auth_required()` reads the env once and memoizes. The test asserts
        // the two branches directly rather than fighting that global, so it is
        // deterministic regardless of the runner's environment.
        if auth_required() {
            // Enforcement is on in this environment.
            let s = actix_web::test::call_service(&app, get("/api/sessions", None)).await;
            assert_eq!(s.status(), 401);
            let s = actix_web::test::call_service(&app, get("/api/sessions", Some(&token))).await;
            assert_eq!(s.status(), 200);
            let s = actix_web::test::call_service(&app, get("/api/health", None)).await;
            assert_eq!(s.status(), 200);
        } else {
            // IRONBRIDGE_DISABLE_AUTH is set in this environment: everything open.
            let s = actix_web::test::call_service(&app, get("/api/sessions", None)).await;
            assert_eq!(s.status(), 200);
            let s = actix_web::test::call_service(&app, get("/api/health", None)).await;
            assert_eq!(s.status(), 200);
        }
    }

    #[test]
    fn query_token_accepted_only_on_websocket_routes() {
        let user = User {
            id: "u1".into(),
            email: "u1@example.com".into(),
            display_name: "U".into(),
            password_hash: String::new(),
            subscription_tier: SubscriptionTier::Free,
            subscription_expires_at: None,
            created_at: 0,
            updated_at: 0,
            last_login_at: None,
            email_verified: false,
            avatar_url: None,
            metadata: None,
        };
        let token = generate_access_token(&user).expect("token");

        // A bare `?token=` on an ordinary request must NOT authenticate: the
        // query fallback exists only so WebSocket handshakes (which cannot set
        // an Authorization header) can carry a token. Honouring it elsewhere
        // would leak tokens into logs, history, and Referer headers.
        let plain = actix_web::test::TestRequest::get()
            .uri(&format!("/api/sessions?token={token}"))
            .to_srv_request();
        assert!(
            request_token(&plain).is_none(),
            "a ?token= on a non-WebSocket route must not authenticate"
        );

        // Spoof guard: setting `Upgrade: websocket` on an ordinary route must
        // still NOT authenticate from the URL. The gate is the route path, not
        // this client-settable header -- otherwise the token would ride in (and
        // be logged from) the URL of a normal API request.
        let spoof = actix_web::test::TestRequest::get()
            .uri(&format!("/api/sessions?token={token}"))
            .insert_header(("Upgrade", "websocket"))
            .to_srv_request();
        assert!(
            request_token(&spoof).is_none(),
            "a forged Upgrade header on a non-WS route must not authenticate from the URL"
        );

        // On a WebSocket route the query fallback IS accepted (legacy path).
        let ws_query = actix_web::test::TestRequest::get()
            .uri(&format!("/ws?token={token}"))
            .to_srv_request();
        assert!(
            request_token(&ws_query).is_some(),
            "a ?token= on the /ws route must authenticate"
        );

        // Preferred WS channel: token in the Sec-WebSocket-Protocol header.
        let ws_subproto = actix_web::test::TestRequest::get()
            .uri("/ws")
            .insert_header(("Sec-WebSocket-Protocol", format!("bearer, {token}")))
            .to_srv_request();
        assert!(
            request_token(&ws_subproto).is_some(),
            "a bearer subprotocol on /ws must authenticate"
        );

        // The Authorization header path is unaffected on ordinary requests.
        let hdr = actix_web::test::TestRequest::get()
            .uri("/api/sessions")
            .insert_header(("Authorization", format!("Bearer {token}")))
            .to_srv_request();
        assert!(
            request_token(&hdr).is_some(),
            "the Authorization header must still authenticate ordinary requests"
        );
    }
}
