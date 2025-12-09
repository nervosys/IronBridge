# Examples by Provider

This directory contains example chat session data for each supported LLM provider backend.
Each subdirectory contains sample data in the format used by that provider.

## Directory Structure

```
examples/
├── copilot/           # GitHub Copilot (VS Code Chat)
├── cursor/            # Cursor IDE
├── ollama/            # Ollama local LLM
├── vllm/              # vLLM server
├── azure-foundry/     # Azure AI Foundry
├── lm-studio/         # LM Studio
├── localai/           # LocalAI
├── text-gen-webui/    # Text Generation WebUI
├── jan/               # Jan.ai
├── gpt4all/           # GPT4All
├── llamafile/         # Llamafile
├── openai/            # OpenAI API
├── anthropic/         # Anthropic Claude
├── chatgpt-export/    # ChatGPT export files
└── custom/            # Custom provider template
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
csm provider import copilot --source examples/copilot

# Import from ChatGPT export
csm provider import chatgpt --source examples/chatgpt-export/conversations.json

# Import from Ollama history
csm provider import ollama --source examples/ollama
```

### Test Provider Connections

```bash
# Test local provider
csm provider test ollama

# Test with custom endpoint
csm provider test lm-studio --endpoint http://localhost:1234/v1
```

## Session Format

Each provider may use a different session format. CSM normalizes these to a common format:

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
