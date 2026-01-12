# Text Generation WebUI Demo

Demo chat sessions for oobabooga's Text Generation WebUI.

## Endpoint

Default: `http://localhost:5000/v1`

## Features

- Web interface for model interaction
- Multiple model loaders (Transformers, llama.cpp, ExLlamaV2, etc.)
- GGUF, GPTQ, AWQ, EXL2 format support
- Character/persona system
- Extensions ecosystem
- Training/fine-tuning support

## Setup

```bash
# Clone repository
git clone https://github.com/oobabooga/text-generation-webui
cd text-generation-webui

# One-click installer
# Windows: start_windows.bat
# Linux: ./start_linux.sh
# macOS: ./start_macos.sh

# Enable API
python server.py --api --api-port 5000
```

## API Format

```bash
# OpenAI-compatible endpoint
curl http://localhost:5000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "current-model",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Model Loading

Download models through the UI:
1. Go to **Model** tab
2. Enter HuggingFace model name
3. Click **Download**
4. Select loader and load model

## Usage with chasm

```bash
# Configure Text Gen WebUI provider
chasm provider config text-gen-webui --endpoint http://localhost:5000/v1

# Test connection
chasm provider test text-gen-webui

# Import demo sessions
chasm provider import text-gen-webui --source examples/text-gen-webui/sessions
```

