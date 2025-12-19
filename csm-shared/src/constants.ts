// =============================================================================
// CSM Shared Constants
// =============================================================================
// Constants shared across the entire CSM ecosystem:
// - csm-rust (Rust backend)
// - csm-web (React web app)
// - csm-app (React Native mobile app)
// - vscode-extension (VS Code extension)

// =============================================================================
// Provider Configuration
// =============================================================================

export const PROVIDERS = {
    copilot: {
        id: 'copilot',
        name: 'GitHub Copilot',
        type: 'cloud' as const,
        models: ['gpt-4o', 'gpt-4o-mini', 'claude-3.5-sonnet', 'o1-preview', 'o1-mini'],
        color: '#1f6feb',
        icon: 'github',
    },
    ollama: {
        id: 'ollama',
        name: 'Ollama',
        type: 'local' as const,
        endpoint: 'http://localhost:11434',
        models: ['llama3.2', 'llama3.1', 'codellama', 'mistral', 'mixtral', 'qwen2.5-coder', 'deepseek-coder'],
        color: '#ffffff',
        icon: 'ollama',
    },
    openai: {
        id: 'openai',
        name: 'OpenAI',
        type: 'cloud' as const,
        endpoint: 'https://api.openai.com/v1',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini'],
        color: '#10a37f',
        icon: 'openai',
    },
    anthropic: {
        id: 'anthropic',
        name: 'Anthropic',
        type: 'cloud' as const,
        endpoint: 'https://api.anthropic.com/v1',
        models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
        color: '#d4a574',
        icon: 'anthropic',
    },
    azure: {
        id: 'azure',
        name: 'Azure OpenAI',
        type: 'cloud' as const,
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
        color: '#0078d4',
        icon: 'azure',
    },
    google: {
        id: 'google',
        name: 'Google AI',
        type: 'cloud' as const,
        endpoint: 'https://generativelanguage.googleapis.com/v1',
        models: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
        color: '#4285f4',
        icon: 'google',
    },
    lmstudio: {
        id: 'lmstudio',
        name: 'LM Studio',
        type: 'local' as const,
        endpoint: 'http://localhost:1234/v1',
        models: [],
        color: '#6366f1',
        icon: 'lmstudio',
    },
    jan: {
        id: 'jan',
        name: 'Jan',
        type: 'local' as const,
        endpoint: 'http://localhost:1337/v1',
        models: [],
        color: '#2563eb',
        icon: 'jan',
    },
    llamafile: {
        id: 'llamafile',
        name: 'llamafile',
        type: 'local' as const,
        endpoint: 'http://localhost:8080/v1',
        models: [],
        color: '#f97316',
        icon: 'llamafile',
    },
    gpt4all: {
        id: 'gpt4all',
        name: 'GPT4All',
        type: 'local' as const,
        endpoint: 'http://localhost:4891/v1',
        models: [],
        color: '#22c55e',
        icon: 'gpt4all',
    },
} as const;

export type ProviderId = keyof typeof PROVIDERS;

// =============================================================================
// Agent Roles
// =============================================================================

export const AGENT_ROLES = {
    coordinator: {
        id: 'coordinator',
        name: 'Coordinator',
        description: 'Orchestrates tasks and manages other agents',
        icon: '🎯',
        color: '#3b82f6',
        capabilities: ['planning', 'delegation', 'synthesis', 'monitoring'],
    },
    researcher: {
        id: 'researcher',
        name: 'Researcher',
        description: 'Gathers information and analyzes data',
        icon: '🔍',
        color: '#10b981',
        capabilities: ['search', 'analysis', 'synthesis', 'fact_checking'],
    },
    coder: {
        id: 'coder',
        name: 'Coder',
        description: 'Writes, reviews, and debugs code',
        icon: '💻',
        color: '#f59e0b',
        capabilities: ['code_generation', 'code_review', 'debugging', 'refactoring'],
    },
    reviewer: {
        id: 'reviewer',
        name: 'Reviewer',
        description: 'Reviews code and provides feedback',
        icon: '✅',
        color: '#8b5cf6',
        capabilities: ['code_review', 'quality_assurance', 'feedback', 'validation'],
    },
    executor: {
        id: 'executor',
        name: 'Executor',
        description: 'Executes tools and commands',
        icon: '⚡',
        color: '#ef4444',
        capabilities: ['tool_use', 'command_execution', 'automation', 'api_calls'],
    },
    writer: {
        id: 'writer',
        name: 'Writer',
        description: 'Creates and edits documentation',
        icon: '✍️',
        color: '#ec4899',
        capabilities: ['documentation', 'content_creation', 'editing', 'summarization'],
    },
    tester: {
        id: 'tester',
        name: 'Tester',
        description: 'Creates and runs tests',
        icon: '🧪',
        color: '#06b6d4',
        capabilities: ['test_generation', 'test_execution', 'bug_finding', 'coverage_analysis'],
    },
    custom: {
        id: 'custom',
        name: 'Custom',
        description: 'Custom agent with user-defined capabilities',
        icon: '🔧',
        color: '#6b7280',
        capabilities: [],
    },
} as const;

export type AgentRoleId = keyof typeof AGENT_ROLES;

// =============================================================================
// Orchestration Modes
// =============================================================================

export const ORCHESTRATION_MODES = {
    single: {
        id: 'single',
        name: 'Single Agent',
        description: 'Traditional single-agent response',
        icon: '👤',
    },
    sequential: {
        id: 'sequential',
        name: 'Sequential',
        description: 'Agents execute one after another, passing results forward',
        icon: '➡️',
    },
    parallel: {
        id: 'parallel',
        name: 'Parallel',
        description: 'Multiple agents work simultaneously on subtasks',
        icon: '⚡',
    },
    loop: {
        id: 'loop',
        name: 'Loop',
        description: 'Agent repeats until a condition is met',
        icon: '🔁',
    },
    hierarchical: {
        id: 'hierarchical',
        name: 'Hierarchical',
        description: 'Lead agent delegates to specialized sub-agents',
        icon: '🏛️',
    },
    swarm: {
        id: 'swarm',
        name: 'Swarm',
        description: 'Multiple agents collaborate with a coordinator',
        icon: '🐝',
    },
    debate: {
        id: 'debate',
        name: 'Debate',
        description: 'Agents debate to reach the best solution',
        icon: '💬',
    },
} as const;

export type OrchestrationModeId = keyof typeof ORCHESTRATION_MODES;

// =============================================================================
// Tool Categories
// =============================================================================

export const TOOL_CATEGORIES = {
    code: {
        id: 'code',
        name: 'Code',
        description: 'Code execution and development tools',
        icon: '💻',
    },
    search: {
        id: 'search',
        name: 'Search',
        description: 'Search and retrieval tools',
        icon: '🔍',
    },
    file: {
        id: 'file',
        name: 'File',
        description: 'File system operations',
        icon: '📁',
    },
    web: {
        id: 'web',
        name: 'Web',
        description: 'Web browsing and fetching',
        icon: '🌐',
    },
    analysis: {
        id: 'analysis',
        name: 'Analysis',
        description: 'Code analysis and linting',
        icon: '📊',
    },
    git: {
        id: 'git',
        name: 'Git',
        description: 'Version control operations',
        icon: '📦',
    },
    database: {
        id: 'database',
        name: 'Database',
        description: 'Database operations',
        icon: '🗃️',
    },
    custom: {
        id: 'custom',
        name: 'Custom',
        description: 'Custom tools',
        icon: '🔧',
    },
} as const;

export type ToolCategoryId = keyof typeof TOOL_CATEGORIES;

// =============================================================================
// Status Constants
// =============================================================================

export const AGENT_STATUSES = ['idle', 'thinking', 'executing', 'waiting', 'completed', 'failed', 'paused'] as const;
export type AgentStatusType = (typeof AGENT_STATUSES)[number];

export const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'failed', 'cancelled'] as const;
export type TaskStatusType = (typeof TASK_STATUSES)[number];

export const SWARM_STATUSES = ['idle', 'running', 'paused', 'completed', 'failed'] as const;
export type SwarmStatusType = (typeof SWARM_STATUSES)[number];

export const PROVIDER_STATUSES = ['connected', 'disconnected', 'error', 'unknown'] as const;
export type ProviderStatusType = (typeof PROVIDER_STATUSES)[number];

// =============================================================================
// Export Formats
// =============================================================================

export const EXPORT_FORMATS = ['json', 'markdown', 'html', 'csv', 'pdf'] as const;
export type ExportFormatType = (typeof EXPORT_FORMATS)[number];

// =============================================================================
// API Configuration
// =============================================================================

export const API_CONFIG = {
    defaultBaseUrl: 'http://localhost:3000',
    defaultTimeout: 30000,
    version: 'v1',
} as const;

export const API_ENDPOINTS = {
    health: '/api/health',
    stats: '/api/v1/stats',
    workspaces: '/api/v1/workspaces',
    sessions: '/api/v1/sessions',
    messages: '/api/v1/messages',
    providers: '/api/v1/providers',
    agents: '/api/v1/agents',
    swarms: '/api/v1/swarms',
    runs: '/api/v1/runs',
    chat: '/api/v1/chat',
    search: '/api/v1/search',
    mcp: '/api/v1/mcp',
    export: '/api/v1/export',
    import: '/api/v1/import',
} as const;

// =============================================================================
// Session Format
// =============================================================================

export const SESSION_FORMAT = {
    version: 3,
    maxMessages: 1000,
    maxTitleLength: 200,
    maxContentLength: 100000,
} as const;

// =============================================================================
// Limits
// =============================================================================

export const LIMITS = {
    maxMessageLength: 100000,
    maxSessionMessages: 1000,
    maxSessionTitleLength: 200,
    maxAgentsPerSwarm: 10,
    maxIterations: 50,
    maxConcurrentAgents: 5,
    maxToolCalls: 100,
    maxFileSize: 10 * 1024 * 1024, // 10MB
} as const;

// =============================================================================
// Default Agent Configurations
// =============================================================================

export const DEFAULT_AGENT_CONFIG = {
    temperature: 0.7,
    maxTokens: 4096,
    autonomy: 'medium' as const,
    maxIterations: 10,
};

export const DEFAULT_AGENTS = [
    {
        name: 'assistant',
        role: 'custom' as const,
        description: 'General-purpose AI assistant with planning and reflection',
        instruction: 'You are a helpful assistant that provides clear, accurate, and concise responses.',
        model: 'gpt-4o',
        tools: [],
        temperature: 0.7,
        autonomy: 'medium' as const,
        maxIterations: 10,
    },
    {
        name: 'coder',
        role: 'coder' as const,
        description: 'Expert software developer with autonomous coding capabilities',
        instruction: 'You are an expert software developer. Plan your approach, write clean code, and test it.',
        model: 'gpt-4o',
        tools: ['read_file', 'create_file', 'replace_string_in_file', 'run_in_terminal', 'get_errors'],
        temperature: 0.3,
        autonomy: 'high' as const,
        maxIterations: 15,
    },
    {
        name: 'researcher',
        role: 'researcher' as const,
        description: 'Research specialist with deep analysis capabilities',
        instruction: 'You are a research specialist. Analyze thoroughly and provide balanced perspectives.',
        model: 'gpt-4o',
        tools: ['semantic_search', 'fetch_webpage', 'read_file'],
        temperature: 0.5,
        autonomy: 'high' as const,
        maxIterations: 12,
    },
    {
        name: 'reviewer',
        role: 'reviewer' as const,
        description: 'Code review expert with detailed analysis',
        instruction: 'You are a senior code reviewer. Review for correctness, security, and best practices.',
        model: 'gpt-4o',
        tools: ['read_file', 'grep_search', 'get_errors'],
        temperature: 0.3,
        autonomy: 'medium' as const,
        maxIterations: 8,
    },
    {
        name: 'coordinator',
        role: 'coordinator' as const,
        description: 'Multi-agent coordinator for complex tasks',
        instruction: 'You are a coordinator that orchestrates multiple agents. Plan, delegate, and synthesize.',
        model: 'gpt-4o',
        tools: ['semantic_search'],
        temperature: 0.4,
        autonomy: 'high' as const,
        maxIterations: 20,
    },
] as const;

// =============================================================================
// Swarm Templates
// =============================================================================

export const SWARM_TEMPLATES = [
    {
        name: 'Research Team',
        description: 'A team focused on research and analysis tasks',
        roles: ['coordinator', 'researcher', 'researcher', 'reviewer'],
    },
    {
        name: 'Development Team',
        description: 'A team for software development tasks',
        roles: ['coordinator', 'coder', 'reviewer', 'tester'],
    },
    {
        name: 'Documentation Team',
        description: 'A team for creating and reviewing documentation',
        roles: ['coordinator', 'writer', 'reviewer'],
    },
    {
        name: 'Code Review Team',
        description: 'A team for thorough code reviews',
        roles: ['coordinator', 'reviewer', 'reviewer', 'tester'],
    },
] as const;
