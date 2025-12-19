import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    TextInput,
    Modal,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAgentsContext } from '../context/AgentsContext';
import { useTheme } from '../context/ThemeContext';
import {
    AgentSwarm,
    Agent,
    AgentTask,
    AgentRole,
    AGENT_TEMPLATES,
    createAgent,
    createTask,
} from '../api/agents';
import type { RootStackParamList } from '../navigation/types';

type Props = {
    route: RouteProp<RootStackParamList, 'SwarmDetail'>;
    navigation: NativeStackNavigationProp<RootStackParamList, 'SwarmDetail'>;
};

const STATUS_COLORS: Record<string, string> = {
    idle: '#8E8E93',
    running: '#007AFF',
    paused: '#FF9500',
    completed: '#34C759',
    failed: '#FF3B30',
    pending: '#FF9500',
    in_progress: '#007AFF',
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

const ROLE_COLORS: Record<AgentRole, string> = {
    coordinator: '#5856D6',
    researcher: '#007AFF',
    coder: '#34C759',
    reviewer: '#FF9500',
    executor: '#FF3B30',
    writer: '#EC4899',
    tester: '#06B6D4',
    custom: '#8E8E93',
};

export function SwarmDetailScreen({ route, navigation }: Props) {
    const { swarmId } = route.params;
    const { colors, isDark } = useTheme();
    const {
        swarms,
        agents,
        updateSwarm,
        addAgent,
        removeSwarm,
        startRun,
    } = useAgentsContext();

    const [activeTab, setActiveTab] = useState<'agents' | 'tasks' | 'config'>('agents');
    const [showAddAgentModal, setShowAddAgentModal] = useState(false);
    const [showAddTaskModal, setShowAddTaskModal] = useState(false);
    const [newAgentName, setNewAgentName] = useState('');
    const [newAgentRole, setNewAgentRole] = useState<AgentRole>('custom');
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDescription, setNewTaskDescription] = useState('');
    const [goalDescription, setGoalDescription] = useState('');
    const [isEditingGoal, setIsEditingGoal] = useState(false);

    const swarm = swarms.find(s => s.id === swarmId);

    useEffect(() => {
        if (swarm) {
            navigation.setOptions({
                title: swarm.name,
                headerRight: () => (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        {swarm.status === 'running' && (
                            <TouchableOpacity
                                style={{ paddingHorizontal: 8 }}
                                onPress={handlePauseSwarm}
                            >
                                <Ionicons name="pause-circle-outline" size={24} color={colors.warning} />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={{ paddingHorizontal: 8 }}
                            onPress={handleMoreOptions}
                        >
                            <Ionicons name="ellipsis-horizontal" size={24} color={colors.primary} />
                        </TouchableOpacity>
                    </View>
                ),
            });
            setGoalDescription(swarm.goalDescription || '');
        }
    }, [swarm, navigation, colors]);

    if (!swarm) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <Text style={[styles.errorText, { color: colors.error }]}>Swarm not found</Text>
            </View>
        );
    }

    const handlePauseSwarm = () => {
        Alert.alert(
            'Pause Swarm',
            'Are you sure you want to pause this swarm?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Pause',
                    onPress: () => updateSwarm({ ...swarm, status: 'paused' }),
                },
            ]
        );
    };

    const handleMoreOptions = () => {
        Alert.alert('Swarm Options', undefined, [
            {
                text: 'Start Run',
                onPress: handleStartRun,
            },
            {
                text: 'Export Swarm',
                onPress: handleExportSwarm,
            },
            {
                text: 'Delete Swarm',
                style: 'destructive',
                onPress: () => {
                    Alert.alert(
                        'Delete Swarm',
                        `Are you sure you want to delete "${swarm.name}"?`,
                        [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: () => {
                                    removeSwarm(swarm.id);
                                    navigation.goBack();
                                },
                            },
                        ]
                    );
                },
            },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const handleStartRun = () => {
        if (swarm.agents.length === 0) {
            Alert.alert('No Agents', 'Please add agents to the swarm before starting a run.');
            return;
        }

        Alert.alert(
            'Start Run',
            `Start a new run with ${swarm.agents.length} agents?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Start',
                    onPress: () => {
                        const run = startRun(swarm.name + ' Run', swarm.goalDescription || 'Swarm execution');
                        navigation.navigate('AgentRunDetail', { runId: run.id });
                    },
                },
            ]
        );
    };

    const handleExportSwarm = () => {
        const exportData = JSON.stringify(swarm, null, 2);
        Alert.alert('Export', 'Swarm configuration copied to clipboard');
    };

    const handleAddAgent = () => {
        if (!newAgentName.trim()) {
            Alert.alert('Error', 'Please enter an agent name');
            return;
        }

        const template = AGENT_TEMPLATES.find(t => t.role === newAgentRole);
        const agent = addAgent(
            newAgentName.trim(),
            newAgentRole,
            template?.description || ''
        );

        // Add to swarm
        updateSwarm({
            ...swarm,
            agents: [...swarm.agents, agent],
            updatedAt: Date.now(),
        });

        setNewAgentName('');
        setNewAgentRole('custom');
        setShowAddAgentModal(false);
    };

    const handleRemoveAgent = (agentId: string) => {
        Alert.alert(
            'Remove Agent',
            'Are you sure you want to remove this agent from the swarm?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => {
                        updateSwarm({
                            ...swarm,
                            agents: swarm.agents.filter(a => a.id !== agentId),
                            updatedAt: Date.now(),
                        });
                    },
                },
            ]
        );
    };

    const handleAddTask = () => {
        if (!newTaskTitle.trim()) {
            Alert.alert('Error', 'Please enter a task title');
            return;
        }

        const task = createTask(newTaskTitle.trim(), newTaskDescription.trim());
        updateSwarm({
            ...swarm,
            tasks: [...swarm.tasks, task],
            updatedAt: Date.now(),
        });

        setNewTaskTitle('');
        setNewTaskDescription('');
        setShowAddTaskModal(false);
    };

    const handleSetCoordinator = (agentId: string) => {
        updateSwarm({
            ...swarm,
            coordinatorAgentId: agentId,
            updatedAt: Date.now(),
        });
    };

    const handleSaveGoal = () => {
        updateSwarm({
            ...swarm,
            goalDescription: goalDescription.trim(),
            updatedAt: Date.now(),
        });
        setIsEditingGoal(false);
    };

    const renderAgentItem = ({ item }: { item: Agent }) => {
        const isCoordinator = swarm.coordinatorAgentId === item.id;
        const roleColor = ROLE_COLORS[item.role] || colors.textTertiary;

        return (
            <TouchableOpacity
                style={[styles.agentCard, { backgroundColor: colors.card }]}
                onLongPress={() => handleRemoveAgent(item.id)}
            >
                <View style={styles.agentHeader}>
                    <View style={[styles.agentIcon, { backgroundColor: roleColor + '20' }]}>
                        <Ionicons name={ROLE_ICONS[item.role]} size={20} color={roleColor} />
                    </View>
                    <View style={styles.agentInfo}>
                        <View style={styles.agentNameRow}>
                            <Text style={[styles.agentName, { color: colors.text }]}>{item.name}</Text>
                            {isCoordinator && (
                                <View style={[styles.coordinatorBadge, { backgroundColor: colors.primary + '20' }]}>
                                    <Ionicons name="star" size={10} color={colors.primary} />
                                    <Text style={[styles.coordinatorText, { color: colors.primary }]}>Lead</Text>
                                </View>
                            )}
                        </View>
                        <Text style={[styles.agentRole, { color: roleColor }]}>
                            {item.role.charAt(0).toUpperCase() + item.role.slice(1)}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.moreButton}
                        onPress={() => {
                            Alert.alert(item.name, undefined, [
                                { text: 'Set as Coordinator', onPress: () => handleSetCoordinator(item.id) },
                                { text: 'Remove from Swarm', style: 'destructive', onPress: () => handleRemoveAgent(item.id) },
                                { text: 'Cancel', style: 'cancel' },
                            ]);
                        }}
                    >
                        <Ionicons name="ellipsis-vertical" size={18} color={colors.iconSecondary} />
                    </TouchableOpacity>
                </View>
                {item.description && (
                    <Text style={[styles.agentDescription, { color: colors.textTertiary }]} numberOfLines={2}>
                        {item.description}
                    </Text>
                )}
                <View style={styles.agentCapabilities}>
                    {item.capabilities.slice(0, 3).map((cap, index) => (
                        <View key={index} style={[styles.capabilityChip, { backgroundColor: colors.background }]}>
                            <Text style={[styles.capabilityText, { color: colors.textTertiary }]}>
                                {cap.replace('_', ' ')}
                            </Text>
                        </View>
                    ))}
                    {item.capabilities.length > 3 && (
                        <Text style={[styles.moreCapabilities, { color: colors.textTertiary }]}>
                            +{item.capabilities.length - 3}
                        </Text>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    const renderTaskItem = ({ item }: { item: AgentTask }) => {
        const statusColor = STATUS_COLORS[item.status] || colors.textTertiary;

        return (
            <View style={[styles.taskCard, { backgroundColor: colors.card }]}>
                <View style={styles.taskHeader}>
                    <View style={[styles.taskCheckbox, { borderColor: statusColor }]}>
                        {item.status === 'completed' && (
                            <Ionicons name="checkmark" size={14} color={statusColor} />
                        )}
                    </View>
                    <View style={styles.taskInfo}>
                        <Text style={[styles.taskTitle, { color: colors.text }]}>{item.title}</Text>
                        {item.description && (
                            <Text style={[styles.taskDescription, { color: colors.textTertiary }]} numberOfLines={2}>
                                {item.description}
                            </Text>
                        )}
                    </View>
                    <View style={[styles.taskStatus, { backgroundColor: statusColor + '20' }]}>
                        <Text style={[styles.taskStatusText, { color: statusColor }]}>
                            {item.status.replace('_', ' ')}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderConfig = () => (
        <ScrollView style={styles.configContainer}>
            {/* Goal Section */}
            <View style={[styles.configCard, { backgroundColor: colors.card }]}>
                <View style={styles.configHeader}>
                    <Text style={[styles.configTitle, { color: colors.text }]}>Goal</Text>
                    <TouchableOpacity onPress={() => setIsEditingGoal(!isEditingGoal)}>
                        <Ionicons
                            name={isEditingGoal ? 'checkmark' : 'pencil'}
                            size={18}
                            color={colors.primary}
                        />
                    </TouchableOpacity>
                </View>
                {isEditingGoal ? (
                    <TextInput
                        style={[styles.goalInput, { color: colors.text, backgroundColor: colors.background }]}
                        value={goalDescription}
                        onChangeText={setGoalDescription}
                        placeholder="Describe the swarm's goal..."
                        placeholderTextColor={colors.placeholder}
                        multiline
                        numberOfLines={4}
                        onBlur={handleSaveGoal}
                    />
                ) : (
                    <Text style={[styles.goalText, { color: swarm.goalDescription ? colors.text : colors.textTertiary }]}>
                        {swarm.goalDescription || 'No goal defined. Tap to add one.'}
                    </Text>
                )}
            </View>

            {/* Status Section */}
            <View style={[styles.configCard, { backgroundColor: colors.card }]}>
                <Text style={[styles.configTitle, { color: colors.text }]}>Status</Text>
                <View style={styles.statusOptions}>
                    {(['idle', 'running', 'paused'] as const).map((status) => (
                        <TouchableOpacity
                            key={status}
                            style={[
                                styles.statusOption,
                                { borderColor: STATUS_COLORS[status] },
                                swarm.status === status && { backgroundColor: STATUS_COLORS[status] + '20' },
                            ]}
                            onPress={() => updateSwarm({ ...swarm, status, updatedAt: Date.now() })}
                        >
                            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[status] }]} />
                            <Text style={[
                                styles.statusOptionText,
                                { color: swarm.status === status ? STATUS_COLORS[status] : colors.textTertiary }
                            ]}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Coordinator Section */}
            <View style={[styles.configCard, { backgroundColor: colors.card }]}>
                <Text style={[styles.configTitle, { color: colors.text }]}>Coordinator Agent</Text>
                {swarm.coordinatorAgentId ? (
                    <View style={styles.coordinatorInfo}>
                        <Ionicons name="person-circle" size={24} color={colors.primary} />
                        <Text style={[styles.coordinatorName, { color: colors.text }]}>
                            {swarm.agents.find(a => a.id === swarm.coordinatorAgentId)?.name || 'Unknown'}
                        </Text>
                        <TouchableOpacity onPress={() => updateSwarm({ ...swarm, coordinatorAgentId: undefined, updatedAt: Date.now() })}>
                            <Ionicons name="close-circle" size={20} color={colors.error} />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <Text style={[styles.noCoordinator, { color: colors.textTertiary }]}>
                        No coordinator selected. Long-press an agent to set one.
                    </Text>
                )}
            </View>

            {/* Stats Section */}
            <View style={[styles.configCard, { backgroundColor: colors.card }]}>
                <Text style={[styles.configTitle, { color: colors.text }]}>Statistics</Text>
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: colors.primary }]}>{swarm.agents.length}</Text>
                        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Agents</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: colors.success }]}>{swarm.tasks.length}</Text>
                        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Tasks</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: colors.warning }]}>{swarm.messages.length}</Text>
                        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Messages</Text>
                    </View>
                </View>
            </View>

            {/* Actions */}
            <View style={styles.actionsContainer}>
                <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.primary }]}
                    onPress={handleStartRun}
                >
                    <Ionicons name="play" size={20} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Start Run</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );

    const renderAddAgentModal = () => (
        <Modal
            visible={showAddAgentModal}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowAddAgentModal(false)}
        >
            <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={() => setShowAddAgentModal(false)}>
                        <Text style={[styles.cancelButton, { color: colors.primary }]}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>Add Agent</Text>
                    <TouchableOpacity onPress={handleAddAgent}>
                        <Text style={[styles.createButton, { color: colors.primary }]}>Add</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalContent}>
                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>Name</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, backgroundColor: colors.card }]}
                            value={newAgentName}
                            onChangeText={setNewAgentName}
                            placeholder="Enter agent name"
                            placeholderTextColor={colors.placeholder}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>Role</Text>
                        <View style={styles.roleGrid}>
                            {(Object.keys(ROLE_ICONS) as AgentRole[]).map((role) => (
                                <TouchableOpacity
                                    key={role}
                                    style={[
                                        styles.roleOption,
                                        { backgroundColor: colors.card, borderColor: colors.border },
                                        newAgentRole === role && { borderColor: ROLE_COLORS[role], backgroundColor: ROLE_COLORS[role] + '10' },
                                    ]}
                                    onPress={() => setNewAgentRole(role)}
                                >
                                    <Ionicons
                                        name={ROLE_ICONS[role]}
                                        size={24}
                                        color={newAgentRole === role ? ROLE_COLORS[role] : colors.iconSecondary}
                                    />
                                    <Text style={[
                                        styles.roleOptionText,
                                        { color: newAgentRole === role ? ROLE_COLORS[role] : colors.text }
                                    ]}>
                                        {role.charAt(0).toUpperCase() + role.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>Templates</Text>
                        {AGENT_TEMPLATES.filter(t => t.role === newAgentRole || newAgentRole === 'custom').slice(0, 3).map((template, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[styles.templateOption, { backgroundColor: colors.card }]}
                                onPress={() => setNewAgentName(template.name)}
                            >
                                <View style={styles.templateInfo}>
                                    <Text style={[styles.templateName, { color: colors.text }]}>{template.name}</Text>
                                    <Text style={[styles.templateDesc, { color: colors.textTertiary }]} numberOfLines={1}>
                                        {template.description}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={colors.iconSecondary} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );

    const renderAddTaskModal = () => (
        <Modal
            visible={showAddTaskModal}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowAddTaskModal(false)}
        >
            <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={() => setShowAddTaskModal(false)}>
                        <Text style={[styles.cancelButton, { color: colors.primary }]}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>Add Task</Text>
                    <TouchableOpacity onPress={handleAddTask}>
                        <Text style={[styles.createButton, { color: colors.primary }]}>Add</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.modalContent}>
                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>Title</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, backgroundColor: colors.card }]}
                            value={newTaskTitle}
                            onChangeText={setNewTaskTitle}
                            placeholder="Enter task title"
                            placeholderTextColor={colors.placeholder}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>Description</Text>
                        <TextInput
                            style={[styles.input, styles.textArea, { color: colors.text, backgroundColor: colors.card }]}
                            value={newTaskDescription}
                            onChangeText={setNewTaskDescription}
                            placeholder="Enter task description (optional)"
                            placeholderTextColor={colors.placeholder}
                            multiline
                            numberOfLines={4}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Description Header */}
            <View style={[styles.descriptionHeader, { backgroundColor: colors.card }]}>
                <View style={styles.descriptionRow}>
                    <View style={[
                        styles.statusBadge,
                        { backgroundColor: (STATUS_COLORS[swarm.status] || colors.textTertiary) + '20' }
                    ]}>
                        <View style={[
                            styles.statusDot,
                            { backgroundColor: STATUS_COLORS[swarm.status] || colors.textTertiary }
                        ]} />
                        <Text style={[
                            styles.statusText,
                            { color: STATUS_COLORS[swarm.status] || colors.textTertiary }
                        ]}>
                            {swarm.status.charAt(0).toUpperCase() + swarm.status.slice(1)}
                        </Text>
                    </View>
                    <Text style={[styles.agentCount, { color: colors.textTertiary }]}>
                        {swarm.agents.length} agents • {swarm.tasks.length} tasks
                    </Text>
                </View>
                {swarm.description && (
                    <Text style={[styles.swarmDescription, { color: colors.textTertiary }]} numberOfLines={2}>
                        {swarm.description}
                    </Text>
                )}
            </View>

            {/* Tab Bar */}
            <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                {(['agents', 'tasks', 'config'] as const).map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[
                            styles.tab,
                            activeTab === tab && { borderBottomColor: colors.primary },
                        ]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Ionicons
                            name={
                                tab === 'agents' ? 'people-outline' :
                                    tab === 'tasks' ? 'checkbox-outline' :
                                        'settings-outline'
                            }
                            size={18}
                            color={activeTab === tab ? colors.primary : colors.textTertiary}
                        />
                        <Text style={[
                            styles.tabText,
                            { color: activeTab === tab ? colors.primary : colors.textTertiary }
                        ]}>
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Content */}
            {activeTab === 'agents' && (
                <View style={styles.listContainer}>
                    <FlatList
                        data={swarm.agents}
                        renderItem={renderAgentItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Ionicons name="people-outline" size={48} color={colors.iconSecondary} />
                                <Text style={[styles.emptyTitle, { color: colors.text }]}>No Agents</Text>
                                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                                    Add agents to build your swarm team
                                </Text>
                            </View>
                        }
                    />
                    <TouchableOpacity
                        style={[styles.fab, { backgroundColor: colors.primary }]}
                        onPress={() => setShowAddAgentModal(true)}
                    >
                        <Ionicons name="person-add" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            )}

            {activeTab === 'tasks' && (
                <View style={styles.listContainer}>
                    <FlatList
                        data={swarm.tasks}
                        renderItem={renderTaskItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Ionicons name="checkbox-outline" size={48} color={colors.iconSecondary} />
                                <Text style={[styles.emptyTitle, { color: colors.text }]}>No Tasks</Text>
                                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                                    Add tasks for the swarm to complete
                                </Text>
                            </View>
                        }
                    />
                    <TouchableOpacity
                        style={[styles.fab, { backgroundColor: colors.primary }]}
                        onPress={() => setShowAddTaskModal(true)}
                    >
                        <Ionicons name="add" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            )}

            {activeTab === 'config' && renderConfig()}

            {renderAddAgentModal()}
            {renderAddTaskModal()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        fontSize: 16,
    },
    descriptionHeader: {
        padding: 16,
    },
    descriptionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
    },
    agentCount: {
        fontSize: 14,
    },
    swarmDescription: {
        fontSize: 14,
        marginTop: 8,
    },
    tabBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 6,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
    },
    listContainer: {
        flex: 1,
    },
    listContent: {
        padding: 16,
        paddingBottom: 100,
    },
    // Agent card styles
    agentCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    agentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    agentIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    agentInfo: {
        flex: 1,
        marginLeft: 12,
    },
    agentNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    agentName: {
        fontSize: 17,
        fontWeight: '600',
    },
    coordinatorBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 4,
    },
    coordinatorText: {
        fontSize: 11,
        fontWeight: '600',
    },
    agentRole: {
        fontSize: 14,
        fontWeight: '500',
        marginTop: 2,
    },
    moreButton: {
        padding: 8,
    },
    agentDescription: {
        fontSize: 14,
        marginTop: 8,
        lineHeight: 20,
    },
    agentCapabilities: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 12,
    },
    capabilityChip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    capabilityText: {
        fontSize: 12,
    },
    moreCapabilities: {
        fontSize: 12,
        alignSelf: 'center',
    },
    // Task card styles
    taskCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
    },
    taskHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    taskCheckbox: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        marginTop: 2,
    },
    taskInfo: {
        flex: 1,
    },
    taskTitle: {
        fontSize: 16,
        fontWeight: '500',
    },
    taskDescription: {
        fontSize: 14,
        marginTop: 4,
    },
    taskStatus: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    taskStatusText: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    // Config styles
    configContainer: {
        flex: 1,
        padding: 16,
    },
    configCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    configHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    configTitle: {
        fontSize: 17,
        fontWeight: '600',
        marginBottom: 12,
    },
    goalInput: {
        padding: 12,
        borderRadius: 10,
        fontSize: 15,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    goalText: {
        fontSize: 15,
        lineHeight: 22,
    },
    statusOptions: {
        flexDirection: 'row',
        gap: 12,
    },
    statusOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        gap: 8,
    },
    statusOptionText: {
        fontSize: 14,
        fontWeight: '500',
    },
    coordinatorInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    coordinatorName: {
        flex: 1,
        fontSize: 16,
    },
    noCoordinator: {
        fontSize: 14,
        fontStyle: 'italic',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
    },
    statLabel: {
        fontSize: 13,
        marginTop: 4,
    },
    actionsContainer: {
        padding: 16,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 8,
    },
    actionButtonText: {
        fontSize: 17,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    // Modal styles
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '600',
    },
    cancelButton: {
        fontSize: 17,
    },
    createButton: {
        fontSize: 17,
        fontWeight: '600',
    },
    modalContent: {
        flex: 1,
        padding: 16,
    },
    inputGroup: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '500',
        marginBottom: 8,
    },
    input: {
        borderRadius: 10,
        padding: 14,
        fontSize: 16,
    },
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    roleGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    roleOption: {
        width: '30%',
        alignItems: 'center',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        gap: 8,
    },
    roleOptionText: {
        fontSize: 12,
        fontWeight: '500',
    },
    templateOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 10,
        marginBottom: 8,
    },
    templateInfo: {
        flex: 1,
    },
    templateName: {
        fontSize: 16,
        fontWeight: '500',
    },
    templateDesc: {
        fontSize: 13,
        marginTop: 2,
    },
    // Empty state
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
    },
    emptyText: {
        fontSize: 15,
        marginTop: 8,
        textAlign: 'center',
    },
    // FAB
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
});
