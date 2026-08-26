// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import { useState, useMemo } from 'react';
import {
    Cloud,
    HardDrive,
    CheckCircle,
    XCircle,
    RefreshCw,
    Settings,
    ExternalLink,
    AlertCircle,
    Loader2,
    Server,
} from 'lucide-react';
import { useApi } from '../context/ApiContext';
import type { Provider as ApiProvider, ProviderHealth } from '../api/types';
import { PROVIDERS } from '@csm/shared';

// Provider icons mapping - uses shared provider data when available
const PROVIDER_ICONS: Record<string, string> = {
    'github-copilot': '🤖',
    'copilot': '🤖',
    'cursor': '⚡',
    'ollama': '🦙',
    'lm-studio': '🎛️',
    'lmstudio': '🎛️',
    'chatgpt': '💬',
    'openai': '💬',
    'claude': '🧠',
    'anthropic': '🧠',
    'gemini': '✨',
    'google': '✨',
    'perplexity': '🔍',
    'jan': '🎯',
    'gpt4all': '🌐',
    'localai': '🖥️',
    'llamafile': '📦',
    'azure': '☁️',
    'default': '🤖',
};

function getProviderIcon(name: string): string {
    const normalized = name.toLowerCase().replace(/\s+/g, '-');
    // Try shared providers first
    const sharedProvider = Object.values(PROVIDERS).find(
        p => p.id === normalized || p.name.toLowerCase().replace(/\s+/g, '-') === normalized
    );
    if (sharedProvider) {
        return PROVIDER_ICONS[sharedProvider.id] || PROVIDER_ICONS.default;
    }
    return PROVIDER_ICONS[normalized] || PROVIDER_ICONS.default;
}

interface ProviderCardProps {
    provider: ApiProvider;
    health?: ProviderHealth;
    sessionCount: number;
    /** Awaited, so the spinner can track the refetch rather than a timer. */
    onRefresh: () => void | Promise<unknown>;
}

function ProviderCard({ provider, health, sessionCount, onRefresh }: ProviderCardProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            // Awaited. This used to fire the refetch and clear the spinner on a
            // one-second timer, so the indicator described the timer rather
            // than the request -- it stopped at a second whether the refetch
            // had finished, was still running, or had failed.
            await onRefresh();
        } finally {
            setIsRefreshing(false);
        }
    };

    const status = health?.status || provider.status || 'unknown';
    const latency = health?.latency;

    return (
        <div className="bg-[hsl(var(--card))] rounded-xl p-5 border hover:border-[hsl(var(--primary)/0.5)] transition-colors">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[hsl(var(--muted))] rounded-xl flex items-center justify-center text-2xl">
                        {getProviderIcon(provider.name)}
                    </div>
                    <div>
                        <h3 className="font-semibold">{provider.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            {provider.type === 'local' ? (
                                <span className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                                    <HardDrive size={12} />
                                    Local
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                                    <Cloud size={12} />
                                    Cloud
                                </span>
                            )}
                            <span
                                className={`flex items-center gap-1 text-xs ${status === 'connected'
                                    ? 'text-green-500'
                                    : status === 'disconnected'
                                        ? 'text-red-500'
                                        : 'text-yellow-500'
                                    }`}
                            >
                                {status === 'connected' ? (
                                    <CheckCircle size={12} />
                                ) : (
                                    <XCircle size={12} />
                                )}
                                {status}
                            </span>
                            {latency && (
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                    {latency}ms
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleRefresh}
                    className={`p-2 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors ${isRefreshing ? 'animate-spin' : ''
                        }`}
                >
                    <RefreshCw size={16} className="text-[hsl(var(--muted-foreground))]" />
                </button>
            </div>

            {provider.models && provider.models.length > 0 && (
                <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
                    {provider.models.length} model{provider.models.length !== 1 ? 's' : ''} available
                </p>
            )}

            {provider.endpoint && (
                <div className="text-xs text-[hsl(var(--muted-foreground))] mb-4 font-mono bg-[hsl(var(--muted))] px-2 py-1 rounded truncate">
                    {provider.endpoint}
                </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t">
                <span className="text-sm text-[hsl(var(--muted-foreground))]">
                    {sessionCount} sessions
                </span>
                <div className="flex gap-2">
                    <button className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors">
                        <Settings size={16} className="text-[hsl(var(--muted-foreground))]" />
                    </button>
                    {provider.endpoint && (
                        <button className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors">
                            <ExternalLink size={16} className="text-[hsl(var(--muted-foreground))]" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function Providers() {
    const { providers, providerHealth, sessions, isLoading, error, refetchProviders } = useApi();
    const [filter, setFilter] = useState<'all' | 'local' | 'cloud'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'connected' | 'disconnected'>('all');

    // Compute session counts per provider
    const sessionCounts = useMemo(() => {
        const counts = new Map<string, number>();
        sessions.forEach((s) => {
            counts.set(s.provider, (counts.get(s.provider) || 0) + 1);
        });
        return counts;
    }, [sessions]);

    // Create health lookup
    const healthMap = useMemo(() => {
        const map = new Map<string, ProviderHealth>();
        providerHealth.forEach((h) => {
            map.set(h.providerId, h);
        });
        return map;
    }, [providerHealth]);

    const filteredProviders = providers.filter((provider) => {
        const health = healthMap.get(provider.id);
        const status = health?.status || provider.status || 'unknown';
        const matchesType = filter === 'all' || provider.type === filter;
        const matchesStatus = statusFilter === 'all' ||
            (statusFilter === 'connected' && status === 'connected') ||
            (statusFilter === 'disconnected' && (status === 'disconnected' || status === 'error'));
        return matchesType && matchesStatus;
    });

    const onlineCount = providers.filter((p) => {
        const health = healthMap.get(p.id);
        return (health?.status || p.status) === 'connected';
    }).length;
    const localCount = providers.filter((p) => p.type === 'local').length;
    const cloudCount = providers.filter((p) => p.type === 'cloud').length;

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Failed to Load Providers</h3>
                    <p className="text-[hsl(var(--muted-foreground))]">{error.message}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Providers</h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                        Manage your LLM providers and connections
                    </p>
                </div>
                {isLoading && (
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Updating...</span>
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                            <CheckCircle className="text-green-500" size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{onlineCount}</p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">Connected</p>
                        </div>
                    </div>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                            <HardDrive className="text-blue-500" size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{localCount}</p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">Local</p>
                        </div>
                    </div>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                            <Cloud className="text-purple-500" size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{cloudCount}</p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">Cloud</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                <div className="flex rounded-lg border overflow-hidden">
                    {(['all', 'local', 'cloud'] as const).map((type) => (
                        <button
                            key={type}
                            onClick={() => setFilter(type)}
                            className={`px-4 py-2 text-sm capitalize transition-colors ${filter === type
                                ? 'bg-[hsl(var(--primary))] text-white'
                                : 'bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))]'
                                }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
                <div className="flex rounded-lg border overflow-hidden">
                    {(['all', 'connected', 'disconnected'] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-4 py-2 text-sm capitalize transition-colors ${statusFilter === status
                                ? 'bg-[hsl(var(--primary))] text-white'
                                : 'bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))]'
                                }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {/* Providers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredProviders.length > 0 ? (
                    filteredProviders.map((provider) => (
                        <ProviderCard
                            key={provider.id}
                            provider={provider}
                            health={healthMap.get(provider.id)}
                            sessionCount={sessionCounts.get(provider.name) || 0}
                            onRefresh={refetchProviders}
                        />
                    ))
                ) : (
                    <div className="col-span-full text-center py-16 bg-[hsl(var(--card))] rounded-xl border">
                        <Server className="w-12 h-12 mx-auto mb-4 text-[hsl(var(--muted-foreground))] opacity-50" />
                        <h3 className="text-lg font-semibold mb-2">No Providers Found</h3>
                        <p className="text-[hsl(var(--muted-foreground))]">
                            {filter !== 'all' || statusFilter !== 'all'
                                ? 'Try adjusting your filters'
                                : 'Configure providers to get started'}
                        </p>
                    </div>
                )}
            </div>

            {/* Summary */}
            <div className="text-sm text-[hsl(var(--muted-foreground))]">
                Showing {filteredProviders.length} of {providers.length} providers
            </div>
        </div>
    );
}
