// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// =============================================================================
// OAuth Login Screen
// =============================================================================
// Provides OAuth authentication for various AI providers

import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    TextInput,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth, useProviderAuth } from '../context/AuthContext';
import {
    OAuthProviderType,
    OAUTH_PROVIDERS,
    SCOPE_DESCRIPTIONS,
} from '../api/oauth';

// =============================================================================
// Provider Card Component
// =============================================================================

interface ProviderCardProps {
    provider: OAuthProviderType;
    onLogin: (clientId?: string) => void;
    onLogout: () => void;
    isLoading: boolean;
}

const PROVIDER_COLORS: Record<OAuthProviderType, string> = {
    openai: '#10A37F',
    anthropic: '#D4A06F',
    azure: '#0078D4',
    google: '#4285F4',
    github: '#24292E',
    microsoft: '#00A4EF',
};

const PROVIDER_ICONS: Record<OAuthProviderType, keyof typeof Ionicons.glyphMap> = {
    openai: 'flash',
    anthropic: 'sparkles',
    azure: 'cloud',
    google: 'logo-google',
    github: 'logo-github',
    microsoft: 'logo-microsoft',
};

function ProviderCard({ provider, onLogin, onLogout, isLoading }: ProviderCardProps) {
    const { colors, isDark } = useTheme();
    const { isAuthenticated, user, session } = useProviderAuth(provider);
    const config = OAUTH_PROVIDERS[provider];
    const [showClientIdInput, setShowClientIdInput] = useState(false);
    const [clientId, setClientId] = useState('');

    const handleLogin = useCallback(() => {
        if (!config.clientId && !clientId) {
            setShowClientIdInput(true);
        } else {
            onLogin(clientId || undefined);
        }
    }, [config.clientId, clientId, onLogin]);

    const handleLoginWithClientId = useCallback(() => {
        if (!clientId.trim()) {
            Alert.alert('Error', 'Please enter a Client ID');
            return;
        }
        setShowClientIdInput(false);
        onLogin(clientId);
    }, [clientId, onLogin]);

    const providerColor = PROVIDER_COLORS[provider];
    const providerIcon = PROVIDER_ICONS[provider];

    return (
        <>
            <View style={[styles.providerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.providerHeader}>
                    <View style={[styles.providerIconContainer, { backgroundColor: providerColor + '20' }]}>
                        <Ionicons name={providerIcon} size={24} color={providerColor} />
                    </View>
                    <View style={styles.providerInfo}>
                        <Text style={[styles.providerName, { color: colors.text }]}>
                            {config.displayName}
                        </Text>
                        {isAuthenticated ? (
                            <View style={styles.connectedBadge}>
                                <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                                <Text style={styles.connectedText}>Connected</Text>
                            </View>
                        ) : (
                            <Text style={[styles.disconnectedText, { color: colors.textTertiary }]}>
                                Not connected
                            </Text>
                        )}
                    </View>
                </View>

                {isAuthenticated && user && (
                    <View style={[styles.userInfo, { borderTopColor: colors.divider }]}>
                        <Ionicons name="person-circle-outline" size={18} color={colors.textSecondary} />
                        <Text style={[styles.userText, { color: colors.textSecondary }]}>
                            {user.name || user.email || 'Authenticated'}
                        </Text>
                    </View>
                )}

                {isAuthenticated && session && (
                    <View style={styles.sessionInfo}>
                        <Text style={[styles.scopesLabel, { color: colors.textTertiary }]}>
                            Permissions:
                        </Text>
                        <View style={styles.scopesList}>
                            {session.tokens.scopes.slice(0, 3).map((scope, index) => (
                                <View
                                    key={scope}
                                    style={[styles.scopeBadge, { backgroundColor: colors.background }]}
                                >
                                    <Text style={[styles.scopeText, { color: colors.textSecondary }]}>
                                        {SCOPE_DESCRIPTIONS[scope] || scope.split('/').pop()}
                                    </Text>
                                </View>
                            ))}
                            {session.tokens.scopes.length > 3 && (
                                <Text style={[styles.moreScopes, { color: colors.textTertiary }]}>
                                    +{session.tokens.scopes.length - 3} more
                                </Text>
                            )}
                        </View>
                    </View>
                )}

                <View style={styles.providerActions}>
                    {isAuthenticated ? (
                        <TouchableOpacity
                            style={[styles.logoutButton, { borderColor: colors.error }]}
                            onPress={onLogout}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator size="small" color={colors.error} />
                            ) : (
                                <>
                                    <Ionicons name="log-out-outline" size={18} color={colors.error} />
                                    <Text style={[styles.logoutButtonText, { color: colors.error }]}>
                                        Disconnect
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[styles.loginButton, { backgroundColor: providerColor }]}
                            onPress={handleLogin}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
                                    <Text style={styles.loginButtonText}>
                                        Connect with {config.displayName}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Client ID Input Modal */}
            <Modal
                visible={showClientIdInput}
                transparent
                animationType="fade"
                onRequestClose={() => setShowClientIdInput(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>
                            Configure {config.displayName}
                        </Text>
                        <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
                            Enter your OAuth Client ID to connect with {config.displayName}.
                            You can get this from the developer console.
                        </Text>
                        <TextInput
                            style={[styles.clientIdInput, {
                                backgroundColor: colors.background,
                                color: colors.text,
                                borderColor: colors.border,
                            }]}
                            value={clientId}
                            onChangeText={setClientId}
                            placeholder="Enter Client ID"
                            placeholderTextColor={colors.textTertiary}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalCancelButton, { borderColor: colors.border }]}
                                onPress={() => setShowClientIdInput(false)}
                            >
                                <Text style={[styles.modalCancelText, { color: colors.text }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalConnectButton, { backgroundColor: providerColor }]}
                                onPress={handleLoginWithClientId}
                            >
                                <Text style={styles.modalConnectText}>Connect</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}

// =============================================================================
// Main OAuth Login Screen
// =============================================================================

export function OAuthLoginScreen() {
    const { colors, isDark } = useTheme();
    const { isLoading, error, login, logout, authenticatedProviders } = useAuth();

    const providers: OAuthProviderType[] = [
        'openai',
        'anthropic',
        'google',
        'azure',
        'github',
        'microsoft',
    ];

    const handleLogin = useCallback(async (provider: OAuthProviderType, clientId?: string) => {
        const success = await login(provider, clientId);
        if (!success) {
            // Error is handled in AuthContext and shown via error state
        }
    }, [login]);

    const handleLogout = useCallback(async (provider: OAuthProviderType) => {
        Alert.alert(
            'Disconnect',
            `Are you sure you want to disconnect from ${OAUTH_PROVIDERS[provider].displayName}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disconnect',
                    style: 'destructive',
                    onPress: () => logout(provider),
                },
            ]
        );
    }, [logout]);

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            contentContainerStyle={styles.contentContainer}
        >
            {/* Header */}
            <View style={styles.header}>
                <View style={[styles.headerIcon, { backgroundColor: colors.primary + '20' }]}>
                    <Ionicons name="key" size={32} color={colors.primary} />
                </View>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                    Connect Your Accounts
                </Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                    Sign in with your AI provider accounts to use OAuth instead of API keys.
                    Your credentials are stored securely on your device.
                </Text>
            </View>

            {/* Error Message */}
            {error && (
                <View style={[styles.errorContainer, { backgroundColor: colors.error + '10' }]}>
                    <Ionicons name="alert-circle" size={20} color={colors.error} />
                    <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                </View>
            )}

            {/* Connected Summary */}
            {authenticatedProviders.length > 0 && (
                <View style={[styles.summaryContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.summaryTitle, { color: colors.text }]}>
                        Connected Accounts ({authenticatedProviders.length})
                    </Text>
                    <View style={styles.summaryIcons}>
                        {authenticatedProviders.map(p => (
                            <View
                                key={p}
                                style={[styles.summaryIcon, { backgroundColor: PROVIDER_COLORS[p] + '20' }]}
                            >
                                <Ionicons
                                    name={PROVIDER_ICONS[p]}
                                    size={16}
                                    color={PROVIDER_COLORS[p]}
                                />
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* Provider Cards */}
            <View style={styles.providersSection}>
                <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>
                    AVAILABLE PROVIDERS
                </Text>
                {providers.map(provider => (
                    <ProviderCard
                        key={provider}
                        provider={provider}
                        onLogin={(clientId) => handleLogin(provider, clientId)}
                        onLogout={() => handleLogout(provider)}
                        isLoading={isLoading}
                    />
                ))}
            </View>

            {/* Security Notice */}
            <View style={[styles.securityNotice, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
                <View style={styles.securityTextContainer}>
                    <Text style={[styles.securityTitle, { color: colors.text }]}>
                        Secure Authentication
                    </Text>
                    <Text style={[styles.securityDescription, { color: colors.textSecondary }]}>
                        OAuth tokens are stored securely using your device's secure storage.
                        We never see or store your passwords.
                    </Text>
                </View>
            </View>
        </ScrollView>
    );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 32,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
        paddingTop: 16,
    },
    headerIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
        textAlign: 'center',
    },
    headerSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 16,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        gap: 8,
    },
    errorText: {
        flex: 1,
        fontSize: 14,
    },
    summaryContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 24,
    },
    summaryTitle: {
        fontSize: 14,
        fontWeight: '600',
    },
    summaryIcons: {
        flexDirection: 'row',
        gap: 8,
    },
    summaryIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    providersSection: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: 12,
        marginLeft: 4,
    },
    providerCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        marginBottom: 12,
    },
    providerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    providerIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    providerInfo: {
        flex: 1,
    },
    providerName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    connectedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    connectedText: {
        fontSize: 12,
        color: '#34C759',
        fontWeight: '500',
    },
    disconnectedText: {
        fontSize: 12,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        gap: 8,
    },
    userText: {
        fontSize: 13,
    },
    sessionInfo: {
        marginTop: 12,
    },
    scopesLabel: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 6,
    },
    scopesList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    scopeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    scopeText: {
        fontSize: 11,
    },
    moreScopes: {
        fontSize: 11,
        alignSelf: 'center',
        marginLeft: 4,
    },
    providerActions: {
        marginTop: 16,
    },
    loginButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        gap: 8,
    },
    loginButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        gap: 8,
    },
    logoutButtonText: {
        fontSize: 14,
        fontWeight: '600',
    },
    securityNotice: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        gap: 12,
    },
    securityTextContainer: {
        flex: 1,
    },
    securityTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    securityDescription: {
        fontSize: 12,
        lineHeight: 18,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        padding: 24,
    },
    modalContent: {
        borderRadius: 16,
        padding: 24,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    modalDescription: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 16,
    },
    clientIdInput: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        marginBottom: 16,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    modalCancelButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: 14,
        fontWeight: '600',
    },
    modalConnectButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    modalConnectText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
});

export default OAuthLoginScreen;
