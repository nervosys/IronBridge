// =============================================================================
// CSM API Client
// =============================================================================
// HTTP client for communicating with csm-rust backend API
// Aligned with csm-web/src/api/client.ts and csm-shared types

import * as vscode from 'vscode';
import {
    Session,
    Workspace,
    Agent,
    Swarm,
    AgentRun,
    Provider,
    ProviderHealth,
    Statistics,
    SearchResult,
    ApiResponse,
    PaginatedResponse,
    ChatCompletionRequest,
    ChatCompletionResponse,
    SessionFilter,
    ExportOptions,
} from './types';

// Re-export types that use different names in csm-shared
export type { Session as CsmSession };
export type { Workspace as CsmWorkspace };
export type { Agent as CsmAgent };
export type { Swarm as CsmSwarm };

/**
 * Configuration for the CSM API client
 */
export interface CsmApiConfig {
    baseUrl: string;
    timeout?: number;
    apiKey?: string;
}

/**
 * Default API configuration
 */
const DEFAULT_CONFIG: CsmApiConfig = {
    baseUrl: 'http://localhost:3000',
    timeout: 30000,
};

/**
 * CSM API Client for communicating with csm-rust backend
 * API structure mirrors csm-web/src/api/client.ts
 */
export class CsmApiClient {
    private _config: CsmApiConfig;
    private _outputChannel: vscode.OutputChannel;

    constructor(config?: Partial<CsmApiConfig>, outputChannel?: vscode.OutputChannel) {
        this._config = { ...DEFAULT_CONFIG, ...config };
        this._outputChannel = outputChannel || vscode.window.createOutputChannel('CSM API');
    }

    // =========================================================================
    // HTTP Helpers
    // =========================================================================

    private async _fetch<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<ApiResponse<T>> {
        const url = `${this._config.baseUrl}${endpoint}`;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string> || {}),
        };

        if (this._config.apiKey) {
            headers['Authorization'] = `Bearer ${this._config.apiKey}`;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this._config.timeout);

            const response = await fetch(url, {
                ...options,
                headers,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText })) as { message?: string };
                return {
                    success: false,
                    error: {
                        code: `HTTP_${response.status}`,
                        message: errorData.message || response.statusText,
                        details: errorData as Record<string, unknown>,
                    },
                };
            }

            const data = await response.json() as T;
            return { success: true, data };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this._outputChannel.appendLine(`API Error: ${endpoint} - ${errorMessage}`);
            return {
                success: false,
                error: {
                    code: 'NETWORK_ERROR',
                    message: errorMessage,
                },
            };
        }
    }

    private async _get<T>(endpoint: string): Promise<ApiResponse<T>> {
        return this._fetch<T>(endpoint, { method: 'GET' });
    }

    private async _post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
        return this._fetch<T>(endpoint, {
            method: 'POST',
            body: data ? JSON.stringify(data) : undefined,
        });
    }

    private async _put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
        return this._fetch<T>(endpoint, {
            method: 'PUT',
            body: data ? JSON.stringify(data) : undefined,
        });
    }

    private async _delete<T>(endpoint: string): Promise<ApiResponse<T>> {
        return this._fetch<T>(endpoint, { method: 'DELETE' });
    }

    // =========================================================================
    // Health & Status
    // =========================================================================

    async health(): Promise<ApiResponse<{ status: string; version: string }>> {
        return this._get('/api/health');
    }

    async getStatistics(): Promise<ApiResponse<Statistics>> {
        return this._get('/api/v1/stats');
    }

    // =========================================================================
    // Workspaces API (mirrors csm-web/src/api/client.ts)
    // =========================================================================

    workspaces = {
        list: (): Promise<ApiResponse<Workspace[]>> => {
            return this._get('/api/v1/workspaces');
        },

        get: (id: string): Promise<ApiResponse<Workspace>> => {
            return this._get(`/api/v1/workspaces/${encodeURIComponent(id)}`);
        },

        create: (data: Partial<Workspace>): Promise<ApiResponse<Workspace>> => {
            return this._post('/api/v1/workspaces', data);
        },

        update: (id: string, data: Partial<Workspace>): Promise<ApiResponse<Workspace>> => {
            return this._put(`/api/v1/workspaces/${encodeURIComponent(id)}`, data);
        },

        delete: (id: string): Promise<ApiResponse<void>> => {
            return this._delete(`/api/v1/workspaces/${encodeURIComponent(id)}`);
        },

        getSessions: (id: string): Promise<ApiResponse<Session[]>> => {
            return this._get(`/api/v1/workspaces/${encodeURIComponent(id)}/sessions`);
        },
    };

    // =========================================================================
    // Sessions API (mirrors csm-web/src/api/client.ts)
    // =========================================================================

    sessions = {
        list: (filter?: SessionFilter): Promise<ApiResponse<PaginatedResponse<Session>>> => {
            const params = new URLSearchParams();
            if (filter) {
                Object.entries(filter).forEach(([key, value]) => {
                    if (value !== undefined) {
                        params.append(key, String(value));
                    }
                });
            }
            const query = params.toString();
            return this._get(`/api/v1/sessions${query ? `?${query}` : ''}`);
        },

        get: (id: string): Promise<ApiResponse<Session>> => {
            return this._get(`/api/v1/sessions/${encodeURIComponent(id)}`);
        },

        getWithMessages: (id: string): Promise<ApiResponse<Session>> => {
            return this._get(`/api/v1/sessions/${encodeURIComponent(id)}?include=messages`);
        },

        create: (data: Partial<Session>): Promise<ApiResponse<Session>> => {
            return this._post('/api/v1/sessions', data);
        },

        update: (id: string, data: Partial<Session>): Promise<ApiResponse<Session>> => {
            return this._put(`/api/v1/sessions/${encodeURIComponent(id)}`, data);
        },

        delete: (id: string): Promise<ApiResponse<void>> => {
            return this._delete(`/api/v1/sessions/${encodeURIComponent(id)}`);
        },

        archive: (id: string): Promise<ApiResponse<Session>> => {
            return this._post(`/api/v1/sessions/${encodeURIComponent(id)}/archive`);
        },

        export: (id: string, options?: ExportOptions): Promise<ApiResponse<string>> => {
            const format = options?.format || 'json';
            return this._get(`/api/v1/sessions/${encodeURIComponent(id)}/export?format=${format}`);
        },

        search: (query: string): Promise<ApiResponse<SearchResult[]>> => {
            return this._get(`/api/v1/sessions/search?q=${encodeURIComponent(query)}`);
        },
    };

    // =========================================================================
    // Providers API (mirrors csm-web/src/api/client.ts)
    // =========================================================================

    providers = {
        list: (): Promise<ApiResponse<Provider[]>> => {
            return this._get('/api/v1/providers');
        },

        get: (id: string): Promise<ApiResponse<Provider>> => {
            return this._get(`/api/v1/providers/${encodeURIComponent(id)}`);
        },

        health: (id: string): Promise<ApiResponse<ProviderHealth>> => {
            return this._get(`/api/v1/providers/${encodeURIComponent(id)}/health`);
        },

        healthAll: (): Promise<ApiResponse<ProviderHealth[]>> => {
            return this._get('/api/v1/providers/health');
        },

        models: (id: string): Promise<ApiResponse<string[]>> => {
            return this._get(`/api/v1/providers/${encodeURIComponent(id)}/models`);
        },
    };

    // =========================================================================
    // Agents API (mirrors csm-web/src/api/client.ts)
    // =========================================================================

    agents = {
        list: (): Promise<ApiResponse<Agent[]>> => {
            return this._get('/api/v1/agents');
        },

        get: (id: string): Promise<ApiResponse<Agent>> => {
            return this._get(`/api/v1/agents/${encodeURIComponent(id)}`);
        },

        create: (data: Partial<Agent>): Promise<ApiResponse<Agent>> => {
            return this._post('/api/v1/agents', data);
        },

        update: (id: string, data: Partial<Agent>): Promise<ApiResponse<Agent>> => {
            return this._put(`/api/v1/agents/${encodeURIComponent(id)}`, data);
        },

        delete: (id: string): Promise<ApiResponse<void>> => {
            return this._delete(`/api/v1/agents/${encodeURIComponent(id)}`);
        },

        clone: (id: string): Promise<ApiResponse<Agent>> => {
            return this._post(`/api/v1/agents/${encodeURIComponent(id)}/clone`);
        },
    };

    // =========================================================================
    // Swarms API (mirrors csm-web/src/api/client.ts)
    // =========================================================================

    swarms = {
        list: (): Promise<ApiResponse<Swarm[]>> => {
            return this._get('/api/v1/swarms');
        },

        get: (id: string): Promise<ApiResponse<Swarm>> => {
            return this._get(`/api/v1/swarms/${encodeURIComponent(id)}`);
        },

        create: (data: Partial<Swarm>): Promise<ApiResponse<Swarm>> => {
            return this._post('/api/v1/swarms', data);
        },

        update: (id: string, data: Partial<Swarm>): Promise<ApiResponse<Swarm>> => {
            return this._put(`/api/v1/swarms/${encodeURIComponent(id)}`, data);
        },

        delete: (id: string): Promise<ApiResponse<void>> => {
            return this._delete(`/api/v1/swarms/${encodeURIComponent(id)}`);
        },

        start: (id: string, goal?: string): Promise<ApiResponse<AgentRun>> => {
            return this._post(`/api/v1/swarms/${encodeURIComponent(id)}/start`, { goal });
        },

        pause: (id: string): Promise<ApiResponse<Swarm>> => {
            return this._post(`/api/v1/swarms/${encodeURIComponent(id)}/pause`);
        },

        resume: (id: string): Promise<ApiResponse<Swarm>> => {
            return this._post(`/api/v1/swarms/${encodeURIComponent(id)}/resume`);
        },

        addAgent: (id: string, agentId: string, role: string): Promise<ApiResponse<Swarm>> => {
            return this._post(`/api/v1/swarms/${encodeURIComponent(id)}/agents`, { agentId, role });
        },

        removeAgent: (id: string, agentId: string): Promise<ApiResponse<Swarm>> => {
            return this._delete(`/api/v1/swarms/${encodeURIComponent(id)}/agents/${encodeURIComponent(agentId)}`);
        },
    };

    // =========================================================================
    // Runs API
    // =========================================================================

    runs = {
        list: (): Promise<ApiResponse<AgentRun[]>> => {
            return this._get('/api/v1/runs');
        },

        get: (id: string): Promise<ApiResponse<AgentRun>> => {
            return this._get(`/api/v1/runs/${encodeURIComponent(id)}`);
        },

        cancel: (id: string): Promise<ApiResponse<AgentRun>> => {
            return this._post(`/api/v1/runs/${encodeURIComponent(id)}/cancel`);
        },
    };

    // =========================================================================
    // Chat Completion API
    // =========================================================================

    chat = {
        completion: (request: ChatCompletionRequest): Promise<ApiResponse<ChatCompletionResponse>> => {
            return this._post('/api/v1/chat/completions', request);
        },

        completionStream: async function* (
            this: CsmApiClient,
            request: ChatCompletionRequest
        ): AsyncGenerator<string, void, unknown> {
            const url = `${this._config.baseUrl}/api/v1/chat/completions`;

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(this._config.apiKey ? { Authorization: `Bearer ${this._config.apiKey}` } : {}),
                    },
                    body: JSON.stringify({ ...request, stream: true }),
                });

                if (!response.ok || !response.body) {
                    throw new Error(`Stream error: ${response.statusText}`);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

                    for (const line of lines) {
                        const data = line.slice(6);
                        if (data === '[DONE]') return;

                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.delta) {
                                yield parsed.delta;
                            }
                        } catch {
                            // Skip invalid JSON
                        }
                    }
                }
            } catch (error) {
                this._outputChannel.appendLine(`Stream error: ${error}`);
                throw error;
            }
        }.bind(this),
    };

    // =========================================================================
    // Search API
    // =========================================================================

    search = {
        global: (query: string): Promise<ApiResponse<SearchResult[]>> => {
            return this._get(`/api/v1/search?q=${encodeURIComponent(query)}`);
        },

        sessions: (query: string): Promise<ApiResponse<SearchResult[]>> => {
            return this._get(`/api/v1/search/sessions?q=${encodeURIComponent(query)}`);
        },

        messages: (query: string): Promise<ApiResponse<SearchResult[]>> => {
            return this._get(`/api/v1/search/messages?q=${encodeURIComponent(query)}`);
        },
    };

    // =========================================================================
    // MCP (Model Context Protocol) API
    // =========================================================================

    mcp = {
        tools: (): Promise<ApiResponse<Array<{ name: string; description: string; inputSchema: unknown }>>> => {
            return this._get('/api/v1/mcp/tools');
        },

        callTool: (name: string, args: Record<string, unknown>): Promise<ApiResponse<unknown>> => {
            return this._post('/api/v1/mcp/tools/call', { name, arguments: args });
        },
    };
}

/**
 * Singleton API client instance
 */
let _apiClient: CsmApiClient | null = null;

/**
 * Get the shared API client instance
 */
export function getApiClient(config?: Partial<CsmApiConfig>): CsmApiClient {
    if (!_apiClient || config) {
        _apiClient = new CsmApiClient(config);
    }
    return _apiClient;
}

/**
 * Create a new API client with custom configuration
 */
export function createApiClient(config?: Partial<CsmApiConfig>, outputChannel?: vscode.OutputChannel): CsmApiClient {
    return new CsmApiClient(config, outputChannel);
}
