import React, { useState, useMemo, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    Alert,
    TextInput,
    Modal,
    ScrollView,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAgentsContext } from '../context/AgentsContext';
import { useTheme } from '../context/ThemeContext';
import {
    AgentRun,
    AgentSwarm,
    AGENT_TEMPLATES,
    SWARM_TEMPLATES,
    AgentRole,
} from '../api/agents';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type AgentsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Agents'>;

interface Props {
    navigation: AgentsScreenNavigationProp;
}

// Agent type tabs matching csm-web
const AGENT_TYPE_TABS = [
    { id: 'inbox', label: 'Inbox', icon: 'mail-outline' },
    { id: 'all', label: 'All Agents', icon: 'apps-outline' },
    { id: 'swe', label: 'SWE', icon: 'code-slash-outline' },
    { id: 'os', label: 'OS', icon: 'desktop-outline' },
    { id: 'network', label: 'Network', icon: 'wifi-outline' },
    { id: 'cyber', label: 'Cyber', icon: 'shield-outline' },
    { id: 'web', label: 'Web', icon: 'globe-outline' },
    { id: 'social', label: 'Social', icon: 'share-social-outline' },
    { id: 'research', label: 'Research', icon: 'flask-outline' },
    { id: 'swarms', label: 'Swarms', icon: 'people-outline' },
] as const;

type AgentTab = typeof AGENT_TYPE_TABS[number]['id'];

// Quick access tools for agentic AI features
const AGENT_TOOLS = [
    {
        id: 'inbox',
        title: 'Inbox',
        subtitle: 'Messages & Permissions',
        icon: 'mail-outline',
        color: '#8b5cf6',
        route: 'AgentInbox' as keyof RootStackParamList,
    },
    {
        id: 'protocols',
        title: 'Protocols',
        subtitle: 'MCP, A2A, NANDA',
        icon: 'git-network-outline',
        color: '#f59e0b',
        route: 'Protocols' as keyof RootStackParamList,
    },
    {
        id: 'developer',
        title: 'Developer',
        subtitle: 'ML & Fine-tuning',
        icon: 'code-slash-outline',
        color: '#06b6d4',
        route: 'Developer' as keyof RootStackParamList,
    },
];

// Agent roles with colors and icons (matching csm-web)
const AGENT_ROLE_INFO: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
    coordinator: { label: 'Coordinator', color: '#8b5cf6', icon: 'git-branch-outline' },
    researcher: { label: 'Researcher', color: '#3b82f6', icon: 'search-outline' },
    coder: { label: 'Coder', color: '#10b981', icon: 'code-slash-outline' },
    reviewer: { label: 'Reviewer', color: '#f59e0b', icon: 'document-text-outline' },
    planner: { label: 'Planner', color: '#ec4899', icon: 'bulb-outline' },
    executor: { label: 'Executor', color: '#06b6d4', icon: 'play-outline' },
    validator: { label: 'Validator', color: '#84cc16', icon: 'shield-checkmark-outline' },
    specialist: { label: 'Specialist', color: '#f97316', icon: 'sparkles-outline' },
    swe: { label: 'SWE Agent', color: '#10b981', icon: 'code-slash-outline' },
    os: { label: 'OS Agent', color: '#6366f1', icon: 'desktop-outline' },
    network: { label: 'Network Agent', color: '#8b5cf6', icon: 'wifi-outline' },
    cyber: { label: 'Cyber Agent', color: '#ef4444', icon: 'shield-outline' },
    web: { label: 'Web Agent', color: '#3b82f6', icon: 'globe-outline' },
    social: { label: 'Social Agent', color: '#ec4899', icon: 'share-social-outline' },
    research: { label: 'Research Agent', color: '#f59e0b', icon: 'flask-outline' },
    custom: { label: 'Custom', color: '#6b7280', icon: 'construct-outline' },
};

// Swarm algorithms (matching csm-web)
const SWARM_ALGORITHMS = [
    { id: 'pso', name: 'Particle Swarm', description: 'Optimizes via social behavior' },
    { id: 'aco', name: 'Ant Colony', description: 'Pheromone-based pathfinding' },
    { id: 'abc', name: 'Artificial Bee', description: 'Foraging optimization' },
    { id: 'gso', name: 'Glowworm Swarm', description: 'Local optima discovery' },
    { id: 'fa', name: 'Firefly Algorithm', description: 'Attraction-based search' },
    { id: 'ba', name: 'Bat Algorithm', description: 'Echolocation optimization' },
];

// Consensus protocols (matching csm-web)
const CONSENSUS_PROTOCOLS = [
    { id: 'pbft', name: 'PBFT', description: 'Byzantine fault tolerance' },
    { id: 'raft', name: 'Raft', description: 'Leader-based consensus' },
    { id: 'voting', name: 'Majority Voting', description: 'Democratic decision making' },
    { id: 'federated', name: 'Federated', description: 'Distributed learning consensus' },
];

// Communication protocols (matching csm-web)
const COMMUNICATION_PROTOCOLS = [
    { id: 'direct', name: 'Direct Messaging', description: 'One-to-one communication' },
    { id: 'broadcast', name: 'Broadcast', description: 'One-to-all messaging' },
    { id: 'gossip', name: 'Gossip Protocol', description: 'Epidemic information spread' },
    { id: 'pubsub', name: 'Pub/Sub', description: 'Topic-based messaging' },
    { id: 'rpc', name: 'RPC', description: 'Direct request-response' },
];

// Activity log entry type
interface ActivityLogEntry {
    time: string;
    agent: string;
    action: string;
    type: 'success' | 'warning' | 'error' | 'info' | 'pause';
}

const STATUS_COLORS: Record<string, string> = {
    running: '#007AFF',
    completed: '#34C759',
    failed: '#FF3B30',
    cancelled: '#8E8E93',
    idle: '#8E8E93',
    paused: '#FF9500',
};

const ROLE_ICONS: Record<AgentRole, keyof typeof Ionicons.glyphMap> = {
    coordinator: 'git-branch-outline',
    researcher: 'search-outline',
    coder: 'code-slash-outline',
    reviewer: 'checkmark-circle-outline',
    executor: 'play-outline',
    writer: 'document-text-outline',
    tester: 'flask-outline',
    custom: 'construct-outline',
};

// SWE Memory types and sample data
interface SweMemory {
    id: string;
    type: 'solution' | 'pattern' | 'debug' | 'review' | 'architecture' | 'performance' | 'security' | 'testing' | 'refactoring' | 'documentation';
    title: string;
    description: string;
    language: string;
    tags: string[];
    codeSnippet?: string;
    linkedSession?: string;
    createdAt: string;
    useCount: number;
}

interface SweProject {
    id: string;
    name: string;
    path: string;
    language: string;
    lastAccessed: string;
    memoriesCount: number;
}

interface SweRule {
    id: string;
    type: 'style' | 'architecture' | 'naming' | 'security' | 'performance' | 'testing';
    title: string;
    description: string;
    enabled: boolean;
    severity: 'info' | 'warning' | 'error';
}

const SWE_MEMORY_TYPES: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
    solution: { icon: 'bulb-outline', color: '#10b981', label: 'Solution' },
    pattern: { icon: 'git-branch-outline', color: '#3b82f6', label: 'Pattern' },
    debug: { icon: 'bug-outline', color: '#f59e0b', label: 'Debug' },
    review: { icon: 'eye-outline', color: '#8b5cf6', label: 'Review' },
    architecture: { icon: 'cube-outline', color: '#06b6d4', label: 'Architecture' },
    performance: { icon: 'speedometer-outline', color: '#ec4899', label: 'Performance' },
    security: { icon: 'shield-checkmark-outline', color: '#ef4444', label: 'Security' },
    testing: { icon: 'flask-outline', color: '#84cc16', label: 'Testing' },
    refactoring: { icon: 'refresh-outline', color: '#f97316', label: 'Refactoring' },
    documentation: { icon: 'document-text-outline', color: '#6366f1', label: 'Documentation' },
};

const SAMPLE_SWE_MEMORIES: SweMemory[] = [
    {
        id: '1',
        type: 'solution',
        title: 'React Hook Dependency Fix',
        description: 'Resolved infinite re-render by memoizing callbacks',
        language: 'typescript',
        tags: ['react', 'hooks', 'performance'],
        createdAt: '2024-12-12T10:00:00Z',
        useCount: 5,
    },
    {
        id: '2',
        type: 'pattern',
        title: 'API Error Handling',
        description: 'Consistent error handling with retry logic',
        language: 'typescript',
        tags: ['api', 'error-handling'],
        createdAt: '2024-12-10T14:30:00Z',
        useCount: 12,
    },
    {
        id: '3',
        type: 'debug',
        title: 'SQLite Connection Pool',
        description: 'Fixed connection exhaustion with proper pooling',
        language: 'rust',
        tags: ['database', 'sqlite'],
        createdAt: '2024-12-08T09:15:00Z',
        useCount: 3,
    },
];

const SAMPLE_SWE_PROJECTS: SweProject[] = [
    { id: '1', name: 'ChatSessionManager', path: '/dev/csm', language: 'Rust/TS', lastAccessed: '2024-12-12', memoriesCount: 24 },
    { id: '2', name: 'csm-web', path: '/dev/csm/csm-web', language: 'TypeScript', lastAccessed: '2024-12-12', memoriesCount: 18 },
    { id: '3', name: 'csm-app', path: '/dev/csm/csm-app', language: 'TypeScript', lastAccessed: '2024-12-11', memoriesCount: 12 },
];

const SAMPLE_SWE_RULES: SweRule[] = [
    { id: '1', type: 'style', title: 'Prefer const', description: 'Use const over let where possible', enabled: true, severity: 'info' },
    { id: '2', type: 'naming', title: 'CamelCase', description: 'Use camelCase for variables', enabled: true, severity: 'warning' },
    { id: '3', type: 'security', title: 'No eval', description: 'Avoid using eval()', enabled: true, severity: 'error' },
];

export function AgentsScreen({ navigation }: Props) {
    const { colors, isDark } = useTheme();
    const {
        runs,
        swarms,
        agents,
        addSwarm,
        addAgent,
        startRun,
        removeRun,
        removeSwarm,
        removeAgent,
        updateAgent,
    } = useAgentsContext();

    const [activeTab, setActiveTab] = useState<AgentTab>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createType, setCreateType] = useState<'swarm' | 'agent' | 'run'>('swarm');
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
    const [selectedAlgorithm, setSelectedAlgorithm] = useState<string>('');
    const [selectedConsensus, setSelectedConsensus] = useState<string>('');
    const [selectedCommunication, setSelectedCommunication] = useState<string>('direct');
    const [expandedLogs, setExpandedLogs] = useState(true);
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

    // Edit agent modal state
    const [showEditAgentModal, setShowEditAgentModal] = useState(false);
    const [editingAgent, setEditingAgent] = useState<typeof agents[0] | null>(null);
    const [editAgentName, setEditAgentName] = useState('');
    const [editAgentDescription, setEditAgentDescription] = useState('');

    // SWE Memory state (for embedded SWE tab content)
    const [sweSubTab, setSweSubTab] = useState<'agents' | 'memory' | 'rules'>('agents');
    const [sweMemories, setSweMemories] = useState<SweMemory[]>([]);
    const [sweProjects, setSweProjects] = useState<SweProject[]>([]);
    const [sweRules, setSweRules] = useState<SweRule[]>([]);
    const [selectedSweProject, setSelectedSweProject] = useState<SweProject | null>(null);
    const [sweMemorySearch, setSweMemorySearch] = useState('');
    const [isSweLoading, setIsSweLoading] = useState(false);

    // Mock activity log (in production, would come from API)
    const [activityLog] = useState<ActivityLogEntry[]>([
        { time: '14:23', agent: 'Code Agent', action: 'Completed PR review', type: 'success' },
        { time: '14:20', agent: 'Research Agent', action: 'Found 5 relevant papers', type: 'info' },
        { time: '14:15', agent: 'Test Agent', action: 'All tests passing', type: 'success' },
        { time: '14:10', agent: 'Security Agent', action: 'Detected potential vulnerability', type: 'warning' },
        { time: '14:05', agent: 'Code Agent', action: 'Started refactoring task', type: 'info' },
    ]);

    // Calculate stats
    const stats = useMemo(() => {
        const totalTokens = runs.reduce((acc, run) => acc + (run.tokensUsed || 0), 0);
        const totalMessages = runs.reduce((acc, run) => acc + run.messages.length, 0);
        const runningAgents = agents.filter(a => a.status === 'executing' || a.status === 'thinking').length;
        const uniqueProviders = new Set(agents.map(a => a.providerId).filter(Boolean));

        return {
            totalAgents: agents.length,
            totalTokens,
            totalMessages,
            runningAgents,
            providersCount: uniqueProviders.size || 1, // At least 1 if we have agents
        };
    }, [agents, runs]);

    // Filter agents by type/category
    const filteredAgents = useMemo(() => {
        if (activeTab === 'all' || activeTab === 'inbox' || activeTab === 'swarms') {
            return agents;
        }
        // Filter by role matching the tab
        return agents.filter(agent => {
            const role = agent.role?.toLowerCase() || '';
            return role.includes(activeTab) ||
                (activeTab === 'swe' && (role === 'coder' || role === 'developer')) ||
                (activeTab === 'research' && role === 'researcher');
        });
    }, [agents, activeTab]);

    // Get role info helper
    const getRoleInfo = (role?: string) => {
        return AGENT_ROLE_INFO[role || 'custom'] || AGENT_ROLE_INFO.custom;
    };

    const handleCreate = () => {
        if (!newName.trim()) {
            Alert.alert('Error', 'Please enter a name');
            return;
        }

        if (createType === 'swarm') {
            const swarm = addSwarm(newName, newDescription);
            // Store protocol selections with swarm (would be persisted in production)
            console.log('Creating swarm with protocols:', {
                algorithm: selectedAlgorithm,
                consensus: selectedConsensus,
                communication: selectedCommunication,
            });
            if (selectedTemplate !== null) {
                const template = SWARM_TEMPLATES[selectedTemplate];
                template.roles.forEach((role, index) => {
                    const agentTemplate = AGENT_TEMPLATES.find(t => t.role === role);
                    if (agentTemplate) {
                        const agent = addAgent(
                            `${agentTemplate.name} ${index + 1}`,
                            role,
                            agentTemplate.description || ''
                        );
                    }
                });
            }
        } else if (createType === 'agent') {
            const template = selectedTemplate !== null ? AGENT_TEMPLATES[selectedTemplate] : null;
            addAgent(
                newName,
                template?.role || 'custom',
                newDescription || template?.description || ''
            );
        } else if (createType === 'run') {
            startRun(newName, newDescription);
        }

        setShowCreateModal(false);
        setNewName('');
        setNewDescription('');
        setSelectedTemplate(null);
        setSelectedAlgorithm('');
        setSelectedConsensus('');
        setSelectedCommunication('direct');
    };

    const handleDeleteRun = (run: AgentRun) => {
        Alert.alert(
            'Delete Run',
            `Are you sure you want to delete "${run.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => removeRun(run.id),
                },
            ]
        );
    };

    const handleEditAgent = (agent: typeof agents[0]) => {
        setEditingAgent(agent);
        setEditAgentName(agent.name);
        setEditAgentDescription(agent.description || '');
        setShowEditAgentModal(true);
    };

    const handleUpdateAgent = () => {
        if (!editingAgent || !editAgentName.trim()) return;

        updateAgent({
            ...editingAgent,
            name: editAgentName.trim(),
            description: editAgentDescription.trim() || null,
        });

        setShowEditAgentModal(false);
        setEditingAgent(null);
        setEditAgentName('');
        setEditAgentDescription('');
    };

    const handleDeleteAgent = (agent: typeof agents[0]) => {
        Alert.alert(
            'Delete Agent',
            `Are you sure you want to delete "${agent.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => removeAgent(agent.id),
                },
            ]
        );
    };

    const formatDuration = (start: number, end?: number): string => {
        const duration = (end || Date.now()) - start;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        }
        return `${seconds}s`;
    };

    const formatDate = (timestamp: number): string => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (days === 1) {
            return 'Yesterday';
        } else if (days < 7) {
            return date.toLocaleDateString([], { weekday: 'short' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const renderRun = ({ item }: { item: AgentRun }) => {
        const statusColor = STATUS_COLORS[item.status];
        const completedTasks = item.tasks.filter(t => t.status === 'completed').length;

        return (
            <TouchableOpacity
                style={styles.runCard}
                onPress={() => navigation.navigate('AgentRunDetail' as any, { runId: item.id })}
                onLongPress={() => handleDeleteRun(item)}
            >
                <View style={styles.runHeader}>
                    <View style={styles.runInfo}>
                        <Text style={styles.runName} numberOfLines={1}>{item.name}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                            <Text style={[styles.statusText, { color: statusColor }]}>
                                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.runDate}>{formatDate(item.startedAt)}</Text>
                </View>

                {item.description && (
                    <Text style={styles.runDescription} numberOfLines={2}>
                        {item.description}
                    </Text>
                )}

                <View style={styles.runFooter}>
                    <View style={styles.runStats}>
                        <View style={styles.statItem}>
                            <Ionicons name="chatbubble-outline" size={14} color="#8E8E93" />
                            <Text style={styles.statText}>{item.messages.length}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Ionicons name="checkbox-outline" size={14} color="#8E8E93" />
                            <Text style={styles.statText}>
                                {completedTasks}/{item.tasks.length}
                            </Text>
                        </View>
                        {item.tokensUsed > 0 && (
                            <View style={styles.statItem}>
                                <Ionicons name="analytics-outline" size={14} color="#8E8E93" />
                                <Text style={styles.statText}>
                                    {item.tokensUsed.toLocaleString()}
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.durationText}>
                        {formatDuration(item.startedAt, item.completedAt)}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    const renderSwarm = ({ item }: { item: AgentSwarm }) => {
        const statusColor = STATUS_COLORS[item.status];

        return (
            <TouchableOpacity
                style={styles.swarmCard}
                onPress={() => navigation.navigate('SwarmDetail' as any, { swarmId: item.id })}
                onLongPress={() => {
                    Alert.alert(
                        'Delete Swarm',
                        `Are you sure you want to delete "${item.name}"?`,
                        [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: () => removeSwarm(item.id),
                            },
                        ]
                    );
                }}
            >
                <View style={styles.swarmHeader}>
                    <Ionicons name="people-outline" size={24} color="#007AFF" />
                    <View style={styles.swarmInfo}>
                        <Text style={styles.swarmName}>{item.name}</Text>
                        <Text style={styles.swarmAgents}>
                            {item.agents.length} agents
                        </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={[styles.statusText, { color: statusColor }]}>
                            {item.status}
                        </Text>
                    </View>
                </View>
                {item.description && (
                    <Text style={styles.swarmDescription} numberOfLines={2}>
                        {item.description}
                    </Text>
                )}
            </TouchableOpacity>
        );
    };

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Ionicons name="git-network-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyTitle}>No Agent Runs</Text>
            <Text style={styles.emptySubtitle}>
                Create a swarm or start a new agent run to track AI task completion
            </Text>
        </View>
    );

    const renderCreateModal = () => (
        <Modal
            visible={showCreateModal}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowCreateModal(false)}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                        <Text style={styles.cancelButton}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>
                        Create {createType.charAt(0).toUpperCase() + createType.slice(1)}
                    </Text>
                    <TouchableOpacity onPress={handleCreate}>
                        <Text style={styles.createButton}>Create</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.typeSelector}>
                    {(['swarm', 'agent', 'run'] as const).map(type => (
                        <TouchableOpacity
                            key={type}
                            style={[
                                styles.typeButton,
                                createType === type && styles.typeButtonActive,
                            ]}
                            onPress={() => {
                                setCreateType(type);
                                setSelectedTemplate(null);
                            }}
                        >
                            <Text
                                style={[
                                    styles.typeButtonText,
                                    createType === type && styles.typeButtonTextActive,
                                ]}
                            >
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.modalContent}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Name</Text>
                        <TextInput
                            style={styles.input}
                            value={newName}
                            onChangeText={setNewName}
                            placeholder={`Enter ${createType} name`}
                            placeholderTextColor="#8E8E93"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Description</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={newDescription}
                            onChangeText={setNewDescription}
                            placeholder="Optional description"
                            placeholderTextColor="#8E8E93"
                            multiline
                            numberOfLines={3}
                        />
                    </View>

                    {createType === 'swarm' && (
                        <ScrollView style={styles.templatesSection} showsVerticalScrollIndicator={false}>
                            <Text style={styles.templatesTitle}>Templates</Text>
                            {SWARM_TEMPLATES.map((template, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.templateCard,
                                        selectedTemplate === index && styles.templateCardSelected,
                                    ]}
                                    onPress={() => {
                                        setSelectedTemplate(selectedTemplate === index ? null : index);
                                        if (selectedTemplate !== index) {
                                            setNewName(template.name);
                                            setNewDescription(template.description || '');
                                        }
                                    }}
                                >
                                    <Text style={styles.templateName}>{template.name}</Text>
                                    <Text style={styles.templateDescription}>
                                        {template.description}
                                    </Text>
                                    <View style={styles.templateRoles}>
                                        {template.roles.map((role, idx) => (
                                            <View key={idx} style={styles.roleChip}>
                                                <Ionicons
                                                    name={ROLE_ICONS[role]}
                                                    size={12}
                                                    color="#007AFF"
                                                />
                                                <Text style={styles.roleChipText}>{role}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </TouchableOpacity>
                            ))}

                            {/* Swarm Protocols Section (matching csm-web) */}
                            <Text style={[styles.templatesTitle, { marginTop: 16 }]}>Protocols</Text>

                            {/* Swarm Algorithm */}
                            <View style={styles.protocolSection}>
                                <Text style={styles.protocolLabel}>Swarm Intelligence</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={styles.protocolOptions}>
                                        {SWARM_ALGORITHMS.map((alg) => (
                                            <TouchableOpacity
                                                key={alg.id}
                                                style={[
                                                    styles.protocolChip,
                                                    selectedAlgorithm === alg.id && styles.protocolChipSelected,
                                                ]}
                                                onPress={() => setSelectedAlgorithm(selectedAlgorithm === alg.id ? '' : alg.id)}
                                            >
                                                <Text style={[
                                                    styles.protocolChipText,
                                                    selectedAlgorithm === alg.id && styles.protocolChipTextSelected,
                                                ]}>
                                                    {alg.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>
                            </View>

                            {/* Consensus Protocol */}
                            <View style={styles.protocolSection}>
                                <Text style={styles.protocolLabel}>Consensus Protocol</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={styles.protocolOptions}>
                                        {CONSENSUS_PROTOCOLS.map((proto) => (
                                            <TouchableOpacity
                                                key={proto.id}
                                                style={[
                                                    styles.protocolChip,
                                                    { borderColor: '#34C759' },
                                                    selectedConsensus === proto.id && [styles.protocolChipSelected, { backgroundColor: '#34C75920' }],
                                                ]}
                                                onPress={() => setSelectedConsensus(selectedConsensus === proto.id ? '' : proto.id)}
                                            >
                                                <Text style={[
                                                    styles.protocolChipText,
                                                    { color: '#34C759' },
                                                    selectedConsensus === proto.id && { fontWeight: '600' },
                                                ]}>
                                                    {proto.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>
                            </View>

                            {/* Communication Protocol */}
                            <View style={styles.protocolSection}>
                                <Text style={styles.protocolLabel}>Communication Protocol</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={styles.protocolOptions}>
                                        {COMMUNICATION_PROTOCOLS.map((proto) => (
                                            <TouchableOpacity
                                                key={proto.id}
                                                style={[
                                                    styles.protocolChip,
                                                    { borderColor: '#3B82F6' },
                                                    selectedCommunication === proto.id && [styles.protocolChipSelected, { backgroundColor: '#3B82F620' }],
                                                ]}
                                                onPress={() => setSelectedCommunication(proto.id)}
                                            >
                                                <Text style={[
                                                    styles.protocolChipText,
                                                    { color: '#3B82F6' },
                                                    selectedCommunication === proto.id && { fontWeight: '600' },
                                                ]}>
                                                    {proto.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>
                            </View>
                        </ScrollView>
                    )}

                    {createType === 'agent' && (
                        <View style={styles.templatesSection}>
                            <Text style={styles.templatesTitle}>Agent Roles</Text>
                            {AGENT_TEMPLATES.map((template, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.templateCard,
                                        selectedTemplate === index && styles.templateCardSelected,
                                    ]}
                                    onPress={() => {
                                        setSelectedTemplate(selectedTemplate === index ? null : index);
                                        if (selectedTemplate !== index) {
                                            setNewName(template.name);
                                            setNewDescription(template.description || '');
                                        }
                                    }}
                                >
                                    <View style={styles.templateHeader}>
                                        <Ionicons
                                            name={ROLE_ICONS[template.role]}
                                            size={20}
                                            color="#007AFF"
                                        />
                                        <Text style={styles.templateName}>{template.name}</Text>
                                    </View>
                                    <Text style={styles.templateDescription}>
                                        {template.description}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );

    // Render stats cards (matching csm-web)
    const renderStatsCards = () => (
        <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.statHeader}>
                    <Ionicons name="people-outline" size={18} color={colors.textSecondary} />
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Agents</Text>
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.totalAgents}</Text>
                <Text style={[styles.statSubtext, { color: colors.textTertiary }]}>{stats.runningAgents} active</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.statHeader}>
                    <Ionicons name="flash-outline" size={18} color={colors.textSecondary} />
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Tokens Used</Text>
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>
                    {stats.totalTokens > 1000 ? `${(stats.totalTokens / 1000).toFixed(1)}K` : stats.totalTokens}
                </Text>
                <Text style={[styles.statSubtext, { color: colors.textTertiary }]}>across all sessions</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.statHeader}>
                    <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Messages</Text>
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.totalMessages}</Text>
                <Text style={[styles.statSubtext, { color: colors.textTertiary }]}>exchanged</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.statHeader}>
                    <Ionicons name="server-outline" size={18} color={colors.textSecondary} />
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Providers</Text>
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>{stats.providersCount}</Text>
                <Text style={[styles.statSubtext, { color: colors.textTertiary }]}>connected</Text>
            </View>
        </View>
    );

    // Render agent card with details (matching csm-web)
    const renderAgentCard = (agent: typeof agents[0]) => {
        const roleInfo = getRoleInfo(agent.role);
        const isSelected = selectedAgent === agent.id;

        return (
            <TouchableOpacity
                key={agent.id}
                style={[
                    styles.agentCard,
                    { backgroundColor: colors.card, borderColor: isSelected ? '#007AFF' : colors.border },
                    isSelected && styles.agentCardSelected,
                ]}
                onPress={() => setSelectedAgent(isSelected ? null : agent.id)}
            >
                <View style={styles.agentCardHeader}>
                    <View style={styles.agentCardLeft}>
                        <View style={[styles.agentIconContainer, { backgroundColor: `${roleInfo.color}15` }]}>
                            <Ionicons name={roleInfo.icon as any} size={20} color={roleInfo.color} />
                        </View>
                        <View style={styles.agentCardInfo}>
                            <View style={styles.agentNameRow}>
                                <Text style={[styles.agentName, { color: colors.text }]} numberOfLines={1}>
                                    {agent.name}
                                </Text>
                                <View style={[styles.statusBadgeSmall, { backgroundColor: STATUS_COLORS[agent.status || 'idle'] + '20' }]}>
                                    <View style={[styles.statusDotSmall, { backgroundColor: STATUS_COLORS[agent.status || 'idle'] }]} />
                                    <Text style={[styles.statusTextSmall, { color: STATUS_COLORS[agent.status || 'idle'] }]}>
                                        {agent.status || 'idle'}
                                    </Text>
                                </View>
                            </View>
                            <Text style={[styles.agentMeta, { color: colors.textSecondary }]}>
                                {agent.providerId || 'Local'} • {agent.model || 'Default'}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.agentCardActions}>
                        {(agent.status === 'executing' || agent.status === 'thinking') && (
                            <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#FF950020' }]}>
                                <Ionicons name="pause-circle-outline" size={18} color="#FF9500" />
                            </TouchableOpacity>
                        )}
                        {agent.status === 'paused' && (
                            <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#34C75920' }]}>
                                <Ionicons name="play-outline" size={18} color="#34C759" />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: colors.surface || colors.border }]}
                            onPress={() => handleEditAgent(agent)}
                        >
                            <Ionicons name="settings-outline" size={18} color={colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: '#FF3B3020' }]}
                            onPress={() => handleDeleteAgent(agent)}
                        >
                            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                        </TouchableOpacity>
                    </View>
                </View>

                {agent.description && (
                    <Text style={[styles.agentDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                        {agent.description}
                    </Text>
                )}

                <View style={styles.agentStats}>
                    <View style={styles.agentStatItem}>
                        <Ionicons name="flash-outline" size={14} color={colors.textTertiary} />
                        <Text style={[styles.agentStatText, { color: colors.textTertiary }]}>
                            {(agent.tokensUsed || 0) > 1000 ? `${((agent.tokensUsed || 0) / 1000).toFixed(1)}K` : agent.tokensUsed || 0} tokens
                        </Text>
                    </View>
                    <View style={styles.agentStatItem}>
                        <Ionicons name="chatbubble-outline" size={14} color={colors.textTertiary} />
                        <Text style={[styles.agentStatText, { color: colors.textTertiary }]}>
                            {agent.messageCount || 0} messages
                        </Text>
                    </View>
                    <View style={styles.agentStatItem}>
                        <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
                        <Text style={[styles.agentStatText, { color: colors.textTertiary }]}>
                            {formatDate(agent.updatedAt || Date.now())}
                        </Text>
                    </View>
                </View>

                {agent.tools && agent.tools.length > 0 && (
                    <View style={[styles.agentToolsRow, { borderTopColor: colors.border }]}>
                        <Ionicons name="construct-outline" size={14} color="#007AFF" />
                        <Text style={[styles.toolsLabel, { color: colors.textSecondary }]}>Tools:</Text>
                        <View style={styles.toolTags}>
                            {agent.tools.slice(0, 3).map((tool, idx) => (
                                <View key={idx} style={styles.toolTag}>
                                    <Text style={styles.toolTagText}>{tool}</Text>
                                </View>
                            ))}
                            {agent.tools.length > 3 && (
                                <Text style={[styles.moreTools, { color: colors.textTertiary }]}>
                                    +{agent.tools.length - 3} more
                                </Text>
                            )}
                        </View>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    // Render activity log (matching csm-web)
    const renderActivityLog = () => (
        <View style={[styles.activityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
                style={styles.activityHeader}
                onPress={() => setExpandedLogs(!expandedLogs)}
            >
                <View style={styles.activityHeaderLeft}>
                    <Ionicons name="terminal-outline" size={18} color="#007AFF" />
                    <Text style={[styles.activityTitle, { color: colors.text }]}>Recent Activity</Text>
                </View>
                <Ionicons
                    name={expandedLogs ? 'chevron-down' : 'chevron-forward'}
                    size={18}
                    color={colors.textSecondary}
                />
            </TouchableOpacity>

            {expandedLogs && (
                <View style={styles.activityContent}>
                    {activityLog.length === 0 ? (
                        <Text style={[styles.noActivity, { color: colors.textSecondary }]}>
                            No recent activity
                        </Text>
                    ) : (
                        activityLog.map((log, index) => (
                            <View key={index} style={styles.logEntry}>
                                <Text style={[styles.logTime, { color: colors.textTertiary }]}>{log.time}</Text>
                                <View style={[styles.logDot, { backgroundColor: getLogColor(log.type) }]} />
                                <Text style={[styles.logText, { color: colors.text }]}>
                                    <Text style={styles.logAgent}>{log.agent}:</Text> {log.action}
                                </Text>
                            </View>
                        ))
                    )}
                </View>
            )}
        </View>
    );

    const getLogColor = (type: string) => {
        switch (type) {
            case 'success': return '#34C759';
            case 'warning': return '#FF9500';
            case 'error': return '#FF3B30';
            case 'info': return '#007AFF';
            default: return '#8E8E93';
        }
    };

    // Handle inbox tab navigation via useEffect (not during render)
    useEffect(() => {
        if (activeTab === 'inbox') {
            navigation.navigate('AgentInbox' as any);
            setActiveTab('all');
        }
    }, [activeTab, navigation]);

    // Initialize SWE Memory data when SWE tab is active
    useEffect(() => {
        if (activeTab === 'swe' && sweMemories.length === 0) {
            // Load sample data (in production, would fetch from API)
            setSweMemories(SAMPLE_SWE_MEMORIES);
            setSweProjects(SAMPLE_SWE_PROJECTS);
            setSweRules(SAMPLE_SWE_RULES);
        }
    }, [activeTab, sweMemories.length]);

    // Render content based on active tab
    const renderTabContent = () => {
        // Skip rendering if navigating to inbox
        if (activeTab === 'inbox') {
            return null;
        }

        if (activeTab === 'swarms') {
            return (
                <View style={styles.tabContent}>
                    {swarms.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="people-outline" size={64} color={colors.textTertiary} />
                            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Swarms Yet</Text>
                            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                                Create your first swarm to orchestrate multi-agent teams
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.swarmsGrid}>
                            {swarms.map((swarm) => (
                                <View key={swarm.id}>
                                    {renderSwarm({ item: swarm })}
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            );
        }

        // SWE Tab content with sub-tabs
        if (activeTab === 'swe') {
            const filteredSweMemories = sweMemories.filter(m =>
                sweMemorySearch === '' ||
                m.title.toLowerCase().includes(sweMemorySearch.toLowerCase()) ||
                m.description.toLowerCase().includes(sweMemorySearch.toLowerCase())
            );

            return (
                <View style={styles.tabContent}>
                    {/* SWE Stats Cards */}
                    <View style={styles.statsGrid}>
                        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                            <Ionicons name="code-slash-outline" size={20} color="#10b981" />
                            <Text style={[styles.statValue, { color: colors.text }]}>{filteredAgents.length}</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>SWE Agents</Text>
                        </View>
                        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                            <Ionicons name="folder-outline" size={20} color="#3b82f6" />
                            <Text style={[styles.statValue, { color: colors.text }]}>{sweProjects.length}</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Projects</Text>
                        </View>
                        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                            <Ionicons name="hardware-chip-outline" size={20} color="#f97316" />
                            <Text style={[styles.statValue, { color: colors.text }]}>{sweMemories.length}</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Memories</Text>
                        </View>
                        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                            <Ionicons name="document-text-outline" size={20} color="#8b5cf6" />
                            <Text style={[styles.statValue, { color: colors.text }]}>{sweRules.length}</Text>
                            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Rules</Text>
                        </View>
                    </View>

                    {/* SWE Sub-tabs */}
                    <View style={[styles.sweSubTabs, { borderColor: colors.border }]}>
                        <TouchableOpacity
                            style={[styles.sweSubTab, sweSubTab === 'agents' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                            onPress={() => setSweSubTab('agents')}
                        >
                            <Ionicons name="people-outline" size={16} color={sweSubTab === 'agents' ? colors.primary : colors.textSecondary} />
                            <Text style={[styles.sweSubTabText, { color: sweSubTab === 'agents' ? colors.primary : colors.textSecondary }]}>Agents</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.sweSubTab, sweSubTab === 'memory' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                            onPress={() => setSweSubTab('memory')}
                        >
                            <Ionicons name="hardware-chip-outline" size={16} color={sweSubTab === 'memory' ? colors.primary : colors.textSecondary} />
                            <Text style={[styles.sweSubTabText, { color: sweSubTab === 'memory' ? colors.primary : colors.textSecondary }]}>Memory</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.sweSubTab, sweSubTab === 'rules' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                            onPress={() => setSweSubTab('rules')}
                        >
                            <Ionicons name="document-text-outline" size={16} color={sweSubTab === 'rules' ? colors.primary : colors.textSecondary} />
                            <Text style={[styles.sweSubTabText, { color: sweSubTab === 'rules' ? colors.primary : colors.textSecondary }]}>Rules</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.sweSubTab}
                            onPress={() => navigation.navigate('SWE' as any)}
                        >
                            <Ionicons name="open-outline" size={16} color={colors.textSecondary} />
                            <Text style={[styles.sweSubTabText, { color: colors.textSecondary }]}>Full View</Text>
                        </TouchableOpacity>
                    </View>

                    {/* SWE Sub-tab Content */}
                    {sweSubTab === 'agents' && (
                        <View>
                            <Text style={[styles.sectionTitle, { color: colors.textTertiary, marginTop: 16 }]}>SWE AGENTS</Text>
                            {filteredAgents.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="code-slash-outline" size={64} color={colors.textTertiary} />
                                    <Text style={[styles.emptyTitle, { color: colors.text }]}>No SWE Agents</Text>
                                    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                                        Create a coder or developer agent to get started
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.agentsList}>
                                    {filteredAgents.map(renderAgentCard)}
                                </View>
                            )}
                        </View>
                    )}

                    {sweSubTab === 'memory' && (
                        <View>
                            {/* Memory Search */}
                            <View style={[styles.sweSearchContainer, { backgroundColor: colors.card }]}>
                                <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
                                <TextInput
                                    style={[styles.sweSearchInput, { color: colors.text }]}
                                    placeholder="Search memories..."
                                    placeholderTextColor={colors.textTertiary}
                                    value={sweMemorySearch}
                                    onChangeText={setSweMemorySearch}
                                />
                            </View>

                            {/* Projects List */}
                            <Text style={[styles.sectionTitle, { color: colors.textTertiary, marginTop: 16 }]}>PROJECTS</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                                {sweProjects.map(project => (
                                    <TouchableOpacity
                                        key={project.id}
                                        style={[
                                            styles.sweProjectChip,
                                            { backgroundColor: selectedSweProject?.id === project.id ? colors.primary : colors.card }
                                        ]}
                                        onPress={() => setSelectedSweProject(selectedSweProject?.id === project.id ? null : project)}
                                    >
                                        <Ionicons name="folder-outline" size={14} color={selectedSweProject?.id === project.id ? '#fff' : colors.textSecondary} />
                                        <Text style={[styles.sweProjectChipText, { color: selectedSweProject?.id === project.id ? '#fff' : colors.text }]}>
                                            {project.name}
                                        </Text>
                                        <Text style={[styles.sweProjectChipCount, { color: selectedSweProject?.id === project.id ? '#fff' : colors.textTertiary }]}>
                                            {project.memoriesCount}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {/* Memories List */}
                            <Text style={[styles.sectionTitle, { color: colors.textTertiary, marginTop: 16 }]}>MEMORIES</Text>
                            {filteredSweMemories.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="hardware-chip-outline" size={48} color={colors.textTertiary} />
                                    <Text style={[styles.emptyTitle, { color: colors.text }]}>No Memories</Text>
                                    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                                        Code patterns and solutions will appear here
                                    </Text>
                                </View>
                            ) : (
                                filteredSweMemories.map(memory => {
                                    const typeInfo = SWE_MEMORY_TYPES[memory.type] || SWE_MEMORY_TYPES.solution;
                                    return (
                                        <View key={memory.id} style={[styles.sweMemoryCard, { backgroundColor: colors.card }]}>
                                            <View style={styles.sweMemoryHeader}>
                                                <View style={[styles.sweMemoryBadge, { backgroundColor: typeInfo.color + '20' }]}>
                                                    <Ionicons name={typeInfo.icon} size={12} color={typeInfo.color} />
                                                    <Text style={[styles.sweMemoryBadgeText, { color: typeInfo.color }]}>{typeInfo.label}</Text>
                                                </View>
                                                <Text style={[styles.sweMemoryUseCount, { color: colors.textTertiary }]}>
                                                    Used {memory.useCount}x
                                                </Text>
                                            </View>
                                            <Text style={[styles.sweMemoryTitle, { color: colors.text }]}>{memory.title}</Text>
                                            <Text style={[styles.sweMemoryDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                                                {memory.description}
                                            </Text>
                                            <View style={styles.sweMemoryTags}>
                                                {memory.tags.slice(0, 3).map(tag => (
                                                    <View key={tag} style={[styles.sweTag, { backgroundColor: colors.border }]}>
                                                        <Text style={[styles.sweTagText, { color: colors.textSecondary }]}>{tag}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    );
                                })
                            )}
                        </View>
                    )}

                    {sweSubTab === 'rules' && (
                        <View>
                            <Text style={[styles.sectionTitle, { color: colors.textTertiary, marginTop: 16 }]}>CODING RULES</Text>
                            {sweRules.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="document-text-outline" size={48} color={colors.textTertiary} />
                                    <Text style={[styles.emptyTitle, { color: colors.text }]}>No Rules</Text>
                                    <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                                        Add coding rules and guidelines here
                                    </Text>
                                </View>
                            ) : (
                                sweRules.map(rule => {
                                    const severityColors = { info: '#3b82f6', warning: '#f59e0b', error: '#ef4444' };
                                    return (
                                        <View key={rule.id} style={[styles.sweRuleCard, { backgroundColor: colors.card }]}>
                                            <View style={styles.sweRuleHeader}>
                                                <View style={[styles.sweRuleBadge, { backgroundColor: severityColors[rule.severity] + '20' }]}>
                                                    <Ionicons
                                                        name={rule.severity === 'error' ? 'alert-circle-outline' : rule.severity === 'warning' ? 'warning-outline' : 'information-circle-outline'}
                                                        size={12}
                                                        color={severityColors[rule.severity]}
                                                    />
                                                    <Text style={[styles.sweRuleBadgeText, { color: severityColors[rule.severity] }]}>{rule.type}</Text>
                                                </View>
                                                <TouchableOpacity>
                                                    <Ionicons
                                                        name={rule.enabled ? 'toggle' : 'toggle-outline'}
                                                        size={24}
                                                        color={rule.enabled ? colors.primary : colors.textTertiary}
                                                    />
                                                </TouchableOpacity>
                                            </View>
                                            <Text style={[styles.sweRuleTitle, { color: colors.text }]}>{rule.title}</Text>
                                            <Text style={[styles.sweRuleDesc, { color: colors.textSecondary }]}>{rule.description}</Text>
                                        </View>
                                    );
                                })
                            )}
                        </View>
                    )}
                </View>
            );
        }

        // Agents tab content
        return (
            <View style={styles.tabContent}>
                {/* Stats Cards */}
                {renderStatsCards()}

                {/* Agent Cards */}
                <Text style={[styles.sectionTitle, { color: colors.textTertiary, marginTop: 16 }]}>
                    {activeTab === 'all' ? 'ALL AGENTS' : `${activeTab.toUpperCase()} AGENTS`}
                </Text>

                {filteredAgents.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="people-outline" size={64} color={colors.textTertiary} />
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>No Agents</Text>
                        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                            {activeTab === 'all'
                                ? 'Create your first agent to get started'
                                : `No ${activeTab} agents found`}
                        </Text>
                    </View>
                ) : (
                    <View style={styles.agentsList}>
                        {filteredAgents.map(renderAgentCard)}
                    </View>
                )}

                {/* Activity Log */}
                <View style={{ marginTop: 16 }}>
                    {renderActivityLog()}
                </View>

                {/* Recent Runs */}
                {runs.length > 0 && (
                    <View style={styles.runsSection}>
                        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>RECENT RUNS</Text>
                        {runs.map((item) => (
                            <View key={item.id}>
                                {renderRun({ item })}
                            </View>
                        ))}
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Tab Bar */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
                contentContainerStyle={styles.tabBarContent}
            >
                {AGENT_TYPE_TABS.map((tab) => (
                    <TouchableOpacity
                        key={tab.id}
                        style={[
                            styles.tab,
                            activeTab === tab.id && styles.tabActive,
                        ]}
                        onPress={() => setActiveTab(tab.id)}
                    >
                        <Ionicons
                            name={tab.icon as any}
                            size={16}
                            color={activeTab === tab.id ? '#007AFF' : colors.textSecondary}
                        />
                        <Text style={[
                            styles.tabLabel,
                            { color: activeTab === tab.id ? '#007AFF' : colors.textSecondary },
                            activeTab === tab.id && styles.tabLabelActive,
                        ]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Main Content */}
            <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                {/* Quick Tools (collapsed when on specific tabs) */}
                {(activeTab === 'all' || activeTab === 'inbox') && (
                    <View style={styles.toolsSection}>
                        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>QUICK ACCESS</Text>
                        <View style={styles.toolsGrid}>
                            {AGENT_TOOLS.map((tool) => (
                                <TouchableOpacity
                                    key={tool.id}
                                    style={[styles.toolCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                                    onPress={() => navigation.navigate(tool.route as any)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.toolIconContainer, { backgroundColor: `${tool.color}15` }]}>
                                        <Ionicons name={tool.icon as any} size={22} color={tool.color} />
                                    </View>
                                    <View style={styles.toolInfo}>
                                        <Text style={[styles.toolTitle, { color: colors.text }]}>{tool.title}</Text>
                                        <Text style={[styles.toolSubtitle, { color: colors.textSecondary }]}>{tool.subtitle}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* Tab Content */}
                {renderTabContent()}
            </ScrollView>

            {/* FAB */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => setShowCreateModal(true)}
            >
                <Ionicons name="add" size={28} color="#FFFFFF" />
            </TouchableOpacity>

            {renderCreateModal()}

            {/* Edit Agent Modal */}
            <Modal
                visible={showEditAgentModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowEditAgentModal(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => {
                            setShowEditAgentModal(false);
                            setEditingAgent(null);
                            setEditAgentName('');
                            setEditAgentDescription('');
                        }}>
                            <Text style={styles.cancelButton}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Edit Agent</Text>
                        <TouchableOpacity
                            onPress={handleUpdateAgent}
                            disabled={!editAgentName.trim()}
                        >
                            <Text style={[styles.createButton, !editAgentName.trim() && { opacity: 0.5 }]}>Save</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalBody}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Name</Text>
                            <TextInput
                                style={styles.input}
                                value={editAgentName}
                                onChangeText={setEditAgentName}
                                placeholder="Agent name"
                                placeholderTextColor="#999"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Description</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={editAgentDescription}
                                onChangeText={setEditAgentDescription}
                                placeholder="What does this agent do?"
                                placeholderTextColor="#999"
                                multiline
                                numberOfLines={4}
                            />
                        </View>
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F2F7',
    },
    scrollContainer: {
        flex: 1,
    },
    toolsSection: {
        marginTop: 16,
        paddingHorizontal: 16,
    },
    toolsGrid: {
        gap: 8,
    },
    toolCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    toolIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    toolInfo: {
        flex: 1,
        marginLeft: 12,
    },
    toolTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    toolSubtitle: {
        fontSize: 13,
        marginTop: 2,
    },
    section: {
        marginTop: 16,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8E8E93',
        marginBottom: 8,
        marginLeft: 16,
    },
    swarmsContainer: {
        paddingHorizontal: 16,
    },
    swarmCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginRight: 12,
        width: 280,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    swarmHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    swarmInfo: {
        flex: 1,
        marginLeft: 12,
    },
    swarmName: {
        fontSize: 17,
        fontWeight: '600',
        color: '#000000',
    },
    swarmAgents: {
        fontSize: 13,
        color: '#8E8E93',
        marginTop: 2,
    },
    swarmDescription: {
        fontSize: 14,
        color: '#8E8E93',
        marginTop: 8,
        lineHeight: 20,
    },
    runsSection: {
        flex: 1,
        marginTop: 16,
    },
    runsContainer: {
        padding: 16,
        paddingTop: 8,
        flexGrow: 1,
    },
    runCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    runHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    runInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },
    runName: {
        fontSize: 17,
        fontWeight: '600',
        color: '#000000',
    },
    runDate: {
        fontSize: 13,
        color: '#8E8E93',
    },
    runDescription: {
        fontSize: 14,
        color: '#8E8E93',
        marginTop: 8,
        lineHeight: 20,
    },
    runFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
    },
    runStats: {
        flexDirection: 'row',
        gap: 16,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        fontSize: 13,
        color: '#8E8E93',
    },
    durationText: {
        fontSize: 13,
        color: '#8E8E93',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '500',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#000000',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 15,
        color: '#8E8E93',
        textAlign: 'center',
        marginTop: 8,
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#F2F2F7',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5EA',
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#000000',
    },
    cancelButton: {
        fontSize: 17,
        color: '#007AFF',
    },
    createButton: {
        fontSize: 17,
        fontWeight: '600',
        color: '#007AFF',
    },
    typeSelector: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        padding: 8,
        gap: 8,
    },
    typeButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#F2F2F7',
        alignItems: 'center',
    },
    typeButtonActive: {
        backgroundColor: '#007AFF',
    },
    typeButtonText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#8E8E93',
    },
    typeButtonTextActive: {
        color: '#FFFFFF',
    },
    modalContent: {
        flex: 1,
        padding: 16,
    },
    modalBody: {
        flex: 1,
        paddingHorizontal: 16,
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: '#8E8E93',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: '#000000',
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    templatesSection: {
        marginTop: 8,
    },
    templatesTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8E8E93',
        marginBottom: 12,
    },
    templateCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    templateCardSelected: {
        borderColor: '#007AFF',
    },
    templateHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    templateName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000000',
    },
    templateDescription: {
        fontSize: 14,
        color: '#8E8E93',
        marginTop: 4,
    },
    templateRoles: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
    },
    roleChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#E5F2FF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    roleChipText: {
        fontSize: 12,
        color: '#007AFF',
        fontWeight: '500',
    },
    // Tab bar styles
    tabBar: {
        borderBottomWidth: 1,
        maxHeight: 50,
    },
    tabBarContent: {
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 12,
        gap: 6,
    },
    tabActive: {
        borderBottomWidth: 2,
        borderBottomColor: '#007AFF',
    },
    tabLabel: {
        fontSize: 13,
        fontWeight: '500',
    },
    tabLabelActive: {
        fontWeight: '600',
    },
    tabContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    // Stats grid styles
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    statCard: {
        flex: 1,
        minWidth: '47%',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    statHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    statLabel: {
        fontSize: 12,
    },
    statValue: {
        fontSize: 22,
        fontWeight: '700',
    },
    statSubtext: {
        fontSize: 12,
        marginTop: 2,
    },
    // Agent card styles
    agentsList: {
        gap: 12,
    },
    agentCard: {
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
    },
    agentCardSelected: {
        borderWidth: 2,
    },
    agentCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    agentCardLeft: {
        flexDirection: 'row',
        flex: 1,
        gap: 12,
    },
    agentIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    agentCardInfo: {
        flex: 1,
    },
    agentNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    agentName: {
        fontSize: 16,
        fontWeight: '600',
    },
    agentMeta: {
        fontSize: 13,
        marginTop: 2,
    },
    agentDescription: {
        fontSize: 14,
        marginTop: 8,
        lineHeight: 20,
    },
    agentCardActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    agentStats: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 12,
    },
    agentStatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    agentStatText: {
        fontSize: 12,
    },
    agentToolsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        flexWrap: 'wrap',
    },
    toolsLabel: {
        fontSize: 12,
    },
    toolTags: {
        flexDirection: 'row',
        gap: 6,
        flexWrap: 'wrap',
        flex: 1,
    },
    toolTag: {
        backgroundColor: '#007AFF15',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    toolTagText: {
        fontSize: 11,
        color: '#007AFF',
        fontWeight: '500',
    },
    moreTools: {
        fontSize: 11,
    },
    statusBadgeSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    statusDotSmall: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        marginRight: 4,
    },
    statusTextSmall: {
        fontSize: 11,
        fontWeight: '500',
        textTransform: 'capitalize',
    },
    // Activity log styles
    activityCard: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
    },
    activityHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
    },
    activityHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    activityTitle: {
        fontSize: 15,
        fontWeight: '600',
    },
    activityContent: {
        paddingHorizontal: 12,
        paddingBottom: 12,
        gap: 8,
    },
    noActivity: {
        textAlign: 'center',
        paddingVertical: 16,
        fontSize: 14,
    },
    logEntry: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    logTime: {
        fontSize: 12,
        fontFamily: 'monospace',
        width: 40,
    },
    logDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginTop: 5,
    },
    logText: {
        flex: 1,
        fontSize: 13,
    },
    logAgent: {
        fontWeight: '600',
    },
    // Swarms grid for tab view
    swarmsGrid: {
        gap: 12,
    },
    // Protocol section styles
    protocolSection: {
        marginBottom: 16,
    },
    protocolLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#8E8E93',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    protocolOptions: {
        flexDirection: 'row',
        gap: 8,
    },
    protocolChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#8B5CF6',
        backgroundColor: 'transparent',
    },
    protocolChipSelected: {
        backgroundColor: '#8B5CF620',
    },
    protocolChipText: {
        fontSize: 12,
        color: '#8B5CF6',
        fontWeight: '500',
    },
    protocolChipTextSelected: {
        fontWeight: '600',
    },
    // SWE Tab styles
    sweSubTabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        marginTop: 16,
    },
    sweSubTab: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        gap: 4,
    },
    sweSubTabText: {
        fontSize: 13,
        fontWeight: '500',
    },
    sweSearchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        gap: 8,
    },
    sweSearchInput: {
        flex: 1,
        fontSize: 14,
    },
    sweProjectChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginRight: 8,
        gap: 6,
    },
    sweProjectChipText: {
        fontSize: 13,
        fontWeight: '500',
    },
    sweProjectChipCount: {
        fontSize: 11,
    },
    sweMemoryCard: {
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
    },
    sweMemoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    sweMemoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    sweMemoryBadgeText: {
        fontSize: 11,
        fontWeight: '500',
    },
    sweMemoryUseCount: {
        fontSize: 11,
    },
    sweMemoryTitle: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 4,
    },
    sweMemoryDesc: {
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 8,
    },
    sweMemoryTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
    },
    sweTag: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    sweTagText: {
        fontSize: 11,
    },
    sweRuleCard: {
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
    },
    sweRuleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    sweRuleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    sweRuleBadgeText: {
        fontSize: 11,
        fontWeight: '500',
        textTransform: 'uppercase',
    },
    sweRuleTitle: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 4,
    },
    sweRuleDesc: {
        fontSize: 13,
        lineHeight: 18,
    },
});
