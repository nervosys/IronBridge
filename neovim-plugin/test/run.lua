-- Copyright (c) 2024-2027 Nervosys LLC
-- SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
--
-- Run with:  nvim --headless -l test/run.lua
--
-- The plugin's HTTP layer goes through plenary.curl, which it loads lazily via
-- pcall(require, ...). Registering a stand-in in package.preload before the
-- module is required means the real dependency is not needed to test what the
-- plugin does with it: which path it asks for, what it sends, and what it makes
-- of the answer. Those are the parts that break silently — a wrong path returns
-- nil, and every caller renders nil as "nothing found".

local failures = {}
local checks = 0

local function check(ok, message)
  checks = checks + 1
  if not ok then
    table.insert(failures, message)
  end
end

local function eq(actual, expected, what)
  check(
    vim.deep_equal(actual, expected),
    string.format('%s: expected %s, got %s', what, vim.inspect(expected), vim.inspect(actual))
  )
end

-- --------------------------------------------------------------------------
-- A plenary.curl stand-in that records calls and replays queued responses.
-- --------------------------------------------------------------------------

local http = { calls = {}, responses = {} }

function http.queue(response)
  table.insert(http.responses, response)
end

function http.reset()
  http.calls = {}
  http.responses = {}
end

local function respond(method, url, opts)
  table.insert(http.calls, { method = method, url = url, opts = opts or {} })
  local response = table.remove(http.responses, 1)
  return response or { status = 200, body = '{}' }
end

package.preload['plenary.curl'] = function()
  return {
    get = function(url, opts) return respond('GET', url, opts) end,
    post = function(url, opts) return respond('POST', url, opts) end,
  }
end

-- The plugin lives one directory up from this file.
local here = debug.getinfo(1, 'S').source:sub(2):gsub('[\\/][^\\/]*$', '')
vim.opt.runtimepath:prepend(here .. '/..')

local ironbridge = require('ironbridge')
ironbridge.config.server_url = 'http://127.0.0.1:8787'

local function last_call()
  return http.calls[#http.calls]
end

-- --------------------------------------------------------------------------
-- Paths. Every one of these is a route the server actually serves; `/health`
-- without the `/api` prefix was here until these tests were written, and it
-- made a healthy server look unreachable.
-- --------------------------------------------------------------------------

http.reset()
http.queue({ status = 200, body = '{"status":"ok","version":"2.0.1"}' })
local health = ironbridge.health()
eq(last_call().url, 'http://127.0.0.1:8787/api/health', 'health path')
eq(last_call().method, 'GET', 'health method')
eq(health.status, 'ok', 'health status')
eq(health.version, '2.0.1', 'health version')

http.reset()
http.queue({ status = 200, body = '{"sessions":[{"id":"s-1","title":"One"}]}' })
local sessions = ironbridge.get_sessions()
eq(last_call().url, 'http://127.0.0.1:8787/api/sessions', 'sessions path')
-- get_sessions unwraps the envelope, so callers get the list itself.
eq(sessions[1].id, 's-1', 'session id')

http.reset()
http.queue({ status = 200, body = '{"id":"s-1","title":"One"}' })
ironbridge.get_session('s-1')
eq(last_call().url, 'http://127.0.0.1:8787/api/sessions/s-1', 'session-by-id path')

http.reset()
http.queue({ status = 200, body = '{"results":[]}' })
ironbridge.search('auth bypass')
eq(last_call().url, 'http://127.0.0.1:8787/api/search', 'search path')
-- The query goes in the query table, so plenary encodes it. Building it into
-- the URL by hand is how a space or an ampersand becomes a truncated search.
eq(last_call().opts.query, { q = 'auth bypass' }, 'search query')

http.reset()
http.queue({ status = 200, body = '{"sessionsCount":3}' })
ironbridge.harvest()
eq(last_call().url, 'http://127.0.0.1:8787/api/harvest', 'harvest path')
eq(last_call().method, 'POST', 'harvest method')

http.reset()
http.queue({ status = 200, body = '{"totalSessions":10}' })
local stats = ironbridge.stats()
eq(last_call().url, 'http://127.0.0.1:8787/api/stats', 'stats path')
eq(stats.totalSessions, 10, 'stats payload')

-- --------------------------------------------------------------------------
-- Failure handling. A server that answers 500, or refuses the connection
-- outright, must not surface as an empty-but-fine result.
-- --------------------------------------------------------------------------

http.reset()
http.queue({ status = 500, body = '{"error":"boom"}' })
check(ironbridge.health() == nil, 'a 500 must not come back as a healthy server')

http.reset()
http.queue({ status = 500, body = '{"error":"boom"}' })
eq(ironbridge.get_sessions(), {}, 'a 500 reads as no sessions rather than crashing')

http.reset()
http.queue(nil) -- plenary returns nothing at all when the connection fails
eq(ironbridge.get_sessions(), {}, 'a dead server reads as no sessions')

http.reset()
http.queue({ status = 200, body = 'not json at all' })
eq(ironbridge.get_sessions(), {}, 'an unparseable body reads as empty, not as a crash')

http.reset()
http.queue({ status = 204, body = '' })
eq(ironbridge.get_sessions(), {}, 'an empty body reads as empty')

http.reset()
http.queue({ status = 404, body = '{}' })
check(ironbridge.get_session('missing') == nil, 'a missing session is nil, not an empty table')

-- --------------------------------------------------------------------------
-- Configuration.
-- --------------------------------------------------------------------------

local defaults = require('ironbridge').config
check(defaults.server_url ~= nil, 'a default server url is set')
check(type(defaults.keymaps) == 'table', 'keymaps are configurable')

ironbridge.setup({ server_url = 'http://example.test:9999' })
eq(ironbridge.config.server_url, 'http://example.test:9999', 'setup overrides the url')
-- setup merges rather than replaces: dropping the keymap table would leave the
-- plugin with no bindings at all.
check(type(ironbridge.config.keymaps) == 'table', 'setup keeps untouched defaults')

http.reset()
http.queue({ status = 200, body = '{}' })
ironbridge.health()
eq(last_call().url, 'http://example.test:9999/api/health', 'requests follow the configured url')

-- --------------------------------------------------------------------------

if #failures > 0 then
  io.stderr:write(string.format('%d of %d checks failed:\n', #failures, checks))
  for _, message in ipairs(failures) do
    io.stderr:write('  - ' .. message .. '\n')
  end
  -- os.exit rather than :cquit — under `nvim -l`, cquit does not set the
  -- process exit code, so a failing suite would look like a passing one.
  os.exit(1)
end

io.stdout:write(string.format('ok - %d checks passed\n', checks))
vim.cmd('quit')
