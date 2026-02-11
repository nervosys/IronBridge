# Codex CLI Setup

OpenAI's Codex CLI sessions are auto-detected from the Codex data directory.

## Prerequisites

- [Codex CLI](https://github.com/openai/codex) installed
- Active OpenAI API key

## Installation

```bash
# Install Codex CLI
npm install -g @openai/codex

# Set API key
export OPENAI_API_KEY=sk-...

# Verify
codex --version
```

## How It Works

Codex CLI stores sessions as JSONL files:

| Platform    | Path                             |
| ----------- | -------------------------------- |
| **Windows** | `%USERPROFILE%\.codex\sessions\` |
| **macOS**   | `~/.codex/sessions/`             |
| **Linux**   | `~/.codex/sessions/`             |

## Usage

```bash
# List Codex CLI sessions
chasm list sessions --provider codexcli

# Harvest
chasm harvest run --providers codexcli

# Watch for new sessions
chasm watch --agent codex
```

## Tips

- Codex CLI sessions include tool invocations (file edits, terminal commands)
- Sessions are stored in JSONL event-sourced format
- Use `chasm run codex` to launch Codex with automatic session capture
