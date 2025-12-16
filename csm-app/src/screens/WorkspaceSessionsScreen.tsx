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
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getSessions, Session } from '../api';
import { RootStackParamList } from '../navigation/types';
import { formatDate } from '../utils/formatDate';

type Props = {
    route: RouteProp<RootStackParamList, 'WorkspaceSessions'>;
    navigation: NativeStackNavigationProp<RootStackParamList, 'WorkspaceSessions'>;
};

export function WorkspaceSessionsScreen({ route, navigation }: Props) {
    const { workspaceId } = route.params;

    const {
        data: sessions,
        isLoading,
        error,
        refetch,
        isRefetching,
    } = useQuery({
        queryKey: ['sessions', workspaceId],
        queryFn: () => getSessions({ workspace_id: workspaceId }),
    });

    const renderSession = ({ item }: { item: Session }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() =>
                navigation.navigate('SessionDetail', {
                    sessionId: item.id,
                    sessionTitle: item.title,
                })
            }
        >
            <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title || 'Untitled Session'}
            </Text>
            <Text style={styles.modelText}>{item.model || item.provider}</Text>
            <View style={styles.cardFooter}>
                <View style={styles.statsContainer}>
                    <Ionicons name="chatbubbles-outline" size={14} color="#8E8E93" />
                    <Text style={styles.statsText}>{item.message_count} messages</Text>
                </View>
                <Text style={styles.dateText}>
                    {formatDate(item.updated_at)}
                </Text>
            </View>
        </TouchableOpacity>
    );

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centered}>
                <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
                <Text style={styles.errorText}>Failed to load sessions</Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
                    <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={sessions}
                renderItem={renderSession}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Ionicons name="chatbubbles-outline" size={48} color="#8E8E93" />
                        <Text style={styles.emptyText}>No sessions in this workspace</Text>
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
    list: {
        padding: 16,
    },
    card: {
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
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000000',
        marginBottom: 4,
    },
    modelText: {
        fontSize: 13,
        color: '#8E8E93',
        marginBottom: 12,
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
        color: '#8E8E93',
        marginLeft: 6,
    },
    dateText: {
        fontSize: 13,
        color: '#8E8E93',
    },
    errorText: {
        marginTop: 12,
        fontSize: 17,
        fontWeight: '600',
        color: '#FF3B30',
    },
    retryButton: {
        marginTop: 20,
        backgroundColor: '#007AFF',
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
        color: '#3C3C43',
    },
});
