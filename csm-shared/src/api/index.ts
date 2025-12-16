// =============================================================================
// CSM Shared API Client
// =============================================================================
// Platform-agnostic API methods for CSM backend
// Works with both fetch (web) and axios (React Native)

import type {
    Workspace,
    Session,
    SessionWithMessages,
    Statistics,
    SearchResult,
    SessionFilter,
    WorkspaceFilter,
    ApiResponse,
    ApiError,
    McpTool,
    McpToolCall,
    McpToolResult,
} from '../types';

// =============================================================================
// Configuration
// =============================================================================

export interface ApiClientConfig {
    baseUrl: string;
    timeout?: number;
    headers?: Record<string, string>;
    onError?: (error: Error) => void;
    // Custom fetch function (for React Native with axios adapter)
    customFetch?: typeof fetch;
}

const DEFAULT_CONFIG: ApiClientConfig = {
    baseUrl: 'http://localhost:8787',
    timeout: 30000,
};

// =============================================================================
// API Client Factory
// =============================================================================

export function createApiClient(config: ApiClientConfig = DEFAULT_CONFIG) {
    const { baseUrl, timeout = 30000, headers = {}, onError, customFetch } = config;

    const fetchFn = customFetch || fetch;

    // Base request function
    async function request<T>(
        method: string,
        path: string,
        body?: unknown,
        customHeaders?: Record<string, string>
    ): Promise<ApiResponse<T>> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetchFn(`${baseUrl}${path}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers,
                    ...customHeaders,
                },
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    success: false,
                    error: {
                        code: `HTTP_${response.status}`,
                        message: errorData.message || response.statusText,
                        details: errorData,
                    },
                };
            }

            const data = await response.json();
            // Handle both { success, data } and direct data responses
            if (data && typeof data === 'object' && 'success' in data) {
                return data;
            }
            return { success: true, data };
        } catch (error) {
            clearTimeout(timeoutId);
            const err = error as Error;

            if (onError) {
                onError(err);
            }

            return {
                success: false,
                error: {
                    code: err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR',
                    message: err.message,
                },
            };
        }
    }

    function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
        const entries = Object.entries(params).filter(([, v]) => v !== undefined);
        return new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
    }

    async function get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<ApiResponse<T>> {
        const url = params ? `${path}?${buildQuery(params)}` : path;
        return request<T>('GET', url);
    }

    async function post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
        return request<T>('POST', path, body);
    }

    async function put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
        return request<T>('PUT', path, body);
    }

    async function del<T>(path: string): Promise<ApiResponse<T>> {
        return request<T>('DELETE', path);
    }

    // =============================================================================
    // Workspaces API
    // =============================================================================

    const workspaces = {
        async list(filter?: WorkspaceFilter): Promise<ApiResponse<Workspace[]>> {
            return get('/api/workspaces', filter as Record<string, string | number | boolean | undefined>);
        },

        async get(id: string): Promise<ApiResponse<Workspace>> {
            return get(`/api/workspaces/${encodeURIComponent(id)}`);
        },

        async getByPath(path: string): Promise<ApiResponse<Workspace>> {
            return get('/api/workspaces/by-path', { path });
        },

        async refresh(id: string): Promise<ApiResponse<Workspace>> {
            return post(`/api/workspaces/${encodeURIComponent(id)}/refresh`);
        },
    };

    // =============================================================================
    // Sessions API
    // =============================================================================

    const sessions = {
        async list(filter?: SessionFilter): Promise<ApiResponse<Session[]>> {
            return get('/api/sessions', filter as Record<string, string | number | boolean | undefined>);
        },

        async get(id: string): Promise<ApiResponse<SessionWithMessages>> {
            return get(`/api/sessions/${encodeURIComponent(id)}`);
        },

        async getMessages(id: string): Promise<ApiResponse<SessionWithMessages>> {
            return get(`/api/sessions/${encodeURIComponent(id)}`, { include: 'messages' });
        },

        async create(data: Partial<Session>): Promise<ApiResponse<Session>> {
            return post('/api/sessions', data);
        },

        async update(id: string, data: Partial<Session>): Promise<ApiResponse<Session>> {
            return put(`/api/sessions/${encodeURIComponent(id)}`, data);
        },

        async delete(id: string): Promise<ApiResponse<void>> {
            return del(`/api/sessions/${encodeURIComponent(id)}`);
        },

        async archive(id: string, archived: boolean = true): Promise<ApiResponse<Session>> {
            return post(`/api/sessions/${encodeURIComponent(id)}/archive`, { archived });
        },

        async fork(id: string, fromMessageId?: string): Promise<ApiResponse<Session>> {
            return post(`/api/sessions/${encodeURIComponent(id)}/fork`, { fromMessageId });
        },

        async merge(sessionIds: string[], title: string): Promise<ApiResponse<Session>> {
            return post('/api/sessions/merge', { sessionIds, title });
        },
    };

    // =============================================================================
    // Search API
    // =============================================================================

    const search = {
        async query(q: string, limit?: number): Promise<ApiResponse<SearchResult[]>> {
            return get('/api/search', { q, limit });
        },

        async sessions(q: string, filter?: SessionFilter): Promise<ApiResponse<Session[]>> {
            return get('/api/search/sessions', { q, ...filter } as Record<string, string | number | boolean | undefined>);
        },
    };

    // =============================================================================
    // Statistics API
    // =============================================================================

    const stats = {
        async get(): Promise<ApiResponse<Statistics>> {
            return get('/api/stats');
        },

        async byProvider(): Promise<ApiResponse<Record<string, number>>> {
            return get('/api/stats/by-provider');
        },
    };

    // =============================================================================
    // MCP Tools API (for introspective chat)
    // =============================================================================

    const mcp = {
        async listTools(): Promise<ApiResponse<McpTool[]>> {
            return get('/mcp/tools');
        },

        async callTool(name: string, args: Record<string, unknown>): Promise<ApiResponse<McpToolResult>> {
            return post('/mcp/call', { name, arguments: args });
        },

        async callToolsBatch(calls: McpToolCall[]): Promise<ApiResponse<McpToolResult[]>> {
            return post('/mcp/call/batch', { calls });
        },

        async getSystemPrompt(): Promise<ApiResponse<{ system_prompt: string }>> {
            return get('/mcp/system-prompt');
        },
    };

    // =============================================================================
    // Health Check
    // =============================================================================

    const health = {
        async check(): Promise<ApiResponse<{ status: string; version: string }>> {
            return get('/health');
        },
    };

    return {
        config: { baseUrl, timeout },
        workspaces,
        sessions,
        search,
        stats,
        mcp,
        health,
        // Expose raw request methods for custom endpoints
        request,
        get,
        post,
        put,
        delete: del,
    };
}

// Default client instance
export const api = createApiClient();

// Re-export types
export type { ApiResponse, ApiError };
