// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

// =============================================================================
// CSM App - API Module
// =============================================================================
// Re-exports all API modules with feature parity to csm-web

export * from './client';
export {
    // Workspace API
    workspaces,
    getWorkspaces,
    getWorkspace,
    // Sessions API
    sessions,
    getSessions,
    getSession,
    deleteSession,
    exportSession,
    searchSessions,
    // Messages API
    messages,
    // Providers API
    providers,
    getProviders,
    // Search API
    search,
    // Stats API
    stats,
    getStats,
    // Agents API
    agents,
    // Swarms API
    swarms,
    // Runs API
    // System API
    system,
    // Types
    type Workspace,
    type Session,
    type SessionWithMessages,
    type Message,
    type ToolInvocation,
    type FileChange,
    type Provider,
    type ProviderHealth,
    type Checkpoint,
    type ShareLink,
    type Stats,
    type SearchResult,
    type Agent,
    type Swarm,
    type AgentRun,
} from './sessions';
export * from './chat';
export * from './agents';
