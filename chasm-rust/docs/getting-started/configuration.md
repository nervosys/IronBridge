# Configuration

Chasm works out of the box with zero configuration for basic session recovery and harvesting. This page covers optional configuration for providers, API keys, and the API server.

## Environment Variables

### Cloud Provider API Keys

```bash
# Anthropic / Claude
export ANTHROPIC_API_KEY=sk-ant-...

# OpenAI / ChatGPT
export OPENAI_API_KEY=sk-...

# Google / Gemini
export GOOGLE_API_KEY=AIza...

# Perplexity
export PERPLEXITY_API_KEY=pplx-...
```

### Local Provider Endpoints

```bash
# Ollama (default: http://localhost:11434)
export OLLAMA_HOST=http://localhost:11434

# LM Studio (default: http://localhost:1234)
export LM_STUDIO_URL=http://localhost:1234

# GPT4All (default: http://localhost:4891)
export GPT4ALL_URL=http://localhost:4891

# LocalAI (default: http://localhost:8080)
export LOCALAI_URL=http://localhost:8080
```

## CLI Global Options

| Option | Description |
|---|---|
| `--verbose`, `-v` | Enable verbose output |
| `--quiet`, `-q` | Suppress non-essential output |
| `--help`, `-h` | Show help |
| `--version`, `-V` | Show version |

## Database Location

Chasm stores data in a platform-specific directory:

| Platform | Path |
|---|---|
| Windows | `%LOCALAPPDATA%\csm\csm.db` |
| macOS | `~/Library/Application Support/csm/csm.db` |
| Linux | `~/.local/share/csm/csm.db` |

## API Server Configuration

```bash
# Start with custom host and port
chasm api serve --host 0.0.0.0 --port 8787
```

| Option | Default | Description |
|---|---|---|
| `--host` | `127.0.0.1` | Bind address |
| `--port` | `8787` | Port number |

## Provider Filtering

Harvest from specific providers only:

```bash
# Only harvest from GitHub Copilot and Cursor
chasm harvest run --providers copilot,cursor

# Only harvest from local providers
chasm harvest run --providers ollama,lmstudio
```

## Telemetry

Telemetry is **opt-in** and anonymous. No session content is ever transmitted.

```bash
chasm telemetry status   # Check current status
chasm telemetry enable   # Enable
chasm telemetry disable  # Disable
```
