# Continue.dev Setup

Continue.dev sessions are auto-detected from the VS Code extension's workspace storage.

## Prerequisites

- VS Code with [Continue.dev](https://continue.dev/) extension installed
- Configured LLM provider in Continue.dev settings

## How It Works

Continue.dev stores session history through VS Code's extension host. IronBridge reads these from:

| Platform | Path |
|---|---|
| **Windows** | `%APPDATA%\Code\User\globalStorage\continue.continue\` |
| **macOS** | `~/Library/Application Support/Code/User/globalStorage/continue.continue/` |
| **Linux** | `~/.config/Code/User/globalStorage/continue.continue/` |

## Usage

```bash
# List Continue.dev sessions
ironbridge list sessions --provider continuedev

# Harvest
ironbridge harvest run --providers continuedev
```

## Tips

- Continue.dev supports multiple LLM backends — IronBridge captures sessions regardless of which model you use
- Tab completions and inline edits are tracked separately from chat sessions
