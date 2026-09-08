// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// Biometric Authentication Service
// Handles Face ID, Touch ID, and fingerprint authentication for secure app access

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type BiometricType = 'fingerprint' | 'facial' | 'iris' | 'none';

export interface BiometricConfig {
    enabled: boolean;
    requireOnLaunch: boolean;
    requireOnBackground: boolean;
    backgroundTimeout: number; // seconds before requiring re-auth
    fallbackToPasscode: boolean;
}

export interface BiometricStatus {
    isAvailable: boolean;
    isEnrolled: boolean;
    supportedTypes: BiometricType[];
    securityLevel: LocalAuthentication.SecurityLevel;
}

const CONFIG_KEY = 'biometric_config';
const AUTH_TIMESTAMP_KEY = 'last_auth_timestamp';

const DEFAULT_CONFIG: BiometricConfig = {
    enabled: false,
    requireOnLaunch: true,
    requireOnBackground: true,
    backgroundTimeout: 300, // 5 minutes
    fallbackToPasscode: true,
};

class BiometricAuthService {
    private config: BiometricConfig = DEFAULT_CONFIG;
    private status: BiometricStatus | null = null;
    private lastAuthTimestamp: number = 0;
    private authListeners: Set<(authenticated: boolean) => void> = new Set();

    /**
     * Initialize the biometric service and check hardware capabilities
     */
    async initialize(): Promise<BiometricStatus> {
        // Check hardware support
        const isAvailable = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        const supportedTypesRaw = await LocalAuthentication.supportedAuthenticationTypesAsync();
        const securityLevel = await LocalAuthentication.getEnrolledLevelAsync();

        // Map supported types
        const supportedTypes: BiometricType[] = supportedTypesRaw.map((type: LocalAuthentication.AuthenticationType) => {
            switch (type) {
                case LocalAuthentication.AuthenticationType.FINGERPRINT:
                    return 'fingerprint';
                case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
                    return 'facial';
                case LocalAuthentication.AuthenticationType.IRIS:
                    return 'iris';
                default:
                    return 'none';
            }
        }).filter((t: BiometricType | 'none'): t is BiometricType => t !== 'none');

        this.status = {
            isAvailable,
            isEnrolled,
            supportedTypes,
            securityLevel,
        };

        // Load saved config
        await this.loadConfig();

        // Load last auth timestamp
        const savedTimestamp = await SecureStore.getItemAsync(AUTH_TIMESTAMP_KEY);
        if (savedTimestamp) {
            this.lastAuthTimestamp = parseInt(savedTimestamp, 10);
        }

        return this.status;
    }

    /**
     * Get current biometric status
     */
    getStatus(): BiometricStatus | null {
        return this.status;
    }

    /**
     * Get current configuration
     */
    getConfig(): BiometricConfig {
        return { ...this.config };
    }

    /**
     * Update biometric configuration
     */
    async setConfig(updates: Partial<BiometricConfig>): Promise<void> {
        this.config = { ...this.config, ...updates };
        await this.saveConfig();
    }

    /**
     * Load configuration from secure storage
     */
    private async loadConfig(): Promise<void> {
        try {
            const saved = await SecureStore.getItemAsync(CONFIG_KEY);
            if (saved) {
                this.config = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.error('Failed to load biometric config:', error);
        }
    }

    /**
     * Save configuration to secure storage
     */
    private async saveConfig(): Promise<void> {
        try {
            await SecureStore.setItemAsync(CONFIG_KEY, JSON.stringify(this.config));
        } catch (error) {
            console.error('Failed to save biometric config:', error);
        }
    }

    /**
     * Check if biometric authentication is required
     */
    isAuthRequired(): boolean {
        if (!this.config.enabled || !this.status?.isAvailable || !this.status?.isEnrolled) {
            return false;
        }

        // Check if we're within the background timeout
        const now = Date.now();
        const elapsed = (now - this.lastAuthTimestamp) / 1000;

        if (this.config.requireOnBackground && elapsed > this.config.backgroundTimeout) {
            return true;
        }

        return false;
    }

    /**
     * Perform biometric authentication
     */
    async authenticate(reason?: string): Promise<{ success: boolean; error?: string }> {
        if (!this.status?.isAvailable) {
            return { success: false, error: 'Biometric authentication not available' };
        }

        if (!this.status?.isEnrolled) {
            return { success: false, error: 'No biometric credentials enrolled' };
        }

        const promptMessage = reason || this.getDefaultPromptMessage();

        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage,
                cancelLabel: 'Cancel',
                disableDeviceFallback: !this.config.fallbackToPasscode,
                fallbackLabel: this.config.fallbackToPasscode ? 'Use Passcode' : undefined,
            });

            if (result.success) {
                // Update auth timestamp
                this.lastAuthTimestamp = Date.now();
                await SecureStore.setItemAsync(AUTH_TIMESTAMP_KEY, this.lastAuthTimestamp.toString());

                // Notify listeners
                this.notifyListeners(true);

                return { success: true };
            }

            return {
                success: false,
                error: result.error || 'Authentication failed',
            };
        } catch (error: any) {
            console.error('Biometric authentication error:', error);
            return {
                success: false,
                error: error.message || 'Authentication error',
            };
        }
    }

    /**
     * Get appropriate prompt message based on biometric type
     */
    private getDefaultPromptMessage(): string {
        if (!this.status?.supportedTypes.length) {
            return 'Authenticate to access IronBridge';
        }

        const primaryType = this.status.supportedTypes[0];

        switch (primaryType) {
            case 'facial':
                return Platform.OS === 'ios' ? 'Use Face ID to unlock IronBridge' : 'Use face recognition to unlock IronBridge';
            case 'fingerprint':
                return Platform.OS === 'ios' ? 'Use Touch ID to unlock IronBridge' : 'Use fingerprint to unlock IronBridge';
            case 'iris':
                return 'Use iris scan to unlock IronBridge';
            default:
                return 'Authenticate to access IronBridge';
        }
    }

    /**
     * Get user-friendly name for biometric type
     */
    getBiometricTypeName(): string {
        if (!this.status?.supportedTypes.length) {
            return 'Biometric Authentication';
        }

        const primaryType = this.status.supportedTypes[0];

        switch (primaryType) {
            case 'facial':
                return Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition';
            case 'fingerprint':
                return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
            case 'iris':
                return 'Iris Scan';
            default:
                return 'Biometric Authentication';
        }
    }

    /**
     * Add authentication state listener
     */
    addAuthListener(listener: (authenticated: boolean) => void): () => void {
        this.authListeners.add(listener);
        return () => this.authListeners.delete(listener);
    }

    /**
     * Notify all listeners of authentication state change
     */
    private notifyListeners(authenticated: boolean): void {
        this.authListeners.forEach((listener) => listener(authenticated));
    }

    /**
     * Reset authentication (force re-auth on next access)
     */
    async resetAuth(): Promise<void> {
        this.lastAuthTimestamp = 0;
        await SecureStore.deleteItemAsync(AUTH_TIMESTAMP_KEY);
    }

    /**
     * Enable biometric authentication
     */
    async enable(): Promise<{ success: boolean; error?: string }> {
        if (!this.status?.isAvailable) {
            return { success: false, error: 'Biometric authentication not available on this device' };
        }

        if (!this.status?.isEnrolled) {
            return { success: false, error: 'Please set up biometric authentication in your device settings first' };
        }

        // Verify with authentication before enabling
        const authResult = await this.authenticate('Verify your identity to enable biometric lock');

        if (authResult.success) {
            await this.setConfig({ enabled: true });
            return { success: true };
        }

        return authResult;
    }

    /**
     * Disable biometric authentication
     */
    async disable(): Promise<{ success: boolean; error?: string }> {
        // Verify with authentication before disabling
        const authResult = await this.authenticate('Verify your identity to disable biometric lock');

        if (authResult.success) {
            await this.setConfig({ enabled: false });
            await this.resetAuth();
            return { success: true };
        }

        return authResult;
    }
}

export const biometricAuth = new BiometricAuthService();
export default biometricAuth;
