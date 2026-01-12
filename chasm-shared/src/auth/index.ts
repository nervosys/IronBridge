// =============================================================================
// CSM Authentication Module
// =============================================================================
// Client-side authentication for CSM sync services

import type {
    User,
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    RefreshTokenRequest,
    RefreshTokenResponse,
    Subscription,
    SubscribeRequest,
    PasswordChangeRequest,
    PasswordResetRequest,
    ApiKey,
    CreateApiKeyRequest,
    CreateApiKeyResponse,
    DeviceSession,
    AuthState,
} from '../types';

// =============================================================================
// Storage Keys
// =============================================================================

const STORAGE_KEYS = {
    ACCESS_TOKEN: 'csm_access_token',
    REFRESH_TOKEN: 'csm_refresh_token',
    TOKEN_EXPIRY: 'csm_token_expiry',
    USER: 'csm_user',
} as const;

// =============================================================================
// Auth Service Configuration
// =============================================================================

export interface AuthServiceConfig {
    baseUrl: string;
    onAuthStateChange?: (state: AuthState) => void;
    onTokenRefresh?: (accessToken: string) => void;
    storage?: Storage;
}

// =============================================================================
// Auth Service Class
// =============================================================================

export class AuthService {
    private baseUrl: string;
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private tokenExpiry: number | null = null;
    private user: User | null = null;
    private refreshPromise: Promise<string> | null = null;
    private storage: Storage;
    private onAuthStateChange?: (state: AuthState) => void;
    private onTokenRefresh?: (accessToken: string) => void;

    constructor(config: AuthServiceConfig) {
        this.baseUrl = config.baseUrl.replace(/\/$/, '');
        this.onAuthStateChange = config.onAuthStateChange;
        this.onTokenRefresh = config.onTokenRefresh;

        // Use provided storage or default to localStorage
        // Create a no-op storage for SSR/Node environments
        const noopStorage: Storage = {
            length: 0,
            clear: () => { },
            getItem: () => null,
            key: () => null,
            removeItem: () => { },
            setItem: () => { },
        };
        this.storage = config.storage ?? (typeof localStorage !== 'undefined' ? localStorage : noopStorage);

        // Load stored tokens
        this.loadStoredAuth();
    }

    // =========================================================================
    // Token Management
    // =========================================================================

    private loadStoredAuth(): void {
        try {
            this.accessToken = this.storage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
            this.refreshToken = this.storage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
            const expiry = this.storage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
            this.tokenExpiry = expiry ? parseInt(expiry, 10) : null;

            const userJson = this.storage.getItem(STORAGE_KEYS.USER);
            this.user = userJson ? JSON.parse(userJson) : null;
        } catch (error) {
            console.error('Failed to load stored auth:', error);
            this.clearStoredAuth();
        }
    }

    private storeAuth(response: AuthResponse): void {
        this.accessToken = response.accessToken;
        this.refreshToken = response.refreshToken;
        this.tokenExpiry = response.expiresAt;
        this.user = response.user;

        this.storage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.accessToken);
        this.storage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);
        this.storage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, response.expiresAt.toString());
        this.storage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));

        this.notifyAuthStateChange();
    }

    private clearStoredAuth(): void {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        this.user = null;

        this.storage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        this.storage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        this.storage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
        this.storage.removeItem(STORAGE_KEYS.USER);

        this.notifyAuthStateChange();
    }

    private notifyAuthStateChange(): void {
        this.onAuthStateChange?.({
            isAuthenticated: this.isAuthenticated(),
            isLoading: false,
            user: this.user,
            error: null,
        });
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        return this.accessToken !== null && this.user !== null;
    }

    /**
     * Check if token needs refresh (within 5 minutes of expiry)
     */
    private needsRefresh(): boolean {
        if (!this.tokenExpiry) return false;
        const now = Math.floor(Date.now() / 1000);
        return this.tokenExpiry - now < 300; // 5 minutes
    }

    /**
     * Get current access token, refreshing if needed
     */
    async getAccessToken(): Promise<string | null> {
        if (!this.accessToken) return null;

        if (this.needsRefresh() && this.refreshToken) {
            try {
                return await this.refreshAccessToken();
            } catch {
                // Token refresh failed, user needs to re-login
                this.clearStoredAuth();
                return null;
            }
        }

        return this.accessToken;
    }

    /**
     * Refresh the access token
     */
    private async refreshAccessToken(): Promise<string> {
        // If already refreshing, wait for that promise
        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        this.refreshPromise = (async () => {
            if (!this.refreshToken) {
                throw new Error('No refresh token available');
            }

            const response = await this.request<RefreshTokenResponse>('/auth/refresh', {
                method: 'POST',
                body: JSON.stringify({ refreshToken: this.refreshToken } as RefreshTokenRequest),
                skipAuth: true,
            });

            this.accessToken = response.accessToken;
            this.tokenExpiry = response.expiresAt;

            this.storage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.accessToken);
            this.storage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, response.expiresAt.toString());

            this.onTokenRefresh?.(response.accessToken);

            return response.accessToken;
        })();

        try {
            return await this.refreshPromise;
        } finally {
            this.refreshPromise = null;
        }
    }

    // =========================================================================
    // HTTP Request Helper
    // =========================================================================

    private async request<T>(
        path: string,
        options: {
            method?: string;
            body?: string;
            skipAuth?: boolean;
        } = {}
    ): Promise<T> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (!options.skipAuth && this.accessToken) {
            headers['Authorization'] = `Bearer ${this.accessToken}`;
        }

        const response = await fetch(`${this.baseUrl}${path}`, {
            method: options.method ?? 'GET',
            headers,
            body: options.body,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new AuthError(error.message || 'Request failed', response.status);
        }

        return response.json();
    }

    // =========================================================================
    // Authentication Methods
    // =========================================================================

    /**
     * Register a new user account
     */
    async register(request: RegisterRequest): Promise<AuthResponse> {
        const response = await this.request<AuthResponse>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(request),
            skipAuth: true,
        });

        this.storeAuth(response);
        return response;
    }

    /**
     * Login with email and password
     */
    async login(request: LoginRequest): Promise<AuthResponse> {
        const response = await this.request<AuthResponse>('/auth/login', {
            method: 'POST',
            body: JSON.stringify(request),
            skipAuth: true,
        });

        this.storeAuth(response);
        return response;
    }

    /**
     * Logout and invalidate tokens
     */
    async logout(): Promise<void> {
        try {
            if (this.accessToken) {
                await this.request('/auth/logout', {
                    method: 'POST',
                });
            }
        } catch {
            // Ignore logout errors
        } finally {
            this.clearStoredAuth();
        }
    }

    /**
     * Get current user info
     */
    async getCurrentUser(): Promise<User> {
        const token = await this.getAccessToken();
        if (!token) {
            throw new AuthError('Not authenticated', 401);
        }

        const user = await this.request<User>('/auth/me');
        this.user = user;
        this.storage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        this.notifyAuthStateChange();
        return user;
    }

    /**
     * Get cached user without API call
     */
    getUser(): User | null {
        return this.user;
    }

    // =========================================================================
    // Subscription Methods
    // =========================================================================

    /**
     * Get current subscription details
     */
    async getSubscription(): Promise<Subscription> {
        return this.request<Subscription>('/auth/subscription');
    }

    /**
     * Subscribe to a tier
     */
    async subscribe(request: SubscribeRequest): Promise<Subscription> {
        const subscription = await this.request<Subscription>('/auth/subscribe', {
            method: 'POST',
            body: JSON.stringify(request),
        });

        // Update cached user subscription
        if (this.user) {
            this.user.subscription = subscription;
            this.storage.setItem(STORAGE_KEYS.USER, JSON.stringify(this.user));
            this.notifyAuthStateChange();
        }

        return subscription;
    }

    /**
     * Cancel subscription (downgrade to free)
     */
    async cancelSubscription(): Promise<Subscription> {
        return this.request<Subscription>('/auth/subscription/cancel', {
            method: 'POST',
        });
    }

    // =========================================================================
    // Password Management
    // =========================================================================

    /**
     * Request password reset email
     */
    async requestPasswordReset(request: PasswordResetRequest): Promise<void> {
        await this.request('/auth/password/reset', {
            method: 'POST',
            body: JSON.stringify(request),
            skipAuth: true,
        });
    }

    /**
     * Change password (requires authentication)
     */
    async changePassword(request: PasswordChangeRequest): Promise<void> {
        await this.request('/auth/password/change', {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }

    // =========================================================================
    // API Key Management
    // =========================================================================

    /**
     * List API keys
     */
    async listApiKeys(): Promise<ApiKey[]> {
        return this.request<ApiKey[]>('/auth/api-keys');
    }

    /**
     * Create a new API key
     */
    async createApiKey(request: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
        return this.request<CreateApiKeyResponse>('/auth/api-keys', {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }

    /**
     * Delete an API key
     */
    async deleteApiKey(keyId: string): Promise<void> {
        await this.request(`/auth/api-keys/${keyId}`, {
            method: 'DELETE',
        });
    }

    // =========================================================================
    // Device/Session Management
    // =========================================================================

    /**
     * List active device sessions
     */
    async listDeviceSessions(): Promise<DeviceSession[]> {
        return this.request<DeviceSession[]>('/auth/sessions');
    }

    /**
     * Revoke a device session
     */
    async revokeDeviceSession(sessionId: string): Promise<void> {
        await this.request(`/auth/sessions/${sessionId}`, {
            method: 'DELETE',
        });
    }

    /**
     * Revoke all other device sessions
     */
    async revokeAllOtherSessions(): Promise<void> {
        await this.request('/auth/sessions/revoke-others', {
            method: 'POST',
        });
    }

    // =========================================================================
    // Authorization Header Helper
    // =========================================================================

    /**
     * Get authorization headers for API requests
     */
    async getAuthHeaders(): Promise<Record<string, string>> {
        const token = await this.getAccessToken();
        if (!token) {
            return {};
        }
        return {
            'Authorization': `Bearer ${token}`,
        };
    }
}

// =============================================================================
// Auth Error Class
// =============================================================================

export class AuthError extends Error {
    constructor(
        message: string,
        public statusCode: number
    ) {
        super(message);
        this.name = 'AuthError';
    }

    isUnauthorized(): boolean {
        return this.statusCode === 401;
    }

    isForbidden(): boolean {
        return this.statusCode === 403;
    }
}

// =============================================================================
// Singleton Instance Helper
// =============================================================================

let defaultInstance: AuthService | null = null;

/**
 * Initialize the default auth service instance
 */
export function initAuthService(config: AuthServiceConfig): AuthService {
    defaultInstance = new AuthService(config);
    return defaultInstance;
}

/**
 * Get the default auth service instance
 */
export function getAuthService(): AuthService {
    if (!defaultInstance) {
        throw new Error('AuthService not initialized. Call initAuthService() first.');
    }
    return defaultInstance;
}

// =============================================================================
// Re-export types
// =============================================================================

export type {
    User,
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    RefreshTokenRequest,
    RefreshTokenResponse,
    Subscription,
    SubscribeRequest,
    PasswordChangeRequest,
    PasswordResetRequest,
    ApiKey,
    CreateApiKeyRequest,
    CreateApiKeyResponse,
    DeviceSession,
    AuthState,
};
