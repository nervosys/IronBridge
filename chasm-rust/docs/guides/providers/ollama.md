# Ollama Setup

Run open-source models locally with Ollama and chat through Chasm.

## Prerequisites

- [Ollama](https://ollama.ai/) installed and running

## Installation

=== "macOS"

    ```bash
    brew install ollama
    ollama serve
    ```

=== "Linux"

    ```bash
    curl -fsSL https://ollama.ai/install.sh | sh
    ollama serve
    ```

=== "Windows"

    Download from [ollama.ai](https://ollama.ai/) and run the installer.

## Pull a Model

```bash
ollama pull mistral
ollama pull llama3.2
ollama pull codellama
ollama pull qwen2.5-coder
```

## Usage with Chasm

```bash
# Interactive chat (sessions auto-saved)
chasm run ollama --model mistral

# Use a specific endpoint
OLLAMA_HOST=http://localhost:11434 chasm run ollama

# List models available on your Ollama instance
chasm provider list --type ollama
```

## Configuration

| Variable      | Default                  | Description       |
| ------------- | ------------------------ | ----------------- |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL |

## Verify Connection

```bash
# Check if Ollama is running
chasm harvest scan

# Expected output:
# ✓ Ollama (localhost:11434) — running
```

## Tips

- Ollama runs entirely on your local machine — no data leaves your network
- Use quantized models (Q4_K_M, Q5_K_M) for a good balance of quality and speed
- GPU acceleration (NVIDIA CUDA, Apple Metal) is automatic when available
