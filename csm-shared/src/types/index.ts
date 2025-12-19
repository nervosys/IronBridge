// =============================================================================
// CSM Shared Types
// =============================================================================
// Common TypeScript interfaces shared between csm-web and csm-app
// These types mirror the CSM Rust backend models

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
    providerWorkspaceId?: string | null;
    sessionCount?: number;
    createdAt: number;
    updatedAt: number;
    metadata?: Record<string, unknown> | null;
}

/**
 * Chat session containing messages
 */
export interface Session {
    id: string;
    workspaceId: string | null;
    workspaceName?: string | null;
    provider: string;
    providerSessionId?: string | null;
    title: string;
    model?: string | null;
    messageCount: number;
    tokenCount?: number | null;
    createdAt: number;
    updatedAt: number;
    archived?: boolean;
    metadata?: Record<string, unknown> | null;
}

/**
 * Message within a session
 */
export interface Message {
    id: string;
    index?: number;
    sessionId?: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    contentRaw?: string;
    model?: string | null;
    modelId?: string | null;
    requestId?: string;
    responseId?: string;
    tokenCount?: number | null;
    createdAt: number;
    isCanceled?: boolean;
    toolInvocations?: ToolInvocation[];
    variableData?: unknown;
    contentReferences?: unknown[];
    codeCitations?: unknown[];
    metadata?: Record<string, unknown> | null;
}

/**
 * Tool invocation within a message
 */
export interface ToolInvocation {
    toolName: string;
    toolCallId?: string;
    invocationIndex?: number;
    status?: 'pending' | 'running' | 'complete' | 'error';
    isComplete?: boolean;
    isConfirmed?: boolean | null;
    invocationMessage?: string | { value?: string;[key: string]: unknown };
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    toolSpecificData?: unknown;
    fileChanges?: FileChange[];
    timestamp?: number;
}

/**
 * File change from a tool invocation
 */
export interface FileChange {
    type: 'file_edit' | 'file_create' | 'file_delete' | 'terminal_command' | 'notebook_edit' | string;
    filePath?: string;
    command?: string;
    oldString?: string;
    newString?: string;
    oldContent?: string;
    newContent?: string;
    diffUnified?: string;
    output?: unknown;
    exitCode?: number;
    lineStart?: number;
    lineEnd?: number;
    data?: unknown;
}

/**
 * Session with full message history
 */
export interface SessionWithMessages extends Session {
    messages: Message[];
    toolInvocations?: ToolInvocation[];
    fileChanges?: FileChange[];
}

/**
 * Checkpoint/snapshot of a session
 */
export interface Checkpoint {
    id: string;
    sessionId: string;
    name: string;
    description?: string | null;
    messageId?: string | null;
    gitCommit?: string | null;
    gitBranch?: string | null;
    createdAt: number;
    metadata?: Record<string, unknown> | null;
}

/**
 * Share link for a session
 */
export interface ShareLink {
    id: string;
    sessionId: string;
    provider: ShareLinkProvider;
    url: string;
    expiresAt?: number | null;
    createdAt: number;
}

export type ShareLinkProvider = 'github_gist' | 'pastebin' | 'hastebin' | 'chatgpt' | 'claude' | 'custom';

// =============================================================================
// Provider Models
// =============================================================================

/**
 * LLM provider configuration
 */
export interface Provider {
    id: string;
    name: string;
    type: ProviderType;
    icon?: string;
    color?: string;
    endpoint?: string | null;
    apiKey?: string | null;
    models: string[];
    status: ProviderStatus;
    settings?: ProviderSettings;
}

export type ProviderType = 'local' | 'cloud';
export type ProviderStatus = 'connected' | 'disconnected' | 'error' | 'unknown';

export interface ProviderSettings {
    enabled: boolean;
    priority?: number;
    timeout?: number;
    maxTokens?: number | null;
    temperature?: number | null;
}

/**
 * Provider health check result
 */
export interface ProviderHealth {
    providerId: string;
    status: ProviderStatus;
    latency?: number | null;
    lastChecked: number;
    error?: string | null;
    version?: string | null;
    models: string[];
}

// =============================================================================
// Agent & Swarm Models
// =============================================================================

export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'completed' | 'failed' | 'paused';
export type AgentRole = 'coordinator' | 'researcher' | 'coder' | 'reviewer' | 'executor' | 'writer' | 'tester' | 'custom';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type SwarmStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

/**
 * Orchestration type - matches Rust ADK OrchestrationType
 */
export type OrchestrationType =
    | 'single'       // Traditional single-agent
    | 'sequential'   // Agents execute one after another
    | 'parallel'     // Agents execute simultaneously
    | 'loop'         // Agent repeats until condition met
    | 'hierarchical' // Coordinator delegates to sub-agents
    | 'swarm'        // Multi-agent swarm with coordinator
    | 'debate';      // Agents debate to reach consensus

/**
 * Pipeline configuration for multi-agent orchestration
 */
export interface Pipeline {
    id: string;
    name: string;
    orchestration: OrchestrationType;
    agents: string[]; // Agent IDs
    maxIterations?: number;
    createdAt: number;
    updatedAt: number;
}

/**
 * AI Agent configuration
 */
export interface Agent {
    id: string;
    name: string;
    role: AgentRole;
    description?: string | null;
    systemPrompt?: string;
    model?: string;
    providerId?: string;
    tools?: string[];
    capabilities?: string[];
    temperature?: number;
    maxTokens?: number | null;
    status: AgentStatus;
    currentTaskId?: string;
    messageCount?: number;
    createdAt: number;
    updatedAt: number;
    metadata?: Record<string, unknown> | null;
}

/**
 * Agent task
 */
export interface AgentTask {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    assignedAgentId?: string;
    parentTaskId?: string;
    subtasks?: AgentTask[];
    result?: string;
    error?: string;
    startedAt?: number;
    completedAt?: number;
    createdAt: number;
    updatedAt: number;
}

/**
 * Agent message for inter-agent communication
 */
export interface AgentMessage {
    id: string;
    agentId: string;
    targetAgentId?: string;
    type: 'thought' | 'action' | 'observation' | 'result' | 'error' | 'handoff';
    content: string;
    metadata?: Record<string, unknown>;
    timestamp: number;
}

/**
 * Multi-agent swarm configuration
 */
export interface Swarm {
    id: string;
    name: string;
    description?: string | null;
    agents: SwarmAgent[];
    tasks?: AgentTask[];
    messages?: AgentMessage[];
    workflow: SwarmWorkflow;
    status: SwarmStatus;
    coordinatorAgentId?: string;
    goalDescription?: string;
    result?: string;
    startedAt?: number;
    completedAt?: number;
    createdAt: number;
    updatedAt: number;
}

export interface SwarmAgent {
    agentId: string;
    role: string;
    position?: { x: number; y: number };
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

/**
 * Agent run (execution instance)
 */
export interface AgentRun {
    id: string;
    swarmId?: string;
    agentId?: string;
    name: string;
    description: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    tasks: AgentTask[];
    messages: AgentMessage[];
    tokensUsed: number;
    cost?: number;
    startedAt: number;
    completedAt?: number;
    createdAt: number;
}

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
    email?: string;
    timestamp: number;
    branch?: string;
    sessionId?: string | null;
    messageId?: string | null;
}

/**
 * Git repository info
 */
export interface GitRepository {
    path: string;
    branch: string;
    remote?: string | null;
    uncommittedChanges?: number;
    ahead?: number;
    behind?: number;
}

// =============================================================================
// Statistics & Analytics
// =============================================================================

/**
 * Overview statistics
 */
export interface Statistics {
    totalSessions: number;
    totalMessages: number;
    totalWorkspaces: number;
    totalProviders?: number;
    totalToolInvocations?: number;
    totalFileChanges?: number;
    sessionsThisWeek?: number;
    messagesThisWeek?: number;
    sessionsByProvider: ProviderCount[];
    messagesByDay?: DayCount[];
    topWorkspaces?: WorkspaceStats[];
}

export interface ProviderCount {
    provider: string;
    count: number;
    color?: string;
}

export interface DayCount {
    date: string;
    sessions: number;
    messages?: number;
}

export interface WorkspaceStats {
    id: string;
    name: string;
    sessionCount: number;
    messageCount?: number;
    lastActive?: number;
}

// =============================================================================
// Search & Filter
// =============================================================================

/**
 * Full-text search result
 */
export interface SearchResult {
    type: 'session' | 'message' | 'workspace';
    id: string;
    title: string;
    snippet?: string;
    highlights?: string[];
    score?: number;
    timestamp?: number;
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
 * API error
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
// Chat Completion Types
// =============================================================================

export interface ChatCompletionRequest {
    provider: string;
    model: string;
    messages: ChatCompletionMessage[];
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    sessionId?: string;
    enableTools?: boolean;
}

export interface ChatCompletionMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface ChatCompletionResponse {
    id: string;
    provider?: string;
    model: string;
    content: string;
    message?: ChatCompletionMessage;
    usage?: TokenUsage;
    tokens?: TokenUsage;
    finishReason?: 'stop' | 'length' | 'tool_calls' | 'error';
    toolCalls?: Array<{ name: string; arguments: string }>;
}

export interface TokenUsage {
    prompt?: number;
    promptTokens?: number;
    completion?: number;
    completionTokens?: number;
    total?: number;
    totalTokens?: number;
}

export interface StreamChunk {
    id: string;
    delta: string;
    finishReason?: 'stop' | 'length' | 'tool_calls' | 'error';
}

// =============================================================================
// Import/Export Types
// =============================================================================

export interface ImportSource {
    type: 'share_link' | 'file' | 'directory' | 'provider';
    uri: string;
    provider?: string;
}

export interface ImportResult {
    success: boolean;
    sessionsImported: number;
    messagesImported: number;
    errors: string[];
    warnings: string[];
}

export interface ExportOptions {
    format: 'json' | 'markdown' | 'html' | 'csv';
    includeMetadata?: boolean;
    sessionIds?: string[];
    workspaceId?: string;
    dateFrom?: number;
    dateTo?: number;
}

// =============================================================================
// Settings Types
// =============================================================================

export type ThemeMode = 'light' | 'dark' | 'system' | 'neutral';

export interface AppSettings {
    theme: ThemeMode;
    syntaxTheme?: string;
    fontSize?: number;
    showTimestamps?: boolean;
    soundEnabled?: boolean;
    streamResponses?: boolean;
    defaultProvider?: string | null;
    defaultModel?: string | null;
    autoSave?: boolean;
    harvestPath?: string | null;
}

// =============================================================================
// MCP (Model Context Protocol) Types
// =============================================================================

export interface McpTool {
    name: string;
    description: string | null;
    inputSchema: Record<string, unknown>;
}

export interface McpToolCall {
    name: string;
    arguments: Record<string, unknown>;
}

export interface McpToolResult {
    tool: string;
    result: {
        content: Array<{ type: string; text: string }>;
        isError?: boolean;
    };
}

// =============================================================================
// ADK Event Types (matches Rust ADK)
// =============================================================================

/**
 * ADK Event type - mirrors Rust ADK EventType
 */
export type AdkEventType =
    | 'agent_started'
    | 'agent_thinking'
    | 'agent_executing'
    | 'agent_completed'
    | 'agent_failed'
    | 'tool_call_started'
    | 'tool_call_completed'
    | 'tool_call_failed'
    | 'message_created'
    | 'message_delta'
    | 'task_created'
    | 'task_started'
    | 'task_completed'
    | 'task_failed'
    | 'swarm_started'
    | 'swarm_agent_joined'
    | 'swarm_completed'
    | 'swarm_failed'
    | 'handoff'
    | 'error';

/**
 * ADK Event - matches Rust ADK AdkEvent
 */
export interface AdkEvent {
    type: AdkEventType;
    agentId?: string;
    agentName?: string;
    taskId?: string;
    toolName?: string;
    message?: string;
    content?: string;
    error?: string;
    tokensUsed?: number;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

/**
 * Tool call information - matches Rust ADK ToolCall
 */
export interface AdkToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    timestamp: number;
}

/**
 * Tool result - matches Rust ADK ToolResult
 */
export interface AdkToolResult {
    callId: string;
    name: string;
    content: string;
    isError: boolean;
    duration?: number;
    timestamp: number;
}

/**
 * Execution result from agent or pipeline run
 */
export interface ExecutionResult {
    success: boolean;
    output: string;
    agentName?: string;
    tokensUsed?: TokenUsage;
    duration: number;
    toolCalls?: AdkToolCall[];
    events: AdkEvent[];
}

/**
 * Orchestrator result for multi-agent runs
 */
export interface OrchestratorResult {
    success: boolean;
    outputs: string[];
    agentResults: ExecutionResult[];
    totalTokens: TokenUsage;
    duration: number;
}
