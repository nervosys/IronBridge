// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import { useMemo, useState, useCallback } from 'react';
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
import { MessageSquare, FolderOpen, Server, Database, TrendingUp, Clock, AlertCircle, Loader2, Calendar } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { formatRelativeTime } from '@csm/shared';

// Time period options for session activity chart
type TimePeriod = 'week' | 'month' | 'year' | 'all';

interface ActivityDataPoint {
    date: string;
    fullDate: string;
    sessions: number;
    messages: number;
    prevSessions?: number;
    prevMessages?: number;
}

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

// Mapping from provider IDs to proper display names
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
    'copilot': 'GitHub Copilot',
    'github-copilot': 'GitHub Copilot',
    'openai': 'OpenAI',
    'chatgpt': 'ChatGPT',
    'anthropic': 'Anthropic',
    'claude': 'Claude',
    'google': 'Google AI',
    'gemini': 'Gemini',
    'azure-openai': 'Azure OpenAI',
    'ai-foundry': 'Azure AI Foundry',
    'github-models': 'GitHub Models',
    'deepseek': 'DeepSeek',
    'xai': 'xAI',
    'mistral': 'Mistral AI',
    'cohere': 'Cohere',
    'perplexity': 'Perplexity',
    'groq': 'Groq',
    'together': 'Together AI',
    'fireworks': 'Fireworks AI',
    'replicate': 'Replicate',
    'openrouter': 'OpenRouter',
    'aws-bedrock': 'AWS Bedrock',
    'ai21': 'AI21 Labs',
    'cursor': 'Cursor',
    'm365-copilot': 'Microsoft 365 Copilot',
    'ollama': 'Ollama',
    'lm-studio': 'LM Studio',
    'localai': 'LocalAI',
    'llamafile': 'llamafile',
    'jan': 'Jan',
    'gpt4all': 'GPT4All',
    'text-gen-webui': 'Text Generation WebUI',
    'vllm': 'vLLM',
    'mlx': 'MLX',
    'koboldcpp': 'KoboldCpp',
    'tabby': 'Tabby',
};

function getProviderDisplayName(providerId: string): string {
    const normalized = providerId.toLowerCase().replace(/\s+/g, '-');
    return PROVIDER_DISPLAY_NAMES[normalized] || providerId;
}

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
    const [timePeriod, setTimePeriod] = useState<TimePeriod>('week');
    const [showBaseline, setShowBaseline] = useState(true);

    // Helper function to get date range for period
    const getDateRange = useCallback((period: TimePeriod, offset = 0) => {
        const now = new Date();
        const end = new Date(now);
        const start = new Date(now);

        // Adjust for offset (0 = current period, 1 = previous period)
        switch (period) {
            case 'week':
                end.setDate(end.getDate() - (offset * 7));
                start.setDate(end.getDate() - 6);
                break;
            case 'month':
                end.setMonth(end.getMonth() - offset);
                start.setMonth(end.getMonth());
                start.setDate(1);
                break;
            case 'year':
                end.setFullYear(end.getFullYear() - offset);
                start.setFullYear(end.getFullYear());
                start.setMonth(0);
                start.setDate(1);
                break;
            case 'all': {
                // For 'all', use the earliest session date
                const earliest = sessions.length > 0
                    ? Math.min(...sessions.map(s => s.createdAt))
                    : now.getTime() - 365 * 24 * 60 * 60 * 1000;
                start.setTime(earliest);
                break;
            }
        }

        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }, [sessions]);

    // Generate activity data based on selected period with baseline comparison
    const sessionActivityData = useMemo((): ActivityDataPoint[] => {
        const { start: currentStart, end: currentEnd } = getDateRange(timePeriod, 0);
        const { start: prevStart, end: prevEnd } = getDateRange(timePeriod, 1);

        // Aggregate sessions by date bucket
        const aggregateByBucket = (startDate: Date, endDate: Date) => {
            const buckets = new Map<string, { sessions: number; messages: number }>();

            // Determine bucket key function based on period
            let bucketKey: (d: Date) => string;

            switch (timePeriod) {
                case 'week':
                    bucketKey = (d) => d.toLocaleDateString('en-US', { weekday: 'short' });
                    break;
                case 'month':
                    bucketKey = (d) => d.getDate().toString();
                    break;
                case 'year':
                    bucketKey = (d) => d.toLocaleDateString('en-US', { month: 'short' });
                    break;
                case 'all':
                    // Use months for 'all'
                    bucketKey = (d) => d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                    break;
            }

            // Initialize buckets
            if (timePeriod === 'week') {
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const startDay = startDate.getDay();
                for (let i = 0; i < 7; i++) {
                    const dayIndex = (startDay + i) % 7;
                    buckets.set(days[dayIndex], { sessions: 0, messages: 0 });
                }
            } else if (timePeriod === 'month') {
                const daysInMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
                for (let i = 1; i <= daysInMonth; i++) {
                    buckets.set(i.toString(), { sessions: 0, messages: 0 });
                }
            } else if (timePeriod === 'year') {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                months.forEach(m => buckets.set(m, { sessions: 0, messages: 0 }));
            }

            // Aggregate sessions
            sessions.forEach(session => {
                const sessionDate = new Date(session.createdAt);
                if (sessionDate >= startDate && sessionDate <= endDate) {
                    const key = bucketKey(sessionDate);
                    const existing = buckets.get(key) || { sessions: 0, messages: 0 };
                    buckets.set(key, {
                        sessions: existing.sessions + 1,
                        messages: existing.messages + session.messageCount,
                    });
                }
            });

            return buckets;
        };

        const currentBuckets = aggregateByBucket(currentStart, currentEnd);
        const prevBuckets = aggregateByBucket(prevStart, prevEnd);

        // Convert to array format
        const result: ActivityDataPoint[] = [];

        if (timePeriod === 'week') {
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const startDay = currentStart.getDay();
            for (let i = 0; i < 7; i++) {
                const dayIndex = (startDay + i) % 7;
                const key = days[dayIndex];
                const current = currentBuckets.get(key) || { sessions: 0, messages: 0 };
                const prev = prevBuckets.get(key) || { sessions: 0, messages: 0 };
                const date = new Date(currentStart);
                date.setDate(date.getDate() + i);
                result.push({
                    date: key,
                    fullDate: date.toLocaleDateString(),
                    sessions: current.sessions,
                    messages: current.messages,
                    prevSessions: prev.sessions,
                    prevMessages: prev.messages,
                });
            }
        } else if (timePeriod === 'month') {
            const daysInMonth = new Date(currentEnd.getFullYear(), currentEnd.getMonth() + 1, 0).getDate();
            for (let i = 1; i <= daysInMonth; i++) {
                const key = i.toString();
                const current = currentBuckets.get(key) || { sessions: 0, messages: 0 };
                const prev = prevBuckets.get(key) || { sessions: 0, messages: 0 };
                result.push({
                    date: key,
                    fullDate: new Date(currentEnd.getFullYear(), currentEnd.getMonth(), i).toLocaleDateString(),
                    sessions: current.sessions,
                    messages: current.messages,
                    prevSessions: prev.sessions,
                    prevMessages: prev.messages,
                });
            }
        } else if (timePeriod === 'year') {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            months.forEach((key, i) => {
                const current = currentBuckets.get(key) || { sessions: 0, messages: 0 };
                const prev = prevBuckets.get(key) || { sessions: 0, messages: 0 };
                result.push({
                    date: key,
                    fullDate: new Date(currentEnd.getFullYear(), i, 1).toLocaleDateString(),
                    sessions: current.sessions,
                    messages: current.messages,
                    prevSessions: prev.sessions,
                    prevMessages: prev.messages,
                });
            });
        } else {
            // 'all' - group by month/year
            currentBuckets.forEach((value, key) => {
                const prev = prevBuckets.get(key) || { sessions: 0, messages: 0 };
                result.push({
                    date: key,
                    fullDate: key,
                    sessions: value.sessions,
                    messages: value.messages,
                    prevSessions: prev.sessions,
                    prevMessages: prev.messages,
                });
            });
        }

        return result;
    }, [sessions, timePeriod, getDateRange]);

    const providerData = useMemo(() => {
        if (statistics?.sessionsByProvider) {
            return statistics.sessionsByProvider.map((p) => ({
                name: getProviderDisplayName(p.provider),
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
        return Array.from(providerCounts.entries()).map(([id, count]) => ({
            name: getProviderDisplayName(id),
            sessions: count,
            color: getProviderColor(id),
        }));
    }, [statistics, sessions]);

    const recentSessions = useMemo(() => {
        return [...sessions]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 5)
            .map((s) => ({
                id: s.id,
                title: s.title || 'Untitled Session',
                provider: getProviderDisplayName(s.provider),
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
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-xl font-semibold">Session Activity</h2>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                {timePeriod === 'week' && 'Last 7 days'}
                                {timePeriod === 'month' && 'This month'}
                                {timePeriod === 'year' && 'This year'}
                                {timePeriod === 'all' && 'All time'}
                                {showBaseline && timePeriod !== 'all' && ' vs. previous period'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-[hsl(var(--muted-foreground))]" />
                            <select
                                value={timePeriod}
                                onChange={(e) => setTimePeriod(e.target.value as TimePeriod)}
                                className="bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                            >
                                <option value="week">Week</option>
                                <option value="month">Month</option>
                                <option value="year">Year</option>
                                <option value="all">All</option>
                            </select>
                        </div>
                    </div>

                    {/* Legend and baseline toggle */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[hsl(199,89%,48%)]" />
                                <span className="text-[hsl(var(--muted-foreground))]">Sessions</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[#10b981]" />
                                <span className="text-[hsl(var(--muted-foreground))]">Messages</span>
                            </div>
                            {showBaseline && timePeriod !== 'all' && (
                                <>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-[#f97316] opacity-50" />
                                        <span className="text-[hsl(var(--muted-foreground))]">Prev Sessions</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-[#8b5cf6] opacity-50" />
                                        <span className="text-[hsl(var(--muted-foreground))]">Prev Messages</span>
                                    </div>
                                </>
                            )}
                        </div>
                        {timePeriod !== 'all' && (
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showBaseline}
                                    onChange={(e) => setShowBaseline(e.target.checked)}
                                    className="rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]"
                                />
                                <span className="text-[hsl(var(--muted-foreground))]">Show baseline</span>
                            </label>
                        )}
                    </div>

                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={sessionActivityData}>
                                <defs>
                                    {/* Current period gradients */}
                                    <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    {/* Previous period gradients (50% opacity) */}
                                    <linearGradient id="colorPrevSessions" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorPrevMessages" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis
                                    dataKey="date"
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={12}
                                    interval={timePeriod === 'month' ? 4 : 0}
                                />
                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '8px',
                                    }}
                                    formatter={(value, name) => {
                                        const labels: Record<string, string> = {
                                            sessions: 'Sessions',
                                            messages: 'Messages',
                                            prevSessions: 'Prev Sessions',
                                            prevMessages: 'Prev Messages',
                                        };
                                        const numValue = typeof value === 'number' ? value : 0;
                                        return [numValue.toLocaleString(), labels[String(name)] || String(name)];
                                    }}
                                    labelFormatter={(label, payload) => {
                                        const data = (payload as unknown as { payload?: ActivityDataPoint }[])?.[0]?.payload;
                                        return data?.fullDate || String(label);
                                    }}
                                />
                                {/* Previous period areas (rendered first, behind current) */}
                                {showBaseline && timePeriod !== 'all' && (
                                    <>
                                        <Area
                                            type="monotone"
                                            dataKey="prevSessions"
                                            stroke="#f97316"
                                            strokeOpacity={0.5}
                                            strokeDasharray="5 5"
                                            fillOpacity={1}
                                            fill="url(#colorPrevSessions)"
                                            name="prevSessions"
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="prevMessages"
                                            stroke="#8b5cf6"
                                            strokeOpacity={0.5}
                                            strokeDasharray="5 5"
                                            fillOpacity={1}
                                            fill="url(#colorPrevMessages)"
                                            name="prevMessages"
                                        />
                                    </>
                                )}
                                {/* Current period areas */}
                                <Area
                                    type="monotone"
                                    dataKey="sessions"
                                    stroke="hsl(199, 89%, 48%)"
                                    fillOpacity={1}
                                    fill="url(#colorSessions)"
                                    name="sessions"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="messages"
                                    stroke="#10b981"
                                    fillOpacity={1}
                                    fill="url(#colorMessages)"
                                    name="messages"
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
