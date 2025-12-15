import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import {
    WorkspacesScreen,
    SessionsScreen,
    SessionDetailScreen,
    WorkspaceSessionsScreen,
    SearchScreen,
    SettingsScreen,
} from '../screens';
import { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

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

export function AppNavigator() {
    return (
        <NavigationContainer>
            <Tab.Navigator
                screenOptions={({ route }) => ({
                    headerShown: false,
                    tabBarIcon: ({ focused, color, size }) => {
                        let iconName: keyof typeof Ionicons.glyphMap;

                        switch (route.name) {
                            case 'WorkspacesTab':
                                iconName = focused ? 'folder' : 'folder-outline';
                                break;
                            case 'SessionsTab':
                                iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
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
                    tabBarActiveTintColor: '#007AFF',
                    tabBarInactiveTintColor: '#8E8E93',
                })}
            >
                <Tab.Screen
                    name="WorkspacesTab"
                    component={WorkspacesStack}
                    options={{ title: 'Workspaces' }}
                />
                <Tab.Screen
                    name="SessionsTab"
                    component={SessionsStack}
                    options={{ title: 'Sessions' }}
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
