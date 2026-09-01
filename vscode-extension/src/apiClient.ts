// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

// =============================================================================
// Chasm API Client
// =============================================================================
// HTTP client for communicating with chasm-rust backend API
// Aligned with chasm-web/src/api/client.ts and chasm-shared types

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

// Re-export types that use different names in chasm-shared
export type { Session as CsmSession };
export type { Workspace as CsmWorkspace };
export type { Agent as CsmAgent };
export type { Swarm as CsmSwarm };

/**
 * Configuration for the Chasm API client
 */
export interface ChasmApiConfig {
    baseUrl: string;
    timeout?: number;
    apiKey?: string;
}

/**
 * Default API configuration
 */
const DEFAULT_CONFIG: ChasmApiConfig = {
    // 8787 is what `chasm api serve` binds by default. This said 3000, which
    // nothing in this repository listens on, so every request failed at the
    // socket before a path was ever in question.
    baseUrl: 'http://localhost:8787',
    timeout: 30000,
};

/**
 * Chasm API Client for communicating with chasm-rust backend
 * API structure mirrors chasm-web/src/api/client.ts
 */
export class ChasmApiClient {
    private _config: ChasmApiConfig;
    private _outputChannel: vscode.OutputChannel;

    constructor(config?: Partial<ChasmApiConfig>, outputChannel?: vscode.OutputChannel) {
        this._config = { ...DEFAULT_CONFIG, ...config };
        this._outputChannel = outputChannel || vscode.window.createOutputChannel('Chasm API');
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
        return this._get('/api/stats');
    }

    // =========================================================================
    // Workspaces API (mirrors chasm-web/src/api/client.ts)
    // =========================================================================

    workspaces = {
        list: (): Promise<ApiResponse<Workspace[]>> => {
            return this._get('/api/workspaces');
        },

        get: (id: string): Promise<ApiResponse<Workspace>> => {
            return this._get(`/api/workspaces/${encodeURIComponent(id)}`);
        },

        create: (data: Partial<Workspace>): Promise<ApiResponse<Workspace>> => {
            return this._post('/api/workspaces', data);
        },

        update: (id: string, data: Partial<Workspace>): Promise<ApiResponse<Workspace>> => {
            return this._put(`/api/workspaces/${encodeURIComponent(id)}`, data);
        },

        delete: (id: string): Promise<ApiResponse<void>> => {
            return this._delete(`/api/workspaces/${encodeURIComponent(id)}`);
        },
    };

    // =========================================================================
    // Sessions API (mirrors chasm-web/src/api/client.ts)
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
            return this._get(`/api/sessions${query ? `?${query}` : ''}`);
        },

        get: (id: string): Promise<ApiResponse<Session>> => {
            return this._get(`/api/sessions/${encodeURIComponent(id)}`);
        },

        getWithMessages: (id: string): Promise<ApiResponse<Session>> => {
            return this._get(`/api/sessions/${encodeURIComponent(id)}?include=messages`);
        },

        create: (data: Partial<Session>): Promise<ApiResponse<Session>> => {
            return this._post('/api/sessions', data);
        },

        update: (id: string, data: Partial<Session>): Promise<ApiResponse<Session>> => {
            return this._put(`/api/sessions/${encodeURIComponent(id)}`, data);
        },

        delete: (id: string): Promise<ApiResponse<void>> => {
            return this._delete(`/api/sessions/${encodeURIComponent(id)}`);
        },

        export: (id: string, options?: ExportOptions): Promise<ApiResponse<string>> => {
            const format = options?.format || 'json';
            return this._get(`/api/sessions/${encodeURIComponent(id)}/export?format=${format}`);
        },

    };

    // =========================================================================
    // Providers API (mirrors chasm-web/src/api/client.ts)
    // =========================================================================

    providers = {
        list: (): Promise<ApiResponse<Provider[]>> => {
            return this._get('/api/providers');
        },

        get: (id: string): Promise<ApiResponse<Provider>> => {
            return this._get(`/api/providers/${encodeURIComponent(id)}`);
        },

        healthAll: (): Promise<ApiResponse<ProviderHealth[]>> => {
            // Served as /api/system/providers/health; there is no
            // /api/providers/health. Same note chasm-web's client carries,
            // because the same wrong guess was made in both.
            return this._get('/api/system/providers/health');
        },

    };

    // =========================================================================
    // Agents API (mirrors chasm-web/src/api/client.ts)
    // =========================================================================

    agents = {
        list: (): Promise<ApiResponse<Agent[]>> => {
            return this._get('/api/agents');
        },

        get: (id: string): Promise<ApiResponse<Agent>> => {
            return this._get(`/api/agents/${encodeURIComponent(id)}`);
        },

        create: (data: Partial<Agent>): Promise<ApiResponse<Agent>> => {
            return this._post('/api/agents', data);
        },

        update: (id: string, data: Partial<Agent>): Promise<ApiResponse<Agent>> => {
            return this._put(`/api/agents/${encodeURIComponent(id)}`, data);
        },

        delete: (id: string): Promise<ApiResponse<void>> => {
            return this._delete(`/api/agents/${encodeURIComponent(id)}`);
        },

    };

    // =========================================================================
    // Swarms API (mirrors chasm-web/src/api/client.ts)
    // =========================================================================

    swarms = {
        list: (): Promise<ApiResponse<Swarm[]>> => {
            return this._get('/api/swarms');
        },

        get: (id: string): Promise<ApiResponse<Swarm>> => {
            return this._get(`/api/swarms/${encodeURIComponent(id)}`);
        },

        create: (data: Partial<Swarm>): Promise<ApiResponse<Swarm>> => {
            return this._post('/api/swarms', data);
        },

        update: (id: string, data: Partial<Swarm>): Promise<ApiResponse<Swarm>> => {
            return this._put(`/api/swarms/${encodeURIComponent(id)}`, data);
        },

        delete: (id: string): Promise<ApiResponse<void>> => {
            return this._delete(`/api/swarms/${encodeURIComponent(id)}`);
        },
    };

    // =========================================================================
    // Chat Completion API
    // =========================================================================

    chat = {
        completion: (request: ChatCompletionRequest): Promise<ApiResponse<ChatCompletionResponse>> => {
            return this._post('/api/chat/completions', request);
        },

        completionStream: async function* (
            this: ChasmApiClient,
            request: ChatCompletionRequest
        ): AsyncGenerator<string, void, unknown> {
            const url = `${this._config.baseUrl}/api/chat/completions`;

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
                    if (done) {break;}

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

                    for (const line of lines) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {return;}

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
            return this._get(`/api/search?q=${encodeURIComponent(query)}`);
        },
    };

    // =========================================================================
    // MCP (Model Context Protocol) API
    // =========================================================================

    mcp = {
        tools: (): Promise<ApiResponse<Array<{ name: string; description: string; inputSchema: unknown }>>> => {
            return this._get('/api/mcp/tools');
        },

    };

    // =========================================================================
    // Recording API (Real-time Session Recording)
    // =========================================================================

    recording = {
        /**
         * Send recording events to the backend
         */
        sendEvents: (events: RecordingEventPayload[]): Promise<ApiResponse<RecordingEventsResponse>> => {
            return this._post('/recording/events', { events });
        },

        /**
         * Store a full session snapshot
         */
        storeSnapshot: (snapshot: RecordingEventPayload): Promise<ApiResponse<RecordingAckResponse>> => {
            return this._post('/recording/snapshot', snapshot);
        },

        /**
         * Get recording service status
         */
        status: (): Promise<ApiResponse<RecordingStatusResponse>> => {
            return this._get('/recording/status');
        },

        /**
         * List active recording sessions
         */
        listSessions: (): Promise<ApiResponse<ActiveRecordingSessionsResponse>> => {
            return this._get('/recording/sessions');
        },

        /**
         * Get a specific recording session
         */
        getSession: (sessionId: string): Promise<ApiResponse<ActiveRecordingSession>> => {
            return this._get(`/recording/session/${sessionId}`);
        },

        /**
         * Get recovery info for a session
         */
        getRecovery: (sessionId: string): Promise<ApiResponse<RecordingRecoveryResponse>> => {
            return this._get(`/recording/session/${sessionId}/recovery`);
        },
    };
}

// =============================================================================
// Recording Types
// =============================================================================

// These interfaces use snake_case to match the Rust API exactly
/* eslint-disable @typescript-eslint/naming-convention */

export interface RecordingEventPayload {
    type: string;
    session_id: string;
    [key: string]: unknown;
}

export interface RecordingEventsResponse {
    processed: number;
    responses: RecordingAckResponse[];
}

export interface RecordingAckResponse {
    type: 'ack' | 'error' | 'recovery';
    event_id?: string;
    session_id?: string;
    status?: string;
    code?: string;
    message?: string;
}

export interface RecordingStatusResponse {
    status: string;
    active_sessions: number;
    dirty_sessions: number;
    config: {
        persist_interval_secs: number;
        max_memory_messages: number;
        session_timeout_secs: number;
    };
}

export interface ActiveRecordingSessionsResponse {
    active_sessions: ActiveRecordingSessionSummary[];
    total: number;
}

export interface ActiveRecordingSessionSummary {
    session_id: string;
    provider: string;
    title?: string;
    workspace_path?: string;
    message_count: number;
    started_at: string;
    last_activity: string;
    is_dirty: boolean;
}

export interface ActiveRecordingSession {
    session_id: string;
    provider: string;
    title?: string;
    workspace_path?: string;
    messages: RecordedMessagePayload[];
    message_count: number;
    started_at: string;
    last_activity: string;
}

export interface RecordedMessagePayload {
    message_id: string;
    role: string;
    content: string;
    model?: string;
    created_at: number;
    parent_id?: string;
    metadata?: Record<string, unknown>;
}

export interface RecordingRecoveryResponse {
    session_id: string;
    last_message_id?: string;
    message_count: number;
}

/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Singleton API client instance
 */
let _apiClient: ChasmApiClient | null = null;

/**
 * Get the shared API client instance
 */
export function getApiClient(config?: Partial<ChasmApiConfig>): ChasmApiClient {
    if (!_apiClient || config) {
        _apiClient = new ChasmApiClient(config);
    }
    return _apiClient;
}

/**
 * Create a new API client with custom configuration
 */
export function createApiClient(config?: Partial<ChasmApiConfig>, outputChannel?: vscode.OutputChannel): ChasmApiClient {
    return new ChasmApiClient(config, outputChannel);
}

