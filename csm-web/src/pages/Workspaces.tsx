import { useState, useMemo } from 'react';
import { Search, FolderOpen, MessageSquare, ExternalLink, MoreVertical, AlertCircle, Loader2 } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { formatDate } from '@csm/shared';

export default function Workspaces() {
    const { workspaces, sessions, isLoading, error } = useApi();
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'sessions' | 'lastActive' | 'path'>('lastActive');

    // Compute session counts per workspace
    const sessionCounts = useMemo(() => {
        const counts = new Map<string, number>();
        sessions.forEach((s) => {
            if (s.workspaceId) {
                counts.set(s.workspaceId, (counts.get(s.workspaceId) || 0) + 1);
            }
        });
        return counts;
    }, [sessions]);

    // Transform workspaces for display
    const workspacesData = useMemo(() => {
        return workspaces.map((ws) => ({
            id: ws.id,
            hash: ws.id.substring(0, 12) + '...',
            projectPath: ws.path || ws.name || ws.id,
            sessions: ws.sessionCount || sessionCounts.get(ws.id) || 0,
            lastActive: formatDate(ws.updatedAt),
            lastActiveTimestamp: ws.updatedAt,
            hasChats: (ws.sessionCount || sessionCounts.get(ws.id) || 0) > 0,
            provider: ws.provider,
        }));
    }, [workspaces, sessionCounts]);

    const filteredWorkspaces = workspacesData
        .filter((ws) =>
            ws.projectPath.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ws.hash.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
            if (sortBy === 'sessions') return b.sessions - a.sessions;
            if (sortBy === 'path') return a.projectPath.localeCompare(b.projectPath);
            return b.lastActiveTimestamp - a.lastActiveTimestamp;
        });

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Failed to Load Workspaces</h3>
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
                    <h1 className="text-3xl font-bold">Workspaces</h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                        Manage VS Code workspaces and their chat sessions
                    </p>
                </div>
                {isLoading && (
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Updating...</span>
                    </div>
                )}
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
                        placeholder="Search workspaces..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border bg-[hsl(var(--card))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                    />
                </div>
                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'sessions' | 'lastActive' | 'path')}
                    className="px-4 py-2 rounded-lg border bg-[hsl(var(--card))] text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                >
                    <option value="lastActive">Sort by Last Active</option>
                    <option value="sessions">Sort by Sessions</option>
                    <option value="path">Sort by Path</option>
                </select>
            </div>

            {/* Workspaces Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredWorkspaces.length > 0 ? (
                    filteredWorkspaces.map((workspace) => (
                        <div
                            key={workspace.id}
                            className="bg-[hsl(var(--card))] rounded-xl p-5 border hover:border-[hsl(var(--primary))] transition-colors cursor-pointer group"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-10 h-10 bg-[hsl(var(--primary)/0.1)] rounded-lg flex items-center justify-center">
                                    <FolderOpen className="text-[hsl(var(--primary))]" size={20} />
                                </div>
                                <button className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[hsl(var(--muted))] transition-all">
                                    <MoreVertical size={18} className="text-[hsl(var(--muted-foreground))]" />
                                </button>
                            </div>

                            <h3 className="font-semibold text-sm truncate mb-1" title={workspace.projectPath}>
                                {workspace.projectPath.split(/[/\\]/).pop() || workspace.projectPath}
                            </h3>
                            <p
                                className="text-xs text-[hsl(var(--muted-foreground))] truncate mb-4"
                                title={workspace.projectPath}
                            >
                                {workspace.projectPath}
                            </p>

                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-1 text-[hsl(var(--muted-foreground))]">
                                    <MessageSquare size={14} />
                                    <span>{workspace.sessions} sessions</span>
                                </div>
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                    {workspace.lastActive}
                                </span>
                            </div>

                            <div className="mt-4 pt-4 border-t flex gap-2">
                                <button className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary)/0.9)] transition-colors">
                                    View Sessions
                                </button>
                                <button className="px-3 py-1.5 rounded-lg border hover:bg-[hsl(var(--muted))] transition-colors">
                                    <ExternalLink size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full text-center py-16 bg-[hsl(var(--card))] rounded-xl border">
                        <FolderOpen className="w-12 h-12 mx-auto mb-4 text-[hsl(var(--muted-foreground))] opacity-50" />
                        <h3 className="text-lg font-semibold mb-2">No Workspaces Found</h3>
                        <p className="text-[hsl(var(--muted-foreground))]">
                            {searchQuery
                                ? 'Try adjusting your search criteria'
                                : 'Open VS Code projects to see workspaces here'}
                        </p>
                    </div>
                )}
            </div>

            {/* Summary */}
            <div className="text-sm text-[hsl(var(--muted-foreground))]">
                Showing {filteredWorkspaces.length} of {workspacesData.length} workspaces
            </div>
        </div>
    );
}
