# GitHub Copilot Demo

Demo chat sessions in VS Code Copilot Chat format.

## Format

VS Code Copilot stores chat sessions in JSON files with this structure:

```json
{
  "version": 3,
  "sessionId": "uuid",
  "creationDate": 1733616000000,
  "lastMessageDate": 1733619600000,
  "isImported": false,
  "initialLocation": "panel",
  "customTitle": "Session Title",
  "requests": [
    {
      "time": 1733616000000,
      "message": { "text": "User message" },
      "response": { "text": "Assistant response" }
    }
  ]
}
```

## Storage Location

- **Windows**: `%APPDATA%\Code\User\workspaceStorage\<id>\chatSessions\`
- **macOS**: `~/Library/Application Support/Code/User/workspaceStorage/<id>/chatSessions/`
- **Linux**: `~/.config/Code/User/workspaceStorage/<id>/chatSessions/`

## Usage

```bash
# List Copilot sessions
chasm list sessions

# Import these demo sessions
chasm provider import copilot --source examples/copilot/chatSessions
```

