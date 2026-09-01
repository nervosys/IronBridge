// Copyright (c) 2024-2027 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
//! Enterprise module
//!
//! Multi-tenancy and white-labelling, behind the `enterprise` feature.
//!
//! # Nothing here is routed yet
//!
//! Both modules compile, are linted, and have tests, but no endpoint, table or
//! caller reaches them. They are kept under the compiler rather than deleted
//! because an orphan cannot rot *detectably* -- while these files had no `mod`
//! declaration, appending invalid Rust to one of them broke no build.
//!
//! Wiring them is a product decision, and a substantial one: every table in
//! this codebase is single-tenant today, so tenancy touches all of them.
//!
//! # Why compliance.rs is not here
//!
//! It used to be, and it was a second implementation of audit logging and
//! retention policy -- both of which already ship routed, persisted and
//! served by `api::audit` and `api::retention`.
//!
//! The two had already drifted apart. `RetentionPolicy` keyed on `Uuid` here
//! and `String` there; `description` was required here and optional there.
//! `AuditEvent`, `AuditCategory`, `AuditQuery` and `AuditEventBuilder` were
//! likewise duplicated under the same names. Two divergent models of the same
//! compliance concept, one of them unreachable, is a bug waiting for whoever
//! next imports the wrong one.
//!
//! The routed implementation is the one that serves traffic, so it is the one
//! that stayed. Deleted in full; recoverable from history if any part of it
//! turns out to be worth porting across.

pub mod multitenancy;
pub mod whitelabel;

pub use multitenancy::*;
pub use whitelabel::*;
