import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    TextInput,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface MLProject {
    id: string;
    name: string;
    type: 'fine-tune' | 'embedding' | 'rag' | 'agent';
    status: 'running' | 'completed' | 'failed' | 'queued';
    baseModel: string;
    progress: number;
    metrics?: {
        loss?: number;
        accuracy?: number;
        f1?: number;
    };
    createdAt: string;
    updatedAt: string;
}

interface Dataset {
    id: string;
    name: string;
    type: 'conversations' | 'documents' | 'qa' | 'custom';
    size: number;
    entries: number;
    format: string;
}

const sampleProjects: MLProject[] = [
    {
        id: '1',
        name: 'Code Assistant Fine-tune',
        type: 'fine-tune',
        status: 'running',
        baseModel: 'llama-3.2-3b',
        progress: 67,
        metrics: { loss: 0.234, accuracy: 0.891 },
        createdAt: '2024-12-10T10:00:00Z',
        updatedAt: '2024-12-12T15:30:00Z',
    },
    {
        id: '2',
        name: 'Document Embeddings',
        type: 'embedding',
        status: 'completed',
        baseModel: 'bge-large-en-v1.5',
        progress: 100,
        createdAt: '2024-12-08T09:00:00Z',
        updatedAt: '2024-12-08T12:00:00Z',
    },
    {
        id: '3',
        name: 'Support RAG Pipeline',
        type: 'rag',
        status: 'completed',
        baseModel: 'gpt-4o-mini',
        progress: 100,
        metrics: { f1: 0.923 },
        createdAt: '2024-12-05T14:00:00Z',
        updatedAt: '2024-12-06T08:00:00Z',
    },
    {
        id: '4',
        name: 'Research Agent',
        type: 'agent',
        status: 'queued',
        baseModel: 'claude-3-haiku',
        progress: 0,
        createdAt: '2024-12-12T16:00:00Z',
        updatedAt: '2024-12-12T16:00:00Z',
    },
];

const sampleDatasets: Dataset[] = [
    { id: '1', name: 'Chat History Export', type: 'conversations', size: 15.2, entries: 1247, format: 'JSONL' },
    { id: '2', name: 'Technical Docs', type: 'documents', size: 45.8, entries: 324, format: 'Markdown' },
    { id: '3', name: 'FAQ Pairs', type: 'qa', size: 2.1, entries: 892, format: 'CSV' },
    { id: '4', name: 'Code Samples', type: 'custom', size: 8.7, entries: 1563, format: 'JSONL' },
];

const typeConfig = {
    'fine-tune': { icon: 'fitness-outline', color: '#8b5cf6' },
    'embedding': { icon: 'cube-outline', color: '#3b82f6' },
    'rag': { icon: 'git-network-outline', color: '#10b981' },
    'agent': { icon: 'person-outline', color: '#f59e0b' },
};

const statusConfig = {
    running: { bg: '#3b82f620', color: '#3b82f6', icon: 'play-circle' },
    completed: { bg: '#10b98120', color: '#10b981', icon: 'checkmark-circle' },
    failed: { bg: '#ef444420', color: '#ef4444', icon: 'close-circle' },
    queued: { bg: '#64748b20', color: '#64748b', icon: 'time' },
};

export function DeveloperScreen() {
    const { colors } = useTheme();
    const [activeTab, setActiveTab] = useState<'projects' | 'datasets' | 'playground'>('projects');
    const [projects] = useState<MLProject[]>(sampleProjects);
    const [datasets] = useState<Dataset[]>(sampleDatasets);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [playgroundPrompt, setPlaygroundPrompt] = useState('');

    // Stats
    const stats = useMemo(() => ({
        totalProjects: projects.length,
        running: projects.filter(p => p.status === 'running').length,
        datasets: datasets.length,
        totalSize: datasets.reduce((sum, d) => sum + d.size, 0).toFixed(1),
    }), [projects, datasets]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 1000);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Stats */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="flask-outline" size={18} color={colors.primary} />
                    <Text style={[styles.statValue, { color: colors.text }]}>{stats.totalProjects}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Projects</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="pulse-outline" size={18} color="#3b82f6" />
                    <Text style={[styles.statValue, { color: '#3b82f6' }]}>{stats.running}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Running</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="document-outline" size={18} color="#10b981" />
                    <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.datasets}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Datasets</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="server-outline" size={18} color="#f59e0b" />
                    <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.totalSize}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>MB</Text>
                </View>
            </View>

            {/* Tab Bar */}
            <View style={styles.tabBar}>
                {(['projects', 'datasets', 'playground'] as const).map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[
                            styles.tab,
                            { borderBottomColor: activeTab === tab ? colors.primary : 'transparent' }
                        ]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Ionicons
                            name={tab === 'projects' ? 'flask-outline' : tab === 'datasets' ? 'document-outline' : 'code-slash-outline'}
                            size={18}
                            color={activeTab === tab ? colors.primary : colors.textSecondary}
                        />
                        <Text style={[styles.tabText, {
                            color: activeTab === tab ? colors.primary : colors.textSecondary
                        }]}>
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Content */}
            <ScrollView
                style={styles.content}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
                }
            >
                {activeTab === 'projects' && (
                    <>
                        {projects.map((project) => {
                            const typeStyle = typeConfig[project.type];
                            const status = statusConfig[project.status];

                            return (
                                <View
                                    key={project.id}
                                    style={[styles.projectCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                                >
                                    <View style={styles.projectHeader}>
                                        <View style={[styles.typeIcon, { backgroundColor: `${typeStyle.color}20` }]}>
                                            <Ionicons name={typeStyle.icon as any} size={20} color={typeStyle.color} />
                                        </View>
                                        <View style={styles.projectInfo}>
                                            <Text style={[styles.projectName, { color: colors.text }]}>{project.name}</Text>
                                            <Text style={[styles.projectMeta, { color: colors.textSecondary }]}>
                                                {project.type} • {project.baseModel}
                                            </Text>
                                        </View>
                                        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                                            <Ionicons name={status.icon as any} size={12} color={status.color} />
                                            <Text style={[styles.statusText, { color: status.color }]}>{project.status}</Text>
                                        </View>
                                    </View>

                                    {/* Progress */}
                                    {project.status === 'running' && (
                                        <View style={styles.progressSection}>
                                            <View style={styles.progressHeader}>
                                                <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>Progress</Text>
                                                <Text style={[styles.progressValue, { color: colors.text }]}>{project.progress}%</Text>
                                            </View>
                                            <View style={[styles.progressBar, { backgroundColor: colors.background }]}>
                                                <View style={[styles.progressFill, { width: `${project.progress}%`, backgroundColor: typeStyle.color }]} />
                                            </View>
                                        </View>
                                    )}

                                    {/* Metrics */}
                                    {project.metrics && (
                                        <View style={styles.metricsRow}>
                                            {project.metrics.loss !== undefined && (
                                                <View style={styles.metricItem}>
                                                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Loss</Text>
                                                    <Text style={[styles.metricValue, { color: colors.text }]}>{project.metrics.loss.toFixed(3)}</Text>
                                                </View>
                                            )}
                                            {project.metrics.accuracy !== undefined && (
                                                <View style={styles.metricItem}>
                                                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Accuracy</Text>
                                                    <Text style={[styles.metricValue, { color: colors.text }]}>{(project.metrics.accuracy * 100).toFixed(1)}%</Text>
                                                </View>
                                            )}
                                            {project.metrics.f1 !== undefined && (
                                                <View style={styles.metricItem}>
                                                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>F1 Score</Text>
                                                    <Text style={[styles.metricValue, { color: colors.text }]}>{(project.metrics.f1 * 100).toFixed(1)}%</Text>
                                                </View>
                                            )}
                                        </View>
                                    )}

                                    <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                                        Updated {formatDate(project.updatedAt)}
                                    </Text>
                                </View>
                            );
                        })}
                    </>
                )}

                {activeTab === 'datasets' && (
                    <>
                        {datasets.map((dataset) => (
                            <View
                                key={dataset.id}
                                style={[styles.datasetCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                            >
                                <View style={styles.datasetHeader}>
                                    <Ionicons name="document-text-outline" size={24} color={colors.primary} />
                                    <View style={styles.datasetInfo}>
                                        <Text style={[styles.datasetName, { color: colors.text }]}>{dataset.name}</Text>
                                        <Text style={[styles.datasetMeta, { color: colors.textSecondary }]}>
                                            {dataset.type} • {dataset.format}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.datasetStats}>
                                    <View style={styles.datasetStat}>
                                        <Text style={[styles.datasetStatValue, { color: colors.text }]}>{dataset.entries.toLocaleString()}</Text>
                                        <Text style={[styles.datasetStatLabel, { color: colors.textSecondary }]}>entries</Text>
                                    </View>
                                    <View style={styles.datasetStat}>
                                        <Text style={[styles.datasetStatValue, { color: colors.text }]}>{dataset.size}</Text>
                                        <Text style={[styles.datasetStatLabel, { color: colors.textSecondary }]}>MB</Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                        <TouchableOpacity style={[styles.uploadButton, { borderColor: colors.border }]}>
                            <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
                            <Text style={[styles.uploadText, { color: colors.primary }]}>Upload Dataset</Text>
                        </TouchableOpacity>
                    </>
                )}

                {activeTab === 'playground' && (
                    <View style={[styles.playgroundCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.playgroundTitle, { color: colors.text }]}>Prompt Playground</Text>
                        <TextInput
                            style={[styles.playgroundInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                            placeholder="Enter your prompt here..."
                            placeholderTextColor={colors.textSecondary}
                            value={playgroundPrompt}
                            onChangeText={setPlaygroundPrompt}
                            multiline
                            numberOfLines={6}
                            textAlignVertical="top"
                        />
                        <View style={styles.playgroundActions}>
                            <TouchableOpacity style={[styles.modelSelect, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                <Text style={[styles.modelSelectText, { color: colors.text }]}>gpt-4o-mini</Text>
                                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.runButton, { backgroundColor: colors.primary }]}>
                                <Ionicons name="play" size={18} color="#fff" />
                                <Text style={styles.runButtonText}>Run</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={[styles.outputArea, { backgroundColor: colors.background, borderColor: colors.border }]}>
                            <Text style={[styles.outputPlaceholder, { color: colors.textSecondary }]}>
                                Output will appear here...
                            </Text>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* FAB */}
            <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]}>
                <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    statsRow: {
        flexDirection: 'row',
        padding: 16,
        gap: 8,
    },
    statCard: {
        flex: 1,
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 18,
        fontWeight: '700',
        marginTop: 4,
    },
    statLabel: {
        fontSize: 9,
        marginTop: 2,
    },
    tabBar: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderBottomWidth: 2,
    },
    tabText: {
        fontSize: 13,
        fontWeight: '500',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    projectCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        marginBottom: 12,
    },
    projectHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    typeIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    projectInfo: {
        flex: 1,
    },
    projectName: {
        fontSize: 15,
        fontWeight: '600',
    },
    projectMeta: {
        fontSize: 12,
        marginTop: 2,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '500',
    },
    progressSection: {
        marginBottom: 12,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    progressLabel: {
        fontSize: 11,
    },
    progressValue: {
        fontSize: 11,
        fontWeight: '600',
    },
    progressBar: {
        height: 6,
        borderRadius: 3,
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    metricsRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 8,
    },
    metricItem: {},
    metricLabel: {
        fontSize: 10,
    },
    metricValue: {
        fontSize: 14,
        fontWeight: '600',
    },
    timestamp: {
        fontSize: 11,
    },
    datasetCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        marginBottom: 12,
    },
    datasetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    datasetInfo: {
        flex: 1,
    },
    datasetName: {
        fontSize: 15,
        fontWeight: '600',
    },
    datasetMeta: {
        fontSize: 12,
        marginTop: 2,
    },
    datasetStats: {
        flexDirection: 'row',
        gap: 24,
    },
    datasetStat: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
    },
    datasetStatValue: {
        fontSize: 18,
        fontWeight: '700',
    },
    datasetStatLabel: {
        fontSize: 12,
    },
    uploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 20,
        borderRadius: 12,
        borderWidth: 2,
        borderStyle: 'dashed',
    },
    uploadText: {
        fontSize: 14,
        fontWeight: '500',
    },
    playgroundCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
    },
    playgroundTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    playgroundInput: {
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        fontSize: 14,
        minHeight: 120,
    },
    playgroundActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    modelSelect: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
    },
    modelSelectText: {
        fontSize: 13,
    },
    runButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
    },
    runButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    outputArea: {
        marginTop: 12,
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        minHeight: 100,
    },
    outputPlaceholder: {
        fontSize: 13,
        fontStyle: 'italic',
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
});

export default DeveloperScreen;
