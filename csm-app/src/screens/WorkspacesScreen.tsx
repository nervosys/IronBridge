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
import { useTheme } from '../context/ThemeContext';

type Props = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'Workspaces'>;
};

// Extract project name from full path (last directory component)
const getProjectName = (fullPath: string): string => {
    if (!fullPath) return 'Unknown';
    // Normalize path separators and get last component
    const parts = fullPath.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts[parts.length - 1] || fullPath;
};

export function WorkspacesScreen({ navigation }: Props) {
    const { colors, isDark } = useTheme();

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

    const renderWorkspace = ({ item }: { item: Workspace }) => {
        // item.name is the project name (last path component)
        // item.id is the hash
        // item.path is the full filesystem path
        const projectName = item.name || getProjectName(item.path || item.id);

        return (
            <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.card }]}
                onPress={() =>
                    navigation.navigate('WorkspaceSessions', {
                        workspaceId: item.id,
                        workspaceName: projectName,
                    })
                }
            >
                <View style={styles.cardHeader}>
                    <Ionicons name="folder-outline" size={24} color={colors.primary} />
                    <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                        {projectName}
                    </Text>
                </View>
                <Text style={[styles.hashText, { color: colors.textTertiary }]} numberOfLines={1}>
                    {item.id}
                </Text>
                <Text style={[styles.cardPath, { color: colors.textTertiary }]} numberOfLines={2}>
                    {item.path || item.id}
                </Text>
                <View style={styles.cardFooter}>
                    <View style={[styles.badge, { backgroundColor: isDark ? '#0A84FF22' : '#E5F2FF' }]}>
                        <Text style={[styles.badgeText, { color: colors.primary }]}>{item.provider}</Text>
                    </View>
                    <View style={[styles.sessionBadge, { backgroundColor: isDark ? '#38383A' : '#F0F0F5' }]}>
                        <Text style={[styles.sessionBadgeText, { color: colors.textSecondary }]}>{item.session_count} sessions</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    if (isLoading) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textTertiary }]}>Loading workspaces...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <Ionicons name="cloud-offline-outline" size={48} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]}>Failed to load workspaces</Text>
                <Text style={[styles.errorSubtext, { color: colors.textTertiary }]}>
                    Make sure the CSM API server is running
                </Text>
                <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
                    <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <FlatList
                data={workspaces}
                renderItem={renderWorkspace}
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
                        <Ionicons name="folder-open-outline" size={48} color={colors.textTertiary} />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No workspaces found</Text>
                        <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
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
        alignItems: 'center',
        marginBottom: 8,
    },
    cardTitle: {
        fontSize: 17,
        fontWeight: '600',
        marginLeft: 12,
        flex: 1,
    },
    cardPath: {
        fontSize: 12,
        marginBottom: 12,
    },
    hashText: {
        fontSize: 11,
        fontFamily: 'monospace',
        marginBottom: 6,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '500',
    },
    sessionBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    sessionBadgeText: {
        fontSize: 12,
        fontWeight: '500',
    },
    dateText: {
        fontSize: 12,
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
    errorSubtext: {
        marginTop: 8,
        fontSize: 14,
        textAlign: 'center',
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
    emptySubtext: {
        marginTop: 8,
        fontSize: 14,
        textAlign: 'center',
    },
});
