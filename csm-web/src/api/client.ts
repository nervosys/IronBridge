// CSM API Client - Communicates with the CSM Rust backend
// Provides typed methods for all backend operations

import type {
    Workspace,
    Session,
    Message,
    Checkpoint,
    Provider,
    ProviderHealth,
    Agent,
    Swarm,
    GitCommit,
    GitRepository,
    Statistics,
    SearchResult,
    SessionFilter,
    WorkspaceFilter,
    PaginatedResponse,
    ApiResponse,
    ChatCompletionRequest,
    ChatCompletionResponse,
    StreamChunk,
    ImportSource,
    ImportResult,
    ExportOptions,
    AppSettings,
    ProviderAccount,
    ShareLink,
} from './types';

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_BASE_URL = 'http://localhost:8787';
const DEFAULT_TIMEOUT = 30000;

export interface ClientConfig {
    baseUrl?: string;
    timeout?: number;
    headers?: Record<string, string>;
    onError?: (error: Error) => void;
}

let config: ClientConfig = {
    baseUrl: DEFAULT_BASE_URL,
    timeout: DEFAULT_TIMEOUT,
};

/**
 * Configure the API client
 */
export function configure(newConfig: Partial<ClientConfig>): void {
    config = { ...config, ...newConfig };
}

/**
 * Get current configuration
 */
export function getConfig(): ClientConfig {
    return { ...config };
}

// =============================================================================
// Base HTTP Methods
// =============================================================================

async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    customHeaders?: Record<string, string>
): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...config.headers,
            ...customHeaders,
        };

        const response = await fetch(`${config.baseUrl}${path}`, {
            method,
            headers,
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
        // If backend already returns { success, data, error } format, use it directly
        if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
            return data;
        }
        return { success: true, data };
    } catch (error) {
        clearTimeout(timeoutId);
        const err = error as Error;

        if (config.onError) {
            config.onError(err);
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

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined);
    return new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

// =============================================================================
// Workspaces API
// =============================================================================

export const workspaces = {
    /**
     * List all discovered workspaces
     */
    async list(filter?: WorkspaceFilter): Promise<ApiResponse<PaginatedResponse<Workspace>>> {
        return get('/api/v1/workspaces', filter as Record<string, string | number | boolean | undefined>);
    },

    /**
     * Get a workspace by ID
     */
    async get(id: string): Promise<ApiResponse<Workspace>> {
        return get(`/api/v1/workspaces/${encodeURIComponent(id)}`);
    },

    /**
     * Get workspace by path
     */
    async getByPath(path: string): Promise<ApiResponse<Workspace>> {
        return get('/api/v1/workspaces/by-path', { path });
    },

    /**
     * Discover workspaces from VS Code storage
     */
    async discover(): Promise<ApiResponse<Workspace[]>> {
        return post('/api/v1/workspaces/discover');
    },

    /**
     * Refresh workspace sessions
     */
    async refresh(id: string): Promise<ApiResponse<Workspace>> {
        return post(`/api/v1/workspaces/${encodeURIComponent(id)}/refresh`);
    },

    /**
     * Link workspace to current project
     */
    async link(id: string, projectPath: string): Promise<ApiResponse<Workspace>> {
        return post(`/api/v1/workspaces/${encodeURIComponent(id)}/link`, { projectPath });
    },

    /**
     * Get workspace git info
     */
    async gitInfo(id: string): Promise<ApiResponse<GitRepository>> {
        return get(`/api/v1/workspaces/${encodeURIComponent(id)}/git`);
    },
};

// =============================================================================
// Sessions API
// =============================================================================

export const sessions = {
    /**
     * List sessions with filtering
     */
    async list(filter?: SessionFilter): Promise<ApiResponse<PaginatedResponse<Session>>> {
        return get('/api/v1/sessions', filter as Record<string, string | number | boolean | undefined>);
    },

    /**
     * Get a session by ID
     */
    async get(id: string): Promise<ApiResponse<Session>> {
        return get(`/api/v1/sessions/${encodeURIComponent(id)}`);
    },

    /**
     * Get session with messages
     */
    async getWithMessages(id: string): Promise<ApiResponse<Session & { messages: Message[] }>> {
        return get(`/api/v1/sessions/${encodeURIComponent(id)}`, { include: 'messages' });
    },

    /**
     * Create a new session
     */
    async create(data: Partial<Session>): Promise<ApiResponse<Session>> {
        return post('/api/v1/sessions', data);
    },

    /**
     * Update a session
     */
    async update(id: string, data: Partial<Session>): Promise<ApiResponse<Session>> {
        return put(`/api/v1/sessions/${encodeURIComponent(id)}`, data);
    },

    /**
     * Delete a session
     */
    async delete(id: string): Promise<ApiResponse<void>> {
        return del(`/api/v1/sessions/${encodeURIComponent(id)}`);
    },

    /**
     * Archive/unarchive a session
     */
    async archive(id: string, archived: boolean = true): Promise<ApiResponse<Session>> {
        return post(`/api/v1/sessions/${encodeURIComponent(id)}/archive`, { archived });
    },

    /**
     * Fork a session (create a copy)
     */
    async fork(id: string, fromMessageId?: string): Promise<ApiResponse<Session>> {
        return post(`/api/v1/sessions/${encodeURIComponent(id)}/fork`, { fromMessageId });
    },

    /**
     * Merge sessions
     */
    async merge(sessionIds: string[], title: string): Promise<ApiResponse<Session>> {
        return post('/api/v1/sessions/merge', { sessionIds, title });
    },

    /**
     * Export session
     */
    async export(id: string, format: ExportOptions['format']): Promise<ApiResponse<Blob>> {
        const response = await fetch(`${config.baseUrl}/api/v1/sessions/${encodeURIComponent(id)}/export?format=${format}`, {
            headers: config.headers,
        });
        if (!response.ok) {
            return { success: false, error: { code: 'EXPORT_FAILED', message: 'Export failed' } };
        }
        const blob = await response.blob();
        return { success: true, data: blob };
    },

    /**
     * Get session checkpoints
     */
    async checkpoints(id: string): Promise<ApiResponse<Checkpoint[]>> {
        return get(`/api/v1/sessions/${encodeURIComponent(id)}/checkpoints`);
    },

    /**
     * Create checkpoint
     */
    async createCheckpoint(id: string, data: Partial<Checkpoint>): Promise<ApiResponse<Checkpoint>> {
        return post(`/api/v1/sessions/${encodeURIComponent(id)}/checkpoints`, data);
    },

    /**
     * Get session share links
     */
    async shareLinks(id: string): Promise<ApiResponse<ShareLink[]>> {
        return get(`/api/v1/sessions/${encodeURIComponent(id)}/share`);
    },

    /**
     * Create share link
     */
    async share(id: string, provider: string, expiresIn?: number): Promise<ApiResponse<ShareLink>> {
        return post(`/api/v1/sessions/${encodeURIComponent(id)}/share`, { provider, expiresIn });
    },

    /**
     * Get git commits linked to session
     */
    async commits(id: string): Promise<ApiResponse<GitCommit[]>> {
        return get(`/api/v1/sessions/${encodeURIComponent(id)}/commits`);
    },
};

// =============================================================================
// Messages API
// =============================================================================

export const messages = {
    /**
     * Get messages for a session
     */
    async list(sessionId: string, limit?: number, before?: string): Promise<ApiResponse<Message[]>> {
        return get(`/api/v1/sessions/${encodeURIComponent(sessionId)}/messages`, { limit, before });
    },

    /**
     * Get a single message
     */
    async get(sessionId: string, messageId: string): Promise<ApiResponse<Message>> {
        return get(`/api/v1/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}`);
    },

    /**
     * Add a message to a session
     */
    async create(sessionId: string, data: Partial<Message>): Promise<ApiResponse<Message>> {
        return post(`/api/v1/sessions/${encodeURIComponent(sessionId)}/messages`, data);
    },

    /**
     * Update a message
     */
    async update(sessionId: string, messageId: string, data: Partial<Message>): Promise<ApiResponse<Message>> {
        return put(
            `/api/v1/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}`,
            data
        );
    },

    /**
     * Delete a message
     */
    async delete(sessionId: string, messageId: string): Promise<ApiResponse<void>> {
        return del(`/api/v1/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}`);
    },

    /**
     * Regenerate an assistant message
     */
    async regenerate(sessionId: string, messageId: string): Promise<ApiResponse<Message>> {
        return post(
            `/api/v1/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}/regenerate`
        );
    },
};

// =============================================================================
// Providers API
// =============================================================================

export const providers = {
    /**
     * List all configured providers
     */
    async list(): Promise<ApiResponse<Provider[]>> {
        return get('/api/v1/providers');
    },

    /**
     * Get provider by ID
     */
    async get(id: string): Promise<ApiResponse<Provider>> {
        return get(`/api/v1/providers/${encodeURIComponent(id)}`);
    },

    /**
     * Create/register a provider
     */
    async create(data: Partial<Provider>): Promise<ApiResponse<Provider>> {
        return post('/api/v1/providers', data);
    },

    /**
     * Update provider configuration
     */
    async update(id: string, data: Partial<Provider>): Promise<ApiResponse<Provider>> {
        return put(`/api/v1/providers/${encodeURIComponent(id)}`, data);
    },

    /**
     * Delete a provider
     */
    async delete(id: string): Promise<ApiResponse<void>> {
        return del(`/api/v1/providers/${encodeURIComponent(id)}`);
    },

    /**
     * Health check for all providers
     */
    async healthCheck(): Promise<ApiResponse<ProviderHealth[]>> {
        return get('/api/v1/providers/health');
    },

    /**
     * Health check for specific provider
     */
    async checkHealth(id: string): Promise<ApiResponse<ProviderHealth>> {
        return get(`/api/v1/providers/${encodeURIComponent(id)}/health`);
    },

    /**
     * List models available from a provider
     */
    async models(id: string): Promise<ApiResponse<string[]>> {
        return get(`/api/v1/providers/${encodeURIComponent(id)}/models`);
    },

    /**
     * Test provider connection
     */
    async test(id: string): Promise<ApiResponse<{ success: boolean; latency: number }>> {
        return post(`/api/v1/providers/${encodeURIComponent(id)}/test`);
    },
};

// =============================================================================
// Agents API
// =============================================================================

export const agents = {
    /**
     * List all agents
     */
    async list(): Promise<ApiResponse<Agent[]>> {
        return get('/api/v1/agents');
    },

    /**
     * Get an agent by ID
     */
    async get(id: string): Promise<ApiResponse<Agent>> {
        return get(`/api/v1/agents/${encodeURIComponent(id)}`);
    },

    /**
     * Create a new agent
     */
    async create(data: Partial<Agent>): Promise<ApiResponse<Agent>> {
        return post('/api/v1/agents', data);
    },

    /**
     * Update an agent
     */
    async update(id: string, data: Partial<Agent>): Promise<ApiResponse<Agent>> {
        return put(`/api/v1/agents/${encodeURIComponent(id)}`, data);
    },

    /**
     * Delete an agent
     */
    async delete(id: string): Promise<ApiResponse<void>> {
        return del(`/api/v1/agents/${encodeURIComponent(id)}`);
    },

    /**
     * Clone an agent
     */
    async clone(id: string): Promise<ApiResponse<Agent>> {
        return post(`/api/v1/agents/${encodeURIComponent(id)}/clone`);
    },
};

// =============================================================================
// Swarms API
// =============================================================================

export const swarms = {
    /**
     * List all swarms
     */
    async list(): Promise<ApiResponse<Swarm[]>> {
        return get('/api/v1/swarms');
    },

    /**
     * Get a swarm by ID
     */
    async get(id: string): Promise<ApiResponse<Swarm>> {
        return get(`/api/v1/swarms/${encodeURIComponent(id)}`);
    },

    /**
     * Create a new swarm
     */
    async create(data: Partial<Swarm>): Promise<ApiResponse<Swarm>> {
        return post('/api/v1/swarms', data);
    },

    /**
     * Update a swarm
     */
    async update(id: string, data: Partial<Swarm>): Promise<ApiResponse<Swarm>> {
        return put(`/api/v1/swarms/${encodeURIComponent(id)}`, data);
    },

    /**
     * Delete a swarm
     */
    async delete(id: string): Promise<ApiResponse<void>> {
        return del(`/api/v1/swarms/${encodeURIComponent(id)}`);
    },

    /**
     * Start swarm execution
     */
    async start(id: string, input: string): Promise<ApiResponse<{ runId: string }>> {
        return post(`/api/v1/swarms/${encodeURIComponent(id)}/start`, { input });
    },

    /**
     * Pause swarm execution
     */
    async pause(id: string): Promise<ApiResponse<void>> {
        return post(`/api/v1/swarms/${encodeURIComponent(id)}/pause`);
    },

    /**
     * Resume swarm execution
     */
    async resume(id: string): Promise<ApiResponse<void>> {
        return post(`/api/v1/swarms/${encodeURIComponent(id)}/resume`);
    },

    /**
     * Stop swarm execution
     */
    async stop(id: string): Promise<ApiResponse<void>> {
        return post(`/api/v1/swarms/${encodeURIComponent(id)}/stop`);
    },
};

// =============================================================================
// Chat Completion API
// =============================================================================

export const chat = {
    /**
     * Send a chat completion request (non-streaming)
     */
    async complete(request: ChatCompletionRequest): Promise<ApiResponse<ChatCompletionResponse>> {
        return post('/api/v1/chat/completions', { ...request, stream: false });
    },

    /**
     * Stream a chat completion
     */
    async* stream(request: ChatCompletionRequest): AsyncGenerator<StreamChunk, void, unknown> {
        const response = await fetch(`${config.baseUrl}/api/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...config.headers,
            },
            body: JSON.stringify({ ...request, stream: true }),
        });

        if (!response.ok || !response.body) {
            throw new Error(`Stream request failed: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') return;
                    try {
                        yield JSON.parse(data) as StreamChunk;
                    } catch {
                        // Skip invalid JSON
                    }
                }
            }
        }
    },
};

// =============================================================================
// Search API
// =============================================================================

export const search = {
    /**
     * Full-text search across all content
     */
    async query(q: string, types?: string[], limit?: number): Promise<ApiResponse<SearchResult[]>> {
        return get('/api/v1/search', { q, types: types?.join(','), limit });
    },

    /**
     * Search sessions
     */
    async sessions(q: string, filter?: SessionFilter): Promise<ApiResponse<PaginatedResponse<Session>>> {
        return get('/api/v1/search/sessions', { q, ...filter as Record<string, string | number | boolean | undefined> });
    },

    /**
     * Search messages
     */
    async messages(q: string, sessionId?: string, limit?: number): Promise<ApiResponse<Message[]>> {
        return get('/api/v1/search/messages', { q, sessionId, limit });
    },

    /**
     * Semantic search (vector similarity)
     */
    async semantic(q: string, limit?: number): Promise<ApiResponse<SearchResult[]>> {
        return get('/api/v1/search/semantic', { q, limit });
    },
};

// =============================================================================
// Statistics API
// =============================================================================

export const stats = {
    /**
     * Get overview statistics
     */
    async overview(): Promise<ApiResponse<Statistics>> {
        return get('/api/v1/stats/overview');
    },

    /**
     * Get statistics for a specific workspace
     */
    async workspace(id: string): Promise<ApiResponse<Statistics>> {
        return get(`/api/v1/stats/workspace/${encodeURIComponent(id)}`);
    },

    /**
     * Get provider usage statistics
     */
    async providers(): Promise<ApiResponse<Record<string, { sessions: number; messages: number; tokens: number }>>> {
        return get('/api/v1/stats/providers');
    },

    /**
     * Get usage over time
     */
    async timeline(days?: number): Promise<ApiResponse<{ date: string; sessions: number; messages: number }[]>> {
        return get('/api/v1/stats/timeline', { days });
    },
};

// =============================================================================
// Import/Export API
// =============================================================================

export const transfer = {
    /**
     * Import sessions from a source
     */
    async import(source: ImportSource): Promise<ApiResponse<ImportResult>> {
        return post('/api/v1/import', source);
    },

    /**
     * Batch export sessions
     */
    async export(options: ExportOptions): Promise<ApiResponse<Blob>> {
        const response = await fetch(`${config.baseUrl}/api/v1/export`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...config.headers,
            },
            body: JSON.stringify(options),
        });
        if (!response.ok) {
            return { success: false, error: { code: 'EXPORT_FAILED', message: 'Export failed' } };
        }
        const blob = await response.blob();
        return { success: true, data: blob };
    },

    /**
     * Harvest sessions from providers
     */
    async harvest(providers?: string[]): Promise<ApiResponse<ImportResult>> {
        return post('/api/v1/harvest', { providers });
    },

    /**
     * Sync with cloud storage
     */
    async sync(direction: 'push' | 'pull'): Promise<ApiResponse<{ synced: number; conflicts: number }>> {
        return post('/api/v1/sync', { direction });
    },
};

// =============================================================================
// Settings API
// =============================================================================

export const settings = {
    /**
     * Get application settings
     */
    async get(): Promise<ApiResponse<AppSettings>> {
        return get('/api/v1/settings');
    },

    /**
     * Update application settings
     */
    async update(data: Partial<AppSettings>): Promise<ApiResponse<AppSettings>> {
        return put('/api/v1/settings', data);
    },

    /**
     * Get connected accounts
     */
    async accounts(): Promise<ApiResponse<ProviderAccount[]>> {
        return get('/api/v1/settings/accounts');
    },

    /**
     * Add account
     */
    async addAccount(provider: string, credentials: Record<string, string>): Promise<ApiResponse<ProviderAccount>> {
        return post('/api/v1/settings/accounts', { provider, credentials });
    },

    /**
     * Remove account
     */
    async removeAccount(id: string): Promise<ApiResponse<void>> {
        return del(`/api/v1/settings/accounts/${encodeURIComponent(id)}`);
    },
};

// =============================================================================
// Health & System API
// =============================================================================

export const system = {
    /**
     * Health check
     */
    async health(): Promise<ApiResponse<{ status: string; version: string; uptime: number }>> {
        return get('/api/v1/health');
    },

    /**
     * Get system info
     */
    async info(): Promise<ApiResponse<{
        version: string;
        platform: string;
        databaseSize: number;
        sessionCount: number;
        providerCount: number;
    }>> {
        return get('/api/v1/system/info');
    },

    /**
     * Clear cache
     */
    async clearCache(): Promise<ApiResponse<void>> {
        return post('/api/v1/system/cache/clear');
    },

    /**
     * Vacuum database
     */
    async vacuum(): Promise<ApiResponse<{ before: number; after: number }>> {
        return post('/api/v1/system/vacuum');
    },
};

// =============================================================================
// WebSocket Connection
// =============================================================================

export type WebSocketHandler = (event: import('./types').WebSocketEvent) => void;

let ws: WebSocket | null = null;
let wsHandlers: Set<WebSocketHandler> = new Set();
let wsReconnectTimer: number | null = null;

/**
 * Connect to WebSocket for real-time updates
 */
export function connectWebSocket(onMessage?: WebSocketHandler): () => void {
    if (onMessage) {
        wsHandlers.add(onMessage);
    }

    if (!ws || ws.readyState === WebSocket.CLOSED) {
        const wsUrl = config.baseUrl?.replace(/^http/, 'ws') + '/api/v1/ws';
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            wsHandlers.forEach((h) => h({ type: 'connected' }));
        };

        ws.onclose = () => {
            wsHandlers.forEach((h) => h({ type: 'disconnected' }));
            // Auto-reconnect after 5 seconds
            wsReconnectTimer = window.setTimeout(() => {
                if (wsHandlers.size > 0) {
                    connectWebSocket();
                }
            }, 5000);
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                wsHandlers.forEach((h) => h(data));
            } catch {
                // Skip invalid messages
            }
        };
    }

    return () => {
        if (onMessage) {
            wsHandlers.delete(onMessage);
        }
        if (wsHandlers.size === 0 && ws) {
            if (wsReconnectTimer) {
                clearTimeout(wsReconnectTimer);
            }
            ws.close();
            ws = null;
        }
    };
}

/**
 * Send message over WebSocket
 */
export function sendWebSocketMessage(message: unknown): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}

// =============================================================================
// Export namespace
// =============================================================================

export const api = {
    configure,
    getConfig,
    workspaces,
    sessions,
    messages,
    providers,
    agents,
    swarms,
    chat,
    search,
    stats,
    transfer,
    settings,
    system,
    connectWebSocket,
    sendWebSocketMessage,
};

export default api;
