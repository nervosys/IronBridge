// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

// Storage key
const THEME_STORAGE_KEY = 'csm_theme_mode';

// Theme modes
export type ThemeMode = 'light' | 'dark' | 'system';

// Color palette definitions
export interface ThemeColors {
    // Backgrounds
    background: string;
    surface: string;
    card: string;

    // Text
    text: string;
    textSecondary: string;
    textTertiary: string;

    // Accent colors
    primary: string;
    success: string;
    warning: string;
    error: string;

    // UI elements
    border: string;
    divider: string;
    icon: string;
    iconSecondary: string;

    // Navigation
    tabBar: string;
    tabBarBorder: string;

    // Search
    searchBackground: string;
    placeholder: string;

    // Status bar style
    statusBar: 'light' | 'dark';
}

const lightColors: ThemeColors = {
    // Backgrounds
    background: '#F2F2F7',
    surface: '#FFFFFF',
    card: '#FFFFFF',

    // Text
    text: '#000000',
    textSecondary: '#3C3C43',
    textTertiary: '#8E8E93',

    // Accent colors
    primary: '#007AFF',
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',

    // UI elements
    border: '#C7C7CC',
    divider: '#E5E5EA',
    icon: '#007AFF',
    iconSecondary: '#C7C7CC',

    // Navigation
    tabBar: '#FFFFFF',
    tabBarBorder: '#A9A9A9',

    // Search
    searchBackground: '#E5E5EA',
    placeholder: '#8E8E93',

    // Status bar
    statusBar: 'dark',
};

const darkColors: ThemeColors = {
    // Backgrounds
    background: '#000000',
    surface: '#1C1C1E',
    card: '#1C1C1E',

    // Text
    text: '#FFFFFF',
    textSecondary: '#EBEBF5',
    textTertiary: '#8E8E93',

    // Accent colors
    primary: '#0A84FF',
    success: '#30D158',
    warning: '#FF9F0A',
    error: '#FF453A',

    // UI elements
    border: '#38383A',
    divider: '#38383A',
    icon: '#0A84FF',
    iconSecondary: '#48484A',

    // Navigation
    tabBar: '#1C1C1E',
    tabBarBorder: '#38383A',

    // Search
    searchBackground: '#1C1C1E',
    placeholder: '#8E8E93',

    // Status bar
    statusBar: 'light',
};

// State type
interface ThemeState {
    mode: ThemeMode;
    colors: ThemeColors;
    isDark: boolean;
}

type ThemeAction = { type: 'SET_MODE'; payload: ThemeMode; systemColorScheme: 'light' | 'dark' };

// Reducer
function themeReducer(state: ThemeState, action: ThemeAction): ThemeState {
    switch (action.type) {
        case 'SET_MODE': {
            const mode = action.payload;
            const isDark = mode === 'system'
                ? action.systemColorScheme === 'dark'
                : mode === 'dark';
            return {
                mode,
                colors: isDark ? darkColors : lightColors,
                isDark,
            };
        }
        default:
            return state;
    }
}

// Context type
interface ThemeContextType {
    mode: ThemeMode;
    colors: ThemeColors;
    isDark: boolean;
    setThemeMode: (mode: ThemeMode) => void;
}

// Create context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Provider component
export function ThemeContextProvider({ children }: { children: ReactNode }) {
    const systemColorScheme = useColorScheme() || 'light';

    const [state, dispatch] = useReducer(themeReducer, {
        mode: 'system',
        colors: systemColorScheme === 'dark' ? darkColors : lightColors,
        isDark: systemColorScheme === 'dark',
    });

    // Load saved theme on mount
    useEffect(() => {
        const loadTheme = async () => {
            try {
                const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
                if (savedMode && ['light', 'dark', 'system'].includes(savedMode)) {
                    dispatch({
                        type: 'SET_MODE',
                        payload: savedMode as ThemeMode,
                        systemColorScheme,
                    });
                }
            } catch (error) {
                console.error('Failed to load theme:', error);
            }
        };
        loadTheme();
    }, []);

    // Update when system color scheme changes (if in system mode)
    useEffect(() => {
        if (state.mode === 'system') {
            dispatch({
                type: 'SET_MODE',
                payload: 'system',
                systemColorScheme,
            });
        }
    }, [systemColorScheme, state.mode]);

    // Set theme mode
    const setThemeMode = async (mode: ThemeMode) => {
        try {
            await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
            dispatch({
                type: 'SET_MODE',
                payload: mode,
                systemColorScheme,
            });
        } catch (error) {
            console.error('Failed to save theme:', error);
        }
    };

    return (
        <ThemeContext.Provider
            value={{
                mode: state.mode,
                colors: state.colors,
                isDark: state.isDark,
                setThemeMode,
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
}

// Hook to use theme context
export function useTheme(): ThemeContextType {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeContextProvider');
    }
    return context;
}

// Export color palettes for reference
export { lightColors, darkColors };
