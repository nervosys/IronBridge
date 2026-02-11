# LM Studio Setup

Run GGUF models locally with LM Studio and chat through Chasm.

## Prerequisites

- [LM Studio](https://lmstudio.ai/) installed

## Setup

1. Download and install LM Studio from [lmstudio.ai](https://lmstudio.ai/)
2. Download a model from the built-in model browser
3. Start the local server (Developer tab → Start Server)

## Usage with Chasm

```bash
# Interactive chat
chasm run lmstudio

# Custom endpoint
LM_STUDIO_URL=http://localhost:1234 chasm run lmstudio
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `LM_STUDIO_URL` | `http://localhost:1234` | LM Studio server URL |

## Tips

- LM Studio provides an OpenAI-compatible API
- Load models in the LM Studio GUI before starting a chat
- Supports GGUF format models from Hugging Face
