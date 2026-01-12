# Llamafile Demo

Demo chat sessions for Llamafile portable LLM executables.

## Endpoint

Default: `http://localhost:8080/v1`

## Features

- Single executable with model included
- No installation or dependencies
- Cross-platform (Windows, macOS, Linux)
- Built-in web UI and API server
- Perfect for air-gapped environments

## Setup

```bash
# Download a llamafile
wget https://huggingface.co/Mozilla/llava-v1.5-7b-llamafile/resolve/main/llava-v1.5-7b-q4.llamafile

# Make executable (macOS/Linux)
chmod +x llava-v1.5-7b-q4.llamafile

# Run with server mode
./llava-v1.5-7b-q4.llamafile --server --port 8080

# Windows: just double-click or run from cmd
llava-v1.5-7b-q4.llamafile.exe --server --port 8080
```

## API Format

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llava-v1.5-7b-q4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Available Llamafiles

Find pre-built llamafiles at:
- [Mozilla's HuggingFace](https://huggingface.co/Mozilla)
- [jartine's releases](https://github.com/Mozilla-Ocho/llamafile/releases)

## Create Your Own

```bash
# Build llamafile from GGUF model
llamafile-convert model.gguf -o my-model.llamafile
```

## Usage with chasm

```bash
# Configure Llamafile provider
chasm provider config llamafile --endpoint http://localhost:8080/v1

# Test connection
chasm provider test llamafile

# Import demo sessions
chasm provider import llamafile --source examples/llamafile/sessions
```

