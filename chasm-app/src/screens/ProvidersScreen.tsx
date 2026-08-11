// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Switch,
    Alert,
    RefreshControl,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { providers as providersApi } from '../api/sessions';

interface Provider {
    id: string;
    name: string;
    type: 'cloud' | 'local';
    icon: string;
    status: 'connected' | 'configured' | 'disconnected';
    apiEndpoint?: string;
    models: string[];
    enabled: boolean;
}


/** Provider ids the server reports that run on the user's own machine. */
const LOCAL_PROVIDER_TYPES = new Set(['ollama', 'lm-studio', 'cursor', 'copilot']);

/**
 * Fold a server provider and its health row into what this screen renders.
 *
 * `status` comes from the health endpoint, never from a guess: the server
 * distinguishes connected / disconnected / error / unknown, and `unknown` is a
 * real answer here -- it is what a cloud provider reports when the server holds
 * no credentials for it and will not pretend to know.
 */
function toScreenProvider(
    p: { id: string; name: string; type?: string; enabled?: boolean; base_url?: string; models?: string[] },
    health: Map<string, string>
): Provider {
    const serverType = (p.type ?? '').toLowerCase();
    const isLocal =
        LOCAL_PROVIDER_TYPES.has(serverType) ||
        /localhost|127\.0\.0\.1|\[::1\]/.test(p.base_url ?? '');

    const reported = health.get(p.id);
    const status: Provider['status'] =
        reported === 'connected' ? 'connected' : reported === 'error' ? 'disconnected' : 'configured';

    return {
        id: p.id,
        name: p.name,
        type: isLocal ? 'local' : 'cloud',
        icon: isLocal ? '💻' : '☁️',
        status,
        apiEndpoint: p.base_url,
        models: p.models ?? [],
        enabled: p.enabled ?? false,
        // No quota fields: the server reports none, and the numbers that used
        // to sit here (45 of 100, and so on) were invented.
    };
}

export function ProvidersScreen() {
    const { colors, isDark } = useTheme();
    // Was seeded from `defaultProviders`, a hard-coded list that declared
    // OpenAI "connected" with 45 of 100 quota used on a machine that had never
    // contacted it. Starts empty now and fills from `/api/providers`.
    const [providers, setProviders] = useState<Provider[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [filterType, setFilterType] = useState<'all' | 'cloud' | 'local'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);

    const loadProviders = useCallback(async () => {
        try {
            const [list, healthRows] = await Promise.all([
                providersApi.list(),
                // Health is advisory: a server that lists providers but cannot
                // report health should still render the list.
                providersApi.health().catch(() => []),
            ]);
            const health = new Map(
                healthRows.map((h: any) => [h.providerId ?? h.provider_id, h.status])
            );
            setProviders(list.map((p: any) => toScreenProvider(p, health)));
            setLoadError(null);
        } catch (err) {
            setProviders([]);
            setLoadError(err instanceof Error ? err.message : 'Could not reach the Chasm server');
        }
    }, []);

    useEffect(() => {
        void loadProviders();
    }, [loadProviders]);

    // Filter providers
    const filteredProviders = useMemo(() => {
        return providers.filter(p => {
            if (filterType !== 'all' && p.type !== filterType) return false;
            if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            return true;
        });
    }, [providers, filterType, searchQuery]);

    // Stats
    const stats = useMemo(() => ({
        total: providers.length,
        enabled: providers.filter(p => p.enabled).length,
        connected: providers.filter(p => p.status === 'connected').length,
        cloudCount: providers.filter(p => p.type === 'cloud').length,
        localCount: providers.filter(p => p.type === 'local').length,
    }), [providers]);

    /**
     * Local only -- this does not persist.
     *
     * Enabling a provider server-side would need `PUT /api/providers/{id}`,
     * which the server does not route. The switch therefore survives until the
     * next load and no further, and the toast says so rather than letting the
     * user believe a setting was saved.
     */
    const handleToggleProvider = (id: string) => {
        const provider = providers.find(p => p.id === id);
        setProviders(prev => prev.map(p =>
            p.id === id ? { ...p, enabled: !p.enabled } : p
        ));
        if (provider) {
            Alert.alert(
                'Not saved',
                `${provider.name} was toggled for this session only. Chasm has no endpoint ` +
                `for changing provider settings yet, so this resets when the screen reloads.`
            );
        }
    };

    // Was: show "Testing...", wait a second, then mark the provider connected
    // unconditionally. It tested nothing and could not fail, so the green dot
    // afterwards meant only that a second had passed.
    const handleTestConnection = async (provider: Provider) => {
        try {
            const result = await providersApi.test(provider.id);
            setProviders(prev => prev.map(p =>
                p.id === provider.id
                    ? { ...p, status: result.success ? 'connected' : 'disconnected' }
                    : p
            ));
            Alert.alert(
                result.success ? 'Connected' : 'Connection failed',
                result.success
                    ? `${provider.name} answered in ${result.latency} ms.`
                    : `${provider.name} did not answer.`
            );
        } catch (err) {
            setProviders(prev => prev.map(p =>
                p.id === provider.id ? { ...p, status: 'disconnected' } : p
            ));
            Alert.alert(
                'Connection failed',
                err instanceof Error ? err.message : `Could not test ${provider.name}.`
            );
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await loadProviders();
        } finally {
            setIsRefreshing(false);
        }
    };

    const getStatusColor = (status: Provider['status']) => {
        switch (status) {
            case 'connected': return '#10b981';
            case 'configured': return '#f59e0b';
            case 'disconnected': return '#ef4444';
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header Stats */}
            <View style={styles.statsRow}>
                <View style={[styles.statChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.statValue, { color: colors.text }]}>{stats.enabled}/{stats.total}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Enabled</Text>
                </View>
                <View style={[styles.statChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.connected}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Connected</Text>
                </View>
                <View style={[styles.statChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.statValue, { color: '#3b82f6' }]}>{stats.cloudCount}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Cloud</Text>
                </View>
                <View style={[styles.statChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.statValue, { color: '#8b5cf6' }]}>{stats.localCount}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Local</Text>
                </View>
            </View>

            {/* Filter Bar */}
            <View style={styles.filterBar}>
                <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search providers..."
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
                <View style={styles.filterButtons}>
                    {(['all', 'cloud', 'local'] as const).map((type) => (
                        <TouchableOpacity
                            key={type}
                            style={[
                                styles.filterButton,
                                { backgroundColor: filterType === type ? colors.primary : colors.card, borderColor: colors.border }
                            ]}
                            onPress={() => setFilterType(type)}
                        >
                            <Text style={[
                                styles.filterButtonText,
                                { color: filterType === type ? '#fff' : colors.text }
                            ]}>
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Provider List */}
            <ScrollView
                style={styles.list}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
                }
            >
                {/* An empty list and a failed request look identical once
                    rendered, so they are told apart here rather than both
                    reading as "you have no providers". */}
                {filteredProviders.length === 0 && (
                    <View style={[styles.providerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={{ color: colors.textSecondary }}>
                            {loadError
                                ? `Providers unavailable: ${loadError}`
                                : providers.length === 0
                                    ? 'No providers configured on the server.'
                                    : 'No providers match this filter.'}
                        </Text>
                    </View>
                )}
                {filteredProviders.map((provider) => (
                    <TouchableOpacity
                        key={provider.id}
                        style={[styles.providerCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => setSelectedProvider(provider)}
                    >
                        <View style={styles.providerHeader}>
                            <View style={styles.providerInfo}>
                                <Text style={styles.providerIcon}>{provider.icon}</Text>
                                <View>
                                    <Text style={[styles.providerName, { color: colors.text }]}>{provider.name}</Text>
                                    <View style={styles.providerMeta}>
                                        <View style={[styles.typeBadge, {
                                            backgroundColor: provider.type === 'cloud' ? '#3b82f620' : '#8b5cf620'
                                        }]}>
                                            <Text style={[styles.typeText, {
                                                color: provider.type === 'cloud' ? '#3b82f6' : '#8b5cf6'
                                            }]}>
                                                {provider.type}
                                            </Text>
                                        </View>
                                        <View style={[styles.statusDot, { backgroundColor: getStatusColor(provider.status) }]} />
                                        <Text style={[styles.statusText, { color: colors.textSecondary }]}>{provider.status}</Text>
                                    </View>
                                </View>
                            </View>
                            <Switch
                                value={provider.enabled}
                                onValueChange={() => handleToggleProvider(provider.id)}
                                trackColor={{ false: colors.border, true: colors.primary }}
                            />
                        </View>

                        {/* Models */}
                        {provider.models.length > 0 && (
                            <View style={styles.modelsSection}>
                                <Text style={[styles.modelsLabel, { color: colors.textSecondary }]}>Models:</Text>
                                <View style={styles.modelTags}>
                                    {provider.models.slice(0, 3).map((model) => (
                                        <View key={model} style={[styles.modelTag, { backgroundColor: colors.background }]}>
                                            <Text style={[styles.modelText, { color: colors.text }]}>{model}</Text>
                                        </View>
                                    ))}
                                    {provider.models.length > 3 && (
                                        <Text style={[styles.moreModels, { color: colors.textSecondary }]}>
                                            +{provider.models.length - 3} more
                                        </Text>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* No quota bar. The server reports no quota for any
                            provider, so this could only ever have rendered the
                            invented "45 / 100" the fixture carried. If quota
                            is added server-side, add it to `toScreenProvider`
                            and bring the bar back with it. */}

                        {/* Actions */}
                        <View style={styles.cardActions}>
                            <TouchableOpacity
                                style={[styles.actionButton, { borderColor: colors.border }]}
                                onPress={() => handleTestConnection(provider)}
                            >
                                <Ionicons name="flash-outline" size={16} color={colors.primary} />
                                <Text style={[styles.actionText, { color: colors.primary }]}>Test</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionButton, { borderColor: colors.border }]}
                                onPress={() => setSelectedProvider(provider)}
                            >
                                <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
                                <Text style={[styles.actionText, { color: colors.textSecondary }]}>Configure</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Add Provider Button */}
            <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.primary }]}
                onPress={() => setShowAddModal(true)}
            >
                <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>

            {/* Provider Detail Modal */}
            <Modal
                visible={selectedProvider !== null}
                animationType="slide"
                transparent
                onRequestClose={() => setSelectedProvider(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        {selectedProvider && (
                            <>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalIcon}>{selectedProvider.icon}</Text>
                                    <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedProvider.name}</Text>
                                    <TouchableOpacity onPress={() => setSelectedProvider(null)}>
                                        <Ionicons name="close" size={24} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.modalBody}>
                                    <View style={styles.configRow}>
                                        <Text style={[styles.configLabel, { color: colors.textSecondary }]}>API Endpoint</Text>
                                        <TextInput
                                            style={[styles.configInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                            value={selectedProvider.apiEndpoint || ''}
                                            placeholder="https://api.example.com"
                                            placeholderTextColor={colors.textSecondary}
                                        />
                                    </View>
                                    <View style={styles.configRow}>
                                        <Text style={[styles.configLabel, { color: colors.textSecondary }]}>API Key</Text>
                                        <TextInput
                                            style={[styles.configInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                            value="••••••••••••••••"
                                            secureTextEntry
                                        />
                                    </View>
                                    <View style={styles.configRow}>
                                        <Text style={[styles.configLabel, { color: colors.textSecondary }]}>Models ({selectedProvider.models.length})</Text>
                                        <View style={styles.modelsList}>
                                            {selectedProvider.models.map((model) => (
                                                <View key={model} style={[styles.modelItem, { backgroundColor: colors.background }]}>
                                                    <Text style={[styles.modelItemText, { color: colors.text }]}>{model}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.modalFooter}>
                                    <TouchableOpacity
                                        style={[styles.modalButton, { backgroundColor: colors.background }]}
                                        onPress={() => setSelectedProvider(null)}
                                    >
                                        <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.modalButton, { backgroundColor: colors.primary }]}
                                        onPress={() => {
                                            Alert.alert('Saved', 'Provider configuration saved');
                                            setSelectedProvider(null);
                                        }}
                                    >
                                        <Text style={[styles.modalButtonText, { color: '#fff' }]}>Save</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
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
    statChip: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 18,
        fontWeight: '700',
    },
    statLabel: {
        fontSize: 10,
        marginTop: 2,
    },
    filterBar: {
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 8,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 14,
    },
    filterButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    filterButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
        borderWidth: 1,
    },
    filterButtonText: {
        fontSize: 13,
        fontWeight: '500',
    },
    list: {
        flex: 1,
        paddingHorizontal: 16,
    },
    providerCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        marginBottom: 12,
    },
    providerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    providerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    providerIcon: {
        fontSize: 32,
    },
    providerName: {
        fontSize: 16,
        fontWeight: '600',
    },
    providerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    typeBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    typeText: {
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 11,
    },
    modelsSection: {
        marginTop: 12,
    },
    modelsLabel: {
        fontSize: 11,
        marginBottom: 6,
    },
    modelTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    modelTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    modelText: {
        fontSize: 11,
    },
    moreModels: {
        fontSize: 11,
        alignSelf: 'center',
    },
    cardActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
    },
    actionText: {
        fontSize: 12,
        fontWeight: '500',
    },
    addButton: {
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
    },
    modalIcon: {
        fontSize: 32,
    },
    modalTitle: {
        flex: 1,
        fontSize: 20,
        fontWeight: '600',
    },
    modalBody: {
        gap: 16,
    },
    configRow: {
        gap: 8,
    },
    configLabel: {
        fontSize: 12,
    },
    configInput: {
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        fontSize: 14,
    },
    modelsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    modelItem: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
    },
    modelItemText: {
        fontSize: 12,
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
    },
    modalButton: {
        flex: 1,
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    modalButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});

export default ProvidersScreen;
