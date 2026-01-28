# Chasm 🗄️

**Universal Chat Session Manager** — Harvest, merge, and recover AI chat history across workspaces and providers.

--

## Features

- 🔍 **Workspace Discovery** — Find all VS Code workspaces with chat sessions
- 🔄 **Session Recovery** — Detect and recover orphaned sessions from old workspace hashes
- 🔀 **History Merging** — Combine sessions across workspaces chronologically
- 📥 **Harvest System** — Unified database collecting sessions from all providers
- 🔗 **Share Link Import** — Import shared chats from ChatGPT, Claude, Gemini
- 🔎 **Full-Text Search** — Search across all harvested messages with FTS5
- 🎛️ **Interactive TUI** — Browse workspaces and sessions in the terminal
- 🤖 **MCP Server** — Model Context Protocol integration for AI agents
- 📦 **Git Integration** — Version control your chat histories

## Install

```bash
cargo install chasm
```

## Quick Start

```bash
chasm list workspaces        # List all VS Code workspaces
chasm show path              # Show sessions for current project
chasm find session "auth"    # Search session content
```

## Session Recovery

Recover orphaned sessions when VS Code creates a new workspace hash:

```bash
chasm detect orphaned /path/to/project           # Find orphaned sessions
chasm detect orphaned -r /path/to/project        # Recover to active workspace
chasm register all --force --path /path/to/project  # Register in VS Code
# Then: Ctrl+Shift+P → Developer: Reload Window
```

## Commands

### List & Find

```bash
chasm list workspaces              # All VS Code workspaces
chasm list sessions                # All chat sessions
chasm list orphaned                # Unindexed sessions on disk
chasm find workspace <pattern>     # Search by workspace name
chasm find session <pattern>       # Search by session content
```

### Detect & Recover

```bash
chasm detect                       # Full detection report
chasm detect workspace [path]      # Workspace info for path
chasm detect providers             # Available LLM providers
chasm detect orphaned [path]       # Find orphaned sessions
chasm detect orphaned -r [path]    # Recover orphaned sessions
chasm register all [--force]       # Register sessions in VS Code index
```

### Merge & Export

```bash
chasm merge path [path]            # Merge all sessions into one
chasm merge workspace <name>       # Merge by workspace name
chasm export path <dest> [path]    # Export sessions
chasm import path <src> [path]     # Import sessions
```

### Harvest (Multi-Provider Database)

```bash
chasm harvest init                 # Initialize database
chasm harvest scan                 # Scan for providers
chasm harvest run                  # Collect all sessions
chasm harvest search "query"       # Full-text search
chasm harvest share <url>          # Import share link
```

## Supported Providers

| Type           | Providers                                                       |
| -------------- | --------------------------------------------------------------- |
| **Editors**    | GitHub Copilot, Cursor, Windsurf                                |
| **Local LLMs** | Ollama, vLLM, LM Studio, LocalAI, Jan, GPT4All, Llamafile       |
| **Cloud**      | ChatGPT, Claude, Gemini, Perplexity, DeepSeek (via share links) |

## MCP Server

AI agent integration via Model Context Protocol:

```json
{
  "mcpServers": {
    "chasm": { "command": "csm-mcp" }
  }
}
```

Tools: `csm_list_workspaces`, `csm_list_sessions`, `csm_show_session`, `csm_search`, `csm_detect`, `csm_register_all`

## TUI

```bash
chasm run tui    # Interactive browser (↑↓/jk to navigate, Enter to select, ? for help)
```

## Project Structure

```bash
chasm/
├── chasm-rust/        # CLI (Rust)
├── chasm-web/         # Web UI (React)
├── chasm-app/         # Mobile (React Native)
├── vscode-extension/  # VS Code extension
└── examples/          # Provider examples
```

## License

Apache 2.0 — Made by [Nervosys](https://nervosys.ai)
