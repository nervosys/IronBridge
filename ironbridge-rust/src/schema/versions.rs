// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
//! Versioned schema definitions for every known AI chat provider.
//!
//! Each function returns a [`ProviderSchema`] describing the exact data layout
//! for a specific provider at a specific version. These are the ground-truth
//! definitions that the schema registry and ontology layer build upon.

use crate::schema::types::*;
use std::collections::HashMap;

// ============================================================================
// VS Code Copilot Chat — JSON format (0.25.x – 0.36.x)
// ============================================================================

/// VS Code Copilot Chat JSON format (extensions 0.25.0 – 0.36.99).
///
/// Sessions stored as single JSON objects in individual files under
/// `{workspaceStorage}/{hash}/chatSessions/{uuid}.json`.
/// Metadata stored in `state.vscdb` SQLite key-value store.
pub fn copilot_json_v3() -> ProviderSchema {
    ProviderSchema {
        version: SchemaVersion::new("copilot", FormatType::Json, 3, "Copilot Chat JSON v3"),
        extension_version_min: Some("0.25.0".into()),
        extension_version_max: Some("0.36.99".into()),
        host_version_min: Some("1.98.0".into()),
        introduced: Some("2025-02".into()),
        deprecated: Some("2026-01".into()),
        storage: StorageLocation {
            description: "VS Code workspace storage, one JSON file per session".into(),
            path_pattern: "{APPDATA}/Code/User/workspaceStorage/{hash}/chatSessions/{uuid}.json"
                .into(),
            platform_paths: HashMap::from([
                (
                    "windows".into(),
                    "%APPDATA%/Code/User/workspaceStorage/{hash}/chatSessions/".into(),
                ),
                (
                    "macos".into(),
                    "~/Library/Application Support/Code/User/workspaceStorage/{hash}/chatSessions/"
                        .into(),
                ),
                (
                    "linux".into(),
                    "~/.config/Code/User/workspaceStorage/{hash}/chatSessions/".into(),
                ),
            ]),
            storage_type: StorageType::Hybrid,
            file_extensions: vec![".json".into()],
        },
        session_schema: SessionFormatSchema {
            description: "Single JSON object containing the full session state".into(),
            format: FormatType::Json,
            fields: copilot_session_fields_v3(),
            nested_objects: copilot_nested_objects_v3(),
            example: Some(serde_json::json!({
                "version": 3,
                "sessionId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                "creationDate": 1700000000000_i64,
                "lastMessageDate": 1700001000000_i64,
                "isImported": false,
                "initialLocation": "panel",
                "requests": []
            })),
        },
        db_keys: copilot_db_keys_json(),
        notes: vec![
            "Legacy JSON format used from Copilot Chat 0.25.x through 0.36.x".into(),
            "Session version field is always 3".into(),
            "Response format is {\"value\": [{\"value\": \"text\"}, ...]}".into(),
        ],
        breaking_changes: vec![],
        tags: vec![
            "vscode".into(),
            "copilot".into(),
            "json".into(),
            "file-based".into(),
            "hybrid-storage".into(),
        ],
    }
}

// ============================================================================
// VS Code Copilot Chat — JSONL format (0.37.x – current)
// ============================================================================

/// VS Code Copilot Chat JSONL event-sourced format (extensions 0.37.0+).
///
/// Sessions stored as JSONL files with event-sourced updates:
/// - kind 0: Full session snapshot (first line)
/// - kind 1: Incremental request update
/// - kind 2: Incremental response update
///
/// Verified compatible with extension versions 0.37.x through 0.41.x
/// (VS Code 1.109 through 1.113+) — the on-disk session format has not
/// changed since the JSONL transition.
pub fn copilot_jsonl_v1() -> ProviderSchema {
    ProviderSchema {
        version: SchemaVersion::new("copilot", FormatType::Jsonl, 1, "Copilot Chat JSONL v1"),
        extension_version_min: Some("0.37.0".into()),
        extension_version_max: None,
        host_version_min: Some("1.109.0".into()),
        introduced: Some("2026-01".into()),
        deprecated: None,
        storage: StorageLocation {
            description: "VS Code workspace storage, one JSONL file per session (event-sourced)"
                .into(),
            path_pattern: "{APPDATA}/Code/User/workspaceStorage/{hash}/chatSessions/{uuid}.jsonl"
                .into(),
            platform_paths: HashMap::from([
                (
                    "windows".into(),
                    "%APPDATA%/Code/User/workspaceStorage/{hash}/chatSessions/".into(),
                ),
                (
                    "macos".into(),
                    "~/Library/Application Support/Code/User/workspaceStorage/{hash}/chatSessions/"
                        .into(),
                ),
                (
                    "linux".into(),
                    "~/.config/Code/User/workspaceStorage/{hash}/chatSessions/".into(),
                ),
            ]),
            storage_type: StorageType::Hybrid,
            file_extensions: vec![".jsonl".into()],
        },
        session_schema: SessionFormatSchema {
            description: "JSONL event-sourced format. First line is kind:0 (full snapshot). \
                          Subsequent lines are kind:1 (request update) or kind:2 (response update)."
                .into(),
            format: FormatType::Jsonl,
            fields: copilot_jsonl_event_fields(),
            nested_objects: copilot_nested_objects_jsonl(),
            example: Some(serde_json::json!({
                "kind": 0,
                "data": {
                    "version": 3,
                    "sessionId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                    "creationDate": 1700000000000_i64,
                    "lastMessageDate": 1700001000000_i64,
                    "initialLocation": "panel",
                    "requests": []
                }
            })),
        },
        db_keys: copilot_db_keys_jsonl(),
        notes: vec![
            "JSONL event-sourced format introduced with Copilot Chat 0.37.x (Jan 2026)".into(),
            "kind:0 = full session snapshot, kind:1 = request update, kind:2 = response update"
                .into(),
            "Response format changed to array of parts: [{\"kind\":\"\",\"value\":\"text\"}]".into(),
            "modelState field added: {\"value\": 0|1|2, \"completedAt\": timestamp}".into(),
            "Timing field changed from startTime/endTime to created/lastRequestStarted/lastRequestEnded".into(),
        ],
        breaking_changes: vec![
            "File extension changed from .json to .jsonl".into(),
            "Response format: object → array of typed parts".into(),
            "Timing field names renamed (startTime→created, endTime→lastRequestEnded)".into(),
            "Added modelState field (required for VS Code to show session as non-empty)".into(),
            "Index format changed from array of UUIDs to map of UUID→entry objects".into(),
        ],
        tags: vec![
            "vscode".into(),
            "copilot".into(),
            "jsonl".into(),
            "event-sourced".into(),
            "file-based".into(),
            "hybrid-storage".into(),
        ],
    }
}

// ============================================================================
// Cursor IDE
// ============================================================================

/// Cursor IDE chat session schema.
///
/// Cursor stores sessions in a format similar to VS Code Copilot Chat JSON v3,
/// but in Cursor's own app data directory.
pub fn cursor_v1() -> ProviderSchema {
    ProviderSchema {
        version: SchemaVersion::new("cursor", FormatType::Json, 1, "Cursor Chat v1"),
        extension_version_min: None,
        extension_version_max: None,
        host_version_min: None,
        introduced: Some("2024-01".into()),
        deprecated: None,
        storage: StorageLocation {
            description: "Cursor app data, one JSON file per session in chatSessions/".into(),
            path_pattern: "{APPDATA}/Cursor/User/workspaceStorage/{hash}/chatSessions/{uuid}.json"
                .into(),
            platform_paths: HashMap::from([
                (
                    "windows".into(),
                    "%APPDATA%/Cursor/User/workspaceStorage/{hash}/chatSessions/".into(),
                ),
                (
                    "macos".into(),
                    "~/Library/Application Support/Cursor/User/workspaceStorage/{hash}/chatSessions/"
                        .into(),
                ),
                (
                    "linux".into(),
                    "~/.config/Cursor/User/workspaceStorage/{hash}/chatSessions/".into(),
                ),
            ]),
            storage_type: StorageType::FilePerSession,
            file_extensions: vec![".json".into()],
        },
        session_schema: SessionFormatSchema {
            description: "JSON format similar to Copilot Chat v3, stored in Cursor's workspace storage".into(),
            format: FormatType::Json,
            fields: cursor_session_fields(),
            nested_objects: HashMap::new(),
            example: None,
        },
        db_keys: vec![],
        notes: vec![
            "Cursor uses a VS Code fork with similar session format".into(),
            "Sessions stored in Cursor's own workspaceStorage directory".into(),
            "Field names and structure closely match Copilot Chat JSON v3".into(),
        ],
        breaking_changes: vec![],
        tags: vec![
            "cursor".into(),
            "json".into(),
            "file-based".into(),
            "vscode-fork".into(),
        ],
    }
}

// ============================================================================
// Claude Code (Anthropic)
// ============================================================================

/// Claude Code CLI session schema.
///
/// Claude Code stores sessions as JSONL files in `~/.claude/projects/`.
pub fn claude_code_v1() -> ProviderSchema {
    ProviderSchema {
        version: SchemaVersion::new("claude-code", FormatType::Jsonl, 1, "Claude Code v1"),
        extension_version_min: None,
        extension_version_max: None,
        host_version_min: None,
        introduced: Some("2025-03".into()),
        deprecated: None,
        storage: StorageLocation {
            description: "Claude Code stores JSONL sessions in ~/.claude/projects/{project}/".into(),
            path_pattern: "{HOME}/.claude/projects/{project_hash}/{uuid}.jsonl".into(),
            platform_paths: HashMap::from([
                ("windows".into(), "%USERPROFILE%/.claude/projects/".into()),
                ("macos".into(), "~/.claude/projects/".into()),
                ("linux".into(), "~/.claude/projects/".into()),
            ]),
            storage_type: StorageType::FilePerSession,
            file_extensions: vec![".jsonl".into()],
        },
        session_schema: SessionFormatSchema {
            description: "JSONL format with one message event per line. Each line has type, role, content fields.".into(),
            format: FormatType::Jsonl,
            fields: claude_code_fields(),
            nested_objects: HashMap::new(),
            example: Some(serde_json::json!({
                "type": "human",
                "message": {"role": "user", "content": "Hello"},
                "timestamp": "2025-06-15T10:30:00Z"
            })),
        },
        db_keys: vec![],
        notes: vec![
            "Claude Code CLI stores sessions as JSONL in ~/.claude/projects/".into(),
            "Each line is a message event with type (human/assistant/system/tool_use/tool_result)".into(),
            "Project identified by hash of project path".into(),
        ],
        breaking_changes: vec![],
        tags: vec![
            "anthropic".into(),
            "claude-code".into(),
            "cli".into(),
            "jsonl".into(),
            "file-based".into(),
        ],
    }
}

// ============================================================================
// Codex CLI (OpenAI)
// ============================================================================

/// OpenAI Codex CLI session schema.
///
/// Codex CLI stores sessions as JSONL in `~/.codex/sessions/`.
pub fn codex_cli_v1() -> ProviderSchema {
    ProviderSchema {
        version: SchemaVersion::new("codex-cli", FormatType::Jsonl, 1, "Codex CLI v1"),
        extension_version_min: None,
        extension_version_max: None,
        host_version_min: None,
        introduced: Some("2025-05".into()),
        deprecated: None,
        storage: StorageLocation {
            description: "Codex CLI stores JSONL sessions in ~/.codex/sessions/".into(),
            path_pattern: "{HOME}/.codex/sessions/{uuid}.jsonl".into(),
            platform_paths: HashMap::from([
                ("windows".into(), "%USERPROFILE%/.codex/sessions/".into()),
                ("macos".into(), "~/.codex/sessions/".into()),
                ("linux".into(), "~/.codex/sessions/".into()),
            ]),
            storage_type: StorageType::FilePerSession,
            file_extensions: vec![".jsonl".into()],
        },
        session_schema: SessionFormatSchema {
            description: "JSONL format with OpenAI message events".into(),
            format: FormatType::Jsonl,
            fields: codex_cli_fields(),
            nested_objects: HashMap::new(),
            example: None,
        },
        db_keys: vec![],
        notes: vec![
            "OpenAI Codex CLI stores sessions as JSONL in ~/.codex/sessions/".into(),
            "Uses OpenAI API message format (role/content pairs)".into(),
        ],
        breaking_changes: vec![],
        tags: vec![
            "openai".into(),
            "codex".into(),
            "cli".into(),
            "jsonl".into(),
            "file-based".into(),
        ],
    }
}

// ============================================================================
// Gemini CLI (Google)
// ============================================================================

/// Google Gemini CLI session schema.
///
/// Gemini CLI stores sessions as JSON in `~/.gemini/tmp/`.
pub fn gemini_cli_v1() -> ProviderSchema {
    ProviderSchema {
        version: SchemaVersion::new("gemini-cli", FormatType::Json, 1, "Gemini CLI v1"),
        extension_version_min: None,
        extension_version_max: None,
        host_version_min: None,
        introduced: Some("2025-06".into()),
        deprecated: None,
        storage: StorageLocation {
            description: "Gemini CLI stores JSON sessions in ~/.gemini/tmp/".into(),
            path_pattern: "{HOME}/.gemini/tmp/{session_id}.json".into(),
            platform_paths: HashMap::from([
                ("windows".into(), "%USERPROFILE%/.gemini/tmp/".into()),
                ("macos".into(), "~/.gemini/tmp/".into()),
                ("linux".into(), "~/.gemini/tmp/".into()),
            ]),
            storage_type: StorageType::FilePerSession,
            file_extensions: vec![".json".into()],
        },
        session_schema: SessionFormatSchema {
            description: "JSON format with Google Gemini API message structure".into(),
            format: FormatType::Json,
            fields: gemini_cli_fields(),
            nested_objects: HashMap::new(),
            example: None,
        },
        db_keys: vec![],
        notes: vec![
            "Google Gemini CLI stores sessions as JSON in ~/.gemini/tmp/".into(),
            "Uses Gemini API message format (contents with parts)".into(),
        ],
        breaking_changes: vec![],
        tags: vec![
            "google".into(),
            "gemini".into(),
            "cli".into(),
            "json".into(),
            "file-based".into(),
        ],
    }
}

// ============================================================================
// Continue.dev
// ============================================================================

/// Continue.dev VS Code extension session schema.
///
/// Continue stores sessions in its own format within VS Code's storage.
pub fn continue_dev_v1() -> ProviderSchema {
    ProviderSchema {
        version: SchemaVersion::new("continue-dev", FormatType::Json, 1, "Continue.dev v1"),
        extension_version_min: None,
        extension_version_max: None,
        host_version_min: None,
        introduced: Some("2024-01".into()),
        deprecated: None,
        storage: StorageLocation {
            description: "Continue.dev stores sessions in ~/.continue/sessions/".into(),
            path_pattern: "{HOME}/.continue/sessions/{session_id}.json".into(),
            platform_paths: HashMap::from([
                ("windows".into(), "%USERPROFILE%/.continue/sessions/".into()),
                ("macos".into(), "~/.continue/sessions/".into()),
                ("linux".into(), "~/.continue/sessions/".into()),
            ]),
            storage_type: StorageType::FilePerSession,
            file_extensions: vec![".json".into()],
        },
        session_schema: SessionFormatSchema {
            description: "JSON format with Continue.dev's session structure".into(),
            format: FormatType::Json,
            fields: continue_dev_fields(),
            nested_objects: HashMap::new(),
            example: None,
        },
        db_keys: vec![],
        notes: vec![
            "Continue.dev extension stores sessions in ~/.continue/sessions/".into(),
            "Uses a chat-model-agnostic format with provider metadata".into(),
        ],
        breaking_changes: vec![],
        tags: vec![
            "continuedev".into(),
            "vscode-extension".into(),
            "json".into(),
            "file-based".into(),
        ],
    }
}

// ============================================================================
// OpenAI API (generic)
// ============================================================================

/// Generic OpenAI API-compatible conversation format.
///
/// Used by Ollama, vLLM, LM Studio, LocalAI, Jan, GPT4All, Llamafile,
/// Text Generation WebUI, and cloud providers (Groq, Together, Fireworks, etc.)
pub fn openai_api_v1() -> ProviderSchema {
    ProviderSchema {
        version: SchemaVersion::new("openai-api", FormatType::OpenAiApi, 1, "OpenAI API v1"),
        extension_version_min: None,
        extension_version_max: None,
        host_version_min: None,
        introduced: Some("2023-03".into()),
        deprecated: None,
        storage: StorageLocation {
            description:
                "OpenAI-compatible API — conversations are ephemeral unless saved by the client"
                    .into(),
            path_pattern: "N/A — API-based, no local storage".into(),
            platform_paths: HashMap::new(),
            storage_type: StorageType::CloudApi,
            file_extensions: vec![],
        },
        session_schema: SessionFormatSchema {
            description: "OpenAI Chat Completions API format (messages array with role/content)"
                .into(),
            format: FormatType::OpenAiApi,
            fields: openai_api_fields(),
            nested_objects: openai_api_nested_objects(),
            example: Some(serde_json::json!({
                "model": "gpt-4o",
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": "Hello!"},
                    {"role": "assistant", "content": "Hi! How can I help?"}
                ],
                "temperature": 0.7
            })),
        },
        db_keys: vec![],
        notes: vec![
            "Standard OpenAI Chat Completions API format".into(),
            "Used by: Ollama, vLLM, LM Studio, LocalAI, Jan, GPT4All, Llamafile, TextGen WebUI"
                .into(),
            "Also used by cloud providers: OpenAI, Groq, Together, Fireworks, DeepSeek".into(),
            "Conversations are request/response pairs — no persistent session storage".into(),
        ],
        breaking_changes: vec![],
        tags: vec![
            "openai".into(),
            "api".into(),
            "cloud".into(),
            "local".into(),
            "universal".into(),
        ],
    }
}

// ============================================================================
// Helper: Build all schemas
// ============================================================================

/// Build and return all known provider schemas.
pub fn build_all_provider_schemas() -> Vec<ProviderSchema> {
    vec![
        copilot_json_v3(),
        copilot_jsonl_v1(),
        cursor_v1(),
        claude_code_v1(),
        codex_cli_v1(),
        gemini_cli_v1(),
        continue_dev_v1(),
        openai_api_v1(),
    ]
}

// ============================================================================
// Field definitions — Copilot Chat JSON v3
// ============================================================================

fn copilot_session_fields_v3() -> Vec<FieldSchema> {
    vec![
        FieldSchema {
            name: "version".into(),
            serialized_name: None,
            data_type: DataType::Integer,
            required: true,
            default_value: Some(serde_json::json!(3)),
            description: "Session format version (always 3)".into(),
            constraints: vec![FieldConstraint::Enum {
                values: vec![serde_json::json!(3)],
            }],
            semantic_tag: Some("schema_version".into()),
            since_version: None,
            removed_in: None,
        },
        FieldSchema {
            name: "sessionId".into(),
            serialized_name: Some("session_id".into()),
            data_type: DataType::Uuid,
            required: false,
            default_value: None,
            description: "Unique session identifier (UUID). May be absent in file; use filename."
                .into(),
            constraints: vec![],
            semantic_tag: Some("session_id".into()),
            since_version: None,
            removed_in: None,
        },
        FieldSchema {
            name: "creationDate".into(),
            serialized_name: Some("creation_date".into()),
            data_type: DataType::Timestamp,
            required: true,
            default_value: Some(serde_json::json!(0)),
            description: "Session creation timestamp (milliseconds since epoch)".into(),
            constraints: vec![],
            semantic_tag: Some("created_at".into()),
            since_version: None,
            removed_in: None,
        },
        FieldSchema {
            name: "lastMessageDate".into(),
            serialized_name: Some("last_message_date".into()),
            data_type: DataType::Timestamp,
            required: true,
            default_value: Some(serde_json::json!(0)),
            description: "Last message timestamp (milliseconds since epoch)".into(),
            constraints: vec![],
            semantic_tag: Some("updated_at".into()),
            since_version: None,
            removed_in: None,
        },
        FieldSchema {
            name: "isImported".into(),
            serialized_name: Some("is_imported".into()),
            data_type: DataType::Boolean,
            required: false,
            default_value: Some(serde_json::json!(false)),
            description: "Whether this session was imported from another source".into(),
            constraints: vec![],
            semantic_tag: Some("is_imported".into()),
            since_version: None,
            removed_in: None,
        },
        FieldSchema {
            name: "initialLocation".into(),
            serialized_name: Some("initial_location".into()),
            data_type: DataType::Enum(vec![
                "panel".into(),
                "terminal".into(),
                "notebook".into(),
                "editor".into(),
            ]),
            required: true,
            default_value: Some(serde_json::json!("panel")),
            description: "Where the session was initiated in VS Code".into(),
            constraints: vec![],
            semantic_tag: Some("session_location".into()),
            since_version: None,
            removed_in: None,
        },
        FieldSchema {
            name: "customTitle".into(),
            serialized_name: Some("custom_title".into()),
            data_type: DataType::Optional(Box::new(DataType::String)),
            required: false,
            default_value: None,
            description: "User-set title for the session".into(),
            constraints: vec![],
            semantic_tag: Some("title".into()),
            since_version: None,
            removed_in: None,
        },
        FieldSchema {
            name: "requesterUsername".into(),
            serialized_name: Some("requester_username".into()),
            data_type: DataType::Optional(Box::new(DataType::String)),
            required: false,
            default_value: None,
            description: "Display name of the user who initiated the session".into(),
            constraints: vec![],
            semantic_tag: Some("user_name".into()),
            since_version: None,
            removed_in: None,
        },
        FieldSchema {
            name: "responderUsername".into(),
            serialized_name: Some("responder_username".into()),
            data_type: DataType::Optional(Box::new(DataType::String)),
            required: false,
            default_value: None,
            description: "Display name of the AI responder".into(),
            constraints: vec![],
            semantic_tag: Some("assistant_name".into()),
            since_version: None,
            removed_in: None,
        },
        FieldSchema {
            name: "requests".into(),
            serialized_name: None,
            data_type: DataType::Array(Box::new(DataType::Object("ChatRequest".into()))),
            required: true,
            default_value: Some(serde_json::json!([])),
            description: "Array of chat request/response pairs".into(),
            constraints: vec![],
            semantic_tag: Some("messages".into()),
            since_version: None,
            removed_in: None,
        },
    ]
}

fn copilot_nested_objects_v3() -> HashMap<String, Vec<FieldSchema>> {
    let mut map = HashMap::new();

    map.insert(
        "ChatRequest".into(),
        vec![
            FieldSchema {
                name: "timestamp".into(),
                serialized_name: None,
                data_type: DataType::Optional(Box::new(DataType::Timestamp)),
                required: false,
                default_value: None,
                description: "Request timestamp (milliseconds since epoch)".into(),
                constraints: vec![],
                semantic_tag: Some("message_timestamp".into()),
                since_version: None,
                removed_in: None,
            },
            FieldSchema {
                name: "message".into(),
                serialized_name: None,
                data_type: DataType::Optional(Box::new(DataType::Object("ChatMessage".into()))),
                required: false,
                default_value: None,
                description: "The user's message".into(),
                constraints: vec![],
                semantic_tag: Some("user_message".into()),
                since_version: None,
                removed_in: None,
            },
            FieldSchema {
                name: "response".into(),
                serialized_name: None,
                data_type: DataType::Optional(Box::new(DataType::Json)),
                required: false,
                default_value: None,
                description: "AI response. Legacy format: {\"value\": [{\"value\": \"text\"}]}"
                    .into(),
                constraints: vec![],
                semantic_tag: Some("assistant_response".into()),
                since_version: None,
                removed_in: None,
            },
            FieldSchema {
                name: "requestId".into(),
                serialized_name: Some("request_id".into()),
                data_type: DataType::Optional(Box::new(DataType::Uuid)),
                required: false,
                default_value: None,
                description: "Unique request identifier".into(),
                constraints: vec![],
                semantic_tag: Some("request_id".into()),
                since_version: None,
                removed_in: None,
            },
            FieldSchema {
                name: "modelId".into(),
                serialized_name: Some("model_id".into()),
                data_type: DataType::Optional(Box::new(DataType::String)),
                required: false,
                default_value: None,
                description:
                    "LLM model used for this request (e.g., 'gpt-4o', 'claude-3.5-sonnet')".into(),
                constraints: vec![],
                semantic_tag: Some("model_id".into()),
                since_version: None,
                removed_in: None,
            },
            FieldSchema {
                name: "agent".into(),
                serialized_name: None,
                data_type: DataType::Optional(Box::new(DataType::Json)),
                required: false,
                default_value: None,
                description: "Agent information (for agent-mode sessions)".into(),
                constraints: vec![],
                semantic_tag: Some("agent".into()),
                since_version: Some("0.29.0".into()),
                removed_in: None,
            },
            FieldSchema {
                name: "isCanceled".into(),
                serialized_name: Some("is_canceled".into()),
                data_type: DataType::Optional(Box::new(DataType::Boolean)),
                required: false,
                default_value: None,
                description: "Whether the request was canceled by the user".into(),
                constraints: vec![],
                semantic_tag: Some("is_canceled".into()),
                since_version: None,
                removed_in: None,
            },
            FieldSchema {
                name: "variableData".into(),
                serialized_name: Some("variable_data".into()),
                data_type: DataType::Optional(Box::new(DataType::Json)),
                required: false,
                default_value: None,
                description: "Context variables (files, selections, terminal output)".into(),
                constraints: vec![],
                semantic_tag: Some("context".into()),
                since_version: None,
                removed_in: None,
            },
        ],
    );

    map.insert(
        "ChatMessage".into(),
        vec![
            FieldSchema {
                name: "text".into(),
                serialized_name: None,
                data_type: DataType::Optional(Box::new(DataType::String)),
                required: false,
                default_value: None,
                description: "Message text content".into(),
                constraints: vec![],
                semantic_tag: Some("message_text".into()),
                since_version: None,
                removed_in: None,
            },
            FieldSchema {
                name: "parts".into(),
                serialized_name: None,
                data_type: DataType::Optional(Box::new(DataType::Array(Box::new(DataType::Json)))),
                required: false,
                default_value: None,
                description: "Complex message parts (for multi-modal messages)".into(),
                constraints: vec![],
                semantic_tag: Some("message_parts".into()),
                since_version: None,
                removed_in: None,
            },
        ],
    );

    map
}

// ============================================================================
// Field definitions — Copilot Chat JSONL v1
// ============================================================================

fn copilot_jsonl_event_fields() -> Vec<FieldSchema> {
    vec![
        FieldSchema {
            name: "kind".into(),
            serialized_name: None,
            data_type: DataType::Enum(vec!["0".into(), "1".into(), "2".into()]),
            required: true,
            default_value: None,
            description: "Event kind: 0=full snapshot, 1=request update, 2=response update".into(),
            constraints: vec![],
            semantic_tag: Some("event_type".into()),
            since_version: Some("0.37.0".into()),
            removed_in: None,
        },
        FieldSchema {
            name: "data".into(),
            serialized_name: None,
            data_type: DataType::Json,
            required: true,
            default_value: None,
            description:
                "Event payload. For kind:0, the full session object. For kind:1/2, update deltas."
                    .into(),
            constraints: vec![],
            semantic_tag: Some("event_data".into()),
            since_version: Some("0.37.0".into()),
            removed_in: None,
        },
    ]
}

fn copilot_nested_objects_jsonl() -> HashMap<String, Vec<FieldSchema>> {
    let mut map = copilot_nested_objects_v3();

    // Add modelState to ChatRequest (new in JSONL)
    if let Some(request_fields) = map.get_mut("ChatRequest") {
        request_fields.push(FieldSchema {
            name: "modelState".into(),
            serialized_name: Some("model_state".into()),
            data_type: DataType::Optional(Box::new(DataType::Object("ModelState".into()))),
            required: false,
            default_value: None,
            description: "Model processing state. value: 0=Pending, 1=Complete, 2=Cancelled".into(),
            constraints: vec![],
            semantic_tag: Some("model_state".into()),
            since_version: Some("0.37.0".into()),
            removed_in: None,
        });
        request_fields.push(FieldSchema {
            name: "timeSpentWaiting".into(),
            serialized_name: Some("time_spent_waiting".into()),
            data_type: DataType::Optional(Box::new(DataType::Integer)),
            required: false,
            default_value: None,
            description: "Time spent waiting for response (milliseconds)".into(),
            constraints: vec![],
            semantic_tag: Some("latency".into()),
            since_version: Some("0.37.0".into()),
            removed_in: None,
        });
    }

    // Add ModelState object
    map.insert(
        "ModelState".into(),
        vec![
            FieldSchema {
                name: "value".into(),
                serialized_name: None,
                data_type: DataType::Enum(vec!["0".into(), "1".into(), "2".into()]),
                required: true,
                default_value: None,
                description: "0=Pending, 1=Complete, 2=Cancelled".into(),
                constraints: vec![],
                semantic_tag: Some("completion_state".into()),
                since_version: Some("0.37.0".into()),
                removed_in: None,
            },
            FieldSchema {
                name: "completedAt".into(),
                serialized_name: Some("completed_at".into()),
                data_type: DataType::Optional(Box::new(DataType::Timestamp)),
                required: false,
                default_value: None,
                description: "Timestamp when the model finished processing".into(),
                constraints: vec![],
                semantic_tag: Some("completed_at".into()),
                since_version: Some("0.37.0".into()),
                removed_in: None,
            },
        ],
    );

    map
}

// ============================================================================
// DB Key schemas — Copilot (shared fields + version-specific)
// ============================================================================

fn copilot_db_keys_json() -> Vec<DbKeySchema> {
    vec![
        DbKeySchema {
            key: "chat.ChatSessionStore.index".into(),
            description: "Session index mapping session IDs to metadata. Old format uses array of UUID strings.".into(),
            value_type: DataType::Json,
            value_fields: vec![
                FieldSchema {
                    name: "version".into(),
                    serialized_name: None,
                    data_type: DataType::Integer,
                    required: true,
                    default_value: Some(serde_json::json!(1)),
                    description: "Index version".into(),
                    constraints: vec![],
                    semantic_tag: Some("index_version".into()),
                    since_version: None,
                    removed_in: None,
                },
                FieldSchema {
                    name: "entries".into(),
                    serialized_name: None,
                    data_type: DataType::Array(Box::new(DataType::Uuid)),
                    required: true,
                    default_value: None,
                    description: "Array of session UUID strings (old format)".into(),
                    constraints: vec![],
                    semantic_tag: Some("session_index".into()),
                    since_version: None,
                    removed_in: Some("0.37.0".into()),
                },
            ],
            required: true,
            since_version: None,
            removed_in: None,
            renamed_to: None,
        },
        DbKeySchema {
            key: "memento/interactive-session".into(),
            description: "Session input history and active session state".into(),
            value_type: DataType::Json,
            value_fields: vec![],
            required: false,
            since_version: None,
            removed_in: None,
            renamed_to: None,
        },
        DbKeySchema {
            key: "memento/interactive-session-view-copilot".into(),
            description: "Current active session view state (which session is open)".into(),
            value_type: DataType::Json,
            value_fields: vec![],
            required: false,
            since_version: None,
            removed_in: None,
            renamed_to: None,
        },
    ]
}

fn copilot_db_keys_jsonl() -> Vec<DbKeySchema> {
    vec![
        DbKeySchema {
            key: "chat.ChatSessionStore.index".into(),
            description: "Session index mapping session IDs to rich metadata entries.".into(),
            value_type: DataType::Json,
            value_fields: copilot_index_entry_fields(),
            required: true,
            since_version: Some("0.37.0".into()),
            removed_in: None,
            renamed_to: None,
        },
        DbKeySchema {
            key: "agentSessions.model.cache".into(),
            description: "Model cache that drives Chat sidebar visibility. Sessions MUST have entries here to appear in VS Code UI.".into(),
            value_type: DataType::Array(Box::new(DataType::Object("ModelCacheEntry".into()))),
            value_fields: copilot_model_cache_fields(),
            required: true,
            since_version: Some("0.37.0".into()),
            removed_in: None,
            renamed_to: None,
        },
        DbKeySchema {
            key: "agentSessions.state.cache".into(),
            description: "Session read/archived state for UI indicators".into(),
            value_type: DataType::Array(Box::new(DataType::Object("StateCacheEntry".into()))),
            value_fields: copilot_state_cache_fields(),
            required: false,
            since_version: Some("0.37.0".into()),
            removed_in: None,
            renamed_to: None,
        },
        DbKeySchema {
            key: "memento/interactive-session".into(),
            description: "Session input history and active session state".into(),
            value_type: DataType::Json,
            value_fields: vec![],
            required: false,
            since_version: None,
            removed_in: None,
            renamed_to: None,
        },
        DbKeySchema {
            key: "memento/interactive-session-view-copilot".into(),
            description: "Current active session view state (which session is open)".into(),
            value_type: DataType::Json,
            value_fields: vec![],
            required: false,
            since_version: None,
            removed_in: None,
            renamed_to: None,
        },
    ]
}

fn copilot_index_entry_fields() -> Vec<FieldSchema> {
    vec![
        FieldSchema {
            name: "version".into(),
            serialized_name: None,
            data_type: DataType::Integer,
            required: true,
            default_value: Some(serde_json::json!(1)),
            description: "Index format version".into(),
            constraints: vec![],
            semantic_tag: Some("index_version".into()),
            since_version: None,
            removed_in: None,
        },
        FieldSchema {
            name: "entries".into(),
            serialized_name: None,
            data_type: DataType::Object("Map<UUID, IndexEntry>".into()),
            required: true,
            default_value: None,
            description: "Map of session UUID → IndexEntry objects (new format)".into(),
            constraints: vec![],
            semantic_tag: Some("session_index".into()),
            since_version: Some("0.37.0".into()),
            removed_in: None,
        },
    ]
}

fn copilot_model_cache_fields() -> Vec<FieldSchema> {
    vec![
        FieldSchema {
            name: "providerType".into(),
            serialized_name: Some("provider_type".into()),
            data_type: DataType::String,
            required: true,
            default_value: Some(serde_json::json!("local")),
            description: "Always 'local' for local sessions".into(),
            constraints: vec![],
            semantic_tag: None,
            since_version: Some("0.37.0".into()),
            removed_in: None,
        },
        FieldSchema {
            name: "providerLabel".into(),
            serialized_name: Some("provider_label".into()),
            data_type: DataType::String,
            required: true,
            default_value: Some(serde_json::json!("Local")),
            description: "Always 'Local' for local sessions".into(),
            constraints: vec![],
            semantic_tag: None,
            since_version: Some("0.37.0".into()),
            removed_in: None,
        },
        FieldSchema {
            name: "resource".into(),
            serialized_name: None,
            data_type: DataType::Uri,
            required: true,
            default_value: None,
            description: "Resource URI: vscode-chat-session://local/{base64(sessionId)}".into(),
            constraints: vec![FieldConstraint::Pattern {
                pattern: "^vscode-chat-session://local/[A-Za-z0-9+/=]+$".into(),
            }],
            semantic_tag: Some("resource_uri".into()),
            since_version: Some("0.37.0".into()),
            removed_in: None,
        },
        FieldSchema {
            name: "icon".into(),
            serialized_name: None,
            data_type: DataType::String,
            required: false,
            default_value: Some(serde_json::json!("vm")),
            description: "Icon identifier for the UI".into(),
            constraints: vec![],
            semantic_tag: None,
            since_version: Some("0.37.0".into()),
            removed_in: None,
        },
        FieldSchema {
            name: "label".into(),
            serialized_name: None,
            data_type: DataType::String,
            required: true,
            default_value: None,
            description: "Session title displayed in sidebar".into(),
            constraints: vec![],
            semantic_tag: Some("title".into()),
            since_version: Some("0.37.0".into()),
            removed_in: None,
        },
        FieldSchema {
            name: "status".into(),
            serialized_name: None,
            data_type: DataType::Integer,
            required: true,
            default_value: Some(serde_json::json!(1)),
            description: "Status: 1 = valid".into(),
            constraints: vec![],
            semantic_tag: None,
            since_version: Some("0.37.0".into()),
            removed_in: None,
        },
        FieldSchema {
            name: "timing".into(),
            serialized_name: None,
            data_type: DataType::Object("ChatSessionTiming".into()),
            required: true,
            default_value: None,
            description: "Session timing (created, lastRequestStarted, lastRequestEnded)".into(),
            constraints: vec![],
            semantic_tag: Some("timing".into()),
            since_version: Some("0.37.0".into()),
            removed_in: None,
        },
        FieldSchema {
            name: "isEmpty".into(),
            serialized_name: Some("is_empty".into()),
            data_type: DataType::Boolean,
            required: true,
            default_value: Some(serde_json::json!(false)),
            description: "Whether the session has no requests. MUST be false for VS Code to load."
                .into(),
            constraints: vec![],
            semantic_tag: Some("is_empty".into()),
            since_version: Some("0.37.0".into()),
            removed_in: None,
        },
        FieldSchema {
            name: "lastResponseState".into(),
            serialized_name: Some("last_response_state".into()),
            data_type: DataType::Enum(vec![
                "0".into(),
                "1".into(),
                "2".into(),
                "3".into(),
                "4".into(),
            ]),
            required: true,
            default_value: Some(serde_json::json!(1)),
            description: "0=Pending, 1=Complete, 2=Cancelled, 3=Failed, 4=NeedsInput".into(),
            constraints: vec![],
            semantic_tag: Some("response_state".into()),
            since_version: Some("0.37.0".into()),
            removed_in: None,
        },
    ]
}

fn copilot_state_cache_fields() -> Vec<FieldSchema> {
    vec![
        FieldSchema {
            name: "resource".into(),
            serialized_name: None,
            data_type: DataType::Uri,
            required: true,
            default_value: None,
            description: "Resource URI (same as model cache)".into(),
            constraints: vec![],
            semantic_tag: Some("resource_uri".into()),
            since_version: Some("0.37.0".into()),
            removed_in: None,
        },
        FieldSchema {
            name: "read".into(),
            serialized_name: None,
            data_type: DataType::Optional(Box::new(DataType::Timestamp)),
            required: false,
            default_value: None,
            description: "Timestamp when the session was last read by the user".into(),
            constraints: vec![],
            semantic_tag: Some("last_read".into()),
            since_version: Some("0.37.0".into()),
            removed_in: None,
        },
    ]
}

// ============================================================================
// Field definitions — Cursor
// ============================================================================

fn cursor_session_fields() -> Vec<FieldSchema> {
    // Cursor uses a format very similar to Copilot JSON v3
    let mut fields = copilot_session_fields_v3();
    // Cursor may have additional fields
    fields.push(FieldSchema {
        name: "workspaceId".into(),
        serialized_name: Some("workspace_id".into()),
        data_type: DataType::Optional(Box::new(DataType::String)),
        required: false,
        default_value: None,
        description: "Cursor workspace identifier".into(),
        constraints: vec![],
        semantic_tag: Some("workspace_id".into()),
        since_version: None,
        removed_in: None,
    });
    fields
}

// ============================================================================
// Field definitions — Claude Code
// ============================================================================

fn claude_code_fields() -> Vec<FieldSchema> {
    vec![
        FieldSchema {
            name: "type".into(),
            serialized_name: None,
            data_type: DataType::Enum(vec![
                "human".into(),
                "assistant".into(),
                "system".into(),
                "tool_use".into(),
                "tool_result".into(),
            ]),
            required: true,
            default_value: None,
            description: "Message event type".into(),
            constraints: vec![],
            semantic_tag: Some("message_role".into()),
            since_version: None,
            removed_in: None,
        },
        FieldSchema {
            name: "message".into(),
            serialized_name: None,
            data_type: DataType::Object("ClaudeMessage".into()),
            required: true,
            default_value: None,
            description: "Message content object with role and content fields".into(),
            constraints: vec![],
            semantic_tag: Some("message".into()),
            since_version: None,
            removed_in: None,
        },
        FieldSchema {
            name: "timestamp".into(),
            serialized_name: None,
            data_type: DataType::String,
            required: false,
            default_value: None,
            description: "ISO 8601 timestamp".into(),
            constraints: vec![],
            semantic_tag: Some("message_timestamp".into()),
            since_version: None,
            removed_in: None,
        },
        FieldSchema {
            name: "costUSD".into(),
            serialized_name: Some("cost_usd".into()),
            data_type: DataType::Optional(Box::new(DataType::Float)),
            required: false,
            default_value: None,
            description: "Cost in USD for this message".into(),
            constraints: vec![],
            semantic_tag: Some("cost".into()),
            since_version: None,
            removed_in: None,
        },
        FieldSchema {
            name: "durationMs".into(),
            serialized_name: Some("duration_ms".into()),
            data_type: DataType::Optional(Box::new(DataType::Integer)),
            required: false,
            default_value: None,
            description: "Processing duration in milliseconds".into(),
            constraints: vec![],
            semantic_tag: Some("latency".into()),
            since_version: None,
            removed_in: None,
        },
    ]
}

// ============================================================================
// Field definitions — Codex CLI
// ============================================================================

fn codex_cli_fields() -> Vec<FieldSchema> {
    vec![
        FieldSchema {
            name: "role".into(),
            serialized_name: None,
            data_type: DataType::Enum(vec![
                "system".into(),
                "user".into(),
                "assistant".into(),
                "tool".into(),
            ]),
            required: true,
            default_value: None,
            description: "Message role (OpenAI format)".into(),
            constraints: vec![],
            semantic_tag: Some("message_role".into()),
            since_version: None,
            removed_in: None,
        },
        FieldSchema {
            name: "content".into(),
            serialized_name: None,
            data_type: DataType::String,
            required: true,
            default_value: None,
            description: "Message content text".into(),
            constraints: vec![],
            semantic_tag: Some("message_text".into()),
            since_version: None,
            removed_in: None,
        },
        FieldSchema {
            name: "timestamp".into(),
            serialized_name: None,
            data_type: DataType::Optional(Box::new(DataType::Timestamp)),
            required: false,
            default_value: None,
            description: "Message timestamp".into(),
            constraints: vec![],
            semantic_tag: Some("message_timestamp".into()),
            since_version: None,
            removed_in: None,
        },
    ]
}

// ============================================================================
// Field definitions — Gemini CLI
// ============================================================================

fn gemini_cli_fields() -> Vec<FieldSchema> {
    vec![
        FieldSchema {
            name: "role".into(),
            serialized_name: None,
            data_type: DataType::Enum(vec!["user".into(), "model".into()]),
            required: true,
            default_value: None,
            description: "Message role (Gemini uses 'model' for assistant)".into(),
            constraints: vec![],
            semantic_tag: Some("message_role".into()),
            since_version: None,
            removed_in: None,
        },
        FieldSchema {
            name: "parts".into(),
            serialized_name: None,
            data_type: DataType::Array(Box::new(DataType::Object("GeminiPart".into()))),
            required: true,
            default_value: None,
            description: "Content parts array (Gemini multi-part format)".into(),
            constraints: vec![],
            semantic_tag: Some("message_parts".into()),
            since_version: None,
            removed_in: None,
        },
    ]
}

// ============================================================================
// Field definitions — Continue.dev
// ============================================================================

fn continue_dev_fields() -> Vec<FieldSchema> {
    vec![
        FieldSchema {
            name: "sessionId".into(),
            serialized_name: Some("session_id".into()),
            data_type: DataType::Uuid,
            required: true,
            default_value: None,
            description: "Session identifier".into(),
            constraints: vec![],
            semantic_tag: Some("session_id".into()),
            since_version: None,
            removed_in: None,
        },
        FieldSchema {
            name: "title".into(),
            serialized_name: None,
            data_type: DataType::Optional(Box::new(DataType::String)),
            required: false,
            default_value: None,
            description: "Session title".into(),
            constraints: vec![],
            semantic_tag: Some("title".into()),
            since_version: None,
            removed_in: None,
        },
        FieldSchema {
            name: "dateCreated".into(),
            serialized_name: Some("date_created".into()),
            data_type: DataType::String,
            required: true,
            default_value: None,
            description: "ISO 8601 creation date".into(),
            constraints: vec![],
            semantic_tag: Some("created_at".into()),
            since_version: None,
            removed_in: None,
        },
        FieldSchema {
            name: "history".into(),
            serialized_name: None,
            data_type: DataType::Array(Box::new(DataType::Object("ContinueMessage".into()))),
            required: true,
            default_value: None,
            description: "Array of history step objects".into(),
            constraints: vec![],
            semantic_tag: Some("messages".into()),
            since_version: None,
            removed_in: None,
        },
    ]
}

// ============================================================================
// Field definitions — OpenAI API (generic)
// ============================================================================

fn openai_api_fields() -> Vec<FieldSchema> {
    vec![
        FieldSchema {
            name: "model".into(),
            serialized_name: None,
            data_type: DataType::String,
            required: true,
            default_value: None,
            description: "Model identifier (e.g., 'gpt-4o', 'llama3.3')".into(),
            constraints: vec![],
            semantic_tag: Some("model_id".into()),
            since_version: None,
            removed_in: None,
        },
        FieldSchema {
            name: "messages".into(),
            serialized_name: None,
            data_type: DataType::Array(Box::new(DataType::Object("OpenAIMessage".into()))),
            required: true,
            default_value: None,
            description: "Array of message objects with role and content".into(),
            constraints: vec![],
            semantic_tag: Some("messages".into()),
            since_version: None,
            removed_in: None,
        },
        FieldSchema {
            name: "temperature".into(),
            serialized_name: None,
            data_type: DataType::Optional(Box::new(DataType::Float)),
            required: false,
            default_value: Some(serde_json::json!(1.0)),
            description: "Sampling temperature (0.0 – 2.0)".into(),
            constraints: vec![
                FieldConstraint::Min {
                    value: serde_json::json!(0.0),
                },
                FieldConstraint::Max {
                    value: serde_json::json!(2.0),
                },
            ],
            semantic_tag: Some("temperature".into()),
            since_version: None,
            removed_in: None,
        },
        FieldSchema {
            name: "tools".into(),
            serialized_name: None,
            data_type: DataType::Optional(Box::new(DataType::Array(Box::new(DataType::Object(
                "Tool".into(),
            ))))),
            required: false,
            default_value: None,
            description: "Available tools/functions for function calling".into(),
            constraints: vec![],
            semantic_tag: Some("tools".into()),
            since_version: None,
            removed_in: None,
        },
        FieldSchema {
            name: "stream".into(),
            serialized_name: None,
            data_type: DataType::Optional(Box::new(DataType::Boolean)),
            required: false,
            default_value: Some(serde_json::json!(false)),
            description: "Whether to stream the response".into(),
            constraints: vec![],
            semantic_tag: Some("streaming".into()),
            since_version: None,
            removed_in: None,
        },
    ]
}

fn openai_api_nested_objects() -> HashMap<String, Vec<FieldSchema>> {
    let mut map = HashMap::new();

    map.insert(
        "OpenAIMessage".into(),
        vec![
            FieldSchema {
                name: "role".into(),
                serialized_name: None,
                data_type: DataType::Enum(vec![
                    "system".into(),
                    "user".into(),
                    "assistant".into(),
                    "tool".into(),
                ]),
                required: true,
                default_value: None,
                description: "Message role".into(),
                constraints: vec![],
                semantic_tag: Some("message_role".into()),
                since_version: None,
                removed_in: None,
            },
            FieldSchema {
                name: "content".into(),
                serialized_name: None,
                data_type: DataType::String,
                required: true,
                default_value: None,
                description: "Message content".into(),
                constraints: vec![],
                semantic_tag: Some("message_text".into()),
                since_version: None,
                removed_in: None,
            },
            FieldSchema {
                name: "tool_calls".into(),
                serialized_name: None,
                data_type: DataType::Optional(Box::new(DataType::Array(Box::new(
                    DataType::Object("ToolCall".into()),
                )))),
                required: false,
                default_value: None,
                description: "Tool/function calls made by the assistant".into(),
                constraints: vec![],
                semantic_tag: Some("tool_calls".into()),
                since_version: None,
                removed_in: None,
            },
        ],
    );

    map
}
