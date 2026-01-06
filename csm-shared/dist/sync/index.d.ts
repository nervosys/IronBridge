import { Workspace, Session, Agent, Swarm, Provider } from '../types/index.js';

type SyncEntityType = 'workspace' | 'session' | 'message' | 'agent' | 'swarm' | 'provider' | 'settings';
type SyncOperation = 'create' | 'update' | 'delete' | 'sync';
interface SyncEvent<T = unknown> {
    id: string;
    type: SyncEntityType;
    operation: SyncOperation;
    entityId: string;
    data?: T;
    timestamp: number;
    clientId: string;
    version: number;
}
interface SyncState {
    lastSyncTime: number;
    version: number;
    pendingChanges: SyncEvent[];
    conflicts: SyncConflict[];
    isOnline: boolean;
    isSyncing: boolean;
}
interface SyncConflict {
    id: string;
    entityType: SyncEntityType;
    entityId: string;
    localVersion: unknown;
    serverVersion: unknown;
    timestamp: number;
    resolved: boolean;
    resolution?: 'local' | 'server' | 'merge';
}
interface SyncSnapshot {
    workspaces: Workspace[];
    sessions: Session[];
    agents: Agent[];
    swarms: Swarm[];
    providers: Provider[];
    timestamp: number;
    version: number;
}
interface SyncDelta {
    created: SyncEvent[];
    updated: SyncEvent[];
    deleted: SyncEvent[];
    timestamp: number;
    fromVersion: number;
    toVersion: number;
}
interface SyncConfig {
    baseUrl: string;
    clientId: string;
    reconnectInterval?: number;
    maxRetries?: number;
    batchSize?: number;
    conflictResolution?: 'local' | 'server' | 'manual';
    enableOfflineSupport?: boolean;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onSyncStart?: () => void;
    onSyncComplete?: (delta: SyncDelta) => void;
    onSyncError?: (error: Error) => void;
    onConflict?: (conflict: SyncConflict) => void;
}
type EventHandler<T> = (event: SyncEvent<T>) => void;
declare class SyncService {
    private config;
    private eventSource;
    private state;
    private eventHandlers;
    private reconnectAttempts;
    private reconnectTimer;
    private isSyncInProgress;
    constructor(config: SyncConfig);
    connect(): void;
    disconnect(): void;
    private scheduleReconnect;
    private apiRequest;
    private handleMessage;
    private handleSyncEvent;
    private handleSnapshot;
    private handleDelta;
    private _handleConflict;
    subscribe<T>(entityType: SyncEntityType | '*', handler: EventHandler<T>): () => void;
    private emit;
    push<T>(entityType: SyncEntityType, operation: SyncOperation, entityId: string, data?: T): Promise<void>;
    private syncPendingChanges;
    requestSync(): Promise<void>;
    requestSnapshot(): Promise<SyncSnapshot>;
    resolveConflict(conflictId: string, resolution: 'local' | 'server' | 'merge'): void;
    getState(): Readonly<SyncState>;
    isConnected(): boolean;
    getVersion(): number;
    getPendingChanges(): SyncEvent[];
    getConflicts(): SyncConflict[];
    private loadCachedState;
    private saveCachedState;
    clearCache(): void;
}
declare function createSyncService(config: SyncConfig): SyncService;
declare function getDefaultSyncService(): SyncService | null;
declare function initDefaultSyncService(config: SyncConfig): SyncService;
declare function generateClientId(): string;

export { type SyncConfig, type SyncConflict, type SyncDelta, type SyncEntityType, type SyncEvent, type SyncOperation, SyncService, type SyncSnapshot, type SyncState, createSyncService, generateClientId, getDefaultSyncService, initDefaultSyncService };
