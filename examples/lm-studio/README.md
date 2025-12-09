# LM Studio Demo

Demo chat sessions for LM Studio local LLM application.

## Endpoint

Default: `http://localhost:1234/v1`

## Features

- User-friendly GUI for model management
- GGUF model support (quantized models)
- OpenAI-compatible API server
- Mac, Windows, and Linux support

## Setup

1. Download LM Studio from [lmstudio.ai](https://lmstudio.ai)
2. Download a model (e.g., Mistral, Llama, Phi)
3. Start the local server from the "Local Server" tab
4. Server runs on `http://localhost:1234/v1`

## API Format

```bash
curl http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "local-model",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

## Python Example

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:1234/v1",
    api_key="lm-studio"  # Can be anything
)

response = client.chat.completions.create(
    model="local-model",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

## Usage with CSM

```bash
# Configure LM Studio provider
csm provider config lm-studio --endpoint http://localhost:1234/v1

# Test connection
csm provider test lm-studio

# Import demo sessions
csm provider import lm-studio --source examples/lm-studio/sessions
```
