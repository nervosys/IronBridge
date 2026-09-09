// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

import { describe, expect, it } from 'vitest';
import { loadServiceWorker } from './harness.mjs';

describe('apiHeaders', () => {
  it('sends the bearer token when one is stored', async () => {
    const { apiHeaders } = loadServiceWorker({ storage: { accessToken: 'tok-123' } });
    const headers = await apiHeaders();

    expect(headers.Authorization).toBe('Bearer tok-123');
    expect(headers.Accept).toBe('application/json');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('sends no Authorization header when no token is stored', async () => {
    // Correct against a server that does not require auth; the alternative is
    // sending `Bearer undefined`, which a server would reject as malformed.
    const { apiHeaders } = loadServiceWorker();
    const headers = await apiHeaders();

    expect(headers).not.toHaveProperty('Authorization');
  });

  it('keeps caller-supplied headers and still attaches the token', async () => {
    const { apiHeaders } = loadServiceWorker({ storage: { accessToken: 'tok-123' } });
    const headers = await apiHeaders({ 'X-Request-Id': 'r-1' });

    expect(headers['X-Request-Id']).toBe('r-1');
    expect(headers.Authorization).toBe('Bearer tok-123');
  });
});

describe('serverReason', () => {
  it("prefers the server's own error sentence", async () => {
    const { serverReason } = loadServiceWorker();
    const reason = await serverReason({
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ success: false, error: 'session id already exists' }),
    });

    expect(reason).toBe('session id already exists');
  });

  it('falls back to the status line when the body is not JSON', async () => {
    // A proxy's HTML error page, say. Inventing a reason here would be worse
    // than reporting the status.
    const { serverReason } = loadServiceWorker();
    const reason = await serverReason({
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    });

    expect(reason).toBe('IronBridge answered 502 Bad Gateway');
  });

  it('falls back when the JSON body carries no usable error', async () => {
    const { serverReason } = loadServiceWorker();

    for (const body of [{ success: false }, { error: '' }, { error: '   ' }, { error: 42 }]) {
      const reason = await serverReason({ status: 500, statusText: 'Internal Server Error', json: async () => body });
      expect(reason).toBe('IronBridge answered 500 Internal Server Error');
    }
  });
});

describe('auto-harvest alarm', () => {
  it('schedules an alarm at the configured interval when enabled', async () => {
    const { initAutoHarvest, calls } = loadServiceWorker({
      storage: { autoHarvest: true, harvestInterval: 15 },
    });
    await initAutoHarvest();

    expect(calls.alarmsCleared).toContain('auto-harvest');
    expect(calls.alarmsCreated).toEqual([
      { name: 'auto-harvest', delayInMinutes: 1, periodInMinutes: 15 },
    ]);
  });

  it('defaults to 30 minutes when no interval is stored', async () => {
    const { initAutoHarvest, calls } = loadServiceWorker({ storage: { autoHarvest: true } });
    await initAutoHarvest();

    expect(calls.alarmsCreated[0].periodInMinutes).toBe(30);
  });

  it('clears the alarm and schedules nothing when disabled', async () => {
    // The clear has to happen on the disabled path too, or turning the setting
    // off leaves the previous alarm running.
    const { initAutoHarvest, calls } = loadServiceWorker({ storage: { autoHarvest: false } });
    await initAutoHarvest();

    expect(calls.alarmsCleared).toContain('auto-harvest');
    expect(calls.alarmsCreated).toEqual([]);
  });
});

describe('install', () => {
  it('writes defaults and builds the context menus', async () => {
    const { listeners, store, calls } = loadServiceWorker();
    expect(listeners.installed).toHaveLength(1);

    await listeners.installed[0]();

    expect(store.get('apiUrl')).toBe('http://localhost:8787');
    expect(store.get('autoHarvest')).toBe(false);
    expect(store.get('harvestInterval')).toBe(30);
    expect(store.get('notifications')).toBe(true);
    expect(calls.menusCreated.length).toBeGreaterThan(0);
  });
});

describe('checkApiConnection', () => {
  it('reports a reachable server, and asks /api/health', async () => {
    const { checkApiConnection, fetchCalls } = loadServiceWorker({
      storage: { accessToken: 'tok-123' },
      fetchImpl: async () => ({ ok: true, status: 200, statusText: 'OK', json: async () => ({ success: true }) }),
    });

    await expect(checkApiConnection()).resolves.toEqual({ connected: true });
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0][0]).toBe('http://localhost:8787/api/health');
    // The probe is authenticated too: against a server that requires auth, an
    // unauthenticated probe answers 401 and the extension would call a healthy
    // server unreachable.
    expect(fetchCalls[0][1].headers.Authorization).toBe('Bearer tok-123');
  });

  it('reports an unreachable server rather than throwing', async () => {
    const { checkApiConnection } = loadServiceWorker({
      fetchImpl: async () => {
        throw new TypeError('Failed to fetch');
      },
    });

    await expect(checkApiConnection()).resolves.toEqual({ connected: false });
  });

  it('treats a non-ok response as not connected', async () => {
    const { checkApiConnection } = loadServiceWorker({
      fetchImpl: async () => ({ ok: false, status: 503, statusText: 'Service Unavailable', json: async () => ({}) }),
    });

    await expect(checkApiConnection()).resolves.toEqual({ connected: false });
  });
});
