# REST API

Start the REST API server to integrate Chasm with web apps, mobile apps, or custom tooling.

```bash
chasm api serve --host 0.0.0.0 --port 8787
```

## Base URL

```
http://localhost:8787
```

All endpoints return JSON with a consistent envelope:

```json
{
  "success": true,
  "data": { ... }
}
```

---

## Core Endpoints

### Health Check

```http
GET /api/health
```

Returns server status and version.

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.3.2"
  }
}
```

---

### Workspaces

#### List Workspaces

```http
GET /api/workspaces
```

Returns all discovered workspaces.

```bash
curl http://localhost:8787/api/workspaces
```

```json
{
  "success": true,
  "data": [
    {
      "id": "abc123",
      "name": "my-project",
      "provider": "copilot",
      "sessions": 15,
      "updated": "2026-01-08T12:00:00Z"
    }
  ]
}
```

#### Get Workspace Details

```http
GET /api/workspaces/:id
```

Returns a workspace with its session list.

---

### Sessions

#### List Sessions

```http
GET /api/sessions
```

Query parameters:

| Parameter | Type | Description |
|---|---|---|
| `workspace` | `string` | Filter by workspace ID |
| `limit` | `integer` | Max results (default: 50) |
| `offset` | `integer` | Pagination offset |

#### Get Session

```http
GET /api/sessions/:id
```

Returns a full session including all messages.

```bash
curl http://localhost:8787/api/sessions/abc123-def4-5678
```

#### Search Sessions

```http
GET /api/sessions/search?q=<query>
```

Full-text search across session content.

| Parameter | Type | Description |
|---|---|---|
| `q` | `string` | Search query (required) |
| `limit` | `integer` | Max results (default: 20) |

```bash
curl "http://localhost:8787/api/sessions/search?q=authentication&limit=10"
```

---

### Statistics

```http
GET /api/stats
```

Returns aggregate database statistics.

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

---

### Providers

```http
GET /api/providers
```

Lists all supported providers and their detection status.

---

## Recording API

The recording API captures chat sessions in real time via events and snapshots.

### Send Recording Events

```http
POST /api/recording/events
```

Stream individual conversation events (message sent, tool called, etc.) for real-time capture.

```bash
curl -X POST http://localhost:8787/api/recording/events \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "abc123",
    "event_type": "message",
    "data": {
      "role": "user",
      "content": "How do I implement auth?"
    }
  }'
```

### Store Session Snapshot

```http
POST /api/recording/snapshot
```

Store a complete session snapshot (useful for periodic saves).

### List Active Recording Sessions

```http
GET /api/recording/sessions
```

### Get Recorded Session

```http
GET /api/recording/sessions/:id
```

### Recover After Crash

```http
GET /api/recording/recovery
```

Recovers in-flight sessions that were interrupted by a crash or restart.

### Recording Status

```http
GET /api/recording/status
```

Returns the recording service health and active session count.

---

## Agency API

Full CRUD operations for AI agents and swarm orchestration.

### Agents

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/agents` | List all agents |
| `POST` | `/api/agents` | Create an agent |
| `GET` | `/api/agents/:id` | Get agent details |
| `PUT` | `/api/agents/:id` | Update an agent |
| `DELETE` | `/api/agents/:id` | Delete an agent |
| `POST` | `/api/agents/:id/clone` | Clone an agent |

#### Create Agent

```bash
curl -X POST http://localhost:8787/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "code-assistant",
    "instruction": "You are a helpful coding assistant specializing in Rust.",
    "role": "coder",
    "model": "gemini-2.0-flash",
    "temperature": 0.3,
    "tools": ["file_read", "file_write", "terminal"]
  }'
```

### Swarms

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/swarms` | List all swarms |
| `POST` | `/api/swarms` | Create a swarm |
| `POST` | `/api/swarms/:id/start` | Start swarm execution |
| `POST` | `/api/swarms/:id/pause` | Pause swarm |
| `POST` | `/api/swarms/:id/resume` | Resume swarm |
| `POST` | `/api/swarms/:id/stop` | Stop swarm |

#### Create and Run a Swarm

```bash
# Create
curl -X POST http://localhost:8787/api/swarms \
  -H "Content-Type: application/json" \
  -d '{
    "name": "dev-team",
    "coordinator": "tech-lead",
    "workers": ["frontend-dev", "backend-dev", "tester"],
    "description": "Full-stack development team"
  }'

# Start
curl -X POST http://localhost:8787/api/swarms/{id}/start \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Build a todo app with user authentication"}'
```

---

## Agent Inbox API

Notifications, agent messages, permission requests and workflow runs. The
agency runtime writes to this as it executes agents; these endpoints are the
read side plus the user's responses.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/inbox` | All four collections in one response |
| `GET` | `/api/inbox/counts` | Unread and pending counts for badges |
| `GET` | `/api/inbox/notifications` | Notifications only |
| `POST` | `/api/inbox/notifications/:id/read` | Mark one read |
| `POST` | `/api/inbox/notifications/:id/dismiss` | Dismiss one |
| `POST` | `/api/inbox/notifications/read-all` | Mark every unread one read |
| `GET` | `/api/inbox/messages` | Agent messages |
| `POST` | `/api/inbox/messages/:id/read` | Mark read |
| `POST` | `/api/inbox/messages/:id/star` | Toggle the star |
| `POST` | `/api/inbox/messages/:id/archive` | Archive |
| `POST` | `/api/inbox/messages/:id/respond` | Reply to a message |
| `GET` | `/api/inbox/permissions` | Permission requests |
| `POST` | `/api/inbox/permissions/:id/respond` | Approve or deny |
| `GET` | `/api/inbox/workflows` | Workflow runs |

### Permission expiry

Requests carry an expiry, and it is applied **on read**: a request whose
deadline has passed reports `expired` even though it is still stored as
`pending`. Without that, a lapsed request would sit in the UI looking
approvable long after the agent that raised it had moved on.

Responding to an expired request returns `409 Conflict` rather than a
misleading success:

```bash
curl -X POST http://localhost:8787/api/inbox/permissions/{id}/respond \
  -H "Content-Type: application/json" \
  -d '{"approved": true, "scope": "run", "note": "looks safe"}'
```

`scope` is one of `once`, `session`, `run`, `always`. Mutating an id that does
not exist returns `404`, so a caller can distinguish "recorded" from "no such
record" instead of getting `200` either way.

---

## WebSocket

For real-time recording, connect via WebSocket:

```
ws://localhost:8787/ws/recording
```

Events are streamed bi-directionally — the client sends conversation events, and the server acknowledges with recording confirmations.

---

## Error Handling

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Session not found"
  }
}
```

| HTTP Status | Meaning |
|---|---|
| `200` | Success |
| `400` | Bad request / invalid parameters |
| `404` | Resource not found |
| `500` | Internal server error |

---

## Spec coverage

As of spec version 2.0.0, `openapi.yaml` documents only endpoints the server
actually routes. Twenty paths and seven further operations that had been
documented but never implemented were removed; a client generated from the spec
no longer emits methods that 404 on every call. The removed list, and why each
one went, is kept in
[`ROADMAP.md`](../../../ROADMAP.md#rest-surface-removed-from-the-spec-in-200).

Sessions are now writable over REST -- create, delete, append messages,
checkpoints and commits all exist. Workspaces and providers remain
**read-only**: the `POST`, `PUT` and `DELETE` operations the spec once
advertised on those paths were never implemented, and use the CLI instead.

Three endpoints deliberately refuse rather than guess:

- `POST /chat/completions` returns `503` when no model is configured, naming
  `OPENAI_API_KEY`. It never substitutes a canned reply.
- `POST /providers/{id}/test` returns `501` for any provider whose endpoint
  this server cannot reach, rather than a `success: true` that tested nothing.
- `GET /stats/providers` reports `tokens: 0` where the store holds no token
  counts, rather than estimating one.

`GET /search` is substring matching over titles and message content. Semantic
search remains a library capability with no REST route.

### Scopes outside `/api`

`/auth`, `/sync`, `/recording` and `/webhooks` are registered on the App, not
inside the `/api` scope, so they sit at the server root: `POST /auth/login`,
not `POST /api/auth/login`. In `openapi.yaml` each of those paths carries a
path-level `servers` override; the spec tests read it rather than assuming the
global base.

They are also less uniform than `/api`. `/auth` and `/sync` use the response
envelope; `/recording` and `/webhooks` answer bare. `/auth` payloads are
snake_case except the subscription object, which is camelCase. `/sync/delta`
mixes both in a single object. `/sync/subscribe` is an SSE stream and
`/recording/ws` is a WebSocket upgrade, so neither is JSON.

The enterprise scopes (`/audit`, `/retention`, `/sso`) are feature-gated and
are deliberately absent from the spec: documenting them unconditionally would
fail the route test on a default build.

### Adding a route

Add it to the **existing** `web::scope("/api")` in `api::mod::configure_routes`
(the write handlers do this via `handlers_write::attach_write_routes`). Do not
register a second `web::scope("/api")`.

Actix matches scopes in registration order, and a scope whose prefix matches
handles the request even when no resource inside it matches -- it does not fall
through to a later scope with the same prefix. A second `/api` scope registered
first therefore shadows every route in the other one, and the entire API
returns 404. `/api/inbox` is the exception that proves the rule: its prefix is
narrower, so it can only shadow paths that are genuinely its own.

### Response envelope

Every endpoint **except `GET /health`** wraps its payload:

```json
{ "success": true, "data": { ... }, "error": null }
```

Errors carry `{"success": false, "error": "..."}` with no `data` key. `/health`
alone answers bare, with `{"status": "ok", "version": "..."}`.

The spec documented the payloads bare until 2.0.0, so a generated client failed
to deserialize every response it received -- a worse failure than a 404, since
it happens *after* a successful request. It was also wrong about field names:
it described a snake_case API (`total_sessions`, `auto_harvest`,
`uptime_seconds`) where the server returns camelCase, and named a `sessions`
array on the list endpoints where the server sends `items` plus `hasMore`.

Two tests keep this honest, and both found real bugs on their first run:

- `every_documented_path_is_actually_routed` builds the real app behind a
  sentinel `default_service` and fails if any documented operation reaches it.
  It caught the scope-shadowing bug below.
- `documented_response_bodies_match_what_the_server_sends` calls each
  documented parameterless `GET` and compares the body's top-level keys with
  the schema. It compares names only, not types or nested shapes, so it catches
  wholesale drift rather than every detail. `published_docs_copy_matches_the_served_spec`
covers the other half -- `docs/assets/openapi.yaml`, which MkDocs publishes, is
a copy of the root spec and had silently drifted a full release behind it.

Two things that trip people up, now that those paths are gone:

- Search is `GET /api/sessions/search?q=`, not `/api/search`. Semantic search
  exists as a library capability with no REST route.
- Harvest and export are CLI-only (`chasm harvest`, `chasm export`).

The spec is still narrower than the server. `/swarms`, the `/swe/projects/*`
tree, and the `/auth`, `/sync`, `/recording`, `/webhooks`, `/audit`,
`/retention`, and `/sso` scopes are all served but undocumented.

When checking whether something is served, read the route registrations in
`src/api/` rather than probing: this server answers `404` for a method mismatch
as well as for an unknown path, so a `404` alone cannot tell the two apart. That
is also why `/workspaces/{id}` was briefly and wrongly listed as missing -- it
returns `404` for an unknown id, which looks identical to an absent route.
