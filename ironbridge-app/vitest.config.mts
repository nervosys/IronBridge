// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// These tests cover the app's logic — export formatting, timestamp handling and
// the background-sync gates — not its screens. Rendering React Native
// components needs a native bridge and a preset that pulls in most of Expo;
// aliasing the handful of native modules the units import keeps the suite fast
// and lets it run anywhere Node does, including CI without a simulator.

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const mock = (name: string) => resolve(here, 'test/mocks', name);

export default defineConfig({
  resolve: {
    alias: {
      'react-native': mock('react-native.ts'),
      '@react-native-async-storage/async-storage': mock('async-storage.ts'),
      '@react-native-community/netinfo': mock('netinfo.ts'),
      'expo-battery': mock('expo-battery.ts'),
      'expo-sharing': mock('expo-sharing.ts'),
      'expo-file-system': mock('expo-file-system.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
