//! Agent Execution
//!
//! Handles the execution of individual agents with tool calling.

use crate::adk::agent::{Agent, AgentStatus};
use crate::adk::error::{AdkError, AdkResult};
use crate::adk::models::{AdkEvent, AdkMessage, EventType, MessageRole, ToolCall, ToolResult, TokenUsage};
use crate::adk::session::{generate_message_id, Session};
use crate::adk::tools::ToolRegistry;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::mpsc;

/// Execution context passed to tools
#[derive(Debug, Clone)]
pub struct ExecutionContext {
    /// Session ID
    pub session_id: String,
    /// Agent name
    pub agent_name: String,
    /// User ID
    pub user_id: Option<String>,
    /// Current state
    pub state: HashMap<String, serde_json::Value>,
    /// Whether to allow tool execution
    pub allow_tools: bool,
    /// Maximum tool calls per turn
    pub max_tool_calls: u32,
    /// Event sender for streaming
    pub event_sender: Option<mpsc::Sender<AdkEvent>>,
}

impl ExecutionContext {
    pub fn new(session: &Session) -> Self {
        Self {
            session_id: session.id.clone(),
            agent_name: session.agent_name.clone(),
            user_id: session.user_id.clone(),
            state: session.state.data.clone(),
            allow_tools: true,
            max_tool_calls: 10,
            event_sender: None,
        }
    }

    /// Send an event to listeners
    pub async fn emit(&self, event: AdkEvent) {
        if let Some(sender) = &self.event_sender {
            let _ = sender.send(event).await;
        }
    }
}

/// Result of agent execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    /// Final response text
    pub response: String,
    /// Messages generated during execution
    pub messages: Vec<AdkMessage>,
    /// Events emitted
    pub events: Vec<AdkEvent>,
    /// Token usage
    pub token_usage: TokenUsage,
    /// Execution duration in milliseconds
    pub duration_ms: u64,
    /// Whether execution completed successfully
    pub success: bool,
    /// Error message if failed
    pub error: Option<String>,
}

/// Agent executor handles running an agent with optional tool calling
pub struct Executor {
    tool_registry: Arc<ToolRegistry>,
}

impl Executor {
    /// Create a new executor with the given tool registry
    pub fn new(tool_registry: Arc<ToolRegistry>) -> Self {
        Self { tool_registry }
    }

    /// Execute an agent with a user message
    pub async fn execute(
        &self,
        agent: &Agent,
        session: &mut Session,
        user_message: &str,
        ctx: &mut ExecutionContext,
    ) -> AdkResult<ExecutionResult> {
        let start_time = std::time::Instant::now();
        let mut messages = Vec::new();
        let mut events = Vec::new();
        let mut token_usage = TokenUsage::default();

        // Set agent status
        agent.set_status(AgentStatus::Thinking);

        // Emit start event
        let start_event = AdkEvent {
            event_type: EventType::AgentStart,
            agent_name: agent.name().to_string(),
            data: serde_json::json!({ "message": user_message }),
            timestamp: Utc::now(),
            session_id: Some(session.id.clone()),
        };
        events.push(start_event.clone());
        ctx.emit(start_event).await;

        // Add user message
        let user_msg = AdkMessage {
            id: generate_message_id(),
            role: MessageRole::User,
            content: user_message.to_string(),
            tool_calls: vec![],
            tool_result: None,
            timestamp: Utc::now(),
            tokens: None,
            agent_name: Some(agent.name().to_string()),
            metadata: HashMap::new(),
        };
        session.add_message(user_msg.clone());
        messages.push(user_msg);

        // Execute with tool loop
        let mut tool_call_count = 0;
        #[allow(unused_assignments)]
        let mut final_response = String::new();

        loop {
            // Call the model
            agent.set_status(AgentStatus::Thinking);
            let thinking_event = AdkEvent {
                event_type: EventType::Thinking,
                agent_name: agent.name().to_string(),
                data: serde_json::json!({}),
                timestamp: Utc::now(),
                session_id: Some(session.id.clone()),
            };
            events.push(thinking_event.clone());
            ctx.emit(thinking_event).await;

            // TODO: Implement actual model API call
            // For now, return a placeholder response
            let model_response = self.call_model(agent, session).await?;

            token_usage.add(&model_response.usage);

            // Check for tool calls
            if !model_response.tool_calls.is_empty() && ctx.allow_tools {
                agent.set_status(AgentStatus::WaitingForTool);

                for tool_call in &model_response.tool_calls {
                    tool_call_count += 1;
                    if tool_call_count > ctx.max_tool_calls {
                        return Err(AdkError::MaxIterationsExceeded(ctx.max_tool_calls));
                    }

                    // Emit tool call event
                    let call_event = AdkEvent {
                        event_type: EventType::ToolCall,
                        agent_name: agent.name().to_string(),
                        data: serde_json::json!({
                            "tool": tool_call.name,
                            "arguments": tool_call.arguments
                        }),
                        timestamp: Utc::now(),
                        session_id: Some(session.id.clone()),
                    };
                    events.push(call_event.clone());
                    ctx.emit(call_event).await;

                    // Execute tool
                    agent.set_status(AgentStatus::Executing);
                    let tool_result = self.execute_tool(tool_call).await;

                    // Emit tool result event
                    let result_event = AdkEvent {
                        event_type: EventType::ToolResult,
                        agent_name: agent.name().to_string(),
                        data: serde_json::json!({
                            "tool": tool_call.name,
                            "success": tool_result.success,
                            "content": tool_result.content
                        }),
                        timestamp: Utc::now(),
                        session_id: Some(session.id.clone()),
                    };
                    events.push(result_event.clone());
                    ctx.emit(result_event).await;

                    // Add tool result message
                    let tool_msg = AdkMessage {
                        id: generate_message_id(),
                        role: MessageRole::Tool,
                        content: tool_result.content.clone(),
                        tool_calls: vec![],
                        tool_result: Some(tool_result),
                        timestamp: Utc::now(),
                        tokens: None,
                        agent_name: Some(agent.name().to_string()),
                        metadata: HashMap::new(),
                    };
                    session.add_message(tool_msg.clone());
                    messages.push(tool_msg);
                }

                // Continue loop to get model response after tool results
                continue;
            }

            // No tool calls - we have the final response
            final_response = model_response.content.clone();

            // Add assistant message
            let assistant_msg = AdkMessage {
                id: generate_message_id(),
                role: MessageRole::Assistant,
                content: model_response.content,
                tool_calls: model_response.tool_calls,
                tool_result: None,
                timestamp: Utc::now(),
                tokens: Some(model_response.usage.completion_tokens),
                agent_name: Some(agent.name().to_string()),
                metadata: HashMap::new(),
            };
            session.add_message(assistant_msg.clone());
            messages.push(assistant_msg);

            break;
        }

        // Emit end event
        agent.set_status(AgentStatus::Completed);
        let end_event = AdkEvent {
            event_type: EventType::AgentEnd,
            agent_name: agent.name().to_string(),
            data: serde_json::json!({ "response": final_response }),
            timestamp: Utc::now(),
            session_id: Some(session.id.clone()),
        };
        events.push(end_event.clone());
        ctx.emit(end_event).await;

        Ok(ExecutionResult {
            response: final_response,
            messages,
            events,
            token_usage,
            duration_ms: start_time.elapsed().as_millis() as u64,
            success: true,
            error: None,
        })
    }

    /// Call the model (placeholder - implement with actual API)
    async fn call_model(&self, agent: &Agent, session: &Session) -> AdkResult<ModelResponse> {
        // TODO: Implement actual model API calls for different providers
        // This is a placeholder that returns a mock response

        let _messages = session.to_api_messages();
        let _tools = agent.tool_definitions();

        // Mock response
        Ok(ModelResponse {
            content: format!(
                "I'm {}, an AI assistant. I received your message and am ready to help. \
                (Note: This is a placeholder response - implement model API integration)",
                agent.name()
            ),
            tool_calls: vec![],
            usage: TokenUsage::new(10, 20),
        })
    }

    /// Execute a tool
    async fn execute_tool(&self, tool_call: &ToolCall) -> ToolResult {
        let start = std::time::Instant::now();

        // Check if tool exists
        if let Some(executor) = self.tool_registry.get_executor(&tool_call.name) {
            match executor.execute(tool_call.arguments.clone()).await {
                Ok(result) => result,
                Err(e) => ToolResult {
                    call_id: tool_call.id.clone(),
                    name: tool_call.name.clone(),
                    success: false,
                    content: format!("Tool execution failed: {}", e),
                    duration_ms: start.elapsed().as_millis() as u64,
                    data: None,
                },
            }
        } else {
            // Tool not found - return error result
            ToolResult {
                call_id: tool_call.id.clone(),
                name: tool_call.name.clone(),
                success: false,
                content: format!("Tool '{}' not found in registry", tool_call.name),
                duration_ms: start.elapsed().as_millis() as u64,
                data: None,
            }
        }
    }
}

/// Response from model API
struct ModelResponse {
    content: String,
    tool_calls: Vec<ToolCall>,
    usage: TokenUsage,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::adk::agent::AgentBuilder;

    #[tokio::test]
    async fn test_executor() {
        let tool_registry = Arc::new(ToolRegistry::new());
        let executor = Executor::new(tool_registry);

        let mut agent = AgentBuilder::new("test_agent")
            .description("Test agent")
            .instruction("You are a helpful assistant.")
            .model("gemini-2.5-flash")
            .build();

        let mut session = Session::new("test_agent", None);
        let mut ctx = ExecutionContext::new(&session);

        let result = executor
            .execute(&mut agent, &mut session, "Hello!", &mut ctx)
            .await
            .unwrap();

        assert!(result.success);
        assert!(!result.response.is_empty());
        assert!(!result.messages.is_empty());
    }
}
