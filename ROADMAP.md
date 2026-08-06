# Chasm Roadmap

> **Last Updated:** August 4, 2026

This document tracks the development progress and future plans for Chasm (Chat Session Manager).

> **Reading the checkboxes.** A `[x]` below means the feature was built, not
> necessarily that it is wired up and usable. Items marked `[~]` are present in
> the tree but incomplete — see [Known gaps](#known-gaps) for what is actually
> shippable today. `README.md` carries the same summary under
> "Implementation status".

## Recently built

The five features previously listed as unbuilt are implemented, with the
design decisions recorded here because they were made in the code rather than
handed down:

| Feature | Endpoints | Decision |
| --- | --- | --- |
| Timeline stats | `GET /stats/timeline` | Quiet days are omitted, not zero-filled. The store knows nothing about a day on which nothing happened, and inventing rows makes an empty database look like a quiet one. |
| Workspace writes | `POST /workspaces`, `PUT`/`DELETE /workspaces/{id}` | Deleting a workspace **detaches** its sessions rather than deleting them. Removing a filing record should never destroy the conversations filed under it. |
| Fork | `POST /sessions/{id}/fork` | The copy is fully independent and records `parentSessionId`. |
| Merge | `POST /sessions/merge` | Sources are left intact -- an accidental merge has to be recoverable. Each turn carries `mergedFrom`. |
| Export | `GET /sessions/{id}/export` | `json` or `markdown`, served as an attachment. Filenames are stripped of path characters. |
| Sharing | `POST`/`GET /sessions/{id}/share`, `GET`/`DELETE /shared/{token}` | **Local only.** A share is a token granting read access *through this server*; nothing is uploaded anywhere. See below. |
| Semantic search | `GET /search/semantic`, `POST /search/semantic/index` | Indexing is explicit and separate. No lexical fallback. |

### Why sharing is local-only

Chasm holds a person's entire chat history on their own machine. Making
"share" mean "transmit a conversation to a third party" has privacy
consequences that belong to whoever runs it, not to whoever wrote the code, so
the implementation does the useful thing that cannot leak: a revocable,
optionally-expiring bearer token that reads the session back through this same
server.

The token is 256 bits from the OS random source rather than a UUID, because it
is a credential and not an identifier. Expiry is derived on read, so a link is
dead the moment it expires whether or not anything has swept it. Unknown,
revoked and expired tokens all answer `404`, so probing cannot distinguish a
closed link from a guess. A link only works while this server is reachable by
the recipient -- which is the point.

### What is verified, and what is not

All five are covered by 26 new tests and were exercised against a running
server: the timeline groups real sessions, a workspace delete leaves its
sessions behind, a fork diverges from its source, a merge leaves both inputs
intact, markdown export renders the transcript, and a share link reads, lists
as active, revokes, and then 404s.

**Semantic search's success path is not verified.** No embedding API was
reachable from the machine this was written on, so what has been exercised is
the refusal path (`503` naming `OPENAI_API_KEY`), the vector encode/decode
round trip, and the cosine arithmetic including its degenerate cases. The
embed-index-rank path has never run against a real embedding endpoint. It is
written to fail loudly rather than quietly -- mismatched vector counts and
out-of-order indices are errors, not silent corruption -- but it has not been
proven end to end, and the first person with a key should treat it as
unproven.

## Known gaps

Verified against the tree as of August 4, 2026:

| Item | Reality |
| --- | --- |
| GraphQL API | Mounted and backed by the database. `harvest` and `sync` mutations return errors by design (use the CLI or REST). `tags` is rejected on session updates -- no column exists for it. |
| REST API | Single implementation. The orphaned `api/handlers.rs` and `api/routes.rs` — which held all 24 `"not yet implemented"` stubs — were deleted. The served API is 92 routes across `api/mod.rs` and `api/handlers_write.rs`, plus the root-mounted auth, sync, recording, webhook and websocket scopes. (This said 47 until the write handlers landed; the count is now asserted by `openapi.yaml` and its route test rather than kept by hand.) |
| SSO/SAML | Signature verification is implemented (samael/libxmlsec1) and covered by wrapping-attack tests. IdP config and sessions persist via `SqliteEnterpriseStore`. Requires libxmlsec1; built on Linux only in CI. |
| Audit logging, retention | Persist through `SqliteEnterpriseStore`, which implements all 35 `api::audit::DatabaseOps` methods. |
| AI & Intelligence | Model-backed via `chasm analyze`, against any OpenAI-compatible endpoint. Falls back to the old heuristics without a key, and every result states which produced it. |
| Embeddings / semantic search | Implemented against the OpenAI embeddings API, with index-order and dimension validation. Requires an API key; without one, embedding calls error rather than returning zeros. |
| Desktop application | Runs the API server in-process, so it works standalone. The UI is chasm-web; there is no desktop-specific interface. |
| Agent inbox | Backed by `/api/inbox`. The agency runtime emits run and message events; permission requests expire rather than lingering as approvable. |

### REST surface removed from the spec in 2.0.0

`openapi.yaml` used to document twenty paths the server never routed, so a
generated client compiled fine and then 404'd at runtime. They were removed so
the spec describes only what is served. Recorded here because deleting them
from the spec also deletes the only record that they were once intended:

Seven of them were **implemented afterwards** rather than left deleted, once
the web-client audit below showed the UI depended on them: `POST /sessions`,
`DELETE /sessions/{id}`, `POST /sessions/{id}/messages`, `GET /search`,
`GET /stats/providers`, `POST /chat/completions` and `POST /harvest`. Those
rows are marked below; the rest stay out of the spec.

(The twelve endpoints in the web-client section are these seven plus five that
had never been documented at all: `GET` and `POST /sessions/{id}/checkpoints`,
`GET /sessions/{id}/commits`, `PUT /swarms/{id}` and
`POST /providers/{id}/test`.)

| Removed | Methods | Note |
| --- | --- | --- |
| `/system/vacuum`, `/system/cache/clear` | POST | No maintenance endpoints exist. |
| `/workspaces/discover`, `/workspaces/{id}/refresh` | POST | Discovery is CLI-only (`chasm detect`). |
| `/sessions/merge`, `/sessions/{id}/archive`, `/sessions/{id}/fork` | POST | Merge exists as a library and CLI capability, not over REST. |
| `/sessions/{id}/export` | GET | Export is CLI-only. |
| `/sessions/{id}/messages` | GET | GET stays out; messages come back embedded in `GET /sessions/{id}`. **POST is now implemented.** |
| `/providers/{id}`, `/providers/{id}/health`, `/providers/{id}/models` | GET, PUT, DELETE | Only `GET /providers` and `GET /system/providers/health` are served. **`POST /providers/{id}/test` is now implemented.** |
| `/chat/completions` | POST | **Now implemented** as a proxy to a configured OpenAI-compatible endpoint. Chasm still hosts no inference of its own. |
| `/sync` | POST | Served as `/sync/*` subroutes, never as bare `POST /sync`. |
| `/harvest` | POST | **Now implemented** -- runs the incremental CLI harvest. |
| `/search/sessions`, `/search/semantic` | GET | Semantic search remains a library capability with no REST route. **`GET /search` is now implemented** as substring matching. |
| `/stats/timeline` | GET | No timeline data is stored. **`GET /stats/providers` is now implemented.** |

Seven further operations were removed from paths that are otherwise served.
Workspaces and providers stay read-only over REST; sessions did not, because the
Chat page cannot function without writing them:

| Removed | Status |
| --- | --- |
| `POST /workspaces`, `PUT /workspaces/{id}`, `DELETE /workspaces/{id}` | Still removed; `GET` only. |
| `PUT /sessions/{id}` | Still removed. |
| `POST /sessions`, `DELETE /sessions/{id}` | **Now implemented.** |
| `POST /providers` | Still removed; `GET` only. |

Determined from route registrations in `src/api/`, not by probing: this server
answers `404` for a method mismatch as well as for an unknown path, so a `404`
alone cannot tell the two apart. `api::docs` now enforces this with
`every_documented_path_is_actually_routed`, which builds the real app behind a
sentinel `default_service` and fails if any documented operation reaches it --
that test is what found the seven above.

The inverse gap is **closed for `/api`**. All 40 operations that were served
there but undocumented -- the `/swe/projects/*` tree, the inbox sub-resources,
MCP, swarms, settings accounts, `/system/health`, `/system/providers/health`,
`/stats` and `/sessions/search` -- are now in the spec, taking it from 32
operations to 72. Response shapes were read off a running server, including
creating a SWE project, a memory entry and a rule so their schemas describe
real records rather than guesses.

The root-mounted scopes are documented too. `/auth`, `/sync`, `/recording` and
`/webhooks` are registered on the App rather than inside the `/api` scope, so
each of their paths carries an OpenAPI 3 path-level `servers` override
pointing at the server root; both spec tests honour that override rather than
blindly prefixing `/api`. The spec is now 80 paths and 102 operations, up from
32 when this work started.

Those scopes are less consistent than `/api`, and the spec records it rather
than smoothing it over: `/auth` and `/sync` use the envelope, `/recording` and
`/webhooks` answer bare. `/auth` payloads are snake_case except `Subscription`,
which is camelCase, and `/sync/delta` mixes both in one object.

Two are not JSON at all and are documented as such: `/sync/subscribe` is an SSE
stream and `/recording/ws` is a WebSocket upgrade.

The enterprise scopes are documented too, with a caveat that is stated in the
spec itself. `/audit`, `/retention` and `/sso` are `#[cfg(feature =
"enterprise")]`, so a default build does not route them. Each is marked
`x-chasm-feature: enterprise`; the spec tests skip a marked path when the
feature is off and probe it normally when it is on, so an enterprise build
verifies them. On a default build the route test prints how many it skipped
rather than passing silently, and asserts the marking has not drifted onto a
path outside those three scopes.

**The build obstacle is now gone.** `samael` was replaced by the pure-Rust
`chasm-sso`, so the enterprise feature has no native dependencies and builds
anywhere cargo does. All 18 enterprise operations are verified as routed on
every platform, and 39 tests that had never run on Windows now execute.

Their response bodies remain unmodelled, but only because nobody has observed
one yet. The obstacle is removed; the work is not done.

The history below is kept because its lesson outlived the problem — the error
you can see is repeatedly not the error that stops you.

**Formerly:** the enterprise feature could not be compiled here, so no
response from these endpoints was ever observed. The blocker was a chain of
three, each hiding the next, and only the third was genuinely hard: `openssl-sys` is satisfied by pointing `OPENSSL_DIR` at any
existing OpenSSL 3.x with headers; `libxml v0.3.3` is satisfied by
`vcpkg install libxml2` plus an explicit `LIBXML2` path to the `.lib`; but
`samael` then shells out to `xmlsec1-config`, an autotools script with no
vcpkg port on Windows and no environment-variable equivalent. Past that point
you need MSYS2 or a source build of xmlsec1.

Build enterprise on Linux, which is what CI does.
`chasm-rust/docs/api/rest.md` records the exact steps for 1 and 2 so nobody
repeats the search believing OpenSSL is the problem. Every other schema in the
document was read off a running server. Guessing these would have undone that,
so each says "body not modelled" instead. Paths and methods come from the
route registrations, which are unambiguous, and are enforced by the test on
any enterprise build.

That leaves the spec at 93 paths and 120 operations, describing every route
the server registers. 102 of those operations are verified as routed on every
test run; the remaining 18 are verified only on an enterprise build.

### The spec described responses the server has never sent

Setting out to document those missing scopes turned up something worse than
the omission. **Every endpoint except `GET /health` wraps its payload in
`{success, data, error}`, and the spec documented all of them bare.** A client
generated from it failed to deserialize every response it received -- a worse
failure than a 404, because it happens after a successful request.

The field names were wrong too. The spec described a snake_case API
(`total_sessions`, `auto_harvest`, `uptime_seconds`, `database_size_bytes`)
against a server that returns camelCase, named a `sessions` array where the
server sends `items` plus `hasMore`, gave `HealthResponse.status` an enum of
`healthy|degraded|unhealthy` when the only value ever returned is `ok`, and
typed `GET /sessions/{id}` as a bare `Session` when it returns
`{session, messages, tool_invocations, file_changes}`. Of the ten documented
parameterless `GET`s, only two matched reality.

All are corrected against a live server, and
`documented_response_bodies_match_what_the_server_sends` now guards them: it
calls each documented parameterless `GET` and compares the body's top-level
keys against the schema. It compares names, not types or nested shapes, so it
catches wholesale drift rather than every detail.

Worth noting for anyone extending the spec: the API itself is inconsistent
about casing. Session fields are camelCase, but the `GET /sessions/{id}`
wrapper keys and message fields are snake_case. The spec now records that as
it is rather than tidying it, because the spec's job is to describe the server,
not to describe what the server ought to be.

### Web UI calling endpoints that do not exist

Auditing `chasm-web/src/api/client.ts` against the route registrations found 51
client methods aimed at endpoints the server does not route. Of those, 38 had no
consumer anywhere and were deleted along with their 24 hooks; one was a wrong
path against an endpoint that does exist (`/api/providers/health`, served as
`/api/system/providers/health`) and was corrected; 12 remain live.

Separately, `connectWebSocket` pointed at `/api/ws` when `/ws` is mounted at the
server root, so the socket never connected at all. Fixed.

The remaining twelve were live -- the UI called them and got a 404 -- and are
now **implemented** in `src/api/handlers_write.rs`:

| Endpoint | Notes |
| --- | --- |
| `POST /sessions`, `DELETE /sessions/{id}` | Delete also clears the session's `messages_v2` rows; that table has no cascade. |
| `POST /sessions/{id}/messages` | Appends into `session_json.requests`. An assistant reply attaches to the trailing prompt instead of opening a new exchange, so the read path pairs them correctly. |
| `GET`/`POST /sessions/{id}/checkpoints` | Backed by `api_checkpoints`, created on demand -- the harvest schema predates checkpoints. |
| `GET /sessions/{id}/commits` | Shells out to `git` in the session's workspace. Empty, not an error, when there is no repository. |
| `GET /search` | Substring over titles and `messages_v2` content. Explicitly *not* semantic: there is no embedding index behind REST. |
| `GET /stats/providers` | Real counts. Tokens report 0 rather than an estimate, because an invented number renders in the UI as fact. |
| `PUT /swarms/{id}` | `COALESCE` per field, so a partial update does not null the rest. |
| `POST /providers/{id}/test` | Measures a real request for locally hosted providers. Anything else returns 501 rather than a success that tested nothing. |
| `POST /chat/completions` | Proxies an OpenAI-compatible endpoint via `OPENAI_API_KEY`/`OPENAI_BASE_URL`. Without a key it returns 503 and says what to set -- never a canned reply. |
| `POST /harvest` | Runs the incremental CLI harvest on a blocking thread; counts come from differencing the session table. |

All twelve are in `openapi.yaml` and covered by 20 tests.

Four bugs surfaced while building this, all pre-existing:

- `ChatDatabase::initialize` detected a harvest database with
  `SELECT 1 FROM sessions LIMIT 1`, which returns no rows on an *empty* harvest
  table. A harvested-but-empty database was therefore treated as fresh, the full
  `sql/schema.sql` ran against harvest-shaped tables, and
  `CREATE INDEX idx_sessions_model ON sessions(model)` failed against a table
  with no `model` column -- so opening it errored outright. Both checks now read
  `sqlite_master`/`pragma_table_info` instead of probing for rows.
- The API server never ensured the harvest schema existed. Every read handler
  parses `sessions.session_json`, which only that schema has, so on a machine
  that had never run `chasm harvest` the session endpoints failed on a missing
  column. `start_server` now creates the harvest tables before opening.
- The harvest schema has no `workspaces` table, but `GET /api/workspaces`
  joins one -- so that endpoint answered `500` against every harvested
  install. Opening a harvest database now creates it, alongside the `agents`
  and `metadata` tables it already backfilled.
- `GET /api/system/health` checked the database with
  `conn.execute("SELECT 1")`. rusqlite's `execute` rejects any statement that
  returns rows, so the check could never succeed: the endpoint reported
  `status: degraded` and `database: error` on every install it has ever run
  on, however healthy the database was. It uses `query_row` now, and a test
  asserts the *green* path -- the only kind that catches a check which can
  never pass.
- Registering the write handlers in their own `web::scope("/api")` shadowed
  every read route: actix matches scopes in registration order, and a matching
  scope handles the request even when no resource inside it matches, so it
  never falls through to a second scope with the same prefix. The whole API
  returned 404. They now join the existing scope via
  `handlers_write::attach_write_routes`. This was caught by
  `every_documented_path_is_actually_routed`, not by hand.

Verified against a running server on a fresh database, not only by unit test:
all nineteen read routes answer 200, a message written through
`POST /sessions/{id}/messages` is visible in `GET /sessions/{id}`, and the
three refusal paths return 404/501/503 rather than a false success.

`GET /api/system/providers/health` was found in the same pass and has since
been fixed. It returned two hardcoded rows -- `copilot: connected, 45ms` and
`ollama: disconnected` -- whatever was actually running, and keyed them
`provider`/`lastCheck` where the client reads `providerId`/`lastChecked`, so
the UI's health map was keyed by `undefined` and even the invented data never
arrived. It now probes each locally hosted provider at its declared endpoint
concurrently and reports `unknown` for cloud providers, which this server holds
no credentials for and therefore cannot honestly assess.

`ShareSessionModal` -- a fully tested component that nothing rendered, driving
a share API that does not exist -- has been deleted along with its five tests.
It was never imported, so the production bundle is byte-for-byte the same size
without it, which is the clearest evidence it was dead. The `ShareLink` and
`SessionShare` types stay: `Harvest.tsx` still uses them. Session sharing over
REST remains unimplemented, and would need decisions about link expiry,
visibility and whether links leave the machine before it is worth building.

The CLI, core library, harvest/recovery pipeline, provider parsers, MCP server,
and TUI are complete. The suite is 841 passing tests on Windows (199 lib plus
integration), up from 780 as the API work above added coverage. Earlier figures
in the 880–960 range double-counted: `main.rs` re-declared modules that
`lib.rs` already owned, so their unit tests ran in both targets.

## Overview

Chasm is a unified platform for harvesting, managing, and analyzing AI chat sessions across multiple providers and tools.

---

## Components

| Component             | Status   | Description                              |
| --------------------- | -------- | ---------------------------------------- |
| **chasm-rust**        | 🟢 Active | Core Rust CLI, library, and API server   |
| **chasm-web**         | 🟢 Active | React web application                    |
| **chasm-app**         | 🟢 Active | React Native mobile app                  |
| **chasm-shared**      | 🟢 Active | Shared TypeScript types and utilities    |
| **chasm-desktop**     | 🟢 Active | Tauri app wrapping chasm-web             |
| **vscode-extension**  | 🟢 Active | VS Code extension for session management |
| **browser-extension** | 🟢 Active | Chrome/Firefox extension for web AI chat |
| **jetbrains-plugin**  | 🟢 Active | IntelliJ/JetBrains IDE plugin            |
| **neovim-plugin**     | 🟢 Active | Neovim plugin (Lua)                      |
| **vim-plugin**        | 🟢 Active | Vim plugin (VimScript)                   |
| **docs website**      | 🟢 Active | MkDocs Material documentation site       |

---

## Completed ✅

### Core Infrastructure
- [x] Rust core library with session harvesting
- [x] REST API server (port 8787)
- [x] SQLite database for session storage
- [x] Cross-platform session format support
- [x] SSE-based real-time sync (Server-Sent Events)
- [x] WebSocket support for bidirectional real-time updates
- [x] Session encryption at rest (AES-256-GCM)
- [x] Cloud sync service integration (local, S3, Azure, GCS, WebDAV)

### Web Application
- [x] Dashboard with statistics overview
- [x] Chat interface with session replay
- [x] Agent management and inbox
- [x] Workspace browser
- [x] Session explorer with filtering
- [x] Provider configuration
- [x] Harvest management
- [x] Provider comparison view
- [x] Account management
- [x] Developer tools
- [x] Research interface
- [x] Dark mode theme system (CSS variables)
- [x] Demo mode (opt-in via `VITE_ENABLE_DEMO_MODE`; never substitutes for a live backend)
- [x] Real-time sync status indicators
- [x] Advanced session search and filtering
- [x] Session diff/comparison view
- [x] Export to multiple formats (JSON, Markdown, HTML, PDF)

### Mobile Application
- [x] Basic navigation structure
- [x] Home screen
- [x] Workspace browser
- [x] Session list view
- [x] Chat interface
- [x] Provider configuration
- [x] Offline session caching
- [x] Push notifications for agent messages
- [x] Biometric authentication (Face ID, Touch ID, Fingerprint)

### VS Code Extension
- [x] Session tree view in sidebar
- [x] Quick session search
- [x] Inline session preview
- [x] One-click harvest from workspace
- [x] Orphaned session recovery
- [x] Real-time session recording (prevents data loss from crashes)
- [x] Recording API with event buffering and snapshots
- [x] Multi-provider recording support (VS Code, Cursor, Continue.dev, Claude Code, OpenCode, Windsurf, etc.)

### Documentation
- [x] Sales presentation (Typst)
- [x] Automated screenshot capture (Playwright)
- [x] README documentation
- [x] Ecosystem alignment docs
- [x] Sync CONOPS documentation
- [x] MkDocs Material documentation website (Abyss dark theme)
- [x] Custom logo and favicon SVGs

### Licensing & Governance
- [x] AGPL-3.0-only license with commercial dual-license
- [x] Contributor License Agreement (CLA)
- [x] SPDX headers across all 146 source files
- [x] Open Source Strategy documentation

### Recent Features (February 2026)
- [x] `chasm watch` — File-system monitoring for auto-harvest
- [x] `chasm run` — Agent launcher with auto-save
- [x] `chasm sync` — Bidirectional session backup/restore
- [x] Real-time session recording API (crash recovery)
- [x] Codex CLI, Droid CLI, Gemini CLI provider support
- [x] Agent skills framework

---

## In Progress 🚧

### Q1 2026

#### Browser Extension Publication
- [ ] Firefox Add-on Store publication
- [ ] Chrome Web Store publication
- [x] PNG icon generation (16, 32, 48, 128px)
- [x] Privacy policy and store listing copy

#### Documentation Website
- [x] API reference auto-generation from OpenAPI spec (Swagger UI)
- [x] Provider-specific setup guides (12 providers)
- [x] Video tutorials and screencasts (Remotion)
- [x] Search functionality (MkDocs search plugin)

#### CLI Polish
- [x] Shell completions (Bash, Zsh, Fish, PowerShell, Elvish)
- [x] `chasm doctor` — Environment diagnostics command (13+ checks)
- [x] `chasm provider` — Provider management commands
- [x] `chasm watch` — File-system monitoring with auto-harvest
- [x] Interactive TUI improvements (session browsing, export, filtering)
- [x] CLI reference documentation (watch, provider, completions, doctor)

---

## Completed ✅ (Previously Planned)

### Q1-Q2 2026

#### Enhancements
- [x] Session annotation and notes
- [x] Custom session templates
- [x] Keyboard shortcuts for power users
- [x] Batch operations (delete, archive, export)

#### Q2 2026 Features
- [x] Multi-user collaboration
- [x] Team workspaces
- [x] Session sharing with permissions
- [x] AI-powered session summarization — `chasm analyze`, model-backed with a heuristic fallback
- [x] Semantic search across sessions — backed by the OpenAI embeddings API; requires an API key
- [x] Custom tagging and organization

### Q2 2026

#### Integrations
- [x] GitHub Copilot Chat deep integration
- [x] Cursor IDE support
- [x] Continue.dev support
- [x] Claude Desktop/API
- [x] ChatGPT API
- [x] Local LLM providers (Ollama, LM Studio, etc.)

#### Platform
- [x] Desktop application (Tauri) — wraps chasm-web with an in-process API server
- [x] CLI tool for automation (chasm-cli v1.3.2 on crates.io)
- [x] Browser extension for web-based AI tools (Chrome/Firefox Manifest V3)

### Q3 2026

#### Enterprise Features
- [~] SSO/SAML authentication (SAML 2.0 IdP integration) — flow and signature verification done; blocked on `DatabaseOps` persistence
- [~] Audit logging (comprehensive event tracking) — no `DatabaseOps` implementor, nothing persists
- [~] Data retention policies (configurable lifecycle management) — no `DatabaseOps` implementor, nothing persists
- [~] Admin dashboard (React admin UI with system management) — the agent-inbox view has no backend
- [x] Usage analytics (event tracking, metrics, time series, dashboards)

#### Advanced Features
- [x] Session branching and merging (fork, merge with conflict resolution)
- [x] Version control for conversations (commits, diff, tags, checkout/revert)
- [x] Automated backup scheduling (cron schedules, multi-destination, retention)
- [x] Cross-device sync (CRDT-based, offline-first, conflict resolution)

### Q4 2026

#### Sync Completion
- [x] Bidirectional sync engine (push/pull with change tracking)
- [x] Conflict resolution strategies (LocalWins, RemoteWins, MostRecent, Manual)
- [x] Provider-specific sync adapters (VSCode, extensible to others)

#### AI & Intelligence
- [~] Topic extraction and categorization (keyword substring matching, not model-backed)
- [x] Conversation insights generation
- [~] Sentiment analysis (lexicon-based, not model-backed)
- [x] Quality scoring for sessions
- [~] Similarity detection (Jaccard-based, not model-backed)
- [x] Session recommendation engine

#### Platform Maturity
- [x] Plugin system architecture (manifest, lifecycle, event hooks)
- [x] Workflow automation engine (triggers, conditions, actions)
- [x] Extended provider support (GPT4All, Jan, LM Studio, LocalAI, TextGen WebUI)

### Q1 2027

#### Browser Extension Enhancement
- [x] Additional provider content scripts (Copilot, Poe, Perplexity)
- [x] Auto-harvest with configurable schedules
- [x] Firefox Manifest V2 compatibility

#### API Enhancements
- [x] GraphQL API endpoint — mounted at /graphql with database-backed resolvers
- [x] Webhook integrations
- [x] OpenAPI/Swagger documentation

### Q2 2027

#### AI Agents
- [x] Autonomous session archival agent
- [x] Context-aware search refinement

#### Ecosystem
- [x] JetBrains IDE plugin
- [x] Neovim/Vim plugin

### Q3 2027

#### Team Features
- [x] Workspace sharing and permissions
- [x] Team session templates
- [~] Audit logging for compliance — see Known gaps

#### Analytics Dashboard
- [x] Usage metrics and insights
- [x] Cost tracking per provider
- [x] Productivity analytics

### Q4 2027

#### Advanced AI Routing
- [x] Multi-model orchestration
- [x] Cost-optimized routing
- [x] Fallback chain configuration

#### Enterprise Scale
- [x] Multi-region deployment
- [x] High availability configuration
- [x] Performance monitoring

### Q1 2028

#### Mobile Enhancements
- [x] Background sync optimization
- [x] Widget support (iOS/Android)
- [x] Offline-first architecture improvements

#### Performance & Scale
- [x] Database sharding support
- [x] Edge caching layer
- [x] Connection pooling improvements

#### Developer Experience
- [x] SDK generator for custom integrations
- [x] API rate limiting dashboard
- [x] Enhanced debugging tools
---

## Provider Support Matrix

| Provider            | Harvest | View | Sync | Status  |
| ------------------- | ------- | ---- | ---- | ------- |
| GitHub Copilot Chat | ✅       | ✅    | 🚧    | Primary |
| VS Code Copilot     | ✅       | ✅    | 🚧    | Primary |
| Cursor              | ✅       | ✅    | 📋    | Active  |
| ClaudeCode          | ✅       | ✅    | 📋    | Active  |
| Codex CLI (OpenAI)  | ✅       | ✅    | 📋    | Active  |
| Droid CLI (Factory) | ✅       | ✅    | 📋    | Active  |
| Gemini CLI (Google) | ✅       | ✅    | 📋    | Active  |
| OpenCode            | ✅       | ✅    | 📋    | Active  |
| OpenClaw            | ✅       | ✅    | 📋    | Active  |
| Antigravity         | ✅       | ✅    | 📋    | Active  |
| Continue.dev        | ✅       | 📋    | 📋    | Active  |
| ChatGPT             | ✅       | ✅    | 📋    | Active  |
| GPT4All             | ✅       | ✅    | 📋    | Active  |
| Jan                 | ✅       | ✅    | 📋    | Active  |
| LlamaFile           | ✅       | ✅    | —    | Active  |
| LM Studio           | ✅       | ✅    | 📋    | Active  |
| LocalAI             | ✅       | ✅    | —    | Active  |
| Ollama              | ✅       | ✅    | 📋    | Active  |
| Text Gen WebUI      | ✅       | ✅    | 📋    | Active  |
| vLLM                | ✅       | ✅    | —    | Active  |

**Legend:** ✅ Complete | 🚧 In Progress | 📋 Planned

---

## Recent Changes

### February 2026 (v1.3.2)

#### License & Governance
- Switched to AGPL-3.0-only with commercial dual-license
- Created Contributor License Agreement (CLA)
- Updated SPDX headers across all 146 source files

#### Documentation Website
- MkDocs Material documentation site with Abyss dark theme
- Custom SVG logo and favicon (bridge/void gradient)
- Sections: Getting Started, Guides, API Reference, Providers
- Dark mode default, homepage hero with project stats

#### New CLI Commands
- `chasm watch` — File-system monitoring with auto-harvest on session changes
- `chasm run` — Agent launcher with auto-save capabilities
- `chasm sync` — Bidirectional session backup/restore

#### New Providers
- Codex CLI (OpenAI) — JSONL sessions in `~/.codex/sessions/`
- Droid CLI (Factory) — JSONL sessions in `~/.factory/sessions/`
- Gemini CLI (Google) — JSON sessions in `~/.gemini/tmp/`

#### Real-time Recording API (v1.3.2)
- Session recording to prevent data loss from editor crashes
- Event buffering: SessionStart, MessageAdd, MessageAppend, Heartbeat
- Snapshot storage for full session recovery
- Multi-provider recording (VS Code, Cursor, Continue.dev, Claude Code, etc.)

#### Agent Skills Framework
- Agent skills system for extensible AI tool integration
- SpecStory comparison documentation

### February 2026 (v1.1.0 Multi-Provider Forensics)

#### Multi-Provider Session Forensics (chasm-rust)
- Added cross-provider session discovery and analysis
- New providers: ClaudeCode, OpenCode, OpenClaw, Antigravity
- Commands support `--provider` and `--all-providers` flags:
  - `chasm list sessions` - List sessions from specific or all providers
  - `chasm list agents` - List agent mode sessions across providers
  - `chasm show timeline` - Aggregate timeline visualization
  - `chasm find session` - Search across all providers
- Cross-platform storage detection (Windows, macOS, Linux)
- Provider aliases: `claudecode`/`claude`, `opencode`, `openclaw`/`claw`, `antigravity`/`ag`

#### JSONL Format Support (chasm-rust)
- Handle VS Code 1.109.0+ event-sourced session format
- Automatic detection and parsing of `.jsonl` session files  
- Session state reconstruction from event streams

### February 2027 (Q2 2027 AI Agents and Ecosystem)

#### Autonomous Agents (chasm-rust)
- Created archival.rs (~521 lines) - Autonomous session archival agent
  - ArchivalPolicy with configurable inactivity thresholds, message counts, provider filters
  - ArchivalCandidate for session evaluation with priority scoring
  - ArchivalDecision with confidence scoring and reasoning
  - Policy matching for exclude/include tags (pinned, important, archive)
- Created search_refinement.rs (~584 lines) - Context-aware search refinement
  - SearchContext with recent queries, sessions, workspace, provider history
  - QueryRefinement suggestions with confidence scores
  - RefinementType: Specificity, Broadening, Correction, Synonyms, Contextual, Temporal
  - EnrichedSearchResult with relevance scoring

#### JetBrains Plugin (jetbrains-plugin)
- Created Kotlin/IntelliJ plugin with Gradle build
- Implemented ChasmService for server communication
- Added actions: Harvest, Sync, Search, SaveToSession, OpenSettings
- Created tool window panel with session browser
- Settings configurable for server URL and sync options

#### Vim Plugin (vim-plugin)
- Created vim-plug/Vundle/Pathogen compatible plugin
- Autoload functions for HTTP requests via curl
- Commands: ChasmHealth, ChasmHarvest, ChasmSync, ChasmStats, ChasmSearch, ChasmSessions, ChasmView
- Quickfix list integration for session browsing
- Configurable keymaps with leader prefix

### February 2028 (Q1 2028 Performance & Developer Experience)

#### Mobile Enhancements (chasm-app)
- Created backgroundSync.ts (~450 lines) - Battery-optimized background sync
  - SyncConfig with WiFi-only, charging-only, battery level, quiet hours settings
  - SyncQueueItem with priority levels (high/normal/low) and retry tracking
  - BackgroundSyncService with condition checking and scheduling
  - Platform-specific background tasks for iOS (BGTaskScheduler) and Android (WorkManager)
- Created widgetService.ts (~400 lines) - iOS/Android home screen widgets
  - Widget types: quick_stats, recent_sessions, quick_actions, search, favorites, provider_status
  - WidgetConfig with refresh intervals and theme support
  - Native module integration for widget updates and interactions

#### Database Scaling (chasm-rust)
- Created scaling.rs (~500 lines) - Sharding and read replica support
  - ShardingStrategy: Hash, Range, Tenant, Geographic, RoundRobin, Custom
  - ConsistentHashRing for distributed key routing
  - ShardRouter for query routing with scatter-gather support
  - ReplicaManager with health checking and lag monitoring
  - ScalingManager for unified read/write connection routing

#### Edge Caching (chasm-rust)
- Created api/caching.rs (~500 lines) - CDN and caching layer
  - CacheBackend: Memory, Redis, Memcached, File
  - CDN integration: Cloudflare, Fastly, CloudFront, Akamai, BunnyCDN
  - EdgeCacheManager with LRU eviction and TTL support
  - CacheMiddleware for API response caching
  - Pattern-based invalidation and CDN purge

#### SDK Generator (chasm-rust)
- Created api/sdk.rs (~700 lines) - Multi-language SDK generation
  - Supported languages: Python, Node.js, Go, Rust, Java, C#, Ruby, PHP
  - Python SDK with async/sync clients, Pydantic types, httpx
  - Node.js SDK with TypeScript, axios, proper error handling
  - Go SDK with idiomatic services pattern and resty client
  - API endpoint and type definitions for code generation
### February 2026 (Q4 2026 Platform Maturity)

#### Sync Engine (chasm-rust)
- Created bidirectional sync module with conflict resolution
- Implemented SessionSyncState tracking with hash-based change detection
- Added conflict strategies: LocalWins, RemoteWins, MostRecent, KeepBoth, Manual
- Created VSCodeSyncAdapter for Copilot Chat sessions

#### AI Intelligence (chasm-rust)
- Created intelligence module with AI-powered analysis
- Implemented TopicExtractor for keyword-based topic detection
- Added InsightsGenerator for conversation key points
- Created SentimentAnalyzer with lexicon-based scoring
- Implemented QualityScorer for session quality metrics
- Added SimilarityDetector using Jaccard similarity

#### Plugin System (chasm-rust)
- Created extensible plugin architecture (~650 lines)
- Implemented PluginManifest with permissions and metadata
- Added PluginManager for lifecycle management
- Created event hook system with priority ordering
- Implemented PluginRegistry for discovery

#### Workflow Automation (chasm-rust)
- Created automation engine (~960 lines)
- Implemented triggers: Event, Schedule, Interval, Manual
- Added conditions: And, Or, Not, Compare, TimeWindow, Matches
- Created actions: Export, Archive, Sync, Harvest, Notify, Shell, Http
- Added workflow execution engine with run tracking

#### Provider Expansion (chasm-rust)
- Enhanced GPT4All provider with session harvesting
- Enhanced Jan provider with session harvesting
- Enhanced LM Studio provider with session harvesting
- Enhanced LocalAI provider with session harvesting
- Enhanced Text Gen WebUI provider with session harvesting

### February 2026 (Q2 2026 Provider Sprint)

#### Providers (chasm-rust)
- Verified Cursor IDE provider implementation
- Verified ChatGPT cloud provider implementation
- Verified Ollama local LLM provider implementation
- All providers registered in ProviderRegistry
- Built and verified Tauri desktop application

### January 2026 (Q2 2026 Features Sprint)

#### Shared Types (chasm-shared)
- Created collaboration types: users, teams, presence, cursors, permissions
- Created summarization types: AI providers, templates, session summaries
- Created semantic search types: embeddings, vector stores, hybrid search

#### Web Application (chasm-web)
- Added PresenceIndicator component for real-time user presence
- Added TeamWorkspacePanel for team management with invitations and roles
- Added ShareSessionModal for session sharing with granular permissions
- Added SessionSummaryPanel for AI-generated summary display
- Added SemanticSearchPanel for advanced natural language search

### January 2026 (Q1 Completion Sprint)

#### Infrastructure
- Added WebSocket handler for bidirectional real-time communication
- Implemented AES-256-GCM session encryption at rest
- Created cloud sync service with multi-provider support
- Added PBKDF2 key derivation for secure password-based encryption

#### Web Application
- Created ExportModal component with JSON/Markdown/HTML/PDF export
- Implemented AdvancedSearch component with multi-filter support
- Added SessionDiff component for side-by-side comparison
- Created SyncStatus components (indicator and panel)

#### Mobile Application
- Implemented biometric authentication service (Face ID, Touch ID, Fingerprint)
- Added offline session caching with AsyncStorage
- Created network state tracking for offline mode

#### VS Code Extension
- Added harvest commands (harvest, harvestScan)
- Implemented session search command
- Added orphaned session recovery
- Created session preview command

#### Previous
- Fixed dark mode styling in AgentInbox component
- Implemented demo mode with mock data fallback
- Automated screenshot capture for documentation
- Updated sales presentation with new screenshots

---

## Contributing

See [CONTRIBUTING.md](chasm-rust/CONTRIBUTING.md) for guidelines on contributing to this project. All contributors must agree to the [CLA](CLA.md).

## License

This project is licensed under [AGPL-3.0-only](LICENSE) with a [commercial dual-license](COMMERCIAL_LICENSE.md) available.




