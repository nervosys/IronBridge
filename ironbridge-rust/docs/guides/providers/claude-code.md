# Claude Code Setup

Claude Code (terminal-based) sessions are auto-detected from the Claude CLI data directory.

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI installed
- Active Anthropic API key or Claude subscription

## Installation

```bash
# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version
```

## How It Works

IronBridge detects Claude Code sessions from:

| Platform | Path |
|---|---|
| **Windows** | `%USERPROFILE%\.claude\` |
| **macOS** | `~/.claude/` |
| **Linux** | `~/.claude/` |

## Usage

```bash
# List Claude Code sessions
ironbridge list sessions --provider claudecode

# Use alias
ironbridge list sessions --provider claude

# Harvest Claude Code sessions
ironbridge harvest run --providers claudecode

# Watch for new sessions
ironbridge watch --agent claude
```

## Provider Aliases

- `claudecode` (full name)
- `claude` (shorthand)

## Tips

- Claude Code stores sessions as JSONL event streams
- Use `ironbridge show timeline --provider claude` to see your Claude Code activity
- Sessions include tool invocations (file edits, terminal commands) for full context
