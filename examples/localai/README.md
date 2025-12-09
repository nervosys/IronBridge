# LocalAI Demo

Demo chat sessions for LocalAI self-hosted inference.

## Endpoint

Default: `http://localhost:8080/v1`

## Features

- OpenAI-compatible API
- Multiple model backends (GGML, GGUF, transformers)
- CPU and GPU support
- Built-in model gallery
- Audio transcription (Whisper)
- Image generation (Stable Diffusion)

## Setup

```bash
# Docker (CPU)
docker run -p 8080:8080 -v $PWD/models:/models localai/localai:latest

# Docker (GPU - NVIDIA)
docker run --gpus all -p 8080:8080 -v $PWD/models:/models \
  localai/localai:latest-gpu-nvidia-cuda-12

# Docker Compose
docker compose up -d
```

## Download Models

```bash
# Using model gallery
curl http://localhost:8080/models/apply \
  -H "Content-Type: application/json" \
  -d '{"url": "github:go-skynet/model-gallery/gpt4all-j.yaml"}'

# List available models
curl http://localhost:8080/v1/models
```

## API Format

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Usage with CSM

```bash
# Configure LocalAI provider
csm provider config localai --endpoint http://localhost:8080/v1

# Test connection
csm provider test localai

# Import demo sessions
csm provider import localai --source examples/localai/sessions
```
