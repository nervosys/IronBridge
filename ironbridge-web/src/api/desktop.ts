// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// Point the API client at the desktop app's embedded server.
//
// In the browser the API URL comes from VITE_API_BASE_URL, defaulting to port
// 8787. The desktop app runs its own server on a different port -- chosen so
// it does not collide with a `ironbridge api serve` the user may be running -- so
// the built-in default would send every request to the wrong place, or to
// nothing at all.

import { configure } from './client';
import { isTauri } from '../hooks/useTauri';

interface DesktopServerStatus {
    running: boolean;
    mode: 'embedded' | 'adopted' | 'failed';
    url: string;
    port: number;
    error?: string;
}

/** How long to keep waiting for the embedded server on a cold start. */
const STARTUP_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 400;

/** Marks an IPC call that could not be made at all. */
const IPC_BROKEN = Symbol('ipc-broken');

/**
 * A rejected invoke means the bridge itself is unusable, which is a different
 * thing from a server that has not finished starting. Collapsing both to
 * `null` made a broken bridge get retried for the whole startup window,
 * delaying the error the user needs to see.
 */
async function invoke<T>(cmd: string): Promise<T | typeof IPC_BROKEN> {
    const internals = window.__TAURI_INTERNALS__;
    if (!internals) return IPC_BROKEN;
    try {
        return await internals.invoke<T>(cmd);
    } catch {
        return IPC_BROKEN;
    }
}

/**
 * Resolve the desktop API URL and point the client at it.
 *
 * Returns the status so a caller can surface a real failure rather than
 * letting every subsequent request fail one at a time with no explanation.
 * A no-op in the browser.
 */
export async function configureDesktopApi(
    options: { timeoutMs?: number; pollIntervalMs?: number } = {}
): Promise<DesktopServerStatus | null> {
    if (!isTauri()) return null;

    const timeoutMs = options.timeoutMs ?? STARTUP_TIMEOUT_MS;
    const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
    const deadline = Date.now() + timeoutMs;
    let status = await invoke<DesktopServerStatus>('get_api_server_status');
    if (status === IPC_BROKEN) return null;

    // The server is started in parallel with the window, so on a cold start
    // the first status read usually arrives before it is listening.
    while (!status.running && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        const next = await invoke<DesktopServerStatus>('get_api_server_status');
        if (next === IPC_BROKEN) return null;
        status = next;
    }

    // One explicit retry: startup may have failed for a transient reason
    // (a port briefly held by a closing instance) that a second attempt clears.
    if (!status.running) {
        const retried = await invoke<DesktopServerStatus>('start_api_server');
        if (retried === IPC_BROKEN) return status;
        status = retried;
    }

    if (status.running) {
        configure({ baseUrl: status.url });
    }
    return status;
}
