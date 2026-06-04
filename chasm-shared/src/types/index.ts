// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

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
 * Model provider type - matches Rust Agency ModelProvider enum
 * Includes both cloud and local LLM providers
 */
export type ModelProvider =
    // Cloud Providers
    | 'google'
    | 'openai'
    | 'anthropic'
    | 'azure'
    | 'groq'
    | 'together'
    | 'fireworks'
    | 'deepseek'
    | 'mistral'
    | 'cohere'
    | 'perplexity'
    // Local Providers
    | 'ollama'
    | 'lmstudio'
    | 'jan'
    | 'gpt4all'
    | 'localai'
    | 'llamafile'
    | 'textgenwebui'
    | 'vllm'
    | 'koboldcpp'
    | 'tabbyml'
    | 'exo'
    // Generic
    | 'openai_compatible'
    | 'custom';

/**
 * Model configuration - matches Rust Agency ModelConfig
 */
export interface ModelConfig {
    model: string;
    provider: ModelProvider;
    endpoint?: string | null;
    apiKey?: string | null;
    temperature?: number;
    maxTokens?: number | null;
    topP?: number | null;
}

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
// Modality Models - VLM/VLA Support
// =============================================================================

/**
 * Input/output modality types
 */
export type Modality =
    | 'text'           // Natural language text
    | 'image'          // Static images (PNG, JPEG, WebP)
    | 'video'          // Video sequences
    | 'audio'          // Audio/speech
    | 'point_cloud'    // 3D point cloud data
    | 'action'         // Robot/agent actions
    | 'sensor'         // Sensor readings
    | 'depth'          // Depth maps
    | 'segmentation'   // Semantic/instance segmentation
    | 'bounding_box'   // Object detection boxes
    | 'pose'           // Pose estimation (skeleton)
    | 'trajectory';    // Motion trajectories

/**
 * Model category by capabilities
 */
export type ModelCategory =
    | 'llm'         // Language-only (GPT-3.5, Llama)
    | 'vlm'         // Vision-Language (GPT-4o, Claude 3.5, Gemini)
    | 'vla'         // Vision-Language-Action (RT-2, PaLM-E)
    | 'alm'         // Audio-Language (Whisper+GPT, Gemini)
    | 'valm'        // Vision-Audio-Language (Gemini 2.0)
    | 'multimodal'  // Generic multimodal
    | 'embodied';   // Full embodied agent

/**
 * Modality capabilities for a model
 */
export interface ModalityCapabilities {
    category: ModelCategory;
    inputModalities: Modality[];
    outputModalities: Modality[];
    supportsStreaming: boolean;
    supportsRealtime: boolean;
    maxImageSize?: number | null;
    maxVideoLength?: number | null;
    maxAudioLength?: number | null;
    supportedImageFormats: string[];
    supportedVideoFormats: string[];
    supportedAudioFormats: string[];
}

/**
 * Image format types
 */
export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'bmp' | 'tiff';

/**
 * Image content for multimodal messages
 */
export interface ImageContent {
    format: ImageFormat;
    data: ImageData;
    width?: number | null;
    height?: number | null;
    altText?: string | null;
}

/**
 * Image data (URL or base64)
 */
export type ImageData =
    | { type: 'url'; url: string }
    | { type: 'base64'; base64: string };

/**
 * Video content for multimodal messages
 */
export interface VideoContent {
    format: string;
    source: VideoSource;
    durationSeconds?: number | null;
    fps?: number | null;
    width?: number | null;
    height?: number | null;
}

/**
 * Video source
 */
export type VideoSource =
    | { type: 'url'; url: string }
    | { type: 'base64'; base64: string }
    | { type: 'frames'; frames: ImageContent[] };

/**
 * Audio format types
 */
export type AudioFormat = 'mp3' | 'wav' | 'ogg' | 'flac' | 'webm' | 'pcm';

/**
 * Audio content for multimodal messages
 */
export interface AudioContent {
    format: AudioFormat;
    data: AudioData;
    durationSeconds?: number | null;
    sampleRate?: number | null;
    channels?: number | null;
    transcript?: string | null;
}

/**
 * Audio data (URL or base64)
 */
export type AudioData =
    | { type: 'url'; url: string }
    | { type: 'base64'; base64: string };

/**
 * Sensor types for VLA models
 */
export type SensorType =
    | 'joint_state'
    | 'imu'
    | 'force_torque'
    | 'camera_rgb'
    | 'camera_depth'
    | 'lidar'
    | 'tactile'
    | 'temperature'
    | 'proximity'
    | { type: 'custom'; name: string };

/**
 * Sensor data for VLA input
 */
export interface SensorData {
    sensorType: SensorType;
    timestamp: number;
    values: SensorValues;
    frameId?: string | null;
}

/**
 * Sensor value types
 */
export type SensorValues =
    | { type: 'joint_state'; positions: number[]; velocities?: number[] | null; efforts?: number[] | null }
    | { type: 'imu'; orientation: number[]; angularVelocity: number[]; linearAcceleration: number[] }
    | { type: 'force_torque'; force: number[]; torque: number[] }
    | { type: 'depth'; data: number[]; width: number; height: number }
    | { type: 'lidar'; ranges: number[]; angleMin: number; angleMax: number }
    | { type: 'tactile'; forces: number[] }
    | { type: 'temperature'; value: number }
    | { type: 'proximity'; distance: number }
    | { type: 'raw'; data: number[] };

/**
 * Robot joint state
 */
export interface JointState {
    name: string;
    position: number;
    velocity?: number | null;
    effort?: number | null;
}

/**
 * Action types for VLA models
 */
export type ActionType =
    | 'move'           // Move to position
    | 'rotate'         // Rotate to orientation
    | 'grasp'          // Grasp object
    | 'release'        // Release object
    | 'push'           // Push object
    | 'pull'           // Pull object
    | 'place'          // Place object at location
    | 'pick'           // Pick up object
    | 'move_arm'       // Move arm to pose
    | 'move_joint'     // Move specific joint
    | 'velocity'       // Velocity command
    | 'torque'         // Torque/force command
    | 'navigate'       // Navigate to goal
    | 'look_at'        // Point camera at target
    | 'speak'          // Speech output
    | 'wait'           // Wait for condition
    | 'stop'           // Emergency stop
    | { type: 'custom'; name: string };

/**
 * Action command for VLA output
 */
export interface ActionCommand {
    actionType: ActionType;
    parameters: ActionParameters;
    targetObject?: string | null;
    confidence?: number | null;
    duration?: number | null;
    priority?: number;
}

/**
 * Action parameters
 */
export type ActionParameters =
    | { type: 'position'; position: number[]; velocity?: number | null }
    | { type: 'pose'; position: number[]; orientation: number[] }
    | { type: 'joint'; jointPositions: number[]; jointVelocities?: number[] | null }
    | { type: 'velocity'; linear: number[]; angular: number[] }
    | { type: 'force'; force: number[]; torque: number[] }
    | { type: 'gripper'; width: number; force?: number | null }
    | { type: 'navigation'; goal: number[]; constraints?: Record<string, unknown> | null }
    | { type: 'speech'; text: string; language?: string | null }
    | { type: 'wait'; duration?: number | null; condition?: string | null }
    | { type: 'custom'; data: Record<string, unknown> };

/**
 * Action space types for VLA models
 */
export type ActionSpaceType =
    | 'discrete'        // Finite set of actions
    | 'continuous'      // Continuous action space
    | 'hybrid';         // Mixed discrete/continuous

/**
 * Action space configuration
 */
export interface ActionSpace {
    spaceType: ActionSpaceType;
    dimensions?: number | null;
    actionLabels?: string[] | null;
    bounds?: ActionBounds | null;
}

/**
 * Action bounds for continuous spaces
 */
export interface ActionBounds {
    low: number[];
    high: number[];
}

/**
 * Manipulator types for robot capabilities
 */
export type ManipulatorType =
    | 'parallel_gripper'
    | 'suction'
    | 'dexterous_hand'
    | 'soft_gripper'
    | 'magnetic'
    | { type: 'custom'; name: string };

/**
 * Navigation capabilities
 */
export type NavigationCapability = 'wheeled' | 'legged' | 'flying' | 'swimming' | 'stationary';

/**
 * Robot capabilities for VLA models
 */
export interface RobotCapabilities {
    manipulators: ManipulatorType[];
    navigation?: NavigationCapability | null;
    dof: number;
    maxPayload?: number | null;
    workspace?: WorkspaceBounds | null;
    sensors: SensorType[];
    actionSpace: ActionSpace;
}

/**
 * Workspace bounds for robot
 */
export interface WorkspaceBounds {
    minBounds: number[];
    maxBounds: number[];
}

/**
 * Content part for multimodal messages
 */
export type ContentPart =
    | { type: 'text'; text: string }
    | { type: 'image'; image: ImageContent }
    | { type: 'video'; video: VideoContent }
    | { type: 'audio'; audio: AudioContent }
    | { type: 'sensor'; sensor: SensorData }
    | { type: 'action'; action: ActionCommand };

/**
 * Multimodal message supporting mixed content
 */
export interface MultimodalMessage {
    role: 'user' | 'assistant' | 'system';
    content: ContentPart[];
    name?: string | null;
    toolCalls?: ToolInvocation[] | null;
    actions?: ActionCommand[] | null;
    timestamp?: number | null;
}

/**
 * Multimodal model definition
 */
export interface MultimodalModel {
    id: string;
    name: string;
    provider: ModelProvider;
    category: ModelCategory;
    capabilities: ModalityCapabilities;
    contextLength: number;
    description?: string | null;
    releaseDate?: string | null;
    deprecated?: boolean;
}

// =============================================================================
// Agent & Swarm Models
// =============================================================================

export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'completed' | 'failed' | 'paused';
export type AgentRole = 'coordinator' | 'researcher' | 'coder' | 'reviewer' | 'executor' | 'writer' | 'tester' | 'household' | 'business' | 'custom';
export type AgentAutonomy = 'none' | 'low' | 'medium' | 'high' | 'supervised';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type SwarmStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

/**
 * Permission level for proactive agents
 */
export type AgentPermissionLevel = 'notify_only' | 'low_risk' | 'medium_risk' | 'high_autonomy';

/**
 * Proactive action that requires permission
 */
export interface ProactiveAction {
    id: string;
    agentId: string;
    actionType: string;
    description: string;
    reasoning: string;
    estimatedImpact?: string;
    riskLevel: 'low' | 'medium' | 'high';
    status: 'pending' | 'approved' | 'rejected' | 'executed' | 'cancelled';
    autoApproved?: boolean;
    approvedAt?: number;
    approvedBy?: string;
    executedAt?: number;
    result?: string;
    error?: string;
    createdAt: number;
}

/**
 * Detected problem by proactive agent
 */
export interface DetectedProblem {
    id: string;
    agentId: string;
    category: string;
    title: string;
    description: string;
    severity: 'info' | 'warning' | 'urgent' | 'critical';
    detectedAt: number;
    source: string;
    suggestedActions: ProactiveAction[];
    status: 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'dismissed';
    resolvedAt?: number;
    metadata?: Record<string, unknown>;
}

/**
 * Orchestration type - matches Rust Agency OrchestrationType
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
    tokensUsed?: number;
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

// =============================================================================
// Memory & RAG Models
// =============================================================================

/**
 * Memory type classification - matches Rust MemoryType
 */
export type MemoryType =
    | 'short_term'   // Current conversation context
    | 'long_term'    // Persistent facts and preferences
    | 'episodic'     // Specific events and experiences
    | 'semantic'     // Concepts, relationships, knowledge
    | 'procedural'   // How to do things, workflows
    | 'preference'   // User preferences and settings
    | 'cache';       // Cached computation results

/**
 * Source of memory entry
 */
export type MemorySource =
    | { type: 'conversation'; sessionId: string; messageId: string }
    | { type: 'document'; path: string; chunkIndex: number }
    | { type: 'user_input' }
    | { type: 'agent_reasoning'; agentId: string }
    | { type: 'tool_result'; toolName: string }
    | { type: 'web_page'; url: string }
    | { type: 'summary'; sourceIds: string[] }
    | { type: 'custom'; sourceType: string };

/**
 * Memory entry - stored knowledge
 */
export interface MemoryEntry {
    id: string;
    content: string;
    embedding?: number[];
    memoryType: MemoryType;
    source: MemorySource;
    importance: number;
    accessCount: number;
    lastAccessed: number;
    createdAt: number;
    expiresAt?: number;
    agentId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
    tags: string[];
}

/**
 * Search result from vector store
 */
export interface VectorSearchResult {
    entry: MemoryEntry;
    score: number;
    rank: number;
}

/**
 * Embedding model options
 */
export type EmbeddingModel =
    | 'openai_small'     // text-embedding-3-small (1536 dims)
    | 'openai_large'     // text-embedding-3-large (3072 dims)
    | 'openai_ada'       // text-embedding-ada-002 (1536 dims)
    | 'minilm'           // all-MiniLM-L6-v2 (384 dims)
    | 'mpnet'            // all-mpnet-base-v2 (768 dims)
    | 'cohere'           // embed-english-v3.0 (1024 dims)
    | 'google_gecko'     // text-embedding-004 (768 dims)
    | 'voyage'           // voyage-2 (1024 dims)
    | { type: 'ollama'; model: string }
    | { type: 'custom'; name: string; dim: number };

/**
 * Similarity metric for vector search
 */
export type SimilarityMetric = 'cosine' | 'euclidean' | 'dot_product' | 'manhattan';

/**
 * Vector store configuration
 */
export interface VectorStoreConfig {
    embeddingModel: EmbeddingModel;
    embeddingDim: number;
    similarityMetric: SimilarityMetric;
    maxEntries: number;
    dbPath?: string;
}

/**
 * Document for knowledge base
 */
export interface Document {
    id: string;
    title: string;
    content: string;
    docType: DocumentType;
    source: string;
    chunks: DocumentChunk[];
    createdAt: number;
    updatedAt: number;
    metadata?: Record<string, unknown>;
}

/**
 * Document types
 */
export type DocumentType =
    | 'text'
    | 'markdown'
    | { type: 'code'; language: string }
    | 'html'
    | 'pdf'
    | 'json'
    | 'yaml'
    | 'csv'
    | { type: 'custom'; mimeType: string };

/**
 * Document chunk for embedding
 */
export interface DocumentChunk {
    index: number;
    content: string;
    startPos: number;
    endPos: number;
    embedding?: number[];
    tokenCount: number;
}

/**
 * Chunking strategy
 */
export type ChunkingStrategy = 'fixed_size' | 'sentence' | 'paragraph' | 'semantic' | 'code';

/**
 * Chunking configuration
 */
export interface ChunkingConfig {
    chunkSize: number;
    chunkOverlap: number;
    strategy: ChunkingStrategy;
}

/**
 * Context segment type
 */
export type ContextSegmentType =
    | 'system_prompt'
    | 'user_preferences'
    | 'conversation_history'
    | 'retrieved_context'
    | 'tool_results'
    | 'current_query'
    | { type: 'custom'; name: string };

/**
 * Context segment for building prompts
 */
export interface ContextSegment {
    segmentType: ContextSegmentType;
    content: string;
    tokens: number;
    priority: number;
    required: boolean;
}

/**
 * Memory manager configuration
 */
export interface MemoryConfig {
    vectorStore: VectorStoreConfig;
    chunking: ChunkingConfig;
    contextWindowTokens: number;
    cacheSize: number;
    dbPath?: string;
    autoSummarize: boolean;
    summarizeThreshold: number;
}

/**
 * Memory statistics
 */
export interface MemoryStats {
    totalEntries: number;
    entriesByType: Record<string, number>;
    totalAccessCount: number;
    avgImportance: number;
    documentCount: number;
}

/**
 * RAG (Retrieval-Augmented Generation) configuration
 */
export interface RAGConfig {
    enabled: boolean;
    memoryConfig: MemoryConfig;
    retrievalLimit: number;
    minRelevanceScore: number;
    includeConversationHistory: boolean;
    maxConversationTurns: number;
}

// =============================================================================
// Remote Monitoring Models
// =============================================================================

/**
 * Remote node status
 */
export type NodeStatus = 'online' | 'degraded' | 'offline' | 'maintenance' | 'unknown';

/**
 * Remote task status
 */
export type RemoteTaskStatus = 'queued' | 'starting' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'timed_out';

/**
 * Task priority
 */
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Log level
 */
export type RemoteLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

/**
 * Hardware information for a remote node
 */
export interface HardwareInfo {
    cpuCores: number;
    ramTotal: number;
    ramAvailable: number;
    gpus: GpuInfo[];
    os: string;
    arch: string;
}

/**
 * GPU information
 */
export interface GpuInfo {
    name: string;
    vram: number;
    cudaVersion?: string;
}

/**
 * Remote node representing a machine running agents
 */
export interface RemoteNode {
    id: string;
    name: string;
    address: string;
    status: NodeStatus;
    tags: string[];
    hardware?: HardwareInfo;
    activeAgents: number;
    runningTasks: number;
    lastHeartbeat: number;
    registeredAt: number;
    metadata?: Record<string, unknown>;
}

/**
 * Resource usage during task execution
 */
export interface ResourceUsage {
    cpuPercent: number;
    memoryBytes: number;
    gpuMemoryBytes?: number;
    networkTxBytes: number;
    networkRxBytes: number;
    diskReadBytes: number;
    diskWriteBytes: number;
}

/**
 * Task log entry
 */
export interface TaskLogEntry {
    timestamp: number;
    level: RemoteLogLevel;
    message: string;
    data?: unknown;
}

/**
 * Task execution metrics
 */
export interface TaskMetrics {
    durationMs: number;
    tokensUsed?: number;
    apiCalls: number;
    filesProcessed: number;
    errorsRecovered: number;
    retries: number;
}

/**
 * Artifact type
 */
export type ArtifactType = 'file' | 'directory' | 'url' | 'database' | 'model' | 'report' | 'log' | { type: 'custom'; name: string };

/**
 * Task artifact (output files, etc.)
 */
export interface TaskArtifact {
    name: string;
    artifactType: ArtifactType;
    location: string;
    size?: number;
    checksum?: string;
}

/**
 * Task result
 */
export interface RemoteTaskResult {
    success: boolean;
    output?: unknown;
    artifacts: TaskArtifact[];
    metrics: TaskMetrics;
}

/**
 * Remote task running on a node
 */
export interface RemoteTask {
    id: string;
    nodeId: string;
    agentId: string;
    agentName: string;
    title: string;
    description?: string;
    status: RemoteTaskStatus;
    progress: number;
    progressMessage?: string;
    currentStep?: number;
    totalSteps?: number;
    priority: TaskPriority;
    startedAt: number;
    completedAt?: number;
    eta?: number;
    result?: RemoteTaskResult;
    error?: string;
    resources: ResourceUsage;
    logs: TaskLogEntry[];
    metadata?: Record<string, unknown>;
}

/**
 * Remote monitor configuration
 */
export interface RemoteMonitorConfig {
    bindAddress: string;
    port: number;
    tlsEnabled: boolean;
    tlsCertPath?: string;
    tlsKeyPath?: string;
    authToken?: string;
    heartbeatIntervalSecs: number;
    nodeTimeoutSecs: number;
    maxLogEntries: number;
    metricsEnabled: boolean;
}

/**
 * Monitor statistics
 */
export interface MonitorStats {
    totalNodes: number;
    onlineNodes: number;
    totalAgents: number;
    totalTasks: number;
    runningTasks: number;
    queuedTasks: number;
    completedTasks: number;
    failedTasks: number;
}

/**
 * Remote event types
 */
export type RemoteEventType =
    | 'node_online'
    | 'node_offline'
    | 'node_status_changed'
    | 'node_heartbeat'
    | 'task_created'
    | 'task_started'
    | 'task_progress'
    | 'task_step_completed'
    | 'task_completed'
    | 'task_failed'
    | 'task_cancelled'
    | 'task_log'
    | 'agent_registered'
    | 'agent_unregistered';

/**
 * Remote event
 */
export interface RemoteEvent {
    type: RemoteEventType;
    timestamp: number;
    nodeId?: string;
    taskId?: string;
    agentId?: string;
    data?: unknown;
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
// Agency Event Types (matches Rust Agency)
// =============================================================================

/**
 * Agency Event type - mirrors Rust Agency EventType
 */
export type AgencyEventType =
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
 * Agency Event - matches Rust Agency AgencyEvent
 */
export interface AgencyEvent {
    type: AgencyEventType;
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
 * Tool call information - matches Rust Agency ToolCall
 */
export interface AgencyToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    timestamp: number;
}

/**
 * Tool result - matches Rust Agency ToolResult
 */
export interface AgencyToolResult {
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
    toolCalls?: AgencyToolCall[];
    events: AgencyEvent[];
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

// =============================================================================
// Life Integration Types
// =============================================================================

/**
 * Integration category
 */
export type IntegrationCategory =
    | 'productivity'
    | 'communication'
    | 'browser'
    | 'development'
    | 'smart_home'
    | 'finance'
    | 'health'
    | 'media'
    | 'travel'
    | 'shopping'
    | 'system';

/**
 * Authentication method for integrations
 */
export type IntegrationAuthType =
    | 'oauth2'
    | 'api_key'
    | 'bot_token'
    | 'local'
    | 'bridge'
    | 'extension'
    | 'none';

/**
 * Integration status
 */
export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'pending' | 'unknown';

/**
 * Integration configuration
 */
export interface Integration {
    id: string;
    name: string;
    category: IntegrationCategory;
    icon: string;
    color: string;
    capabilities: string[];
    authType: IntegrationAuthType;
    status: IntegrationStatus;
    lastSync?: number;
    error?: string;
    config?: IntegrationConfig;
}

/**
 * Integration-specific configuration
 */
export interface IntegrationConfig {
    enabled: boolean;
    credentials?: IntegrationCredentials;
    settings?: Record<string, unknown>;
    webhookUrl?: string;
    refreshToken?: string;
    expiresAt?: number;
}

/**
 * Integration credentials (stored securely)
 */
export interface IntegrationCredentials {
    accessToken?: string;
    apiKey?: string;
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
}

// =============================================================================
// Hook Types
// =============================================================================

/**
 * Hook trigger types
 */
export type HookTriggerType =
    | 'cron'
    | 'interval'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'webhook'
    | 'file_change'
    | 'email_received'
    | 'calendar_event'
    | 'git_push'
    | 'git_pr'
    | 'app_launch'
    | 'system_wake'
    | 'battery_low'
    | 'network_change'
    | 'custom';

/**
 * Hook action types
 */
export type HookActionType =
    | 'send_notification'
    | 'send_email'
    | 'send_slack'
    | 'send_discord'
    | 'send_sms'
    | 'run_command'
    | 'run_script'
    | 'call_api'
    | 'create_file'
    | 'move_file'
    | 'create_event'
    | 'update_event'
    | 'create_task'
    | 'complete_task'
    | 'control_device'
    | 'run_scene'
    | 'ask_agent'
    | 'summarize'
    | 'translate'
    | 'custom';

/**
 * Hook trigger configuration
 */
export interface HookTrigger {
    type: HookTriggerType;
    config: Record<string, unknown>;
}

/**
 * Hook action configuration
 */
export interface HookAction {
    type: HookActionType;
    integrationId?: string;
    config: Record<string, unknown>;
}

/**
 * Hook condition for conditional execution
 */
export interface HookCondition {
    field: string;
    operator: 'equals' | 'contains' | 'matches' | 'gt' | 'lt' | 'gte' | 'lte' | 'exists' | 'not_exists';
    value: unknown;
    negate?: boolean;
}

/**
 * Hook configuration
 */
export interface Hook {
    id: string;
    name: string;
    description?: string;
    enabled: boolean;
    trigger: HookTrigger;
    conditions?: HookCondition[];
    actions: HookAction[];
    cooldownMs?: number;
    maxExecutions?: number;
    executionCount: number;
    lastExecuted?: number;
    createdAt: number;
    updatedAt: number;
}

/**
 * Hook execution result
 */
export interface HookExecutionResult {
    hookId: string;
    success: boolean;
    actionsExecuted: number;
    actionsFailed: number;
    results: HookActionResult[];
    duration: number;
    timestamp: number;
}

/**
 * Individual action result
 */
export interface HookActionResult {
    actionType: HookActionType;
    success: boolean;
    output?: unknown;
    error?: string;
    duration: number;
}

/**
 * Hook preset template
 */
export interface HookPreset {
    id: string;
    name: string;
    description: string;
    category: string;
    trigger: HookTrigger;
    conditions?: HookCondition[];
    actions: HookAction[];
    requiredIntegrations: string[];
}

// =============================================================================
// SWE Mode Types
// =============================================================================
// Types for the Software Engineering mode with persistent project memory

/**
 * A software project directory with persistent memory
 */
export interface SweProject {
    id: string;
    name: string;
    path: string;
    description?: string | null;
    gitRemote?: string | null;
    gitBranch?: string | null;
    language?: string | null;
    framework?: string | null;
    lastOpened: number;
    createdAt: number;
    updatedAt: number;
    memoryCount: number;
    ruleCount: number;
    sessionCount: number;
    metadata?: Record<string, unknown> | null;
}

/**
 * Memory entry in the project key-value store
 * Used for persistent facts, context, and learned information
 */
export interface SweMemory {
    id: string;
    projectId: string;
    key: string;
    value: string;
    category: SweMemoryCategory;
    importance: SweImportance;
    source?: SweMemorySource;
    sourceMessageId?: string | null;
    expiresAt?: number | null;
    accessCount: number;
    lastAccessed?: number | null;
    createdAt: number;
    updatedAt: number;
    metadata?: Record<string, unknown> | null;
}

/**
 * Categories for organizing memory entries
 */
export type SweMemoryCategory =
    | 'fact'           // Learned facts about the project
    | 'decision'       // Design decisions and rationale
    | 'pattern'        // Code patterns and conventions
    | 'dependency'     // Package/dependency information
    | 'architecture'   // Architecture notes
    | 'bug'            // Known bugs and issues
    | 'todo'           // Tasks and todos
    | 'context'        // Contextual information
    | 'preference'     // User preferences
    | 'custom';

/**
 * Source of a memory entry
 */
export type SweMemorySource =
    | 'user'           // Explicitly added by user
    | 'assistant'      // Inferred by assistant
    | 'file'           // Extracted from file
    | 'git'            // From git history
    | 'import';        // Imported from external source

/**
 * Importance level for prioritizing memory in context
 */
export type SweImportance = 'critical' | 'high' | 'medium' | 'low';

/**
 * User-defined rules that are always injected into context
 * These are "never do X", "always do Y" type instructions
 */
export interface SweRule {
    id: string;
    projectId: string;
    rule: string;
    description?: string | null;
    category: SweRuleCategory;
    priority: number;
    enabled: boolean;
    scope?: SweRuleScope;
    conditions?: SweRuleCondition[];
    createdAt: number;
    updatedAt: number;
    metadata?: Record<string, unknown> | null;
}

/**
 * Rule categories for organization
 */
export type SweRuleCategory =
    | 'constraint'     // "Never do X"
    | 'requirement'    // "Always do Y"
    | 'style'          // Code style preferences
    | 'architecture'   // Architecture rules
    | 'security'       // Security requirements
    | 'testing'        // Testing requirements
    | 'documentation'  // Documentation standards
    | 'custom';

/**
 * Scope for when a rule applies
 */
export interface SweRuleScope {
    filePatterns?: string[];      // Glob patterns for files
    directories?: string[];        // Specific directories
    languages?: string[];          // Programming languages
    operations?: SweOperation[];   // Specific operations
}

/**
 * Operations that can trigger rules
 */
export type SweOperation =
    | 'file_create'
    | 'file_edit'
    | 'file_delete'
    | 'terminal_command'
    | 'code_review'
    | 'refactor'
    | 'test'
    | 'deploy'
    | 'all';

/**
 * Conditional rule application
 */
export interface SweRuleCondition {
    type: 'file_exists' | 'file_contains' | 'env_set' | 'branch_matches' | 'custom';
    value: string;
    negate?: boolean;
}

/**
 * SWE session - extends regular session with project context
 */
export interface SweSession {
    id: string;
    projectId: string;
    title: string;
    model?: string | null;
    provider: string;
    messageCount: number;
    tokenCount?: number | null;
    workingDirectory?: string | null;
    gitBranch?: string | null;
    createdAt: number;
    updatedAt: number;
    archived?: boolean;
    metadata?: Record<string, unknown> | null;
}

/**
 * SWE session with full details including messages and context
 */
export interface SweSessionWithMessages extends SweSession {
    messages: SweMessage[];
    project: SweProject;
    activeRules: SweRule[];
    relevantMemory: SweMemory[];
}

/**
 * SWE message - extends regular message with tool execution context
 */
export interface SweMessage {
    id: string;
    sessionId: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    model?: string | null;
    tokenCount?: number | null;
    createdAt: number;
    toolCalls?: SweToolCall[];
    toolResults?: SweToolResult[];
    contextSnapshot?: SweContextSnapshot;
    metadata?: Record<string, unknown> | null;
}

/**
 * Tool call made by the assistant
 */
export interface SweToolCall {
    id: string;
    name: SweTool;
    input: Record<string, unknown>;
    status: 'pending' | 'running' | 'success' | 'error';
    startedAt?: number;
    completedAt?: number;
}

/**
 * Result of a tool execution
 */
export interface SweToolResult {
    callId: string;
    success: boolean;
    output?: unknown;
    error?: string;
    duration: number;
    affectedFiles?: string[];
}

/**
 * Available SWE tools
 */
export type SweTool =
    | 'read_file'
    | 'write_file'
    | 'edit_file'
    | 'create_file'
    | 'delete_file'
    | 'list_directory'
    | 'search_files'
    | 'search_code'
    | 'run_command'
    | 'git_status'
    | 'git_diff'
    | 'git_commit'
    | 'git_log'
    | 'add_memory'
    | 'get_memory'
    | 'search_memory'
    | 'add_rule'
    | 'web_search'
    | 'fetch_url';

/**
 * Snapshot of context at message time
 */
export interface SweContextSnapshot {
    workingDirectory: string;
    gitBranch?: string;
    gitStatus?: string;
    openFiles?: string[];
    recentChanges?: SweFileChange[];
    injectedRules: string[];
    injectedMemory: string[];
}

/**
 * File change record
 */
export interface SweFileChange {
    path: string;
    type: 'create' | 'edit' | 'delete' | 'rename';
    diff?: string;
    timestamp: number;
}

/**
 * Project file tree node
 */
export interface SweFileNode {
    name: string;
    path: string;
    type: 'file' | 'directory';
    size?: number;
    modified?: number;
    children?: SweFileNode[];
    isExpanded?: boolean;
    isGitIgnored?: boolean;
}

/**
 * Git status for the project
 */
export interface SweGitStatus {
    branch: string;
    ahead: number;
    behind: number;
    staged: SweGitChange[];
    unstaged: SweGitChange[];
    untracked: string[];
    hasConflicts: boolean;
}

/**
 * Git change entry
 */
export interface SweGitChange {
    path: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
    oldPath?: string;
}

/**
 * Search result for code/file search
 */
export interface SweSearchResult {
    file: string;
    line: number;
    column?: number;
    content: string;
    context?: string;
    matchType: 'exact' | 'fuzzy' | 'regex';
}

/**
 * Terminal execution result
 */
export interface SweTerminalResult {
    command: string;
    exitCode: number;
    stdout: string;
    stderr: string;
    duration: number;
    workingDirectory: string;
}

/**
 * Context to inject into model prompts
 */
export interface SweContextInjection {
    systemPrompt: string;
    rules: SweRule[];
    memory: SweMemory[];
    recentFiles: string[];
    gitContext?: SweGitStatus;
    customContext?: string;
}

/**
 * Stats for a SWE project
 */
export interface SweProjectStats {
    projectId: string;
    totalSessions: number;
    totalMessages: number;
    totalTokens: number;
    totalMemoryEntries: number;
    totalRules: number;
    totalFileOperations: number;
    totalTerminalCommands: number;
    lastActivity: number;
    topMemoryCategories: { category: SweMemoryCategory; count: number }[];
    recentFiles: string[];
}

/**
 * Request to create a new SWE project
 */
export interface CreateSweProjectRequest {
    path: string;
    name?: string;
    description?: string;
}

/**
 * Request to add a memory entry
 */
export interface CreateSweMemoryRequest {
    key: string;
    value: string;
    category?: SweMemoryCategory;
    importance?: SweImportance;
    expiresAt?: number;
    metadata?: Record<string, unknown>;
}

/**
 * Request to add a rule
 */
export interface CreateSweRuleRequest {
    rule: string;
    description?: string;
    category?: SweRuleCategory;
    priority?: number;
    scope?: SweRuleScope;
    conditions?: SweRuleCondition[];
}

/**
 * Request to execute a tool
 */
export interface SweToolExecutionRequest {
    projectId: string;
    sessionId?: string;
    tool: SweTool;
    input: Record<string, unknown>;
}

/**
 * Batch memory import request
 */
export interface SweBatchMemoryImport {
    projectId: string;
    entries: CreateSweMemoryRequest[];
    overwriteExisting?: boolean;
}

/**
 * Project template for quick setup
 */
export interface SweProjectTemplate {
    id: string;
    name: string;
    description: string;
    language: string;
    framework?: string;
    defaultRules: CreateSweRuleRequest[];
    defaultMemory: CreateSweMemoryRequest[];
}

/**
 * Common project templates
 */
export const SWE_PROJECT_TEMPLATES: SweProjectTemplate[] = [
    {
        id: 'typescript-node',
        name: 'TypeScript Node.js',
        description: 'Node.js project with TypeScript',
        language: 'typescript',
        framework: 'node',
        defaultRules: [
            { rule: 'Use strict TypeScript - no `any` types unless absolutely necessary', category: 'style', priority: 1 },
            { rule: 'All async functions must have proper error handling', category: 'requirement', priority: 2 },
            { rule: 'Use ESM imports, not CommonJS require()', category: 'style', priority: 3 },
        ],
        defaultMemory: [],
    },
    {
        id: 'react-app',
        name: 'React Application',
        description: 'React frontend application',
        language: 'typescript',
        framework: 'react',
        defaultRules: [
            { rule: 'Use functional components with hooks, not class components', category: 'style', priority: 1 },
            { rule: 'All components must have proper TypeScript props interfaces', category: 'requirement', priority: 2 },
            { rule: 'Use Tailwind CSS for styling, avoid inline styles', category: 'style', priority: 3 },
        ],
        defaultMemory: [],
    },
    {
        id: 'rust-project',
        name: 'Rust Project',
        description: 'Rust application or library',
        language: 'rust',
        defaultRules: [
            { rule: 'Handle all Result and Option types explicitly - no unwrap() in production code', category: 'constraint', priority: 1 },
            { rule: 'Document all public functions and types with /// doc comments', category: 'documentation', priority: 2 },
            { rule: 'Run clippy and fix warnings before committing', category: 'requirement', priority: 3 },
        ],
        defaultMemory: [],
    },
    {
        id: 'python-project',
        name: 'Python Project',
        description: 'Python application or library',
        language: 'python',
        defaultRules: [
            { rule: 'Use type hints for all function parameters and return values', category: 'style', priority: 1 },
            { rule: 'Follow PEP 8 style guide', category: 'style', priority: 2 },
            { rule: 'All functions must have docstrings', category: 'documentation', priority: 3 },
        ],
        defaultMemory: [],
    },
];

// =============================================================================
// Authentication & Subscription Types
// =============================================================================

/**
 * Subscription tier levels for CSM cloud sync services
 */
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

/**
 * Subscription pricing information
 */
export interface SubscriptionPricing {
    tier: SubscriptionTier;
    name: string;
    price: number; // Monthly price in USD
    yearlyPrice?: number;
    features: string[];
    limits: SubscriptionLimits;
}

/**
 * Subscription usage limits
 */
export interface SubscriptionLimits {
    maxWorkspaces: number;
    maxSessions: number;
    maxAgents: number;
    maxSwarms: number;
    syncEnabled: boolean;
    realTimeSync: boolean;
    prioritySync: boolean;
    teamFeatures: boolean;
    apiAccess: boolean;
    customIntegrations: boolean;
}

/**
 * User subscription details
 */
export interface Subscription {
    tier: SubscriptionTier;
    expiresAt: number | null;
    autoRenew: boolean;
    limits: SubscriptionLimits;
    usage?: SubscriptionUsage;
}

/**
 * Current subscription usage
 */
export interface SubscriptionUsage {
    workspaces: number;
    sessions: number;
    agents: number;
    swarms: number;
    syncEvents: number;
    lastSyncAt: number | null;
}

/**
 * User account information
 */
export interface User {
    id: string;
    email: string;
    username: string | null;
    subscription: Subscription;
    createdAt: number;
    updatedAt: number;
    isActive: boolean;
    emailVerified: boolean;
    avatarUrl?: string | null;
    preferences?: UserPreferences;
}

/**
 * User preferences
 */
export interface UserPreferences {
    theme: 'light' | 'dark' | 'system';
    defaultProvider: string | null;
    syncOnStartup: boolean;
    autoBackup: boolean;
    notificationsEnabled: boolean;
}

/**
 * Login request payload
 */
export interface LoginRequest {
    email: string;
    password: string;
    rememberMe?: boolean;
}

/**
 * Registration request payload
 */
export interface RegisterRequest {
    email: string;
    password: string;
    username?: string;
    acceptTerms: boolean;
}

/**
 * Authentication response with tokens
 */
export interface AuthResponse {
    user: User;
    accessToken: string;
    refreshToken: string;
    expiresAt: number; // Unix timestamp when access token expires
}

/**
 * Token refresh request
 */
export interface RefreshTokenRequest {
    refreshToken: string;
}

/**
 * Token refresh response
 */
export interface RefreshTokenResponse {
    accessToken: string;
    expiresAt: number;
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
    email: string;
}

/**
 * Password change request
 */
export interface PasswordChangeRequest {
    currentPassword: string;
    newPassword: string;
}

/**
 * Subscription upgrade/change request
 */
export interface SubscribeRequest {
    tier: SubscriptionTier;
    paymentMethodId?: string;
    billingCycle: 'monthly' | 'yearly';
}

/**
 * API key for programmatic access
 */
export interface ApiKey {
    id: string;
    name: string;
    prefix: string; // First 8 chars of key for identification
    createdAt: number;
    lastUsedAt: number | null;
    expiresAt: number | null;
    scopes: ApiKeyScope[];
}

/**
 * API key scopes/permissions
 */
export type ApiKeyScope =
    | 'read:sessions'
    | 'write:sessions'
    | 'read:workspaces'
    | 'write:workspaces'
    | 'read:agents'
    | 'write:agents'
    | 'sync:read'
    | 'sync:write';

/**
 * Create API key request
 */
export interface CreateApiKeyRequest {
    name: string;
    scopes: ApiKeyScope[];
    expiresInDays?: number;
}

/**
 * Create API key response (includes full key, only shown once)
 */
export interface CreateApiKeyResponse {
    apiKey: ApiKey;
    key: string; // Full API key, only returned on creation
}

/**
 * Authentication state for client applications
 */
export interface AuthState {
    isAuthenticated: boolean;
    isLoading: boolean;
    user: User | null;
    error: string | null;
}

/**
 * Device/session information for active sessions management
 */
export interface DeviceSession {
    id: string;
    deviceName: string;
    deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
    platform: string;
    browser?: string;
    ipAddress?: string;
    location?: string;
    lastActiveAt: number;
    createdAt: number;
    isCurrent: boolean;
}

/**
 * Subscription pricing tiers (constant)
 */
export const SUBSCRIPTION_TIERS: SubscriptionPricing[] = [
    {
        tier: 'free',
        name: 'Free',
        price: 0,
        features: [
            'Up to 10 workspaces',
            'Up to 100 sessions',
            'Local sync only',
            'Basic agent support',
        ],
        limits: {
            maxWorkspaces: 10,
            maxSessions: 100,
            maxAgents: 3,
            maxSwarms: 1,
            syncEnabled: true,
            realTimeSync: false,
            prioritySync: false,
            teamFeatures: false,
            apiAccess: false,
            customIntegrations: false,
        },
    },
    {
        tier: 'pro',
        name: 'Pro',
        price: 9.99,
        yearlyPrice: 99.99,
        features: [
            'Up to 100 workspaces',
            'Unlimited sessions',
            'Real-time cloud sync',
            'Unlimited agents',
            'API access',
            'Priority support',
        ],
        limits: {
            maxWorkspaces: 100,
            maxSessions: -1, // Unlimited
            maxAgents: -1,
            maxSwarms: 10,
            syncEnabled: true,
            realTimeSync: true,
            prioritySync: false,
            teamFeatures: false,
            apiAccess: true,
            customIntegrations: false,
        },
    },
    {
        tier: 'enterprise',
        name: 'Enterprise',
        price: 29.99,
        yearlyPrice: 299.99,
        features: [
            'Unlimited workspaces',
            'Unlimited sessions',
            'Priority real-time sync',
            'Unlimited agents & swarms',
            'Team collaboration features',
            'Custom integrations',
            'Dedicated support',
            'SLA guarantee',
        ],
        limits: {
            maxWorkspaces: -1,
            maxSessions: -1,
            maxAgents: -1,
            maxSwarms: -1,
            syncEnabled: true,
            realTimeSync: true,
            prioritySync: true,
            teamFeatures: true,
            apiAccess: true,
            customIntegrations: true,
        },
    },
];

// =============================================================================
// Re-export additional types from separate modules
// =============================================================================

// Q1-Q2 2026 Enhancements
export * from './annotations';
export * from './templates';
export * from './shortcuts';
export * from './batch';

// Q2 2026 Features
export * from './collaboration';
export * from './summarization';
export * from './search';
export * from './tagging';
