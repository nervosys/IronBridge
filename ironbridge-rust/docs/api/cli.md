# CLI Reference

Complete reference for every `ironbridge` command, organized by function.

## Global Options

```
ironbridge [OPTIONS] <COMMAND>

Options:
  --verbose, -v       Enable verbose output
  --quiet, -q         Suppress non-essential output
  --help, -h          Show help
  --version, -V       Show version
```

---

## Session Recovery

Commands for recovering lost or orphaned chat sessions.

| Command | Description |
|---|---|
| `ironbridge fetch path <path>` | Recover sessions for a project path |
| `ironbridge detect orphaned <path>` | Find orphaned sessions in old workspace hashes |
| `ironbridge detect orphaned -r <path>` | Recover orphaned sessions to active workspace |
| `ironbridge detect all <path>` | Full workspace detection and analysis |
| `ironbridge register all --path <path>` | Register on-disk sessions in VS Code's index |
| `ironbridge recover extract <path>` | Extract sessions from VS Code recording state |
| `ironbridge recover upgrade <path>` | Upgrade session format from JSON to JSONL |

### Examples

```bash
# Full recovery workflow
ironbridge detect orphaned /path/to/project
ironbridge detect orphaned --recover /path/to/project
ironbridge register all --force --path /path/to/project

# Quick fetch
ironbridge fetch path /path/to/project --verbose
```

---

## Listing & Discovery

Commands for browsing workspaces and sessions.

| Command | Description |
|---|---|
| `ironbridge list workspaces` | List all discovered workspaces |
| `ironbridge list sessions` | List sessions (optionally filtered) |
| `ironbridge list orphaned` | List unregistered sessions on disk |
| `ironbridge find workspace <pattern>` | Search workspaces by name |
| `ironbridge find session <pattern>` | Search sessions by content |

### Examples

```bash
# List all workspaces
ironbridge list workspaces

# Filter sessions by workspace
ironbridge list sessions --workspace abc123

# Search by pattern
ironbridge find workspace "my-project"
ironbridge find session "authentication"
```

---

## Viewing Sessions

Commands for inspecting session content.

| Command | Description |
|---|---|
| `ironbridge show session <id>` | Display full session content |
| `ironbridge show path <path>` | Show sessions for a project path |

### Examples

```bash
# View a specific session
ironbridge show session abc123-def4-5678

# View sessions for a project
ironbridge show path /path/to/project
```

---

## Export & Import

Commands for moving data in and out of IronBridge.

| Command | Description |
|---|---|
| `ironbridge export session <id>` | Export session to file |
| `ironbridge export path <dest> <path>` | Export sessions for a project |
| `ironbridge export batch <dest> <paths...>` | Batch export from multiple projects |
| `ironbridge import <file>` | Import sessions from file |

### Supported Formats

| Format | Extension | Description |
|---|---|---|
| JSON | `.json` | Full session structure |
| JSONL | `.jsonl` | Streaming-friendly line-delimited JSON |
| Markdown | `.md` | Human-readable conversation format |

### Examples

```bash
# Export to markdown
ironbridge export session abc123 --format markdown --output chat.md

# Batch export
ironbridge export batch ./backup /project1 /project2 /project3

# Import
ironbridge import ./backup/session.json
```

---

## Merge & Sync

Commands for combining and synchronizing sessions.

| Command | Description |
|---|---|
| `ironbridge merge workspace <name>` | Merge sessions from a workspace |
| `ironbridge sync --pull` | Pull sessions from workspaces to database |
| `ironbridge sync --push` | Push sessions from database to workspaces |

### Examples

```bash
# Sync all sessions into the database
ironbridge sync --pull

# Push database sessions back to workspaces
ironbridge sync --push

# Merge a specific workspace
ironbridge merge workspace my-project
```

---

## Harvesting

Commands for scanning, collecting, and searching across provider data.

| Command | Description |
|---|---|
| `ironbridge harvest scan` | Scan for available providers and sessions |
| `ironbridge harvest run` | Collect sessions from all providers |
| `ironbridge harvest run --providers <list>` | Collect from specific providers |
| `ironbridge harvest status` | Show harvest database status |
| `ironbridge harvest search <query>` | Full-text search across harvested sessions |

### Examples

```bash
# Scan what's available
ironbridge harvest scan

# Harvest everything
ironbridge harvest run

# Harvest from specific providers
ironbridge harvest run --providers copilot,cursor

# Search
ironbridge harvest search "react component"
ironbridge harvest search "authentication" --limit 10
```

---

## Agency (Agent Development Kit)

Commands for building and running AI agents.

| Command | Description |
|---|---|
| `ironbridge agency list` | List available agents and roles |
| `ironbridge agency list --verbose` | Detailed agent listing |
| `ironbridge agency info <agent>` | Get detailed agent information |
| `ironbridge agency run --agent <name> <prompt>` | Run an agent with a prompt |
| `ironbridge agency run --orchestration <mode> <prompt>` | Multi-agent orchestration |
| `ironbridge agency create <name>` | Create a custom agent |
| `ironbridge agency tools` | List available tools |
| `ironbridge agency templates` | List agent templates |
| `ironbridge agency modes` | List orchestration modes |

### Agent Roles

| Role | Icon | Description |
|---|---|---|
| `coordinator` | `[C]` | Manages and delegates tasks |
| `researcher` | `[R]` | Gathers information and analyzes data |
| `coder` | `[D]` | Writes and modifies code |
| `reviewer` | `[V]` | Reviews code and provides feedback |
| `executor` | `[E]` | Executes commands and tools |
| `writer` | `[W]` | Creates documentation and content |
| `tester` | `[T]` | Writes and runs tests |
| `analyst` | `[A]` | Data analysis and insights |
| `household` | `[H]` | Home automation and management |
| `business` | `[B]` | Business process automation |
| `custom` | `[X]` | User-defined agent |

### Orchestration Modes

| Mode | Pattern | Description |
|---|---|---|
| `single` | `[1]` | Traditional single-agent response |
| `sequential` | `[>]` | Agents execute one after another |
| `parallel` | `[‖]` | Multiple agents work simultaneously |
| `loop` | `[O]` | Agent repeats until condition met |
| `hierarchical` | `[H]` | Lead agent delegates to sub-agents |
| `swarm` | `[S]` | Multiple agents collaborate with a coordinator |

### Examples

```bash
# Single agent
ironbridge agency run --agent researcher "Latest trends in AI safety"
ironbridge agency run --agent coder --model gpt-4o "Write a REST API in Rust"

# Multi-agent
ironbridge agency run --orchestration sequential "Build and test a web scraper"
ironbridge agency run --orchestration parallel "Research AI, blockchain, and quantum"
ironbridge agency run --orchestration swarm "Design a microservices architecture"

# Custom agent
ironbridge agency create my-rust-expert --role coder \
  --instruction "You are a Rust expert"
```

---

## Run (Provider Chat)

Interactive chat commands that route to specific AI providers.

| Command | Description |
|---|---|
| `ironbridge run ollama` | Chat with local Ollama |
| `ironbridge run claude` | Chat with Claude (Anthropic) |
| `ironbridge run chatgpt` | Chat with ChatGPT (OpenAI) |
| `ironbridge run gemini` | Chat with Gemini (Google) |
| `ironbridge run perplexity` | Chat with Perplexity |
| `ironbridge run lmstudio` | Chat with LM Studio |
| `ironbridge run gpt4all` | Chat with GPT4All |
| `ironbridge run localai` | Chat with LocalAI |
| `ironbridge run llamafile` | Chat with llamafile |

### Examples

```bash
# Local chat with Ollama
ironbridge run ollama --model mistral

# Cloud chat
ironbridge run claude --model claude-sonnet-4-20250514
ironbridge run chatgpt --model gpt-4o
```

---

## Analysis

Extract topics, sentiment and key points from a session.

| Command | Description |
|---|---|
| `ironbridge analyze <file>` | Analyze a session file |
| `ironbridge analyze <file> --json` | Emit the analysis as JSON |
| `ironbridge analyze <file> --require-model` | Fail rather than fall back to heuristics |

Analysis uses a language model when `OPENAI_API_KEY` is set, and offline
heuristics otherwise. **The output always names which one ran.** The
heuristics recognise only a couple of languages and write no summary, so a
thin-looking result usually means no model was configured rather than a
featureless conversation. Use `--require-model` in scripts that treat the
summary as meaningful.

### Environment

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Enables model-backed analysis. Blank counts as unset. |
| `OPENAI_BASE_URL` | Any OpenAI-compatible endpoint, including a local one. |
| `IRONBRIDGE_ANALYSIS_MODEL` | Model name; defaults to `gpt-4o-mini`. |

### Examples

```bash
# Offline heuristics
ironbridge analyze session.json

# Against a local Ollama server
export OPENAI_API_KEY=local          # local servers ignore the value
export OPENAI_BASE_URL=http://127.0.0.1:11434/v1
export IRONBRIDGE_ANALYSIS_MODEL=gemma4:latest
ironbridge analyze session.json --require-model

# Machine-readable, for a pipeline
ironbridge analyze session.json --json | jq .topics
```

---

## Server

Commands for running IronBridge as a service.

| Command | Description |
|---|---|
| `ironbridge api serve` | Start the REST API server |
| `ironbridge api serve --port <port>` | Start on a specific port |
| `ironbridge api serve --host <host>` | Bind to a specific host |
| `ironbridge mcp serve` | Start the MCP tool server |

### Examples

```bash
# Start API server
ironbridge api serve --host 0.0.0.0 --port 8787

# Start MCP server
ironbridge mcp serve
```

---

## Interactive Tools

| Command | Description |
|---|---|
| `ironbridge tui` | Launch the terminal UI browser |
| `ironbridge browse` | Open interactive session browser |

---

## Git Integration

| Command | Description |
|---|---|
| `ironbridge git init <path>` | Initialize git versioning for sessions |
| `ironbridge git commit <path>` | Commit current session state |
| `ironbridge git log <path>` | View session version history |
| `ironbridge git diff <path>` | Compare session versions |

### Examples

```bash
# Version your chat sessions with git
ironbridge git init /path/to/project
ironbridge git commit /path/to/project -m "After auth implementation"
ironbridge git log /path/to/project
```

---

## Watch (File-System Monitor)

Watch agent session directories for changes and auto-harvest new sessions.

| Command | Description |
|---|---|
| `ironbridge watch` | Watch all known agent directories for changes |
| `ironbridge watch --agent <name>` | Watch a specific agent's session directory |
| `ironbridge watch --path <dir>` | Watch a custom directory path |
| `ironbridge watch --no-harvest` | Detect changes without harvesting (dry-run) |

### Options

| Flag | Default | Description |
|---|---|---|
| `--agent, -a` | — | Watch a specific agent (e.g., `claude`, `gemini`, `codex`) |
| `--path, -p` | — | Watch a custom path instead of agent directories |
| `--debounce, -d` | `3` | Debounce interval in seconds before harvesting |
| `--no-harvest` | `false` | Detect changes without harvesting |
| `--verbose, -v` | `false` | Show detailed file change events |

### Examples

```bash
# Watch all agent directories
ironbridge watch

# Watch only Claude Code sessions
ironbridge watch --agent claude

# Watch a custom directory with verbose output
ironbridge watch --path /path/to/sessions --verbose

# Dry-run: see changes without harvesting
ironbridge watch --no-harvest --debounce 5
```

---

## Provider Management

Commands for managing LLM provider configuration and connectivity.

| Command | Description |
|---|---|
| `ironbridge provider list` | List all discovered LLM providers |
| `ironbridge provider info <name>` | Show detailed info about a provider |
| `ironbridge provider config <name>` | Configure a provider's settings |
| `ironbridge provider test <name>` | Test connection to a provider |
| `ironbridge provider import --from <name>` | Import sessions from another provider |

### Configuration Options

```bash
ironbridge provider config ollama \
  --endpoint http://localhost:11434 \
  --model mistral \
  --enabled true

ironbridge provider config openai \
  --api-key sk-... \
  --model gpt-4o
```

### Examples

```bash
# List all providers
ironbridge provider list

# Check a provider
ironbridge provider info ollama
ironbridge provider test ollama

# Import sessions from Cursor into current project
ironbridge provider import --from cursor --path .
```

---

## Shell Completions

Generate shell completions for your preferred shell.

| Command | Description |
|---|---|
| `ironbridge completions bash` | Generate Bash completions |
| `ironbridge completions zsh` | Generate Zsh completions |
| `ironbridge completions fish` | Generate Fish completions |
| `ironbridge completions powershell` | Generate PowerShell completions |
| `ironbridge completions elvish` | Generate Elvish completions |

### Installation

```bash
# Bash (add to ~/.bashrc)
ironbridge completions bash > ~/.local/share/bash-completion/completions/ironbridge

# Zsh (add to fpath)
ironbridge completions zsh > ~/.zfunc/_ironbridge

# Fish
ironbridge completions fish > ~/.config/fish/completions/ironbridge.fish

# PowerShell (add to $PROFILE)
ironbridge completions powershell >> $PROFILE
```

---

## Doctor (Diagnostics)

Check system environment, providers, and configuration health.

| Command | Description |
|---|---|
| Command | Description |
|---|---|
| `ironbridge doctor` | Run basic environment checks, including the session-file scan |
| `ironbridge doctor --quick` | Skip the session-file scan — the slow part |
| `ironbridge doctor --full` | Run all checks including network connectivity |
| `ironbridge doctor --format json` | Output results as JSON |
| `ironbridge doctor --fix` | Attempt to fix detected issues automatically |

### How long it takes

Every check except the session scan finishes in well under a second;
`--quick` returns in about that. The session scan parses every session file in
every workspace, so its cost is proportional to your store — on a machine with
224 VS Code workspaces it takes several minutes even scanning workspaces in
parallel, because it is disk-bound rather than CPU-bound.

Results print as each check completes, and the scan shows a running
`scanning workspaces… n/total` counter, so a long run is visibly working
rather than apparently hung. `--format json` is the exception: it must emit a
single document, so it prints nothing until the end.

### Checks Performed

| Category | Check | Requires `--full` | Skipped by `--quick` |
|---|---|---|---|
| System | IronBridge version | No | No |
| System | Rust version | No | No |
| System | Operating system | No | No |
| Storage | VS Code session storage | No | No |
| Storage | Cursor session storage | No | No |
| Storage | Harvest database | No | No |
| Provider | Claude Code CLI | No | No |
| Provider | Codex CLI (OpenAI) | No | No |
| Provider | Gemini CLI (Google) | No | No |
| Tools | Git | No | No |
| Tools | SQLite | No | No |
| Network | Ollama server | Yes | No |
| Network | LM Studio server | Yes | No |
| Network | IronBridge API server | Yes | No |
| Sessions | Per-workspace session health | No | **Yes** |

### Examples

```bash
# Everything except the network checks
ironbridge doctor

# Environment only, no session scan -- sub-second
ironbridge doctor --quick

# Full check with network tests
ironbridge doctor --full

# JSON output for scripting
ironbridge doctor --format json

# Auto-fix issues
ironbridge doctor --fix
```

---

## Telemetry

| Command | Description |
|---|---|
| `ironbridge telemetry status` | Show status and installation ID (alias for `info`) |
| `ironbridge telemetry enable` | Allow local recording (alias for `opt-in`) |
| `ironbridge telemetry disable` | Refuse it (alias for `opt-out`) |
| `ironbridge telemetry record` | Write one record locally |
| `ironbridge telemetry query` | Read the records back |
| `ironbridge telemetry export` | Export records as JSON or CSV |
| `ironbridge telemetry config` | Set **your own** remote endpoint and API key |
| `ironbridge telemetry sync` | POST recorded rows to that endpoint |

!!! info "Privacy"
    IronBridge has no built-in analytics endpoint and sends nothing on its own.
    Nothing is recorded automatically either — `ironbridge telemetry record` is
    the only writer, with the data you pass it, into a local JSONL file.

    `sync` transmits, but only after you have supplied an endpoint and API
    key via `config`, and only to the destination you named. There is no
    Nervosys default. Separately, setting `OTEL_EXPORTER_OTLP_ENDPOINT`
    exports traces to that collector — also one you chose.
