// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// =============================================================================
// IRONBRIDGE Shared - Main Entry Point
// =============================================================================
// @ironbridge/shared - Shared types, API client, and utilities for IRONBRIDGE applications
//
// NOTE: React-specific exports (sync hooks, providers) are in separate entry points:
//   - @ironbridge/shared/sync - Sync service, hooks, and SyncProvider
//   - @ironbridge/shared/auth - Auth service and hooks

// Re-export all types
export * from './types';

// Re-export API client
export { createApiClient, api } from './api';
export type { ApiClientConfig } from './api';

// Re-export all utilities
export * from './utils';

// Re-export all constants
export * from './constants';
