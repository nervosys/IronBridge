import React, { useMemo, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useQuery } from '@tanstack/react-query';
import { getWorkspaces, getSessions, getStats, getProviders } from '../api/sessions';
import { formatRelativeTime } from '../utils/formatDate';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { RootStackParamList, TabParamList } from '../navigation/types';

type OverviewScreenNavigationProp = CompositeNavigationProp<
    NativeStackNavigationProp<RootStackParamList, 'Overview'>,
    BottomTabNavigationProp<TabParamList>
>;

interface Props {
    navigation: OverviewScreenNavigationProp;
}

// Provider colors for visual consistency
const PROVIDER_COLORS: Record<string, string> = {
    'github-copilot': '#0ea5e9',
    copilot: '#0ea5e9',
    chatgpt: '#10b981',
    openai: '#10b981',
    claude: '#f59e0b',
    anthropic: '#f59e0b',
    ollama: '#8b5cf6',
    cursor: '#ec4899',
    default: '#64748b',
};

function getProviderColor(provider: string): string {
    const normalized = provider.toLowerCase().replace(/\s+/g, '-');
    return PROVIDER_COLORS[normalized] || PROVIDER_COLORS.default;
}

interface StatCardProps {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string | number;
    color: string;
    onPress?: () => void;
}

function StatCard({ icon, label, value, color, onPress }: StatCardProps) {
    const { colors } = useTheme();

    return (
        <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={onPress}
            activeOpacity={onPress ? 0.7 : 1}
        >
            <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
                <Ionicons name={icon} size={24} color={color} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
        </TouchableOpacity>
    );
}

interface RecentSessionItemProps {
    title: string;
    provider: string;
    time: string;
    messages: number;
    onPress: () => void;
}

function RecentSessionItem({ title, provider, time, messages, onPress }: RecentSessionItemProps) {
    const { colors } = useTheme();
    const providerColor = getProviderColor(provider);

    return (
        <TouchableOpacity
            style={[styles.sessionItem, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={onPress}
        >
            <View style={[styles.sessionProviderBadge, { backgroundColor: providerColor + '20' }]}>
                <Text style={[styles.sessionProviderText, { color: providerColor }]}>
                    {provider.slice(0, 2).toUpperCase()}
                </Text>
            </View>
            <View style={styles.sessionContent}>
                <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>
                    {title}
                </Text>
                <View style={styles.sessionMeta}>
                    <Text style={[styles.sessionMetaText, { color: colors.textSecondary }]}>
                        {messages} messages
                    </Text>
                    <Text style={[styles.sessionMetaDot, { color: colors.textSecondary }]}>•</Text>
                    <Text style={[styles.sessionMetaText, { color: colors.textSecondary }]}>{time}</Text>
                </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
    );
}

interface ProviderItemProps {
    name: string;
    sessionCount: number;
    onPress: () => void;
}

function ProviderItem({ name, sessionCount, onPress }: ProviderItemProps) {
    const { colors } = useTheme();
    const providerColor = getProviderColor(name);

    return (
        <TouchableOpacity
            style={[styles.providerItem, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={onPress}
        >
            <View style={[styles.providerDot, { backgroundColor: providerColor }]} />
            <Text style={[styles.providerName, { color: colors.text }]} numberOfLines={1}>
                {name}
            </Text>
            <Text style={[styles.providerCount, { color: colors.textSecondary }]}>
                {sessionCount}
            </Text>
        </TouchableOpacity>
    );
}

export function OverviewScreen({ navigation }: Props) {
    const { colors, isDark } = useTheme();

    // Fetch data from API - use select to ensure arrays are always arrays
    const {
        data: workspaces = [],
        isLoading: workspacesLoading,
        refetch: refetchWorkspaces,
    } = useQuery({
        queryKey: ['workspaces'],
        queryFn: getWorkspaces,
        select: (data) => Array.isArray(data) ? data : [],
    });

    const {
        data: sessions = [],
        isLoading: sessionsLoading,
        refetch: refetchSessions,
    } = useQuery({
        queryKey: ['sessions', { limit: 50 }],
        queryFn: () => getSessions({ limit: 50 }),
        select: (data) => Array.isArray(data) ? data : [],
    });

    const {
        data: stats,
        isLoading: statsLoading,
        refetch: refetchStats,
    } = useQuery({
        queryKey: ['stats'],
        queryFn: getStats,
    });

    const {
        data: providers = [],
        isLoading: providersLoading,
        refetch: refetchProviders,
    } = useQuery({
        queryKey: ['providers'],
        queryFn: getProviders,
        select: (data) => Array.isArray(data) ? data : [],
    });

    const isLoading = workspacesLoading || sessionsLoading || statsLoading || providersLoading;

    // Debug: Test direct API connection
    useEffect(() => {
        const testConnection = async () => {
            console.log('[DEBUG] Testing API connection...');
            console.log('[DEBUG] Window location:', typeof window !== 'undefined' ? window.location.href : 'N/A');

            // Test with XMLHttpRequest
            const xhr = new XMLHttpRequest();
            xhr.open('GET', 'http://127.0.0.1:8787/api/health', true);
            xhr.onload = () => {
                console.log('[DEBUG] XHR success:', xhr.status, xhr.responseText);
            };
            xhr.onerror = (e) => {
                console.error('[DEBUG] XHR error:', e);
            };
            xhr.send();

            // Also test fetch
            try {
                const response = await fetch('http://127.0.0.1:8787/api/health');
                const data = await response.json();
                console.log('[DEBUG] Fetch success:', data);
            } catch (error) {
                console.error('[DEBUG] Fetch failed:', error);
            }
        };
        testConnection();
    }, []);

    const handleRefresh = async () => {
        await Promise.all([refetchWorkspaces(), refetchSessions(), refetchStats(), refetchProviders()]);
    };

    // Compute stats
    const totalSessions = stats?.totalSessions ?? sessions.length;
    const totalMessages = stats?.totalMessages ?? sessions.reduce((sum, s) => sum + s.messageCount, 0);
    const totalWorkspaces = workspaces.length;

    // Recent sessions (sorted by updatedAt)
    const recentSessions = useMemo(() => {
        if (!Array.isArray(sessions)) return [];
        return sessions
            .slice()
            .sort((a, b) => {
                const aTime = typeof a.updatedAt === 'number' ? a.updatedAt : new Date(a.updatedAt).getTime();
                const bTime = typeof b.updatedAt === 'number' ? b.updatedAt : new Date(b.updatedAt).getTime();
                return bTime - aTime;
            })
            .slice(0, 5);
    }, [sessions]);

    // Provider distribution
    const providerDistribution = useMemo(() => {
        if (stats?.sessionsByProvider && Array.isArray(stats.sessionsByProvider)) {
            return stats.sessionsByProvider
                .map((p) => ({ name: p.provider, sessionCount: p.count }))
                .sort((a, b) => b.sessionCount - a.sessionCount);
        }

        if (!Array.isArray(sessions)) return [];
        const counts = new Map<string, number>();
        sessions.forEach((s) => {
            const count = counts.get(s.provider) || 0;
            counts.set(s.provider, count + 1);
        });
        return Array.from(counts.entries())
            .map(([name, sessionCount]) => ({ name, sessionCount }))
            .sort((a, b) => b.sessionCount - a.sessionCount);
    }, [stats, sessions]);

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
                <RefreshControl
                    refreshing={isLoading}
                    onRefresh={handleRefresh}
                    tintColor={colors.primary}
                />
            }
        >
            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Overview</Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                    Your chat sessions across all providers
                </Text>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
                <StatCard
                    icon="chatbubbles-outline"
                    label="Sessions"
                    value={totalSessions.toLocaleString()}
                    color={colors.primary}
                    onPress={() => navigation.navigate('Sessions')}
                />
                <StatCard
                    icon="folder-outline"
                    label="Workspaces"
                    value={totalWorkspaces.toLocaleString()}
                    color="#10b981"
                    onPress={() => navigation.navigate('Workspaces')}
                />
                <StatCard
                    icon="chatbox-outline"
                    label="Messages"
                    value={totalMessages.toLocaleString()}
                    color="#f59e0b"
                />
                <StatCard
                    icon="server-outline"
                    label="Providers"
                    value={providerDistribution.length}
                    color="#8b5cf6"
                />
            </View>

            {/* Recent Sessions */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Sessions</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Sessions')}>
                        <Text style={[styles.sectionLink, { color: colors.primary }]}>See All</Text>
                    </TouchableOpacity>
                </View>
                {recentSessions.length > 0 ? (
                    recentSessions.map((session) => (
                        <RecentSessionItem
                            key={session.id}
                            title={session.title || 'Untitled Session'}
                            provider={session.provider}
                            time={formatRelativeTime(session.updatedAt)}
                            messages={session.messageCount}
                            onPress={() =>
                                navigation.navigate('SessionDetail', { sessionId: session.id })
                            }
                        />
                    ))
                ) : (
                    <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Ionicons name="chatbubbles-outline" size={40} color={colors.textSecondary} />
                        <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                            No sessions yet
                        </Text>
                        <TouchableOpacity
                            style={[styles.emptyStateButton, { backgroundColor: colors.primary }]}
                            onPress={() => navigation.navigate('Chat')}
                        >
                            <Text style={styles.emptyStateButtonText}>Start a Chat</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Provider Distribution */}
            {providerDistribution.length > 0 && (
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>By Provider</Text>
                    </View>
                    <View style={styles.providerList}>
                        {providerDistribution.map((provider) => (
                            <ProviderItem
                                key={provider.name}
                                name={provider.name}
                                sessionCount={provider.sessionCount}
                                onPress={() =>
                                    navigation.navigate('Sessions', { provider: provider.name } as any)
                                }
                            />
                        ))}
                    </View>
                </View>
            )}

            {/* Quick Actions */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
                </View>
                <View style={styles.quickActions}>
                    <TouchableOpacity
                        style={[styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => navigation.navigate('ChatTab')}
                    >
                        <Ionicons name="add-circle-outline" size={28} color={colors.primary} />
                        <Text style={[styles.quickActionText, { color: colors.text }]}>New Chat</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => navigation.navigate('SearchTab')}
                    >
                        <Ionicons name="search-outline" size={28} color={colors.primary} />
                        <Text style={[styles.quickActionText, { color: colors.text }]}>Search</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => navigation.navigate('AgentsTab')}
                    >
                        <Ionicons name="hardware-chip-outline" size={28} color={colors.primary} />
                        <Text style={[styles.quickActionText, { color: colors.text }]}>Agents</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => navigation.navigate('SettingsTab')}
                    >
                        <Ionicons name="settings-outline" size={28} color={colors.primary} />
                        <Text style={[styles.quickActionText, { color: colors.text }]}>Settings</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
}

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2;

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 32,
    },
    header: {
        marginBottom: 24,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        fontSize: 14,
        marginTop: 4,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
    },
    statCard: {
        width: cardWidth,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    statIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    statValue: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    statLabel: {
        fontSize: 13,
        marginTop: 2,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    sectionLink: {
        fontSize: 14,
        fontWeight: '500',
    },
    sessionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 8,
    },
    sessionProviderBadge: {
        width: 40,
        height: 40,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    sessionProviderText: {
        fontSize: 14,
        fontWeight: '600',
    },
    sessionContent: {
        flex: 1,
    },
    sessionTitle: {
        fontSize: 15,
        fontWeight: '500',
        marginBottom: 2,
    },
    sessionMeta: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sessionMetaText: {
        fontSize: 12,
    },
    sessionMetaDot: {
        fontSize: 12,
        marginHorizontal: 6,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        borderRadius: 12,
        borderWidth: 1,
    },
    emptyStateText: {
        fontSize: 15,
        marginTop: 12,
        marginBottom: 16,
    },
    emptyStateButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    emptyStateButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    providerList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    providerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
    },
    providerDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 8,
    },
    providerName: {
        fontSize: 14,
        marginRight: 8,
    },
    providerCount: {
        fontSize: 13,
        fontWeight: '600',
    },
    quickActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    quickAction: {
        width: cardWidth,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        borderRadius: 12,
        borderWidth: 1,
    },
    quickActionText: {
        fontSize: 14,
        fontWeight: '500',
        marginTop: 8,
    },
});
