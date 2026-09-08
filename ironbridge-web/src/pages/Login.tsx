// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

import { useState } from 'react';
import { Lock, LogIn, UserPlus } from 'lucide-react';
import { auth } from '../api/client';

/**
 * The login / register screen.
 *
 * Shown by `AuthGate` only when the server has returned 401 -- i.e. when
 * `IRONBRIDGE_REQUIRE_AUTH` is set. On success `auth.login`/`auth.register` store the
 * token in the session module, which flips `isLoginRequired()` off and lets the
 * app render. There is no route for this; it replaces the whole app while login
 * is required, so a half-loaded authenticated page is never visible behind it.
 */
export function Login() {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !password) return;
        setBusy(true);
        setError(null);
        const result =
            mode === 'login'
                ? await auth.login(email.trim(), password)
                : await auth.register(email.trim(), password, displayName.trim() || email.trim());
        setBusy(false);
        if (!result.ok) {
            setError(result.error);
        }
        // On success the session module notifies AuthGate, which unmounts this.
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))] p-4">
            <div className="w-full max-w-sm bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] p-6 shadow-lg">
                <div className="flex items-center gap-2 mb-6">
                    <Lock className="w-5 h-5 text-[hsl(var(--primary))]" />
                    <h1 className="text-lg font-semibold text-[hsl(var(--foreground))]">
                        {mode === 'login' ? 'Sign in to IronBridge' : 'Create an account'}
                    </h1>
                </div>

                <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
                    This server requires authentication.
                </p>

                <form onSubmit={submit} className="space-y-3">
                    {mode === 'register' && (
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Display name"
                            autoComplete="name"
                            className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                        />
                    )}
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email"
                        autoComplete="username"
                        required
                        className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        required
                        className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                    />

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <button
                        type="submit"
                        disabled={busy || !email.trim() || !password}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90 transition-colors disabled:opacity-50"
                    >
                        {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                        {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
                    </button>
                </form>

                <button
                    onClick={() => {
                        setMode(mode === 'login' ? 'register' : 'login');
                        setError(null);
                    }}
                    className="mt-4 text-sm text-[hsl(var(--primary))] hover:underline"
                >
                    {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
                </button>
            </div>
        </div>
    );
}
