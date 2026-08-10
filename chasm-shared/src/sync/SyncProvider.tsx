// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

// =============================================================================
// CSM Sync Provider Component
// =============================================================================
// React context provider for real-time data synchronization

import React, { createContext, useContext, useEffect, useMemo, ReactNode } from 'react';
import {
    SyncService,
    SyncConfig,
    SyncState,
    SyncEvent,
    SyncEntityType,
    createSyncService,
    generateClientId,
} from './index';

// =============================================================================
// Context Types
// =============================================================================

export interface SyncContextValue {
    sync: SyncService;
    isConnected: boolean;
    isSyncing: boolean;
    version: number;
    pendingCount: number;
    conflictCount: number;
}

const SyncContext = createContext<SyncContextValue | null>(null);

// =============================================================================
// Provider Props
// =============================================================================

export interface SyncProviderProps {
    children: ReactNode;
    baseUrl?: string;
    clientId?: string;
    autoConnect?: boolean;
    conflictResolution?: 'local' | 'server' | 'manual';
    onConnect?: () => void;
    onDisconnect?: () => void;
    onSyncError?: (error: Error) => void;
}

// =============================================================================
// Provider Component
// =============================================================================

export function SyncProvider({
    children,
    baseUrl = 'http://localhost:8787',
    clientId,
    autoConnect = true,
    conflictResolution = 'server',
    onConnect,
    onDisconnect,
    onSyncError,
}: SyncProviderProps) {
    const [state, setState] = React.useState<{
        isConnected: boolean;
        isSyncing: boolean;
        version: number;
        pendingCount: number;
        conflictCount: number;
    }>({
        isConnected: false,
        isSyncing: false,
        version: 0,
        pendingCount: 0,
        conflictCount: 0,
    });

    // Memoize client ID to prevent reconnections
    const stableClientId = useMemo(
        () => clientId || generateClientId(),
        [clientId]
    );

    // Create sync service
    const sync = useMemo(() => {
        const config: SyncConfig = {
            baseUrl,
            clientId: stableClientId,
            conflictResolution,
            onConnect: () => {
                setState(prev => ({ ...prev, isConnected: true }));
                onConnect?.();
            },
            onDisconnect: () => {
                setState(prev => ({ ...prev, isConnected: false }));
                onDisconnect?.();
            },
            onSyncStart: () => {
                setState(prev => ({ ...prev, isSyncing: true }));
            },
            onSyncComplete: () => {
                setState(prev => ({ ...prev, isSyncing: false }));
            },
            onSyncError: (error) => {
                setState(prev => ({ ...prev, isSyncing: false }));
                onSyncError?.(error);
            },
            onConflict: () => {
                setState(prev => ({
                    ...prev,
                    conflictCount: prev.conflictCount + 1,
                }));
            },
        };

        return createSyncService(config);
    }, [baseUrl, stableClientId, conflictResolution, onConnect, onDisconnect, onSyncError]);

    // Auto-connect on mount
    useEffect(() => {
        if (autoConnect) {
            sync.connect();
        }

        return () => {
            sync.disconnect();
        };
    }, [sync, autoConnect]);

    // Update state periodically
    useEffect(() => {
        const updateState = () => {
            const syncState = sync.getState();
            setState(prev => ({
                ...prev,
                version: syncState.version,
                pendingCount: syncState.pendingChanges.length,
                conflictCount: syncState.conflicts.length,
            }));
        };

        const interval = setInterval(updateState, 1000);
        return () => clearInterval(interval);
    }, [sync]);

    const value = useMemo(
        () => ({
            sync,
            ...state,
        }),
        [sync, state]
    );

    return (
        <SyncContext.Provider value={value}>
            {children}
        </SyncContext.Provider>
    );
}

// =============================================================================
// Hook
// =============================================================================

export function useSyncContext(): SyncContextValue {
    const context = useContext(SyncContext);
    if (!context) {
        throw new Error('useSyncContext must be used within a SyncProvider');
    }
    return context;
}

// =============================================================================
// Higher-Order Component
// =============================================================================

export function withSync<P extends object>(
    WrappedComponent: React.ComponentType<P & { sync: SyncContextValue }>
): React.FC<Omit<P, 'sync'>> {
    return function WithSyncComponent(props: Omit<P, 'sync'>) {
        const sync = useSyncContext();
        return <WrappedComponent {...(props as P)} sync={sync} />;
    };
}
