// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// =============================================================================
// OAuth2 Types and Configuration
// =============================================================================
// Comprehensive OAuth2 implementation for Chat and Agent providers

// =============================================================================
// Types
// =============================================================================

export type OAuthProviderType =
    | 'openai'
    | 'anthropic'
    | 'azure'
    | 'google'
    | 'github'
    | 'microsoft';

export interface OAuthConfig {
    providerId: OAuthProviderType;
    displayName: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
    revokeEndpoint?: string;
    userInfoEndpoint?: string;
    clientId: string;
    clientSecret?: string; // Only for confidential clients (backend)
    scopes: string[];
    responseType: 'code' | 'token';
    pkceRequired: boolean;
    additionalParams?: Record<string, string>;
    redirectUri: string;
}

export interface OAuthTokenResponse {
    access_token: string;
    token_type: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
    id_token?: string;
}

export interface OAuthTokens {
    accessToken: string;
    refreshToken?: string;
    idToken?: string;
    tokenType: string;
    expiresAt?: number; // Unix timestamp
    scopes: string[];
}

export interface OAuthUser {
    id: string;
    email?: string;
    name?: string;
    picture?: string;
    provider: OAuthProviderType;
}

export interface OAuthSession {
    provider: OAuthProviderType;
    tokens: OAuthTokens;
    user?: OAuthUser;
    createdAt: number;
    updatedAt: number;
}

export interface OAuthState {
    state: string;
    codeVerifier?: string; // For PKCE
    provider: OAuthProviderType;
    redirectUri: string;
    timestamp: number;
}

export interface OAuthError {
    error: string;
    error_description?: string;
    error_uri?: string;
}

// =============================================================================
// OAuth Provider Configurations
// =============================================================================

// App-specific redirect URIs
const REDIRECT_SCHEME = 'ironbridge';
const WEB_REDIRECT_URI = 'http://localhost:8081/oauth/callback';
const NATIVE_REDIRECT_URI = `${REDIRECT_SCHEME}://oauth/callback`;

export const OAUTH_PROVIDERS: Record<OAuthProviderType, OAuthConfig> = {
    openai: {
        providerId: 'openai',
        displayName: 'OpenAI',
        authorizationEndpoint: 'https://auth.openai.com/authorize',
        tokenEndpoint: 'https://auth.openai.com/oauth/token',
        revokeEndpoint: 'https://auth.openai.com/oauth/revoke',
        userInfoEndpoint: 'https://api.openai.com/v1/me',
        clientId: '', // Set via environment or settings
        scopes: [
            'openid',
            'profile',
            'email',
            'model.read',
            'model.request',
            'organization.read',
        ],
        responseType: 'code',
        pkceRequired: true,
        redirectUri: NATIVE_REDIRECT_URI,
    },
    anthropic: {
        providerId: 'anthropic',
        displayName: 'Anthropic (Claude)',
        authorizationEndpoint: 'https://console.anthropic.com/oauth/authorize',
        tokenEndpoint: 'https://console.anthropic.com/oauth/token',
        revokeEndpoint: 'https://console.anthropic.com/oauth/revoke',
        userInfoEndpoint: 'https://api.anthropic.com/v1/me',
        clientId: '',
        scopes: [
            'messages:write',
            'messages:read',
            'models:read',
        ],
        responseType: 'code',
        pkceRequired: true,
        redirectUri: NATIVE_REDIRECT_URI,
    },
    azure: {
        providerId: 'azure',
        displayName: 'Azure AI',
        authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        revokeEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/logout',
        userInfoEndpoint: 'https://graph.microsoft.com/v1.0/me',
        clientId: '',
        scopes: [
            'openid',
            'profile',
            'email',
            'offline_access',
            'https://cognitiveservices.azure.com/.default',
        ],
        responseType: 'code',
        pkceRequired: true,
        additionalParams: {
            prompt: 'select_account',
        },
        redirectUri: NATIVE_REDIRECT_URI,
    },
    google: {
        providerId: 'google',
        displayName: 'Google AI',
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
        revokeEndpoint: 'https://oauth2.googleapis.com/revoke',
        userInfoEndpoint: 'https://www.googleapis.com/oauth2/v2/userinfo',
        clientId: '',
        scopes: [
            'openid',
            'profile',
            'email',
            'https://www.googleapis.com/auth/generative-language.retriever',
            'https://www.googleapis.com/auth/cloud-platform',
        ],
        responseType: 'code',
        pkceRequired: true,
        additionalParams: {
            access_type: 'offline',
            prompt: 'consent',
        },
        redirectUri: NATIVE_REDIRECT_URI,
    },
    github: {
        providerId: 'github',
        displayName: 'GitHub',
        authorizationEndpoint: 'https://github.com/login/oauth/authorize',
        tokenEndpoint: 'https://github.com/login/oauth/access_token',
        userInfoEndpoint: 'https://api.github.com/user',
        clientId: '',
        scopes: [
            'read:user',
            'user:email',
            'copilot',
        ],
        responseType: 'code',
        pkceRequired: false,
        redirectUri: NATIVE_REDIRECT_URI,
    },
    microsoft: {
        providerId: 'microsoft',
        displayName: 'Microsoft 365 Copilot',
        authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        revokeEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/logout',
        userInfoEndpoint: 'https://graph.microsoft.com/v1.0/me',
        clientId: '',
        scopes: [
            'openid',
            'profile',
            'email',
            'offline_access',
            'User.Read',
            'Chat.Read',
            'Chat.ReadWrite',
        ],
        responseType: 'code',
        pkceRequired: true,
        additionalParams: {
            prompt: 'select_account',
        },
        redirectUri: NATIVE_REDIRECT_URI,
    },
};

// =============================================================================
// Scope Descriptions (for UI display)
// =============================================================================

export const SCOPE_DESCRIPTIONS: Record<string, string> = {
    // Common
    'openid': 'Access your identity',
    'profile': 'View your basic profile',
    'email': 'View your email address',
    'offline_access': 'Maintain access when you\'re not using the app',

    // OpenAI
    'model.read': 'View available AI models',
    'model.request': 'Make requests to AI models',
    'organization.read': 'View organization details',

    // Anthropic
    'messages:write': 'Send messages to Claude',
    'messages:read': 'Read conversation history',
    'models:read': 'View available Claude models',

    // Azure
    'https://cognitiveservices.azure.com/.default': 'Access Azure AI services',

    // Google
    'https://www.googleapis.com/auth/generative-language.retriever': 'Access Gemini AI',
    'https://www.googleapis.com/auth/cloud-platform': 'Access Google Cloud services',

    // GitHub
    'read:user': 'View your GitHub profile',
    'user:email': 'View your GitHub email',
    'copilot': 'Access GitHub Copilot',

    // Microsoft
    'User.Read': 'View your Microsoft profile',
    'Chat.Read': 'Read your chats',
    'Chat.ReadWrite': 'Read and write your chats',
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a random state parameter for OAuth
 */
export function generateOAuthState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate PKCE code verifier (43-128 characters)
 */
export function generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return base64UrlEncode(array);
}

/**
 * Generate PKCE code challenge from verifier
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Base64 URL encode (for PKCE)
 */
function base64UrlEncode(buffer: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < buffer.length; i++) {
        binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * Build authorization URL with all parameters
 */
export async function buildAuthorizationUrl(
    config: OAuthConfig,
    state: string,
    codeVerifier?: string
): Promise<{ url: string; codeVerifier?: string }> {
    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: config.responseType,
        scope: config.scopes.join(' '),
        state,
    });

    let finalCodeVerifier = codeVerifier;

    // Add PKCE parameters if required
    if (config.pkceRequired) {
        finalCodeVerifier = finalCodeVerifier || generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(finalCodeVerifier);
        params.append('code_challenge', codeChallenge);
        params.append('code_challenge_method', 'S256');
    }

    // Add any additional provider-specific parameters
    if (config.additionalParams) {
        Object.entries(config.additionalParams).forEach(([key, value]) => {
            params.append(key, value);
        });
    }

    return {
        url: `${config.authorizationEndpoint}?${params.toString()}`,
        codeVerifier: finalCodeVerifier,
    };
}

/**
 * Parse OAuth callback URL
 */
export function parseOAuthCallback(url: string): {
    code?: string;
    state?: string;
    error?: string;
    errorDescription?: string;
} {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);

    // Also check hash for implicit flow
    if (urlObj.hash) {
        const hashParams = new URLSearchParams(urlObj.hash.slice(1));
        hashParams.forEach((value, key) => {
            if (!params.has(key)) {
                params.append(key, value);
            }
        });
    }

    return {
        code: params.get('code') || undefined,
        state: params.get('state') || undefined,
        error: params.get('error') || undefined,
        errorDescription: params.get('error_description') || undefined,
    };
}

/**
 * Check if tokens are expired (with 5 minute buffer)
 */
export function isTokenExpired(tokens: OAuthTokens): boolean {
    if (!tokens.expiresAt) return false;
    const bufferMs = 5 * 60 * 1000; // 5 minutes
    return Date.now() + bufferMs >= tokens.expiresAt;
}

/**
 * Get provider config with optional overrides
 */
export function getProviderConfig(
    provider: OAuthProviderType,
    overrides?: Partial<OAuthConfig>
): OAuthConfig {
    const baseConfig = OAUTH_PROVIDERS[provider];
    return {
        ...baseConfig,
        ...overrides,
    };
}

/**
 * Map provider type to OAuth provider
 */
export function mapChatProviderToOAuth(
    chatProviderType: string
): OAuthProviderType | null {
    const mapping: Record<string, OAuthProviderType> = {
        'openai': 'openai',
        'anthropic': 'anthropic',
        'azure-openai': 'azure',
        'google': 'google',
        'groq': null as any, // Groq uses API keys only
        'together': null as any, // Together uses API keys only
        'openrouter': null as any, // OpenRouter uses API keys only
    };
    return mapping[chatProviderType] || null;
}
