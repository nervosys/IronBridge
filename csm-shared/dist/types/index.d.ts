/**
 * Workspace representing a VS Code workspace or project directory
 */
interface Workspace {
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
interface Session {
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
interface Message {
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
interface ToolInvocation {
    toolName: string;
    toolCallId?: string;
    invocationIndex?: number;
    status?: 'pending' | 'running' | 'complete' | 'error';
    isComplete?: boolean;
    isConfirmed?: boolean | null;
    invocationMessage?: string | {
        value?: string;
        [key: string]: unknown;
    };
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    toolSpecificData?: unknown;
    fileChanges?: FileChange[];
    timestamp?: number;
}
/**
 * File change from a tool invocation
 */
interface FileChange {
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
interface SessionWithMessages extends Session {
    messages: Message[];
    toolInvocations?: ToolInvocation[];
    fileChanges?: FileChange[];
}
/**
 * Checkpoint/snapshot of a session
 */
interface Checkpoint {
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
interface ShareLink {
    id: string;
    sessionId: string;
    provider: ShareLinkProvider;
    url: string;
    expiresAt?: number | null;
    createdAt: number;
}
type ShareLinkProvider = 'github_gist' | 'pastebin' | 'hastebin' | 'chatgpt' | 'claude' | 'custom';
/**
 * LLM provider configuration
 */
interface Provider {
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
type ProviderType = 'local' | 'cloud';
type ProviderStatus = 'connected' | 'disconnected' | 'error' | 'unknown';
interface ProviderSettings {
    enabled: boolean;
    priority?: number;
    timeout?: number;
    maxTokens?: number | null;
    temperature?: number | null;
}
/**
 * Provider health check result
 */
interface ProviderHealth {
    providerId: string;
    status: ProviderStatus;
    latency?: number | null;
    lastChecked: number;
    error?: string | null;
    version?: string | null;
    models: string[];
}
type AgentStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'completed' | 'failed' | 'paused';
type AgentRole = 'coordinator' | 'researcher' | 'coder' | 'reviewer' | 'executor' | 'writer' | 'tester' | 'custom';
type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
type SwarmStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';
/**
 * Orchestration type - matches Rust ADK OrchestrationType
 */
type OrchestrationType = 'single' | 'sequential' | 'parallel' | 'loop' | 'hierarchical' | 'swarm' | 'debate';
/**
 * Pipeline configuration for multi-agent orchestration
 */
interface Pipeline {
    id: string;
    name: string;
    orchestration: OrchestrationType;
    agents: string[];
    maxIterations?: number;
    createdAt: number;
    updatedAt: number;
}
/**
 * AI Agent configuration
 */
interface Agent {
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
interface AgentTask {
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
interface AgentMessage {
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
interface Swarm {
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
interface SwarmAgent {
    agentId: string;
    role: string;
    position?: {
        x: number;
        y: number;
    };
}
interface SwarmWorkflow {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
}
interface WorkflowNode {
    id: string;
    type: 'agent' | 'input' | 'output' | 'condition' | 'merge';
    agentId?: string;
    position: {
        x: number;
        y: number;
    };
}
interface WorkflowEdge {
    id: string;
    source: string;
    target: string;
    condition?: string;
}
/**
 * Agent run (execution instance)
 */
interface AgentRun {
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
/**
 * Git commit info linked to chat
 */
interface GitCommit {
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
interface GitRepository {
    path: string;
    branch: string;
    remote?: string | null;
    uncommittedChanges?: number;
    ahead?: number;
    behind?: number;
}
/**
 * Overview statistics
 */
interface Statistics {
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
interface ProviderCount {
    provider: string;
    count: number;
    color?: string;
}
interface DayCount {
    date: string;
    sessions: number;
    messages?: number;
}
interface WorkspaceStats {
    id: string;
    name: string;
    sessionCount: number;
    messageCount?: number;
    lastActive?: number;
}
/**
 * Full-text search result
 */
interface SearchResult {
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
interface SessionFilter {
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
interface WorkspaceFilter {
    provider?: string;
    hasChats?: boolean;
    search?: string;
    sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'sessionCount';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}
/**
 * Paginated response wrapper
 */
interface PaginatedResponse<T> {
    items: T[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
}
/**
 * API error
 */
interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}
/**
 * Generic API response
 */
interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: ApiError;
}
interface ChatCompletionRequest {
    provider: string;
    model: string;
    messages: ChatCompletionMessage[];
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    sessionId?: string;
    enableTools?: boolean;
}
interface ChatCompletionMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}
interface ChatCompletionResponse {
    id: string;
    provider?: string;
    model: string;
    content: string;
    message?: ChatCompletionMessage;
    usage?: TokenUsage;
    tokens?: TokenUsage;
    finishReason?: 'stop' | 'length' | 'tool_calls' | 'error';
    toolCalls?: Array<{
        name: string;
        arguments: string;
    }>;
}
interface TokenUsage {
    prompt?: number;
    promptTokens?: number;
    completion?: number;
    completionTokens?: number;
    total?: number;
    totalTokens?: number;
}
interface StreamChunk {
    id: string;
    delta: string;
    finishReason?: 'stop' | 'length' | 'tool_calls' | 'error';
}
interface ImportSource {
    type: 'share_link' | 'file' | 'directory' | 'provider';
    uri: string;
    provider?: string;
}
interface ImportResult {
    success: boolean;
    sessionsImported: number;
    messagesImported: number;
    errors: string[];
    warnings: string[];
}
interface ExportOptions {
    format: 'json' | 'markdown' | 'html' | 'csv';
    includeMetadata?: boolean;
    sessionIds?: string[];
    workspaceId?: string;
    dateFrom?: number;
    dateTo?: number;
}
type ThemeMode = 'light' | 'dark' | 'system' | 'neutral';
interface AppSettings {
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
interface McpTool {
    name: string;
    description: string | null;
    inputSchema: Record<string, unknown>;
}
interface McpToolCall {
    name: string;
    arguments: Record<string, unknown>;
}
interface McpToolResult {
    tool: string;
    result: {
        content: Array<{
            type: string;
            text: string;
        }>;
        isError?: boolean;
    };
}
/**
 * ADK Event type - mirrors Rust ADK EventType
 */
type AdkEventType = 'agent_started' | 'agent_thinking' | 'agent_executing' | 'agent_completed' | 'agent_failed' | 'tool_call_started' | 'tool_call_completed' | 'tool_call_failed' | 'message_created' | 'message_delta' | 'task_created' | 'task_started' | 'task_completed' | 'task_failed' | 'swarm_started' | 'swarm_agent_joined' | 'swarm_completed' | 'swarm_failed' | 'handoff' | 'error';
/**
 * ADK Event - matches Rust ADK AdkEvent
 */
interface AdkEvent {
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
interface AdkToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    timestamp: number;
}
/**
 * Tool result - matches Rust ADK ToolResult
 */
interface AdkToolResult {
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
interface ExecutionResult {
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
interface OrchestratorResult {
    success: boolean;
    outputs: string[];
    agentResults: ExecutionResult[];
    totalTokens: TokenUsage;
    duration: number;
}

export type { AdkEvent, AdkEventType, AdkToolCall, AdkToolResult, Agent, AgentMessage, AgentRole, AgentRun, AgentStatus, AgentTask, ApiError, ApiResponse, AppSettings, ChatCompletionMessage, ChatCompletionRequest, ChatCompletionResponse, Checkpoint, DayCount, ExecutionResult, ExportOptions, FileChange, GitCommit, GitRepository, ImportResult, ImportSource, McpTool, McpToolCall, McpToolResult, Message, OrchestrationType, OrchestratorResult, PaginatedResponse, Pipeline, Provider, ProviderCount, ProviderHealth, ProviderSettings, ProviderStatus, ProviderType, SearchResult, Session, SessionFilter, SessionWithMessages, ShareLink, ShareLinkProvider, Statistics, StreamChunk, Swarm, SwarmAgent, SwarmStatus, SwarmWorkflow, TaskStatus, ThemeMode, TokenUsage, ToolInvocation, WorkflowEdge, WorkflowNode, Workspace, WorkspaceFilter, WorkspaceStats };
