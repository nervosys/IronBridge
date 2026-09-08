# Configuration

IronBridge works out of the box with zero configuration for basic session recovery and harvesting. This page covers optional configuration for providers, API keys, and the API server.

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

IronBridge stores data in a platform-specific directory:

| Platform | Path |
|---|---|
| Windows | `%LOCALAPPDATA%\ironbridge\ironbridge.db` |
| macOS | `~/Library/Application Support/ironbridge/ironbridge.db` |
| Linux | `~/.local/share/ironbridge/ironbridge.db` |

## API Server Configuration

```bash
# Start with custom host and port
ironbridge api serve --host 0.0.0.0 --port 8787
```

| Option | Default | Description |
|---|---|---|
| `--host` | `127.0.0.1` | Bind address |
| `--port` | `8787` | Port number |

## Provider Filtering

Harvest from specific providers only:

```bash
# Only harvest from GitHub Copilot and Cursor
ironbridge harvest run --providers copilot,cursor

# Only harvest from local providers
ironbridge harvest run --providers ollama,lmstudio
```

## Telemetry

IronBridge has **no built-in analytics endpoint** and transmits nothing on its own.
Nothing is recorded automatically: `ironbridge telemetry record` is the only writer,
and it records what you pass it, into a local JSONL file.

The setting below controls whether that local recording is permitted at all.

```bash
ironbridge telemetry status   # Check current status
ironbridge telemetry enable   # Allow local recording
ironbridge telemetry disable  # Refuse it
```

To send those records anywhere, you must name the destination yourself:

```bash
ironbridge telemetry config --endpoint https://your-collector.example --api-key ...
ironbridge telemetry sync     # POSTs to the endpoint you configured, nowhere else
```
