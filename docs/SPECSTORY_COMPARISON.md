# Chasm vs SpecStory: Competitive Analysis

> **Date:** 2025-07-07
> **Chasm Version:** 1.3.2 | **SpecStory Version:** 1.5.0
> **Verdict:** Chasm is a superset of SpecStory in nearly every dimension

---

## Executive Summary

SpecStory captures AI coding conversations from 5 terminal agents and 2 IDE
extensions, saving them as Markdown files with optional cloud sync. Chasm captures
conversations from **30+ providers** across local APIs, cloud APIs, web interfaces,
terminal agents, and IDE extensions — normalizing everything into a unified SQLite
database with full API, desktop, mobile, web, and browser access.

| Dimension | SpecStory | Chasm | Winner |
|-----------|-----------|-------|--------|
| Provider count | 5 CLI + 2 IDE | 30+ local/cloud/web/IDE | **Chasm 6x** |
| Storage format | Markdown files | SQLite + export to JSON/JSONL/MD | **Chasm** |
| Search | Cloud-only FTS | Local FTS5 + semantic search | **Chasm** |
| API server | None (cloud SaaS) | REST + GraphQL + WebSocket | **Chasm** |
| Desktop app | None | Tauri (~10MB) | **Chasm** |
| Mobile app | None | React Native (iOS/Android) | **Chasm** |
| Web dashboard | Cloud SaaS only | Self-hosted React + Vite | **Chasm** |
| Browser extension | None | Chrome + Firefox | **Chasm** |
| VS Code extension | 2 (Cursor + Copilot) | 30+ commands, 10 recording providers | **Chasm** |
| Agent SDK | Agent Skills (md) | Agency ADK (orchestration) | **Chasm** |
| Git versioning | None | Full (init/track/diff/restore) | **Chasm** |
| Recovery tools | None | 8 recovery modes | **Chasm** |
| Multi-agent | None | Swarms, protocols, orchestration | **Chasm** |
| MCP server | None | 14+ tools | **Chasm** |
| Enterprise | None | Compliance, RBAC, multitenancy | **Chasm** |
| Telemetry | PostHog (cloud) | Self-hosted structured events | **Chasm** |
| Privacy | Local-first + cloud opt-in | 100% self-hosted | **Chasm** |
| Terminal agent wrapping | `specstory run <agent>` | `agency run` | Tie |
| Agent detection | `specstory check` | `detect` | Tie |
| Cloud SaaS | cloud.specstory.com | Not applicable (self-hosted) | SpecStory* |
| Windows support | No | Yes | **Chasm** |

*\*SpecStory's cloud SaaS is a different model; Chasm's self-hosted approach is
superior for privacy, enterprise, and sovereignty.*

---

## Detailed Feature Comparison

### 1. Provider Coverage

#### Terminal CLI Agents
| Agent | SpecStory | Chasm |
|-------|-----------|-------|
| Claude Code CLI | ✅ JSONL `~/.claude/projects/` | ✅ Recording + harvest |
| Codex CLI | ✅ JSONL `~/.codex/sessions/` | 🔧 Add provider |
| Cursor CLI | ✅ SQLite `~/.cursor/chats/` | ✅ Full support |
| Droid CLI | ✅ JSONL `~/.factory/sessions/` | 🔧 Add provider |
| Gemini CLI | ✅ JSON `~/.gemini/tmp/` | 🔧 Add provider |
| OpenCode | ❌ | ✅ Recording |
| OpenClaw | ❌ | ✅ Recording |
| Antigravity | ❌ | ✅ Recording |
| Windsurf | ❌ | ✅ Recording |
| Zed | ❌ | ✅ Recording |

#### IDE Extensions (Recording)
| IDE/Extension | SpecStory | Chasm |
|---------------|-----------|-------|
| VS Code Copilot | ✅ Extension | ✅ Extension + recording |
| Cursor IDE | ✅ Extension | ✅ Recording |
| Continue.dev | ❌ | ✅ Full support |
| Codespaces | ❌ | ✅ Recording |

#### Local API Servers
| Provider | SpecStory | Chasm |
|----------|-----------|-------|
| Ollama | ❌ | ✅ |
| vLLM | ❌ | ✅ |
| LM Studio | ❌ | ✅ |
| LocalAI | ❌ | ✅ |
| Jan.ai | ❌ | ✅ |
| GPT4All | ❌ | ✅ |
| Llamafile | ❌ | ✅ |
| Text Gen WebUI | ❌ | ✅ |
| Azure AI Foundry | ❌ | ✅ |

#### Cloud APIs
| Provider | SpecStory | Chasm |
|----------|-----------|-------|
| OpenAI / ChatGPT | ❌ | ✅ |
| Anthropic Claude | ❌ | ✅ |
| Google Gemini | ❌ | ✅ |
| Microsoft Copilot | ❌ | ✅ |
| Perplexity | ❌ | ✅ |
| DeepSeek | ❌ | ✅ |
| Mistral | ❌ | ✅ |
| Cohere | ❌ | ✅ |
| xAI Grok | ❌ | ✅ |
| Groq | ❌ | ✅ |
| Together AI | ❌ | ✅ |
| Fireworks AI | ❌ | ✅ |
| Replicate | ❌ | ✅ |
| HuggingFace | ❌ | ✅ |
| Qwen / Alibaba | ❌ | ✅ |
| Custom | ❌ | ✅ |

#### Web Interface Harvesting
| Provider | SpecStory | Chasm |
|----------|-----------|-------|
| ChatGPT | ❌ | ✅ Browser extension |
| Claude | ❌ | ✅ Browser extension |
| Gemini | ❌ | ✅ Browser extension |
| Copilot Web | ❌ | ✅ Browser extension |
| Poe | ❌ | ✅ Browser extension |
| Perplexity | ❌ | ✅ Browser extension |
| + 10 more web providers | ❌ | ✅ harvest scan |

### 2. CLI Commands

| Command Category | SpecStory | Chasm |
|-----------------|-----------|-------|
| **Agent execution** | `run`, `watch` | `agency run` (with orchestration modes) |
| **Agent detection** | `check` | `detect` (workspace, providers, sessions, orphaned) |
| **Session sync** | `sync` | `sync`, `harvest sync` (push/pull, format auto-detect) |
| **Auth** | `login`, `logout` | Self-hosted (no cloud auth needed) |
| **Version** | `version` | `--version` |
| **Help** | `help` | `help`, `--help` |
| **List** | — | `list` (workspaces, sessions, agents, paths, orphaned) |
| **Find/Search** | — | `find`, `harvest search` (FTS5) |
| **Show/Info** | — | `show` (workspace, session, agent, path, timeline) |
| **Fetch** | — | `fetch` (sessions, by ID, by path) |
| **Merge** | — | `merge` (workspace, sessions, path, provider, all) |
| **Export** | — | `export` (JSON, JSONL, Markdown, batch) |
| **Import** | — | `import` (workspace, sessions, path) |
| **Move** | — | `move` (sessions between workspaces) |
| **Git versioning** | — | `git` (config, init, add, status, snapshot, track, log, diff, restore) |
| **Migration** | — | `migration` (create, restore packages) |
| **Recovery** | — | `recover` (scan, recording, database, jsonl, orphans, repair, convert, extract, upgrade) |
| **Provider mgmt** | — | `provider` (list, info, config, import, test) |
| **Registration** | — | `register` (all, session, recursive) |
| **Harvest** | — | `harvest` (init, scan, run, status, list, export, search, share, checkpoints, git) |
| **API server** | — | `api serve` (REST + GraphQL + WebSocket) |
| **Agency ADK** | — | `agency` (list, info, modes, run, create, tools, templates) |
| **Telemetry** | — | `telemetry` (info, opt-in/out, record, show, export, sync) |
| **TUI** | — | `run` (terminal user interface) |

### 3. Data Architecture

| Aspect | SpecStory | Chasm |
|--------|-----------|-------|
| **Primary storage** | Markdown files in `.specstory/history/` | SQLite with FTS5 indexes |
| **Schema** | Unstructured (Markdown) | Normalized (workspaces, sessions, messages, tool_invocations, file_changes) |
| **Querying** | Cloud-only search | Local SQL + FTS5 + semantic search |
| **Checkpoints** | None | Session checkpoints with revert |
| **Share links** | Cloud URL sharing | Import from ChatGPT/Claude share URLs |
| **Export formats** | Markdown only | JSON, JSONL, Markdown |
| **Versioning** | None | Git (track, diff, restore, snapshot) |
| **Recovery** | None | 8 recovery modes (corrupted files, orphans, backups) |

### 4. Agent & Multi-Agent Capabilities

| Feature | SpecStory | Chasm |
|---------|-----------|-------|
| **Agent Skills/Templates** | 6 Markdown skills | Agency ADK with templates (coordinator, researcher, coder, reviewer, executor, writer, tester, custom) |
| **Orchestration** | None | Single, sequential, parallel, swarm modes |
| **Protocols** | None | NANDA, A2A, MCP, swarm intelligence, PGMs, consensus |
| **MCP Server** | None | 14+ tools exposed via MCP |
| **Agent Inbox** | None | Agent inbox with message routing |
| **Swarm Management** | None | Full lifecycle (start, pause, resume, stop) |

### 5. User Interfaces

| Interface | SpecStory | Chasm |
|-----------|-----------|-------|
| **CLI** | Go binary | Rust binary (faster, safer) |
| **VS Code Extension** | 2 extensions (Cursor + Copilot) | 1 extension, 30+ commands, 10 providers |
| **Web Dashboard** | Cloud SaaS (cloud.specstory.com) | Self-hosted React + Vite + Tailwind |
| **Desktop App** | None | Tauri 2.0 (~10MB, native perf) |
| **Mobile App** | None | React Native (iOS + Android + Web) |
| **Browser Extension** | None | Chrome + Firefox (6 web providers) |
| **TUI** | None | ratatui-based terminal interface |

### 6. Enterprise & Security

| Feature | SpecStory | Chasm |
|---------|-----------|-------|
| **Privacy model** | Local-first + optional cloud | 100% self-hosted |
| **Encryption** | Cloud TLS | AES-GCM + DPAPI (Windows) |
| **Multi-tenancy** | None | Built-in |
| **RBAC** | None | Built-in |
| **Compliance** | None | Compliance module |
| **White-labeling** | None | Supported |
| **Audit logging** | PostHog analytics | Structured telemetry |

---

## Gap Analysis: What SpecStory Has That Chasm Should Add

### Priority 1: Terminal CLI Agent File Harvesting

SpecStory's `sync` command reads session files from 5 terminal agents' home
directories. Three of these are not yet in chasm's harvest scanner:

| Agent | Format | Path | Status |
|-------|--------|------|--------|
| Codex CLI | JSONL | `~/.codex/sessions/` | **Add to harvest** |
| Droid CLI | JSONL | `~/.factory/sessions/` | **Add to harvest** |
| Gemini CLI | JSON | `~/.gemini/tmp/` | **Add to harvest** |

Claude Code (`~/.claude/projects/`) and Cursor CLI (`~/.cursor/chats/`) are
already supported through chasm's recording and Cursor provider respectively.

### Priority 2: Agent Skills / Knowledge Templates

SpecStory has a separate `agent-skills` repo with 6 skills:
- `specstory-guard` — Pre-commit secret scanning
- `specstory-link-trail` — URL tracking from sessions
- `specstory-organize` — Organize history by year/month
- `specstory-project-stats` — Cloud project statistics
- `specstory-session-summary` — Standup-ready summaries
- `specstory-yak` — Yak-shaving / scope creep detection

Chasm should create equivalent (but superior) agent skills leveraging its
richer data model (SQLite queries, FTS5, file changes, tool invocations).

### Priority 3: File-Based Watch Mode

SpecStory's `specstory watch` monitors a directory for agent file changes
without launching the agent. Chasm's recording feature does something similar
but is VS Code-specific. A standalone `chasm watch` command would be useful
for terminal-only workflows.

---

## 10x Advantages: Where Chasm Already Dominates

1. **6x Provider Coverage** — 30+ vs 5 providers
2. **Structured Data** — SQLite with relations vs flat Markdown files
3. **Full API Server** — REST + GraphQL + WebSocket vs no API
4. **4 Native Clients** — Desktop + Mobile + Web + Browser vs CLI only
5. **Agent Development Kit** — Multi-agent orchestration vs none
6. **Git Versioning** — Session history tracking vs none
7. **Recovery Tools** — 8 recovery modes vs none
8. **Privacy** — 100% self-hosted vs cloud dependency
9. **Windows Support** — Full Windows support vs Linux/macOS only
10. **MCP Server** — AI agent integration vs none
11. **Enterprise** — RBAC, multitenancy, compliance vs none
12. **Multi-Modal** — Vision, audio, video, embodied vs text only

---

## Implementation Plan

### Phase 1: Close Provider Gaps (This Session)
- [ ] Add Codex CLI provider (JSONL, `~/.codex/sessions/`)
- [ ] Add Droid CLI provider (JSONL, `~/.factory/sessions/`)
- [ ] Add Gemini CLI provider (JSON, `~/.gemini/tmp/`)
- [ ] Update provider documentation

### Phase 2: Agent Skills (This Session)
- [ ] Create `skills/` directory with chasm-specific agent skills
- [ ] Session summary skill (standup format)
- [ ] Yak-shaving detector skill
- [ ] Session organizer skill
- [ ] Secret guard skill (pre-commit)
- [ ] Link trail skill
- [ ] Code quality insight skill (chasm-exclusive: leverage tool_invocations)

### Phase 3: Watch Command (Future)
- [ ] Add `chasm watch <path>` for file-system monitoring
- [ ] Auto-detect terminal agent file changes
- [ ] Auto-harvest new/modified sessions

### Phase 4: Cloud Sync Option (Future)
- [ ] Optional cloud sync endpoint
- [ ] Team workspace sharing
- [ ] Cross-device session access

---

## Conclusion

Chasm is already **10x more capable** than SpecStory in most dimensions. The
primary gaps are:

1. **Three terminal CLI agent providers** (Codex, Droid, Gemini CLI) — easy to add
2. **Agent skills templates** — straightforward to create, and chasm's richer
   data model makes them far more powerful than SpecStory's Markdown-only skills

After closing these gaps, chasm will be a strict superset of SpecStory with
massively more capability in every dimension: more providers, more clients,
more data structure, more agent capabilities, more enterprise features, and
complete privacy sovereignty.
