import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Storage key for API settings
const API_HOST_KEY = 'csm_api_host';

// Get the local network IP from Expo config or use placeholder
// For physical devices, set CSM_API_HOST in app.json extra config or .env
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
    if (Platform.OS === 'android') {
        // Android emulator uses 10.0.2.2 for host localhost
        // Physical Android device uses local network IP
        return `http://${LOCAL_IP}:8787`;
    }
    if (Platform.OS === 'ios') {
        // iOS simulator and physical device use local network IP
        return `http://${LOCAL_IP}:8787`;
    }
    // Web
    return 'http://localhost:8787';
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

// Request interceptor for logging
apiClient.interceptors.request.use(
    (config) => {
        console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
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
