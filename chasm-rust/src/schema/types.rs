// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only
//! Core schema type definitions
//!
//! Defines the vocabulary for describing AI chat provider database schemas
//! in a machine-readable, version-aware format.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// Schema Version Identifier
// ============================================================================

/// Unique identifier for a provider schema version.
///
/// Format: `{provider}-{format}-v{version}`
/// Examples: `copilot-json-v3`, `copilot-jsonl-v1`, `cursor-json-v1`
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct SchemaVersion {
    /// Provider identifier (e.g., "copilot", "cursor", "claude-code")
    pub provider: String,
    /// Format identifier (e.g., "json", "jsonl", "sqlite", "markdown")
    pub format: FormatType,
    /// Schema version number (monotonically increasing per provider+format)
    pub version: u32,
    /// Human-readable label
    pub label: String,
}

impl SchemaVersion {
    /// Create a new schema version identifier
    pub fn new(provider: &str, format: FormatType, version: u32, label: &str) -> Self {
        Self {
            provider: provider.to_string(),
            format,
            version,
            label: label.to_string(),
        }
    }

    /// Get the canonical string ID: `{provider}-{format}-v{version}`
    pub fn id(&self) -> String {
        format!(
            "{}-{}-v{}",
            self.provider,
            self.format.as_str(),
            self.version
        )
    }
}

impl std::fmt::Display for SchemaVersion {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.id())
    }
}

// ============================================================================
// Format & Storage Types
// ============================================================================

/// Session file format
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum FormatType {
    /// Single JSON object per file
    Json,
    /// JSON Lines (one event per line, event-sourced)
    Jsonl,
    /// SQLite database
    Sqlite,
    /// Markdown text files
    Markdown,
    /// Binary / proprietary format
    Binary,
    /// OpenAI API-compatible JSON
    OpenAiApi,
}

impl FormatType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Json => "json",
            Self::Jsonl => "jsonl",
            Self::Sqlite => "sqlite",
            Self::Markdown => "markdown",
            Self::Binary => "binary",
            Self::OpenAiApi => "openai-api",
        }
    }
}

impl std::fmt::Display for FormatType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Where session data is stored
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum StorageType {
    /// Flat files in a directory (one file per session)
    FilePerSession,
    /// SQLite database (state.vscdb or custom)
    SqliteDb,
    /// SQLite key-value store (VS Code ItemTable pattern)
    SqliteKeyValue,
    /// Cloud API (no local storage, fetched on demand)
    CloudApi,
    /// Hybrid: files on disk + metadata in SQLite
    Hybrid,
}

// ============================================================================
// Storage Location
// ============================================================================

/// Platform-aware storage location descriptor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageLocation {
    /// Description of where data lives
    pub description: String,
    /// Path pattern with platform placeholders
    /// e.g., `{APPDATA}/Code/User/workspaceStorage/{hash}/chatSessions/`
    pub path_pattern: String,
    /// Platform-specific path overrides
    #[serde(default)]
    pub platform_paths: HashMap<String, String>,
    /// Storage mechanism
    pub storage_type: StorageType,
    /// File extension filter (e.g., ".jsonl", ".json")
    #[serde(default)]
    pub file_extensions: Vec<String>,
}

// ============================================================================
// Provider Schema (top-level)
// ============================================================================

/// Complete schema definition for one provider at one version.
///
/// This is the primary unit of the schema registry — it fully describes
/// how a provider stores, structures, and indexes chat session data.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderSchema {
    /// Unique version identifier
    pub version: SchemaVersion,

    /// Extension/application version range this schema applies to
    /// e.g., "0.25.0" .. "0.36.99" for Copilot JSON
    pub extension_version_min: Option<String>,
    pub extension_version_max: Option<String>,

    /// Minimum host application version (e.g., VS Code 1.98.0)
    pub host_version_min: Option<String>,

    /// When this schema was first observed / introduced
    pub introduced: Option<String>,
    /// When this schema was deprecated (superseded by a newer version)
    pub deprecated: Option<String>,

    /// Where session data is stored
    pub storage: StorageLocation,

    /// Session file/record schema
    pub session_schema: SessionFormatSchema,

    /// Database keys and their schemas (for SQLite key-value stores like state.vscdb)
    #[serde(default)]
    pub db_keys: Vec<DbKeySchema>,

    /// Human-readable notes about this schema version
    #[serde(default)]
    pub notes: Vec<String>,

    /// Known breaking changes from the previous version
    #[serde(default)]
    pub breaking_changes: Vec<String>,

    /// Tags for ontology classification
    #[serde(default)]
    pub tags: Vec<String>,
}

impl ProviderSchema {
    /// Get the total number of fields in the session schema
    pub fn field_count(&self) -> usize {
        self.session_schema.fields.len()
    }

    /// Get the schema ID
    pub fn id(&self) -> String {
        self.version.id()
    }
}

// ============================================================================
// Session Format Schema
// ============================================================================

/// Schema for the session file/record format
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionFormatSchema {
    /// Top-level description
    pub description: String,
    /// The format type
    pub format: FormatType,
    /// List of fields with types and constraints
    pub fields: Vec<FieldSchema>,
    /// Nested object schemas (e.g., "request", "message", "response")
    #[serde(default)]
    pub nested_objects: HashMap<String, Vec<FieldSchema>>,
    /// Example JSON for this format
    #[serde(default)]
    pub example: Option<serde_json::Value>,
}

// ============================================================================
// Field Schema
// ============================================================================

/// Schema for a single field in a session record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldSchema {
    /// Field name (as it appears in the JSON/data)
    pub name: String,
    /// camelCase name used in serialization
    #[serde(default)]
    pub serialized_name: Option<String>,
    /// Data type
    pub data_type: DataType,
    /// Whether this field is required
    #[serde(default)]
    pub required: bool,
    /// Default value (as JSON)
    #[serde(default)]
    pub default_value: Option<serde_json::Value>,
    /// Human-readable description
    pub description: String,
    /// Constraints (value ranges, patterns, enums)
    #[serde(default)]
    pub constraints: Vec<FieldConstraint>,
    /// Semantic tag for ontology mapping
    #[serde(default)]
    pub semantic_tag: Option<String>,
    /// Version this field was introduced
    #[serde(default)]
    pub since_version: Option<String>,
    /// Version this field was removed
    #[serde(default)]
    pub removed_in: Option<String>,
}

/// Supported data types
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DataType {
    String,
    Integer,
    Float,
    Boolean,
    Timestamp,
    Uuid,
    Json,
    Array(Box<DataType>),
    Object(std::string::String),
    Enum(Vec<std::string::String>),
    Uri,
    Base64,
    Optional(Box<DataType>),
}

impl std::fmt::Display for DataType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::String => write!(f, "string"),
            Self::Integer => write!(f, "integer"),
            Self::Float => write!(f, "float"),
            Self::Boolean => write!(f, "boolean"),
            Self::Timestamp => write!(f, "timestamp"),
            Self::Uuid => write!(f, "uuid"),
            Self::Json => write!(f, "json"),
            Self::Array(inner) => write!(f, "array<{}>", inner),
            Self::Object(name) => write!(f, "object<{}>", name),
            Self::Enum(variants) => write!(f, "enum({})", variants.join("|")),
            Self::Uri => write!(f, "uri"),
            Self::Base64 => write!(f, "base64"),
            Self::Optional(inner) => write!(f, "optional<{}>", inner),
        }
    }
}

/// Constraints on field values
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum FieldConstraint {
    /// Minimum value (inclusive)
    #[serde(rename = "min")]
    Min { value: serde_json::Value },
    /// Maximum value (inclusive)
    #[serde(rename = "max")]
    Max { value: serde_json::Value },
    /// Allowed values
    #[serde(rename = "enum")]
    Enum { values: Vec<serde_json::Value> },
    /// Regex pattern
    #[serde(rename = "pattern")]
    Pattern { pattern: String },
    /// Reference to another entity
    #[serde(rename = "foreign_key")]
    ForeignKey { entity: String, field: String },
}

// ============================================================================
// Database Key Schema (for SQLite KV stores)
// ============================================================================

/// Schema for a key in a SQLite key-value store (like VS Code's state.vscdb)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbKeySchema {
    /// The key name (e.g., "chat.ChatSessionStore.index")
    pub key: String,
    /// Human-readable description
    pub description: String,
    /// The data type of the value (typically JSON)
    pub value_type: DataType,
    /// Schema of the JSON value (if value_type is Json/Object)
    #[serde(default)]
    pub value_fields: Vec<FieldSchema>,
    /// Whether this key is required for the provider to function
    #[serde(default)]
    pub required: bool,
    /// Version this key was introduced
    #[serde(default)]
    pub since_version: Option<String>,
    /// Version this key was removed/renamed
    #[serde(default)]
    pub removed_in: Option<String>,
    /// If renamed, the new key name
    #[serde(default)]
    pub renamed_to: Option<String>,
}
