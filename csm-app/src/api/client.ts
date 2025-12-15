import axios from 'axios';
import { Platform } from 'react-native';

// API base URL - use localhost for web, 10.0.2.2 for Android emulator
const getBaseUrl = () => {
    if (Platform.OS === 'android') {
        return 'http://10.0.2.2:8787';
    }
    if (Platform.OS === 'ios') {
        return 'http://localhost:8787';
    }
    // Web or other platforms
    return 'http://localhost:8787';
};

export const apiClient = axios.create({
    baseURL: getBaseUrl(),
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

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
