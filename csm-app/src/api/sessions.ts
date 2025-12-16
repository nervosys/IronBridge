import { apiClient } from './client';

// Types matching the CSM API
export interface Workspace {
    id: string;
    name: string;
    path: string;
    provider: string;
    session_count?: number;
    created_at?: string;
    updated_at?: string;
}

export interface Session {
    id: string;
    workspace_id?: string;
    workspace_name?: string;
    provider: string;
    title: string;
    model?: string | null;
    message_count: number;
    created_at: string | number;
    updated_at: string | number;
}

export interface FileChange {
    type: string;
    file_path?: string;
    command?: string;
    old_string?: string;
    new_string?: string;
    old_content?: string;
    new_content?: string;
    diff_unified?: string;
    output?: any;
    exit_code?: number;
    data?: any;
}

export interface ToolInvocation {
    tool_name: string;
    tool_call_id?: string;
    status?: string;
    is_complete?: boolean;
    is_confirmed?: any;
    invocation_message?: string | { value?: string;[key: string]: any };
    tool_specific_data?: any;
    file_changes?: FileChange[];
}

export interface Message {
    id?: string;
    index?: number;
    session_id?: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    content_raw?: string;
    model?: string | null;
    model_id?: string | null;
    request_id?: string;
    response_id?: string;
    is_canceled?: boolean;
    created_at?: string | number | null;
    tool_invocations?: ToolInvocation[];
    variable_data?: any;
    content_references?: any[];
    code_citations?: any[];
}

export interface SessionWithMessages extends Session {
    messages: Message[];
    tool_invocations?: ToolInvocation[];
    file_changes?: FileChange[];
    session_data?: any;
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
