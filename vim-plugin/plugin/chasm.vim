" Chasm.vim - Vim plugin for AI chat session management
" Copyright (c) 2024-2027 Nervosys LLC
" SPDX-License-Identifier: AGPL-3.0-only

if exists('g:loaded_chasm')
  finish
endif
let g:loaded_chasm = 1

" Configuration defaults
if !exists('g:chasm_server_url')
  let g:chasm_server_url = 'http://localhost:8787'
endif

if !exists('g:chasm_auto_sync')
  let g:chasm_auto_sync = 0
endif

" Commands
command! -nargs=0 ChasmHealth call chasm#health()
command! -nargs=0 ChasmHarvest call chasm#harvest()
command! -nargs=0 ChasmSync call chasm#sync()
command! -nargs=0 ChasmStats call chasm#stats()
command! -nargs=? ChasmSearch call chasm#search(<q-args>)
command! -nargs=? ChasmView call chasm#view(<q-args>)
command! -nargs=0 ChasmSessions call chasm#sessions()

" Default keymaps (can be disabled with g:chasm_no_mappings)
if !exists('g:chasm_no_mappings') || !g:chasm_no_mappings
  nnoremap <silent> <leader>cs :ChasmSearch<CR>
  nnoremap <silent> <leader>ch :ChasmHarvest<CR>
  nnoremap <silent> <leader>cv :ChasmSessions<CR>
  nnoremap <silent> <leader>cy :ChasmSync<CR>
endif
