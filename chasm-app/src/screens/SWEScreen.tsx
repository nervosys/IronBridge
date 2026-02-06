import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface CodeMemory {
    id: string;
    type: 'solution' | 'pattern' | 'debug' | 'review';
    title: string;
    description: string;
    language: string;
    tags: string[];
    codeSnippet?: string;
    linkedSession?: string;
    createdAt: string;
    useCount: number;
}

interface ProjectContext {
    id: string;
    name: string;
    path: string;
    language: string;
    lastAccessed: string;
    memoriesCount: number;
}

const sampleMemories: CodeMemory[] = [
    {
        id: '1',
        type: 'solution',
        title: 'React Hook Dependency Array Fix',
        description: 'Resolved infinite re-render loop by properly memoizing callback dependencies',
        language: 'typescript',
        tags: ['react', 'hooks', 'performance'],
        codeSnippet: 'const memoizedCallback = useCallback(() => {\n  doSomething(a, b);\n}, [a, b]);',
        createdAt: '2024-12-12T10:00:00Z',
        useCount: 5,
    },
    {
        id: '2',
        type: 'pattern',
        title: 'API Error Handling Pattern',
        description: 'Consistent error handling with retry logic and user feedback',
        language: 'typescript',
        tags: ['api', 'error-handling', 'async'],
        createdAt: '2024-12-10T14:30:00Z',
        useCount: 12,
    },
    {
        id: '3',
        type: 'debug',
        title: 'SQLite Connection Pool Issue',
        description: 'Fixed connection exhaustion by implementing proper pooling',
        language: 'rust',
        tags: ['database', 'sqlite', 'performance'],
        linkedSession: 'session_abc123',
        createdAt: '2024-12-08T09:15:00Z',
        useCount: 3,
    },
    {
        id: '4',
        type: 'review',
        title: 'Authentication Flow Improvements',
        description: 'PR review notes on OAuth2 PKCE implementation',
        language: 'typescript',
        tags: ['security', 'auth', 'oauth'],
        createdAt: '2024-12-05T16:00:00Z',
        useCount: 2,
    },
];

const sampleProjects: ProjectContext[] = [
    { id: '1', name: 'Chasm', path: '/dev/chasm', language: 'Rust/TypeScript', lastAccessed: '2024-12-12', memoriesCount: 24 },
    { id: '2', name: 'csm-web', path: '/dev/csm/csm-web', language: 'TypeScript', lastAccessed: '2024-12-12', memoriesCount: 18 },
    { id: '3', name: 'csm-app', path: '/dev/csm/csm-app', language: 'TypeScript', lastAccessed: '2024-12-11', memoriesCount: 12 },
];

const typeConfig = {
    solution: { icon: 'bulb-outline', color: '#10b981', label: 'Solution' },
    pattern: { icon: 'git-branch-outline', color: '#3b82f6', label: 'Pattern' },
    debug: { icon: 'bug-outline', color: '#f59e0b', label: 'Debug' },
    review: { icon: 'eye-outline', color: '#8b5cf6', label: 'Review' },
};

const languageColors: Record<string, string> = {
    typescript: '#3178c6',
    javascript: '#f7df1e',
    rust: '#dea584',
    python: '#3776ab',
    go: '#00add8',
};

export function SWEScreen() {
    const { colors } = useTheme();
    const [activeTab, setActiveTab] = useState<'memories' | 'projects' | 'search'>('memories');
    const [memories] = useState<CodeMemory[]>(sampleMemories);
    const [projects] = useState<ProjectContext[]>(sampleProjects);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const filteredMemories = useMemo(() => {
        let result = memories;
        if (filterType !== 'all') {
            result = result.filter(m => m.type === filterType);
        }
        if (searchQuery) {
            result = result.filter(m =>
                m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                m.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }
        return result;
    }, [memories, filterType, searchQuery]);

    const stats = useMemo(() => ({
        total: memories.length,
        solutions: memories.filter(m => m.type === 'solution').length,
        patterns: memories.filter(m => m.type === 'pattern').length,
        totalUses: memories.reduce((sum, m) => sum + m.useCount, 0),
    }), [memories]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 1000);
    };

    const formatRelativeTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Stats */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="code-slash-outline" size={18} color={colors.primary} />
                    <Text style={[styles.statValue, { color: colors.text }]}>{stats.total}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Memories</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="bulb-outline" size={18} color="#10b981" />
                    <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.solutions}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Solutions</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="git-branch-outline" size={18} color="#3b82f6" />
                    <Text style={[styles.statValue, { color: '#3b82f6' }]}>{stats.patterns}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Patterns</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="repeat-outline" size={18} color="#8b5cf6" />
                    <Text style={[styles.statValue, { color: '#8b5cf6' }]}>{stats.totalUses}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Uses</Text>
                </View>
            </View>

            {/* Search */}
            <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
                <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search memories, patterns, solutions..."
                    placeholderTextColor={colors.textSecondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {/* Tabs */}
            <View style={styles.tabBar}>
                {(['memories', 'projects', 'search'] as const).map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, { borderBottomColor: activeTab === tab ? colors.primary : 'transparent' }]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Ionicons
                            name={tab === 'memories' ? 'hardware-chip-outline' : tab === 'projects' ? 'folder-outline' : 'telescope-outline'}
                            size={18}
                            color={activeTab === tab ? colors.primary : colors.textSecondary}
                        />
                        <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.textSecondary }]}>
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Type Filter */}
            {activeTab === 'memories' && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                    <View style={styles.filterRow}>
                        {['all', 'solution', 'pattern', 'debug', 'review'].map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[styles.filterChip, {
                                    backgroundColor: filterType === type ? colors.primary : colors.card,
                                    borderColor: colors.border,
                                }]}
                                onPress={() => setFilterType(type)}
                            >
                                {type !== 'all' && (
                                    <Ionicons
                                        name={typeConfig[type as keyof typeof typeConfig].icon as any}
                                        size={14}
                                        color={filterType === type ? '#fff' : typeConfig[type as keyof typeof typeConfig].color}
                                    />
                                )}
                                <Text style={[styles.filterChipText, { color: filterType === type ? '#fff' : colors.text }]}>
                                    {type === 'all' ? 'All' : typeConfig[type as keyof typeof typeConfig].label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            )}

            {/* Content */}
            <ScrollView
                style={styles.content}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
                }
            >
                {activeTab === 'memories' && (
                    <>
                        {filteredMemories.map((memory) => {
                            const typeStyle = typeConfig[memory.type];

                            return (
                                <View
                                    key={memory.id}
                                    style={[styles.memoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                                >
                                    <View style={styles.memoryHeader}>
                                        <View style={[styles.typeIcon, { backgroundColor: `${typeStyle.color}20` }]}>
                                            <Ionicons name={typeStyle.icon as any} size={18} color={typeStyle.color} />
                                        </View>
                                        <View style={styles.memoryInfo}>
                                            <Text style={[styles.memoryTitle, { color: colors.text }]}>{memory.title}</Text>
                                            <View style={styles.memoryMeta}>
                                                <View style={[styles.langBadge, {
                                                    backgroundColor: `${languageColors[memory.language] || colors.primary}20`
                                                }]}>
                                                    <Text style={[styles.langText, {
                                                        color: languageColors[memory.language] || colors.primary
                                                    }]}>
                                                        {memory.language}
                                                    </Text>
                                                </View>
                                                <Text style={[styles.useCount, { color: colors.textSecondary }]}>
                                                    Used {memory.useCount}x
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                                            {formatRelativeTime(memory.createdAt)}
                                        </Text>
                                    </View>

                                    <Text style={[styles.memoryDescription, { color: colors.text }]}>
                                        {memory.description}
                                    </Text>

                                    {memory.codeSnippet && (
                                        <View style={[styles.codeBlock, { backgroundColor: colors.background }]}>
                                            <Text style={[styles.codeText, { color: colors.text }]} numberOfLines={4}>
                                                {memory.codeSnippet}
                                            </Text>
                                        </View>
                                    )}

                                    <View style={styles.tagRow}>
                                        {memory.tags.map((tag) => (
                                            <View key={tag} style={[styles.tag, { backgroundColor: colors.background }]}>
                                                <Text style={[styles.tagText, { color: colors.textSecondary }]}>#{tag}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            );
                        })}
                    </>
                )}

                {activeTab === 'projects' && (
                    <>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Project Contexts</Text>
                        {projects.map((project) => (
                            <View
                                key={project.id}
                                style={[styles.projectCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                            >
                                <View style={styles.projectHeader}>
                                    <Ionicons name="folder-open-outline" size={24} color={colors.primary} />
                                    <View style={styles.projectInfo}>
                                        <Text style={[styles.projectName, { color: colors.text }]}>{project.name}</Text>
                                        <Text style={[styles.projectPath, { color: colors.textSecondary }]}>{project.path}</Text>
                                    </View>
                                </View>
                                <View style={styles.projectStats}>
                                    <View style={styles.projectStat}>
                                        <Text style={[styles.projectStatValue, { color: colors.text }]}>{project.memoriesCount}</Text>
                                        <Text style={[styles.projectStatLabel, { color: colors.textSecondary }]}>memories</Text>
                                    </View>
                                    <View style={[styles.langBadge, { backgroundColor: colors.background }]}>
                                        <Text style={[styles.langText, { color: colors.primary }]}>{project.language}</Text>
                                    </View>
                                    <Text style={[styles.projectDate, { color: colors.textSecondary }]}>
                                        {formatRelativeTime(project.lastAccessed)}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </>
                )}

                {activeTab === 'search' && (
                    <View style={styles.semanticSearch}>
                        <View style={[styles.searchCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={[styles.searchCardTitle, { color: colors.text }]}>Semantic Code Search</Text>
                            <Text style={[styles.searchCardDesc, { color: colors.textSecondary }]}>
                                Search your code memories using natural language queries. Find patterns, solutions, and debugging notes across all projects.
                            </Text>
                            <TextInput
                                style={[styles.semanticInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                placeholder="e.g., 'How do I handle async errors in React?'"
                                placeholderTextColor={colors.textSecondary}
                                multiline
                                numberOfLines={3}
                            />
                            <TouchableOpacity style={[styles.searchButton, { backgroundColor: colors.primary }]}>
                                <Ionicons name="search" size={18} color="#fff" />
                                <Text style={styles.searchButtonText}>Search Memories</Text>
                            </TouchableOpacity>
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
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 14,
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
    filterScroll: {
        maxHeight: 50,
        paddingHorizontal: 12,
        marginTop: 8,
    },
    filterRow: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 4,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
    },
    filterChipText: {
        fontSize: 12,
        fontWeight: '500',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    memoryCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        marginBottom: 12,
    },
    memoryHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 10,
    },
    typeIcon: {
        width: 36,
        height: 36,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    memoryInfo: {
        flex: 1,
    },
    memoryTitle: {
        fontSize: 14,
        fontWeight: '600',
    },
    memoryMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
    },
    langBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    langText: {
        fontSize: 10,
        fontWeight: '600',
    },
    useCount: {
        fontSize: 11,
    },
    timestamp: {
        fontSize: 11,
    },
    memoryDescription: {
        fontSize: 13,
        lineHeight: 19,
        marginBottom: 10,
    },
    codeBlock: {
        padding: 12,
        borderRadius: 8,
        marginBottom: 10,
    },
    codeText: {
        fontFamily: 'monospace',
        fontSize: 11,
        lineHeight: 16,
    },
    tagRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    tag: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
    },
    tagText: {
        fontSize: 11,
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
    projectInfo: {
        flex: 1,
    },
    projectName: {
        fontSize: 15,
        fontWeight: '600',
    },
    projectPath: {
        fontSize: 11,
        marginTop: 2,
    },
    projectStats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    projectStat: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
    },
    projectStatValue: {
        fontSize: 16,
        fontWeight: '700',
    },
    projectStatLabel: {
        fontSize: 11,
    },
    projectDate: {
        fontSize: 11,
        marginLeft: 'auto',
    },
    semanticSearch: {
        flex: 1,
    },
    searchCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 20,
    },
    searchCardTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
    },
    searchCardDesc: {
        fontSize: 13,
        lineHeight: 20,
        marginBottom: 16,
    },
    semanticInput: {
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        fontSize: 14,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    searchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 14,
        borderRadius: 8,
        marginTop: 12,
    },
    searchButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
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

export default SWEScreen;
