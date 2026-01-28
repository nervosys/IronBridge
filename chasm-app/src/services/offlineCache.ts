// Offline Cache Service
// Handles local storage of sessions for offline access

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { ChatSession, ChatMessage } from '../api/chat';

const CACHE_KEY_PREFIX = '@chasm_cache_';
const SESSIONS_INDEX_KEY = `${CACHE_KEY_PREFIX}sessions_index`;
const SESSION_KEY_PREFIX = `${CACHE_KEY_PREFIX}session_`;
const CACHE_METADATA_KEY = `${CACHE_KEY_PREFIX}metadata`;
const PENDING_CHANGES_KEY = `${CACHE_KEY_PREFIX}pending_changes`;

export interface CacheMetadata {
    lastUpdated: number;
    totalSessions: number;
    totalSize: number; // estimated bytes
    version: number;
}

export interface PendingChange {
    id: string;
    type: 'create' | 'update' | 'delete';
    sessionId: string;
    timestamp: number;
    data?: any;
}

export interface OfflineStatus {
    isOnline: boolean;
    cachedSessionCount: number;
    pendingChanges: number;
    lastSyncedAt: number | null;
    cacheSize: number;
}

class OfflineCacheService {
    private isOnline: boolean = true;
    private statusListeners: Set<(status: OfflineStatus) => void> = new Set();
    private metadata: CacheMetadata = {
        lastUpdated: 0,
        totalSessions: 0,
        totalSize: 0,
        version: 1,
    };
    private pendingChanges: PendingChange[] = [];

    /**
     * Initialize the offline cache service
     */
    async initialize(): Promise<void> {
        // Load metadata
        await this.loadMetadata();
        await this.loadPendingChanges();

        // Subscribe to network state changes
        NetInfo.addEventListener(this.handleNetworkChange);

        // Get initial network state
        const state = await NetInfo.fetch();
        this.isOnline = state.isConnected ?? true;
    }

    /**
     * Handle network state changes
     */
    private handleNetworkChange = (state: NetInfoState): void => {
        const wasOnline = this.isOnline;
        this.isOnline = state.isConnected ?? true;

        if (!wasOnline && this.isOnline) {
            // Back online - trigger sync
            this.notifyListeners();
        } else if (wasOnline && !this.isOnline) {
            // Went offline
            this.notifyListeners();
        }
    };

    /**
     * Get current offline status
     */
    async getStatus(): Promise<OfflineStatus> {
        return {
            isOnline: this.isOnline,
            cachedSessionCount: this.metadata.totalSessions,
            pendingChanges: this.pendingChanges.length,
            lastSyncedAt: this.metadata.lastUpdated,
            cacheSize: this.metadata.totalSize,
        };
    }

    /**
     * Add status listener
     */
    addStatusListener(listener: (status: OfflineStatus) => void): () => void {
        this.statusListeners.add(listener);
        return () => this.statusListeners.delete(listener);
    }

    /**
     * Notify all status listeners
     */
    private async notifyListeners(): Promise<void> {
        const status = await this.getStatus();
        this.statusListeners.forEach((listener) => listener(status));
    }

    /**
     * Load cache metadata
     */
    private async loadMetadata(): Promise<void> {
        try {
            const saved = await AsyncStorage.getItem(CACHE_METADATA_KEY);
            if (saved) {
                this.metadata = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Failed to load cache metadata:', error);
        }
    }

    /**
     * Save cache metadata
     */
    private async saveMetadata(): Promise<void> {
        try {
            await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(this.metadata));
        } catch (error) {
            console.error('Failed to save cache metadata:', error);
        }
    }

    /**
     * Load pending changes
     */
    private async loadPendingChanges(): Promise<void> {
        try {
            const saved = await AsyncStorage.getItem(PENDING_CHANGES_KEY);
            if (saved) {
                this.pendingChanges = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Failed to load pending changes:', error);
        }
    }

    /**
     * Save pending changes
     */
    private async savePendingChanges(): Promise<void> {
        try {
            await AsyncStorage.setItem(PENDING_CHANGES_KEY, JSON.stringify(this.pendingChanges));
        } catch (error) {
            console.error('Failed to save pending changes:', error);
        }
    }

    /**
     * Cache a session locally
     */
    async cacheSession(session: ChatSession): Promise<void> {
        try {
            const key = `${SESSION_KEY_PREFIX}${session.id}`;
            const data = JSON.stringify(session);

            await AsyncStorage.setItem(key, data);

            // Update index
            const index = await this.getSessionIndex();
            if (!index.includes(session.id)) {
                index.push(session.id);
                await AsyncStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(index));
            }

            // Update metadata
            this.metadata.totalSessions = index.length;
            this.metadata.totalSize += data.length;
            this.metadata.lastUpdated = Date.now();
            await this.saveMetadata();

            await this.notifyListeners();
        } catch (error) {
            console.error('Failed to cache session:', error);
        }
    }

    /**
     * Cache multiple sessions
     */
    async cacheSessions(sessions: ChatSession[]): Promise<void> {
        for (const session of sessions) {
            await this.cacheSession(session);
        }
    }

    /**
     * Get a cached session
     */
    async getCachedSession(sessionId: string): Promise<ChatSession | null> {
        try {
            const key = `${SESSION_KEY_PREFIX}${sessionId}`;
            const data = await AsyncStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Failed to get cached session:', error);
            return null;
        }
    }

    /**
     * Get all cached sessions
     */
    async getAllCachedSessions(): Promise<ChatSession[]> {
        try {
            const index = await this.getSessionIndex();
            const sessions: ChatSession[] = [];

            for (const sessionId of index) {
                const session = await this.getCachedSession(sessionId);
                if (session) {
                    sessions.push(session);
                }
            }

            return sessions;
        } catch (error) {
            console.error('Failed to get all cached sessions:', error);
            return [];
        }
    }

    /**
     * Get session index
     */
    private async getSessionIndex(): Promise<string[]> {
        try {
            const saved = await AsyncStorage.getItem(SESSIONS_INDEX_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Failed to get session index:', error);
            return [];
        }
    }

    /**
     * Remove a session from cache
     */
    async removeCachedSession(sessionId: string): Promise<void> {
        try {
            const key = `${SESSION_KEY_PREFIX}${sessionId}`;
            await AsyncStorage.removeItem(key);

            // Update index
            const index = await this.getSessionIndex();
            const newIndex = index.filter((id) => id !== sessionId);
            await AsyncStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(newIndex));

            // Update metadata
            this.metadata.totalSessions = newIndex.length;
            await this.saveMetadata();

            await this.notifyListeners();
        } catch (error) {
            console.error('Failed to remove cached session:', error);
        }
    }

    /**
     * Add a pending change (for offline modifications)
     */
    async addPendingChange(change: Omit<PendingChange, 'id' | 'timestamp'>): Promise<void> {
        const pendingChange: PendingChange = {
            ...change,
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            timestamp: Date.now(),
        };

        this.pendingChanges.push(pendingChange);
        await this.savePendingChanges();
        await this.notifyListeners();
    }

    /**
     * Get all pending changes
     */
    getPendingChanges(): PendingChange[] {
        return [...this.pendingChanges];
    }

    /**
     * Remove a pending change after successful sync
     */
    async removePendingChange(changeId: string): Promise<void> {
        this.pendingChanges = this.pendingChanges.filter((c) => c.id !== changeId);
        await this.savePendingChanges();
        await this.notifyListeners();
    }

    /**
     * Clear all pending changes
     */
    async clearPendingChanges(): Promise<void> {
        this.pendingChanges = [];
        await this.savePendingChanges();
        await this.notifyListeners();
    }

    /**
     * Clear entire cache
     */
    async clearCache(): Promise<void> {
        try {
            const index = await this.getSessionIndex();

            // Remove all session data
            for (const sessionId of index) {
                await AsyncStorage.removeItem(`${SESSION_KEY_PREFIX}${sessionId}`);
            }

            // Clear index and metadata
            await AsyncStorage.removeItem(SESSIONS_INDEX_KEY);
            this.metadata = {
                lastUpdated: 0,
                totalSessions: 0,
                totalSize: 0,
                version: 1,
            };
            await this.saveMetadata();

            await this.notifyListeners();
        } catch (error) {
            console.error('Failed to clear cache:', error);
        }
    }

    /**
     * Check if we're currently online
     */
    getIsOnline(): boolean {
        return this.isOnline;
    }

    /**
     * Estimate cache size
     */
    async estimateCacheSize(): Promise<number> {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const chasmKeys = keys.filter((k) => k.startsWith(CACHE_KEY_PREFIX));

            let totalSize = 0;
            for (const key of chasmKeys) {
                const value = await AsyncStorage.getItem(key);
                if (value) {
                    totalSize += value.length * 2; // UTF-16 encoding
                }
            }

            return totalSize;
        } catch (error) {
            console.error('Failed to estimate cache size:', error);
            return 0;
        }
    }

    /**
     * Format cache size for display
     */
    formatCacheSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
}

export const offlineCache = new OfflineCacheService();
export default offlineCache;
