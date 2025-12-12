import { useState } from 'react';
import { Search, MessageSquare, Calendar, Bot, Filter } from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

// Mock timeline data
const timelineData = [
    { time: '00:00', messages: 2 },
    { time: '04:00', messages: 0 },
    { time: '08:00', messages: 8 },
    { time: '10:00', messages: 15 },
    { time: '12:00', messages: 12 },
    { time: '14:00', messages: 23 },
    { time: '16:00', messages: 18 },
    { time: '18:00', messages: 9 },
    { time: '20:00', messages: 14 },
    { time: '22:00', messages: 6 },
];

// Mock sessions data
const sessionsData = [
    {
        id: 'abc123-def456',
        title: 'Implementing authentication flow',
        provider: 'GitHub Copilot',
        workspace: 'chat-session-manager',
        messages: 45,
        lastModified: '2024-12-11 15:30',
        preview: 'How can I implement JWT authentication with refresh tokens...',
    },
    {
        id: 'ghi789-jkl012',
        title: 'React component optimization',
        provider: 'ChatGPT',
        workspace: 'web-app',
        messages: 23,
        lastModified: '2024-12-11 14:15',
        preview: "I'm having performance issues with my React component...",
    },
    {
        id: 'mno345-pqr678',
        title: 'Database schema design',
        provider: 'Claude',
        workspace: 'api-server',
        messages: 67,
        lastModified: '2024-12-11 12:00',
        preview: 'What would be the best approach for designing a schema for...',
    },
    {
        id: 'stu901-vwx234',
        title: 'Rust error handling patterns',
        provider: 'GitHub Copilot',
        workspace: 'chat-session-manager',
        messages: 31,
        lastModified: '2024-12-11 10:45',
        preview: 'How do I properly use the ? operator with custom error types...',
    },
    {
        id: 'yza567-bcd890',
        title: 'API endpoint debugging',
        provider: 'Ollama',
        workspace: 'api-server',
        messages: 18,
        lastModified: '2024-12-10 18:30',
        preview: 'My POST endpoint is returning 500 errors when...',
    },
];

const providers = ['All', 'GitHub Copilot', 'ChatGPT', 'Claude', 'Ollama', 'Cursor'];

export default function Sessions() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProvider, setSelectedProvider] = useState('All');
    const [selectedSession, setSelectedSession] = useState<string | null>(null);

    const filteredSessions = sessionsData.filter((session) => {
        const matchesSearch =
            session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            session.preview.toLowerCase().includes(searchQuery.toLowerCase()) ||
            session.workspace.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesProvider =
            selectedProvider === 'All' || session.provider === selectedProvider;
        return matchesSearch && matchesProvider;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold">Sessions</h1>
                <p className="text-[hsl(var(--muted-foreground))] mt-1">
                    Browse and search your chat sessions
                </p>
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
                        {providers.map((provider) => (
                            <option key={provider} value={provider}>
                                {provider}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Sessions List */}
            <div className="space-y-3">
                {filteredSessions.map((session) => (
                    <div
                        key={session.id}
                        onClick={() => setSelectedSession(session.id === selectedSession ? null : session.id)}
                        className={`bg-[hsl(var(--card))] rounded-xl p-5 border cursor-pointer transition-all ${selectedSession === session.id
                                ? 'border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--primary)/0.2)]'
                                : 'hover:border-[hsl(var(--primary)/0.5)]'
                            }`}
                    >
                        <div className="flex items-start justify-between mb-3">
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
                            <span className="text-xs px-2 py-1 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                                {session.workspace}
                            </span>
                        </div>

                        <p className="text-sm text-[hsl(var(--muted-foreground))] line-clamp-2">
                            {session.preview}
                        </p>

                        {selectedSession === session.id && (
                            <div className="mt-4 pt-4 border-t flex gap-2">
                                <button className="px-4 py-2 text-sm rounded-lg bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary)/0.9)] transition-colors">
                                    Open Session
                                </button>
                                <button className="px-4 py-2 text-sm rounded-lg border hover:bg-[hsl(var(--muted))] transition-colors">
                                    Export
                                </button>
                                <button className="px-4 py-2 text-sm rounded-lg border hover:bg-[hsl(var(--muted))] transition-colors">
                                    Merge
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Summary */}
            <div className="text-sm text-[hsl(var(--muted-foreground))]">
                Showing {filteredSessions.length} of {sessionsData.length} sessions
            </div>
        </div>
    );
}
