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

    async getByPath(path: string): Promise<Workspace> {
        const response = await apiClient.get('/api/workspaces/by-path', { params: { path } });
        return unwrapResponse(response);
    },

    async discover(): Promise<Workspace[]> {
        const response = await apiClient.post('/api/workspaces/discover');
        return unwrapResponse(response) || [];
    },

    async refresh(id: string): Promise<Workspace> {
        const response = await apiClient.post(`/api/workspaces/${encodeURIComponent(id)}/refresh`);
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

    async archive(id: string, archived: boolean = true): Promise<Session> {
        const response = await apiClient.post(`/api/sessions/${encodeURIComponent(id)}/archive`, { archived });
        return unwrapResponse(response);
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

    async get(sessionId: string, messageId: string): Promise<Message> {
        const response = await apiClient.get(
            `/api/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}`
        );
        return unwrapResponse(response);
    },

    async create(sessionId: string, data: Partial<Message>): Promise<Message> {
        const response = await apiClient.post(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, data);
        return unwrapResponse(response);
    },

    async update(sessionId: string, messageId: string, data: Partial<Message>): Promise<Message> {
        const response = await apiClient.put(
            `/api/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}`,
            data
        );
        return unwrapResponse(response);
    },

    async delete(sessionId: string, messageId: string): Promise<void> {
        await apiClient.delete(
            `/api/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}`
        );
    },

    async regenerate(sessionId: string, messageId: string): Promise<Message> {
        const response = await apiClient.post(
            `/api/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}/regenerate`
        );
        return unwrapResponse(response);
    },
};

// =============================================================================
// Providers API (matches csm-web)
// =============================================================================

export const providers = {
    async list(): Promise<Provider[]> {
        const response = await apiClient.get('/api/providers');
        return unwrapResponse(response) || [];
    },

    async get(id: string): Promise<Provider> {
        const response = await apiClient.get(`/api/providers/${encodeURIComponent(id)}`);
        return unwrapResponse(response);
    },

    async create(data: Partial<Provider>): Promise<Provider> {
        const response = await apiClient.post('/api/providers', data);
        return unwrapResponse(response);
    },

    async update(id: string, data: Partial<Provider>): Promise<Provider> {
        const response = await apiClient.put(`/api/providers/${encodeURIComponent(id)}`, data);
        return unwrapResponse(response);
    },

    async delete(id: string): Promise<void> {
        await apiClient.delete(`/api/providers/${encodeURIComponent(id)}`);
    },

    async healthCheck(): Promise<ProviderHealth[]> {
        const response = await apiClient.get('/api/providers/health');
        return unwrapResponse(response) || [];
    },

    async checkHealth(id: string): Promise<ProviderHealth> {
        const response = await apiClient.get(`/api/providers/${encodeURIComponent(id)}/health`);
        return unwrapResponse(response);
    },

    async models(id: string): Promise<string[]> {
        const response = await apiClient.get(`/api/providers/${encodeURIComponent(id)}/models`);
        return unwrapResponse(response) || [];
    },

    async test(id: string): Promise<{ success: boolean; latency: number }> {
        const response = await apiClient.post(`/api/providers/${encodeURIComponent(id)}/test`);
        return unwrapResponse(response);
    },
};

// Legacy function export for backward compatibility
export async function getProviders(): Promise<Provider[]> {
    return providers.list();
}

// =============================================================================
// Search API (matches csm-web)
// =============================================================================

export const search = {
    async query(q: string, types?: string[], limit?: number): Promise<SearchResult[]> {
        const response = await apiClient.get('/api/search', {
            params: { q, types: types?.join(','), limit },
        });
        return unwrapResponse(response) || [];
    },

    async sessions(q: string, limit?: number): Promise<Session[]> {
        const response = await apiClient.get('/api/search/sessions', {
            params: { q, limit },
        });
        return unwrapResponse(response) || [];
    },

    async messages(q: string, sessionId?: string, limit?: number): Promise<Message[]> {
        const response = await apiClient.get('/api/search/messages', {
            params: { q, sessionId, limit },
        });
        return unwrapResponse(response) || [];
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

    async workspace(id: string): Promise<Stats> {
        const response = await apiClient.get(`/api/stats/workspace/${encodeURIComponent(id)}`);
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

    async clone(id: string): Promise<Agent> {
        const response = await apiClient.post(`/api/agents/${encodeURIComponent(id)}/clone`);
        return unwrapResponse(response);
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

    async start(id: string, input: string): Promise<{ runId: string }> {
        const response = await apiClient.post(`/api/swarms/${encodeURIComponent(id)}/start`, { input });
        return unwrapResponse(response);
    },

    async pause(id: string): Promise<void> {
        await apiClient.post(`/api/swarms/${encodeURIComponent(id)}/pause`);
    },

    async resume(id: string): Promise<void> {
        await apiClient.post(`/api/swarms/${encodeURIComponent(id)}/resume`);
    },

    async stop(id: string): Promise<void> {
        await apiClient.post(`/api/swarms/${encodeURIComponent(id)}/stop`);
    },
};

// =============================================================================
// Runs API (matches csm-web)
// =============================================================================

export const runs = {
    async list(): Promise<AgentRun[]> {
        const response = await apiClient.get('/api/runs');
        return unwrapResponse(response) || [];
    },

    async get(id: string): Promise<AgentRun> {
        const response = await apiClient.get(`/api/runs/${encodeURIComponent(id)}`);
        return unwrapResponse(response);
    },

    async cancel(id: string): Promise<AgentRun> {
        const response = await apiClient.post(`/api/runs/${encodeURIComponent(id)}/cancel`);
        return unwrapResponse(response);
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
