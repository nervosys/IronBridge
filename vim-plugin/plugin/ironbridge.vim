" IronBridge.vim - Vim plugin for AI chat session management
" Copyright (c) 2024-2027 Nervosys LLC
" SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

if exists('g:loaded_ironbridge')
  finish
endif
let g:loaded_ironbridge = 1

" Configuration defaults
if !exists('g:ironbridge_server_url')
  let g:ironbridge_server_url = 'http://localhost:8787'
endif

if !exists('g:ironbridge_auto_sync')
  let g:ironbridge_auto_sync = 0
endif

" Commands
command! -nargs=0 IronBridgeHealth call ironbridge#health()
command! -nargs=0 IronBridgeHarvest call ironbridge#harvest()
command! -nargs=0 IronBridgeSync call ironbridge#sync()
command! -nargs=0 IronBridgeStats call ironbridge#stats()
command! -nargs=? IronBridgeSearch call ironbridge#search(<q-args>)
command! -nargs=? IronBridgeView call ironbridge#view(<q-args>)
command! -nargs=0 IronBridgeSessions call ironbridge#sessions()

" Default keymaps (can be disabled with g:ironbridge_no_mappings)
if !exists('g:ironbridge_no_mappings') || !g:ironbridge_no_mappings
  nnoremap <silent> <leader>cs :IronBridgeSearch<CR>
  nnoremap <silent> <leader>ch :IronBridgeHarvest<CR>
  nnoremap <silent> <leader>cv :IronBridgeSessions<CR>
  nnoremap <silent> <leader>cy :IronBridgeSync<CR>
endif
