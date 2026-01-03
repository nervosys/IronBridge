import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    TextInput,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAgentsContext } from '../context/AgentsContext';
import { useTheme } from '../context/ThemeContext';
import { AgentRun, AgentTask, AgentMessage, TaskStatus } from '../api/agents';
import type { RootStackParamList } from '../navigation/types';

type Props = {
    route: RouteProp<RootStackParamList, 'AgentRunDetail'>;
    navigation: NativeStackNavigationProp<RootStackParamList, 'AgentRunDetail'>;
};

const STATUS_COLORS: Record<string, string> = {
    running: '#007AFF',
    completed: '#34C759',
    failed: '#FF3B30',
    cancelled: '#8E8E93',
    pending: '#FF9500',
    in_progress: '#007AFF',
};

const MESSAGE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
    thought: 'bulb-outline',
    action: 'play-circle-outline',
    observation: 'eye-outline',
    result: 'checkmark-circle-outline',
    error: 'alert-circle-outline',
    handoff: 'swap-horizontal-outline',
};

export function AgentRunDetailScreen({ route, navigation }: Props) {
    const { runId } = route.params;
    const { colors, isDark } = useTheme();
    const {
        runs,
        updateRun,
        addMessageToRun,
        addTaskToRun,
        updateTaskInRun,
    } = useAgentsContext();

    const [activeTab, setActiveTab] = useState<'timeline' | 'tasks' | 'stats'>('timeline');
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [showAddTask, setShowAddTask] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    const run = runs.find(r => r.id === runId);

    useEffect(() => {
        if (run) {
            navigation.setOptions({
                title: run.name,
                headerRight: () => (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        {run.status === 'running' && (
                            <TouchableOpacity
                                style={{ paddingHorizontal: 8 }}
                                onPress={handlePauseRun}
                            >
                                <Ionicons name="pause-circle-outline" size={24} color={colors.warning} />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={{ paddingHorizontal: 8 }}
                            onPress={handleShareRun}
                        >
                            <Ionicons name="share-outline" size={24} color={colors.primary} />
                        </TouchableOpacity>
                    </View>
                ),
            });
        }
    }, [run, navigation, colors]);

    if (!run) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <Text style={[styles.errorText, { color: colors.error }]}>Run not found</Text>
            </View>
        );
    }

    const handlePauseRun = () => {
        Alert.alert(
            'Pause Run',
            'Are you sure you want to pause this run?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Pause',
                    onPress: () => updateRun({ ...run, status: 'cancelled' }),
                },
            ]
        );
    };

    const handleShareRun = () => {
        const summary = generateRunSummary(run);
        Alert.alert('Export Run', 'Choose export format', [
            { text: 'Copy JSON', onPress: () => copyToClipboard(JSON.stringify(run, null, 2)) },
            { text: 'Copy Summary', onPress: () => copyToClipboard(summary) },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const copyToClipboard = async (text: string) => {
        // In a real app, use Clipboard API
        Alert.alert('Copied', 'Content copied to clipboard');
    };

    const generateRunSummary = (run: AgentRun): string => {
        const completedTasks = run.tasks.filter(t => t.status === 'completed').length;
        return `# ${run.name}

**Status:** ${run.status}
**Duration:** ${formatDuration(run.startedAt, run.completedAt)}
**Tasks:** ${completedTasks}/${run.tasks.length} completed
**Messages:** ${run.messages.length}
**Tokens:** ${run.tokensUsed.toLocaleString()}

## Tasks
${run.tasks.map(t => `- [${t.status === 'completed' ? 'x' : ' '}] ${t.title}`).join('\n')}

## Timeline
${run.messages.slice(-10).map(m => `**${m.type}:** ${m.content.slice(0, 100)}...`).join('\n')}
`;
    };

    const handleAddTask = () => {
        if (!newTaskTitle.trim()) return;

        addTaskToRun(run.id, newTaskTitle.trim(), '');

        setNewTaskTitle('');
        setShowAddTask(false);
    };

    const handleUpdateTaskStatus = (task: AgentTask, newStatus: TaskStatus) => {
        updateTaskInRun(run.id, {
            ...task,
            status: newStatus,
            updatedAt: Date.now(),
            ...(newStatus === 'completed' ? { completedAt: Date.now() } : {}),
            ...(newStatus === 'in_progress' ? { startedAt: Date.now() } : {}),
        });
    };

    const formatDuration = (start: number, end?: number): string => {
        const duration = (end || Date.now()) - start;
        const hours = Math.floor(duration / 3600000);
        const minutes = Math.floor((duration % 3600000) / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        }
        return `${seconds}s`;
    };

    const formatTime = (timestamp: number): string => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const renderTimelineItem = ({ item, index }: { item: AgentMessage; index: number }) => {
        const iconName = MESSAGE_ICONS[item.type] || 'chatbubble-outline';
        const isError = item.type === 'error';

        return (
            <View style={[styles.timelineItem, { backgroundColor: colors.card }]}>
                <View style={styles.timelineLeft}>
                    <View style={[
                        styles.iconCircle,
                        { backgroundColor: isError ? colors.error + '20' : colors.primary + '20' }
                    ]}>
                        <Ionicons
                            name={iconName}
                            size={16}
                            color={isError ? colors.error : colors.primary}
                        />
                    </View>
                    {index < run.messages.length - 1 && (
                        <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                    )}
                </View>
                <View style={styles.timelineContent}>
                    <View style={styles.timelineHeader}>
                        <Text style={[styles.messageType, { color: colors.textTertiary }]}>
                            {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                        </Text>
                        <Text style={[styles.messageTime, { color: colors.textTertiary }]}>
                            {formatTime(item.timestamp)}
                        </Text>
                    </View>
                    <Text style={[styles.messageContent, { color: colors.text }]} numberOfLines={4}>
                        {item.content}
                    </Text>
                    {item.metadata && Object.keys(item.metadata).length > 0 && (
                        <View style={[styles.metadataContainer, { backgroundColor: colors.background }]}>
                            {Object.entries(item.metadata).slice(0, 3).map(([key, value]) => (
                                <Text key={key} style={[styles.metadataText, { color: colors.textTertiary }]}>
                                    {key}: {String(value).slice(0, 50)}
                                </Text>
                            ))}
                        </View>
                    )}
                </View>
            </View>
        );
    };

    const renderTaskItem = ({ item }: { item: AgentTask }) => {
        const statusColor = STATUS_COLORS[item.status] || colors.textTertiary;

        return (
            <TouchableOpacity
                style={[styles.taskItem, { backgroundColor: colors.card }]}
                onPress={() => {
                    const nextStatus: Record<TaskStatus, TaskStatus> = {
                        pending: 'in_progress',
                        in_progress: 'completed',
                        completed: 'pending',
                        failed: 'pending',
                        cancelled: 'pending',
                    };
                    handleUpdateTaskStatus(item, nextStatus[item.status]);
                }}
                onLongPress={() => {
                    Alert.alert('Task Options', item.title, [
                        { text: 'Mark Complete', onPress: () => handleUpdateTaskStatus(item, 'completed') },
                        { text: 'Mark Failed', onPress: () => handleUpdateTaskStatus(item, 'failed'), style: 'destructive' },
                        { text: 'Cancel', style: 'cancel' },
                    ]);
                }}
            >
                <View style={[styles.taskCheckbox, { borderColor: statusColor }]}>
                    {item.status === 'completed' && (
                        <Ionicons name="checkmark" size={14} color={statusColor} />
                    )}
                    {item.status === 'in_progress' && (
                        <ActivityIndicator size="small" color={statusColor} />
                    )}
                    {item.status === 'failed' && (
                        <Ionicons name="close" size={14} color={statusColor} />
                    )}
                </View>
                <View style={styles.taskContent}>
                    <Text
                        style={[
                            styles.taskTitle,
                            { color: colors.text },
                            item.status === 'completed' && styles.taskTitleCompleted,
                        ]}
                    >
                        {item.title}
                    </Text>
                    {item.description && (
                        <Text style={[styles.taskDescription, { color: colors.textTertiary }]} numberOfLines={2}>
                            {item.description}
                        </Text>
                    )}
                </View>
                <View style={[styles.taskStatusBadge, { backgroundColor: statusColor + '20' }]}>
                    <Text style={[styles.taskStatusText, { color: statusColor }]}>
                        {item.status.replace('_', ' ')}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    const renderStats = () => {
        const completedTasks = run.tasks.filter(t => t.status === 'completed').length;
        const failedTasks = run.tasks.filter(t => t.status === 'failed').length;
        const messagesByType = run.messages.reduce((acc, m) => {
            acc[m.type] = (acc[m.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return (
            <ScrollView style={styles.statsContainer}>
                {/* Summary Card */}
                <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
                    <Text style={[styles.statsTitle, { color: colors.text }]}>Run Summary</Text>

                    <View style={styles.statsGrid}>
                        <View style={styles.statBox}>
                            <Text style={[styles.statValue, { color: colors.primary }]}>
                                {formatDuration(run.startedAt, run.completedAt)}
                            </Text>
                            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Duration</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={[styles.statValue, { color: colors.success }]}>
                                {completedTasks}/{run.tasks.length}
                            </Text>
                            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Tasks Done</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={[styles.statValue, { color: colors.text }]}>
                                {run.messages.length}
                            </Text>
                            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Messages</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={[styles.statValue, { color: colors.warning }]}>
                                {run.tokensUsed.toLocaleString()}
                            </Text>
                            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Tokens</Text>
                        </View>
                    </View>
                </View>

                {/* Messages Breakdown */}
                <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
                    <Text style={[styles.statsTitle, { color: colors.text }]}>Message Types</Text>
                    {Object.entries(messagesByType).map(([type, count]) => (
                        <View key={type} style={styles.breakdownRow}>
                            <View style={styles.breakdownLabel}>
                                <Ionicons
                                    name={MESSAGE_ICONS[type] || 'chatbubble-outline'}
                                    size={16}
                                    color={colors.primary}
                                />
                                <Text style={[styles.breakdownText, { color: colors.text }]}>
                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                </Text>
                            </View>
                            <Text style={[styles.breakdownCount, { color: colors.textTertiary }]}>
                                {count}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Task Progress */}
                <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
                    <Text style={[styles.statsTitle, { color: colors.text }]}>Task Progress</Text>
                    <View style={[styles.progressBar, { backgroundColor: colors.background }]}>
                        <View
                            style={[
                                styles.progressFill,
                                {
                                    backgroundColor: colors.success,
                                    width: `${run.tasks.length > 0 ? (completedTasks / run.tasks.length) * 100 : 0}%`,
                                },
                            ]}
                        />
                        <View
                            style={[
                                styles.progressFill,
                                {
                                    backgroundColor: colors.error,
                                    width: `${run.tasks.length > 0 ? (failedTasks / run.tasks.length) * 100 : 0}%`,
                                },
                            ]}
                        />
                    </View>
                    <View style={styles.progressLegend}>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                            <Text style={[styles.legendText, { color: colors.textTertiary }]}>
                                Completed ({completedTasks})
                            </Text>
                        </View>
                        <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
                            <Text style={[styles.legendText, { color: colors.textTertiary }]}>
                                Failed ({failedTasks})
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Cost Estimate */}
                {run.cost !== undefined && (
                    <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
                        <Text style={[styles.statsTitle, { color: colors.text }]}>Cost Estimate</Text>
                        <Text style={[styles.costValue, { color: colors.success }]}>
                            ${run.cost.toFixed(4)}
                        </Text>
                    </View>
                )}
            </ScrollView>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Status Header */}
            <View style={[styles.statusHeader, { backgroundColor: colors.card }]}>
                <View style={styles.statusInfo}>
                    <View style={[
                        styles.statusBadge,
                        { backgroundColor: (STATUS_COLORS[run.status] || colors.textTertiary) + '20' }
                    ]}>
                        <View style={[
                            styles.statusDot,
                            { backgroundColor: STATUS_COLORS[run.status] || colors.textTertiary }
                        ]} />
                        <Text style={[
                            styles.statusText,
                            { color: STATUS_COLORS[run.status] || colors.textTertiary }
                        ]}>
                            {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
                        </Text>
                    </View>
                    <Text style={[styles.runDescription, { color: colors.textTertiary }]} numberOfLines={2}>
                        {run.description || 'No description'}
                    </Text>
                </View>
                {run.status === 'running' && (
                    <ActivityIndicator size="small" color={colors.primary} />
                )}
            </View>

            {/* Tab Bar */}
            <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                {(['timeline', 'tasks', 'stats'] as const).map((tab) => (
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
                                tab === 'timeline' ? 'time-outline' :
                                    tab === 'tasks' ? 'checkbox-outline' :
                                        'stats-chart-outline'
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
            {activeTab === 'timeline' && (
                <FlatList
                    data={Array.isArray(run.messages) ? run.messages.slice().reverse() : []}
                    renderItem={renderTimelineItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="time-outline" size={48} color={colors.iconSecondary} />
                            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                                No messages yet
                            </Text>
                        </View>
                    }
                />
            )}

            {activeTab === 'tasks' && (
                <View style={styles.tasksContainer}>
                    <FlatList
                        data={run.tasks}
                        renderItem={renderTaskItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Ionicons name="checkbox-outline" size={48} color={colors.iconSecondary} />
                                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                                    No tasks yet
                                </Text>
                            </View>
                        }
                    />

                    {/* Add Task Input */}
                    {showAddTask ? (
                        <View style={[styles.addTaskContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
                            <TextInput
                                style={[styles.addTaskInput, { color: colors.text, backgroundColor: colors.background }]}
                                placeholder="Enter task title..."
                                placeholderTextColor={colors.placeholder}
                                value={newTaskTitle}
                                onChangeText={setNewTaskTitle}
                                onSubmitEditing={handleAddTask}
                                autoFocus
                            />
                            <TouchableOpacity
                                style={[styles.addTaskButton, { backgroundColor: colors.primary }]}
                                onPress={handleAddTask}
                            >
                                <Ionicons name="add" size={20} color="#FFFFFF" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.cancelTaskButton}
                                onPress={() => setShowAddTask(false)}
                            >
                                <Ionicons name="close" size={20} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={[styles.addTaskFab, { backgroundColor: colors.primary }]}
                            onPress={() => setShowAddTask(true)}
                        >
                            <Ionicons name="add" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {activeTab === 'stats' && renderStats()}
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
    statusHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    statusInfo: {
        flex: 1,
        gap: 8,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
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
    runDescription: {
        fontSize: 14,
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
    listContent: {
        padding: 16,
        paddingBottom: 100,
    },
    // Timeline styles
    timelineItem: {
        flexDirection: 'row',
        marginBottom: 12,
        borderRadius: 12,
        padding: 12,
    },
    timelineLeft: {
        alignItems: 'center',
        marginRight: 12,
    },
    iconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timelineLine: {
        width: 2,
        flex: 1,
        marginTop: 8,
    },
    timelineContent: {
        flex: 1,
    },
    timelineHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    messageType: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    messageTime: {
        fontSize: 12,
    },
    messageContent: {
        fontSize: 14,
        lineHeight: 20,
    },
    metadataContainer: {
        marginTop: 8,
        padding: 8,
        borderRadius: 8,
    },
    metadataText: {
        fontSize: 12,
        fontFamily: 'monospace',
    },
    // Task styles
    tasksContainer: {
        flex: 1,
    },
    taskItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginBottom: 8,
        borderRadius: 12,
    },
    taskCheckbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    taskContent: {
        flex: 1,
    },
    taskTitle: {
        fontSize: 16,
        fontWeight: '500',
    },
    taskTitleCompleted: {
        textDecorationLine: 'line-through',
        opacity: 0.7,
    },
    taskDescription: {
        fontSize: 14,
        marginTop: 4,
    },
    taskStatusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    taskStatusText: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    addTaskContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderTopWidth: 1,
        gap: 8,
    },
    addTaskInput: {
        flex: 1,
        height: 44,
        borderRadius: 10,
        paddingHorizontal: 16,
        fontSize: 16,
    },
    addTaskButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelTaskButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addTaskFab: {
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
    // Stats styles
    statsContainer: {
        flex: 1,
        padding: 16,
    },
    statsCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    statsTitle: {
        fontSize: 17,
        fontWeight: '600',
        marginBottom: 16,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    statBox: {
        width: '45%',
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
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    breakdownLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    breakdownText: {
        fontSize: 15,
    },
    breakdownCount: {
        fontSize: 15,
        fontWeight: '600',
    },
    progressBar: {
        height: 8,
        borderRadius: 4,
        flexDirection: 'row',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
    },
    progressLegend: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 12,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendText: {
        fontSize: 13,
    },
    costValue: {
        fontSize: 28,
        fontWeight: '700',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 15,
        marginTop: 12,
    },
});
