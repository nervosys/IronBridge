// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
//! Schema Registry — central catalog of all provider schemas with detection.
//!
//! The registry is the primary entry point for the schema subsystem. It:
//! 1. Holds all known provider schemas
//! 2. Auto-detects which schema a workspace uses
//! 3. Provides search/filter APIs for AI agents
//! 4. Exposes the ontology for cross-provider mapping

use crate::schema::ontology::Ontology;
use crate::schema::types::*;
use crate::schema::versions;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

// ============================================================================
// Schema Registry
// ============================================================================

/// Central registry of all known AI chat provider schemas.
///
/// ```rust,ignore
/// let registry = SchemaRegistry::new();
///
/// // List all schemas
/// for schema in registry.list_schemas() {
///     println!("{}: {} fields", schema.id(), schema.field_count());
/// }
///
/// // Detect schema for a workspace
/// let detected = registry.detect_schema("/path/to/session.jsonl")?;
/// ```
pub struct SchemaRegistry {
    /// All registered schemas indexed by their version ID
    schemas: HashMap<String, ProviderSchema>,
    /// The ontology over all schemas
    ontology: Ontology,
}

impl SchemaRegistry {
    /// Create a new registry pre-loaded with all known provider schemas.
    pub fn new() -> Self {
        let all_schemas = versions::build_all_provider_schemas();
        let mut schemas = HashMap::new();

        for schema in all_schemas {
            schemas.insert(schema.id(), schema);
        }

        Self {
            schemas,
            ontology: Ontology::build(),
        }
    }

    /// Get a reference to the ontology.
    pub fn ontology(&self) -> &Ontology {
        &self.ontology
    }

    /// List all registered schemas.
    pub fn list_schemas(&self) -> Vec<&ProviderSchema> {
        let mut schemas: Vec<&ProviderSchema> = self.schemas.values().collect();
        schemas.sort_by_key(|s| s.id());
        schemas
    }

    /// Get a schema by its version ID.
    pub fn get_schema(&self, id: &str) -> Option<&ProviderSchema> {
        self.schemas.get(id)
    }

    /// Get all schemas for a specific provider.
    pub fn schemas_for_provider(&self, provider: &str) -> Vec<&ProviderSchema> {
        self.schemas
            .values()
            .filter(|s| s.version.provider == provider)
            .collect()
    }

    /// Register a custom schema (for plugins / new providers).
    pub fn register_schema(&mut self, schema: ProviderSchema) {
        self.schemas.insert(schema.id(), schema);
    }

    /// Detect which schema a session file uses based on its contents.
    pub fn detect_schema_from_file(&self, path: &Path) -> Result<DetectedSchema> {
        let extension = path.extension().and_then(|e| e.to_str()).unwrap_or("");

        let content = std::fs::read_to_string(path)
            .with_context(|| format!("Failed to read {}", path.display()))?;

        match extension {
            "jsonl" => self.detect_jsonl_schema(&content, path),
            "json" => self.detect_json_schema(&content, path),
            _ => Ok(DetectedSchema {
                schema_id: "unknown".into(),
                confidence: 0.0,
                evidence: vec![format!("Unknown file extension: .{}", extension)],
                detected_version: None,
            }),
        }
    }

    /// Detect schema from a VS Code workspace storage directory.
    pub fn detect_schema_from_workspace(&self, workspace_dir: &Path) -> Result<DetectedSchema> {
        let chat_sessions = workspace_dir.join("chatSessions");

        if !chat_sessions.exists() {
            return Ok(DetectedSchema {
                schema_id: "unknown".into(),
                confidence: 0.0,
                evidence: vec!["No chatSessions directory found".into()],
                detected_version: None,
            });
        }

        // Check what file types exist
        let mut has_jsonl = false;
        let mut has_json = false;
        let mut jsonl_count = 0;
        let mut json_count = 0;

        if let Ok(entries) = std::fs::read_dir(&chat_sessions) {
            for entry in entries.flatten() {
                let path = entry.path();
                match path.extension().and_then(|e| e.to_str()) {
                    Some("jsonl") => {
                        has_jsonl = true;
                        jsonl_count += 1;
                    }
                    Some("json") => {
                        // Exclude backup files
                        let name = path.file_name().unwrap_or_default().to_string_lossy();
                        if !name.contains(".bak") && !name.contains(".pre-") {
                            has_json = true;
                            json_count += 1;
                        }
                    }
                    _ => {}
                }
            }
        }

        let mut evidence = Vec::new();

        if has_jsonl && !has_json {
            evidence.push(format!(
                "Found {} .jsonl files, no .json files → JSONL format",
                jsonl_count
            ));
            return Ok(DetectedSchema {
                schema_id: "copilot-jsonl-v1".into(),
                confidence: 0.95,
                evidence,
                detected_version: None,
            });
        }

        if has_json && !has_jsonl {
            evidence.push(format!(
                "Found {} .json files, no .jsonl files → JSON format",
                json_count
            ));
            return Ok(DetectedSchema {
                schema_id: "copilot-json-v3".into(),
                confidence: 0.95,
                evidence,
                detected_version: None,
            });
        }

        if has_jsonl && has_json {
            evidence.push(format!(
                "Found both .jsonl ({}) and .json ({}) files → mixed / transitional",
                jsonl_count, json_count
            ));

            // Newer format takes precedence
            let schema_id = if jsonl_count >= json_count {
                "copilot-jsonl-v1"
            } else {
                "copilot-json-v3"
            };

            return Ok(DetectedSchema {
                schema_id: schema_id.into(),
                confidence: 0.7,
                evidence,
                detected_version: None,
            });
        }

        Ok(DetectedSchema {
            schema_id: "unknown".into(),
            confidence: 0.0,
            evidence: vec!["No session files found".into()],
            detected_version: None,
        })
    }

    /// Export the full registry as JSON (for AI agent consumption).
    pub fn to_json(&self) -> Result<String> {
        let export = RegistryExport {
            version: "2.0.0".into(),
            schema_count: self.schemas.len(),
            schemas: self.list_schemas().into_iter().cloned().collect(),
            ontology: self.ontology.clone(),
        };

        serde_json::to_string_pretty(&export).map_err(Into::into)
    }

    /// Export the registry as a compact JSON for embedding in documents.
    pub fn to_json_compact(&self) -> Result<String> {
        let export = RegistryExport {
            version: "2.0.0".into(),
            schema_count: self.schemas.len(),
            schemas: self.list_schemas().into_iter().cloned().collect(),
            ontology: self.ontology.clone(),
        };

        serde_json::to_string(&export).map_err(Into::into)
    }

    // ========================================================================
    // Internal detection helpers
    // ========================================================================

    fn detect_jsonl_schema(&self, content: &str, _path: &Path) -> Result<DetectedSchema> {
        let first_line = content.lines().next().unwrap_or("");
        let mut evidence = Vec::new();

        // Try to parse as Copilot JSONL (kind:0 envelope)
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(first_line) {
            if val.get("kind").is_some() {
                evidence.push("First line has 'kind' field → Copilot JSONL event format".into());

                let kind = val.get("kind").and_then(|k| k.as_u64()).unwrap_or(99);
                if kind == 0 {
                    evidence.push("kind=0 → full session snapshot (expected first line)".into());
                }

                // Check for data.version
                if let Some(data) = val.get("data") {
                    if let Some(version) = data.get("version").and_then(|v| v.as_u64()) {
                        evidence.push(format!(
                            "data.version = {} → session format version",
                            version
                        ));
                    }
                }

                // Check for extensionVersion in data
                let ext_version = val
                    .get("data")
                    .and_then(|d| d.get("requests"))
                    .and_then(|r| r.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|req| req.get("result"))
                    .and_then(|res| res.get("metadata"))
                    .and_then(|meta| meta.get("extensionVersion"))
                    .and_then(|v| v.as_str())
                    .map(String::from);

                return Ok(DetectedSchema {
                    schema_id: "copilot-jsonl-v1".into(),
                    confidence: 0.95,
                    evidence,
                    detected_version: ext_version,
                });
            }

            // Check for Claude Code format (type field)
            if val.get("type").is_some() && val.get("message").is_some() {
                evidence.push("Has 'type' and 'message' fields → Claude Code format".into());
                return Ok(DetectedSchema {
                    schema_id: "claude-code-jsonl-v1".into(),
                    confidence: 0.9,
                    evidence,
                    detected_version: None,
                });
            }

            // Check for Codex CLI format (role/content)
            if val.get("role").is_some() && val.get("content").is_some() {
                evidence.push("Has 'role' and 'content' fields → Codex CLI / OpenAI format".into());
                return Ok(DetectedSchema {
                    schema_id: "codex-cli-jsonl-v1".into(),
                    confidence: 0.8,
                    evidence,
                    detected_version: None,
                });
            }
        }

        evidence.push("Could not identify JSONL format from first line".into());
        Ok(DetectedSchema {
            schema_id: "unknown".into(),
            confidence: 0.0,
            evidence,
            detected_version: None,
        })
    }

    fn detect_json_schema(&self, content: &str, _path: &Path) -> Result<DetectedSchema> {
        let mut evidence = Vec::new();

        if let Ok(val) = serde_json::from_str::<serde_json::Value>(content) {
            // Check for Copilot Chat JSON v3
            if val.get("requests").is_some() {
                evidence.push("Has 'requests' field → Copilot Chat format".into());

                if let Some(version) = val.get("version").and_then(|v| v.as_u64()) {
                    evidence.push(format!(
                        "version = {} → session format v{}",
                        version, version
                    ));
                }

                if val.get("creationDate").is_some() {
                    evidence.push("Has 'creationDate' → Copilot JSON v3".into());
                }

                return Ok(DetectedSchema {
                    schema_id: "copilot-json-v3".into(),
                    confidence: 0.95,
                    evidence,
                    detected_version: None,
                });
            }

            // Check for Continue.dev format
            if val.get("history").is_some() && val.get("dateCreated").is_some() {
                evidence.push("Has 'history' and 'dateCreated' → Continue.dev format".into());
                return Ok(DetectedSchema {
                    schema_id: "continue-dev-json-v1".into(),
                    confidence: 0.9,
                    evidence,
                    detected_version: None,
                });
            }

            // Check for Gemini CLI format (contents with parts)
            if val.get("contents").is_some() {
                evidence.push("Has 'contents' field → Gemini format".into());
                return Ok(DetectedSchema {
                    schema_id: "gemini-cli-json-v1".into(),
                    confidence: 0.85,
                    evidence,
                    detected_version: None,
                });
            }

            // Check for OpenAI API format
            if val.get("messages").is_some() && val.get("model").is_some() {
                evidence.push("Has 'messages' and 'model' → OpenAI API format".into());
                return Ok(DetectedSchema {
                    schema_id: "openai-api-openai-api-v1".into(),
                    confidence: 0.9,
                    evidence,
                    detected_version: None,
                });
            }
        } else {
            evidence.push("Failed to parse as JSON".into());
        }

        Ok(DetectedSchema {
            schema_id: "unknown".into(),
            confidence: 0.0,
            evidence,
            detected_version: None,
        })
    }
}

impl Default for SchemaRegistry {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Detection Result
// ============================================================================

/// Result of schema auto-detection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedSchema {
    /// Best-matching schema version ID
    pub schema_id: String,
    /// Confidence score (0.0 – 1.0)
    pub confidence: f64,
    /// Evidence that led to this conclusion
    pub evidence: Vec<String>,
    /// Detected extension version (if extractable)
    pub detected_version: Option<String>,
}

// ============================================================================
// Registry Export (for serialization)
// ============================================================================

#[derive(Serialize, Deserialize)]
struct RegistryExport {
    version: String,
    schema_count: usize,
    schemas: Vec<ProviderSchema>,
    ontology: Ontology,
}
