import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get the local network IP from Expo config or use placeholder
// For physical devices, set CSM_API_HOST in app.json extra config or .env
const LOCAL_IP = Constants.expoConfig?.extra?.apiHost || 'localhost';

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
