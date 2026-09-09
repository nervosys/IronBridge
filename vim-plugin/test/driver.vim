" Copyright (c) 2024-2027 Nervosys LLC
" SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial
"
" Driven by test/run_tests.py, which fills in the three @@...@@ placeholders and
" runs this under `vim -es`. Kept as a real .vim file rather than a string
" inside the Python so it stays readable and free of two layers of escaping.

set nocompatible
let &runtimepath = '@@PLUGIN@@' . ',' . &runtimepath
let g:ironbridge_server_url = 'http://127.0.0.1:@@PORT@@'
let g:ironbridge_no_mappings = 1

runtime plugin/ironbridge.vim

" The commands a user runs. Their output is echoed rather than returned, so the
" assertions that matter are made server-side on what was requested; these calls
" are here to make the requests happen and to prove a good answer does not
" throw.
call ironbridge#health()
call ironbridge#harvest()
call ironbridge#sync()
call ironbridge#stats()

" ironbridge#search, #sessions and #view finish by opening a quickfix or
" scratch window, which silent-ex mode has no room for. Their request layer is
" driven directly below, and run_tests.py additionally checks every path the
" source declares.

" The plugin defines its commands and its load guard.
call assert_true(exists(':IronBridgeHealth') == 2, 'IronBridgeHealth is not defined')
call assert_true(exists(':IronBridgeSearch') == 2, 'IronBridgeSearch is not defined')
call assert_true(exists(':IronBridgeSessions') == 2, 'IronBridgeSessions is not defined')
call assert_true(exists(':IronBridgeView') == 2, 'IronBridgeView is not defined')
call assert_equal(1, g:loaded_ironbridge, 'the load guard is not set')

" s:request and s:urlencode are script-local. Rather than reshape the plugin to
" expose them, find the autoload script's id and reach them through <SNR> —
" the approach Vim's own test suite uses.
let s:sid = 0
for s:line in split(execute('scriptnames'), "\n")
  if s:line =~# 'autoload[\\/]ironbridge\.vim'
    let s:sid = str2nr(matchstr(s:line, '^\s*\zs\d\+'))
  endif
endfor
call assert_true(s:sid > 0, 'could not find the autoload script id')

if s:sid > 0
  let s:Request = function('<SNR>' . s:sid . '_request')
  let s:Encode = function('<SNR>' . s:sid . '_urlencode')

  " A session fetched by id comes back decoded, not as a string.
  let s:session = s:Request('GET', '/api/sessions/s-1')
  call assert_equal('Recovering a lost session', get(s:session, 'title', ''), 'the session did not decode')
  call assert_equal(2, len(get(s:session, 'messages', [])), 'the messages did not decode')

  " A 404 body still decodes, and its error field is what every caller checks.
  let s:missing = s:Request('GET', '/api/sessions/nope')
  call assert_true(has_key(s:missing, 'error'), 'a 404 must surface as an error')

  " A body that is not JSON must be reported, not passed on as data.
  let s:garbage = s:Request('GET', '/not-json')
  call assert_equal('Invalid JSON response', get(s:garbage, 'error', ''), 'unparseable output must be reported')

  " The search URL, built exactly the way ironbridge#search builds it.
  let s:results = s:Request('GET', '/api/search?q=' . s:Encode('auth bypass & csv'))
  call assert_true(has_key(s:results, 'sessions'), 'the search response did not decode')

  " Percent-encoding. A raw space or ampersand truncates the query server-side.
  call assert_equal('plain', s:Encode('plain'), 'unreserved characters must survive')
  call assert_equal('a%20b', s:Encode('a b'), 'a space must be encoded')
  call assert_equal('a%26b', s:Encode('a&b'), 'an ampersand must be encoded')
  call assert_equal('a%3Db', s:Encode('a=b'), 'an equals must be encoded')
  call assert_equal('a%2Fb', s:Encode('a/b'), 'a slash must be encoded')
  call assert_equal('a%3Fb', s:Encode('a?b'), 'a question mark must be encoded')
  call assert_equal('a%25b', s:Encode('a%b'), 'a percent must be encoded too')
  call assert_equal('-._~', s:Encode('-._~'), 'RFC 3986 unreserved marks stay literal')
  call assert_equal('', s:Encode(''), 'an empty query encodes to nothing')
endif

call writefile(v:errors, '@@RESULTS@@')
qall!
