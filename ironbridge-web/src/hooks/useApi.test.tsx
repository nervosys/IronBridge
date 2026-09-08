// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// Regression tests for the fetch-loop bug in the filter-taking query hooks.
//
// useWorkspaces/useSessions/useSearch key their queryFn on a caller-supplied
// filter. Callers pass object literals, so keying on the object itself gives
// it a fresh identity every render: queryFn is rebuilt, the fetch effect
// re-runs, it sets state, and the component re-renders -- forever. These tests
// pin the fix (keying on a serialised form) by counting real fetches.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { useEffect } from 'react';

const listWorkspaces = vi.fn();
const listSessions = vi.fn();
const searchQuery = vi.fn();

vi.mock('../api/client', () => ({
    workspaces: {
        list: (...args: unknown[]) => listWorkspaces(...args),
        get: vi.fn(),
        discover: vi.fn(),
        refresh: vi.fn(),
    },
    sessions: { list: (...args: unknown[]) => listSessions(...args) },
    search: { query: (...args: unknown[]) => searchQuery(...args) },
    messages: {},
    providers: {},
    agents: {},
    swarms: {},
    stats: {},
    settings: {},
    system: {},
    transfer: {},
    chat: {},
    mcp: {},
    connectWebSocket: vi.fn(() => () => undefined),
}));

const ok = (data: unknown) => Promise.resolve({ success: true, data });

beforeEach(() => {
    vi.clearAllMocks();
    listWorkspaces.mockImplementation(() => ok({ items: [], total: 0 }));
    listSessions.mockImplementation(() => ok({ items: [], total: 0 }));
    searchQuery.mockImplementation(() => ok([]));
});

afterEach(cleanup);

describe('useWorkspaces', () => {
    it('does not refetch when re-rendered with an equal inline filter object', async () => {
        const { useWorkspaces } = await import('./useApi');

        // A fresh object literal on every render, which is how pages call this.
        function Probe({ tick }: { tick: number }) {
            useWorkspaces({ search: 'abc' });
            return <span data-testid="tick">{tick}</span>;
        }

        const { rerender } = render(<Probe tick={0} />);
        await waitFor(() => expect(listWorkspaces).toHaveBeenCalledTimes(1));

        for (let i = 1; i <= 5; i++) {
            rerender(<Probe tick={i} />);
        }

        // Give any runaway effect loop a chance to show itself.
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(listWorkspaces).toHaveBeenCalledTimes(1);
    });

    it('refetches when the filter contents actually change', async () => {
        const { useWorkspaces } = await import('./useApi');

        function Probe({ term }: { term: string }) {
            useWorkspaces({ search: term });
            return null;
        }

        const { rerender } = render(<Probe term="abc" />);
        await waitFor(() => expect(listWorkspaces).toHaveBeenCalledTimes(1));

        rerender(<Probe term="xyz" />);
        await waitFor(() => expect(listWorkspaces).toHaveBeenCalledTimes(2));

        expect(listWorkspaces).toHaveBeenLastCalledWith({ search: 'xyz' });
    });

    it('settles into a stable render count rather than looping', async () => {
        const { useWorkspaces } = await import('./useApi');

        let renders = 0;
        function Probe() {
            renders++;
            useWorkspaces({ search: 'abc' });
            return null;
        }

        render(<Probe />);
        await waitFor(() => expect(listWorkspaces).toHaveBeenCalledTimes(1));
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Mount plus the loading->loaded transition. The pre-fix code grew
        // without bound here.
        expect(renders).toBeLessThan(10);
    });
});

describe('useSessions', () => {
    it('does not refetch when re-rendered with an equal inline filter object', async () => {
        const { useSessions } = await import('./useApi');

        function Probe({ tick }: { tick: number }) {
            useSessions({ provider: 'claude' });
            return <span>{tick}</span>;
        }

        const { rerender } = render(<Probe tick={0} />);
        await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(1));

        rerender(<Probe tick={1} />);
        rerender(<Probe tick={2} />);
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(listSessions).toHaveBeenCalledTimes(1);
    });
});

describe('useSearch', () => {
    it('does not refetch when the types array is a new literal each render', async () => {
        const { useSearch } = await import('./useApi');

        function Probe({ tick }: { tick: number }) {
            useSearch('query', ['session', 'message']);
            return <span>{tick}</span>;
        }

        const { rerender } = render(<Probe tick={0} />);
        await waitFor(() => expect(searchQuery).toHaveBeenCalledTimes(1));

        rerender(<Probe tick={1} />);
        rerender(<Probe tick={2} />);
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(searchQuery).toHaveBeenCalledTimes(1);
    });

    it('refetches when the query changes', async () => {
        const { useSearch } = await import('./useApi');

        function Probe({ q }: { q: string }) {
            useSearch(q, ['session']);
            return null;
        }

        const { rerender } = render(<Probe q="one" />);
        await waitFor(() => expect(searchQuery).toHaveBeenCalledTimes(1));

        rerender(<Probe q="two" />);
        await waitFor(() => expect(searchQuery).toHaveBeenCalledTimes(2));
    });
});

describe('query hook error handling', () => {
    it('surfaces a rejected request as an error without leaving isLoading set', async () => {
        const { useWorkspaces } = await import('./useApi');
        listWorkspaces.mockImplementation(() => Promise.reject(new Error('network down')));

        let snapshot: { isLoading: boolean; error: Error | null } | null = null;
        function Probe() {
            const { isLoading, error } = useWorkspaces({ search: 'abc' });
            useEffect(() => {
                snapshot = { isLoading, error };
            });
            return null;
        }

        render(<Probe />);

        await waitFor(() => {
            expect(snapshot?.error?.message).toBe('network down');
            expect(snapshot?.isLoading).toBe(false);
        });
    });
});
