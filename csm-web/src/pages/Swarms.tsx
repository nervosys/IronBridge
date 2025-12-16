import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
    Network,
    ExternalLink,
    Loader2,
    RefreshCw,
} from 'lucide-react';
import { useApi } from '../context/ApiContext';
import {
    useCreateSwarm,
    useDeleteSwarm,
    useStartSwarm,
    usePauseSwarm,
} from '../hooks/useApi';
import { formatRelativeTime } from '@csm/shared';
import type { Swarm } from '../api/types';

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

// Execution patterns (basic orchestration)
const executionPatterns = [
    { id: 'sequential', name: 'Sequential', description: 'Agents work one after another' },
    { id: 'parallel', name: 'Parallel', description: 'Agents work simultaneously' },
    { id: 'hierarchical', name: 'Hierarchical', description: 'Lead agent coordinates others' },
    { id: 'collaborative', name: 'Collaborative', description: 'Agents discuss and reach consensus' },
    { id: 'competitive', name: 'Competitive', description: 'Agents compete for best solution' },
];

// Swarm Intelligence Algorithms
const swarmAlgorithms = [
    { id: 'pso', name: 'PSO', fullName: 'Particle Swarm Optimization', description: 'Optimization inspired by bird flocking', category: 'Swarm Intelligence' },
    { id: 'aco', name: 'ACO', fullName: 'Ant Colony Optimization', description: 'Path optimization via pheromone trails', category: 'Swarm Intelligence' },
    { id: 'abc', name: 'ABC', fullName: 'Artificial Bee Colony', description: 'Foraging behavior for optimization', category: 'Swarm Intelligence' },
    { id: 'flocking', name: 'Flocking', fullName: 'Flocking Behavior', description: 'Reynolds flocking rules (separation, alignment, cohesion)', category: 'Self-Organizing' },
    { id: 'stigmergy', name: 'Stigmergy', fullName: 'Stigmergic Coordination', description: 'Indirect coordination through environment', category: 'Self-Organizing' },
];

// Consensus Protocols
const consensusProtocols = [
    { id: 'raft', name: 'Raft', description: 'Leader-based consensus for fault tolerance', category: 'Distributed Consensus' },
    { id: 'pbft', name: 'PBFT', fullName: 'Practical Byzantine Fault Tolerance', description: 'Byzantine fault tolerant consensus', category: 'Distributed Consensus' },
    { id: 'marl', name: 'MARL', fullName: 'Multi-Agent Reinforcement Learning', description: 'Coordinated learning across agents', category: 'Learning Protocols' },
    { id: 'contract-net', name: 'Contract Net', description: 'Task allocation through bidding', category: 'Task Allocation' },
];

// Communication Protocols
const communicationProtocols = [
    { id: 'mcp', name: 'MCP', fullName: 'Model Context Protocol', description: 'Standardized tool integration', category: 'Tool Integration' },
    { id: 'a2a', name: 'A2A', fullName: 'Agent-to-Agent', description: 'Direct agent communication', category: 'Communication' },
    { id: 'nanda', name: 'NANDA', description: 'Decentralized discovery & coordination', category: 'Discovery' },
];

export default function Swarms() {
    const { swarms, agents, isLoading, error, refetchSwarms } = useApi();
    const [selectedSwarm, setSelectedSwarm] = useState<Swarm | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showAddAgentModal, setShowAddAgentModal] = useState(false);

    // Form state for creating swarm
    const [newSwarmName, setNewSwarmName] = useState('');
    const [newSwarmDescription, setNewSwarmDescription] = useState('');

    // Mutations
    const createSwarm = useCreateSwarm();
    const deleteSwarmMutation = useDeleteSwarm();
    const startSwarm = useStartSwarm();
    const pauseSwarm = usePauseSwarm();

    // Transform swarms data for display
    const swarmsData = useMemo(() => {
        return swarms.map(swarm => ({
            ...swarm,
            totalTasks: swarm.workflow.nodes.filter(n => n.type === 'agent').length,
            completedTasks: 0, // Would need run state tracking
        }));
    }, [swarms]);

    // Update selected swarm when swarms change
    useMemo(() => {
        if (selectedSwarm && swarmsData.length > 0) {
            const updated = swarmsData.find(s => s.id === selectedSwarm.id);
            if (updated && updated !== selectedSwarm) {
                setSelectedSwarm(updated);
            }
        } else if (!selectedSwarm && swarmsData.length > 0) {
            setSelectedSwarm(swarmsData[0]);
        }
    }, [swarmsData, selectedSwarm]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'running':
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

    const handleToggleSwarmStatus = async (swarmId: string, currentStatus: string) => {
        if (currentStatus === 'running') {
            await pauseSwarm.mutate(swarmId);
        } else if (currentStatus === 'paused') {
            await startSwarm.mutate({ id: swarmId, input: '' });
        } else {
            await startSwarm.mutate({ id: swarmId, input: '' });
        }
        refetchSwarms();
    };

    const handleDeleteSwarm = async (swarmId: string) => {
        if (confirm('Are you sure you want to delete this swarm?')) {
            await deleteSwarmMutation.mutate(swarmId);
            if (selectedSwarm?.id === swarmId) {
                setSelectedSwarm(null);
            }
            refetchSwarms();
        }
    };

    const handleCreateSwarm = async () => {
        if (!newSwarmName.trim()) return;

        await createSwarm.mutate({
            name: newSwarmName,
            description: newSwarmDescription || null,
            agents: [],
            workflow: { nodes: [], edges: [] },
            status: 'idle',
        });

        setNewSwarmName('');
        setNewSwarmDescription('');
        setShowCreateModal(false);
        refetchSwarms();
    };

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
                <p className="text-lg font-medium">Error loading swarms</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">{error.message}</p>
                <button
                    onClick={() => refetchSwarms()}
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
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">Agent Swarms</h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                        Orchestrate multi-agent teams for complex collaborative tasks
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => refetchSwarms()}
                        className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded-lg hover:bg-[hsl(var(--muted))]/80 transition-colors"
                    >
                        <RefreshCw size={18} />
                        Refresh
                    </button>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90 transition-colors"
                    >
                        <Plus size={18} />
                        Create Swarm
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Swarms List */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Your Swarms</h2>

                    {swarmsData.length === 0 ? (
                        <div className="bg-[hsl(var(--card))] rounded-xl p-8 border text-center">
                            <Users size={48} className="mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
                            <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">No Swarms Yet</h3>
                            <p className="text-[hsl(var(--muted-foreground))] mt-2">
                                Create your first multi-agent swarm to coordinate AI teams.
                            </p>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="mt-4 flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90 transition-colors mx-auto"
                            >
                                <Plus size={18} />
                                Create Swarm
                            </button>
                        </div>
                    ) : (
                        swarmsData.map(swarm => (
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
                                                style={{ width: `${swarm.totalTasks > 0 ? (swarm.completedTasks / swarm.totalTasks) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                                <div className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                                    Updated {formatRelativeTime(swarm.updatedAt)}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Swarm Details */}
                {selectedSwarm ? (
                    <div className="lg:col-span-2 space-y-4">
                        <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">{selectedSwarm.name}</h2>
                                    <p className="text-[hsl(var(--muted-foreground))] mt-1">{selectedSwarm.description || 'No description'}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleToggleSwarmStatus(selectedSwarm.id, selectedSwarm.status)}
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
                                        onClick={() => handleDeleteSwarm(selectedSwarm.id)}
                                        className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 mb-6">
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-[hsl(var(--muted-foreground))]">Created:</span>
                                    <span className="text-[hsl(var(--foreground))]">
                                        {new Date(selectedSwarm.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-[hsl(var(--muted-foreground))]">Workflow nodes:</span>
                                    <span className="text-[hsl(var(--foreground))]">
                                        {selectedSwarm.workflow.nodes.length}
                                    </span>
                                </div>
                            </div>

                            {/* Agents */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-medium text-[hsl(var(--foreground))]">Agents in Swarm</h3>
                                    <button
                                        onClick={() => setShowAddAgentModal(true)}
                                        className="text-sm text-[hsl(var(--primary))] hover:underline flex items-center gap-1"
                                    >
                                        <Plus size={14} />
                                        Add Agent
                                    </button>
                                </div>

                                {selectedSwarm.agents.length === 0 ? (
                                    <div className="p-6 bg-[hsl(var(--muted))] rounded-lg text-center">
                                        <Bot size={32} className="mx-auto text-[hsl(var(--muted-foreground))] mb-2" />
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                            No agents assigned yet. Add agents to build your swarm.
                                        </p>
                                    </div>
                                ) : (
                                    selectedSwarm.agents.map(swarmAgent => {
                                        const role = agentRoles.find(r => r.id === swarmAgent.role);
                                        const RoleIcon = role?.icon || Bot;
                                        const agent = agents.find(a => a.id === swarmAgent.agentId);
                                        return (
                                            <div
                                                key={swarmAgent.agentId}
                                                className="flex items-center justify-between p-3 bg-[hsl(var(--muted))] rounded-lg"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="p-2 rounded-lg"
                                                        style={{ backgroundColor: (role?.color || '#6b7280') + '20' }}
                                                    >
                                                        <RoleIcon size={18} style={{ color: role?.color || '#6b7280' }} />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-[hsl(var(--foreground))]">
                                                                {agent?.name || 'Unknown Agent'}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-[hsl(var(--muted-foreground))]">
                                                            Role: {role?.name || swarmAgent.role}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right text-sm">
                                                    <div className="text-[hsl(var(--foreground))]">{agent?.provider || 'N/A'}</div>
                                                    <div className="text-xs text-[hsl(var(--muted-foreground))]">
                                                        {agent?.model || 'N/A'}
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
                                <Link to="/swarms/protocols" className="text-sm text-[hsl(var(--primary))] hover:underline flex items-center gap-1">
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
                                    <Link to="/swarms/protocols" className="ml-auto text-xs text-[hsl(var(--primary))] hover:underline" onClick={() => setShowCreateModal(false)}>
                                        Learn more
                                    </Link>
                                </div>

                                {/* Swarm Algorithm */}
                                <div className="mb-3">
                                    <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">Swarm Intelligence Algorithm</label>
                                    <select className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]">
                                        <option value="">None (basic orchestration)</option>
                                        {swarmAlgorithms.map(alg => (
                                            <option key={alg.id} value={alg.id}>{alg.name} - {alg.description}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Consensus Protocol */}
                                <div className="mb-3">
                                    <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">Consensus Protocol</label>
                                    <select className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]">
                                        <option value="">None</option>
                                        {consensusProtocols.map(proto => (
                                            <option key={proto.id} value={proto.id}>{proto.name} - {proto.description}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Communication Protocol */}
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
                                            <option key={agent.id} value={agent.id}>{agent.name} ({agent.provider})</option>
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
