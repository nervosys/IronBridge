// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme, LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import {
    OverviewScreen,
    WorkspacesScreen,
    SessionsScreen,
    SessionDetailScreen,
    WorkspaceSessionsScreen,
    SearchScreen,
    SettingsScreen,
    ChatScreen,
    ChatProvidersScreen,
    ChatHistoryScreen,
    AgentsScreen,
    AgentRunDetailScreen,
    SwarmDetailScreen,
    MoreScreen,
    ComparisonScreen,
    HarvestScreen,
    ProvidersScreen,
    ProtocolsScreen,
    AccountsScreen,
    DeveloperScreen,
    ResearchScreen,
    SWEScreen,
    LocalLlmSettingsScreen,
    AgentInboxScreen,
} from '../screens';
import { OAuthLoginScreen } from '../screens/OAuthLoginScreen';
import { RootStackParamList, TabParamList } from './types';
import { useTheme } from '../context/ThemeContext';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// Deep linking configuration for OAuth callbacks
const linking: LinkingOptions<TabParamList> = {
    prefixes: [Linking.createURL('/'), 'csm://'],
    config: {
        screens: {
            SettingsTab: {
                screens: {
                    OAuthLogin: 'oauth/callback',
                },
            },
        },
    },
};

function OverviewStack() {
    return (
        <Stack.Navigator>
            <Stack.Screen
                name="Overview"
                component={OverviewScreen}
                options={{ title: 'Overview' }}
            />
            <Stack.Screen
                name="Sessions"
                component={SessionsScreen}
                options={{ title: 'All Sessions' }}
            />
            <Stack.Screen
                name="Workspaces"
                component={WorkspacesScreen}
                options={{ title: 'Workspaces' }}
            />
            <Stack.Screen
                name="WorkspaceSessions"
                component={WorkspaceSessionsScreen}
                options={({ route }) => ({
                    title: route.params.workspaceName,
                })}
            />
            <Stack.Screen
                name="SessionDetail"
                component={SessionDetailScreen}
                options={({ route }) => ({
                    title: route.params.sessionTitle || 'Session',
                })}
            />
        </Stack.Navigator>
    );
}

function WorkspacesStack() {
    return (
        <Stack.Navigator>
            <Stack.Screen
                name="Workspaces"
                component={WorkspacesScreen}
                options={{ title: 'Workspaces' }}
            />
            <Stack.Screen
                name="WorkspaceSessions"
                component={WorkspaceSessionsScreen}
                options={({ route }) => ({
                    title: route.params.workspaceName,
                })}
            />
            <Stack.Screen
                name="SessionDetail"
                component={SessionDetailScreen}
                options={({ route }) => ({
                    title: route.params.sessionTitle || 'Session',
                })}
            />
        </Stack.Navigator>
    );
}

function SessionsStack() {
    return (
        <Stack.Navigator>
            <Stack.Screen
                name="Sessions"
                component={SessionsScreen}
                options={{ title: 'All Sessions' }}
            />
            <Stack.Screen
                name="SessionDetail"
                component={SessionDetailScreen}
                options={({ route }) => ({
                    title: route.params.sessionTitle || 'Session',
                })}
            />
        </Stack.Navigator>
    );
}

function SearchStack() {
    return (
        <Stack.Navigator>
            <Stack.Screen
                name="Search"
                component={SearchScreen}
                options={{ title: 'Search' }}
            />
            <Stack.Screen
                name="SessionDetail"
                component={SessionDetailScreen}
                options={({ route }) => ({
                    title: route.params.sessionTitle || 'Session',
                })}
            />
        </Stack.Navigator>
    );
}

function SettingsStack() {
    return (
        <Stack.Navigator>
            <Stack.Screen
                name="Settings"
                component={SettingsScreen}
                options={{ title: 'Settings' }}
            />
            <Stack.Screen
                name="OAuthLogin"
                component={OAuthLoginScreen}
                options={{ title: 'Connected Accounts' }}
            />
        </Stack.Navigator>
    );
}

function ChatStack() {
    return (
        <Stack.Navigator>
            <Stack.Screen
                name="Chat"
                component={ChatScreen}
                options={{ title: 'Chat' }}
            />
            <Stack.Screen
                name="ChatProviders"
                component={ChatProvidersScreen}
                options={{ title: 'AI Providers' }}
            />
            <Stack.Screen
                name="ChatHistory"
                component={ChatHistoryScreen}
                options={{ title: 'Chat History' }}
            />
        </Stack.Navigator>
    );
}

function AgentsStack() {
    return (
        <Stack.Navigator>
            <Stack.Screen
                name="Agents"
                component={AgentsScreen}
                options={{ title: 'Agents' }}
            />
            <Stack.Screen
                name="AgentRunDetail"
                component={AgentRunDetailScreen}
                options={({ route }) => ({
                    title: 'Run Details',
                })}
            />
            <Stack.Screen
                name="SwarmDetail"
                component={SwarmDetailScreen}
                options={({ route }) => ({
                    title: 'Swarm',
                })}
            />
            <Stack.Screen
                name="Protocols"
                component={ProtocolsScreen}
                options={{ title: 'Protocols' }}
            />
            <Stack.Screen
                name="Developer"
                component={DeveloperScreen}
                options={{ title: 'Developer' }}
            />
            <Stack.Screen
                name="SWE"
                component={SWEScreen}
                options={{ title: 'SWE Memory' }}
            />
            <Stack.Screen
                name="AgentInbox"
                component={AgentInboxScreen}
                options={{ title: 'Agent Inbox' }}
            />
        </Stack.Navigator>
    );
}

function MoreStack() {
    return (
        <Stack.Navigator>
            <Stack.Screen
                name="More"
                component={MoreScreen}
                options={{ title: 'More' }}
            />
            <Stack.Screen
                name="Comparison"
                component={ComparisonScreen}
                options={{ title: 'Model Comparison' }}
            />
            <Stack.Screen
                name="Harvest"
                component={HarvestScreen}
                options={{ title: 'Harvest' }}
            />
            <Stack.Screen
                name="Providers"
                component={ProvidersScreen}
                options={{ title: 'Providers' }}
            />
            <Stack.Screen
                name="Protocols"
                component={ProtocolsScreen}
                options={{ title: 'Protocols' }}
            />
            <Stack.Screen
                name="Accounts"
                component={AccountsScreen}
                options={{ title: 'Accounts' }}
            />
            <Stack.Screen
                name="Developer"
                component={DeveloperScreen}
                options={{ title: 'Developer' }}
            />
            <Stack.Screen
                name="Research"
                component={ResearchScreen}
                options={{ title: 'Research' }}
            />
            <Stack.Screen
                name="SWE"
                component={SWEScreen}
                options={{ title: 'SWE Memory' }}
            />
            <Stack.Screen
                name="LocalLlmSettings"
                component={LocalLlmSettingsScreen}
                options={{ title: 'Local LLM' }}
            />
        </Stack.Navigator>
    );
}

export function AppNavigator() {
    const { colors, isDark } = useTheme();

    // Create custom navigation themes based on our theme colors
    const navigationTheme = {
        ...(isDark ? DarkTheme : DefaultTheme),
        colors: {
            ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
            primary: colors.primary,
            background: colors.background,
            card: colors.card,
            text: colors.text,
            border: colors.border,
            notification: colors.error,
        },
    };

    return (
        <NavigationContainer theme={navigationTheme} linking={linking}>
            <Tab.Navigator
                screenOptions={({ route }) => ({
                    headerShown: false,
                    tabBarIcon: ({ focused, color, size }) => {
                        let iconName: keyof typeof Ionicons.glyphMap;

                        switch (route.name) {
                            case 'OverviewTab':
                                iconName = focused ? 'home' : 'home-outline';
                                break;
                            case 'WorkspacesTab':
                                iconName = focused ? 'folder' : 'folder-outline';
                                break;
                            case 'SessionsTab':
                                iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
                                break;
                            case 'ChatTab':
                                iconName = focused ? 'sparkles' : 'sparkles-outline';
                                break;
                            case 'AgentsTab':
                                iconName = focused ? 'git-network' : 'git-network-outline';
                                break;
                            case 'SearchTab':
                                iconName = focused ? 'search' : 'search-outline';
                                break;
                            case 'SettingsTab':
                                iconName = focused ? 'settings' : 'settings-outline';
                                break;
                            case 'MoreTab':
                                iconName = focused ? 'grid' : 'grid-outline';
                                break;
                            default:
                                iconName = 'help-outline';
                        }

                        return <Ionicons name={iconName} size={size} color={color} />;
                    },
                    tabBarActiveTintColor: colors.primary,
                    tabBarInactiveTintColor: colors.textTertiary,
                    tabBarStyle: {
                        backgroundColor: colors.tabBar,
                        borderTopColor: colors.tabBarBorder,
                    },
                })}
            >
                <Tab.Screen
                    name="OverviewTab"
                    component={OverviewStack}
                    options={{ title: 'Home' }}
                />
                <Tab.Screen
                    name="ChatTab"
                    component={ChatStack}
                    options={{ title: 'Chat' }}
                />
                <Tab.Screen
                    name="AgentsTab"
                    component={AgentsStack}
                    options={{ title: 'Agents' }}
                />
                <Tab.Screen
                    name="SearchTab"
                    component={SearchStack}
                    options={{ title: 'Search' }}
                />
                <Tab.Screen
                    name="MoreTab"
                    component={MoreStack}
                    options={{ title: 'More' }}
                />
                <Tab.Screen
                    name="SettingsTab"
                    component={SettingsStack}
                    options={{ title: 'Settings' }}
                />
            </Tab.Navigator>
        </NavigationContainer>
    );
}
