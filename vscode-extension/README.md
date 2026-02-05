# Chasm VS Code Extension

A VS Code extension that provides a graphical interface for managing AI chat sessions across workspaces.

## Features

- **View All Workspaces**: Browse all VS Code workspaces that have chat sessions
- **Session Management**: View, export, import, and move chat sessions between workspaces
- **History Operations**: Fetch chat history from other workspaces, merge sessions into unified timelines
- **Git Versioning**: Initialize git tracking for chat sessions, create snapshots and commits
- **Migration Support**: Create and restore migration packages for moving to new machines
- **Interactive TUI**: Launch the terminal-based interface directly from VS Code
- **Quick Search**: Search sessions using Command Palette
- **Orphaned Recovery**: Detect and recover orphaned sessions from old workspace hashes
- **Session Preview**: View session content inline
- **Real-time Recording**: Automatically capture sessions as you work to prevent data loss from crashes

## Requirements

- VS Code 1.85.0 or later
- [chasm CLI](https://github.com/nervosys/chasm) must be installed and accessible in your PATH

## Installation

1. Install the CSM CLI:

```bash
# From source
cd csm-rust
cargo install --path .
```

1. Install this extension from the VS Code Marketplace or build from source:

```bash
cd vscode-extension
npm install
npm run compile
```

## Usage

### Tree Views

The extension adds a "Chat System Manager" view container in the activity bar with two views:

- **Workspaces**: Lists all VS Code workspaces with chat sessions
- **Sessions**: Shows chat sessions for the selected workspace

### Commands

Access commands via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command                          | Description                          |
| -------------------------------- | ------------------------------------ |
| `CSM: Show All Workspaces`       | Open webview with all workspaces     |
| `CSM: Show Sessions`             | View sessions for current workspace  |
| `CSM: Show Chat History`         | Display chat history timeline        |
| `CSM: Find Workspace`            | Search workspaces by pattern         |
| `CSM: Export Sessions`           | Export sessions to a directory       |
| `CSM: Import Sessions`           | Import sessions from a directory     |
| `CSM: Fetch History`             | Fetch sessions from other workspaces |
| `CSM: Merge All Sessions`        | Merge sessions into single timeline  |
| `CSM: Move Sessions`             | Move sessions between workspaces     |
| `CSM: Launch TUI`                | Open interactive terminal interface  |
| `CSM: Initialize Git Versioning` | Set up git tracking for sessions     |
| `CSM: Stage & Commit Sessions`   | Git add/commit session changes       |
| `CSM: Show Git Status`           | View git status of sessions          |
| `CSM: Create Git Snapshot`       | Create tagged git snapshot           |
| `CSM: Create Migration Package`  | Package all sessions for migration   |
| `CSM: Restore Migration Package` | Restore sessions from package        |
| `CSM: Show Version`              | Display CSM version                  |
| `CSM: Toggle Recording`          | Enable/disable real-time recording   |
| `CSM: Recording Status`          | Show current recording status        |

### Context Menus

Right-click on workspaces in the tree view for quick actions:

- Show Sessions
- Export Sessions
- Fetch History
- Move Sessions

## Extension Settings

| Setting                   | Default                   | Description                      |
| ------------------------- | ------------------------- | -------------------------------- |
| `csm.binaryPath`          | `"csm"`                   | Path to csm binary               |
| `csm.showNotifications`   | `true`                    | Show operation notifications     |
| `csm.api.baseUrl`         | `"http://localhost:3000"` | Chasm API server URL             |
| `csm.recording.enabled`   | `false`                   | Enable real-time recording       |
| `csm.recording.providers` | `["vscode", "cursor"]`    | Providers to record from         |

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

| Provider | Status | Storage Location |
|----------|--------|------------------|
| VS Code Copilot | ✅ | `~/.config/Code/User/workspaceStorage/*/chatSessions/` |
| Cursor | ✅ | `~/.config/Cursor/User/workspaceStorage/*/chatSessions/` |
| Continue.dev | ✅ | `~/.continue/sessions/` |
| Claude Code | ✅ | `~/.config/claude-code/sessions/` |
| OpenCode | ✅ | `~/.config/opencode/conversations/` |
| OpenClaw | ✅ | `~/.config/openclaw/chat-history/` |
| Antigravity | ✅ | `~/.config/antigravity/sessions/` |
| Windsurf | ✅ | `~/.config/Windsurf/User/workspaceStorage/*/chatSessions/` |
| Zed | ✅ | `~/.config/zed/conversations/` |
| Codespaces | ✅ | Same as VS Code |

### How It Works

1. **File Watcher**: Monitors session directories for all enabled providers
2. **Event Buffering**: Batches events to reduce API calls
3. **Heartbeat**: Maintains connection health with periodic pings
4. **Snapshots**: Periodically saves full session state for recovery

### Setup

1. Start the Chasm API server:

```bash
csm serve --port 3000
```

2. Enable recording in VS Code settings:

```json
{
  "csm.recording.enabled": true,
  "csm.recording.providers": ["vscode", "cursor", "continuedev"],
  "csm.api.baseUrl": "http://localhost:3000"
}
```

3. Or toggle via Command Palette: `CSM: Toggle Recording`

### Provider Configuration

By default, the extension records from VS Code and Cursor. To add more providers:

```json
{
  "csm.recording.providers": [
    "vscode",
    "cursor",
    "continuedev",
    "claude-code",
    "opencode",
    "windsurf"
  ]
}
```

### Recovery

If VS Code crashes while recording is enabled, your sessions are preserved on the Chasm server. Use the recovery endpoint to retrieve them:

```bash
curl http://localhost:3000/api/recording/recovery
```

## Testing

The extension includes a comprehensive test suite with 79 tests covering:

- **Unit Tests**: Parsing logic, HTML escaping, command construction
- **Provider Tests**: WorkspaceProvider and SessionProvider logic
- **Integration Tests**: Command registration, configuration, tree views
- **Mock Tests**: Error handling, tooltip generation, filtering

Run the full test suite:

```bash
npm test
```

Tests run in a real VS Code instance using `@vscode/test-electron`.

## License

MIT

## Links

- [Chasm CLI Repository](https://github.com/nervosys/chasm)
- [Report Issues](https://github.com/nervosys/chasm/issues)
