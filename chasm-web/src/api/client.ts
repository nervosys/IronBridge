// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

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
    Statistics,
    SearchResult,
    SessionFilter,
    WorkspaceFilter,
    PaginatedResponse,
    ApiResponse,
    ChatCompletionRequest,
    ChatCompletionResponse,
    StreamChunk,
    ImportResult,
    AppSettings,
    ProviderAccount,
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
        return get('/api/workspaces', filter as Record<string, string | number | boolean | undefined>);
    },

    /**
     * Get a workspace by ID
     */
    async get(id: string): Promise<ApiResponse<Workspace>> {
        return get(`/api/workspaces/${encodeURIComponent(id)}`);
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
        return get('/api/sessions', filter as Record<string, string | number | boolean | undefined>);
    },

    /**
     * Get a session by ID
     */
    async get(id: string): Promise<ApiResponse<Session>> {
        return get(`/api/sessions/${encodeURIComponent(id)}`);
    },

    /**
     * Get session with messages
     */
    async getWithMessages(id: string): Promise<ApiResponse<Session & { messages: Message[] }>> {
        return get(`/api/sessions/${encodeURIComponent(id)}`, { include: 'messages' });
    },

    /**
     * Create a new session
     */
    async create(data: Partial<Session>): Promise<ApiResponse<Session>> {
        return post('/api/sessions', data);
    },

    async delete(id: string): Promise<ApiResponse<void>> {
        return del(`/api/sessions/${encodeURIComponent(id)}`);
    },

    async checkpoints(id: string): Promise<ApiResponse<Checkpoint[]>> {
        return get(`/api/sessions/${encodeURIComponent(id)}/checkpoints`);
    },

    /**
     * Create checkpoint
     */
    async createCheckpoint(id: string, data: Partial<Checkpoint>): Promise<ApiResponse<Checkpoint>> {
        return post(`/api/sessions/${encodeURIComponent(id)}/checkpoints`, data);
    },

    async commits(id: string): Promise<ApiResponse<GitCommit[]>> {
        return get(`/api/sessions/${encodeURIComponent(id)}/commits`);
    },
};

// =============================================================================
// Messages API
// =============================================================================

export const messages = {
    async create(sessionId: string, data: Partial<Message>): Promise<ApiResponse<Message>> {
        return post(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, data);
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
        return get('/api/providers');
    },

    async healthCheck(): Promise<ApiResponse<ProviderHealth[]>> {
        // Served as /api/system/providers/health; there is no /api/providers/health.
        return get('/api/system/providers/health');
    },

    async test(id: string): Promise<ApiResponse<{ success: boolean; latency: number }>> {
        return post(`/api/providers/${encodeURIComponent(id)}/test`);
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
        return get('/api/agents');
    },

    /**
     * Get an agent by ID
     */
    async get(id: string): Promise<ApiResponse<Agent>> {
        return get(`/api/agents/${encodeURIComponent(id)}`);
    },

    /**
     * Create a new agent
     */
    async create(data: Partial<Agent>): Promise<ApiResponse<Agent>> {
        return post('/api/agents', data);
    },

    /**
     * Update an agent
     */
    async update(id: string, data: Partial<Agent>): Promise<ApiResponse<Agent>> {
        return put(`/api/agents/${encodeURIComponent(id)}`, data);
    },

    /**
     * Delete an agent
     */
    async delete(id: string): Promise<ApiResponse<void>> {
        return del(`/api/agents/${encodeURIComponent(id)}`);
    },

};

// =============================================================================
// Swarms API
// =============================================================================

/**
 * What `POST /api/swarms` actually accepts.
 *
 * `Partial<Swarm>` used to stand in for this, and it hid a bug: `Swarm` has a
 * `workflow`, not an `orchestration`, and every field on a Partial is optional
 * -- so a body with neither `orchestration` nor `agents` type-checked cleanly
 * and the server rejected it with 400 "missing field `orchestration`". Creating
 * a swarm from the web UI had never once worked.
 *
 * Note `agent_id`: the request is deserialized into a Rust struct with no serde
 * rename, so this one field is snake_case. Sending `agentId` -- which is what
 * the shared `SwarmAgent` type declares -- is also a 400.
 */
export interface CreateSwarmRequest {
    name: string;
    description?: string;
    /** The server's enum. Anything else is stored but nothing consumes it. */
    orchestration: 'sequential' | 'parallel' | 'hierarchical' | 'debate';
    agents: { agent_id: string; role: string }[];
    max_iterations?: number;
}

export const swarms = {
    /**
     * List all swarms
     */
    async list(): Promise<ApiResponse<Swarm[]>> {
        return get('/api/swarms');
    },

    /**
     * Get a swarm by ID
     */
    async get(id: string): Promise<ApiResponse<Swarm>> {
        return get(`/api/swarms/${encodeURIComponent(id)}`);
    },

    /**
     * Create a new swarm
     */
    async create(data: CreateSwarmRequest): Promise<ApiResponse<Swarm>> {
        return post('/api/swarms', data);
    },

    /**
     * Update a swarm
     */
    async update(id: string, data: Partial<Swarm>): Promise<ApiResponse<Swarm>> {
        return put(`/api/swarms/${encodeURIComponent(id)}`, data);
    },

    /**
     * Delete a swarm
     */
    async delete(id: string): Promise<ApiResponse<void>> {
        return del(`/api/swarms/${encodeURIComponent(id)}`);
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
        return post('/api/chat/completions', { ...request, stream: false });
    },

    /**
     * Stream a chat completion
     */
    async* stream(request: ChatCompletionRequest): AsyncGenerator<StreamChunk, void, unknown> {
        const response = await fetch(`${config.baseUrl}/api/chat/completions`, {
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
        return get('/api/search', { q, types: types?.join(','), limit });
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
        return get('/api/stats/overview');
    },

    async providers(): Promise<ApiResponse<Record<string, { sessions: number; messages: number; tokens: number }>>> {
        return get('/api/stats/providers');
    },

};

// =============================================================================
// Import/Export API
// =============================================================================

export const transfer = {
    async harvest(providers?: string[]): Promise<ApiResponse<ImportResult>> {
        return post('/api/harvest', { providers });
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
        return get('/api/settings');
    },

    /**
     * Update application settings
     */
    async update(data: Partial<AppSettings>): Promise<ApiResponse<AppSettings>> {
        return put('/api/settings', data);
    },

    /**
     * Get connected accounts
     */
    async accounts(): Promise<ApiResponse<ProviderAccount[]>> {
        return get('/api/settings/accounts');
    },

    /**
     * Add account
     */
    async addAccount(provider: string, credentials: Record<string, string>): Promise<ApiResponse<ProviderAccount>> {
        return post('/api/settings/accounts', { provider, credentials });
    },

    /**
     * Remove account
     */
    async removeAccount(id: string): Promise<ApiResponse<void>> {
        return del(`/api/settings/accounts/${encodeURIComponent(id)}`);
    },
};

// =============================================================================
// MCP API
//
// These describe the MCP surface that CSM itself exposes to MCP clients. CSM
// is an MCP *server*; it does not act as a client, so there is no registry of
// external MCP servers to enumerate here.
// =============================================================================

export const mcp = {
    /**
     * List the tools CSM exposes over MCP
     */
    async listTools(): Promise<ApiResponse<{ mcp_tools: import('./types').McpTool[] }>> {
        return get('/api/mcp/tools');
    },

    /**
     * Fetch the system prompt CSM advertises to MCP clients
     */
    async systemPrompt(): Promise<ApiResponse<{ system_prompt: string }>> {
        return get('/api/mcp/system-prompt');
    },

    /**
     * Run one of those tools and return what it produced.
     *
     * A failed tool still answers 200: the failure is reported as
     * `result.isError` on the payload, not as an HTTP status. Callers must
     * check it -- treating the status alone as success is how a tool that
     * returned "Unknown tool" would render as a successful run.
     */
    async callTool(
        name: string,
        args: Record<string, unknown>
    ): Promise<ApiResponse<import('./types').McpToolResult>> {
        return post('/api/mcp/call', { name, arguments: args });
    },
};

// =============================================================================
// Document knowledge base API
// =============================================================================

export interface DocumentSummary {
    id: string;
    title: string;
    source: string;
    docType: string;
    chunkCount: number;
    tokenCount: number;
    embeddingModel: string;
    chunkingStrategy: string;
    createdAt: number;
}

export interface DocumentChunkMatch {
    documentId: string;
    documentTitle: string;
    chunkIndex: number;
    content: string;
    score: number;
}

export interface DocumentSearchResults {
    query: string;
    /**
     * How many chunks were compared.
     *
     * Zero means nothing has been ingested under the embedding model the
     * server is currently configured with -- a different answer from "no
     * matches", and the reason this field is rendered rather than dropped.
     */
    searched: number;
    results: DocumentChunkMatch[];
}

export const documents = {
    async list(): Promise<ApiResponse<DocumentSummary[]>> {
        return get('/api/documents');
    },

    /**
     * Ingest a document: the server chunks it, embeds the chunks and stores
     * both. Answers 503 when no embedding model is configured, rather than
     * storing something that could never be found again.
     */
    async ingest(input: {
        title: string;
        content: string;
        source?: string;
        strategy?: string;
    }): Promise<ApiResponse<DocumentSummary>> {
        return post('/api/documents', input);
    },

    async search(q: string, limit = 10): Promise<ApiResponse<DocumentSearchResults>> {
        return get(`/api/documents/search?q=${encodeURIComponent(q)}&limit=${limit}`);
    },

    async remove(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
        return del(`/api/documents/${encodeURIComponent(id)}`);
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
        return get('/api/health');
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
        return get('/api/system/info');
    },

};

// =============================================================================
// WebSocket Connection
// =============================================================================

export type WebSocketHandler = (event: import('./types').WebSocketEvent) => void;

let ws: WebSocket | null = null;
const wsHandlers: Set<WebSocketHandler> = new Set();
let wsReconnectTimer: number | null = null;

/**
 * Connect to WebSocket for real-time updates
 */
export function connectWebSocket(onMessage?: WebSocketHandler): () => void {
    if (onMessage) {
        wsHandlers.add(onMessage);
    }

    if (!ws || ws.readyState === WebSocket.CLOSED) {
        // `/ws` is mounted at the server root, not under `/api` -- the socket
        // never connected while this pointed at `/api/ws`.
        const wsUrl = config.baseUrl?.replace(/^http/, 'ws') + '/ws';
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

// =============================================================================
// Agent Inbox API
// =============================================================================

/** Shape returned by `GET /api/inbox`, mirroring `api::inbox` on the server. */
export interface InboxSnapshot<N, M, P, W> {
    notifications: N[];
    messages: M[];
    permissions: P[];
    workflows: W[];
}

export interface InboxCounts {
    unreadNotifications: number;
    unreadMessages: number;
    pendingPermissions: number;
    activeWorkflows: number;
}

export const inbox = {
    /** Everything in one round trip, which is what the inbox view needs. */
    async all<N, M, P, W>(): Promise<ApiResponse<InboxSnapshot<N, M, P, W>>> {
        return get('/api/inbox');
    },

    /** Badge counts only — far cheaper than fetching records to length-filter. */
    async counts(): Promise<ApiResponse<InboxCounts>> {
        return get('/api/inbox/counts');
    },

    async markNotificationRead(id: string): Promise<ApiResponse<unknown>> {
        return post(`/api/inbox/notifications/${encodeURIComponent(id)}/read`);
    },

    async dismissNotification(id: string): Promise<ApiResponse<unknown>> {
        return post(`/api/inbox/notifications/${encodeURIComponent(id)}/dismiss`);
    },

    async markAllNotificationsRead(): Promise<ApiResponse<unknown>> {
        return post('/api/inbox/notifications/read-all');
    },

    async markMessageRead(id: string): Promise<ApiResponse<unknown>> {
        return post(`/api/inbox/messages/${encodeURIComponent(id)}/read`);
    },

    /** Server-side toggle, so concurrent viewers cannot disagree on the state. */
    async toggleMessageStar(id: string): Promise<ApiResponse<unknown>> {
        return post(`/api/inbox/messages/${encodeURIComponent(id)}/star`);
    },

    async archiveMessage(id: string): Promise<ApiResponse<unknown>> {
        return post(`/api/inbox/messages/${encodeURIComponent(id)}/archive`);
    },

    async respondToMessage(id: string, response: string): Promise<ApiResponse<unknown>> {
        return post(`/api/inbox/messages/${encodeURIComponent(id)}/respond`, { response });
    },

    /**
     * Answer a permission request. Fails with HTTP 409 if it expired first —
     * the agent has already been told no, so a late approval must not appear
     * to have worked.
     */
    async respondToPermission(
        id: string,
        approved: boolean,
        scope?: 'once' | 'session' | 'run' | 'always',
        note?: string
    ): Promise<ApiResponse<unknown>> {
        return post(`/api/inbox/permissions/${encodeURIComponent(id)}/respond`, {
            approved,
            scope,
            note,
        });
    },
};

export const api = {
    configure,
    getConfig,
    inbox,
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
    mcp,
    documents,
    system,
    connectWebSocket,
    sendWebSocketMessage,
};

export default api;
