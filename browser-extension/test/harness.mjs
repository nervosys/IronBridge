// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// Test harness for the extension scripts.
//
// The content scripts and the service worker are plain scripts loaded by the
// browser, not modules: nothing is exported, and the content scripts wrap
// themselves in an IIFE. Rather than reshape shipping code to make it testable,
// these helpers load each file the way a browser would — a content script into
// a real DOM with a `chrome` object in scope, the service worker into a bare
// function scope — and drive it through the same surface the browser uses.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * A `chrome` stand-in covering the APIs these scripts touch. Storage is a real
 * map so writes are observable; everything else records its calls.
 */
export function makeChrome({ storage = {} } = {}) {
  const store = new Map(Object.entries(storage));
  const calls = {
    alarmsCreated: [],
    alarmsCleared: [],
    menusCreated: [],
    menusRemoved: 0,
    notifications: [],
    tabMessages: [],
  };
  const listeners = {
    message: [],
    installed: [],
    startup: [],
    alarm: [],
    menuClicked: [],
    storageChanged: [],
  };

  const chrome = {
    runtime: {
      lastError: undefined,
      onMessage: { addListener: (fn) => listeners.message.push(fn) },
      onInstalled: { addListener: (fn) => listeners.installed.push(fn) },
      onStartup: { addListener: (fn) => listeners.startup.push(fn) },
      getURL: (path) => `chrome-extension://test/${path}`,
    },
    storage: {
      onChanged: { addListener: (fn) => listeners.storageChanged.push(fn) },
      local: {
        async get(keys) {
          if (keys === null || keys === undefined) return Object.fromEntries(store);
          const wanted = Array.isArray(keys) ? keys : [keys];
          const out = {};
          for (const k of wanted) if (store.has(k)) out[k] = store.get(k);
          return out;
        },
        async set(obj) {
          for (const [k, v] of Object.entries(obj)) store.set(k, v);
        },
      },
    },
    alarms: {
      create: (name, opts) => calls.alarmsCreated.push({ name, ...opts }),
      clear: async (name) => {
        calls.alarmsCleared.push(name);
        return true;
      },
      onAlarm: { addListener: (fn) => listeners.alarm.push(fn) },
    },
    contextMenus: {
      create: (opts) => calls.menusCreated.push(opts),
      removeAll: (cb) => {
        calls.menusRemoved += 1;
        if (cb) cb();
      },
      onClicked: { addListener: (fn) => listeners.menuClicked.push(fn) },
    },
    notifications: {
      create: (opts) => calls.notifications.push(opts),
    },
    tabs: {
      query: async () => [{ id: 1, url: 'https://example.test/' }],
      sendMessage: async (tabId, message) => {
        calls.tabMessages.push({ tabId, message });
        return { session: null };
      },
    },
    action: { setBadgeText: () => {}, setBadgeBackgroundColor: () => {} },
  };

  return { chrome, calls, store, listeners };
}

/**
 * Load a content script into a fresh DOM at `url` and return a `send` function
 * that delivers a message the way `chrome.tabs.sendMessage` would, resolving
 * with whatever the script passes to `sendResponse`.
 */
export function loadContentScript(relPath, { html = '<!doctype html><html><body></body></html>', url }) {
  const src = readFileSync(join(root, relPath), 'utf8');
  const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
  const { chrome, calls, store, listeners } = makeChrome();

  dom.window.chrome = chrome;
  // jsdom has no clipboard; the copy path only needs it to exist.
  Object.defineProperty(dom.window.navigator, 'clipboard', {
    value: { writeText: async () => {} },
    configurable: true,
  });
  dom.window.eval(src);

  const send = (message) =>
    new Promise((resolve, reject) => {
      if (listeners.message.length === 0) {
        reject(new Error(`${relPath} registered no onMessage listener`));
        return;
      }
      let settled = false;
      const sendResponse = (value) => {
        settled = true;
        resolve(value);
      };
      const kept = listeners.message.map((fn) => fn(message, { tab: { id: 1 } }, sendResponse));
      // A listener returning true promises an async sendResponse; otherwise a
      // synchronous handler has already resolved, and anything else is a miss.
      if (!settled && !kept.some(Boolean)) {
        reject(new Error(`no listener handled ${JSON.stringify(message.action)}`));
      }
    });

  return { dom, window: dom.window, document: dom.window.document, send, chrome, calls, store };
}

/**
 * Load the service worker. It is a flat script, so appending a return statement
 * to the function body hands back its top-level declarations without touching
 * the file itself.
 */
export function loadServiceWorker({ storage = {}, fetchImpl } = {}) {
  const src = readFileSync(join(root, 'background/service-worker.js'), 'utf8');
  const { chrome, calls, store, listeners } = makeChrome({ storage });
  const fetchCalls = [];
  const fetchFn =
    fetchImpl ??
    (async () => ({ ok: true, status: 200, statusText: 'OK', json: async () => ({ success: true, data: {} }) }));

  const wrapped = new Function(
    'chrome',
    'fetch',
    'console',
    `${src}\nreturn { apiHeaders, serverReason, initAutoHarvest, createContextMenus, checkApiConnection, API_BASE };`
  );

  const exports = wrapped(
    chrome,
    async (...args) => {
      fetchCalls.push(args);
      return fetchFn(...args);
    },
    { log() {}, error() {}, warn() {} }
  );

  return { ...exports, chrome, calls, store, listeners, fetchCalls };
}
