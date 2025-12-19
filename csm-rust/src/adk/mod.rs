//! Agent Development Kit (ADK) - Rust Implementation
//!
//! A Rust-native framework for building, orchestrating, and deploying AI agents.
//! Inspired by multi-agent patterns but built from scratch for performance and control.
//!
//! ## Key Features
//!
//! - **Code-First Development**: Define agents and tools in Rust for type safety and performance
//! - **Modular Architecture**: Compose agents into hierarchies (sequential, parallel, loop)
//! - **Tool Ecosystem**: Built-in tools + custom function registration
//! - **Multi-Model Support**: Works with any LLM provider (Gemini, OpenAI, Anthropic, local)
//! - **Session Management**: Persistent conversation state with SQLite backend
//! - **Streaming Support**: Real-time response streaming via SSE
//!
//! ## Example
//!
//! ```rust,ignore
//! use csm::adk::{Agent, AgentBuilder, Tool, Runtime};
//!
//! let search_agent = AgentBuilder::new("researcher")
//!     .model("gemini-2.5-flash")
//!     .instruction("You are a helpful research assistant.")
//!     .tool(Tool::web_search())
//!     .build();
//!
//! let runtime = Runtime::new();
//! let result = runtime.run(&search_agent, "What is quantum computing?").await?;
//! ```

pub mod agent;
pub mod error;
pub mod executor;
pub mod models;
pub mod orchestrator;
pub mod runtime;
pub mod session;
pub mod tools;

// Re-export main types
pub use agent::{Agent, AgentBuilder, AgentConfig, AgentRole, AgentStatus};
pub use error::AdkError;
pub use executor::{ExecutionContext, ExecutionResult, Executor};
pub use models::{AdkMessage, AdkEvent, EventType, ToolCall, ToolResult};
pub use orchestrator::{Orchestrator, OrchestrationType, Pipeline, Swarm};
pub use runtime::{Runtime, RuntimeConfig};
pub use session::{Session, SessionManager, SessionState};
pub use tools::{Tool, ToolBuilder, ToolRegistry, BuiltinTools};
