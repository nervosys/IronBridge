# Ollama Demo

Demo chat sessions for Ollama local LLM provider.

## Endpoint

Default: `http://localhost:11434`

## API Format

Ollama uses an OpenAI-compatible API:

```bash
# Chat completion
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'

# List models
curl http://localhost:11434/api/tags
```

## Session Format

```json
{
  "id": "session-id",
  "title": "Session Title",
  "model": "llama3.2:latest",
  "messages": [
    {"role": "user", "content": "...", "timestamp": "..."},
    {"role": "assistant", "content": "...", "timestamp": "..."}
  ],
  "provider": "ollama",
  "endpoint": "http://localhost:11434"
}
```

## Setup

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull llama3.2

# Start server (if not running as service)
ollama serve
```

## Usage with chasm

```bash
# Configure Ollama provider
chasm provider config ollama --endpoint http://localhost:11434

# Test connection
chasm provider test ollama

# Import demo sessions
chasm provider import ollama --source examples/ollama/sessions
```

