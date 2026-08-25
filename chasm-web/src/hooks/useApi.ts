// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

// React hooks for CSM API data fetching
// Provides typed, reactive data access with caching and refetching

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    workspaces,
    sessions,
    messages,
    providers,
    agents,
    swarms,
    stats,
    search,
    settings,
    system,
    transfer,
    chat,
    mcp,
    documents,
    datasets,
    connectWebSocket,
} from '../api/client';
import type { CreateSwarmRequest, DocumentSummary, Dataset, DatasetType } from '../api/client';
import type {
    Workspace,
    Session,
    Message,
    Checkpoint,
    Provider,
    ProviderHealth,
    Agent,
    Swarm,
    Statistics,
    SearchResult,
    SessionFilter,
    WorkspaceFilter,
    PaginatedResponse,
    ApiResponse,
    AppSettings,
    ProviderAccount,
    GitCommit,
    WebSocketEvent,
    ChatCompletionRequest,
    StreamChunk,
    McpTool,
} from '../api/types';

// =============================================================================
// Types
// =============================================================================

interface UseQueryOptions {
    enabled?: boolean;
    refetchInterval?: number;
    refetchOnWindowFocus?: boolean;
}

interface UseQueryResult<T> {
    data: T | null;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    isRefetching: boolean;
}

interface UseMutationResult<TData, TVariables> {
    mutate: (variables: TVariables) => Promise<TData | null>;
    data: TData | null;
    isLoading: boolean;
    error: Error | null;
    reset: () => void;
}

// =============================================================================
// Base Hooks
// =============================================================================

/**
 * Generic query hook with caching and refetching
 */
function useQuery<T>(
    queryFn: () => Promise<ApiResponse<T>>,
    deps: unknown[] = [],
    options: UseQueryOptions = {}
): UseQueryResult<T> {
    const { enabled = true, refetchInterval, refetchOnWindowFocus = false } = options;
    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefetching, setIsRefetching] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const mountedRef = useRef(true);

    const fetchData = useCallback(async (isRefetch = false) => {
        if (!enabled) return;

        if (isRefetch) {
            setIsRefetching(true);
        } else {
            setIsLoading(true);
        }
        setError(null);

        try {
            const result = await queryFn();
            if (!mountedRef.current) return;

            if (result.success && result.data !== undefined) {
                setData(result.data);
            } else if (result.error) {
                setError(new Error(result.error.message));
            }
        } catch (err) {
            if (!mountedRef.current) return;
            setError(err as Error);
        } finally {
            if (mountedRef.current) {
                setIsLoading(false);
                setIsRefetching(false);
            }
        }
    }, [queryFn, enabled]);

    const refetch = useCallback(async () => {
        await fetchData(true);
    }, [fetchData]);

    // Initial fetch and dependency changes.
    //
    // fetchData sets isLoading/error synchronously before awaiting. That is
    // the intended behaviour of a fetch-on-mount hook, and it does not cascade:
    // on mount both are already at their target values (true/null) so React
    // bails out, and on a dependency change the single re-render into the
    // loading state is exactly what callers render a spinner from.
    //
    // set-state-in-effect is disabled rather than worked around; removing it
    // properly means adopting a query library, not restructuring this effect.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchData();
        // `deps` is caller-supplied, so the array cannot be statically verified.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps, enabled, fetchData]);

    // Refetch interval
    useEffect(() => {
        if (!refetchInterval || !enabled) return;
        const interval = setInterval(() => fetchData(true), refetchInterval);
        return () => clearInterval(interval);
    }, [refetchInterval, enabled, fetchData]);

    // Refetch on window focus
    useEffect(() => {
        if (!refetchOnWindowFocus || !enabled) return;
        const onFocus = () => fetchData(true);
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [refetchOnWindowFocus, enabled, fetchData]);

    // Cleanup
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    return { data, isLoading, error, refetch, isRefetching };
}

/**
 * Generic mutation hook
 */
function useMutation<TData, TVariables>(
    mutationFn: (variables: TVariables) => Promise<ApiResponse<TData>>
): UseMutationResult<TData, TVariables> {
    const [data, setData] = useState<TData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const mutate = useCallback(async (variables: TVariables): Promise<TData | null> => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await mutationFn(variables);
            if (result.success && result.data !== undefined) {
                setData(result.data);
                return result.data;
            } else if (result.error) {
                setError(new Error(result.error.message));
            }
            return null;
        } catch (err) {
            setError(err as Error);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, [mutationFn]);

    const reset = useCallback(() => {
        setData(null);
        setError(null);
        setIsLoading(false);
    }, []);

    return { mutate, data, isLoading, error, reset };
}

// =============================================================================
// Workspace Hooks
// =============================================================================

/**
 * Fetch all workspaces
 */
export function useWorkspaces(filter?: WorkspaceFilter, options?: UseQueryOptions): UseQueryResult<PaginatedResponse<Workspace>> {
    const filterKey = JSON.stringify(filter);
    // Key on filterKey, not filter: callers pass object literals, so `filter`
    // has a fresh identity every render and would rebuild queryFn (and thus
    // re-run the fetch effect) on every single render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const queryFn = useCallback(() => workspaces.list(filter), [filterKey]);
    return useQuery(queryFn, [filterKey], options);
}

/**
 * Fetch a single workspace
 */
export function useWorkspace(id: string | null, options?: UseQueryOptions): UseQueryResult<Workspace> {
    const queryFn = useCallback(() => workspaces.get(id!), [id]);
    return useQuery(queryFn, [id], { ...options, enabled: !!id && options?.enabled !== false });
}

export function useSessions(filter?: SessionFilter, options?: UseQueryOptions): UseQueryResult<PaginatedResponse<Session>> {
    const filterKey = JSON.stringify(filter);
    // See useWorkspaces: key on the serialized filter, not the object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const queryFn = useCallback(() => sessions.list(filter), [filterKey]);
    return useQuery(queryFn, [filterKey], options);
}

/**
 * Fetch a single session
 */
export function useSession(id: string | null, options?: UseQueryOptions): UseQueryResult<Session> {
    const queryFn = useCallback(() => sessions.get(id!), [id]);
    return useQuery(queryFn, [id], { ...options, enabled: !!id && options?.enabled !== false });
}

/**
 * Fetch session with messages
 */
export function useSessionWithMessages(id: string | null, options?: UseQueryOptions): UseQueryResult<Session & { messages: Message[] }> {
    const queryFn = useCallback(() => sessions.getWithMessages(id!), [id]);
    return useQuery(queryFn, [id], { ...options, enabled: !!id && options?.enabled !== false });
}

/**
 * Create session mutation
 */
export function useCreateSession() {
    return useMutation((data: Partial<Session>) => sessions.create(data));
}

export function useDeleteSession() {
    return useMutation((id: string) => sessions.delete(id));
}

export function useSessionCheckpoints(sessionId: string | null, options?: UseQueryOptions): UseQueryResult<Checkpoint[]> {
    const queryFn = useCallback(() => sessions.checkpoints(sessionId!), [sessionId]);
    return useQuery(queryFn, [sessionId], { ...options, enabled: !!sessionId && options?.enabled !== false });
}

/**
 * Create checkpoint mutation
 */
export function useCreateCheckpoint() {
    return useMutation(({ sessionId, data }: { sessionId: string; data: Partial<Checkpoint> }) =>
        sessions.createCheckpoint(sessionId, data)
    );
}

/**
 * Fetch session git commits
 */
export function useSessionCommits(sessionId: string | null, options?: UseQueryOptions): UseQueryResult<GitCommit[]> {
    const queryFn = useCallback(() => sessions.commits(sessionId!), [sessionId]);
    return useQuery(queryFn, [sessionId], { ...options, enabled: !!sessionId && options?.enabled !== false });
}

// =============================================================================
// Message Hooks
// =============================================================================

export function useCreateMessage() {
    return useMutation(({ sessionId, data }: { sessionId: string; data: Partial<Message> }) =>
        messages.create(sessionId, data)
    );
}

/**
 * Update message mutation
 */
// =============================================================================
// Provider Hooks
// =============================================================================

/**
 * Fetch all providers
 */
export function useProviders(options?: UseQueryOptions): UseQueryResult<Provider[]> {
    const queryFn = useCallback(() => providers.list(), []);
    return useQuery(queryFn, [], options);
}

export function useProviderHealth(options?: UseQueryOptions): UseQueryResult<ProviderHealth[]> {
    const queryFn = useCallback(() => providers.healthCheck(), []);
    return useQuery(queryFn, [], { ...options, refetchInterval: options?.refetchInterval ?? 30000 });
}

export function useTestProvider() {
    return useMutation((id: string) => providers.test(id));
}

export function useMcpTools(options?: UseQueryOptions): UseQueryResult<{ mcp_tools: McpTool[] }> {
    const queryFn = useCallback(() => mcp.listTools(), []);
    return useQuery(queryFn, [], options);
}

/**
 * The datasets this server holds -- the ones the user uploaded, not a remote
 * catalogue.
 */
export function useDatasets(options?: UseQueryOptions): UseQueryResult<Dataset[]> {
    const queryFn = useCallback(() => datasets.list(), []);
    return useQuery(queryFn, [], options);
}

export function useCreateDataset() {
    return useMutation(
        (input: { name: string; type?: DatasetType; format?: string; entries: unknown[] }) =>
            datasets.create(input)
    );
}

export function useDeleteDataset() {
    return useMutation((id: string) => datasets.remove(id));
}

/**
 * The documents in the server's knowledge base.
 */
export function useDocuments(options?: UseQueryOptions): UseQueryResult<DocumentSummary[]> {
    const queryFn = useCallback(() => documents.list(), []);
    return useQuery(queryFn, [], options);
}

export function useIngestDocument() {
    return useMutation((input: { title: string; content: string; source?: string; strategy?: string }) =>
        documents.ingest(input)
    );
}

export function useSearchDocuments() {
    return useMutation(({ q, limit }: { q: string; limit?: number }) => documents.search(q, limit));
}

export function useDeleteDocument() {
    return useMutation((id: string) => documents.remove(id));
}

/**
 * Run an MCP tool.
 *
 * Note the result: a tool that failed still comes back on the success path
 * with `result.isError` set, so callers check that rather than assuming a
 * resolved promise means the tool worked.
 */
export function useCallMcpTool() {
    return useMutation(({ name, args }: { name: string; args: Record<string, unknown> }) =>
        mcp.callTool(name, args)
    );
}

// =============================================================================
// Agent Hooks
// =============================================================================

/**
 * Fetch all agents
 */
export function useAgents(options?: UseQueryOptions): UseQueryResult<Agent[]> {
    const queryFn = useCallback(() => agents.list(), []);
    return useQuery(queryFn, [], options);
}

/**
 * Fetch a single agent
 */
export function useAgent(id: string | null, options?: UseQueryOptions): UseQueryResult<Agent> {
    const queryFn = useCallback(() => agents.get(id!), [id]);
    return useQuery(queryFn, [id], { ...options, enabled: !!id && options?.enabled !== false });
}

/**
 * Create agent mutation
 */
export function useCreateAgent() {
    return useMutation((data: Partial<Agent>) => agents.create(data));
}

/**
 * Update agent mutation
 */
export function useUpdateAgent() {
    return useMutation(({ id, data }: { id: string; data: Partial<Agent> }) => agents.update(id, data));
}

/**
 * Delete agent mutation
 */
export function useDeleteAgent() {
    return useMutation((id: string) => agents.delete(id));
}

export function useSwarms(options?: UseQueryOptions): UseQueryResult<Swarm[]> {
    const queryFn = useCallback(() => swarms.list(), []);
    return useQuery(queryFn, [], options);
}

/**
 * Fetch a single swarm
 */
export function useSwarm(id: string | null, options?: UseQueryOptions): UseQueryResult<Swarm> {
    const queryFn = useCallback(() => swarms.get(id!), [id]);
    return useQuery(queryFn, [id], { ...options, enabled: !!id && options?.enabled !== false });
}

/**
 * Create swarm mutation
 */
export function useCreateSwarm() {
    return useMutation((data: CreateSwarmRequest) => swarms.create(data));
}

/**
 * Update swarm mutation
 */
export function useUpdateSwarm() {
    return useMutation(({ id, data }: { id: string; data: Partial<Swarm> }) => swarms.update(id, data));
}

/**
 * Delete swarm mutation
 */
export function useDeleteSwarm() {
    return useMutation((id: string) => swarms.delete(id));
}

export function useSearch(query: string, types?: string[], options?: UseQueryOptions): UseQueryResult<SearchResult[]> {
    const typesKey = JSON.stringify(types);
    // See useWorkspaces: `types` is an array literal with fresh identity each
    // render, so key on the serialized form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const queryFn = useCallback(() => search.query(query, types), [query, typesKey]);
    return useQuery(queryFn, [query, typesKey], {
        ...options,
        enabled: query.length > 0 && options?.enabled !== false,
    });
}

export function useDebouncedSearch(delay = 300) {
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(query), delay);
        return () => clearTimeout(timer);
    }, [query, delay]);

    const results = useSearch(debouncedQuery);

    return {
        query,
        setQuery,
        ...results,
        isDebouncing: query !== debouncedQuery,
    };
}

// =============================================================================
// Statistics Hooks
// =============================================================================

/**
 * Fetch overview statistics
 */
export function useStatistics(options?: UseQueryOptions): UseQueryResult<Statistics> {
    const queryFn = useCallback(() => stats.overview(), []);
    return useQuery(queryFn, [], { ...options, refetchInterval: options?.refetchInterval ?? 60000 });
}

export function useProviderStats(options?: UseQueryOptions): UseQueryResult<Record<string, { sessions: number; messages: number; tokens: number }>> {
    const queryFn = useCallback(() => stats.providers(), []);
    return useQuery(queryFn, [], options);
}

export function useSettings(options?: UseQueryOptions): UseQueryResult<AppSettings> {
    const queryFn = useCallback(() => settings.get(), []);
    return useQuery(queryFn, [], options);
}

/**
 * Update settings mutation
 */
export function useUpdateSettings() {
    return useMutation((data: Partial<AppSettings>) => settings.update(data));
}

/**
 * Fetch provider accounts
 */
export function useAccounts(options?: UseQueryOptions): UseQueryResult<ProviderAccount[]> {
    const queryFn = useCallback(() => settings.accounts(), []);
    return useQuery(queryFn, [], options);
}

/**
 * Add provider account mutation
 */
export function useAddAccount() {
    return useMutation(({ provider, credentials }: { provider: string; credentials: Record<string, string> }) =>
        settings.addAccount(provider, credentials)
    );
}

/**
 * Remove provider account mutation
 */
export function useRemoveAccount() {
    return useMutation((id: string) => settings.removeAccount(id));
}

// =============================================================================
// Chat Completion Hooks
// =============================================================================

/**
 * Chat completion mutation (non-streaming)
 */
export function useChatCompletion() {
    return useMutation((request: ChatCompletionRequest) => chat.complete(request));
}

/**
 * Streaming chat completion hook
 * Returns a function to start streaming and state for the current stream
 */
export function useChatStream() {
    const [isStreaming, setIsStreaming] = useState(false);
    const [content, setContent] = useState('');
    const [error, setError] = useState<Error | null>(null);
    const abortRef = useRef(false);

    const startStream = useCallback(async (
        request: ChatCompletionRequest,
        onChunk?: (chunk: StreamChunk) => void,
        onComplete?: (content: string) => void
    ) => {
        setIsStreaming(true);
        setContent('');
        setError(null);
        abortRef.current = false;

        let fullContent = '';
        try {
            for await (const chunk of chat.stream(request)) {
                if (abortRef.current) break;
                fullContent += chunk.delta;
                setContent(fullContent);
                onChunk?.(chunk);

                if (chunk.finishReason) {
                    break;
                }
            }
            onComplete?.(fullContent);
        } catch (err) {
            setError(err as Error);
        } finally {
            setIsStreaming(false);
        }

        return fullContent;
    }, []);

    const abort = useCallback(() => {
        abortRef.current = true;
    }, []);

    const reset = useCallback(() => {
        setContent('');
        setError(null);
        setIsStreaming(false);
    }, []);

    return {
        startStream,
        abort,
        reset,
        isStreaming,
        content,
        error,
    };
}

// =============================================================================
// System Hooks
// =============================================================================

/**
 * System health check
 */
export function useSystemHealth(options?: UseQueryOptions): UseQueryResult<{ status: string; version: string; uptime: number }> {
    const queryFn = useCallback(() => system.health(), []);
    return useQuery(queryFn, [], { ...options, refetchInterval: options?.refetchInterval ?? 10000 });
}

/**
 * System info
 */
export function useSystemInfo(options?: UseQueryOptions): UseQueryResult<{
    version: string;
    platform: string;
    databaseSize: number;
    sessionCount: number;
    providerCount: number;
}> {
    const queryFn = useCallback(() => system.info(), []);
    return useQuery(queryFn, [], options);
}

// =============================================================================
// Transfer Hooks
// =============================================================================

/**
 * Harvest sessions mutation
 */
export function useHarvest() {
    return useMutation((providers?: string[]) => transfer.harvest(providers));
}

export function useWebSocket(onEvent?: (event: WebSocketEvent) => void) {
    const [connected, setConnected] = useState(false);
    const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);
    const handlerRef = useRef(onEvent);

    useEffect(() => {
        handlerRef.current = onEvent;
    });

    useEffect(() => {
        const handler = (event: WebSocketEvent) => {
            if (event.type === 'connected') {
                setConnected(true);
            } else if (event.type === 'disconnected') {
                setConnected(false);
            }
            setLastEvent(event);
            handlerRef.current?.(event);
        };

        const cleanup = connectWebSocket(handler);
        return cleanup;
    }, []);

    return { connected, lastEvent };
}

// =============================================================================
// Combined/Utility Hooks
// =============================================================================

/**
 * Get session count for a workspace
 */
export function useWorkspaceSessionCount(workspaceId: string | null): number {
    const { data } = useSessions(workspaceId ? { workspaceId } : undefined, { enabled: !!workspaceId });
    return data?.total ?? 0;
}

/**
 * Get active providers (connected status)
 */
export function useActiveProviders(): { providers: Provider[]; count: number } {
    const { data: providerList } = useProviders();
    const { data: healthList } = useProviderHealth();

    const activeProviders = useMemo(() => {
        if (!providerList || !healthList) return [];
        const healthMap = new Map(healthList.map((h) => [h.providerId, h.status]));
        return providerList.filter((p) => healthMap.get(p.id) === 'connected');
    }, [providerList, healthList]);

    return { providers: activeProviders, count: activeProviders.length };
}

/**
 * Dashboard data hook - combines multiple queries for the overview page
 */
export function useDashboardData() {
    const statistics = useStatistics();
    const recentSessions = useSessions({ sortBy: 'updatedAt', sortOrder: 'desc', limit: 5 });
    const providerHealth = useProviderHealth();
    const systemHealth = useSystemHealth();

    return {
        statistics,
        recentSessions,
        providerHealth,
        systemHealth,
        isLoading: statistics.isLoading || recentSessions.isLoading,
        refetchAll: async () => {
            await Promise.all([
                statistics.refetch(),
                recentSessions.refetch(),
                providerHealth.refetch(),
                systemHealth.refetch(),
            ]);
        },
    };
}
