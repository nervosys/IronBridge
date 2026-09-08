# IronBridge VS Code Extension

Universal AI chat session manager for VS Code — harvest, repair, merge, and search across VS Code, Cursor, Claude Code, and 30+ providers.

## Features

- **Health Check & Auto-Fix**: Run `ironbridge doctor` to scan all workspaces for session issues (multi-line JSONL, concatenated files, orphaned sessions, missing compat fields, stale indexes) and auto-repair them with one click
- **View All Workspaces**: Browse all VS Code workspaces that have chat sessions
- **Session Management**: View, export, import, and move chat sessions between workspaces
- **History Operations**: Fetch chat history from other workspaces, merge sessions into unified timelines
- **Session Repair**: Repair all sessions across workspaces — compact JSONL, rebuild indexes, inject compat fields
- **Recursive Repair**: Scan entire directory trees for workspaces and repair all discovered sessions
- **API Server**: Start/stop the IronBridge API server directly from VS Code
- **Sync**: Pull sessions into the harvest database (backup) or push them back (restore)
- **Format Upgrade**: Upgrade legacy JSON sessions to JSONL for VS Code 1.109+
- **Harvest**: Harvest chat sessions from all AI providers into a unified database
- **Full-Text Search**: Search across all harvested sessions and quick-search by title/content/ID
- **Git Versioning**: Initialize git tracking for chat sessions, create snapshots and commits
- **Migration Support**: Create and restore migration packages for moving to new machines
- **Interactive TUI**: Launch the terminal-based interface directly from VS Code
- **Orphan Recovery**: Detect and recover orphaned sessions from old workspace hashes
- **Session Preview**: View session content inline as markdown
- **Real-time Recording**: Capture sessions from 13+ providers as you work to prevent data loss
- **Status Bar**: Quick health status indicator with one-click access

## Requirements

- VS Code 1.85.0 or later
- [IronBridge CLI](https://github.com/nervosys/IronBridge) must be installed and accessible in PATH

## Installation

1. Install the IronBridge CLI:

```bash
cargo install ironbridge-cli
```

2. Install this extension from the VS Code Marketplace or build from source:

```bash
cd vscode-extension
npm install
npm run compile
```

## Usage

### Activity Bar

The extension adds a **IronBridge** view container in the activity bar with four views:

- **Chat**: Quick access to open the chat interface
- **Workspaces**: Lists all VS Code workspaces with chat sessions
- **Sessions**: Shows chat sessions for the selected workspace
- **Health**: Run health checks and fix session issues

### Commands

Access commands via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

#### Health & Repair

| Command                                   | Description                             | Keybinding     |
| ----------------------------------------- | --------------------------------------- | -------------- |
| `IronBridge: Run Health Check`                 | Scan all workspaces for session issues  | `Ctrl+Shift+H` |
| `IronBridge: Fix All Session Issues`           | Auto-fix all detected issues            |                |
| `IronBridge: Preview Repairs (Dry Run)`        | Preview what would be repaired          |                |
| `IronBridge: Repair All Sessions`              | Compact JSONL + rebuild indexes         |                |
| `IronBridge: Repair Sessions (Recursive Scan)` | Recursively scan + repair all sessions  |                |
| `IronBridge: Upgrade Session Format`           | Upgrade JSON → JSONL for VS Code 1.109+ |                |

#### Server & Sync

| Command                      | Description                               |
| ---------------------------- | ----------------------------------------- |
| `IronBridge: Start API Server`    | Start the IronBridge API server in a terminal  |
| `IronBridge: Stop API Server`     | Stop the running API server               |
| `IronBridge: Sync Pull (Backup)`  | Pull sessions into harvest database       |
| `IronBridge: Sync Push (Restore)` | Push sessions from database to workspaces |

#### Sessions

| Command                       | Description                          | Keybinding     |
| ----------------------------- | ------------------------------------ | -------------- |
| `IronBridge: Show All Workspaces`  | Open webview with all workspaces     |                |
| `IronBridge: Show Sessions`        | View sessions for current workspace  |                |
| `IronBridge: Show Chat History`    | Display chat history timeline        |                |
| `IronBridge: Find Workspace`       | Search workspaces by pattern         |                |
| `IronBridge: Quick Session Search` | Search by title, content, or ID      | `Ctrl+Shift+/` |
| `IronBridge: Full-Text Search`     | Search harvest database              |                |
| `IronBridge: Export Sessions`      | Export sessions to a directory       |                |
| `IronBridge: Import Sessions`      | Import sessions from a directory     |                |
| `IronBridge: Fetch History`        | Fetch sessions from other workspaces |                |
| `IronBridge: Merge All Sessions`   | Merge sessions into single timeline  |                |
| `IronBridge: Move Sessions`        | Move sessions between workspaces     |                |

#### Harvest & Recovery

| Command                                | Description                              | Keybinding     |
| -------------------------------------- | ---------------------------------------- | -------------- |
| `IronBridge: Harvest Sessions`              | Harvest from all providers               | `Ctrl+Shift+\` |
| `IronBridge: Scan for Providers`            | Detect available AI chat providers       |                |
| `IronBridge: Recover Orphaned Sessions`     | Detect and recover orphaned sessions     |                |
| `IronBridge: Scan for Recoverable Sessions` | Find recoverable sessions from backups   |                |
| `IronBridge: List Orphaned Sessions`        | Show sessions missing from VS Code index |                |

#### Git & Migration

| Command                            | Description                        |
| ---------------------------------- | ---------------------------------- |
| `IronBridge: Initialize Git Versioning` | Set up git tracking for sessions   |
| `IronBridge: Stage & Commit Sessions`   | Git add/commit session changes     |
| `IronBridge: Show Git Status`           | View git status of sessions        |
| `IronBridge: Create Git Snapshot`       | Create tagged git snapshot         |
| `IronBridge: Create Migration Package`  | Package all sessions for migration |
| `IronBridge: Restore Migration Package` | Restore sessions from package      |

#### Other

| Command                   | Description                         | Keybinding     |
| ------------------------- | ----------------------------------- | -------------- |
| `IronBridge: Open Chat`        | Open the IronBridge chat interface       | `Ctrl+Shift+;` |
| `IronBridge: Launch TUI`       | Open interactive terminal interface |                |
| `IronBridge: Toggle Recording` | Enable/disable real-time recording  |                |
| `IronBridge: Recording Status` | Show current recording status       |                |
| `IronBridge: Show Version`     | Display IronBridge CLI version           |                |

### Context Menus

Right-click on workspaces in the tree view for quick actions:

- Show Sessions
- Export Sessions
- Fetch History
- Merge Sessions
- Move Sessions

## Extension Settings

| Setting                     | Default                   | Description                         |
| --------------------------- | ------------------------- | ----------------------------------- |
| `ironbridge.binaryPath`          | `"ironbridge"`                 | Path to ironbridge binary                |
| `ironbridge.showNotifications`   | `true`                    | Show operation notifications        |
| `ironbridge.api.baseUrl`         | `"http://localhost:3000"` | IronBridge API server URL                |
| `ironbridge.api.autoStart`       | `false`                   | Auto-start API server on activation |
| `ironbridge.recording.enabled`   | `false`                   | Enable real-time recording          |
| `ironbridge.recording.providers` | `["vscode", "cursor"]`    | Providers to record from            |
| `ironbridge.doctor.runOnStartup` | `false`                   | Run health check on startup         |
| `ironbridge.statusBar.enabled`   | `true`                    | Show status bar indicator           |

## Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch

# Lint
npm run lint

# Run tests
npm test
```

## Real-time Recording

The extension can capture chat sessions in real-time from multiple AI chat providers, preventing data loss from crashes or unexpected closures.

### Supported Providers

| Provider        | Status | Storage Location                                 |
| --------------- | ------ | ------------------------------------------------ |
| VS Code Copilot | ✅      | `workspaceStorage/*/chatSessions/`               |
| Cursor          | ✅      | `Cursor/User/workspaceStorage/*/chatSessions/`   |
| Continue.dev    | ✅      | `~/.continue/sessions/`                          |
| Claude Code     | ✅      | `~/.config/claude-code/sessions/`                |
| OpenCode        | ✅      | `~/.config/opencode/conversations/`              |
| OpenClaw        | ✅      | `~/.config/openclaw/chat-history/`               |
| Antigravity     | ✅      | `~/.config/antigravity/sessions/`                |
| Windsurf        | ✅      | `Windsurf/User/workspaceStorage/*/chatSessions/` |
| Zed             | ✅      | `~/.config/zed/conversations/`                   |
| Codespaces      | ✅      | Same as VS Code                                  |
| Codex CLI       | ✅      | `~/.codex/sessions/`                             |
| Droid CLI       | ✅      | `~/.droid/sessions/`                             |
| Gemini CLI      | ✅      | `~/.gemini/sessions/`                            |

### Setup

1. Start the IronBridge API server (from VS Code or terminal):

```bash
ironbridge api serve
```

Or use the `IronBridge: Start API Server` command from the palette.

2. Enable recording in VS Code settings:

```json
{
  "ironbridge.recording.enabled": true,
  "ironbridge.recording.providers": ["vscode", "cursor", "continuedev"],
  "ironbridge.api.baseUrl": "http://localhost:3000"
}
```

3. Or toggle via Command Palette: `IronBridge: Toggle Recording`

## Testing

The extension includes a comprehensive test suite covering:

- **Unit Tests**: Parsing logic, HTML escaping, command construction
- **Provider Tests**: WorkspaceProvider and SessionProvider logic
- **Integration Tests**: Command registration, configuration, tree views
- **Mock Tests**: Error handling, tooltip generation, filtering

Run the full test suite:

```bash
npm test
```

## License

AGPL-3.0-only

## Links

- [IronBridge CLI on crates.io](https://crates.io/crates/ironbridge-cli)
- [IronBridge Repository](https://github.com/nervosys/IronBridge)
- [Report Issues](https://github.com/nervosys/IronBridge/issues)
