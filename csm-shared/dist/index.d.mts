export { AgencyEvent, AgencyEventType, AgencyToolCall, AgencyToolResult, Agent, AgentMessage, AgentRole, AgentRun, AgentStatus, AgentTask, ApiError, ApiResponse, AppSettings, ChatCompletionMessage, ChatCompletionRequest, ChatCompletionResponse, Checkpoint, DayCount, ExecutionResult, ExportOptions, FileChange, GitCommit, GitRepository, ImportResult, ImportSource, McpTool, McpToolCall, McpToolResult, Message, ModelConfig, ModelProvider, OrchestrationType, OrchestratorResult, PaginatedResponse, Pipeline, Provider, ProviderCount, ProviderHealth, ProviderSettings, ProviderStatus, ProviderType, SearchResult, Session, SessionFilter, SessionWithMessages, ShareLink, ShareLinkProvider, Statistics, StreamChunk, Swarm, SwarmAgent, SwarmStatus, SwarmWorkflow, TaskStatus, ThemeMode, TokenUsage, ToolInvocation, WorkflowEdge, WorkflowNode, Workspace, WorkspaceFilter, WorkspaceStats } from './types/index.mjs';
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
}];

export { AGENT_ROLES, AGENT_STATUSES, API_CONFIG, API_ENDPOINTS, type AgentRoleId, type AgentStatusType, DEFAULT_AGENTS, DEFAULT_AGENT_CONFIG, EXPORT_FORMATS, type ExportFormatType, LIMITS, ORCHESTRATION_MODES, type OrchestrationModeId, PROVIDERS, PROVIDER_STATUSES, type ProviderId, type ProviderStatusType, SESSION_FORMAT, SWARM_STATUSES, SWARM_TEMPLATES, type SwarmStatusType, TASK_STATUSES, TOOL_CATEGORIES, type TaskStatusType, type ToolCategoryId };
