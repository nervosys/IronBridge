import React from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Linking,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { getStats, getProviders, Stats, Provider } from '../api';
import { useTheme, ThemeMode } from '../context/ThemeContext';

export function SettingsScreen() {
    const { colors, mode, setThemeMode, isDark } = useTheme();

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
                        <Text style={[styles.statValue, { color: colors.textTertiary }]}>{stats?.total_sessions ?? 0}</Text>
                    </View>
                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                    <View style={styles.statRow}>
                        <Text style={[styles.statLabel, { color: colors.text }]}>Total Messages</Text>
                        <Text style={[styles.statValue, { color: colors.textTertiary }]}>{stats?.total_messages ?? 0}</Text>
                    </View>
                </View>
            </View>

            {stats?.by_provider && Object.keys(stats.by_provider).length > 0 && (
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>Sessions by Provider</Text>
                    <View style={[styles.card, { backgroundColor: colors.card }]}>
                        {Object.entries(stats.by_provider).map(([provider, count], index) => (
                            <React.Fragment key={provider}>
                                {index > 0 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
                                <View style={styles.statRow}>
                                    <Text style={[styles.statLabel, { color: colors.text }]}>{provider}</Text>
                                    <Text style={[styles.statValue, { color: colors.textTertiary }]}>{count}</Text>
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
                                        {provider.session_count} sessions
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
                    <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                    <View style={styles.statRow}>
                        <Text style={[styles.statLabel, { color: colors.text }]}>API Server</Text>
                        <Text style={[styles.statValue, { color: colors.textTertiary }]}>localhost:8787</Text>
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
