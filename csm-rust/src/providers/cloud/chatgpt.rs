//! ChatGPT (OpenAI) cloud provider
//!
//! Fetches conversation history from ChatGPT web interface.
//!
//! ## Authentication
//!
//! Requires either:
//! - API key via `OPENAI_API_KEY` environment variable (for API access)
//! - Session token for web interface access (retrieved from browser cookies)
//!
//! Note: The official API doesn't provide conversation history access.
//! Web scraping requires a session token from browser cookies.

use super::common::{
    build_http_client, CloudConversation, CloudMessage, CloudProvider, FetchOptions,
    HttpClientConfig,
};
use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use serde::Deserialize;

const CHATGPT_API_BASE: &str = "https://chat.openai.com/backend-api";
const CHATGPT_AUTH_API: &str = "https://api.openai.com/v1";

/// ChatGPT provider for fetching conversation history
pub struct ChatGPTProvider {
    api_key: Option<String>,
    session_token: Option<String>,
    client: Option<reqwest::blocking::Client>,
}

impl ChatGPTProvider {
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

    fn get_auth_header(&self) -> Option<String> {
        if let Some(ref token) = self.session_token {
            Some(format!("Bearer {}", token))
        } else if let Some(ref key) = self.api_key {
            Some(format!("Bearer {}", key))
        } else {
            None
        }
    }
}

#[derive(Debug, Deserialize)]
struct ConversationListResponse {
    items: Vec<ConversationItem>,
    #[serde(default)]
    limit: i32,
    #[serde(default)]
    offset: i32,
    #[serde(default)]
    total: i32,
    #[serde(default)]
    has_missing_conversations: bool,
}

#[derive(Debug, Deserialize)]
struct ConversationItem {
    id: String,
    title: Option<String>,
    create_time: f64,
    update_time: Option<f64>,
    #[serde(default)]
    is_archived: bool,
}

#[derive(Debug, Deserialize)]
struct ConversationDetailResponse {
    title: Option<String>,
    create_time: f64,
    update_time: Option<f64>,
    mapping: std::collections::HashMap<String, MessageNode>,
    #[serde(default)]
    current_node: Option<String>,
    #[serde(default)]
    conversation_id: Option<String>,
    #[serde(default)]
    model: Option<ModelInfo>,
}

#[derive(Debug, Deserialize)]
struct MessageNode {
    id: String,
    #[serde(default)]
    parent: Option<String>,
    #[serde(default)]
    children: Vec<String>,
    message: Option<MessageContent>,
}

#[derive(Debug, Deserialize)]
struct MessageContent {
    id: String,
    author: AuthorInfo,
    create_time: Option<f64>,
    content: ContentParts,
    #[serde(default)]
    metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct AuthorInfo {
    role: String,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct ContentParts {
    content_type: String,
    #[serde(default)]
    parts: Option<Vec<serde_json::Value>>,
    #[serde(default)]
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ModelInfo {
    slug: Option<String>,
    max_tokens: Option<i32>,
    title: Option<String>,
}

impl CloudProvider for ChatGPTProvider {
    fn name(&self) -> &'static str {
        "ChatGPT"
    }

    fn api_base_url(&self) -> &str {
        CHATGPT_API_BASE
    }

    fn is_authenticated(&self) -> bool {
        self.api_key.is_some() || self.session_token.is_some()
    }

    fn set_credentials(&mut self, api_key: Option<String>, session_token: Option<String>) {
        self.api_key = api_key;
        self.session_token = session_token;
    }

    fn list_conversations(&self, _options: &FetchOptions) -> Result<Vec<CloudConversation>> {
        // Note: This requires a session token from ChatGPT web interface
        // The official API doesn't expose conversation history

        if !self.is_authenticated() {
            return Err(anyhow!(
                "ChatGPT requires authentication. Set OPENAI_API_KEY or provide a session token.\n\
                Note: The official API doesn't provide conversation history. \n\
                For web conversations, you'll need to extract your session token from browser cookies."
            ));
        }

        // For now, return an empty list with a helpful message
        // Full implementation would require session token authentication
        eprintln!("Note: ChatGPT conversation history requires web session authentication.");
        eprintln!("The official OpenAI API doesn't provide access to ChatGPT web conversations.");

        // In a real implementation, we would:
        // 1. Use the session token to authenticate
        // 2. Call GET /backend-api/conversations?offset=0&limit=50
        // 3. Parse and return the results

        Ok(vec![])
    }

    fn fetch_conversation(&self, _id: &str) -> Result<CloudConversation> {
        if !self.is_authenticated() {
            return Err(anyhow!("ChatGPT requires authentication"));
        }

        // Placeholder - would call GET /backend-api/conversation/{id}
        Err(anyhow!(
            "Fetching individual ChatGPT conversations requires web session authentication. \
            Please export your conversations using ChatGPT's built-in export feature."
        ))
    }

    fn api_key_env_var(&self) -> &'static str {
        "OPENAI_API_KEY"
    }
}

/// Parse a ChatGPT export file (JSON format from "Export data" feature)
pub fn parse_chatgpt_export(json_data: &str) -> Result<Vec<CloudConversation>> {
    let conversations: Vec<ChatGPTExportConversation> = serde_json::from_str(json_data)?;

    Ok(conversations
        .into_iter()
        .map(|conv| CloudConversation {
            id: conv.id,
            title: conv.title,
            created_at: timestamp_to_datetime(conv.create_time),
            updated_at: conv.update_time.map(timestamp_to_datetime),
            model: None,
            messages: conv
                .mapping
                .into_iter()
                .filter_map(|(_, node)| {
                    node.message.map(|msg| {
                        let content = msg
                            .content
                            .parts
                            .map(|parts| {
                                parts
                                    .into_iter()
                                    .filter_map(|p| p.as_str().map(String::from))
                                    .collect::<Vec<_>>()
                                    .join("\n")
                            })
                            .or(msg.content.text)
                            .unwrap_or_default();

                        CloudMessage {
                            id: Some(msg.id),
                            role: msg.author.role,
                            content,
                            timestamp: msg.create_time.map(timestamp_to_datetime),
                            model: None,
                        }
                    })
                })
                .filter(|m| !m.content.is_empty() && m.role != "system")
                .collect(),
            metadata: None,
        })
        .collect())
}

#[derive(Debug, Deserialize)]
struct ChatGPTExportConversation {
    id: String,
    title: Option<String>,
    create_time: f64,
    update_time: Option<f64>,
    mapping: std::collections::HashMap<String, ChatGPTExportNode>,
}

#[derive(Debug, Deserialize)]
struct ChatGPTExportNode {
    message: Option<ChatGPTExportMessage>,
}

#[derive(Debug, Deserialize)]
struct ChatGPTExportMessage {
    id: String,
    author: ChatGPTExportAuthor,
    create_time: Option<f64>,
    content: ChatGPTExportContent,
}

#[derive(Debug, Deserialize)]
struct ChatGPTExportAuthor {
    role: String,
}

#[derive(Debug, Deserialize)]
struct ChatGPTExportContent {
    #[serde(default)]
    parts: Option<Vec<serde_json::Value>>,
    #[serde(default)]
    text: Option<String>,
}

fn timestamp_to_datetime(ts: f64) -> DateTime<Utc> {
    use chrono::TimeZone;
    Utc.timestamp_opt(ts as i64, ((ts.fract()) * 1_000_000_000.0) as u32)
        .single()
        .unwrap_or_else(Utc::now)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chatgpt_provider_new() {
        let provider = ChatGPTProvider::new(Some("test-key".to_string()));
        assert_eq!(provider.name(), "ChatGPT");
        assert!(provider.is_authenticated());
    }

    #[test]
    fn test_chatgpt_provider_unauthenticated() {
        let provider = ChatGPTProvider::new(None);
        assert!(!provider.is_authenticated());
    }

    #[test]
    fn test_timestamp_to_datetime() {
        let ts = 1700000000.123;
        let dt = timestamp_to_datetime(ts);
        assert_eq!(dt.timestamp(), 1700000000);
    }
}
