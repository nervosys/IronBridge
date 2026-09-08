// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { research as researchApi, type Paper } from '../api/research';

// Papers come from /api/research, which proxies arXiv.
//
// Two fixtures used to sit here. `samplePapers` carried a `citations` count
// and a `saved` flag; `sampleTrends` carried topics with paper counts and
// month-over-month growth percentages. arXiv reports no citation count and
// nothing resembling a trend, so both are gone rather than fed from something
// invented -- and the Trends tab with them.

export function ResearchScreen() {
    const { colors } = useTheme();
    const [activeTab, setActiveTab] = useState<'papers' | 'saved'>('papers');
    const [results, setResults] = useState<Paper[] | null>(null);
    const [totalResults, setTotalResults] = useState(0);
    const [saved, setSaved] = useState<Paper[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const savedIds = useMemo(() => new Set(saved.map(p => p.arxivId)), [saved]);
    const papers = activeTab === 'saved' ? saved : results ?? [];

    const loadSaved = useCallback(async () => {
        try {
            setSaved(await researchApi.saved());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not reach the server.');
        }
    }, []);

    useEffect(() => {
        loadSaved();
    }, [loadSaved]);

    /**
     * Search arXiv.
     *
     * On demand rather than as you type: arXiv asks that clients not poll it,
     * and a request per keystroke is exactly that.
     */
    const runSearch = async () => {
        if (!searchQuery.trim() || isSearching) return;
        setIsSearching(true);
        setError(null);
        setResults(null);
        try {
            const answer = await researchApi.search(searchQuery, 25);
            setResults(answer.results);
            setTotalResults(answer.totalResults);
        } catch (err) {
            // An unreachable arXiv and a query with no hits are different
            // answers, so a failure is shown rather than drawn as no results.
            setError(err instanceof Error ? err.message : 'The search failed.');
        } finally {
            setIsSearching(false);
        }
    };

    /**
     * Pull to refresh re-reads the saved list.
     *
     * It used to be `setTimeout(..., 1000)`: a spinner that ran for a second
     * and reloaded nothing. Searches are not re-run -- that would be a request
     * to arXiv the user did not ask for.
     */
    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadSaved();
        setIsRefreshing(false);
    };

    /**
     * Save or unsave, on the server.
     *
     * This used to flip a field in component state, which was discarded on
     * unmount -- the bookmark filled in, and nothing was saved.
     */
    const handleToggleSave = async (paper: Paper) => {
        setError(null);
        try {
            if (savedIds.has(paper.arxivId)) {
                await researchApi.unsave(paper.arxivId);
            } else {
                await researchApi.save(paper);
            }
            await loadSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not update your saved papers.');
        }
    };

    const handleOpenPaper = (paper: Paper) => {
        Linking.openURL(paper.url);
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Stats
              *
              * Two, where there were four. "Topics" counted distinct
              * categories across a fixture list, and "This Week" counted its
              * publication dates -- both were statistics about eight built-in
              * papers, not about anything of the user's. What is left is the
              * result count arXiv reports and the number of papers actually
              * saved on the server.
              */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="library-outline" size={18} color={colors.primary} />
                    <Text style={[styles.statValue, { color: colors.text }]}>
                        {results === null ? '—' : totalResults.toLocaleString()}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Matches</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="bookmark-outline" size={18} color="#f59e0b" />
                    <Text style={[styles.statValue, { color: '#f59e0b' }]}>{saved.length}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Saved</Text>
                </View>
            </View>

            {error && (
                <View style={[styles.paperCard, { backgroundColor: colors.card, borderColor: '#ef4444' }]}>
                    <Text style={[styles.paperAuthors, { color: colors.textSecondary }]}>{error}</Text>
                </View>
            )}

            {/* Search */}
            <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
                <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search arXiv..."
                    placeholderTextColor={colors.textSecondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={runSearch}
                    returnKeyType="search"
                />
                <TouchableOpacity onPress={runSearch} disabled={!searchQuery.trim() || isSearching}>
                    <Ionicons
                        name={isSearching ? 'hourglass-outline' : 'arrow-forward-circle'}
                        size={22}
                        color={searchQuery.trim() ? colors.primary : colors.textSecondary}
                    />
                </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabBar}>
                {(['papers', 'saved'] as const).map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, { borderBottomColor: activeTab === tab ? colors.primary : 'transparent' }]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Ionicons
                            name={tab === 'papers' ? 'document-text-outline' : 'bookmark-outline'}
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
                <>
                    {papers.map((paper) => (
                        <TouchableOpacity
                            key={paper.arxivId}
                            style={[styles.paperCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                            onPress={() => handleOpenPaper(paper)}
                        >
                            <View style={styles.paperHeader}>
                                <View style={styles.paperTitleRow}>
                                    <Text style={[styles.paperTitle, { color: colors.text }]} numberOfLines={2}>
                                        {paper.title}
                                    </Text>
                                    <TouchableOpacity onPress={() => handleToggleSave(paper)}>
                                        <Ionicons
                                            name={savedIds.has(paper.arxivId) ? 'bookmark' : 'bookmark-outline'}
                                            size={22}
                                            color={savedIds.has(paper.arxivId) ? '#f59e0b' : colors.textSecondary}
                                        />
                                    </TouchableOpacity>
                                </View>
                                <Text style={[styles.paperAuthors, { color: colors.textSecondary }]}>
                                    {paper.authors.length > 3
                                        ? `${paper.authors.slice(0, 3).join(', ')} +${paper.authors.length - 3}`
                                        : paper.authors.join(', ')}
                                </Text>
                            </View>

                            <Text style={[styles.paperAbstract, { color: colors.text }]} numberOfLines={3}>
                                {paper.summary}
                            </Text>

                            <View style={styles.paperMeta}>
                                <View style={styles.categoryTags}>
                                    {paper.categories.slice(0, 3).map((cat) => (
                                        <View key={cat} style={[styles.categoryTag, { backgroundColor: colors.background }]}>
                                            <Text style={[styles.categoryText, { color: colors.primary }]}>{cat}</Text>
                                        </View>
                                    ))}
                                </View>
                                {/*
                                  * No citation count. arXiv does not report
                                  * one, and the number that used to sit here
                                  * came from a literal.
                                  */}
                                <Text style={[styles.paperDate, { color: colors.textSecondary }]}>
                                    {paper.published.slice(0, 10)}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))}

                    {papers.length === 0 && (
                        <View style={styles.emptyState}>
                            <Ionicons name="document-outline" size={48} color={colors.textSecondary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                {activeTab === 'saved'
                                    ? 'No saved papers yet'
                                    : results === null
                                        ? 'Search arXiv to see papers'
                                        : 'arXiv returned no papers for that search'}
                            </Text>
                        </View>
                    )}
                </>

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
});

export default ResearchScreen;
