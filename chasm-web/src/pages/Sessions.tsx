import { useState, useMemo, useCallback } from 'react';
import { Search, MessageSquare, Calendar, Bot, Filter, AlertCircle, Loader2, FileText, GitCompare, Download, Tag, CheckSquare, SlidersHorizontal } from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { useApi } from '../context/ApiContext';
import { formatDate } from '@csm/shared';
import type { Session, SessionWithMessages } from '@csm/shared';
import ExportModal from '../components/ExportModal';
import SessionDiff from '../components/SessionDiff';
import AdvancedSearch, { createDefaultFilters, type SearchFilters } from '../components/AdvancedSearch';

// Get today's activity data from sessions
function getTodayActivityData(sessions: { updatedAt: number }[]) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Group sessions by hour
    const hourlyData = new Map<string, number>();
    for (let i = 0; i < 24; i += 2) {
        const hour = i.toString().padStart(2, '0') + ':00';
        hourlyData.set(hour, 0);
    }

    sessions.forEach((session) => {
        if (session.updatedAt >= startOfDay) {
            const hour = new Date(session.updatedAt).getHours();
            const roundedHour = Math.floor(hour / 2) * 2;
            const key = roundedHour.toString().padStart(2, '0') + ':00';
            hourlyData.set(key, (hourlyData.get(key) || 0) + 1);
        }
    });

    return Array.from(hourlyData.entries()).map(([time, messages]) => ({
        time,
        messages,
    }));
}

export default function Sessions() {
    const { sessions, workspaces, isLoading, error } = useApi();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProvider, setSelectedProvider] = useState('All');
    const [selectedSession, setSelectedSession] = useState<string | null>(null);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportSessionId, setExportSessionId] = useState<string | null>(null);
    const [showDiffView, setShowDiffView] = useState(false);
    const [diffSessionA, setDiffSessionA] = useState<string | null>(null);
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
    const [advancedFilters, setAdvancedFilters] = useState<SearchFilters>(createDefaultFilters());
    const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());

    // Get unique providers from sessions
    const availableProviders = useMemo(() => {
        const providerSet = new Set(sessions.map((s) => s.provider));
        return ['All', ...Array.from(providerSet)];
    }, [sessions]);

    // Create workspace lookup map
    const workspaceMap = useMemo(() => {
        const map = new Map<string, string>();
        workspaces.forEach((ws) => {
            map.set(ws.id, ws.name || ws.path || ws.id);
        });
        return map;
    }, [workspaces]);

    // Transform sessions for display
    const sessionsData = useMemo(() => {
        return sessions.map((session) => ({
            id: session.id,
            title: session.title || 'Untitled Session',
            provider: session.provider,
            workspace: workspaceMap.get(session.workspaceId || '') || 'Unknown',
            messages: session.messageCount,
            lastModified: formatDate(session.updatedAt),
            preview: '', // Would need to fetch first message
            model: session.model,
        }));
    }, [sessions, workspaceMap]);

    // Get timeline data
    const timelineData = useMemo(() => getTodayActivityData(sessions), [sessions]);

    const toggleSessionSelection = useCallback((sessionId: string) => {
        setSelectedSessions(prev => {
            const next = new Set(prev);
            if (next.has(sessionId)) {
                next.delete(sessionId);
            } else {
                next.add(sessionId);
            }
            return next;
        });
    }, []);

    const filteredSessions = sessionsData.filter((session) => {
        const matchesSearch =
            session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            session.workspace.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesProvider =
            selectedProvider === 'All' || session.provider === selectedProvider;
        return matchesSearch && matchesProvider;
    });

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Failed to Load Sessions</h3>
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
                    <h1 className="text-3xl font-bold">Sessions</h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                        Browse and search your chat sessions
                    </p>
                </div>
                {isLoading && (
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Updating...</span>
                    </div>
                )}
            </div>

            {/* Timeline Chart */}
            <div className="bg-[hsl(var(--card))] rounded-xl p-6 border">
                <h2 className="text-lg font-semibold mb-4">Today's Activity</h2>
                <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={timelineData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="messages"
                                stroke="hsl(199, 89%, 48%)"
                                strokeWidth={2}
                                dot={{ fill: 'hsl(199, 89%, 48%)', strokeWidth: 0, r: 4 }}
                                activeDot={{ r: 6 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[hsl(var(--muted-foreground))]"
                        size={20}
                    />
                    <input
                        type="text"
                        placeholder="Search sessions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border bg-[hsl(var(--card))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-[hsl(var(--muted-foreground))]" />
                    <select
                        value={selectedProvider}
                        onChange={(e) => setSelectedProvider(e.target.value)}
                        className="px-4 py-2 rounded-lg border bg-[hsl(var(--card))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                    >
                        {availableProviders.map((provider) => (
                            <option key={provider} value={provider}>
                                {provider}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                        className={`p-2 rounded-lg border transition-colors ${showAdvancedSearch ? 'bg-[hsl(var(--primary))] text-white' : 'hover:bg-[hsl(var(--muted))]'}`}
                        title="Advanced filters"
                    >
                        <SlidersHorizontal size={18} />
                    </button>
                    <button
                        onClick={() => setShowDiffView(!showDiffView)}
                        className={`p-2 rounded-lg border transition-colors ${showDiffView ? 'bg-[hsl(var(--primary))] text-white' : 'hover:bg-[hsl(var(--muted))]'}`}
                        title="Compare sessions"
                    >
                        <GitCompare size={18} />
                    </button>
                </div>
            </div>

            {/* Advanced Search Panel */}
            {showAdvancedSearch && (
                <AdvancedSearch
                    filters={advancedFilters}
                    onFiltersChange={setAdvancedFilters}
                    availableProviders={availableProviders.filter(p => p !== 'All')}
                    availableWorkspaces={workspaces.map(ws => ({ id: ws.id, name: ws.name || ws.path || ws.id }))}
                    availableModels={[...new Set(sessions.map(s => s.model).filter(Boolean) as string[])]}
                    resultCount={filteredSessions.length}
                />
            )}

            {/* Session Diff View */}
            {showDiffView && (
                <SessionDiff
                    sessionA={sessions.find(s => s.id === (diffSessionA || filteredSessions[0]?.id)) as unknown as SessionWithMessages}
                    sessionB={sessions.find(s => s.id === (selectedSession || filteredSessions[1]?.id)) as unknown as SessionWithMessages}
                    onSelectSession={(side: 'A' | 'B') => {
                        // When user picks a side to swap, open selection UI
                        if (side === 'A') setDiffSessionA(null);
                        else setSelectedSession(null);
                    }}
                    availableSessions={sessions as unknown as Session[]}
                />
            )}

            {/* Batch Operations Bar */}
            {selectedSessions.size > 0 && (
                <div className="bg-[hsl(var(--primary))] text-white rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <CheckSquare size={20} />
                        <span className="font-medium">{selectedSessions.size} session(s) selected</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="px-3 py-1.5 text-sm rounded-lg bg-white/20 hover:bg-white/30 transition-colors flex items-center gap-1.5">
                            <Tag size={14} /> Tag
                        </button>
                        <button className="px-3 py-1.5 text-sm rounded-lg bg-white/20 hover:bg-white/30 transition-colors flex items-center gap-1.5">
                            <Download size={14} /> Export
                        </button>
                        <button
                            onClick={() => setSelectedSessions(new Set())}
                            className="px-3 py-1.5 text-sm rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                </div>
            )}

            {/* Sessions List */}
            <div className="space-y-3">
                {filteredSessions.length > 0 ? (
                    filteredSessions.map((session) => (
                        <div
                            key={session.id}
                            onClick={() => setSelectedSession(session.id === selectedSession ? null : session.id)}
                            className={`bg-[hsl(var(--card))] rounded-xl p-5 border cursor-pointer transition-all ${selectedSession === session.id
                                ? 'border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--primary)/0.2)]'
                                : 'hover:border-[hsl(var(--primary)/0.5)]'
                                }`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-start gap-3 flex-1">
                                    <input
                                        type="checkbox"
                                        checked={selectedSessions.has(session.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={() => toggleSessionSelection(session.id)}
                                        className="mt-1.5 h-4 w-4 rounded border-gray-300 text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]"
                                    />
                                    <div className="flex-1">
                                    <h3 className="font-semibold mb-1">{session.title}</h3>
                                    <div className="flex items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
                                        <span className="flex items-center gap-1">
                                            <Bot size={14} />
                                            {session.provider}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <MessageSquare size={14} />
                                            {session.messages} messages
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Calendar size={14} />
                                            {session.lastModified}
                                        </span>
                                    </div>
                                    </div>
                                </div>
                                <span className="text-xs px-2 py-1 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                                    {session.workspace}
                                </span>
                            </div>

                            {session.model && (
                                <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">
                                    Model: {session.model}
                                </p>
                            )}

            {selectedSession === session.id && (
                                <div className="mt-4 pt-4 border-t flex gap-2">
                                    <button className="px-4 py-2 text-sm rounded-lg bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary)/0.9)] transition-colors">
                                        Open Session
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setExportSessionId(session.id); setShowExportModal(true); }}
                                        className="px-4 py-2 text-sm rounded-lg border hover:bg-[hsl(var(--muted))] transition-colors flex items-center gap-1.5"
                                    >
                                        <Download size={14} /> Export
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setDiffSessionA(session.id); setShowDiffView(true); }}
                                        className="px-4 py-2 text-sm rounded-lg border hover:bg-[hsl(var(--muted))] transition-colors flex items-center gap-1.5"
                                    >
                                        <GitCompare size={14} /> Compare
                                    </button>
                                    <button className="px-4 py-2 text-sm rounded-lg border hover:bg-[hsl(var(--muted))] transition-colors">
                                        Merge
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="text-center py-16 bg-[hsl(var(--card))] rounded-xl border">
                        <FileText className="w-12 h-12 mx-auto mb-4 text-[hsl(var(--muted-foreground))] opacity-50" />
                        <h3 className="text-lg font-semibold mb-2">No Sessions Found</h3>
                        <p className="text-[hsl(var(--muted-foreground))]">
                            {searchQuery || selectedProvider !== 'All'
                                ? 'Try adjusting your search or filter criteria'
                                : 'Start chatting to see your sessions here'}
                        </p>
                    </div>
                )}
            </div>

            {/* Summary */}
            <div className="text-sm text-[hsl(var(--muted-foreground))]">
                Showing {filteredSessions.length} of {sessionsData.length} sessions
            </div>

            {/* Export Modal */}
            {showExportModal && exportSessionId && (
                <ExportModal
                    session={sessions.find(s => s.id === exportSessionId) as unknown as SessionWithMessages}
                    isOpen={showExportModal}
                    onClose={() => { setShowExportModal(false); setExportSessionId(null); }}
                />
            )}
        </div>
    );
}
