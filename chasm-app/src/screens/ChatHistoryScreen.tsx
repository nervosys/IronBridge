// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import React from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChatContext } from '../context/ChatContext';
import { useTheme } from '../context/ThemeContext';
import { ChatSession } from '../api/chat';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type ChatHistoryScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ChatHistory'>;

interface Props {
    navigation: ChatHistoryScreenNavigationProp;
}

export function ChatHistoryScreen({ navigation }: Props) {
    const { colors, isDark } = useTheme();
    const { sessions, activeSessionId, setActiveSession, deleteSession } = useChatContext();

    const handleSelectSession = (session: ChatSession) => {
        setActiveSession(session.id);
        navigation.goBack();
    };

    const handleDeleteSession = (session: ChatSession) => {
        Alert.alert(
            'Delete Chat',
            `Are you sure you want to delete "${session.title}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => deleteSession(session.id),
                },
            ]
        );
    };

    const formatDate = (timestamp: number): string => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (days === 1) {
            return 'Yesterday';
        } else if (days < 7) {
            return date.toLocaleDateString([], { weekday: 'long' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    };

    const getPreviewText = (session: ChatSession): string => {
        const lastMessage = session.messages[session.messages.length - 1];
        if (!lastMessage) return 'No messages';
        return lastMessage.content.substring(0, 100) + (lastMessage.content.length > 100 ? '...' : '');
    };

    const renderSession = ({ item }: { item: ChatSession }) => {
        const isActive = item.id === activeSessionId;

        return (
            <TouchableOpacity
                style={[
                    styles.sessionCard,
                    { backgroundColor: colors.card },
                    isActive && [styles.sessionCardActive, { borderColor: colors.primary }]
                ]}
                onPress={() => handleSelectSession(item)}
                onLongPress={() => handleDeleteSession(item)}
            >
                <View style={styles.sessionHeader}>
                    <View style={styles.sessionInfo}>
                        <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>
                            {item.title}
                        </Text>
                        <Text style={[styles.sessionDate, { color: colors.textTertiary }]}>{formatDate(item.updatedAt)}</Text>
                    </View>
                </View>
                <Text style={[styles.sessionPreview, { color: colors.textSecondary }]} numberOfLines={2}>
                    {getPreviewText(item)}
                </Text>
                <View style={styles.sessionFooter}>
                    <View style={[styles.providerBadge, { backgroundColor: colors.surface }]}>
                        <Ionicons name="flash" size={12} color={colors.primary} />
                        <Text style={[styles.providerName, { color: colors.textSecondary }]}>{item.provider.name}</Text>
                    </View>
                    <Text style={[styles.messageCount, { color: colors.textTertiary }]}>
                        {item.messages.length} messages
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color={colors.iconSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Chat History</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                Your conversations will appear here
            </Text>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <FlatList
                data={sessions}
                renderItem={renderSession}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={renderEmptyState}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F2F2F7',
    },
    listContent: {
        padding: 16,
        flexGrow: 1,
    },
    sessionCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    sessionCardActive: {
        borderWidth: 2,
        borderColor: '#007AFF',
    },
    sessionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    sessionInfo: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sessionTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#000000',
        flex: 1,
        marginRight: 12,
    },
    sessionDate: {
        fontSize: 13,
        color: '#8E8E93',
    },
    sessionPreview: {
        fontSize: 14,
        color: '#8E8E93',
        lineHeight: 20,
        marginBottom: 12,
    },
    sessionFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    providerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E5F2FF',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    providerName: {
        fontSize: 12,
        color: '#007AFF',
        fontWeight: '500',
        marginLeft: 4,
    },
    messageCount: {
        fontSize: 12,
        color: '#8E8E93',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#000000',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 15,
        color: '#8E8E93',
        textAlign: 'center',
        marginTop: 8,
    },
});
