//! MCP (Model Context Protocol) Server for Chat System Manager
//!
//! This module implements an MCP server that exposes csm functionality
//! to AI agents, enabling them to:
//! - List and search workspaces and chat sessions
//! - Access csm-web database sessions and messages
//! - Find orphaned sessions not in VS Code's index
//! - Register sessions to make them visible
//! - Merge sessions across workspaces
//! - Search chat history with full-text search

pub mod db;
pub mod server;
pub mod tools;
pub mod resources;
pub mod types;

pub use server::McpServer;
