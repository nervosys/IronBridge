// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Storage key for API settings
const API_HOST_KEY = 'ironbridge_api_host';

// Get the local network IP from Expo config or use placeholder
// For physical devices, set IRONBRIDGE_API_HOST in app.json extra config or .env
const LOCAL_IP = Constants.expoConfig?.extra?.apiHost || 'localhost';

// Default API settings
export const getDefaultHost = () => {
    if (Platform.OS === 'android') {
        return '10.0.2.2'; // Android emulator uses 10.0.2.2 for host localhost
    }
    return LOCAL_IP;
};

export const DEFAULT_PORT = '8787';

// API base URL - use localhost for web, local IP for mobile devices
const getBaseUrl = () => {
    const url = (() => {
        if (Platform.OS === 'android') {
            // Android emulator uses 10.0.2.2 for host localhost
            // Physical Android device uses local network IP
            return `http://${LOCAL_IP}:8787`;
        }
        if (Platform.OS === 'ios') {
            // iOS simulator and physical device use local network IP
            return `http://${LOCAL_IP}:8787`;
        }
        // Web - use 127.0.0.1 instead of localhost for better compatibility
        return 'http://127.0.0.1:8787';
    })();
    console.log(`[API] Platform: ${Platform.OS}, Base URL: ${url}`);
    return url;
};

export const apiClient = axios.create({
    baseURL: getBaseUrl(),
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

/**
 * Load saved API settings from storage and apply to client
 */
export const loadApiSettings = async (): Promise<{ host: string; port: string }> => {
    try {
        const savedSettings = await AsyncStorage.getItem(API_HOST_KEY);
        if (savedSettings) {
            const { host, port } = JSON.parse(savedSettings);
            const finalHost = host || getDefaultHost();
            const finalPort = port || DEFAULT_PORT;
            apiClient.defaults.baseURL = `http://${finalHost}:${finalPort}`;
            return { host: finalHost, port: finalPort };
        }
    } catch (error) {
        console.error('Failed to load API settings:', error);
    }
    return { host: getDefaultHost(), port: DEFAULT_PORT };
};

/**
 * Save API settings to storage and update client
 */
export const saveApiSettings = async (host: string, port: string): Promise<void> => {
    try {
        await AsyncStorage.setItem(API_HOST_KEY, JSON.stringify({ host, port }));
        apiClient.defaults.baseURL = `http://${host}:${port}`;
    } catch (error) {
        console.error('Failed to save API settings:', error);
        throw error;
    }
};

/**
 * Test connection to the API server
 */
export const testApiConnection = async (): Promise<boolean> => {
    try {
        await apiClient.get('/api/stats', { timeout: 5000 });
        return true;
    } catch {
        return false;
    }
};

// Bearer token for a server that has IRONBRIDGE_REQUIRE_AUTH set. Absent by default;
// the same key the web client uses, so the two agree on "logged in".
const ACCESS_TOKEN_KEY = 'ironbridge_access_token';

export async function getAuthToken(): Promise<string | null> {
    try {
        return await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
    } catch {
        return null;
    }
}

export async function setAuthToken(token: string): Promise<void> {
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export async function clearAuthToken(): Promise<void> {
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
}

/**
 * Log in against `/auth/login` and store the token.
 *
 * `/auth/*` stays open even when `/api` is gated, so this works before the app
 * has a token. On success every subsequent request carries the token via the
 * interceptor below.
 */
export async function login(
    email: string,
    password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        const resp = await apiClient.post('/auth/login', { email, password });
        const token = resp.data?.data?.access_token;
        if (!token) return { ok: false, error: 'The server returned no token.' };
        await setAuthToken(token);
        return { ok: true };
    } catch (error: unknown) {
        const message =
            (error as { message?: string })?.message ?? 'Login failed';
        return { ok: false, error: message };
    }
}

// Request interceptor: attach the token when we have one, and log.
apiClient.interceptors.request.use(
    async (config) => {
        console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
        const token = await getAuthToken();
        if (token) {
            config.headers = config.headers ?? {};
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        console.error('[API] Request error:', error);
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            console.error(`[API] Error ${error.response.status}:`, error.response.data);

            // A 401 means the token is missing or stale. Drop it so the app
            // stops sending a rejected credential and can prompt for login.
            if (error.response.status === 401) {
                void clearAuthToken();
            }

            // Carry the server's own explanation onto `error.message`.
            //
            // Axios sets it to "Request failed with status code 400", which
            // discards the `error` field in the response envelope -- the part
            // that actually says what went wrong and what to do about it. Every
            // screen that reports `err.message` was showing the status line
            // instead of the reason.
            const served = error.response.data?.error;
            if (typeof served === 'string' && served.trim()) {
                error.message = served;
            }
        } else if (error.request) {
            console.error('[API] No response received:', error.message);
        } else {
            console.error('[API] Error:', error.message);
        }
        return Promise.reject(error);
    }
);

// Initialize API settings on module load
loadApiSettings();
