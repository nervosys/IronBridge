# Providers

Chasm supports **20+ AI providers** across three categories: editor-based assistants, local LLMs, and cloud APIs.

## Editor-Based Providers

These providers are detected automatically from VS Code, Cursor, and other editor workspace storage.

| Provider | Editor | Detection | Status |
|---|---|---|---|
| **GitHub Copilot** | VS Code | Automatic | :white_check_mark: Stable |
| **Cursor** | Cursor | Automatic | :white_check_mark: Stable |
| **Windsurf** | Windsurf | Automatic | :white_check_mark: Stable |
| **Continue.dev** | VS Code | Automatic | :white_check_mark: Stable |
| **Claude Code** | Terminal | Automatic | :white_check_mark: Stable |
| **OpenCode** | Terminal | Automatic | :white_check_mark: Stable |
| **OpenClaw** | VS Code | Automatic | :white_check_mark: Stable |
| **Antigravity** | VS Code | Automatic | :white_check_mark: Stable |

### How Detection Works

Chasm scans standard workspace storage locations for each editor:

| Platform | VS Code Location |
|---|---|
| Windows | `%APPDATA%\Code\User\workspaceStorage\` |
| macOS | `~/Library/Application Support/Code/User/workspaceStorage/` |
| Linux | `~/.config/Code/User/workspaceStorage/` |

Each workspace folder contains provider-specific session files (JSON/JSONL) that Chasm parses and normalizes into a unified format.

---

## Local LLM Providers

These providers run AI models on your local machine. Use `chasm run <provider>` to start an interactive chat session.

| Provider | Default Endpoint | Models |
|---|---|---|
| **Ollama** | `http://localhost:11434` | Mistral, Llama, CodeLlama, Phi, Qwen, etc. |
| **LM Studio** | `http://localhost:1234` | Any GGUF model |
| **GPT4All** | `http://localhost:4891` | Bundled models |
| **LocalAI** | `http://localhost:8080` | Any GGUF/GGML model |
| **llamafile** | `http://localhost:8080` | Single-binary models |

### Configuration

Set custom endpoints via environment variables:

```bash
export OLLAMA_HOST=http://localhost:11434
export LM_STUDIO_URL=http://localhost:1234
export GPT4ALL_URL=http://localhost:4891
export LOCALAI_URL=http://localhost:8080
```

### Examples

```bash
# Chat with Ollama
chasm run ollama --model mistral

# Chat with LM Studio
chasm run lmstudio

# Chat with GPT4All
chasm run gpt4all
```

---

## Cloud API Providers

These providers connect to hosted AI services. Requires an API key.

| Provider | API Key Variable | Default Model |
|---|---|---|
| **OpenAI / ChatGPT** | `OPENAI_API_KEY` | `gpt-4o` |
| **Anthropic / Claude** | `ANTHROPIC_API_KEY` | `claude-sonnet-4-20250514` |
| **Google / Gemini** | `GOOGLE_API_KEY` | `gemini-2.0-flash` |
| **Perplexity** | `PERPLEXITY_API_KEY` | `llama-3.1-sonar-large-128k-online` |

### Configuration

```bash
# Set API keys
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export GOOGLE_API_KEY=AIza...
export PERPLEXITY_API_KEY=pplx-...
```

### Examples

```bash
# Chat with Claude
chasm run claude --model claude-sonnet-4-20250514

# Chat with ChatGPT
chasm run chatgpt --model gpt-4o

# Chat with Gemini
chasm run gemini --model gemini-2.0-flash

# Chat with Perplexity
chasm run perplexity
```

---

## Provider Auto-Detection

When running `chasm harvest scan`, Chasm automatically detects which providers are available on your system:

```bash
$ chasm harvest scan

Detected providers:
  ✓ GitHub Copilot  (VS Code)        — 15 workspaces, 47 sessions
  ✓ Cursor          (Cursor)         — 3 workspaces, 12 sessions
  ✓ Ollama          (localhost:11434) — running
  ✗ LM Studio       (localhost:1234) — not running
  ✗ OpenAI          (api.openai.com) — no API key set
  ✓ Anthropic       (api.anthropic.com) — configured
```

You can then harvest from all detected providers or target specific ones:

```bash
# Harvest from all detected providers
chasm harvest run

# Harvest from specific providers only
chasm harvest run --providers copilot,cursor,ollama
```

---

## Session Normalization

Regardless of provider, all sessions are normalized into a unified schema:

```
Session
├── id: UUID
├── title: String
├── provider: String
├── workspace_id: UUID
├── created_at: DateTime
├── updated_at: DateTime
└── messages: Vec<Message>
    ├── role: user | assistant | system | tool
    ├── content: String
    ├── timestamp: DateTime
    └── tool_invocations: Vec<ToolInvocation>
        ├── name: String
        ├── input: JSON
        └── output: JSON
```

This means you can search, merge, and export sessions across providers without worrying about format differences.
