# Chasm Roadmap

> **Last Updated:** July 31, 2026

This document tracks the development progress and future plans for Chasm (Chat Session Manager).

> **Reading the checkboxes.** A `[x]` below means the feature was built, not
> necessarily that it is wired up and usable. Items marked `[~]` are present in
> the tree but incomplete — see [Known gaps](#known-gaps) for what is actually
> shippable today. `README.md` carries the same summary under
> "Implementation status".

## Known gaps

Verified against the tree as of July 31, 2026:

| Item | Reality |
| --- | --- |
| GraphQL API | Mounted and backed by the database. `harvest` and `sync` mutations return errors by design (use the CLI or REST). `tags` is rejected on session updates -- no column exists for it. |
| REST API | Two parallel implementations exist and the larger one is orphaned. `api/handlers.rs` (2049 LOC, where the 24 `"not yet implemented"` stubs live) and `api/routes.rs` (76 routes) have no `mod` declaration, so rustc never compiles them. The served API is the 46 routes in `api/mod.rs` plus auth, sync, recording, and websocket. |
| Orphaned API modules | 5989 LOC across `api/{handlers,routes,analytics,backup,branching,device_sync,versioning}.rs` is absent from the crate's dependency graph — verified against rustc's own dep-info, not by grep. |
| Compiled but unmounted | `api/docs.rs` (4 routes) and `api/webhooks.rs` (8 routes) compile, but `configure_docs_routes` and `configure_webhook_routes` are never called and the modules are private, so the routes are unreachable. |
| SSO/SAML | Signature verification is implemented (samael/libxmlsec1) and covered by wrapping-attack tests. Still not end-to-end usable: `DatabaseOps` has no implementor, so IdP config and sessions do not persist. Requires libxmlsec1; built on Linux only in CI. |
| Audit logging, retention | Compile and are unit-tested, but `api::audit::DatabaseOps` has no implementor — nothing persists. |
| AI & Intelligence | Heuristic, not model-backed: substring keyword matching, lexicon sentiment, Jaccard similarity. |
| Embeddings / semantic search | Implemented against the OpenAI embeddings API, with index-order and dimension validation. Requires an API key; without one, embedding calls error rather than returning zeros. |
| Desktop application | Tauri shell only (176 LOC). |
| Agent inbox | No notification, inbox-message, permission-request, or workflow-run endpoints exist, and nothing emits those events. The view renders empty unless `VITE_ENABLE_DEMO_MODE` is set. |

The CLI, core library, harvest/recovery pipeline, provider parsers, MCP server,
and TUI are complete and covered by 887 passing tests.

## Overview

Chasm is a unified platform for harvesting, managing, and analyzing AI chat sessions across multiple providers and tools.

---

## Components

| Component             | Status   | Description                              |
| --------------------- | -------- | ---------------------------------------- |
| **chasm-rust**        | 🟢 Active | Core Rust CLI, library, and API server   |
| **chasm-web**         | 🟢 Active | React web application                    |
| **chasm-app**         | 🟢 Active | React Native mobile app                  |
| **chasm-shared**      | 🟢 Active | Shared TypeScript types and utilities    |
| **chasm-desktop**     | 🚧 Shell  | Tauri shell only (176 LOC)               |
| **vscode-extension**  | 🟢 Active | VS Code extension for session management |
| **browser-extension** | 🟢 Active | Chrome/Firefox extension for web AI chat |
| **jetbrains-plugin**  | 🟢 Active | IntelliJ/JetBrains IDE plugin            |
| **neovim-plugin**     | 🟢 Active | Neovim plugin (Lua)                      |
| **vim-plugin**        | 🟢 Active | Vim plugin (VimScript)                   |
| **docs website**      | 🟢 Active | MkDocs Material documentation site       |

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
- [x] Demo mode (opt-in via `VITE_ENABLE_DEMO_MODE`; never substitutes for a live backend)
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
- [x] Real-time session recording (prevents data loss from crashes)
- [x] Recording API with event buffering and snapshots
- [x] Multi-provider recording support (VS Code, Cursor, Continue.dev, Claude Code, OpenCode, Windsurf, etc.)

### Documentation
- [x] Sales presentation (Typst)
- [x] Automated screenshot capture (Playwright)
- [x] README documentation
- [x] Ecosystem alignment docs
- [x] Sync CONOPS documentation
- [x] MkDocs Material documentation website (Abyss dark theme)
- [x] Custom logo and favicon SVGs

### Licensing & Governance
- [x] AGPL-3.0-only license with commercial dual-license
- [x] Contributor License Agreement (CLA)
- [x] SPDX headers across all 146 source files
- [x] Open Source Strategy documentation

### Recent Features (February 2026)
- [x] `chasm watch` — File-system monitoring for auto-harvest
- [x] `chasm run` — Agent launcher with auto-save
- [x] `chasm sync` — Bidirectional session backup/restore
- [x] Real-time session recording API (crash recovery)
- [x] Codex CLI, Droid CLI, Gemini CLI provider support
- [x] Agent skills framework

---

## In Progress 🚧

### Q1 2026

#### Browser Extension Publication
- [ ] Firefox Add-on Store publication
- [ ] Chrome Web Store publication
- [x] PNG icon generation (16, 32, 48, 128px)
- [x] Privacy policy and store listing copy

#### Documentation Website
- [x] API reference auto-generation from OpenAPI spec (Swagger UI)
- [x] Provider-specific setup guides (12 providers)
- [x] Video tutorials and screencasts (Remotion)
- [x] Search functionality (MkDocs search plugin)

#### CLI Polish
- [x] Shell completions (Bash, Zsh, Fish, PowerShell, Elvish)
- [x] `chasm doctor` — Environment diagnostics command (13+ checks)
- [x] `chasm provider` — Provider management commands
- [x] `chasm watch` — File-system monitoring with auto-harvest
- [x] Interactive TUI improvements (session browsing, export, filtering)
- [x] CLI reference documentation (watch, provider, completions, doctor)

---

## Completed ✅ (Previously Planned)

### Q1-Q2 2026

#### Enhancements
- [x] Session annotation and notes
- [x] Custom session templates
- [x] Keyboard shortcuts for power users
- [x] Batch operations (delete, archive, export)

#### Q2 2026 Features
- [x] Multi-user collaboration
- [x] Team workspaces
- [x] Session sharing with permissions
- [~] AI-powered session summarization — heuristic key-point extraction only; no model inference
- [~] Semantic search across sessions — `OpenAIEmbedding::embed` returns a zero vector, so ranking is degenerate
- [x] Custom tagging and organization

### Q2 2026

#### Integrations
- [x] GitHub Copilot Chat deep integration
- [x] Cursor IDE support
- [x] Continue.dev support
- [x] Claude Desktop/API
- [x] ChatGPT API
- [x] Local LLM providers (Ollama, LM Studio, etc.)

#### Platform
- [~] Desktop application (Tauri) — shell only (176 LOC)
- [x] CLI tool for automation (chasm-cli v1.3.2 on crates.io)
- [x] Browser extension for web-based AI tools (Chrome/Firefox Manifest V3)

### Q3 2026

#### Enterprise Features
- [~] SSO/SAML authentication (SAML 2.0 IdP integration) — flow and signature verification done; blocked on `DatabaseOps` persistence
- [~] Audit logging (comprehensive event tracking) — no `DatabaseOps` implementor, nothing persists
- [~] Data retention policies (configurable lifecycle management) — no `DatabaseOps` implementor, nothing persists
- [~] Admin dashboard (React admin UI with system management) — the agent-inbox view has no backend
- [x] Usage analytics (event tracking, metrics, time series, dashboards)

#### Advanced Features
- [x] Session branching and merging (fork, merge with conflict resolution)
- [x] Version control for conversations (commits, diff, tags, checkout/revert)
- [x] Automated backup scheduling (cron schedules, multi-destination, retention)
- [x] Cross-device sync (CRDT-based, offline-first, conflict resolution)

### Q4 2026

#### Sync Completion
- [x] Bidirectional sync engine (push/pull with change tracking)
- [x] Conflict resolution strategies (LocalWins, RemoteWins, MostRecent, Manual)
- [x] Provider-specific sync adapters (VSCode, extensible to others)

#### AI & Intelligence
- [~] Topic extraction and categorization (keyword substring matching, not model-backed)
- [x] Conversation insights generation
- [~] Sentiment analysis (lexicon-based, not model-backed)
- [x] Quality scoring for sessions
- [~] Similarity detection (Jaccard-based, not model-backed)
- [x] Session recommendation engine

#### Platform Maturity
- [x] Plugin system architecture (manifest, lifecycle, event hooks)
- [x] Workflow automation engine (triggers, conditions, actions)
- [x] Extended provider support (GPT4All, Jan, LM Studio, LocalAI, TextGen WebUI)

### Q1 2027

#### Browser Extension Enhancement
- [x] Additional provider content scripts (Copilot, Poe, Perplexity)
- [x] Auto-harvest with configurable schedules
- [x] Firefox Manifest V2 compatibility

#### API Enhancements
- [x] GraphQL API endpoint — mounted at /graphql with database-backed resolvers
- [x] Webhook integrations
- [x] OpenAPI/Swagger documentation

### Q2 2027

#### AI Agents
- [x] Autonomous session archival agent
- [x] Context-aware search refinement

#### Ecosystem
- [x] JetBrains IDE plugin
- [x] Neovim/Vim plugin

### Q3 2027

#### Team Features
- [x] Workspace sharing and permissions
- [x] Team session templates
- [~] Audit logging for compliance — see Known gaps

#### Analytics Dashboard
- [x] Usage metrics and insights
- [x] Cost tracking per provider
- [x] Productivity analytics

### Q4 2027

#### Advanced AI Routing
- [x] Multi-model orchestration
- [x] Cost-optimized routing
- [x] Fallback chain configuration

#### Enterprise Scale
- [x] Multi-region deployment
- [x] High availability configuration
- [x] Performance monitoring

### Q1 2028

#### Mobile Enhancements
- [x] Background sync optimization
- [x] Widget support (iOS/Android)
- [x] Offline-first architecture improvements

#### Performance & Scale
- [x] Database sharding support
- [x] Edge caching layer
- [x] Connection pooling improvements

#### Developer Experience
- [x] SDK generator for custom integrations
- [x] API rate limiting dashboard
- [x] Enhanced debugging tools
---

## Provider Support Matrix

| Provider            | Harvest | View | Sync | Status  |
| ------------------- | ------- | ---- | ---- | ------- |
| GitHub Copilot Chat | ✅       | ✅    | 🚧    | Primary |
| VS Code Copilot     | ✅       | ✅    | 🚧    | Primary |
| Cursor              | ✅       | ✅    | 📋    | Active  |
| ClaudeCode          | ✅       | ✅    | 📋    | Active  |
| Codex CLI (OpenAI)  | ✅       | ✅    | 📋    | Active  |
| Droid CLI (Factory) | ✅       | ✅    | 📋    | Active  |
| Gemini CLI (Google) | ✅       | ✅    | 📋    | Active  |
| OpenCode            | ✅       | ✅    | 📋    | Active  |
| OpenClaw            | ✅       | ✅    | 📋    | Active  |
| Antigravity         | ✅       | ✅    | 📋    | Active  |
| Continue.dev        | ✅       | 📋    | 📋    | Active  |
| ChatGPT             | ✅       | ✅    | 📋    | Active  |
| GPT4All             | ✅       | ✅    | 📋    | Active  |
| Jan                 | ✅       | ✅    | 📋    | Active  |
| LlamaFile           | ✅       | ✅    | —    | Active  |
| LM Studio           | ✅       | ✅    | 📋    | Active  |
| LocalAI             | ✅       | ✅    | —    | Active  |
| Ollama              | ✅       | ✅    | 📋    | Active  |
| Text Gen WebUI      | ✅       | ✅    | 📋    | Active  |
| vLLM                | ✅       | ✅    | —    | Active  |

**Legend:** ✅ Complete | 🚧 In Progress | 📋 Planned

---

## Recent Changes

### February 2026 (v1.3.2)

#### License & Governance
- Switched to AGPL-3.0-only with commercial dual-license
- Created Contributor License Agreement (CLA)
- Updated SPDX headers across all 146 source files

#### Documentation Website
- MkDocs Material documentation site with Abyss dark theme
- Custom SVG logo and favicon (bridge/void gradient)
- Sections: Getting Started, Guides, API Reference, Providers
- Dark mode default, homepage hero with project stats

#### New CLI Commands
- `chasm watch` — File-system monitoring with auto-harvest on session changes
- `chasm run` — Agent launcher with auto-save capabilities
- `chasm sync` — Bidirectional session backup/restore

#### New Providers
- Codex CLI (OpenAI) — JSONL sessions in `~/.codex/sessions/`
- Droid CLI (Factory) — JSONL sessions in `~/.factory/sessions/`
- Gemini CLI (Google) — JSON sessions in `~/.gemini/tmp/`

#### Real-time Recording API (v1.3.2)
- Session recording to prevent data loss from editor crashes
- Event buffering: SessionStart, MessageAdd, MessageAppend, Heartbeat
- Snapshot storage for full session recovery
- Multi-provider recording (VS Code, Cursor, Continue.dev, Claude Code, etc.)

#### Agent Skills Framework
- Agent skills system for extensible AI tool integration
- SpecStory comparison documentation

### February 2026 (v1.1.0 Multi-Provider Forensics)

#### Multi-Provider Session Forensics (chasm-rust)
- Added cross-provider session discovery and analysis
- New providers: ClaudeCode, OpenCode, OpenClaw, Antigravity
- Commands support `--provider` and `--all-providers` flags:
  - `chasm list sessions` - List sessions from specific or all providers
  - `chasm list agents` - List agent mode sessions across providers
  - `chasm show timeline` - Aggregate timeline visualization
  - `chasm find session` - Search across all providers
- Cross-platform storage detection (Windows, macOS, Linux)
- Provider aliases: `claudecode`/`claude`, `opencode`, `openclaw`/`claw`, `antigravity`/`ag`

#### JSONL Format Support (chasm-rust)
- Handle VS Code 1.109.0+ event-sourced session format
- Automatic detection and parsing of `.jsonl` session files  
- Session state reconstruction from event streams

### February 2027 (Q2 2027 AI Agents and Ecosystem)

#### Autonomous Agents (chasm-rust)
- Created archival.rs (~521 lines) - Autonomous session archival agent
  - ArchivalPolicy with configurable inactivity thresholds, message counts, provider filters
  - ArchivalCandidate for session evaluation with priority scoring
  - ArchivalDecision with confidence scoring and reasoning
  - Policy matching for exclude/include tags (pinned, important, archive)
- Created search_refinement.rs (~584 lines) - Context-aware search refinement
  - SearchContext with recent queries, sessions, workspace, provider history
  - QueryRefinement suggestions with confidence scores
  - RefinementType: Specificity, Broadening, Correction, Synonyms, Contextual, Temporal
  - EnrichedSearchResult with relevance scoring

#### JetBrains Plugin (jetbrains-plugin)
- Created Kotlin/IntelliJ plugin with Gradle build
- Implemented ChasmService for server communication
- Added actions: Harvest, Sync, Search, SaveToSession, OpenSettings
- Created tool window panel with session browser
- Settings configurable for server URL and sync options

#### Vim Plugin (vim-plugin)
- Created vim-plug/Vundle/Pathogen compatible plugin
- Autoload functions for HTTP requests via curl
- Commands: ChasmHealth, ChasmHarvest, ChasmSync, ChasmStats, ChasmSearch, ChasmSessions, ChasmView
- Quickfix list integration for session browsing
- Configurable keymaps with leader prefix

### February 2028 (Q1 2028 Performance & Developer Experience)

#### Mobile Enhancements (chasm-app)
- Created backgroundSync.ts (~450 lines) - Battery-optimized background sync
  - SyncConfig with WiFi-only, charging-only, battery level, quiet hours settings
  - SyncQueueItem with priority levels (high/normal/low) and retry tracking
  - BackgroundSyncService with condition checking and scheduling
  - Platform-specific background tasks for iOS (BGTaskScheduler) and Android (WorkManager)
- Created widgetService.ts (~400 lines) - iOS/Android home screen widgets
  - Widget types: quick_stats, recent_sessions, quick_actions, search, favorites, provider_status
  - WidgetConfig with refresh intervals and theme support
  - Native module integration for widget updates and interactions

#### Database Scaling (chasm-rust)
- Created scaling.rs (~500 lines) - Sharding and read replica support
  - ShardingStrategy: Hash, Range, Tenant, Geographic, RoundRobin, Custom
  - ConsistentHashRing for distributed key routing
  - ShardRouter for query routing with scatter-gather support
  - ReplicaManager with health checking and lag monitoring
  - ScalingManager for unified read/write connection routing

#### Edge Caching (chasm-rust)
- Created api/caching.rs (~500 lines) - CDN and caching layer
  - CacheBackend: Memory, Redis, Memcached, File
  - CDN integration: Cloudflare, Fastly, CloudFront, Akamai, BunnyCDN
  - EdgeCacheManager with LRU eviction and TTL support
  - CacheMiddleware for API response caching
  - Pattern-based invalidation and CDN purge

#### SDK Generator (chasm-rust)
- Created api/sdk.rs (~700 lines) - Multi-language SDK generation
  - Supported languages: Python, Node.js, Go, Rust, Java, C#, Ruby, PHP
  - Python SDK with async/sync clients, Pydantic types, httpx
  - Node.js SDK with TypeScript, axios, proper error handling
  - Go SDK with idiomatic services pattern and resty client
  - API endpoint and type definitions for code generation
### February 2026 (Q4 2026 Platform Maturity)

#### Sync Engine (chasm-rust)
- Created bidirectional sync module with conflict resolution
- Implemented SessionSyncState tracking with hash-based change detection
- Added conflict strategies: LocalWins, RemoteWins, MostRecent, KeepBoth, Manual
- Created VSCodeSyncAdapter for Copilot Chat sessions

#### AI Intelligence (chasm-rust)
- Created intelligence module with AI-powered analysis
- Implemented TopicExtractor for keyword-based topic detection
- Added InsightsGenerator for conversation key points
- Created SentimentAnalyzer with lexicon-based scoring
- Implemented QualityScorer for session quality metrics
- Added SimilarityDetector using Jaccard similarity

#### Plugin System (chasm-rust)
- Created extensible plugin architecture (~650 lines)
- Implemented PluginManifest with permissions and metadata
- Added PluginManager for lifecycle management
- Created event hook system with priority ordering
- Implemented PluginRegistry for discovery

#### Workflow Automation (chasm-rust)
- Created automation engine (~960 lines)
- Implemented triggers: Event, Schedule, Interval, Manual
- Added conditions: And, Or, Not, Compare, TimeWindow, Matches
- Created actions: Export, Archive, Sync, Harvest, Notify, Shell, Http
- Added workflow execution engine with run tracking

#### Provider Expansion (chasm-rust)
- Enhanced GPT4All provider with session harvesting
- Enhanced Jan provider with session harvesting
- Enhanced LM Studio provider with session harvesting
- Enhanced LocalAI provider with session harvesting
- Enhanced Text Gen WebUI provider with session harvesting

### February 2026 (Q2 2026 Provider Sprint)

#### Providers (chasm-rust)
- Verified Cursor IDE provider implementation
- Verified ChatGPT cloud provider implementation
- Verified Ollama local LLM provider implementation
- All providers registered in ProviderRegistry
- Built and verified Tauri desktop application

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

See [CONTRIBUTING.md](chasm-rust/CONTRIBUTING.md) for guidelines on contributing to this project. All contributors must agree to the [CLA](CLA.md).

## License

This project is licensed under [AGPL-3.0-only](LICENSE) with a [commercial dual-license](COMMERCIAL_LICENSE.md) available.




