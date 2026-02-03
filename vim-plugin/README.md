# Chasm.vim - Vim Plugin for Chasm

A Vim plugin for managing AI chat sessions with the Chasm system.

## Features

- 🔍 **Session Search**: Search and browse AI chat sessions
- 📥 **Harvest**: Collect sessions from AI providers
- 📊 **Session Viewer**: View session details and messages
- 🔄 **Sync**: Synchronize with Chasm server

## Requirements

- Vim 8.0+ with `+job` and `+json` features
- `curl` command available
- Chasm server running (default: localhost:8787)

## Installation

### Using vim-plug

```vim
Plug 'nervosys/chasm.vim'
```

### Using Vundle

```vim
Plugin 'nervosys/chasm.vim'
```

### Using Pathogen

```bash
cd ~/.vim/bundle
git clone https://github.com/nervosys/chasm.vim
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
let g:chasm_server_url = 'http://localhost:8787'

" Disable auto-sync (default: 0)
let g:chasm_auto_sync = 0

" Disable default mappings (default: 0)
let g:chasm_no_mappings = 0
```

## Commands

| Command | Description |
|---------|-------------|
| `:ChasmHealth` | Check server health |
| `:ChasmHarvest` | Harvest new sessions |
| `:ChasmSync` | Sync with server |
| `:ChasmStats` | Show statistics |
| `:ChasmSearch [query]` | Search sessions |
| `:ChasmSessions` | List all sessions |
| `:ChasmView [id]` | View session details |

## Keymaps

Default keymaps (can be disabled with `g:chasm_no_mappings`):

| Keymap | Action |
|--------|--------|
| `<leader>cs` | Search sessions |
| `<leader>ch` | Harvest sessions |
| `<leader>cv` | View sessions |
| `<leader>cy` | Sync with server |

## Usage

### Browse Sessions

```vim
:ChasmSessions
```

Opens a quickfix list with all sessions. Press Enter on a session to view it.

### Search Sessions

```vim
:ChasmSearch my query
```

Or interactively:

```vim
:ChasmSearch
```

### View Session

```vim
:ChasmView session-id
```

Opens a new buffer with the session content in Markdown format.

### Harvest Sessions

```vim
:ChasmHarvest
```

Collects new sessions from AI providers.

## License

Apache License 2.0

Copyright (c) 2024-2027 Nervosys LLC
