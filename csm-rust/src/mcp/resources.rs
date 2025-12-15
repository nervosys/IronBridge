//! MCP Resources - Expose csm data as MCP resources

use super::types::*;
use serde_json::json;

/// Get the list of available resources
pub fn list_resources() -> Vec<Resource> {
    vec![
        Resource {
            uri: "csm://workspaces".to_string(),
            name: "Workspaces".to_string(),
            description: Some("All VS Code workspaces with chat sessions".to_string()),
            mime_type: Some("application/json".to_string()),
        },
        Resource {
            uri: "csm://sessions".to_string(),
            name: "Sessions".to_string(),
            description: Some("All chat sessions across all workspaces".to_string()),
            mime_type: Some("application/json".to_string()),
        },
        Resource {
            uri: "csm://orphaned".to_string(),
            name: "Orphaned Sessions".to_string(),
            description: Some("Sessions on disk but not in VS Code's index".to_string()),
            mime_type: Some("application/json".to_string()),
        },
        Resource {
            uri: "csm://providers".to_string(),
            name: "Providers".to_string(),
            description: Some("Available LLM providers".to_string()),
            mime_type: Some("application/json".to_string()),
        },
    ]
}

/// Read a resource by URI
pub fn read_resource(uri: &str) -> ReadResourceResult {
    match uri {
        "csm://workspaces" => read_workspaces_resource(),
        "csm://sessions" => read_sessions_resource(),
        "csm://orphaned" => read_orphaned_resource(),
        "csm://providers" => read_providers_resource(),
        _ => {
            // Try to parse workspace-specific or session-specific URIs
            if uri.starts_with("csm://workspace/") {
                let hash = &uri["csm://workspace/".len()..];
                read_workspace_resource(hash)
            } else if uri.starts_with("csm://session/") {
                let id = &uri["csm://session/".len()..];
                read_session_resource(id)
            } else {
                ReadResourceResult {
                    contents: vec![ResourceContent {
                        uri: uri.to_string(),
                        mime_type: Some("text/plain".to_string()),
                        text: Some(format!("Unknown resource: {}", uri)),
                        blob: None,
                    }],
                }
            }
        }
    }
}

fn read_workspaces_resource() -> ReadResourceResult {
    use crate::workspace::discover_workspaces;

    match discover_workspaces() {
        Ok(workspaces) => {
            let infos: Vec<serde_json::Value> = workspaces
                .iter()
                .map(|ws| {
                    json!({
                        "hash": ws.hash,
                        "project_path": ws.project_path,
                        "session_count": ws.chat_session_count,
                        "has_chats": ws.has_chat_sessions,
                        "workspace_path": ws.workspace_path.display().to_string()
                    })
                })
                .collect();

            ReadResourceResult {
                contents: vec![ResourceContent {
                    uri: "csm://workspaces".to_string(),
                    mime_type: Some("application/json".to_string()),
                    text: Some(serde_json::to_string_pretty(&json!({
                        "workspaces": infos,
                        "total": infos.len()
                    })).unwrap_or_default()),
                    blob: None,
                }],
            }
        }
        Err(e) => ReadResourceResult {
            contents: vec![ResourceContent {
                uri: "csm://workspaces".to_string(),
                mime_type: Some("text/plain".to_string()),
                text: Some(format!("Error: {}", e)),
                blob: None,
            }],
        },
    }
}

fn read_sessions_resource() -> ReadResourceResult {
    use crate::workspace::{discover_workspaces, get_chat_sessions_from_workspace};

    match discover_workspaces() {
        Ok(workspaces) => {
            let mut all_sessions = Vec::new();

            for ws in &workspaces {
                if let Ok(sessions) = get_chat_sessions_from_workspace(&ws.workspace_path) {
                    for s in sessions {
                        all_sessions.push(json!({
                            "id": s.session.session_id,
                            "title": s.session.title(),
                            "message_count": s.session.requests.len(),
                            "last_message_date": s.session.last_message_date,
                            "workspace_hash": ws.hash,
                            "project_path": ws.project_path,
                            "file_path": s.path.display().to_string()
                        }));
                    }
                }
            }

            ReadResourceResult {
                contents: vec![ResourceContent {
                    uri: "csm://sessions".to_string(),
                    mime_type: Some("application/json".to_string()),
                    text: Some(serde_json::to_string_pretty(&json!({
                        "sessions": all_sessions,
                        "total": all_sessions.len()
                    })).unwrap_or_default()),
                    blob: None,
                }],
            }
        }
        Err(e) => ReadResourceResult {
            contents: vec![ResourceContent {
                uri: "csm://sessions".to_string(),
                mime_type: Some("text/plain".to_string()),
                text: Some(format!("Error: {}", e)),
                blob: None,
            }],
        },
    }
}

fn read_orphaned_resource() -> ReadResourceResult {
    // For now, return a placeholder - orphaned detection requires a specific workspace
    ReadResourceResult {
        contents: vec![ResourceContent {
            uri: "csm://orphaned".to_string(),
            mime_type: Some("application/json".to_string()),
            text: Some(json!({
                "message": "Use csm_list_orphaned tool with a specific path to find orphaned sessions"
            }).to_string()),
            blob: None,
        }],
    }
}

fn read_providers_resource() -> ReadResourceResult {
    let providers = json!({
        "providers": [
            {"name": "copilot", "type": "vscode", "description": "GitHub Copilot (VS Code)"},
            {"name": "cursor", "type": "ide", "description": "Cursor IDE"},
            {"name": "ollama", "type": "local", "description": "Ollama local LLM"},
            {"name": "vllm", "type": "local", "description": "vLLM server"},
            {"name": "lm-studio", "type": "local", "description": "LM Studio"},
            {"name": "jan", "type": "local", "description": "Jan.ai"},
            {"name": "gpt4all", "type": "local", "description": "GPT4All"},
            {"name": "localai", "type": "local", "description": "LocalAI"},
            {"name": "llamafile", "type": "local", "description": "Llamafile"},
            {"name": "text-gen-webui", "type": "local", "description": "Text Generation WebUI"},
            {"name": "azure-foundry", "type": "cloud", "description": "Azure AI Foundry"},
            {"name": "chatgpt", "type": "web", "description": "ChatGPT (share links)"},
            {"name": "claude", "type": "web", "description": "Claude (share links)"},
            {"name": "gemini", "type": "web", "description": "Gemini (share links)"},
            {"name": "perplexity", "type": "web", "description": "Perplexity (share links)"},
            {"name": "deepseek", "type": "web", "description": "DeepSeek (share links)"}
        ]
    });

    ReadResourceResult {
        contents: vec![ResourceContent {
            uri: "csm://providers".to_string(),
            mime_type: Some("application/json".to_string()),
            text: Some(serde_json::to_string_pretty(&providers).unwrap_or_default()),
            blob: None,
        }],
    }
}

fn read_workspace_resource(hash: &str) -> ReadResourceResult {
    use crate::workspace::{discover_workspaces, get_chat_sessions_from_workspace};

    match discover_workspaces() {
        Ok(workspaces) => {
            for ws in &workspaces {
                if ws.hash.starts_with(hash) || ws.hash == hash {
                    let sessions = get_chat_sessions_from_workspace(&ws.workspace_path)
                        .unwrap_or_default();

                    let session_infos: Vec<serde_json::Value> = sessions
                        .iter()
                        .map(|s| {
                            json!({
                                "id": s.session.session_id,
                                "title": s.session.title(),
                                "message_count": s.session.requests.len(),
                                "file_path": s.path.display().to_string()
                            })
                        })
                        .collect();

                    return ReadResourceResult {
                        contents: vec![ResourceContent {
                            uri: format!("csm://workspace/{}", ws.hash),
                            mime_type: Some("application/json".to_string()),
                            text: Some(serde_json::to_string_pretty(&json!({
                                "hash": ws.hash,
                                "project_path": ws.project_path,
                                "workspace_path": ws.workspace_path.display().to_string(),
                                "session_count": ws.chat_session_count,
                                "sessions": session_infos
                            })).unwrap_or_default()),
                            blob: None,
                        }],
                    };
                }
            }

            ReadResourceResult {
                contents: vec![ResourceContent {
                    uri: format!("csm://workspace/{}", hash),
                    mime_type: Some("text/plain".to_string()),
                    text: Some(format!("Workspace not found: {}", hash)),
                    blob: None,
                }],
            }
        }
        Err(e) => ReadResourceResult {
            contents: vec![ResourceContent {
                uri: format!("csm://workspace/{}", hash),
                mime_type: Some("text/plain".to_string()),
                text: Some(format!("Error: {}", e)),
                blob: None,
            }],
        },
    }
}

fn read_session_resource(session_id: &str) -> ReadResourceResult {
    use crate::workspace::{discover_workspaces, get_chat_sessions_from_workspace};

    match discover_workspaces() {
        Ok(workspaces) => {
            for ws in &workspaces {
                if let Ok(sessions) = get_chat_sessions_from_workspace(&ws.workspace_path) {
                    for s in sessions {
                        let sid = s.session.session_id.clone().unwrap_or_default();
                        if sid.starts_with(session_id) || sid == session_id {
                            // Return full session content
                            let messages: Vec<serde_json::Value> = s
                                .session
                                .requests
                                .iter()
                                .map(|r| {
                                    let user_msg = r.message.as_ref()
                                        .map(|m| m.get_text())
                                        .unwrap_or_default();
                                    let response_text = r.response.as_ref()
                                        .and_then(|v| v.get("text"))
                                        .and_then(|t| t.as_str())
                                        .unwrap_or("");
                                    json!({
                                        "message": user_msg,
                                        "response": response_text,
                                        "timestamp": r.timestamp
                                    })
                                })
                                .collect();

                            return ReadResourceResult {
                                contents: vec![ResourceContent {
                                    uri: format!("csm://session/{}", sid),
                                    mime_type: Some("application/json".to_string()),
                                    text: Some(serde_json::to_string_pretty(&json!({
                                        "id": sid,
                                        "title": s.session.title(),
                                        "message_count": s.session.requests.len(),
                                        "last_message_date": s.session.last_message_date,
                                        "is_imported": s.session.is_imported,
                                        "workspace_hash": ws.hash,
                                        "project_path": ws.project_path,
                                        "file_path": s.path.display().to_string(),
                                        "messages": messages
                                    })).unwrap_or_default()),
                                    blob: None,
                                }],
                            };
                        }
                    }
                }
            }

            ReadResourceResult {
                contents: vec![ResourceContent {
                    uri: format!("csm://session/{}", session_id),
                    mime_type: Some("text/plain".to_string()),
                    text: Some(format!("Session not found: {}", session_id)),
                    blob: None,
                }],
            }
        }
        Err(e) => ReadResourceResult {
            contents: vec![ResourceContent {
                uri: format!("csm://session/{}", session_id),
                mime_type: Some("text/plain".to_string()),
                text: Some(format!("Error: {}", e)),
                blob: None,
            }],
        },
    }
}
