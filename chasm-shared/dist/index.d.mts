import { MultimodalModel, ModelCategory } from './types/index.mjs';
export { ActionBounds, ActionCommand, ActionParameters, ActionSpace, ActionSpaceType, ActionType, AgencyEvent, AgencyEventType, AgencyToolCall, AgencyToolResult, Agent, AgentAutonomy, AgentMessage, AgentRole, AgentRun, AgentStatus, AgentTask, ApiError, ApiKey, ApiKeyScope, ApiResponse, AppSettings, ArtifactType, AudioContent, AudioData, AudioFormat, AuthResponse, AuthState, ChatCompletionMessage, ChatCompletionRequest, ChatCompletionResponse, Checkpoint, ChunkingConfig, ChunkingStrategy, ContentPart, ContextSegment, ContextSegmentType, CreateApiKeyRequest, CreateApiKeyResponse, CreateSweMemoryRequest, CreateSweProjectRequest, CreateSweRuleRequest, DayCount, DetectedProblem, DeviceSession, Document, DocumentChunk, DocumentType, EmbeddingModel, ExecutionResult, ExportOptions, FileChange, GitCommit, GitRepository, GpuInfo, HardwareInfo, Hook, HookAction, HookActionResult, HookActionType, HookCondition, HookExecutionResult, HookPreset, HookTrigger, HookTriggerType, ImageContent, ImageData, ImageFormat, ImportResult, ImportSource, Integration, IntegrationAuthType, IntegrationCategory, IntegrationConfig, IntegrationCredentials, IntegrationStatus, JointState, LoginRequest, ManipulatorType, McpTool, McpToolCall, McpToolResult, MemoryConfig, MemoryEntry, MemorySource, MemoryStats, MemoryType, Message, Modality, ModalityCapabilities, ModelConfig, ModelProvider, MonitorStats, MultimodalMessage, NavigationCapability, NodeStatus, OrchestrationType, OrchestratorResult, PaginatedResponse, PasswordChangeRequest, PasswordResetRequest, PermissionLevel, Pipeline, ProactiveAction, Provider, ProviderCount, ProviderHealth, ProviderSettings, ProviderStatus, ProviderType, RAGConfig, RefreshTokenRequest, RefreshTokenResponse, RegisterRequest, RemoteEvent, RemoteEventType, RemoteLogLevel, RemoteMonitorConfig, RemoteNode, RemoteTask, RemoteTaskResult, RemoteTaskStatus, ResourceUsage, RobotCapabilities, SUBSCRIPTION_TIERS, SWE_PROJECT_TEMPLATES, SearchResult, SensorData, SensorType, SensorValues, Session, SessionFilter, SessionWithMessages, ShareLink, ShareLinkProvider, SimilarityMetric, Statistics, StreamChunk, SubscribeRequest, Subscription, SubscriptionLimits, SubscriptionPricing, SubscriptionTier, SubscriptionUsage, Swarm, SwarmAgent, SwarmStatus, SwarmWorkflow, SweBatchMemoryImport, SweContextInjection, SweContextSnapshot, SweFileChange, SweFileNode, SweGitChange, SweGitStatus, SweImportance, SweMemory, SweMemoryCategory, SweMemorySource, SweMessage, SweOperation, SweProject, SweProjectStats, SweProjectTemplate, SweRule, SweRuleCategory, SweRuleCondition, SweRuleScope, SweSearchResult, SweSession, SweSessionWithMessages, SweTerminalResult, SweTool, SweToolCall, SweToolExecutionRequest, SweToolResult, TaskArtifact, TaskLogEntry, TaskMetrics, TaskPriority, TaskStatus, ThemeMode, TokenUsage, ToolInvocation, User, UserPreferences, VectorSearchResult, VectorStoreConfig, VideoContent, VideoSource, WorkflowEdge, WorkflowNode, Workspace, WorkspaceBounds, WorkspaceFilter, WorkspaceStats } from './types/index.mjs';
export { ApiClientConfig, api, createApiClient } from './api/index.mjs';
export { capitalize, chunk, countTotalTokens, debounce, deepClone, deepMerge, delay, estimateTokenCount, extractFirstLine, extractSessionTitle, formatBytes, formatDate, formatDateISO, formatDuration, formatNumber, formatRelativeTime, formatTime, formatTokens, generateShortId, generateTimestampId, generateUUID, getDirectory, getExtension, getFileName, groupBy, hexToRgb, isColorDark, isToday, isValidJson, isValidUUID, isValidUrl, isWithinDays, normalizePath, omit, pick, retry, rgbToHex, safeJsonParse, slugify, sortBy, stripMarkdown, throttle, toTitleCase, truncate, uniqueBy } from './utils/index.mjs';

declare const PROVIDERS: {
    readonly copilot: {
        readonly id: "copilot";
        readonly name: "GitHub Copilot";
        readonly type: "cloud";
        readonly models: readonly ["gpt-4o", "gpt-4o-mini", "claude-3.5-sonnet", "o1-preview", "o1-mini"];
        readonly color: "#1f6feb";
        readonly icon: "github";
    };
    readonly openai: {
        readonly id: "openai";
        readonly name: "OpenAI";
        readonly type: "cloud";
        readonly endpoint: "https://api.openai.com/v1";
        readonly models: readonly ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "o1-preview", "o1-mini", "o3-mini"];
        readonly color: "#10a37f";
        readonly icon: "openai";
    };
    readonly anthropic: {
        readonly id: "anthropic";
        readonly name: "Anthropic";
        readonly type: "cloud";
        readonly endpoint: "https://api.anthropic.com/v1";
        readonly models: readonly ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-3-opus-latest", "claude-sonnet-4-20250514"];
        readonly color: "#d4a574";
        readonly icon: "anthropic";
    };
    readonly azure: {
        readonly id: "azure";
        readonly name: "Azure OpenAI";
        readonly type: "cloud";
        readonly models: readonly ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"];
        readonly color: "#0078d4";
        readonly icon: "azure";
    };
    readonly google: {
        readonly id: "google";
        readonly name: "Google AI";
        readonly type: "cloud";
        readonly endpoint: "https://generativelanguage.googleapis.com/v1";
        readonly models: readonly ["gemini-2.0-flash-exp", "gemini-2.5-flash", "gemini-1.5-pro", "gemini-1.5-flash"];
        readonly color: "#4285f4";
        readonly icon: "google";
    };
    readonly groq: {
        readonly id: "groq";
        readonly name: "Groq";
        readonly type: "cloud";
        readonly endpoint: "https://api.groq.com/openai/v1";
        readonly models: readonly ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"];
        readonly color: "#f55036";
        readonly icon: "groq";
    };
    readonly together: {
        readonly id: "together";
        readonly name: "Together AI";
        readonly type: "cloud";
        readonly endpoint: "https://api.together.xyz/v1";
        readonly models: readonly ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "Qwen/Qwen2.5-Coder-32B-Instruct", "deepseek-ai/DeepSeek-R1"];
        readonly color: "#0ea5e9";
        readonly icon: "together";
    };
    readonly fireworks: {
        readonly id: "fireworks";
        readonly name: "Fireworks AI";
        readonly type: "cloud";
        readonly endpoint: "https://api.fireworks.ai/inference/v1";
        readonly models: readonly ["accounts/fireworks/models/llama-v3p3-70b-instruct", "accounts/fireworks/models/qwen2p5-coder-32b-instruct"];
        readonly color: "#ff6b35";
        readonly icon: "fireworks";
    };
    readonly deepseek: {
        readonly id: "deepseek";
        readonly name: "DeepSeek";
        readonly type: "cloud";
        readonly endpoint: "https://api.deepseek.com/v1";
        readonly models: readonly ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"];
        readonly color: "#4f46e5";
        readonly icon: "deepseek";
    };
    readonly mistral: {
        readonly id: "mistral";
        readonly name: "Mistral AI";
        readonly type: "cloud";
        readonly endpoint: "https://api.mistral.ai/v1";
        readonly models: readonly ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest", "codestral-latest"];
        readonly color: "#ff7000";
        readonly icon: "mistral";
    };
    readonly cohere: {
        readonly id: "cohere";
        readonly name: "Cohere";
        readonly type: "cloud";
        readonly endpoint: "https://api.cohere.ai/v1";
        readonly models: readonly ["command-r-plus", "command-r", "command-light"];
        readonly color: "#39594d";
        readonly icon: "cohere";
    };
    readonly perplexity: {
        readonly id: "perplexity";
        readonly name: "Perplexity";
        readonly type: "cloud";
        readonly endpoint: "https://api.perplexity.ai";
        readonly models: readonly ["llama-3.1-sonar-large-128k-online", "llama-3.1-sonar-small-128k-online"];
        readonly color: "#20b2aa";
        readonly icon: "perplexity";
    };
    readonly ollama: {
        readonly id: "ollama";
        readonly name: "Ollama";
        readonly type: "local";
        readonly endpoint: "http://localhost:11434";
        readonly models: readonly ["llama3.2", "llama3.1", "codellama", "mistral", "mixtral", "qwen2.5-coder", "deepseek-coder-v2", "phi3"];
        readonly color: "#ffffff";
        readonly icon: "ollama";
    };
    readonly lmstudio: {
        readonly id: "lmstudio";
        readonly name: "LM Studio";
        readonly type: "local";
        readonly endpoint: "http://localhost:1234/v1";
        readonly models: readonly [];
        readonly color: "#6366f1";
        readonly icon: "lmstudio";
    };
    readonly jan: {
        readonly id: "jan";
        readonly name: "Jan";
        readonly type: "local";
        readonly endpoint: "http://localhost:1337/v1";
        readonly models: readonly [];
        readonly color: "#2563eb";
        readonly icon: "jan";
    };
    readonly gpt4all: {
        readonly id: "gpt4all";
        readonly name: "GPT4All";
        readonly type: "local";
        readonly endpoint: "http://localhost:4891/v1";
        readonly models: readonly [];
        readonly color: "#22c55e";
        readonly icon: "gpt4all";
    };
    readonly localai: {
        readonly id: "localai";
        readonly name: "LocalAI";
        readonly type: "local";
        readonly endpoint: "http://localhost:8080/v1";
        readonly models: readonly [];
        readonly color: "#14b8a6";
        readonly icon: "localai";
    };
    readonly llamafile: {
        readonly id: "llamafile";
        readonly name: "llamafile";
        readonly type: "local";
        readonly endpoint: "http://localhost:8080/v1";
        readonly models: readonly [];
        readonly color: "#f97316";
        readonly icon: "llamafile";
    };
    readonly textgenwebui: {
        readonly id: "textgenwebui";
        readonly name: "Text Gen WebUI";
        readonly type: "local";
        readonly endpoint: "http://localhost:5000/v1";
        readonly models: readonly [];
        readonly color: "#a855f7";
        readonly icon: "textgenwebui";
    };
    readonly vllm: {
        readonly id: "vllm";
        readonly name: "vLLM";
        readonly type: "local";
        readonly endpoint: "http://localhost:8000/v1";
        readonly models: readonly [];
        readonly color: "#3b82f6";
        readonly icon: "vllm";
    };
    readonly koboldcpp: {
        readonly id: "koboldcpp";
        readonly name: "KoboldCpp";
        readonly type: "local";
        readonly endpoint: "http://localhost:5001/v1";
        readonly models: readonly [];
        readonly color: "#eab308";
        readonly icon: "koboldcpp";
    };
    readonly tabbyml: {
        readonly id: "tabbyml";
        readonly name: "Tabby";
        readonly type: "local";
        readonly endpoint: "http://localhost:8080/v1";
        readonly models: readonly [];
        readonly color: "#ec4899";
        readonly icon: "tabbyml";
    };
    readonly exo: {
        readonly id: "exo";
        readonly name: "Exo";
        readonly type: "local";
        readonly endpoint: "http://localhost:52415/v1";
        readonly models: readonly [];
        readonly color: "#8b5cf6";
        readonly icon: "exo";
    };
};
type ProviderId = keyof typeof PROVIDERS;

/**
 * Vision-Language Models that support image understanding
 */
declare const VLM_MODELS: MultimodalModel[];
/**
 * Vision-Language-Action Models for robotics and embodied AI
 */
declare const VLA_MODELS: MultimodalModel[];
/**
 * All multimodal models (VLM + VLA)
 */
declare const MULTIMODAL_MODELS: MultimodalModel[];
/**
 * Model categories with descriptions
 */
declare const MODEL_CATEGORIES: Record<ModelCategory, {
    name: string;
    description: string;
    icon: string;
}>;
/**
 * Helper function to get models by category
 */
declare function getModelsByCategory(category: ModelCategory): MultimodalModel[];
/**
 * Helper function to get VLM-capable models
 */
declare function getVLMModels(): MultimodalModel[];
/**
 * Helper function to get VLA-capable models
 */
declare function getVLAModels(): MultimodalModel[];
declare const AGENT_ROLES: {
    readonly coordinator: {
        readonly id: "coordinator";
        readonly name: "Coordinator";
        readonly description: "Orchestrates tasks and manages other agents";
        readonly icon: "🎯";
        readonly color: "#3b82f6";
        readonly capabilities: readonly ["planning", "delegation", "synthesis", "monitoring"];
    };
    readonly researcher: {
        readonly id: "researcher";
        readonly name: "Researcher";
        readonly description: "Gathers information and analyzes data";
        readonly icon: "🔍";
        readonly color: "#10b981";
        readonly capabilities: readonly ["search", "analysis", "synthesis", "fact_checking"];
    };
    readonly coder: {
        readonly id: "coder";
        readonly name: "Coder";
        readonly description: "Writes, reviews, and debugs code";
        readonly icon: "💻";
        readonly color: "#f59e0b";
        readonly capabilities: readonly ["code_generation", "code_review", "debugging", "refactoring"];
    };
    readonly reviewer: {
        readonly id: "reviewer";
        readonly name: "Reviewer";
        readonly description: "Reviews code and provides feedback";
        readonly icon: "✅";
        readonly color: "#8b5cf6";
        readonly capabilities: readonly ["code_review", "quality_assurance", "feedback", "validation"];
    };
    readonly executor: {
        readonly id: "executor";
        readonly name: "Executor";
        readonly description: "Executes tools and commands";
        readonly icon: "⚡";
        readonly color: "#ef4444";
        readonly capabilities: readonly ["tool_use", "command_execution", "automation", "api_calls"];
    };
    readonly writer: {
        readonly id: "writer";
        readonly name: "Writer";
        readonly description: "Creates and edits documentation";
        readonly icon: "✍️";
        readonly color: "#ec4899";
        readonly capabilities: readonly ["documentation", "content_creation", "editing", "summarization"];
    };
    readonly tester: {
        readonly id: "tester";
        readonly name: "Tester";
        readonly description: "Creates and runs tests";
        readonly icon: "🧪";
        readonly color: "#06b6d4";
        readonly capabilities: readonly ["test_generation", "test_execution", "bug_finding", "coverage_analysis"];
    };
    readonly household: {
        readonly id: "household";
        readonly name: "Household Agent";
        readonly description: "Proactively monitors and solves household problems with permission";
        readonly icon: "🏠";
        readonly color: "#14b8a6";
        readonly capabilities: readonly ["smart_home_monitoring", "energy_optimization", "maintenance_scheduling", "grocery_management", "bill_tracking", "appliance_monitoring", "security_alerts", "package_tracking", "cleaning_scheduling", "meal_planning"];
    };
    readonly business: {
        readonly id: "business";
        readonly name: "Business Agent";
        readonly description: "Proactively monitors and solves work/business problems with permission";
        readonly icon: "💼";
        readonly color: "#8b5cf6";
        readonly capabilities: readonly ["calendar_optimization", "email_triage", "meeting_prep", "deadline_tracking", "expense_management", "report_generation", "competitor_monitoring", "lead_tracking", "project_health", "team_coordination"];
    };
    readonly custom: {
        readonly id: "custom";
        readonly name: "Custom";
        readonly description: "Custom agent with user-defined capabilities";
        readonly icon: "🔧";
        readonly color: "#6b7280";
        readonly capabilities: readonly [];
    };
};
type AgentRoleId = keyof typeof AGENT_ROLES;
declare const ORCHESTRATION_MODES: {
    readonly single: {
        readonly id: "single";
        readonly name: "Single Agent";
        readonly description: "Traditional single-agent response";
        readonly icon: "👤";
    };
    readonly sequential: {
        readonly id: "sequential";
        readonly name: "Sequential";
        readonly description: "Agents execute one after another, passing results forward";
        readonly icon: "➡️";
    };
    readonly parallel: {
        readonly id: "parallel";
        readonly name: "Parallel";
        readonly description: "Multiple agents work simultaneously on subtasks";
        readonly icon: "⚡";
    };
    readonly loop: {
        readonly id: "loop";
        readonly name: "Loop";
        readonly description: "Agent repeats until a condition is met";
        readonly icon: "🔁";
    };
    readonly hierarchical: {
        readonly id: "hierarchical";
        readonly name: "Hierarchical";
        readonly description: "Lead agent delegates to specialized sub-agents";
        readonly icon: "🏛️";
    };
    readonly swarm: {
        readonly id: "swarm";
        readonly name: "Swarm";
        readonly description: "Multiple agents collaborate with a coordinator";
        readonly icon: "🐝";
    };
    readonly debate: {
        readonly id: "debate";
        readonly name: "Debate";
        readonly description: "Agents debate to reach the best solution";
        readonly icon: "💬";
    };
};
type OrchestrationModeId = keyof typeof ORCHESTRATION_MODES;
declare const TOOL_CATEGORIES: {
    readonly code: {
        readonly id: "code";
        readonly name: "Code";
        readonly description: "Code execution and development tools";
        readonly icon: "💻";
    };
    readonly search: {
        readonly id: "search";
        readonly name: "Search";
        readonly description: "Search and retrieval tools";
        readonly icon: "🔍";
    };
    readonly file: {
        readonly id: "file";
        readonly name: "File";
        readonly description: "File system operations";
        readonly icon: "📁";
    };
    readonly web: {
        readonly id: "web";
        readonly name: "Web";
        readonly description: "Web browsing and fetching";
        readonly icon: "🌐";
    };
    readonly analysis: {
        readonly id: "analysis";
        readonly name: "Analysis";
        readonly description: "Code analysis and linting";
        readonly icon: "📊";
    };
    readonly git: {
        readonly id: "git";
        readonly name: "Git";
        readonly description: "Version control operations";
        readonly icon: "📦";
    };
    readonly database: {
        readonly id: "database";
        readonly name: "Database";
        readonly description: "Database operations";
        readonly icon: "🗃️";
    };
    readonly custom: {
        readonly id: "custom";
        readonly name: "Custom";
        readonly description: "Custom tools";
        readonly icon: "🔧";
    };
};
type ToolCategoryId = keyof typeof TOOL_CATEGORIES;
declare const AGENT_STATUSES: readonly ["idle", "thinking", "executing", "waiting", "completed", "failed", "paused"];
type AgentStatusType = (typeof AGENT_STATUSES)[number];
declare const TASK_STATUSES: readonly ["pending", "in_progress", "completed", "failed", "cancelled"];
type TaskStatusType = (typeof TASK_STATUSES)[number];
declare const SWARM_STATUSES: readonly ["idle", "running", "paused", "completed", "failed"];
type SwarmStatusType = (typeof SWARM_STATUSES)[number];
declare const PROVIDER_STATUSES: readonly ["connected", "disconnected", "error", "unknown"];
type ProviderStatusType = (typeof PROVIDER_STATUSES)[number];
declare const EXPORT_FORMATS: readonly ["json", "markdown", "html", "csv", "pdf"];
type ExportFormatType = (typeof EXPORT_FORMATS)[number];
declare const API_CONFIG: {
    readonly defaultBaseUrl: "http://localhost:3000";
    readonly defaultTimeout: 30000;
    readonly version: "v1";
};
declare const API_ENDPOINTS: {
    readonly health: "/api/health";
    readonly stats: "/api/v1/stats";
    readonly workspaces: "/api/v1/workspaces";
    readonly sessions: "/api/v1/sessions";
    readonly messages: "/api/v1/messages";
    readonly providers: "/api/v1/providers";
    readonly agents: "/api/v1/agents";
    readonly swarms: "/api/v1/swarms";
    readonly runs: "/api/v1/runs";
    readonly chat: "/api/v1/chat";
    readonly search: "/api/v1/search";
    readonly mcp: "/api/v1/mcp";
    readonly export: "/api/v1/export";
    readonly import: "/api/v1/import";
};
declare const SESSION_FORMAT: {
    readonly version: 3;
    readonly maxMessages: 1000;
    readonly maxTitleLength: 200;
    readonly maxContentLength: 100000;
};
declare const LIMITS: {
    readonly maxMessageLength: 100000;
    readonly maxSessionMessages: 1000;
    readonly maxSessionTitleLength: 200;
    readonly maxAgentsPerSwarm: 10;
    readonly maxIterations: 50;
    readonly maxConcurrentAgents: 5;
    readonly maxToolCalls: 100;
    readonly maxFileSize: number;
};
declare const DEFAULT_AGENT_CONFIG: {
    temperature: number;
    maxTokens: number;
    autonomy: "medium";
    maxIterations: number;
};
declare const DEFAULT_AGENTS: readonly [{
    readonly name: "assistant";
    readonly role: "custom";
    readonly description: "General-purpose AI assistant with planning and reflection";
    readonly instruction: "You are a helpful assistant that provides clear, accurate, and concise responses.";
    readonly model: "gpt-4o";
    readonly tools: readonly [];
    readonly temperature: 0.7;
    readonly autonomy: "medium";
    readonly maxIterations: 10;
}, {
    readonly name: "coder";
    readonly role: "coder";
    readonly description: "Expert software developer with autonomous coding capabilities";
    readonly instruction: "You are an expert software developer. Plan your approach, write clean code, and test it.";
    readonly model: "gpt-4o";
    readonly tools: readonly ["read_file", "create_file", "replace_string_in_file", "run_in_terminal", "get_errors"];
    readonly temperature: 0.3;
    readonly autonomy: "high";
    readonly maxIterations: 15;
}, {
    readonly name: "researcher";
    readonly role: "researcher";
    readonly description: "Research specialist with deep analysis capabilities";
    readonly instruction: "You are a research specialist. Analyze thoroughly and provide balanced perspectives.";
    readonly model: "gpt-4o";
    readonly tools: readonly ["semantic_search", "fetch_webpage", "read_file"];
    readonly temperature: 0.5;
    readonly autonomy: "high";
    readonly maxIterations: 12;
}, {
    readonly name: "reviewer";
    readonly role: "reviewer";
    readonly description: "Code review expert with detailed analysis";
    readonly instruction: "You are a senior code reviewer. Review for correctness, security, and best practices.";
    readonly model: "gpt-4o";
    readonly tools: readonly ["read_file", "grep_search", "get_errors"];
    readonly temperature: 0.3;
    readonly autonomy: "medium";
    readonly maxIterations: 8;
}, {
    readonly name: "coordinator";
    readonly role: "coordinator";
    readonly description: "Multi-agent coordinator for complex tasks";
    readonly instruction: "You are a coordinator that orchestrates multiple agents. Plan, delegate, and synthesize.";
    readonly model: "gpt-4o";
    readonly tools: readonly ["semantic_search"];
    readonly temperature: 0.4;
    readonly autonomy: "high";
    readonly maxIterations: 20;
}, {
    readonly name: "household";
    readonly role: "household";
    readonly description: "Proactive household management agent that monitors your home and solves problems";
    readonly instruction: "You are a proactive Household Agent that helps users manage their home life efficiently.\n\nYour responsibilities:\n1. MONITOR: Continuously scan for household issues (bills due, maintenance needed, supplies running low)\n2. DETECT: Identify problems before they become urgent\n3. PROPOSE: Suggest solutions with clear cost/benefit analysis\n4. EXECUTE: Take action ONLY after explicit user permission\n\nProactive behaviors:\n- Track recurring bills and alert before due dates\n- Monitor smart home devices for anomalies (energy spikes, device offline)\n- Manage grocery lists based on consumption patterns\n- Schedule maintenance reminders (HVAC filters, car service, etc.)\n- Track package deliveries and alert on delays\n- Optimize energy usage based on utility rates and patterns\n- Coordinate cleaning and household tasks\n- Manage home security alerts\n\nPERMISSION PROTOCOL:\n- Always explain what you detected and why action is needed\n- Present options ranked by recommendation\n- Wait for explicit \"approved\", \"yes\", or \"do it\" before taking action\n- For financial actions, always require confirmation\n- Log all actions taken for transparency";
    readonly model: "gpt-4o";
    readonly tools: readonly ["smart_home_control", "calendar_create", "send_notification", "grocery_add", "bill_pay", "package_track", "energy_monitor", "maintenance_schedule"];
    readonly temperature: 0.4;
    readonly autonomy: "supervised";
    readonly maxIterations: 15;
}, {
    readonly name: "business";
    readonly role: "business";
    readonly description: "Proactive business agent that monitors work and solves professional problems";
    readonly instruction: "You are a proactive Business Agent that helps users excel in their professional life.\n\nYour responsibilities:\n1. MONITOR: Scan calendars, emails, projects, and deadlines continuously\n2. DETECT: Identify risks, conflicts, and opportunities early\n3. PROPOSE: Suggest optimizations with clear reasoning\n4. EXECUTE: Take action ONLY after explicit user permission\n\nProactive behaviors:\n- Analyze calendar for conflicts, back-to-back meetings, prep time gaps\n- Triage incoming emails by urgency and required action\n- Prepare briefing docs before important meetings\n- Track project deadlines and flag risks early\n- Monitor expense reports and flag anomalies\n- Generate weekly/monthly reports automatically\n- Track competitor news and industry trends\n- Follow up on pending responses and action items\n- Optimize meeting schedules for focus time\n- Coordinate with team members on shared goals\n\nPERMISSION PROTOCOL:\n- Always explain what you detected and the business impact\n- Present options with pros/cons\n- Wait for explicit approval before:\n  - Sending any communication\n  - Scheduling or rescheduling meetings\n  - Making financial decisions\n  - Sharing information externally\n- Maintain confidentiality of all business data\n- Log all actions for audit trail";
    readonly model: "gpt-4o";
    readonly tools: readonly ["calendar_read", "calendar_create", "email_read", "email_draft", "slack_send", "document_create", "expense_submit", "project_track", "web_search", "competitor_monitor"];
    readonly temperature: 0.3;
    readonly autonomy: "supervised";
    readonly maxIterations: 20;
}];
declare const SWARM_TEMPLATES: readonly [{
    readonly name: "Research Team";
    readonly description: "A team focused on research and analysis tasks";
    readonly roles: readonly ["coordinator", "researcher", "researcher", "reviewer"];
}, {
    readonly name: "Development Team";
    readonly description: "A team for software development tasks";
    readonly roles: readonly ["coordinator", "coder", "reviewer", "tester"];
}, {
    readonly name: "Documentation Team";
    readonly description: "A team for creating and reviewing documentation";
    readonly roles: readonly ["coordinator", "writer", "reviewer"];
}, {
    readonly name: "Code Review Team";
    readonly description: "A team for thorough code reviews";
    readonly roles: readonly ["coordinator", "reviewer", "reviewer", "tester"];
}, {
    readonly name: "Life Management Team";
    readonly description: "Proactive agents for managing household and business tasks";
    readonly roles: readonly ["coordinator", "household", "business"];
}, {
    readonly name: "Home Automation Team";
    readonly description: "Smart home monitoring and optimization";
    readonly roles: readonly ["household", "executor"];
}, {
    readonly name: "Executive Assistant Team";
    readonly description: "Full business support with research and coordination";
    readonly roles: readonly ["business", "researcher", "writer", "coordinator"];
}];
declare const PROACTIVE_AGENT_CONFIG: {
    /** Permission levels for proactive actions */
    readonly permissionLevels: {
        readonly notify_only: {
            readonly id: "notify_only";
            readonly name: "Notify Only";
            readonly description: "Agent can only send notifications, no actions taken";
            readonly autoApprove: readonly [];
        };
        readonly low_risk: {
            readonly id: "low_risk";
            readonly name: "Low Risk Auto-Approve";
            readonly description: "Auto-approve notifications, reminders, and info gathering";
            readonly autoApprove: readonly ["send_notification", "calendar_read", "email_read", "web_search", "package_track"];
        };
        readonly medium_risk: {
            readonly id: "medium_risk";
            readonly name: "Medium Risk Auto-Approve";
            readonly description: "Also auto-approve scheduling and drafts (no sending)";
            readonly autoApprove: readonly ["send_notification", "calendar_read", "calendar_create", "email_read", "email_draft", "document_create", "web_search", "package_track"];
        };
        readonly high_autonomy: {
            readonly id: "high_autonomy";
            readonly name: "High Autonomy";
            readonly description: "Auto-approve most actions except financial and external communication";
            readonly autoApprove: readonly ["*"];
            readonly requireApproval: readonly ["bill_pay", "email_send", "slack_send", "expense_submit", "purchase"];
        };
    };
    /** Scanning intervals for proactive monitoring */
    readonly scanIntervals: {
        readonly realtime: {
            readonly id: "realtime";
            readonly name: "Real-time";
            readonly intervalMs: 0;
            readonly description: "Event-driven, instant response";
        };
        readonly frequent: {
            readonly id: "frequent";
            readonly name: "Every 5 minutes";
            readonly intervalMs: number;
            readonly description: "High priority items";
        };
        readonly regular: {
            readonly id: "regular";
            readonly name: "Every 30 minutes";
            readonly intervalMs: number;
            readonly description: "Standard monitoring";
        };
        readonly hourly: {
            readonly id: "hourly";
            readonly name: "Hourly";
            readonly intervalMs: number;
            readonly description: "Low priority background tasks";
        };
        readonly daily: {
            readonly id: "daily";
            readonly name: "Daily";
            readonly intervalMs: number;
            readonly description: "Daily digest and reports";
        };
    };
    /** Problem categories that agents can detect */
    readonly problemCategories: {
        readonly household: readonly ["bill_due", "maintenance_needed", "supply_low", "energy_anomaly", "device_offline", "security_alert", "package_delayed", "appointment_reminder", "weather_alert", "subscription_renewal"];
        readonly business: readonly ["calendar_conflict", "deadline_approaching", "email_urgent", "meeting_prep_needed", "follow_up_due", "expense_pending", "project_at_risk", "competitor_news", "team_blocker", "report_due"];
    };
};
declare const MEMORY_CONFIG: {
    /** Available embedding models */
    readonly embeddingModels: {
        readonly minilm: {
            readonly id: "minilm";
            readonly name: "MiniLM-L6-v2";
            readonly dimension: 384;
            readonly provider: "local";
            readonly description: "Fast local embeddings, good for most use cases";
        };
        readonly mpnet: {
            readonly id: "mpnet";
            readonly name: "MPNet Base v2";
            readonly dimension: 768;
            readonly provider: "local";
            readonly description: "Higher quality local embeddings";
        };
        readonly openaiSmall: {
            readonly id: "openai_small";
            readonly name: "OpenAI text-embedding-3-small";
            readonly dimension: 1536;
            readonly provider: "openai";
            readonly description: "Balanced cloud embeddings, good quality/cost ratio";
        };
        readonly openaiLarge: {
            readonly id: "openai_large";
            readonly name: "OpenAI text-embedding-3-large";
            readonly dimension: 3072;
            readonly provider: "openai";
            readonly description: "Highest quality OpenAI embeddings";
        };
        readonly cohere: {
            readonly id: "cohere";
            readonly name: "Cohere embed-english-v3.0";
            readonly dimension: 1024;
            readonly provider: "cohere";
            readonly description: "Cohere multilingual embeddings";
        };
        readonly googleGecko: {
            readonly id: "google_gecko";
            readonly name: "Google text-embedding-004";
            readonly dimension: 768;
            readonly provider: "google";
            readonly description: "Google Vertex AI embeddings";
        };
        readonly voyage: {
            readonly id: "voyage";
            readonly name: "Voyage AI voyage-2";
            readonly dimension: 1024;
            readonly provider: "voyage";
            readonly description: "High quality embeddings for code and text";
        };
    };
    /** Memory types with descriptions */
    readonly memoryTypes: {
        readonly short_term: {
            readonly id: "short_term";
            readonly name: "Short-term Memory";
            readonly description: "Current conversation context, cleared after session";
            readonly ttlMinutes: 60;
        };
        readonly long_term: {
            readonly id: "long_term";
            readonly name: "Long-term Memory";
            readonly description: "Persistent facts, preferences, and learned information";
            readonly ttlMinutes: null;
        };
        readonly episodic: {
            readonly id: "episodic";
            readonly name: "Episodic Memory";
            readonly description: "Specific events and experiences with timestamps";
            readonly ttlMinutes: null;
        };
        readonly semantic: {
            readonly id: "semantic";
            readonly name: "Semantic Memory";
            readonly description: "Concepts, relationships, and general knowledge";
            readonly ttlMinutes: null;
        };
        readonly procedural: {
            readonly id: "procedural";
            readonly name: "Procedural Memory";
            readonly description: "How to do things, workflows, and processes";
            readonly ttlMinutes: null;
        };
        readonly preference: {
            readonly id: "preference";
            readonly name: "User Preferences";
            readonly description: "User settings, likes, dislikes, and habits";
            readonly ttlMinutes: null;
        };
        readonly cache: {
            readonly id: "cache";
            readonly name: "Computation Cache";
            readonly description: "Cached results for expensive operations";
            readonly ttlMinutes: 30;
        };
    };
    /** Chunking strategies for documents */
    readonly chunkingStrategies: {
        readonly fixed_size: {
            readonly id: "fixed_size";
            readonly name: "Fixed Size";
            readonly description: "Split into fixed character chunks";
            readonly defaultSize: 1000;
        };
        readonly sentence: {
            readonly id: "sentence";
            readonly name: "Sentence";
            readonly description: "Split on sentence boundaries";
            readonly defaultSize: 512;
        };
        readonly paragraph: {
            readonly id: "paragraph";
            readonly name: "Paragraph";
            readonly description: "Split on paragraph boundaries";
            readonly defaultSize: 512;
        };
        readonly semantic: {
            readonly id: "semantic";
            readonly name: "Semantic";
            readonly description: "Intelligent splitting respecting content structure";
            readonly defaultSize: 512;
        };
        readonly code: {
            readonly id: "code";
            readonly name: "Code-aware";
            readonly description: "Split on function/class boundaries";
            readonly defaultSize: 1024;
        };
    };
    /** Default configurations */
    readonly defaults: {
        readonly embeddingModel: "minilm";
        readonly chunkSize: 512;
        readonly chunkOverlap: 50;
        readonly chunkingStrategy: "semantic";
        readonly contextWindowTokens: 8192;
        readonly cacheSize: 1000;
        readonly maxVectorStoreEntries: 100000;
        readonly retrievalLimit: 5;
        readonly minRelevanceScore: 0.7;
        readonly autoSummarize: true;
        readonly summarizeThreshold: 20;
    };
    /** Similarity metrics */
    readonly similarityMetrics: {
        readonly cosine: {
            readonly id: "cosine";
            readonly name: "Cosine Similarity";
            readonly description: "Default, works well for most cases";
        };
        readonly euclidean: {
            readonly id: "euclidean";
            readonly name: "Euclidean Distance";
            readonly description: "L2 distance converted to similarity";
        };
        readonly dot_product: {
            readonly id: "dot_product";
            readonly name: "Dot Product";
            readonly description: "Fast, requires normalized vectors";
        };
        readonly manhattan: {
            readonly id: "manhattan";
            readonly name: "Manhattan Distance";
            readonly description: "L1 distance converted to similarity";
        };
    };
    /** RAG presets */
    readonly ragPresets: {
        readonly minimal: {
            readonly id: "minimal";
            readonly name: "Minimal RAG";
            readonly description: "Light memory usage, good for simple assistants";
            readonly config: {
                readonly embeddingModel: "minilm";
                readonly contextWindowTokens: 4096;
                readonly retrievalLimit: 3;
                readonly autoSummarize: false;
            };
        };
        readonly balanced: {
            readonly id: "balanced";
            readonly name: "Balanced RAG";
            readonly description: "Good balance of quality and performance";
            readonly config: {
                readonly embeddingModel: "minilm";
                readonly contextWindowTokens: 8192;
                readonly retrievalLimit: 5;
                readonly autoSummarize: true;
            };
        };
        readonly comprehensive: {
            readonly id: "comprehensive";
            readonly name: "Comprehensive RAG";
            readonly description: "Full memory capabilities for power users";
            readonly config: {
                readonly embeddingModel: "openai_small";
                readonly contextWindowTokens: 16384;
                readonly retrievalLimit: 10;
                readonly autoSummarize: true;
            };
        };
        readonly code_focused: {
            readonly id: "code_focused";
            readonly name: "Code-focused RAG";
            readonly description: "Optimized for code documentation and retrieval";
            readonly config: {
                readonly embeddingModel: "voyage";
                readonly contextWindowTokens: 8192;
                readonly retrievalLimit: 8;
                readonly chunkingStrategy: "code";
                readonly autoSummarize: false;
            };
        };
    };
};
declare const REMOTE_MONITOR_CONFIG: {
    /** Node status types */
    readonly nodeStatuses: {
        readonly online: {
            readonly id: "online";
            readonly name: "Online";
            readonly color: "#22c55e";
            readonly description: "Node is healthy and responding";
        };
        readonly degraded: {
            readonly id: "degraded";
            readonly name: "Degraded";
            readonly color: "#f59e0b";
            readonly description: "Node is online but experiencing issues";
        };
        readonly offline: {
            readonly id: "offline";
            readonly name: "Offline";
            readonly color: "#ef4444";
            readonly description: "Node is unreachable";
        };
        readonly maintenance: {
            readonly id: "maintenance";
            readonly name: "Maintenance";
            readonly color: "#3b82f6";
            readonly description: "Node is in maintenance mode";
        };
        readonly unknown: {
            readonly id: "unknown";
            readonly name: "Unknown";
            readonly color: "#6b7280";
            readonly description: "Node status is unknown";
        };
    };
    /** Task status types */
    readonly taskStatuses: {
        readonly queued: {
            readonly id: "queued";
            readonly name: "Queued";
            readonly color: "#6b7280";
            readonly description: "Task is waiting to start";
        };
        readonly starting: {
            readonly id: "starting";
            readonly name: "Starting";
            readonly color: "#8b5cf6";
            readonly description: "Task is initializing";
        };
        readonly running: {
            readonly id: "running";
            readonly name: "Running";
            readonly color: "#3b82f6";
            readonly description: "Task is actively executing";
        };
        readonly paused: {
            readonly id: "paused";
            readonly name: "Paused";
            readonly color: "#f59e0b";
            readonly description: "Task is paused";
        };
        readonly completed: {
            readonly id: "completed";
            readonly name: "Completed";
            readonly color: "#22c55e";
            readonly description: "Task finished successfully";
        };
        readonly failed: {
            readonly id: "failed";
            readonly name: "Failed";
            readonly color: "#ef4444";
            readonly description: "Task failed with error";
        };
        readonly cancelled: {
            readonly id: "cancelled";
            readonly name: "Cancelled";
            readonly color: "#6b7280";
            readonly description: "Task was cancelled";
        };
        readonly timed_out: {
            readonly id: "timed_out";
            readonly name: "Timed Out";
            readonly color: "#ef4444";
            readonly description: "Task exceeded time limit";
        };
    };
    /** Task priority levels */
    readonly taskPriorities: {
        readonly low: {
            readonly id: "low";
            readonly name: "Low";
            readonly value: 0;
            readonly color: "#6b7280";
        };
        readonly normal: {
            readonly id: "normal";
            readonly name: "Normal";
            readonly value: 1;
            readonly color: "#3b82f6";
        };
        readonly high: {
            readonly id: "high";
            readonly name: "High";
            readonly value: 2;
            readonly color: "#f59e0b";
        };
        readonly critical: {
            readonly id: "critical";
            readonly name: "Critical";
            readonly value: 3;
            readonly color: "#ef4444";
        };
    };
    /** Log levels */
    readonly logLevels: {
        readonly trace: {
            readonly id: "trace";
            readonly name: "Trace";
            readonly color: "#6b7280";
        };
        readonly debug: {
            readonly id: "debug";
            readonly name: "Debug";
            readonly color: "#8b5cf6";
        };
        readonly info: {
            readonly id: "info";
            readonly name: "Info";
            readonly color: "#3b82f6";
        };
        readonly warn: {
            readonly id: "warn";
            readonly name: "Warning";
            readonly color: "#f59e0b";
        };
        readonly error: {
            readonly id: "error";
            readonly name: "Error";
            readonly color: "#ef4444";
        };
    };
    /** Remote event types */
    readonly eventTypes: {
        readonly node_online: {
            readonly id: "node_online";
            readonly name: "Node Online";
            readonly icon: "server";
        };
        readonly node_offline: {
            readonly id: "node_offline";
            readonly name: "Node Offline";
            readonly icon: "server-off";
        };
        readonly node_status_changed: {
            readonly id: "node_status_changed";
            readonly name: "Node Status Changed";
            readonly icon: "activity";
        };
        readonly node_heartbeat: {
            readonly id: "node_heartbeat";
            readonly name: "Node Heartbeat";
            readonly icon: "heart-pulse";
        };
        readonly task_created: {
            readonly id: "task_created";
            readonly name: "Task Created";
            readonly icon: "plus-circle";
        };
        readonly task_started: {
            readonly id: "task_started";
            readonly name: "Task Started";
            readonly icon: "play";
        };
        readonly task_progress: {
            readonly id: "task_progress";
            readonly name: "Task Progress";
            readonly icon: "loader";
        };
        readonly task_step_completed: {
            readonly id: "task_step_completed";
            readonly name: "Step Completed";
            readonly icon: "check-circle";
        };
        readonly task_completed: {
            readonly id: "task_completed";
            readonly name: "Task Completed";
            readonly icon: "check-circle-2";
        };
        readonly task_failed: {
            readonly id: "task_failed";
            readonly name: "Task Failed";
            readonly icon: "x-circle";
        };
        readonly task_cancelled: {
            readonly id: "task_cancelled";
            readonly name: "Task Cancelled";
            readonly icon: "slash";
        };
        readonly task_log: {
            readonly id: "task_log";
            readonly name: "Task Log";
            readonly icon: "file-text";
        };
        readonly agent_registered: {
            readonly id: "agent_registered";
            readonly name: "Agent Registered";
            readonly icon: "user-plus";
        };
        readonly agent_unregistered: {
            readonly id: "agent_unregistered";
            readonly name: "Agent Unregistered";
            readonly icon: "user-minus";
        };
    };
    /** Default configuration */
    readonly defaults: {
        readonly bindAddress: "0.0.0.0";
        readonly port: 9876;
        readonly tlsEnabled: false;
        readonly heartbeatIntervalSecs: 30;
        readonly nodeTimeoutSecs: 90;
        readonly maxLogEntries: 1000;
        readonly metricsEnabled: true;
    };
    /** Artifact types */
    readonly artifactTypes: {
        readonly file: {
            readonly id: "file";
            readonly name: "File";
            readonly icon: "file";
        };
        readonly directory: {
            readonly id: "directory";
            readonly name: "Directory";
            readonly icon: "folder";
        };
        readonly url: {
            readonly id: "url";
            readonly name: "URL";
            readonly icon: "link";
        };
        readonly database: {
            readonly id: "database";
            readonly name: "Database";
            readonly icon: "database";
        };
        readonly model: {
            readonly id: "model";
            readonly name: "Model";
            readonly icon: "brain";
        };
        readonly report: {
            readonly id: "report";
            readonly name: "Report";
            readonly icon: "file-chart";
        };
        readonly log: {
            readonly id: "log";
            readonly name: "Log";
            readonly icon: "scroll";
        };
    };
    /** Monitoring presets */
    readonly presets: {
        readonly development: {
            readonly id: "development";
            readonly name: "Development";
            readonly description: "Local development with verbose logging";
            readonly config: {
                readonly port: 9876;
                readonly heartbeatIntervalSecs: 10;
                readonly nodeTimeoutSecs: 30;
                readonly maxLogEntries: 5000;
                readonly metricsEnabled: true;
            };
        };
        readonly production: {
            readonly id: "production";
            readonly name: "Production";
            readonly description: "Production deployment with TLS and authentication";
            readonly config: {
                readonly port: 443;
                readonly tlsEnabled: true;
                readonly heartbeatIntervalSecs: 30;
                readonly nodeTimeoutSecs: 90;
                readonly maxLogEntries: 1000;
                readonly metricsEnabled: true;
            };
        };
        readonly lightweight: {
            readonly id: "lightweight";
            readonly name: "Lightweight";
            readonly description: "Minimal resource usage for constrained environments";
            readonly config: {
                readonly port: 9876;
                readonly heartbeatIntervalSecs: 60;
                readonly nodeTimeoutSecs: 180;
                readonly maxLogEntries: 100;
                readonly metricsEnabled: false;
            };
        };
    };
};
declare const INTEGRATIONS: {
    readonly googleCalendar: {
        readonly id: "google_calendar";
        readonly name: "Google Calendar";
        readonly category: "productivity";
        readonly icon: "calendar";
        readonly color: "#4285f4";
        readonly capabilities: readonly ["list_events", "create_event", "update_event", "delete_event", "get_free_busy"];
        readonly authType: "oauth2";
    };
    readonly outlook: {
        readonly id: "outlook";
        readonly name: "Microsoft Outlook";
        readonly category: "productivity";
        readonly icon: "mail";
        readonly color: "#0078d4";
        readonly capabilities: readonly ["list_events", "create_event", "list_emails", "send_email", "read_email"];
        readonly authType: "oauth2";
    };
    readonly gmail: {
        readonly id: "gmail";
        readonly name: "Gmail";
        readonly category: "productivity";
        readonly icon: "mail";
        readonly color: "#ea4335";
        readonly capabilities: readonly ["list_emails", "send_email", "read_email", "archive", "label", "search"];
        readonly authType: "oauth2";
    };
    readonly notion: {
        readonly id: "notion";
        readonly name: "Notion";
        readonly category: "productivity";
        readonly icon: "file-text";
        readonly color: "#000000";
        readonly capabilities: readonly ["list_pages", "create_page", "update_page", "query_database", "search"];
        readonly authType: "oauth2";
    };
    readonly obsidian: {
        readonly id: "obsidian";
        readonly name: "Obsidian";
        readonly category: "productivity";
        readonly icon: "gem";
        readonly color: "#7c3aed";
        readonly capabilities: readonly ["list_notes", "create_note", "update_note", "search", "get_backlinks"];
        readonly authType: "local";
    };
    readonly todoist: {
        readonly id: "todoist";
        readonly name: "Todoist";
        readonly category: "productivity";
        readonly icon: "check-square";
        readonly color: "#e44332";
        readonly capabilities: readonly ["list_tasks", "create_task", "complete_task", "update_task", "list_projects"];
        readonly authType: "oauth2";
    };
    readonly slack: {
        readonly id: "slack";
        readonly name: "Slack";
        readonly category: "communication";
        readonly icon: "message-square";
        readonly color: "#4a154b";
        readonly capabilities: readonly ["send_message", "list_channels", "read_messages", "upload_file", "react"];
        readonly authType: "oauth2";
    };
    readonly discord: {
        readonly id: "discord";
        readonly name: "Discord";
        readonly category: "communication";
        readonly icon: "message-circle";
        readonly color: "#5865f2";
        readonly capabilities: readonly ["send_message", "list_guilds", "list_channels", "read_messages"];
        readonly authType: "bot_token";
    };
    readonly teams: {
        readonly id: "teams";
        readonly name: "Microsoft Teams";
        readonly category: "communication";
        readonly icon: "users";
        readonly color: "#6264a7";
        readonly capabilities: readonly ["send_message", "list_teams", "list_channels", "schedule_meeting"];
        readonly authType: "oauth2";
    };
    readonly telegram: {
        readonly id: "telegram";
        readonly name: "Telegram";
        readonly category: "communication";
        readonly icon: "send";
        readonly color: "#0088cc";
        readonly capabilities: readonly ["send_message", "list_chats", "read_messages", "send_file"];
        readonly authType: "bot_token";
    };
    readonly chrome: {
        readonly id: "chrome";
        readonly name: "Google Chrome";
        readonly category: "browser";
        readonly icon: "globe";
        readonly color: "#4285f4";
        readonly capabilities: readonly ["list_tabs", "open_url", "close_tab", "get_bookmarks", "get_history"];
        readonly authType: "extension";
    };
    readonly arc: {
        readonly id: "arc";
        readonly name: "Arc Browser";
        readonly category: "browser";
        readonly icon: "compass";
        readonly color: "#fc5c65";
        readonly capabilities: readonly ["list_tabs", "list_spaces", "create_space", "pin_tab", "create_easel"];
        readonly authType: "local";
    };
    readonly github: {
        readonly id: "github";
        readonly name: "GitHub";
        readonly category: "development";
        readonly icon: "github";
        readonly color: "#171515";
        readonly capabilities: readonly ["list_repos", "create_issue", "create_pr", "review_pr", "search_code"];
        readonly authType: "oauth2";
    };
    readonly gitlab: {
        readonly id: "gitlab";
        readonly name: "GitLab";
        readonly category: "development";
        readonly icon: "gitlab";
        readonly color: "#fc6d26";
        readonly capabilities: readonly ["list_projects", "create_issue", "create_mr", "pipelines"];
        readonly authType: "oauth2";
    };
    readonly linear: {
        readonly id: "linear";
        readonly name: "Linear";
        readonly category: "development";
        readonly icon: "layout";
        readonly color: "#5e6ad2";
        readonly capabilities: readonly ["list_issues", "create_issue", "update_issue", "list_projects", "search"];
        readonly authType: "oauth2";
    };
    readonly docker: {
        readonly id: "docker";
        readonly name: "Docker";
        readonly category: "development";
        readonly icon: "box";
        readonly color: "#2496ed";
        readonly capabilities: readonly ["list_containers", "start_container", "stop_container", "build_image", "logs"];
        readonly authType: "local";
    };
    readonly homeAssistant: {
        readonly id: "home_assistant";
        readonly name: "Home Assistant";
        readonly category: "smart_home";
        readonly icon: "home";
        readonly color: "#41bdf5";
        readonly capabilities: readonly ["list_devices", "control_device", "run_scene", "run_automation", "get_state"];
        readonly authType: "api_key";
    };
    readonly hue: {
        readonly id: "hue";
        readonly name: "Philips Hue";
        readonly category: "smart_home";
        readonly icon: "sun";
        readonly color: "#0065d3";
        readonly capabilities: readonly ["list_lights", "set_light", "list_scenes", "run_scene"];
        readonly authType: "bridge";
    };
    readonly nest: {
        readonly id: "nest";
        readonly name: "Google Nest";
        readonly category: "smart_home";
        readonly icon: "thermometer";
        readonly color: "#00a5e5";
        readonly capabilities: readonly ["get_temperature", "set_temperature", "get_cameras", "get_doorbell"];
        readonly authType: "oauth2";
    };
    readonly plaid: {
        readonly id: "plaid";
        readonly name: "Plaid";
        readonly category: "finance";
        readonly icon: "credit-card";
        readonly color: "#00d66e";
        readonly capabilities: readonly ["list_accounts", "get_transactions", "get_balance"];
        readonly authType: "oauth2";
    };
    readonly coinbase: {
        readonly id: "coinbase";
        readonly name: "Coinbase";
        readonly category: "finance";
        readonly icon: "dollar-sign";
        readonly color: "#0052ff";
        readonly capabilities: readonly ["get_portfolio", "get_prices", "list_transactions"];
        readonly authType: "oauth2";
    };
    readonly appleHealth: {
        readonly id: "apple_health";
        readonly name: "Apple Health";
        readonly category: "health";
        readonly icon: "heart";
        readonly color: "#ff2d55";
        readonly capabilities: readonly ["get_steps", "get_heart_rate", "get_sleep", "get_workouts"];
        readonly authType: "local";
    };
    readonly oura: {
        readonly id: "oura";
        readonly name: "Oura Ring";
        readonly category: "health";
        readonly icon: "activity";
        readonly color: "#1d1d1f";
        readonly capabilities: readonly ["get_sleep", "get_readiness", "get_activity", "get_heart_rate"];
        readonly authType: "oauth2";
    };
    readonly spotify: {
        readonly id: "spotify";
        readonly name: "Spotify";
        readonly category: "media";
        readonly icon: "music";
        readonly color: "#1db954";
        readonly capabilities: readonly ["get_playing", "play", "pause", "skip", "search", "add_to_playlist"];
        readonly authType: "oauth2";
    };
    readonly youtube: {
        readonly id: "youtube";
        readonly name: "YouTube";
        readonly category: "media";
        readonly icon: "youtube";
        readonly color: "#ff0000";
        readonly capabilities: readonly ["search", "get_subscriptions", "get_playlist", "get_watch_later"];
        readonly authType: "oauth2";
    };
    readonly googleMaps: {
        readonly id: "google_maps";
        readonly name: "Google Maps";
        readonly category: "travel";
        readonly icon: "map-pin";
        readonly color: "#4285f4";
        readonly capabilities: readonly ["search_places", "get_directions", "get_traffic", "get_distance"];
        readonly authType: "api_key";
    };
    readonly uber: {
        readonly id: "uber";
        readonly name: "Uber";
        readonly category: "travel";
        readonly icon: "car";
        readonly color: "#000000";
        readonly capabilities: readonly ["request_ride", "get_estimate", "get_history"];
        readonly authType: "oauth2";
    };
    readonly amazon: {
        readonly id: "amazon";
        readonly name: "Amazon";
        readonly category: "shopping";
        readonly icon: "shopping-cart";
        readonly color: "#ff9900";
        readonly capabilities: readonly ["search_products", "get_orders", "track_package", "add_to_cart"];
        readonly authType: "oauth2";
    };
    readonly instacart: {
        readonly id: "instacart";
        readonly name: "Instacart";
        readonly category: "shopping";
        readonly icon: "shopping-bag";
        readonly color: "#43b02a";
        readonly capabilities: readonly ["search_products", "add_to_cart", "checkout", "track_order"];
        readonly authType: "oauth2";
    };
    readonly shell: {
        readonly id: "shell";
        readonly name: "Shell";
        readonly category: "system";
        readonly icon: "terminal";
        readonly color: "#4d4d4d";
        readonly capabilities: readonly ["run_command", "run_script", "get_environment"];
        readonly authType: "local";
    };
    readonly clipboard: {
        readonly id: "clipboard";
        readonly name: "Clipboard";
        readonly category: "system";
        readonly icon: "clipboard";
        readonly color: "#6b7280";
        readonly capabilities: readonly ["get", "set", "get_history", "clear"];
        readonly authType: "local";
    };
    readonly filesystem: {
        readonly id: "filesystem";
        readonly name: "Filesystem";
        readonly category: "system";
        readonly icon: "folder";
        readonly color: "#3b82f6";
        readonly capabilities: readonly ["read", "write", "list", "search", "watch"];
        readonly authType: "local";
    };
    readonly notifications: {
        readonly id: "notifications";
        readonly name: "System Notifications";
        readonly category: "system";
        readonly icon: "bell";
        readonly color: "#ef4444";
        readonly capabilities: readonly ["notify", "schedule", "cancel"];
        readonly authType: "local";
    };
};
type IntegrationId = keyof typeof INTEGRATIONS;
declare const INTEGRATION_CATEGORIES: readonly ["productivity", "communication", "browser", "development", "smart_home", "finance", "health", "media", "travel", "shopping", "system"];
type IntegrationCategoryType = (typeof INTEGRATION_CATEGORIES)[number];
declare const HOOK_TRIGGERS: {
    readonly cron: {
        readonly id: "cron";
        readonly name: "Cron Schedule";
        readonly category: "time";
    };
    readonly interval: {
        readonly id: "interval";
        readonly name: "Interval";
        readonly category: "time";
    };
    readonly daily: {
        readonly id: "daily";
        readonly name: "Daily";
        readonly category: "time";
    };
    readonly weekly: {
        readonly id: "weekly";
        readonly name: "Weekly";
        readonly category: "time";
    };
    readonly monthly: {
        readonly id: "monthly";
        readonly name: "Monthly";
        readonly category: "time";
    };
    readonly webhook: {
        readonly id: "webhook";
        readonly name: "Webhook";
        readonly category: "event";
    };
    readonly fileChange: {
        readonly id: "file_change";
        readonly name: "File Change";
        readonly category: "event";
    };
    readonly emailReceived: {
        readonly id: "email_received";
        readonly name: "Email Received";
        readonly category: "event";
    };
    readonly calendarEvent: {
        readonly id: "calendar_event";
        readonly name: "Calendar Event";
        readonly category: "event";
    };
    readonly gitPush: {
        readonly id: "git_push";
        readonly name: "Git Push";
        readonly category: "event";
    };
    readonly gitPr: {
        readonly id: "git_pr";
        readonly name: "Pull Request";
        readonly category: "event";
    };
    readonly appLaunch: {
        readonly id: "app_launch";
        readonly name: "App Launch";
        readonly category: "event";
    };
    readonly systemWake: {
        readonly id: "system_wake";
        readonly name: "System Wake";
        readonly category: "event";
    };
    readonly batteryLow: {
        readonly id: "battery_low";
        readonly name: "Battery Low";
        readonly category: "event";
    };
    readonly networkChange: {
        readonly id: "network_change";
        readonly name: "Network Change";
        readonly category: "event";
    };
};
type HookTriggerId = keyof typeof HOOK_TRIGGERS;
declare const HOOK_ACTIONS: {
    readonly sendNotification: {
        readonly id: "send_notification";
        readonly name: "Send Notification";
        readonly category: "notification";
    };
    readonly sendEmail: {
        readonly id: "send_email";
        readonly name: "Send Email";
        readonly category: "notification";
    };
    readonly sendSlack: {
        readonly id: "send_slack";
        readonly name: "Send Slack Message";
        readonly category: "notification";
    };
    readonly sendDiscord: {
        readonly id: "send_discord";
        readonly name: "Send Discord Message";
        readonly category: "notification";
    };
    readonly sendSms: {
        readonly id: "send_sms";
        readonly name: "Send SMS";
        readonly category: "notification";
    };
    readonly runCommand: {
        readonly id: "run_command";
        readonly name: "Run Command";
        readonly category: "automation";
    };
    readonly runScript: {
        readonly id: "run_script";
        readonly name: "Run Script";
        readonly category: "automation";
    };
    readonly callApi: {
        readonly id: "call_api";
        readonly name: "Call API";
        readonly category: "automation";
    };
    readonly createFile: {
        readonly id: "create_file";
        readonly name: "Create File";
        readonly category: "automation";
    };
    readonly moveFile: {
        readonly id: "move_file";
        readonly name: "Move File";
        readonly category: "automation";
    };
    readonly createEvent: {
        readonly id: "create_event";
        readonly name: "Create Calendar Event";
        readonly category: "calendar";
    };
    readonly updateEvent: {
        readonly id: "update_event";
        readonly name: "Update Calendar Event";
        readonly category: "calendar";
    };
    readonly createTask: {
        readonly id: "create_task";
        readonly name: "Create Task";
        readonly category: "tasks";
    };
    readonly completeTask: {
        readonly id: "complete_task";
        readonly name: "Complete Task";
        readonly category: "tasks";
    };
    readonly controlDevice: {
        readonly id: "control_device";
        readonly name: "Control Smart Device";
        readonly category: "smart_home";
    };
    readonly runScene: {
        readonly id: "run_scene";
        readonly name: "Run Scene";
        readonly category: "smart_home";
    };
    readonly askAgent: {
        readonly id: "ask_agent";
        readonly name: "Ask AI Agent";
        readonly category: "ai";
    };
    readonly summarize: {
        readonly id: "summarize";
        readonly name: "Summarize Content";
        readonly category: "ai";
    };
    readonly translate: {
        readonly id: "translate";
        readonly name: "Translate";
        readonly category: "ai";
    };
};
type HookActionId = keyof typeof HOOK_ACTIONS;

export { AGENT_ROLES, AGENT_STATUSES, API_CONFIG, API_ENDPOINTS, type AgentRoleId, type AgentStatusType, DEFAULT_AGENTS, DEFAULT_AGENT_CONFIG, EXPORT_FORMATS, type ExportFormatType, HOOK_ACTIONS, HOOK_TRIGGERS, type HookActionId, type HookTriggerId, INTEGRATIONS, INTEGRATION_CATEGORIES, type IntegrationCategoryType, type IntegrationId, LIMITS, MEMORY_CONFIG, MODEL_CATEGORIES, MULTIMODAL_MODELS, ModelCategory, MultimodalModel, ORCHESTRATION_MODES, type OrchestrationModeId, PROACTIVE_AGENT_CONFIG, PROVIDERS, PROVIDER_STATUSES, type ProviderId, type ProviderStatusType, REMOTE_MONITOR_CONFIG, SESSION_FORMAT, SWARM_STATUSES, SWARM_TEMPLATES, type SwarmStatusType, TASK_STATUSES, TOOL_CATEGORIES, type TaskStatusType, type ToolCategoryId, VLA_MODELS, VLM_MODELS, getModelsByCategory, getVLAModels, getVLMModels };
