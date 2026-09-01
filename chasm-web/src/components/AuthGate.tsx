// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import type { ReactNode } from 'react';
import { useSession } from '../hooks/useSession';
import { Login } from '../pages/Login';

/**
 * Renders the app, or the login screen when the server demands authentication.
 *
 * "Demands" means a request has actually come back 401 -- see `api/session`.
 * On the local-first default, where the server never requires auth, no 401 ever
 * arrives, `loginRequired` stays false, and this is a transparent pass-through.
 * So wrapping the whole app in it costs nothing when auth is off and is the
 * entire gate when it is on.
 */
export function AuthGate({ children }: { children: ReactNode }) {
    const { loginRequired } = useSession();
    if (loginRequired) {
        return <Login />;
    }
    return <>{children}</>;
}
