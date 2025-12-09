//! Anthropic (Claude) cloud provider
//!
//! Fetches conversation history from Claude web interface.
//! 
//! ## Authentication
//! 
//! Requires either:
//! - API key via `ANTHROPIC_API_KEY` environment variable
//! - Session token for web interface access
//!
//! Note: The official Anthropic API is stateless and doesn't store conversations.
//! Web conversation history requires session authentication.

use super::common::{CloudConversation, CloudMessage, CloudProvider, FetchOptions, HttpClientConfig, build_http_client};
use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use serde::Deserialize;

const ANTHROPIC_WEB_API: &str = "https://claude.ai/api";
const ANTHROPIC_API: &str = "https://api.anthropic.com/v1";

/// Anthropic Claude provider for fetching conversation history
pub struct AnthropicProvider {
    api_key: Option<String>,
    session_token: Option<String>,
    client: Option<reqwest::blocking::Client>,
}

impl AnthropicProvider {
    pub fn new(api_key: Option<String>) -> Self {
        Self {
            api_key,
            session_token: None,
            client: None,
        }
    }
    
    fn ensure_client(&mut self) -> Result<&reqwest::blocking::Client> {
        if self.client.is_none() {
            let config = HttpClientConfig::default();
            self.client = Some(build_http_client(&config)?);
        }
        Ok(self.client.as_ref().unwrap())
    }
}

#[derive(Debug, Deserialize)]
struct ClaudeConversationList {
    conversations: Vec<ClaudeConversationSummary>,
}

#[derive(Debug, Deserialize)]
struct ClaudeConversationSummary {
    uuid: String,
    name: Option<String>,
    created_at: String,
    updated_at: String,
    #[serde(default)]
    model: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClaudeConversationDetail {
    uuid: String,
    name: Option<String>,
    created_at: String,
    updated_at: String,
    chat_messages: Vec<ClaudeMessage>,
    #[serde(default)]
    model: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClaudeMessage {
    uuid: String,
    text: String,
    sender: String, // "human" or "assistant"
    created_at: String,
    #[serde(default)]
    attachments: Vec<serde_json::Value>,
}

impl CloudProvider for AnthropicProvider {
    fn name(&self) -> &'static str {
        "Claude"
    }
    
    fn api_base_url(&self) -> &str {
        ANTHROPIC_WEB_API
    }
    
    fn is_authenticated(&self) -> bool {
        self.api_key.is_some() || self.session_token.is_some()
    }
    
    fn set_credentials(&mut self, api_key: Option<String>, session_token: Option<String>) {
        self.api_key = api_key;
        self.session_token = session_token;
    }
    
    fn list_conversations(&self, _options: &FetchOptions) -> Result<Vec<CloudConversation>> {
        if !self.is_authenticated() {
            return Err(anyhow!(
                "Claude requires authentication. Set ANTHROPIC_API_KEY or provide a session token.\n\
                Note: The Anthropic API is stateless. For web conversations, extract your session token from browser cookies."
            ));
        }
        
        eprintln!("Note: Claude conversation history requires web session authentication.");
        eprintln!("The Anthropic API is stateless and doesn't store conversation history.");
        
        // In a real implementation:
        // 1. Use session token to call GET /api/organizations/{org_id}/chat_conversations
        // 2. Parse the conversation list
        
        Ok(vec![])
    }
    
    fn fetch_conversation(&self, _id: &str) -> Result<CloudConversation> {
        if !self.is_authenticated() {
            return Err(anyhow!("Claude requires authentication"));
        }
        
        Err(anyhow!(
            "Fetching Claude conversations requires web session authentication. \
            The Anthropic API doesn't store conversation history."
        ))
    }
    
    fn api_key_env_var(&self) -> &'static str {
        "ANTHROPIC_API_KEY"
    }
}

/// Parse a Claude export file (if available)
pub fn parse_claude_export(json_data: &str) -> Result<Vec<CloudConversation>> {
    // Claude doesn't have an official export format yet
    // This is a placeholder for when/if they add one
    let conversations: Vec<ClaudeExportConversation> = serde_json::from_str(json_data)?;
    
    Ok(conversations.into_iter().map(|conv| {
        CloudConversation {
            id: conv.uuid,
            title: conv.name,
            created_at: parse_iso_timestamp(&conv.created_at).unwrap_or_else(|_| Utc::now()),
            updated_at: Some(parse_iso_timestamp(&conv.updated_at).unwrap_or_else(|_| Utc::now())),
            model: conv.model,
            messages: conv.messages.into_iter().map(|msg| {
                CloudMessage {
                    id: Some(msg.uuid),
                    role: if msg.sender == "human" { "user".to_string() } else { "assistant".to_string() },
                    content: msg.text,
                    timestamp: parse_iso_timestamp(&msg.created_at).ok(),
                    model: None,
                }
            }).collect(),
            metadata: None,
        }
    }).collect())
}

#[derive(Debug, Deserialize)]
struct ClaudeExportConversation {
    uuid: String,
    name: Option<String>,
    created_at: String,
    updated_at: String,
    messages: Vec<ClaudeExportMessage>,
    #[serde(default)]
    model: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClaudeExportMessage {
    uuid: String,
    text: String,
    sender: String,
    created_at: String,
}

fn parse_iso_timestamp(s: &str) -> Result<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|e| anyhow!("Failed to parse timestamp: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Datelike;
    
    #[test]
    fn test_anthropic_provider_new() {
        let provider = AnthropicProvider::new(Some("test-key".to_string()));
        assert_eq!(provider.name(), "Claude");
        assert!(provider.is_authenticated());
    }
    
    #[test]
    fn test_anthropic_provider_unauthenticated() {
        let provider = AnthropicProvider::new(None);
        assert!(!provider.is_authenticated());
    }
    
    #[test]
    fn test_parse_iso_timestamp() {
        let ts = "2024-01-15T10:30:00Z";
        let dt = parse_iso_timestamp(ts).unwrap();
        assert_eq!(dt.year(), 2024);
        assert_eq!(dt.month(), 1);
        assert_eq!(dt.day(), 15);
    }
}
