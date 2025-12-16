import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
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
} from '../screens';
import { RootStackParamList, TabParamList } from './types';
import { useTheme } from '../context/ThemeContext';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

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
        <NavigationContainer theme={navigationTheme}>
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
                    name="SettingsTab"
                    component={SettingsStack}
                    options={{ title: 'Settings' }}
                />
            </Tab.Navigator>
        </NavigationContainer>
    );
}
