# GPT4All Demo

Demo chat sessions for GPT4All local LLM application.

## Endpoint

Default: `http://localhost:4891/v1`

## Features

- CPU-optimized inference
- No GPU required
- Cross-platform desktop app
- Python library available
- Privacy-focused
- Open source

## Setup

### Desktop Application

1. Download from [gpt4all.io](https://gpt4all.io)
2. Install and launch
3. Download models from the built-in browser

### Python Library

```bash
pip install gpt4all
```

```python
from gpt4all import GPT4All

model = GPT4All("mistral-7b-openorca.Q4_0.gguf")
response = model.generate("Hello!")
```

### API Server

```bash
# Enable in desktop app settings
# Or start from command line
gpt4all --model mistral-7b-openorca.Q4_0.gguf --server
```

## API Format

```bash
curl http://localhost:4891/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mistral-7b-openorca.Q4_0.gguf",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Recommended Models

| Model               | Size   | Use Case       |
| ------------------- | ------ | -------------- |
| mistral-7b-openorca | 4.1 GB | General chat   |
| gpt4all-falcon      | 3.9 GB | Fast responses |
| nous-hermes-llama2  | 3.8 GB | Instructions   |
| wizardlm-13b        | 7.3 GB | Complex tasks  |

## Usage with CSM

```bash
# Configure GPT4All provider
csm provider config gpt4all --endpoint http://localhost:4891/v1

# Test connection
csm provider test gpt4all

# Import demo sessions
csm provider import gpt4all --source examples/gpt4all/sessions
```
