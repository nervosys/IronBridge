// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

// Chat Sync Service
// Handles syncing local chat sessions with the CSM backend API

import { apiClient } from '../api/client';
import { ChatSession, ChatMessage, ChatProvider } from '../api/chat';

export interface SyncStatus {
    lastSynced: number | null;
    pendingChanges: number;
    isSyncing: boolean;
    error: string | null;
}

export interface SyncResult {
    success: boolean;
    syncedSessions: number;
    errors: string[];
}

// Transform local chat session to backend format
function transformSessionForBackend(session: ChatSession): any {
    // Extract system prompt from messages if present
    const systemMessage = session.messages.find(m => m.role === 'system');

    return {
        id: session.id,
        title: session.title,
        provider: session.provider.type,
        model: session.provider.model,
        created_at: new Date(session.createdAt).toISOString(),
        updated_at: new Date(session.updatedAt).toISOString(),
        messages: session.messages.map(msg => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            model: msg.model,
            tokens: msg.tokens,
            created_at: new Date(msg.timestamp).toISOString(),
        })),
        metadata: {
            source: 'csm_app',
            provider_name: session.provider.name,
            system_prompt: systemMessage?.content,
        },
    };
}

// Transform backend session to local format
function transformSessionFromBackend(
    backendSession: any,
    providers: ChatProvider[]
): ChatSession | null {
    // Find matching provider
    const provider = providers.find(p => p.type === backendSession.provider) || providers[0];
    if (!provider) return null;

    // Build messages array, including system prompt if present
    const messages: ChatMessage[] = [];

    // Add system prompt as first message if present
    const systemPrompt = backendSession.metadata?.system_prompt;
    if (systemPrompt) {
        messages.push({
            id: `system-${backendSession.id}`,
            role: 'system',
            content: systemPrompt,
            timestamp: new Date(backendSession.created_at || backendSession.createdAt).getTime(),
        });
    }

    // Add remaining messages
    const backendMessages = (backendSession.messages || []).map((msg: any) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content || msg.text || '',
        model: msg.model,
        tokens: msg.tokens,
        timestamp: new Date(msg.created_at || msg.createdAt).getTime(),
    }));
    messages.push(...backendMessages);

    return {
        id: backendSession.id,
        title: backendSession.title || 'Imported Session',
        provider: {
            ...provider,
            model: backendSession.model || provider.model,
        },
        messages,
        createdAt: new Date(backendSession.created_at || backendSession.createdAt).getTime(),
        updatedAt: new Date(backendSession.updated_at || backendSession.updatedAt).getTime(),
    };
}

class ChatSyncService {
    private syncStatus: SyncStatus = {
        lastSynced: null,
        pendingChanges: 0,
        isSyncing: false,
        error: null,
    };

    private pendingSessions: Map<string, ChatSession> = new Map();
    private syncListeners: Set<(status: SyncStatus) => void> = new Set();

    getStatus(): SyncStatus {
        return { ...this.syncStatus };
    }

    addStatusListener(listener: (status: SyncStatus) => void): () => void {
        this.syncListeners.add(listener);
        return () => this.syncListeners.delete(listener);
    }

    private notifyListeners(): void {
        this.syncListeners.forEach(listener => listener(this.getStatus()));
    }

    private updateStatus(updates: Partial<SyncStatus>): void {
        this.syncStatus = { ...this.syncStatus, ...updates };
        this.notifyListeners();
    }

    // Queue a session for sync
    queueForSync(session: ChatSession): void {
        this.pendingSessions.set(session.id, session);
        this.updateStatus({ pendingChanges: this.pendingSessions.size });
    }

    // Sync a single session to the backend
    async syncSession(session: ChatSession): Promise<boolean> {
        try {
            const backendData = transformSessionForBackend(session);

            // Try to update existing session, or create new one
            try {
                await apiClient.put(`/api/chat/sessions/${session.id}`, backendData);
            } catch (e: any) {
                if (e.response?.status === 404) {
                    // Session doesn't exist, create it
                    await apiClient.post('/api/chat/sessions', backendData);
                } else {
                    throw e;
                }
            }

            this.pendingSessions.delete(session.id);
            this.updateStatus({
                pendingChanges: this.pendingSessions.size,
                lastSynced: Date.now(),
            });

            return true;
        } catch (error: any) {
            console.error('Failed to sync session:', error);
            this.updateStatus({ error: error.message || 'Sync failed' });
            return false;
        }
    }

    // Sync all pending sessions
    async syncAll(): Promise<SyncResult> {
        if (this.syncStatus.isSyncing) {
            return { success: false, syncedSessions: 0, errors: ['Sync already in progress'] };
        }

        this.updateStatus({ isSyncing: true, error: null });

        const results: SyncResult = {
            success: true,
            syncedSessions: 0,
            errors: [],
        };

        for (const [id, session] of this.pendingSessions) {
            const success = await this.syncSession(session);
            if (success) {
                results.syncedSessions++;
            } else {
                results.success = false;
                results.errors.push(`Failed to sync session ${id}`);
            }
        }

        this.updateStatus({
            isSyncing: false,
            lastSynced: Date.now(),
        });

        return results;
    }

    // Fetch sessions from backend
    async fetchFromBackend(
        providers: ChatProvider[],
        options?: { limit?: number; since?: number }
    ): Promise<ChatSession[]> {
        try {
            const params: Record<string, any> = {};
            if (options?.limit) params.limit = options.limit;
            if (options?.since) params.since = new Date(options.since).toISOString();

            const response = await apiClient.get('/api/chat/sessions', { params });
            const backendSessions = response.data.data || response.data || [];

            return backendSessions
                .map((s: any) => transformSessionFromBackend(s, providers))
                .filter((s: ChatSession | null): s is ChatSession => s !== null);
        } catch (error: any) {
            console.error('Failed to fetch sessions from backend:', error);
            this.updateStatus({ error: error.message || 'Fetch failed' });
            return [];
        }
    }

    // Full sync - upload local and download remote
    async fullSync(
        localSessions: ChatSession[],
        providers: ChatProvider[]
    ): Promise<{
        uploaded: number;
        downloaded: number;
        merged: ChatSession[];
    }> {
        this.updateStatus({ isSyncing: true, error: null });

        const result = {
            uploaded: 0,
            downloaded: 0,
            merged: [] as ChatSession[],
        };

        try {
            // Upload local sessions
            for (const session of localSessions) {
                const success = await this.syncSession(session);
                if (success) result.uploaded++;
            }

            // Download remote sessions
            const remoteSessions = await this.fetchFromBackend(providers);
            result.downloaded = remoteSessions.length;

            // Merge sessions (prefer newer versions)
            const sessionMap = new Map<string, ChatSession>();

            // Add local sessions
            localSessions.forEach(s => sessionMap.set(s.id, s));

            // Merge remote sessions (newer wins)
            remoteSessions.forEach(remote => {
                const local = sessionMap.get(remote.id);
                if (!local || remote.updatedAt > local.updatedAt) {
                    sessionMap.set(remote.id, remote);
                }
            });

            result.merged = Array.from(sessionMap.values());
        } catch (error: any) {
            this.updateStatus({ error: error.message || 'Full sync failed' });
        } finally {
            this.updateStatus({
                isSyncing: false,
                lastSynced: Date.now(),
            });
        }

        return result;
    }

    // Delete a session from backend
    async deleteFromBackend(sessionId: string): Promise<boolean> {
        try {
            await apiClient.delete(`/api/chat/sessions/${sessionId}`);
            return true;
        } catch (error: any) {
            console.error('Failed to delete session from backend:', error);
            return false;
        }
    }

    // Clear sync state
    clearPending(): void {
        this.pendingSessions.clear();
        this.updateStatus({ pendingChanges: 0, error: null });
    }
}

// Singleton instance
export const chatSyncService = new ChatSyncService();

// Hook for using in React components
export function useChatSync() {
    return {
        getStatus: () => chatSyncService.getStatus(),
        addStatusListener: (listener: (status: SyncStatus) => void) =>
            chatSyncService.addStatusListener(listener),
        queueForSync: (session: ChatSession) => chatSyncService.queueForSync(session),
        syncSession: (session: ChatSession) => chatSyncService.syncSession(session),
        syncAll: () => chatSyncService.syncAll(),
        fetchFromBackend: (providers: ChatProvider[], options?: { limit?: number; since?: number }) =>
            chatSyncService.fetchFromBackend(providers, options),
        fullSync: (localSessions: ChatSession[], providers: ChatProvider[]) =>
            chatSyncService.fullSync(localSessions, providers),
        deleteFromBackend: (sessionId: string) => chatSyncService.deleteFromBackend(sessionId),
        clearPending: () => chatSyncService.clearPending(),
    };
}
