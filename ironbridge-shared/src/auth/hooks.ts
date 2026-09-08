// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// =============================================================================
// IRONBRIDGE Authentication React Hooks
// =============================================================================
// React hooks and context for authentication in IRONBRIDGE applications

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useMemo,
    type ReactNode,
} from 'react';

import type {
    User,
    AuthState,
    LoginRequest,
    RegisterRequest,
    Subscription,
    SubscribeRequest,
    SubscriptionTier,
    SubscriptionLimits,
} from '../types';
import { AuthService, AuthServiceConfig, AuthError } from './index';

// =============================================================================
// Auth Context
// =============================================================================

interface AuthContextValue extends AuthState {
    login: (request: LoginRequest) => Promise<void>;
    register: (request: RegisterRequest) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    getAccessToken: () => Promise<string | null>;
    service: AuthService;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// =============================================================================
// Auth Provider
// =============================================================================

export interface AuthProviderProps {
    children: ReactNode;
    config: AuthServiceConfig;
}

export function AuthProvider({ children, config }: AuthProviderProps): React.ReactElement {
    const [state, setState] = useState<AuthState>({
        isAuthenticated: false,
        isLoading: true,
        user: null,
        error: null,
    });

    // Create auth service with state change handler
    const service = useMemo(() => {
        return new AuthService({
            ...config,
            onAuthStateChange: (newState) => {
                setState(newState);
            },
        });
    }, [config]);

    // Initialize - check for stored auth
    useEffect(() => {
        const init = async () => {
            try {
                const token = await service.getAccessToken();
                if (token) {
                    await service.getCurrentUser();
                }
            } catch (error) {
                console.error('Auth initialization failed:', error);
            } finally {
                setState((s) => ({ ...s, isLoading: false }));
            }
        };

        init();
    }, [service]);

    const login = useCallback(
        async (request: LoginRequest) => {
            setState((s) => ({ ...s, isLoading: true, error: null }));
            try {
                await service.login(request);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Login failed';
                setState((s) => ({ ...s, isLoading: false, error: message }));
                throw error;
            }
        },
        [service]
    );

    const register = useCallback(
        async (request: RegisterRequest) => {
            setState((s) => ({ ...s, isLoading: true, error: null }));
            try {
                await service.register(request);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Registration failed';
                setState((s) => ({ ...s, isLoading: false, error: message }));
                throw error;
            }
        },
        [service]
    );

    const logout = useCallback(async () => {
        setState((s) => ({ ...s, isLoading: true }));
        try {
            await service.logout();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setState({
                isAuthenticated: false,
                isLoading: false,
                user: null,
                error: null,
            });
        }
    }, [service]);

    const refreshUser = useCallback(async () => {
        try {
            await service.getCurrentUser();
        } catch (error) {
            console.error('Failed to refresh user:', error);
        }
    }, [service]);

    const getAccessToken = useCallback(() => {
        return service.getAccessToken();
    }, [service]);

    const value: AuthContextValue = {
        ...state,
        login,
        register,
        logout,
        refreshUser,
        getAccessToken,
        service,
    };

    return React.createElement(AuthContext.Provider, { value }, children);
}

// =============================================================================
// useAuth Hook
// =============================================================================

/**
 * Hook to access authentication state and methods
 */
export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

// =============================================================================
// useUser Hook
// =============================================================================

/**
 * Hook to access current user
 */
export function useUser(): User | null {
    const { user } = useAuth();
    return user;
}

// =============================================================================
// useSubscription Hook
// =============================================================================

interface UseSubscriptionResult {
    subscription: Subscription | null;
    tier: SubscriptionTier;
    limits: SubscriptionLimits | null;
    isLoading: boolean;
    error: string | null;
    subscribe: (request: SubscribeRequest) => Promise<void>;
    cancelSubscription: () => Promise<void>;
    refresh: () => Promise<void>;
    canUseFeature: (feature: keyof SubscriptionLimits) => boolean;
    isWithinLimit: (resource: 'workspaces' | 'sessions' | 'agents' | 'swarms', count: number) => boolean;
}

/**
 * Hook to manage subscription
 */
export function useSubscription(): UseSubscriptionResult {
    const { user, service } = useAuth();
    const [subscription, setSubscription] = useState<Subscription | null>(
        user?.subscription ?? null
    );
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Update subscription when user changes
    useEffect(() => {
        setSubscription(user?.subscription ?? null);
    }, [user?.subscription]);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const sub = await service.getSubscription();
            setSubscription(sub);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load subscription';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [service]);

    const subscribe = useCallback(
        async (request: SubscribeRequest) => {
            setIsLoading(true);
            setError(null);
            try {
                const sub = await service.subscribe(request);
                setSubscription(sub);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to subscribe';
                setError(message);
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        [service]
    );

    const cancelSubscription = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const sub = await service.cancelSubscription();
            setSubscription(sub);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to cancel subscription';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [service]);

    const canUseFeature = useCallback(
        (feature: keyof SubscriptionLimits): boolean => {
            if (!subscription) return false;
            const value = subscription.limits[feature];
            return typeof value === 'boolean' ? value : true;
        },
        [subscription]
    );

    const isWithinLimit = useCallback(
        (resource: 'workspaces' | 'sessions' | 'agents' | 'swarms', count: number): boolean => {
            if (!subscription) return false;
            const limitKey = `max${resource.charAt(0).toUpperCase() + resource.slice(1)}` as keyof SubscriptionLimits;
            const limit = subscription.limits[limitKey];
            if (typeof limit !== 'number') return false;
            return limit === -1 || count < limit; // -1 = unlimited
        },
        [subscription]
    );

    return {
        subscription,
        tier: subscription?.tier ?? 'free',
        limits: subscription?.limits ?? null,
        isLoading,
        error,
        subscribe,
        cancelSubscription,
        refresh,
        canUseFeature,
        isWithinLimit,
    };
}

// =============================================================================
// useRequireAuth Hook
// =============================================================================

interface UseRequireAuthOptions {
    redirectTo?: string;
    requiredTier?: SubscriptionTier;
}

/**
 * Hook that ensures user is authenticated, optionally with a specific tier
 */
export function useRequireAuth(options: UseRequireAuthOptions = {}): {
    isAuthorized: boolean;
    isLoading: boolean;
    user: User | null;
} {
    const { isAuthenticated, isLoading, user } = useAuth();
    const { subscription } = useSubscription();

    const tierPriority: Record<SubscriptionTier, number> = {
        free: 0,
        pro: 1,
        enterprise: 2,
    };

    const isAuthorized = useMemo(() => {
        if (!isAuthenticated) return false;
        if (!options.requiredTier) return true;
        if (!subscription) return false;

        return tierPriority[subscription.tier] >= tierPriority[options.requiredTier];
    }, [isAuthenticated, subscription, options.requiredTier]);

    return {
        isAuthorized,
        isLoading,
        user,
    };
}

// =============================================================================
// useApiKeys Hook
// =============================================================================

import type { ApiKey, CreateApiKeyRequest, CreateApiKeyResponse } from '../types';

interface UseApiKeysResult {
    apiKeys: ApiKey[];
    isLoading: boolean;
    error: string | null;
    createKey: (request: CreateApiKeyRequest) => Promise<CreateApiKeyResponse>;
    deleteKey: (keyId: string) => Promise<void>;
    refresh: () => Promise<void>;
}

/**
 * Hook to manage API keys
 */
export function useApiKeys(): UseApiKeysResult {
    const { service } = useAuth();
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const keys = await service.listApiKeys();
            setApiKeys(keys);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load API keys';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [service]);

    const createKey = useCallback(
        async (request: CreateApiKeyRequest): Promise<CreateApiKeyResponse> => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await service.createApiKey(request);
                setApiKeys((prev) => [...prev, response.apiKey]);
                return response;
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to create API key';
                setError(message);
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        [service]
    );

    const deleteKey = useCallback(
        async (keyId: string) => {
            setIsLoading(true);
            setError(null);
            try {
                await service.deleteApiKey(keyId);
                setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to delete API key';
                setError(message);
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        [service]
    );

    // Load on mount
    useEffect(() => {
        refresh();
    }, [refresh]);

    return {
        apiKeys,
        isLoading,
        error,
        createKey,
        deleteKey,
        refresh,
    };
}

// =============================================================================
// useDeviceSessions Hook
// =============================================================================

import type { DeviceSession } from '../types';

interface UseDeviceSessionsResult {
    sessions: DeviceSession[];
    isLoading: boolean;
    error: string | null;
    revokeSession: (sessionId: string) => Promise<void>;
    revokeAllOther: () => Promise<void>;
    refresh: () => Promise<void>;
}

/**
 * Hook to manage device sessions
 */
export function useDeviceSessions(): UseDeviceSessionsResult {
    const { service } = useAuth();
    const [sessions, setSessions] = useState<DeviceSession[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const deviceSessions = await service.listDeviceSessions();
            setSessions(deviceSessions);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load sessions';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, [service]);

    const revokeSession = useCallback(
        async (sessionId: string) => {
            setIsLoading(true);
            setError(null);
            try {
                await service.revokeDeviceSession(sessionId);
                setSessions((prev) => prev.filter((s) => s.id !== sessionId));
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to revoke session';
                setError(message);
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        [service]
    );

    const revokeAllOther = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            await service.revokeAllOtherSessions();
            setSessions((prev) => prev.filter((s) => s.isCurrent));
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to revoke sessions';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [service]);

    // Load on mount
    useEffect(() => {
        refresh();
    }, [refresh]);

    return {
        sessions,
        isLoading,
        error,
        revokeSession,
        revokeAllOther,
        refresh,
    };
}

// =============================================================================
// Re-exports
// =============================================================================

export { AuthService, AuthError } from './index';
export type { AuthServiceConfig } from './index';
