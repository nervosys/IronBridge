# Cursor IDE Demo

Demo chat sessions in Cursor IDE format.

## Format

Cursor stores conversations in its own JSON format:

```json
{
  "id": "uuid",
  "title": "Session Title",
  "created_at": "2024-12-08T10:00:00Z",
  "workspace": "/path/to/project",
  "messages": [
    {
      "id": "msg-id",
      "role": "user|assistant",
      "content": "Message content",
      "timestamp": "2024-12-08T10:00:00Z"
    }
  ],
  "model": "cursor-fast",
  "provider": "cursor"
}
```

## Storage Location

- **Windows**: `%APPDATA%\Cursor\User\workspaceStorage\`
- **macOS**: `~/Library/Application Support/Cursor/User/workspaceStorage/`
- **Linux**: `~/.config/Cursor/User/workspaceStorage/`

## Usage

```bash
# Import Cursor sessions
ironbridge provider import cursor --source examples/cursor/sessions

# List imported sessions
ironbridge list sessions --provider cursor
```

