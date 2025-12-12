import { useState } from 'react';
import {
    Users,
    Plus,
    Play,
    Pause,
    Settings,
    Trash2,
    Bot,
    Brain,
    Code,
    FileText,
    Search,
    Zap,
    Target,
    GitBranch,
    CheckCircle2,
    Clock,
    AlertCircle,
} from 'lucide-react';

// Agent role templates
const agentRoles = [
    { id: 'researcher', name: 'Researcher', icon: Search, color: '#3b82f6', description: 'Gathers information and analyzes data' },
    { id: 'coder', name: 'Coder', icon: Code, color: '#22c55e', description: 'Writes and reviews code' },
    { id: 'writer', name: 'Writer', icon: FileText, color: '#f59e0b', description: 'Creates documentation and content' },
    { id: 'reviewer', name: 'Reviewer', icon: Target, color: '#ef4444', description: 'Reviews and provides feedback' },
    { id: 'planner', name: 'Planner', icon: Brain, color: '#8b5cf6', description: 'Plans and coordinates tasks' },
    { id: 'debugger', name: 'Debugger', icon: Zap, color: '#ec4899', description: 'Finds and fixes issues' },
    { id: 'tester', name: 'Tester', icon: CheckCircle2, color: '#14b8a6', description: 'Tests and validates solutions' },
    { id: 'architect', name: 'Architect', icon: GitBranch, color: '#6366f1', description: 'Designs system architecture' },
];

// Provider options
const providers = [
    { id: 'copilot', name: 'GitHub Copilot', icon: '🤖' },
    { id: 'openai', name: 'OpenAI GPT-4', icon: '🧠' },
    { id: 'anthropic', name: 'Claude', icon: '🔮' },
    { id: 'deepseek', name: 'DeepSeek', icon: '🔍' },
    { id: 'ollama', name: 'Ollama (Local)', icon: '🦙' },
    { id: 'lmstudio', name: 'LM Studio', icon: '🎬' },
];

// Execution patterns
const executionPatterns = [
    { id: 'sequential', name: 'Sequential', description: 'Agents work one after another' },
    { id: 'parallel', name: 'Parallel', description: 'Agents work simultaneously' },
    { id: 'hierarchical', name: 'Hierarchical', description: 'Lead agent coordinates others' },
    { id: 'collaborative', name: 'Collaborative', description: 'Agents discuss and reach consensus' },
    { id: 'competitive', name: 'Competitive', description: 'Agents compete for best solution' },
];

interface Agent {
    id: string;
    name: string;
    role: string;
    provider: string;
    model: string;
    status: 'idle' | 'working' | 'completed' | 'error';
    tasksCompleted: number;
    tokensUsed: number;
}

interface Swarm {
    id: string;
    name: string;
    description: string;
    agents: Agent[];
    pattern: string;
    status: 'idle' | 'running' | 'paused' | 'completed';
    createdAt: Date;
    totalTasks: number;
    completedTasks: number;
}

// Demo swarms
const demoSwarms: Swarm[] = [
    {
        id: '1',
        name: 'Code Review Pipeline',
        description: 'Automated code review with multiple specialized agents',
        agents: [
            { id: 'a1', name: 'Security Scanner', role: 'reviewer', provider: 'anthropic', model: 'claude-3-opus', status: 'completed', tasksCompleted: 12, tokensUsed: 45000 },
            { id: 'a2', name: 'Performance Analyzer', role: 'debugger', provider: 'openai', model: 'gpt-4', status: 'working', tasksCompleted: 8, tokensUsed: 32000 },
            { id: 'a3', name: 'Style Checker', role: 'reviewer', provider: 'copilot', model: 'gpt-4', status: 'idle', tasksCompleted: 0, tokensUsed: 0 },
        ],
        pattern: 'sequential',
        status: 'running',
        createdAt: new Date(Date.now() - 3600000),
        totalTasks: 25,
        completedTasks: 20,
    },
    {
        id: '2',
        name: 'Research Assistant Team',
        description: 'Collaborative research and documentation team',
        agents: [
            { id: 'b1', name: 'Data Gatherer', role: 'researcher', provider: 'perplexity', model: 'sonar-pro', status: 'completed', tasksCompleted: 15, tokensUsed: 28000 },
            { id: 'b2', name: 'Summarizer', role: 'writer', provider: 'anthropic', model: 'claude-3-sonnet', status: 'completed', tasksCompleted: 15, tokensUsed: 41000 },
            { id: 'b3', name: 'Fact Checker', role: 'reviewer', provider: 'openai', model: 'gpt-4', status: 'completed', tasksCompleted: 15, tokensUsed: 22000 },
        ],
        pattern: 'collaborative',
        status: 'completed',
        createdAt: new Date(Date.now() - 86400000),
        totalTasks: 15,
        completedTasks: 15,
    },
    {
        id: '3',
        name: 'Bug Hunt Squad',
        description: 'Multi-agent debugging and testing team',
        agents: [
            { id: 'c1', name: 'Bug Hunter', role: 'debugger', provider: 'deepseek', model: 'deepseek-coder', status: 'idle', tasksCompleted: 0, tokensUsed: 0 },
            { id: 'c2', name: 'Test Writer', role: 'tester', provider: 'copilot', model: 'gpt-4', status: 'idle', tasksCompleted: 0, tokensUsed: 0 },
        ],
        pattern: 'parallel',
        status: 'idle',
        createdAt: new Date(Date.now() - 172800000),
        totalTasks: 0,
        completedTasks: 0,
    },
];

export default function Swarms() {
    const [swarms, setSwarms] = useState<Swarm[]>(demoSwarms);
    const [selectedSwarm, setSelectedSwarm] = useState<Swarm | null>(demoSwarms[0]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showAddAgentModal, setShowAddAgentModal] = useState(false);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'running':
            case 'working':
                return 'text-green-500 bg-green-500/10';
            case 'paused':
                return 'text-yellow-500 bg-yellow-500/10';
            case 'completed':
                return 'text-blue-500 bg-blue-500/10';
            case 'error':
                return 'text-red-500 bg-red-500/10';
            default:
                return 'text-gray-500 bg-gray-500/10';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'running':
            case 'working':
                return <Play size={14} />;
            case 'paused':
                return <Pause size={14} />;
            case 'completed':
                return <CheckCircle2 size={14} />;
            case 'error':
                return <AlertCircle size={14} />;
            default:
                return <Clock size={14} />;
        }
    };

    const toggleSwarmStatus = (swarmId: string) => {
        setSwarms(prev => prev.map(s => {
            if (s.id === swarmId) {
                const newStatus = s.status === 'running' ? 'paused' : s.status === 'paused' ? 'running' : 'running';
                return { ...s, status: newStatus };
            }
            return s;
        }));
    };

    const deleteSwarm = (swarmId: string) => {
        setSwarms(prev => prev.filter(s => s.id !== swarmId));
        if (selectedSwarm?.id === swarmId) {
            setSelectedSwarm(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">Agent Swarms</h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                        Orchestrate multi-agent teams for complex collaborative tasks
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90 transition-colors"
                >
                    <Plus size={18} />
                    Create Swarm
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Swarms List */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Your Swarms</h2>
                    {swarms.map(swarm => (
                        <div
                            key={swarm.id}
                            onClick={() => setSelectedSwarm(swarm)}
                            className={`p-4 bg-[hsl(var(--card))] rounded-xl border cursor-pointer transition-all hover:border-[hsl(var(--primary))] ${selectedSwarm?.id === swarm.id ? 'border-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary))]' : ''
                                }`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-[hsl(var(--muted))] rounded-lg">
                                        <Users size={20} className="text-[hsl(var(--primary))]" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-[hsl(var(--foreground))]">{swarm.name}</h3>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">{swarm.agents.length} agents</p>
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${getStatusColor(swarm.status)}`}>
                                    {getStatusIcon(swarm.status)}
                                    {swarm.status}
                                </span>
                            </div>
                            {swarm.totalTasks > 0 && (
                                <div className="mt-3">
                                    <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))] mb-1">
                                        <span>Progress</span>
                                        <span>{swarm.completedTasks}/{swarm.totalTasks} tasks</span>
                                    </div>
                                    <div className="h-1.5 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[hsl(var(--primary))] rounded-full transition-all"
                                            style={{ width: `${(swarm.completedTasks / swarm.totalTasks) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Swarm Details */}
                {selectedSwarm ? (
                    <div className="lg:col-span-2 space-y-4">
                        <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">{selectedSwarm.name}</h2>
                                    <p className="text-[hsl(var(--muted-foreground))] mt-1">{selectedSwarm.description}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => toggleSwarmStatus(selectedSwarm.id)}
                                        className={`p-2 rounded-lg transition-colors ${selectedSwarm.status === 'running'
                                            ? 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20'
                                            : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                                            }`}
                                    >
                                        {selectedSwarm.status === 'running' ? <Pause size={18} /> : <Play size={18} />}
                                    </button>
                                    <button className="p-2 rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
                                        <Settings size={18} />
                                    </button>
                                    <button
                                        onClick={() => deleteSwarm(selectedSwarm.id)}
                                        className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 mb-6">
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-[hsl(var(--muted-foreground))]">Pattern:</span>
                                    <span className="px-2 py-0.5 bg-[hsl(var(--muted))] rounded text-[hsl(var(--foreground))]">
                                        {executionPatterns.find(p => p.id === selectedSwarm.pattern)?.name}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-[hsl(var(--muted-foreground))]">Created:</span>
                                    <span className="text-[hsl(var(--foreground))]">
                                        {selectedSwarm.createdAt.toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            {/* Agents */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-medium text-[hsl(var(--foreground))]">Agents</h3>
                                    <button
                                        onClick={() => setShowAddAgentModal(true)}
                                        className="text-sm text-[hsl(var(--primary))] hover:underline flex items-center gap-1"
                                    >
                                        <Plus size={14} />
                                        Add Agent
                                    </button>
                                </div>
                                {selectedSwarm.agents.map(agent => {
                                    const role = agentRoles.find(r => r.id === agent.role);
                                    const RoleIcon = role?.icon || Bot;
                                    return (
                                        <div
                                            key={agent.id}
                                            className="flex items-center justify-between p-3 bg-[hsl(var(--muted))] rounded-lg"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="p-2 rounded-lg"
                                                    style={{ backgroundColor: role?.color + '20' }}
                                                >
                                                    <RoleIcon size={18} style={{ color: role?.color }} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-[hsl(var(--foreground))]">{agent.name}</span>
                                                        <span className={`px-1.5 py-0.5 rounded text-xs ${getStatusColor(agent.status)}`}>
                                                            {agent.status}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                                                        {providers.find(p => p.id === agent.provider)?.name} • {agent.model}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right text-sm">
                                                <div className="text-[hsl(var(--foreground))]">{agent.tasksCompleted} tasks</div>
                                                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                                                    {(agent.tokensUsed / 1000).toFixed(1)}K tokens
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
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

            {/* Create Swarm Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[hsl(var(--card))] rounded-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] mb-4">Create New Swarm</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">Name</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                    placeholder="My Agent Swarm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">Description</label>
                                <textarea
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
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90 transition-colors"
                            >
                                Create Swarm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Agent Modal */}
            {showAddAgentModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[hsl(var(--card))] rounded-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] mb-4">Add Agent</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">Agent Name</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                    placeholder="My Agent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">Role</label>
                                <select className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]">
                                    {agentRoles.map(role => (
                                        <option key={role.id} value={role.id}>{role.name} - {role.description}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">Provider</label>
                                <select className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]">
                                    {providers.map(provider => (
                                        <option key={provider.id} value={provider.id}>{provider.icon} {provider.name}</option>
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
