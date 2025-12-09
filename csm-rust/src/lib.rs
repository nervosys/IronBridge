//! Chat Session Manager (CSM) - Library
//!
//! A library for managing and merging chat sessions across workspaces and LLM providers.
//!
//! ## Supported Providers
//!
//! - **VS Code Copilot Chat** - Default, file-based sessions
//! - **Cursor** - Cursor IDE chat sessions
//! - **Ollama** - Local LLM inference
//! - **vLLM** - High-performance LLM serving
//! - **Azure AI Foundry** - Microsoft's AI platform (Foundry Local)
//! - **LM Studio** - Local model runner
//! - **LocalAI** - Drop-in OpenAI replacement
//! - **Text Generation WebUI** - oobabooga's web interface
//! - **Jan.ai** - Open source ChatGPT alternative
//! - **GPT4All** - Local privacy-focused AI
//! - **Llamafile** - Portable executable LLMs

pub mod cli;
pub mod commands;
pub mod error;
pub mod models;
pub mod providers;
pub mod storage;
pub mod tui;
pub mod workspace;

// Re-export commonly used items
pub use cli::{Cli, Commands, HistoryCommands};
pub use error::CsmError;
pub use models::{ChatMessage, ChatRequest, ChatSession, ChatSessionIndex, ChatSessionIndexEntry, SessionWithPath, Workspace, WorkspaceJson};
pub use providers::{CsmConfig, GenericMessage, GenericSession, ProviderConfig, ProviderRegistry, ProviderType};
pub use workspace::{decode_workspace_folder, discover_workspaces, find_workspace_by_path, get_chat_sessions_from_workspace, get_workspace_storage_path, normalize_path, get_workspace_by_hash, get_workspace_by_path};
pub use storage::{add_session_to_index, is_vscode_running, read_chat_session_index, register_all_sessions_from_directory, write_chat_session_index, backup_workspace_sessions};
