// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
//! Agency Runtime
//!
//! High-level API for running agents with automatic session management.

#![allow(dead_code)]

use crate::agency::agent::Agent;
use crate::agency::error::{AgencyError, AgencyResult};
use crate::agency::executor::{ExecutionContext, ExecutionResult, Executor};
use crate::agency::models::AgencyEvent;
use crate::agency::orchestrator::{Orchestrator, OrchestratorResult, Pipeline, Swarm};
use crate::agency::session::{Session, SessionManager};
use crate::agency::tools::ToolRegistry;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::mpsc;

/// Runtime configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeConfig {
    /// Database path for session storage
    pub db_path: PathBuf,
    /// Default model to use
    pub default_model: String,
    /// Maximum tool calls per turn
    pub max_tool_calls: u32,
    /// Request timeout in seconds
    pub timeout_seconds: u64,
    /// Enable streaming by default
    pub streaming: bool,
    /// API keys for providers (provider -> key)
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub api_keys: HashMap<String, String>,
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            db_path: PathBuf::from("Agency_sessions.db"),
            default_model: "gemini-2.5-flash".to_string(),
            max_tool_calls: 10,
            timeout_seconds: 120,
            streaming: true,
            api_keys: HashMap::new(),
        }
    }
}

/// The Agency Runtime - main entry point for running agents
pub struct Runtime {
    config: RuntimeConfig,
    tool_registry: Arc<ToolRegistry>,
    session_manager: Arc<SessionManager>,
    executor: Arc<Executor>,
    orchestrator: Orchestrator,
    agents: HashMap<String, Arc<Agent>>,
    /// Feeds the Agent Inbox. `None` for in-memory runtimes, which have no
    /// database to write to and whose runs are not user-visible anyway.
    inbox: Option<crate::api::InboxEmitter>,
}

impl Runtime {
    /// Create a new runtime with default configuration
    pub fn new() -> AgencyResult<Self> {
        Self::with_config(RuntimeConfig::default())
    }

    /// Create a new runtime with custom configuration
    pub fn with_config(config: RuntimeConfig) -> AgencyResult<Self> {
        let tool_registry = Arc::new(ToolRegistry::with_builtins());
        let session_manager = Arc::new(SessionManager::new(&config.db_path)?);
        let executor = Arc::new(Executor::new(tool_registry.clone()));
        let orchestrator = Orchestrator::new(executor.clone());
        let inbox = Some(crate::api::InboxEmitter::new(&config.db_path));

        Ok(Self {
            config,
            tool_registry,
            session_manager,
            executor,
            orchestrator,
            agents: HashMap::new(),
            inbox,
        })
    }

    /// Create an in-memory runtime (for testing)
    pub fn in_memory() -> AgencyResult<Self> {
        let tool_registry = Arc::new(ToolRegistry::with_builtins());
        let session_manager = Arc::new(SessionManager::in_memory()?);
        let executor = Arc::new(Executor::new(tool_registry.clone()));
        let orchestrator = Orchestrator::new(executor.clone());

        Ok(Self {
            config: RuntimeConfig::default(),
            tool_registry,
            session_manager,
            executor,
            orchestrator,
            agents: HashMap::new(),
            inbox: None,
        })
    }

    /// Register an agent
    pub fn register_agent(&mut self, agent: Agent) {
        self.agents
            .insert(agent.name().to_string(), Arc::new(agent));
    }

    /// Get a registered agent
    pub fn get_agent(&self, name: &str) -> Option<&Arc<Agent>> {
        self.agents.get(name)
    }

    /// List registered agents
    pub fn list_agents(&self) -> Vec<&str> {
        self.agents.keys().map(|s| s.as_str()).collect()
    }

    /// Get the tool registry
    pub fn tools(&self) -> &ToolRegistry {
        &self.tool_registry
    }

    /// Get the session manager
    pub fn sessions(&self) -> &SessionManager {
        &self.session_manager
    }

    /// Run an agent with a message
    pub async fn run(
        &self,
        agent_name: &str,
        message: &str,
        options: Option<RunOptions>,
    ) -> AgencyResult<ExecutionResult> {
        let options = options.unwrap_or_default();

        // Get or create agent
        let agent_arc = self
            .agents
            .get(agent_name)
            .ok_or_else(|| AgencyError::AgentNotFound(agent_name.to_string()))?;

        // Get or create session
        let mut session = if let Some(session_id) = &options.session_id {
            self.session_manager
                .get(session_id)?
                .ok_or_else(|| AgencyError::SessionNotFound(session_id.clone()))?
        } else {
            self.session_manager
                .create(agent_name, options.user_id.clone())?
        };

        // Create execution context
        let mut ctx = ExecutionContext::new(&session);
        ctx.user_id = options.user_id;
        ctx.allow_tools = options.allow_tools;
        ctx.max_tool_calls = options.max_tool_calls.unwrap_or(self.config.max_tool_calls);
        ctx.event_sender = options.event_sender;

        // The Agent Inbox keys everything off the session id, so the run is
        // opened before execution rather than recorded after it -- a run that
        // never returns still needs to be visible as `running`.
        let run_id = session.id.clone();
        if let Some(inbox) = &self.inbox {
            inbox.workflow_started(&run_id, agent_name, None);
        }

        // Execute
        let result = self
            .executor
            .execute(agent_arc.as_ref(), &mut session, message, &mut ctx)
            .await;

        if let Some(inbox) = &self.inbox {
            match &result {
                Ok(r) => {
                    inbox.workflow_finished(
                        &run_id,
                        agent_name,
                        r.success,
                        r.token_usage.total_tokens as i64,
                    );
                    // The response is what the user actually wants to read,
                    // so it lands in the inbox as a message rather than only
                    // as a "finished" notification.
                    if r.success && !r.response.trim().is_empty() {
                        inbox.message_from_agent(agent_name, message, &r.response, Some(&run_id));
                    }
                }
                // An error here means the run died, not that it finished
                // unsuccessfully; both read as `failed` to the client.
                Err(_) => inbox.workflow_finished(&run_id, agent_name, false, 0),
            }
        }
        let result = result?;

        // Save session
        self.session_manager.save(&session)?;

        Ok(result)
    }

    /// Run an agent with streaming events
    pub async fn run_stream(
        &self,
        agent_name: &str,
        message: &str,
        options: Option<RunOptions>,
    ) -> AgencyResult<(ExecutionResult, mpsc::Receiver<AgencyEvent>)> {
        let (tx, rx) = mpsc::channel(100);
        let mut options = options.unwrap_or_default();
        options.event_sender = Some(tx);

        let result = self.run(agent_name, message, Some(options)).await?;
        Ok((result, rx))
    }

    /// Run a pipeline
    pub async fn run_pipeline(
        &self,
        pipeline: &Pipeline,
        input: &str,
        options: Option<RunOptions>,
    ) -> AgencyResult<OrchestratorResult> {
        let options = options.unwrap_or_default();

        let session = Session::new(&pipeline.name, options.user_id.clone());
        let mut ctx = ExecutionContext::new(&session);
        ctx.user_id = options.user_id;
        ctx.allow_tools = options.allow_tools;
        ctx.event_sender = options.event_sender;

        let run_id = session.id.clone();
        if let Some(inbox) = &self.inbox {
            inbox.workflow_started(&run_id, &pipeline.name, None);
        }
        let result = self
            .orchestrator
            .run_pipeline(pipeline, input, &mut ctx)
            .await;
        self.record_orchestration(&run_id, &pipeline.name, &result);
        result
    }

    /// Run a swarm
    pub async fn run_swarm(
        &self,
        swarm: &Swarm,
        input: &str,
        options: Option<RunOptions>,
    ) -> AgencyResult<OrchestratorResult> {
        let options = options.unwrap_or_default();

        let session = Session::new(&swarm.name, options.user_id.clone());
        let mut ctx = ExecutionContext::new(&session);
        ctx.user_id = options.user_id;
        ctx.allow_tools = options.allow_tools;
        ctx.event_sender = options.event_sender;

        let run_id = session.id.clone();
        if let Some(inbox) = &self.inbox {
            // A swarm is its own grouping, so the run doubles as the swarm id
            // and the client can collapse its agents under one entry.
            inbox.workflow_started(&run_id, &swarm.name, Some(&run_id));
        }
        let result = self.orchestrator.run_swarm(swarm, input, &mut ctx).await;
        self.record_orchestration(&run_id, &swarm.name, &result);
        result
    }

    /// Close out a pipeline or swarm run in the inbox.
    ///
    /// Orchestrator results carry no `success` flag -- reaching the end
    /// without an error is the success condition -- so that is what is
    /// recorded.
    fn record_orchestration(
        &self,
        run_id: &str,
        name: &str,
        result: &AgencyResult<OrchestratorResult>,
    ) {
        let Some(inbox) = &self.inbox else {
            return;
        };
        match result {
            Ok(r) => {
                inbox.workflow_finished(run_id, name, true, r.token_usage.total_tokens as i64);
                if !r.response.trim().is_empty() {
                    inbox.message_from_agent(name, name, &r.response, Some(run_id));
                }
            }
            Err(e) => {
                inbox.workflow_finished(run_id, name, false, 0);
                inbox.notify(
                    "workflow_error",
                    "high",
                    &format!("{} failed", name),
                    &e.to_string(),
                    Some(run_id),
                    Some(name),
                );
            }
        }
    }

    /// Create a new session for an agent
    pub fn create_session(
        &self,
        agent_name: &str,
        user_id: Option<String>,
    ) -> AgencyResult<Session> {
        self.session_manager.create(agent_name, user_id)
    }

    /// Get a session by ID
    pub fn get_session(&self, session_id: &str) -> AgencyResult<Option<Session>> {
        self.session_manager.get(session_id)
    }

    /// List sessions for an agent
    pub fn list_sessions(
        &self,
        agent_name: &str,
        limit: Option<u32>,
    ) -> AgencyResult<Vec<Session>> {
        self.session_manager.list_by_agent(agent_name, limit)
    }

    /// Delete a session
    pub fn delete_session(&self, session_id: &str) -> AgencyResult<bool> {
        self.session_manager.delete(session_id)
    }
}

/// Options for running an agent
#[derive(Debug, Clone, Default)]
pub struct RunOptions {
    /// Session ID to continue (creates new if not provided)
    pub session_id: Option<String>,
    /// User ID
    pub user_id: Option<String>,
    /// Allow tool execution
    pub allow_tools: bool,
    /// Maximum tool calls
    pub max_tool_calls: Option<u32>,
    /// Event sender for streaming
    pub event_sender: Option<mpsc::Sender<AgencyEvent>>,
}

impl RunOptions {
    pub fn new() -> Self {
        Self {
            allow_tools: true,
            ..Default::default()
        }
    }

    pub fn with_session(mut self, session_id: impl Into<String>) -> Self {
        self.session_id = Some(session_id.into());
        self
    }

    pub fn with_user(mut self, user_id: impl Into<String>) -> Self {
        self.user_id = Some(user_id.into());
        self
    }

    pub fn with_tools(mut self, allow: bool) -> Self {
        self.allow_tools = allow;
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agency::agent::AgentBuilder;

    #[tokio::test]
    #[ignore = "Integration test - requires API credentials"]
    async fn test_runtime() -> AgencyResult<()> {
        let mut runtime = Runtime::in_memory()?;

        let agent = AgentBuilder::new("assistant")
            .description("A helpful assistant")
            .instruction("You are a helpful AI assistant.")
            .model("gemini-2.5-flash")
            .build();

        runtime.register_agent(agent);

        let result = runtime.run("assistant", "Hello!", None).await?;
        assert!(result.success);
        assert!(!result.response.is_empty());

        Ok(())
    }

    #[tokio::test]
    #[ignore = "Integration test - requires API credentials"]
    async fn test_runtime_sessions() -> AgencyResult<()> {
        let mut runtime = Runtime::in_memory()?;

        let agent = AgentBuilder::new("test_agent")
            .instruction("You are a test agent.")
            .build();

        runtime.register_agent(agent);

        // Create session
        let session = runtime.create_session("test_agent", Some("user1".to_string()))?;
        assert_eq!(session.agent_name, "test_agent");

        // Run with session
        let options = RunOptions::new()
            .with_session(&session.id)
            .with_user("user1");

        let result = runtime
            .run("test_agent", "Test message", Some(options))
            .await?;
        assert!(result.success);

        // Verify session was updated
        let updated_session = runtime.get_session(&session.id)?.unwrap();
        assert!(!updated_session.messages.is_empty());

        Ok(())
    }
}
