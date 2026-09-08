// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
//! # Schema Registry & Ontology
//!
//! Persistent, versioned database schemas for every AI chat provider and format
//! version, plus an ontology layer that makes schemas discoverable by AI agents.
//!
//! ## Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────┐
//! │                    Schema Registry                          │
//! │  ┌─────────────┐ ┌────────────-─┐ ┌─────────────┐           │
//! │  │  Copilot v3 │ │ Copilot JSONL│ │  Cursor v1  │  ...      │
//! │  │  (JSON)     │ │  (0.37+)     │ │             │           │
//! │  └─────────────┘ └──────────────┘ └─────────────┘           │
//! ├─────────────────────────────────────────────────────────────┤
//! │                    Ontology Layer                           │
//! │  • Entity types, relationships, field semantics             │
//! │  • Cross-provider mappings (field A in X ≡ field B in Y)    │
//! │  • Version migration paths                                  │
//! │  • Machine-readable capability descriptors                  │
//! └─────────────────────────────────────────────────────────────┘
//! ```
//!
//! ## Usage
//!
//! ```
//! use ironbridge::schema::SchemaRegistry;
//! use std::path::Path;
//!
//! let registry = SchemaRegistry::new();
//!
//! // List all known schemas
//! for schema in registry.list_schemas() {
//!     println!("{}: {} fields", schema.id(), schema.field_count());
//! }
//!
//! // Detect the schema of a workspace directory. Note that an absent
//! // directory is not an error here -- it reports no confident match, which
//! // is a different thing from failing.
//! let detected = registry.detect_schema_from_workspace(Path::new("/nonexistent"))?;
//! println!("{detected:?}");
//!
//! // Query the ontology
//! let ontology = registry.ontology();
//! let mappings = ontology.cross_provider_mappings("copilot-jsonl-v1", "cursor-v1");
//! println!("{} mapping(s)", mappings.len());
//! # Ok::<(), anyhow::Error>(())
//! ```

mod ontology;
mod registry;
mod types;
mod versions;

pub use ontology::{
    CrossProviderMapping, EntityRelationship, EntityType, FieldTransform, MigrationPath, Ontology,
    RelationshipKind, SemanticTag,
};
pub use registry::{DetectedSchema, SchemaRegistry};
pub use types::{
    DataType, DbKeySchema, FieldConstraint, FieldSchema, FormatType, ProviderSchema, SchemaVersion,
    SessionFormatSchema, StorageLocation, StorageType,
};
pub use versions::{
    build_all_provider_schemas, claude_code_v1, codex_cli_v1, continue_dev_v1, copilot_json_v3,
    copilot_jsonl_v1, cursor_v1, gemini_cli_v1, openai_api_v1,
};
