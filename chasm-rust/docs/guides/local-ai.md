# Local AI Setup

Run AI models locally for maximum privacy and zero API costs. Chasm supports all major local inference engines.

## Ollama (Recommended)

[Ollama](https://ollama.ai) is the easiest way to run models locally.

### Install

=== "Windows"
    Download from [ollama.ai](https://ollama.ai/download/windows)

=== "macOS"
    ```bash
    brew install ollama
    ```

=== "Linux"
    ```bash
    curl -fsSL https://ollama.ai/install.sh | sh
    ```

### Start & Pull a Model

```bash
# Start the Ollama server
ollama serve

# Pull a model (in another terminal)
ollama pull mistral
ollama pull codellama
ollama pull llama3.1
```

### Use with Chasm

```bash
# Interactive chat
chasm run ollama --model mistral

# Different model
chasm run ollama --model codellama
```

### Custom Endpoint

```bash
export OLLAMA_HOST=http://192.168.1.100:11434
chasm run ollama
```

### Recommended Models

| Model | Size | Best For |
|---|---|---|
| `mistral` | 4.1 GB | General coding, fast responses |
| `codellama` | 3.8 GB | Code generation and completion |
| `llama3.1` | 4.7 GB | General purpose, reasoning |
| `deepseek-coder-v2` | 8.9 GB | Advanced code generation |
| `phi3` | 2.3 GB | Lightweight, fast |
| `qwen2.5-coder` | 4.7 GB | Code-focused, good context |

---

## LM Studio

[LM Studio](https://lmstudio.ai) provides a GUI for managing and running models.

### Install

Download from [lmstudio.ai](https://lmstudio.ai) (Windows, macOS, Linux).

### Setup

1. Open LM Studio
2. Download a model from the model browser (e.g., `TheBloke/Mistral-7B-Instruct-v0.2-GGUF`)
3. Go to **Local Server** tab → Click **Start Server**
4. Server runs on `http://localhost:1234`

### Use with Chasm

```bash
chasm run lmstudio
```

### Custom Endpoint

```bash
export LM_STUDIO_URL=http://localhost:1234
chasm run lmstudio
```

---

## GPT4All

[GPT4All](https://gpt4all.io) is a desktop application for running models locally.

### Install

Download from [gpt4all.io](https://gpt4all.io) (Windows, macOS, Linux).

### Setup

1. Open GPT4All
2. Download a model from the model browser
3. Enable the **API Server** in settings
4. Server runs on `http://localhost:4891`

### Use with Chasm

```bash
chasm run gpt4all
```

---

## LocalAI

[LocalAI](https://localai.io) is a self-hosted, OpenAI-compatible API alternative.

### Install

```bash
# Docker (recommended)
docker run -p 8080:8080 localai/localai

# Or with GPU support
docker run --gpus all -p 8080:8080 localai/localai
```

### Use with Chasm

```bash
export LOCALAI_URL=http://localhost:8080
chasm run localai
```

---

## llamafile

[llamafile](https://github.com/Mozilla-Ocho/llamafile) packages models as single-binary executables.

### Install

```bash
# Download a llamafile (example: Mistral)
curl -L -o mistral.llamafile \
  https://huggingface.co/Mozilla/Mistral-7B-Instruct-v0.2-llamafile/resolve/main/mistral-7b-instruct-v0.2.Q4_0.llamafile

# Make executable
chmod +x mistral.llamafile

# Run (starts server on port 8080)
./mistral.llamafile
```

### Use with Chasm

```bash
chasm run llamafile
```

---

## Hardware Requirements

| Model Size | Minimum RAM | Recommended | GPU |
|---|---|---|---|
| 3B params | 4 GB | 8 GB | Optional |
| 7B params | 8 GB | 16 GB | Recommended |
| 13B params | 16 GB | 32 GB | Recommended |
| 34B+ params | 32 GB | 64 GB | Required |

!!! tip "Apple Silicon"
    If you're on an M-series Mac, all local LLM engines leverage Metal for GPU acceleration automatically. 7B models run smoothly on 16 GB unified memory.

## Harvesting Local LLM Sessions

After chatting with local models through Chasm, your sessions are automatically captured in the database:

```bash
# Check what's been captured
chasm harvest status

# Search across all sessions (local and cloud)
chasm harvest search "that code fix"
```

## Which Provider Should I Choose?

| Use Case | Recommended Provider |
|---|---|
| Quick setup, many models | **Ollama** |
| GUI model management | **LM Studio** |
| Simple desktop app | **GPT4All** |
| Self-hosted API | **LocalAI** |
| Single-file deployment | **llamafile** |
