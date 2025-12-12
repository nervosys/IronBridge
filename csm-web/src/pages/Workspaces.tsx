import { useState } from 'react';
import { Search, FolderOpen, MessageSquare, ExternalLink, MoreVertical } from 'lucide-react';

// Mock data
const workspacesData = [
    {
        id: '1',
        hash: 'a5dafce48e3e...',
        projectPath: 'C:\\Users\\dev\\projects\\chat-session-manager',
        sessions: 8,
        lastActive: '2024-12-11 14:30',
        hasChats: true,
    },
    {
        id: '2',
        hash: 'b7c2f1a89d4e...',
        projectPath: 'C:\\Users\\dev\\projects\\web-app',
        sessions: 15,
        lastActive: '2024-12-11 12:15',
        hasChats: true,
    },
    {
        id: '3',
        hash: 'c9d3e2b1f5a6...',
        projectPath: 'C:\\Users\\dev\\projects\\api-server',
        sessions: 23,
        lastActive: '2024-12-10 18:45',
        hasChats: true,
    },
    {
        id: '4',
        hash: 'd4e5f6a7b8c9...',
        projectPath: 'C:\\Users\\dev\\projects\\mobile-app',
        sessions: 5,
        lastActive: '2024-12-09 09:20',
        hasChats: true,
    },
    {
        id: '5',
        hash: 'e8f9a0b1c2d3...',
        projectPath: 'C:\\Users\\dev\\projects\\data-pipeline',
        sessions: 12,
        lastActive: '2024-12-08 16:00',
        hasChats: true,
    },
    {
        id: '6',
        hash: 'f0a1b2c3d4e5...',
        projectPath: '(ALL SESSIONS)',
        sessions: 34,
        lastActive: '2024-12-11 15:00',
        hasChats: true,
    },
];

export default function Workspaces() {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'sessions' | 'lastActive' | 'path'>('lastActive');

    const filteredWorkspaces = workspacesData
        .filter((ws) =>
            ws.projectPath.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ws.hash.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
            if (sortBy === 'sessions') return b.sessions - a.sessions;
            if (sortBy === 'path') return a.projectPath.localeCompare(b.projectPath);
            return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
        });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold">Workspaces</h1>
                <p className="text-[hsl(var(--muted-foreground))] mt-1">
                    Manage VS Code workspaces and their chat sessions
                </p>
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
                {filteredWorkspaces.map((workspace) => (
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
                            {workspace.projectPath.split('\\').pop() || workspace.projectPath}
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
                ))}
            </div>

            {/* Summary */}
            <div className="text-sm text-[hsl(var(--muted-foreground))]">
                Showing {filteredWorkspaces.length} of {workspacesData.length} workspaces
            </div>
        </div>
    );
}
