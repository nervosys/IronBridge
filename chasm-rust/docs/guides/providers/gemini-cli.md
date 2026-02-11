# Gemini CLI Setup

Google's Gemini CLI sessions are auto-detected from the Gemini data directory.

## Prerequisites

- [Gemini CLI](https://github.com/google-gemini/gemini-cli) installed
- Active Google API key

## Installation

```bash
# Install Gemini CLI
npm install -g @anthropic-ai/gemini-cli

# Set API key
export GOOGLE_API_KEY=AIza...

# Verify
gemini --version
```

## How It Works

Gemini CLI stores sessions as JSON files:

| Platform | Path |
|---|---|
| **Windows** | `%USERPROFILE%\.gemini\tmp\` |
| **macOS** | `~/.gemini/tmp/` |
| **Linux** | `~/.gemini/tmp/` |

## Usage

```bash
# List Gemini CLI sessions
chasm list sessions --provider geminicli

# Harvest
chasm harvest run --providers geminicli

# Watch for new sessions
chasm watch --agent gemini
```

## Tips

- Gemini CLI sessions are stored as standard JSON
- Use `chasm run gemini` to launch Gemini CLI with automatic session capture
- Sessions include function calls and code execution results
