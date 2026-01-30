# Continue.dev Demo

Demo chat sessions in Continue.dev format.

## Format

Continue.dev stores conversations in JSON files within `~/.continue/sessions/`:

### Session Index (sessions.json)
```json
[
  {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Python Data Processing",
    "dateCreated": "1706000000000",
    "workspaceDirectory": "/path/to/workspace"
  }
]
```

### Individual Session ({sessionId}.json)
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Python Data Processing",
  "workspaceDirectory": "/path/to/workspace",
  "history": [
    {
      "message": {
        "role": "user",
        "content": "How do I read a large CSV file?"
      },
      "contextItems": [
        {
          "content": "file contents...",
          "name": "main.py",
          "description": "Current file"
        }
      ]
    },
    {
      "message": {
        "role": "assistant",
        "content": "Here's how to read large CSV files efficiently..."
      },
      "contextItems": []
    }
  ],
  "mode": "chat",
  "chatModelTitle": "Claude 3.5 Sonnet",
  "usage": {
    "totalCost": 0.0025,
    "promptTokens": 1500,
    "completionTokens": 800
  }
}
```

## Storage Location

- **Windows**: `%USERPROFILE%\.continue\sessions\`
- **macOS**: `~/.continue/sessions/`
- **Linux**: `~/.continue/sessions/`

The path can be overridden via the `CONTINUE_GLOBAL_DIR` environment variable.

## Usage

```bash
# Import Continue.dev sessions
chasm provider import continuedev --source examples/continuedev/sessions

# List imported sessions
chasm list sessions --provider continuedev

# View a specific session
chasm show session <session-id>
```

## Features Supported

- ✅ Full conversation history
- ✅ Context items (attached files/code)
- ✅ Model information
- ✅ Token usage statistics
- ✅ Workspace association
- ❌ Session export (Continue.dev doesn't support external imports)
