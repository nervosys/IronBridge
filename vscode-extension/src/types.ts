// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

// =============================================================================
// Chasm VS Code Extension Types
// =============================================================================
// Type definitions aligned with chasm-shared and chasm-rust Agency
// These types ensure consistency across the entire Chasm ecosystem

// =============================================================================
// Core Session Types (aligned with chasm-shared/types)
// =============================================================================

/**
 * Message role - matches chasm-rust Agency MessageRole
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * Tool invocation status
 */
export type ToolStatus = 'pending' | 'running' | 'complete' | 'error';

/**
 * Agent status - matches chasm-shared AgentStatus
 */
export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'completed' | 'failed' | 'paused';

/**
 * Agent role - matches chasm-shared AgentRole
 */
export type AgentRole = 'coordinator' | 'researcher' | 'coder' | 'reviewer' | 'executor' | 'custom';

/**
 * Task status - matches chasm-shared TaskStatus
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

/**
 * Swarm status - matches chasm-shared SwarmStatus
 */
export type SwarmStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

/**
 * Orchestration type - matches chasm-rust Agency OrchestrationType
 */
export type OrchestrationType = 'single' | 'sequential' | 'parallel' | 'loop' | 'hierarchical' | 'swarm' | 'debate';

/**
 * Provider type - matches chasm-shared ProviderType
 */
export type ProviderType = 'local' | 'cloud';

/**
 * Provider status - matches chasm-shared ProviderStatus
 */
export type ProviderStatus = 'connected' | 'disconnected' | 'error' | 'unknown';

// =============================================================================
// Message Types (aligned with chasm-rust Agency models)
// =============================================================================

/**
 * Tool call request - matches chasm-rust Agency ToolCall
 */
export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    timestamp?: number;
}

/**
 * Tool execution result - matches chasm-rust Agency ToolResult
 */
export interface ToolResult {
    callId: string;
    name: string;
    success: boolean;
    content: string;
    durationMs?: number;
    data?: unknown;
}

/**
 * Tool invocation - matches chasm-shared ToolInvocation
 */
export interface ToolInvocation {
    toolName: string;
    toolCallId?: string;
    invocationIndex?: number;
    status?: ToolStatus;
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
 * File change from tool invocation - matches chasm-shared FileChange
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
 * Token usage - matches chasm-shared TokenUsage
 */
export interface TokenUsage {
    prompt?: number;
    promptTokens?: number;
    completion?: number;
    completionTokens?: number;
    total?: number;
    totalTokens?: number;
}

/**
 * Chat message - aligned with chasm-shared Message and chasm-rust AgencyMessage
 */
export interface ChatMessage {
    id: string;
    role: MessageRole;
    content: string;
    contentRaw?: string;
    timestamp: Date;
    model?: string;
    modelId?: string;
    requestId?: string;
    responseId?: string;
    tokens?: TokenUsage;
    agentName?: string;
    toolCalls?: ToolCall[];
    toolResult?: ToolResult;
    toolInvocations?: ToolInvocation[];
    plan?: TaskPlan;
    reflection?: AgentReflection;
    isStreaming?: boolean;
    isCanceled?: boolean;
    metadata?: Record<string, unknown>;
}

// =============================================================================
// Session Types (aligned with chasm-shared Session)
// =============================================================================

/**
 * Chat session - matches chasm-shared Session
 */
export interface ChatSession {
    id: string;
    workspaceId?: string;
    workspaceName?: string;
    provider: string;
    providerSessionId?: string;
    title: string;
    model: string;
    messageCount: number;
    tokenCount?: number;
    createdAt: Date;
    updatedAt: Date;
    archived?: boolean;
    agentName?: string;
    messages: ChatMessage[];
    metadata: Record<string, unknown>;
}

/**
 * Session filter - matches chasm-shared SessionFilter
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

// =============================================================================
// Agent Types (aligned with chasm-shared Agent and chasm-rust Agency Agent)
// =============================================================================

/**
 * Agent capability
 */
export interface AgentCapability {
    name: string;
    description: string;
    enabled: boolean;
}

/**
 * Agent configuration - aligned with chasm-shared Agent and chasm-rust Agency Agent
 */
export interface AgentConfig {
    id?: string;
    name: string;
    role?: AgentRole;
    description: string;
    instruction: string;
    systemPrompt?: string;
    model: string;
    provider: string;
    providerId?: string;
    tools: string[];
    capabilities?: AgentCapability[];
    temperature?: number;
    maxTokens?: number;
    autonomy?: 'low' | 'medium' | 'high';
    maxIterations?: number;
    status?: AgentStatus;
    messageCount?: number;
    createdAt?: number;
    updatedAt?: number;
    metadata?: Record<string, unknown>;
}

/**
 * Agent task - matches chasm-shared AgentTask
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
 * Agent message for inter-agent communication - matches chasm-shared AgentMessage
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
 * Task plan for agent execution
 */
export interface TaskPlan {
    steps: PlanStep[];
    reasoning: string;
    estimatedTime?: number;
}

/**
 * Plan step
 */
export interface PlanStep {
    id: string;
    description: string;
    status: TaskStatus;
    result?: string;
    toolsUsed?: string[];
    agentId?: string;
}

/**
 * Agent self-reflection
 */
export interface AgentReflection {
    evaluation: string;
    improvements: string[];
    confidence: number;
}

// =============================================================================
// Swarm Types (aligned with chasm-shared Swarm and chasm-rust Agency Swarm)
// =============================================================================

/**
 * Swarm agent assignment - matches chasm-shared SwarmAgent
 */
export interface SwarmAgent {
    agentId: string;
    role: string;
    position?: { x: number; y: number };
}

/**
 * Workflow node - matches chasm-shared WorkflowNode
 */
export interface WorkflowNode {
    id: string;
    type: 'agent' | 'input' | 'output' | 'condition' | 'merge';
    agentId?: string;
    position: { x: number; y: number };
    data?: Record<string, unknown>;
}

/**
 * Workflow edge - matches chasm-shared WorkflowEdge
 */
export interface WorkflowEdge {
    id: string;
    source: string;
    target: string;
    condition?: string;
}

/**
 * Swarm workflow - matches chasm-shared SwarmWorkflow
 */
export interface SwarmWorkflow {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
}

/**
 * Multi-agent swarm - matches chasm-shared Swarm and chasm-rust Agency Swarm
 */
export interface Swarm {
    id: string;
    name: string;
    description?: string;
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

/**
 * Agent run - matches chasm-shared AgentRun
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
// Provider Types (aligned with chasm-shared Provider)
// =============================================================================

/**
 * Provider settings - matches chasm-shared ProviderSettings
 */
export interface ProviderSettings {
    enabled: boolean;
    priority?: number;
    timeout?: number;
    maxTokens?: number;
    temperature?: number;
}

/**
 * Provider configuration - matches chasm-shared Provider
 */
export interface ProviderConfig {
    id?: string;
    name: string;
    displayName: string;
    type?: ProviderType;
    icon?: string;
    color?: string;
    endpoint?: string;
    apiKey?: string;
    models: string[];
    status?: ProviderStatus;
    isAvailable: boolean;
    settings?: ProviderSettings;
}

/**
 * Provider health check - matches chasm-shared ProviderHealth
 */
export interface ProviderHealth {
    providerId: string;
    status: ProviderStatus;
    latency?: number;
    lastChecked: number;
    error?: string;
    version?: string;
    models: string[];
}

// =============================================================================
// Tool Types (for VS Code integration)
// =============================================================================

/**
 * Tool category
 */
export type ToolCategory = 'code' | 'search' | 'file' | 'web' | 'analysis' | 'git' | 'custom';

/**
 * Tool definition - for VS Code tools and MCP tools
 */
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    category: ToolCategory;
    source?: 'vscode' | 'mcp' | 'Chasm' | 'custom';
}

/**
 * MCP Tool - matches chasm-shared McpTool
 */
export interface McpTool {
    name: string;
    description: string | null;
    inputSchema: Record<string, unknown>;
}

/**
 * MCP Tool Call - matches chasm-shared McpToolCall
 */
export interface McpToolCall {
    name: string;
    arguments: Record<string, unknown>;
}

/**
 * MCP Tool Result - matches chasm-shared McpToolResult
 */
export interface McpToolResult {
    tool: string;
    result: {
        content: Array<{ type: string; text: string }>;
        isError?: boolean;
    };
}

// =============================================================================
// Event Types (aligned with chasm-rust Agency events)
// =============================================================================

/**
 * Event type - matches chasm-rust Agency EventType
 */
export type EventType =
    | 'agent_started'
    | 'agent_completed'
    | 'agent_error'
    | 'message_received'
    | 'tool_call_started'
    | 'tool_call_completed'
    | 'thinking'
    | 'streaming'
    | 'plan_created'
    | 'plan_step_started'
    | 'plan_step_completed'
    | 'reflection_complete';

/**
 * Agency Event - aligned with chasm-rust Agency AgencyEvent
 */
export interface AgencyEvent {
    eventType: EventType;
    agentName: string;
    data: unknown;
    timestamp: number;
}

// =============================================================================
// Chat Completion Types (aligned with chasm-shared)
// =============================================================================

/**
 * Chat completion request - matches chasm-shared ChatCompletionRequest
 */
export interface ChatCompletionRequest {
    provider: string;
    model: string;
    messages: Array<{ role: MessageRole; content: string }>;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    sessionId?: string;
    enableTools?: boolean;
    tools?: ToolDefinition[];
}

/**
 * Chat completion response - matches chasm-shared ChatCompletionResponse
 */
export interface ChatCompletionResponse {
    id: string;
    provider?: string;
    model: string;
    content: string;
    message?: { role: MessageRole; content: string };
    usage?: TokenUsage;
    finishReason?: 'stop' | 'length' | 'tool_calls' | 'error';
    toolCalls?: ToolCall[];
}

/**
 * Stream chunk - matches chasm-shared StreamChunk
 */
export interface StreamChunk {
    id: string;
    delta: string;
    finishReason?: 'stop' | 'length' | 'tool_calls' | 'error';
}

// =============================================================================
// API Types (aligned with chasm-shared)
// =============================================================================

/**
 * API error - matches chasm-shared ApiError
 */
export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}

/**
 * API response - matches chasm-shared ApiResponse
 */
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: ApiError;
}

/**
 * Paginated response - matches chasm-shared PaginatedResponse
 */
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
}

// =============================================================================
// Search Types (aligned with chasm-shared)
// =============================================================================

/**
 * Search result - matches chasm-shared SearchResult
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

// =============================================================================
// Export Types (aligned with chasm-shared)
// =============================================================================

/**
 * Export format
 */
export type ExportFormat = 'json' | 'markdown' | 'html' | 'csv';

/**
 * Export options - matches chasm-shared ExportOptions
 */
export interface ExportOptions {
    format: ExportFormat;
    includeMetadata?: boolean;
    sessionIds?: string[];
    workspaceId?: string;
    dateFrom?: number;
    dateTo?: number;
}

// =============================================================================
// Git Types (aligned with chasm-shared)
// =============================================================================

/**
 * Git commit - matches chasm-shared GitCommit
 */
export interface GitCommit {
    hash: string;
    shortHash: string;
    message: string;
    author: string;
    email?: string;
    timestamp: number;
    branch?: string;
    sessionId?: string;
    messageId?: string;
}

/**
 * Git repository - matches chasm-shared GitRepository
 */
export interface GitRepository {
    path: string;
    branch: string;
    remote?: string;
    uncommittedChanges?: number;
    ahead?: number;
    behind?: number;
}

// =============================================================================
// Checkpoint Types (aligned with chasm-shared)
// =============================================================================

/**
 * Session checkpoint - matches chasm-shared Checkpoint
 */
export interface Checkpoint {
    id: string;
    sessionId: string;
    name: string;
    description?: string;
    messageId?: string;
    gitCommit?: string;
    gitBranch?: string;
    createdAt: number;
    metadata?: Record<string, unknown>;
}

// =============================================================================
// UI State Types (VS Code extension specific)
// =============================================================================

/**
 * Panel state for webview communication
 */
export interface PanelState {
    sessions: ChatSession[];
    currentSession: ChatSession | null;
    providers: ProviderConfig[];
    agents: AgentConfig[];
    selectedProvider: string;
    selectedModel: string;
    selectedAgent: string | null;
    isStreaming: boolean;
    orchestrationMode: OrchestrationType;
    enablePlanning: boolean;
    enableReflection: boolean;
    availableTools: ToolDefinition[];
    swarms?: Swarm[];
    currentSwarm?: Swarm | null;
    activeRun?: AgentRun | null;
}

/**
 * Webview message types
 */
export type WebviewMessageType =
    | 'sendMessage'
    | 'newSession'
    | 'loadSession'
    | 'deleteSession'
    | 'selectProvider'
    | 'selectModel'
    | 'selectAgent'
    | 'selectOrchestration'
    | 'togglePlanning'
    | 'toggleReflection'
    | 'stopGeneration'
    | 'exportSession'
    | 'renameSession'
    | 'copyMessage'
    | 'insertCode'
    | 'createAgent'
    | 'createSwarm'
    | 'startSwarm'
    | 'pauseSwarm'
    | 'swarmAction'
    | 'cancelRun'
    | 'refresh';

/**
 * Webview message
 */
export interface WebviewMessage {
    type: WebviewMessageType;
    [key: string]: unknown;
}

// =============================================================================
// Backend API Types (for chasm-rust API communication)
// =============================================================================

/**
 * Workspace - matches chasm-shared Workspace (for API)
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
 * Session - matches chasm-shared Session (for API, without messages array)
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
 * Agent - matches chasm-shared Agent (for API)
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
 * Provider - matches chasm-shared Provider (for API)
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

/**
 * Statistics - matches chasm-shared Statistics
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
    sessionsByProvider: Array<{ provider: string; count: number; color?: string }>;
    messagesByDay?: Array<{ date: string; sessions: number; messages?: number }>;
    topWorkspaces?: Array<{ id: string; name: string; sessionCount: number; messageCount?: number; lastActive?: number }>;
}

