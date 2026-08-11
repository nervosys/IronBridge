# CLI Reference

Complete reference for every `chasm` command, organized by function.

## Global Options

```
chasm [OPTIONS] <COMMAND>

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
| `chasm fetch path <path>` | Recover sessions for a project path |
| `chasm detect orphaned <path>` | Find orphaned sessions in old workspace hashes |
| `chasm detect orphaned -r <path>` | Recover orphaned sessions to active workspace |
| `chasm detect all <path>` | Full workspace detection and analysis |
| `chasm register all --path <path>` | Register on-disk sessions in VS Code's index |
| `chasm recover extract <path>` | Extract sessions from VS Code recording state |
| `chasm recover upgrade <path>` | Upgrade session format from JSON to JSONL |

### Examples

```bash
# Full recovery workflow
chasm detect orphaned /path/to/project
chasm detect orphaned --recover /path/to/project
chasm register all --force --path /path/to/project

# Quick fetch
chasm fetch path /path/to/project --verbose
```

---

## Listing & Discovery

Commands for browsing workspaces and sessions.

| Command | Description |
|---|---|
| `chasm list workspaces` | List all discovered workspaces |
| `chasm list sessions` | List sessions (optionally filtered) |
| `chasm list orphaned` | List unregistered sessions on disk |
| `chasm find workspace <pattern>` | Search workspaces by name |
| `chasm find session <pattern>` | Search sessions by content |

### Examples

```bash
# List all workspaces
chasm list workspaces

# Filter sessions by workspace
chasm list sessions --workspace abc123

# Search by pattern
chasm find workspace "my-project"
chasm find session "authentication"
```

---

## Viewing Sessions

Commands for inspecting session content.

| Command | Description |
|---|---|
| `chasm show session <id>` | Display full session content |
| `chasm show path <path>` | Show sessions for a project path |

### Examples

```bash
# View a specific session
chasm show session abc123-def4-5678

# View sessions for a project
chasm show path /path/to/project
```

---

## Export & Import

Commands for moving data in and out of Chasm.

| Command | Description |
|---|---|
| `chasm export session <id>` | Export session to file |
| `chasm export path <dest> <path>` | Export sessions for a project |
| `chasm export batch <dest> <paths...>` | Batch export from multiple projects |
| `chasm import <file>` | Import sessions from file |

### Supported Formats

| Format | Extension | Description |
|---|---|---|
| JSON | `.json` | Full session structure |
| JSONL | `.jsonl` | Streaming-friendly line-delimited JSON |
| Markdown | `.md` | Human-readable conversation format |

### Examples

```bash
# Export to markdown
chasm export session abc123 --format markdown --output chat.md

# Batch export
chasm export batch ./backup /project1 /project2 /project3

# Import
chasm import ./backup/session.json
```

---

## Merge & Sync

Commands for combining and synchronizing sessions.

| Command | Description |
|---|---|
| `chasm merge workspace <name>` | Merge sessions from a workspace |
| `chasm sync --pull` | Pull sessions from workspaces to database |
| `chasm sync --push` | Push sessions from database to workspaces |

### Examples

```bash
# Sync all sessions into the database
chasm sync --pull

# Push database sessions back to workspaces
chasm sync --push

# Merge a specific workspace
chasm merge workspace my-project
```

---

## Harvesting

Commands for scanning, collecting, and searching across provider data.

| Command | Description |
|---|---|
| `chasm harvest scan` | Scan for available providers and sessions |
| `chasm harvest run` | Collect sessions from all providers |
| `chasm harvest run --providers <list>` | Collect from specific providers |
| `chasm harvest status` | Show harvest database status |
| `chasm harvest search <query>` | Full-text search across harvested sessions |

### Examples

```bash
# Scan what's available
chasm harvest scan

# Harvest everything
chasm harvest run

# Harvest from specific providers
chasm harvest run --providers copilot,cursor

# Search
chasm harvest search "react component"
chasm harvest search "authentication" --limit 10
```

---

## Agency (Agent Development Kit)

Commands for building and running AI agents.

| Command | Description |
|---|---|
| `chasm agency list` | List available agents and roles |
| `chasm agency list --verbose` | Detailed agent listing |
| `chasm agency info <agent>` | Get detailed agent information |
| `chasm agency run --agent <name> <prompt>` | Run an agent with a prompt |
| `chasm agency run --orchestration <mode> <prompt>` | Multi-agent orchestration |
| `chasm agency create <name>` | Create a custom agent |
| `chasm agency tools` | List available tools |
| `chasm agency templates` | List agent templates |
| `chasm agency modes` | List orchestration modes |

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
chasm agency run --agent researcher "Latest trends in AI safety"
chasm agency run --agent coder --model gpt-4o "Write a REST API in Rust"

# Multi-agent
chasm agency run --orchestration sequential "Build and test a web scraper"
chasm agency run --orchestration parallel "Research AI, blockchain, and quantum"
chasm agency run --orchestration swarm "Design a microservices architecture"

# Custom agent
chasm agency create my-rust-expert --role coder \
  --instruction "You are a Rust expert"
```

---

## Run (Provider Chat)

Interactive chat commands that route to specific AI providers.

| Command | Description |
|---|---|
| `chasm run ollama` | Chat with local Ollama |
| `chasm run claude` | Chat with Claude (Anthropic) |
| `chasm run chatgpt` | Chat with ChatGPT (OpenAI) |
| `chasm run gemini` | Chat with Gemini (Google) |
| `chasm run perplexity` | Chat with Perplexity |
| `chasm run lmstudio` | Chat with LM Studio |
| `chasm run gpt4all` | Chat with GPT4All |
| `chasm run localai` | Chat with LocalAI |
| `chasm run llamafile` | Chat with llamafile |

### Examples

```bash
# Local chat with Ollama
chasm run ollama --model mistral

# Cloud chat
chasm run claude --model claude-sonnet-4-20250514
chasm run chatgpt --model gpt-4o
```

---

## Analysis

Extract topics, sentiment and key points from a session.

| Command | Description |
|---|---|
| `chasm analyze <file>` | Analyze a session file |
| `chasm analyze <file> --json` | Emit the analysis as JSON |
| `chasm analyze <file> --require-model` | Fail rather than fall back to heuristics |

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
| `CHASM_ANALYSIS_MODEL` | Model name; defaults to `gpt-4o-mini`. |

### Examples

```bash
# Offline heuristics
chasm analyze session.json

# Against a local Ollama server
export OPENAI_API_KEY=local          # local servers ignore the value
export OPENAI_BASE_URL=http://127.0.0.1:11434/v1
export CHASM_ANALYSIS_MODEL=gemma4:latest
chasm analyze session.json --require-model

# Machine-readable, for a pipeline
chasm analyze session.json --json | jq .topics
```

---

## Server

Commands for running Chasm as a service.

| Command | Description |
|---|---|
| `chasm api serve` | Start the REST API server |
| `chasm api serve --port <port>` | Start on a specific port |
| `chasm api serve --host <host>` | Bind to a specific host |
| `chasm mcp serve` | Start the MCP tool server |

### Examples

```bash
# Start API server
chasm api serve --host 0.0.0.0 --port 8787

# Start MCP server
chasm mcp serve
```

---

## Interactive Tools

| Command | Description |
|---|---|
| `chasm tui` | Launch the terminal UI browser |
| `chasm browse` | Open interactive session browser |

---

## Git Integration

| Command | Description |
|---|---|
| `chasm git init <path>` | Initialize git versioning for sessions |
| `chasm git commit <path>` | Commit current session state |
| `chasm git log <path>` | View session version history |
| `chasm git diff <path>` | Compare session versions |

### Examples

```bash
# Version your chat sessions with git
chasm git init /path/to/project
chasm git commit /path/to/project -m "After auth implementation"
chasm git log /path/to/project
```

---

## Watch (File-System Monitor)

Watch agent session directories for changes and auto-harvest new sessions.

| Command | Description |
|---|---|
| `chasm watch` | Watch all known agent directories for changes |
| `chasm watch --agent <name>` | Watch a specific agent's session directory |
| `chasm watch --path <dir>` | Watch a custom directory path |
| `chasm watch --no-harvest` | Detect changes without harvesting (dry-run) |

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
chasm watch

# Watch only Claude Code sessions
chasm watch --agent claude

# Watch a custom directory with verbose output
chasm watch --path /path/to/sessions --verbose

# Dry-run: see changes without harvesting
chasm watch --no-harvest --debounce 5
```

---

## Provider Management

Commands for managing LLM provider configuration and connectivity.

| Command | Description |
|---|---|
| `chasm provider list` | List all discovered LLM providers |
| `chasm provider info <name>` | Show detailed info about a provider |
| `chasm provider config <name>` | Configure a provider's settings |
| `chasm provider test <name>` | Test connection to a provider |
| `chasm provider import --from <name>` | Import sessions from another provider |

### Configuration Options

```bash
chasm provider config ollama \
  --endpoint http://localhost:11434 \
  --model mistral \
  --enabled true

chasm provider config openai \
  --api-key sk-... \
  --model gpt-4o
```

### Examples

```bash
# List all providers
chasm provider list

# Check a provider
chasm provider info ollama
chasm provider test ollama

# Import sessions from Cursor into current project
chasm provider import --from cursor --path .
```

---

## Shell Completions

Generate shell completions for your preferred shell.

| Command | Description |
|---|---|
| `chasm completions bash` | Generate Bash completions |
| `chasm completions zsh` | Generate Zsh completions |
| `chasm completions fish` | Generate Fish completions |
| `chasm completions powershell` | Generate PowerShell completions |
| `chasm completions elvish` | Generate Elvish completions |

### Installation

```bash
# Bash (add to ~/.bashrc)
chasm completions bash > ~/.local/share/bash-completion/completions/chasm

# Zsh (add to fpath)
chasm completions zsh > ~/.zfunc/_chasm

# Fish
chasm completions fish > ~/.config/fish/completions/chasm.fish

# PowerShell (add to $PROFILE)
chasm completions powershell >> $PROFILE
```

---

## Doctor (Diagnostics)

Check system environment, providers, and configuration health.

| Command | Description |
|---|---|
| Command | Description |
|---|---|
| `chasm doctor` | Run basic environment checks, including the session-file scan |
| `chasm doctor --quick` | Skip the session-file scan — the slow part |
| `chasm doctor --full` | Run all checks including network connectivity |
| `chasm doctor --format json` | Output results as JSON |
| `chasm doctor --fix` | Attempt to fix detected issues automatically |

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
| System | Chasm version | No | No |
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
| Network | Chasm API server | Yes | No |
| Sessions | Per-workspace session health | No | **Yes** |

### Examples

```bash
# Everything except the network checks
chasm doctor

# Environment only, no session scan -- sub-second
chasm doctor --quick

# Full check with network tests
chasm doctor --full

# JSON output for scripting
chasm doctor --format json

# Auto-fix issues
chasm doctor --fix
```

---

## Telemetry

| Command | Description |
|---|---|
| `chasm telemetry status` | Show status and installation ID (alias for `info`) |
| `chasm telemetry enable` | Allow local recording (alias for `opt-in`) |
| `chasm telemetry disable` | Refuse it (alias for `opt-out`) |
| `chasm telemetry record` | Write one record locally |
| `chasm telemetry query` | Read the records back |
| `chasm telemetry export` | Export records as JSON or CSV |
| `chasm telemetry config` | Set **your own** remote endpoint and API key |
| `chasm telemetry sync` | POST recorded rows to that endpoint |

!!! info "Privacy"
    Chasm has no built-in analytics endpoint and sends nothing on its own.
    Nothing is recorded automatically either — `chasm telemetry record` is
    the only writer, with the data you pass it, into a local JSONL file.

    `sync` transmits, but only after you have supplied an endpoint and API
    key via `config`, and only to the destination you named. There is no
    Nervosys default. Separately, setting `OTEL_EXPORTER_OTLP_ENDPOINT`
    exports traces to that collector — also one you chose.
