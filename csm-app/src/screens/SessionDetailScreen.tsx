import React from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp } from '@react-navigation/native';
import { getSession, Message, SessionWithMessages } from '../api';
import { RootStackParamList } from '../navigation/types';

type Props = {
    route: RouteProp<RootStackParamList, 'SessionDetail'>;
};

export function SessionDetailScreen({ route }: Props) {
    const { sessionId } = route.params;

    const {
        data: session,
        isLoading,
        error,
        refetch,
        isRefetching,
    } = useQuery({
        queryKey: ['session', sessionId],
        queryFn: () => getSession(sessionId),
    });

    const renderMessage = ({ item }: { item: Message }) => {
        const isUser = item.role === 'user';
        const isSystem = item.role === 'system';

        return (
            <View
                style={[
                    styles.messageContainer,
                    isUser ? styles.userMessage : styles.assistantMessage,
                    isSystem && styles.systemMessage,
                ]}
            >
                <View style={styles.messageHeader}>
                    <View style={styles.roleContainer}>
                        <Ionicons
                            name={
                                isUser
                                    ? 'person-outline'
                                    : isSystem
                                        ? 'settings-outline'
                                        : 'sparkles-outline'
                            }
                            size={14}
                            color={isUser ? '#007AFF' : isSystem ? '#8E8E93' : '#10A37F'}
                        />
                        <Text
                            style={[
                                styles.roleText,
                                isUser && styles.userRoleText,
                                isSystem && styles.systemRoleText,
                            ]}
                        >
                            {item.role.charAt(0).toUpperCase() + item.role.slice(1)}
                        </Text>
                    </View>
                    {item.model && (
                        <Text style={styles.modelText}>{item.model}</Text>
                    )}
                </View>
                <Text style={styles.messageContent} selectable>
                    {item.content}
                </Text>
                <Text style={styles.timestampText}>
                    {new Date(item.created_at).toLocaleString()}
                </Text>
            </View>
        );
    };

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading conversation...</Text>
            </View>
        );
    }

    if (error || !session) {
        return (
            <View style={styles.centered}>
                <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
                <Text style={styles.errorText}>Failed to load session</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle} numberOfLines={2}>
                    {session.title || 'Untitled Session'}
                </Text>
                <View style={styles.headerMeta}>
                    <Text style={styles.metaText}>
                        {session.provider} • {session.message_count} messages
                    </Text>
                    <Text style={styles.metaText}>
                        {new Date(session.created_at).toLocaleDateString()}
                    </Text>
                </View>
            </View>
            <FlatList
                data={session.messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.messagesList}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>No messages in this session</Text>
                    </View>
                }
            />
        </View>
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
        padding: 20,
    },
    header: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E5EA',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#000000',
        marginBottom: 8,
    },
    headerMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    metaText: {
        fontSize: 13,
        color: '#8E8E93',
    },
    messagesList: {
        padding: 16,
    },
    messageContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    userMessage: {
        borderLeftWidth: 3,
        borderLeftColor: '#007AFF',
    },
    assistantMessage: {
        borderLeftWidth: 3,
        borderLeftColor: '#10A37F',
    },
    systemMessage: {
        borderLeftWidth: 3,
        borderLeftColor: '#8E8E93',
        opacity: 0.8,
    },
    messageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    roleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    roleText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#10A37F',
        marginLeft: 6,
    },
    userRoleText: {
        color: '#007AFF',
    },
    systemRoleText: {
        color: '#8E8E93',
    },
    modelText: {
        fontSize: 12,
        color: '#8E8E93',
    },
    messageContent: {
        fontSize: 15,
        color: '#000000',
        lineHeight: 22,
    },
    timestampText: {
        fontSize: 11,
        color: '#C7C7CC',
        marginTop: 8,
        textAlign: 'right',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#8E8E93',
    },
    errorText: {
        marginTop: 12,
        fontSize: 17,
        fontWeight: '600',
        color: '#FF3B30',
    },
    empty: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyText: {
        fontSize: 16,
        color: '#8E8E93',
    },
});
