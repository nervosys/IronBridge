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
import { MessageSquare, FolderOpen, Server, Database, TrendingUp, Clock } from 'lucide-react';

// Mock data for charts
const sessionActivityData = [
    { date: 'Mon', sessions: 12, messages: 145 },
    { date: 'Tue', sessions: 19, messages: 234 },
    { date: 'Wed', sessions: 15, messages: 189 },
    { date: 'Thu', sessions: 23, messages: 312 },
    { date: 'Fri', sessions: 28, messages: 398 },
    { date: 'Sat', sessions: 8, messages: 87 },
    { date: 'Sun', sessions: 11, messages: 124 },
];

const providerData = [
    { name: 'GitHub Copilot', sessions: 156, color: '#0ea5e9' },
    { name: 'ChatGPT', sessions: 89, color: '#10b981' },
    { name: 'Claude', sessions: 67, color: '#f59e0b' },
    { name: 'Ollama', sessions: 45, color: '#8b5cf6' },
    { name: 'Cursor', sessions: 34, color: '#ec4899' },
];

const recentSessions = [
    { id: '1', title: 'Implementing auth flow', provider: 'GitHub Copilot', time: '5 min ago', messages: 23 },
    { id: '2', title: 'Debug API endpoint', provider: 'ChatGPT', time: '1 hour ago', messages: 15 },
    { id: '3', title: 'React component help', provider: 'Claude', time: '2 hours ago', messages: 31 },
    { id: '4', title: 'Database optimization', provider: 'Ollama', time: '3 hours ago', messages: 8 },
    { id: '5', title: 'CSS layout issues', provider: 'Cursor', time: '5 hours ago', messages: 12 },
];

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

export default function Dashboard() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <p className="text-[hsl(var(--muted-foreground))] mt-1">
                    Overview of your chat sessions across all providers
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    icon={MessageSquare}
                    label="Total Sessions"
                    value="391"
                    change="+12% from last week"
                    changeType="positive"
                />
                <StatCard
                    icon={FolderOpen}
                    label="Workspaces"
                    value="24"
                    change="+3 new"
                    changeType="positive"
                />
                <StatCard
                    icon={Server}
                    label="Active Providers"
                    value="5"
                />
                <StatCard
                    icon={Database}
                    label="Harvested Messages"
                    value="4,892"
                    change="+234 today"
                    changeType="positive"
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
                                    innerRadius={50}
                                    outerRadius={70}
                                    paddingAngle={2}
                                    dataKey="sessions"
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
                        {recentSessions.map((session) => (
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
                        ))}
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
