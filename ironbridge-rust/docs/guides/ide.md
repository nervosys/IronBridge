# IDE Integration

Integrate IronBridge with your code editor to automatically capture, recover, and search AI chat sessions.

## VS Code

### IronBridge Extension

The IronBridge VS Code extension provides seamless integration:

1. **Install** from the VS Code Marketplace or VSIX
2. **Configure** the recording server connection
3. Sessions are captured automatically as you chat

#### Settings

Add to your `settings.json`:

```json
{
  "ironbridge.recording.enabled": true,
  "ironbridge.recording.server": "http://localhost:8787",
  "ironbridge.autoHarvest": true
}
```

### MCP Integration (Copilot Chat)

Connect IronBridge as an MCP server for GitHub Copilot Chat:

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

Now you can ask Copilot to search your session history:

> "Search my previous sessions for authentication implementations"

### Manual Recovery

If the extension isn't installed, you can still recover VS Code sessions manually:

```bash
# Recover sessions for the active project
ironbridge fetch path /path/to/your/project

# Reload VS Code (Ctrl+R) to see recovered sessions
```

---

## Cursor

Cursor stores sessions in its own workspace storage directory. IronBridge detects and harvests them automatically.

```bash
# Scan for Cursor sessions
ironbridge harvest scan

# Harvest Cursor sessions
ironbridge harvest run --providers cursor
```

### Storage Location

| Platform | Path |
|---|---|
| Windows | `%APPDATA%\Cursor\User\workspaceStorage\` |
| macOS | `~/Library/Application Support/Cursor/User/workspaceStorage/` |
| Linux | `~/.config/Cursor/User/workspaceStorage/` |

---

## Windsurf

Windsurf sessions are also automatically detected:

```bash
ironbridge harvest run --providers windsurf
```

---

## Continue.dev

[Continue.dev](https://continue.dev) sessions stored in VS Code are harvested alongside Copilot sessions:

```bash
ironbridge harvest run --providers continue
```

---

## Claude Code

Claude Code (terminal-based) stores conversations in `~/.claude/`:

```bash
ironbridge harvest run --providers claudecode
```

---

## Neovim

### Plugin

The IronBridge Neovim plugin provides session recovery and search from within Neovim:

```lua
-- In your init.lua or plugin config
require('ironbridge').setup({
  auto_harvest = true,
  recording_server = 'http://localhost:8787',
})
```

### Key Bindings

| Binding | Action |
|---|---|
| `<leader>cs` | Search sessions |
| `<leader>cl` | List sessions |
| `<leader>cr` | Recover sessions |
| `<leader>ch` | Harvest sessions |

---

## JetBrains (IntelliJ, WebStorm, etc.)

The IronBridge JetBrains plugin integrates with IntelliJ-based IDEs:

1. Install from the JetBrains Marketplace
2. Configure in **Settings → Tools → IronBridge**
3. Sessions from JetBrains AI assistants are captured automatically

---

## Vim

The IronBridge Vim plugin provides basic integration:

```vim
" In your .vimrc
Plug 'nervosys/ironbridge', { 'rtp': 'vim-plugin' }

" Commands
:IronBridgeSearch <query>
:IronBridgeList
:IronBridgeRecover
```

---

## Universal: API Server

For any editor not directly supported, run the IronBridge API server and use the REST API:

```bash
# Start the server
ironbridge api serve --port 8787

# Any tool can now send recording events via REST
curl -X POST http://localhost:8787/api/recording/events \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "my-session",
    "event_type": "message",
    "data": {"role": "user", "content": "Hello!"}
  }'
```

## Cross-Editor Session Search

Once sessions are harvested from all your editors, search across everything:

```bash
# Search across VS Code, Cursor, Windsurf, and more
ironbridge harvest search "authentication middleware"

# Browse all sessions in the TUI
ironbridge tui
```
