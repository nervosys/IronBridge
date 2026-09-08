// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface ProtocolFeature {
    /** Feature name as the protocol itself names it. */
    name: string;
    /** Whether IronBridge implements it. Every `true` below cites where. */
    implemented: boolean;
}

interface Protocol {
    id: string;
    name: string;
    fullName: string;
    /** Protocol version IronBridge targets, or the version described when unsupported. */
    version: string;
    category: 'agent' | 'tool' | 'memory' | 'auth';
    description: string;
    features: ProtocolFeature[];
    docsUrl?: string;
}

/**
 * What IronBridge implements of each protocol.
 *
 * This screen used to carry an `implementedFeatures` count per protocol and a
 * headline "coverage" percentage derived from it. The counts were not measured
 * against anything: it claimed three of four A2A features, one of four NANDA,
 * two of four Mem0 and three of four LangChain, and there is not a line of
 * code for any of those four protocols anywhere in the server. MCP was listed
 * at four of five when the server declares two capabilities and answers six
 * methods.
 *
 * Each flag below was checked against the source, and the true ones say where.
 * If you add support for something here, flip its flag in the same change.
 */
const protocols: Protocol[] = [
    {
        id: 'mcp',
        name: 'MCP',
        fullName: 'Model Context Protocol',
        version: '2024-11-05',
        category: 'tool',
        description:
            "Anthropic's protocol for connecting AI models to external tools, data sources, and system capabilities.",
        features: [
            // ironbridge-rust/src/mcp/server.rs -- `tools/list`, `tools/call`.
            { name: 'Tool calling', implemented: true },
            // ironbridge-rust/src/mcp/server.rs -- `resources/list`, `resources/read`.
            { name: 'Resource access', implemented: true },
            // The server declares `prompts: None` in its initialize result.
            { name: 'Prompts', implemented: false },
            { name: 'Sampling', implemented: false },
            { name: 'Roots', implemented: false },
        ],
        docsUrl: 'https://modelcontextprotocol.io',
    },
    {
        id: 'openai-tools',
        name: 'OpenAI Tools',
        fullName: 'OpenAI Function Calling',
        version: '1.0',
        category: 'tool',
        description: "OpenAI's native function calling interface for GPT models.",
        features: [
            // `GET /api/mcp/tools` also emits every tool as an OpenAI function
            // definition, ready to pass straight to a chat model.
            { name: 'Function definitions', implemented: true },
            { name: 'Parallel calls', implemented: false },
            // Structured outputs means a `json_schema` response format. IronBridge
            // sends `json_object`, which is JSON mode, not this.
            { name: 'Structured outputs', implemented: false },
            // ironbridge-rust/src/intelligence/model.rs.
            { name: 'JSON mode', implemented: true },
        ],
        docsUrl: 'https://platform.openai.com/docs/guides/function-calling',
    },
    {
        id: 'oauth2',
        name: 'OAuth 2.0',
        fullName: 'Open Authorization 2.0',
        version: '2.1',
        category: 'auth',
        description: 'Industry-standard protocol for authorization and API access.',
        features: [
            // ironbridge-rust/src/api/oidc.rs.
            { name: 'Auth code flow', implemented: true },
            { name: 'Client credentials', implemented: false },
            // ironbridge-rust/src/api/auth.rs -- issued, stored and validated.
            { name: 'Refresh tokens', implemented: true },
            // ironbridge-rust/src/api/oidc.rs -- the verifier never leaves the server.
            { name: 'PKCE', implemented: true },
        ],
    },
    {
        id: 'a2a',
        name: 'A2A',
        fullName: 'Agent-to-Agent Protocol',
        version: '1.0',
        category: 'agent',
        description:
            "Google's protocol enabling AI agents to communicate, delegate tasks, and collaborate.",
        features: [
            { name: 'Agent discovery', implemented: false },
            { name: 'Task delegation', implemented: false },
            { name: 'Message passing', implemented: false },
            { name: 'Capability negotiation', implemented: false },
        ],
        docsUrl: 'https://github.com/google/A2A',
    },
    {
        id: 'nanda',
        name: 'NANDA',
        fullName: 'Networked Agents for Decentralized Applications',
        version: '0.9',
        category: 'agent',
        description:
            'Decentralized protocol for agent coordination and task orchestration across networks.',
        features: [
            { name: 'Decentralized registry', implemented: false },
            { name: 'Task marketplace', implemented: false },
            { name: 'Reputation system', implemented: false },
            { name: 'Payment rails', implemented: false },
        ],
    },
    {
        id: 'langchain-tools',
        name: 'LangChain Tools',
        fullName: 'LangChain Tool Interface',
        version: '0.1',
        category: 'tool',
        description: "LangChain's standardized tool interface for building agent applications.",
        features: [
            { name: 'Tool wrappers', implemented: false },
            { name: 'Toolkits', implemented: false },
            { name: 'Agent types', implemented: false },
            { name: 'Memory integration', implemented: false },
        ],
    },
    {
        id: 'mem0',
        name: 'Mem0',
        fullName: 'Memory Layer Protocol',
        version: '0.1',
        category: 'memory',
        description: 'Protocol for managing persistent memory across AI agent sessions.',
        features: [
            // IronBridge stores per-project memory of its own, under /api/swe. That
            // is not this protocol, and does not count towards it.
            { name: 'Semantic memory', implemented: false },
            { name: 'Episodic memory', implemented: false },
            { name: 'Working memory', implemented: false },
            { name: 'Memory search', implemented: false },
        ],
    },
];

function implementedCount(p: Protocol): number {
    return p.features.filter((f) => f.implemented).length;
}

const categoryConfig = {
    agent: { icon: 'people-outline', color: '#8b5cf6' },
    tool: { icon: 'construct-outline', color: '#3b82f6' },
    memory: { icon: 'hardware-chip-outline', color: '#10b981' },
    auth: { icon: 'lock-closed-outline', color: '#f59e0b' },
};

export function ProtocolsScreen() {
    const { colors, isDark } = useTheme();
    const [filterCategory, setFilterCategory] = useState<string>('all');

    const filteredProtocols = useMemo(() => {
        if (filterCategory === 'all') return protocols;
        return protocols.filter(p => p.category === filterCategory);
    }, [filterCategory]);

    // Stats
    const stats = useMemo(() => {
        const implemented = protocols.reduce((sum, p) => sum + implementedCount(p), 0);
        const total = protocols.reduce((sum, p) => sum + p.features.length, 0);
        return {
            total: protocols.length,
            supported: protocols.filter((p) => implementedCount(p) > 0).length,
            implemented,
            coverage: Math.round((implemented / total) * 100),
        };
    }, []);

    const handleOpenDocs = (url: string) => {
        Linking.openURL(url);
    };

    // The badge says how much of the protocol IronBridge implements, which is what a
    // reader of this screen is actually asking. It used to say how mature the
    // protocol was upstream -- true, but not an answer to that question.
    const getSupportStyle = (protocol: Protocol) => {
        const done = implementedCount(protocol);
        if (done === 0) return { bg: '#ef444420', color: '#ef4444', label: 'not implemented' };
        if (done === protocol.features.length) return { bg: '#10b98120', color: '#10b981', label: 'full' };
        return { bg: '#f59e0b20', color: '#f59e0b', label: 'partial' };
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
                    <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.supported}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Supported</Text>
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
            {/* No pull-to-refresh: this table is compiled into the app, so a
                spinner here would reload nothing. */}
            <ScrollView style={styles.list}>
                {filteredProtocols.map((protocol) => {
                    const catConfig = categoryConfig[protocol.category];
                    const supportStyle = getSupportStyle(protocol);
                    const done = implementedCount(protocol);

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
                                        <View style={[styles.statusBadge, { backgroundColor: supportStyle.bg }]}>
                                            <Text style={[styles.statusText, { color: supportStyle.color }]}>
                                                {supportStyle.label}
                                            </Text>
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
                                    Implemented ({done}/{protocol.features.length})
                                </Text>
                                <View style={[styles.progressBar, { backgroundColor: colors.background }]}>
                                    <View
                                        style={[styles.progressFill, {
                                            width: `${(done / protocol.features.length) * 100}%`,
                                            backgroundColor: catConfig.color,
                                        }]}
                                    />
                                </View>
                                <View style={styles.featureTags}>
                                    {protocol.features.map((feature) => (
                                        <View
                                            key={feature.name}
                                            style={[styles.featureTag, {
                                                backgroundColor: feature.implemented
                                                    ? `${catConfig.color}20`
                                                    : colors.background,
                                            }]}
                                        >
                                            <Ionicons
                                                name={feature.implemented ? 'checkmark' : 'close'}
                                                size={12}
                                                color={feature.implemented ? catConfig.color : colors.textSecondary}
                                            />
                                            <Text style={[styles.featureText, {
                                                color: feature.implemented ? catConfig.color : colors.textSecondary,
                                            }]}>
                                                {feature.name}
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
