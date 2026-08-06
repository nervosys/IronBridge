// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

//! Enterprise single sign-on for Chasm, with no native dependencies.
//!
//! Two protocols, deliberately unequal in emphasis:
//!
//! * [`oidc`] — the one to reach for. ID tokens are JWTs, so signature
//!   verification is a solved problem with a mature implementation behind it.
//!   Entra, Okta, Ping, Google and Auth0 all speak it.
//! * [`saml`] — for buyers who require it. Verifying a SAML assertion means
//!   canonicalising XML byte-for-byte as the signer did, which is the single
//!   most error-prone thing in this crate. Read [`saml`]'s own documentation
//!   about what it supports and refuses before deploying it.
//!
//! # Why this exists
//!
//! The alternative is `samael`, which wraps the C library `xmlsec1`. That
//! works, and on Linux it is the safer choice because xmlsec1 is battle-tested
//! in a way this crate is not. It also drags in libxml2, OpenSSL and an
//! autotools helper (`xmlsec1-config`) that has no Windows equivalent, which
//! makes a self-hosted Windows build effectively impossible.
//!
//! This crate trades a mature C implementation for a narrow pure-Rust one. The
//! trade is only defensible because the profile is small and the refusals are
//! aggressive: see [`saml`].
//!
//! # Shape of a login
//!
//! Both protocols end at the same place -- an [`Identity`] the host can map to
//! its own user record. Nothing here writes to a database or issues a session;
//! that belongs to the host, which knows what a user is.

pub mod error;
pub mod oidc;
pub mod saml;

pub use error::{Result, SsoError};

/// A verified end user.
///
/// Produced only after the provider's signature has been checked. Anything
/// reaching a caller as an `Identity` has been authenticated; whether it is
/// *authorised* is the host's question.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Identity {
    /// The provider's stable identifier. This, paired with the issuer, is the
    /// only safe primary key.
    ///
    /// Not the email: addresses get reassigned when people leave, and treating
    /// one as an identity hands the departed employee's account to their
    /// replacement.
    pub subject: String,

    /// Who vouched for this. Part of the key, because subjects are only unique
    /// within an issuer.
    pub issuer: String,

    pub email: Option<String>,
    pub email_verified: bool,
    pub display_name: Option<String>,

    /// Group or role claims, verbatim. Mapping them to permissions is the
    /// host's job -- this crate has no opinion about what "admin" means.
    pub groups: Vec<String>,

    /// Everything else the provider asserted, unmapped.
    pub attributes: std::collections::BTreeMap<String, Vec<String>>,
}

impl Identity {
    /// A key that is unique across providers.
    ///
    /// Two identity providers can both emit subject `12345`; only the pair
    /// distinguishes them.
    pub fn federated_key(&self) -> String {
        format!("{}|{}", self.issuer, self.subject)
    }
}
