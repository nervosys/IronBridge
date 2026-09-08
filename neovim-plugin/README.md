# IronBridge.nvim - Neovim Plugin for IronBridge

A Neovim plugin for managing AI chat sessions with the IronBridge system.

## Features

- 🔍 **Session Search**: Search and browse AI chat sessions with Telescope
- 📥 **Harvest**: Collect sessions from AI providers
- 📊 **Session Viewer**: View session details and messages
- 🔄 **Sync**: Synchronize with IronBridge server
- ⌨️ **Commands**: Full command-line interface

## Requirements

- Neovim 0.8+
- [plenary.nvim](https://github.com/nvim-lua/plenary.nvim)
- [telescope.nvim](https://github.com/nvim-telescope/telescope.nvim) (optional, for fuzzy search)
- IronBridge server running (default: localhost:8787)

## Installation

### Using lazy.nvim

```lua
{
  "nervosys/IronBridge.nvim",
  dependencies = {
    "nvim-lua/plenary.nvim",
    "nvim-telescope/telescope.nvim", -- optional
  },
  config = function()
    require("ironbridge").setup({
      server_url = "http://localhost:8787",
    })
  end,
}
```

### Using packer.nvim

```lua
use {
  "nervosys/IronBridge.nvim",
  requires = {
    "nvim-lua/plenary.nvim",
    "nvim-telescope/telescope.nvim",
  },
  config = function()
    require("ironbridge").setup()
  end,
}
```

### Using vim-plug

```vim
Plug 'nvim-lua/plenary.nvim'
Plug 'nvim-telescope/telescope.nvim'
Plug 'nervosys/IronBridge.nvim'
```

## Configuration

```lua
require("ironbridge").setup({
  -- Server configuration
  server_url = "http://localhost:8787",
  
  -- Auto-sync settings
  auto_sync = false,
  sync_interval = 15 * 60 * 1000, -- 15 minutes in ms
  
  -- UI settings
  float_width = 0.8,
  float_height = 0.8,
  
  -- Keymaps (set to false to disable)
  keymaps = {
    search = "<leader>cs",
    harvest = "<leader>ch",
    view = "<leader>cv",
    sync = "<leader>cy",
  },
  
  -- Telescope integration
  telescope = {
    enabled = true,
  },
})
```

## Commands

| Command                | Description          |
| ---------------------- | -------------------- |
| `:IronBridgeSearch [query]` | Search sessions      |
| `:IronBridgeHarvest`        | Harvest new sessions |
| `:IronBridgeSync`           | Sync with server     |
| `:IronBridgeView [id]`      | View session details |
| `:IronBridgeStats`          | Show statistics      |
| `:IronBridgeHealth`         | Check server health  |

## Keymaps

Default keymaps (configurable):

| Keymap       | Action                        |
| ------------ | ----------------------------- |
| `<leader>cs` | Search sessions               |
| `<leader>ch` | Harvest sessions              |
| `<leader>cv` | View current/selected session |
| `<leader>cy` | Sync with server              |

## Telescope Integration

If telescope.nvim is installed, you can use the IronBridge picker:

```lua
:Telescope ironbridge sessions
:Telescope ironbridge search query=your-query
```

Or via Lua:

```lua
require("telescope").extensions.ironbridge.sessions()
require("telescope").extensions.ironbridge.search({ query = "your query" })
```

## API

```lua
local ironbridge = require("ironbridge")

-- Check health
ironbridge.health()

-- Search sessions
ironbridge.search("query")

-- Harvest sessions
ironbridge.harvest()

-- Get session by ID
ironbridge.get_session("session-id")

-- Get all sessions
ironbridge.get_sessions()

-- Get statistics
ironbridge.stats()
```

## License

Apache License 2.0

Copyright (c) 2024-2027 Nervosys LLC
