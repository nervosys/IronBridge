# Chasm Roadmap

> **Last Updated:** January 29, 2026

This document tracks the development progress and future plans for Chasm (Chat Session Manager).

## Overview

Chasm is a unified platform for harvesting, managing, and analyzing AI chat sessions across multiple providers and tools.

---

## Components

| Component            | Status   | Description                              |
| -------------------- | -------- | ---------------------------------------- |
| **csm-rust**         | 🟢 Active | Core Rust library and API server         |
| **csm-web**          | 🟢 Active | React web application                    |
| **csm-app**          | � Active | React Native mobile app                  |
| **csm-shared**       | 🟢 Active | Shared TypeScript types and utilities    |
| **vscode-extension** | 🟢 Active | VS Code extension for session management |

---

## Completed ✅

### Core Infrastructure
- [x] Rust core library with session harvesting
- [x] REST API server (port 8787)
- [x] SQLite database for session storage
- [x] Cross-platform session format support
- [x] SSE-based real-time sync (Server-Sent Events)
- [x] WebSocket support for bidirectional real-time updates
- [x] Session encryption at rest (AES-256-GCM)
- [x] Cloud sync service integration (local, S3, Azure, GCS, WebDAV)

### Web Application
- [x] Dashboard with statistics overview
- [x] Chat interface with session replay
- [x] Agent management and inbox
- [x] Workspace browser
- [x] Session explorer with filtering
- [x] Provider configuration
- [x] Harvest management
- [x] Provider comparison view
- [x] Account management
- [x] Developer tools
- [x] Research interface
- [x] Dark mode theme system (CSS variables)
- [x] Demo mode with mock data fallback
- [x] Real-time sync status indicators
- [x] Advanced session search and filtering
- [x] Session diff/comparison view
- [x] Export to multiple formats (JSON, Markdown, HTML, PDF)

### Mobile Application
- [x] Basic navigation structure
- [x] Home screen
- [x] Workspace browser
- [x] Session list view
- [x] Chat interface
- [x] Provider configuration
- [x] Offline session caching
- [x] Push notifications for agent messages
- [x] Biometric authentication (Face ID, Touch ID, Fingerprint)

### VS Code Extension
- [x] Session tree view in sidebar
- [x] Quick session search
- [x] Inline session preview
- [x] One-click harvest from workspace
- [x] Orphaned session recovery

### Documentation
- [x] Sales presentation (Typst)
- [x] Automated screenshot capture (Playwright)
- [x] README documentation
- [x] Ecosystem alignment docs
- [x] Sync CONOPS documentation

---

## In Progress 🚧

### Q1-Q2 2026

#### Enhancements ✅
- [x] Session annotation and notes
- [x] Custom session templates
- [x] Keyboard shortcuts for power users
- [x] Batch operations (delete, archive, export)

#### Q2 2026 Features ✅
- [x] Multi-user collaboration
- [x] Team workspaces
- [x] Session sharing with permissions
- [x] AI-powered session summarization
- [x] Semantic search across sessions
- [x] Custom tagging and organization

---

## Planned 📋

### Q2 2026

#### Integrations
- [ ] GitHub Copilot Chat deep integration
- [ ] Cursor IDE support
- [x] Continue.dev support
- [ ] Claude Desktop/API
- [ ] ChatGPT API
- [ ] Local LLM providers (Ollama, LM Studio, etc.)

#### Platform
- [ ] Desktop application (Electron/Tauri)
- [ ] CLI tool for automation
- [ ] Browser extension for web-based AI tools

### Q3 2026

#### Enterprise Features
- [ ] SSO/SAML authentication
- [ ] Audit logging
- [ ] Data retention policies
- [ ] Admin dashboard
- [ ] Usage analytics

#### Advanced Features
- [ ] Session branching and merging
- [ ] Version control for conversations
- [ ] Automated backup scheduling
- [ ] Cross-device sync

---

## Provider Support Matrix

| Provider            | Harvest | View | Sync | Status  |
| ------------------- | ------- | ---- | ---- | ------- |
| GitHub Copilot Chat | ✅       | ✅    | 🚧    | Primary |
| VS Code Copilot     | ✅       | ✅    | 🚧    | Primary |
| Cursor              | 📋       | 📋    | 📋    | Planned |
| Continue.dev        | ✅       | 📋    | 📋    | Active  |
| GPT4All             | 📋       | 📋    | 📋    | Planned |
| Jan                 | 📋       | 📋    | 📋    | Planned |
| LlamaFile           | 📋       | 📋    | 📋    | Planned |
| LM Studio           | 📋       | 📋    | 📋    | Planned |
| LocalAI             | 📋       | 📋    | 📋    | Planned |
| Ollama              | 📋       | 📋    | 📋    | Planned |
| Text Gen WebUI      | 📋       | 📋    | 📋    | Planned |
| vLLM                | 📋       | 📋    | 📋    | Planned |

**Legend:** ✅ Complete | 🚧 In Progress | 📋 Planned

---

## Recent Changes

### January 2026 (Q2 2026 Features Sprint)

#### Shared Types (chasm-shared)
- Created collaboration types: users, teams, presence, cursors, permissions
- Created summarization types: AI providers, templates, session summaries
- Created semantic search types: embeddings, vector stores, hybrid search

#### Web Application (chasm-web)
- Added PresenceIndicator component for real-time user presence
- Added TeamWorkspacePanel for team management with invitations and roles
- Added ShareSessionModal for session sharing with granular permissions
- Added SessionSummaryPanel for AI-generated summary display
- Added SemanticSearchPanel for advanced natural language search

### January 2026 (Q1 Completion Sprint)

#### Infrastructure
- Added WebSocket handler for bidirectional real-time communication
- Implemented AES-256-GCM session encryption at rest
- Created cloud sync service with multi-provider support
- Added PBKDF2 key derivation for secure password-based encryption

#### Web Application
- Created ExportModal component with JSON/Markdown/HTML/PDF export
- Implemented AdvancedSearch component with multi-filter support
- Added SessionDiff component for side-by-side comparison
- Created SyncStatus components (indicator and panel)

#### Mobile Application
- Implemented biometric authentication service (Face ID, Touch ID, Fingerprint)
- Added offline session caching with AsyncStorage
- Created network state tracking for offline mode

#### VS Code Extension
- Added harvest commands (harvest, harvestScan)
- Implemented session search command
- Added orphaned session recovery
- Created session preview command

#### Previous
- Fixed dark mode styling in AgentInbox component
- Implemented demo mode with mock data fallback
- Automated screenshot capture for documentation
- Updated sales presentation with new screenshots

---

## Contributing

See [CONTRIBUTING.md](csm-rust/CONTRIBUTING.md) for guidelines on contributing to this project.

## License

This project is licensed under the terms specified in [LICENSE](LICENSE).
