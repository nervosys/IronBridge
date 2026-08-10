// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

// Tests for pointing the API client at the desktop app's embedded server.
//
// Getting this wrong is quiet and total: the client keeps its browser default
// of port 8787, every request in the desktop app goes nowhere, and the UI
// looks like a backend outage rather than a misconfiguration.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const configure = vi.fn();
vi.mock('./client', () => ({
    configure: (...args: unknown[]) => configure(...args),
}));

import { configureDesktopApi } from './desktop';

type Invoke = (cmd: string) => Promise<unknown>;

function asTauri(invoke: Invoke) {
    (window as unknown as { __TAURI_INTERNALS__?: { invoke: Invoke } }).__TAURI_INTERNALS__ = {
        invoke,
    };
}

function asBrowser() {
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

const RUNNING = {
    running: true,
    mode: 'embedded',
    url: 'http://127.0.0.1:8788',
    port: 8788,
};

describe('configureDesktopApi', () => {
    beforeEach(() => {
        configure.mockClear();
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
        vi.useRealTimers();
        asBrowser();
    });

    it('does nothing in a browser', async () => {
        asBrowser();
        const status = await configureDesktopApi({ timeoutMs: 300, pollIntervalMs: 50 });
        expect(status).toBeNull();
        expect(configure).not.toHaveBeenCalled();
    });

    it('points the client at the reported url', async () => {
        asTauri(async () => RUNNING);
        const status = await configureDesktopApi({ timeoutMs: 300, pollIntervalMs: 50 });
        expect(status).toEqual(RUNNING);
        expect(configure).toHaveBeenCalledWith({ baseUrl: 'http://127.0.0.1:8788' });
    });

    it('uses the reported port rather than the browser default', async () => {
        asTauri(async () => ({ ...RUNNING, url: 'http://127.0.0.1:9999', port: 9999 }));
        await configureDesktopApi({ timeoutMs: 300, pollIntervalMs: 50 });
        const [[arg]] = configure.mock.calls as [[{ baseUrl: string }]];
        expect(arg.baseUrl).not.toContain('8787');
        expect(arg.baseUrl).toContain('9999');
    });

    it('waits for a server that is still starting', async () => {
        // A cold start reports not-running first; giving up immediately would
        // strand the app on the wrong URL for the whole session.
        let calls = 0;
        asTauri(async () => {
            calls += 1;
            return calls < 3 ? { ...RUNNING, running: false } : RUNNING;
        });
        const status = await configureDesktopApi({ timeoutMs: 300, pollIntervalMs: 50 });
        expect(status?.running).toBe(true);
        expect(configure).toHaveBeenCalledWith({ baseUrl: RUNNING.url });
    });

    it('never configures a url when the server failed to start', async () => {
        // Configuring anyway would mask the failure behind ordinary request
        // errors instead of letting the caller report it.
        asTauri(async () => ({
            running: false,
            mode: 'failed',
            url: 'http://127.0.0.1:8788',
            port: 8788,
            error: 'port in use',
        }));
        const status = await configureDesktopApi({ timeoutMs: 300, pollIntervalMs: 50 });
        expect(status?.running).toBe(false);
        expect(status?.error).toBe('port in use');
        expect(configure).not.toHaveBeenCalled();
    });

    it('survives an invoke that throws', async () => {
        asTauri(async () => {
            throw new Error('ipc gone');
        });
        const status = await configureDesktopApi({ timeoutMs: 300, pollIntervalMs: 50 });
        expect(status).toBeNull();
        expect(configure).not.toHaveBeenCalled();
    });
});
