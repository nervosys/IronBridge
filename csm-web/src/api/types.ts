// API Types and Interfaces for CSM Backend
// These types mirror the Rust backend models

// =============================================================================
// Core Data Models
// =============================================================================

/**
 * Workspace representing a VS Code workspace or project directory
 */
export interface Workspace {
    id: string;
    name: string;
    path: string | null;
    provider: string;
    providerWorkspaceId: string | null;
    createdAt: number; // Unix timestamp
    updatedAt: number;
    metadata: Record<string, unknown> | null;
    // Computed fields from discovery
    sessionCount?: number;
    hasChats?: boolean;
}

/**
 * Chat session containing messages
 */
export interface Session {
    id: string;
    workspaceId: string | null;
    provider: string;
    providerSessionId: string | null;
    title: string;
    model: string | null;
    messageCount: number;
    tokenCount: number | null;
    createdAt: number;
    updatedAt: number;
    archived: boolean;
    metadata: Record<string, unknown> | null;
}

/**
 * Message within a session
 */
export interface Message {
    id: string;
    sessionId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    model: string | null;
    tokenCount: number | null;
    createdAt: number;
    metadata: Record<string, unknown> | null;
}

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

// =============================================================================
// Provider Models
// =============================================================================

/**
 * LLM provider configuration
 */
export interface Provider {
    id: string;
    name: string;
    type: 'local' | 'cloud';
    icon: string;
    color: string;
    endpoint: string | null;
    apiKey: string | null;
    models: string[];
    status: ProviderStatus;
    settings: ProviderSettings;
}

export type ProviderStatus = 'connected' | 'disconnected' | 'error' | 'unknown';

export interface ProviderSettings {
    enabled: boolean;
    priority: number;
    timeout: number;
    maxTokens: number | null;
    temperature: number | null;
}

/**
 * Provider health check result
 */
export interface ProviderHealth {
    providerId: string;
    status: ProviderStatus;
    latency: number | null;
    lastChecked: number;
    error: string | null;
    version: string | null;
    models: string[];
}

// =============================================================================
// Agent & Swarm Models
// =============================================================================

/**
 * AI Agent configuration
 */
export interface Agent {
    id: string;
    name: string;
    description: string | null;
    systemPrompt: string;
    model: string;
    provider: string;
    tools: string[];
    temperature: number;
    maxTokens: number | null;
    createdAt: number;
    updatedAt: number;
    metadata: Record<string, unknown> | null;
}

/**
 * Multi-agent swarm configuration
 */
export interface Swarm {
    id: string;
    name: string;
    description: string | null;
    agents: SwarmAgent[];
    workflow: SwarmWorkflow;
    status: SwarmStatus;
    createdAt: number;
    updatedAt: number;
}

export interface SwarmAgent {
    agentId: string;
    role: string;
    position: { x: number; y: number };
}

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
// Statistics & Analytics Models
// =============================================================================

/**
 * Overview statistics
 */
export interface Statistics {
    totalSessions: number;
    totalMessages: number;
    totalWorkspaces: number;
    totalProviders: number;
    sessionsThisWeek: number;
    messagesThisWeek: number;
    sessionsByProvider: ProviderCount[];
    messagesByDay: DayCount[];
    topWorkspaces: WorkspaceStats[];
}

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
// Search & Filter Models
// =============================================================================

/**
 * Full-text search result
 */
export interface SearchResult {
    type: 'session' | 'message' | 'workspace';
    id: string;
    title: string;
    snippet: string;
    highlights: string[];
    score: number;
    timestamp: number;
    provider?: string;
    workspaceId?: string;
    sessionId?: string;
}

/**
 * Session filter options
 */
export interface SessionFilter {
    workspaceId?: string;
    provider?: string;
    model?: string;
    archived?: boolean;
    dateFrom?: number;
    dateTo?: number;
    search?: string;
    sortBy?: 'createdAt' | 'updatedAt' | 'messageCount' | 'title';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}

/**
 * Workspace filter options
 */
export interface WorkspaceFilter {
    provider?: string;
    hasChats?: boolean;
    search?: string;
    sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'sessionCount';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
}

/**
 * API error response
 */
export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}

/**
 * Generic API response
 */
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: ApiError;
}

// =============================================================================
// Chat Completion Types (for streaming)
// =============================================================================

/**
 * Chat completion request
 */
export interface ChatCompletionRequest {
    provider: string;
    model: string;
    messages: ChatCompletionMessage[];
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    sessionId?: string;
}

export interface ChatCompletionMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

/**
 * Chat completion response (non-streaming)
 */
export interface ChatCompletionResponse {
    id: string;
    provider: string;
    model: string;
    message: ChatCompletionMessage;
    usage: TokenUsage;
    finishReason: 'stop' | 'length' | 'tool_calls' | 'error';
}

export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

/**
 * Streaming chunk
 */
export interface StreamChunk {
    id: string;
    delta: string;
    finishReason?: 'stop' | 'length' | 'tool_calls' | 'error';
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
// Settings Types
// =============================================================================

/**
 * Application settings
 */
export interface AppSettings {
    theme: 'light' | 'neutral' | 'dark';
    syntaxTheme: string;
    fontSize: number;
    showTimestamps: boolean;
    soundEnabled: boolean;
    streamResponses: boolean;
    defaultProvider: string | null;
    defaultModel: string | null;
    autoSave: boolean;
    harvestPath: string | null;
}

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

export type WebSocketEvent =
    | { type: 'connected' }
    | { type: 'disconnected' }
    | { type: 'session_created'; session: Session }
    | { type: 'session_updated'; session: Session }
    | { type: 'session_deleted'; sessionId: string }
    | { type: 'message_created'; message: Message }
    | { type: 'provider_status'; provider: string; status: ProviderStatus }
    | { type: 'swarm_status'; swarmId: string; status: SwarmStatus }
    | { type: 'sync_progress'; progress: number; total: number }
    | { type: 'error'; error: ApiError };
