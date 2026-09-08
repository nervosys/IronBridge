# Change Log

All notable changes to the IronBridge VS Code extension will be documented in this file.

## [1.0.0] - 2025-07-22

### Changed

- **Full rename**: IRONBRIDGE → IronBridge across all identifiers, commands, settings, views, and display strings
- All command prefixes: `ironbridge.*` → `ironbridge.*`
- All configuration keys: `ironbridge.*` → `ironbridge.*`
- All view IDs: `ironbridge.*` → `ironbridge.*`
- Extension name: `chat-session-manager` → `ironbridge`
- Display name: `Chat System Manager` → `IronBridge`
- Version bumped to 1.0.0

### Added

- **Health Check & Auto-Fix** (`ironbridge doctor`):
  - `IronBridge: Run Health Check` — scans all workspaces for session issues
  - `IronBridge: Fix All Session Issues` — auto-repairs detected issues
  - `IronBridge: Preview Repairs (Dry Run)` — preview what would be fixed
- **Session Repair**:
  - `IronBridge: Repair All Sessions` — compact JSONL, rebuild indexes, inject compat fields
  - `IronBridge: Repair Sessions (Recursive Scan)` — scan directory trees and repair all found sessions
- **API Server Management**:
  - `IronBridge: Start API Server` — launch the REST API in a managed VS Code terminal
  - `IronBridge: Stop API Server` — stop the running server terminal
- **Sync Operations**:
  - `IronBridge: Sync Pull (Backup)` — pull sessions into the harvest database
  - `IronBridge: Sync Push (Restore)` — push sessions back to workspaces
- **Recovery**:
  - `IronBridge: Scan for Recoverable Sessions` — find recoverable session files
  - `IronBridge: Recover Orphaned Sessions` — detect and recover orphaned sessions
- **Format Upgrade**:
  - `IronBridge: Upgrade Session Format` — upgrade legacy JSON to JSONL for VS Code 1.109+
- **Harvest Search**:
  - `IronBridge: Full-Text Search` — search across all harvested sessions
- **Status Bar**: Health indicator shows issue count, click to run health check
- **Health view**: New sidebar view in the IronBridge activity bar
- **New IronBridgeExecutor**: Complete CLI wrapper with methods for all ironbridge subcommands
- **New keybindings**:
  - `Ctrl+Shift+H` — Run health check
  - `Ctrl+Shift+/` — Quick session search
  - `Ctrl+Shift+\` — Harvest sessions
  - `Ctrl+Shift+R` — Refresh views
- **New settings**:
  - `ironbridge.api.autoStart` — auto-start API server on activation
  - `ironbridge.doctor.runOnStartup` — run health check on startup
  - `ironbridge.statusBar.enabled` — show/hide status bar indicator
- **New providers**: codex-cli, droid-cli, gemini-cli added to recording config
- Categories: Machine Learning, Data Science added for marketplace discoverability

## [0.1.0] - 2024-12-06

### Added

- Initial release
- Tree view for workspaces with Copilot Chat sessions
- Tree view for sessions within selected workspace
- Webview panels for workspaces, sessions, and chat history
- Commands for session management:
  - Show All Workspaces
  - Show Sessions
  - Show Chat History
  - Find Workspace
  - Export Sessions
  - Import Sessions
  - Fetch History from Other Workspaces
  - Merge All Sessions
  - Move Sessions Between Workspaces
- Git versioning support:
  - Initialize Git Versioning
  - Stage & Commit Sessions
  - Show Git Status
  - Create Git Snapshot
- Migration support:
  - Create Migration Package
  - Restore Migration Package
- Launch TUI command for interactive terminal interface
- Configurable binary path setting
- Context menus for workspace items
