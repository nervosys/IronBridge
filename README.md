# Chat System Manager (chasm|csm) 📚

A fast, cross-platform CLI tool for managing chat sessions across workspaces and LLM providers.

## Features

- **Workspace Discovery** - Find and list all VS Code workspaces with chat sessions
- **ALL SESSIONS Support** - Access VS Code's workspace-independent "ALL SESSIONS" window
- **History Merging** - Merge chat histories from multiple workspaces chronologically
- **Session Management** - Import, export, and move chat sessions between workspaces
- **Harvest System** - Unified database for collecting sessions from all providers
- **Share Link Import** - Import shared chats from ChatGPT, Claude, Gemini, Perplexity, and more
- **Full-Text Search** - Search across all harvested messages with FTS5
- **Session Checkpoints** - Version snapshots for session tracking
- **Git Integration** - Version control your chat histories
- **Migration Tools** - Move chat histories to new machines
- **Interactive TUI** - Browse workspaces and sessions with a color-coded terminal UI
- **Multi-Provider Support** - Local LLMs, cloud APIs, and web-based chat providers

## Supported Providers

### Local LLM Providers

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

### Cloud/Web Providers (via Share Links & Browser Auth)

| Provider     | Share Links | Browser Auth | Endpoint                        |
| ------------ | :---------: | :----------: | ------------------------------- |
| ChatGPT      |      ✅      |      ✅       | `https://chat.openai.com`       |
| Claude       |      ✅      |      ✅       | `https://claude.ai`             |
| Gemini       |      ✅      |      ✅       | `https://gemini.google.com`     |
| Perplexity   |      ✅      |      ✅       | `https://www.perplexity.ai`     |
| DeepSeek     |      ✅      |      ❌       | `https://chat.deepseek.com`     |
| M365 Copilot |      ❌      |      ✅       | `https://copilot.microsoft.com` |
| HuggingChat  |      ❌      |      ✅       | `https://huggingface.co/chat`   |
| Mistral      |      ❌      |      ✅       | `https://chat.mistral.ai`       |
| Groq         |      ❌      |      ✅       | `https://groq.com`              |
| Cohere Coral |      ❌      |      ✅       | `https://coral.cohere.com`      |
| Phind        |      ❌      |      ✅       | `https://www.phind.com`         |
| You.com      |      ❌      |      ✅       | `https://you.com/chat`          |
| Pi           |      ❌      |      ✅       | `https://pi.ai`                 |
| Character.AI |      ❌      |      ✅       | `https://character.ai`          |

## Installation

### From Source (Rust)

```bash
cd csm-rust
cargo build --release
# or
cargo install --path .
```

The `csm` (Linux, MacOS) or `csm.exe` (Windows) binary will be in the `csm-rust/target/release/` or the `$HOME/.cargo/bin/` directory.

### Add to PATH (unnecessary if installed to `$HOME/.cargo/bin`)

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

Output includes workspace-bound sessions and VS Code's "ALL SESSIONS" (workspace-independent sessions):

```text
Total workspaces: 137
Empty window sessions (ALL SESSIONS): 3
```

### List All Sessions

```bash
csm list sessions
```

Sessions from VS Code's "ALL SESSIONS" window appear with `(ALL SESSIONS)` as the project path.

### Find a Workspace

```bash
# Find workspace by name (defaults to current directory)
csm find workspace
csm find workspace my_project
```

### View Chat History

```bash
# Show chat history timeline (defaults to current directory)
csm show path
csm show path /path/to/project
```

### Recover Historical Sessions

When you've moved a project or reopened it in a new location, your old chat sessions may be scattered across multiple VS Code workspaces. Here's how to find and consolidate them:

```bash
# 1. Find all workspaces matching your project name
csm find workspace my_project

# Output shows all matching workspaces with session paths:
# ┌──────────────────┬─────────────────────────────────┬──────────┐
# │ Hash             │ Project Path                    │ Sessions │
# │ a5dafce48e3e...  │ C:\old\path\my_project          │ 5        │
# │ b7c2f1a89d4e...  │ D:\new\location\my_project      │ 3        │
# └──────────────────┴─────────────────────────────────┴──────────┘
# Sessions for C:\old\path\my_project:
#   C:\Users\...\workspaceStorage\a5dafce48e3e...\chatSessions\abc123.json
#   ...

# 2. Merge all sessions from matching workspaces into one unified session
csm merge workspace my_project --title "My Project - Complete History"

# Or merge from multiple specific workspace patterns
csm merge workspaces my_project old_project --title "Combined History"
```

### Merge Workspace Histories

When you've moved a project and want to recover old chat conversations:

```bash
# Fetch sessions from old workspaces into current
csm fetch path /path/to/project

# Or merge all into a single unified session
csm merge path /path/to/project --force
```

> **💡 Tip: Use `--force` when VS Code is running**
>
> By default, CSM skips writing to VS Code's session index when VS Code is running. Use `--force` to register sessions immediately:
>
> ```bash
> csm merge path /path/to/project --force
> ```
>
> With `--force`, merged sessions appear in VS Code's "Show Chats..." dropdown immediately, no restart required. Just refresh the chat panel or switch tabs.

> **⚠️ Note: Some applications may require a restart**
>
> While VS Code supports concurrent SQLite writes (WAL mode), other applications may cache session data in memory. If sessions don't appear after using `--force`, try restarting the application.

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

### Register Sessions in VS Code's Index

VS Code only shows chat sessions that are registered in its internal index (`chat.ChatSessionStore.index` in `state.vscdb`). Sessions can exist on disk but be invisible if they're not indexed. Use the `register` commands to make orphaned sessions visible:

```bash
# List sessions on disk that aren't in VS Code's index
csm list orphaned --path /path/to/project

# Register all sessions from a workspace into the index
csm register all --path /path/to/project --force

# Merge all sessions into one and register it
csm register all --merge --force

# Register specific sessions by ID (supports multiple IDs)
csm register session abc123-def456 789xyz-012abc --force

# Register sessions by title (partial match, case-insensitive)
csm register session --title "Project History" "Bug Fix" --force
```

#### Register Command Options

| Command                                | Description                                          |
| -------------------------------------- | ---------------------------------------------------- |
| `csm list orphaned [--path <p>]`       | List sessions on disk that aren't in VS Code's index |
| `csm register all [--force]`           | Register all sessions from the workspace             |
| `csm register all --merge [--force]`   | Merge all sessions into one, then register           |
| `csm register session <id1> <id2> ...` | Register specific sessions by ID                     |
| `csm register session -t <title1> ...` | Register sessions matching titles (partial match)    |

> **💡 Why sessions become orphaned:**
>
> - Sessions imported from other machines or backups
> - Sessions recovered from old workspace directories
> - Sessions created by third-party tools
> - Corrupted index after VS Code crash
>
> After registering, sessions appear immediately in VS Code's "Show Chats..." dropdown.

### Export/Import Sessions

```bash
# Export sessions to a directory
csm export path /path/to/backup --path /path/to/project

# Import sessions from a backup
csm import path /path/to/backup --path /path/to/project
```

### Cross-Provider Merging

Merge chat sessions from multiple LLM providers into a unified history:

```bash
# Merge from a single provider
csm merge provider copilot --title "Copilot Sessions"

# Merge from multiple providers
csm merge providers copilot cursor ollama --title "Combined History"

# Merge ALL sessions from ALL available providers
csm merge all --title "Complete AI History"

# Filter by workspace name when merging across providers
csm merge all --workspace "my_project" --title "Project Sessions"
```

### Git Integration for Chat Sessions

Track chat sessions together with associated file changes:

```bash
# Initialize git tracking for chat sessions
csm git init /path/to/project

# Track chat sessions with file changes in a single commit
csm git track /path/to/project --message "Feature: Add authentication" --all

# View chat session commit history
csm git log /path/to/project --sessions-only

# Diff chat sessions between commits
csm git diff /path/to/project --from HEAD~5 --to HEAD --with-files

# Create a tagged snapshot
csm git snapshot /path/to/project --tag v1.0.0
```

### Auto-Detection

Automatically detect workspace, providers, and session information:

```bash
# Full detection report for current directory
csm detect

# Detect with verbose output (shows all providers)
csm detect all --verbose

# Detect workspace for a specific path
csm detect workspace /path/to/project

# Detect available providers and their session counts
csm detect providers

# Only show providers that have sessions
csm detect providers --with-sessions

# Detect which provider owns a specific session
csm detect session my-session-id
```

### Interactive TUI

```bash
csm run tui
```

Navigate with arrow keys or `j`/`k`, press `Enter` to drill down, `?` for help.

### Harvest System

Collect and unify chat sessions from all providers into a single searchable database:

```bash
# Initialize the harvest database
csm harvest init

# Scan for available local providers and sessions
csm harvest scan

# Scan for web-based LLM providers (ChatGPT, Claude, Gemini, etc.)
csm harvest scan --web

# Collect all sessions into the database
csm harvest run

# Check harvest status
csm harvest status

# Search across all sessions (full-text search)
csm harvest search "authentication"

# Search with provider filter
csm harvest search "api" --provider chatgpt
```

#### Import Shared Chat URLs

Import chat sessions from share links (ChatGPT, Claude, Gemini, Perplexity, DeepSeek):

```bash
# Register a share link for import
csm harvest share "https://chatgpt.com/share/abc123"
csm harvest share "https://claude.ai/share/abc123"

# List pending and imported links
csm harvest shares
csm harvest shares --status imported
```

#### Session Checkpoints

Create version snapshots of sessions for tracking changes:

```bash
# Create a checkpoint
csm harvest checkpoint my-session-id --name "Before refactor"

# List checkpoints
csm harvest checkpoints my-session-id

# Restore to a previous checkpoint
csm harvest restore my-session-id checkpoint-id
```

#### Harvest Git Tracking

Version control for the harvest database:

```bash
# Initialize git tracking for the harvest database
csm harvest git init

# Commit current state of the harvest database
csm harvest git commit -m "Added new sessions"

# View commit history
csm harvest git log

# Show changes since last commit
csm harvest git diff

# Restore to a previous commit
csm harvest git restore <commit-hash>
```

## All Commands

| Command                                   | Description                                      |
| ----------------------------------------- | ------------------------------------------------ |
| `csm list workspaces`                     | List all VS Code workspaces + ALL SESSIONS count |
| `csm list sessions`                       | List all chat sessions (incl. ALL SESSIONS)      |
| `csm list path [<path>]`                  | List sessions for a project path                 |
| `csm list orphaned [--path <p>]`          | List sessions on disk but not in VS Code's index |
| `csm find workspace <pattern>`            | Find workspaces matching pattern                 |
| `csm find session <pattern>`              | Find sessions by content                         |
| `csm find path <pattern>`                 | Find sessions in a path                          |
| `csm show workspace <name>`               | Show workspace details                           |
| `csm show session <id>`                   | Show session details                             |
| `csm show path [<path>]`                  | Show chat history timeline                       |
| `csm fetch workspace <name>`              | Fetch sessions from workspace                    |
| `csm fetch session <id1> <id2> ...`       | Fetch specific sessions                          |
| `csm fetch path [<path>]`                 | Fetch sessions from old workspaces               |
| `csm merge workspace <name>`              | Merge sessions by workspace name                 |
| `csm merge workspaces <n1> <n2> ...`      | Merge from multiple workspace names              |
| `csm merge sessions <id1> <id2> ...`      | Merge specific sessions by ID                    |
| `csm merge path [<path>]`                 | Merge all sessions into one                      |
| `csm merge provider <name>`               | Merge sessions from a provider                   |
| `csm merge providers <p1> <p2> ...`       | Merge from multiple providers                    |
| `csm merge all`                           | Merge all sessions from all providers            |
| `csm export workspace <dest> <hash>`      | Export sessions from workspace                   |
| `csm export sessions <dest> <ids...>`     | Export specific sessions                         |
| `csm export path <dest> [<path>]`         | Export sessions from path                        |
| `csm import workspace <src> <hash>`       | Import sessions into workspace                   |
| `csm import sessions <files...>`          | Import specific session files                    |
| `csm import path <src> [<target>]`        | Import sessions into path                        |
| `csm move workspace <src_hash> <target>`  | Move all sessions from workspace                 |
| `csm move sessions <ids...> <target>`     | Move specific sessions                           |
| `csm move path <src> <target>`            | Move sessions between paths                      |
| `csm git config --name <n> --email <e>`   | Configure git user                               |
| `csm git init <path>`                     | Initialize git for chat sessions                 |
| `csm git add <path>`                      | Stage chat session changes                       |
| `csm git status <path>`                   | Show git status of sessions                      |
| `csm git snapshot <path>`                 | Create a tagged snapshot                         |
| `csm git track <path>`                    | Track sessions with file changes                 |
| `csm git log <path>`                      | Show chat session commit history                 |
| `csm git diff <path>`                     | Diff sessions between commits                    |
| `csm detect`                              | Auto-detect workspace and providers              |
| `csm detect workspace [<path>]`           | Detect workspace for a path                      |
| `csm detect providers`                    | Detect available providers                       |
| `csm detect session <id>`                 | Detect which provider owns a session             |
| `csm detect all [<path>]`                 | Full detection report                            |
| `csm register all [--merge] [--force]`    | Register (or merge) all sessions in index        |
| `csm register session <ids...> [--force]` | Register specific sessions by ID                 |
| `csm register session -t <titles...>`     | Register sessions matching titles                |
| `csm harvest init`                        | Initialize harvest database                      |
| `csm harvest scan`                        | Scan for local providers and sessions            |
| `csm harvest scan --web`                  | Scan for web LLM providers (ChatGPT, etc.)       |
| `csm harvest run`                         | Collect sessions from all providers              |
| `csm harvest status`                      | Show harvest database statistics                 |
| `csm harvest list`                        | List harvested sessions                          |
| `csm harvest export`                      | Export sessions from harvest DB                  |
| `csm harvest share <url>`                 | Import a shared chat URL                         |
| `csm harvest shares`                      | List pending/imported share links                |
| `csm harvest checkpoint <session>`        | Create session checkpoint                        |
| `csm harvest checkpoints <session>`       | List session checkpoints                         |
| `csm harvest restore <session> <cp>`      | Restore session to checkpoint                    |
| `csm harvest search <query>`              | Full-text search across sessions                 |
| `csm harvest git init`                    | Initialize git tracking for harvest DB           |
| `csm harvest git commit`                  | Commit changes to the harvest DB                 |
| `csm harvest git log`                     | Show git log for harvest DB                      |
| `csm harvest git diff`                    | Show changes to harvest DB                       |
| `csm harvest git restore`                 | Restore harvest DB from a commit                 |
| `csm migration create <output>`           | Create migration package                         |
| `csm migration restore <package>`         | Restore from migration                           |
| `csm run tui`                             | Launch interactive TUI                           |
| `csm provider list`                       | List available LLM providers                     |
| `csm provider info <name>`                | Show provider details                            |
| `csm provider config <name>`              | Configure a provider                             |
| `csm provider import --from <name>`       | Import sessions from provider                    |
| `csm provider test <name>`                | Test provider connection                         |

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

### Local Providers

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

### Web/Cloud Providers

| Provider     | Import Method        | Endpoint                        |
| ------------ | -------------------- | ------------------------------- |
| ChatGPT      | Share Links, Browser | `https://chat.openai.com`       |
| Claude       | Share Links, Browser | `https://claude.ai`             |
| Gemini       | Share Links, Browser | `https://gemini.google.com`     |
| Perplexity   | Share Links, Browser | `https://www.perplexity.ai`     |
| DeepSeek     | Share Links          | `https://chat.deepseek.com`     |
| M365 Copilot | Browser Auth         | `https://copilot.microsoft.com` |
| HuggingChat  | Browser Auth         | `https://huggingface.co/chat`   |
| Mistral      | Browser Auth         | `https://chat.mistral.ai`       |
| Groq         | Browser Auth         | `https://groq.com`              |

### Discover Available Providers

```bash
# Auto-detect installed local providers
csm provider list

# Scan for web providers with browser auth
csm harvest scan --web
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

Apache 2.0
