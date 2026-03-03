// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only
//! Ontology layer for AI agent discoverability.
//!
//! Provides a structured, machine-readable description of:
//! - Entity types across all providers (session, message, tool_call, etc.)
//! - Semantic tags that map provider-specific field names to universal concepts
//! - Cross-provider field mappings (field A in provider X ≡ field B in provider Y)
//! - Migration paths between schema versions
//! - Relationship graphs between entities
//!
//! AI agents can query the ontology to understand what data exists,
//! where it lives, how to access it, and how to translate between providers.

use crate::schema::types::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// Semantic Tags
// ============================================================================

/// A semantic tag represents a universal concept that may appear under
/// different field names in different providers.
///
/// Example: The concept "session creation time" is stored as:
///   - `creationDate` in Copilot Chat
///   - `dateCreated` in Continue.dev
///   - `timestamp` (of first message) in Claude Code
///
/// The semantic tag `created_at` unifies all of these.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticTag {
    /// Canonical tag name (e.g., "created_at", "session_id", "message_text")
    pub tag: String,
    /// Human-readable description
    pub description: String,
    /// The universal data type for this concept
    pub canonical_type: DataType,
    /// Entity type this tag belongs to
    pub entity: EntityType,
    /// Related tags (e.g., "created_at" is related to "updated_at")
    #[serde(default)]
    pub related_tags: Vec<String>,
}

// ============================================================================
// Entity Types
// ============================================================================

/// High-level entity types that appear across providers
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EntityType {
    /// A chat session / conversation
    Session,
    /// A single message (user or assistant turn)
    Message,
    /// A request-response pair (Copilot Chat's "request" unit)
    RequestResponse,
    /// An AI model
    Model,
    /// A tool/function call
    ToolCall,
    /// An AI agent
    Agent,
    /// A workspace / project context
    Workspace,
    /// Session index / registry metadata
    SessionIndex,
    /// Cache / UI state metadata
    UiState,
}

impl std::fmt::Display for EntityType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Session => write!(f, "session"),
            Self::Message => write!(f, "message"),
            Self::RequestResponse => write!(f, "request_response"),
            Self::Model => write!(f, "model"),
            Self::ToolCall => write!(f, "tool_call"),
            Self::Agent => write!(f, "agent"),
            Self::Workspace => write!(f, "workspace"),
            Self::SessionIndex => write!(f, "session_index"),
            Self::UiState => write!(f, "ui_state"),
        }
    }
}

// ============================================================================
// Entity Relationships
// ============================================================================

/// A relationship between two entity types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityRelationship {
    /// Source entity type
    pub from: EntityType,
    /// Target entity type
    pub to: EntityType,
    /// Relationship kind
    pub kind: RelationshipKind,
    /// Description of the relationship
    pub description: String,
}

/// Kinds of relationships between entities
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RelationshipKind {
    /// One-to-many containment (session contains messages)
    Contains,
    /// Many-to-one reference (message belongs to session)
    BelongsTo,
    /// Many-to-many association (session uses models)
    References,
    /// One-to-one equivalence (session <-> index entry)
    MapsTo,
}

// ============================================================================
// Cross-Provider Mapping
// ============================================================================

/// A mapping between fields in two different provider schemas.
///
/// Used to translate data between providers (e.g., migrating sessions
/// from Copilot to Cursor, or merging sessions from multiple providers).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrossProviderMapping {
    /// Source schema version ID
    pub source_schema: String,
    /// Source field path (dot-separated, e.g., "session.creationDate")
    pub source_field: String,
    /// Target schema version ID
    pub target_schema: String,
    /// Target field path
    pub target_field: String,
    /// Transformation required (if any)
    pub transform: Option<FieldTransform>,
    /// Confidence level (0.0 – 1.0)
    pub confidence: f64,
    /// Semantic tag that links these fields
    pub semantic_tag: String,
}

/// Transformation to apply when mapping a field between providers
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum FieldTransform {
    /// Direct copy (no transformation needed)
    #[serde(rename = "identity")]
    Identity,
    /// Rename only (same value, different key)
    #[serde(rename = "rename")]
    Rename,
    /// Type conversion (e.g., epoch ms → ISO 8601)
    #[serde(rename = "type_convert")]
    TypeConvert { from_type: String, to_type: String },
    /// Value mapping (e.g., "model" → "assistant" for Gemini roles)
    #[serde(rename = "value_map")]
    ValueMap { mapping: HashMap<String, String> },
    /// Structural transformation (e.g., flatten nested object)
    #[serde(rename = "restructure")]
    Restructure { description: String },
    /// Custom transformation requiring code
    #[serde(rename = "custom")]
    Custom { description: String },
}

// ============================================================================
// Migration Path
// ============================================================================

/// Describes how to migrate data from one schema version to another.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationPath {
    /// Source schema version ID
    pub from_schema: String,
    /// Target schema version ID
    pub to_schema: String,
    /// Whether the migration is lossless
    pub lossless: bool,
    /// Ordered list of field mappings to apply
    pub mappings: Vec<CrossProviderMapping>,
    /// Fields that will be lost in migration
    #[serde(default)]
    pub data_loss: Vec<String>,
    /// Fields that will be added (with defaults)
    #[serde(default)]
    pub new_fields: Vec<String>,
    /// Human-readable migration notes
    #[serde(default)]
    pub notes: Vec<String>,
}

// ============================================================================
// Ontology (aggregate)
// ============================================================================

/// The complete ontology over all provider schemas.
///
/// AI agents can query this to:
/// 1. Discover what data is available across providers
/// 2. Understand field semantics and relationships
/// 3. Find equivalent fields across providers
/// 4. Plan data migrations and merges
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ontology {
    /// Version of the ontology specification
    pub version: String,
    /// All known semantic tags (universal field concepts)
    pub semantic_tags: Vec<SemanticTag>,
    /// Entity type relationships
    pub relationships: Vec<EntityRelationship>,
    /// Cross-provider field mappings
    pub mappings: Vec<CrossProviderMapping>,
    /// Known migration paths between schema versions
    pub migration_paths: Vec<MigrationPath>,
    /// Provider capability matrix (provider → set of capabilities)
    pub capabilities: HashMap<String, Vec<String>>,
}

impl Ontology {
    /// Build the default ontology from all known schemas
    pub fn build() -> Self {
        Self {
            version: "1.0.0".into(),
            semantic_tags: build_semantic_tags(),
            relationships: build_relationships(),
            mappings: build_cross_provider_mappings(),
            migration_paths: build_migration_paths(),
            capabilities: build_capability_matrix(),
        }
    }

    /// Find all mappings between two schemas
    pub fn cross_provider_mappings(
        &self,
        source_schema: &str,
        target_schema: &str,
    ) -> Vec<&CrossProviderMapping> {
        self.mappings
            .iter()
            .filter(|m| m.source_schema == source_schema && m.target_schema == target_schema)
            .collect()
    }

    /// Find all fields matching a semantic tag across all schemas
    pub fn find_by_semantic_tag(&self, tag: &str) -> Vec<&CrossProviderMapping> {
        self.mappings
            .iter()
            .filter(|m| m.semantic_tag == tag)
            .collect()
    }

    /// Get migration path between two schema versions
    pub fn migration_path(&self, from: &str, to: &str) -> Option<&MigrationPath> {
        self.migration_paths
            .iter()
            .find(|p| p.from_schema == from && p.to_schema == to)
    }

    /// Get capabilities for a specific provider
    pub fn provider_capabilities(&self, provider: &str) -> Option<&Vec<String>> {
        self.capabilities.get(provider)
    }

    /// Get all entity types used in the ontology
    pub fn entity_types(&self) -> Vec<&EntityType> {
        let mut types: Vec<&EntityType> = self
            .semantic_tags
            .iter()
            .map(|t| &t.entity)
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();
        types.sort_by_key(|e| format!("{}", e));
        types
    }
}

// ============================================================================
// Default Ontology Builders
// ============================================================================

fn build_semantic_tags() -> Vec<SemanticTag> {
    vec![
        // Session-level tags
        SemanticTag {
            tag: "session_id".into(),
            description: "Unique identifier for a chat session".into(),
            canonical_type: DataType::Uuid,
            entity: EntityType::Session,
            related_tags: vec![],
        },
        SemanticTag {
            tag: "title".into(),
            description: "Human-readable session title".into(),
            canonical_type: DataType::String,
            entity: EntityType::Session,
            related_tags: vec![],
        },
        SemanticTag {
            tag: "created_at".into(),
            description: "When the session was created (timestamp)".into(),
            canonical_type: DataType::Timestamp,
            entity: EntityType::Session,
            related_tags: vec!["updated_at".into()],
        },
        SemanticTag {
            tag: "updated_at".into(),
            description: "When the session was last modified (timestamp)".into(),
            canonical_type: DataType::Timestamp,
            entity: EntityType::Session,
            related_tags: vec!["created_at".into()],
        },
        SemanticTag {
            tag: "is_imported".into(),
            description: "Whether the session was imported from another source".into(),
            canonical_type: DataType::Boolean,
            entity: EntityType::Session,
            related_tags: vec![],
        },
        SemanticTag {
            tag: "session_location".into(),
            description: "Where in the IDE the session was initiated (panel, terminal, etc.)"
                .into(),
            canonical_type: DataType::String,
            entity: EntityType::Session,
            related_tags: vec![],
        },
        // Message-level tags
        SemanticTag {
            tag: "message_role".into(),
            description: "The role of a message sender (user, assistant, system, tool)".into(),
            canonical_type: DataType::Enum(vec![
                "user".into(),
                "assistant".into(),
                "system".into(),
                "tool".into(),
            ]),
            entity: EntityType::Message,
            related_tags: vec!["message_text".into()],
        },
        SemanticTag {
            tag: "message_text".into(),
            description: "The text content of a message".into(),
            canonical_type: DataType::String,
            entity: EntityType::Message,
            related_tags: vec!["message_role".into(), "message_parts".into()],
        },
        SemanticTag {
            tag: "message_timestamp".into(),
            description: "When a message was sent/received".into(),
            canonical_type: DataType::Timestamp,
            entity: EntityType::Message,
            related_tags: vec![],
        },
        SemanticTag {
            tag: "message_parts".into(),
            description: "Multi-part message content (multimodal: text, images, code)".into(),
            canonical_type: DataType::Array(Box::new(DataType::Json)),
            entity: EntityType::Message,
            related_tags: vec!["message_text".into()],
        },
        SemanticTag {
            tag: "user_message".into(),
            description: "The user's input message in a request-response pair".into(),
            canonical_type: DataType::Json,
            entity: EntityType::RequestResponse,
            related_tags: vec!["assistant_response".into()],
        },
        SemanticTag {
            tag: "assistant_response".into(),
            description: "The AI's response in a request-response pair".into(),
            canonical_type: DataType::Json,
            entity: EntityType::RequestResponse,
            related_tags: vec!["user_message".into()],
        },
        // Model-level tags
        SemanticTag {
            tag: "model_id".into(),
            description: "Identifier of the AI model used (e.g., 'gpt-4o', 'claude-3.5-sonnet')"
                .into(),
            canonical_type: DataType::String,
            entity: EntityType::Model,
            related_tags: vec![],
        },
        // Agent/tool tags
        SemanticTag {
            tag: "agent".into(),
            description: "AI agent metadata (for agentic sessions)".into(),
            canonical_type: DataType::Json,
            entity: EntityType::Agent,
            related_tags: vec!["tools".into()],
        },
        SemanticTag {
            tag: "tools".into(),
            description: "Available tools/functions for the session".into(),
            canonical_type: DataType::Array(Box::new(DataType::Json)),
            entity: EntityType::ToolCall,
            related_tags: vec!["tool_calls".into()],
        },
        SemanticTag {
            tag: "tool_calls".into(),
            description: "Tool/function invocations made by the assistant".into(),
            canonical_type: DataType::Array(Box::new(DataType::Json)),
            entity: EntityType::ToolCall,
            related_tags: vec!["tools".into()],
        },
        // Context tags
        SemanticTag {
            tag: "context".into(),
            description: "Context data provided to the model (files, selections, terminal)".into(),
            canonical_type: DataType::Json,
            entity: EntityType::RequestResponse,
            related_tags: vec![],
        },
        // State tags
        SemanticTag {
            tag: "response_state".into(),
            description: "State of the response: Pending, Complete, Cancelled, Failed, NeedsInput"
                .into(),
            canonical_type: DataType::Enum(vec![
                "pending".into(),
                "complete".into(),
                "cancelled".into(),
                "failed".into(),
                "needs_input".into(),
            ]),
            entity: EntityType::RequestResponse,
            related_tags: vec!["is_canceled".into()],
        },
        SemanticTag {
            tag: "is_canceled".into(),
            description: "Whether a request was canceled by the user".into(),
            canonical_type: DataType::Boolean,
            entity: EntityType::RequestResponse,
            related_tags: vec!["response_state".into()],
        },
        // Cost/performance tags
        SemanticTag {
            tag: "cost".into(),
            description: "Monetary cost of the request/response".into(),
            canonical_type: DataType::Float,
            entity: EntityType::RequestResponse,
            related_tags: vec!["latency".into()],
        },
        SemanticTag {
            tag: "latency".into(),
            description: "Time taken for the request to complete (milliseconds)".into(),
            canonical_type: DataType::Integer,
            entity: EntityType::RequestResponse,
            related_tags: vec!["cost".into()],
        },
        // Schema metadata
        SemanticTag {
            tag: "schema_version".into(),
            description: "Version number of the session format schema".into(),
            canonical_type: DataType::Integer,
            entity: EntityType::Session,
            related_tags: vec![],
        },
        SemanticTag {
            tag: "event_type".into(),
            description: "Type of event in event-sourced formats (snapshot, update)".into(),
            canonical_type: DataType::String,
            entity: EntityType::Session,
            related_tags: vec!["event_data".into()],
        },
        SemanticTag {
            tag: "event_data".into(),
            description: "Payload of an event in event-sourced formats".into(),
            canonical_type: DataType::Json,
            entity: EntityType::Session,
            related_tags: vec!["event_type".into()],
        },
        // UI state tags
        SemanticTag {
            tag: "resource_uri".into(),
            description: "URI identifying a session resource in the IDE".into(),
            canonical_type: DataType::Uri,
            entity: EntityType::UiState,
            related_tags: vec![],
        },
        SemanticTag {
            tag: "is_empty".into(),
            description: "Whether a session has no messages/requests".into(),
            canonical_type: DataType::Boolean,
            entity: EntityType::SessionIndex,
            related_tags: vec![],
        },
        SemanticTag {
            tag: "timing".into(),
            description: "Session timing metadata (created, last request, last response)".into(),
            canonical_type: DataType::Object("Timing".into()),
            entity: EntityType::SessionIndex,
            related_tags: vec!["created_at".into(), "updated_at".into()],
        },
        SemanticTag {
            tag: "user_name".into(),
            description: "Display name of the human user".into(),
            canonical_type: DataType::String,
            entity: EntityType::Session,
            related_tags: vec!["assistant_name".into()],
        },
        SemanticTag {
            tag: "assistant_name".into(),
            description: "Display name of the AI assistant".into(),
            canonical_type: DataType::String,
            entity: EntityType::Session,
            related_tags: vec!["user_name".into()],
        },
        SemanticTag {
            tag: "workspace_id".into(),
            description: "Identifier of the workspace/project".into(),
            canonical_type: DataType::String,
            entity: EntityType::Workspace,
            related_tags: vec![],
        },
        SemanticTag {
            tag: "model_state".into(),
            description: "Model processing state (Pending/Complete/Cancelled)".into(),
            canonical_type: DataType::Object("ModelState".into()),
            entity: EntityType::RequestResponse,
            related_tags: vec!["response_state".into()],
        },
        SemanticTag {
            tag: "completed_at".into(),
            description: "Timestamp when model finished processing".into(),
            canonical_type: DataType::Timestamp,
            entity: EntityType::RequestResponse,
            related_tags: vec!["message_timestamp".into()],
        },
        SemanticTag {
            tag: "completion_state".into(),
            description: "Numeric completion state (0=Pending, 1=Complete, 2=Cancelled)".into(),
            canonical_type: DataType::Integer,
            entity: EntityType::RequestResponse,
            related_tags: vec!["response_state".into(), "model_state".into()],
        },
        SemanticTag {
            tag: "streaming".into(),
            description: "Whether the response should be streamed".into(),
            canonical_type: DataType::Boolean,
            entity: EntityType::RequestResponse,
            related_tags: vec![],
        },
        SemanticTag {
            tag: "temperature".into(),
            description: "Sampling temperature for model generation".into(),
            canonical_type: DataType::Float,
            entity: EntityType::RequestResponse,
            related_tags: vec![],
        },
        SemanticTag {
            tag: "request_id".into(),
            description: "Unique identifier for a request within a session".into(),
            canonical_type: DataType::Uuid,
            entity: EntityType::RequestResponse,
            related_tags: vec!["session_id".into()],
        },
        SemanticTag {
            tag: "session_index".into(),
            description: "Index/registry of all session IDs and their metadata".into(),
            canonical_type: DataType::Json,
            entity: EntityType::SessionIndex,
            related_tags: vec![],
        },
        SemanticTag {
            tag: "index_version".into(),
            description: "Version of the session index format".into(),
            canonical_type: DataType::Integer,
            entity: EntityType::SessionIndex,
            related_tags: vec!["schema_version".into()],
        },
        SemanticTag {
            tag: "last_read".into(),
            description: "Timestamp when a session was last read by the user".into(),
            canonical_type: DataType::Timestamp,
            entity: EntityType::UiState,
            related_tags: vec![],
        },
        SemanticTag {
            tag: "messages".into(),
            description: "Collection of messages/requests in a session".into(),
            canonical_type: DataType::Array(Box::new(DataType::Json)),
            entity: EntityType::Session,
            related_tags: vec!["message_text".into(), "message_role".into()],
        },
    ]
}

fn build_relationships() -> Vec<EntityRelationship> {
    vec![
        EntityRelationship {
            from: EntityType::Session,
            to: EntityType::RequestResponse,
            kind: RelationshipKind::Contains,
            description: "A session contains zero or more request-response pairs".into(),
        },
        EntityRelationship {
            from: EntityType::Session,
            to: EntityType::Message,
            kind: RelationshipKind::Contains,
            description: "A session contains an ordered sequence of messages".into(),
        },
        EntityRelationship {
            from: EntityType::RequestResponse,
            to: EntityType::Message,
            kind: RelationshipKind::Contains,
            description: "Each request-response pair contains a user message and assistant reply"
                .into(),
        },
        EntityRelationship {
            from: EntityType::RequestResponse,
            to: EntityType::ToolCall,
            kind: RelationshipKind::Contains,
            description: "A request may invoke zero or more tool calls".into(),
        },
        EntityRelationship {
            from: EntityType::Session,
            to: EntityType::Model,
            kind: RelationshipKind::References,
            description: "A session may use one or more AI models".into(),
        },
        EntityRelationship {
            from: EntityType::Session,
            to: EntityType::Agent,
            kind: RelationshipKind::References,
            description: "An agentic session references an AI agent identity".into(),
        },
        EntityRelationship {
            from: EntityType::Session,
            to: EntityType::Workspace,
            kind: RelationshipKind::BelongsTo,
            description: "A session belongs to a workspace/project".into(),
        },
        EntityRelationship {
            from: EntityType::Session,
            to: EntityType::SessionIndex,
            kind: RelationshipKind::MapsTo,
            description: "Each session has a corresponding index entry for UI display".into(),
        },
        EntityRelationship {
            from: EntityType::SessionIndex,
            to: EntityType::UiState,
            kind: RelationshipKind::MapsTo,
            description: "Index entries map to UI state (cache, read timestamps)".into(),
        },
        EntityRelationship {
            from: EntityType::Workspace,
            to: EntityType::Session,
            kind: RelationshipKind::Contains,
            description: "A workspace contains multiple sessions".into(),
        },
    ]
}

fn build_cross_provider_mappings() -> Vec<CrossProviderMapping> {
    let mut mappings = Vec::new();

    // Copilot JSON v3 → Copilot JSONL v1
    mappings.extend(copilot_json_to_jsonl_mappings());

    // Copilot JSON v3 → Cursor v1
    mappings.extend(copilot_to_cursor_mappings());

    // Copilot JSON v3 → OpenAI API v1
    mappings.extend(copilot_to_openai_mappings());

    // Copilot JSON v3 → Claude Code v1
    mappings.extend(copilot_to_claude_code_mappings());

    // Claude Code v1 → OpenAI API v1
    mappings.extend(claude_code_to_openai_mappings());

    mappings
}

// --- Copilot JSON v3 → Copilot JSONL v1 ---

fn copilot_json_to_jsonl_mappings() -> Vec<CrossProviderMapping> {
    vec![
        CrossProviderMapping {
            source_schema: "copilot-json-v3".into(),
            source_field: "session.version".into(),
            target_schema: "copilot-jsonl-v1".into(),
            target_field: "data.version".into(),
            transform: Some(FieldTransform::Restructure {
                description: "Wrapped inside kind:0 event envelope".into(),
            }),
            confidence: 1.0,
            semantic_tag: "schema_version".into(),
        },
        CrossProviderMapping {
            source_schema: "copilot-json-v3".into(),
            source_field: "session.sessionId".into(),
            target_schema: "copilot-jsonl-v1".into(),
            target_field: "data.sessionId".into(),
            transform: Some(FieldTransform::Identity),
            confidence: 1.0,
            semantic_tag: "session_id".into(),
        },
        CrossProviderMapping {
            source_schema: "copilot-json-v3".into(),
            source_field: "session.creationDate".into(),
            target_schema: "copilot-jsonl-v1".into(),
            target_field: "data.creationDate".into(),
            transform: Some(FieldTransform::Identity),
            confidence: 1.0,
            semantic_tag: "created_at".into(),
        },
        CrossProviderMapping {
            source_schema: "copilot-json-v3".into(),
            source_field: "session.requests".into(),
            target_schema: "copilot-jsonl-v1".into(),
            target_field: "data.requests".into(),
            transform: Some(FieldTransform::Restructure {
                description: "Response format changed from {value:[{value:text}]} to [{kind:\"\",value:text}]".into(),
            }),
            confidence: 0.9,
            semantic_tag: "messages".into(),
        },
    ]
}

// --- Copilot JSON v3 → Cursor v1 ---

fn copilot_to_cursor_mappings() -> Vec<CrossProviderMapping> {
    vec![
        CrossProviderMapping {
            source_schema: "copilot-json-v3".into(),
            source_field: "session.sessionId".into(),
            target_schema: "cursor-json-v1".into(),
            target_field: "session.sessionId".into(),
            transform: Some(FieldTransform::Identity),
            confidence: 1.0,
            semantic_tag: "session_id".into(),
        },
        CrossProviderMapping {
            source_schema: "copilot-json-v3".into(),
            source_field: "session.creationDate".into(),
            target_schema: "cursor-json-v1".into(),
            target_field: "session.creationDate".into(),
            transform: Some(FieldTransform::Identity),
            confidence: 1.0,
            semantic_tag: "created_at".into(),
        },
        CrossProviderMapping {
            source_schema: "copilot-json-v3".into(),
            source_field: "session.requests".into(),
            target_schema: "cursor-json-v1".into(),
            target_field: "session.requests".into(),
            transform: Some(FieldTransform::Identity),
            confidence: 0.95,
            semantic_tag: "messages".into(),
        },
    ]
}

// --- Copilot JSON v3 → OpenAI API v1 ---

fn copilot_to_openai_mappings() -> Vec<CrossProviderMapping> {
    vec![
        CrossProviderMapping {
            source_schema: "copilot-json-v3".into(),
            source_field: "request.message.text".into(),
            target_schema: "openai-api-openai-api-v1".into(),
            target_field: "messages[].content".into(),
            transform: Some(FieldTransform::Restructure {
                description: "Extract text from ChatMessage and set role='user'".into(),
            }),
            confidence: 0.9,
            semantic_tag: "message_text".into(),
        },
        CrossProviderMapping {
            source_schema: "copilot-json-v3".into(),
            source_field: "request.response".into(),
            target_schema: "openai-api-openai-api-v1".into(),
            target_field: "messages[].content".into(),
            transform: Some(FieldTransform::Custom {
                description: "Extract text from response value array and set role='assistant'"
                    .into(),
            }),
            confidence: 0.85,
            semantic_tag: "assistant_response".into(),
        },
        CrossProviderMapping {
            source_schema: "copilot-json-v3".into(),
            source_field: "request.modelId".into(),
            target_schema: "openai-api-openai-api-v1".into(),
            target_field: "model".into(),
            transform: Some(FieldTransform::Identity),
            confidence: 0.95,
            semantic_tag: "model_id".into(),
        },
    ]
}

// --- Copilot JSON v3 → Claude Code v1 ---

fn copilot_to_claude_code_mappings() -> Vec<CrossProviderMapping> {
    vec![
        CrossProviderMapping {
            source_schema: "copilot-json-v3".into(),
            source_field: "request.message.text".into(),
            target_schema: "claude-code-jsonl-v1".into(),
            target_field: "message.content".into(),
            transform: Some(FieldTransform::Restructure {
                description: "Set type='human' and wrap in message object".into(),
            }),
            confidence: 0.85,
            semantic_tag: "message_text".into(),
        },
        CrossProviderMapping {
            source_schema: "copilot-json-v3".into(),
            source_field: "request.timestamp".into(),
            target_schema: "claude-code-jsonl-v1".into(),
            target_field: "timestamp".into(),
            transform: Some(FieldTransform::TypeConvert {
                from_type: "epoch_ms".into(),
                to_type: "iso8601".into(),
            }),
            confidence: 0.9,
            semantic_tag: "message_timestamp".into(),
        },
    ]
}

// --- Claude Code v1 → OpenAI API v1 ---

fn claude_code_to_openai_mappings() -> Vec<CrossProviderMapping> {
    vec![
        CrossProviderMapping {
            source_schema: "claude-code-jsonl-v1".into(),
            source_field: "type".into(),
            target_schema: "openai-api-openai-api-v1".into(),
            target_field: "messages[].role".into(),
            transform: Some(FieldTransform::ValueMap {
                mapping: HashMap::from([
                    ("human".into(), "user".into()),
                    ("assistant".into(), "assistant".into()),
                    ("system".into(), "system".into()),
                    ("tool_use".into(), "assistant".into()),
                    ("tool_result".into(), "tool".into()),
                ]),
            }),
            confidence: 0.9,
            semantic_tag: "message_role".into(),
        },
        CrossProviderMapping {
            source_schema: "claude-code-jsonl-v1".into(),
            source_field: "message.content".into(),
            target_schema: "openai-api-openai-api-v1".into(),
            target_field: "messages[].content".into(),
            transform: Some(FieldTransform::Identity),
            confidence: 0.95,
            semantic_tag: "message_text".into(),
        },
    ]
}

// ============================================================================
// Migration Paths
// ============================================================================

fn build_migration_paths() -> Vec<MigrationPath> {
    vec![
        // Copilot JSON v3 → JSONL v1 (the big format transition)
        MigrationPath {
            from_schema: "copilot-json-v3".into(),
            to_schema: "copilot-jsonl-v1".into(),
            lossless: false,
            mappings: copilot_json_to_jsonl_mappings(),
            data_loss: vec![
                "Response format changes (legacy value array → typed parts array)".into(),
            ],
            new_fields: vec![
                "modelState (required for VS Code to show session)".into(),
                "timeSpentWaiting".into(),
                "Event envelope (kind, data)".into(),
            ],
            notes: vec![
                "Major format transition from single JSON to event-sourced JSONL".into(),
                "Response extraction logic must change".into(),
                "Index format changes from UUID array to UUID→entry map".into(),
                "Model cache (agentSessions.model.cache) must be populated".into(),
                "File extension changes from .json to .jsonl".into(),
            ],
        },
        // Copilot JSONL v1 → JSON v3 (reverse migration for backwards compat)
        MigrationPath {
            from_schema: "copilot-jsonl-v1".into(),
            to_schema: "copilot-json-v3".into(),
            lossless: false,
            mappings: vec![], // Reverse of json_to_jsonl
            data_loss: vec![
                "modelState field dropped".into(),
                "timeSpentWaiting field dropped".into(),
                "Event history lost (only kind:0 snapshot preserved)".into(),
                "Incremental updates (kind:1, kind:2) discarded".into(),
            ],
            new_fields: vec![],
            notes: vec![
                "Reverse migration for backwards compatibility with older VS Code versions".into(),
                "Compact JSONL to single snapshot first, then unwrap event envelope".into(),
                "Response parts array must be converted back to legacy format".into(),
            ],
        },
    ]
}

// ============================================================================
// Capability Matrix
// ============================================================================

fn build_capability_matrix() -> HashMap<String, Vec<String>> {
    HashMap::from([
        (
            "copilot".into(),
            vec![
                "session_storage".into(),
                "session_index".into(),
                "model_cache".into(),
                "state_cache".into(),
                "event_sourcing".into(),
                "agent_mode".into(),
                "tool_calling".into(),
                "multi_model".into(),
                "mcp".into(),
                "checkpoints".into(),
            ],
        ),
        (
            "cursor".into(),
            vec![
                "session_storage".into(),
                "multi_model".into(),
                "agent_mode".into(),
                "tool_calling".into(),
            ],
        ),
        (
            "claude-code".into(),
            vec![
                "session_storage".into(),
                "tool_calling".into(),
                "agent_mode".into(),
                "cost_tracking".into(),
                "mcp".into(),
            ],
        ),
        (
            "codex-cli".into(),
            vec![
                "session_storage".into(),
                "tool_calling".into(),
                "agent_mode".into(),
            ],
        ),
        (
            "gemini-cli".into(),
            vec![
                "session_storage".into(),
                "tool_calling".into(),
                "agent_mode".into(),
                "multi_modal".into(),
            ],
        ),
        (
            "continue-dev".into(),
            vec![
                "session_storage".into(),
                "multi_model".into(),
                "multi_provider".into(),
            ],
        ),
        (
            "openai-api".into(),
            vec![
                "chat_completions".into(),
                "tool_calling".into(),
                "streaming".into(),
                "multi_model".into(),
                "embeddings".into(),
            ],
        ),
    ])
}
