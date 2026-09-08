# Provider Setup Guides

Step-by-step guides for configuring each AI provider with IronBridge.

## Editor-Based Providers

These providers are auto-detected from your editor's workspace storage — no configuration needed.

| Guide | Provider | Detection |
|---|---|---|
| [GitHub Copilot](copilot.md) | VS Code Copilot Chat | Automatic |
| [Cursor](cursor.md) | Cursor IDE | Automatic |
| [Claude Code](claude-code.md) | Claude Code CLI | Automatic |
| [Continue.dev](continuedev.md) | Continue.dev Extension | Automatic |

## Terminal-Based Providers

These providers store sessions in your home directory.

| Guide | Provider | Session Location |
|---|---|---|
| [Codex CLI](codex-cli.md) | OpenAI Codex CLI | `~/.codex/sessions/` |
| [Gemini CLI](gemini-cli.md) | Google Gemini CLI | `~/.gemini/tmp/` |

## Local LLM Providers

Run models locally and chat through IronBridge.

| Guide | Provider | Default Port |
|---|---|---|
| [Ollama](ollama.md) | Ollama | `11434` |
| [LM Studio](lm-studio.md) | LM Studio | `1234` |
| [GPT4All](gpt4all.md) | GPT4All | `4891` |
| [LocalAI](localai.md) | LocalAI | `8080` |

## Cloud API Providers

Connect to hosted AI services with API keys.

| Guide | Provider | API Key Variable |
|---|---|---|
| [OpenAI / ChatGPT](openai.md) | OpenAI | `OPENAI_API_KEY` |
| [Anthropic / Claude](anthropic.md) | Anthropic | `ANTHROPIC_API_KEY` |
| [Google Gemini](google.md) | Google AI | `GOOGLE_API_KEY` |
