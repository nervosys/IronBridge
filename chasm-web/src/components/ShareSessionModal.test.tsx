// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Regression tests for the share-expiry clock.
//
// The active-share filter used to read Date.now() inside a useMemo keyed only
// on existingShares. Besides being impure, that froze the cutoff: a share that
// lapsed while the modal stayed open kept being listed as active. The fix
// moves "now" into state on a 30s interval, so these tests advance timers and
// assert the list actually reacts.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { ShareSessionModal } from './ShareSessionModal';
import type { Session, SessionShare } from '@csm/shared';

const T0 = new Date('2026-06-15T12:00:00Z').getTime();

const session = { id: 's1', title: 'Test session' } as unknown as Session;

function share(id: string, expiresAt?: number): SessionShare {
    return {
        id,
        sessionId: 's1',
        token: `tok-${id}`,
        url: `https://example.com/${id}`,
        visibility: 'link',
        // Required: the share row renders a PermissionBadge that indexes a
        // config map by this value and destructures the result.
        permission: 'view',
        createdAt: T0 - 60_000,
        expiresAt,
        viewCount: 0,
        allowDownload: true,
        allowCopy: true,
    } as unknown as SessionShare;
}

/**
 * Renders the modal and switches to the Manage Access tab, which is where the
 * active-share list lives; the modal opens on Create Share.
 */
function renderModal(shares: SessionShare[]) {
    const result = render(
        <ShareSessionModal
            isOpen
            session={session}
            existingShares={shares}
            existingAccess={[]}
            teams={[]}
            onClose={vi.fn()}
            onCreateShare={vi.fn()}
            onUpdateShare={vi.fn()}
            onRevokeShare={vi.fn()}
            onRevokeAccess={vi.fn()}
        />
    );

    fireEvent.click(screen.getByText(/Manage Access/));
    return result;
}

beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(T0);
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe('ShareSessionModal active share list', () => {
    it('counts a share with no expiry as active', () => {
        renderModal([share('a')]);
        expect(screen.getByText(/Active Shares \(1\)/)).toBeTruthy();
    });

    it('excludes a share that already expired before mount', () => {
        renderModal([share('a', T0 - 1_000)]);
        expect(screen.getByText(/Active Shares \(0\)/)).toBeTruthy();
    });

    it('drops a share once its expiry passes while the modal stays open', async () => {
        // The core regression: with a frozen cutoff this stayed at 1 forever.
        renderModal([share('a', T0 + 60_000)]);
        expect(screen.getByText(/Active Shares \(1\)/)).toBeTruthy();

        await act(async () => {
            vi.setSystemTime(T0 + 120_000);
            await vi.advanceTimersByTimeAsync(31_000);
        });

        expect(screen.getByText(/Active Shares \(0\)/)).toBeTruthy();
    });

    it('keeps a still-valid share across a tick', async () => {
        renderModal([share('a', T0 + 10 * 60_000)]);

        await act(async () => {
            vi.setSystemTime(T0 + 60_000);
            await vi.advanceTimersByTimeAsync(31_000);
        });

        expect(screen.getByText(/Active Shares \(1\)/)).toBeTruthy();
    });

    it('renders nothing when closed', () => {
        const { container } = render(
            <ShareSessionModal
                isOpen={false}
                session={session}
                existingShares={[share('a')]}
                existingAccess={[]}
                teams={[]}
                onClose={vi.fn()}
                onCreateShare={vi.fn()}
                onUpdateShare={vi.fn()}
                onRevokeShare={vi.fn()}
                onRevokeAccess={vi.fn()}
            />
        );
        expect(container.firstChild).toBeNull();
    });
});
