import { apiClient } from './client';

// Types matching the CSM API
export interface Workspace {
    id: string;
    name: string;
    path: string;
    provider: string;
    created_at: string;
    updated_at: string;
}

export interface Session {
    id: string;
    workspace_id: string;
    provider: string;
    title: string;
    model: string | null;
    message_count: number;
    created_at: string;
    updated_at: string;
}

export interface Message {
    id: string;
    session_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    model: string | null;
    created_at: string;
}

export interface SessionWithMessages extends Session {
    messages: Message[];
}

export interface Provider {
    id: string;
    name: string;
    session_count: number;
}

export interface Stats {
    total_sessions: number;
    total_messages: number;
    by_provider: Record<string, number>;
}

// API Functions

export async function getWorkspaces(): Promise<Workspace[]> {
    const response = await apiClient.get('/api/workspaces');
    return response.data;
}

export async function getWorkspace(id: string): Promise<Workspace> {
    const response = await apiClient.get(`/api/workspaces/${id}`);
    return response.data;
}

export async function getSessions(params?: {
    workspace_id?: string;
    provider?: string;
    limit?: number;
}): Promise<Session[]> {
    const response = await apiClient.get('/api/sessions', { params });
    return response.data;
}

export async function getSession(id: string): Promise<SessionWithMessages> {
    const response = await apiClient.get(`/api/sessions/${id}`);
    return response.data;
}

export async function searchSessions(query: string, limit = 20): Promise<Session[]> {
    const response = await apiClient.get('/api/sessions/search', {
        params: { q: query, limit },
    });
    return response.data;
}

export async function getProviders(): Promise<Provider[]> {
    const response = await apiClient.get('/api/providers');
    return response.data;
}

export async function getStats(): Promise<Stats> {
    const response = await apiClient.get('/api/stats');
    return response.data;
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
