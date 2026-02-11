# Cursor IDE Setup

Cursor sessions are auto-detected from Cursor's workspace storage.

## Prerequisites

- [Cursor](https://cursor.sh/) IDE installed
- Active Cursor subscription (for AI features)

## How It Works

Chasm reads Cursor chat sessions from workspace storage:

| Platform | Path |
|---|---|
| **Windows** | `%APPDATA%\Cursor\User\workspaceStorage\` |
| **macOS** | `~/Library/Application Support/Cursor/User/workspaceStorage/` |
| **Linux** | `~/.config/Cursor/User/workspaceStorage/` |

## Usage

```bash
# List Cursor sessions
chasm list sessions --provider cursor

# Search across Cursor and VS Code
chasm find session "refactor" --all-providers

# Harvest Cursor sessions
chasm harvest run --providers cursor
```

## Tips

- Cursor uses the same workspace storage format as VS Code
- Sessions from Cursor Composer and Chat are both captured
- Use `--all-providers` to search across both VS Code and Cursor simultaneously
