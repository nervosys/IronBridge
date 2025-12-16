import { useMemo } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import { MessageSquare, FolderOpen, Server, Database, TrendingUp, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { formatRelativeTime } from '@csm/shared';

// Provider colors for consistent styling
const PROVIDER_COLORS: Record<string, string> = {
    'github-copilot': '#0ea5e9',
    'copilot': '#0ea5e9',
    'chatgpt': '#10b981',
    'openai': '#10b981',
    'claude': '#f59e0b',
    'anthropic': '#f59e0b',
    'ollama': '#8b5cf6',
    'cursor': '#ec4899',
    'default': '#64748b',
};

function getProviderColor(provider: string): string {
    const normalized = provider.toLowerCase().replace(/\s+/g, '-');
    return PROVIDER_COLORS[normalized] || PROVIDER_COLORS.default;
}

interface StatCardProps {
    icon: React.ElementType;
    label: string;
    value: string | number;
    change?: string;
    changeType?: 'positive' | 'negative';
}

function StatCard({ icon: Icon, label, value, change, changeType }: StatCardProps) {
    return (
        <div className="bg-[hsl(var(--card))] rounded-xl p-6 border">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{label}</p>
                    <p className="text-3xl font-bold mt-1">{value}</p>
                    {change && (
                        <p
                            className={`text-sm mt-1 ${changeType === 'positive' ? 'text-green-500' : 'text-red-500'
                                }`}
                        >
                            {change}
                        </p>
                    )}
                </div>
                <div className="w-12 h-12 bg-[hsl(var(--primary)/0.1)] rounded-lg flex items-center justify-center">
                    <Icon className="text-[hsl(var(--primary))]" size={24} />
                </div>
            </div>
        </div>
    );
}

export default function Overview() {
    const { statistics, sessions, providers, workspaces, isLoading, error } = useApi();

    // Derive data from API
    const sessionActivityData = useMemo(() => {
        if (statistics?.messagesByDay) {
            return statistics.messagesByDay.map((day) => ({
                date: new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }),
                sessions: day.sessions,
                messages: day.messages,
            }));
        }
        // Fallback for when data is loading
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        return days.map((date) => ({ date, sessions: 0, messages: 0 }));
    }, [statistics]);

    const providerData = useMemo(() => {
        if (statistics?.sessionsByProvider) {
            return statistics.sessionsByProvider.map((p) => ({
                name: p.provider,
                sessions: p.count,
                color: p.color || getProviderColor(p.provider),
            }));
        }
        // Derive from sessions if statistics not available
        const providerCounts = new Map<string, number>();
        sessions.forEach((s) => {
            const count = providerCounts.get(s.provider) || 0;
            providerCounts.set(s.provider, count + 1);
        });
        return Array.from(providerCounts.entries()).map(([name, count]) => ({
            name,
            sessions: count,
            color: getProviderColor(name),
        }));
    }, [statistics, sessions]);

    const recentSessions = useMemo(() => {
        return [...sessions]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 5)
            .map((s) => ({
                id: s.id,
                title: s.title || 'Untitled Session',
                provider: s.provider,
                time: formatRelativeTime(s.updatedAt),
                messages: s.messageCount,
            }));
    }, [sessions]);

    // Calculate stats
    const totalSessions = statistics?.totalSessions ?? sessions.length;
    const totalWorkspaces = statistics?.totalWorkspaces ?? workspaces.length;
    const totalMessages = statistics?.totalMessages ?? sessions.reduce((sum, s) => sum + s.messageCount, 0);
    const activeProviders = providers.filter((p) => p.status === 'connected').length || providers.length;
    const sessionsThisWeek = statistics?.sessionsThisWeek ?? 0;

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Failed to Load Data</h3>
                    <p className="text-[hsl(var(--muted-foreground))]">{error.message}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Overview</h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                        Overview of your chat sessions across all providers
                    </p>
                </div>
                {isLoading && (
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Updating...</span>
                    </div>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    icon={MessageSquare}
                    label="Total Sessions"
                    value={totalSessions.toLocaleString()}
                    change={sessionsThisWeek > 0 ? `+${sessionsThisWeek} this week` : undefined}
                    changeType="positive"
                />
                <StatCard
                    icon={FolderOpen}
                    label="Workspaces"
                    value={totalWorkspaces.toLocaleString()}
                />
                <StatCard
                    icon={Server}
                    label="Active Providers"
                    value={activeProviders}
                />
                <StatCard
                    icon={Database}
                    label="Total Messages"
                    value={totalMessages.toLocaleString()}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Activity Chart */}
                <div className="lg:col-span-2 bg-[hsl(var(--card))] rounded-xl p-6 border">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-semibold">Session Activity</h2>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">Sessions and messages over time</p>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[hsl(var(--primary))]" />
                                <span className="text-[hsl(var(--muted-foreground))]">Sessions</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[#10b981]" />
                                <span className="text-[hsl(var(--muted-foreground))]">Messages</span>
                            </div>
                        </div>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={sessionActivityData}>
                                <defs>
                                    <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
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
                                <Area
                                    type="monotone"
                                    dataKey="sessions"
                                    stroke="hsl(199, 89%, 48%)"
                                    fillOpacity={1}
                                    fill="url(#colorSessions)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="messages"
                                    stroke="#10b981"
                                    fillOpacity={1}
                                    fill="url(#colorMessages)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Provider Distribution */}
                <div className="bg-[hsl(var(--card))] rounded-xl p-6 border">
                    <h2 className="text-xl font-semibold mb-2">Sessions by Provider</h2>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">Distribution across LLM providers</p>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={providerData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={45}
                                    outerRadius={85}
                                    paddingAngle={2}
                                    dataKey="sessions"
                                    stroke="none"
                                >
                                    {providerData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '8px',
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 mt-4">
                        {providerData.map((provider) => (
                            <div key={provider.name} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: provider.color }} />
                                    <span>{provider.name}</span>
                                </div>
                                <span className="text-[hsl(var(--muted-foreground))]">{provider.sessions}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Recent Sessions & Provider Bar Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Sessions */}
                <div className="bg-[hsl(var(--card))] rounded-xl p-6 border">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-semibold">Recent Sessions</h2>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">Latest chat activity</p>
                        </div>
                        <Clock size={20} className="text-[hsl(var(--muted-foreground))]" />
                    </div>
                    <div className="space-y-4">
                        {recentSessions.length > 0 ? (
                            recentSessions.map((session) => (
                                <div
                                    key={session.id}
                                    className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--muted)/0.5)] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer"
                                >
                                    <div>
                                        <p className="font-medium">{session.title}</p>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                            {session.provider} · {session.time}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 text-sm text-[hsl(var(--muted-foreground))]">
                                        <MessageSquare size={14} />
                                        <span>{session.messages}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-[hsl(var(--muted-foreground))]">
                                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No sessions yet</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Provider Comparison Bar Chart */}
                <div className="bg-[hsl(var(--card))] rounded-xl p-6 border">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-semibold">Provider Comparison</h2>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">Sessions per provider</p>
                        </div>
                        <TrendingUp size={20} className="text-[hsl(var(--muted-foreground))]" />
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={providerData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={12}
                                    width={100}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '8px',
                                    }}
                                />
                                <Bar dataKey="sessions" radius={[0, 4, 4, 0]}>
                                    {providerData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
