// =============================================================================
// CSM App - Sessions API
// =============================================================================
// Re-exports shared types and provides API functions using axios client

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
    Statistics as Stats,
} from '@csm/shared';

// Import types for internal use
import type {
    Workspace,
    Session,
    SessionWithMessages,
    Provider,
    Statistics as Stats,
} from '@csm/shared';

// =============================================================================
// API Functions
// =============================================================================

export async function getWorkspaces(): Promise<Workspace[]> {
    const response = await apiClient.get('/api/workspaces');
    return response.data.data || response.data;
}

export async function getWorkspace(id: string): Promise<Workspace> {
    const response = await apiClient.get(`/api/workspaces/${id}`);
    return response.data.data || response.data;
}

export async function getSessions(params?: {
    workspace_id?: string;
    provider?: string;
    limit?: number;
}): Promise<Session[]> {
    const response = await apiClient.get('/api/sessions', { params });
    return response.data.data || response.data;
}

export async function getSession(id: string): Promise<SessionWithMessages> {
    const response = await apiClient.get(`/api/sessions/${id}`);
    const data = response.data.data || response.data;
    // API returns { session: {...}, messages: [...], tool_invocations: [...], file_changes: [...] }
    if (data.session) {
        return {
            ...data.session,
            messages: data.messages || [],
            tool_invocations: data.tool_invocations || [],
            file_changes: data.file_changes || [],
        };
    }
    return data;
}

export async function searchSessions(query: string, limit = 20): Promise<Session[]> {
    const response = await apiClient.get('/api/sessions/search', {
        params: { q: query, limit },
    });
    const data = response.data.data || response.data;
    return data.results || data;
}

export async function getProviders(): Promise<Provider[]> {
    const response = await apiClient.get('/api/providers');
    return response.data.data || response.data || [];
}

export async function getStats(): Promise<Stats> {
    const response = await apiClient.get('/api/stats');
    const raw = response.data.data || response.data;

    // Transform snake_case API response to camelCase
    const byProvider = raw.by_provider || {};
    const sessionsByProvider = Object.entries(byProvider).map(([provider, count]) => ({
        provider,
        count: count as number,
    }));

    return {
        totalSessions: raw.total_sessions ?? 0,
        totalMessages: raw.total_messages ?? 0,
        totalWorkspaces: raw.total_workspaces ?? 0,
        totalProviders: sessionsByProvider.length,
        totalToolInvocations: raw.total_tool_invocations ?? 0,
        totalFileChanges: raw.total_file_changes ?? 0,
        sessionsByProvider,
    };
}

export async function deleteSession(id: string): Promise<void> {
    await apiClient.delete(`/api/sessions/${id}`);
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
