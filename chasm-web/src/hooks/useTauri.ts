/**
 * Tauri Desktop Integration Hook
 *
 * Detects whether the app is running inside a Tauri desktop shell
 * and provides access to native desktop APIs (app info, platform,
 * tray control, devtools, API health checks).
 *
 * When running in the browser, all functions are no-ops that return
 * safe defaults.
 */

import { useState, useEffect, useCallback } from 'react';

// Type declarations for Tauri's global injection
declare global {
    interface Window {
        __TAURI_INTERNALS__?: {
            invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
        };
    }
}

export interface AppInfo {
    name: string;
    version: string;
    tauri_version: string;
}

export interface ApiHealth {
    healthy: boolean;
    message: string;
    api_url: string;
}

/**
 * Check if running inside Tauri desktop shell
 */
export function isTauri(): boolean {
    return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;
}

/**
 * Invoke a Tauri IPC command (no-op if not in Tauri)
 */
async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
    if (!isTauri()) return null;
    try {
        return await window.__TAURI_INTERNALS__!.invoke<T>(cmd, args);
    } catch (err) {
        console.warn(`[Tauri] invoke "${cmd}" failed:`, err);
        return null;
    }
}

/**
 * Hook providing Tauri desktop integration
 */
export function useTauri() {
    const [desktop, setDesktop] = useState(false);
    const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
    const [platform, setPlatform] = useState<string | null>(null);

    useEffect(() => {
        const inTauri = isTauri();
        setDesktop(inTauri);
        if (!inTauri) return;

        // Fetch app info and platform on mount
        (async () => {
            const [info, plat] = await Promise.all([
                invoke<AppInfo>('get_app_info'),
                invoke<string>('get_platform'),
            ]);
            if (info) setAppInfo(info);
            if (plat) setPlatform(plat);
        })();
    }, []);

    const minimizeToTray = useCallback(async () => {
        await invoke('minimize_to_tray');
    }, []);

    const openDevtools = useCallback(async () => {
        await invoke('open_devtools');
    }, []);

    const checkApiHealth = useCallback(async (apiUrl: string): Promise<ApiHealth | null> => {
        return invoke<ApiHealth>('check_api_health', { apiUrl });
    }, []);

    return {
        /** True when running inside Tauri desktop shell */
        isDesktop: desktop,
        /** App name, version, and Tauri version (null in browser) */
        appInfo,
        /** OS platform string (null in browser) */
        platform,
        /** Hide window to system tray */
        minimizeToTray,
        /** Open Chromium DevTools (debug builds only) */
        openDevtools,
        /** Ping the chasm-cli API server */
        checkApiHealth,
    };
}

export default useTauri;
