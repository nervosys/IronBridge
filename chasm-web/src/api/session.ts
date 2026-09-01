// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

/**
 * Client-side session: the bearer token, and the "you need to log in" signal.
 *
 * The design is 401-driven. The client does not probe the server to ask whether
 * authentication is on; it just makes requests. When the server has
 * `CHASM_REQUIRE_AUTH` set, an unauthenticated call comes back 401, `request()`
 * reports it here, and the app shows the login screen. When the server does not
 * require auth (the local-first default), no 401 ever arrives and none of this
 * is visible. One code path serves both, with nothing to configure.
 *
 * The token lives under `csm_access_token` -- the same key the shared
 * `AuthService` uses -- so the two agree on what "logged in" means.
 */

const ACCESS_TOKEN_KEY = 'csm_access_token';
const USER_KEY = 'csm_user';

export interface SessionUser {
    id: string;
    email: string;
    displayName: string;
}

type Listener = () => void;
const listeners = new Set<Listener>();

/**
 * True once a request has come back 401 and we have no token to retry with.
 *
 * Held in a module variable rather than derived from the token alone, because
 * "no token" is the normal state when the server does not require auth -- it
 * must not by itself mean "show the login screen". Only a real 401 sets this.
 */
let loginRequired = false;

function readStorage(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        // Private mode, disabled storage: behave as logged-out rather than throw.
        return null;
    }
}

function writeStorage(key: string, value: string | null): void {
    try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
    } catch {
        // Non-fatal: the token simply won't persist across reloads.
    }
}

function emit(): void {
    listeners.forEach((l) => l());
}

/** Subscribe to auth-state changes; returns an unsubscribe function. */
export function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function getToken(): string | null {
    return readStorage(ACCESS_TOKEN_KEY);
}

export function getUser(): SessionUser | null {
    const raw = readStorage(USER_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as SessionUser;
    } catch {
        return null;
    }
}

export function isAuthenticated(): boolean {
    return getToken() !== null;
}

/** Whether the app should render the login screen. */
export function isLoginRequired(): boolean {
    return loginRequired && !isAuthenticated();
}

/**
 * Record a session. Clears the login-required flag: a token means we are in.
 */
export function setSession(token: string, user?: SessionUser): void {
    writeStorage(ACCESS_TOKEN_KEY, token);
    if (user) writeStorage(USER_KEY, JSON.stringify(user));
    loginRequired = false;
    emit();
}

/** Drop the token and, unless this is an explicit logout, ask for login. */
export function clearSession(requireLogin: boolean): void {
    writeStorage(ACCESS_TOKEN_KEY, null);
    writeStorage(USER_KEY, null);
    loginRequired = requireLogin;
    emit();
}

/**
 * Called by `request()` when a call returns 401.
 *
 * The stored token, if any, is stale or rejected, so it is dropped and the
 * login screen is requested. A no-op-looking 401 on a server that does not
 * require auth cannot happen -- that server never returns 401 for missing
 * credentials -- so this only fires when login is genuinely needed.
 */
export function markUnauthorized(): void {
    clearSession(true);
}

export function logout(): void {
    clearSession(false);
}
