// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMcpTools } from '../hooks/useApi';
import {
    Server,
    Settings,
    Trash2,
    Power,
    PowerOff,
    RefreshCw,
    CheckCircle2,
    XCircle,
    Clock,
    Wrench,
    FileText,
    MessageSquare,
    ChevronDown,
    ChevronRight,
    Search,
    Filter,
    Terminal,
    Code,
    Network,
    Cpu,
    Workflow,
    Share2,
    GitBranch,
    Boxes,
    Brain,
    Zap,
    Target,
    Layers,
    Activity,
    Link as LinkIcon,
    BookOpen,
    ExternalLink,
    Users,
    Bot,
} from 'lucide-react';

// Protocol categories for multi-agent systems
const protocolCategories = [
    {
        id: 'nanda',
        name: 'NANDA',
        fullName: 'Networked Agents for Natural Discovery and Automation',
        description: 'Protocol for decentralized agent coordination and capability discovery',
        category: 'Discovery & Coordination',
        status: 'active',
        version: '0.3.0',
        icon: 'network',
        features: [
            'Decentralized agent discovery',
            'Capability advertisement',
            'Dynamic task routing',
            'Trust-based delegation',
            'Natural language negotiation',
        ],
        specs: {
            transport: 'HTTP/gRPC',
            serialization: 'JSON-LD/Protobuf',
            discovery: 'DHT/mDNS',
        },
        links: {
            docs: 'https://nanda.dev/docs',
            spec: 'https://nanda.dev/spec',
            github: 'https://github.com/nanda-protocol',
        },
    },
    {
        id: 'a2a',
        name: 'A2A',
        fullName: 'Agent-to-Agent Protocol',
        description: 'Google\'s protocol for direct agent-to-agent communication',
        category: 'Communication',
        status: 'active',
        version: '1.0.0',
        icon: 'share',
        features: [
            'Agent cards for identity',
            'Task lifecycle management',
            'Streaming responses',
            'Push notifications',
            'Multi-turn conversations',
        ],
        specs: {
            transport: 'HTTP/2',
            serialization: 'JSON',
            auth: 'OAuth 2.0',
        },
        links: {
            docs: 'https://google.github.io/a2a',
            spec: 'https://google.github.io/a2a/spec',
            github: 'https://github.com/google/a2a',
        },
    },
    {
        id: 'mcp',
        name: 'MCP',
        fullName: 'Model Context Protocol',
        description: 'Anthropic\'s protocol for connecting AI models to tools and data',
        category: 'Tool Integration',
        status: 'active',
        version: '1.0.0',
        icon: 'cpu',
        features: [
            'Tool discovery & invocation',
            'Resource exposure',
            'Prompt templates',
            'Bidirectional communication',
            'Stateful sessions',
        ],
        specs: {
            transport: 'stdio/SSE',
            serialization: 'JSON-RPC 2.0',
            schema: 'JSON Schema',
        },
        links: {
            docs: 'https://modelcontextprotocol.io',
            spec: 'https://spec.modelcontextprotocol.io',
            github: 'https://github.com/modelcontextprotocol',
        },
    },
    {
        id: 'agentprotocol',
        name: 'Agent Protocol',
        fullName: 'AI Agent Protocol',
        description: 'Standardized API for communicating with AI agents',
        category: 'Communication',
        status: 'active',
        version: '1.1.0',
        icon: 'workflow',
        features: [
            'Task management API',
            'Step-by-step execution',
            'Artifact handling',
            'Standardized endpoints',
            'Agent benchmarking',
        ],
        specs: {
            transport: 'REST/HTTP',
            serialization: 'JSON',
            schema: 'OpenAPI 3.0',
        },
        links: {
            docs: 'https://agentprotocol.ai',
            spec: 'https://agentprotocol.ai/spec',
            github: 'https://github.com/AI-Engineer-Foundation/agent-protocol',
        },
    },
    {
        id: 'swarm-pso',
        name: 'PSO',
        fullName: 'Particle Swarm Optimization',
        description: 'Bio-inspired optimization through swarm intelligence',
        category: 'Swarm Intelligence',
        status: 'stable',
        version: 'Classic',
        icon: 'boxes',
        features: [
            'Global best tracking',
            'Local best memory',
            'Velocity updates',
            'Inertia weight adaptation',
            'Topology configurations',
        ],
        specs: {
            type: 'Optimization',
            inspired: 'Bird flocking',
            convergence: 'Asymptotic',
        },
        links: {
            docs: 'https://en.wikipedia.org/wiki/Particle_swarm_optimization',
        },
    },
    {
        id: 'swarm-aco',
        name: 'ACO',
        fullName: 'Ant Colony Optimization',
        description: 'Pheromone-based path optimization for distributed systems',
        category: 'Swarm Intelligence',
        status: 'stable',
        version: 'Classic',
        icon: 'gitbranch',
        features: [
            'Pheromone trails',
            'Evaporation rates',
            'Path construction',
            'Daemon actions',
            'Multi-colony variants',
        ],
        specs: {
            type: 'Combinatorial Optimization',
            inspired: 'Ant foraging',
            problems: 'TSP, VRP, Scheduling',
        },
        links: {
            docs: 'https://en.wikipedia.org/wiki/Ant_colony_optimization',
        },
    },
    {
        id: 'swarm-bees',
        name: 'ABC',
        fullName: 'Artificial Bee Colony',
        description: 'Bee foraging behavior for function optimization',
        category: 'Swarm Intelligence',
        status: 'stable',
        version: 'Classic',
        icon: 'target',
        features: [
            'Employed bees phase',
            'Onlooker bees phase',
            'Scout bees phase',
            'Fitness-based selection',
            'Abandonment limit',
        ],
        specs: {
            type: 'Numerical Optimization',
            inspired: 'Bee foraging',
            exploration: 'High',
        },
        links: {
            docs: 'https://en.wikipedia.org/wiki/Artificial_bee_colony_algorithm',
        },
    },
    {
        id: 'pgm-bn',
        name: 'Bayesian Networks',
        fullName: 'Probabilistic Bayesian Networks',
        description: 'DAG-based probabilistic inference for agent coordination',
        category: 'Probabilistic Graphical Models',
        status: 'stable',
        version: 'Classic',
        icon: 'brain',
        features: [
            'Conditional independence',
            'Exact inference',
            'Approximate inference',
            'Structure learning',
            'Parameter estimation',
        ],
        specs: {
            type: 'Directed Graphical Model',
            inference: 'Variable Elimination, BP',
            learning: 'EM, Score-based',
        },
        links: {
            docs: 'https://en.wikipedia.org/wiki/Bayesian_network',
        },
    },
    {
        id: 'pgm-mrf',
        name: 'MRF',
        fullName: 'Markov Random Fields',
        description: 'Undirected graphical models for agent consensus',
        category: 'Probabilistic Graphical Models',
        status: 'stable',
        version: 'Classic',
        icon: 'layers',
        features: [
            'Undirected dependencies',
            'Potential functions',
            'Loopy belief propagation',
            'Gibbs sampling',
            'Mean field inference',
        ],
        specs: {
            type: 'Undirected Graphical Model',
            inference: 'BP, MCMC',
            applications: 'Image, NLP, Networks',
        },
        links: {
            docs: 'https://en.wikipedia.org/wiki/Markov_random_field',
        },
    },
    {
        id: 'pgm-factor',
        name: 'Factor Graphs',
        fullName: 'Factor Graph Message Passing',
        description: 'Unified representation for belief propagation in agent networks',
        category: 'Probabilistic Graphical Models',
        status: 'stable',
        version: 'Classic',
        icon: 'activity',
        features: [
            'Sum-product algorithm',
            'Max-product algorithm',
            'Message scheduling',
            'Convergence guarantees',
            'Distributed computation',
        ],
        specs: {
            type: 'Bipartite Graphical Model',
            inference: 'Message Passing',
            unifies: 'BN + MRF',
        },
        links: {
            docs: 'https://en.wikipedia.org/wiki/Factor_graph',
        },
    },
    {
        id: 'consensus-raft',
        name: 'Raft',
        fullName: 'Raft Consensus Algorithm',
        description: 'Understandable consensus for agent state replication',
        category: 'Distributed Consensus',
        status: 'stable',
        version: 'Classic',
        icon: 'link',
        features: [
            'Leader election',
            'Log replication',
            'Safety guarantees',
            'Membership changes',
            'Log compaction',
        ],
        specs: {
            type: 'Consensus Protocol',
            faultTolerance: '(n-1)/2',
            consistency: 'Strong',
        },
        links: {
            docs: 'https://raft.github.io',
            spec: 'https://raft.github.io/raft.pdf',
        },
    },
    {
        id: 'consensus-pbft',
        name: 'PBFT',
        fullName: 'Practical Byzantine Fault Tolerance',
        description: 'Byzantine consensus for untrusted agent environments',
        category: 'Distributed Consensus',
        status: 'stable',
        version: 'Classic',
        icon: 'zap',
        features: [
            'Byzantine fault tolerance',
            'Three-phase protocol',
            'View changes',
            'Checkpoint mechanism',
            'Cryptographic verification',
        ],
        specs: {
            type: 'BFT Consensus',
            faultTolerance: '(n-1)/3',
            phases: 'Pre-prepare, Prepare, Commit',
        },
        links: {
            docs: 'https://pmg.csail.mit.edu/papers/osdi99.pdf',
        },
    },
    {
        id: 'self-org-flocking',
        name: 'Flocking',
        fullName: 'Reynolds Flocking Model',
        description: 'Emergent collective motion from simple rules',
        category: 'Self-Organizing Systems',
        status: 'stable',
        version: 'Classic',
        icon: 'boxes',
        features: [
            'Separation rule',
            'Alignment rule',
            'Cohesion rule',
            'Obstacle avoidance',
            'Goal seeking',
        ],
        specs: {
            type: 'Multi-agent Motion',
            rules: '3 basic rules',
            emergent: 'Swarm behavior',
        },
        links: {
            docs: 'https://www.red3d.com/cwr/boids/',
        },
    },
    {
        id: 'self-org-stigmergy',
        name: 'Stigmergy',
        fullName: 'Stigmergic Coordination',
        description: 'Indirect coordination through environmental modification',
        category: 'Self-Organizing Systems',
        status: 'stable',
        version: 'Classic',
        icon: 'share',
        features: [
            'Environment as memory',
            'Indirect communication',
            'Marker-based signals',
            'Quantitative stigmergy',
            'Qualitative stigmergy',
        ],
        specs: {
            type: 'Indirect Coordination',
            mechanism: 'Environmental traces',
            examples: 'Ant trails, Wiki edits',
        },
        links: {
            docs: 'https://en.wikipedia.org/wiki/Stigmergy',
        },
    },
    {
        id: 'marl',
        name: 'MARL',
        fullName: 'Multi-Agent Reinforcement Learning',
        description: 'Decentralized learning for cooperative and competitive agents',
        category: 'Learning Protocols',
        status: 'active',
        version: 'Various',
        icon: 'brain',
        features: [
            'Independent learners',
            'Centralized training',
            'Communication learning',
            'Credit assignment',
            'Emergent cooperation',
        ],
        specs: {
            type: 'Learning Framework',
            paradigms: 'CTDE, IL, JAL',
            algorithms: 'QMIX, MAPPO, MADDPG',
        },
        links: {
            docs: 'https://arxiv.org/abs/1911.10635',
        },
    },
    {
        id: 'contract-net',
        name: 'Contract Net',
        fullName: 'Contract Net Protocol',
        description: 'Task allocation through bidding and negotiation',
        category: 'Task Allocation',
        status: 'stable',
        version: 'Classic',
        icon: 'workflow',
        features: [
            'Task announcement',
            'Bid submission',
            'Bid evaluation',
            'Contract awarding',
            'Result reporting',
        ],
        specs: {
            type: 'Negotiation Protocol',
            mechanism: 'Auction-based',
            FIPA: 'FIPA Contract Net',
        },
        links: {
            docs: 'http://www.fipa.org/specs/fipa00029/',
        },
    },
];

// IRONBRIDGE is itself an MCP server: it exposes tools to MCP clients, and does not
// act as an MCP client managing external servers. So there is exactly one
// server to describe here, and its tool list comes from the live backend.
interface McpServerView {
    id: string;
    name: string;
    displayName: string;
    description: string;
    status: 'connected' | 'disconnected' | 'error';
    type: string;
    command: string;
    args: string[];
    tools: { name: string; description: string }[];
    resources: { name: string; description: string }[];
    prompts: { name: string; description: string }[];
    error?: string;
}

export default function Protocols() {
    const { data: mcpData, isLoading: mcpLoading, error: mcpError, refetch: refetchMcp } = useMcpTools();

    const servers = useMemo<McpServerView[]>(() => {
        if (mcpLoading || (!mcpData && !mcpError)) return [];
        const tools = (mcpData?.mcp_tools ?? []).map(t => ({
            name: t.name,
            description: t.description ?? '',
        }));
        return [{
            id: 'ironbridge',
            name: 'ironbridge',
            displayName: 'IRONBRIDGE MCP Server',
            description: 'Chat session tools this instance exposes to MCP clients',
            status: mcpError ? 'error' : 'connected',
            type: 'stdio',
            command: 'ironbridge',
            args: ['mcp'],
            tools,
            // The HTTP API exposes tools only; resources and prompts are served
            // over the stdio transport and are not enumerable from here.
            resources: [],
            prompts: [],
            ...(mcpError ? { error: mcpError.message } : {}),
        }];
    }, [mcpData, mcpLoading, mcpError]);

    const [selectedServer, setSelectedServer] = useState<string | null>(null);
    const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'protocols' | 'mcp'>('protocols');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        tools: true,
        resources: true,
        prompts: true,
        features: true,
        specs: true,
    });

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const getProtocolIcon = (iconName: string) => {
        switch (iconName) {
            case 'network': return <Network size={20} />;
            case 'share': return <Share2 size={20} />;
            case 'cpu': return <Cpu size={20} />;
            case 'workflow': return <Workflow size={20} />;
            case 'boxes': return <Boxes size={20} />;
            case 'gitbranch': return <GitBranch size={20} />;
            case 'target': return <Target size={20} />;
            case 'brain': return <Brain size={20} />;
            case 'layers': return <Layers size={20} />;
            case 'activity': return <Activity size={20} />;
            case 'link': return <LinkIcon size={20} />;
            case 'zap': return <Zap size={20} />;
            default: return <Server size={20} />;
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'connected':
                return <CheckCircle2 size={16} className="text-green-500" />;
            case 'disconnected':
                return <XCircle size={16} className="text-gray-500" />;
            case 'error':
                return <XCircle size={16} className="text-red-500" />;
            default:
                return <Clock size={16} className="text-yellow-500" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'connected':
                return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'disconnected':
                return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
            case 'error':
                return 'bg-red-500/10 text-red-500 border-red-500/20';
            default:
                return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
        }
    };

    const getServerIcon = (name: string) => {
        switch (name) {
            case 'ironbridge':
                return <Terminal size={20} />;
            default:
                return <Server size={20} />;
        }
    };

    const connectedCount = servers.filter(s => s.status === 'connected').length;
    const totalTools = servers.reduce((sum, s) => sum + s.tools.length, 0);
    const totalResources = servers.reduce((sum, s) => sum + s.resources.length, 0);

    const filteredServers = servers.filter(
        s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedServerData = servers.find(s => s.id === selectedServer);

    // Protocol filtering
    const categories = ['all', ...new Set(protocolCategories.map(p => p.category))];
    const filteredProtocols = protocolCategories.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });
    const selectedProtocolData = protocolCategories.find(p => p.id === selectedProtocol);

    const getProtocolStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'stable': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'experimental': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">Protocols</h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                        Multi-agent protocols, swarm intelligence, and MCP servers
                    </p>
                </div>
                {activeTab === 'mcp' && (
                    <button
                        onClick={() => { void refetchMcp(); }}
                        disabled={mcpLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={18} className={mcpLoading ? 'animate-spin' : undefined} />
                        Refresh
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-[hsl(var(--muted))] p-1 rounded-lg w-fit">
                <button
                    onClick={() => { setActiveTab('protocols'); setSelectedProtocol(null); }}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'protocols'
                        ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
                        : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                        }`}
                >
                    <span className="flex items-center gap-2">
                        <Network size={16} />
                        Agent Protocols
                    </span>
                </button>
                <button
                    onClick={() => { setActiveTab('mcp'); setSelectedServer(null); }}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'mcp'
                        ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm'
                        : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                        }`}
                >
                    <span className="flex items-center gap-2">
                        <Cpu size={16} />
                        MCP Servers
                    </span>
                </button>
            </div>

            {activeTab === 'protocols' ? (
                <>
                    {/* Protocol Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                            <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                                <Network size={18} />
                                <span className="text-sm">Total Protocols</span>
                            </div>
                            <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{protocolCategories.length}</p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">documented</p>
                        </div>

                        <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                            <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                                <Boxes size={18} />
                                <span className="text-sm">Swarm Intelligence</span>
                            </div>
                            <p className="text-2xl font-bold text-blue-500">
                                {protocolCategories.filter(p => p.category === 'Swarm Intelligence').length}
                            </p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">algorithms</p>
                        </div>

                        <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                            <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                                <Brain size={18} />
                                <span className="text-sm">Probabilistic Models</span>
                            </div>
                            <p className="text-2xl font-bold text-purple-500">
                                {protocolCategories.filter(p => p.category === 'Probabilistic Graphical Models').length}
                            </p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">PGM types</p>
                        </div>

                        <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                            <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                                <Share2 size={18} />
                                <span className="text-sm">Communication</span>
                            </div>
                            <p className="text-2xl font-bold text-green-500">
                                {protocolCategories.filter(p => ['Communication', 'Discovery & Coordination', 'Tool Integration'].includes(p.category)).length}
                            </p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">protocols</p>
                        </div>
                    </div>

                    {/* Integration Quick Links */}
                    <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Zap size={18} className="text-[hsl(var(--primary))]" />
                                <span className="font-medium text-[hsl(var(--foreground))]">Deploy Protocols</span>
                            </div>
                            <span className="text-xs text-[hsl(var(--muted-foreground))]">Configure protocols in your agents and swarms</span>
                        </div>
                        <div className="flex items-center gap-4 mt-3">
                            <Link
                                to="/agency"
                                className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--muted))] rounded-lg hover:bg-[hsl(var(--muted))]/80 transition-colors group"
                            >
                                <Bot size={18} className="text-[hsl(var(--primary))] group-hover:scale-110 transition-transform" />
                                <span className="text-sm text-[hsl(var(--foreground))]">Configure Agents</span>
                                <ExternalLink size={14} className="text-[hsl(var(--muted-foreground))]" />
                            </Link>
                            <Link
                                to="/agency"
                                className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--muted))] rounded-lg hover:bg-[hsl(var(--muted))]/80 transition-colors group"
                            >
                                <Users size={18} className="text-purple-500 group-hover:scale-110 transition-transform" />
                                <span className="text-sm text-[hsl(var(--foreground))]">Configure Swarms</span>
                                <ExternalLink size={14} className="text-[hsl(var(--muted-foreground))]" />
                            </Link>
                        </div>
                    </div>

                    {/* Search and Filter */}
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="relative flex-1 max-w-md">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search protocols..."
                                className="w-full pl-10 pr-4 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                            />
                        </div>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="px-4 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                        >
                            {categories.map(cat => (
                                <option key={cat} value={cat}>
                                    {cat === 'all' ? 'All Categories' : cat}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Protocol List */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1 space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto">
                            <h2 className="text-lg font-semibold text-[hsl(var(--foreground))] sticky top-0 bg-[hsl(var(--background))] py-2">
                                Protocols ({filteredProtocols.length})
                            </h2>
                            {filteredProtocols.map(protocol => (
                                <div
                                    key={protocol.id}
                                    onClick={() => setSelectedProtocol(protocol.id)}
                                    className={`bg-[hsl(var(--card))] rounded-xl p-4 border cursor-pointer transition-all hover:border-[hsl(var(--primary))] ${selectedProtocol === protocol.id ? 'border-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary))]' : ''}`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--primary))]">
                                                {getProtocolIcon(protocol.icon)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-[hsl(var(--foreground))]">{protocol.name}</span>
                                                </div>
                                                <p className="text-sm text-[hsl(var(--muted-foreground))]">{protocol.fullName}</p>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-xs border ${getProtocolStatusColor(protocol.status)}`}>
                                            {protocol.status}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))] line-clamp-2">
                                        {protocol.description}
                                    </p>
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className="px-2 py-0.5 bg-[hsl(var(--muted))] rounded text-xs text-[hsl(var(--muted-foreground))]">
                                            {protocol.category}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Protocol Details */}
                        <div className="lg:col-span-2">
                            {selectedProtocolData ? (
                                <div className="bg-[hsl(var(--card))] rounded-xl border overflow-hidden">
                                    {/* Header */}
                                    <div className="p-4 border-b">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-3 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--primary))]">
                                                    {getProtocolIcon(selectedProtocolData.icon)}
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-semibold text-[hsl(var(--foreground))]">
                                                        {selectedProtocolData.name}
                                                    </h3>
                                                    <p className="text-[hsl(var(--muted-foreground))]">{selectedProtocolData.fullName}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-3 py-1 rounded-full text-sm border ${getProtocolStatusColor(selectedProtocolData.status)}`}>
                                                    {selectedProtocolData.status}
                                                </span>
                                                <span className="px-3 py-1 bg-[hsl(var(--muted))] rounded-full text-sm text-[hsl(var(--foreground))]">
                                                    v{selectedProtocolData.version}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="mt-3 text-[hsl(var(--muted-foreground))]">
                                            {selectedProtocolData.description}
                                        </p>
                                        <div className="mt-3">
                                            <span className="px-2 py-1 bg-[hsl(var(--muted))] rounded text-sm text-[hsl(var(--muted-foreground))]">
                                                {selectedProtocolData.category}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Features Section */}
                                    <div className="border-b">
                                        <button
                                            onClick={() => toggleSection('features')}
                                            className="w-full p-4 flex items-center justify-between hover:bg-[hsl(var(--muted))]/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 size={18} className="text-[hsl(var(--primary))]" />
                                                <span className="font-medium text-[hsl(var(--foreground))]">
                                                    Features ({selectedProtocolData.features.length})
                                                </span>
                                            </div>
                                            {expandedSections.features ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        </button>
                                        {expandedSections.features && (
                                            <div className="px-4 pb-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {selectedProtocolData.features.map((feature, i) => (
                                                        <div key={i} className="flex items-center gap-2 p-2 bg-[hsl(var(--muted))] rounded-lg">
                                                            <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                                                            <span className="text-sm text-[hsl(var(--foreground))]">{feature}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Specs Section */}
                                    <div className="border-b">
                                        <button
                                            onClick={() => toggleSection('specs')}
                                            className="w-full p-4 flex items-center justify-between hover:bg-[hsl(var(--muted))]/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Settings size={18} className="text-[hsl(var(--primary))]" />
                                                <span className="font-medium text-[hsl(var(--foreground))]">
                                                    Specifications
                                                </span>
                                            </div>
                                            {expandedSections.specs ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        </button>
                                        {expandedSections.specs && (
                                            <div className="px-4 pb-4 space-y-2">
                                                {Object.entries(selectedProtocolData.specs).map(([key, value]) => (
                                                    <div key={key} className="flex items-center justify-between p-3 bg-[hsl(var(--muted))] rounded-lg">
                                                        <span className="text-sm font-medium text-[hsl(var(--muted-foreground))] capitalize">{key}</span>
                                                        <span className="text-sm font-mono text-[hsl(var(--foreground))]">{value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Links Section */}
                                    <div className="p-4">
                                        <h4 className="text-sm font-medium text-[hsl(var(--muted-foreground))] mb-3">Resources</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedProtocolData.links.docs && (
                                                <a
                                                    href={selectedProtocolData.links.docs}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/80 transition-colors"
                                                >
                                                    <BookOpen size={16} />
                                                    <span className="text-sm">Documentation</span>
                                                    <ExternalLink size={12} />
                                                </a>
                                            )}
                                            {selectedProtocolData.links.spec && (
                                                <a
                                                    href={selectedProtocolData.links.spec}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/80 transition-colors"
                                                >
                                                    <FileText size={16} />
                                                    <span className="text-sm">Specification</span>
                                                    <ExternalLink size={12} />
                                                </a>
                                            )}
                                            {selectedProtocolData.links.github && (
                                                <a
                                                    href={selectedProtocolData.links.github}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/80 transition-colors"
                                                >
                                                    <Code size={16} />
                                                    <span className="text-sm">GitHub</span>
                                                    <ExternalLink size={12} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-[hsl(var(--card))] rounded-xl border p-8 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
                                    <Network size={48} className="text-[hsl(var(--muted-foreground))] mb-4" />
                                    <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">Select a Protocol</h3>
                                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                                        Choose a protocol from the list to view its details
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {/* MCP Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                            <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                                <Server size={18} />
                                <span className="text-sm">Connected</span>
                            </div>
                            <p className="text-2xl font-bold text-green-500">{connectedCount}</p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">of {servers.length} servers</p>
                        </div>

                        <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                            <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                                <Wrench size={18} />
                                <span className="text-sm">Available Tools</span>
                            </div>
                            <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{totalTools}</p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">across all servers</p>
                        </div>

                        <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                            <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                                <FileText size={18} />
                                <span className="text-sm">Resources</span>
                            </div>
                            <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{totalResources}</p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">exposed</p>
                        </div>

                        <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                            <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                                <MessageSquare size={18} />
                                <span className="text-sm">Prompts</span>
                            </div>
                            <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
                                {servers.reduce((sum, s) => sum + s.prompts.length, 0)}
                            </p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">templates</p>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search servers..."
                                className="w-full pl-10 pr-4 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                            />
                        </div>
                        <button className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded-lg hover:bg-[hsl(var(--muted))]/80 transition-colors">
                            <Filter size={18} />
                            Filter
                        </button>
                    </div>

                    {/* Main Content */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Server List */}
                        <div className="lg:col-span-1 space-y-3">
                            <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Servers</h2>
                            {mcpLoading && (
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading MCP tools…</p>
                            )}
                            {filteredServers.map(server => (
                                <div
                                    key={server.id}
                                    onClick={() => setSelectedServer(server.id)}
                                    className={`bg-[hsl(var(--card))] rounded-xl p-4 border cursor-pointer transition-all hover:border-[hsl(var(--primary))] ${selectedServer === server.id ? 'border-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary))]' : ''
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--primary))]">
                                                {getServerIcon(server.name)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-[hsl(var(--foreground))]">{server.displayName}</span>
                                                </div>
                                                <p className="text-sm text-[hsl(var(--muted-foreground))]">{server.name}</p>
                                            </div>
                                        </div>
                                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${getStatusColor(server.status)}`}>
                                            {getStatusIcon(server.status)}
                                            {server.status}
                                        </span>
                                    </div>
                                    <div className="mt-3 flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                                        <span className="flex items-center gap-1">
                                            <Wrench size={12} />
                                            {server.tools.length} tools
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <FileText size={12} />
                                            {server.resources.length} resources
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Server Details */}
                        <div className="lg:col-span-2">
                            {selectedServerData ? (
                                <div className="bg-[hsl(var(--card))] rounded-xl border overflow-hidden">
                                    {/* Header */}
                                    <div className="p-4 border-b">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-3 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--primary))]">
                                                    {getServerIcon(selectedServerData.name)}
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-semibold text-[hsl(var(--foreground))]">
                                                        {selectedServerData.displayName}
                                                    </h3>
                                                    <p className="text-[hsl(var(--muted-foreground))]">{selectedServerData.description}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {selectedServerData.status === 'connected' ? (
                                                    <button className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
                                                        <PowerOff size={18} />
                                                    </button>
                                                ) : (
                                                    <button className="p-2 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors">
                                                        <Power size={18} />
                                                    </button>
                                                )}
                                                <button className="p-2 rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/80 transition-colors">
                                                    <RefreshCw size={18} />
                                                </button>
                                                <button className="p-2 rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/80 transition-colors">
                                                    <Settings size={18} />
                                                </button>
                                                <button className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>

                                        {selectedServerData.error && (
                                            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                                                {selectedServerData.error}
                                            </div>
                                        )}
                                    </div>

                                    {/* Command */}
                                    <div className="p-4 border-b bg-[hsl(var(--muted))]/50">
                                        <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] mb-2">
                                            <Terminal size={14} />
                                            <span>Command</span>
                                        </div>
                                        <code className="text-sm font-mono text-[hsl(var(--foreground))]">
                                            {selectedServerData.command} {selectedServerData.args.join(' ')}
                                        </code>
                                    </div>

                                    {/* Tools Section */}
                                    <div className="border-b">
                                        <button
                                            onClick={() => toggleSection('tools')}
                                            className="w-full p-4 flex items-center justify-between hover:bg-[hsl(var(--muted))]/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Wrench size={18} className="text-[hsl(var(--primary))]" />
                                                <span className="font-medium text-[hsl(var(--foreground))]">
                                                    Tools ({selectedServerData.tools.length})
                                                </span>
                                            </div>
                                            {expandedSections.tools ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        </button>
                                        {expandedSections.tools && (
                                            <div className="px-4 pb-4 space-y-2">
                                                {selectedServerData.tools.map((tool, i) => (
                                                    <div key={i} className="p-3 bg-[hsl(var(--muted))] rounded-lg">
                                                        <div className="font-mono text-sm text-[hsl(var(--primary))]">{tool.name}</div>
                                                        <div className="text-sm text-[hsl(var(--muted-foreground))]">{tool.description}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Resources Section */}
                                    <div className="border-b">
                                        <button
                                            onClick={() => toggleSection('resources')}
                                            className="w-full p-4 flex items-center justify-between hover:bg-[hsl(var(--muted))]/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <FileText size={18} className="text-[hsl(var(--primary))]" />
                                                <span className="font-medium text-[hsl(var(--foreground))]">
                                                    Resources ({selectedServerData.resources.length})
                                                </span>
                                            </div>
                                            {expandedSections.resources ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        </button>
                                        {expandedSections.resources && (
                                            <div className="px-4 pb-4 space-y-2">
                                                {selectedServerData.resources.length > 0 ? (
                                                    selectedServerData.resources.map((resource, i) => (
                                                        <div key={i} className="p-3 bg-[hsl(var(--muted))] rounded-lg">
                                                            <div className="font-mono text-sm text-[hsl(var(--primary))]">{resource.name}</div>
                                                            <div className="text-sm text-[hsl(var(--muted-foreground))]">{resource.description}</div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-sm text-[hsl(var(--muted-foreground))] py-2">No resources exposed</p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Prompts Section */}
                                    <div>
                                        <button
                                            onClick={() => toggleSection('prompts')}
                                            className="w-full p-4 flex items-center justify-between hover:bg-[hsl(var(--muted))]/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <MessageSquare size={18} className="text-[hsl(var(--primary))]" />
                                                <span className="font-medium text-[hsl(var(--foreground))]">
                                                    Prompts ({selectedServerData.prompts.length})
                                                </span>
                                            </div>
                                            {expandedSections.prompts ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        </button>
                                        {expandedSections.prompts && (
                                            <div className="px-4 pb-4 space-y-2">
                                                {selectedServerData.prompts.length > 0 ? (
                                                    selectedServerData.prompts.map((prompt, i) => (
                                                        <div key={i} className="p-3 bg-[hsl(var(--muted))] rounded-lg">
                                                            <div className="font-mono text-sm text-[hsl(var(--primary))]">{prompt.name}</div>
                                                            <div className="text-sm text-[hsl(var(--muted-foreground))]">{prompt.description}</div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-sm text-[hsl(var(--muted-foreground))] py-2">No prompt templates</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-[hsl(var(--card))] rounded-xl border p-8 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
                                    <Server size={48} className="text-[hsl(var(--muted-foreground))] mb-4" />
                                    <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">Select a Server</h3>
                                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                                        Choose an MCP server from the list to view its details
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

        </div>
    );
}
