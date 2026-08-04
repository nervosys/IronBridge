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
| `GET` | `/api/v1/agents` | List all agents |
| `POST` | `/api/v1/agents` | Create an agent |
| `GET` | `/api/v1/agents/:id` | Get agent details |
| `PUT` | `/api/v1/agents/:id` | Update an agent |
| `DELETE` | `/api/v1/agents/:id` | Delete an agent |
| `POST` | `/api/v1/agents/:id/clone` | Clone an agent |

#### Create Agent

```bash
curl -X POST http://localhost:8787/api/v1/agents \
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
| `GET` | `/api/v1/swarms` | List all swarms |
| `POST` | `/api/v1/swarms` | Create a swarm |
| `POST` | `/api/v1/swarms/:id/start` | Start swarm execution |
| `POST` | `/api/v1/swarms/:id/pause` | Pause swarm |
| `POST` | `/api/v1/swarms/:id/resume` | Resume swarm |
| `POST` | `/api/v1/swarms/:id/stop` | Stop swarm |

#### Create and Run a Swarm

```bash
# Create
curl -X POST http://localhost:8787/api/v1/swarms \
  -H "Content-Type: application/json" \
  -d '{
    "name": "dev-team",
    "coordinator": "tech-lead",
    "workers": ["frontend-dev", "backend-dev", "tester"],
    "description": "Full-stack development team"
  }'

# Start
curl -X POST http://localhost:8787/api/v1/swarms/{id}/start \
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
