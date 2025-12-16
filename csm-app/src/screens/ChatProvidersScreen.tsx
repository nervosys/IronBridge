import React, { useState } from 'react';
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
    Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChatContext } from '../context/ChatContext';
import {
    ChatProvider,
    ChatProviderType,
    DEFAULT_PROVIDERS,
    testProviderConnection,
    generateId,
    OAUTH_CONFIGS,
} from '../api/chat';

const PROVIDER_ICONS: Record<ChatProviderType, keyof typeof Ionicons.glyphMap> = {
    openai: 'logo-electron',
    anthropic: 'sparkles',
    'azure-openai': 'cloud',
    openrouter: 'git-network-outline',
    groq: 'flash-outline',
    together: 'people-outline',
    custom: 'code-slash-outline',
};

export function ChatProvidersScreen() {
    const { providers, updateProvider, addProvider, removeProvider } = useChatContext();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [testingId, setTestingId] = useState<string | null>(null);
    const [editingProvider, setEditingProvider] = useState<ChatProvider | null>(null);

    const handleToggleEnabled = (provider: ChatProvider) => {
        // Check if API key is required
        if (!provider.isEnabled && !provider.apiKey && !provider.oauthToken) {
            Alert.alert(
                'API Key Required',
                `Please add an API key for ${provider.name} before enabling.`,
                [{ text: 'OK' }]
            );
            return;
        }
        updateProvider({ ...provider, isEnabled: !provider.isEnabled });
    };

    const handleGetApiKey = async (provider: ChatProvider) => {
        const oauthConfig = OAUTH_CONFIGS[provider.type];
        if (!oauthConfig) {
            Alert.alert('Not Available', `API key setup is not available for ${provider.name}`);
            return;
        }

        // Open the provider's developer console to get an API key
        const apiKeyUrls: Record<string, string> = {
            openai: 'https://platform.openai.com/api-keys',
            anthropic: 'https://console.anthropic.com/settings/keys',
        };

        const url = apiKeyUrls[provider.type];
        if (url) {
            Alert.alert(
                `Get ${provider.name} API Key`,
                'You will be redirected to the developer console. Create or copy an API key, then paste it in the API Key field below.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Open',
                        onPress: () => Linking.openURL(url),
                    },
                ]
            );
        }
    };

    const handleSetDefault = (provider: ChatProvider) => {
        // Unset other defaults
        providers.forEach(p => {
            if (p.isDefault && p.id !== provider.id) {
                updateProvider({ ...p, isDefault: false });
            }
        });
        updateProvider({ ...provider, isDefault: true });
    };

    const handleTestConnection = async (provider: ChatProvider) => {
        setTestingId(provider.id);
        try {
            const success = await testProviderConnection(provider);
            Alert.alert(
                success ? 'Connection Successful' : 'Connection Failed',
                success
                    ? `Successfully connected to ${provider.name}`
                    : `Could not connect to ${provider.name}. Please check your settings.`
            );
        } catch (error: any) {
            Alert.alert('Connection Failed', error.message);
        } finally {
            setTestingId(null);
        }
    };

    const handleSaveProvider = () => {
        if (!editingProvider) return;
        updateProvider(editingProvider);
        setEditingProvider(null);
    };

    const handleDeleteProvider = (provider: ChatProvider) => {
        Alert.alert(
            'Delete Provider',
            `Are you sure you want to delete ${provider.name}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => removeProvider(provider.id),
                },
            ]
        );
    };

    const handleAddCustomProvider = () => {
        const newProvider: ChatProvider = {
            id: generateId(),
            type: 'custom',
            name: 'Custom Provider',
            baseUrl: 'https://api.example.com/v1',
            model: 'model-name',
            apiKey: '',
            isEnabled: false,
        };
        addProvider(newProvider);
        setExpandedId(newProvider.id);
    };

    const renderProvider = (provider: ChatProvider) => {
        const isExpanded = expandedId === provider.id;
        const isTesting = testingId === provider.id;
        const icon = PROVIDER_ICONS[provider.type] || 'server-outline';

        return (
            <View key={provider.id} style={styles.providerCard}>
                <TouchableOpacity
                    style={styles.providerHeader}
                    onPress={() => setExpandedId(isExpanded ? null : provider.id)}
                >
                    <View style={styles.providerInfo}>
                        <View style={[
                            styles.providerIcon,
                            provider.isEnabled && styles.providerIconEnabled,
                        ]}>
                            <Ionicons
                                name={icon}
                                size={20}
                                color={provider.isEnabled ? '#007AFF' : '#8E8E93'}
                            />
                        </View>
                        <View style={styles.providerText}>
                            <Text style={styles.providerName}>{provider.name}</Text>
                            <Text style={styles.providerModel}>{provider.model}</Text>
                        </View>
                    </View>
                    <View style={styles.providerActions}>
                        {provider.isDefault && (
                            <View style={styles.defaultBadge}>
                                <Text style={styles.defaultBadgeText}>Default</Text>
                            </View>
                        )}
                        <Switch
                            value={provider.isEnabled}
                            onValueChange={() => handleToggleEnabled(provider)}
                            trackColor={{ false: '#E5E5EA', true: '#34C759' }}
                        />
                        <Ionicons
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={20}
                            color="#8E8E93"
                            style={styles.chevron}
                        />
                    </View>
                </TouchableOpacity>

                {isExpanded && (
                    <View style={styles.providerDetails}>
                        {/* Get API Key Button for supported providers */}
                        {['openai', 'anthropic'].includes(provider.type) && (
                            <TouchableOpacity
                                style={styles.oauthButton}
                                onPress={() => handleGetApiKey(provider)}
                            >
                                <Ionicons
                                    name={provider.type === 'openai' ? 'logo-electron' : 'sparkles'}
                                    size={20}
                                    color="#FFFFFF"
                                />
                                <Text style={styles.oauthButtonText}>
                                    Get {provider.type === 'openai' ? 'OpenAI' : 'Claude'} API Key
                                </Text>
                            </TouchableOpacity>
                        )}

                        {/* API Key */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>API Key</Text>
                            <TextInput
                                style={styles.input}
                                value={editingProvider?.id === provider.id
                                    ? editingProvider.apiKey
                                    : provider.apiKey}
                                onChangeText={(text) =>
                                    setEditingProvider({
                                        ...(editingProvider || provider),
                                        id: provider.id,
                                        apiKey: text
                                    })
                                }
                                onBlur={handleSaveProvider}
                                placeholder="Enter API key"
                                placeholderTextColor="#8E8E93"
                                secureTextEntry
                                autoCapitalize="none"
                            />
                        </View>

                        {/* Base URL */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Base URL</Text>
                            <TextInput
                                style={styles.input}
                                value={editingProvider?.id === provider.id
                                    ? editingProvider.baseUrl
                                    : provider.baseUrl}
                                onChangeText={(text) =>
                                    setEditingProvider({
                                        ...(editingProvider || provider),
                                        id: provider.id,
                                        baseUrl: text
                                    })
                                }
                                onBlur={handleSaveProvider}
                                placeholder="https://api.example.com/v1"
                                placeholderTextColor="#8E8E93"
                                autoCapitalize="none"
                                keyboardType="url"
                            />
                        </View>

                        {/* Model */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Model</Text>
                            <TextInput
                                style={styles.input}
                                value={editingProvider?.id === provider.id
                                    ? editingProvider.model
                                    : provider.model}
                                onChangeText={(text) =>
                                    setEditingProvider({
                                        ...(editingProvider || provider),
                                        id: provider.id,
                                        model: text
                                    })
                                }
                                onBlur={handleSaveProvider}
                                placeholder="Model name"
                                placeholderTextColor="#8E8E93"
                                autoCapitalize="none"
                            />
                        </View>

                        {/* Actions */}
                        <View style={styles.detailActions}>
                            <TouchableOpacity
                                style={[styles.actionButton, styles.testButton]}
                                onPress={() => handleTestConnection(provider)}
                                disabled={isTesting}
                            >
                                {isTesting ? (
                                    <ActivityIndicator size="small" color="#007AFF" />
                                ) : (
                                    <>
                                        <Ionicons name="flash-outline" size={16} color="#007AFF" />
                                        <Text style={styles.testButtonText}>Test</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            {!provider.isDefault && provider.isEnabled && (
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.defaultButton]}
                                    onPress={() => handleSetDefault(provider)}
                                >
                                    <Ionicons name="star-outline" size={16} color="#FF9500" />
                                    <Text style={styles.defaultButtonText}>Set Default</Text>
                                </TouchableOpacity>
                            )}

                            {provider.type === 'custom' && (
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.deleteButton]}
                                    onPress={() => handleDeleteProvider(provider)}
                                >
                                    <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                                    <Text style={styles.deleteButtonText}>Delete</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}
            </View>
        );
    };

    // Group providers by type (mobile-compatible only - no local providers)
    const cloudProviders = providers.filter(p =>
        ['openai', 'anthropic', 'azure-openai', 'groq', 'openrouter', 'together'].includes(p.type)
    );
    const customProviders = providers.filter(p => p.type === 'custom');

    return (
        <ScrollView style={styles.container}>
            {/* Quick Setup */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Quick Setup</Text>
                <Text style={styles.sectionSubtitle}>
                    Get API keys from your provider accounts
                </Text>
                <View style={styles.oauthButtonsRow}>
                    <TouchableOpacity
                        style={[styles.oauthQuickButton, { backgroundColor: '#10A37F' }]}
                        onPress={() => {
                            const openaiProvider = providers.find(p => p.type === 'openai');
                            if (openaiProvider) handleGetApiKey(openaiProvider);
                        }}
                    >
                        <Ionicons name="logo-electron" size={24} color="#FFFFFF" />
                        <Text style={styles.oauthQuickButtonText}>OpenAI</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.oauthQuickButton, { backgroundColor: '#D4A06F' }]}
                        onPress={() => {
                            const anthropicProvider = providers.find(p => p.type === 'anthropic');
                            if (anthropicProvider) handleGetApiKey(anthropicProvider);
                        }}
                    >
                        <Ionicons name="sparkles" size={24} color="#FFFFFF" />
                        <Text style={styles.oauthQuickButtonText}>Claude</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Cloud Providers */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Cloud Providers</Text>
                {cloudProviders.map(renderProvider)}
            </View>

            {/* Custom Providers */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Custom Providers</Text>
                {customProviders.length > 0 ? (
                    customProviders.map(renderProvider)
                ) : (
                    <Text style={styles.emptyText}>
                        No custom providers configured
                    </Text>
                )}
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={handleAddCustomProvider}
                >
                    <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
                    <Text style={styles.addButtonText}>Add Custom Provider</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    API keys are stored locally on your device
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F2F7',
    },
    section: {
        marginTop: 24,
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8E8E93',
        textTransform: 'uppercase',
        marginBottom: 8,
        marginLeft: 16,
    },
    sectionSubtitle: {
        fontSize: 13,
        color: '#8E8E93',
        marginBottom: 12,
        marginLeft: 16,
    },
    providerCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginBottom: 8,
        overflow: 'hidden',
    },
    providerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    providerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    providerIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#F2F2F7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    providerIconEnabled: {
        backgroundColor: '#E5F2FF',
    },
    providerText: {
        marginLeft: 12,
        flex: 1,
    },
    providerName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000000',
    },
    providerModel: {
        fontSize: 13,
        color: '#8E8E93',
        marginTop: 2,
    },
    providerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    defaultBadge: {
        backgroundColor: '#FFF3E0',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        marginRight: 12,
    },
    defaultBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FF9500',
    },
    chevron: {
        marginLeft: 8,
    },
    providerDetails: {
        padding: 16,
        paddingTop: 0,
        borderTopWidth: 1,
        borderTopColor: '#E5E5EA',
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: '#8E8E93',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F2F2F7',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: '#000000',
    },
    detailActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
    },
    testButton: {
        backgroundColor: '#E5F2FF',
    },
    testButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#007AFF',
        marginLeft: 6,
    },
    defaultButton: {
        backgroundColor: '#FFF3E0',
    },
    defaultButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#FF9500',
        marginLeft: 6,
    },
    deleteButton: {
        backgroundColor: '#FFEBEB',
    },
    deleteButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#FF3B30',
        marginLeft: 6,
    },
    oauthButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#007AFF',
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 16,
        gap: 8,
    },
    oauthButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    oauthButtonsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    oauthQuickButton: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        paddingVertical: 16,
        gap: 8,
    },
    oauthQuickButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    emptyText: {
        fontSize: 14,
        color: '#8E8E93',
        textAlign: 'center',
        paddingVertical: 16,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginTop: 8,
    },
    addButtonText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#007AFF',
        marginLeft: 8,
    },
    footer: {
        padding: 24,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 13,
        color: '#8E8E93',
        textAlign: 'center',
    },
});
