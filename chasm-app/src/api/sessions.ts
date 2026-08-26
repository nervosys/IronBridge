// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

// =============================================================================
// CSM App - Sessions API
// =============================================================================
// Re-exports shared types and provides API functions using axios client
// Aligned with csm-web/src/api/client.ts for feature parity

import { apiClient } from './client';

// Re-export shared types for convenience
export type {
    Workspace,
    Session,
    SessionWithMessages,
    Message,
    ToolInvocation,
    FileChange,
    Provider,
    ProviderHealth,
    Checkpoint,
    ShareLink,
    Statistics as Stats,
    SearchResult,
    Agent,
    Swarm,
    AgentRun,
} from '@csm/shared';

// Import types for internal use
import type {
    Workspace,
    Session,
    SessionWithMessages,
    Message,
    Provider,
    ProviderHealth,
    Checkpoint,
    ShareLink,
    Statistics as Stats,
    SearchResult,
    Agent,
    Swarm,
    AgentRun,
} from '@csm/shared';

// =============================================================================
// Response Helpers
// =============================================================================

/**
 * Unwrap API response data, handling both wrapped and unwrapped formats.
 * Also handles paginated responses with { items: [], total: ... } format.
 * Ensures arrays are proper JavaScript arrays to avoid iterator issues
 * with Hermes engine.
 */
function unwrapResponse<T>(response: { data: { data?: T; success?: boolean } | T }): T {
    let data: unknown = response.data;

    // Unwrap { success: true, data: ... } format
    if (data && typeof data === 'object' && 'data' in data) {
        data = (data as { data: unknown }).data;
    }

    // Handle paginated response { items: [], total: ... }
    if (data && typeof data === 'object' && 'items' in data && Array.isArray((data as { items: unknown[] }).items)) {
        const items = (data as { items: unknown[] }).items;
        return [...items] as T;
    }

    // Ensure arrays are proper arrays (fixes Hermes iterator issues)
    if (Array.isArray(data)) {
        return [...data] as T;
    }

    return data as T;
}

// =============================================================================
// Workspaces API (matches csm-web)
// =============================================================================

export const workspaces = {
    async list(): Promise<Workspace[]> {
        const response = await apiClient.get('/api/workspaces');
        return unwrapResponse(response) || [];
    },

    async get(id: string): Promise<Workspace> {
        const response = await apiClient.get(`/api/workspaces/${encodeURIComponent(id)}`);
        return unwrapResponse(response);
    },

};

// Legacy function exports for backward compatibility
export async function getWorkspaces(): Promise<Workspace[]> {
    return workspaces.list();
}

export async function getWorkspace(id: string): Promise<Workspace> {
    return workspaces.get(id);
}

// =============================================================================
// Sessions API (matches csm-web)
// =============================================================================

export const sessions = {
    async list(params?: {
        workspace_id?: string;
        provider?: string;
        limit?: number;
        offset?: number;
        archived?: boolean;
    }): Promise<Session[]> {
        const response = await apiClient.get('/api/sessions', { params });
        return unwrapResponse(response) || [];
    },

    async get(id: string): Promise<SessionWithMessages> {
        const response = await apiClient.get(`/api/sessions/${encodeURIComponent(id)}`);
        const data = unwrapResponse<any>(response);
        // API returns { session: {...}, messages: [...], tool_invocations: [...], file_changes: [...] }
        if (data.session) {
            return {
                ...data.session,
                messages: data.messages || [],
                toolInvocations: data.tool_invocations || [],
                fileChanges: data.file_changes || [],
            };
        }
        return data;
    },

    async create(data: Partial<Session>): Promise<Session> {
        const response = await apiClient.post('/api/sessions', data);
        return unwrapResponse(response);
    },

    async update(id: string, data: Partial<Session>): Promise<Session> {
        const response = await apiClient.put(`/api/sessions/${encodeURIComponent(id)}`, data);
        return unwrapResponse(response);
    },

    async delete(id: string): Promise<void> {
        await apiClient.delete(`/api/sessions/${encodeURIComponent(id)}`);
    },

    async fork(id: string, fromMessageId?: string): Promise<Session> {
        const response = await apiClient.post(`/api/sessions/${encodeURIComponent(id)}/fork`, { fromMessageId });
        return unwrapResponse(response);
    },

    async merge(sessionIds: string[], title: string): Promise<Session> {
        const response = await apiClient.post('/api/sessions/merge', { sessionIds, title });
        return unwrapResponse(response);
    },

    async export(id: string, format: 'json' | 'markdown' = 'json'): Promise<string> {
        const response = await apiClient.get(`/api/sessions/${encodeURIComponent(id)}/export`, {
            params: { format },
        });
        return response.data;
    },

    async checkpoints(id: string): Promise<Checkpoint[]> {
        const response = await apiClient.get(`/api/sessions/${encodeURIComponent(id)}/checkpoints`);
        return unwrapResponse(response) || [];
    },

    async createCheckpoint(id: string, data: Partial<Checkpoint>): Promise<Checkpoint> {
        const response = await apiClient.post(`/api/sessions/${encodeURIComponent(id)}/checkpoints`, data);
        return unwrapResponse(response);
    },

    async shareLinks(id: string): Promise<ShareLink[]> {
        const response = await apiClient.get(`/api/sessions/${encodeURIComponent(id)}/share`);
        return unwrapResponse(response) || [];
    },

    async share(id: string, provider: string, expiresIn?: number): Promise<ShareLink> {
        const response = await apiClient.post(`/api/sessions/${encodeURIComponent(id)}/share`, { provider, expiresIn });
        return unwrapResponse(response);
    },
};

// =============================================================================
// Messages API (matches csm-web)
// =============================================================================

export const messages = {
    async list(sessionId: string, limit?: number, before?: string): Promise<Message[]> {
        const response = await apiClient.get(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
            params: { limit, before },
        });
        return unwrapResponse(response) || [];
    },

    // No get, update or delete for a single message.
    //
    // `/api/sessions/{id}/messages` is POST-only -- the server routes nothing
    // for one message by id, so all three answered 404. None had a caller.

};

// =============================================================================
// Providers API (matches csm-web)
// =============================================================================

/**
 * The three provider endpoints the server actually routes.
 *
 * This object used to have nine methods. Six of them -- `get`, `create`,
 * `update`, `delete`, `checkHealth` and `models` -- addressed paths the server
 * has never registered, and `healthCheck` used `/api/providers/health`, which
 * is not where health lives either. All seven would have returned 404. None
 * had a caller, so nothing had ever exercised them.
 *
 * `chasm-web/src/api/client.ts` already carried the correction, with a comment
 * spelling out the health path; it simply never reached this file. Keeping the
 * two clients to the same three calls is what stops that from recurring.
 */
export const providers = {
    async list(): Promise<Provider[]> {
        const response = await apiClient.get('/api/providers');
        return unwrapResponse(response) || [];
    },

    /** Served as `/api/system/providers/health`; there is no `/api/providers/health`. */
    async health(): Promise<ProviderHealth[]> {
        const response = await apiClient.get('/api/system/providers/health');
        return unwrapResponse(response) || [];
    },

    async test(id: string): Promise<{ success: boolean; latency: number }> {
        const response = await apiClient.post(`/api/providers/${encodeURIComponent(id)}/test`);
        return unwrapResponse(response);
    },

    /**
     * Switch a provider on or off, persistently.
     *
     * The catalogue is compiled into the server, so `enabled` is the only
     * field this can change. Returns the updated provider; an id outside the
     * catalogue is a 404.
     */
    async update(id: string, enabled: boolean): Promise<Provider> {
        const response = await apiClient.put(`/api/providers/${encodeURIComponent(id)}`, { enabled });
        return unwrapResponse(response);
    },
};

// Legacy function export for backward compatibility
export async function getProviders(): Promise<Provider[]> {
    return providers.list();
}

// =============================================================================
// Software-engineering project context (`/api/swe/*`)
// =============================================================================

/**
 * Shapes copied from `openapi.yaml`, not invented here.
 *
 * The SWE screen previously defined its own `CodeMemory` with `title`, `tags`,
 * `codeSnippet` and `useCount`. The server stores none of those: a memory is a
 * key/value pair with a category, an importance and an access count. Modelling
 * the screen on the fixture rather than the API is what made the two disagree.
 */
export interface SweProject {
    id: string;
    name: string;
    path: string;
    description?: string | null;
    gitRemote?: string | null;
    gitBranch?: string | null;
    language?: string | null;
    framework?: string | null;
    lastOpened: number;
    createdAt: number;
}

export interface SweMemory {
    id: string;
    projectId: string;
    key: string;
    value: string;
    category: string;
    importance: string;
    source: string;
    sourceMessageId?: string | null;
    expiresAt?: number | null;
    accessCount: number;
    lastAccessed?: number | null;
    createdAt: number;
}

export interface SweRule {
    id: string;
    projectId: string;
    rule: string;
    description?: string | null;
    category: string;
    priority: number;
    enabled: boolean;
    scope?: string | null;
}

export const swe = {
    async projects(): Promise<SweProject[]> {
        const response = await apiClient.get('/api/swe/projects');
        return unwrapResponse(response) || [];
    },

    async memory(projectId: string): Promise<SweMemory[]> {
        const response = await apiClient.get(
            `/api/swe/projects/${encodeURIComponent(projectId)}/memory`
        );
        return unwrapResponse(response) || [];
    },

    async rules(projectId: string): Promise<SweRule[]> {
        const response = await apiClient.get(
            `/api/swe/projects/${encodeURIComponent(projectId)}/rules`
        );
        return unwrapResponse(response) || [];
    },
};

// =============================================================================
// Search API (matches csm-web)
// =============================================================================

export const search = {
    /**
     * Substring match over session titles and message content.
     *
     * `/api/search` takes `q` and `limit` and nothing else -- this used to pass
     * a `types` filter the server has never read.
     */
    async query(q: string, limit?: number): Promise<SearchResult[]> {
        const response = await apiClient.get('/api/search', { params: { q, limit } });
        return unwrapResponse(response) || [];
    },

    /**
     * Substring match over session titles.
     *
     * Served as `/api/sessions/search`, which answers `{ query, results }`.
     * This used to request `/api/search/sessions`, which is not routed: the
     * Search screen's only query 404'd on every keystroke.
     */
    async sessions(q: string, limit?: number): Promise<Session[]> {
        const response = await apiClient.get('/api/sessions/search', {
            params: { q, limit },
        });
        const data = unwrapResponse<{ query: string; results: Session[] }>(response);
        return data?.results || [];
    },

    async semantic(q: string, limit?: number): Promise<SearchResult[]> {
        const response = await apiClient.get('/api/search/semantic', {
            params: { q, limit },
        });
        return unwrapResponse(response) || [];
    },
};

// Legacy function export for backward compatibility
export async function searchSessions(query: string, limit = 20): Promise<Session[]> {
    return search.sessions(query, limit);
}

// =============================================================================
// Statistics API (matches csm-web)
// =============================================================================

export const stats = {
    async overview(): Promise<Stats> {
        const response = await apiClient.get('/api/stats/overview');
        const raw = unwrapResponse<any>(response);
        return transformStats(raw);
    },

    async providers(): Promise<Record<string, { sessions: number; messages: number; tokens: number }>> {
        const response = await apiClient.get('/api/stats/providers');
        return unwrapResponse(response) || {};
    },

    async timeline(days?: number): Promise<{ date: string; sessions: number; messages: number }[]> {
        const response = await apiClient.get('/api/stats/timeline', { params: { days } });
        return unwrapResponse(response) || [];
    },
};

function transformStats(raw: any): Stats {
    // Handle both snake_case (from some endpoints) and camelCase (from /api/stats)
    const byProvider = raw.by_provider || raw.sessionsByProvider || {};

    // sessionsByProvider can be an array of {provider, count} or an object {provider: count}
    let sessionsByProvider: Array<{ provider: string; count: number }>;
    if (Array.isArray(byProvider)) {
        sessionsByProvider = byProvider;
    } else {
        sessionsByProvider = Object.entries(byProvider).map(([provider, count]) => ({
            provider,
            count: count as number,
        }));
    }

    return {
        totalSessions: raw.total_sessions ?? raw.totalSessions ?? 0,
        totalMessages: raw.total_messages ?? raw.totalMessages ?? 0,
        totalWorkspaces: raw.total_workspaces ?? raw.totalWorkspaces ?? 0,
        totalProviders: sessionsByProvider.length,
        totalToolInvocations: raw.total_tool_invocations ?? raw.totalToolInvocations ?? 0,
        totalFileChanges: raw.total_file_changes ?? raw.totalFileChanges ?? 0,
        sessionsByProvider,
    };
}

// Legacy function export for backward compatibility
export async function getStats(): Promise<Stats> {
    return stats.overview();
}

// =============================================================================
// Agents API (matches csm-web)
// =============================================================================

export const agents = {
    async list(): Promise<Agent[]> {
        const response = await apiClient.get('/api/agents');
        return unwrapResponse(response) || [];
    },

    async get(id: string): Promise<Agent> {
        const response = await apiClient.get(`/api/agents/${encodeURIComponent(id)}`);
        return unwrapResponse(response);
    },

    async create(data: Partial<Agent>): Promise<Agent> {
        const response = await apiClient.post('/api/agents', data);
        return unwrapResponse(response);
    },

    async update(id: string, data: Partial<Agent>): Promise<Agent> {
        const response = await apiClient.put(`/api/agents/${encodeURIComponent(id)}`, data);
        return unwrapResponse(response);
    },

    async delete(id: string): Promise<void> {
        await apiClient.delete(`/api/agents/${encodeURIComponent(id)}`);
    },
};

// =============================================================================
// Swarms API (matches csm-web)
// =============================================================================

export const swarms = {
    async list(): Promise<Swarm[]> {
        const response = await apiClient.get('/api/swarms');
        return unwrapResponse(response) || [];
    },

    async get(id: string): Promise<Swarm> {
        const response = await apiClient.get(`/api/swarms/${encodeURIComponent(id)}`);
        return unwrapResponse(response);
    },

    async create(data: Partial<Swarm>): Promise<Swarm> {
        const response = await apiClient.post('/api/swarms', data);
        return unwrapResponse(response);
    },

    async update(id: string, data: Partial<Swarm>): Promise<Swarm> {
        const response = await apiClient.put(`/api/swarms/${encodeURIComponent(id)}`, data);
        return unwrapResponse(response);
    },

    async delete(id: string): Promise<void> {
        await apiClient.delete(`/api/swarms/${encodeURIComponent(id)}`);
    },
};

// =============================================================================
// Provider accounts API
// =============================================================================

/**
 * A stored provider credential.
 *
 * This is the whole of what the server keeps: `provider_accounts` has an id, a
 * provider, a display name, a default flag and two timestamps. The credential
 * itself is stored but never read back out over the API, and there is no
 * column for a token type, an email, a scope list or an expiry -- so a screen
 * cannot show those without inventing them.
 */
export interface ProviderAccount {
    id: string;
    provider: string;
    name: string;
    isDefault: boolean;
    createdAt: number;
    updatedAt: number;
}

export const accounts = {
    /** Served as `/api/settings/accounts`; there is no `/api/accounts`. */
    async list(): Promise<ProviderAccount[]> {
        const response = await apiClient.get('/api/settings/accounts');
        return unwrapResponse(response) || [];
    },

    async create(provider: string, credentials: Record<string, unknown>): Promise<ProviderAccount> {
        const response = await apiClient.post('/api/settings/accounts', { provider, credentials });
        return unwrapResponse(response);
    },

    async remove(id: string): Promise<void> {
        await apiClient.delete(`/api/settings/accounts/${encodeURIComponent(id)}`);
    },
};

// =============================================================================
// System API (matches csm-web)
// =============================================================================

export const system = {
    async health(): Promise<{ status: string; version: string; uptime?: number }> {
        const response = await apiClient.get('/api/health');
        return unwrapResponse(response);
    },

    async info(): Promise<{
        version: string;
        platform: string;
        databaseSize: number;
        sessionCount: number;
        providerCount: number;
    }> {
        const response = await apiClient.get('/api/system/info');
        return unwrapResponse(response);
    },
};

// Legacy function exports for backward compatibility
export async function getSessions(params?: {
    workspace_id?: string;
    provider?: string;
    limit?: number;
}): Promise<Session[]> {
    return sessions.list(params);
}

export async function getSession(id: string): Promise<SessionWithMessages> {
    return sessions.get(id);
}

export async function deleteSession(id: string): Promise<void> {
    return sessions.delete(id);
}

export async function exportSession(
    id: string,
    format: 'json' | 'markdown' = 'json'
): Promise<string> {
    const response = await apiClient.get(`/api/sessions/${id}/export`, {
        params: { format },
    });
    return response.data;
}
