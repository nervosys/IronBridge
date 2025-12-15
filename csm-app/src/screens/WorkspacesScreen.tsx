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
import { getWorkspaces, Workspace } from '../api';
import { RootStackParamList } from '../navigation/types';

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Workspaces'>;
};

export function WorkspacesScreen({ navigation }: Props) {
    const {
        data: workspaces,
        isLoading,
        error,
        refetch,
        isRefetching,
    } = useQuery({
        queryKey: ['workspaces'],
        queryFn: getWorkspaces,
    });

    const renderWorkspace = ({ item }: { item: Workspace }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() =>
                navigation.navigate('WorkspaceSessions', {
                    workspaceId: item.id,
                    workspaceName: item.name,
                })
            }
        >
            <View style={styles.cardHeader}>
                <Ionicons name="folder-outline" size={24} color="#007AFF" />
                <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.name}
                </Text>
            </View>
            <Text style={styles.cardPath} numberOfLines={1}>
                {item.path}
            </Text>
            <View style={styles.cardFooter}>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.provider}</Text>
                </View>
                <Text style={styles.dateText}>
                    {new Date(item.updated_at).toLocaleDateString()}
                </Text>
            </View>
        </TouchableOpacity>
    );

    if (isLoading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading workspaces...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centered}>
                <Ionicons name="cloud-offline-outline" size={48} color="#FF3B30" />
                <Text style={styles.errorText}>Failed to load workspaces</Text>
                <Text style={styles.errorSubtext}>
                    Make sure the CSM API server is running
                </Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
                    <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={workspaces}
                renderItem={renderWorkspace}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Ionicons name="folder-open-outline" size={48} color="#8E8E93" />
                        <Text style={styles.emptyText}>No workspaces found</Text>
                        <Text style={styles.emptySubtext}>
                            Import sessions from your AI tools to get started
                        </Text>
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
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardTitle: {
        fontSize: 17,
        fontWeight: '600',
        marginLeft: 12,
        flex: 1,
        color: '#000000',
    },
    cardPath: {
        fontSize: 13,
        color: '#8E8E93',
        marginBottom: 12,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    badge: {
        backgroundColor: '#E5F2FF',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 12,
        color: '#007AFF',
        fontWeight: '500',
    },
    dateText: {
        fontSize: 12,
        color: '#8E8E93',
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
    errorSubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#8E8E93',
        textAlign: 'center',
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
    emptySubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#8E8E93',
        textAlign: 'center',
    },
});
