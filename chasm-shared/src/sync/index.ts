// =============================================================================
// CSM Sync Service
// =============================================================================
// Real-time data synchronization between csm-rust, csm-web, and csm-app
// Provides a single source of truth via the backend
//
// Uses Server-Sent Events (SSE) for receiving real-time updates and
// REST API for sending data changes.

import type {
    Workspace,
    Session,
    Agent,
    Swarm,
    Provider,
} from '../types';

// =============================================================================
// Sync Types
// =============================================================================

export type SyncEntityType =
    | 'workspace'
    | 'session'
    | 'message'
    | 'agent'
    | 'swarm'
    | 'provider'
    | 'settings';

export type SyncOperation = 'create' | 'update' | 'delete' | 'sync';

export interface SyncEvent<T = unknown> {
    id: string;
    type: SyncEntityType;
    operation: SyncOperation;
    entityId: string;
    data?: T;
    timestamp: number;
    clientId: string;
    version: number;
}

export interface SyncState {
    lastSyncTime: number;
    version: number;
    pendingChanges: SyncEvent[];
    conflicts: SyncConflict[];
    isOnline: boolean;
    isSyncing: boolean;
}

export interface SyncConflict {
    id: string;
    entityType: SyncEntityType;
    entityId: string;
    localVersion: unknown;
    serverVersion: unknown;
    timestamp: number;
    resolved: boolean;
    resolution?: 'local' | 'server' | 'merge';
}

export interface SyncSnapshot {
    workspaces: Workspace[];
    sessions: Session[];
    agents: Agent[];
    swarms: Swarm[];
    providers: Provider[];
    timestamp: number;
    version: number;
}

export interface SyncDelta {
    created: SyncEvent[];
    updated: SyncEvent[];
    deleted: SyncEvent[];
    timestamp: number;
    fromVersion: number;
    toVersion: number;
}

export interface SyncConfig {
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

// Server message types from SSE
interface ServerWelcome {
    type: 'welcome';
    version: number;
}

interface ServerSyncEvent {
    type: 'sync_event';
    event: SyncEvent;
}

interface ServerAck {
    type: 'ack';
    version: number;
}

type ServerMessage = ServerWelcome | ServerSyncEvent | ServerAck;

// =============================================================================
// Sync Service Class
// =============================================================================

type EventHandler<T> = (event: SyncEvent<T>) => void;

export class SyncService {
    private config: Required<SyncConfig>;
    private eventSource: EventSource | null = null;
    private state: SyncState;
    private eventHandlers: Map<string, Set<EventHandler<unknown>>> = new Map();
    private reconnectAttempts = 0;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private isSyncInProgress = false;

    constructor(config: SyncConfig) {
        this.config = {
            reconnectInterval: 5000,
            maxRetries: 10,
            batchSize: 50,
            conflictResolution: 'server',
            enableOfflineSupport: true,
            onConnect: () => { },
            onDisconnect: () => { },
            onSyncStart: () => { },
            onSyncComplete: () => { },
            onSyncError: () => { },
            onConflict: () => { },
            ...config,
        };

        this.state = {
            lastSyncTime: 0,
            version: 0,
            pendingChanges: [],
            conflicts: [],
            isOnline: false,
            isSyncing: false,
        };

        // Load cached state if offline support is enabled
        if (this.config.enableOfflineSupport) {
            this.loadCachedState();
        }
    }

    // =========================================================================
    // Connection Management (SSE)
    // =========================================================================

    connect(): void {
        if (this.eventSource?.readyState === EventSource.OPEN) {
            return;
        }

        const sseUrl = `${this.config.baseUrl}/sync/subscribe`;

        try {
            this.eventSource = new EventSource(sseUrl);

            this.eventSource.onopen = () => {
                this.state.isOnline = true;
                this.reconnectAttempts = 0;
                this.config.onConnect();

                // Sync pending changes via REST API
                this.syncPendingChanges();
            };

            this.eventSource.onmessage = (event) => {
                try {
                    const message: ServerMessage = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (err) {
                    console.error('Failed to parse SSE message:', err);
                }
            };

            this.eventSource.onerror = () => {
                this.state.isOnline = false;
                this.config.onDisconnect();
                this.eventSource?.close();
                this.eventSource = null;
                this.scheduleReconnect();
            };
        } catch (err) {
            console.error('Failed to connect:', err);
            this.scheduleReconnect();
        }
    }

    disconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }

        this.state.isOnline = false;
    }

    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.config.maxRetries) {
            console.error('Max reconnect attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);

        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, Math.min(delay, 30000));
    }

    // =========================================================================
    // REST API Methods
    // =========================================================================

    private async apiRequest<T>(
        endpoint: string,
        method: 'GET' | 'POST' = 'GET',
        body?: unknown
    ): Promise<T> {
        const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'API request failed');
        }

        return result.data;
    }

    // =========================================================================
    // Message Handling (SSE)
    // =========================================================================

    private handleMessage(message: ServerMessage): void {
        switch (message.type) {
            case 'welcome':
                // Server sends current version on connect
                if (message.version > this.state.version) {
                    // We're behind, request a delta
                    this.requestSync();
                }
                break;

            case 'sync_event':
                if (message.event) {
                    this.handleSyncEvent(message.event);
                }
                break;

            case 'ack':
                if (message.version) {
                    this.state.version = message.version;
                    this.saveCachedState();
                }
                break;
        }
    }

    private handleSyncEvent(event: SyncEvent): void {
        // Skip events from this client
        if (event.clientId === this.config.clientId) {
            return;
        }

        // Update version
        if (event.version > this.state.version) {
            this.state.version = event.version;
        }

        // Emit to subscribers
        this.emit(event.type, event);
        this.emit('*', event); // Wildcard for all events
    }

    private handleSnapshot(snapshot: SyncSnapshot): void {
        this.state.version = snapshot.version;
        this.state.lastSyncTime = snapshot.timestamp;

        // Emit snapshot events for each entity type
        snapshot.workspaces.forEach((ws) => {
            this.emit('workspace', {
                id: `snapshot-ws-${ws.id}`,
                type: 'workspace',
                operation: 'sync',
                entityId: ws.id,
                data: ws,
                timestamp: snapshot.timestamp,
                clientId: 'server',
                version: snapshot.version,
            });
        });

        snapshot.sessions.forEach((session) => {
            this.emit('session', {
                id: `snapshot-session-${session.id}`,
                type: 'session',
                operation: 'sync',
                entityId: session.id,
                data: session,
                timestamp: snapshot.timestamp,
                clientId: 'server',
                version: snapshot.version,
            });
        });

        snapshot.agents.forEach((agent) => {
            this.emit('agent', {
                id: `snapshot-agent-${agent.id}`,
                type: 'agent',
                operation: 'sync',
                entityId: agent.id,
                data: agent,
                timestamp: snapshot.timestamp,
                clientId: 'server',
                version: snapshot.version,
            });
        });

        this.saveCachedState();
        this.config.onSyncComplete({
            created: [],
            updated: [],
            deleted: [],
            timestamp: snapshot.timestamp,
            fromVersion: 0,
            toVersion: snapshot.version,
        });
    }

    private handleDelta(delta: SyncDelta): void {
        this.state.version = delta.toVersion;
        this.state.lastSyncTime = delta.timestamp;

        // Process all changes
        [...delta.created, ...delta.updated, ...delta.deleted].forEach((event) => {
            this.emit(event.type, event);
        });

        this.saveCachedState();
        this.config.onSyncComplete(delta);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private _handleConflict(conflict: SyncConflict): void {
        // Auto-resolve based on config
        if (this.config.conflictResolution !== 'manual') {
            conflict.resolution = this.config.conflictResolution;
            conflict.resolved = true;
            // Conflicts are resolved via REST API now
        } else {
            this.state.conflicts.push(conflict);
            this.config.onConflict(conflict);
        }
    }

    // =========================================================================
    // Event Subscription
    // =========================================================================

    subscribe<T>(entityType: SyncEntityType | '*', handler: EventHandler<T>): () => void {
        if (!this.eventHandlers.has(entityType)) {
            this.eventHandlers.set(entityType, new Set());
        }

        this.eventHandlers.get(entityType)!.add(handler as EventHandler<unknown>);

        return () => {
            this.eventHandlers.get(entityType)?.delete(handler as EventHandler<unknown>);
        };
    }

    private emit<T>(entityType: string, event: SyncEvent<T>): void {
        this.eventHandlers.get(entityType)?.forEach((handler) => {
            try {
                handler(event as SyncEvent<unknown>);
            } catch (err) {
                console.error('Error in sync event handler:', err);
            }
        });
    }

    // =========================================================================
    // Data Operations (via REST API)
    // =========================================================================

    async push<T>(
        entityType: SyncEntityType,
        operation: SyncOperation,
        entityId: string,
        data?: T
    ): Promise<void> {
        const event: SyncEvent<T> = {
            id: `${this.config.clientId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: entityType,
            operation,
            entityId,
            data,
            timestamp: Date.now(),
            clientId: this.config.clientId,
            version: this.state.version + 1,
        };

        if (this.state.isOnline) {
            try {
                const result = await this.apiRequest<{ version: number }>(
                    '/sync/event',
                    'POST',
                    event
                );
                this.state.version = result.version;
                this.saveCachedState();
            } catch (err) {
                console.error('Failed to push sync event:', err);
                if (this.config.enableOfflineSupport) {
                    this.state.pendingChanges.push(event);
                    this.saveCachedState();
                }
                throw err;
            }
        } else if (this.config.enableOfflineSupport) {
            this.state.pendingChanges.push(event);
            this.saveCachedState();
        }
    }

    private async syncPendingChanges(): Promise<void> {
        if (this.isSyncInProgress || this.state.pendingChanges.length === 0) {
            return;
        }

        this.isSyncInProgress = true;
        this.state.isSyncing = true;
        this.config.onSyncStart();

        try {
            // Send pending changes in batches via REST API
            while (this.state.pendingChanges.length > 0) {
                const batch = this.state.pendingChanges.splice(0, this.config.batchSize);
                const result = await this.apiRequest<{ version: number }>(
                    '/sync/batch',
                    'POST',
                    { events: batch }
                );
                this.state.version = result.version;
            }

            this.saveCachedState();
        } catch (err) {
            console.error('Failed to sync pending changes:', err);
            this.config.onSyncError(err as Error);
        } finally {
            this.isSyncInProgress = false;
            this.state.isSyncing = false;
        }
    }

    async requestSync(): Promise<void> {
        try {
            const delta = await this.apiRequest<SyncDelta>(
                `/sync/delta?from=${this.state.version}`
            );
            this.handleDelta(delta);
        } catch (err) {
            console.error('Failed to request sync delta:', err);
            this.config.onSyncError(err as Error);
        }
    }

    async requestSnapshot(): Promise<SyncSnapshot> {
        try {
            const snapshot = await this.apiRequest<SyncSnapshot>('/sync/snapshot');
            this.handleSnapshot(snapshot);
            return snapshot;
        } catch (err) {
            console.error('Failed to request snapshot:', err);
            this.config.onSyncError(err as Error);
            throw err;
        }
    }

    // =========================================================================
    // Conflict Resolution
    // =========================================================================

    resolveConflict(conflictId: string, resolution: 'local' | 'server' | 'merge'): void {
        const conflict = this.state.conflicts.find((c) => c.id === conflictId);
        if (!conflict) {
            return;
        }

        conflict.resolution = resolution;
        conflict.resolved = true;

        // Remove from conflicts list
        this.state.conflicts = this.state.conflicts.filter((c) => c.id !== conflictId);
    }

    // =========================================================================
    // State Management
    // =========================================================================

    getState(): Readonly<SyncState> {
        return { ...this.state };
    }

    isConnected(): boolean {
        return this.state.isOnline;
    }

    getVersion(): number {
        return this.state.version;
    }

    getPendingChanges(): SyncEvent[] {
        return [...this.state.pendingChanges];
    }

    getConflicts(): SyncConflict[] {
        return [...this.state.conflicts];
    }

    // =========================================================================
    // Cache Management
    // =========================================================================

    private loadCachedState(): void {
        try {
            const cached = localStorage?.getItem(`csm-sync-state-${this.config.clientId}`);
            if (cached) {
                const parsed = JSON.parse(cached);
                this.state.version = parsed.version || 0;
                this.state.lastSyncTime = parsed.lastSyncTime || 0;
                this.state.pendingChanges = parsed.pendingChanges || [];
            }
        } catch (err) {
            // localStorage may not be available (e.g., in React Native)
            console.debug('Could not load cached sync state:', err);
        }
    }

    private saveCachedState(): void {
        try {
            localStorage?.setItem(
                `csm-sync-state-${this.config.clientId}`,
                JSON.stringify({
                    version: this.state.version,
                    lastSyncTime: this.state.lastSyncTime,
                    pendingChanges: this.state.pendingChanges,
                })
            );
        } catch (err) {
            console.debug('Could not save cached sync state:', err);
        }
    }

    clearCache(): void {
        try {
            localStorage?.removeItem(`csm-sync-state-${this.config.clientId}`);
        } catch (err) {
            console.debug('Could not clear cached sync state:', err);
        }

        this.state = {
            lastSyncTime: 0,
            version: 0,
            pendingChanges: [],
            conflicts: [],
            isOnline: this.state.isOnline,
            isSyncing: false,
        };
    }
}

// =============================================================================
// Singleton Factory
// =============================================================================

let defaultSyncService: SyncService | null = null;

export function createSyncService(config: SyncConfig): SyncService {
    return new SyncService(config);
}

export function getDefaultSyncService(): SyncService | null {
    return defaultSyncService;
}

export function initDefaultSyncService(config: SyncConfig): SyncService {
    if (!defaultSyncService) {
        defaultSyncService = new SyncService(config);
    }
    return defaultSyncService;
}

// =============================================================================
// Helper Functions
// =============================================================================

export function generateClientId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    const platform = typeof window !== 'undefined' ? 'web' : 'native';
    return `${platform}-${timestamp}-${random}`;
}
