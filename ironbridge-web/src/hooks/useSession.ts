// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

import { useSyncExternalStore } from 'react';
import { subscribe, isLoginRequired, isAuthenticated, getUser } from '../api/session';
import type { SessionUser } from '../api/session';

/**
 * Reactive view of the client session.
 *
 * `useSyncExternalStore` subscribes to the session module, so any component
 * re-renders when a 401 raises the login screen or a login clears it.
 */
export function useSession(): {
    loginRequired: boolean;
    authenticated: boolean;
    user: SessionUser | null;
} {
    const loginRequired = useSyncExternalStore(subscribe, isLoginRequired, () => false);
    const authenticated = useSyncExternalStore(subscribe, isAuthenticated, () => false);
    const user = useSyncExternalStore(subscribe, getUser, () => null);
    return { loginRequired, authenticated, user };
}
