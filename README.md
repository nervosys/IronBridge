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
- 🌐 **REST API** — 130 documented operations, every one verified as routed
- 🔗 **Local Share Links** — Revocable, expiring tokens that read a session
  back through your own server. Nothing is uploaded anywhere
- 🧠 **Conversation Analysis** — Model-backed against any OpenAI-compatible
  endpoint, with offline heuristics as a clearly-labelled fallback
- 🔌 **Plugin System** — Extensible architecture with event hooks

> See [Implementation status](#implementation-status) for what each part of
> the tree actually does today.

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
| **Editors**    | GitHub Copilot, Cursor, Windsurf, Trae, Continue.dev, Cline, Roo Code, Kilo Code, Antigravity |
| **CLI Agents** | Claude Code, Codex CLI, Gemini CLI, Antigravity CLI, Cursor CLI, GitHub Copilot CLI, Droid CLI, OpenCode, OpenClaw, Qwen Code, Pi, Goose |
| **Local LLMs** | Ollama, vLLM, LM Studio, LocalAI, Jan, GPT4All, Llamafile                                   |
| **Cloud**      | ChatGPT, Claude, Gemini, Perplexity, DeepSeek (via share links)                             |

## Ecosystem

| Component             | Description                       | Status         |
| --------------------- | --------------------------------- | -------------- |
| **chasm-rust**        | Core Rust library and CLI         | ✅ Stable       |
| **chasm-web**         | React web application             | ✅ Stable       |
| **chasm-app**         | React Native mobile app           | ✅ Stable       |
| **chasm-desktop**     | Tauri desktop application         | ✅ Stable       |
| **vscode-extension**  | VS Code extension                 | ✅ Stable       |
| **browser-extension** | Chrome/Firefox extension          | ✅ Stable       |
| **jetbrains-plugin**  | IntelliJ/PyCharm/WebStorm plugin  | ✅ Stable       |
| **vim-plugin**        | Vim 8.0+ plugin                   | ✅ Stable       |
| **neovim-plugin**     | Neovim 0.8+ plugin with Telescope | ✅ Stable       |

See [Implementation status](#implementation-status) for the per-area detail
behind these labels, including which features need an API key or a
Linux-only build.

## API Server

Start the REST/GraphQL API server:

```bash
chasm api serve --port 8787
```

### REST Endpoints

| Method | Endpoint               | Description               |
| ------ | ---------------------- | ------------------------- |
| GET    | `/api/health`          | Health check              |
| GET    | `/api/workspaces`      | List workspaces           |
| GET    | `/api/workspaces/:id`  | Get one workspace         |
| GET    | `/api/sessions`        | List sessions             |
| GET    | `/api/sessions/:id`    | Get session with messages |
| GET    | `/api/sessions/search` | Full-text search (`?q=`)  |
| GET    | `/api/search`          | Search sessions and messages (`?q=`) |
| GET    | `/api/stats`           | Database statistics       |
| GET    | `/api/stats/providers` | Per-provider counts       |
| GET    | `/api/stats/timeline`  | Sessions and messages per day (`?days=`) |

Writes:

| Method | Endpoint                          | Description                     |
| ------ | --------------------------------- | ------------------------------- |
| POST   | `/api/sessions`                   | Create a session                |
| DELETE | `/api/sessions/:id`               | Delete a session                |
| POST   | `/api/sessions/:id/messages`      | Append a message                |
| POST   | `/api/sessions/:id/fork`          | Copy a session                  |
| POST   | `/api/sessions/merge`             | Merge sessions into a new one   |
| GET    | `/api/sessions/:id/export`        | Download (`?format=json\|markdown`) |
| GET    | `/api/sessions/:id/checkpoints`   | List checkpoints                |
| POST   | `/api/sessions/:id/checkpoints`   | Create a checkpoint             |
| GET    | `/api/sessions/:id/commits`       | Git commits for the workspace   |
| POST   | `/api/workspaces`                 | Create a workspace              |
| PUT    | `/api/workspaces/:id`             | Update a workspace              |
| DELETE | `/api/workspaces/:id`             | Delete a workspace              |
| PUT    | `/api/swarms/:id`                 | Update a swarm                  |
| POST   | `/api/providers/:id/test`         | Test provider connectivity      |
| POST   | `/api/chat/completions`           | Proxy a completion              |
| POST   | `/api/harvest`                    | Run an incremental harvest      |

Endpoints that refuse rather than guess:

- `POST /api/chat/completions` needs `OPENAI_API_KEY` (and `OPENAI_BASE_URL`
  for a local endpoint). Without one it returns `503` naming the variable,
  never a canned reply.
- `POST /api/providers/:id/test` only knows how to reach locally hosted
  providers; anything else returns `501` rather than a success that tested
  nothing.
- `GET /api/stats/providers` reports `tokens: 0` where the store holds no
  token counts, rather than estimating.

Deleting a workspace **detaches** its sessions rather than deleting them.
Merging leaves its sources intact. A fork is an independent copy, not an alias.

### Response envelope

Every endpoint **except `GET /api/health`** wraps its payload:

```json
{ "success": true, "data": { ... }, "error": null }
```

Errors carry `{"success": false, "error": "..."}` with no `data`.

The full spec is `chasm-rust/openapi.yaml` — 101 paths, 130 operations. Two
tests keep it honest: one fails if a documented path is not routed, the other
if a response body no longer matches its schema.

### Sharing

```bash
curl -X POST localhost:8787/api/sessions/$ID/share -d '{"expiresInHours":24}'
curl localhost:8787/api/shared/$TOKEN          # read it back
curl -X DELETE localhost:8787/api/shared/$TOKEN # revoke
```

| Method | Endpoint                     | Description                       |
| ------ | ---------------------------- | --------------------------------- |
| POST   | `/api/sessions/:id/share`    | Create a link                     |
| GET    | `/api/sessions/:id/share`    | List links, with status           |
| GET    | `/api/shared/:token`         | Read the session (no auth)        |
| DELETE | `/api/shared/:token`         | Revoke                            |

**A share link is local.** The token grants read access *through your own
server* — nothing is uploaded anywhere, and the link only works while your
server is reachable by the recipient. That is deliberate: Chasm holds your
entire chat history on your machine, and transmitting a conversation to a
third party is a decision that should be yours to make explicitly.

The token is a bearer credential: 256 bits of OS randomness, and anyone
holding it can read that session. Expiry is evaluated on every read, so a
link dies on time without needing a cleanup job, and unknown, revoked and
expired tokens are all answered with `404` so probing cannot tell them apart.

### Semantic search

```bash
export OPENAI_API_KEY=...                       # or a local endpoint
curl -X POST localhost:8787/api/search/semantic/index -d '{}'
curl "localhost:8787/api/search/semantic?q=how+did+we+fix+the+deadlock"
```

Indexing is a separate, explicit step — embedding a whole store costs money and
time proportional to its size, so a query never triggers one silently. The
response reports how many vectors it searched, so an empty index is
distinguishable from no matches.

There is no lexical fallback: without a key both routes return `503`. An
endpoint called "semantic" quietly returning substring matches would be
indistinguishable from a broken index, and `/api/search` already does substring
matching honestly.

> **Not yet proven.** The refusal path, vector storage and similarity maths are
> tested, but the embed–index–rank path has never run against a real embedding
> endpoint. Treat it as unverified until you have run it with a key.

### GraphQL

| Endpoint               | Description                    |
| ---------------------- | ------------------------------ |
| `/graphql`             | Queries and mutations (GET/POST) |
| `/graphql/playground`  | Interactive explorer           |
| `/graphql/sdl`         | Schema in SDL form             |

Queries (`workspaces`, `sessions`, `messages`, `providers`, `agents`, `stats`,
`search`) read the same database as the REST routes. Session and agent
mutations perform real writes.

Two deliberate exceptions: the `harvest` and `sync` mutations return an error
directing you to `chasm harvest run` / `chasm sync`, because a multi-minute
directory scan does not belong in a synchronous GraphQL field. Updating a
session with `tags` is also rejected — no column exists to store them.

On databases created by the harvest pipeline, `model`, `tokenCount` and
`archived` are absent from the underlying tables and are reported as null, 0
and false respectively.

### Agent Inbox

| Method | Endpoint                                | Description                        |
| ------ | --------------------------------------- | ---------------------------------- |
| GET    | `/api/inbox`                            | Notifications, messages, permissions, workflows |
| GET    | `/api/inbox/counts`                     | Unread and pending badge counts    |
| POST   | `/api/inbox/notifications/{id}/read`    | Mark read                          |
| POST   | `/api/inbox/messages/{id}/star`         | Toggle star                        |
| POST   | `/api/inbox/permissions/{id}/respond`   | Approve or deny                    |

The agency runtime writes to this as it runs agents. Permission requests
expire: responding to a lapsed one returns 409 rather than a misleading
success, because the agent that asked has already moved on.

## Conversation Analysis

```bash
chasm analyze session.json                  # topics, sentiment, key points
chasm analyze session.json --json           # machine-readable
chasm analyze session.json --require-model  # fail rather than fall back
```

Uses a language model when `OPENAI_API_KEY` is set, and offline heuristics
otherwise. **The output always states which one ran** — the heuristics only
recognise a couple of languages and write no summary, so a result that looks
thin may simply mean no model was configured.

Point it at any OpenAI-compatible endpoint, including a local one:

```bash
export OPENAI_API_KEY=local                        # local servers ignore it
export OPENAI_BASE_URL=http://127.0.0.1:11434/v1   # e.g. Ollama
export CHASM_ANALYSIS_MODEL=gemma4:latest
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

## Desktop App

```bash
cd chasm-desktop && cargo tauri dev     # or `cargo tauri build`
```

The desktop app is chasm-web in a Tauri window. It starts the API server
in-process on `127.0.0.1:8788`, so there is no separate backend to launch. If
a Chasm API is already listening there it is shared rather than duplicated —
two processes writing one SQLite file is worse than one.

The port differs from the CLI's 8787 deliberately, so the app and a
`chasm api serve` you started yourself do not contend for the same database.

## Agency (AI Agent Framework)

```bash
chasm agency run --agent researcher "What are the latest AI trends?"
chasm agency run --orchestration swarm "Build a REST API"
```

## Enterprise Features (`--features enterprise`)

Behind the `enterprise` feature flag. Building these needs `libxmlsec1` and
`clang`, so CI builds them on Linux only.

- **SSO/SAML**: SAML 2.0 flow for Okta, Azure AD, Google, OneLogin, Auth0.
  Assertion signatures are verified with samael/libxmlsec1, and the response is
  re-parsed from the signature-reduced document so wrapped forgeries cannot
  reach the session.
- **Audit Logging**: event model, categories, and CSV/JSON/JSONL export.
- **Data Retention**: policy model, scheduling, and expiry actions.
- **Compliance**: SOC2, HIPAA, GDPR, CCPA, ISO 27001, FedRAMP, PCI DSS —
  reporting scaffolding, not certification.
- **Multi-tenancy**: Subscription tiers, tenant isolation, white-labeling.

All three services persist through `api::audit::DatabaseOps`. The crate ships
`SqliteEnterpriseStore`, which implements all 35 methods against the same SQLite
database as the rest of Chasm; an embedder can substitute its own implementor.

**Team Workspaces** (RBAC, activity feeds, session sharing) is not gated behind
this flag and does not depend on `DatabaseOps`.

## Implementation status

The CLI and core library are the mature part of this project. The server and
enterprise layers are scaffolding at varying stages. Concretely:

| Area                            | State                                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| CLI, library, harvest, recovery | **Working.** ~96k LOC Rust, 879 tests passing.                                                                            |
| Providers                       | **Working.** 11 local/OpenAI-compatible endpoints in the catalogue, 21 cloud providers listed, and 5 cloud share-link parsers (ChatGPT, Claude, Gemini, Perplexity, Poe). |
| MCP server, TUI                 | **Working.**                                                                                                              |
| REST API                        | **Working.** 130 operations across 101 documented paths, covering `/api` plus the root-mounted auth, sync, recording and webhook scopes. Every one is asserted to be routed by a test, and response bodies are checked against the schema. The rival implementation in `api/handlers.rs`/`api/routes.rs`, which held the 24 `"not yet implemented"` stubs and was never compiled, has been deleted. |
| GraphQL                         | **Working.** Mounted at `/graphql`, with playground and SDL. `harvest`/`sync` mutations deliberately error and point at the CLI. |
| Enterprise (SSO/audit/retention)| **Working, Linux-only build.** SAML signatures are verified against wrapping attacks, and `SqliteEnterpriseStore` implements all 35 `DatabaseOps` methods, so IdP config, sessions, audit events and retention policies persist. Needs `libxmlsec1`. |
| Conversation analysis           | **Model-backed.** `chasm analyze <file>` calls any OpenAI-compatible endpoint. Without a key it falls back to the old heuristics, and the output always names which one ran. |
| Embeddings / semantic search    | **Built, unproven.** `POST /api/search/semantic/index` embeds sessions and `GET /api/search/semantic` ranks them by cosine similarity. Refusal, vector storage and the similarity maths are tested; the embed–index–rank path has never run against a real embedding endpoint, so treat it as unverified. This row previously read "Working" while nothing in the tree ever wrote an embedding. |
| Session sharing                 | **Working, local only.** Revocable, optionally-expiring tokens readable through your own server. Nothing is uploaded anywhere — see [Sharing](#sharing). |
| chasm-desktop                   | **Working.** Wraps chasm-web and runs the API server in-process on 127.0.0.1:8788, so it needs no separately started backend. No desktop-specific UI. |
| chasm-web                       | **Working.** `AgentInbox` is backed by `/api/inbox`.                                                                      |

Mock data in chasm-web is opt-in via `VITE_ENABLE_DEMO_MODE`; an empty or
failing backend renders as empty or as an error, never as fixtures.

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

[AGPL-3.0](LICENSE) with [commercial dual-license](COMMERCIAL_LICENSE.md) — Made by [Nervosys](https://nervosys.ai)

Contributions require signing the [CLA](CLA.md).
