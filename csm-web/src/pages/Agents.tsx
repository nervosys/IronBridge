import { useState, useMemo } from 'react';
import {
    Bot,
    CheckCircle2,
    Circle,
    Clock,
    Cpu,
    Loader2,
    MessageSquare,
    PauseCircle,
    Play,
    RefreshCw,
    Terminal,
    Zap,
    AlertTriangle,
    ChevronDown,
    ChevronRight,
    Network,
    Settings,
    Plus,
    AlertCircle,
} from 'lucide-react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
} from 'recharts';
import { useApi } from '../context/ApiContext';
import { formatRelativeTime } from '@csm/shared';

// Activity log type for tracking agent actions
interface ActivityLogEntry {
    time: string;
    agent: string;
    action: string;
    type: 'success' | 'warning' | 'error' | 'info' | 'pause';
}

export default function Agents() {
    const { agents, sessions, providers, isLoading, error, refetchAgents } = useApi();
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    const [expandedLogs, setExpandedLogs] = useState(true);

    // Transform API agents data for display
    const agentsData = useMemo(() => {
        return agents.map(agent => {
            // Count sessions that might be associated with this agent's provider
            const agentSessions = sessions.filter(s => s.provider === agent.provider);
            const tokenCount = agentSessions.reduce((sum, s) => sum + (s.tokenCount || 0), 0);
            const messageCount = agentSessions.reduce((sum, s) => sum + s.messageCount, 0);

            return {
                ...agent,
                status: 'idle' as 'idle' | 'running' | 'paused' | 'completed' | 'error', // Agents from API are configurations
                tokens: tokenCount,
                messages: messageCount,
                currentTask: agent.description || 'No active task',
                progress: 0,
                protocol: agent.tools.includes('mcp') ? 'mcp' : undefined,
            };
        });
    }, [agents, sessions]);

    // Generate token usage data from sessions
    const tokenUsageData = useMemo(() => {
        const now = new Date();
        const data = [];
        for (let i = 7; i >= 0; i--) {
            const hour = new Date(now.getTime() - i * 3600000);
            const hourStart = hour.getTime();
            const hourEnd = hourStart + 3600000;
            const hourSessions = sessions.filter(s =>
                s.createdAt >= hourStart && s.createdAt < hourEnd
            );
            const tokens = hourSessions.reduce((sum, s) => sum + (s.tokenCount || 0), 0);
            data.push({
                time: i === 0 ? 'Now' : hour.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                tokens,
            });
        }
        return data;
    }, [sessions]);

    // Generate activity log from recent sessions
    const activityLog = useMemo<ActivityLogEntry[]>(() => {
        return sessions
            .slice(0, 6)
            .map(session => ({
                time: new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                agent: session.provider,
                action: `Session "${session.title}" updated (${session.messageCount} messages)`,
                type: 'info' as const,
            }));
    }, [sessions]);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'running':
                return <Loader2 size={16} className="animate-spin text-green-500" />;
            case 'paused':
                return <PauseCircle size={16} className="text-yellow-500" />;
            case 'completed':
                return <CheckCircle2 size={16} className="text-blue-500" />;
            case 'error':
                return <AlertTriangle size={16} className="text-red-500" />;
            default:
                return <Circle size={16} className="text-gray-500" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'running':
                return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'paused':
                return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            case 'completed':
                return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'error':
                return 'bg-red-500/10 text-red-500 border-red-500/20';
            default:
                return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
        }
    };

    const getLogTypeColor = (type: string) => {
        switch (type) {
            case 'success':
                return 'text-green-500';
            case 'warning':
                return 'text-yellow-500';
            case 'error':
                return 'text-red-500';
            case 'pause':
                return 'text-yellow-500';
            default:
                return 'text-[hsl(var(--muted-foreground))]';
        }
    };

    // Calculate stats from real data
    const totalTokens = agentsData.reduce((sum, a) => sum + a.tokens, 0);
    const totalMessages = agentsData.reduce((sum, a) => sum + a.messages, 0);
    const runningAgents = agentsData.filter(a => a.status === 'running').length;

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
                <p className="text-lg font-medium">Error loading agents</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">{error.message}</p>
                <button
                    onClick={() => refetchAgents()}
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">Agents</h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                        Manage and monitor your AI agent configurations
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => refetchAgents()}
                        className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded-lg hover:bg-[hsl(var(--muted))]/80 transition-colors"
                    >
                        <RefreshCw size={18} />
                        Refresh
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90 transition-colors">
                        <Plus size={18} />
                        New Agent
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Bot size={18} />
                        <span className="text-sm">Total Agents</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{agentsData.length}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{runningAgents} active</p>
                </div>

                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Zap size={18} />
                        <span className="text-sm">Tokens Used</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
                        {totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}K` : totalTokens}
                    </p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">across all sessions</p>
                </div>

                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <MessageSquare size={18} />
                        <span className="text-sm">Messages</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{totalMessages}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">exchanged</p>
                </div>

                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Cpu size={18} />
                        <span className="text-sm">Providers</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{providers.length}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">connected</p>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Agent List */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Agent Configurations</h2>

                    {agentsData.length === 0 ? (
                        <div className="bg-[hsl(var(--card))] rounded-xl p-8 border text-center">
                            <Bot size={48} className="mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
                            <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">No Agents Yet</h3>
                            <p className="text-[hsl(var(--muted-foreground))] mt-2">
                                Create your first agent to get started with automated tasks.
                            </p>
                            <button className="mt-4 flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90 transition-colors mx-auto">
                                <Plus size={18} />
                                Create Agent
                            </button>
                        </div>
                    ) : (
                        agentsData.map(agent => (
                            <div
                                key={agent.id}
                                onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
                                className={`bg-[hsl(var(--card))] rounded-xl p-4 border cursor-pointer transition-all hover:border-[hsl(var(--primary))] ${selectedAgent === agent.id ? 'border-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary))]' : ''
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-[hsl(var(--muted))] rounded-lg">
                                            <Bot size={20} className="text-[hsl(var(--primary))]" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-[hsl(var(--foreground))]">{agent.name}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs border ${getStatusColor(agent.status)}`}>
                                                    {getStatusIcon(agent.status)}
                                                    <span className="ml-1">{agent.status}</span>
                                                </span>
                                            </div>
                                            <p className="text-sm text-[hsl(var(--muted-foreground))]">{agent.provider} • {agent.model}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {agent.status === 'running' && (
                                            <button className="p-2 rounded-lg bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 transition-colors">
                                                <PauseCircle size={18} />
                                            </button>
                                        )}
                                        {agent.status === 'paused' && (
                                            <button className="p-2 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors">
                                                <Play size={18} />
                                            </button>
                                        )}
                                        <button className="p-2 rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/80 transition-colors">
                                            <Settings size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{agent.currentTask}</p>
                                </div>

                                <div className="mt-4 flex items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
                                    <span className="flex items-center gap-1">
                                        <Zap size={14} />
                                        {agent.tokens > 1000 ? `${(agent.tokens / 1000).toFixed(1)}K` : agent.tokens} tokens
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <MessageSquare size={14} />
                                        {agent.messages} messages
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock size={14} />
                                        {formatRelativeTime(agent.updatedAt)}
                                    </span>
                                </div>

                                {/* Tools Badge */}
                                {agent.tools.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-[hsl(var(--border))]">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Network size={14} className="text-[hsl(var(--primary))]" />
                                            <span className="text-sm text-[hsl(var(--muted-foreground))]">Tools:</span>
                                            {agent.tools.slice(0, 3).map(tool => (
                                                <span
                                                    key={tool}
                                                    className="px-2 py-0.5 rounded-full text-xs bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] font-medium"
                                                >
                                                    {tool}
                                                </span>
                                            ))}
                                            {agent.tools.length > 3 && (
                                                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                                    +{agent.tools.length - 3} more
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Right Sidebar */}
                <div className="space-y-4">
                    {/* Token Usage Chart */}
                    <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                        <h3 className="font-medium text-[hsl(var(--foreground))] mb-4">Token Usage</h3>
                        <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={tokenUsageData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="tokens"
                                        stroke="hsl(var(--primary))"
                                        fill="hsl(var(--primary))"
                                        fillOpacity={0.2}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Activity Log */}
                    <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                        <button
                            onClick={() => setExpandedLogs(!expandedLogs)}
                            className="flex items-center justify-between w-full"
                        >
                            <h3 className="font-medium text-[hsl(var(--foreground))] flex items-center gap-2">
                                <Terminal size={18} />
                                Recent Activity
                            </h3>
                            {expandedLogs ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>
                        {expandedLogs && (
                            <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto">
                                {activityLog.length === 0 ? (
                                    <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
                                        No recent activity
                                    </p>
                                ) : (
                                    activityLog.map((log, i) => (
                                        <div key={i} className="flex items-start gap-2 text-sm">
                                            <span className="text-[hsl(var(--muted-foreground))] font-mono shrink-0">{log.time}</span>
                                            <span className={getLogTypeColor(log.type)}>•</span>
                                            <span className="text-[hsl(var(--foreground))]">
                                                <span className="font-medium">{log.agent}:</span> {log.action}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
