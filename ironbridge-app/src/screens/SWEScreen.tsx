// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { swe as sweApi } from '../api/sessions';
import type { SweMemory, SweProject } from '../api/sessions';

/**
 * Icons for the memory categories the server is known to emit.
 *
 * Looked up through {@link categoryStyle} rather than indexed directly: the
 * server does not constrain `category` to this set, and an unrecognised value
 * must render rather than crash on `undefined.icon`.
 */
const typeConfig: Record<string, { icon: string; color: string; label: string }> = {
    solution: { icon: 'bulb-outline', color: '#10b981', label: 'Solution' },
    pattern: { icon: 'git-branch-outline', color: '#3b82f6', label: 'Pattern' },
    debug: { icon: 'bug-outline', color: '#f59e0b', label: 'Debug' },
    review: { icon: 'eye-outline', color: '#8b5cf6', label: 'Review' },
    architecture: { icon: 'construct-outline', color: '#ec4899', label: 'Architecture' },
    convention: { icon: 'list-outline', color: '#14b8a6', label: 'Convention' },
};

const FALLBACK_CATEGORY = { icon: 'document-text-outline', color: '#6b7280', label: 'Other' };

function categoryStyle(category: string) {
    return typeConfig[category?.toLowerCase()] ?? {
        ...FALLBACK_CATEGORY,
        label: category || FALLBACK_CATEGORY.label,
    };
}

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
    // Both were seeded from `sampleMemories` / `sampleProjects`: invented
    // records about invented repositories, shown as this user's project
    // context. They now come from `/api/swe/*`, and the screen's types were
    // rewritten to match what the server actually stores -- a memory is a
    // key/value pair with a category and an access count, not the title, tags
    // and code snippet the fixture described.
    const [memories, setMemories] = useState<SweMemory[]>([]);
    const [projects, setProjects] = useState<SweProject[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            const projectList = await sweApi.projects();
            setProjects(projectList);

            // Memory is per-project; the screen shows one combined list, so
            // every project's memory is fetched and merged. A project whose
            // memory cannot be read is skipped rather than failing the lot.
            const perProject = await Promise.all(
                projectList.map(p => sweApi.memory(p.id).catch(() => [] as SweMemory[]))
            );
            setMemories(perProject.flat());
            setLoadError(null);
        } catch (err) {
            setProjects([]);
            setMemories([]);
            setLoadError(err instanceof Error ? err.message : 'Could not reach the IronBridge server');
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    /** Categories actually present, so the filter row cannot offer an empty one. */
    const categories = useMemo(
        () => Array.from(new Set(memories.map(m => m.category).filter(Boolean))).sort(),
        [memories]
    );

    const memoriesPerProject = useMemo(() => {
        const counts = new Map<string, number>();
        for (const m of memories) counts.set(m.projectId, (counts.get(m.projectId) ?? 0) + 1);
        return counts;
    }, [memories]);

    const filteredMemories = useMemo(() => {
        let result = memories;
        if (filterType !== 'all') {
            result = result.filter(m => m.category === filterType);
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(m =>
                m.key.toLowerCase().includes(q) ||
                m.value.toLowerCase().includes(q) ||
                m.category.toLowerCase().includes(q)
            );
        }
        return result;
    }, [memories, filterType, searchQuery]);

    const stats = useMemo(() => ({
        total: memories.length,
        solutions: memories.filter(m => m.category === 'solution').length,
        patterns: memories.filter(m => m.category === 'pattern').length,
        totalUses: memories.reduce((sum, m) => sum + m.accessCount, 0),
    }), [memories]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await load();
        } finally {
            setIsRefreshing(false);
        }
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
                        {/* Built from the categories present rather than a fixed
                            list, so the row cannot offer a filter that matches
                            nothing or omit one the server actually uses. */}
                        {['all', ...categories].map((type) => (
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
                        {filteredMemories.length === 0 && (
                            <View style={[styles.memoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Text style={{ color: colors.textSecondary }}>
                                    {loadError
                                        ? `Project context unavailable: ${loadError}`
                                        : memories.length === 0
                                            ? 'No project memory recorded yet.'
                                            : 'No memory matches this filter.'}
                                </Text>
                            </View>
                        )}
                        {filteredMemories.map((memory) => {
                            const typeStyle = categoryStyle(memory.category);

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
                                            <Text style={[styles.memoryTitle, { color: colors.text }]}>{memory.key}</Text>
                                            <View style={styles.memoryMeta}>
                                                <View style={[styles.langBadge, { backgroundColor: `${typeStyle.color}20` }]}>
                                                    <Text style={[styles.langText, { color: typeStyle.color }]}>
                                                        {typeStyle.label}
                                                    </Text>
                                                </View>
                                                {/* `accessCount`, not an invented "useCount". */}
                                                <Text style={[styles.useCount, { color: colors.textSecondary }]}>
                                                    Used {memory.accessCount}x
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                                            {formatRelativeTime(new Date(memory.createdAt).toISOString())}
                                        </Text>
                                    </View>

                                    <Text style={[styles.memoryDescription, { color: colors.text }]}>
                                        {memory.value}
                                    </Text>

                                    {/* No tag row and no code block: the server stores neither
                                        for a memory, so both could only ever have rendered the
                                        fixture's invention. */}
                                </View>
                            );
                        })}
                    </>
                )}

                {activeTab === 'projects' && (
                    <>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Project Contexts</Text>
                        {projects.length === 0 && (
                            <View style={[styles.projectCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Text style={{ color: colors.textSecondary }}>
                                    {loadError
                                        ? `Projects unavailable: ${loadError}`
                                        : 'No SWE projects registered.'}
                                </Text>
                            </View>
                        )}
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
                                        {/* Counted from the memory actually fetched, rather
                                            than a `memoriesCount` the server does not send. */}
                                        <Text style={[styles.projectStatValue, { color: colors.text }]}>
                                            {memoriesPerProject.get(project.id) ?? 0}
                                        </Text>
                                        <Text style={[styles.projectStatLabel, { color: colors.textSecondary }]}>memories</Text>
                                    </View>
                                    {project.language && (
                                        <View style={[styles.langBadge, {
                                            backgroundColor: `${languageColors[project.language.toLowerCase()] ?? colors.primary}20`
                                        }]}>
                                            <Text style={[styles.langText, {
                                                color: languageColors[project.language.toLowerCase()] ?? colors.primary
                                            }]}>
                                                {project.language}
                                            </Text>
                                        </View>
                                    )}
                                    <Text style={[styles.projectDate, { color: colors.textSecondary }]}>
                                        {formatRelativeTime(new Date(project.lastOpened).toISOString())}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </>
                )}

                {activeTab === 'search' && (
                    <View style={styles.semanticSearch}>
                        <View style={[styles.searchCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            {/* Was titled "Semantic Code Search" and promised natural-language
                                queries. There is no embedding search behind this screen, and
                                the button had no onPress at all -- pressing it did nothing,
                                silently. It now runs the same substring match the Memories tab
                                uses, and says that is what it does. */}
                            <Text style={[styles.searchCardTitle, { color: colors.text }]}>Search project memory</Text>
                            <Text style={[styles.searchCardDesc, { color: colors.textSecondary }]}>
                                Matches text in a memory's key, value or category across all
                                projects. This is a substring match, not a semantic one.
                            </Text>
                            <TextInput
                                style={[styles.semanticInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                placeholder="e.g. 'retry' or 'async'"
                                placeholderTextColor={colors.textSecondary}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                multiline
                                numberOfLines={3}
                            />
                            <TouchableOpacity
                                style={[styles.searchButton, { backgroundColor: colors.primary }]}
                                onPress={() => {
                                    setFilterType('all');
                                    setActiveTab('memories');
                                }}
                            >
                                <Ionicons name="search" size={18} color="#fff" />
                                <Text style={styles.searchButtonText}>
                                    {searchQuery
                                        ? `Show ${filteredMemories.length} match${filteredMemories.length === 1 ? '' : 'es'}`
                                        : 'Search Memories'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* No floating "add" button. It had no onPress: it was a button that
                did nothing when pressed. Creating a memory needs a project
                picker and a key/value form against
                POST /api/swe/projects/{id}/memory, which is not built. */}
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
});

export default SWEScreen;
