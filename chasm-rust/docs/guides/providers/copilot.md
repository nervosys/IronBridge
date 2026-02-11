# GitHub Copilot Setup

GitHub Copilot Chat sessions are auto-detected from VS Code workspace storage.

## Prerequisites

- VS Code with [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) extension
- Active Copilot subscription

## How It Works

Chasm reads Copilot Chat sessions from VS Code's `workspaceStorage` directory:

| Platform | Path |
|---|---|
| **Windows** | `%APPDATA%\Code\User\workspaceStorage\` |
| **macOS** | `~/Library/Application Support/Code/User/workspaceStorage/` |
| **Linux** | `~/.config/Code/User/workspaceStorage/` |

Each workspace folder contains session files in JSON or JSONL format (VS Code 1.109.0+).

## Usage

```bash
# List all Copilot sessions
chasm list sessions --provider vscode

# Search Copilot sessions
chasm find session "auth" --provider vscode

# Show timeline
chasm show timeline --provider vscode

# Harvest into database
chasm harvest run --providers copilot
```

## Session Formats

### Legacy JSON (VS Code < 1.109.0)

```
workspaceStorage/<hash>/state.vscdb
```

Sessions stored in SQLite database as JSON blobs.

### Event-Sourced JSONL (VS Code 1.109.0+)

```
workspaceStorage/<hash>/chat/sessions/*.jsonl
```

Each line is an event: `SessionStart`, `MessageAdd`, `MessageAppend`, etc. Chasm reconstructs the full session state from the event stream.

## Tips

- Use `chasm detect orphaned /path/to/project` to find sessions from old workspace hashes
- Use `chasm register all --path /path/to/project` to make orphaned sessions visible in VS Code
- Use `chasm watch --agent vscode` to auto-harvest on session changes
