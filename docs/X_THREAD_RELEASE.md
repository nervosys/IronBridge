# Chasm v1.3 — X Release Thread

> Copy each numbered section as a separate post in an X thread.
> Character counts are noted per tweet. Images/video suggestions in brackets.

---

## 1/15 — Hook (267 chars)

🚀 Introducing Chasm v1.3 — the universal AI session manager.

One CLI to harvest, search, merge, version, and recover your chat history from every AI coding agent.

VS Code Copilot · Cursor · Claude Code · Codex CLI · Gemini CLI · OpenCode · 30+ more.

Open source. Written in Rust. 🦀

---

## 2/15 — The Problem (280 chars)

Your AI conversations are scattered everywhere.

VS Code keeps sessions in hidden SQLite databases. Cursor stores them separately. Claude Code has its own directory. Codex CLI, Gemini CLI, OpenCode — all different formats, different paths.

You can't search them. You can't back them up. You lose them.

---

## 3/15 — Agent Launcher (276 chars)

`chasm run` — launch any AI coding agent with automatic session capture.

```
chasm run claude "fix the auth bug"
chasm run codex "add unit tests"
chasm run gemini "refactor this module"
```

7 agents supported. Sessions auto-harvested on exit. Zero config.

Your work is never lost again.

---

## 4/15 — Real-Time Watcher (248 chars)

`chasm watch` — monitor agent session directories in real-time.

Detects new and modified sessions across all agents simultaneously. Auto-harvests them into your unified database.

```
chasm watch              # all agents
chasm watch --agent claude  # specific agent
```

Set it and forget it.

---

## 5/15 — Agency ADK (279 chars)

Chasm ships its own Agent Development Kit.

Built-in orchestration modes:
→ Single — one agent, one task
→ Sequential — agents chain results
→ Parallel — agents work simultaneously
→ Swarm — multi-agent collaboration with a coordinator

```
chasm agency run --orchestration swarm "build the feature"
```

---

## 6/15 — 34 Providers (270 chars)

One unified interface for 34 AI providers across 3 categories:

📁 File-based (10): Copilot, Cursor, Claude Code, Codex CLI, Gemini CLI, OpenCode, ContinueDev, Droid CLI, OpenClaw, Antigravity

🖥️ Local API (9): Ollama, vLLM, LM Studio, LocalAI, Jan, GPT4All...

☁️ Cloud API (15): OpenAI, Anthropic, DeepSeek, Mistral...

---

## 7/15 — Harvest & Search (278 chars)

`chasm harvest` — ingest every session from every provider into a single SQLite database with FTS5 full-text search.

```
chasm harvest init
chasm harvest run --commit
chasm harvest search "authentication bug"
```

94,000 messages across 500 sessions? Searched in milliseconds. With git versioning.

---

## 8/15 — 6 Agent Skills (280 chars)

Pre-built skills any AI agent can use (Claude Code, Copilot, Cursor, Codex, Gemini CLI):

📋 session-summary — standup-ready recaps
🐃 yak-detector — scope creep alerts
🔍 code-insight — tool & file change analysis
🏷️ session-organizer — auto-categorize
🔐 secret-guard — leaked key scanner
🔗 link-trail — URL catalog

---

## 9/15 — MCP Server (260 chars)

`csm-mcp` — a Model Context Protocol server so any MCP-compatible agent can query your session history directly.

5 tools: list workspaces, list sessions, get session, search, get stats.

Works with Claude Desktop, VS Code, and any MCP client. Stdio transport. Zero config.

---

## 10/15 — Session Recovery (280 chars)

Lost a session? Chasm has 7 recovery paths:

```
chasm recover scan           # find everything
chasm recover orphans        # unindexed files
chasm recover jsonl <file>   # fix corruption
chasm recover database <bak> # extract from backups
chasm register repair        # rebuild VS Code index
```

Fixes concatenated JSONL, cancelled response states, and isEmpty bugs.

---

## 11/15 — Git Versioning (259 chars)

Version-control your AI conversations like code.

```
chasm git init .
chasm git track . -m "after auth refactor"
chasm git snapshot . --tag v1
chasm git diff . --from HEAD~1
chasm git restore . <commit>
```

Track sessions alongside your file changes. Diff conversations between commits.

---

## 12/15 — Machine-Readable Ontology (280 chars)

We created a 1,400-line YAML ontology so AI agents can fully discover chasm without human guidance.

Every command, argument, entity, relationship, workflow, constraint, and failure mode — machine-readable.

Agents read ontology.yaml and know exactly what to call, when, and why. Self-documenting infrastructure.

---

## 13/15 — Full Interface Surface (265 chars)

Chasm isn't just a CLI. It's a platform.

→ CLI with shell completions (bash/zsh/fish/pwsh)
→ REST API with OpenAPI spec (30+ endpoints)
→ GraphQL with Playground
→ WebSocket for real-time updates
→ MCP server for agent integration
→ TUI browser with Abyss dark theme
→ Web, Desktop (Tauri), Mobile (RN)

---

## 14/15 — Migration & Sync (270 chars)

Moving machines? Chasm handles it.

```
chasm migration create backup.tar --all
# transfer to new machine
chasm migration restore backup.tar --mapping "C:\old:C:\new"
```

Bidirectional sync between harvest DB and provider workspaces:

```
chasm sync --pull   # backup
chasm sync --push   # restore
```

---

## 15/15 — Get Started (232 chars)

```
cargo install chasm-cli
chasm doctor --fix
chasm harvest init && chasm harvest run
chasm harvest search "your query"
```

⭐ GitHub: github.com/nervosys/chasm
📦 Crates.io: crates.io/crates/chasm-cli
📄 License: AGPL-3.0 (commercial available)

Built by @nervosys. Contributions welcome.
