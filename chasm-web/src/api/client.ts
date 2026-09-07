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
import { getToken, markUnauthorized, setSession, logout } from './session';

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

        // Attach the bearer token when we have one. When the server does not
        // require auth there is none, and it does not ask for one -- so this is
        // simply absent, not empty-and-rejected.
        const token = getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${config.baseUrl}${path}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // 401 means the server requires auth and this request did not satisfy
        // it. Drop any stale token and raise the login screen. This is the only
        // thing that turns login on, so a server that never 401s never shows it.
        if (response.status === 401) {
            markUnauthorized();
        }

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
// Auth API
// =============================================================================

interface AuthEnvelope {
    access_token: string;
    refresh_token?: string;
    user?: { id: string; email: string; display_name: string };
}

/**
 * Log in and register. These call the root-mounted `/auth/*` endpoints, which
 * stay open even when `CHASM_REQUIRE_AUTH` gates `/api` -- otherwise a token
 * could never be obtained. On success the token is stored via `session`, which
 * clears the login-required flag and lets `request()` attach it from then on.
 *
 * The `/auth/*` responses are bare (`{ data: { access_token, user } }`), not
 * the `/api` envelope, so this reads them directly rather than through
 * `request()`.
 */
export const auth = {
    async login(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
        return authCall('/auth/login', { email, password });
    },

    async register(
        email: string,
        password: string,
        displayName: string
    ): Promise<{ ok: true } | { ok: false; error: string }> {
        return authCall('/auth/register', { email, password, display_name: displayName });
    },

    logout(): void {
        logout();
    },
};

async function authCall(
    path: string,
    body: Record<string, string>
): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        const response = await fetch(`${config.baseUrl}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { ok: false, error: payload?.error || response.statusText || 'Login failed' };
        }
        const data: AuthEnvelope = payload?.data ?? payload;
        if (!data?.access_token) {
            return { ok: false, error: 'The server returned no token.' };
        }
        setSession(
            data.access_token,
            data.user
                ? { id: data.user.id, email: data.user.email, displayName: data.user.display_name }
                : undefined
        );
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Network error' };
    }
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
    async create(data: CreateAgentRequest): Promise<ApiResponse<Agent>> {
        return post('/api/agents', data);
    },

    /**
     * Update an agent
     *
     * Every field optional here, and on the server too -- `UpdateAgentRequest`
     * is all `Option<T>`, so a partial update is genuinely what it accepts.
     */
    async update(id: string, data: UpdateAgentRequest): Promise<ApiResponse<Agent>> {
        return put(`/api/agents/${encodeURIComponent(id)}`, data);
    },

    /**
     * Delete an agent
     */
    async delete(id: string): Promise<ApiResponse<void>> {
        return del(`/api/agents/${encodeURIComponent(id)}`);
    },

};

/**
 * What `POST /api/agents` actually accepts.
 *
 * `Partial<Agent>` used to stand in for this, and it hid the same bug the
 * swarm request had: the server requires an `instruction`, and the shared
 * `Agent` type has no such field -- it declares `systemPrompt`. So a body of
 * `{ name, description, role }` type-checked cleanly and the server answered
 * 400 "missing field `instruction`". Creating an agent from the web UI had
 * never once worked.
 *
 * The snake_case fields are not a slip: the request deserializes into a Rust
 * struct with no serde rename, so `max_tokens` and `sub_agents` are spelled
 * as the server spells them. `maxTokens` is silently ignored.
 */
export interface CreateAgentRequest {
    name: string;
    /** What the agent is told to do. Required.  */
    instruction: string;
    description?: string;
    role?: string;
    model?: string;
    provider?: string;
    temperature?: number;
    max_tokens?: number;
    tools?: string[];
    sub_agents?: string[];
    metadata?: string;
}

/** What `PUT /api/agents/{id}` accepts -- every field optional, server-side too. */
export type UpdateAgentRequest = Partial<CreateAgentRequest>;

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

/** One agent's membership of a swarm, spelled as the server spells it. */
export interface SwarmMember {
    agent_id: string;
    role: string;
}

/** What the membership endpoints return: the swarm's list after the change. */
export interface SwarmMembership {
    id: string;
    agents: SwarmMember[];
    updatedAt: number;
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

    /**
     * Add an agent to a swarm, or change the role it already holds.
     *
     * `agent_id` is snake_case because that is how the server spells it: the
     * body deserializes into a Rust struct with no serde rename.
     */
    async addAgent(id: string, member: SwarmMember): Promise<ApiResponse<SwarmMembership>> {
        return post(`/api/swarms/${encodeURIComponent(id)}/agents`, member);
    },

    /**
     * Remove an agent from a swarm. A 404 means it was not a member.
     */
    async removeAgent(id: string, agentId: string): Promise<ApiResponse<SwarmMembership>> {
        return del(`/api/swarms/${encodeURIComponent(id)}/agents/${encodeURIComponent(agentId)}`);
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
        const streamToken = getToken();
        const response = await fetch(`${config.baseUrl}/api/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...config.headers,
                ...(streamToken ? { Authorization: `Bearer ${streamToken}` } : {}),
            },
            body: JSON.stringify({ ...request, stream: true }),
        });

        if (response.status === 401) {
            markUnauthorized();
        }
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
// Research API
// =============================================================================
//
// arXiv search, plus the papers this server has saved.
//
// Note what a Paper does not carry: no citations, views, comments, stars or
// trend score. arXiv's API reports none of them, and the page this replaced
// showed all five and ranked a leaderboard by them.

export interface Paper {
    arxivId: string;
    title: string;
    authors: string[];
    /** The abstract, unwrapped -- arXiv hard-wraps it at the source. */
    summary: string;
    categories: string[];
    published: string;
    updated?: string;
    /** The abstract page. */
    url: string;
    pdfUrl?: string;
    /** The authors' own note, e.g. a venue. Often absent. */
    comment?: string;
}

export interface PaperResults {
    query: string;
    source: 'arxiv';
    /** arXiv's own count for the query, not this page's length. */
    totalResults: number;
    start: number;
    results: Paper[];
}

export const research = {
    async search(q: string, limit = 20, start = 0): Promise<ApiResponse<PaperResults>> {
        return get(
            `/api/research/papers?q=${encodeURIComponent(q)}&limit=${limit}&start=${start}`
        );
    },

    async saved(): Promise<ApiResponse<Paper[]>> {
        return get('/api/research/saved');
    },

    /** Idempotent: saving the same paper twice is not an error. */
    async save(paper: Paper): Promise<ApiResponse<unknown>> {
        return post('/api/research/saved', { paper });
    },

    async unsave(arxivId: string): Promise<ApiResponse<unknown>> {
        return del(`/api/research/saved/${encodeURIComponent(arxivId)}`);
    },
};

// =============================================================================
// Fine-tuning API
// =============================================================================
//
// Chasm does not train anything. It hands a dataset to the provider configured
// on the server and reads that provider's status back.
//
// Note what a TrainingJob does not have: no progress, no ETA, no GPU, no
// accuracy, no F1. A fine-tuning API reports none of them, and the table this
// replaced showed all five -- including jobs 67% through work that had never
// started.

export interface DatasetProblem {
    /** Which entry is at fault. Absent for a whole-dataset problem. */
    entryIndex?: number;
    message: string;
}

export interface DatasetValidation {
    datasetId: string;
    datasetName: string;
    entryCount: number;
    usable: boolean;
    problems: DatasetProblem[];
}

export interface TrainingJob {
    id: string;
    /** The provider's own id, so the job can be found in their dashboard. */
    providerJobId: string;
    datasetId: string;
    datasetName: string;
    baseModel: string;
    /** The provider's status verbatim. */
    status: 'validating_files' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
    fineTunedModel?: string;
    trainedTokens?: number;
    error?: string;
    createdAt: number;
    updatedAt: number;
    finishedAt?: number;
    /**
     * Present when the provider could not be reached on this request, so
     * `status` is the last one read rather than the current one. Render it:
     * a stale status is otherwise indistinguishable from a fresh one.
     */
    refreshError?: string;
}

export const training = {
    /**
     * Check a dataset before spending anything.
     *
     * Local and free. The alternative is finding out at the provider, after
     * an upload that has already been paid for.
     */
    async validate(datasetId: string): Promise<ApiResponse<DatasetValidation>> {
        return get(`/api/training/validate?datasetId=${encodeURIComponent(datasetId)}`);
    },

    async jobs(): Promise<ApiResponse<TrainingJob[]>> {
        return get('/api/training/jobs');
    },

    async start(input: {
        datasetId: string;
        baseModel: string;
        suffix?: string;
    }): Promise<ApiResponse<TrainingJob>> {
        return post('/api/training/jobs', input);
    },

    /** Cancels a running job at the provider, or forgets a finished one. */
    async cancel(id: string): Promise<ApiResponse<unknown>> {
        return del(`/api/training/jobs/${encodeURIComponent(id)}`);
    },
};

// =============================================================================
// Remote catalogue API
// =============================================================================
//
// Models and datasets published on the Hugging Face Hub.
//
// The other half of the word "dataset": this is the catalogue you would fetch
// *from*, `datasets` below is the local store you upload *to*.
//
// Note what a CatalogEntry does not have: no size, no sample count, no
// parameter count, no format, no `downloaded` flag. The Hub's search API
// reports none of them, and the tables this replaced rendered all five as
// measurements of artifacts nothing had measured.

export interface CatalogEntry {
    id: string;
    author?: string;
    name: string;
    downloads: number;
    likes: number;
    /** Models only, e.g. `text-generation`. */
    task?: string;
    /** Models only, e.g. `transformers`. */
    library?: string;
    /** Datasets only, and often long. */
    description?: string;
    tags: string[];
    updatedAt?: string;
    /** Canonical Hub page. Link to it rather than rebuilding the URL. */
    url: string;
    gated: boolean;
}

export interface CatalogResults {
    query: string;
    source: 'huggingface';
    results: CatalogEntry[];
}

export const catalog = {
    /**
     * Search the Hub.
     *
     * An unreachable or rate-limited Hub is a 502, never an empty list, so a
     * thrown error here is a real answer and worth showing.
     */
    async models(q: string, limit = 20): Promise<ApiResponse<CatalogResults>> {
        return get(`/api/catalog/models?q=${encodeURIComponent(q)}&limit=${limit}`);
    },

    async datasets(q: string, limit = 20): Promise<ApiResponse<CatalogResults>> {
        return get(`/api/catalog/datasets?q=${encodeURIComponent(q)}&limit=${limit}`);
    },

    /**
     * A repository's files, with sizes.
     *
     * Sizes are what makes a download decidable: they are why a 5 GB file can
     * be flagged before anyone clicks, and why the server can check the disk.
     */
    async files(kind: 'models' | 'datasets', id: string): Promise<ApiResponse<RepoFileList>> {
        return get(`/api/catalog/files?kind=${kind}&id=${encodeURIComponent(id)}`);
    },
};

export interface RepoFile {
    path: string;
    size: number;
}

export interface RepoFileList {
    kind: string;
    id: string;
    files: RepoFile[];
}

// =============================================================================
// Downloads API
// =============================================================================

export interface DownloadJob {
    id: string;
    kind: 'models' | 'datasets';
    repoId: string;
    filePath: string;
    /** Absolute path on the server, so a user can find the file. */
    destPath: string;
    totalBytes: number;
    /**
     * Written periodically by the running transfer, so it lags the true
     * figure by at most a few megabytes.
     */
    downloadedBytes: number;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    error?: string;
    startedAt: number;
    updatedAt: number;
    completedAt?: number;
}

export const downloads = {
    async list(): Promise<ApiResponse<DownloadJob[]>> {
        return get('/api/downloads');
    },

    /**
     * Start one. Returns immediately with a job to poll -- these files are
     * large enough that waiting for the transfer would time out the request.
     */
    async start(input: {
        kind: 'models' | 'datasets';
        repoId: string;
        filePath: string;
    }): Promise<ApiResponse<DownloadJob>> {
        return post('/api/downloads', input);
    },

    async get(id: string): Promise<ApiResponse<DownloadJob>> {
        return get(`/api/downloads/${encodeURIComponent(id)}`);
    },

    /**
     * Cancel a running job, or forget a finished one.
     *
     * Never deletes the downloaded file: dropping the record is a request to
     * stop tracking it, not to lose the artifact.
     */
    async cancel(id: string): Promise<ApiResponse<unknown>> {
        return del(`/api/downloads/${encodeURIComponent(id)}`);
    },
};

// =============================================================================
// Local dataset store API
// =============================================================================
//
// Datasets the user uploads and this server holds.
//
// Deliberately not the same thing as the HuggingFace catalogue on the
// Developer page, which is something you download *from*. The data flows the
// other way, so they are separate features rather than one endpoint pretending
// to be both.

export type DatasetType = 'conversations' | 'documents' | 'qa' | 'custom';

export interface Dataset {
    id: string;
    name: string;
    type: DatasetType;
    format: string;
    /** Counted by the server from the rows it wrote, never supplied here. */
    entryCount: number;
    /** Summed by the server over the stored JSON, so it describes what is on disk. */
    sizeBytes: number;
    createdAt: number;
    updatedAt: number;
}

export interface DatasetEntryPage {
    datasetId: string;
    /** The dataset's whole record count, not this page's length. */
    total: number;
    limit: number;
    offset: number;
    entries: unknown[];
}

export const datasets = {
    async list(): Promise<ApiResponse<Dataset[]>> {
        return get('/api/datasets');
    },

    /** At most 50,000 entries; the server has no streaming import. */
    async create(input: {
        name: string;
        type?: DatasetType;
        format?: string;
        entries: unknown[];
    }): Promise<ApiResponse<Dataset>> {
        return post('/api/datasets', input);
    },

    async entries(id: string, limit = 50, offset = 0): Promise<ApiResponse<DatasetEntryPage>> {
        return get(`/api/datasets/${encodeURIComponent(id)}/entries?limit=${limit}&offset=${offset}`);
    },

    async remove(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
        return del(`/api/datasets/${encodeURIComponent(id)}`);
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
        //
        // A browser cannot set an Authorization header on a WebSocket, so the
        // token travels in the `Sec-WebSocket-Protocol` subprotocol instead of
        // the URL. Unlike a `?token=` query string, the subprotocol header is
        // not written to request-line access/proxy logs or browser history, so
        // the token does not leak there. The server reads `['bearer', token]`
        // and echoes `bearer`. On a server with auth enabled `/ws` is gated
        // like everything else; with auth disabled the token is simply absent.
        const token = getToken();
        const base = config.baseUrl?.replace(/^http/, 'ws') + '/ws';
        ws = token
            ? new WebSocket(base, ['bearer', token])
            : new WebSocket(base);

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
    datasets,
    catalog,
    downloads,
    training,
    research,
    system,
    connectWebSocket,
    sendWebSocketMessage,
};

export default api;
