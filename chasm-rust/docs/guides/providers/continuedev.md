# Continue.dev Setup

Continue.dev sessions are auto-detected from the VS Code extension's workspace storage.

## Prerequisites

- VS Code with [Continue.dev](https://continue.dev/) extension installed
- Configured LLM provider in Continue.dev settings

## How It Works

Continue.dev stores session history through VS Code's extension host. Chasm reads these from:

| Platform | Path |
|---|---|
| **Windows** | `%APPDATA%\Code\User\globalStorage\continue.continue\` |
| **macOS** | `~/Library/Application Support/Code/User/globalStorage/continue.continue/` |
| **Linux** | `~/.config/Code/User/globalStorage/continue.continue/` |

## Usage

```bash
# List Continue.dev sessions
chasm list sessions --provider continuedev

# Harvest
chasm harvest run --providers continuedev
```

## Tips

- Continue.dev supports multiple LLM backends — Chasm captures sessions regardless of which model you use
- Tab completions and inline edits are tracked separately from chat sessions
