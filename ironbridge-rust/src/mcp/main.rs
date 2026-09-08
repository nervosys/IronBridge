// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
//! IRONBRIDGE MCP Server - Entry point
//!
//! This binary provides a Model Context Protocol (MCP) server interface
//! for Chat System Manager, enabling AI agents to programmatically interact
//! with chat session management functionality.
//!
//! # Usage
//!
//! The server communicates via stdio (stdin/stdout) using JSON-RPC 2.0.
//!
//! ## Available Tools
//!
//! - `ironbridge_list_workspaces` - List all registered workspaces
//! - `ironbridge_find_workspace` - Find workspace by name or path
//! - `ironbridge_list_sessions` - List sessions in a workspace
//! - `ironbridge_list_orphaned` - Find orphaned session files
//! - `ironbridge_register_all` - Register all sessions in current directory
//! - `ironbridge_register_sessions` - Register specific sessions by ID or title
//! - `ironbridge_show_session` - Show details of a specific session
//! - `ironbridge_show_history` - Show history of workspace sessions
//! - `ironbridge_merge_sessions` - Merge multiple sessions
//! - `ironbridge_search` - Search sessions by content
//! - `ironbridge_detect` - Detect chat provider and sessions
//!
//! ## Available Resources
//!
//! - `ironbridge://workspaces` - List of all registered workspaces
//! - `ironbridge://sessions` - List of all sessions across workspaces
//! - `ironbridge://orphaned` - List of orphaned session files
//! - `ironbridge://providers` - List of supported chat providers
//! - `ironbridge://workspace/{hash}` - Details of a specific workspace
//! - `ironbridge://session/{id}` - Details of a specific session
//!
//! # Configuration
//!
//! Add to your MCP client configuration (e.g., Claude Desktop):
//!
//! ```json
//! {
//!   "mcpServers": {
//!     "ironbridge": {
//!       "command": "ironbridge-mcp",
//!       "args": []
//!     }
//!   }
//! }
//! ```

use ironbridge::mcp::server::McpServer;

fn main() {
    let mut server = McpServer::new();

    if let Err(e) = server.run() {
        eprintln!("[ironbridge-mcp] Server error: {}", e);
        std::process::exit(1);
    }
}
