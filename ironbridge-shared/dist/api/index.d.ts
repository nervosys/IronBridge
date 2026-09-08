import { WorkspaceFilter, ApiResponse, Workspace, SessionFilter, Session, SessionWithMessages, SearchResult, Statistics, McpTool, McpToolResult, McpToolCall } from '../types/index.js';
export { ApiError } from '../types/index.js';

interface ApiClientConfig {
    baseUrl: string;
    timeout?: number;
    headers?: Record<string, string>;
    onError?: (error: Error) => void;
    customFetch?: typeof fetch;
}
declare function createApiClient(config?: ApiClientConfig): {
    config: {
        baseUrl: string;
        timeout: number;
    };
    workspaces: {
        list(filter?: WorkspaceFilter): Promise<ApiResponse<Workspace[]>>;
        get(id: string): Promise<ApiResponse<Workspace>>;
    };
    sessions: {
        list(filter?: SessionFilter): Promise<ApiResponse<Session[]>>;
        get(id: string): Promise<ApiResponse<SessionWithMessages>>;
        getMessages(id: string): Promise<ApiResponse<SessionWithMessages>>;
        create(data: Partial<Session>): Promise<ApiResponse<Session>>;
        update(id: string, data: Partial<Session>): Promise<ApiResponse<Session>>;
        delete(id: string): Promise<ApiResponse<void>>;
        fork(id: string, fromMessageId?: string): Promise<ApiResponse<Session>>;
        merge(sessionIds: string[], title: string): Promise<ApiResponse<Session>>;
    };
    search: {
        query(q: string, limit?: number): Promise<ApiResponse<SearchResult[]>>;
        sessions(q: string, filter?: SessionFilter): Promise<ApiResponse<Session[]>>;
    };
    stats: {
        get(): Promise<ApiResponse<Statistics>>;
        byProvider(): Promise<ApiResponse<Record<string, number>>>;
    };
    mcp: {
        listTools(): Promise<ApiResponse<McpTool[]>>;
        callTool(name: string, args: Record<string, unknown>): Promise<ApiResponse<McpToolResult>>;
        callToolsBatch(calls: McpToolCall[]): Promise<ApiResponse<McpToolResult[]>>;
        getSystemPrompt(): Promise<ApiResponse<{
            system_prompt: string;
        }>>;
    };
    health: {
        check(): Promise<ApiResponse<{
            status: string;
            version: string;
        }>>;
    };
    request: <T>(method: string, path: string, body?: unknown, customHeaders?: Record<string, string>) => Promise<ApiResponse<T>>;
    get: <T>(path: string, params?: Record<string, string | number | boolean | undefined>) => Promise<ApiResponse<T>>;
    post: <T>(path: string, body?: unknown) => Promise<ApiResponse<T>>;
    put: <T>(path: string, body?: unknown) => Promise<ApiResponse<T>>;
    delete: <T>(path: string) => Promise<ApiResponse<T>>;
};
declare const api: {
    config: {
        baseUrl: string;
        timeout: number;
    };
    workspaces: {
        list(filter?: WorkspaceFilter): Promise<ApiResponse<Workspace[]>>;
        get(id: string): Promise<ApiResponse<Workspace>>;
    };
    sessions: {
        list(filter?: SessionFilter): Promise<ApiResponse<Session[]>>;
        get(id: string): Promise<ApiResponse<SessionWithMessages>>;
        getMessages(id: string): Promise<ApiResponse<SessionWithMessages>>;
        create(data: Partial<Session>): Promise<ApiResponse<Session>>;
        update(id: string, data: Partial<Session>): Promise<ApiResponse<Session>>;
        delete(id: string): Promise<ApiResponse<void>>;
        fork(id: string, fromMessageId?: string): Promise<ApiResponse<Session>>;
        merge(sessionIds: string[], title: string): Promise<ApiResponse<Session>>;
    };
    search: {
        query(q: string, limit?: number): Promise<ApiResponse<SearchResult[]>>;
        sessions(q: string, filter?: SessionFilter): Promise<ApiResponse<Session[]>>;
    };
    stats: {
        get(): Promise<ApiResponse<Statistics>>;
        byProvider(): Promise<ApiResponse<Record<string, number>>>;
    };
    mcp: {
        listTools(): Promise<ApiResponse<McpTool[]>>;
        callTool(name: string, args: Record<string, unknown>): Promise<ApiResponse<McpToolResult>>;
        callToolsBatch(calls: McpToolCall[]): Promise<ApiResponse<McpToolResult[]>>;
        getSystemPrompt(): Promise<ApiResponse<{
            system_prompt: string;
        }>>;
    };
    health: {
        check(): Promise<ApiResponse<{
            status: string;
            version: string;
        }>>;
    };
    request: <T>(method: string, path: string, body?: unknown, customHeaders?: Record<string, string>) => Promise<ApiResponse<T>>;
    get: <T>(path: string, params?: Record<string, string | number | boolean | undefined>) => Promise<ApiResponse<T>>;
    post: <T>(path: string, body?: unknown) => Promise<ApiResponse<T>>;
    put: <T>(path: string, body?: unknown) => Promise<ApiResponse<T>>;
    delete: <T>(path: string) => Promise<ApiResponse<T>>;
};

export { type ApiClientConfig, ApiResponse, api, createApiClient };
