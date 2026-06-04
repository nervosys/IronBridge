// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

// =============================================================================
// OAuth2 Service
// =============================================================================
// Handles OAuth2 authorization flows, token exchange, refresh, and storage

import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import {
    OAuthConfig,
    OAuthTokens,
    OAuthTokenResponse,
    OAuthSession,
    OAuthUser,
    OAuthState,
    OAuthError,
    OAuthProviderType,
    OAUTH_PROVIDERS,
    generateOAuthState,
    generateCodeVerifier,
    buildAuthorizationUrl,
    parseOAuthCallback,
    isTokenExpired,
    getProviderConfig,
} from '../api/oauth';

// =============================================================================
// Storage Keys
// =============================================================================

const STORAGE_PREFIX = 'csm_oauth_';
const SESSIONS_KEY = `${STORAGE_PREFIX}sessions`;
const PENDING_STATE_KEY = `${STORAGE_PREFIX}pending_state`;

// =============================================================================
// OAuth Service Class
// =============================================================================

class OAuthService {
    private sessions: Map<OAuthProviderType, OAuthSession> = new Map();
    private pendingStates: Map<string, OAuthState> = new Map();
    private initialized = false;

    // =========================================================================
    // Initialization
    // =========================================================================

    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            // Load sessions from secure storage
            const sessionsJson = await SecureStore.getItemAsync(SESSIONS_KEY);
            if (sessionsJson) {
                const sessionsArray: OAuthSession[] = JSON.parse(sessionsJson);
                sessionsArray.forEach(session => {
                    this.sessions.set(session.provider, session);
                });
            }

            // Load pending states
            const pendingStateJson = await SecureStore.getItemAsync(PENDING_STATE_KEY);
            if (pendingStateJson) {
                const states: OAuthState[] = JSON.parse(pendingStateJson);
                states.forEach(state => {
                    this.pendingStates.set(state.state, state);
                });
            }

            this.initialized = true;
            console.log('[OAuth] Initialized with', this.sessions.size, 'sessions');
        } catch (error) {
            console.error('[OAuth] Initialization error:', error);
            this.initialized = true; // Continue anyway
        }
    }

    // =========================================================================
    // Authorization Flow
    // =========================================================================

    /**
     * Start OAuth authorization flow for a provider
     */
    async authorize(
        provider: OAuthProviderType,
        clientId?: string,
        customScopes?: string[]
    ): Promise<{ success: boolean; error?: string }> {
        await this.initialize();

        try {
            const config = getProviderConfig(provider, {
                clientId: clientId || OAUTH_PROVIDERS[provider].clientId,
                scopes: customScopes || OAUTH_PROVIDERS[provider].scopes,
            });

            if (!config.clientId) {
                return {
                    success: false,
                    error: `No client ID configured for ${config.displayName}. Please set up OAuth credentials.`,
                };
            }

            // Generate state and PKCE parameters
            const state = generateOAuthState();
            const codeVerifier = config.pkceRequired ? generateCodeVerifier() : undefined;

            // Build authorization URL
            const { url, codeVerifier: finalVerifier } = await buildAuthorizationUrl(
                config,
                state,
                codeVerifier
            );

            // Store pending state
            const oauthState: OAuthState = {
                state,
                codeVerifier: finalVerifier,
                provider,
                redirectUri: config.redirectUri,
                timestamp: Date.now(),
            };
            this.pendingStates.set(state, oauthState);
            await this.savePendingStates();

            console.log('[OAuth] Starting auth flow for', provider);
            console.log('[OAuth] Auth URL:', url);

            // Open browser for authentication
            if (Platform.OS === 'web') {
                // For web, redirect the current window
                window.location.href = url;
                return { success: true };
            } else {
                // For mobile, use WebBrowser
                const result = await WebBrowser.openAuthSessionAsync(
                    url,
                    config.redirectUri
                );

                if (result.type === 'success' && result.url) {
                    return await this.handleCallback(result.url);
                } else if (result.type === 'cancel') {
                    this.pendingStates.delete(state);
                    await this.savePendingStates();
                    return { success: false, error: 'Authentication cancelled' };
                } else {
                    return { success: false, error: 'Authentication failed' };
                }
            }
        } catch (error) {
            console.error('[OAuth] Authorization error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Authorization failed',
            };
        }
    }

    /**
     * Handle OAuth callback URL
     */
    async handleCallback(url: string): Promise<{ success: boolean; error?: string }> {
        await this.initialize();

        try {
            const { code, state, error, errorDescription } = parseOAuthCallback(url);

            if (error) {
                console.error('[OAuth] Callback error:', error, errorDescription);
                return {
                    success: false,
                    error: errorDescription || error,
                };
            }

            if (!state || !code) {
                return {
                    success: false,
                    error: 'Invalid callback: missing state or code',
                };
            }

            // Verify state
            const pendingState = this.pendingStates.get(state);
            if (!pendingState) {
                return {
                    success: false,
                    error: 'Invalid state parameter',
                };
            }

            // Check state expiration (10 minutes)
            if (Date.now() - pendingState.timestamp > 10 * 60 * 1000) {
                this.pendingStates.delete(state);
                await this.savePendingStates();
                return {
                    success: false,
                    error: 'Authorization expired. Please try again.',
                };
            }

            // Exchange code for tokens
            const config = OAUTH_PROVIDERS[pendingState.provider];
            const tokens = await this.exchangeCodeForTokens(
                config,
                code,
                pendingState.codeVerifier
            );

            // Fetch user info if available
            let user: OAuthUser | undefined;
            if (config.userInfoEndpoint) {
                user = await this.fetchUserInfo(config, tokens.accessToken);
            }

            // Create and save session
            const session: OAuthSession = {
                provider: pendingState.provider,
                tokens,
                user,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            this.sessions.set(pendingState.provider, session);
            await this.saveSessions();

            // Clean up pending state
            this.pendingStates.delete(state);
            await this.savePendingStates();

            console.log('[OAuth] Successfully authenticated with', pendingState.provider);
            return { success: true };
        } catch (error) {
            console.error('[OAuth] Callback handling error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to complete authentication',
            };
        }
    }

    /**
     * Exchange authorization code for tokens
     */
    private async exchangeCodeForTokens(
        config: OAuthConfig,
        code: string,
        codeVerifier?: string
    ): Promise<OAuthTokens> {
        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: config.clientId,
            code,
            redirect_uri: config.redirectUri,
        });

        if (codeVerifier) {
            body.append('code_verifier', codeVerifier);
        }

        if (config.clientSecret) {
            body.append('client_secret', config.clientSecret);
        }

        const response = await fetch(config.tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            },
            body: body.toString(),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                errorData.error_description ||
                errorData.error ||
                `Token exchange failed: ${response.status}`
            );
        }

        const data: OAuthTokenResponse = await response.json();

        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            idToken: data.id_token,
            tokenType: data.token_type || 'Bearer',
            expiresAt: data.expires_in
                ? Date.now() + data.expires_in * 1000
                : undefined,
            scopes: data.scope ? data.scope.split(' ') : config.scopes,
        };
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshToken(provider: OAuthProviderType): Promise<boolean> {
        await this.initialize();

        const session = this.sessions.get(provider);
        if (!session?.tokens.refreshToken) {
            console.warn('[OAuth] No refresh token available for', provider);
            return false;
        }

        try {
            const config = OAUTH_PROVIDERS[provider];
            const body = new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: config.clientId,
                refresh_token: session.tokens.refreshToken,
            });

            if (config.clientSecret) {
                body.append('client_secret', config.clientSecret);
            }

            const response = await fetch(config.tokenEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                },
                body: body.toString(),
            });

            if (!response.ok) {
                console.error('[OAuth] Token refresh failed:', response.status);
                return false;
            }

            const data: OAuthTokenResponse = await response.json();

            // Update session with new tokens
            session.tokens = {
                ...session.tokens,
                accessToken: data.access_token,
                refreshToken: data.refresh_token || session.tokens.refreshToken,
                expiresAt: data.expires_in
                    ? Date.now() + data.expires_in * 1000
                    : session.tokens.expiresAt,
            };
            session.updatedAt = Date.now();

            this.sessions.set(provider, session);
            await this.saveSessions();

            console.log('[OAuth] Token refreshed for', provider);
            return true;
        } catch (error) {
            console.error('[OAuth] Token refresh error:', error);
            return false;
        }
    }

    // =========================================================================
    // User Info
    // =========================================================================

    /**
     * Fetch user info from provider
     */
    private async fetchUserInfo(
        config: OAuthConfig,
        accessToken: string
    ): Promise<OAuthUser | undefined> {
        if (!config.userInfoEndpoint) return undefined;

        try {
            const response = await fetch(config.userInfoEndpoint, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                console.warn('[OAuth] Failed to fetch user info:', response.status);
                return undefined;
            }

            const data = await response.json();

            // Map provider-specific response to common format
            return {
                id: data.id || data.sub || data.user_id,
                email: data.email,
                name: data.name || data.displayName || data.login,
                picture: data.picture || data.avatar_url || data.photo,
                provider: config.providerId,
            };
        } catch (error) {
            console.warn('[OAuth] Error fetching user info:', error);
            return undefined;
        }
    }

    // =========================================================================
    // Session Management
    // =========================================================================

    /**
     * Get session for a provider
     */
    getSession(provider: OAuthProviderType): OAuthSession | undefined {
        return this.sessions.get(provider);
    }

    /**
     * Get all active sessions
     */
    getAllSessions(): OAuthSession[] {
        return Array.from(this.sessions.values());
    }

    /**
     * Check if authenticated with a provider
     */
    isAuthenticated(provider: OAuthProviderType): boolean {
        const session = this.sessions.get(provider);
        return !!session?.tokens.accessToken;
    }

    /**
     * Get valid access token (refreshing if needed)
     */
    async getAccessToken(provider: OAuthProviderType): Promise<string | null> {
        await this.initialize();

        const session = this.sessions.get(provider);
        if (!session) return null;

        // Check if token needs refresh
        if (isTokenExpired(session.tokens)) {
            const refreshed = await this.refreshToken(provider);
            if (!refreshed) {
                // Token refresh failed, clear session
                await this.logout(provider);
                return null;
            }
        }

        return session.tokens.accessToken;
    }

    /**
     * Logout from a provider
     */
    async logout(provider: OAuthProviderType): Promise<void> {
        await this.initialize();

        const session = this.sessions.get(provider);
        if (!session) return;

        // Try to revoke token at provider
        const config = OAUTH_PROVIDERS[provider];
        if (config.revokeEndpoint && session.tokens.accessToken) {
            try {
                await fetch(config.revokeEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        token: session.tokens.accessToken,
                        client_id: config.clientId,
                    }).toString(),
                });
            } catch (error) {
                console.warn('[OAuth] Token revocation failed:', error);
            }
        }

        // Remove session
        this.sessions.delete(provider);
        await this.saveSessions();

        console.log('[OAuth] Logged out from', provider);
    }

    /**
     * Logout from all providers
     */
    async logoutAll(): Promise<void> {
        await this.initialize();

        const providers = Array.from(this.sessions.keys());
        for (const provider of providers) {
            await this.logout(provider);
        }
    }

    // =========================================================================
    // Storage
    // =========================================================================

    private async saveSessions(): Promise<void> {
        try {
            const sessionsArray = Array.from(this.sessions.values());
            await SecureStore.setItemAsync(
                SESSIONS_KEY,
                JSON.stringify(sessionsArray)
            );
        } catch (error) {
            console.error('[OAuth] Failed to save sessions:', error);
        }
    }

    private async savePendingStates(): Promise<void> {
        try {
            const statesArray = Array.from(this.pendingStates.values());
            // Filter out expired states
            const validStates = statesArray.filter(
                state => Date.now() - state.timestamp < 10 * 60 * 1000
            );
            await SecureStore.setItemAsync(
                PENDING_STATE_KEY,
                JSON.stringify(validStates)
            );
        } catch (error) {
            console.error('[OAuth] Failed to save pending states:', error);
        }
    }

    // =========================================================================
    // Utility Methods
    // =========================================================================

    /**
     * Get headers for authenticated API requests
     */
    async getAuthHeaders(
        provider: OAuthProviderType
    ): Promise<Record<string, string> | null> {
        const token = await this.getAccessToken(provider);
        if (!token) return null;

        return {
            'Authorization': `Bearer ${token}`,
        };
    }

    /**
     * Check if OAuth is configured for a provider
     */
    isProviderConfigured(provider: OAuthProviderType): boolean {
        const config = OAUTH_PROVIDERS[provider];
        return !!config?.clientId;
    }

    /**
     * Set client ID for a provider (for dynamic configuration)
     */
    setClientId(provider: OAuthProviderType, clientId: string): void {
        if (OAUTH_PROVIDERS[provider]) {
            OAUTH_PROVIDERS[provider].clientId = clientId;
        }
    }
}

// =============================================================================
// Export Singleton Instance
// =============================================================================

export const oauthService = new OAuthService();

// =============================================================================
// Convenience Functions
// =============================================================================

export async function initializeOAuth(): Promise<void> {
    return oauthService.initialize();
}

export async function authorizeProvider(
    provider: OAuthProviderType,
    clientId?: string
): Promise<{ success: boolean; error?: string }> {
    return oauthService.authorize(provider, clientId);
}

export async function handleOAuthCallback(
    url: string
): Promise<{ success: boolean; error?: string }> {
    return oauthService.handleCallback(url);
}

export async function getOAuthToken(
    provider: OAuthProviderType
): Promise<string | null> {
    return oauthService.getAccessToken(provider);
}

export async function logoutProvider(
    provider: OAuthProviderType
): Promise<void> {
    return oauthService.logout(provider);
}

export function isProviderAuthenticated(
    provider: OAuthProviderType
): boolean {
    return oauthService.isAuthenticated(provider);
}
