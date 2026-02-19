# Chasm VS Code Extension

Universal AI chat session manager for VS Code — harvest, repair, merge, and search across VS Code, Cursor, Claude Code, and 30+ providers.

## Features

- **Health Check & Auto-Fix**: Run `chasm doctor` to scan all workspaces for session issues (multi-line JSONL, concatenated files, orphaned sessions, missing compat fields, stale indexes) and auto-repair them with one click
- **View All Workspaces**: Browse all VS Code workspaces that have chat sessions
- **Session Management**: View, export, import, and move chat sessions between workspaces
- **History Operations**: Fetch chat history from other workspaces, merge sessions into unified timelines
- **Session Repair**: Repair all sessions across workspaces — compact JSONL, rebuild indexes, inject compat fields
- **Recursive Repair**: Scan entire directory trees for workspaces and repair all discovered sessions
- **API Server**: Start/stop the Chasm API server directly from VS Code
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
- [Chasm CLI](https://github.com/nervosys/chasm) must be installed and accessible in PATH

## Installation

1. Install the Chasm CLI:

```bash
cargo install chasm-cli
```

2. Install this extension from the VS Code Marketplace or build from source:

```bash
cd vscode-extension
npm install
npm run compile
```

## Usage

### Activity Bar

The extension adds a **Chasm** view container in the activity bar with four views:

- **Chat**: Quick access to open the chat interface
- **Workspaces**: Lists all VS Code workspaces with chat sessions
- **Sessions**: Shows chat sessions for the selected workspace
- **Health**: Run health checks and fix session issues

### Commands

Access commands via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

#### Health & Repair

| Command                                   | Description                             | Keybinding     |
| ----------------------------------------- | --------------------------------------- | -------------- |
| `Chasm: Run Health Check`                 | Scan all workspaces for session issues  | `Ctrl+Shift+H` |
| `Chasm: Fix All Session Issues`           | Auto-fix all detected issues            |                |
| `Chasm: Preview Repairs (Dry Run)`        | Preview what would be repaired          |                |
| `Chasm: Repair All Sessions`              | Compact JSONL + rebuild indexes         |                |
| `Chasm: Repair Sessions (Recursive Scan)` | Recursively scan + repair all sessions  |                |
| `Chasm: Upgrade Session Format`           | Upgrade JSON → JSONL for VS Code 1.109+ |                |

#### Server & Sync

| Command                      | Description                               |
| ---------------------------- | ----------------------------------------- |
| `Chasm: Start API Server`    | Start the Chasm API server in a terminal  |
| `Chasm: Stop API Server`     | Stop the running API server               |
| `Chasm: Sync Pull (Backup)`  | Pull sessions into harvest database       |
| `Chasm: Sync Push (Restore)` | Push sessions from database to workspaces |

#### Sessions

| Command                       | Description                          | Keybinding     |
| ----------------------------- | ------------------------------------ | -------------- |
| `Chasm: Show All Workspaces`  | Open webview with all workspaces     |                |
| `Chasm: Show Sessions`        | View sessions for current workspace  |                |
| `Chasm: Show Chat History`    | Display chat history timeline        |                |
| `Chasm: Find Workspace`       | Search workspaces by pattern         |                |
| `Chasm: Quick Session Search` | Search by title, content, or ID      | `Ctrl+Shift+/` |
| `Chasm: Full-Text Search`     | Search harvest database              |                |
| `Chasm: Export Sessions`      | Export sessions to a directory       |                |
| `Chasm: Import Sessions`      | Import sessions from a directory     |                |
| `Chasm: Fetch History`        | Fetch sessions from other workspaces |                |
| `Chasm: Merge All Sessions`   | Merge sessions into single timeline  |                |
| `Chasm: Move Sessions`        | Move sessions between workspaces     |                |

#### Harvest & Recovery

| Command                                | Description                              | Keybinding     |
| -------------------------------------- | ---------------------------------------- | -------------- |
| `Chasm: Harvest Sessions`              | Harvest from all providers               | `Ctrl+Shift+\` |
| `Chasm: Scan for Providers`            | Detect available AI chat providers       |                |
| `Chasm: Recover Orphaned Sessions`     | Detect and recover orphaned sessions     |                |
| `Chasm: Scan for Recoverable Sessions` | Find recoverable sessions from backups   |                |
| `Chasm: List Orphaned Sessions`        | Show sessions missing from VS Code index |                |

#### Git & Migration

| Command                            | Description                        |
| ---------------------------------- | ---------------------------------- |
| `Chasm: Initialize Git Versioning` | Set up git tracking for sessions   |
| `Chasm: Stage & Commit Sessions`   | Git add/commit session changes     |
| `Chasm: Show Git Status`           | View git status of sessions        |
| `Chasm: Create Git Snapshot`       | Create tagged git snapshot         |
| `Chasm: Create Migration Package`  | Package all sessions for migration |
| `Chasm: Restore Migration Package` | Restore sessions from package      |

#### Other

| Command                   | Description                         | Keybinding     |
| ------------------------- | ----------------------------------- | -------------- |
| `Chasm: Open Chat`        | Open the Chasm chat interface       | `Ctrl+Shift+;` |
| `Chasm: Launch TUI`       | Open interactive terminal interface |                |
| `Chasm: Toggle Recording` | Enable/disable real-time recording  |                |
| `Chasm: Recording Status` | Show current recording status       |                |
| `Chasm: Show Version`     | Display Chasm CLI version           |                |

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
| `chasm.binaryPath`          | `"chasm"`                 | Path to chasm binary                |
| `chasm.showNotifications`   | `true`                    | Show operation notifications        |
| `chasm.api.baseUrl`         | `"http://localhost:3000"` | Chasm API server URL                |
| `chasm.api.autoStart`       | `false`                   | Auto-start API server on activation |
| `chasm.recording.enabled`   | `false`                   | Enable real-time recording          |
| `chasm.recording.providers` | `["vscode", "cursor"]`    | Providers to record from            |
| `chasm.doctor.runOnStartup` | `false`                   | Run health check on startup         |
| `chasm.statusBar.enabled`   | `true`                    | Show status bar indicator           |

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

1. Start the Chasm API server (from VS Code or terminal):

```bash
chasm api serve
```

Or use the `Chasm: Start API Server` command from the palette.

2. Enable recording in VS Code settings:

```json
{
  "chasm.recording.enabled": true,
  "chasm.recording.providers": ["vscode", "cursor", "continuedev"],
  "chasm.api.baseUrl": "http://localhost:3000"
}
```

3. Or toggle via Command Palette: `Chasm: Toggle Recording`

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

- [Chasm CLI on crates.io](https://crates.io/crates/chasm-cli)
- [Chasm Repository](https://github.com/nervosys/chasm)
- [Report Issues](https://github.com/nervosys/chasm/issues)
