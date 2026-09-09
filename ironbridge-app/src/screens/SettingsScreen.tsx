// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Linking,
    TextInput,
    Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { getStats, getProviders } from '../api';
import type { Statistics as Stats, Provider } from '@ironbridge/shared';
import { useTheme, ThemeMode } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import {
    loadApiSettings as loadSettings,
    saveApiSettings as saveSettings,
    testApiConnection,
    getDefaultHost,
    DEFAULT_PORT,
} from '../api/client';

type SettingsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

export function SettingsScreen() {
    const navigation = useNavigation<SettingsNavigationProp>();
    const { colors, mode, setThemeMode, isDark } = useTheme();
    const { authenticatedProviders } = useAuth();
    const queryClient = useQueryClient();
    const [apiHost, setApiHost] = useState(getDefaultHost());
    const [apiPort, setApiPort] = useState(DEFAULT_PORT);
    const [isEditingApi, setIsEditingApi] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');

    // Load saved API settings
    useEffect(() => {
        loadApiSettings();
    }, []);

    const loadApiSettings = async () => {
        const { host, port } = await loadSettings();
        setApiHost(host);
        setApiPort(port);
    };

    const handleSaveApiSettings = async () => {
        try {
            await saveSettings(apiHost, apiPort);
            setIsEditingApi(false);
            // Invalidate all queries to refetch with new API
            queryClient.invalidateQueries();
            testConnection();
        } catch (error) {
            Alert.alert('Error', 'Failed to save API settings');
        }
    };

    const testConnection = async () => {
        setConnectionStatus('checking');
        const success = await testApiConnection();
        setConnectionStatus(success ? 'connected' : 'error');
    };

    useEffect(() => {
        testConnection();
    }, []);

    const {
        data: stats,
        isLoading: statsLoading,
        refetch: refetchStats,
        isRefetching: statsRefetching,
    } = useQuery({
        queryKey: ['stats'],
        queryFn: getStats,
    });

    const {
        data: providers,
        isLoading: providersLoading,
        refetch: refetchProviders,
        isRefetching: providersRefetching,
    } = useQuery({
        queryKey: ['providers'],
        queryFn: getProviders,
        select: (data) => Array.isArray(data) ? data : [],
    });

    const handleRefresh = () => {
        refetchStats();
        refetchProviders();
    };

    const openDocs = () => {
        Linking.openURL('https://github.com/nervosys/IronBridge');
    };

    const isLoading = statsLoading || providersLoading;
    const isRefetching = statsRefetching || providersRefetching;

    if (isLoading) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const themeModes: { mode: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
        { mode: 'light', label: 'Light', icon: 'sunny' },
        { mode: 'dark', label: 'Dark', icon: 'moon' },
        { mode: 'system', label: 'System', icon: 'phone-portrait-outline' },
    ];

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            refreshControl={
                <RefreshControl
                    refreshing={isRefetching}
                    onRefresh={handleRefresh}
                    tintColor={colors.primary}
                />
            }
        >
            {/* API Server Section */}
            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>API Server</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <View style={styles.statRow}>
                        <View style={styles.connectionInfo}>
                            <Ionicons
                                name={connectionStatus === 'connected' ? 'checkmark-circle' : connectionStatus === 'error' ? 'close-circle' : 'sync'}
                                size={20}
                                color={connectionStatus === 'connected' ? colors.success : connectionStatus === 'error' ? colors.error : colors.warning}
                            />
                            <Text style={[styles.statLabel, { color: colors.text, marginLeft: 8 }]}>
                                {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'error' ? 'Not Connected' : 'Checking...'}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={testConnection}>
                            <Ionicons name="refresh" size={20} color={colors.primary} />
                        </TouchableOpacity>
                    </View>
                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                    {isEditingApi ? (
                        <>
                            <View style={styles.inputRow}>
                                <Text style={[styles.inputLabel, { color: colors.text }]}>Host</Text>
                                <TextInput
                                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                                    value={apiHost}
                                    onChangeText={setApiHost}
                                    placeholder="localhost or IP"
                                    placeholderTextColor={colors.placeholder}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                            </View>
                            <View style={styles.inputRow}>
                                <Text style={[styles.inputLabel, { color: colors.text }]}>Port</Text>
                                <TextInput
                                    style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                                    value={apiPort}
                                    onChangeText={setApiPort}
                                    placeholder="8787"
                                    placeholderTextColor={colors.placeholder}
                                    keyboardType="number-pad"
                                />
                            </View>
                            <View style={styles.buttonRow}>
                                <TouchableOpacity
                                    style={[styles.cancelButton, { borderColor: colors.border }]}
                                    onPress={() => {
                                        setIsEditingApi(false);
                                        loadApiSettings();
                                    }}
                                >
                                    <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.saveButton, { backgroundColor: colors.primary }]}
                                    onPress={handleSaveApiSettings}
                                >
                                    <Text style={styles.saveButtonText}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <TouchableOpacity style={styles.linkRow} onPress={() => setIsEditingApi(true)}>
                            <View style={styles.linkInfo}>
                                <Ionicons name="server-outline" size={20} color={colors.icon} />
                                <Text style={[styles.statLabel, { color: colors.text, marginLeft: 12 }]}>
                                    {apiHost}:{apiPort}
                                </Text>
                            </View>
                            <Ionicons name="pencil" size={16} color={colors.iconSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Appearance Section */}
            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Appearance</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    {themeModes.map((item, index) => (
                        <React.Fragment key={item.mode}>
                            {index > 0 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
                            <TouchableOpacity
                                style={styles.themeRow}
                                onPress={() => setThemeMode(item.mode)}
                            >
                                <View style={styles.themeInfo}>
                                    <Ionicons
                                        name={item.icon}
                                        size={20}
                                        color={mode === item.mode ? colors.primary : colors.textTertiary}
                                    />
                                    <Text style={[
                                        styles.themeLabel,
                                        { color: colors.text }
                                    ]}>
                                        {item.label}
                                    </Text>
                                </View>
                                {mode === item.mode && (
                                    <Ionicons
                                        name="checkmark"
                                        size={20}
                                        color={colors.primary}
                                    />
                                )}
                            </TouchableOpacity>
                        </React.Fragment>
                    ))}
                </View>
            </View>

            {/* Connected Accounts Section */}
            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Authentication</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <TouchableOpacity
                        style={styles.linkRow}
                        onPress={() => navigation.navigate('OAuthLogin')}
                    >
                        <View style={styles.linkInfo}>
                            <Ionicons name="key-outline" size={20} color={colors.icon} />
                            <View style={styles.linkTextContainer}>
                                <Text style={[styles.linkText, { color: colors.text }]}>Connected Accounts</Text>
                                {authenticatedProviders.length > 0 && (
                                    <Text style={[styles.linkSubtext, { color: colors.textTertiary }]}>
                                        {authenticatedProviders.length} account{authenticatedProviders.length !== 1 ? 's' : ''} connected
                                    </Text>
                                )}
                            </View>
                        </View>
                        <View style={styles.linkBadge}>
                            {authenticatedProviders.length > 0 && (
                                <View style={[styles.connectedBadge, { backgroundColor: colors.success + '20' }]}>
                                    <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                                    <Text style={[styles.connectedBadgeText, { color: colors.success }]}>
                                        {authenticatedProviders.length}
                                    </Text>
                                </View>
                            )}
                            <Ionicons name="chevron-forward" size={20} color={colors.iconSecondary} />
                        </View>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Statistics Section */}
            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Statistics</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <View style={styles.statRow}>
                        <Text style={[styles.statLabel, { color: colors.text }]}>Total Sessions</Text>
                        <Text style={[styles.statValue, { color: colors.textTertiary }]}>{stats?.totalSessions ?? 0}</Text>
                    </View>
                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                    <View style={styles.statRow}>
                        <Text style={[styles.statLabel, { color: colors.text }]}>Total Messages</Text>
                        <Text style={[styles.statValue, { color: colors.textTertiary }]}>{stats?.totalMessages ?? 0}</Text>
                    </View>
                </View>
            </View>

            {stats?.sessionsByProvider && stats.sessionsByProvider.length > 0 && (
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Sessions by Provider</Text>
                    <View style={[styles.card, { backgroundColor: colors.card }]}>
                        {stats.sessionsByProvider.map((item, index) => (
                            <React.Fragment key={item.provider}>
                                {index > 0 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
                                <View style={styles.statRow}>
                                    <Text style={[styles.statLabel, { color: colors.text }]}>{item.provider}</Text>
                                    <Text style={[styles.statValue, { color: colors.textTertiary }]}>{item.count}</Text>
                                </View>
                            </React.Fragment>
                        ))}
                    </View>
                </View>
            )}

            {providers && providers.length > 0 && (
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Connected Providers</Text>
                    <View style={[styles.card, { backgroundColor: colors.card }]}>
                        {providers.map((provider, index) => (
                            <React.Fragment key={provider.id}>
                                {index > 0 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
                                <View style={styles.providerRow}>
                                    <View style={styles.providerInfo}>
                                        <Ionicons
                                            name="checkmark-circle"
                                            size={20}
                                            color={colors.success}
                                        />
                                        <Text style={[styles.providerName, { color: colors.text }]}>{provider.name}</Text>
                                    </View>
                                    <Text style={[styles.providerCount, { color: colors.textTertiary }]}>
                                        {provider.status}
                                    </Text>
                                </View>
                            </React.Fragment>
                        ))}
                    </View>
                </View>
            )}

            <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>About</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <TouchableOpacity style={styles.linkRow} onPress={openDocs}>
                        <View style={styles.linkInfo}>
                            <Ionicons name="book-outline" size={20} color={colors.primary} />
                            <Text style={[styles.linkText, { color: colors.primary }]}>Documentation</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.iconSecondary} />
                    </TouchableOpacity>
                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                    <View style={styles.statRow}>
                        <Text style={[styles.statLabel, { color: colors.text }]}>Version</Text>
                        <Text style={[styles.statValue, { color: colors.textTertiary }]}>
                            {Constants.expoConfig?.version ?? 'unknown'}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.footer}>
                <Text style={[styles.footerText, { color: colors.textSecondary }]}>Chat Session Manager</Text>
                <Text style={[styles.footerSubtext, { color: colors.textTertiary }]}>
                    Unified chat history management
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    section: {
        marginTop: 24,
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 8,
        marginLeft: 16,
    },
    card: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    statLabel: {
        fontSize: 16,
    },
    statValue: {
        fontSize: 16,
    },
    themeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    themeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    themeLabel: {
        fontSize: 16,
        marginLeft: 12,
    },
    providerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    providerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    providerName: {
        fontSize: 16,
        marginLeft: 12,
    },
    providerCount: {
        fontSize: 14,
    },
    linkRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    linkInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    linkTextContainer: {
        marginLeft: 12,
    },
    linkText: {
        fontSize: 16,
    },
    linkSubtext: {
        fontSize: 12,
        marginTop: 2,
    },
    linkBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    connectedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    connectedBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        marginLeft: 16,
    },
    connectionInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    inputRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    inputLabel: {
        fontSize: 16,
        width: 60,
    },
    input: {
        flex: 1,
        fontSize: 16,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderRadius: 8,
        marginLeft: 12,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 12,
    },
    cancelButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        borderWidth: 1,
    },
    cancelButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    saveButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    footer: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    footerText: {
        fontSize: 16,
        fontWeight: '600',
    },
    footerSubtext: {
        fontSize: 14,
        marginTop: 4,
    },
});
