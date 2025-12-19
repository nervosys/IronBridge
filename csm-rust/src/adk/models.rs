//! ADK Data Models
//!
//! Core data structures for the Agent Development Kit.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Message in an ADK conversation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdkMessage {
    /// Unique message ID
    pub id: String,
    /// Role: user, assistant, system, tool
    pub role: MessageRole,
    /// Message content
    pub content: String,
    /// Optional tool calls in this message
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tool_calls: Vec<ToolCall>,
    /// Optional tool result (if role is tool)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_result: Option<ToolResult>,
    /// Message timestamp
    pub timestamp: DateTime<Utc>,
    /// Token count (if available)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tokens: Option<u32>,
    /// Associated agent name
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_name: Option<String>,
    /// Additional metadata
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Message role
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    User,
    Assistant,
    System,
    Tool,
}

impl std::fmt::Display for MessageRole {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MessageRole::User => write!(f, "user"),
            MessageRole::Assistant => write!(f, "assistant"),
            MessageRole::System => write!(f, "system"),
            MessageRole::Tool => write!(f, "tool"),
        }
    }
}

/// Tool call request from the model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    /// Unique call ID
    pub id: String,
    /// Tool name
    pub name: String,
    /// Tool arguments as JSON
    pub arguments: serde_json::Value,
    /// Call timestamp
    #[serde(default = "Utc::now")]
    pub timestamp: DateTime<Utc>,
}

/// Result from tool execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    /// Associated tool call ID
    pub call_id: String,
    /// Tool name
    pub name: String,
    /// Whether execution succeeded
    pub success: bool,
    /// Result content (or error message)
    pub content: String,
    /// Execution duration in milliseconds
    #[serde(default)]
    pub duration_ms: u64,
    /// Additional output data
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

/// Event emitted during agent execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdkEvent {
    /// Event type
    pub event_type: EventType,
    /// Associated agent name
    pub agent_name: String,
    /// Event data
    pub data: serde_json::Value,
    /// Event timestamp
    pub timestamp: DateTime<Utc>,
    /// Session ID
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
}

/// Types of events during execution
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    /// Agent started processing
    AgentStart,
    /// Agent finished processing
    AgentEnd,
    /// Model is thinking/generating
    Thinking,
    /// Model response (partial or complete)
    ModelResponse,
    /// Tool call initiated
    ToolCall,
    /// Tool execution completed
    ToolResult,
    /// Agent handoff to another agent
    Handoff,
    /// Error occurred
    Error,
    /// Execution cancelled
    Cancelled,
    /// State updated
    StateUpdate,
}

impl std::fmt::Display for EventType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EventType::AgentStart => write!(f, "agent_start"),
            EventType::AgentEnd => write!(f, "agent_end"),
            EventType::Thinking => write!(f, "thinking"),
            EventType::ModelResponse => write!(f, "model_response"),
            EventType::ToolCall => write!(f, "tool_call"),
            EventType::ToolResult => write!(f, "tool_result"),
            EventType::Handoff => write!(f, "handoff"),
            EventType::Error => write!(f, "error"),
            EventType::Cancelled => write!(f, "cancelled"),
            EventType::StateUpdate => write!(f, "state_update"),
        }
    }
}

/// Token usage statistics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TokenUsage {
    /// Prompt/input tokens
    pub prompt_tokens: u32,
    /// Completion/output tokens
    pub completion_tokens: u32,
    /// Total tokens
    pub total_tokens: u32,
}

impl TokenUsage {
    pub fn new(prompt: u32, completion: u32) -> Self {
        Self {
            prompt_tokens: prompt,
            completion_tokens: completion,
            total_tokens: prompt + completion,
        }
    }

    pub fn add(&mut self, other: &TokenUsage) {
        self.prompt_tokens += other.prompt_tokens;
        self.completion_tokens += other.completion_tokens;
        self.total_tokens += other.total_tokens;
    }
}

/// Model configuration for an agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    /// Model identifier (e.g., "gemini-2.5-flash", "gpt-4o")
    pub model: String,
    /// Provider type
    #[serde(default)]
    pub provider: ModelProvider,
    /// API endpoint (if custom)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub endpoint: Option<String>,
    /// API key (if not using environment variable)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    /// Temperature (0.0 - 2.0)
    #[serde(default = "default_temperature")]
    pub temperature: f32,
    /// Max output tokens
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    /// Top-p sampling
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
}

fn default_temperature() -> f32 {
    0.7
}

impl Default for ModelConfig {
    fn default() -> Self {
        Self {
            model: "gemini-2.5-flash".to_string(),
            provider: ModelProvider::Google,
            endpoint: None,
            api_key: None,
            temperature: 0.7,
            max_tokens: None,
            top_p: None,
        }
    }
}

/// Supported model providers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ModelProvider {
    #[default]
    Google,
    OpenAI,
    Anthropic,
    Azure,
    Ollama,
    OpenAICompatible,
    Custom,
}

impl std::fmt::Display for ModelProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ModelProvider::Google => write!(f, "google"),
            ModelProvider::OpenAI => write!(f, "openai"),
            ModelProvider::Anthropic => write!(f, "anthropic"),
            ModelProvider::Azure => write!(f, "azure"),
            ModelProvider::Ollama => write!(f, "ollama"),
            ModelProvider::OpenAICompatible => write!(f, "openai_compatible"),
            ModelProvider::Custom => write!(f, "custom"),
        }
    }
}
