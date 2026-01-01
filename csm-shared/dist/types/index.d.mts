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
 * Model provider type - matches Rust Agency ModelProvider enum
 * Includes both cloud and local LLM providers
 */
type ModelProvider = 'google' | 'openai' | 'anthropic' | 'azure' | 'groq' | 'together' | 'fireworks' | 'deepseek' | 'mistral' | 'cohere' | 'perplexity' | 'ollama' | 'lmstudio' | 'jan' | 'gpt4all' | 'localai' | 'llamafile' | 'textgenwebui' | 'vllm' | 'koboldcpp' | 'tabbyml' | 'exo' | 'openai_compatible' | 'custom';
/**
 * Model configuration - matches Rust Agency ModelConfig
 */
interface ModelConfig {
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
/**
 * Input/output modality types
 */
type Modality = 'text' | 'image' | 'video' | 'audio' | 'point_cloud' | 'action' | 'sensor' | 'depth' | 'segmentation' | 'bounding_box' | 'pose' | 'trajectory';
/**
 * Model category by capabilities
 */
type ModelCategory = 'llm' | 'vlm' | 'vla' | 'alm' | 'valm' | 'multimodal' | 'embodied';
/**
 * Modality capabilities for a model
 */
interface ModalityCapabilities {
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
type ImageFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'bmp' | 'tiff';
/**
 * Image content for multimodal messages
 */
interface ImageContent {
    format: ImageFormat;
    data: ImageData;
    width?: number | null;
    height?: number | null;
    altText?: string | null;
}
/**
 * Image data (URL or base64)
 */
type ImageData = {
    type: 'url';
    url: string;
} | {
    type: 'base64';
    base64: string;
};
/**
 * Video content for multimodal messages
 */
interface VideoContent {
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
type VideoSource = {
    type: 'url';
    url: string;
} | {
    type: 'base64';
    base64: string;
} | {
    type: 'frames';
    frames: ImageContent[];
};
/**
 * Audio format types
 */
type AudioFormat = 'mp3' | 'wav' | 'ogg' | 'flac' | 'webm' | 'pcm';
/**
 * Audio content for multimodal messages
 */
interface AudioContent {
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
type AudioData = {
    type: 'url';
    url: string;
} | {
    type: 'base64';
    base64: string;
};
/**
 * Sensor types for VLA models
 */
type SensorType = 'joint_state' | 'imu' | 'force_torque' | 'camera_rgb' | 'camera_depth' | 'lidar' | 'tactile' | 'temperature' | 'proximity' | {
    type: 'custom';
    name: string;
};
/**
 * Sensor data for VLA input
 */
interface SensorData {
    sensorType: SensorType;
    timestamp: number;
    values: SensorValues;
    frameId?: string | null;
}
/**
 * Sensor value types
 */
type SensorValues = {
    type: 'joint_state';
    positions: number[];
    velocities?: number[] | null;
    efforts?: number[] | null;
} | {
    type: 'imu';
    orientation: number[];
    angularVelocity: number[];
    linearAcceleration: number[];
} | {
    type: 'force_torque';
    force: number[];
    torque: number[];
} | {
    type: 'depth';
    data: number[];
    width: number;
    height: number;
} | {
    type: 'lidar';
    ranges: number[];
    angleMin: number;
    angleMax: number;
} | {
    type: 'tactile';
    forces: number[];
} | {
    type: 'temperature';
    value: number;
} | {
    type: 'proximity';
    distance: number;
} | {
    type: 'raw';
    data: number[];
};
/**
 * Robot joint state
 */
interface JointState {
    name: string;
    position: number;
    velocity?: number | null;
    effort?: number | null;
}
/**
 * Action types for VLA models
 */
type ActionType = 'move' | 'rotate' | 'grasp' | 'release' | 'push' | 'pull' | 'place' | 'pick' | 'move_arm' | 'move_joint' | 'velocity' | 'torque' | 'navigate' | 'look_at' | 'speak' | 'wait' | 'stop' | {
    type: 'custom';
    name: string;
};
/**
 * Action command for VLA output
 */
interface ActionCommand {
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
type ActionParameters = {
    type: 'position';
    position: number[];
    velocity?: number | null;
} | {
    type: 'pose';
    position: number[];
    orientation: number[];
} | {
    type: 'joint';
    jointPositions: number[];
    jointVelocities?: number[] | null;
} | {
    type: 'velocity';
    linear: number[];
    angular: number[];
} | {
    type: 'force';
    force: number[];
    torque: number[];
} | {
    type: 'gripper';
    width: number;
    force?: number | null;
} | {
    type: 'navigation';
    goal: number[];
    constraints?: Record<string, unknown> | null;
} | {
    type: 'speech';
    text: string;
    language?: string | null;
} | {
    type: 'wait';
    duration?: number | null;
    condition?: string | null;
} | {
    type: 'custom';
    data: Record<string, unknown>;
};
/**
 * Action space types for VLA models
 */
type ActionSpaceType = 'discrete' | 'continuous' | 'hybrid';
/**
 * Action space configuration
 */
interface ActionSpace {
    spaceType: ActionSpaceType;
    dimensions?: number | null;
    actionLabels?: string[] | null;
    bounds?: ActionBounds | null;
}
/**
 * Action bounds for continuous spaces
 */
interface ActionBounds {
    low: number[];
    high: number[];
}
/**
 * Manipulator types for robot capabilities
 */
type ManipulatorType = 'parallel_gripper' | 'suction' | 'dexterous_hand' | 'soft_gripper' | 'magnetic' | {
    type: 'custom';
    name: string;
};
/**
 * Navigation capabilities
 */
type NavigationCapability = 'wheeled' | 'legged' | 'flying' | 'swimming' | 'stationary';
/**
 * Robot capabilities for VLA models
 */
interface RobotCapabilities {
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
interface WorkspaceBounds {
    minBounds: number[];
    maxBounds: number[];
}
/**
 * Content part for multimodal messages
 */
type ContentPart = {
    type: 'text';
    text: string;
} | {
    type: 'image';
    image: ImageContent;
} | {
    type: 'video';
    video: VideoContent;
} | {
    type: 'audio';
    audio: AudioContent;
} | {
    type: 'sensor';
    sensor: SensorData;
} | {
    type: 'action';
    action: ActionCommand;
};
/**
 * Multimodal message supporting mixed content
 */
interface MultimodalMessage {
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
interface MultimodalModel {
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
type AgentStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'completed' | 'failed' | 'paused';
type AgentRole = 'coordinator' | 'researcher' | 'coder' | 'reviewer' | 'executor' | 'writer' | 'tester' | 'household' | 'business' | 'custom';
type AgentAutonomy = 'none' | 'low' | 'medium' | 'high' | 'supervised';
type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
type SwarmStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';
/**
 * Permission level for proactive agents
 */
type PermissionLevel = 'notify_only' | 'low_risk' | 'medium_risk' | 'high_autonomy';
/**
 * Proactive action that requires permission
 */
interface ProactiveAction {
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
interface DetectedProblem {
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
 * Memory type classification - matches Rust MemoryType
 */
type MemoryType = 'short_term' | 'long_term' | 'episodic' | 'semantic' | 'procedural' | 'preference' | 'cache';
/**
 * Source of memory entry
 */
type MemorySource = {
    type: 'conversation';
    sessionId: string;
    messageId: string;
} | {
    type: 'document';
    path: string;
    chunkIndex: number;
} | {
    type: 'user_input';
} | {
    type: 'agent_reasoning';
    agentId: string;
} | {
    type: 'tool_result';
    toolName: string;
} | {
    type: 'web_page';
    url: string;
} | {
    type: 'summary';
    sourceIds: string[];
} | {
    type: 'custom';
    sourceType: string;
};
/**
 * Memory entry - stored knowledge
 */
interface MemoryEntry {
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
interface VectorSearchResult {
    entry: MemoryEntry;
    score: number;
    rank: number;
}
/**
 * Embedding model options
 */
type EmbeddingModel = 'openai_small' | 'openai_large' | 'openai_ada' | 'minilm' | 'mpnet' | 'cohere' | 'google_gecko' | 'voyage' | {
    type: 'ollama';
    model: string;
} | {
    type: 'custom';
    name: string;
    dim: number;
};
/**
 * Similarity metric for vector search
 */
type SimilarityMetric = 'cosine' | 'euclidean' | 'dot_product' | 'manhattan';
/**
 * Vector store configuration
 */
interface VectorStoreConfig {
    embeddingModel: EmbeddingModel;
    embeddingDim: number;
    similarityMetric: SimilarityMetric;
    maxEntries: number;
    dbPath?: string;
}
/**
 * Document for knowledge base
 */
interface Document {
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
type DocumentType = 'text' | 'markdown' | {
    type: 'code';
    language: string;
} | 'html' | 'pdf' | 'json' | 'yaml' | 'csv' | {
    type: 'custom';
    mimeType: string;
};
/**
 * Document chunk for embedding
 */
interface DocumentChunk {
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
type ChunkingStrategy = 'fixed_size' | 'sentence' | 'paragraph' | 'semantic' | 'code';
/**
 * Chunking configuration
 */
interface ChunkingConfig {
    chunkSize: number;
    chunkOverlap: number;
    strategy: ChunkingStrategy;
}
/**
 * Context segment type
 */
type ContextSegmentType = 'system_prompt' | 'user_preferences' | 'conversation_history' | 'retrieved_context' | 'tool_results' | 'current_query' | {
    type: 'custom';
    name: string;
};
/**
 * Context segment for building prompts
 */
interface ContextSegment {
    segmentType: ContextSegmentType;
    content: string;
    tokens: number;
    priority: number;
    required: boolean;
}
/**
 * Memory manager configuration
 */
interface MemoryConfig {
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
interface MemoryStats {
    totalEntries: number;
    entriesByType: Record<string, number>;
    totalAccessCount: number;
    avgImportance: number;
    documentCount: number;
}
/**
 * RAG (Retrieval-Augmented Generation) configuration
 */
interface RAGConfig {
    enabled: boolean;
    memoryConfig: MemoryConfig;
    retrievalLimit: number;
    minRelevanceScore: number;
    includeConversationHistory: boolean;
    maxConversationTurns: number;
}
/**
 * Remote node status
 */
type NodeStatus = 'online' | 'degraded' | 'offline' | 'maintenance' | 'unknown';
/**
 * Remote task status
 */
type RemoteTaskStatus = 'queued' | 'starting' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'timed_out';
/**
 * Task priority
 */
type TaskPriority = 'low' | 'normal' | 'high' | 'critical';
/**
 * Log level
 */
type RemoteLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';
/**
 * Hardware information for a remote node
 */
interface HardwareInfo {
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
interface GpuInfo {
    name: string;
    vram: number;
    cudaVersion?: string;
}
/**
 * Remote node representing a machine running agents
 */
interface RemoteNode {
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
interface ResourceUsage {
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
interface TaskLogEntry {
    timestamp: number;
    level: RemoteLogLevel;
    message: string;
    data?: unknown;
}
/**
 * Task execution metrics
 */
interface TaskMetrics {
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
type ArtifactType = 'file' | 'directory' | 'url' | 'database' | 'model' | 'report' | 'log' | {
    type: 'custom';
    name: string;
};
/**
 * Task artifact (output files, etc.)
 */
interface TaskArtifact {
    name: string;
    artifactType: ArtifactType;
    location: string;
    size?: number;
    checksum?: string;
}
/**
 * Task result
 */
interface RemoteTaskResult {
    success: boolean;
    output?: unknown;
    artifacts: TaskArtifact[];
    metrics: TaskMetrics;
}
/**
 * Remote task running on a node
 */
interface RemoteTask {
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
interface RemoteMonitorConfig {
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
interface MonitorStats {
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
type RemoteEventType = 'node_online' | 'node_offline' | 'node_status_changed' | 'node_heartbeat' | 'task_created' | 'task_started' | 'task_progress' | 'task_step_completed' | 'task_completed' | 'task_failed' | 'task_cancelled' | 'task_log' | 'agent_registered' | 'agent_unregistered';
/**
 * Remote event
 */
interface RemoteEvent {
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
 * Agency Event type - mirrors Rust Agency EventType
 */
type AgencyEventType = 'agent_started' | 'agent_thinking' | 'agent_executing' | 'agent_completed' | 'agent_failed' | 'tool_call_started' | 'tool_call_completed' | 'tool_call_failed' | 'message_created' | 'message_delta' | 'task_created' | 'task_started' | 'task_completed' | 'task_failed' | 'swarm_started' | 'swarm_agent_joined' | 'swarm_completed' | 'swarm_failed' | 'handoff' | 'error';
/**
 * Agency Event - matches Rust Agency AgencyEvent
 */
interface AgencyEvent {
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
interface AgencyToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    timestamp: number;
}
/**
 * Tool result - matches Rust Agency ToolResult
 */
interface AgencyToolResult {
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
    toolCalls?: AgencyToolCall[];
    events: AgencyEvent[];
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
/**
 * Integration category
 */
type IntegrationCategory = 'productivity' | 'communication' | 'browser' | 'development' | 'smart_home' | 'finance' | 'health' | 'media' | 'travel' | 'shopping' | 'system';
/**
 * Authentication method for integrations
 */
type IntegrationAuthType = 'oauth2' | 'api_key' | 'bot_token' | 'local' | 'bridge' | 'extension' | 'none';
/**
 * Integration status
 */
type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'pending' | 'unknown';
/**
 * Integration configuration
 */
interface Integration {
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
interface IntegrationConfig {
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
interface IntegrationCredentials {
    accessToken?: string;
    apiKey?: string;
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
}
/**
 * Hook trigger types
 */
type HookTriggerType = 'cron' | 'interval' | 'daily' | 'weekly' | 'monthly' | 'webhook' | 'file_change' | 'email_received' | 'calendar_event' | 'git_push' | 'git_pr' | 'app_launch' | 'system_wake' | 'battery_low' | 'network_change' | 'custom';
/**
 * Hook action types
 */
type HookActionType = 'send_notification' | 'send_email' | 'send_slack' | 'send_discord' | 'send_sms' | 'run_command' | 'run_script' | 'call_api' | 'create_file' | 'move_file' | 'create_event' | 'update_event' | 'create_task' | 'complete_task' | 'control_device' | 'run_scene' | 'ask_agent' | 'summarize' | 'translate' | 'custom';
/**
 * Hook trigger configuration
 */
interface HookTrigger {
    type: HookTriggerType;
    config: Record<string, unknown>;
}
/**
 * Hook action configuration
 */
interface HookAction {
    type: HookActionType;
    integrationId?: string;
    config: Record<string, unknown>;
}
/**
 * Hook condition for conditional execution
 */
interface HookCondition {
    field: string;
    operator: 'equals' | 'contains' | 'matches' | 'gt' | 'lt' | 'gte' | 'lte' | 'exists' | 'not_exists';
    value: unknown;
    negate?: boolean;
}
/**
 * Hook configuration
 */
interface Hook {
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
interface HookExecutionResult {
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
interface HookActionResult {
    actionType: HookActionType;
    success: boolean;
    output?: unknown;
    error?: string;
    duration: number;
}
/**
 * Hook preset template
 */
interface HookPreset {
    id: string;
    name: string;
    description: string;
    category: string;
    trigger: HookTrigger;
    conditions?: HookCondition[];
    actions: HookAction[];
    requiredIntegrations: string[];
}

export type { ActionBounds, ActionCommand, ActionParameters, ActionSpace, ActionSpaceType, ActionType, AgencyEvent, AgencyEventType, AgencyToolCall, AgencyToolResult, Agent, AgentAutonomy, AgentMessage, AgentRole, AgentRun, AgentStatus, AgentTask, ApiError, ApiResponse, AppSettings, ArtifactType, AudioContent, AudioData, AudioFormat, ChatCompletionMessage, ChatCompletionRequest, ChatCompletionResponse, Checkpoint, ChunkingConfig, ChunkingStrategy, ContentPart, ContextSegment, ContextSegmentType, DayCount, DetectedProblem, Document, DocumentChunk, DocumentType, EmbeddingModel, ExecutionResult, ExportOptions, FileChange, GitCommit, GitRepository, GpuInfo, HardwareInfo, Hook, HookAction, HookActionResult, HookActionType, HookCondition, HookExecutionResult, HookPreset, HookTrigger, HookTriggerType, ImageContent, ImageData, ImageFormat, ImportResult, ImportSource, Integration, IntegrationAuthType, IntegrationCategory, IntegrationConfig, IntegrationCredentials, IntegrationStatus, JointState, ManipulatorType, McpTool, McpToolCall, McpToolResult, MemoryConfig, MemoryEntry, MemorySource, MemoryStats, MemoryType, Message, Modality, ModalityCapabilities, ModelCategory, ModelConfig, ModelProvider, MonitorStats, MultimodalMessage, MultimodalModel, NavigationCapability, NodeStatus, OrchestrationType, OrchestratorResult, PaginatedResponse, PermissionLevel, Pipeline, ProactiveAction, Provider, ProviderCount, ProviderHealth, ProviderSettings, ProviderStatus, ProviderType, RAGConfig, RemoteEvent, RemoteEventType, RemoteLogLevel, RemoteMonitorConfig, RemoteNode, RemoteTask, RemoteTaskResult, RemoteTaskStatus, ResourceUsage, RobotCapabilities, SearchResult, SensorData, SensorType, SensorValues, Session, SessionFilter, SessionWithMessages, ShareLink, ShareLinkProvider, SimilarityMetric, Statistics, StreamChunk, Swarm, SwarmAgent, SwarmStatus, SwarmWorkflow, TaskArtifact, TaskLogEntry, TaskMetrics, TaskPriority, TaskStatus, ThemeMode, TokenUsage, ToolInvocation, VectorSearchResult, VectorStoreConfig, VideoContent, VideoSource, WorkflowEdge, WorkflowNode, Workspace, WorkspaceBounds, WorkspaceFilter, WorkspaceStats };
