// =============================================================================
// CSM Web - API Types
// =============================================================================
// Re-exports shared types from @csm/shared package

// Re-export all shared types
export type {
    // Core data models
    Workspace,
    Session,
    SessionWithMessages,
    Message,
    ToolInvocation,
    FileChange,

    // Provider types
    Provider,
    ProviderHealth,
    ProviderStatus,

    // API response types
    ApiResponse,
    ApiError,
    PaginatedResponse,
    SessionFilter,
    WorkspaceFilter,
    SearchResult,

    // Statistics
    Statistics,

    // Chat/Completion types
    ChatMessage,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatChoice,
    TokenUsage,
    StreamChunk,
    StreamDelta,

    // Agent types
    Agent,
    AgentCapability,
    AgentTask,
    AgentMessage,
    AgentRun,
    Swarm,
    SwarmAgent,

    // MCP types
    McpServer,
    McpTool,
    McpToolCall,
    McpToolResult,
    McpResource,
    McpPrompt,
    McpPromptArgument,

    // Settings
    ThemeMode,
    AppSettings,
} from '@csm/shared';

// Re-export some as values if needed
export { ThemeMode } from '@csm/shared';

// =============================================================================
// Web-Specific Types (extend shared types if needed)
// =============================================================================

/**
 * WebSocket message for real-time updates
 */
export interface WebSocketMessage {
    type: 'session_update' | 'message_update' | 'workspace_update' | 'connection_status';
    payload: unknown;
    timestamp: number;
}

/**
 * UI state for session viewer
 */
export interface SessionViewState {
    selectedMessageId?: string;
    expandedMessages: Set<string>;
    searchQuery?: string;
    filterRole?: 'user' | 'assistant' | 'system';
}

/**
 * UI state for workspace browser
 */
export interface WorkspaceBrowserState {
    selectedWorkspaceId?: string;
    expandedWorkspaces: Set<string>;
    sortBy: 'name' | 'updated' | 'sessions';
    sortOrder: 'asc' | 'desc';
}

/**
 * Chart data point for visualizations
 */
export interface ChartDataPoint {
    label: string;
    value: number;
    color?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Time series data for activity charts
 */
export interface TimeSeriesPoint {
    timestamp: number;
    value: number;
    label?: string;
}

// =============================================================================
// Web-Specific Extended Types
// =============================================================================

/**
 * Checkpoint/snapshot of a session
 */
export interface Checkpoint {
    id: string;
    sessionId: string;
    name: string;
    description: string | null;
    messageId: string | null;
    gitCommit: string | null;
    gitBranch: string | null;
    createdAt: number;
    metadata: Record<string, unknown> | null;
}

/**
 * Share link for a session
 */
export interface ShareLink {
    id: string;
    sessionId: string;
    provider: ShareLinkProvider;
    url: string;
    expiresAt: number | null;
    createdAt: number;
}

export type ShareLinkProvider = 'github_gist' | 'pastebin' | 'hastebin' | 'custom';

/**
 * Provider settings (web-specific extended version)
 */
export interface ProviderSettings {
    enabled: boolean;
    priority: number;
    timeout: number;
    maxTokens: number | null;
    temperature: number | null;
}

/**
 * Swarm workflow types
 */
export interface SwarmWorkflow {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
}

export interface WorkflowNode {
    id: string;
    type: 'agent' | 'input' | 'output' | 'condition' | 'merge';
    agentId?: string;
    position: { x: number; y: number };
}

export interface WorkflowEdge {
    id: string;
    source: string;
    target: string;
    condition?: string;
}

export type SwarmStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

// =============================================================================
// Git Integration Models
// =============================================================================

/**
 * Git commit info linked to chat
 */
export interface GitCommit {
    hash: string;
    shortHash: string;
    message: string;
    author: string;
    email: string;
    timestamp: number;
    branch: string;
    sessionId: string | null;
    messageId: string | null;
}

/**
 * Git repository info
 */
export interface GitRepository {
    path: string;
    branch: string;
    remote: string | null;
    uncommittedChanges: number;
    ahead: number;
    behind: number;
}

// =============================================================================
// Statistics Extended Types
// =============================================================================

export interface ProviderCount {
    provider: string;
    count: number;
    color: string;
}

export interface DayCount {
    date: string;
    sessions: number;
    messages: number;
}

export interface WorkspaceStats {
    id: string;
    name: string;
    sessionCount: number;
    messageCount: number;
    lastActive: number;
}

// =============================================================================
// Harvest/Import Types
// =============================================================================

/**
 * Import source configuration
 */
export interface ImportSource {
    type: 'share_link' | 'file' | 'directory' | 'provider';
    uri: string;
    provider?: string;
}

/**
 * Import result
 */
export interface ImportResult {
    success: boolean;
    sessionsImported: number;
    messagesImported: number;
    errors: string[];
    warnings: string[];
}

/**
 * Export options
 */
export interface ExportOptions {
    format: 'json' | 'markdown' | 'html' | 'csv';
    includeMetadata: boolean;
    sessionIds?: string[];
    workspaceId?: string;
    dateFrom?: number;
    dateTo?: number;
}

// =============================================================================
// Provider Account Types
// =============================================================================

/**
 * Provider account
 */
export interface ProviderAccount {
    id: string;
    provider: string;
    name: string;
    email: string | null;
    avatarUrl: string | null;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    scopes: string[];
    createdAt: number;
    updatedAt: number;
}

// =============================================================================
// WebSocket Events
// =============================================================================

import type { Session, Message, ProviderStatus, ApiError } from '@csm/shared';
    | { type: 'provider_status'; provider: string; status: ProviderStatus }
    | { type: 'swarm_status'; swarmId: string; status: SwarmStatus }
    | { type: 'sync_progress'; progress: number; total: number }
    | { type: 'error'; error: ApiError };
