// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// =============================================================================
// IronBridge Shared Constants
// =============================================================================
// Constants shared across ironbridge-rust, ironbridge-web, ironbridge-app, and vscode-extension
// These should be kept in sync with ironbridge-shared/src/constants.ts

/**
 * Provider configuration type
 */
export interface ProviderDefinition {
    id: string;
    name: string;
    type: 'cloud' | 'local';
    endpoint?: string;
    models: string[];
    color: string;
}

/**
 * Provider configurations object
 */
export const PROVIDERS: Record<string, ProviderDefinition> = {
    copilot: {
        id: 'copilot',
        name: 'GitHub Copilot',
        type: 'cloud',
        models: ['gpt-4o', 'gpt-4o-mini', 'claude-3.5-sonnet', 'o1-preview', 'o1-mini'],
        color: '#1f6feb',
    },
    ollama: {
        id: 'ollama',
        name: 'Ollama',
        type: 'local',
        endpoint: 'http://localhost:11434',
        models: ['llama3.2', 'llama3.1', 'codellama', 'mistral', 'mixtral', 'qwen2.5-coder'],
        color: '#ffffff',
    },
    openai: {
        id: 'openai',
        name: 'OpenAI',
        type: 'cloud',
        endpoint: 'https://api.openai.com/v1',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini'],
        color: '#10a37f',
    },
    anthropic: {
        id: 'anthropic',
        name: 'Anthropic',
        type: 'cloud',
        endpoint: 'https://api.anthropic.com/v1',
        models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
        color: '#d4a574',
    },
    azure: {
        id: 'azure',
        name: 'Azure OpenAI',
        type: 'cloud',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
        color: '#0078d4',
    },
    google: {
        id: 'google',
        name: 'Google AI',
        type: 'cloud',
        endpoint: 'https://generativelanguage.googleapis.com/v1',
        models: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
        color: '#4285f4',
    },
    lmstudio: {
        id: 'lmstudio',
        name: 'LM Studio',
        type: 'local',
        endpoint: 'http://localhost:1234/v1',
        models: [],
        color: '#6366f1',
    },
};

/**
 * Default provider configurations as array (for iteration)
 */
export const DEFAULT_PROVIDERS: ProviderDefinition[] = Object.values(PROVIDERS);

/**
 * Agent role definition type
 */
export interface AgentRoleDefinition {
    name: string;
    displayName: string;
    description: string;
    icon: string;
    color: string;
    capabilities: string[];
}

/**
 * Agent role definitions
 */
export const AGENT_ROLES: Record<string, AgentRoleDefinition> = {
    coordinator: {
        name: 'coordinator',
        displayName: 'Coordinator',
        description: 'Orchestrates tasks and manages other agents',
        icon: '🎯',
        color: '#3b82f6',
        capabilities: ['planning', 'delegation', 'synthesis'],
    },
    researcher: {
        name: 'researcher',
        displayName: 'Researcher',
        description: 'Gathers information and analyzes data',
        icon: '🔍',
        color: '#10b981',
        capabilities: ['search', 'analysis', 'synthesis'],
    },
    coder: {
        name: 'coder',
        displayName: 'Coder',
        description: 'Writes and reviews code',
        icon: '💻',
        color: '#f59e0b',
        capabilities: ['code_generation', 'code_review', 'debugging'],
    },
    reviewer: {
        name: 'reviewer',
        displayName: 'Reviewer',
        description: 'Reviews code and provides feedback',
        icon: '✅',
        color: '#8b5cf6',
        capabilities: ['code_review', 'quality_assurance', 'feedback'],
    },
    executor: {
        name: 'executor',
        displayName: 'Executor',
        description: 'Executes tools and commands',
        icon: '⚡',
        color: '#ef4444',
        capabilities: ['tool_use', 'command_execution', 'automation'],
    },
    custom: {
        name: 'custom',
        displayName: 'Custom',
        description: 'Custom agent with user-defined capabilities',
        icon: '🔧',
        color: '#6b7280',
        capabilities: [],
    },
};

/**
 * Orchestration mode definitions
 */
export const ORCHESTRATION_MODES = {
    single: {
        name: 'single',
        displayName: 'Single Agent',
        description: 'Traditional single-agent response',
        icon: '👤',
    },
    sequential: {
        name: 'sequential',
        displayName: 'Sequential',
        description: 'Agents execute one after another, passing results forward',
        icon: '➡️',
    },
    parallel: {
        name: 'parallel',
        displayName: 'Parallel',
        description: 'Multiple agents work simultaneously on subtasks',
        icon: '⚡',
    },
    swarm: {
        name: 'swarm',
        displayName: 'Swarm',
        description: 'Multiple agents collaborate with a coordinator',
        icon: '🐝',
    },
    hierarchical: {
        name: 'hierarchical',
        displayName: 'Hierarchical',
        description: 'Lead agent delegates to specialized sub-agents',
        icon: '🏛️',
    },
    debate: {
        name: 'debate',
        displayName: 'Debate',
        description: 'Agents debate to reach the best solution',
        icon: '💬',
    },
    loop: {
        name: 'loop',
        displayName: 'Loop',
        description: 'Agent repeats until a condition is met',
        icon: '🔁',
    },
} as const;

/**
 * Tool categories
 */
export const TOOL_CATEGORIES = {
    code: {
        name: 'code',
        displayName: 'Code',
        description: 'Code execution and development tools',
        icon: '💻',
    },
    search: {
        name: 'search',
        displayName: 'Search',
        description: 'Search and retrieval tools',
        icon: '🔍',
    },
    file: {
        name: 'file',
        displayName: 'File',
        description: 'File system operations',
        icon: '📁',
    },
    web: {
        name: 'web',
        displayName: 'Web',
        description: 'Web browsing and fetching',
        icon: '🌐',
    },
    analysis: {
        name: 'analysis',
        displayName: 'Analysis',
        description: 'Code analysis and linting',
        icon: '📊',
    },
    git: {
        name: 'git',
        displayName: 'Git',
        description: 'Version control operations',
        icon: '📦',
    },
    custom: {
        name: 'custom',
        displayName: 'Custom',
        description: 'Custom tools',
        icon: '🔧',
    },
} as const;

/**
 * VS Code tools available for agents
 */
export const VSCODE_TOOLS = [
    { name: 'read_file', description: 'Read contents of a file', category: 'file' },
    { name: 'create_file', description: 'Create a new file', category: 'file' },
    { name: 'replace_string_in_file', description: 'Replace text in a file', category: 'file' },
    { name: 'list_dir', description: 'List directory contents', category: 'file' },
    { name: 'semantic_search', description: 'Search workspace semantically', category: 'search' },
    { name: 'grep_search', description: 'Search by text pattern', category: 'search' },
    { name: 'file_search', description: 'Search files by name', category: 'search' },
    { name: 'run_in_terminal', description: 'Execute terminal command', category: 'code' },
    { name: 'get_errors', description: 'Get compile/lint errors', category: 'analysis' },
    { name: 'fetch_webpage', description: 'Fetch web page content', category: 'web' },
    { name: 'get_changed_files', description: 'Get git diff', category: 'git' },
    { name: 'list_code_usages', description: 'Find code usages', category: 'analysis' },
] as const;

/**
 * Default agent configuration type
 */
export interface DefaultAgentConfig {
    name: string;
    role: string;
    description: string;
    instruction: string;
    model: string;
    tools: string[];
    temperature: number;
    autonomy: 'low' | 'medium' | 'high';
    maxIterations: number;
}

/**
 * Default agent configurations
 */
export const DEFAULT_AGENTS: DefaultAgentConfig[] = [
    {
        name: 'assistant',
        role: 'custom',
        description: 'General-purpose AI assistant',
        instruction: 'You are a helpful assistant that provides clear, accurate, and concise responses.',
        model: 'gpt-4o',
        tools: [],
        temperature: 0.7,
        autonomy: 'medium',
        maxIterations: 10,
    },
    {
        name: 'coder',
        role: 'coder',
        description: 'Expert software developer',
        instruction: 'You are an expert software developer. Write clean, efficient code and explain your approach.',
        model: 'gpt-4o',
        tools: ['read_file', 'create_file', 'replace_string_in_file', 'run_in_terminal', 'get_errors'],
        temperature: 0.3,
        autonomy: 'high',
        maxIterations: 15,
    },
    {
        name: 'researcher',
        role: 'researcher',
        description: 'Research and analysis specialist',
        instruction: 'You are a research specialist. Analyze thoroughly and provide balanced perspectives.',
        model: 'gpt-4o',
        tools: ['semantic_search', 'fetch_webpage', 'read_file'],
        temperature: 0.5,
        autonomy: 'high',
        maxIterations: 12,
    },
    {
        name: 'reviewer',
        role: 'reviewer',
        description: 'Code review expert',
        instruction: 'You are a senior code reviewer. Review for correctness, security, and best practices.',
        model: 'gpt-4o',
        tools: ['read_file', 'grep_search', 'get_errors'],
        temperature: 0.3,
        autonomy: 'medium',
        maxIterations: 8,
    },
    {
        name: 'coordinator',
        role: 'coordinator',
        description: 'Multi-agent coordinator',
        instruction: 'You are a coordinator that orchestrates multiple agents. Plan, delegate, and synthesize.',
        model: 'gpt-4o',
        tools: ['semantic_search'],
        temperature: 0.4,
        autonomy: 'high',
        maxIterations: 20,
    },
];

/**
 * Export format options
 */
export const EXPORT_FORMATS = ['json', 'markdown', 'html', 'csv'] as const;

/*
 * The endpoint list and default API config that used to sit here are gone.
 *
 * Nothing imported either of them, and both had drifted: every path carried a
 * `/v1` segment the server has never routed, and the default base URL pointed
 * at port 3000, which nothing in this repository listens on. A second copy of
 * the routing table that no one reads is a copy that can only be wrong --
 * `apiClient.ts` is the one that makes the requests, so it is the one that
 * gets to hold the paths.
 */

/**
 * Session format version
 */
export const SESSION_FORMAT_VERSION = 3;

/**
 * Maximum values
 */
export const LIMITS = {
    maxMessageLength: 100000,
    maxSessionMessages: 1000,
    maxAgentsPerSwarm: 10,
    maxIterations: 50,
    maxConcurrentAgents: 5,
} as const;

