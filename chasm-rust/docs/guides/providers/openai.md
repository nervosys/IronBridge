# OpenAI / ChatGPT Setup

Connect to OpenAI's API for GPT-4o, GPT-4, and other models.

## Prerequisites

- [OpenAI API key](https://platform.openai.com/api-keys)

## Configuration

```bash
export OPENAI_API_KEY=sk-...
```

## Usage with Chasm

```bash
# Interactive chat with GPT-4o
chasm run chatgpt --model gpt-4o

# Use a different model
chasm run chatgpt --model gpt-4-turbo

# GPT-3.5 for faster, cheaper responses
chasm run chatgpt --model gpt-3.5-turbo
```

## Available Models

| Model           | Context | Best For                |
| --------------- | ------- | ----------------------- |
| `gpt-4o`        | 128K    | General purpose, vision |
| `gpt-4-turbo`   | 128K    | Complex reasoning       |
| `gpt-3.5-turbo` | 16K     | Fast, cost-effective    |
| `o1`            | 200K    | Deep reasoning          |

## Browser Extension

Chasm's browser extension can also capture sessions from [chatgpt.com](https://chatgpt.com):

1. Install the Chasm browser extension
2. Navigate to chatgpt.com
3. Click the Chasm icon to export the current conversation

## Tips

- Sessions are saved locally — your API key never leaves your machine
- Use `chasm harvest run --providers openai` to import ChatGPT web sessions
- Token usage is tracked per session for cost analysis
