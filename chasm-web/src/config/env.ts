// Environment configuration for CSM Web
// Handles API URL, feature flags, and app settings

/**
 * Environment configuration
 */
export interface EnvConfig {
    // API
    apiBaseUrl: string;
    wsBaseUrl: string;

    // Feature flags
    enableWebSocket: boolean;
    enableOfflineMode: boolean;
    enableDevTools: boolean;
    enableDemoMode: boolean;  // Use mock data instead of API

    // UI
    defaultTheme: 'light' | 'neutral' | 'dark';
    defaultSyntaxTheme: string;

    // Performance
    apiTimeout: number;
    refetchInterval: number;
    maxCacheAge: number;
}

/**
 * Get environment variable with fallback
 */
function getEnv(key: string, fallback: string): string {
    // Vite uses import.meta.env
    const value = (import.meta.env as Record<string, string>)[key];
    return value ?? fallback;
}

/**
 * Get boolean environment variable
 */
function getEnvBool(key: string, fallback: boolean): boolean {
    const value = getEnv(key, String(fallback));
    return value === 'true' || value === '1';
}

/**
 * Get numeric environment variable
 */
function getEnvNumber(key: string, fallback: number): number {
    const value = getEnv(key, String(fallback));
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? fallback : parsed;
}

/**
 * Application configuration
 */
export const config: EnvConfig = {
    // API configuration
    apiBaseUrl: getEnv('VITE_API_BASE_URL', 'http://localhost:8787'),
    wsBaseUrl: getEnv('VITE_WS_BASE_URL', 'ws://localhost:8787'),

    // Feature flags
    enableWebSocket: getEnvBool('VITE_ENABLE_WEBSOCKET', true),
    enableOfflineMode: getEnvBool('VITE_ENABLE_OFFLINE_MODE', false),
    enableDevTools: getEnvBool('VITE_ENABLE_DEV_TOOLS', import.meta.env.DEV),
    enableDemoMode: getEnvBool('VITE_ENABLE_DEMO_MODE', false),

    // UI defaults
    defaultTheme: getEnv('VITE_DEFAULT_THEME', 'dark') as 'light' | 'neutral' | 'dark',
    defaultSyntaxTheme: getEnv('VITE_DEFAULT_SYNTAX_THEME', 'monokai'),

    // Performance
    apiTimeout: getEnvNumber('VITE_API_TIMEOUT', 30000),
    refetchInterval: getEnvNumber('VITE_REFETCH_INTERVAL', 60000),
    maxCacheAge: getEnvNumber('VITE_MAX_CACHE_AGE', 300000),
};

/**
 * Check if running in development mode
 */
export const isDev = import.meta.env.DEV;

/**
 * Check if running in production mode
 */
export const isProd = import.meta.env.PROD;

/**
 * Get the API base URL
 */
export function getApiUrl(path: string = ''): string {
    const base = config.apiBaseUrl.replace(/\/$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${cleanPath}`;
}

/**
 * Get the WebSocket URL
 */
export function getWsUrl(path: string = '/api/ws'): string {
    const base = config.wsBaseUrl.replace(/\/$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${cleanPath}`;
}

export default config;
