// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    TextInput,
    Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface Paper {
    id: string;
    title: string;
    authors: string[];
    abstract: string;
    categories: string[];
    published: string;
    arxivId: string;
    citations?: number;
    saved: boolean;
}

interface Trend {
    topic: string;
    papers: number;
    growth: number; // percentage
    keywords: string[];
}

const samplePapers: Paper[] = [
    {
        id: '1',
        title: 'Constitutional AI: Harmlessness from AI Feedback',
        authors: ['Yuntao Bai', 'et al.'],
        abstract: 'We introduce Constitutional AI (CAI), a method for training AI assistants to be helpful, harmless, and honest using a set of principles (a "constitution") to self-improve...',
        categories: ['cs.AI', 'cs.CL'],
        published: '2024-12-10',
        arxivId: '2212.08073',
        citations: 1245,
        saved: true,
    },
    {
        id: '2',
        title: 'Agent-Computer Interface: Designing Effective Human-AI Interaction',
        authors: ['Research Team'],
        abstract: 'We present a comprehensive study on designing effective interfaces between autonomous AI agents and human operators, focusing on transparency and control...',
        categories: ['cs.HC', 'cs.AI'],
        published: '2024-12-08',
        arxivId: '2412.04567',
        citations: 89,
        saved: false,
    },
    {
        id: '3',
        title: 'Retrieval-Augmented Generation for Knowledge-Intensive Tasks',
        authors: ['Patrick Lewis', 'et al.'],
        abstract: 'We explore the use of retrieval-augmented generation models that combine pre-trained parametric and non-parametric memory for language generation...',
        categories: ['cs.CL', 'cs.IR'],
        published: '2024-12-05',
        arxivId: '2005.11401',
        citations: 3421,
        saved: true,
    },
    {
        id: '4',
        title: 'Multi-Agent Collaboration: A Survey',
        authors: ['Survey Authors'],
        abstract: 'This survey provides a comprehensive overview of multi-agent collaboration techniques in the era of large language models, covering cooperation, competition...',
        categories: ['cs.MA', 'cs.AI'],
        published: '2024-12-01',
        arxivId: '2412.00123',
        citations: 156,
        saved: false,
    },
];

const sampleTrends: Trend[] = [
    { topic: 'Multi-Agent Systems', papers: 234, growth: 45, keywords: ['collaboration', 'orchestration', 'MAS'] },
    { topic: 'RAG & Retrieval', papers: 189, growth: 32, keywords: ['vector search', 'embeddings', 'context'] },
    { topic: 'AI Safety', papers: 167, growth: 28, keywords: ['alignment', 'harmlessness', 'RLHF'] },
    { topic: 'Tool Use', papers: 145, growth: 52, keywords: ['function calling', 'MCP', 'agents'] },
    { topic: 'Code Generation', papers: 128, growth: 18, keywords: ['copilot', 'codex', 'agentic coding'] },
];

export function ResearchScreen() {
    const { colors } = useTheme();
    const [activeTab, setActiveTab] = useState<'papers' | 'trends' | 'saved'>('papers');
    const [papers, setPapers] = useState<Paper[]>(samplePapers);
    const [searchQuery, setSearchQuery] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const filteredPapers = useMemo(() => {
        let result = papers;
        if (activeTab === 'saved') {
            result = papers.filter(p => p.saved);
        }
        if (searchQuery) {
            result = result.filter(p =>
                p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.abstract.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return result;
    }, [papers, activeTab, searchQuery]);

    const stats = useMemo(() => ({
        total: papers.length,
        saved: papers.filter(p => p.saved).length,
        categories: Array.from(new Set(papers.flatMap(p => p.categories))).length,
        thisWeek: papers.filter(p => {
            const pubDate = new Date(p.published);
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            return pubDate > weekAgo;
        }).length,
    }), [papers]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 1000);
    };

    const handleToggleSave = (id: string) => {
        setPapers(prev => prev.map(p =>
            p.id === id ? { ...p, saved: !p.saved } : p
        ));
    };

    const handleOpenPaper = (arxivId: string) => {
        Linking.openURL(`https://arxiv.org/abs/${arxivId}`);
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Stats */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="library-outline" size={18} color={colors.primary} />
                    <Text style={[styles.statValue, { color: colors.text }]}>{stats.total}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Papers</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="bookmark-outline" size={18} color="#f59e0b" />
                    <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.saved}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Saved</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="pricetag-outline" size={18} color="#10b981" />
                    <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.categories}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Topics</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="calendar-outline" size={18} color="#8b5cf6" />
                    <Text style={[styles.statValue, { color: '#8b5cf6' }]}>{stats.thisWeek}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>This Week</Text>
                </View>
            </View>

            {/* Search */}
            <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
                <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search papers..."
                    placeholderTextColor={colors.textSecondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {/* Tabs */}
            <View style={styles.tabBar}>
                {(['papers', 'trends', 'saved'] as const).map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, { borderBottomColor: activeTab === tab ? colors.primary : 'transparent' }]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Ionicons
                            name={tab === 'papers' ? 'document-text-outline' : tab === 'trends' ? 'trending-up-outline' : 'bookmark-outline'}
                            size={18}
                            color={activeTab === tab ? colors.primary : colors.textSecondary}
                        />
                        <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.textSecondary }]}>
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
                {(activeTab === 'papers' || activeTab === 'saved') && (
                    <>
                        {filteredPapers.map((paper) => (
                            <TouchableOpacity
                                key={paper.id}
                                style={[styles.paperCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                                onPress={() => handleOpenPaper(paper.arxivId)}
                            >
                                <View style={styles.paperHeader}>
                                    <View style={styles.paperTitleRow}>
                                        <Text style={[styles.paperTitle, { color: colors.text }]} numberOfLines={2}>
                                            {paper.title}
                                        </Text>
                                        <TouchableOpacity onPress={() => handleToggleSave(paper.id)}>
                                            <Ionicons
                                                name={paper.saved ? 'bookmark' : 'bookmark-outline'}
                                                size={22}
                                                color={paper.saved ? '#f59e0b' : colors.textSecondary}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={[styles.paperAuthors, { color: colors.textSecondary }]}>
                                        {paper.authors.join(', ')}
                                    </Text>
                                </View>

                                <Text style={[styles.paperAbstract, { color: colors.text }]} numberOfLines={3}>
                                    {paper.abstract}
                                </Text>

                                <View style={styles.paperMeta}>
                                    <View style={styles.categoryTags}>
                                        {paper.categories.map((cat) => (
                                            <View key={cat} style={[styles.categoryTag, { backgroundColor: colors.background }]}>
                                                <Text style={[styles.categoryText, { color: colors.primary }]}>{cat}</Text>
                                            </View>
                                        ))}
                                    </View>
                                    <View style={styles.paperStats}>
                                        {paper.citations && (
                                            <View style={styles.paperStat}>
                                                <Ionicons name="chatbubble-outline" size={12} color={colors.textSecondary} />
                                                <Text style={[styles.paperStatText, { color: colors.textSecondary }]}>
                                                    {paper.citations}
                                                </Text>
                                            </View>
                                        )}
                                        <Text style={[styles.paperDate, { color: colors.textSecondary }]}>{paper.published}</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))}

                        {filteredPapers.length === 0 && (
                            <View style={styles.emptyState}>
                                <Ionicons name="document-outline" size={48} color={colors.textSecondary} />
                                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                    {activeTab === 'saved' ? 'No saved papers yet' : 'No papers found'}
                                </Text>
                            </View>
                        )}
                    </>
                )}

                {activeTab === 'trends' && (
                    <>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Trending Topics</Text>
                        {sampleTrends.map((trend, idx) => (
                            <View
                                key={trend.topic}
                                style={[styles.trendCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                            >
                                <View style={styles.trendHeader}>
                                    <View style={styles.trendRank}>
                                        <Text style={[styles.rankNumber, { color: colors.primary }]}>#{idx + 1}</Text>
                                    </View>
                                    <View style={styles.trendInfo}>
                                        <Text style={[styles.trendTopic, { color: colors.text }]}>{trend.topic}</Text>
                                        <Text style={[styles.trendPapers, { color: colors.textSecondary }]}>
                                            {trend.papers} papers this month
                                        </Text>
                                    </View>
                                    <View style={[styles.growthBadge, {
                                        backgroundColor: trend.growth > 30 ? '#10b98120' : '#3b82f620'
                                    }]}>
                                        <Ionicons name="trending-up" size={14} color={trend.growth > 30 ? '#10b981' : '#3b82f6'} />
                                        <Text style={[styles.growthText, {
                                            color: trend.growth > 30 ? '#10b981' : '#3b82f6'
                                        }]}>
                                            +{trend.growth}%
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.keywordTags}>
                                    {trend.keywords.map((kw) => (
                                        <View key={kw} style={[styles.keywordTag, { backgroundColor: colors.background }]}>
                                            <Text style={[styles.keywordText, { color: colors.text }]}>{kw}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        ))}
                    </>
                )}
            </ScrollView>
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
    content: {
        flex: 1,
        padding: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    paperCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        marginBottom: 12,
    },
    paperHeader: {
        marginBottom: 8,
    },
    paperTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
    },
    paperTitle: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        lineHeight: 22,
    },
    paperAuthors: {
        fontSize: 12,
        marginTop: 4,
    },
    paperAbstract: {
        fontSize: 13,
        lineHeight: 20,
        marginBottom: 12,
    },
    paperMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    categoryTags: {
        flexDirection: 'row',
        gap: 6,
    },
    categoryTag: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
    },
    categoryText: {
        fontSize: 10,
        fontWeight: '600',
    },
    paperStats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    paperStat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    paperStatText: {
        fontSize: 11,
    },
    paperDate: {
        fontSize: 11,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 14,
    },
    trendCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        marginBottom: 12,
    },
    trendHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    trendRank: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankNumber: {
        fontSize: 14,
        fontWeight: '700',
    },
    trendInfo: {
        flex: 1,
    },
    trendTopic: {
        fontSize: 15,
        fontWeight: '600',
    },
    trendPapers: {
        fontSize: 12,
        marginTop: 2,
    },
    growthBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    growthText: {
        fontSize: 12,
        fontWeight: '600',
    },
    keywordTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    keywordTag: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
    },
    keywordText: {
        fontSize: 11,
    },
});

export default ResearchScreen;
