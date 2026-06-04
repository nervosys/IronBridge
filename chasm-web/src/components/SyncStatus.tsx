// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, useEffect } from 'react';
import {
    RefreshCw,
    CheckCircle,
    AlertCircle,
    Clock,
    Cloud,
    CloudOff,
    Loader2,
    ChevronDown,
    Wifi,
    WifiOff,
    HardDrive,
    ArrowUpDown,
} from 'lucide-react';
import { formatRelativeTime } from '@csm/shared';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

export interface SyncState {
    status: SyncStatus;
    lastSyncAt: number | null;
    pendingChanges: number;
    error?: string;
    isOnline: boolean;
}

interface SyncIndicatorProps {
    syncState: SyncState;
    onSync?: () => void;
    compact?: boolean;
}

const statusConfig: Record<SyncStatus, { icon: typeof CheckCircle; color: string; label: string }> = {
    idle: { icon: Cloud, color: 'text-[hsl(var(--muted-foreground))]', label: 'Synced' },
    syncing: { icon: Loader2, color: 'text-blue-500', label: 'Syncing...' },
    success: { icon: CheckCircle, color: 'text-green-500', label: 'Synced' },
    error: { icon: AlertCircle, color: 'text-red-500', label: 'Sync Error' },
    offline: { icon: CloudOff, color: 'text-amber-500', label: 'Offline' },
};

export function SyncIndicator({ syncState, onSync, compact = false }: SyncIndicatorProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const config = statusConfig[syncState.status];
    const Icon = config.icon;

    return (
        <div className="relative">
            <button
                onClick={() => (compact ? onSync?.() : setIsExpanded(!isExpanded))}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${syncState.status === 'error'
                    ? 'bg-red-500/10 hover:bg-red-500/20'
                    : syncState.status === 'syncing'
                        ? 'bg-blue-500/10'
                        : 'hover:bg-[hsl(var(--muted))]/50'
                    }`}
            >
                <Icon
                    className={`w-4 h-4 ${config.color} ${syncState.status === 'syncing' ? 'animate-spin' : ''}`}
                />
                {!compact && (
                    <>
                        <span className={`text-sm ${config.color}`}>{config.label}</span>
                        {syncState.pendingChanges > 0 && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-500 rounded">
                                {syncState.pendingChanges}
                            </span>
                        )}
                        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </>
                )}
            </button>

            {/* Expanded Panel */}
            {isExpanded && !compact && (
                <div className="absolute right-0 mt-2 w-72 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-xl z-50">
                    <div className="p-4 space-y-4">
                        {/* Status Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Icon className={`w-5 h-5 ${config.color} ${syncState.status === 'syncing' ? 'animate-spin' : ''}`} />
                                <span className="font-medium">{config.label}</span>
                            </div>
                            {syncState.isOnline ? (
                                <span className="flex items-center gap-1 text-xs text-green-500">
                                    <Wifi className="w-3 h-3" /> Online
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-xs text-amber-500">
                                    <WifiOff className="w-3 h-3" /> Offline
                                </span>
                            )}
                        </div>

                        {/* Error Message */}
                        {syncState.error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                                <p className="text-sm text-red-400">{syncState.error}</p>
                            </div>
                        )}

                        {/* Stats */}
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-[hsl(var(--muted-foreground))]">Last synced</span>
                                <span>
                                    {syncState.lastSyncAt
                                        ? formatRelativeTime(syncState.lastSyncAt)
                                        : 'Never'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[hsl(var(--muted-foreground))]">Pending changes</span>
                                <span className={syncState.pendingChanges > 0 ? 'text-amber-500' : ''}>
                                    {syncState.pendingChanges}
                                </span>
                            </div>
                        </div>

                        {/* Sync Button */}
                        <button
                            onClick={onSync}
                            disabled={syncState.status === 'syncing' || !syncState.isOnline}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${syncState.status === 'syncing' ? 'animate-spin' : ''}`} />
                            {syncState.status === 'syncing' ? 'Syncing...' : 'Sync Now'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// =============================================================================
// Detailed Sync Status Panel (for settings or dedicated page)
// =============================================================================

interface SyncStatusPanelProps {
    syncState: SyncState;
    onSync?: () => void;
    syncHistory?: { timestamp: number; status: SyncStatus; itemCount: number }[];
}

export function SyncStatusPanel({ syncState, onSync, syncHistory = [] }: SyncStatusPanelProps) {
    const config = statusConfig[syncState.status];
    const Icon = config.icon;

    return (
        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))]">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${syncState.status === 'error' ? 'bg-red-500/10' : 'bg-violet-500/10'}`}>
                        <ArrowUpDown className={`w-5 h-5 ${syncState.status === 'error' ? 'text-red-500' : 'text-violet-500'}`} />
                    </div>
                    <div>
                        <h3 className="font-semibold">Sync Status</h3>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            Keep your sessions synchronized
                        </p>
                    </div>
                </div>
                <button
                    onClick={onSync}
                    disabled={syncState.status === 'syncing' || !syncState.isOnline}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${syncState.status === 'syncing' ? 'animate-spin' : ''}`} />
                    Sync Now
                </button>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4">
                <div className="flex items-center gap-3 p-4 bg-[hsl(var(--background))] rounded-lg">
                    <Icon className={`w-8 h-8 ${config.color} ${syncState.status === 'syncing' ? 'animate-spin' : ''}`} />
                    <div>
                        <div className="text-sm text-[hsl(var(--muted-foreground))]">Status</div>
                        <div className="font-medium">{config.label}</div>
                    </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-[hsl(var(--background))] rounded-lg">
                    <Clock className="w-8 h-8 text-[hsl(var(--muted-foreground))]" />
                    <div>
                        <div className="text-sm text-[hsl(var(--muted-foreground))]">Last Sync</div>
                        <div className="font-medium">
                            {syncState.lastSyncAt ? formatRelativeTime(syncState.lastSyncAt) : 'Never'}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-[hsl(var(--background))] rounded-lg">
                    <HardDrive className={`w-8 h-8 ${syncState.pendingChanges > 0 ? 'text-amber-500' : 'text-[hsl(var(--muted-foreground))]'}`} />
                    <div>
                        <div className="text-sm text-[hsl(var(--muted-foreground))]">Pending</div>
                        <div className={`font-medium ${syncState.pendingChanges > 0 ? 'text-amber-500' : ''}`}>
                            {syncState.pendingChanges} change{syncState.pendingChanges !== 1 ? 's' : ''}
                        </div>
                    </div>
                </div>
            </div>

            {/* Error Display */}
            {syncState.error && (
                <div className="mx-4 mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <div className="font-medium text-red-400">Sync Failed</div>
                            <p className="text-sm text-red-300/80 mt-1">{syncState.error}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Sync History */}
            {syncHistory.length > 0 && (
                <div className="border-t border-[hsl(var(--border))]">
                    <div className="p-4">
                        <h4 className="text-sm font-medium text-[hsl(var(--muted-foreground))] mb-3">Recent Activity</h4>
                        <div className="space-y-2">
                            {syncHistory.slice(0, 5).map((entry, i) => {
                                const entryConfig = statusConfig[entry.status];
                                const EntryIcon = entryConfig.icon;
                                return (
                                    <div key={i} className="flex items-center gap-3 text-sm">
                                        <EntryIcon className={`w-4 h-4 ${entryConfig.color}`} />
                                        <span className="flex-1">{entryConfig.label}</span>
                                        <span className="text-[hsl(var(--muted-foreground))]">
                                            {entry.itemCount} item{entry.itemCount !== 1 ? 's' : ''}
                                        </span>
                                        <span className="text-[hsl(var(--muted-foreground))]">
                                            {formatRelativeTime(entry.timestamp)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// =============================================================================
// Hook for managing sync state
// =============================================================================

// eslint-disable-next-line react-refresh/only-export-components
export function useSyncState(initialState?: Partial<SyncState>) {
    const [syncState, setSyncState] = useState<SyncState>({
        status: 'idle',
        lastSyncAt: null,
        pendingChanges: 0,
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        ...initialState,
    });

    // Track online/offline status
    useEffect(() => {
        const handleOnline = () => setSyncState((s) => ({ ...s, isOnline: true, status: s.status === 'offline' ? 'idle' : s.status }));
        const handleOffline = () => setSyncState((s) => ({ ...s, isOnline: false, status: 'offline' }));

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const startSync = () => {
        setSyncState((s) => ({ ...s, status: 'syncing', error: undefined }));
    };

    const syncSuccess = (syncedCount: number = 0) => {
        setSyncState((s) => ({
            ...s,
            status: 'success',
            lastSyncAt: Date.now(),
            pendingChanges: Math.max(0, s.pendingChanges - syncedCount),
            error: undefined,
        }));
        // Reset to idle after a delay
        setTimeout(() => {
            setSyncState((s) => (s.status === 'success' ? { ...s, status: 'idle' } : s));
        }, 3000);
    };

    const syncError = (error: string) => {
        setSyncState((s) => ({ ...s, status: 'error', error }));
    };

    const addPendingChange = () => {
        setSyncState((s) => ({ ...s, pendingChanges: s.pendingChanges + 1 }));
    };

    return {
        syncState,
        startSync,
        syncSuccess,
        syncError,
        addPendingChange,
        setSyncState,
    };
}

export default SyncIndicator;
