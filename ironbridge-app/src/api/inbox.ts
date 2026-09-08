// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// =============================================================================
// Agent inbox (`/api/inbox/*`)
// =============================================================================
//
// The inbox this screen shows is the server's, not the device's.
//
// It used to be backed by `agentNotifications.ts`, which kept notifications,
// messages, permissions and workflows in AsyncStorage. That store had four
// producers -- `addNotification`, `addInboxMessage`, `requestPermission` and
// `updateWorkflowProgress` -- and not one of them was called from anywhere in
// the app. Nothing ever wrote to it, so the inbox could only ever be empty:
// four tabs, unread badges and an approve/deny flow over a store with no
// writer.
//
// The rows are produced server-side by `src/agency/runtime.rs` as agents
// actually run -- `workflow_started`, `message_from_agent`, `notify` -- which
// is why these endpoints are the ones with something in them.
//
// Field names below are the server's wire names, verified against
// `ironbridge-rust/src/api/inbox.rs`: the records serialize `rename_all =
// "camelCase"`, and `InboxMessage`/`PermissionRequest` both rename their Rust
// `kind` field to `type`.

import { apiClient } from './client';
import type {
    AgentNotification,
    InboxMessage,
    PermissionRequest,
    WorkflowProgress,
} from './inboxTypes';

export type {
    AgentNotification,
    InboxMessage,
    PermissionRequest,
    WorkflowProgress,
};

/** What `GET /api/inbox` answers with: the whole inbox in one round trip. */
export interface InboxSnapshot {
    notifications: AgentNotification[];
    messages: InboxMessage[];
    permissions: PermissionRequest[];
    workflows: WorkflowProgress[];
}

/** What `GET /api/inbox/counts` answers with. */
export interface InboxCounts {
    unreadNotifications: number;
    unreadMessages: number;
    pendingPermissions: number;
    activeWorkflows: number;
}

/**
 * Unwrap `{ success, data }`.
 *
 * Every inbox route answers in that envelope -- see `ok()` in `inbox.rs` --
 * so unlike the shared helper this does not need to cope with a bare body.
 */
function unwrap<T>(response: { data: { success?: boolean; data?: T } }): T {
    return response.data?.data as T;
}

export const inbox = {
    /**
     * The whole inbox in one request.
     *
     * Four separate GETs would work too, but they would be four snapshots
     * taken at four different moments -- the counts could disagree with the
     * lists they are counting.
     *
     * The four lists are filtered to the rows the screen is about, because the
     * endpoints and `/counts` do not agree on their own: `/inbox` returns every
     * row it has, while `/counts` counts only the live ones. Left unfiltered, a
     * notification would stay on screen after being dismissed, an approved
     * permission would stay in the Permissions tab, and each tab's badge would
     * disagree with the list under it. The predicates below are the ones
     * `inbox_counts` uses, in the same order, so the two cannot drift:
     *
     *   unreadNotifications  is_read=0 AND dismissed=0
     *   unreadMessages       is_read=0 AND archived=0
     *   pendingPermissions   status='pending' AND expires_at > now
     *   activeWorkflows      status IN ('running','paused')
     *
     * Permission expiry is already derived server-side -- a lapsed request
     * comes back with status `expired`, not `pending` -- so testing the status
     * here is enough and no clock comparison is needed.
     */
    async snapshot(): Promise<InboxSnapshot> {
        const response = await apiClient.get('/api/inbox');
        const data = unwrap<Partial<InboxSnapshot>>(response) ?? {};
        return {
            notifications: (data.notifications ?? []).filter(n => !n.dismissed),
            messages: (data.messages ?? []).filter(m => !m.archived),
            permissions: (data.permissions ?? []).filter(p => p.status === 'pending'),
            workflows: (data.workflows ?? []).filter(
                w => w.status === 'running' || w.status === 'paused'
            ),
        };
    },

    async counts(): Promise<InboxCounts> {
        const response = await apiClient.get('/api/inbox/counts');
        const data = unwrap<Partial<InboxCounts>>(response) ?? {};
        return {
            unreadNotifications: data.unreadNotifications ?? 0,
            unreadMessages: data.unreadMessages ?? 0,
            pendingPermissions: data.pendingPermissions ?? 0,
            activeWorkflows: data.activeWorkflows ?? 0,
        };
    },

    async markNotificationRead(id: string): Promise<void> {
        await apiClient.post(`/api/inbox/notifications/${encodeURIComponent(id)}/read`);
    },

    async markAllNotificationsRead(): Promise<void> {
        await apiClient.post('/api/inbox/notifications/read-all');
    },

    async dismissNotification(id: string): Promise<void> {
        await apiClient.post(`/api/inbox/notifications/${encodeURIComponent(id)}/dismiss`);
    },

    async markMessageRead(id: string): Promise<void> {
        await apiClient.post(`/api/inbox/messages/${encodeURIComponent(id)}/read`);
    },

    /**
     * Star or unstar. The server toggles from its own stored value rather than
     * taking a desired state, so this takes no argument.
     */
    async toggleMessageStar(id: string): Promise<void> {
        await apiClient.post(`/api/inbox/messages/${encodeURIComponent(id)}/star`);
    },

    async archiveMessage(id: string): Promise<void> {
        await apiClient.post(`/api/inbox/messages/${encodeURIComponent(id)}/archive`);
    },

    async respondToMessage(id: string, response: string): Promise<void> {
        await apiClient.post(`/api/inbox/messages/${encodeURIComponent(id)}/respond`, { response });
    },

    /**
     * Approve or deny a pending permission request.
     *
     * The server refuses an expired request rather than approving it late:
     * the agent that raised it has already been told no. A 404 or 409 here
     * therefore means the request is gone or stale, not that the call failed.
     */
    async respondToPermission(
        id: string,
        approved: boolean,
        options?: { scope?: string; note?: string }
    ): Promise<void> {
        await apiClient.post(`/api/inbox/permissions/${encodeURIComponent(id)}/respond`, {
            approved,
            scope: options?.scope,
            note: options?.note,
        });
    },
};
