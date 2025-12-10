# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2024-12-09

### Added

- **Harvest System** - Unified database for collecting sessions from all providers
  - `csm harvest init` - Initialize the harvest database
  - `csm harvest scan` - Scan for available providers and sessions
  - `csm harvest run` - Collect sessions from all providers
  - `csm harvest status` - Show database statistics
  - `csm harvest list` - List harvested sessions
  - `csm harvest export` - Export sessions from the database

- **Share Link Import** - Import shared chat sessions from web URLs
  - `csm harvest share <url>` - Register a share link for import
  - `csm harvest shares` - List pending or imported share links
  - Supports ChatGPT, Claude, Gemini, Perplexity, and Poe share URLs

- **Session Checkpoints** - Version snapshots for session tracking
  - `csm harvest checkpoint <session>` - Create a named checkpoint
  - `csm harvest checkpoints <session>` - List session checkpoints
  - `csm harvest restore <session> <checkpoint>` - Restore to checkpoint

- **Full-Text Search** - Search across all harvested messages
  - `csm harvest search <query>` - Search with FTS5 or LIKE fallback
  - `--provider` filter for provider-specific search
  - `--limit` to control result count

- **Universal Database Schema** (SQLite)
  - `sessions` - Session metadata with provider tracking
  - `messages` - Individual messages with full-text search
  - `checkpoints` - Version snapshots with content hashing
  - `share_links` - Pending and imported share URLs
  - `messages_fts` - FTS5 virtual table for fast search

- **Browser Integration** (foundation)
  - Browser profile discovery for Chrome, Edge, Firefox, Brave
  - Cookie extraction support (Windows DPAPI)

- **Auto-Detection Improvements**
  - `csm detect` - Enhanced workspace and provider detection
  - `csm detect all` - Comprehensive detection report
  - `csm detect providers --with-sessions` - Filter by active providers

### Changed

- Improved CLI output with ASCII-only characters for cross-platform compatibility
- Enhanced error messages with actionable suggestions
- Better handling of missing or inaccessible sessions

### Fixed

- Search query column name mismatch in harvest database
- Schema consistency between database.rs and harvest.rs
- Foreign key constraint issues in checkpoint tests

## [0.1.0] - 2024-11-15

### Added

- Initial release
- Workspace discovery and management
- Session import/export between workspaces
- History merging with chronological ordering
- Git integration for chat session versioning
- Migration tools for cross-machine transfers
- Interactive TUI browser
- Multi-provider support:
  - VS Code GitHub Copilot
  - Cursor IDE
  - Ollama
  - vLLM
  - Azure AI Foundry
  - LM Studio
  - LocalAI
  - Text Gen WebUI
  - Jan.ai
  - GPT4All
  - Llamafile
- Cross-platform support (Windows, macOS, Linux)
