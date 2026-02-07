# Chasm 🗄️

**Chat Session Manager (Chasm):** Bridging the divide between AI providers.

---

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
- 🌐 **REST & GraphQL API** — Build custom integrations
- 🔐 **Enterprise Features** — SSO, audit logging, compliance (SOC2, HIPAA, GDPR)
- 👥 **Team Collaboration** — Workspaces, RBAC, session sharing
- 🧠 **AI Intelligence** — Topic extraction, summarization, recommendations
- 🔌 **Plugin System** — Extensible architecture with event hooks

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
chasm detect orphaned /path/to/project              # Find orphaned sessions
chasm detect orphaned -r /path/to/project           # Recover to active workspace
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

| Type           | Providers                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------- |
| **Editors**    | GitHub Copilot, Cursor, Windsurf, Continue.dev, ClaudeCode, OpenCode, OpenClaw, Antigravity |
| **Local LLMs** | Ollama, vLLM, LM Studio, LocalAI, Jan, GPT4All, Llamafile                                   |
| **Cloud**      | ChatGPT, Claude, Gemini, Perplexity, DeepSeek (via share links)                             |

## Ecosystem

| Component             | Description                       | Status   |
| --------------------- | --------------------------------- | -------- |
| **chasm-rust**        | Core Rust library and CLI         | ✅ Stable |
| **chasm-web**         | React web application             | ✅ Stable |
| **chasm-app**         | React Native mobile app           | ✅ Stable |
| **chasm-desktop**     | Tauri desktop application         | ✅ Stable |
| **vscode-extension**  | VS Code extension                 | ✅ Stable |
| **browser-extension** | Chrome/Firefox extension          | ✅ Stable |
| **jetbrains-plugin**  | IntelliJ/PyCharm/WebStorm plugin  | ✅ Stable |
| **vim-plugin**        | Vim 8.0+ plugin                   | ✅ Stable |
| **neovim-plugin**     | Neovim 0.8+ plugin with Telescope | ✅ Stable |

## API Server

Start the REST/GraphQL API server:

```bash
chasm api serve --port 8787
```

### REST Endpoints

| Method | Endpoint            | Description               |
| ------ | ------------------- | ------------------------- |
| GET    | `/api/health`       | Health check              |
| GET    | `/api/workspaces`   | List workspaces           |
| GET    | `/api/sessions`     | List sessions             |
| GET    | `/api/sessions/:id` | Get session with messages |
| POST   | `/api/harvest`      | Trigger harvest           |
| GET    | `/api/stats`        | Database statistics       |

### GraphQL

```bash
# GraphQL endpoint
curl -X POST http://localhost:8787/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ sessions { id title provider } }"}'

# GraphQL Playground
open http://localhost:8787/graphql/playground
```

## MCP Server

AI agent integration via Model Context Protocol:

```json
{
  "mcpServers": {
    "chasm": { "command": "chasm-mcp" }
  }
}
```

Tools: `chasm_list_workspaces`, `chasm_list_sessions`, `chasm_show_session`, `chasm_search`, `chasm_detect`, `chasm_register_all`

## TUI

```bash
chasm run tui    # Interactive browser (↑↓/jk to navigate, Enter to select, ? for help)
```

## Agency (AI Agent Framework)

```bash
chasm agency run --agent researcher "What are the latest AI trends?"
chasm agency run --orchestration swarm "Build a REST API"
```

## Enterprise Features

- **SSO/SAML**: Okta, Azure AD, Google, OneLogin, Auth0
- **Compliance**: SOC2, HIPAA, GDPR, CCPA, ISO 27001, FedRAMP, PCI DSS
- **Audit Logging**: Comprehensive event tracking with data classification
- **Multi-tenancy**: Subscription tiers, tenant isolation, white-labeling
- **Team Workspaces**: RBAC, activity feeds, session sharing

## Project Structure

```bash
chasm/
├── chasm-rust/          # Core CLI and API server (Rust)
├── chasm-web/           # Web dashboard (React)
├── chasm-app/           # Mobile app (React Native)
├── chasm-desktop/       # Desktop app (Tauri)
├── vscode-extension/    # VS Code extension
├── browser-extension/   # Chrome/Firefox extension
├── jetbrains-plugin/    # JetBrains IDEs plugin
├── vim-plugin/          # Vim plugin
├── neovim-plugin/       # Neovim plugin
└── examples/            # Provider examples
```

## License

Apache 2.0 — Made by [Nervosys](https://nervosys.ai)
