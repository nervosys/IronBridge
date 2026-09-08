// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

import { useState, useMemo, useEffect, useCallback, startTransition } from 'react';
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
    FolderOpen,
    BookOpen,
    Folder,
    Info,
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
import { useCreateSwarm, useDeleteSwarm, useUpdateSwarm, useAddSwarmAgent, useCreateAgent, useDeleteAgent, useUpdateAgent } from '../hooks/useApi';
import { formatRelativeTime, formatTime, AGENT_ROLES } from '@ironbridge/shared';
import { AgentInbox } from '../components/AgentInbox';
import type { Agent, Swarm, SwarmStatus } from '../api/types';
import type { SweProject, SweMemory, SweRule, SweMemoryCategory } from '@ironbridge/shared';

// SWE Memory API base URL
/*
 * `/api`, not `/api/v1`: the server has never routed a `/v1` segment, so all
 * three requests below answered 404 and each `catch` turned that into an
 * empty list. Probed against a running server -- `/api/v1/swe/projects` 404,
 * `/api/swe/projects` 200.
 */
const SWE_API_BASE = 'http://localhost:8787/api';

// SWE Memory categories
const MEMORY_CATEGORIES: { value: SweMemoryCategory; label: string; icon: typeof Brain; color: string }[] = [
    { value: 'fact', label: 'Fact', icon: Lightbulb, color: 'text-yellow-400' },
    { value: 'decision', label: 'Decision', icon: Zap, color: 'text-purple-400' },
    { value: 'pattern', label: 'Pattern', icon: Code, color: 'text-blue-400' },
    { value: 'dependency', label: 'Dependency', icon: Folder, color: 'text-green-400' },
    { value: 'architecture', label: 'Architecture', icon: GitBranch, color: 'text-cyan-400' },
    { value: 'bug', label: 'Bug', icon: AlertCircle, color: 'text-red-400' },
    { value: 'todo', label: 'Todo', icon: CheckCircle2, color: 'text-orange-400' },
    { value: 'context', label: 'Context', icon: Info, color: 'text-gray-400' },
    { value: 'preference', label: 'Preference', icon: Settings, color: 'text-pink-400' },
    { value: 'custom', label: 'Custom', icon: FileText, color: 'text-slate-400' },
];

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

// Agent role definitions with icons - synced with AGENT_ROLES from @ironbridge/shared
const agentRoles = [
    { id: 'coordinator', name: 'Coordinator', icon: Brain, color: '#3b82f6', description: 'Orchestrates tasks and manages agents' },
    { id: 'researcher', name: 'Researcher', icon: Search, color: '#10b981', description: 'Gathers and analyzes information' },
    { id: 'coder', name: 'Coder', icon: Code, color: '#f59e0b', description: 'Writes, reviews, and debugs code' },
    { id: 'reviewer', name: 'Reviewer', icon: FileText, color: '#8b5cf6', description: 'Reviews code and provides feedback' },
    { id: 'executor', name: 'Executor', icon: Zap, color: '#ef4444', description: 'Executes tools and commands' },
    { id: 'writer', name: 'Writer', icon: Lightbulb, color: '#ec4899', description: 'Creates and edits documentation' },
    { id: 'tester', name: 'Tester', icon: FlaskConical, color: '#06b6d4', description: 'Creates and runs tests' },
    { id: 'household', name: 'Household', icon: Monitor, color: '#14b8a6', description: 'Monitors and solves home tasks' },
    { id: 'business', name: 'Business', icon: Sparkles, color: '#8b5cf6', description: 'Handles work/business tasks' },
    { id: 'custom', name: 'Custom', icon: Settings, color: '#6b7280', description: 'Custom agent configuration' },
];

/**
 * The four orchestrations `POST /api/swarms` accepts.
 *
 * This list used to offer `collaborative` and `competitive`, which the server
 * has no notion of, and to omit `debate`, which it does. It did not matter at
 * the time because the select's value was never read -- see `handleCreateSwarm`.
 */
const executionPatterns = [
    { id: 'sequential', name: 'Sequential', description: 'One agent at a time' },
    { id: 'parallel', name: 'Parallel', description: 'All agents simultaneously' },
    { id: 'hierarchical', name: 'Hierarchical', description: 'Leader-worker structure' },
    { id: 'debate', name: 'Debate', description: 'Agents argue to a conclusion' },
] as const;

type Orchestration = (typeof executionPatterns)[number]['id'];

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

// Swarm Templates - roles use valid AgentRole values: coordinator, researcher, coder, reviewer, executor, writer, tester, household, business, custom
const SWARM_TEMPLATES = [
    {
        id: 'dev-team',
        name: 'Development Team',
        description: 'Full-stack development swarm with coordinator, coder, reviewer, and tester roles',
        roles: ['coordinator', 'coder', 'reviewer', 'tester'] as const,
        icon: Code,
        color: '#10b981',
    },
    {
        id: 'research-team',
        name: 'Research Team',
        description: 'Research and analysis swarm with researcher, writer, and reviewer roles',
        roles: ['coordinator', 'researcher', 'writer', 'reviewer'] as const,
        icon: Search,
        color: '#3b82f6',
    },
    {
        id: 'security-team',
        name: 'Security Team',
        description: 'Security audit swarm with tester and executor roles',
        roles: ['coordinator', 'researcher', 'tester', 'executor'] as const,
        icon: Shield,
        color: '#ef4444',
    },
    {
        id: 'content-team',
        name: 'Content Team',
        description: 'Content creation swarm with writer, editor, and reviewer roles',
        roles: ['coordinator', 'writer', 'reviewer', 'custom'] as const,
        icon: FileText,
        color: '#f59e0b',
    },
];

// Agent Templates - roles use valid AgentRole values: coordinator, researcher, coder, reviewer, executor, writer, tester, household, business, custom
/*
 * `instruction` is what the server requires and what the agent is actually
 * told to do. A template fills it in so choosing one produces a working
 * agent; the field stays editable because a default directive is a starting
 * point, not an answer.
 */
const AGENT_TEMPLATES = [
    { id: 'coordinator', name: 'Coordinator', role: 'coordinator', description: 'Orchestrates tasks and manages agents', instruction: 'Break the task into steps, delegate them to the other agents, and assemble their results.', icon: Brain },
    { id: 'researcher', name: 'Researcher', role: 'researcher', description: 'Gathers and analyzes information', instruction: 'Gather relevant information, weigh the sources, and report what is supported and what is not.', icon: Search },
    { id: 'coder', name: 'Coder', role: 'coder', description: 'Writes, reviews, and debugs code', instruction: 'Write and fix code that matches the surrounding style. Explain what you changed and why.', icon: Code },
    { id: 'reviewer', name: 'Reviewer', role: 'reviewer', description: 'Reviews code and provides feedback', instruction: 'Review the change for correctness first, then for clarity. Say plainly what is wrong and what would fix it.', icon: FileText },
    { id: 'executor', name: 'Executor', role: 'executor', description: 'Executes tools and commands', instruction: 'Run the tools needed to complete the task and report exactly what each one returned.', icon: Zap },
    { id: 'writer', name: 'Writer', role: 'writer', description: 'Creates and edits documentation', instruction: 'Write documentation that matches what the code does, not what it was meant to do.', icon: Lightbulb },
    { id: 'tester', name: 'Tester', role: 'tester', description: 'Creates and runs tests', instruction: 'Write tests that would fail if the behaviour regressed, and run them.', icon: FlaskConical },
    { id: 'custom', name: 'Custom', role: 'custom', description: 'Custom agent configuration', instruction: '', icon: Settings },
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
type AgentTypeTab = 'all' | 'swe' | 'os' | 'network' | 'cyber' | 'web' | 'social' | 'research' | 'swarms' | 'inbox';

const agentTypeTabs: { id: AgentTypeTab; label: string; icon: typeof Bot; path: string }[] = [
    { id: 'inbox', label: 'Inbox', icon: MessageSquare, path: '/agents' },
    { id: 'all', label: 'All Agents', icon: Bot, path: '/agents/all' },
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
    const [newSwarmOrchestration, setNewSwarmOrchestration] = useState<Orchestration>('sequential');
    const deleteSwarm = useDeleteSwarm();
    const updateSwarm = useUpdateSwarm();
    const addSwarmAgent = useAddSwarmAgent();

    // Agent mutation hooks
    const createAgent = useCreateAgent();
    const deleteAgent = useDeleteAgent();
    const updateAgent = useUpdateAgent();

    // Edit agent modal state
    const [showEditAgentModal, setShowEditAgentModal] = useState(false);
    const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
    const [editAgentName, setEditAgentName] = useState('');
    const [editAgentDescription, setEditAgentDescription] = useState('');

    // Determine active tab from URL - defaults to inbox
    const activeTab = useMemo((): AgentTypeTab => {
        const path = location.pathname;
        if (path === '/agents/inbox' || path === '/agents') return 'inbox';
        if (path === '/agents/swe') return 'swe';
        if (path === '/agents/os') return 'os';
        if (path === '/agents/network') return 'network';
        if (path === '/agents/cyber') return 'cyber';
        if (path === '/agents/web') return 'web';
        if (path === '/agents/social') return 'social';
        if (path === '/agents/research') return 'research';
        if (path === '/agents/swarms') return 'swarms';
        if (path === '/agents/all') return 'all';
        return 'inbox';
    }, [location.pathname]);

    // Agents tab state
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    const [expandedLogs, setExpandedLogs] = useState(true);

    // Swarms tab state
    const [selectedSwarm, setSelectedSwarm] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showAddAgentModal, setShowAddAgentModal] = useState(false);
    // The two selects in that modal had no value and no onChange, and its
    // confirm button only closed the dialog. Nothing could have been sent:
    // until now there was no route to send it to.
    const [newMemberAgentId, setNewMemberAgentId] = useState('');
    const [newMemberRole, setNewMemberRole] = useState(agentRoles[0]?.id ?? '');
    const [addMemberError, setAddMemberError] = useState<string | null>(null);
    const [newSwarmName, setNewSwarmName] = useState('');
    const [newSwarmDescription, setNewSwarmDescription] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

    // Create Agent modal state
    const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);
    const [newAgentName, setNewAgentName] = useState('');
    const [newAgentDescription, setNewAgentDescription] = useState('');
    const [newAgentRole, setNewAgentRole] = useState<import('@ironbridge/shared').AgentRole>('custom');
    // Required by the server; there was no field for it, which is why
    // creating an agent from this page always answered 400.
    const [newAgentInstruction, setNewAgentInstruction] = useState('');
    const [selectedAgentTemplate, setSelectedAgentTemplate] = useState<string | null>(null);

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

        // Get template data if selected
        const template = selectedTemplate ? SWARM_TEMPLATES.find(t => t.id === selectedTemplate) : null;

        // `orchestration` and `agents` are required by the server and were both
        // missing here, so this call returned 400 every time it was made. The
        // swarm starts with no agents; a template contributes its name and
        // description, not its roles, because there are no agent ids to bind
        // those roles to at creation time.
        await createSwarm.mutate({
            name: newSwarmName.trim(),
            description: newSwarmDescription.trim() || template?.description || undefined,
            orchestration: newSwarmOrchestration,
            agents: [],
        });
        setShowCreateModal(false);
        setNewSwarmName('');
        setNewSwarmDescription('');
        setNewSwarmOrchestration('sequential');
        setSelectedTemplate(null);
    };

    const handleSelectTemplate = (templateId: string) => {
        const template = SWARM_TEMPLATES.find(t => t.id === templateId);
        if (template) {
            if (selectedTemplate === templateId) {
                // Deselect
                setSelectedTemplate(null);
            } else {
                setSelectedTemplate(templateId);
                setNewSwarmName(template.name);
                setNewSwarmDescription(template.description);
            }
        }
    };

    // Create Agent handlers
    // `selectedSwarm` is the id, not the swarm.
    const handleAddAgentToSwarm = async () => {
        if (!selectedSwarm || !newMemberAgentId || !newMemberRole) return;
        setAddMemberError(null);
        try {
            await addSwarmAgent.mutate({
                id: selectedSwarm,
                member: { agent_id: newMemberAgentId, role: newMemberRole },
            });
            refetchSwarms();
            setShowAddAgentModal(false);
            setNewMemberAgentId('');
        } catch (error) {
            // The server says why -- no such agent, no such swarm, a blank
            // role. Closing the dialog on a failure would report an addition
            // that did not happen.
            setAddMemberError(error instanceof Error ? error.message : String(error));
        }
    };

    const handleCreateAgent = async () => {
        // Both are required by `POST /api/agents`, so both are required
        // here -- the alternative is a 400 the user cannot act on.
        if (!newAgentName.trim()) return;

        const template = selectedAgentTemplate ? AGENT_TEMPLATES.find(t => t.id === selectedAgentTemplate) : null;

        await createAgent.mutate({
            name: newAgentName.trim(),
            instruction: newAgentInstruction.trim() || template?.instruction || '',
            description: newAgentDescription.trim() || template?.description || undefined,
            role: template?.role || newAgentRole,
        });

        setShowCreateAgentModal(false);
        setNewAgentName('');
        setNewAgentDescription('');
        setNewAgentRole('custom');
        setSelectedAgentTemplate(null);
        refetchAgents();
    };

    const handleSelectAgentTemplate = (templateId: string) => {
        const template = AGENT_TEMPLATES.find(t => t.id === templateId);
        if (template) {
            if (selectedAgentTemplate === templateId) {
                setSelectedAgentTemplate(null);
            } else {
                setSelectedAgentTemplate(templateId);
                setNewAgentName(template.name);
                setNewAgentDescription(template.description);
                setNewAgentRole(template.role as import('@ironbridge/shared').AgentRole);
            }
        }
    };

    const handleEditAgent = (agent: Agent) => {
        setEditingAgent(agent);
        setEditAgentName(agent.name);
        setEditAgentDescription(agent.description || '');
        setShowEditAgentModal(true);
    };

    const handleUpdateAgent = async () => {
        if (!editingAgent || !editAgentName.trim()) return;

        await updateAgent.mutate({
            id: editingAgent.id,
            data: {
                name: editAgentName.trim(),
                description: editAgentDescription.trim() || undefined,
            },
        });

        setShowEditAgentModal(false);
        setEditingAgent(null);
        setEditAgentName('');
        setEditAgentDescription('');
        refetchAgents();
    };

    const handleDeleteAgent = async (agentId: string) => {
        if (confirm('Are you sure you want to delete this agent?')) {
            await deleteAgent.mutate(agentId);
            refetchAgents();
        }
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

        // Map tab to agent roles from AgentRole type: coordinator, researcher, coder, reviewer, executor, writer, tester, household, business, custom
        const roleMapping: Record<string, string[]> = {
            swe: ['coder', 'reviewer', 'tester'],
            os: ['executor', 'custom'],
            network: ['executor', 'custom'],
            cyber: ['executor', 'tester', 'custom'],
            web: ['researcher', 'writer'],
            social: ['writer', 'coordinator'],
            research: ['researcher', 'coordinator'],
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
                        <button
                            onClick={() => setShowCreateAgentModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90 transition-colors"
                        >
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
            {activeTab === 'inbox' ? (
                <AgentInbox />
            ) : activeTab === 'swarms' ? (
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
            ) : activeTab === 'swe' ? (
                <SWETab
                    agentsData={filteredAgentsData}
                    selectedAgent={selectedAgent}
                    setSelectedAgent={setSelectedAgent}
                    onEditAgent={(agent) => handleEditAgent(agent as unknown as Agent)}
                    onDeleteAgent={handleDeleteAgent}
                    onCreateAgent={() => setShowCreateAgentModal(true)}
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
                    onEditAgent={(agent) => handleEditAgent(agent as unknown as Agent)}
                    onDeleteAgent={handleDeleteAgent}
                    onCreateAgent={() => setShowCreateAgentModal(true)}
                />
            )}

            {/* Create Swarm Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[hsl(var(--card))] rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] mb-4">Create New Swarm</h2>
                        <div className="space-y-4">
                            {/* Templates Section */}
                            <div>
                                <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-2">Quick Start Templates</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {SWARM_TEMPLATES.map((template) => {
                                        const Icon = template.icon;
                                        const isSelected = selectedTemplate === template.id;
                                        return (
                                            <button
                                                key={template.id}
                                                type="button"
                                                onClick={() => handleSelectTemplate(template.id)}
                                                className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left ${isSelected
                                                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5'
                                                    : 'border-[hsl(var(--border))] hover:border-[hsl(var(--muted-foreground))]'
                                                    }`}
                                            >
                                                <div
                                                    className="p-2 rounded-lg shrink-0"
                                                    style={{ backgroundColor: `${template.color}20` }}
                                                >
                                                    <Icon size={18} style={{ color: template.color }} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium text-[hsl(var(--foreground))]">{template.name}</div>
                                                    <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2">{template.description}</div>
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {template.roles.slice(0, 3).map((role) => (
                                                            <span
                                                                key={role}
                                                                className="px-1.5 py-0.5 rounded text-[10px] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                                                            >
                                                                {role}
                                                            </span>
                                                        ))}
                                                        {template.roles.length > 3 && (
                                                            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                                                                +{template.roles.length - 3}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="border-t border-[hsl(var(--border))] pt-4">
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
                                <select
                                    value={newSwarmOrchestration}
                                    onChange={(e) => setNewSwarmOrchestration(e.target.value as Orchestration)}
                                    className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                >
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
                                    <Link to="/agents/protocols" className="ml-auto text-xs text-[hsl(var(--primary))] hover:underline" onClick={() => setShowCreateModal(false)}>
                                        Learn more
                                    </Link>
                                </div>

                                {/* These three were <select>s with no value and no onChange:
                                    a user could pick Particle Swarm, PBFT and Gossip, and
                                    nothing read the choice. Nothing could have -- POST
                                    /api/swarms accepts name, description, orchestration,
                                    agents and max_iterations, and the server has no
                                    implementation of any swarm-intelligence algorithm or
                                    consensus protocol. They are listed here as reference
                                    until there is something to configure. */}
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                    Swarm-intelligence algorithms, consensus protocols and
                                    communication protocols are not yet configurable: the server
                                    accepts only an execution pattern. See{' '}
                                    <Link
                                        to="/agents/protocols"
                                        className="text-[hsl(var(--primary))] hover:underline"
                                        onClick={() => setShowCreateModal(false)}
                                    >
                                        Protocols
                                    </Link>{' '}
                                    for what each one is.
                                </p>
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
                                <select
                                    value={newMemberAgentId}
                                    onChange={(e) => setNewMemberAgentId(e.target.value)}
                                    className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                >
                                    {agents.length === 0 ? (
                                        <option value="" disabled>No agents available</option>
                                    ) : (
                                        <>
                                            <option value="" disabled>Choose an agent</option>
                                            {agents.map(agent => (
                                                <option key={agent.id} value={agent.id}>{agent.name} ({agent.providerId || 'N/A'})</option>
                                            ))}
                                        </>
                                    )}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">Role in Swarm</label>
                                <select
                                    value={newMemberRole}
                                    onChange={(e) => setNewMemberRole(e.target.value)}
                                    className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                >
                                    {agentRoles.map(role => (
                                        <option key={role.id} value={role.id}>{role.name} - {role.description}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        {addMemberError && (
                            <p className="mt-4 text-sm text-red-500">{addMemberError}</p>
                        )}
                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => {
                                    setShowAddAgentModal(false);
                                    setAddMemberError(null);
                                }}
                                className="px-4 py-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddAgentToSwarm}
                                disabled={addSwarmAgent.isLoading || !newMemberAgentId || !newMemberRole}
                                className="px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90 transition-colors disabled:opacity-50"
                            >
                                {addSwarmAgent.isLoading ? 'Adding...' : 'Add Agent'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Agent Modal */}
            {showCreateAgentModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[hsl(var(--card))] rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] mb-4">Create New Agent</h2>
                        <div className="space-y-4">
                            {/* Agent Templates */}
                            <div>
                                <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-2">Quick Start Templates</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {AGENT_TEMPLATES.map((template) => {
                                        const Icon = template.icon;
                                        const isSelected = selectedAgentTemplate === template.id;
                                        const roleInfo = agentRoles.find(r => r.id === template.role);
                                        return (
                                            <button
                                                key={template.id}
                                                type="button"
                                                onClick={() => handleSelectAgentTemplate(template.id)}
                                                className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left ${isSelected
                                                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5'
                                                    : 'border-[hsl(var(--border))] hover:border-[hsl(var(--muted-foreground))]'
                                                    }`}
                                            >
                                                <div
                                                    className="p-2 rounded-lg shrink-0"
                                                    style={{ backgroundColor: `${roleInfo?.color || '#6b7280'}20` }}
                                                >
                                                    <Icon size={18} style={{ color: roleInfo?.color || '#6b7280' }} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium text-[hsl(var(--foreground))]">{template.name}</div>
                                                    <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2">{template.description}</div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="border-t border-[hsl(var(--border))] pt-4">
                                <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">Name</label>
                                <input
                                    type="text"
                                    value={newAgentName}
                                    onChange={(e) => setNewAgentName(e.target.value)}
                                    className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                    placeholder="My Agent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">Description</label>
                                <textarea
                                    value={newAgentDescription}
                                    onChange={(e) => setNewAgentDescription(e.target.value)}
                                    className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] resize-none"
                                    rows={3}
                                    placeholder="What will this agent do?"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">
                                    Instruction
                                </label>
                                <textarea
                                    value={newAgentInstruction}
                                    onChange={(e) => setNewAgentInstruction(e.target.value)}
                                    className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] resize-none"
                                    rows={3}
                                    placeholder={
                                        selectedAgentTemplate
                                            ? AGENT_TEMPLATES.find(t => t.id === selectedAgentTemplate)?.instruction
                                            : 'What should this agent do?'
                                    }
                                />
                                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                    What the agent is told to do. Required — a template fills it in if you leave it blank.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">Role</label>
                                <select
                                    value={newAgentRole}
                                    onChange={(e) => setNewAgentRole(e.target.value as import('@ironbridge/shared').AgentRole)}
                                    className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                >
                                    {agentRoles.map(role => (
                                        <option key={role.id} value={role.id}>{role.name} - {role.description}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => {
                                    setShowCreateAgentModal(false);
                                    setNewAgentName('');
                                    setNewAgentDescription('');
                                    setNewAgentRole('custom');
                                    setSelectedAgentTemplate(null);
                                }}
                                className="px-4 py-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateAgent}
                                disabled={createAgent.isLoading || !newAgentName.trim()}
                                className="px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90 transition-colors disabled:opacity-50"
                            >
                                {createAgent.isLoading ? 'Creating...' : 'Create Agent'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Agent Modal */}
            {showEditAgentModal && editingAgent && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[hsl(var(--card))] rounded-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] mb-4">Edit Agent</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">Name</label>
                                <input
                                    type="text"
                                    value={editAgentName}
                                    onChange={(e) => setEditAgentName(e.target.value)}
                                    className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                    placeholder="Agent name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">Description</label>
                                <textarea
                                    value={editAgentDescription}
                                    onChange={(e) => setEditAgentDescription(e.target.value)}
                                    className="w-full px-3 py-2 bg-[hsl(var(--muted))] rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] resize-none"
                                    rows={3}
                                    placeholder="What does this agent do?"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => {
                                    setShowEditAgentModal(false);
                                    setEditingAgent(null);
                                    setEditAgentName('');
                                    setEditAgentDescription('');
                                }}
                                className="px-4 py-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateAgent}
                                disabled={updateAgent.isLoading || !editAgentName.trim()}
                                className="px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90 transition-colors disabled:opacity-50"
                            >
                                {updateAgent.isLoading ? 'Saving...' : 'Save Changes'}
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
    onEditAgent: (agent: AgentDisplayData) => void;
    onDeleteAgent: (agentId: string) => void;
    onCreateAgent: () => void;
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
    onEditAgent,
    onDeleteAgent,
    onCreateAgent,
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
                            <button
                                onClick={onCreateAgent}
                                className="mt-4 flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90 transition-colors mx-auto"
                            >
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
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onEditAgent(agent); }}
                                            className="p-2 rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/80 transition-colors"
                                            title="Edit Agent"
                                        >
                                            <Settings size={18} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDeleteAgent(agent.id); }}
                                            className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                                            title="Delete Agent"
                                        >
                                            <Trash2 size={18} />
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

// ==================== SWE TAB COMPONENT ====================

interface SWETabProps {
    agentsData: AgentDisplayData[];
    selectedAgent: string | null;
    setSelectedAgent: (id: string | null) => void;
    onEditAgent: (agent: AgentDisplayData) => void;
    onDeleteAgent: (agentId: string) => void;
    onCreateAgent: () => void;
}

function SWETab({
    agentsData,
    selectedAgent,
    setSelectedAgent,
    onEditAgent,
    onDeleteAgent,
    onCreateAgent,
}: SWETabProps) {
    // SWE Memory state
    const [sweProjects, setSweProjects] = useState<SweProject[]>([]);
    const [selectedProject, setSelectedProject] = useState<SweProject | null>(null);
    const [memories, setMemories] = useState<SweMemory[]>([]);
    const [rules, setRules] = useState<SweRule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sweSubTab, setSweSubTab] = useState<'agents' | 'memory' | 'rules'>('agents');
    const [memorySearch, setMemorySearch] = useState('');

    const fetchSweProjects = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${SWE_API_BASE}/swe/projects`);
            const result = await response.json();
            if (result.success && result.data) {
                setSweProjects(result.data);
                if (result.data.length > 0) {
                    setSelectedProject(result.data[0]);
                }
            }
        } catch (error) {
            console.error('Failed to fetch SWE projects:', error);
        }
        setIsLoading(false);
    }, []);

    const fetchMemories = useCallback(async (projectId: string) => {
        try {
            const response = await fetch(`${SWE_API_BASE}/swe/projects/${projectId}/memory`);
            const result = await response.json();
            if (result.success && result.data) {
                setMemories(result.data);
            }
        } catch (error) {
            console.error('Failed to fetch memories:', error);
        }
    }, []);

    const fetchRules = useCallback(async (projectId: string) => {
        try {
            const response = await fetch(`${SWE_API_BASE}/swe/projects/${projectId}/rules`);
            const result = await response.json();
            if (result.success && result.data) {
                setRules(result.data);
            }
        } catch (error) {
            console.error('Failed to fetch rules:', error);
        }
    }, []);

    // Fetch SWE projects on mount
    useEffect(() => {
        startTransition(() => {
            fetchSweProjects();
        });
    }, [fetchSweProjects]);

    // Fetch memories when project changes
    useEffect(() => {
        if (selectedProject) {
            startTransition(() => {
                fetchMemories(selectedProject.id);
                fetchRules(selectedProject.id);
            });
        }
    }, [selectedProject, fetchMemories, fetchRules]);

    const getCategoryInfo = (category: SweMemoryCategory) => {
        return MEMORY_CATEGORIES.find(c => c.value === category) || MEMORY_CATEGORIES[9];
    };

    // Filter SWE-related agents using valid AgentRole values: coder, reviewer, tester
    const sweAgents = agentsData.filter(a =>
        a.role === 'coder' ||
        a.role === 'reviewer' ||
        a.role === 'tester' ||
        a.tools?.some(t => t.toLowerCase().includes('code'))
    );

    // Filter memories by search
    const filteredMemories = memories.filter(m =>
        memorySearch === '' ||
        m.key.toLowerCase().includes(memorySearch.toLowerCase()) ||
        m.value.toLowerCase().includes(memorySearch.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* SWE Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Bot size={18} />
                        <span className="text-sm">SWE Agents</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{sweAgents.length}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">coding specialists</p>
                </div>

                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <FolderOpen size={18} />
                        <span className="text-sm">Projects</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{sweProjects.length}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">with memory</p>
                </div>

                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Brain size={18} />
                        <span className="text-sm">Memories</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{memories.length}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">stored facts</p>
                </div>

                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <BookOpen size={18} />
                        <span className="text-sm">Rules</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{rules.length}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">active constraints</p>
                </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-2 border-b border-[hsl(var(--border))]">
                <button
                    onClick={() => setSweSubTab('agents')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${sweSubTab === 'agents'
                        ? 'text-[hsl(var(--primary))] border-b-2 border-[hsl(var(--primary))]'
                        : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                        }`}
                >
                    <Bot size={16} className="inline mr-2" />
                    SWE Agents
                </button>
                <button
                    onClick={() => setSweSubTab('memory')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${sweSubTab === 'memory'
                        ? 'text-[hsl(var(--primary))] border-b-2 border-[hsl(var(--primary))]'
                        : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                        }`}
                >
                    <Brain size={16} className="inline mr-2" />
                    Memory
                </button>
                <button
                    onClick={() => setSweSubTab('rules')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${sweSubTab === 'rules'
                        ? 'text-[hsl(var(--primary))] border-b-2 border-[hsl(var(--primary))]'
                        : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                        }`}
                >
                    <BookOpen size={16} className="inline mr-2" />
                    Rules
                </button>
                <Link
                    to="/swe-memory"
                    className="ml-auto px-4 py-2 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] flex items-center gap-1"
                >
                    <ExternalLink size={14} />
                    Full SWE Memory
                </Link>
            </div>

            {/* Sub-tab content */}
            {sweSubTab === 'agents' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {sweAgents.length === 0 ? (
                        <div className="col-span-2 bg-[hsl(var(--card))] rounded-xl p-8 border text-center">
                            <Code size={48} className="mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
                            <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">No SWE Agents</h3>
                            <p className="text-[hsl(var(--muted-foreground))] mt-2">
                                Create agents with coder or developer roles for software engineering tasks.
                            </p>
                            <button
                                onClick={onCreateAgent}
                                className="mt-4 flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90 transition-colors mx-auto"
                            >
                                <Plus size={18} />
                                Create SWE Agent
                            </button>
                        </div>
                    ) : (
                        sweAgents.map(agent => (
                            <div
                                key={agent.id}
                                onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
                                className={`bg-[hsl(var(--card))] rounded-xl p-4 border cursor-pointer transition-all hover:border-[hsl(var(--primary))] ${selectedAgent === agent.id ? 'border-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary))]' : ''
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-green-500/10 rounded-lg">
                                            <Code size={20} className="text-green-500" />
                                        </div>
                                        <div>
                                            <span className="font-medium text-[hsl(var(--foreground))]">{agent.name}</span>
                                            <p className="text-sm text-[hsl(var(--muted-foreground))]">{agent.role || 'SWE'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onEditAgent(agent); }}
                                            className="p-2 rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/80 transition-colors"
                                        >
                                            <Settings size={18} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDeleteAgent(agent.id); }}
                                            className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                                {agent.description && (
                                    <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{agent.description}</p>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {sweSubTab === 'memory' && (
                <div className="space-y-4">
                    {/* Project selector */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <FolderOpen size={16} className="text-[hsl(var(--muted-foreground))]" />
                            <select
                                value={selectedProject?.id || ''}
                                onChange={(e) => {
                                    const project = sweProjects.find(p => p.id === e.target.value);
                                    setSelectedProject(project || null);
                                }}
                                className="px-3 py-1.5 bg-[hsl(var(--muted))] rounded-lg text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                            >
                                {sweProjects.length === 0 && <option value="">No projects</option>}
                                {sweProjects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1 relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                            <input
                                type="text"
                                placeholder="Search memories..."
                                value={memorySearch}
                                onChange={(e) => setMemorySearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-[hsl(var(--muted))] rounded-lg text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                            />
                        </div>
                    </div>

                    {/* Memory list */}
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="animate-spin text-[hsl(var(--muted-foreground))]" />
                        </div>
                    ) : filteredMemories.length === 0 ? (
                        <div className="bg-[hsl(var(--card))] rounded-xl p-8 border text-center">
                            <Brain size={48} className="mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
                            <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">No Memories</h3>
                            <p className="text-[hsl(var(--muted-foreground))] mt-2">
                                {selectedProject ? 'Add memories to help agents understand your project.' : 'Select a project first.'}
                            </p>
                            <Link
                                to="/swe-memory"
                                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90 transition-colors"
                            >
                                <Plus size={18} />
                                Add Memory
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {filteredMemories.slice(0, 10).map(memory => {
                                const catInfo = getCategoryInfo(memory.category);
                                const Icon = catInfo.icon;
                                return (
                                    <div key={memory.id} className="bg-[hsl(var(--card))] rounded-lg p-3 border">
                                        <div className="flex items-start gap-2">
                                            <Icon size={16} className={catInfo.color} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-sm text-[hsl(var(--foreground))] truncate">{memory.key}</span>
                                                    <span className={`text-xs ${catInfo.color}`}>{catInfo.label}</span>
                                                </div>
                                                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 line-clamp-2">{memory.value}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredMemories.length > 10 && (
                                <Link
                                    to="/swe-memory"
                                    className="col-span-2 text-center py-2 text-sm text-[hsl(var(--primary))] hover:underline"
                                >
                                    View all {filteredMemories.length} memories →
                                </Link>
                            )}
                        </div>
                    )}
                </div>
            )}

            {sweSubTab === 'rules' && (
                <div className="space-y-4">
                    {/* Project selector */}
                    <div className="flex items-center gap-2">
                        <FolderOpen size={16} className="text-[hsl(var(--muted-foreground))]" />
                        <select
                            value={selectedProject?.id || ''}
                            onChange={(e) => {
                                const project = sweProjects.find(p => p.id === e.target.value);
                                setSelectedProject(project || null);
                            }}
                            className="px-3 py-1.5 bg-[hsl(var(--muted))] rounded-lg text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                        >
                            {sweProjects.length === 0 && <option value="">No projects</option>}
                            {sweProjects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Rules list */}
                    {rules.length === 0 ? (
                        <div className="bg-[hsl(var(--card))] rounded-xl p-8 border text-center">
                            <BookOpen size={48} className="mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
                            <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">No Rules</h3>
                            <p className="text-[hsl(var(--muted-foreground))] mt-2">
                                {selectedProject ? 'Add rules to guide agent behavior.' : 'Select a project first.'}
                            </p>
                            <Link
                                to="/swe-memory"
                                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90 transition-colors"
                            >
                                <Plus size={18} />
                                Add Rule
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {rules.slice(0, 8).map(rule => (
                                <div key={rule.id} className="bg-[hsl(var(--card))] rounded-lg p-3 border flex items-start gap-3">
                                    <div className={`px-2 py-0.5 rounded text-xs font-medium ${rule.category === 'constraint' ? 'bg-red-500/10 text-red-400' :
                                        rule.category === 'requirement' ? 'bg-green-500/10 text-green-400' :
                                            rule.category === 'security' ? 'bg-yellow-500/10 text-yellow-400' :
                                                'bg-blue-500/10 text-blue-400'
                                        }`}>
                                        {rule.category}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-[hsl(var(--foreground))]">{rule.rule}</p>
                                        {rule.description && (
                                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{rule.description}</p>
                                        )}
                                    </div>
                                    <div className={`w-2 h-2 rounded-full ${rule.enabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                                </div>
                            ))}
                            {rules.length > 8 && (
                                <Link
                                    to="/swe-memory"
                                    className="block text-center py-2 text-sm text-[hsl(var(--primary))] hover:underline"
                                >
                                    View all {rules.length} rules →
                                </Link>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
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
                            <Link to="/agents/protocols" className="text-sm text-[hsl(var(--primary))] hover:underline flex items-center gap-1">
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
