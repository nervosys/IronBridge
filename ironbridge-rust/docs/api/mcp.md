# MCP Server

IronBridge provides a [Model Context Protocol](https://modelcontextprotocol.io/) server, allowing AI agents and coding assistants to query your session database directly.

## Starting the MCP Server

```bash
ironbridge mcp serve
```

The MCP server communicates over `stdio`, making it compatible with any MCP client (Claude Desktop, VS Code extensions, custom agents, etc.).

## Available Tools

### `ironbridge_list_workspaces`

List all discovered workspaces.

**Parameters:** None

**Returns:** Array of workspaces with name, provider, session count, and last updated timestamp.

```json
{
  "workspaces": [
    {
      "id": "abc123",
      "name": "my-project",
      "provider": "copilot",
      "sessions": 15,
      "updated": "2026-01-08"
    }
  ]
}
```

---

### `ironbridge_list_sessions`

List sessions, optionally filtered by workspace.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `workspace_id` | `string` | No | Filter by workspace |

**Returns:** Array of sessions with ID, title, message count, and timestamps.

---

### `ironbridge_get_session`

Get the full content of a specific session including all messages.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `session_id` | `string` | Yes | Session identifier |

**Returns:** Full session object with all messages, role annotations, tool invocations, and metadata.

---

### `ironbridge_search_sessions`

Full-text search across all harvested sessions.

**Parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | Yes | Search query |
| `limit` | `integer` | No | Max results (default: 10) |

**Returns:** Matching sessions with relevance-ranked excerpts.

---

### `ironbridge_get_stats`

Get aggregate statistics about the session database.

**Parameters:** None

**Returns:** Total counts for sessions, messages, workspaces, and tool invocations.

```json
{
  "totalSessions": 330,
  "totalMessages": 19068,
  "totalWorkspaces": 138,
  "totalToolInvocations": 122712
}
```

---

## Client Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ironbridge": {
      "command": "ironbridge",
      "args": ["mcp", "serve"]
    }
  }
}
```

### VS Code (Copilot MCP)

Add to your VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcpServers": {
    "ironbridge": {
      "command": "ironbridge",
      "args": ["mcp", "serve"]
    }
  }
}
```

### Custom MCP Client

Any MCP-compatible client can connect by spawning the `ironbridge mcp serve` process and communicating over `stdio` using the MCP protocol.

---

## Use Cases

### Contextual Code Assistance

An AI assistant uses `ironbridge_search_sessions` to find previous conversations about a topic before answering:

> "Before I help you with authentication, let me check your previous sessions..."  
> *Searches for "authentication" → finds 3 relevant sessions → incorporates context*

### Project Onboarding

A team member uses an MCP-connected agent to understand project history:

> "What decisions were made about the database schema?"  
> *Agent searches sessions → finds architecture discussions → summarizes decisions*

### Knowledge Retrieval

Query your entire AI conversation history as a knowledge base:

> "Have I solved a similar bug before?"  
> *Agent searches for error messages → finds previous debugging sessions → suggests fix*
