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
    Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { getStats, getProviders } from '../api';
import type { Statistics as Stats, Provider } from '@csm/shared';
import { useTheme, ThemeMode } from '../context/ThemeContext';
import { apiClient } from '../api/client';

const API_HOST_KEY = 'csm_api_host';
const DEFAULT_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export function SettingsScreen() {
    const { colors, mode, setThemeMode, isDark } = useTheme();
    const queryClient = useQueryClient();
    const [apiHost, setApiHost] = useState(DEFAULT_HOST);
    const [apiPort, setApiPort] = useState('8787');
    const [isEditingApi, setIsEditingApi] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');

    // Load saved API settings
    useEffect(() => {
        loadApiSettings();
    }, []);

    const loadApiSettings = async () => {
        try {
            const savedSettings = await AsyncStorage.getItem(API_HOST_KEY);
            if (savedSettings) {
                const { host, port } = JSON.parse(savedSettings);
                setApiHost(host || DEFAULT_HOST);
                setApiPort(port || '8787');
            }
        } catch (error) {
            console.error('Failed to load API settings:', error);
        }
    };

    const saveApiSettings = async () => {
        try {
            await AsyncStorage.setItem(API_HOST_KEY, JSON.stringify({ host: apiHost, port: apiPort }));
            apiClient.defaults.baseURL = `http://${apiHost}:${apiPort}`;
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
        try {
            await apiClient.get('/api/stats', { timeout: 5000 });
            setConnectionStatus('connected');
        } catch {
            setConnectionStatus('error');
        }
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
    });

    const handleRefresh = () => {
        refetchStats();
        refetchProviders();
    };

    const openDocs = () => {
        Linking.openURL('https://github.com/nervosys/ChatSessionManager');
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
                                    onPress={saveApiSettings}
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
                                        {provider.sessionCount ?? 0} sessions
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
                        <Text style={[styles.statValue, { color: colors.textTertiary }]}>1.0.0</Text>
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
    },
    linkText: {
        fontSize: 16,
        marginLeft: 12,
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
