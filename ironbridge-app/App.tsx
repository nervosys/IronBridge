// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppNavigator } from './src/navigation';
import { ChatContextProvider } from './src/context/ChatContext';
import { AgentsContextProvider } from './src/context/AgentsContext';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeContextProvider, useTheme } from './src/context/ThemeContext';

// Create a QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

// Inner component that can access theme context
function AppContent() {
  const { colors } = useTheme();

  return (
    <SafeAreaProvider>
      <StatusBar style={colors.statusBar} />
      <AppNavigator />
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeContextProvider>
        <AuthProvider>
          <ChatContextProvider>
            <AgentsContextProvider>
              <AppContent />
            </AgentsContextProvider>
          </ChatContextProvider>
        </AuthProvider>
      </ThemeContextProvider>
    </QueryClientProvider>
  );
}
