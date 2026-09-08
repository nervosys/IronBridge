# vLLM Demo

Demo chat sessions for vLLM inference server.

## Endpoint

Default: `http://localhost:8000/v1`

## Features

- High-throughput inference with PagedAttention
- OpenAI-compatible API
- Multi-GPU support (tensor/pipeline parallelism)
- Continuous batching

## Setup

```bash
# Install vLLM
pip install vllm

# Start server
python -m vllm.entrypoints.openai.api_server \
    --model meta-llama/Llama-3.2-8B-Instruct \
    --port 8000

# Or with Docker
docker run --gpus all \
    -v ~/.cache/huggingface:/root/.cache/huggingface \
    -p 8000:8000 \
    vllm/vllm-openai:latest \
    --model meta-llama/Llama-3.2-8B-Instruct
```

## API Format

```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/Llama-3.2-8B-Instruct",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

## Usage with ironbridge

```bash
# Configure vLLM provider
ironbridge provider config vllm --endpoint http://localhost:8000/v1

# Test connection
ironbridge provider test vllm

# Import demo sessions
ironbridge provider import vllm --source examples/vllm/sessions
```

