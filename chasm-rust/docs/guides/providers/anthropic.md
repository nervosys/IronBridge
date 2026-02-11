# Anthropic / Claude API Setup

Connect to Anthropic's API for Claude Sonnet, Opus, and Haiku models.

## Prerequisites

- [Anthropic API key](https://console.anthropic.com/settings/keys)

## Configuration

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

## Usage with Chasm

```bash
# Interactive chat with Claude Sonnet
chasm run claude --model claude-sonnet-4-20250514

# Claude Haiku for fast responses
chasm run claude --model claude-3-5-haiku-20241022
```

## Available Models

| Model | Context | Best For |
|---|---|---|
| `claude-sonnet-4-20250514` | 200K | Balanced quality and speed |
| `claude-3-5-haiku-20241022` | 200K | Fast, cost-effective |
| `claude-3-opus-20240229` | 200K | Highest capability |

## Browser Extension

Chasm's browser extension captures sessions from [claude.ai](https://claude.ai):

1. Install the Chasm browser extension
2. Navigate to claude.ai
3. Click the Chasm icon to export conversations

## Tips

- Claude supports very long context (200K tokens) — ideal for large codebases
- For terminal-based Claude Code, see the [Claude Code guide](claude-code.md)
- Tool use results (file edits, search) are captured in session history
