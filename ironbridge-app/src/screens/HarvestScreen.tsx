// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Alert,
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { stats as statsApi } from '../api/sessions';
import type { Stats } from '../api/sessions';

interface ShareLink {
    id: string;
    url: string;
    provider: string;
    status: 'pending' | 'imported' | 'error';
    addedAt: string;
}

// Detect provider from share URL
function detectProvider(url: string): string {
    if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) return 'ChatGPT';
    if (url.includes('claude.ai')) return 'Claude';
    if (url.includes('gemini.google.com') || url.includes('g.co/gemini')) return 'Gemini';
    if (url.includes('perplexity.ai')) return 'Perplexity';
    if (url.includes('poe.com')) return 'Poe';
    return 'Unknown';
}

/// Shown in a stat card when the number is not known yet, or could not be
/// fetched. Deliberately not `0`: a zero is a claim about the database, and
/// "we could not reach the server" is not the same as "you have no sessions".
const UNKNOWN = '—';

export function HarvestScreen() {
    const { colors } = useTheme();
    const [shareUrl, setShareUrl] = useState('');
    const [pendingShares, setPendingShares] = useState<ShareLink[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // These used to be `mockHarvestStats` and `mockProviderDistribution`:
    // hard-coded constants -- 156 sessions, 4,523 messages, 22.6 MB, "2h ago"
    // -- rendered as though they were this user's data, with no API call
    // behind them and no demo-mode flag gating them. The root README states
    // the policy for ironbridge-web ("an empty or failing backend renders as empty
    // or as an error, never as fixtures"); the mobile app did not follow it.
    const [harvestStats, setHarvestStats] = useState<Stats | null>(null);
    const [statsError, setStatsError] = useState<string | null>(null);

    const loadStats = useCallback(async () => {
        try {
            setHarvestStats(await statsApi.overview());
            setStatsError(null);
        } catch (err) {
            setHarvestStats(null);
            setStatsError(
                err instanceof Error ? err.message : 'Could not reach the IronBridge server'
            );
        }
    }, []);

    useEffect(() => {
        void loadStats();
    }, [loadStats]);

    const providerDistribution: [string, number][] = (harvestStats?.sessionsByProvider ?? [])
        .map(({ provider, count }) => [provider, count] as [string, number])
        .sort((a, b) => b[1] - a[1]);

    const handleAddShare = () => {
        if (!shareUrl.trim()) return;

        const provider = detectProvider(shareUrl);
        if (provider === 'Unknown') {
            Alert.alert('Unknown Provider', 'Could not detect the provider from this URL');
            return;
        }

        const newShare: ShareLink = {
            id: Date.now().toString(),
            url: shareUrl.trim(),
            provider,
            status: 'pending',
            addedAt: new Date().toISOString(),
        };

        setPendingShares([newShare, ...pendingShares]);
        setShareUrl('');
    };

    const handleImportShare = (share: ShareLink) => {
        setPendingShares(prev =>
            prev.map(s => s.id === share.id ? { ...s, status: 'imported' as const } : s)
        );
        Alert.alert('Import Started', `Importing from ${share.provider}...`);
    };

    const handleRemoveShare = (id: string) => {
        setPendingShares(prev => prev.filter(s => s.id !== id));
    };

    // Was `setTimeout(() => setIsRefreshing(false), 1000)` -- a spinner that
    // ran for a second and reloaded nothing, so pulling to refresh looked like
    // it had fetched fresh data and had not.
    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await loadStats();
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleHarvest = () => {
        Alert.alert(
            'Harvest Sessions',
            'This will scan all configured sources for new chat sessions.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Harvest', onPress: () => {
                        Alert.alert('Harvesting', 'Scanning for new sessions...');
                        handleRefresh();
                    }
                },
            ]
        );
    };

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            refreshControl={
                <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
            }
        >
            {/* Stats Cards */}
            <View style={styles.statsGrid}>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="chatbubbles-outline" size={24} color={colors.primary} />
                    <Text style={[styles.statValue, { color: colors.text }]}>
                        {harvestStats ? harvestStats.totalSessions.toLocaleString() : UNKNOWN}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Sessions</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="chatbox-outline" size={24} color="#10b981" />
                    <Text style={[styles.statValue, { color: colors.text }]}>
                        {harvestStats ? harvestStats.totalMessages.toLocaleString() : UNKNOWN}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Messages</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="folder-outline" size={24} color="#f59e0b" />
                    <Text style={[styles.statValue, { color: colors.text }]}>
                        {harvestStats ? harvestStats.totalWorkspaces.toLocaleString() : UNKNOWN}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Workspaces</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="server-outline" size={24} color="#8b5cf6" />
                    <Text style={[styles.statValue, { color: colors.text }]}>
                        {/* Counted from the distribution rather than read from
                            `totalProviders`, which the shared type marks
                            optional -- the two cannot disagree this way. */}
                        {harvestStats ? providerDistribution.length.toLocaleString() : UNKNOWN}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Providers</Text>
                </View>
            </View>

            {statsError && (
                <View style={[styles.statsError, { borderColor: colors.border }]}>
                    <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                    <Text style={[styles.statsErrorText, { color: colors.textSecondary }]}>
                        Statistics unavailable: {statsError}
                    </Text>
                </View>
            )}

            {/* Harvest Button */}
            <TouchableOpacity
                style={[styles.harvestButton, { backgroundColor: colors.primary }]}
                onPress={handleHarvest}
            >
                <Ionicons name="sync-outline" size={20} color="#fff" />
                <Text style={styles.harvestButtonText}>Harvest All Sources</Text>
            </TouchableOpacity>

            {/* Share Link Import */}
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    <Ionicons name="link-outline" size={18} color={colors.text} /> Import Share Link
                </Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                    Paste a share link from ChatGPT, Claude, Gemini, etc.
                </Text>

                <View style={styles.inputRow}>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                        placeholder="https://chat.openai.com/share/..."
                        placeholderTextColor={colors.textSecondary}
                        value={shareUrl}
                        onChangeText={setShareUrl}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: colors.primary }]}
                        onPress={handleAddShare}
                    >
                        <Ionicons name="add" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Pending Shares */}
                {pendingShares.length > 0 && (
                    <View style={styles.sharesList}>
                        {pendingShares.map((share) => (
                            <View
                                key={share.id}
                                style={[styles.shareItem, { borderColor: colors.border }]}
                            >
                                <View style={styles.shareInfo}>
                                    <View style={[styles.providerBadge, {
                                        backgroundColor: share.provider === 'ChatGPT' ? '#10a37f20' :
                                            share.provider === 'Claude' ? '#d4a57420' :
                                                share.provider === 'Gemini' ? '#4285f420' :
                                                    colors.border
                                    }]}>
                                        <Text style={[styles.providerText, {
                                            color: share.provider === 'ChatGPT' ? '#10a37f' :
                                                share.provider === 'Claude' ? '#d4a574' :
                                                    share.provider === 'Gemini' ? '#4285f4' :
                                                        colors.textSecondary
                                        }]}>
                                            {share.provider}
                                        </Text>
                                    </View>
                                    <Text style={[styles.shareUrl, { color: colors.textSecondary }]} numberOfLines={1}>
                                        {share.url}
                                    </Text>
                                </View>
                                <View style={styles.shareActions}>
                                    {share.status === 'pending' && (
                                        <TouchableOpacity onPress={() => handleImportShare(share)}>
                                            <Ionicons name="download-outline" size={20} color={colors.primary} />
                                        </TouchableOpacity>
                                    )}
                                    {share.status === 'imported' && (
                                        <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                                    )}
                                    <TouchableOpacity onPress={() => handleRemoveShare(share.id)}>
                                        <Ionicons name="close-circle-outline" size={20} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </View>

            {/* Provider Distribution */}
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    <Ionicons name="pie-chart-outline" size={18} color={colors.text} /> Provider Distribution
                </Text>
                {providerDistribution.length === 0 && (
                    <Text style={[styles.distributionLabel, { color: colors.textSecondary }]}>
                        {statsError
                            ? 'Unavailable while the server cannot be reached.'
                            : 'No sessions harvested yet.'}
                    </Text>
                )}
                {providerDistribution.map(([provider, count]) => (
                    <View key={provider} style={styles.distributionItem}>
                        <Text style={[styles.distributionLabel, { color: colors.text }]}>{provider}</Text>
                        <View style={styles.distributionBarContainer}>
                            <View
                                style={[styles.distributionBar, {
                                    // Scaled against the largest provider, not
                                    // the session total: a session can be
                                    // counted under more than one provider, so
                                    // the shares need not sum to the total and
                                    // a bar could otherwise overflow its track.
                                    width: `${(count / Math.max(...providerDistribution.map(p => p[1]))) * 100}%`,
                                    backgroundColor: colors.primary,
                                }]}
                            />
                        </View>
                        <Text style={[styles.distributionCount, { color: colors.textSecondary }]}>{count}</Text>
                    </View>
                ))}
            </View>

            {/* Data Sources */}
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    <Ionicons name="folder-outline" size={18} color={colors.text} /> Data Sources
                </Text>
                {[
                    { name: 'VS Code Copilot', icon: 'code-slash-outline' as const, status: 'connected' },
                    { name: 'ChatGPT Export', icon: 'cloud-download-outline' as const, status: 'ready' },
                    { name: 'Claude Export', icon: 'cloud-download-outline' as const, status: 'ready' },
                    { name: 'Local SQLite', icon: 'server-outline' as const, status: 'connected' },
                ].map((source) => (
                    <View key={source.name} style={styles.sourceItem}>
                        <Ionicons name={source.icon} size={20} color={colors.textSecondary} />
                        <Text style={[styles.sourceName, { color: colors.text }]}>{source.name}</Text>
                        <View style={[styles.statusBadge, {
                            backgroundColor: source.status === 'connected' ? '#10b98120' : colors.border
                        }]}>
                            <Text style={[styles.statusText, {
                                color: source.status === 'connected' ? '#10b981' : colors.textSecondary
                            }]}>
                                {source.status}
                            </Text>
                        </View>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
    },
    statsError: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginBottom: 16,
    },
    statsErrorText: {
        flex: 1,
        fontSize: 12,
    },
    statCard: {
        flex: 1,
        minWidth: '45%',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        marginTop: 8,
    },
    statLabel: {
        fontSize: 12,
        marginTop: 4,
    },
    harvestButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        gap: 8,
    },
    harvestButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    section: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 13,
        marginBottom: 12,
    },
    inputRow: {
        flexDirection: 'row',
        gap: 8,
    },
    input: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        fontSize: 14,
    },
    addButton: {
        width: 48,
        height: 48,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sharesList: {
        marginTop: 12,
    },
    shareItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderTopWidth: 1,
    },
    shareInfo: {
        flex: 1,
    },
    providerBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginBottom: 4,
    },
    providerText: {
        fontSize: 11,
        fontWeight: '600',
    },
    shareUrl: {
        fontSize: 12,
    },
    shareActions: {
        flexDirection: 'row',
        gap: 12,
    },
    distributionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    distributionLabel: {
        width: 100,
        fontSize: 13,
    },
    distributionBarContainer: {
        flex: 1,
        height: 8,
        backgroundColor: '#333',
        borderRadius: 4,
        marginHorizontal: 8,
    },
    distributionBar: {
        height: '100%',
        borderRadius: 4,
    },
    distributionCount: {
        width: 30,
        fontSize: 13,
        textAlign: 'right',
    },
    sourceItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        gap: 12,
    },
    sourceName: {
        flex: 1,
        fontSize: 14,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '500',
        textTransform: 'capitalize',
    },
});

export default HarvestScreen;
