// Copyright (c) 2024-2027 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
//! Team management module
//!
//! Provides team workspaces, collaboration, RBAC, and activity tracking.

pub mod activity;
pub mod rbac;
pub mod search;
pub mod workspace;

pub use activity::*;
pub use rbac::*;
pub use search::*;
pub use workspace::*;
