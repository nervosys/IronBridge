// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getSessions, Session } from '../api';
import { RootStackParamList } from '../navigation/types';
import { formatDate } from '../utils/formatDate';
import { useTheme } from '../context/ThemeContext';

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Sessions'>;
};

const providerIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
    copilot: 'logo-github',
    chatgpt: 'chatbubble-ellipses-outline',
    claude: 'sparkles-outline',
    ollama: 'cube-outline',
    'lm-studio': 'desktop-outline',
    cursor: 'code-slash-outline',
    default: 'chatbubbles-outline',
};

const providerColors: Record<string, string> = {
    copilot: '#6E40C9',
    chatgpt: '#10A37F',
    claude: '#D97706',
    ollama: '#3B82F6',
    'lm-studio': '#8B5CF6',
    cursor: '#00D9FF',
    default: '#007AFF',
};

export function SessionsScreen({ navigation }: Props) {
    const { colors } = useTheme();

    const {
        data: sessions,
        isLoading,
        error,
        refetch,
        isRefetching,
    } = useQuery({
        queryKey: ['sessions'],
        queryFn: () => getSessions({ limit: 100 }),
        select: (data) => Array.isArray(data) ? data : [],
    });

    const getProviderIcon = (provider: string) =>
        providerIcons[provider.toLowerCase()] || providerIcons.default;

    const getProviderColor = (provider: string) =>
        providerColors[provider.toLowerCase()] || providerColors.default;

    const renderSession = ({ item }: { item: Session }) => (
        <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card }]}
            onPress={() =>
                navigation.navigate('SessionDetail', {
                    sessionId: item.id,
                    sessionTitle: item.title,
                })
            }
        >
            <View style={styles.cardHeader}>
                <View
                    style={[
                        styles.iconContainer,
                        { backgroundColor: `${getProviderColor(item.provider)}20` },
                    ]}
                >
                    <Ionicons
                        name={getProviderIcon(item.provider)}
                        size={20}
                        color={getProviderColor(item.provider)}
                    />
                </View>
                <View style={styles.headerText}>
                    <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                        {item.title || 'Untitled Session'}
                    </Text>
                    <Text style={[styles.modelText, { color: colors.textTertiary }]}>
                        {item.model || item.provider}
                    </Text>
                </View>
            </View>
            <View style={styles.cardFooter}>
                <View style={styles.statsContainer}>
                    <Ionicons name="chatbubbles-outline" size={14} color={colors.textTertiary} />
                    <Text style={[styles.statsText, { color: colors.textTertiary }]}>{item.messageCount} messages</Text>
                </View>
                <Text style={[styles.dateText, { color: colors.textTertiary }]}>
                    {formatDate(item.updatedAt)}
                </Text>
            </View>
        </TouchableOpacity>
    );

    if (isLoading) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textTertiary }]}>Loading sessions...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <Ionicons name="cloud-offline-outline" size={48} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]}>Failed to load sessions</Text>
                <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
                    <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <FlatList
                data={sessions}
                renderItem={renderSession}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={refetch}
                        tintColor={colors.primary}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Ionicons name="chatbubbles-outline" size={48} color={colors.textTertiary} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No sessions found</Text>
                    </View>
                }
            />
        </View>
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
        padding: 20,
    },
    list: {
        padding: 16,
    },
    card: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerText: {
        flex: 1,
        marginLeft: 12,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        lineHeight: 22,
    },
    modelText: {
        fontSize: 13,
        marginTop: 2,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statsText: {
        fontSize: 13,
        marginLeft: 6,
    },
    dateText: {
        fontSize: 13,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
    },
    errorText: {
        marginTop: 12,
        fontSize: 17,
        fontWeight: '600',
    },
    retryButton: {
        marginTop: 20,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    empty: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 17,
        fontWeight: '600',
    },
});
