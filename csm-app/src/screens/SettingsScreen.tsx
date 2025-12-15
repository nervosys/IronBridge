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

export function SettingsScreen() {
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
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            refreshControl={
                <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />
            }
        >
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Statistics</Text>
                <View style={styles.card}>
                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Total Sessions</Text>
                        <Text style={styles.statValue}>{stats?.total_sessions ?? 0}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Total Messages</Text>
                        <Text style={styles.statValue}>{stats?.total_messages ?? 0}</Text>
                    </View>
                </View>
            </View>

            {stats?.by_provider && Object.keys(stats.by_provider).length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Sessions by Provider</Text>
                    <View style={styles.card}>
                        {Object.entries(stats.by_provider).map(([provider, count], index) => (
                            <React.Fragment key={provider}>
                                {index > 0 && <View style={styles.divider} />}
                                <View style={styles.statRow}>
                                    <Text style={styles.statLabel}>{provider}</Text>
                                    <Text style={styles.statValue}>{count}</Text>
                                </View>
                            </React.Fragment>
                        ))}
                    </View>
                </View>
            )}

            {providers && providers.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Connected Providers</Text>
                    <View style={styles.card}>
                        {providers.map((provider, index) => (
                            <React.Fragment key={provider.id}>
                                {index > 0 && <View style={styles.divider} />}
                                <View style={styles.providerRow}>
                                    <View style={styles.providerInfo}>
                                        <Ionicons
                                            name="checkmark-circle"
                                            size={20}
                                            color="#34C759"
                                        />
                                        <Text style={styles.providerName}>{provider.name}</Text>
                                    </View>
                                    <Text style={styles.providerCount}>
                                        {provider.session_count} sessions
                                    </Text>
                                </View>
                            </React.Fragment>
                        ))}
                    </View>
                </View>
            )}

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>About</Text>
                <View style={styles.card}>
                    <TouchableOpacity style={styles.linkRow} onPress={openDocs}>
                        <View style={styles.linkInfo}>
                            <Ionicons name="book-outline" size={20} color="#007AFF" />
                            <Text style={styles.linkText}>Documentation</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
                    </TouchableOpacity>
                    <View style={styles.divider} />
                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Version</Text>
                        <Text style={styles.statValue}>1.0.0</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>API Server</Text>
                        <Text style={styles.statValue}>localhost:8787</Text>
                    </View>
                </View>
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>Chat Session Manager</Text>
                <Text style={styles.footerSubtext}>
                    Unified chat history management
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
        color: '#8E8E93',
        textTransform: 'uppercase',
        marginBottom: 8,
        marginLeft: 16,
    },
    card: {
        backgroundColor: '#FFFFFF',
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
        color: '#000000',
    },
    statValue: {
        fontSize: 16,
        color: '#8E8E93',
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
        color: '#000000',
        marginLeft: 12,
    },
    providerCount: {
        fontSize: 14,
        color: '#8E8E93',
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
        color: '#007AFF',
        marginLeft: 12,
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E5EA',
        marginLeft: 16,
    },
    footer: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    footerText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#3C3C43',
    },
    footerSubtext: {
        fontSize: 14,
        color: '#8E8E93',
        marginTop: 4,
    },
});
