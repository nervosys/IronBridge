# GPT4All Setup

Run bundled models locally with GPT4All and chat through Chasm.

## Prerequisites

- [GPT4All](https://gpt4all.io/) installed

## Setup

1. Download GPT4All from [gpt4all.io](https://gpt4all.io/)
2. Enable the API server in Settings → Enable API Server
3. Download a model from the built-in model browser

## Usage with Chasm

```bash
# Interactive chat
chasm run gpt4all

# Custom endpoint
GPT4ALL_URL=http://localhost:4891 chasm run gpt4all
```

## Configuration

| Variable      | Default                 | Description        |
| ------------- | ----------------------- | ------------------ |
| `GPT4ALL_URL` | `http://localhost:4891` | GPT4All server URL |

## Tips

- GPT4All bundles models for easy installation — no manual downloads needed
- Supports CPU-only inference with reasonable performance
- The API is OpenAI-compatible
