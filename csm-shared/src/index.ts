// =============================================================================
// CSM Shared - Main Entry Point
// =============================================================================
// @csm/shared - Shared types, API client, and utilities for CSM applications

// Re-export all types
export * from './types';

// Re-export API client
export { createApiClient, api } from './api';
export type { ApiClientConfig } from './api';

// Re-export all utilities
export * from './utils';
