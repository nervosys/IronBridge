<p align="center">
  <h1 align="center">🗄️ Chasm</h1>
  <p align="center">
    <strong>Universal Chat Session Manager</strong><br>
    Harvest, merge, and analyze your AI chat history
  </p>
</p>

<p align="center">
  <a href="https://crates.io/crates/chasm"><img src="https://img.shields.io/crates/v/chasm.svg" alt="Crates.io"></a>
  <a href="https://docs.rs/chasm"><img src="https://docs.rs/chasm/badge.svg" alt="Documentation"></a>
  <a href="https://github.com/nervosys/chasm/actions"><img src="https://github.com/nervosys/chasm/workflows/CI/badge.svg" alt="CI Status"></a>
  <a href="https://codecov.io/gh/nervosys/chasm"><img src="https://codecov.io/gh/nervosys/chasm/branch/main/graph/badge.svg" alt="Coverage"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/LICENSE--2.0-blue.svg" alt="License"></a>
</p>

---

**Chasm** extracts and unifies chat sessions from AI coding assistants like GitHub Copilot, Cursor, and more. Never lose your AI conversations again.

## ✨ Features

- 🔍 **Harvest** - Extract chat sessions from VS Code, Cursor, Windsurf, and other editors
- 🔀 **Merge** - Combine sessions across workspaces and time periods
- 📊 **Analyze** - Get statistics on your AI assistant usage
- 🔌 **API Server** - REST API for building custom integrations
- 🤖 **MCP Tools** - Model Context Protocol support for AI agent integration
- 🗃️ **Universal Database** - SQLite-based storage that normalizes all providers

## 📦 Installation

### From crates.io

```bash
cargo install chasm
```

### From source

```bash
git clone https://github.com/nervosys/chasm.git
cd chasm
cargo install --path .
```

### Pre-built binaries

Download from [GitHub Releases](https://github.com/nervosys/chasm/releases):

| Platform    | Download                                                                       |
| ----------- | ------------------------------------------------------------------------------ |
| Windows x64 | [chasm-windows-x64.zip](https://github.com/nervosys/chasm/releases/latest)     |
| macOS x64   | [chasm-darwin-x64.tar.gz](https://github.com/nervosys/chasm/releases/latest)   |
| macOS ARM   | [chasm-darwin-arm64.tar.gz](https://github.com/nervosys/chasm/releases/latest) |
| Linux x64   | [chasm-linux-x64.tar.gz](https://github.com/nervosys/chasm/releases/latest)    |

### Docker

```bash
docker pull ghcr.io/nervosys/chasm:latest
docker run -v ~/.chasm:/data ghcr.io/nervosys/chasm list workspaces
```

## 🚀 Quick Start

### List discovered workspaces

```bash
chasm list workspaces
```

```
┌────────────────────────┬──────────────────┬──────────┬────────────┐
│ Name                   │ Provider         │ Sessions │ Updated    │
├────────────────────────┼──────────────────┼──────────┼────────────┤
│ my-project             │ GitHub Copilot   │ 15       │ 2026-01-08 │
│ another-project        │ Cursor           │ 8        │ 2026-01-07 │
│ open-source-contrib    │ GitHub Copilot   │ 23       │ 2026-01-06 │
└────────────────────────┴──────────────────┴──────────┴────────────┘
```

### Show sessions for a project

```bash
chasm show path /path/to/your/project
```

### Harvest sessions from VS Code

```bash
chasm harvest
```

### Export a session to Markdown

```bash
chasm export session abc123 --format markdown --output chat.md
```

### Start the API server

```bash
chasm api serve --port 8787
```

## 📖 CLI Reference

### Core Commands

| Command                          | Description                                      |
| -------------------------------- | ------------------------------------------------ |
| `chasm list workspaces`          | List all discovered workspaces                   |
| `chasm list sessions`            | List sessions (optionally filtered by workspace) |
| `chasm list orphaned`            | List unregistered sessions on disk               |
| `chasm show session <id>`        | Display full session content                     |
| `chasm show path <path>`         | Show sessions for a project path                 |
| `chasm find workspace <pattern>` | Search workspaces by name                        |
| `chasm find session <pattern>`   | Search sessions by content                       |

### Data Management

| Command                        | Description                               |
| ------------------------------ | ----------------------------------------- |
| `chasm harvest scan`           | Scan for available providers and sessions |
| `chasm harvest run`            | Collect sessions from all providers       |
| `chasm harvest status`         | Show harvest database status              |
| `chasm merge workspace <name>` | Merge sessions from a workspace           |
| `chasm export session <id>`    | Export session to file                    |
| `chasm import <file>`          | Import sessions from file                 |

### Session Recovery

| Command                            | Description                                    |
| ---------------------------------- | ---------------------------------------------- |
| `chasm detect orphaned <path>`     | Find orphaned sessions in old workspace hashes |
| `chasm detect orphaned -r <path>`  | Recover orphaned sessions to active workspace  |
| `chasm register all --path <path>` | Register on-disk sessions in VS Code's index   |

#### Recovering Lost Chat History

When VS Code creates a new workspace hash (e.g., after reinstall or path change), your chat sessions may become "orphaned" in the old workspace folder. Use these commands to recover them:

```bash
# 1. Scan for orphaned sessions
chasm detect orphaned /path/to/project

# 2. Recover them (copy to active workspace)
chasm detect orphaned --recover /path/to/project

# 3. Register in VS Code's database
chasm register all --force --path /path/to/project

# 4. Reload VS Code (Ctrl+Shift+P -> Developer: Reload Window)
```

### Server

| Command           | Description               |
| ----------------- | ------------------------- |
| `chasm api serve` | Start the REST API server |
| `chasm mcp serve` | Start the MCP tool server |

### Options

```bash
chasm --help          # Show all commands
chasm <cmd> --help    # Show help for a specific command
chasm --version       # Show version
```

## 🔌 API Server

Start the REST API server for integration with web/mobile apps:

```bash
chasm api serve --host 0.0.0.0 --port 8787
```

### Endpoints

| Method | Endpoint                  | Description               |
| ------ | ------------------------- | ------------------------- |
| GET    | `/api/health`             | Health check              |
| GET    | `/api/workspaces`         | List workspaces           |
| GET    | `/api/workspaces/:id`     | Get workspace details     |
| GET    | `/api/sessions`           | List sessions             |
| GET    | `/api/sessions/:id`       | Get session with messages |
| GET    | `/api/sessions/search?q=` | Search sessions           |
| GET    | `/api/stats`              | Database statistics       |
| GET    | `/api/providers`          | List supported providers  |
| GET    | `/api/agents`             | List available agents     |

### Example

```bash
curl http://localhost:8787/api/stats
```

```json
{
  "success": true,
  "data": {
    "totalSessions": 330,
    "totalMessages": 19068,
    "totalWorkspaces": 138,
    "totalToolInvocations": 122712
  }
}
```

## 🤖 MCP Integration

Chasm provides [Model Context Protocol](https://modelcontextprotocol.io/) tools for AI agent integration:

```bash
chasm mcp serve
```

### Available Tools

- `chasm_list_workspaces` - List all workspaces
- `chasm_list_sessions` - List sessions in a workspace
- `chasm_get_session` - Get full session content
- `chasm_search_sessions` - Search across all sessions
- `chasm_get_stats` - Get database statistics

## 🤖 Agency (Agent Development Kit)

Chasm includes an integrated agent development kit for building AI agents:

```bash
# List available agents
chasm agency list

# Run an agent with a prompt
chasm agency run --agent researcher "What are the latest trends in AI?"

# Create a custom agent
chasm agency create my-agent --role coder --instruction "You are a helpful coding assistant"

# List available tools and templates
chasm agency tools
chasm agency templates
```

### Agent Roles

- `coordinator` - Orchestrates other agents
- `researcher` - Information gathering and analysis
- `coder` - Code generation and modification
- `reviewer` - Code review and quality assurance
- `executor` - Task execution
- `writer` - Documentation and content
- `tester` - Testing and validation
- `custom` - User-defined role

## 🗃️ Supported Providers

### Editor-based
- ✅ GitHub Copilot (VS Code)
- ✅ Cursor
- ✅ Windsurf
- ✅ Continue.dev

### Local LLMs
- ✅ Ollama
- ✅ LM Studio
- ✅ GPT4All
- ✅ LocalAI
- ✅ llama.cpp / llamafile

### Cloud APIs
- ✅ OpenAI / ChatGPT
- ✅ Anthropic / Claude
- ✅ Google / Gemini
- ✅ Perplexity

## 📁 Database

Chasm stores all data in a local SQLite database:

| Platform | Location                                   |
| -------- | ------------------------------------------ |
| Windows  | `%LOCALAPPDATA%\csm\csm.db`                |
| macOS    | `~/Library/Application Support/csm/csm.db` |
| Linux    | `~/.local/share/csm/csm.db`                |

### Schema

```
Workspaces ──< Sessions ──< Messages
                  │
                  ├──< Checkpoints
                  └──< ShareLinks
```

## 🛠️ Development

### Prerequisites

- Rust 1.75+
- Git

### Building

```bash
git clone https://github.com/nervosys/chasm.git
cd chasm
cargo build --release
```

### Running tests

```bash
cargo test
```

### Running the TUI

```bash
cargo run -- tui
```

## 📜 License

Licensed under either of:

- Apache License, Version 2.0 ([LICENSE](LICENSE) or http://www.apache.org/licenses/LICENSE-2.0)
- MIT license ([LICENSE](LICENSE) or http://opensource.org/licenses/MIT)

at your option.

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md).

## 🔒 Security

For security issues, please see our [Security Policy](SECURITY.md).

## 📞 Support

- 📖 [Documentation](https://docs.rs/chasm)
- 💬 [GitHub Discussions](https://github.com/nervosys/chasm/discussions)
- 🐛 [Issue Tracker](https://github.com/nervosys/chasm/issues)

---

<p align="center">
  Made with ❤️ by <a href="https://nervosys.ai">Nervosys</a>
</p>
