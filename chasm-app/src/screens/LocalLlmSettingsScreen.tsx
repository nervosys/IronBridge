// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

// =============================================================================
// CSM App - Local LLM Settings Screen
// =============================================================================
// Configure LAN-based LLM servers and on-device models

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Switch,
    Alert,
    ActivityIndicator,
    RefreshControl,
    Modal,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import {
    localLlmService,
    LocalLlmProvider,
    LocalLlmProviderType,
    OnDeviceModel,
    RECOMMENDED_MODELS,
} from '../services/localLlm';

// Provider type icons and colors
const PROVIDER_CONFIG: Record<LocalLlmProviderType, { icon: string; color: string }> = {
    ollama: { icon: '🦙', color: '#ffffff' },
    lmstudio: { icon: '🎛️', color: '#6366f1' },
    llamacpp: { icon: '⚡', color: '#f97316' },
    jan: { icon: '🤖', color: '#2563eb' },
    gpt4all: { icon: '🧠', color: '#22c55e' },
    localai: { icon: '🏠', color: '#14b8a6' },
    vllm: { icon: '🚀', color: '#3b82f6' },
    koboldcpp: { icon: '🐉', color: '#eab308' },
    textgenwebui: { icon: '🌐', color: '#a855f7' },
    custom: { icon: '⚙️', color: '#6b7280' },
};

export function LocalLlmSettingsScreen() {
    const { colors, isDark } = useTheme();
    const [providers, setProviders] = useState<LocalLlmProvider[]>([]);
    const [onDeviceModels, setOnDeviceModels] = useState<OnDeviceModel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [checkingHealth, setCheckingHealth] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingProvider, setEditingProvider] = useState<LocalLlmProvider | null>(null);
    const [activeTab, setActiveTab] = useState<'lan' | 'ondevice'>('lan');

    // Load data on mount
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            await localLlmService.initialize();
            const config = localLlmService.getConfig();
            setProviders(config?.providers ?? []);
            setOnDeviceModels(localLlmService.getOnDeviceModels());
        } catch (error) {
            console.error('Failed to load local LLM config:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadData();
        setIsRefreshing(false);
    };

    const handleCheckHealth = async (provider: LocalLlmProvider) => {
        setCheckingHealth(provider.id);
        try {
            const healthy = await localLlmService.checkProviderHealth(provider);
            if (healthy) {
                await localLlmService.discoverModels(provider);
                const config = localLlmService.getConfig();
                setProviders(config?.providers ?? []);
                Alert.alert('Success', `Connected to ${provider.name}!`);
            } else {
                Alert.alert('Connection Failed', `Could not connect to ${provider.name} at ${provider.host}:${provider.port}`);
            }
        } catch (error) {
            Alert.alert('Error', `Failed to check ${provider.name}: ${error}`);
        } finally {
            setCheckingHealth(null);
        }
    };

    const handleToggleProvider = async (provider: LocalLlmProvider) => {
        await localLlmService.updateProvider(provider.id, { isEnabled: !provider.isEnabled });
        const config = localLlmService.getConfig();
        setProviders(config?.providers ?? []);
    };

    const handleDeleteProvider = async (provider: LocalLlmProvider) => {
        Alert.alert(
            'Delete Provider',
            `Remove ${provider.name}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await localLlmService.removeProvider(provider.id);
                        const config = localLlmService.getConfig();
                        setProviders(config?.providers ?? []);
                    },
                },
            ]
        );
    };

    const handleCheckAllProviders = async () => {
        setIsRefreshing(true);
        try {
            await localLlmService.checkAllProviders();
            const config = localLlmService.getConfig();
            setProviders(config?.providers ?? []);
        } catch (error) {
            console.error('Failed to check providers:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const renderProvider = (provider: LocalLlmProvider) => {
        const config = PROVIDER_CONFIG[provider.type] || PROVIDER_CONFIG.custom;
        const isChecking = checkingHealth === provider.id;

        return (
            <View
                key={provider.id}
                style={[styles.providerCard, { backgroundColor: colors.card }]}
            >
                <View style={styles.providerHeader}>
                    <View style={styles.providerInfo}>
                        <Text style={styles.providerIcon}>{config.icon}</Text>
                        <View>
                            <Text style={[styles.providerName, { color: colors.text }]}>
                                {provider.name}
                            </Text>
                            <Text style={[styles.providerEndpoint, { color: colors.textSecondary }]}>
                                {provider.host}:{provider.port}
                            </Text>
                        </View>
                    </View>
                    <Switch
                        value={provider.isEnabled}
                        onValueChange={() => handleToggleProvider(provider)}
                        trackColor={{ false: colors.border, true: colors.primary }}
                    />
                </View>

                {/* Health Status */}
                <View style={styles.healthRow}>
                    <View style={styles.healthStatus}>
                        <View
                            style={[
                                styles.statusDot,
                                {
                                    backgroundColor: provider.isHealthy
                                        ? '#22c55e'
                                        : provider.lastHealthCheck
                                            ? '#ef4444'
                                            : '#6b7280',
                                },
                            ]}
                        />
                        <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                            {provider.isHealthy
                                ? 'Connected'
                                : provider.lastHealthCheck
                                    ? 'Disconnected'
                                    : 'Not checked'}
                        </Text>
                    </View>
                    {provider.models.length > 0 && (
                        <Text style={[styles.modelCount, { color: colors.textTertiary }]}>
                            {provider.models.length} model{provider.models.length !== 1 ? 's' : ''}
                        </Text>
                    )}
                </View>

                {/* Models List */}
                {provider.models.length > 0 && (
                    <View style={styles.modelsList}>
                        {provider.models.slice(0, 3).map((model, idx) => (
                            <View
                                key={idx}
                                style={[styles.modelTag, { backgroundColor: isDark ? '#38383A' : '#F0F0F5' }]}
                            >
                                <Text style={[styles.modelTagText, { color: colors.textSecondary }]}>
                                    {model}
                                </Text>
                            </View>
                        ))}
                        {provider.models.length > 3 && (
                            <Text style={[styles.moreModels, { color: colors.textTertiary }]}>
                                +{provider.models.length - 3} more
                            </Text>
                        )}
                    </View>
                )}

                {/* Actions */}
                <View style={styles.providerActions}>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: isDark ? '#38383A' : '#F0F0F5' }]}
                        onPress={() => handleCheckHealth(provider)}
                        disabled={isChecking}
                    >
                        {isChecking ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <>
                                <Ionicons name="pulse-outline" size={16} color={colors.primary} />
                                <Text style={[styles.actionText, { color: colors.primary }]}>Test</Text>
                            </>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: isDark ? '#38383A' : '#F0F0F5' }]}
                        onPress={() => setEditingProvider(provider)}
                    >
                        <Ionicons name="create-outline" size={16} color={colors.text} />
                        <Text style={[styles.actionText, { color: colors.text }]}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: isDark ? '#38383A' : '#F0F0F5' }]}
                        onPress={() => handleDeleteProvider(provider)}
                    >
                        <Ionicons name="trash-outline" size={16} color="#ef4444" />
                        <Text style={[styles.actionText, { color: '#ef4444' }]}>Delete</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderOnDeviceSection = () => {
        const isAvailable = localLlmService.isOnDeviceAvailable();
        const recommended = localLlmService.getRecommendedModels();

        return (
            <View>
                {/* Availability Notice */}
                <View style={[styles.noticeCard, { backgroundColor: isAvailable ? '#22c55e22' : '#f59e0b22' }]}>
                    <Ionicons
                        name={isAvailable ? 'checkmark-circle' : 'warning'}
                        size={20}
                        color={isAvailable ? '#22c55e' : '#f59e0b'}
                    />
                    <Text style={[styles.noticeText, { color: isAvailable ? '#22c55e' : '#f59e0b' }]}>
                        {isAvailable
                            ? 'On-device inference is available'
                            : 'On-device inference requires a development build (not Expo Go)'}
                    </Text>
                </View>

                {/* Downloaded Models */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Downloaded Models</Text>
                {onDeviceModels.length === 0 ? (
                    <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
                        <Ionicons name="cube-outline" size={32} color={colors.textTertiary} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                            No models downloaded yet
                        </Text>
                    </View>
                ) : (
                    onDeviceModels.map(model => (
                        <View key={model.id} style={[styles.modelCard, { backgroundColor: colors.card }]}>
                            <View style={styles.modelHeader}>
                                <Text style={[styles.modelName, { color: colors.text }]}>{model.name}</Text>
                                {model.isLoaded && (
                                    <View style={[styles.loadedBadge, { backgroundColor: '#22c55e22' }]}>
                                        <Text style={styles.loadedBadgeText}>Loaded</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={[styles.modelDetails, { color: colors.textSecondary }]}>
                                {model.parameters} • {model.quantization} • {localLlmService.formatSize(model.size)}
                            </Text>
                        </View>
                    ))
                )}

                {/* Recommended Models */}
                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>
                    Recommended Models
                </Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                    Small models optimized for mobile devices
                </Text>
                {recommended.map(model => (
                    <View key={model.id} style={[styles.modelCard, { backgroundColor: colors.card }]}>
                        <View style={styles.modelHeader}>
                            <Text style={[styles.modelName, { color: colors.text }]}>{model.name}</Text>
                            <Text style={[styles.modelSize, { color: colors.textTertiary }]}>
                                {localLlmService.formatSize(model.size)}
                            </Text>
                        </View>
                        <Text style={[styles.modelDetails, { color: colors.textSecondary }]}>
                            {model.parameters} • {model.quantization}
                        </Text>
                        <TouchableOpacity
                            style={[styles.downloadButton, { backgroundColor: colors.primary }]}
                            disabled={!isAvailable}
                            onPress={() => Alert.alert('Coming Soon', 'Model download will be available in a future update')}
                        >
                            <Ionicons name="download-outline" size={16} color="#fff" />
                            <Text style={styles.downloadButtonText}>Download</Text>
                        </TouchableOpacity>
                    </View>
                ))}
            </View>
        );
    };

    if (isLoading) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Tab Switcher */}
            <View style={[styles.tabBar, { backgroundColor: colors.card }]}>
                <TouchableOpacity
                    style={[
                        styles.tab,
                        activeTab === 'lan' && { backgroundColor: colors.primary },
                    ]}
                    onPress={() => setActiveTab('lan')}
                >
                    <Ionicons
                        name="wifi-outline"
                        size={18}
                        color={activeTab === 'lan' ? '#fff' : colors.text}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            { color: activeTab === 'lan' ? '#fff' : colors.text },
                        ]}
                    >
                        LAN Servers
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.tab,
                        activeTab === 'ondevice' && { backgroundColor: colors.primary },
                    ]}
                    onPress={() => setActiveTab('ondevice')}
                >
                    <Ionicons
                        name="phone-portrait-outline"
                        size={18}
                        color={activeTab === 'ondevice' ? '#fff' : colors.text}
                    />
                    <Text
                        style={[
                            styles.tabText,
                            { color: activeTab === 'ondevice' ? '#fff' : colors.text },
                        ]}
                    >
                        On-Device
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.primary}
                    />
                }
            >
                {activeTab === 'lan' ? (
                    <>
                        {/* Info Card */}
                        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
                            <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                                Connect to LLM servers running on your local network (same WiFi).
                                Use your computer's IP address, not localhost.
                            </Text>
                        </View>

                        {/* Actions */}
                        <View style={styles.actionsRow}>
                            <TouchableOpacity
                                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                                onPress={() => setShowAddModal(true)}
                            >
                                <Ionicons name="add" size={20} color="#fff" />
                                <Text style={styles.primaryButtonText}>Add Server</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.secondaryButton, { borderColor: colors.border }]}
                                onPress={handleCheckAllProviders}
                            >
                                <Ionicons name="refresh-outline" size={20} color={colors.text} />
                                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                                    Check All
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Providers List */}
                        {providers.length === 0 ? (
                            <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
                                <Ionicons name="server-outline" size={32} color={colors.textTertiary} />
                                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                    No LLM servers configured
                                </Text>
                                <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
                                    Add a server to get started
                                </Text>
                            </View>
                        ) : (
                            providers.map(renderProvider)
                        )}
                    </>
                ) : (
                    renderOnDeviceSection()
                )}
            </ScrollView>

            {/* Add/Edit Modal */}
            <ProviderModal
                visible={showAddModal || editingProvider !== null}
                provider={editingProvider}
                onClose={() => {
                    setShowAddModal(false);
                    setEditingProvider(null);
                }}
                onSave={async (provider) => {
                    if (editingProvider) {
                        await localLlmService.updateProvider(editingProvider.id, provider);
                    } else {
                        await localLlmService.addProvider(provider);
                    }
                    const config = localLlmService.getConfig();
                    setProviders(config?.providers ?? []);
                    setShowAddModal(false);
                    setEditingProvider(null);
                }}
            />
        </View>
    );
}

// =============================================================================
// Provider Modal Component
// =============================================================================

interface ProviderModalProps {
    visible: boolean;
    provider: LocalLlmProvider | null;
    onClose: () => void;
    onSave: (provider: Omit<LocalLlmProvider, 'id'>) => void;
}

function ProviderModal({ visible, provider, onClose, onSave }: ProviderModalProps) {
    const { colors, isDark } = useTheme();
    const [name, setName] = useState('');
    const [type, setType] = useState<LocalLlmProviderType>('ollama');
    const [host, setHost] = useState('');
    const [port, setPort] = useState('');

    useEffect(() => {
        if (provider) {
            setName(provider.name);
            setType(provider.type);
            setHost(provider.host);
            setPort(provider.port.toString());
        } else {
            setName('');
            setType('ollama');
            setHost('');
            setPort('11434');
        }
    }, [provider, visible]);

    const handleSave = () => {
        if (!name.trim() || !host.trim() || !port.trim()) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        const apiPath = type === 'ollama' ? '/api' : '/v1';
        onSave({
            type,
            name: name.trim(),
            host: host.trim(),
            port: parseInt(port, 10),
            apiPath,
            isEnabled: true,
            models: [],
        });
    };

    const providerTypes: { type: LocalLlmProviderType; name: string; defaultPort: string }[] = [
        { type: 'ollama', name: 'Ollama', defaultPort: '11434' },
        { type: 'lmstudio', name: 'LM Studio', defaultPort: '1234' },
        { type: 'llamacpp', name: 'llama.cpp', defaultPort: '8080' },
        { type: 'jan', name: 'Jan', defaultPort: '1337' },
        { type: 'gpt4all', name: 'GPT4All', defaultPort: '4891' },
        { type: 'localai', name: 'LocalAI', defaultPort: '8080' },
        { type: 'vllm', name: 'vLLM', defaultPort: '8000' },
        { type: 'custom', name: 'Custom', defaultPort: '8080' },
    ];

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>
                            {provider ? 'Edit Server' : 'Add Server'}
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalBody}>
                        {/* Provider Type */}
                        <Text style={[styles.inputLabel, { color: colors.text }]}>Server Type</Text>
                        <View style={styles.typeGrid}>
                            {providerTypes.map(pt => (
                                <TouchableOpacity
                                    key={pt.type}
                                    style={[
                                        styles.typeButton,
                                        {
                                            backgroundColor: type === pt.type ? colors.primary : (isDark ? '#38383A' : '#F0F0F5'),
                                            borderColor: type === pt.type ? colors.primary : colors.border,
                                        },
                                    ]}
                                    onPress={() => {
                                        setType(pt.type);
                                        setPort(pt.defaultPort);
                                        if (!name) setName(pt.name);
                                    }}
                                >
                                    <Text style={styles.typeIcon}>{PROVIDER_CONFIG[pt.type]?.icon || '⚙️'}</Text>
                                    <Text
                                        style={[
                                            styles.typeText,
                                            { color: type === pt.type ? '#fff' : colors.text },
                                        ]}
                                    >
                                        {pt.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Name */}
                        <Text style={[styles.inputLabel, { color: colors.text }]}>Display Name</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: isDark ? '#38383A' : '#F0F0F5', color: colors.text }]}
                            value={name}
                            onChangeText={setName}
                            placeholder="My Ollama Server"
                            placeholderTextColor={colors.textTertiary}
                        />

                        {/* Host */}
                        <Text style={[styles.inputLabel, { color: colors.text }]}>Host / IP Address</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: isDark ? '#38383A' : '#F0F0F5', color: colors.text }]}
                            value={host}
                            onChangeText={setHost}
                            placeholder="192.168.1.100"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="default"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        {/* Port */}
                        <Text style={[styles.inputLabel, { color: colors.text }]}>Port</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: isDark ? '#38383A' : '#F0F0F5', color: colors.text }]}
                            value={port}
                            onChangeText={setPort}
                            placeholder="11434"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="number-pad"
                        />

                        {/* Help Text */}
                        <View style={[styles.helpCard, { backgroundColor: isDark ? '#1C1C1E' : '#F8F8F8' }]}>
                            <Ionicons name="help-circle-outline" size={16} color={colors.textTertiary} />
                            <Text style={[styles.helpText, { color: colors.textTertiary }]}>
                                Find your computer's IP address:{'\n'}
                                • Windows: ipconfig{'\n'}
                                • Mac/Linux: ifconfig or ip addr{'\n'}
                                • Look for 192.168.x.x or 10.0.x.x
                            </Text>
                        </View>
                    </ScrollView>

                    <View style={styles.modalFooter}>
                        <TouchableOpacity
                            style={[styles.cancelButton, { borderColor: colors.border }]}
                            onPress={onClose}
                        >
                            <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.saveButton, { backgroundColor: colors.primary }]}
                            onPress={handleSave}
                        >
                            <Text style={styles.saveButtonText}>Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 32,
    },
    tabBar: {
        flexDirection: 'row',
        margin: 16,
        marginBottom: 0,
        borderRadius: 12,
        padding: 4,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        borderRadius: 8,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    primaryButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 10,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    secondaryButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
    },
    secondaryButtonText: {
        fontSize: 15,
        fontWeight: '600',
    },
    providerCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    providerHeader: {
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
    providerIcon: {
        fontSize: 28,
    },
    providerName: {
        fontSize: 16,
        fontWeight: '600',
    },
    providerEndpoint: {
        fontSize: 13,
        marginTop: 2,
    },
    healthRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    healthStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 13,
    },
    modelCount: {
        fontSize: 12,
    },
    modelsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 12,
    },
    modelTag: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    modelTagText: {
        fontSize: 12,
    },
    moreModels: {
        fontSize: 12,
        alignSelf: 'center',
    },
    providerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 8,
        borderRadius: 8,
    },
    actionText: {
        fontSize: 13,
        fontWeight: '500',
    },
    emptyCard: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        borderRadius: 12,
    },
    emptyText: {
        fontSize: 15,
        fontWeight: '500',
        marginTop: 12,
    },
    emptySubtext: {
        fontSize: 13,
        marginTop: 4,
    },
    noticeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    noticeText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '600',
        marginBottom: 8,
    },
    sectionSubtitle: {
        fontSize: 13,
        marginBottom: 12,
    },
    modelCard: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    modelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    modelName: {
        fontSize: 15,
        fontWeight: '600',
    },
    modelSize: {
        fontSize: 13,
    },
    modelDetails: {
        fontSize: 13,
        marginBottom: 12,
    },
    loadedBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    loadedBadgeText: {
        color: '#22c55e',
        fontSize: 11,
        fontWeight: '600',
    },
    downloadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 8,
    },
    downloadButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(128,128,128,0.2)',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    modalBody: {
        padding: 16,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 8,
        marginTop: 16,
    },
    input: {
        borderRadius: 10,
        padding: 14,
        fontSize: 16,
    },
    typeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    typeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
    },
    typeIcon: {
        fontSize: 16,
    },
    typeText: {
        fontSize: 13,
        fontWeight: '500',
    },
    helpCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        padding: 12,
        borderRadius: 8,
        marginTop: 16,
    },
    helpText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 18,
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(128,128,128,0.2)',
    },
    cancelButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 10,
        borderWidth: 1,
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    saveButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 10,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
