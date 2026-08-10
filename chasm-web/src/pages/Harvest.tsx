// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import { useState, useMemo } from 'react';
import {
    Database,
    Search,
    Download,
    Upload,
    RefreshCw,
    Link,
    GitBranch,
    Clock,
    CheckCircle,
    AlertCircle,
    Play,
    Loader2,
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { useApi } from '../context/ApiContext';
import { useHarvest, useDebouncedSearch } from '../hooks/useApi';

// Share link type for import queue
interface ShareLink {
    id: string;
    url: string;
    provider: string;
    status: 'pending' | 'imported' | 'error';
    addedAt: string;
}

export default function Harvest() {
    const { sessions, statistics, isLoading, error, refetchStatistics, refetchSessions } = useApi();
    const harvestMutation = useHarvest();
    const { query, setQuery, data: searchResults, isLoading: isSearching, isDebouncing } = useDebouncedSearch();

    const [shareUrl, setShareUrl] = useState('');
    const [pendingShares, setPendingShares] = useState<ShareLink[]>([]);

    // Compute harvest stats from real data
    const harvestStats = useMemo(() => {
        const totalSessions = statistics?.totalSessions || sessions.length;
        const totalMessages = statistics?.totalMessages || sessions.reduce((sum, s) => sum + s.messageCount, 0);

        // Get most recent session update time
        const lastUpdate = sessions.length > 0
            ? new Date(Math.max(...sessions.map(s => s.updatedAt)))
            : null;

        return {
            totalSessions,
            totalMessages,
            lastHarvest: lastUpdate ? lastUpdate.toLocaleString() : 'Never',
            dbSize: `${(totalMessages * 0.005).toFixed(1)} MB`, // Rough estimate
            pendingShares: pendingShares.filter(s => s.status === 'pending').length,
            checkpoints: 0, // Would need checkpoint API
        };
    }, [statistics, sessions, pendingShares]);

    // Generate harvest history from session creation dates
    const harvestHistoryData = useMemo(() => {
        const days = 7;
        const now = new Date();
        const data = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dayStart = new Date(date.setHours(0, 0, 0, 0)).getTime();
            const dayEnd = new Date(date.setHours(23, 59, 59, 999)).getTime();

            const daySessions = sessions.filter(s =>
                s.createdAt >= dayStart && s.createdAt <= dayEnd
            ).length;

            data.push({
                date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                sessions: daySessions,
            });
        }

        return data;
    }, [sessions]);

    // Search results are already displayed below

    const handleHarvest = async () => {
        await harvestMutation.mutate(undefined);
        refetchSessions();
        refetchStatistics();
    };

    const handleAddShare = () => {
        if (!shareUrl.trim()) return;

        // Detect provider from URL
        let provider = 'Unknown';
        if (shareUrl.includes('chatgpt.com') || shareUrl.includes('openai.com')) {
            provider = 'ChatGPT';
        } else if (shareUrl.includes('claude.ai')) {
            provider = 'Claude';
        } else if (shareUrl.includes('gemini.google.com')) {
            provider = 'Gemini';
        } else if (shareUrl.includes('perplexity.ai')) {
            provider = 'Perplexity';
        }

        setPendingShares(prev => [
            {
                id: Date.now().toString(),
                url: shareUrl,
                provider,
                status: 'pending',
                addedAt: new Date().toLocaleString(),
            },
            ...prev,
        ]);
        setShareUrl('');
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-[hsl(var(--primary))]" size={32} />
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-[hsl(var(--destructive))]">
                <AlertCircle size={48} className="mb-4" />
                <p className="text-lg font-medium">Error loading data</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">{error.message}</p>
                <button
                    onClick={() => {
                        refetchSessions();
                        refetchStatistics();
                    }}
                    className="mt-4 px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Harvest</h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                        Unified database of all your chat sessions
                    </p>
                </div>
                <button
                    onClick={handleHarvest}
                    disabled={harvestMutation.isLoading}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${harvestMutation.isLoading
                        ? 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] cursor-not-allowed'
                        : 'bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary)/0.9)]'
                        }`}
                >
                    {harvestMutation.isLoading ? (
                        <>
                            <RefreshCw size={18} className="animate-spin" />
                            Harvesting...
                        </>
                    ) : (
                        <>
                            <Play size={18} />
                            Run Harvest
                        </>
                    )}
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <Database size={20} className="text-[hsl(var(--primary))] mb-2" />
                    <p className="text-2xl font-bold">{harvestStats.totalSessions}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Total Sessions</p>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <Search size={20} className="text-[hsl(var(--primary))] mb-2" />
                    <p className="text-2xl font-bold">{harvestStats.totalMessages.toLocaleString()}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Messages</p>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <Clock size={20} className="text-[hsl(var(--primary))] mb-2" />
                    <p className="text-sm font-bold truncate">{harvestStats.lastHarvest}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Last Update</p>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <Download size={20} className="text-[hsl(var(--primary))] mb-2" />
                    <p className="text-2xl font-bold">{harvestStats.dbSize}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Est. Size</p>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <Link size={20} className="text-[hsl(var(--primary))] mb-2" />
                    <p className="text-2xl font-bold">{harvestStats.pendingShares}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Pending Shares</p>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <GitBranch size={20} className="text-[hsl(var(--primary))] mb-2" />
                    <p className="text-2xl font-bold">{harvestStats.checkpoints}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Checkpoints</p>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Harvest History Chart */}
                <div className="bg-[hsl(var(--card))] rounded-xl p-6 border">
                    <h2 className="text-lg font-semibold mb-4">Session Activity (Last 7 Days)</h2>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={harvestHistoryData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '8px',
                                    }}
                                />
                                <Bar dataKey="sessions" fill="hsl(199, 89%, 48%)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Full-Text Search */}
                <div className="bg-[hsl(var(--card))] rounded-xl p-6 border">
                    <h2 className="text-lg font-semibold mb-4">Full-Text Search</h2>
                    <div className="relative mb-4">
                        <Search
                            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
                            size={20}
                        />
                        <input
                            type="text"
                            placeholder="Search across all sessions..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                        />
                        {(isSearching || isDebouncing) && (
                            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 animate-spin text-[hsl(var(--muted-foreground))]" size={16} />
                        )}
                    </div>
                    <div className="space-y-2">
                        {query.length > 0 ? (
                            searchResults && searchResults.length > 0 ? (
                                <>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                        Found {searchResults.length} results:
                                    </p>
                                    {searchResults.slice(0, 4).map((result, index) => (
                                        <div
                                            key={index}
                                            className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] cursor-pointer transition-colors"
                                        >
                                            <span className="text-sm font-medium">{result.title}</span>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-1">
                                                {result.snippet}
                                            </p>
                                        </div>
                                    ))}
                                </>
                            ) : (
                                <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
                                    {isSearching ? 'Searching...' : 'No results found'}
                                </p>
                            )
                        ) : (
                            <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
                                Enter a search query to search across all sessions
                            </p>
                        )}
                    </div>
                </div>

                {/* Import Share Links */}
                <div className="bg-[hsl(var(--card))] rounded-xl p-6 border">
                    <h2 className="text-lg font-semibold mb-4">Import Share Links</h2>
                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            placeholder="Paste share URL (ChatGPT, Claude, Gemini...)"
                            value={shareUrl}
                            onChange={(e) => setShareUrl(e.target.value)}
                            className="flex-1 px-4 py-2 rounded-lg border bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                        />
                        <button
                            onClick={handleAddShare}
                            className="px-4 py-2 rounded-lg bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary)/0.9)] transition-colors"
                        >
                            <Upload size={18} />
                        </button>
                    </div>
                    <div className="space-y-2">
                        {pendingShares.length === 0 ? (
                            <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
                                No share links in queue. Paste a URL above to import.
                            </p>
                        ) : (
                            pendingShares.map((share) => (
                                <div
                                    key={share.id}
                                    className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--muted)/0.5)]"
                                >
                                    <div className="flex items-center gap-3">
                                        {share.status === 'imported' ? (
                                            <CheckCircle size={16} className="text-green-500" />
                                        ) : share.status === 'error' ? (
                                            <AlertCircle size={16} className="text-red-500" />
                                        ) : (
                                            <AlertCircle size={16} className="text-yellow-500" />
                                        )}
                                        <div>
                                            <p className="text-sm font-medium">{share.provider}</p>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate max-w-[200px]">
                                                {share.url}
                                            </p>
                                        </div>
                                    </div>
                                    <span
                                        className={`text-xs px-2 py-1 rounded-full ${share.status === 'imported'
                                            ? 'bg-green-500/10 text-green-500'
                                            : share.status === 'error'
                                                ? 'bg-red-500/10 text-red-500'
                                                : 'bg-yellow-500/10 text-yellow-500'
                                            }`}
                                    >
                                        {share.status}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-[hsl(var(--card))] rounded-xl p-6 border">
                    <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={handleHarvest}
                            className="flex items-center gap-2 p-3 rounded-lg border hover:bg-[hsl(var(--muted))] transition-colors"
                        >
                            <Database size={18} className="text-[hsl(var(--primary))]" />
                            <span className="text-sm">Refresh Data</span>
                        </button>
                        <button className="flex items-center gap-2 p-3 rounded-lg border hover:bg-[hsl(var(--muted))] transition-colors">
                            <Search size={18} className="text-[hsl(var(--primary))]" />
                            <span className="text-sm">Scan Providers</span>
                        </button>
                        <button className="flex items-center gap-2 p-3 rounded-lg border hover:bg-[hsl(var(--muted))] transition-colors">
                            <Download size={18} className="text-[hsl(var(--primary))]" />
                            <span className="text-sm">Export All</span>
                        </button>
                        <button className="flex items-center gap-2 p-3 rounded-lg border hover:bg-[hsl(var(--muted))] transition-colors">
                            <GitBranch size={18} className="text-[hsl(var(--primary))]" />
                            <span className="text-sm">Create Checkpoint</span>
                        </button>
                        <button className="flex items-center gap-2 p-3 rounded-lg border hover:bg-[hsl(var(--muted))] transition-colors">
                            <Upload size={18} className="text-[hsl(var(--primary))]" />
                            <span className="text-sm">Git Commit</span>
                        </button>
                        <button className="flex items-center gap-2 p-3 rounded-lg border hover:bg-[hsl(var(--muted))] transition-colors">
                            <Clock size={18} className="text-[hsl(var(--primary))]" />
                            <span className="text-sm">View History</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
