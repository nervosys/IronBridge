# Chasm.nvim - Neovim Plugin for Chasm

A Neovim plugin for managing AI chat sessions with the Chasm system.

## Features

- 🔍 **Session Search**: Search and browse AI chat sessions with Telescope
- 📥 **Harvest**: Collect sessions from AI providers
- 📊 **Session Viewer**: View session details and messages
- 🔄 **Sync**: Synchronize with Chasm server
- ⌨️ **Commands**: Full command-line interface

## Requirements

- Neovim 0.8+
- [plenary.nvim](https://github.com/nvim-lua/plenary.nvim)
- [telescope.nvim](https://github.com/nvim-telescope/telescope.nvim) (optional, for fuzzy search)
- Chasm server running (default: localhost:8787)

## Installation

### Using lazy.nvim

```lua
{
  "nervosys/chasm.nvim",
  dependencies = {
    "nvim-lua/plenary.nvim",
    "nvim-telescope/telescope.nvim", -- optional
  },
  config = function()
    require("chasm").setup({
      server_url = "http://localhost:8787",
    })
  end,
}
```

### Using packer.nvim

```lua
use {
  "nervosys/chasm.nvim",
  requires = {
    "nvim-lua/plenary.nvim",
    "nvim-telescope/telescope.nvim",
  },
  config = function()
    require("chasm").setup()
  end,
}
```

### Using vim-plug

```vim
Plug 'nvim-lua/plenary.nvim'
Plug 'nvim-telescope/telescope.nvim'
Plug 'nervosys/chasm.nvim'
```

## Configuration

```lua
require("chasm").setup({
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
| `:ChasmSearch [query]` | Search sessions      |
| `:ChasmHarvest`        | Harvest new sessions |
| `:ChasmSync`           | Sync with server     |
| `:ChasmView [id]`      | View session details |
| `:ChasmStats`          | Show statistics      |
| `:ChasmHealth`         | Check server health  |

## Keymaps

Default keymaps (configurable):

| Keymap       | Action                        |
| ------------ | ----------------------------- |
| `<leader>cs` | Search sessions               |
| `<leader>ch` | Harvest sessions              |
| `<leader>cv` | View current/selected session |
| `<leader>cy` | Sync with server              |

## Telescope Integration

If telescope.nvim is installed, you can use the Chasm picker:

```lua
:Telescope chasm sessions
:Telescope chasm search query=your-query
```

Or via Lua:

```lua
require("telescope").extensions.chasm.sessions()
require("telescope").extensions.chasm.search({ query = "your query" })
```

## API

```lua
local chasm = require("chasm")

-- Check health
chasm.health()

-- Search sessions
chasm.search("query")

-- Harvest sessions
chasm.harvest()

-- Get session by ID
chasm.get_session("session-id")

-- Get all sessions
chasm.get_sessions()

-- Get statistics
chasm.stats()
```

## License

Apache License 2.0

Copyright (c) 2024-2027 Nervosys LLC
