// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

// =============================================================================
// CSM Sync React Hooks
// =============================================================================
// React hooks for real-time data synchronization

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    SyncService,
    SyncConfig,
    SyncState,
    SyncEvent,
    SyncEntityType,
    SyncConflict,
    SyncDelta,
    createSyncService,
    generateClientId,
} from './index';
import type {
    Workspace,
    Session,
    Message,
    Agent,
    Swarm,
    Provider,
} from '../types';

// =============================================================================
// Context Types
// =============================================================================

export interface SyncContextValue {
    sync: SyncService | null;
    state: SyncState;
    isConnected: boolean;
    isSyncing: boolean;
    connect: () => void;
    disconnect: () => void;
    requestSync: () => Promise<void>;
    resolveConflict: (conflictId: string, resolution: 'local' | 'server' | 'merge') => void;
}

// =============================================================================
// useSync Hook
// =============================================================================

export interface UseSyncOptions {
    baseUrl?: string;
    clientId?: string;
    autoConnect?: boolean;
    conflictResolution?: 'local' | 'server' | 'manual';
}

export function useSync(options: UseSyncOptions = {}): SyncContextValue {
    const {
        baseUrl = 'http://localhost:8787',
        clientId = generateClientId(),
        autoConnect = true,
        conflictResolution = 'server',
    } = options;

    const [state, setState] = useState<SyncState>({
        lastSyncTime: 0,
        version: 0,
        pendingChanges: [],
        conflicts: [],
        isOnline: false,
        isSyncing: false,
    });

    const syncRef = useRef<SyncService | null>(null);

    // Initialize sync service
    useEffect(() => {
        const config: SyncConfig = {
            baseUrl,
            clientId,
            conflictResolution,
            onConnect: () => {
                setState((prev) => ({ ...prev, isOnline: true }));
            },
            onDisconnect: () => {
                setState((prev) => ({ ...prev, isOnline: false }));
            },
            onSyncStart: () => {
                setState((prev) => ({ ...prev, isSyncing: true }));
            },
            onSyncComplete: () => {
                setState((prev) => ({ ...prev, isSyncing: false }));
            },
            onSyncError: (error) => {
                console.error('Sync error:', error);
                setState((prev) => ({ ...prev, isSyncing: false }));
            },
            onConflict: (conflict) => {
                setState((prev) => ({
                    ...prev,
                    conflicts: [...prev.conflicts, conflict],
                }));
            },
        };

        syncRef.current = createSyncService(config);

        if (autoConnect) {
            syncRef.current.connect();
        }

        return () => {
            syncRef.current?.disconnect();
        };
    }, [baseUrl, clientId, autoConnect, conflictResolution]);

    const connect = useCallback(() => {
        syncRef.current?.connect();
    }, []);

    const disconnect = useCallback(() => {
        syncRef.current?.disconnect();
    }, []);

    const requestSync = useCallback(async () => {
        await syncRef.current?.requestSync();
    }, []);

    const resolveConflict = useCallback(
        (conflictId: string, resolution: 'local' | 'server' | 'merge') => {
            syncRef.current?.resolveConflict(conflictId, resolution);
            setState((prev) => ({
                ...prev,
                conflicts: prev.conflicts.filter((c) => c.id !== conflictId),
            }));
        },
        []
    );

    return {
        sync: syncRef.current,
        state,
        isConnected: state.isOnline,
        isSyncing: state.isSyncing,
        connect,
        disconnect,
        requestSync,
        resolveConflict,
    };
}

// =============================================================================
// useSyncSubscription Hook
// =============================================================================

export function useSyncSubscription<T>(
    sync: SyncService | null,
    entityType: SyncEntityType | '*',
    callback: (event: SyncEvent<T>) => void
): void {
    useEffect(() => {
        if (!sync) return;

        const unsubscribe = sync.subscribe<T>(entityType, callback);
        return unsubscribe;
    }, [sync, entityType, callback]);
}

// =============================================================================
// useSyncedState Hook
// =============================================================================

export interface UseSyncedStateOptions<T> {
    entityType: SyncEntityType;
    initialData: T[];
    idField?: keyof T;
}

export function useSyncedState<T extends { id: string }>(
    sync: SyncService | null,
    options: UseSyncedStateOptions<T>
): {
    data: T[];
    setData: React.Dispatch<React.SetStateAction<T[]>>;
    create: (item: T) => void;
    update: (id: string, updates: Partial<T>) => void;
    remove: (id: string) => void;
} {
    const { entityType, initialData, idField = 'id' as keyof T } = options;
    const [data, setData] = useState<T[]>(initialData);

    // Subscribe to sync events
    const handleEvent = useCallback(
        (event: SyncEvent<T>) => {
            setData((prev) => {
                const id = event.entityId;

                switch (event.operation) {
                    case 'create':
                        if (event.data && !prev.find((item) => String(item[idField]) === id)) {
                            return [...prev, event.data];
                        }
                        return prev;

                    case 'update':
                        return prev.map((item) =>
                            String(item[idField]) === id ? { ...item, ...event.data } : item
                        );

                    case 'delete':
                        return prev.filter((item) => String(item[idField]) !== id);

                    case 'sync':
                        if (event.data) {
                            const existing = prev.find((item) => String(item[idField]) === id);
                            if (existing) {
                                return prev.map((item) =>
                                    String(item[idField]) === id ? { ...item, ...event.data } : item
                                );
                            }
                            return [...prev, event.data];
                        }
                        return prev;

                    default:
                        return prev;
                }
            });
        },
        [idField]
    );

    useSyncSubscription(sync, entityType, handleEvent);

    // CRUD operations with sync
    const create = useCallback(
        (item: T) => {
            const id = String(item[idField]);
            setData((prev) => [...prev, item]);
            sync?.push(entityType, 'create', id, item);
        },
        [sync, entityType, idField]
    );

    const update = useCallback(
        (id: string, updates: Partial<T>) => {
            setData((prev) =>
                prev.map((item) => (String(item[idField]) === id ? { ...item, ...updates } : item))
            );
            sync?.push(entityType, 'update', id, updates);
        },
        [sync, entityType, idField]
    );

    const remove = useCallback(
        (id: string) => {
            setData((prev) => prev.filter((item) => String(item[idField]) !== id));
            sync?.push(entityType, 'delete', id);
        },
        [sync, entityType, idField]
    );

    return { data, setData, create, update, remove };
}

// =============================================================================
// Entity-Specific Hooks
// =============================================================================

export function useSyncedWorkspaces(sync: SyncService | null, initialData: Workspace[] = []) {
    return useSyncedState<Workspace>(sync, {
        entityType: 'workspace',
        initialData,
    });
}

export function useSyncedSessions(sync: SyncService | null, initialData: Session[] = []) {
    return useSyncedState<Session>(sync, {
        entityType: 'session',
        initialData,
    });
}

export function useSyncedAgents(sync: SyncService | null, initialData: Agent[] = []) {
    return useSyncedState<Agent>(sync, {
        entityType: 'agent',
        initialData,
    });
}

export function useSyncedSwarms(sync: SyncService | null, initialData: Swarm[] = []) {
    return useSyncedState<Swarm>(sync, {
        entityType: 'swarm',
        initialData,
    });
}

export function useSyncedProviders(sync: SyncService | null, initialData: Provider[] = []) {
    return useSyncedState<Provider>(sync, {
        entityType: 'provider',
        initialData,
    });
}

// =============================================================================
// Sync Status Hook
// =============================================================================

export interface SyncStatus {
    isOnline: boolean;
    isSyncing: boolean;
    lastSyncTime: Date | null;
    pendingCount: number;
    conflictCount: number;
    version: number;
}

export function useSyncStatus(sync: SyncService | null): SyncStatus {
    const [status, setStatus] = useState<SyncStatus>({
        isOnline: false,
        isSyncing: false,
        lastSyncTime: null,
        pendingCount: 0,
        conflictCount: 0,
        version: 0,
    });

    useEffect(() => {
        if (!sync) return;

        const updateStatus = () => {
            const state = sync.getState();
            setStatus({
                isOnline: state.isOnline,
                isSyncing: state.isSyncing,
                lastSyncTime: state.lastSyncTime ? new Date(state.lastSyncTime) : null,
                pendingCount: state.pendingChanges.length,
                conflictCount: state.conflicts.length,
                version: state.version,
            });
        };

        // Subscribe to all events to update status
        const unsubscribe = sync.subscribe('*', updateStatus);

        // Initial status
        updateStatus();

        // Poll for connection status changes
        const interval = setInterval(updateStatus, 1000);

        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, [sync]);

    return status;
}

// =============================================================================
// Conflict Resolution Hook
// =============================================================================

export function useSyncConflicts(sync: SyncService | null) {
    const [conflicts, setConflicts] = useState<SyncConflict[]>([]);

    useEffect(() => {
        if (!sync) return;

        const updateConflicts = () => {
            setConflicts(sync.getConflicts());
        };

        // Subscribe to all events to catch conflict updates
        const unsubscribe = sync.subscribe('*', updateConflicts);
        updateConflicts();

        return unsubscribe;
    }, [sync]);

    const resolve = useCallback(
        (conflictId: string, resolution: 'local' | 'server' | 'merge') => {
            sync?.resolveConflict(conflictId, resolution);
            setConflicts((prev) => prev.filter((c) => c.id !== conflictId));
        },
        [sync]
    );

    const resolveAll = useCallback(
        (resolution: 'local' | 'server') => {
            conflicts.forEach((conflict) => {
                sync?.resolveConflict(conflict.id, resolution);
            });
            setConflicts([]);
        },
        [sync, conflicts]
    );

    return { conflicts, resolve, resolveAll };
}
