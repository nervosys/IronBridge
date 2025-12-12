import { useState } from 'react';
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
    Square,
    Terminal,
    Zap,
    AlertTriangle,
    ChevronDown,
    ChevronRight,
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

// Mock data for active agents
const mockAgents = [
    {
        id: 'agent-1',
        name: 'Code Review Agent',
        status: 'running',
        provider: 'GitHub Copilot',
        startTime: '2024-12-11T10:30:00',
        tokens: 12450,
        messages: 24,
        currentTask: 'Analyzing pull request #142',
        progress: 65,
    },
    {
        id: 'agent-2',
        name: 'Documentation Agent',
        status: 'running',
        provider: 'Claude',
        startTime: '2024-12-11T09:15:00',
        tokens: 28900,
        messages: 56,
        currentTask: 'Generating API documentation',
        progress: 80,
    },
    {
        id: 'agent-3',
        name: 'Test Generator',
        status: 'paused',
        provider: 'GPT-4',
        startTime: '2024-12-11T08:00:00',
        tokens: 8200,
        messages: 18,
        currentTask: 'Writing unit tests for auth module',
        progress: 45,
    },
    {
        id: 'agent-4',
        name: 'Bug Hunter',
        status: 'completed',
        provider: 'DeepSeek',
        startTime: '2024-12-11T07:00:00',
        tokens: 15600,
        messages: 32,
        currentTask: 'Completed security scan',
        progress: 100,
    },
];

// Mock token usage data
const tokenUsageData = [
    { time: '08:00', tokens: 2400 },
    { time: '09:00', tokens: 5200 },
    { time: '10:00', tokens: 8100 },
    { time: '11:00', tokens: 12400 },
    { time: '12:00', tokens: 18900 },
    { time: '13:00', tokens: 24500 },
    { time: '14:00', tokens: 31200 },
    { time: 'Now', tokens: 38150 },
];

// Mock activity log
const activityLog = [
    { time: '14:32', agent: 'Code Review Agent', action: 'Found 3 potential issues in utils.ts', type: 'warning' },
    { time: '14:28', agent: 'Documentation Agent', action: 'Completed API reference for /users endpoint', type: 'success' },
    { time: '14:25', agent: 'Code Review Agent', action: 'Started analyzing src/components/', type: 'info' },
    { time: '14:20', agent: 'Test Generator', action: 'Paused - waiting for code review completion', type: 'pause' },
    { time: '14:15', agent: 'Bug Hunter', action: 'Completed security scan - no critical issues', type: 'success' },
    { time: '14:10', agent: 'Documentation Agent', action: 'Processing 42 source files', type: 'info' },
];

export default function Agents() {
    const [agents] = useState(mockAgents);
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    const [expandedLogs, setExpandedLogs] = useState(true);

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

    const totalTokens = agents.reduce((sum, a) => sum + a.tokens, 0);
    const totalMessages = agents.reduce((sum, a) => sum + a.messages, 0);
    const runningAgents = agents.filter(a => a.status === 'running').length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">Agents</h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                        Real-time monitoring of active agents and swarms
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded-lg hover:bg-[hsl(var(--muted))]/80 transition-colors">
                        <RefreshCw size={18} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Bot size={18} />
                        <span className="text-sm">Active Agents</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{runningAgents}</p>
                    <p className="text-sm text-green-500">of {agents.length} total</p>
                </div>

                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Zap size={18} />
                        <span className="text-sm">Tokens Used</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{(totalTokens / 1000).toFixed(1)}K</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">this session</p>
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
                        <span className="text-sm">Avg Response</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">1.2s</p>
                    <p className="text-sm text-green-500">-0.3s vs avg</p>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Agent List */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Active Agents</h2>
                    {agents.map(agent => (
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
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">{agent.provider}</p>
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
                                    <button className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
                                        <Square size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4">
                                <div className="flex items-center justify-between text-sm mb-1">
                                    <span className="text-[hsl(var(--muted-foreground))]">{agent.currentTask}</span>
                                    <span className="text-[hsl(var(--foreground))]">{agent.progress}%</span>
                                </div>
                                <div className="h-2 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[hsl(var(--primary))] rounded-full transition-all"
                                        style={{ width: `${agent.progress}%` }}
                                    />
                                </div>
                            </div>

                            <div className="mt-4 flex items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
                                <span className="flex items-center gap-1">
                                    <Zap size={14} />
                                    {(agent.tokens / 1000).toFixed(1)}K tokens
                                </span>
                                <span className="flex items-center gap-1">
                                    <MessageSquare size={14} />
                                    {agent.messages} messages
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock size={14} />
                                    Started {new Date(agent.startTime).toLocaleTimeString()}
                                </span>
                            </div>
                        </div>
                    ))}
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
                                Activity Log
                            </h3>
                            {expandedLogs ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>
                        {expandedLogs && (
                            <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto">
                                {activityLog.map((log, i) => (
                                    <div key={i} className="flex items-start gap-2 text-sm">
                                        <span className="text-[hsl(var(--muted-foreground))] font-mono shrink-0">{log.time}</span>
                                        <span className={getLogTypeColor(log.type)}>•</span>
                                        <span className="text-[hsl(var(--foreground))]">
                                            <span className="font-medium">{log.agent}:</span> {log.action}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
