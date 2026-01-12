// =============================================================================
// Authentication Context
// =============================================================================
// Provides OAuth authentication state management for the entire app

import React, {
    createContext,
    useContext,
    useReducer,
    useEffect,
    useCallback,
    ReactNode,
} from 'react';
import * as Linking from 'expo-linking';

import {
    OAuthProviderType,
    OAuthSession,
    OAuthUser,
    OAuthTokens,
    OAUTH_PROVIDERS,
} from '../api/oauth';
import {
    oauthService,
    initializeOAuth,
    authorizeProvider,
    handleOAuthCallback,
    logoutProvider,
} from '../services/oauth';

// =============================================================================
// Types
// =============================================================================

interface AuthState {
    isInitialized: boolean;
    isLoading: boolean;
    sessions: Record<OAuthProviderType, OAuthSession | null>;
    error: string | null;
}

type AuthAction =
    | { type: 'INITIALIZE_START' }
    | { type: 'INITIALIZE_COMPLETE'; payload: OAuthSession[] }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'SET_SESSION'; payload: { provider: OAuthProviderType; session: OAuthSession | null } }
    | { type: 'CLEAR_SESSION'; payload: OAuthProviderType }
    | { type: 'CLEAR_ALL_SESSIONS' };

interface AuthContextValue extends AuthState {
    // Authentication actions
    login: (provider: OAuthProviderType, clientId?: string) => Promise<boolean>;
    logout: (provider: OAuthProviderType) => Promise<void>;
    logoutAll: () => Promise<void>;

    // Token access
    getAccessToken: (provider: OAuthProviderType) => Promise<string | null>;
    getAuthHeaders: (provider: OAuthProviderType) => Promise<Record<string, string> | null>;

    // Session info
    isAuthenticated: (provider: OAuthProviderType) => boolean;
    getUser: (provider: OAuthProviderType) => OAuthUser | undefined;
    getSession: (provider: OAuthProviderType) => OAuthSession | null;

    // Configuration
    setClientId: (provider: OAuthProviderType, clientId: string) => void;
    isProviderConfigured: (provider: OAuthProviderType) => boolean;

    // All authenticated providers
    authenticatedProviders: OAuthProviderType[];
}

// =============================================================================
// Reducer
// =============================================================================

function authReducer(state: AuthState, action: AuthAction): AuthState {
    switch (action.type) {
        case 'INITIALIZE_START':
            return { ...state, isLoading: true };

        case 'INITIALIZE_COMPLETE': {
            const sessions: Record<OAuthProviderType, OAuthSession | null> = {
                openai: null,
                anthropic: null,
                azure: null,
                google: null,
                github: null,
                microsoft: null,
            };
            action.payload.forEach(session => {
                sessions[session.provider] = session;
            });
            return {
                ...state,
                isInitialized: true,
                isLoading: false,
                sessions,
            };
        }

        case 'SET_LOADING':
            return { ...state, isLoading: action.payload };

        case 'SET_ERROR':
            return { ...state, error: action.payload };

        case 'SET_SESSION':
            return {
                ...state,
                sessions: {
                    ...state.sessions,
                    [action.payload.provider]: action.payload.session,
                },
            };

        case 'CLEAR_SESSION':
            return {
                ...state,
                sessions: {
                    ...state.sessions,
                    [action.payload]: null,
                },
            };

        case 'CLEAR_ALL_SESSIONS':
            return {
                ...state,
                sessions: {
                    openai: null,
                    anthropic: null,
                    azure: null,
                    google: null,
                    github: null,
                    microsoft: null,
                },
            };

        default:
            return state;
    }
}

// =============================================================================
// Initial State
// =============================================================================

const initialState: AuthState = {
    isInitialized: false,
    isLoading: false,
    sessions: {
        openai: null,
        anthropic: null,
        azure: null,
        google: null,
        github: null,
        microsoft: null,
    },
    error: null,
};

// =============================================================================
// Context
// =============================================================================

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// =============================================================================
// Provider Component
// =============================================================================

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [state, dispatch] = useReducer(authReducer, initialState);

    // Initialize OAuth on mount
    useEffect(() => {
        async function init() {
            dispatch({ type: 'INITIALIZE_START' });
            try {
                await initializeOAuth();
                const sessions = oauthService.getAllSessions();
                dispatch({ type: 'INITIALIZE_COMPLETE', payload: sessions });
            } catch (error) {
                console.error('[Auth] Initialization error:', error);
                dispatch({ type: 'INITIALIZE_COMPLETE', payload: [] });
            }
        }
        init();
    }, []);

    // Handle deep link callbacks
    useEffect(() => {
        // Handle initial URL (app opened via deep link)
        async function handleInitialUrl() {
            const url = await Linking.getInitialURL();
            if (url && url.includes('oauth/callback')) {
                await handleDeepLink(url);
            }
        }
        handleInitialUrl();

        // Listen for incoming links
        const subscription = Linking.addEventListener('url', async (event) => {
            if (event.url.includes('oauth/callback')) {
                await handleDeepLink(event.url);
            }
        });

        return () => {
            subscription.remove();
        };
    }, []);

    // Handle OAuth deep link callback
    const handleDeepLink = useCallback(async (url: string) => {
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });

        try {
            const result = await handleOAuthCallback(url);
            if (result.success) {
                // Reload sessions after successful auth
                const sessions = oauthService.getAllSessions();
                sessions.forEach(session => {
                    dispatch({
                        type: 'SET_SESSION',
                        payload: { provider: session.provider, session },
                    });
                });
            } else if (result.error) {
                dispatch({ type: 'SET_ERROR', payload: result.error });
            }
        } catch (error) {
            console.error('[Auth] Deep link handling error:', error);
            dispatch({
                type: 'SET_ERROR',
                payload: error instanceof Error ? error.message : 'Authentication failed',
            });
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    }, []);

    // Login to a provider
    const login = useCallback(async (
        provider: OAuthProviderType,
        clientId?: string
    ): Promise<boolean> => {
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });

        try {
            const result = await authorizeProvider(provider, clientId);

            if (result.success) {
                // Session will be updated via deep link callback
                // For web, reload sessions after redirect
                const session = oauthService.getSession(provider);
                if (session) {
                    dispatch({
                        type: 'SET_SESSION',
                        payload: { provider, session },
                    });
                }
                return true;
            } else {
                dispatch({ type: 'SET_ERROR', payload: result.error || 'Login failed' });
                return false;
            }
        } catch (error) {
            console.error('[Auth] Login error:', error);
            dispatch({
                type: 'SET_ERROR',
                payload: error instanceof Error ? error.message : 'Login failed',
            });
            return false;
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    }, []);

    // Logout from a provider
    const logout = useCallback(async (provider: OAuthProviderType): Promise<void> => {
        dispatch({ type: 'SET_LOADING', payload: true });

        try {
            await logoutProvider(provider);
            dispatch({ type: 'CLEAR_SESSION', payload: provider });
        } catch (error) {
            console.error('[Auth] Logout error:', error);
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    }, []);

    // Logout from all providers
    const logoutAll = useCallback(async (): Promise<void> => {
        dispatch({ type: 'SET_LOADING', payload: true });

        try {
            await oauthService.logoutAll();
            dispatch({ type: 'CLEAR_ALL_SESSIONS' });
        } catch (error) {
            console.error('[Auth] Logout all error:', error);
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    }, []);

    // Get access token for a provider
    const getAccessToken = useCallback(async (
        provider: OAuthProviderType
    ): Promise<string | null> => {
        return oauthService.getAccessToken(provider);
    }, []);

    // Get auth headers for a provider
    const getAuthHeaders = useCallback(async (
        provider: OAuthProviderType
    ): Promise<Record<string, string> | null> => {
        return oauthService.getAuthHeaders(provider);
    }, []);

    // Check if authenticated with a provider
    const isAuthenticated = useCallback((provider: OAuthProviderType): boolean => {
        return !!state.sessions[provider]?.tokens.accessToken;
    }, [state.sessions]);

    // Get user for a provider
    const getUser = useCallback((provider: OAuthProviderType): OAuthUser | undefined => {
        return state.sessions[provider]?.user;
    }, [state.sessions]);

    // Get session for a provider
    const getSession = useCallback((provider: OAuthProviderType): OAuthSession | null => {
        return state.sessions[provider];
    }, [state.sessions]);

    // Set client ID for a provider
    const setClientId = useCallback((
        provider: OAuthProviderType,
        clientId: string
    ): void => {
        oauthService.setClientId(provider, clientId);
    }, []);

    // Check if provider is configured
    const isProviderConfigured = useCallback((provider: OAuthProviderType): boolean => {
        return oauthService.isProviderConfigured(provider);
    }, []);

    // Get all authenticated providers
    const authenticatedProviders = Object.entries(state.sessions)
        .filter(([_, session]) => session?.tokens.accessToken)
        .map(([provider]) => provider as OAuthProviderType);

    // Context value
    const value: AuthContextValue = {
        ...state,
        login,
        logout,
        logoutAll,
        getAccessToken,
        getAuthHeaders,
        isAuthenticated,
        getUser,
        getSession,
        setClientId,
        isProviderConfigured,
        authenticatedProviders,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

// =============================================================================
// Hook
// =============================================================================

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

// =============================================================================
// Utility Hooks
// =============================================================================

/**
 * Hook to get OAuth status for a specific provider
 */
export function useProviderAuth(provider: OAuthProviderType) {
    const {
        isAuthenticated,
        getUser,
        getSession,
        login,
        logout,
        isLoading,
    } = useAuth();

    return {
        isAuthenticated: isAuthenticated(provider),
        user: getUser(provider),
        session: getSession(provider),
        login: (clientId?: string) => login(provider, clientId),
        logout: () => logout(provider),
        isLoading,
    };
}

/**
 * Hook to get all authenticated sessions
 */
export function useAuthSessions() {
    const { sessions, authenticatedProviders } = useAuth();

    return {
        sessions: authenticatedProviders.map(p => sessions[p]!),
        providers: authenticatedProviders,
        count: authenticatedProviders.length,
    };
}
