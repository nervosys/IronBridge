//! TUI (Text User Interface) module for interactive browsing of chat sessions
//!
//! Provides color-coded tables and interactive navigation for VS Code Copilot Chat sessions.

mod app;
mod ui;
mod events;

pub use events::run_tui;
