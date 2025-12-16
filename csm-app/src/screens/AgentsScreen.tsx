import React, { useState } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    Alert,
    TextInput,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAgentsContext } from '../context/AgentsContext';
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
    custom: 'construct-outline',
};

export function AgentsScreen({ navigation }: Props) {
    const {
        runs,
        swarms,
        agents,
        addSwarm,
        addAgent,
        startRun,
        removeRun,
        removeSwarm,
    } = useAgentsContext();

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createType, setCreateType] = useState<'swarm' | 'agent' | 'run'>('swarm');
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);

    const handleCreate = () => {
        if (!newName.trim()) {
            Alert.alert('Error', 'Please enter a name');
            return;
        }

        if (createType === 'swarm') {
            const swarm = addSwarm(newName, newDescription);
            if (selectedTemplate !== null) {
                const template = SWARM_TEMPLATES[selectedTemplate];
                template.roles.forEach((role, index) => {
                    const agentTemplate = AGENT_TEMPLATES.find(t => t.role === role);
                    if (agentTemplate) {
                        const agent = addAgent(
                            `${agentTemplate.name} ${index + 1}`,
                            role,
                            agentTemplate.description
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
                        <View style={styles.templatesSection}>
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
                                            setNewDescription(template.description);
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
                        </View>
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
                                            setNewDescription(template.description);
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

    return (
        <View style={styles.container}>
            {/* Swarms Section */}
            {swarms.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>SWARMS</Text>
                    <FlatList
                        data={swarms}
                        renderItem={renderSwarm}
                        keyExtractor={item => item.id}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.swarmsContainer}
                    />
                </View>
            )}

            {/* Runs Section */}
            <View style={styles.runsSection}>
                <Text style={styles.sectionTitle}>RECENT RUNS</Text>
                <FlatList
                    data={runs}
                    renderItem={renderRun}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.runsContainer}
                    ListEmptyComponent={renderEmptyState}
                />
            </View>

            {/* FAB */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => setShowCreateModal(true)}
            >
                <Ionicons name="add" size={28} color="#FFFFFF" />
            </TouchableOpacity>

            {renderCreateModal()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F2F7',
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
});
