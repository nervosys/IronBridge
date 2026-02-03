-- Copyright (c) 2024-2027 Nervosys LLC
-- SPDX-License-Identifier: Apache-2.0
--
-- Chasm.nvim - Neovim plugin for AI chat session management
--

local M = {}

-- Default configuration
M.config = {
  server_url = "http://localhost:8787",
  auto_sync = false,
  sync_interval = 15 * 60 * 1000, -- 15 minutes
  float_width = 0.8,
  float_height = 0.8,
  keymaps = {
    search = "<leader>cs",
    harvest = "<leader>ch",
    view = "<leader>cv",
    sync = "<leader>cy",
  },
  telescope = {
    enabled = true,
  },
}

-- HTTP client using plenary.curl
local curl = nil
local function get_curl()
  if curl == nil then
    local ok, c = pcall(require, "plenary.curl")
    if ok then
      curl = c
    end
  end
  return curl
end

-- Make HTTP request
local function request(method, path, opts)
  local c = get_curl()
  if not c then
    vim.notify("chasm.nvim requires plenary.nvim", vim.log.levels.ERROR)
    return nil
  end

  opts = opts or {}
  local url = M.config.server_url .. path
  local headers = {
    ["Content-Type"] = "application/json",
    ["Accept"] = "application/json",
  }

  local response
  if method == "GET" then
    response = c.get(url, {
      headers = headers,
      query = opts.query,
    })
  elseif method == "POST" then
    response = c.post(url, {
      headers = headers,
      body = opts.body and vim.fn.json_encode(opts.body) or nil,
    })
  end

  if response and response.status >= 200 and response.status < 300 then
    if response.body and response.body ~= "" then
      local ok, data = pcall(vim.fn.json_decode, response.body)
      if ok then
        return data
      end
    end
    return {}
  end

  return nil, response and response.status or "Connection failed"
end

-- Check server health
function M.health()
  local data, err = request("GET", "/health")
  if data then
    vim.notify(
      string.format("Chasm server: %s (v%s)", data.status or "ok", data.version or "unknown"),
      vim.log.levels.INFO
    )
    return data
  else
    vim.notify("Chasm server unreachable: " .. tostring(err), vim.log.levels.ERROR)
    return nil
  end
end

-- Get all sessions
function M.get_sessions()
  local data, err = request("GET", "/api/sessions")
  if data then
    return data.sessions or data
  else
    vim.notify("Failed to get sessions: " .. tostring(err), vim.log.levels.ERROR)
    return {}
  end
end

-- Get session by ID
function M.get_session(id)
  local data, err = request("GET", "/api/sessions/" .. id)
  if data then
    return data
  else
    vim.notify("Failed to get session: " .. tostring(err), vim.log.levels.ERROR)
    return nil
  end
end

-- Search sessions
function M.search(query)
  local data, err = request("GET", "/api/search", {
    query = { q = query },
  })
  if data then
    return data.sessions or data
  else
    vim.notify("Search failed: " .. tostring(err), vim.log.levels.ERROR)
    return {}
  end
end

-- Harvest sessions
function M.harvest()
  vim.notify("Harvesting sessions...", vim.log.levels.INFO)
  local data, err = request("POST", "/api/harvest")
  if data then
    vim.notify(
      string.format("Harvested %d sessions, %d messages", data.sessions_count or 0, data.messages_count or 0),
      vim.log.levels.INFO
    )
    return data
  else
    vim.notify("Harvest failed: " .. tostring(err), vim.log.levels.ERROR)
    return nil
  end
end

-- Sync sessions
function M.sync()
  vim.notify("Syncing with server...", vim.log.levels.INFO)
  local sessions = M.get_sessions()
  if sessions then
    vim.notify(string.format("Synced %d sessions", #sessions), vim.log.levels.INFO)
    return sessions
  end
  return nil
end

-- Get statistics
function M.stats()
  local data, err = request("GET", "/api/stats")
  if data then
    vim.notify(
      string.format(
        "Stats: %d sessions, %d messages, %d providers",
        data.total_sessions or 0,
        data.total_messages or 0,
        data.providers_count or 0
      ),
      vim.log.levels.INFO
    )
    return data
  else
    vim.notify("Failed to get stats: " .. tostring(err), vim.log.levels.ERROR)
    return nil
  end
end

-- Create floating window
local function create_float(title, content)
  local width = math.floor(vim.o.columns * M.config.float_width)
  local height = math.floor(vim.o.lines * M.config.float_height)
  local row = math.floor((vim.o.lines - height) / 2)
  local col = math.floor((vim.o.columns - width) / 2)

  local buf = vim.api.nvim_create_buf(false, true)
  local win = vim.api.nvim_open_win(buf, true, {
    relative = "editor",
    width = width,
    height = height,
    row = row,
    col = col,
    style = "minimal",
    border = "rounded",
    title = " " .. title .. " ",
    title_pos = "center",
  })

  -- Set content
  if type(content) == "string" then
    content = vim.split(content, "\n")
  end
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, content)

  -- Set buffer options
  vim.api.nvim_buf_set_option(buf, "modifiable", false)
  vim.api.nvim_buf_set_option(buf, "bufhidden", "wipe")

  -- Key mappings
  vim.api.nvim_buf_set_keymap(buf, "n", "q", ":close<CR>", { noremap = true, silent = true })
  vim.api.nvim_buf_set_keymap(buf, "n", "<Esc>", ":close<CR>", { noremap = true, silent = true })

  return buf, win
end

-- View session in floating window
function M.view_session(id)
  local session = M.get_session(id)
  if not session then
    return
  end

  local lines = {
    "# " .. (session.title or "Untitled Session"),
    "",
    "Provider: " .. (session.provider or "Unknown"),
    "Model: " .. (session.model or "Unknown"),
    "Messages: " .. (session.message_count or #(session.messages or {})),
    "Created: " .. (session.created_at or "Unknown"),
    "",
    "---",
    "",
  }

  -- Add messages
  for _, msg in ipairs(session.messages or {}) do
    local role = msg.role or "unknown"
    local content = msg.content or ""
    table.insert(lines, "## " .. role:upper())
    table.insert(lines, "")
    for _, line in ipairs(vim.split(content, "\n")) do
      table.insert(lines, line)
    end
    table.insert(lines, "")
  end

  local buf, win = create_float("Session: " .. (session.title or id), lines)
  vim.api.nvim_buf_set_option(buf, "filetype", "markdown")
end

-- Search UI
function M.search_ui()
  vim.ui.input({ prompt = "Search sessions: " }, function(query)
    if not query or query == "" then
      return
    end

    local results = M.search(query)
    if #results == 0 then
      vim.notify("No results found", vim.log.levels.INFO)
      return
    end

    -- Check for telescope
    local has_telescope = pcall(require, "telescope")
    if has_telescope and M.config.telescope.enabled then
      M.telescope_search(query)
    else
      -- Fallback to quickfix list
      local items = {}
      for _, session in ipairs(results) do
        table.insert(items, {
          text = string.format(
            "[%s] %s (%d messages)",
            session.provider or "?",
            session.title or "Untitled",
            session.message_count or 0
          ),
          filename = session.id,
        })
      end
      vim.fn.setqflist(items)
      vim.cmd("copen")
    end
  end)
end

-- Telescope integration
function M.telescope_search(query)
  local ok, telescope = pcall(require, "telescope")
  if not ok then
    vim.notify("Telescope not available", vim.log.levels.WARN)
    return
  end

  local pickers = require("telescope.pickers")
  local finders = require("telescope.finders")
  local conf = require("telescope.config").values
  local actions = require("telescope.actions")
  local action_state = require("telescope.actions.state")

  local sessions = query and M.search(query) or M.get_sessions()

  pickers
    .new({}, {
      prompt_title = query and ("Search: " .. query) or "Chasm Sessions",
      finder = finders.new_table({
        results = sessions,
        entry_maker = function(session)
          return {
            value = session,
            display = string.format(
              "[%s] %s (%d messages)",
              session.provider or "?",
              session.title or "Untitled",
              session.message_count or 0
            ),
            ordinal = (session.title or "") .. " " .. (session.provider or ""),
          }
        end,
      }),
      sorter = conf.generic_sorter({}),
      attach_mappings = function(prompt_bufnr, map)
        actions.select_default:replace(function()
          actions.close(prompt_bufnr)
          local selection = action_state.get_selected_entry()
          if selection then
            M.view_session(selection.value.id)
          end
        end)
        return true
      end,
    })
    :find()
end

-- Setup keymaps
local function setup_keymaps()
  local km = M.config.keymaps
  if km.search then
    vim.keymap.set("n", km.search, M.search_ui, { desc = "Chasm: Search sessions" })
  end
  if km.harvest then
    vim.keymap.set("n", km.harvest, M.harvest, { desc = "Chasm: Harvest sessions" })
  end
  if km.view then
    vim.keymap.set("n", km.view, function()
      M.telescope_search()
    end, { desc = "Chasm: View sessions" })
  end
  if km.sync then
    vim.keymap.set("n", km.sync, M.sync, { desc = "Chasm: Sync with server" })
  end
end

-- Setup commands
local function setup_commands()
  vim.api.nvim_create_user_command("ChasmHealth", function()
    M.health()
  end, { desc = "Check Chasm server health" })

  vim.api.nvim_create_user_command("ChasmHarvest", function()
    M.harvest()
  end, { desc = "Harvest AI sessions" })

  vim.api.nvim_create_user_command("ChasmSync", function()
    M.sync()
  end, { desc = "Sync with Chasm server" })

  vim.api.nvim_create_user_command("ChasmStats", function()
    M.stats()
  end, { desc = "Show Chasm statistics" })

  vim.api.nvim_create_user_command("ChasmSearch", function(opts)
    if opts.args and opts.args ~= "" then
      local results = M.search(opts.args)
      if M.config.telescope.enabled then
        M.telescope_search(opts.args)
      end
    else
      M.search_ui()
    end
  end, { nargs = "?", desc = "Search Chasm sessions" })

  vim.api.nvim_create_user_command("ChasmView", function(opts)
    if opts.args and opts.args ~= "" then
      M.view_session(opts.args)
    else
      M.telescope_search()
    end
  end, { nargs = "?", desc = "View Chasm session" })
end

-- Setup function
function M.setup(opts)
  M.config = vim.tbl_deep_extend("force", M.config, opts or {})

  setup_commands()
  setup_keymaps()

  -- Register telescope extension if available
  local ok, telescope = pcall(require, "telescope")
  if ok and M.config.telescope.enabled then
    telescope.register_extension({
      exports = {
        sessions = M.telescope_search,
        search = function(opts)
          M.telescope_search(opts.query)
        end,
      },
    })
  end
end

return M
