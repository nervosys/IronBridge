// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

use thiserror::Error;

/// Everything that can go wrong establishing an identity.
///
/// Deliberately coarse about *why* a credential was rejected. A caller
/// deciding whether to log someone in needs to know that verification failed,
/// not which of six checks failed first -- and neither does anyone probing the
/// endpoint. The detail goes in the message for the operator's logs, not in
/// the variant for the attacker's benefit.
#[derive(Debug, Error)]
pub enum SsoError {
    /// The assertion or token did not verify. Treat as "not authenticated".
    #[error("verification failed: {0}")]
    Verification(String),

    /// The document was syntactically wrong before verification could start.
    #[error("malformed {kind}: {detail}")]
    Malformed { kind: &'static str, detail: String },

    /// The provider is configured in a way this crate cannot support.
    ///
    /// Separate from `Verification` on purpose: this is an operator problem to
    /// fix, not a rejected login.
    #[error("unsupported: {0}")]
    Unsupported(String),

    /// Configuration is missing or internally inconsistent.
    #[error("configuration error: {0}")]
    Config(String),

    /// Talking to the identity provider failed.
    #[error("provider request failed: {0}")]
    Transport(String),
}

impl SsoError {
    pub(crate) fn malformed(kind: &'static str, detail: impl Into<String>) -> Self {
        Self::Malformed {
            kind,
            detail: detail.into(),
        }
    }

    pub(crate) fn verification(detail: impl Into<String>) -> Self {
        Self::Verification(detail.into())
    }

    pub(crate) fn unsupported(detail: impl Into<String>) -> Self {
        Self::Unsupported(detail.into())
    }

    /// True when the failure means "this credential is not valid", as opposed
    /// to "this server is misconfigured or unreachable".
    ///
    /// The distinction matters at the HTTP boundary: the first is a 401, the
    /// second is a 500 or 502, and conflating them either leaks configuration
    /// problems to unauthenticated callers or hides real outages behind a
    /// login failure.
    pub fn is_rejection(&self) -> bool {
        matches!(self, Self::Verification(_) | Self::Malformed { .. })
    }
}

pub type Result<T> = std::result::Result<T, SsoError>;
