# IronBridge.vim - Vim Plugin for IronBridge

A Vim plugin for managing AI chat sessions with the IronBridge system.

## Features

- 🔍 **Session Search**: Search and browse AI chat sessions
- 📥 **Harvest**: Collect sessions from AI providers
- 📊 **Session Viewer**: View session details and messages
- 🔄 **Sync**: Synchronize with IronBridge server

## Requirements

- Vim 8.0+ with `+job` and `+json` features
- `curl` command available
- IronBridge server running (default: localhost:8787)

## Installation

### Using vim-plug

```vim
Plug 'nervosys/ironbridge.vim'
```

### Using Vundle

```vim
Plugin 'nervosys/ironbridge.vim'
```

### Using Pathogen

```bash
cd ~/.vim/bundle
git clone https://github.com/nervosys/ironbridge.vim
```

### Manual

Copy the contents to your `~/.vim` directory:

```bash
cp -r plugin/ autoload/ doc/ ~/.vim/
```

## Configuration

Add to your `.vimrc`:

```vim
" Server URL (default: http://localhost:8787)
let g:ironbridge_server_url = 'http://localhost:8787'

" Disable auto-sync (default: 0)
let g:ironbridge_auto_sync = 0

" Disable default mappings (default: 0)
let g:ironbridge_no_mappings = 0
```

## Commands

| Command                | Description          |
| ---------------------- | -------------------- |
| `:IronBridgeHealth`         | Check server health  |
| `:IronBridgeHarvest`        | Harvest new sessions |
| `:IronBridgeSync`           | Sync with server     |
| `:IronBridgeStats`          | Show statistics      |
| `:IronBridgeSearch [query]` | Search sessions      |
| `:IronBridgeSessions`       | List all sessions    |
| `:IronBridgeView [id]`      | View session details |

## Keymaps

Default keymaps (can be disabled with `g:ironbridge_no_mappings`):

| Keymap       | Action           |
| ------------ | ---------------- |
| `<leader>cs` | Search sessions  |
| `<leader>ch` | Harvest sessions |
| `<leader>cv` | View sessions    |
| `<leader>cy` | Sync with server |

## Usage

### Browse Sessions

```vim
:IronBridgeSessions
```

Opens a quickfix list with all sessions. Press Enter on a session to view it.

### Search Sessions

```vim
:IronBridgeSearch my query
```

Or interactively:

```vim
:IronBridgeSearch
```

### View Session

```vim
:IronBridgeView session-id
```

Opens a new buffer with the session content in Markdown format.

### Harvest Sessions

```vim
:IronBridgeHarvest
```

Collects new sessions from AI providers.

## License

Apache License 2.0

Copyright (c) 2024-2027 Nervosys LLC
