# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Cursor session export** — `export_session` writes into Cursor's own
  `chatSessions` store in the format `import_session` reads back. The target
  workspace is the one already holding that session id, or the only workspace
  if there is exactly one; an ambiguous target is an error rather than a guess.
- **Llamafile discovery** — registered alongside the other OpenAI-compatible
  endpoints, honouring `LLAMAFILE_ENDPOINT`.
- **`tests/module_reachability.rs`** — fails if any `.rs` file in any of the
  three crates (`chasm-rust`, `chasm-sso`, `chasm-desktop`) is not reachable
  from a crate root. A file no `mod` declaration names is never
  read by rustc, so it drifts out of sync while `build`, `clippy` and `test`
  all stay green. This has now happened three times (`api/handlers.rs`, the
  seven provider files, and `src/enterprise/`); each was found by hand, months
  late. Verified by planting an orphan and watching the test fail.

### Known

- **`src/enterprise/` is not compiled** — 2,044 lines of multi-tenancy,
  white-labelling and compliance code, never declared in `lib.rs`. Unlike the
  deleted provider files it compiles cleanly, so this is functioning work that
  was simply never wired up; whether to connect it or drop it is a product
  decision. Recorded in `KNOWN_ORPHANS` and flagged in the README, which
  documented all three as features.

### Removed

- **Seven dead provider files** (`gpt4all`, `jan`, `llamafile`, `lmstudio`,
  `localai`, `textgen_webui`, `vllm`, 2,728 lines). None was declared in
  `providers/mod.rs`, so none had ever been compiled; adding the declarations
  produces 137 errors, because they were written against an older `ChatSession`
  model and call a dependency (`ureq`) the crate does not have. Every one of
  these providers speaks the OpenAI API and is already served by the compiled
  `openai_compat` provider, which the registry does use — so this removes
  duplicates, not capability. The 1.5.0 entry below listing them as supported
  was describing files, not behaviour.

### Fixed

- **Export stubs that promised a roadmap** — `export_session` for Ollama and
  the OpenAI-compatible providers said "not yet implemented". Both are
  stateless inference endpoints with nowhere to put a conversation, so the
  answer is not "later", it is "no". They now say why, and point at file export.

## [1.5.4] - 2026-02-25

### Added

- **Model cache rebuild** (`agentSessions.model.cache`) — Sessions now appear in the Chat panel sidebar after repair; previously recovered sessions were invisible because this cache was never populated
- **State cache cleanup** (`agentSessions.state.cache`) — Removes stale entries referencing deleted sessions that could confuse VS Code's UI state
- **Memento fix** (`memento/interactive-session-view-copilot`) — Repairs the last-active-session pointer when it references a non-existent session
- **`.json.bak` recovery** — When a `.jsonl` has fewer requests than a co-located `.json.bak` (truncated migration), automatically restores the full session from the backup
- **Old inputState migration** — Converts pre-v3 top-level `attachments`/`mode`/`inputText`/`selections`/`contrib` fields into the nested `inputState` object VS Code expects
- **`fix_request_model_states()`** — Fixes pending (0) and cancelled (2) modelState values in recovered sessions, adding `completedAt` timestamps
- **`session_resource_uri()` / `session_id_from_resource_uri()`** — Helpers for building and parsing `vscode-chat-session://local/{base64}` URIs
- **`repair_workspace_db_caches()`** — Reusable helper that runs all DB cache repairs (model cache, state cache, memento, .json.bak recovery) for `--all` and `--recursive` repair paths
- New repair passes in `register repair`: Pass 0.5 (.json.bak recovery), Pass 4 (model cache), Pass 5 (state cache), Pass 6 (memento)

### Changed

- `ensure_vscode_compat_fields()` now calls `migrate_old_input_state()` before the inputState existence check
- `repair_workspace_sessions()` now runs `.json.bak` recovery as its first step (Pass 0.5)
- `register repair --all` and `register repair --recursive` now run full DB cache repairs for each workspace

## [1.5.3] - 2026-02-21

### Added

- **`chasm shard` command** — Split oversized sessions into linked shard files
  - `chasm shard session <file>` — Shard a single session file
  - `chasm shard workspace` — Shard all oversized sessions in a workspace
  - `chasm shard info <file>` — Show linked-list shard metadata
  - `--max-requests N` — Split by request count (default: 50)
  - `--max-size <size>` — Split by file size (e.g. `10MB`, `500KB`)
  - `--dry-run` — Preview sharding without writing files
  - `--update-index` — Update VS Code's session index after sharding
  - `--no-backup` — Skip creating `.oversized` backup of original
  - Deterministic shard UUIDs (md5 of `sessionId-shard-N`)
  - Linked-list `_shardInfo` metadata with `prevShardId`/`nextShardId` pointers for agent traversal
  - Supports both legacy `.json` and modern `.jsonl` input formats

## [1.5.2] - 2026-02-21

### Added

- **`.backup` file support** - Recognize `.backup` as a valid session file extension alongside `.json` and `.jsonl`
- **Session deduplication** - `get_chat_sessions_from_workspace()` deduplicates sessions by ID, keeping the version with more requests (handles VS Code migrations that leave empty `.jsonl` files alongside `.backup` files with real data)

## [1.3.3] - 2026-02-19

### Added

- **`ensure_vscode_compat_fields()`** - Shared function that injects missing fields required by VS Code's latest session format (version 3): `hasPendingEdits`, `pendingRequests`, `inputState`, `sessionId`, `responderUsername`
- **Concatenated JSONL detection in `recover repair`** - Now detects and fixes `}{"kind":` concatenation alongside corrupt JSON and missing fields
- **Field injection in `repair_workspace_sessions()`** - Single-line JSONL files with missing VS Code fields are automatically patched during `register repair`

### Changed

- `convert_to_jsonl()` now includes all VS Code-required fields (`hasPendingEdits`, `pendingRequests`, `inputState`) in the `kind:0` snapshot
- `compact_session_jsonl()` now calls `ensure_vscode_compat_fields()` after replaying operations
- `repair_file()` now splits concatenated JSONL, repairs corrupt JSON, and injects missing VS Code fields in a single pass
- `recover_repair` scan reports specific failure reasons (corrupt JSON, concatenated lines, missing VS Code fields)
- `split_concatenated_jsonl()` made public for reuse across recovery and repair paths

### Fixed

- Sessions converted from legacy `.json` to `.jsonl` now load correctly in VS Code 1.109.0+ without manual patching
- Compacted sessions no longer silently drop required VS Code metadata fields

## [1.3.2] - 2026-02-04

### Added

- **Real-time Session Recording API** - Prevent data loss from editor crashes
- **Multi-Provider Recording Support** - VS Code extension records from 10+ providers
  - `POST /api/recording/events` - Send recording events (SessionStart, MessageAdd, MessageAppend, Heartbeat)
  - `POST /api/recording/snapshot` - Store full session snapshot for recovery
  - `GET /api/recording/sessions` - List active recording sessions
  - `GET /api/recording/sessions/:id` - Get recorded session by ID
  - `GET /api/recording/recovery` - Recover sessions after crash
  - `GET /api/recording/status` - Recording service status
  - Event buffering with concurrent session tracking via `RecordingState`

## [1.3.1] - 2026-02-04

### Changed

- Bumped version for Recording API release prep
- Updated CHANGELOG formatting

## [1.3.0] - 2026-02-04

### Added

- **Continue.dev Provider Support** - Session harvesting for Continue.dev IDE extension
- Published to crates.io

## [1.2.0] - 2026-02-01

### Added

- **TUI Abyss Dark Theme** - Deep purple/green color palette matching the project brand
- **TUI Functional Expansion** - Full CLI parity in the TUI browser
  - Session search with real-time filtering
  - Sort sessions by date, title, size, or message count
  - Multi-format export (JSON, Markdown, plain text) with `e` key
  - Delete sessions with confirmation prompt via `d` key
  - Yank/copy session content to clipboard with `y` key
  - Breadcrumb navigation bar
  - Status bar with keybinding hints
- **CLI Name Standardization** - Binary renamed from `csm` to `chasm`
- **CLI Polish** - Shell completions, `chasm doctor`, provider guides
- **Sync Command** - Bidirectional session backup and restore (`chasm sync`)
- **Watch Command** - File-system monitoring for session changes (`chasm watch`)
- **Agent Launcher** - `chasm run agent` with auto-save capability
- **New Providers** - Codex CLI, Droid CLI, Gemini CLI support
- **Agent Skills & SpecStory Comparison** integration
- **OpenAPI Auto-Generated API Docs** with Swagger UI

### Changed

- Moved `chasm run list-agents` → `chasm list agents`
- Updated CLI output colors to match demo.svg palette
- Sanitized private data in repository
- Updated dependencies and fixed lint errors

### Fixed

- **Release Readiness** - Added `[lib]` section to Cargo.toml (lib target: `chasm`)
- **Feature Declaration** - Added `[features]` section with `enterprise` feature
- **Integration Tests** - Fixed `use chasm::...` imports (previously broken by missing lib target)
- **MCP Binary Import** - Updated `csm-mcp` to use `chasm` lib target
- **Version Test** - Updated `test_version_flag` to expect `chasm` instead of `csm`
- **Unused Imports** - Removed `SinkExt` from recording.rs and websocket.rs
- **Copyright Year** - Fixed lib.rs copyright to 2024-2026

## [1.1.0] - 2026-02-04

### Added

- **Multi-Provider Support for Forensic Tools** - Extend session forensics across all providers
  - Supported providers: VS Code (Copilot), Cursor, ClaudeCode, OpenCode, OpenClaw, Antigravity
  - `chasm list sessions --provider <name>` - Filter sessions by provider
  - `chasm list sessions --all-providers` - List sessions from all providers
  - `chasm list agents --provider <name>` - Filter agent sessions by provider
  - `chasm list agents -p all` - List agent sessions from all providers  
  - `chasm show timeline --provider <name>` - Show timeline for specific provider
  - `chasm show timeline --all-providers` - Aggregate timeline across all providers
  - `chasm find session --provider <name>` - Search within specific provider
  - `chasm find session --all-providers` - Search across all providers
  - Provider column added to output tables when multiple providers are shown
  - Provider aliases: `vscode`/`copilot`, `cursor`, `claudecode`/`claude`, `opencode`, `openclaw`/`claw`, `antigravity`/`ag`

- **JSONL Format Support** - Handle VS Code 1.109.0+ event-sourced session format
  - Automatic detection and parsing of `.jsonl` session files
  - Reconstruction of session state from event stream
  - Backward compatible with legacy JSON format

- **Agent Mode Session Tools**
  - `chasm list agents [--size]` - List Copilot Edits / chatEditingSessions
  - `chasm show agent <id>` - Show agent session details
  
- **Timeline Visualization**
  - `chasm show timeline [--agents]` - Visualize session activity with gap detection
  - Shows recent activity bars and identifies periods of inactivity
  - Helps identify missing or lost sessions

- **Session Search Enhancements**
  - `chasm find session --date YYYY-MM-DD` - Filter by internal message timestamp
  - `chasm find session --all` - Search across all workspaces
  - `chasm list sessions --size` - Show file size column

## [1.0.1] - 2026-01-17

### Added

- **Orphaned Session Detection** - Find and recover sessions from orphaned workspace hashes
  - `chasm detect orphaned [PATH]` - Scan for all workspace hashes matching a project path
  - Shows active vs orphaned workspaces with session counts and details
  - `--recover` flag automatically copies orphaned sessions to the active workspace
  - Helps recover valuable chat history when VS Code creates new workspace hashes

## [0.2.1] - 2025-01-10

### Added

- **MCP Server - CSM Database Integration** - Access csm-web database sessions
  - 5 new `csm_db_*` tools for csm-web database access:
    - `csm_db_list_workspaces` - List workspaces from CSM database
    - `csm_db_list_sessions` - List sessions with provider/workspace filters
    - `csm_db_get_session` - Get session with all messages
    - `csm_db_search` - Search sessions by title
    - `csm_db_stats` - Database statistics by provider
  - 3 new `csm://db/*` resources:
    - `csm://db/workspaces` - Workspaces resource
    - `csm://db/sessions` - Sessions resource  
    - `csm://db/stats` - Statistics resource
    - `csm://db/session/{id}` - Individual session resource

### Changed

- MCP server now supports both VS Code workspace storage AND csm-web database

## [0.2.0] - 2025-12-09

### Added

- **VS Code ALL SESSIONS Support** - Access workspace-independent sessions
  - `csm list workspaces` now shows "Empty window sessions (ALL SESSIONS)" count
  - `csm list sessions` includes ALL SESSIONS with "(ALL SESSIONS)" as project path
  - Sessions from VS Code's empty window are now discoverable and manageable

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

## [0.1.0] - 2025-11-15

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
