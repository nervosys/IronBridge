# Jan.ai Demo

Demo chat sessions for Jan.ai local LLM application.

## Endpoint

Default: `http://localhost:1337/v1`

## Features

- Privacy-first, offline-capable
- Modern ChatGPT-like interface
- One-click model downloads
- OpenAI-compatible API
- Cross-platform (Windows, macOS, Linux)
- Open source (AGPLv3)

## Setup

1. Download Jan from [jan.ai](https://jan.ai)
2. Install and launch
3. Download a model from the Hub
4. Enable API server in Settings > Advanced

## Enable API Server

1. Open Jan Settings
2. Go to **Advanced** > **Local API Server**
3. Enable the server
4. Default port: `1337`

## API Format

```bash
curl http://localhost:1337/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mistral-ins-7b-q4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Python Example

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:1337/v1",
    api_key="jan"
)

response = client.chat.completions.create(
    model="mistral-ins-7b-q4",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

## Usage with chasm

```bash
# Configure Jan provider
chasm provider config jan --endpoint http://localhost:1337/v1

# Test connection
chasm provider test jan

# Import demo sessions
chasm provider import jan --source examples/jan/sessions
```

