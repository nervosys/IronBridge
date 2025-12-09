# Chat Session Manager (csm)

A fast, cross-platform CLI tool for managing chat sessions across workspaces and LLM providers.

## Features

- **Workspace Discovery** - Find and list all VS Code workspaces with chat sessions
- **History Merging** - Merge chat histories from multiple workspaces chronologically
- **Session Management** - Import, export, and move chat sessions between workspaces
- **Git Integration** - Version control your chat histories
- **Migration Tools** - Move chat histories to new machines
- **Interactive TUI** - Browse workspaces and sessions with a color-coded terminal UI
- **Multi-Provider Support** - Integrate with Cursor, Ollama, vLLM, Azure AI Foundry, and more

## Supported LLM Providers

| Provider         | Type         | Default Endpoint           |
| ---------------- | ------------ | -------------------------- |
| GitHub Copilot   | VS Code Chat | (built-in)                 |
| Cursor           | IDE Chat     | (file-based)               |
| Ollama           | Local LLM    | `http://localhost:11434`   |
| vLLM             | LLM Server   | `http://localhost:8000`    |
| Azure AI Foundry | Cloud/Local  | `http://localhost:5272`    |
| LM Studio        | Local LLM    | `http://localhost:1234/v1` |
| LocalAI          | Local LLM    | `http://localhost:8080/v1` |
| Text Gen WebUI   | Local LLM    | `http://localhost:5000/v1` |
| Jan.ai           | Local LLM    | `http://localhost:1337/v1` |
| GPT4All          | Local LLM    | `http://localhost:4891/v1` |
| Llamafile        | Local LLM    | `http://localhost:8080/v1` |

## Installation

### From Source (Rust)

```bash
cd csm-rust
cargo build --release
```

The binary will be at `csm-rust/target/release/csm` (or `csm.exe` on Windows).

### Add to PATH

```powershell
# Windows PowerShell
$env:PATH += ";${PWD}\csm-rust\target\release"
```

```bash
# Linux/macOS
export PATH="$PATH:$(pwd)/csm-rust/target/release"
```

## Quick Start

### List All Workspaces

```bash
csm list workspaces
```

### Find a Workspace

```bash
csm find workspace my_project
```

### View Chat History

```bash
csm history show /path/to/project
```

### Merge Workspace Histories

When you've moved a project and want to recover old chat conversations:

```bash
# Fetch sessions from old workspaces into current
csm history fetch /path/to/project

# Or merge all into a single unified session
csm history merge /path/to/project
```

> **⚠️ Important: Application Restart May Be Required**
>
> After running `csm merge` or other commands that modify chat session storage, you may need to restart the application for changes to appear.

#### Why is a restart needed?

Applications like VS Code and Cursor store chat session indexes in SQLite databases and cache them in memory. Even though CSM successfully writes to the database:

- The application holds locks on the database and uses its in-memory cached version
- A simple window reload only refreshes the UI, not the database cache
- Chat extensions only fully reload their session list on startup

The `--force` flag bypasses "application is running" warnings but cannot force an app to refresh its internal cache—only a full restart can do that.

#### Restart requirements by application

| Application       | Restart? | Notes                                         |
| ----------------- | :------: | --------------------------------------------- |
| VS Code / Copilot |  ✅ Yes   | SQLite + in-memory cache. Must fully quit.    |
| Cursor            |  ✅ Yes   | Same architecture as VS Code.                 |
| LM Studio         |  ✅ Yes   | Local file storage. Close before modifying.   |
| Jan.ai            |  ✅ Yes   | Local JSON threads. Close completely.         |
| GPT4All           |  ✅ Yes   | SQLite database. Close before modifying.      |
| Text Gen WebUI    | ⚠️ Maybe  | Depends on extensions. Restart if needed.     |
| Ollama            |   ❌ No   | Stateless API—CSM stores sessions separately. |
| vLLM              |   ❌ No   | Stateless API—no persistent chat state.       |
| LocalAI           |   ❌ No   | Stateless API.                                |
| Llamafile         |   ❌ No   | Stateless API.                                |

#### How to fully quit by platform

| Platform | How to Fully Quit                                                                             |
| -------- | --------------------------------------------------------------------------------------------- |
| Windows  | `File > Exit`, or check Task Manager for remaining processes (`Code.exe`, `Cursor.exe`, etc.) |
| macOS    | `Cmd+Q` (closing windows alone leaves the app running in the menu bar)                        |
| Linux    | `pkill code` / `pkill cursor`, or verify with `pgrep -l <app>`                                |

### Export/Import Sessions

```bash
# Export sessions to a directory
csm export path /path/to/backup --path /path/to/project

# Import sessions from a backup
csm import path /path/to/backup --path /path/to/project
```

### Interactive TUI

```bash
csm run tui
```

Navigate with arrow keys or `j`/`k`, press `Enter` to drill down, `?` for help.

## All Commands

| Command                                 | Description                        |
| --------------------------------------- | ---------------------------------- |
| `csm list workspaces`                   | List all VS Code workspaces        |
| `csm list sessions`                     | List chat sessions in a workspace  |
| `csm find workspace <pattern>`          | Find workspaces matching pattern   |
| `csm find session <pattern>`            | Find sessions by content           |
| `csm history show <path>`               | Show chat history timeline         |
| `csm history fetch <path>`              | Fetch sessions from old workspaces |
| `csm history merge <path>`              | Merge all sessions into one        |
| `csm export path <dest>`                | Export sessions by path            |
| `csm export hash <dest> <hash>`         | Export sessions by hash            |
| `csm import path <src>`                 | Import sessions by path            |
| `csm import hash <src> <hash>`          | Import sessions by hash            |
| `csm move <hash> <dest>`                | Move sessions between workspaces   |
| `csm git config --name <n> --email <e>` | Configure git user                 |
| `csm git init <path>`                   | Initialize git for chat sessions   |
| `csm git add <path>`                    | Stage chat session changes         |
| `csm git status <path>`                 | Show git status of sessions        |
| `csm git snapshot <path>`               | Create a tagged snapshot           |
| `csm create-migration <output>`         | Create migration package           |
| `csm restore-migration <package>`       | Restore from migration             |
| `csm run tui`                           | Launch interactive TUI             |
| `csm provider list`                     | List available LLM providers       |
| `csm provider info <name>`              | Show provider details              |
| `csm provider config <name>`            | Configure a provider               |
| `csm provider import <name>`            | Import sessions from provider      |
| `csm provider test <name>`              | Test provider connection           |

## Project Structure

```tree
copilot_chat_relink/
├── .github/
│   ├── workflows/     # CI/CD pipelines
│   │   ├── rust-ci.yml       # Build, test, lint
│   │   ├── scripts-ci.yml    # Shell script testing
│   │   ├── examples-ci.yml   # Example validation
│   │   └── release.yml       # Automated releases
│   └── dependabot.yml # Dependency updates
├── csm-rust/          # Rust implementation (main)
│   ├── src/           # Source code
│   ├── examples/      # Library and script examples
│   │   ├── *.rs       # Rust example files
│   │   └── scripts/   # Cross-platform shell scripts
│   ├── tests/         # Integration tests
│   └── README.md      # Rust-specific docs
├── vscode-extension/  # VS Code GUI extension
│   ├── src/           # TypeScript source
│   ├── out/           # Compiled JavaScript
│   └── README.md      # Extension docs
├── demo_project/      # Demo workspace for testing
├── scripts/           # Demo and example scripts
└── archive/           # Legacy Python implementation
```

## VS Code Extension

The VS Code extension provides a graphical interface for CSM:

### Install Extension

```bash
cd vscode-extension
npm install
npm run compile
```

Then press `F5` in VS Code to launch the extension in debug mode.

### Extension Features

- **Tree Views**: Browse workspaces and sessions in the sidebar
- **Webview Panels**: Rich HTML views for history and sessions
- **Command Palette**: Access all CSM commands via `Ctrl+Shift+P`
- **Context Menus**: Right-click actions on workspaces
- **TUI Launch**: Open the terminal TUI directly from VS Code

See [vscode-extension/README.md](vscode-extension/README.md) for full documentation.

## LLM Provider Integrations

CSM supports importing and managing chat sessions from multiple LLM providers:

### Supported Providers

| Provider         | Type      | Default Endpoint            |
| ---------------- | --------- | --------------------------- |
| VS Code Copilot  | Local DB  | `~/.config/github-copilot/` |
| Cursor           | Local DB  | `~/.cursor/`                |
| Ollama           | Local API | `http://localhost:11434`    |
| vLLM             | Local API | `http://localhost:8000`     |
| LM Studio        | Local API | `http://localhost:1234/v1`  |
| LocalAI          | Local API | `http://localhost:8080/v1`  |
| Text Gen WebUI   | Local API | `http://localhost:5000/v1`  |
| Jan.ai           | Local API | `http://localhost:1337/v1`  |
| GPT4All          | Local API | `http://localhost:4891/v1`  |
| Azure AI Foundry | Local API | `http://localhost:5272`     |

### Discover Available Providers

```bash
# Auto-detect installed providers
csm provider list
```

### Configure a Provider

```bash
# Configure Ollama with custom endpoint
csm provider config ollama --endpoint http://localhost:11434

# Configure vLLM server
csm provider config vllm --endpoint http://myserver:8000 --api-key sk-xxx
```

### Import Sessions from Provider

```bash
# Import sessions from Cursor
csm provider import cursor --path /path/to/workspace

# Import Ollama chat history
csm provider import ollama --model llama3.2
```

### Test Provider Connection

```bash
# Verify provider is accessible
csm provider test ollama
csm provider test vllm
```

### Provider Configuration File

Provider settings are stored in `~/.config/csm/config.json`:

```json
{
  "default_provider": "vscode-copilot",
  "providers": {
    "ollama": {
      "enabled": true,
      "endpoint": "http://localhost:11434"
    },
    "vllm": {
      "enabled": true,
      "endpoint": "http://localhost:8000",
      "api_key": "sk-xxx"
    }
  }
}
```

## CI/CD

This project uses GitHub Actions for continuous integration:

| Workflow          | Trigger         | Description                              |
| ----------------- | --------------- | ---------------------------------------- |
| `rust-ci.yml`     | Push/PR to main | Build, test, lint (clippy), format check |
| `scripts-ci.yml`  | Push/PR to main | PowerShell and Bash script testing       |
| `examples-ci.yml` | Push/PR to main | Rust examples validation                 |
| `release.yml`     | Tag `v*`        | Cross-platform binary releases           |

**Platforms tested:** Linux, Windows, macOS

**Dependency updates:** Managed by Dependabot (weekly)

## Development

```bash
cd csm-rust

# Build
cargo build

# Run tests
cargo test

# Run with debug output
RUST_LOG=debug cargo run -- ls
```

## License

MIT
