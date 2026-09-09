" IronBridge.vim autoload functions
" Copyright (c) 2024-2027 Nervosys LLC
" SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

" Make HTTP request using curl
function! s:request(method, path, ...) abort
  let l:url = g:ironbridge_server_url . a:path
  let l:headers = '-H "Content-Type: application/json" -H "Accept: application/json"'
  
  if a:method ==# 'GET'
    let l:cmd = 'curl -s ' . l:headers . ' "' . l:url . '"'
  elseif a:method ==# 'POST'
    let l:body = a:0 > 0 ? a:1 : '{}'
    let l:cmd = 'curl -s -X POST ' . l:headers . ' -d ''' . l:body . ''' "' . l:url . '"'
  endif
  
  let l:result = system(l:cmd)
  
  if v:shell_error
    return {'error': 'Request failed: ' . l:result}
  endif
  
  try
    return json_decode(l:result)
  catch
    return {'error': 'Invalid JSON response'}
  endtry
endfunction

" Check server health
function! ironbridge#health() abort
  let l:data = s:request('GET', '/api/health')
  
  if has_key(l:data, 'error')
    echohl ErrorMsg
    echo 'IronBridge server unreachable: ' . l:data.error
    echohl None
    return
  endif
  
  let l:status = get(l:data, 'status', 'ok')
  let l:version = get(l:data, 'version', 'unknown')
  
  echohl Title
  echo 'IronBridge server: ' . l:status . ' (v' . l:version . ')'
  echohl None
endfunction

" Harvest sessions
function! ironbridge#harvest() abort
  echo 'Harvesting sessions...'
  
  let l:data = s:request('POST', '/api/harvest')
  
  if has_key(l:data, 'error')
    echohl ErrorMsg
    echo 'Harvest failed: ' . l:data.error
    echohl None
    return
  endif
  
  let l:sessions = get(l:data, 'sessions_count', 0)
  let l:messages = get(l:data, 'messages_count', 0)
  
  echohl Title
  echo 'Harvested ' . l:sessions . ' sessions with ' . l:messages . ' messages'
  echohl None
endfunction

" Sync with server
function! ironbridge#sync() abort
  echo 'Syncing with server...'
  
  let l:data = s:request('GET', '/api/sessions')
  
  if has_key(l:data, 'error')
    echohl ErrorMsg
    echo 'Sync failed: ' . l:data.error
    echohl None
    return
  endif
  
  let l:sessions = get(l:data, 'sessions', [])
  let l:count = len(l:sessions)
  
  echohl Title
  echo 'Synced ' . l:count . ' sessions'
  echohl None
endfunction

" Get statistics
function! ironbridge#stats() abort
  let l:data = s:request('GET', '/api/stats')
  
  if has_key(l:data, 'error')
    echohl ErrorMsg
    echo 'Failed to get stats: ' . l:data.error
    echohl None
    return
  endif
  
  let l:sessions = get(l:data, 'total_sessions', 0)
  let l:messages = get(l:data, 'total_messages', 0)
  let l:providers = get(l:data, 'providers_count', 0)
  
  echohl Title
  echo 'Stats: ' . l:sessions . ' sessions, ' . l:messages . ' messages, ' . l:providers . ' providers'
  echohl None
endfunction

" Search sessions
function! ironbridge#search(query) abort
  if empty(a:query)
    let l:query = input('Search sessions: ')
    if empty(l:query)
      return
    endif
  else
    let l:query = a:query
  endif
  
  let l:url = '/api/search?q=' . s:urlencode(l:query)
  let l:data = s:request('GET', l:url)
  
  if has_key(l:data, 'error')
    echohl ErrorMsg
    echo 'Search failed: ' . l:data.error
    echohl None
    return
  endif
  
  let l:sessions = get(l:data, 'sessions', l:data)
  
  if empty(l:sessions)
    echo 'No results found'
    return
  endif
  
  " Build quickfix list
  let l:items = []
  for l:session in l:sessions
    let l:provider = get(l:session, 'provider', '?')
    let l:title = get(l:session, 'title', 'Untitled')
    let l:count = get(l:session, 'message_count', 0)
    let l:id = get(l:session, 'id', '')
    
    call add(l:items, {
      \ 'text': '[' . l:provider . '] ' . l:title . ' (' . l:count . ' messages)',
      \ 'filename': l:id
      \ })
  endfor
  
  call setqflist(l:items)
  copen
endfunction

" View session
function! ironbridge#view(id) abort
  if empty(a:id)
    " List sessions for selection
    call ironbridge#sessions()
    return
  endif
  
  let l:data = s:request('GET', '/api/sessions/' . a:id)
  
  if has_key(l:data, 'error')
    echohl ErrorMsg
    echo 'Failed to load session: ' . l:data.error
    echohl None
    return
  endif
  
  " Create new buffer
  new
  setlocal buftype=nofile
  setlocal bufhidden=wipe
  setlocal noswapfile
  setlocal nobuflisted
  setlocal filetype=markdown
  
  " Build content
  let l:lines = []
  let l:title = get(l:data, 'title', 'Untitled Session')
  let l:provider = get(l:data, 'provider', 'Unknown')
  let l:model = get(l:data, 'model', 'Unknown')
  let l:messages = get(l:data, 'messages', [])
  
  call add(l:lines, '# ' . l:title)
  call add(l:lines, '')
  call add(l:lines, 'Provider: ' . l:provider)
  call add(l:lines, 'Model: ' . l:model)
  call add(l:lines, 'Messages: ' . len(l:messages))
  call add(l:lines, '')
  call add(l:lines, '---')
  call add(l:lines, '')
  
  for l:msg in l:messages
    let l:role = toupper(get(l:msg, 'role', 'unknown'))
    let l:content = get(l:msg, 'content', '')
    
    call add(l:lines, '## ' . l:role)
    call add(l:lines, '')
    call extend(l:lines, split(l:content, "\n"))
    call add(l:lines, '')
  endfor
  
  call setline(1, l:lines)
  setlocal nomodifiable
  
  " Keymaps
  nnoremap <buffer> q :close<CR>
endfunction

" List all sessions
function! ironbridge#sessions() abort
  let l:data = s:request('GET', '/api/sessions')
  
  if has_key(l:data, 'error')
    echohl ErrorMsg
    echo 'Failed to get sessions: ' . l:data.error
    echohl None
    return
  endif
  
  let l:sessions = get(l:data, 'sessions', l:data)
  
  if empty(l:sessions)
    echo 'No sessions found'
    return
  endif
  
  " Build quickfix list
  let l:items = []
  for l:session in l:sessions
    let l:provider = get(l:session, 'provider', '?')
    let l:title = get(l:session, 'title', 'Untitled')
    let l:count = get(l:session, 'message_count', 0)
    let l:id = get(l:session, 'id', '')
    let l:model = get(l:session, 'model', '')
    
    call add(l:items, {
      \ 'text': '[' . l:provider . '] ' . l:title . ' (' . l:count . ' messages)' . (empty(l:model) ? '' : ' • ' . l:model),
      \ 'filename': l:id
      \ })
  endfor
  
  call setqflist(l:items)
  copen
endfunction

" URL encode helper
function! s:urlencode(str) abort
  let l:result = ''
  for l:char in split(a:str, '\zs')
    if l:char =~# '[A-Za-z0-9_.~-]'
      let l:result .= l:char
    else
      let l:result .= printf('%%%02X', char2nr(l:char))
    endif
  endfor
  return l:result
endfunction
