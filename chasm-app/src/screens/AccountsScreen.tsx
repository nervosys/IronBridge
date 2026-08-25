// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    RefreshControl,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { accounts as accountsApi, ProviderAccount } from '../api/sessions';

/**
 * Providers offered in the "connect" picker.
 *
 * The server does not publish a list of connectable providers, so this list is
 * the app's own -- but the credential it asks for is real, and saving it stores
 * a real row. `keyLabel` names the secret so the field is not just "value".
 */
const CONNECTABLE = [
    { id: 'github', name: 'GitHub', icon: 'logo-github', keyLabel: 'Personal access token' },
    { id: 'openai', name: 'OpenAI', icon: '🤖', keyLabel: 'API key' },
    { id: 'anthropic', name: 'Anthropic', icon: '🧠', keyLabel: 'API key' },
    { id: 'google', name: 'Google Cloud', icon: 'logo-google', keyLabel: 'API key' },
    { id: 'azure', name: 'Azure', icon: 'cloud-outline', keyLabel: 'API key' },
    { id: 'huggingface', name: 'Hugging Face', icon: '🤗', keyLabel: 'Access token' },
] as const;

const PROVIDER_ICONS: Record<string, string> = {
    github: 'logo-github',
    google: 'logo-google',
    googlecloud: 'logo-google',
    azure: 'cloud-outline',
    openai: '🤖',
    anthropic: '🧠',
    huggingface: '🤗',
};

function iconFor(provider: string): string {
    return PROVIDER_ICONS[provider.toLowerCase().replace(/[^a-z]/g, '')] ?? 'key-outline';
}

function isIoniconName(icon: string): boolean {
    return icon.startsWith('logo-') || icon.includes('-outline');
}

function formatDate(ms: number): string {
    return new Date(ms).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

export function AccountsScreen() {
    const { colors } = useTheme();
    const [accounts, setAccounts] = useState<ProviderAccount[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showAddSection, setShowAddSection] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<(typeof CONNECTABLE)[number] | null>(null);
    const [secret, setSecret] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const load = useCallback(async () => {
        try {
            setAccounts(await accountsApi.list());
            setLoadError(null);
        } catch (err) {
            setAccounts([]);
            setLoadError(err instanceof Error ? err.message : 'Could not reach the Chasm server');
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    // Only what the server actually records. `provider_accounts` has no token
    // type, no expiry and no scope list, so there is nothing here to count
    // those by -- and a screen that showed them would be inventing them.
    const stats = useMemo(
        () => ({
            total: accounts.length,
            providers: new Set(accounts.map((a) => a.provider.toLowerCase())).size,
            defaults: accounts.filter((a) => a.isDefault).length,
        }),
        [accounts]
    );

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await load();
        setIsRefreshing(false);
    };

    const handleDisconnect = (account: ProviderAccount) => {
        Alert.alert('Disconnect Account', `Remove the stored ${account.provider} credential?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Disconnect',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await accountsApi.remove(account.id);
                        await load();
                    } catch (err) {
                        Alert.alert(
                            'Could not disconnect',
                            err instanceof Error ? err.message : 'The server rejected the request.'
                        );
                    }
                },
            },
        ]);
    };

    const handleConnect = async () => {
        if (!selectedProvider || !secret.trim()) return;
        setIsSaving(true);
        try {
            await accountsApi.create(selectedProvider.name, { apiKey: secret.trim() });
            setSecret('');
            setSelectedProvider(null);
            setShowAddSection(false);
            await load();
        } catch (err) {
            Alert.alert(
                'Could not connect',
                err instanceof Error ? err.message : 'The server rejected the request.'
            );
        } finally {
            setIsSaving(false);
        }
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
                    <Ionicons name="cube-outline" size={20} color="#8b5cf6" />
                    <Text style={[styles.statValue, { color: '#8b5cf6' }]}>{stats.providers}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Providers</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="star-outline" size={20} color="#f59e0b" />
                    <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.defaults}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Default</Text>
                </View>
            </View>

            {loadError && (
                <View style={[styles.errorBox, { borderColor: colors.border }]}>
                    <Ionicons name="cloud-offline-outline" size={16} color="#ef4444" />
                    <Text style={[styles.errorText, { color: colors.textSecondary }]}>{loadError}</Text>
                </View>
            )}

            {/* Add Account Toggle */}
            <TouchableOpacity
                style={[styles.addToggle, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setShowAddSection(!showAddSection)}
            >
                <Ionicons
                    name={showAddSection ? 'chevron-up' : 'add-circle-outline'}
                    size={20}
                    color={colors.primary}
                />
                <Text style={[styles.addToggleText, { color: colors.primary }]}>
                    {showAddSection ? 'Hide Options' : 'Connect New Account'}
                </Text>
            </TouchableOpacity>

            {/* Add Account Section */}
            {showAddSection && (
                <View style={[styles.addSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.addSectionTitle, { color: colors.text }]}>Select Provider</Text>
                    <View style={styles.providerGrid}>
                        {CONNECTABLE.map((provider) => {
                            const selected = selectedProvider?.id === provider.id;
                            return (
                                <TouchableOpacity
                                    key={provider.id}
                                    style={[
                                        styles.providerOption,
                                        { borderColor: selected ? colors.primary : colors.border },
                                        selected && { backgroundColor: `${colors.primary}12` },
                                    ]}
                                    onPress={() => setSelectedProvider(selected ? null : provider)}
                                >
                                    {isIoniconName(provider.icon) ? (
                                        <Ionicons name={provider.icon as any} size={28} color={colors.text} />
                                    ) : (
                                        <Text style={styles.providerEmoji}>{provider.icon}</Text>
                                    )}
                                    <Text style={[styles.providerOptionName, { color: colors.text }]}>
                                        {provider.name}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {selectedProvider && (
                        <>
                            <View style={styles.credentialRow}>
                                <TextInput
                                    style={[
                                        styles.credentialInput,
                                        {
                                            color: colors.text,
                                            borderColor: colors.border,
                                            backgroundColor: colors.background,
                                        },
                                    ]}
                                    placeholder={`${selectedProvider.keyLabel} for ${selectedProvider.name}`}
                                    placeholderTextColor={colors.textSecondary}
                                    value={secret}
                                    onChangeText={setSecret}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    secureTextEntry
                                />
                                <TouchableOpacity
                                    style={[
                                        styles.saveButton,
                                        { backgroundColor: colors.primary },
                                        (!secret.trim() || isSaving) && styles.saveButtonDisabled,
                                    ]}
                                    disabled={!secret.trim() || isSaving}
                                    onPress={handleConnect}
                                >
                                    <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Save'}</Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={[styles.credentialNote, { color: colors.textSecondary }]}>
                                Encrypted with AES-256-GCM before it is stored, under a key the
                                server derives from its CHASM_MASTER_KEY environment variable. If
                                that is not set the server refuses to store the key rather than
                                writing it in the clear, and saving will fail with that reason.
                            </Text>
                        </>
                    )}
                </View>
            )}

            {/* Account List */}
            <ScrollView
                style={styles.list}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
            >
                {accounts.length === 0 && !loadError && (
                    <View style={styles.emptyState}>
                        <Ionicons name="key-outline" size={40} color={colors.textSecondary} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                            No provider credentials stored yet.
                        </Text>
                    </View>
                )}

                {accounts.map((account) => {
                    const icon = iconFor(account.provider);

                    return (
                        <View
                            key={account.id}
                            style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                        >
                            <View style={styles.cardHeader}>
                                <View style={styles.providerInfo}>
                                    <View style={[styles.iconCircle, { backgroundColor: colors.background }]}>
                                        {isIoniconName(icon) ? (
                                            <Ionicons name={icon as any} size={24} color={colors.text} />
                                        ) : (
                                            <Text style={styles.iconEmoji}>{icon}</Text>
                                        )}
                                    </View>
                                    <View>
                                        <Text style={[styles.providerName, { color: colors.text }]}>
                                            {account.name}
                                        </Text>
                                        <Text style={[styles.accountIdentifier, { color: colors.textSecondary }]}>
                                            {account.provider}
                                        </Text>
                                    </View>
                                </View>
                                {account.isDefault && (
                                    <View style={[styles.statusBadge, { backgroundColor: '#f59e0b20' }]}>
                                        <Ionicons name="star" size={12} color="#f59e0b" />
                                        <Text style={[styles.statusText, { color: '#f59e0b' }]}>default</Text>
                                    </View>
                                )}
                            </View>

                            {/* Details */}
                            <View style={styles.detailsRow}>
                                <View style={styles.detailItem}>
                                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Added</Text>
                                    <Text style={[styles.detailValue, { color: colors.text }]}>
                                        {formatDate(account.createdAt)}
                                    </Text>
                                </View>
                                <View style={styles.detailItem}>
                                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Updated</Text>
                                    <Text style={[styles.detailValue, { color: colors.text }]}>
                                        {formatDate(account.updatedAt)}
                                    </Text>
                                </View>
                            </View>

                            {/* Actions */}
                            <View style={styles.cardActions}>
                                <TouchableOpacity
                                    style={[
                                        styles.actionButton,
                                        {
                                            backgroundColor: colors.background,
                                            borderColor: colors.border,
                                            borderWidth: 1,
                                        },
                                    ]}
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
    errorBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginHorizontal: 16,
        marginBottom: 12,
    },
    errorText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 17,
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
    credentialRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
    },
    credentialInput: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 13,
    },
    saveButton: {
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderRadius: 8,
    },
    credentialNote: {
        fontSize: 11,
        lineHeight: 16,
        marginTop: 8,
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    list: {
        flex: 1,
        padding: 16,
    },
    emptyState: {
        alignItems: 'center',
        gap: 10,
        paddingVertical: 48,
    },
    emptyText: {
        fontSize: 13,
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
