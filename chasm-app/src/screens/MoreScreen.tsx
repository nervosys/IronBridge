import React from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface MenuItem {
    id: string;
    title: string;
    subtitle: string;
    icon: string;
    iconColor: string;
    route: keyof RootStackParamList;
}

const menuItems: MenuItem[] = [
    {
        id: 'comparison',
        title: 'Model Comparison',
        subtitle: 'Compare AI models by cost, speed & accuracy',
        icon: 'bar-chart-outline',
        iconColor: '#3b82f6',
        route: 'Comparison',
    },
    {
        id: 'harvest',
        title: 'Harvest',
        subtitle: 'Import sessions from share links & sources',
        icon: 'cloud-download-outline',
        iconColor: '#10b981',
        route: 'Harvest',
    },
    {
        id: 'providers',
        title: 'Providers',
        subtitle: 'Manage AI provider connections & API keys',
        icon: 'server-outline',
        iconColor: '#8b5cf6',
        route: 'Providers',
    },
    {
        id: 'accounts',
        title: 'Accounts',
        subtitle: 'OAuth & API key management',
        icon: 'people-outline',
        iconColor: '#ec4899',
        route: 'Accounts',
    },
    {
        id: 'research',
        title: 'Research',
        subtitle: 'arXiv papers, trends & saved papers',
        icon: 'library-outline',
        iconColor: '#84cc16',
        route: 'Research',
    },
    {
        id: 'local-llm',
        title: 'Local LLM',
        subtitle: 'LAN servers & on-device inference',
        icon: 'cube-outline',
        iconColor: '#22c55e',
        route: 'LocalLlmSettings',
    },
];

export function MoreScreen() {
    const { colors } = useTheme();
    const navigation = useNavigation<NavigationProp>();

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>More Features</Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                    Access all ChatSessionManager capabilities
                </Text>
            </View>

            <View style={styles.grid}>
                {menuItems.map((item) => (
                    <TouchableOpacity
                        key={item.id}
                        style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => navigation.navigate(item.route as any)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.iconContainer, { backgroundColor: `${item.iconColor}15` }]}>
                            <Ionicons name={item.icon as any} size={28} color={item.iconColor} />
                        </View>
                        <Text style={[styles.menuTitle, { color: colors.text }]}>{item.title}</Text>
                        <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                            {item.subtitle}
                        </Text>
                        <Ionicons
                            name="chevron-forward"
                            size={18}
                            color={colors.textSecondary}
                            style={styles.chevron}
                        />
                    </TouchableOpacity>
                ))}
            </View>

            {/* Quick Stats */}
            <View style={[styles.statsSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statsTitle, { color: colors.text }]}>Quick Stats</Text>
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Ionicons name="server-outline" size={20} color={colors.primary} />
                        <Text style={[styles.statValue, { color: colors.text }]}>7</Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Providers</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Ionicons name="key-outline" size={20} color="#f59e0b" />
                        <Text style={[styles.statValue, { color: colors.text }]}>4</Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Accounts</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Ionicons name="library-outline" size={20} color="#84cc16" />
                        <Text style={[styles.statValue, { color: colors.text }]}>12</Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Papers</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Ionicons name="cube-outline" size={20} color="#22c55e" />
                        <Text style={[styles.statValue, { color: colors.text }]}>2</Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Local LLMs</Text>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: 20,
        paddingBottom: 12,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
    },
    headerSubtitle: {
        fontSize: 14,
        marginTop: 4,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 12,
        gap: 12,
    },
    menuCard: {
        width: '47%',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        position: 'relative',
    },
    iconContainer: {
        width: 52,
        height: 52,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    menuTitle: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 4,
    },
    menuSubtitle: {
        fontSize: 12,
        lineHeight: 16,
    },
    chevron: {
        position: 'absolute',
        top: 16,
        right: 12,
    },
    statsSection: {
        margin: 16,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
    },
    statsTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 16,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 22,
        fontWeight: '700',
        marginTop: 6,
    },
    statLabel: {
        fontSize: 11,
        marginTop: 2,
    },
});

export default MoreScreen;
