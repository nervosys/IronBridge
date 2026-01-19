# Examples by Provider

This directory contains example chat session data for each supported LLM provider backend.
Each subdirectory contains sample data in the format used by that provider.

## Directory Structure

```
examples/
├── azure-foundry/     # Azure AI Foundry
├── copilot/           # GitHub Copilot (VS Code Chat)
├── copilot_chat/      # Additional Copilot sessions
├── cursor/            # Cursor IDE
├── gpt4all/           # GPT4All
├── jan/               # Jan.ai
├── llamafile/         # Llamafile
├── lm-studio/         # LM Studio
├── localai/           # LocalAI
├── ollama/            # Ollama local LLM
├── sample-data/       # Sample session data
├── text-gen-webui/    # Text Generation WebUI
└── vllm/              # vLLM server
```

## Provider Types

### File-Based Providers (Local Storage)

These providers store chat sessions in local files:

- **GitHub Copilot**: VS Code's native chat format in `workspaceStorage`
- **Cursor**: Cursor IDE's proprietary format

### API-Based Providers (OpenAI-Compatible)

These providers expose an OpenAI-compatible API:

- **Ollama**: `http://localhost:11434`
- **vLLM**: `http://localhost:8000`
- **LM Studio**: `http://localhost:1234/v1`
- **LocalAI**: `http://localhost:8080/v1`
- **Text Gen WebUI**: `http://localhost:5000/v1`
- **Jan.ai**: `http://localhost:1337/v1`
- **GPT4All**: `http://localhost:4891/v1`
- **Llamafile**: `http://localhost:8080/v1`

### Cloud Providers

These providers require API keys:

- **OpenAI**: `https://api.openai.com/v1`
- **Anthropic**: `https://api.anthropic.com/v1`
- **Azure AI Foundry**: Cloud or local deployment

## Usage

### Import Demo Data

```bash
# Import Copilot demo sessions
chasm provider import copilot --source examples/copilot/chatSessions

# Import from Ollama history
chasm provider import ollama --source examples/ollama/sessions

# Import from other providers
chasm provider import cursor --source examples/cursor/sessions
```

### Test Provider Connections

```bash
# Test local provider
chasm provider test ollama

# Test with custom endpoint
chasm provider test lm-studio --endpoint http://localhost:1234/v1
```

## Session Format

Each provider may use a different session format. Chasm normalizes these to a common format:

```json
{
  "id": "uuid",
  "title": "Session Title",
  "created_at": "2024-01-01T00:00:00Z",
  "messages": [
    {
      "role": "user",
      "content": "Hello",
      "timestamp": "2024-01-01T00:00:00Z"
    },
    {
      "role": "assistant", 
      "content": "Hi there!",
      "timestamp": "2024-01-01T00:00:01Z"
    }
  ],
  "provider": "ollama",
  "model": "llama3.2"
}
```

