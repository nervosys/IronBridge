// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface Protocol {
    id: string;
    name: string;
    fullName: string;
    version: string;
    status: 'active' | 'beta' | 'deprecated';
    category: 'agent' | 'tool' | 'memory' | 'auth';
    description: string;
    features: string[];
    docsUrl?: string;
    implementedFeatures: number;
    totalFeatures: number;
}

const protocols: Protocol[] = [
    {
        id: 'mcp',
        name: 'MCP',
        fullName: 'Model Context Protocol',
        version: '2024-11',
        status: 'active',
        category: 'tool',
        description: 'Anthropic\'s protocol for connecting AI models to external tools, data sources, and system capabilities.',
        features: ['Tool calling', 'Resource access', 'Prompts', 'Sampling', 'Roots'],
        docsUrl: 'https://modelcontextprotocol.io',
        implementedFeatures: 4,
        totalFeatures: 5,
    },
    {
        id: 'a2a',
        name: 'A2A',
        fullName: 'Agent-to-Agent Protocol',
        version: '1.0',
        status: 'active',
        category: 'agent',
        description: 'Google\'s protocol enabling AI agents to communicate, delegate tasks, and collaborate.',
        features: ['Agent discovery', 'Task delegation', 'Message passing', 'Capability negotiation'],
        docsUrl: 'https://github.com/google/A2A',
        implementedFeatures: 3,
        totalFeatures: 4,
    },
    {
        id: 'nanda',
        name: 'NANDA',
        fullName: 'Networked Agents for Decentralized Applications',
        version: '0.9',
        status: 'beta',
        category: 'agent',
        description: 'Decentralized protocol for agent coordination and task orchestration across networks.',
        features: ['Decentralized registry', 'Task marketplace', 'Reputation system', 'Payment rails'],
        implementedFeatures: 1,
        totalFeatures: 4,
    },
    {
        id: 'openai-tools',
        name: 'OpenAI Tools',
        fullName: 'OpenAI Function Calling',
        version: '1.0',
        status: 'active',
        category: 'tool',
        description: 'OpenAI\'s native function calling interface for GPT models.',
        features: ['Function definitions', 'Parallel calls', 'Structured outputs', 'JSON mode'],
        docsUrl: 'https://platform.openai.com/docs/guides/function-calling',
        implementedFeatures: 4,
        totalFeatures: 4,
    },
    {
        id: 'langchain-tools',
        name: 'LangChain Tools',
        fullName: 'LangChain Tool Interface',
        version: '0.1',
        status: 'active',
        category: 'tool',
        description: 'LangChain\'s standardized tool interface for building agent applications.',
        features: ['Tool wrappers', 'Toolkits', 'Agent types', 'Memory integration'],
        implementedFeatures: 3,
        totalFeatures: 4,
    },
    {
        id: 'mem0',
        name: 'Mem0',
        fullName: 'Memory Layer Protocol',
        version: '0.1',
        status: 'beta',
        category: 'memory',
        description: 'Protocol for managing persistent memory across AI agent sessions.',
        features: ['Semantic memory', 'Episodic memory', 'Working memory', 'Memory search'],
        implementedFeatures: 2,
        totalFeatures: 4,
    },
    {
        id: 'oauth2',
        name: 'OAuth 2.0',
        fullName: 'Open Authorization 2.0',
        version: '2.1',
        status: 'active',
        category: 'auth',
        description: 'Industry-standard protocol for authorization and API access.',
        features: ['Auth code flow', 'Client credentials', 'Refresh tokens', 'PKCE'],
        implementedFeatures: 4,
        totalFeatures: 4,
    },
];

const categoryConfig = {
    agent: { icon: 'people-outline', color: '#8b5cf6' },
    tool: { icon: 'construct-outline', color: '#3b82f6' },
    memory: { icon: 'hardware-chip-outline', color: '#10b981' },
    auth: { icon: 'lock-closed-outline', color: '#f59e0b' },
};

export function ProtocolsScreen() {
    const { colors, isDark } = useTheme();
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const filteredProtocols = useMemo(() => {
        if (filterCategory === 'all') return protocols;
        return protocols.filter(p => p.category === filterCategory);
    }, [filterCategory]);

    // Stats
    const stats = useMemo(() => {
        const implemented = protocols.reduce((sum, p) => sum + p.implementedFeatures, 0);
        const total = protocols.reduce((sum, p) => sum + p.totalFeatures, 0);
        return {
            total: protocols.length,
            active: protocols.filter(p => p.status === 'active').length,
            implemented,
            coverage: Math.round((implemented / total) * 100),
        };
    }, []);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 1000);
    };

    const handleOpenDocs = (url: string) => {
        Linking.openURL(url);
    };

    const getStatusStyle = (status: Protocol['status']) => {
        switch (status) {
            case 'active': return { bg: '#10b98120', color: '#10b981' };
            case 'beta': return { bg: '#f59e0b20', color: '#f59e0b' };
            case 'deprecated': return { bg: '#ef444420', color: '#ef4444' };
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header Stats */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.statValue, { color: colors.text }]}>{stats.total}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Protocols</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.active}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Active</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.statValue, { color: colors.primary }]}>{stats.coverage}%</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Coverage</Text>
                </View>
            </View>

            {/* Category Filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                <View style={styles.filterRow}>
                    {['all', 'agent', 'tool', 'memory', 'auth'].map((cat) => (
                        <TouchableOpacity
                            key={cat}
                            style={[
                                styles.filterChip,
                                {
                                    backgroundColor: filterCategory === cat ? colors.primary : colors.card,
                                    borderColor: colors.border,
                                }
                            ]}
                            onPress={() => setFilterCategory(cat)}
                        >
                            {cat !== 'all' && (
                                <Ionicons
                                    name={categoryConfig[cat as keyof typeof categoryConfig].icon as any}
                                    size={14}
                                    color={filterCategory === cat ? '#fff' : categoryConfig[cat as keyof typeof categoryConfig].color}
                                />
                            )}
                            <Text style={[
                                styles.filterChipText,
                                { color: filterCategory === cat ? '#fff' : colors.text }
                            ]}>
                                {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>

            {/* Protocol List */}
            <ScrollView
                style={styles.list}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
                }
            >
                {filteredProtocols.map((protocol) => {
                    const catConfig = categoryConfig[protocol.category];
                    const statusStyle = getStatusStyle(protocol.status);

                    return (
                        <View
                            key={protocol.id}
                            style={[styles.protocolCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                        >
                            <View style={styles.cardHeader}>
                                <View style={[styles.iconContainer, { backgroundColor: `${catConfig.color}20` }]}>
                                    <Ionicons name={catConfig.icon as any} size={24} color={catConfig.color} />
                                </View>
                                <View style={styles.titleContainer}>
                                    <View style={styles.titleRow}>
                                        <Text style={[styles.protocolName, { color: colors.text }]}>{protocol.name}</Text>
                                        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                                            <Text style={[styles.statusText, { color: statusStyle.color }]}>{protocol.status}</Text>
                                        </View>
                                    </View>
                                    <Text style={[styles.fullName, { color: colors.textSecondary }]}>{protocol.fullName}</Text>
                                    <Text style={[styles.version, { color: colors.textSecondary }]}>v{protocol.version}</Text>
                                </View>
                            </View>

                            <Text style={[styles.description, { color: colors.text }]}>{protocol.description}</Text>

                            {/* Features */}
                            <View style={styles.featuresSection}>
                                <Text style={[styles.featuresLabel, { color: colors.textSecondary }]}>
                                    Features ({protocol.implementedFeatures}/{protocol.totalFeatures})
                                </Text>
                                <View style={[styles.progressBar, { backgroundColor: colors.background }]}>
                                    <View
                                        style={[styles.progressFill, {
                                            width: `${(protocol.implementedFeatures / protocol.totalFeatures) * 100}%`,
                                            backgroundColor: catConfig.color,
                                        }]}
                                    />
                                </View>
                                <View style={styles.featureTags}>
                                    {protocol.features.map((feature, idx) => (
                                        <View
                                            key={feature}
                                            style={[styles.featureTag, {
                                                backgroundColor: idx < protocol.implementedFeatures
                                                    ? `${catConfig.color}20`
                                                    : colors.background,
                                            }]}
                                        >
                                            {idx < protocol.implementedFeatures && (
                                                <Ionicons name="checkmark" size={12} color={catConfig.color} />
                                            )}
                                            <Text style={[styles.featureText, {
                                                color: idx < protocol.implementedFeatures ? catConfig.color : colors.textSecondary,
                                            }]}>
                                                {feature}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>

                            {/* Actions */}
                            {protocol.docsUrl && (
                                <TouchableOpacity
                                    style={[styles.docsButton, { borderColor: colors.border }]}
                                    onPress={() => handleOpenDocs(protocol.docsUrl!)}
                                >
                                    <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                                    <Text style={[styles.docsButtonText, { color: colors.primary }]}>View Docs</Text>
                                    <Ionicons name="open-outline" size={14} color={colors.primary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    );
                })}
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
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
    },
    statLabel: {
        fontSize: 11,
        marginTop: 2,
    },
    filterScroll: {
        maxHeight: 50,
        paddingHorizontal: 12,
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
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    filterChipText: {
        fontSize: 13,
        fontWeight: '500',
    },
    list: {
        flex: 1,
        padding: 16,
    },
    protocolCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        marginBottom: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleContainer: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    protocolName: {
        fontSize: 18,
        fontWeight: '700',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    fullName: {
        fontSize: 12,
        marginTop: 2,
    },
    version: {
        fontSize: 11,
    },
    description: {
        fontSize: 13,
        lineHeight: 20,
        marginBottom: 12,
    },
    featuresSection: {
        marginBottom: 12,
    },
    featuresLabel: {
        fontSize: 11,
        marginBottom: 6,
    },
    progressBar: {
        height: 4,
        borderRadius: 2,
        marginBottom: 10,
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    featureTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    featureTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    featureText: {
        fontSize: 11,
    },
    docsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
    },
    docsButtonText: {
        fontSize: 13,
        fontWeight: '500',
    },
});

export default ProtocolsScreen;
