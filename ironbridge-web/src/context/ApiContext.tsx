// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// API Context Provider - Global state management for API data
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { configure, connectWebSocket } from '../api/client';
import { config } from '../config/env';
import type {
    Workspace,
    Session,
    Provider,
    ProviderHealth,
    Statistics,
    AppSettings,
    WebSocketEvent,
    Agent,
    Swarm,
    ProviderAccount,
} from '../api/types';
import {
    useWorkspaces,
    useSessions,
    useProviders,
    useProviderHealth,
    useStatistics,
    useSettings,
    useSystemHealth,
    useAgents,
    useSwarms,
    useAccounts,
} from '../hooks/useApi';
import {
    mockWorkspaces,
    mockSessions,
    mockProviders,
    mockProviderHealth,
    mockStatistics,
    mockAgents,
    mockSwarms,
    mockAccounts,
    mockSystemStatus,
} from '../data/mockData';

// =============================================================================
// Context Types
// =============================================================================

interface ApiContextValue {
    // Connection state
    isConnected: boolean;
    isLoading: boolean;
    error: Error | null;

    // Data
    workspaces: Workspace[];
    sessions: Session[];
    providers: Provider[];
    providerHealth: ProviderHealth[];
    agents: Agent[];
    swarms: Swarm[];
    accounts: ProviderAccount[];
    statistics: Statistics | null;
    settings: AppSettings | null;

    // System
    systemStatus: {
        status: string;
        version: string;
        uptime: number;
    } | null;

    // Actions
    refetchWorkspaces: () => Promise<void>;
    refetchSessions: () => Promise<void>;
    refetchProviders: () => Promise<void>;
    refetchAgents: () => Promise<void>;
    refetchSwarms: () => Promise<void>;
    refetchAccounts: () => Promise<void>;
    refetchStatistics: () => Promise<void>;
    refetchAll: () => Promise<void>;

    // Selection state
    selectedWorkspaceId: string | null;
    setSelectedWorkspaceId: (id: string | null) => void;
    selectedSessionId: string | null;
    setSelectedSessionId: (id: string | null) => void;

    // WebSocket events
    lastEvent: WebSocketEvent | null;
}

const defaultContext: ApiContextValue = {
    isConnected: false,
    isLoading: true,
    error: null,
    workspaces: [],
    sessions: [],
    providers: [],
    providerHealth: [],
    agents: [],
    swarms: [],
    accounts: [],
    statistics: null,
    settings: null,
    systemStatus: null,
    refetchWorkspaces: async () => { },
    refetchSessions: async () => { },
    refetchProviders: async () => { },
    refetchAgents: async () => { },
    refetchSwarms: async () => { },
    refetchAccounts: async () => { },
    refetchStatistics: async () => { },
    refetchAll: async () => { },
    selectedWorkspaceId: null,
    setSelectedWorkspaceId: () => { },
    selectedSessionId: null,
    setSelectedSessionId: () => { },
    lastEvent: null,
};

const ApiContext = createContext<ApiContextValue>(defaultContext);

// =============================================================================
// Provider Props
// =============================================================================

interface ApiProviderProps {
    children: React.ReactNode;
    baseUrl?: string;
    autoConnect?: boolean;
}

// =============================================================================
// Provider Component
// =============================================================================

export function ApiProvider({ children, baseUrl, autoConnect = true }: ApiProviderProps) {
    // WebSocket state
    const [wsConnected, setWsConnected] = useState(false);
    const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);

    // Selection state
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

    // Configure API client
    useEffect(() => {
        if (baseUrl) {
            configure({ baseUrl });
        }
    }, [baseUrl]);

    // Connect WebSocket
    useEffect(() => {
        if (!autoConnect) return;

        const handleEvent = (event: WebSocketEvent) => {
            if (event.type === 'connected') {
                setWsConnected(true);
            } else if (event.type === 'disconnected') {
                setWsConnected(false);
            }
            setLastEvent(event);
        };

        const cleanup = connectWebSocket(handleEvent);
        return cleanup;
    }, [autoConnect]);

    // Fetch data using hooks
    const {
        data: workspacesData,
        isLoading: workspacesLoading,
        error: workspacesError,
        refetch: refetchWorkspaces,
    } = useWorkspaces(undefined, { refetchOnWindowFocus: true });

    const {
        data: sessionsData,
        isLoading: sessionsLoading,
        error: sessionsError,
        refetch: refetchSessions,
    } = useSessions(
        selectedWorkspaceId ? { workspaceId: selectedWorkspaceId } : undefined,
        { refetchOnWindowFocus: true }
    );

    const {
        data: providersData,
        isLoading: providersLoading,
        error: providersError,
        refetch: refetchProviders,
    } = useProviders({ refetchOnWindowFocus: true });

    const {
        data: providerHealthData,
        refetch: refetchHealth,
    } = useProviderHealth({ refetchInterval: 30000 });

    const {
        data: statisticsData,
        isLoading: statsLoading,
        error: statsError,
        refetch: refetchStatistics,
    } = useStatistics({ refetchInterval: 60000 });

    const { data: settingsData } = useSettings();

    const { data: systemStatusData } = useSystemHealth({
        refetchInterval: 10000,
    });

    // Agents and Swarms
    const {
        data: agentsData,
        isLoading: agentsLoading,
        error: agentsError,
        refetch: refetchAgents,
    } = useAgents({ refetchOnWindowFocus: true });

    const {
        data: swarmsData,
        isLoading: swarmsLoading,
        error: swarmsError,
        refetch: refetchSwarms,
    } = useSwarms({ refetchOnWindowFocus: true });

    // Accounts
    const {
        data: accountsData,
        isLoading: accountsLoading,
        error: accountsError,
        refetch: refetchAccounts,
    } = useAccounts({ refetchOnWindowFocus: true });

    // Combined loading state
    const isLoading = workspacesLoading || sessionsLoading || providersLoading || statsLoading || agentsLoading || swarmsLoading || accountsLoading;

    // Combined error
    const error = workspacesError || sessionsError || providersError || statsError || agentsError || swarmsError || accountsError || null;

    // Refetch all data
    const refetchAll = useCallback(async () => {
        await Promise.all([
            refetchWorkspaces(),
            refetchSessions(),
            refetchProviders(),
            refetchHealth(),
            refetchStatistics(),
            refetchAgents(),
            refetchSwarms(),
            refetchAccounts(),
        ]);
    }, [refetchWorkspaces, refetchSessions, refetchProviders, refetchHealth, refetchStatistics, refetchAgents, refetchSwarms, refetchAccounts]);

    // Handle WebSocket events that require refetching
    useEffect(() => {
        if (!lastEvent) return;

        switch (lastEvent.type) {
            case 'session_created':
            case 'session_updated':
            case 'session_deleted':
                refetchSessions();
                refetchStatistics();
                break;
            case 'provider_status':
                refetchHealth();
                break;
        }
    }, [lastEvent, refetchSessions, refetchStatistics, refetchHealth]);

    // Mock data is a demo-mode affordance ONLY, opted into with
    // VITE_ENABLE_DEMO_MODE. It must never stand in for a real backend:
    // an empty list means the backend is empty, and an error means an error.
    //
    // This previously also triggered on any error and on an empty workspace
    // list, so a reachable-but-empty (or failing) API rendered a fully
    // populated dashboard of fixtures, while `error` was forced to null and
    // hid the failure from the error states the pages already implement.
    const demoMode = config.enableDemoMode;

    const value = useMemo<ApiContextValue>(
        () => ({
            isConnected: demoMode ? true : wsConnected,
            isLoading: demoMode ? false : isLoading,
            error: demoMode ? null : error,
            workspaces: demoMode ? mockWorkspaces : (workspacesData?.items ?? []),
            sessions: demoMode ? mockSessions : (sessionsData?.items ?? []),
            providers: demoMode ? mockProviders : (providersData ?? []),
            providerHealth: demoMode ? mockProviderHealth : (providerHealthData ?? []),
            agents: demoMode ? mockAgents : (agentsData ?? []),
            swarms: demoMode ? mockSwarms : (swarmsData ?? []),
            accounts: demoMode ? mockAccounts : (accountsData ?? []),
            statistics: demoMode ? mockStatistics : (statisticsData ?? null),
            settings: settingsData ?? null,
            systemStatus: demoMode ? mockSystemStatus : (systemStatusData ?? null),
            refetchWorkspaces,
            refetchSessions,
            refetchProviders,
            refetchAgents,
            refetchSwarms,
            refetchAccounts,
            refetchStatistics,
            refetchAll,
            selectedWorkspaceId,
            setSelectedWorkspaceId,
            selectedSessionId,
            setSelectedSessionId,
            lastEvent,
        }),
        [
            wsConnected,
            isLoading,
            error,
            demoMode,
            workspacesData,
            sessionsData,
            providersData,
            providerHealthData,
            agentsData,
            swarmsData,
            accountsData,
            statisticsData,
            settingsData,
            systemStatusData,
            refetchWorkspaces,
            refetchSessions,
            refetchProviders,
            refetchAgents,
            refetchSwarms,
            refetchAccounts,
            refetchStatistics,
            refetchAll,
            selectedWorkspaceId,
            selectedSessionId,
            lastEvent,
        ]
    );

    return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

// =============================================================================
// Hooks - co-located with context for convenience
// =============================================================================
/* eslint-disable react-refresh/only-export-components */

/**
 * Use the API context
 */
export function useApi(): ApiContextValue {
    const context = useContext(ApiContext);
    if (!context) {
        throw new Error('useApi must be used within an ApiProvider');
    }
    return context;
}

/**
 * Use workspaces from context
 */
export function useContextWorkspaces() {
    const { workspaces, isLoading, error, refetchWorkspaces } = useApi();
    return { workspaces, isLoading, error, refetch: refetchWorkspaces };
}

/**
 * Use sessions from context
 */
export function useContextSessions() {
    const { sessions, isLoading, error, refetchSessions } = useApi();
    return { sessions, isLoading, error, refetch: refetchSessions };
}

/**
 * Use providers from context
 */
export function useContextProviders() {
    const { providers, providerHealth, isLoading, error, refetchProviders } = useApi();
    return { providers, providerHealth, isLoading, error, refetch: refetchProviders };
}

/**
 * Use statistics from context
 */
export function useContextStatistics() {
    const { statistics, isLoading, error, refetchStatistics } = useApi();
    return { statistics, isLoading, error, refetch: refetchStatistics };
}

/**
 * Use agents from context
 */
export function useContextAgents() {
    const { agents, isLoading, error, refetchAgents } = useApi();
    return { agents, isLoading, error, refetch: refetchAgents };
}

/**
 * Use swarms from context
 */
export function useContextSwarms() {
    const { swarms, isLoading, error, refetchSwarms } = useApi();
    return { swarms, isLoading, error, refetch: refetchSwarms };
}

/**
 * Use accounts from context
 */
export function useContextAccounts() {
    const { accounts, isLoading, error, refetchAccounts } = useApi();
    return { accounts, isLoading, error, refetch: refetchAccounts };
}

/**
 * Use connection status
 */
export function useConnectionStatus() {
    const { isConnected, systemStatus, error } = useApi();
    return { isConnected, systemStatus, error };
}

/**
 * Use selection state
 */
export function useSelection() {
    const {
        selectedWorkspaceId,
        setSelectedWorkspaceId,
        selectedSessionId,
        setSelectedSessionId,
    } = useApi();
    return {
        selectedWorkspaceId,
        setSelectedWorkspaceId,
        selectedSessionId,
        setSelectedSessionId,
    };
}

export default ApiContext;
