# MCP Server

IronBridge provides a [Model Context Protocol](https://modelcontextprotocol.io/) server, allowing AI agents and coding assistants to query your session database directly.

## Starting the MCP Server

```bash
ironbridge-mcp
```

`ironbridge-mcp` is a separate binary, built alongside `ironbridge`. There is no `ironbridge mcp` subcommand — `ironbridge` will answer `unrecognized subcommand 'mcp'`.

The server communicates over `stdio`, making it compatible with any MCP client (Claude Desktop, VS Code extensions, custom agents, etc.). It reports itself as `ironbridge-mcp` and speaks protocol version `2024-11-05`.

## Available Tools

Sixteen tools, in two groups.

The `ironbridge_*` tools read **VS Code's on-disk workspace storage** directly and can write back to its index. The `ironbridge_db_*` tools read the **harvested IronBridge database** that the rest of IronBridge serves. They answer different questions from different sources, so a session visible to one is not necessarily visible to the other.

Every name below is verbatim from the server's own `tools/list` response.

### Workspace tools

#### `ironbridge_list_workspaces`

List all VS Code workspaces with chat sessions.

**Parameters:** None

#### `ironbridge_find_workspace`

Find workspaces matching a pattern (project name or path).

**Parameters:**

- `pattern` (string, **required**) — search pattern to match workspace names or paths

#### `ironbridge_list_sessions`

List all chat sessions, optionally filtered by project path.

**Parameters:**

- `project_path` (string) — optional project path to filter sessions

#### `ironbridge_list_orphaned`

List sessions on disk that are not in VS Code's index (invisible sessions).

**Parameters:**

- `path` (string) — project path, defaults to the current directory

#### `ironbridge_show_session`

Show details of a specific chat session.

**Parameters:**

- `session_id` (string, **required**) — supports partial prefix match

#### `ironbridge_show_history`

Show chat history timeline for a project.

**Parameters:**

- `path` (string) — project path, defaults to the current directory

#### `ironbridge_search`

Full-text search across all harvested chat sessions.

**Parameters:**

- `query` (string, **required**) — search query
- `limit` (integer) — maximum number of results, default 20

#### `ironbridge_detect`

Auto-detect workspace and available providers for a path.

**Parameters:**

- `path` (string) — path to detect workspace for

### Tools that write to VS Code's index

These three modify VS Code's state. Each takes a `force` flag because writing while VS Code is running can be overwritten by the editor.

#### `ironbridge_register_all`

Register all sessions from a workspace into VS Code's index.

**Parameters:**

- `path` (string) — project path, defaults to the current directory
- `merge` (boolean) — merge all sessions into one before registering
- `force` (boolean) — register even if VS Code is running

#### `ironbridge_register_sessions`

Register specific sessions by ID or title.

**Parameters:**

- `ids` (array) — session IDs to register
- `titles` (array) — session titles to match (partial match)
- `path` (string) — project path, defaults to the current directory
- `force` (boolean) — register even if VS Code is running

#### `ironbridge_merge_sessions`

Merge multiple chat sessions into one unified history.

**Parameters:**

- `path` (string) — project path to merge sessions from
- `title` (string) — title for the merged session
- `force` (boolean) — merge even if VS Code is running

### Database tools

These read the harvested IronBridge database.

#### `ironbridge_db_list_workspaces`

List all workspaces from the IronBridge database.

**Parameters:** None

#### `ironbridge_db_list_sessions`

List chat sessions from the IronBridge database.

**Parameters:**

- `workspace_id` (string) — filter by workspace ID
- `provider` (string) — filter by provider, e.g. `copilot`, `ollama`, `chatgpt`
- `limit` (integer) — maximum results, default 100

#### `ironbridge_db_get_session`

Get a specific session with all its messages from the IronBridge database.

**Parameters:**

- `session_id` (string, **required**) — session ID to retrieve

#### `ironbridge_db_search`

Search sessions in the IronBridge database **by title**. This is a title search, not a full-text search over message bodies — for that, use `ironbridge_search`.

**Parameters:**

- `query` (string, **required**) — search query for session titles
- `limit` (integer) — maximum results, default 20

#### `ironbridge_db_stats`

Get statistics about the IronBridge database (session counts by provider).

**Parameters:** None

## Resources

The server also exposes read-only resources: `ironbridge://workspaces`, `ironbridge://sessions`, `ironbridge://orphaned`, `ironbridge://providers`, `ironbridge://db/workspaces`, `ironbridge://db/sessions`, `ironbridge://db/stats`, and `ironbridge://workspace/{hash}`.

`ironbridge://providers` is a static catalogue of the provider kinds IronBridge can harvest from. It does not report which providers are installed or detected on this machine — for that, use `ironbridge_detect`.

`ironbridge://orphaned` returns a pointer to `ironbridge_list_orphaned` rather than a result, because orphan detection needs a specific workspace path and the resource URI carries none.

## Client Configuration

### Claude Desktop

```json
{
  "mcpServers": {
    "ironbridge": {
      "command": "ironbridge-mcp"
    }
  }
}
```

The key under `mcpServers` is a label of your choosing; the `command` must be the real binary name, `ironbridge-mcp`.

## Use Cases

An AI assistant uses `ironbridge_search` to find previous conversations about a topic before answering, or `ironbridge_db_stats` to report which providers a user's history actually comes from.

`ironbridge_list_orphaned` followed by `ironbridge_register_all` recovers sessions that exist on disk but that VS Code has dropped from its index.

## Keeping this page honest

`ironbridge-rust/src/api/docs.rs` holds a test that compares every `#### \`ironbridge_...\`` heading here against the server's tool registry and fails if either side gains, loses or renames a tool.

That test exists because this page previously documented `ironbridge_list_workspaces`, `ironbridge_get_session`, `ironbridge_search_sessions` and `ironbridge_get_stats`, and told readers to start the server with `ironbridge mcp serve`. None of those names has ever existed: the prefix is `ironbridge_`, two of the four tools have no counterpart under any prefix, and there is no `mcp` subcommand. An assistant following this page failed at the first step.
