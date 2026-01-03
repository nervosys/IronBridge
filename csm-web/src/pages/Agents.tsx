import { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
    Users,
    Trash2,
    UserPlus,
    Power,
    PowerOff,
    ExternalLink,
    Brain,
    Code,
    Search,
    FileText,
    Lightbulb,
    GitBranch,
    Shield,
    Sparkles,
    Wrench,
    Monitor,
    Globe,
    Share2,
    FlaskConical,
    Wifi,
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
import { useCreateSwarm, useDeleteSwarm, useUpdateSwarm } from '../hooks/useApi';
import { formatRelativeTime, formatTime, AGENT_ROLES } from '@csm/shared';
import type { Agent, Swarm, SwarmStatus } from '../api/types';

// ==================== TYPES ====================

type DisplayStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

// Extended agent data for display
interface AgentDisplayData {
    id: string;
    name: string;
    description?: string | null;
    providerId?: string | null;
    model?: string;
    tools?: string[];
    systemPrompt?: string;
    temperature?: number | null;
    maxTokens?: number | null;
    role?: string;
    updatedAt: number;
    createdAt: number;
    status: DisplayStatus;
    tokens: number;
    messages: number;
    currentTask: string;
    progress: number;
    protocol?: string;
    roleInfo: {
        label: string;
        color: string;
        icon?: string;
    };
}

// Token usage data point
interface TokenUsageDataPoint {
    time: string;
    tokens: number;
}

// Activity log type for tracking agent actions
interface ActivityLogEntry {
    time: string;
    agent: string;
    action: string;
    type: 'success' | 'warning' | 'error' | 'info' | 'pause';
}

// ==================== SWARMS CONSTANTS ====================

// Agent role definitions with icons
const agentRoles = [
    { id: 'coordinator', name: 'Coordinator', icon: Brain, color: '#8b5cf6', description: 'Orchestrates task flow' },
    { id: 'researcher', name: 'Researcher', icon: Search, color: '#3b82f6', description: 'Gathers information' },
    { id: 'coder', name: 'Coder', icon: Code, color: '#10b981', description: 'Writes & reviews code' },
    { id: 'reviewer', name: 'Reviewer', icon: FileText, color: '#f59e0b', description: 'Validates outputs' },
    { id: 'planner', name: 'Planner', icon: Lightbulb, color: '#ec4899', description: 'Creates strategies' },
    { id: 'executor', name: 'Executor', icon: GitBranch, color: '#06b6d4', description: 'Runs operations' },
    { id: 'validator', name: 'Validator', icon: Shield, color: '#84cc16', description: 'Ensures quality' },
    { id: 'specialist', name: 'Specialist', icon: Sparkles, color: '#f97316', description: 'Domain expert' },
];

// Execution patterns for swarms
const executionPatterns = [
    { id: 'sequential', name: 'Sequential', description: 'One agent at a time' },
    { id: 'parallel', name: 'Parallel', description: 'All agents simultaneously' },
    { id: 'hierarchical', name: 'Hierarchical', description: 'Leader-worker structure' },
    { id: 'collaborative', name: 'Collaborative', description: 'Peer-to-peer cooperation' },
    { id: 'competitive', name: 'Competitive', description: 'Best result wins' },
];

// Swarm Intelligence Algorithms
const swarmAlgorithms = [
    { id: 'pso', name: 'Particle Swarm', description: 'Optimizes via social behavior' },
    { id: 'aco', name: 'Ant Colony', description: 'Pheromone-based pathfinding' },
    { id: 'abc', name: 'Artificial Bee', description: 'Foraging optimization' },
    { id: 'gso', name: 'Glowworm Swarm', description: 'Local optima discovery' },
    { id: 'fa', name: 'Firefly Algorithm', description: 'Attraction-based search' },
    { id: 'ba', name: 'Bat Algorithm', description: 'Echolocation optimization' },
];

// Consensus Protocols
const consensusProtocols = [
    { id: 'pbft', name: 'PBFT', description: 'Byzantine fault tolerance' },
    { id: 'raft', name: 'Raft', description: 'Leader-based consensus' },
    { id: 'voting', name: 'Majority Voting', description: 'Democratic decision making' },
    { id: 'federated', name: 'Federated', description: 'Distributed learning consensus' },
];

// Communication Protocols
const communicationProtocols = [
    { id: 'broadcast', name: 'Broadcast', description: 'One-to-all messaging' },
    { id: 'gossip', name: 'Gossip Protocol', description: 'Epidemic information spread' },
    { id: 'pubsub', name: 'Pub/Sub', description: 'Topic-based messaging' },
    { id: 'rpc', name: 'RPC', description: 'Direct request-response' },
];

// ==================== HELPERS ====================

// Use shared agent roles for display
const getAgentRoleInfo = (role: string) => {
    const roleInfo = AGENT_ROLES[role as keyof typeof AGENT_ROLES];
    return roleInfo || AGENT_ROLES.custom;
};

const getStatusIcon = (status: string) => {
    switch (status) {
        case 'running':
        case 'active':
            return <Loader2 size={16} className="animate-spin text-green-500" />;
        case 'paused':
        case 'inactive':
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
        case 'active':
            return 'bg-green-500/10 text-green-500 border-green-500/20';
        case 'paused':
        case 'inactive':
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

// Agent type tabs configuration
type AgentTypeTab = 'all' | 'swe' | 'os' | 'network' | 'cyber' | 'web' | 'social' | 'research' | 'swarms';

const agentTypeTabs: { id: AgentTypeTab; label: string; icon: typeof Bot; path: string }[] = [
    { id: 'all', label: 'All Agents', icon: Bot, path: '/agents' },
    { id: 'swe', label: 'SWE', icon: Wrench, path: '/agents/swe' },
    { id: 'os', label: 'OS', icon: Monitor, path: '/agents/os' },
    { id: 'network', label: 'Network', icon: Wifi, path: '/agents/network' },
    { id: 'cyber', label: 'Cyber', icon: Shield, path: '/agents/cyber' },
    { id: 'web', label: 'Web', icon: Globe, path: '/agents/web' },
    { id: 'social', label: 'Social', icon: Share2, path: '/agents/social' },
    { id: 'research', label: 'Research', icon: FlaskConical, path: '/agents/research' },
    { id: 'swarms', label: 'Swarms', icon: Network, path: '/agents/swarms' },
];

// ==================== MAIN COMPONENT ====================

export default function Agents() {
    const location = useLocation();
    const {
        agents,
        sessions,
        providers,
        swarms,
        isLoading,
        error,
        refetchAgents,
        refetchSwarms,
    } = useApi();

    // Swarm mutation hooks
    const createSwarm = useCreateSwarm();
    const deleteSwarm = useDeleteSwarm();
    const updateSwarm = useUpdateSwarm();

    // Determine active tab from URL
    const activeTab = useMemo((): AgentTypeTab => {
        const path = location.pathname;
        if (path === '/agents/swe') return 'swe';
        if (path === '/agents/os') return 'os';
        if (path === '/agents/network') return 'network';
        if (path === '/agents/cyber') return 'cyber';
        if (path === '/agents/web') return 'web';
        if (path === '/agents/social') return 'social';
        if (path === '/agents/research') return 'research';
        if (path === '/agents/swarms') return 'swarms';
        return 'all';
    }, [location.pathname]);

    // Agents tab state
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    const [expandedLogs, setExpandedLogs] = useState(true);

    // Swarms tab state
    const [selectedSwarm, setSelectedSwarm] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showAddAgentModal, setShowAddAgentModal] = useState(false);
    const [newSwarmName, setNewSwarmName] = useState('');
    const [newSwarmDescription, setNewSwarmDescription] = useState('');

    // ==================== AGENTS DATA ====================

    // Transform API agents data for display
    const agentsData = useMemo((): AgentDisplayData[] => {
        return agents.map(agent => {
            const agentSessions = sessions.filter(s => s.provider === agent.providerId);
            const tokenCount = agentSessions.reduce((sum, s) => sum + (s.tokenCount || 0), 0);
            const messageCount = agentSessions.reduce((sum, s) => sum + s.messageCount, 0);
            const sharedRoleInfo = getAgentRoleInfo(agent.role || 'custom');

            return {
                id: agent.id,
                name: agent.name,
                description: agent.description,
                providerId: agent.providerId,
                model: agent.model,
                tools: agent.tools,
                systemPrompt: agent.systemPrompt,
                temperature: agent.temperature,
                maxTokens: agent.maxTokens,
                role: agent.role,
                updatedAt: agent.updatedAt,
                createdAt: agent.createdAt,
                status: 'idle' as DisplayStatus,
                tokens: tokenCount,
                messages: messageCount,
                currentTask: agent.description || 'No active task',
                progress: 0,
                protocol: agent.tools?.includes('mcp') ? 'mcp' : undefined,
                roleInfo: {
                    label: sharedRoleInfo.name,
                    color: sharedRoleInfo.color,
                    icon: sharedRoleInfo.icon,
                },
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
                time: i === 0 ? 'Now' : formatTime(hour),
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
                time: formatTime(session.updatedAt),
                agent: session.provider,
                action: `Session "${session.title}" updated (${session.messageCount} messages)`,
                type: 'info' as const,
            }));
    }, [sessions]);

    // Calculate stats from real data
    const totalTokens = agentsData.reduce((sum, a) => sum + a.tokens, 0);
    const totalMessages = agentsData.reduce((sum, a) => sum + a.messages, 0);
    const runningAgents = agentsData.filter(a => a.status === 'running').length;

    // ==================== SWARMS HANDLERS ====================

    const selectedSwarmData = useMemo(() => {
        return swarms.find(s => s.id === selectedSwarm);
    }, [swarms, selectedSwarm]);

    const handleToggleStatus = async (swarmId: string, currentStatus: string) => {
        // Toggle between 'running' and 'paused' states
        const newStatus = currentStatus === 'running' ? 'paused' : 'running';
        await updateSwarm.mutate({ id: swarmId, data: { status: newStatus as SwarmStatus } });
    };

    const handleDeleteSwarm = async (swarmId: string) => {
        if (confirm('Are you sure you want to delete this swarm?')) {
            await deleteSwarm.mutate(swarmId);
            if (selectedSwarm === swarmId) {
                setSelectedSwarm(null);
            }
        }
    };

    const handleCreateSwarm = async () => {
        if (!newSwarmName.trim()) return;
        await createSwarm.mutate({
            name: newSwarmName.trim(),
            description: newSwarmDescription.trim() || undefined,
            status: 'idle',
        });
        setShowCreateModal(false);
        setNewSwarmName('');
        setNewSwarmDescription('');
    };

    const handleRefresh = () => {
        if (activeTab === 'swarms') {
            refetchSwarms();
        } else {
            refetchAgents();
        }
    };

    // Filter agents by type based on active tab
    const filteredAgentsData = useMemo(() => {
        if (activeTab === 'all' || activeTab === 'swarms') return agentsData;

        // Map tab to agent roles
        const roleMapping: Record<string, string[]> = {
            swe: ['developer', 'code_review'],
            os: ['assistant'], // OS agents typically are assistants
            network: ['network', 'infrastructure'],
            cyber: ['security', 'analyst'],
            web: ['web_search', 'data_collection'],
            social: ['writer', 'manager'],
            research: ['researcher', 'analyst'],
        };

        const targetRoles = roleMapping[activeTab] || [];
        return agentsData.filter(agent =>
            targetRoles.includes(agent.role || '') ||
            (activeTab === 'swe' && agent.tools?.some(t => t.toLowerCase().includes('code'))) ||
            (activeTab === 'network' && agent.tools?.some(t => t.toLowerCase().includes('network') || t.toLowerCase().includes('ssh') || t.toLowerCase().includes('ping'))) ||
            (activeTab === 'cyber' && agent.tools?.some(t => t.toLowerCase().includes('security') || t.toLowerCase().includes('scan') || t.toLowerCase().includes('vuln'))) ||
            (activeTab === 'web' && agent.tools?.some(t => t.toLowerCase().includes('web') || t.toLowerCase().includes('search'))) ||
            (activeTab === 'research' && agent.tools?.some(t => t.toLowerCase().includes('research') || t.toLowerCase().includes('search')))
        );
    }, [agentsData, activeTab]);

    // ==================== LOADING / ERROR ====================

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-[hsl(var(--primary))]" size={32} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-[hsl(var(--destructive))]">
                <AlertCircle size={48} className="mb-4" />
                <p className="text-lg font-medium">Error loading data</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">{error.message}</p>
                <button
                    onClick={handleRefresh}
                    className="mt-4 px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90"
                >
                    Retry
                </button>
            </div>
        );
    }

    // ==================== RENDER ====================

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">Agents</h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                        Manage AI agents and orchestrate multi-agent swarms
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRefresh}
                        className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded-lg hover:bg-[hsl(var(--muted))]/80 transition-colors"
                    >
                        <RefreshCw size={18} />
                        Refresh
                    </button>
                    {activeTab === 'swarms' ? (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90 transition-colors"
                        >
                            <Plus size={18} />
                            New Swarm
                        </button>
                    ) : (
                        <button className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90 transition-colors">
                            <Plus size={18} />
                            New Agent
                        </button>
                    )}
                </div>
            </div>

            {/* Agent Type Tabs */}
            <div className="flex border-b border-[hsl(var(--border))] overflow-x-auto">
                {agentTypeTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    const count = tab.id === 'swarms' ? swarms.length :
                        tab.id === 'all' ? agentsData.length :
                            filteredAgentsData.length;

                    return (
                        <Link
                            key={tab.id}
                            to={tab.path}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${isActive
                                ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                                : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                                }`}
                        >
                            <Icon size={18} />
                            {tab.label}
                            {tab.id === activeTab && (
                                <span className="px-2 py-0.5 bg-[hsl(var(--muted))] rounded-full text-xs">
                                    {count}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </div>

            {/* Tab Content */}
            {activeTab === 'swarms' ? (
                <SwarmsTab
                    swarms={swarms}
                    agents={agents}
                    selectedSwarm={selectedSwarm}
                    setSelectedSwarm={setSelectedSwarm}
                    selectedSwarmData={selectedSwarmData}
                    handleToggleStatus={handleToggleStatus}
                    handleDeleteSwarm={handleDeleteSwarm}
                    setShowAddAgentModal={setShowAddAgentModal}
                />
            ) : (
                <AgentsTab
                    agentsData={filteredAgentsData}
                    selectedAgent={selectedAgent}
                    setSelectedAgent={setSelectedAgent}
                    tokenUsageData={tokenUsageData}
                    activityLog={activityLog}
                    expandedLogs={expandedLogs}
                    setExpandedLogs={setExpandedLogs}
                    totalTokens={totalTokens}
                    totalMessages={totalMessages}
                    runningAgents={runningAgents}
                    providersCount={providers.length}
                />
            )}

            {/* Create Swarm Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[hsl(var(--card))] rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] mb-4">Create New Swarm</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">Name</label>
                                <input
                                    type="text"
                                    value={newSwarmName}
                                    onChange={(e) => setNewSwarmName(e.target.value)}
                                    className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                    placeholder="My Agent Swarm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">Description</label>
                                <textarea
                                    value={newSwarmDescription}
                                    onChange={(e) => setNewSwarmDescription(e.target.value)}
                                    className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] resize-none"
                                    rows={3}
                                    placeholder="What will this swarm accomplish?"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">Execution Pattern</label>
                                <select className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]">
                                    {executionPatterns.map(pattern => (
                                        <option key={pattern.id} value={pattern.id}>{pattern.name} - {pattern.description}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Protocol Configuration Section */}
                            <div className="border-t border-[hsl(var(--border))] pt-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Network size={16} className="text-[hsl(var(--primary))]" />
                                    <span className="text-sm font-medium text-[hsl(var(--foreground))]">Protocol Configuration</span>
                                    <Link to="/agency/protocols" className="ml-auto text-xs text-[hsl(var(--primary))] hover:underline" onClick={() => setShowCreateModal(false)}>
                                        Learn more
                                    </Link>
                                </div>

                                <div className="mb-3">
                                    <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">Swarm Intelligence Algorithm</label>
                                    <select className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]">
                                        <option value="">None (basic orchestration)</option>
                                        {swarmAlgorithms.map(alg => (
                                            <option key={alg.id} value={alg.id}>{alg.name} - {alg.description}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="mb-3">
                                    <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">Consensus Protocol</label>
                                    <select className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]">
                                        <option value="">None</option>
                                        {consensusProtocols.map(proto => (
                                            <option key={proto.id} value={proto.id}>{proto.name} - {proto.description}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">Communication Protocol</label>
                                    <select className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]">
                                        <option value="">Direct messaging</option>
                                        {communicationProtocols.map(proto => (
                                            <option key={proto.id} value={proto.id}>{proto.name} - {proto.description}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateSwarm}
                                disabled={createSwarm.isLoading || !newSwarmName.trim()}
                                className="px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90 transition-colors disabled:opacity-50"
                            >
                                {createSwarm.isLoading ? 'Creating...' : 'Create Swarm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Agent Modal */}
            {showAddAgentModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[hsl(var(--card))] rounded-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] mb-4">Add Agent to Swarm</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">Select Agent</label>
                                <select className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]">
                                    {agents.length === 0 ? (
                                        <option disabled>No agents available</option>
                                    ) : (
                                        agents.map(agent => (
                                            <option key={agent.id} value={agent.id}>{agent.name} ({agent.providerId || 'N/A'})</option>
                                        ))
                                    )}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">Role in Swarm</label>
                                <select className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]">
                                    {agentRoles.map(role => (
                                        <option key={role.id} value={role.id}>{role.name} - {role.description}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setShowAddAgentModal(false)}
                                className="px-4 py-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => setShowAddAgentModal(false)}
                                className="px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90 transition-colors"
                            >
                                Add Agent
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ==================== AGENTS TAB COMPONENT ====================

interface AgentsTabProps {
    agentsData: AgentDisplayData[];
    selectedAgent: string | null;
    setSelectedAgent: (id: string | null) => void;
    tokenUsageData: TokenUsageDataPoint[];
    activityLog: ActivityLogEntry[];
    expandedLogs: boolean;
    setExpandedLogs: (expanded: boolean) => void;
    totalTokens: number;
    totalMessages: number;
    runningAgents: number;
    providersCount: number;
}

function AgentsTab({
    agentsData,
    selectedAgent,
    setSelectedAgent,
    tokenUsageData,
    activityLog,
    expandedLogs,
    setExpandedLogs,
    totalTokens,
    totalMessages,
    runningAgents,
    providersCount,
}: AgentsTabProps) {
    return (
        <>
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
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{providersCount}</p>
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
                                            <p className="text-sm text-[hsl(var(--muted-foreground))]">{agent.providerId || 'N/A'} • {agent.model}</p>
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

                                {(agent.tools?.length ?? 0) > 0 && (
                                    <div className="mt-4 pt-4 border-t border-[hsl(var(--border))]">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Network size={14} className="text-[hsl(var(--primary))]" />
                                            <span className="text-sm text-[hsl(var(--muted-foreground))]">Tools:</span>
                                            {agent.tools?.slice(0, 3).map((tool: string) => (
                                                <span
                                                    key={tool}
                                                    className="px-2 py-0.5 rounded-full text-xs bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] font-medium"
                                                >
                                                    {tool}
                                                </span>
                                            ))}
                                            {(agent.tools?.length ?? 0) > 3 && (
                                                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                                    +{(agent.tools?.length ?? 0) - 3} more
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
        </>
    );
}

// ==================== SWARMS TAB COMPONENT ====================

interface SwarmsTabProps {
    swarms: Swarm[];
    agents: Agent[];
    selectedSwarm: string | null;
    setSelectedSwarm: (id: string | null) => void;
    selectedSwarmData: Swarm | undefined;
    handleToggleStatus: (id: string, status: string) => void;
    handleDeleteSwarm: (id: string) => void;
    setShowAddAgentModal: (show: boolean) => void;
}

function SwarmsTab({
    swarms,
    agents,
    selectedSwarm,
    setSelectedSwarm,
    selectedSwarmData,
    handleToggleStatus,
    handleDeleteSwarm,
    setShowAddAgentModal,
}: SwarmsTabProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Swarm List */}
            <div className="space-y-4">
                <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Your Swarms</h2>

                {swarms.length === 0 ? (
                    <div className="bg-[hsl(var(--card))] rounded-xl p-8 border text-center">
                        <Users size={48} className="mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
                        <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">No Swarms Yet</h3>
                        <p className="text-[hsl(var(--muted-foreground))] mt-2">
                            Create your first swarm to orchestrate multi-agent teams.
                        </p>
                    </div>
                ) : (
                    swarms.map(swarm => (
                        <div
                            key={swarm.id}
                            onClick={() => setSelectedSwarm(swarm.id)}
                            className={`bg-[hsl(var(--card))] rounded-xl p-4 border cursor-pointer transition-all hover:border-[hsl(var(--primary))] ${selectedSwarm === swarm.id ? 'border-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary))]' : ''
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-[hsl(var(--muted))] rounded-lg">
                                        <Users size={20} className="text-[hsl(var(--primary))]" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-[hsl(var(--foreground))]">{swarm.name}</h3>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                            {swarm.agents?.length || 0} agents
                                        </p>
                                    </div>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-xs border ${getStatusColor(swarm.status)}`}>
                                    {getStatusIcon(swarm.status)}
                                    <span className="ml-1">{swarm.status}</span>
                                </span>
                            </div>
                            {swarm.description && (
                                <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))] line-clamp-2">
                                    {swarm.description}
                                </p>
                            )}
                            <div className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">
                                Updated {formatRelativeTime(swarm.updatedAt)}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Swarm Details */}
            {selectedSwarmData ? (
                <div className="lg:col-span-2 space-y-4">
                    {/* Swarm Header */}
                    <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">{selectedSwarmData.name}</h2>
                                {selectedSwarmData.description && (
                                    <p className="text-[hsl(var(--muted-foreground))] mt-1">{selectedSwarmData.description}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleToggleStatus(selectedSwarmData.id, selectedSwarmData.status)}
                                    className={`p-2 rounded-lg transition-colors ${selectedSwarmData.status === 'running'
                                        ? 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20'
                                        : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                                        }`}
                                    title={selectedSwarmData.status === 'running' ? 'Pause' : 'Start'}
                                >
                                    {selectedSwarmData.status === 'running' ? <PowerOff size={18} /> : <Power size={18} />}
                                </button>
                                <button
                                    onClick={() => handleDeleteSwarm(selectedSwarmData.id)}
                                    className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                                    title="Delete Swarm"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-4">
                            <div className="bg-[hsl(var(--muted))] rounded-lg p-3">
                                <div className="text-sm text-[hsl(var(--muted-foreground))]">Agents</div>
                                <div className="text-xl font-semibold text-[hsl(var(--foreground))]">
                                    {selectedSwarmData.agents?.length || 0}
                                </div>
                            </div>
                            <div className="bg-[hsl(var(--muted))] rounded-lg p-3">
                                <div className="text-sm text-[hsl(var(--muted-foreground))]">Status</div>
                                <div className="text-xl font-semibold text-[hsl(var(--foreground))] capitalize">
                                    {selectedSwarmData.status}
                                </div>
                            </div>
                            <div className="bg-[hsl(var(--muted))] rounded-lg p-3">
                                <div className="text-sm text-[hsl(var(--muted-foreground))]">Workflow</div>
                                <div className="text-xl font-semibold text-[hsl(var(--foreground))]">
                                    {selectedSwarmData.workflow?.nodes?.length ? `${selectedSwarmData.workflow.nodes.length} nodes` : 'Sequential'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Agents in Swarm */}
                    <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-medium text-[hsl(var(--foreground))]">Swarm Agents</h3>
                            <button
                                onClick={() => setShowAddAgentModal(true)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90 transition-colors text-sm"
                            >
                                <UserPlus size={16} />
                                Add Agent
                            </button>
                        </div>
                        <div className="space-y-2">
                            {(!selectedSwarmData.agents || selectedSwarmData.agents.length === 0) ? (
                                <p className="text-[hsl(var(--muted-foreground))] text-center py-4">
                                    No agents in this swarm yet
                                </p>
                            ) : (
                                selectedSwarmData.agents.map((swarmAgent) => {
                                    const agent = agents.find(a => a.id === swarmAgent.agentId);
                                    return (
                                        <div
                                            key={swarmAgent.agentId}
                                            className="flex items-center gap-3 p-3 bg-[hsl(var(--muted))] rounded-lg"
                                        >
                                            <div className="p-2 bg-[hsl(var(--card))] rounded-lg">
                                                <Bot size={18} className="text-[hsl(var(--primary))]" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-medium text-[hsl(var(--foreground))]">
                                                    {agent?.name || 'Unknown Agent'} <span className="text-xs text-[hsl(var(--muted-foreground))]">({swarmAgent.role})</span>
                                                </div>
                                                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                                                    {agent?.providerId || 'N/A'} • {agent?.model || 'N/A'}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Agent Roles Reference */}
                    <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                        <h3 className="font-medium text-[hsl(var(--foreground))] mb-4">Available Agent Roles</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {agentRoles.map(role => {
                                const RoleIcon = role.icon;
                                return (
                                    <div
                                        key={role.id}
                                        className="p-3 bg-[hsl(var(--muted))] rounded-lg text-center"
                                    >
                                        <div
                                            className="w-10 h-10 mx-auto mb-2 rounded-lg flex items-center justify-center"
                                            style={{ backgroundColor: role.color + '20' }}
                                        >
                                            <RoleIcon size={20} style={{ color: role.color }} />
                                        </div>
                                        <div className="text-sm font-medium text-[hsl(var(--foreground))]">{role.name}</div>
                                        <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{role.description}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Protocols Quick Reference */}
                    <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Network size={18} className="text-[hsl(var(--primary))]" />
                                <h3 className="font-medium text-[hsl(var(--foreground))]">Available Protocols</h3>
                            </div>
                            <Link to="/agency/protocols" className="text-sm text-[hsl(var(--primary))] hover:underline flex items-center gap-1">
                                <ExternalLink size={14} />
                                View All
                            </Link>
                        </div>

                        {/* Swarm Intelligence */}
                        <div className="mb-4">
                            <h4 className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">Swarm Intelligence</h4>
                            <div className="flex flex-wrap gap-2">
                                {swarmAlgorithms.map(alg => (
                                    <span
                                        key={alg.id}
                                        className="px-2 py-1 bg-purple-500/10 text-purple-500 rounded-full text-xs font-medium"
                                        title={alg.description}
                                    >
                                        {alg.name}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Consensus Protocols */}
                        <div className="mb-4">
                            <h4 className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">Consensus & Learning</h4>
                            <div className="flex flex-wrap gap-2">
                                {consensusProtocols.map(proto => (
                                    <span
                                        key={proto.id}
                                        className="px-2 py-1 bg-green-500/10 text-green-500 rounded-full text-xs font-medium"
                                        title={proto.description}
                                    >
                                        {proto.name}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Communication Protocols */}
                        <div>
                            <h4 className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">Communication</h4>
                            <div className="flex flex-wrap gap-2">
                                {communicationProtocols.map(proto => (
                                    <span
                                        key={proto.id}
                                        className="px-2 py-1 bg-blue-500/10 text-blue-500 rounded-full text-xs font-medium"
                                        title={proto.description}
                                    >
                                        {proto.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="lg:col-span-2 flex items-center justify-center bg-[hsl(var(--card))] rounded-xl border p-12">
                    <div className="text-center">
                        <Users size={48} className="mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
                        <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">Select a Swarm</h3>
                        <p className="text-[hsl(var(--muted-foreground))] mt-1">Choose a swarm to view details and manage agents</p>
                    </div>
                </div>
            )}
        </div>
    );
}
