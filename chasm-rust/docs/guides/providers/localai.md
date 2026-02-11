# LocalAI Setup

Run any GGUF/GGML model locally with LocalAI and chat through Chasm.

## Prerequisites

- [LocalAI](https://localai.io/) installed (Docker recommended)

## Installation

=== "Docker"

    ```bash
    docker run -p 8080:8080 --name localai \
      -v $PWD/models:/models \
      localai/localai:latest
    ```

=== "Binary"

    Download from [LocalAI releases](https://github.com/mudler/LocalAI/releases).

## Usage with Chasm

```bash
# Interactive chat
chasm run localai

# Custom endpoint
LOCALAI_URL=http://localhost:8080 chasm run localai
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `LOCALAI_URL` | `http://localhost:8080` | LocalAI server URL |

## Tips

- LocalAI supports GGUF, GGML, and other model formats
- Deploy with Docker for easy model management
- Provides OpenAI-compatible API endpoints
