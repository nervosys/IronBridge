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
    Alert,
    Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface Account {
    id: string;
    provider: string;
    type: 'oauth' | 'api_key' | 'pat';
    email?: string;
    username?: string;
    status: 'active' | 'expired' | 'revoked';
    scopes: string[];
    connectedAt: string;
    expiresAt?: string;
    icon: string;
}

const sampleAccounts: Account[] = [
    {
        id: '1',
        provider: 'GitHub',
        type: 'oauth',
        username: 'developer',
        status: 'active',
        scopes: ['repo', 'read:user', 'read:org'],
        connectedAt: '2024-10-15T10:30:00Z',
        icon: 'logo-github',
    },
    {
        id: '2',
        provider: 'OpenAI',
        type: 'api_key',
        email: 'dev@example.com',
        status: 'active',
        scopes: ['models', 'chat', 'embeddings'],
        connectedAt: '2024-11-01T14:00:00Z',
        icon: '🤖',
    },
    {
        id: '3',
        provider: 'Anthropic',
        type: 'api_key',
        email: 'dev@example.com',
        status: 'active',
        scopes: ['messages', 'complete'],
        connectedAt: '2024-11-10T09:15:00Z',
        icon: '🧠',
    },
    {
        id: '4',
        provider: 'Google Cloud',
        type: 'oauth',
        email: 'developer@gmail.com',
        status: 'active',
        scopes: ['generativelanguage', 'aiplatform'],
        connectedAt: '2024-09-20T16:45:00Z',
        expiresAt: '2025-03-20T16:45:00Z',
        icon: 'logo-google',
    },
    {
        id: '5',
        provider: 'Azure',
        type: 'oauth',
        email: 'dev@company.onmicrosoft.com',
        status: 'expired',
        scopes: ['openai.read', 'cognitive.read'],
        connectedAt: '2024-06-01T08:00:00Z',
        expiresAt: '2024-12-01T08:00:00Z',
        icon: 'cloud-outline',
    },
    {
        id: '6',
        provider: 'Hugging Face',
        type: 'pat',
        username: 'ml_developer',
        status: 'active',
        scopes: ['read', 'write', 'inference'],
        connectedAt: '2024-08-15T11:30:00Z',
        icon: '🤗',
    },
];

const availableProviders = [
    { id: 'github', name: 'GitHub', icon: 'logo-github', type: 'oauth' },
    { id: 'google', name: 'Google Cloud', icon: 'logo-google', type: 'oauth' },
    { id: 'azure', name: 'Azure', icon: 'cloud-outline', type: 'oauth' },
    { id: 'openai', name: 'OpenAI', icon: '🤖', type: 'api_key' },
    { id: 'anthropic', name: 'Anthropic', icon: '🧠', type: 'api_key' },
    { id: 'huggingface', name: 'Hugging Face', icon: '🤗', type: 'pat' },
];

export function AccountsScreen() {
    const { colors } = useTheme();
    const [accounts, setAccounts] = useState<Account[]>(sampleAccounts);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showAddSection, setShowAddSection] = useState(false);

    // Stats
    const stats = useMemo(() => ({
        total: accounts.length,
        active: accounts.filter(a => a.status === 'active').length,
        oauth: accounts.filter(a => a.type === 'oauth').length,
        apiKeys: accounts.filter(a => a.type === 'api_key' || a.type === 'pat').length,
    }), [accounts]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 1000);
    };

    const handleRefreshToken = (account: Account) => {
        Alert.alert('Refresh Token', `Refreshing OAuth token for ${account.provider}...`);
        setAccounts(prev => prev.map(a =>
            a.id === account.id ? { ...a, status: 'active' as const, expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() } : a
        ));
    };

    const handleDisconnect = (account: Account) => {
        Alert.alert(
            'Disconnect Account',
            `Are you sure you want to disconnect ${account.provider}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disconnect',
                    style: 'destructive',
                    onPress: () => {
                        setAccounts(prev => prev.filter(a => a.id !== account.id));
                    }
                },
            ]
        );
    };

    const handleConnect = (provider: typeof availableProviders[0]) => {
        Alert.alert('Connect Account', `Connecting to ${provider.name}...`);
        setShowAddSection(false);
    };

    const getStatusStyle = (status: Account['status']) => {
        switch (status) {
            case 'active': return { bg: '#10b98120', color: '#10b981', icon: 'checkmark-circle' };
            case 'expired': return { bg: '#f59e0b20', color: '#f59e0b', icon: 'warning' };
            case 'revoked': return { bg: '#ef444420', color: '#ef4444', icon: 'close-circle' };
        }
    };

    const getTypeLabel = (type: Account['type']) => {
        switch (type) {
            case 'oauth': return 'OAuth';
            case 'api_key': return 'API Key';
            case 'pat': return 'PAT';
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Stats */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="people-outline" size={20} color={colors.primary} />
                    <Text style={[styles.statValue, { color: colors.text }]}>{stats.total}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Accounts</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#10b981" />
                    <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.active}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Active</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="shield-checkmark-outline" size={20} color="#8b5cf6" />
                    <Text style={[styles.statValue, { color: '#8b5cf6' }]}>{stats.oauth}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>OAuth</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="key-outline" size={20} color="#f59e0b" />
                    <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.apiKeys}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Keys</Text>
                </View>
            </View>

            {/* Add Account Toggle */}
            <TouchableOpacity
                style={[styles.addToggle, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setShowAddSection(!showAddSection)}
            >
                <Ionicons name={showAddSection ? 'chevron-up' : 'add-circle-outline'} size={20} color={colors.primary} />
                <Text style={[styles.addToggleText, { color: colors.primary }]}>
                    {showAddSection ? 'Hide Options' : 'Connect New Account'}
                </Text>
            </TouchableOpacity>

            {/* Add Account Section */}
            {showAddSection && (
                <View style={[styles.addSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.addSectionTitle, { color: colors.text }]}>Select Provider</Text>
                    <View style={styles.providerGrid}>
                        {availableProviders.map((provider) => (
                            <TouchableOpacity
                                key={provider.id}
                                style={[styles.providerOption, { borderColor: colors.border }]}
                                onPress={() => handleConnect(provider)}
                            >
                                {provider.icon.startsWith('logo-') || provider.icon.includes('-outline') ? (
                                    <Ionicons name={provider.icon as any} size={28} color={colors.text} />
                                ) : (
                                    <Text style={styles.providerEmoji}>{provider.icon}</Text>
                                )}
                                <Text style={[styles.providerOptionName, { color: colors.text }]}>{provider.name}</Text>
                                <Text style={[styles.providerOptionType, { color: colors.textSecondary }]}>
                                    {getTypeLabel(provider.type as Account['type'])}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            {/* Account List */}
            <ScrollView
                style={styles.list}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
                }
            >
                {accounts.map((account) => {
                    const statusStyle = getStatusStyle(account.status);

                    return (
                        <View
                            key={account.id}
                            style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                        >
                            <View style={styles.cardHeader}>
                                <View style={styles.providerInfo}>
                                    {account.icon.startsWith('logo-') || account.icon.includes('-outline') ? (
                                        <View style={[styles.iconCircle, { backgroundColor: colors.background }]}>
                                            <Ionicons name={account.icon as any} size={24} color={colors.text} />
                                        </View>
                                    ) : (
                                        <View style={[styles.iconCircle, { backgroundColor: colors.background }]}>
                                            <Text style={styles.iconEmoji}>{account.icon}</Text>
                                        </View>
                                    )}
                                    <View>
                                        <Text style={[styles.providerName, { color: colors.text }]}>{account.provider}</Text>
                                        <Text style={[styles.accountIdentifier, { color: colors.textSecondary }]}>
                                            {account.email || account.username}
                                        </Text>
                                    </View>
                                </View>
                                <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                                    <Ionicons name={statusStyle.icon as any} size={12} color={statusStyle.color} />
                                    <Text style={[styles.statusText, { color: statusStyle.color }]}>{account.status}</Text>
                                </View>
                            </View>

                            {/* Details */}
                            <View style={styles.detailsRow}>
                                <View style={styles.detailItem}>
                                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Type</Text>
                                    <Text style={[styles.detailValue, { color: colors.text }]}>{getTypeLabel(account.type)}</Text>
                                </View>
                                <View style={styles.detailItem}>
                                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Connected</Text>
                                    <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(account.connectedAt)}</Text>
                                </View>
                                {account.expiresAt && (
                                    <View style={styles.detailItem}>
                                        <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Expires</Text>
                                        <Text style={[styles.detailValue, {
                                            color: new Date(account.expiresAt) < new Date() ? '#ef4444' : colors.text
                                        }]}>
                                            {formatDate(account.expiresAt)}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {/* Scopes */}
                            <View style={styles.scopesSection}>
                                <Text style={[styles.scopesLabel, { color: colors.textSecondary }]}>Scopes</Text>
                                <View style={styles.scopeTags}>
                                    {account.scopes.map((scope) => (
                                        <View key={scope} style={[styles.scopeTag, { backgroundColor: colors.background }]}>
                                            <Text style={[styles.scopeText, { color: colors.text }]}>{scope}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>

                            {/* Actions */}
                            <View style={styles.cardActions}>
                                {account.type === 'oauth' && account.status === 'expired' && (
                                    <TouchableOpacity
                                        style={[styles.actionButton, { backgroundColor: colors.primary }]}
                                        onPress={() => handleRefreshToken(account)}
                                    >
                                        <Ionicons name="refresh-outline" size={16} color="#fff" />
                                        <Text style={styles.actionButtonText}>Refresh</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={[styles.actionButton, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}
                                    onPress={() => handleDisconnect(account)}
                                >
                                    <Ionicons name="unlink-outline" size={16} color="#ef4444" />
                                    <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>Disconnect</Text>
                                </TouchableOpacity>
                            </View>
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
        fontSize: 10,
        marginTop: 2,
    },
    addToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginHorizontal: 16,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
    },
    addToggleText: {
        fontSize: 14,
        fontWeight: '600',
    },
    addSection: {
        margin: 16,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    addSectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 12,
    },
    providerGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    providerOption: {
        width: '31%',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
    },
    providerEmoji: {
        fontSize: 28,
    },
    providerOptionName: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 6,
        textAlign: 'center',
    },
    providerOptionType: {
        fontSize: 10,
        marginTop: 2,
    },
    list: {
        flex: 1,
        padding: 16,
    },
    accountCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        marginBottom: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    providerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconEmoji: {
        fontSize: 24,
    },
    providerName: {
        fontSize: 16,
        fontWeight: '600',
    },
    accountIdentifier: {
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
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    detailsRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 12,
    },
    detailItem: {},
    detailLabel: {
        fontSize: 10,
    },
    detailValue: {
        fontSize: 12,
        fontWeight: '500',
    },
    scopesSection: {
        marginBottom: 12,
    },
    scopesLabel: {
        fontSize: 10,
        marginBottom: 6,
    },
    scopeTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    scopeTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    scopeText: {
        fontSize: 11,
    },
    cardActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 6,
    },
    actionButtonText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#fff',
    },
});

export default AccountsScreen;
