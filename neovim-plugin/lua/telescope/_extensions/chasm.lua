-- Copyright (c) 2024-2027 Nervosys LLC
-- SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial
--
-- Chasm Telescope extension
--

local has_telescope, telescope = pcall(require, "telescope")
if not has_telescope then
  return
end

local pickers = require("telescope.pickers")
local finders = require("telescope.finders")
local conf = require("telescope.config").values
local actions = require("telescope.actions")
local action_state = require("telescope.actions.state")
local previewers = require("telescope.previewers")

local chasm = require("chasm")

local M = {}

-- Session previewer
local session_previewer = previewers.new_buffer_previewer({
  title = "Session Preview",
  define_preview = function(self, entry, status)
    local session = chasm.get_session(entry.value.id)
    if not session then
      vim.api.nvim_buf_set_lines(self.state.bufnr, 0, -1, false, { "Failed to load session" })
      return
    end

    local lines = {
      "# " .. (session.title or "Untitled"),
      "",
      "**Provider:** " .. (session.provider or "Unknown"),
      "**Model:** " .. (session.model or "Unknown"),
      "**Messages:** " .. tostring(session.message_count or 0),
      "**Created:** " .. (session.created_at or "Unknown"),
      "",
      "---",
      "",
    }

    -- Add first few messages as preview
    local messages = session.messages or {}
    local preview_count = math.min(3, #messages)
    for i = 1, preview_count do
      local msg = messages[i]
      local role = (msg.role or "unknown"):upper()
      local content = msg.content or ""
      -- Truncate long messages
      if #content > 500 then
        content = content:sub(1, 500) .. "..."
      end
      table.insert(lines, "## " .. role)
      table.insert(lines, "")
      for _, line in ipairs(vim.split(content, "\n")) do
        table.insert(lines, line)
      end
      table.insert(lines, "")
    end

    if #messages > preview_count then
      table.insert(lines, "... and " .. (#messages - preview_count) .. " more messages")
    end

    vim.api.nvim_buf_set_lines(self.state.bufnr, 0, -1, false, lines)
    vim.api.nvim_buf_set_option(self.state.bufnr, "filetype", "markdown")
  end,
})

-- Sessions picker
function M.sessions(opts)
  opts = opts or {}

  local sessions = chasm.get_sessions()

  pickers
    .new(opts, {
      prompt_title = "Chasm Sessions",
      finder = finders.new_table({
        results = sessions,
        entry_maker = function(session)
          local provider = session.provider or "?"
          local title = session.title or "Untitled"
          local count = session.message_count or 0
          local model = session.model or ""

          return {
            value = session,
            display = string.format("[%s] %s (%d msgs) %s", provider, title, count, model ~= "" and "• " .. model or ""),
            ordinal = title .. " " .. provider .. " " .. model,
          }
        end,
      }),
      sorter = conf.generic_sorter(opts),
      previewer = session_previewer,
      attach_mappings = function(prompt_bufnr, map)
        -- Open session on Enter
        actions.select_default:replace(function()
          actions.close(prompt_bufnr)
          local selection = action_state.get_selected_entry()
          if selection then
            chasm.view_session(selection.value.id)
          end
        end)

        -- Harvest with <C-h>
        map("i", "<C-h>", function()
          chasm.harvest()
          -- Refresh picker
          local picker = action_state.get_current_picker(prompt_bufnr)
          local new_sessions = chasm.get_sessions()
          picker:refresh(
            finders.new_table({
              results = new_sessions,
              entry_maker = function(session)
                return {
                  value = session,
                  display = string.format(
                    "[%s] %s (%d msgs)",
                    session.provider or "?",
                    session.title or "Untitled",
                    session.message_count or 0
                  ),
                  ordinal = (session.title or "") .. " " .. (session.provider or ""),
                }
              end,
            }),
            { reset_prompt = false }
          )
        end)

        return true
      end,
    })
    :find()
end

-- Search picker
function M.search(opts)
  opts = opts or {}
  local query = opts.query or ""

  local sessions
  if query ~= "" then
    sessions = chasm.search(query)
  else
    sessions = chasm.get_sessions()
  end

  pickers
    .new(opts, {
      prompt_title = query ~= "" and ("Search: " .. query) or "Search Sessions",
      finder = finders.new_table({
        results = sessions,
        entry_maker = function(session)
          return {
            value = session,
            display = string.format(
              "[%s] %s (%d msgs)",
              session.provider or "?",
              session.title or "Untitled",
              session.message_count or 0
            ),
            ordinal = (session.title or "") .. " " .. (session.provider or ""),
          }
        end,
      }),
      sorter = conf.generic_sorter(opts),
      previewer = session_previewer,
      attach_mappings = function(prompt_bufnr, map)
        actions.select_default:replace(function()
          actions.close(prompt_bufnr)
          local selection = action_state.get_selected_entry()
          if selection then
            chasm.view_session(selection.value.id)
          end
        end)
        return true
      end,
    })
    :find()
end

return telescope.register_extension({
  setup = function(ext_config, config)
    -- Extension setup
  end,
  exports = {
    sessions = M.sessions,
    search = M.search,
    chasm = M.sessions, -- Default action
  },
})
