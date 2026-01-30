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
    // =========================================================================
    // IDE/Editor Providers (file-based storage)
    // =========================================================================
    copilot: {
        id: 'copilot',
        name: 'GitHub Copilot',
        type: 'local' as const,
        models: ['gpt-4o', 'gpt-4o-mini', 'claude-3.5-sonnet', 'o1-preview', 'o1-mini'],
        color: '#1f6feb',
        icon: 'github',
    },
    cursor: {
        id: 'cursor',
        name: 'Cursor',
        type: 'local' as const,
        models: ['cursor-fast', 'gpt-4o', 'claude-3.5-sonnet'],
        color: '#00d4aa',
        icon: 'cursor',
    },
    continuedev: {
        id: 'continuedev',
        name: 'Continue.dev',
        type: 'local' as const,
        models: [],
        color: '#ff6b6b',
        icon: 'continue',
    },

    // =========================================================================
    // Cloud Providers
    // =========================================================================
    openai: {
        id: 'openai',
        name: 'OpenAI',
        type: 'cloud' as const,
        endpoint: 'https://api.openai.com/v1',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini', 'o3-mini'],
        color: '#10a37f',
        icon: 'openai',
    },
    anthropic: {
        id: 'anthropic',
        name: 'Anthropic',
        type: 'cloud' as const,
        endpoint: 'https://api.anthropic.com/v1',
        models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest', 'claude-sonnet-4-20250514'],
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
        models: ['gemini-2.0-flash-exp', 'gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
        color: '#4285f4',
        icon: 'google',
    },
    groq: {
        id: 'groq',
        name: 'Groq',
        type: 'cloud' as const,
        endpoint: 'https://api.groq.com/openai/v1',
        models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
        color: '#f55036',
        icon: 'groq',
    },
    together: {
        id: 'together',
        name: 'Together AI',
        type: 'cloud' as const,
        endpoint: 'https://api.together.xyz/v1',
        models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'Qwen/Qwen2.5-Coder-32B-Instruct', 'deepseek-ai/DeepSeek-R1'],
        color: '#0ea5e9',
        icon: 'together',
    },
    fireworks: {
        id: 'fireworks',
        name: 'Fireworks AI',
        type: 'cloud' as const,
        endpoint: 'https://api.fireworks.ai/inference/v1',
        models: ['accounts/fireworks/models/llama-v3p3-70b-instruct', 'accounts/fireworks/models/qwen2p5-coder-32b-instruct'],
        color: '#ff6b35',
        icon: 'fireworks',
    },
    deepseek: {
        id: 'deepseek',
        name: 'DeepSeek',
        type: 'cloud' as const,
        endpoint: 'https://api.deepseek.com/v1',
        models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
        color: '#4f46e5',
        icon: 'deepseek',
    },
    mistral: {
        id: 'mistral',
        name: 'Mistral AI',
        type: 'cloud' as const,
        endpoint: 'https://api.mistral.ai/v1',
        models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'codestral-latest'],
        color: '#ff7000',
        icon: 'mistral',
    },
    cohere: {
        id: 'cohere',
        name: 'Cohere',
        type: 'cloud' as const,
        endpoint: 'https://api.cohere.ai/v1',
        models: ['command-r-plus', 'command-r', 'command-light'],
        color: '#39594d',
        icon: 'cohere',
    },
    perplexity: {
        id: 'perplexity',
        name: 'Perplexity',
        type: 'cloud' as const,
        endpoint: 'https://api.perplexity.ai',
        models: ['llama-3.1-sonar-large-128k-online', 'llama-3.1-sonar-small-128k-online'],
        color: '#20b2aa',
        icon: 'perplexity',
    },

    // =========================================================================
    // Local Providers
    // =========================================================================
    ollama: {
        id: 'ollama',
        name: 'Ollama',
        type: 'local' as const,
        endpoint: 'http://localhost:11434',
        models: ['llama3.2', 'llama3.1', 'codellama', 'mistral', 'mixtral', 'qwen2.5-coder', 'deepseek-coder-v2', 'phi3'],
        color: '#ffffff',
        icon: 'ollama',
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
    gpt4all: {
        id: 'gpt4all',
        name: 'GPT4All',
        type: 'local' as const,
        endpoint: 'http://localhost:4891/v1',
        models: [],
        color: '#22c55e',
        icon: 'gpt4all',
    },
    localai: {
        id: 'localai',
        name: 'LocalAI',
        type: 'local' as const,
        endpoint: 'http://localhost:8080/v1',
        models: [],
        color: '#14b8a6',
        icon: 'localai',
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
    textgenwebui: {
        id: 'textgenwebui',
        name: 'Text Gen WebUI',
        type: 'local' as const,
        endpoint: 'http://localhost:5000/v1',
        models: [],
        color: '#a855f7',
        icon: 'textgenwebui',
    },
    vllm: {
        id: 'vllm',
        name: 'vLLM',
        type: 'local' as const,
        endpoint: 'http://localhost:8000/v1',
        models: [],
        color: '#3b82f6',
        icon: 'vllm',
    },
    koboldcpp: {
        id: 'koboldcpp',
        name: 'KoboldCpp',
        type: 'local' as const,
        endpoint: 'http://localhost:5001/v1',
        models: [],
        color: '#eab308',
        icon: 'koboldcpp',
    },
    tabbyml: {
        id: 'tabbyml',
        name: 'Tabby',
        type: 'local' as const,
        endpoint: 'http://localhost:8080/v1',
        models: [],
        color: '#ec4899',
        icon: 'tabbyml',
    },
    exo: {
        id: 'exo',
        name: 'Exo',
        type: 'local' as const,
        endpoint: 'http://localhost:52415/v1',
        models: [],
        color: '#8b5cf6',
        icon: 'exo',
    },
} as const;

export type ProviderId = keyof typeof PROVIDERS;

// =============================================================================
// Vision-Language Models (VLM)
// =============================================================================

import type { ModelCategory, MultimodalModel } from './types';

/**
 * Vision-Language Models that support image understanding
 */
export const VLM_MODELS: MultimodalModel[] = [
    {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        category: 'vlm',
        contextLength: 128000,
        description: 'OpenAI\'s flagship multimodal model',
        releaseDate: '2024-05',
        capabilities: {
            category: 'vlm',
            inputModalities: ['text', 'image', 'audio'],
            outputModalities: ['text'],
            supportsStreaming: true,
            supportsRealtime: true,
            maxImageSize: 20 * 1024 * 1024,
            maxAudioLength: 600,
            supportedImageFormats: ['png', 'jpeg', 'webp', 'gif'],
            supportedVideoFormats: [],
            supportedAudioFormats: ['mp3', 'wav', 'ogg'],
        },
    },
    {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        category: 'vlm',
        contextLength: 128000,
        description: 'Smaller, faster version of GPT-4o',
        releaseDate: '2024-07',
        capabilities: {
            category: 'vlm',
            inputModalities: ['text', 'image'],
            outputModalities: ['text'],
            supportsStreaming: true,
            supportsRealtime: false,
            maxImageSize: 20 * 1024 * 1024,
            supportedImageFormats: ['png', 'jpeg', 'webp', 'gif'],
            supportedVideoFormats: [],
            supportedAudioFormats: [],
        },
    },
    {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash',
        provider: 'google',
        category: 'valm',
        contextLength: 1000000,
        description: 'Google\'s multimodal model with vision, audio, and video',
        releaseDate: '2024-12',
        capabilities: {
            category: 'valm',
            inputModalities: ['text', 'image', 'video', 'audio'],
            outputModalities: ['text', 'audio'],
            supportsStreaming: true,
            supportsRealtime: true,
            maxImageSize: 20 * 1024 * 1024,
            maxVideoLength: 3600,
            maxAudioLength: 9.5 * 3600,
            supportedImageFormats: ['png', 'jpeg', 'webp', 'gif'],
            supportedVideoFormats: ['mp4', 'mpeg', 'mov', 'avi', 'webm'],
            supportedAudioFormats: ['mp3', 'wav', 'ogg', 'flac'],
        },
    },
    {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'google',
        category: 'vlm',
        contextLength: 2000000,
        description: 'Long-context multimodal model',
        releaseDate: '2024-02',
        capabilities: {
            category: 'vlm',
            inputModalities: ['text', 'image', 'video', 'audio'],
            outputModalities: ['text'],
            supportsStreaming: true,
            supportsRealtime: false,
            maxImageSize: 20 * 1024 * 1024,
            maxVideoLength: 3600,
            maxAudioLength: 9.5 * 3600,
            supportedImageFormats: ['png', 'jpeg', 'webp', 'gif'],
            supportedVideoFormats: ['mp4', 'mpeg', 'mov', 'avi', 'webm'],
            supportedAudioFormats: ['mp3', 'wav', 'ogg', 'flac'],
        },
    },
    {
        id: 'claude-3-5-sonnet-latest',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        category: 'vlm',
        contextLength: 200000,
        description: 'Anthropic\'s vision model with strong reasoning',
        releaseDate: '2024-10',
        capabilities: {
            category: 'vlm',
            inputModalities: ['text', 'image'],
            outputModalities: ['text'],
            supportsStreaming: true,
            supportsRealtime: false,
            maxImageSize: 20 * 1024 * 1024,
            supportedImageFormats: ['png', 'jpeg', 'webp', 'gif'],
            supportedVideoFormats: [],
            supportedAudioFormats: [],
        },
    },
    {
        id: 'llava-v1.6',
        name: 'LLaVA 1.6',
        provider: 'ollama',
        category: 'vlm',
        contextLength: 4096,
        description: 'Open-source vision-language model',
        releaseDate: '2024-01',
        capabilities: {
            category: 'vlm',
            inputModalities: ['text', 'image'],
            outputModalities: ['text'],
            supportsStreaming: true,
            supportsRealtime: false,
            maxImageSize: 10 * 1024 * 1024,
            supportedImageFormats: ['png', 'jpeg', 'webp'],
            supportedVideoFormats: [],
            supportedAudioFormats: [],
        },
    },
    {
        id: 'qwen2-vl',
        name: 'Qwen2-VL',
        provider: 'ollama',
        category: 'vlm',
        contextLength: 32000,
        description: 'Alibaba\'s vision-language model',
        releaseDate: '2024-08',
        capabilities: {
            category: 'vlm',
            inputModalities: ['text', 'image', 'video'],
            outputModalities: ['text'],
            supportsStreaming: true,
            supportsRealtime: false,
            maxImageSize: 20 * 1024 * 1024,
            maxVideoLength: 600,
            supportedImageFormats: ['png', 'jpeg', 'webp', 'gif'],
            supportedVideoFormats: ['mp4', 'webm'],
            supportedAudioFormats: [],
        },
    },
    {
        id: 'pixtral-12b',
        name: 'Pixtral 12B',
        provider: 'mistral',
        category: 'vlm',
        contextLength: 128000,
        description: 'Mistral\'s vision-language model',
        releaseDate: '2024-09',
        capabilities: {
            category: 'vlm',
            inputModalities: ['text', 'image'],
            outputModalities: ['text'],
            supportsStreaming: true,
            supportsRealtime: false,
            maxImageSize: 20 * 1024 * 1024,
            supportedImageFormats: ['png', 'jpeg', 'webp', 'gif'],
            supportedVideoFormats: [],
            supportedAudioFormats: [],
        },
    },
];

// =============================================================================
// Vision-Language-Action Models (VLA) for Robotics
// =============================================================================

/**
 * Vision-Language-Action Models for robotics and embodied AI
 */
export const VLA_MODELS: MultimodalModel[] = [
    {
        id: 'rt-2',
        name: 'RT-2',
        provider: 'google',
        category: 'vla',
        contextLength: 4096,
        description: 'Google\'s Robotics Transformer 2 for vision-language-action',
        releaseDate: '2023-07',
        capabilities: {
            category: 'vla',
            inputModalities: ['text', 'image', 'sensor'],
            outputModalities: ['text', 'action'],
            supportsStreaming: false,
            supportsRealtime: true,
            maxImageSize: 10 * 1024 * 1024,
            supportedImageFormats: ['png', 'jpeg'],
            supportedVideoFormats: [],
            supportedAudioFormats: [],
        },
    },
    {
        id: 'rt-x',
        name: 'RT-X',
        provider: 'google',
        category: 'vla',
        contextLength: 4096,
        description: 'Cross-robot transfer model from Open X-Embodiment',
        releaseDate: '2023-10',
        capabilities: {
            category: 'vla',
            inputModalities: ['text', 'image', 'sensor'],
            outputModalities: ['text', 'action'],
            supportsStreaming: false,
            supportsRealtime: true,
            maxImageSize: 10 * 1024 * 1024,
            supportedImageFormats: ['png', 'jpeg'],
            supportedVideoFormats: [],
            supportedAudioFormats: [],
        },
    },
    {
        id: 'octo',
        name: 'Octo',
        provider: 'custom',
        category: 'vla',
        contextLength: 4096,
        description: 'Open-source generalist robot policy from Berkeley',
        releaseDate: '2024-05',
        capabilities: {
            category: 'vla',
            inputModalities: ['text', 'image', 'sensor'],
            outputModalities: ['action'],
            supportsStreaming: false,
            supportsRealtime: true,
            maxImageSize: 10 * 1024 * 1024,
            supportedImageFormats: ['png', 'jpeg'],
            supportedVideoFormats: [],
            supportedAudioFormats: [],
        },
    },
    {
        id: 'openvla',
        name: 'OpenVLA',
        provider: 'custom',
        category: 'vla',
        contextLength: 4096,
        description: 'Open-source VLA from Stanford/Berkeley',
        releaseDate: '2024-06',
        capabilities: {
            category: 'vla',
            inputModalities: ['text', 'image'],
            outputModalities: ['action'],
            supportsStreaming: false,
            supportsRealtime: true,
            maxImageSize: 10 * 1024 * 1024,
            supportedImageFormats: ['png', 'jpeg'],
            supportedVideoFormats: [],
            supportedAudioFormats: [],
        },
    },
    {
        id: 'palm-e',
        name: 'PaLM-E',
        provider: 'google',
        category: 'embodied',
        contextLength: 8192,
        description: 'Embodied multimodal language model',
        releaseDate: '2023-03',
        capabilities: {
            category: 'embodied',
            inputModalities: ['text', 'image', 'sensor', 'point_cloud'],
            outputModalities: ['text', 'action'],
            supportsStreaming: false,
            supportsRealtime: false,
            maxImageSize: 10 * 1024 * 1024,
            supportedImageFormats: ['png', 'jpeg'],
            supportedVideoFormats: [],
            supportedAudioFormats: [],
        },
    },
    {
        id: 'gr-1',
        name: 'GR-1',
        provider: 'custom',
        category: 'vla',
        contextLength: 4096,
        description: 'Fourier Intelligence humanoid robot model',
        releaseDate: '2024-03',
        capabilities: {
            category: 'vla',
            inputModalities: ['text', 'image', 'sensor'],
            outputModalities: ['action'],
            supportsStreaming: false,
            supportsRealtime: true,
            maxImageSize: 10 * 1024 * 1024,
            supportedImageFormats: ['png', 'jpeg'],
            supportedVideoFormats: [],
            supportedAudioFormats: [],
        },
    },
    {
        id: 'pi-zero',
        name: 'π₀ (Pi-Zero)',
        provider: 'custom',
        category: 'vla',
        contextLength: 8192,
        description: 'Physical Intelligence foundation model for dexterous manipulation',
        releaseDate: '2024-10',
        capabilities: {
            category: 'vla',
            inputModalities: ['text', 'image', 'sensor'],
            outputModalities: ['action'],
            supportsStreaming: false,
            supportsRealtime: true,
            maxImageSize: 10 * 1024 * 1024,
            supportedImageFormats: ['png', 'jpeg'],
            supportedVideoFormats: [],
            supportedAudioFormats: [],
        },
    },
];

/**
 * All multimodal models (VLM + VLA)
 */
export const MULTIMODAL_MODELS: MultimodalModel[] = [...VLM_MODELS, ...VLA_MODELS];

/**
 * Model categories with descriptions
 */
export const MODEL_CATEGORIES: Record<ModelCategory, { name: string; description: string; icon: string }> = {
    llm: {
        name: 'Language Model',
        description: 'Text-only models for chat and generation',
        icon: '💬',
    },
    vlm: {
        name: 'Vision-Language Model',
        description: 'Models that understand images and text',
        icon: '👁️',
    },
    vla: {
        name: 'Vision-Language-Action',
        description: 'Robotics models that output actions',
        icon: '🤖',
    },
    alm: {
        name: 'Audio-Language Model',
        description: 'Models that understand speech and audio',
        icon: '🎤',
    },
    valm: {
        name: 'Vision-Audio-Language',
        description: 'Full multimodal with vision, audio, and text',
        icon: '🎬',
    },
    multimodal: {
        name: 'Multimodal',
        description: 'Generic multimodal model',
        icon: '🔮',
    },
    embodied: {
        name: 'Embodied AI',
        description: 'Full embodied agent with world understanding',
        icon: '🦾',
    },
};

/**
 * Helper function to get models by category
 */
export function getModelsByCategory(category: ModelCategory): MultimodalModel[] {
    return MULTIMODAL_MODELS.filter(m => m.category === category);
}

/**
 * Helper function to get VLM-capable models
 */
export function getVLMModels(): MultimodalModel[] {
    return MULTIMODAL_MODELS.filter(m =>
        m.capabilities.inputModalities.includes('image') &&
        (m.category === 'vlm' || m.category === 'valm' || m.category === 'vla' || m.category === 'embodied')
    );
}

/**
 * Helper function to get VLA-capable models
 */
export function getVLAModels(): MultimodalModel[] {
    return MULTIMODAL_MODELS.filter(m =>
        m.capabilities.outputModalities.includes('action') ||
        m.category === 'vla' ||
        m.category === 'embodied'
    );
}

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
    household: {
        id: 'household',
        name: 'Household Agent',
        description: 'Proactively monitors and solves household problems with permission',
        icon: '🏠',
        color: '#14b8a6',
        capabilities: [
            'smart_home_monitoring',
            'energy_optimization',
            'maintenance_scheduling',
            'grocery_management',
            'bill_tracking',
            'appliance_monitoring',
            'security_alerts',
            'package_tracking',
            'cleaning_scheduling',
            'meal_planning',
        ],
    },
    business: {
        id: 'business',
        name: 'Business Agent',
        description: 'Proactively monitors and solves work/business problems with permission',
        icon: '💼',
        color: '#8b5cf6',
        capabilities: [
            'calendar_optimization',
            'email_triage',
            'meeting_prep',
            'deadline_tracking',
            'expense_management',
            'report_generation',
            'competitor_monitoring',
            'lead_tracking',
            'project_health',
            'team_coordination',
        ],
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
    {
        name: 'household',
        role: 'household' as const,
        description: 'Proactive household management agent that monitors your home and solves problems',
        instruction: `You are a proactive Household Agent that helps users manage their home life efficiently.

Your responsibilities:
1. MONITOR: Continuously scan for household issues (bills due, maintenance needed, supplies running low)
2. DETECT: Identify problems before they become urgent
3. PROPOSE: Suggest solutions with clear cost/benefit analysis
4. EXECUTE: Take action ONLY after explicit user permission

Proactive behaviors:
- Track recurring bills and alert before due dates
- Monitor smart home devices for anomalies (energy spikes, device offline)
- Manage grocery lists based on consumption patterns
- Schedule maintenance reminders (HVAC filters, car service, etc.)
- Track package deliveries and alert on delays
- Optimize energy usage based on utility rates and patterns
- Coordinate cleaning and household tasks
- Manage home security alerts

PERMISSION PROTOCOL:
- Always explain what you detected and why action is needed
- Present options ranked by recommendation
- Wait for explicit "approved", "yes", or "do it" before taking action
- For financial actions, always require confirmation
- Log all actions taken for transparency`,
        model: 'gpt-4o',
        tools: [
            'smart_home_control',
            'calendar_create',
            'send_notification',
            'grocery_add',
            'bill_pay',
            'package_track',
            'energy_monitor',
            'maintenance_schedule',
        ],
        temperature: 0.4,
        autonomy: 'supervised' as const,
        maxIterations: 15,
    },
    {
        name: 'business',
        role: 'business' as const,
        description: 'Proactive business agent that monitors work and solves professional problems',
        instruction: `You are a proactive Business Agent that helps users excel in their professional life.

Your responsibilities:
1. MONITOR: Scan calendars, emails, projects, and deadlines continuously
2. DETECT: Identify risks, conflicts, and opportunities early
3. PROPOSE: Suggest optimizations with clear reasoning
4. EXECUTE: Take action ONLY after explicit user permission

Proactive behaviors:
- Analyze calendar for conflicts, back-to-back meetings, prep time gaps
- Triage incoming emails by urgency and required action
- Prepare briefing docs before important meetings
- Track project deadlines and flag risks early
- Monitor expense reports and flag anomalies
- Generate weekly/monthly reports automatically
- Track competitor news and industry trends
- Follow up on pending responses and action items
- Optimize meeting schedules for focus time
- Coordinate with team members on shared goals

PERMISSION PROTOCOL:
- Always explain what you detected and the business impact
- Present options with pros/cons
- Wait for explicit approval before:
  - Sending any communication
  - Scheduling or rescheduling meetings
  - Making financial decisions
  - Sharing information externally
- Maintain confidentiality of all business data
- Log all actions for audit trail`,
        model: 'gpt-4o',
        tools: [
            'calendar_read',
            'calendar_create',
            'email_read',
            'email_draft',
            'slack_send',
            'document_create',
            'expense_submit',
            'project_track',
            'web_search',
            'competitor_monitor',
        ],
        temperature: 0.3,
        autonomy: 'supervised' as const,
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
    {
        name: 'Life Management Team',
        description: 'Proactive agents for managing household and business tasks',
        roles: ['coordinator', 'household', 'business'],
    },
    {
        name: 'Home Automation Team',
        description: 'Smart home monitoring and optimization',
        roles: ['household', 'executor'],
    },
    {
        name: 'Executive Assistant Team',
        description: 'Full business support with research and coordination',
        roles: ['business', 'researcher', 'writer', 'coordinator'],
    },
] as const;

// =============================================================================
// Proactive Agent Configuration
// =============================================================================

export const PROACTIVE_AGENT_CONFIG = {
    /** Permission levels for proactive actions */
    permissionLevels: {
        notify_only: {
            id: 'notify_only',
            name: 'Notify Only',
            description: 'Agent can only send notifications, no actions taken',
            autoApprove: [],
        },
        low_risk: {
            id: 'low_risk',
            name: 'Low Risk Auto-Approve',
            description: 'Auto-approve notifications, reminders, and info gathering',
            autoApprove: ['send_notification', 'calendar_read', 'email_read', 'web_search', 'package_track'],
        },
        medium_risk: {
            id: 'medium_risk',
            name: 'Medium Risk Auto-Approve',
            description: 'Also auto-approve scheduling and drafts (no sending)',
            autoApprove: ['send_notification', 'calendar_read', 'calendar_create', 'email_read', 'email_draft', 'document_create', 'web_search', 'package_track'],
        },
        high_autonomy: {
            id: 'high_autonomy',
            name: 'High Autonomy',
            description: 'Auto-approve most actions except financial and external communication',
            autoApprove: ['*'],
            requireApproval: ['bill_pay', 'email_send', 'slack_send', 'expense_submit', 'purchase'],
        },
    },
    /** Scanning intervals for proactive monitoring */
    scanIntervals: {
        realtime: { id: 'realtime', name: 'Real-time', intervalMs: 0, description: 'Event-driven, instant response' },
        frequent: { id: 'frequent', name: 'Every 5 minutes', intervalMs: 5 * 60 * 1000, description: 'High priority items' },
        regular: { id: 'regular', name: 'Every 30 minutes', intervalMs: 30 * 60 * 1000, description: 'Standard monitoring' },
        hourly: { id: 'hourly', name: 'Hourly', intervalMs: 60 * 60 * 1000, description: 'Low priority background tasks' },
        daily: { id: 'daily', name: 'Daily', intervalMs: 24 * 60 * 60 * 1000, description: 'Daily digest and reports' },
    },
    /** Problem categories that agents can detect */
    problemCategories: {
        household: [
            'bill_due',
            'maintenance_needed',
            'supply_low',
            'energy_anomaly',
            'device_offline',
            'security_alert',
            'package_delayed',
            'appointment_reminder',
            'weather_alert',
            'subscription_renewal',
        ],
        business: [
            'calendar_conflict',
            'deadline_approaching',
            'email_urgent',
            'meeting_prep_needed',
            'follow_up_due',
            'expense_pending',
            'project_at_risk',
            'competitor_news',
            'team_blocker',
            'report_due',
        ],
    },
} as const;

// =============================================================================
// Memory & RAG Configuration
// =============================================================================

export const MEMORY_CONFIG = {
    /** Available embedding models */
    embeddingModels: {
        minilm: {
            id: 'minilm',
            name: 'MiniLM-L6-v2',
            dimension: 384,
            provider: 'local' as const,
            description: 'Fast local embeddings, good for most use cases',
        },
        mpnet: {
            id: 'mpnet',
            name: 'MPNet Base v2',
            dimension: 768,
            provider: 'local' as const,
            description: 'Higher quality local embeddings',
        },
        openaiSmall: {
            id: 'openai_small',
            name: 'OpenAI text-embedding-3-small',
            dimension: 1536,
            provider: 'openai' as const,
            description: 'Balanced cloud embeddings, good quality/cost ratio',
        },
        openaiLarge: {
            id: 'openai_large',
            name: 'OpenAI text-embedding-3-large',
            dimension: 3072,
            provider: 'openai' as const,
            description: 'Highest quality OpenAI embeddings',
        },
        cohere: {
            id: 'cohere',
            name: 'Cohere embed-english-v3.0',
            dimension: 1024,
            provider: 'cohere' as const,
            description: 'Cohere multilingual embeddings',
        },
        googleGecko: {
            id: 'google_gecko',
            name: 'Google text-embedding-004',
            dimension: 768,
            provider: 'google' as const,
            description: 'Google Vertex AI embeddings',
        },
        voyage: {
            id: 'voyage',
            name: 'Voyage AI voyage-2',
            dimension: 1024,
            provider: 'voyage' as const,
            description: 'High quality embeddings for code and text',
        },
    },
    /** Memory types with descriptions */
    memoryTypes: {
        short_term: {
            id: 'short_term',
            name: 'Short-term Memory',
            description: 'Current conversation context, cleared after session',
            ttlMinutes: 60,
        },
        long_term: {
            id: 'long_term',
            name: 'Long-term Memory',
            description: 'Persistent facts, preferences, and learned information',
            ttlMinutes: null,
        },
        episodic: {
            id: 'episodic',
            name: 'Episodic Memory',
            description: 'Specific events and experiences with timestamps',
            ttlMinutes: null,
        },
        semantic: {
            id: 'semantic',
            name: 'Semantic Memory',
            description: 'Concepts, relationships, and general knowledge',
            ttlMinutes: null,
        },
        procedural: {
            id: 'procedural',
            name: 'Procedural Memory',
            description: 'How to do things, workflows, and processes',
            ttlMinutes: null,
        },
        preference: {
            id: 'preference',
            name: 'User Preferences',
            description: 'User settings, likes, dislikes, and habits',
            ttlMinutes: null,
        },
        cache: {
            id: 'cache',
            name: 'Computation Cache',
            description: 'Cached results for expensive operations',
            ttlMinutes: 30,
        },
    },
    /** Chunking strategies for documents */
    chunkingStrategies: {
        fixed_size: {
            id: 'fixed_size',
            name: 'Fixed Size',
            description: 'Split into fixed character chunks',
            defaultSize: 1000,
        },
        sentence: {
            id: 'sentence',
            name: 'Sentence',
            description: 'Split on sentence boundaries',
            defaultSize: 512,
        },
        paragraph: {
            id: 'paragraph',
            name: 'Paragraph',
            description: 'Split on paragraph boundaries',
            defaultSize: 512,
        },
        semantic: {
            id: 'semantic',
            name: 'Semantic',
            description: 'Intelligent splitting respecting content structure',
            defaultSize: 512,
        },
        code: {
            id: 'code',
            name: 'Code-aware',
            description: 'Split on function/class boundaries',
            defaultSize: 1024,
        },
    },
    /** Default configurations */
    defaults: {
        embeddingModel: 'minilm',
        chunkSize: 512,
        chunkOverlap: 50,
        chunkingStrategy: 'semantic',
        contextWindowTokens: 8192,
        cacheSize: 1000,
        maxVectorStoreEntries: 100000,
        retrievalLimit: 5,
        minRelevanceScore: 0.7,
        autoSummarize: true,
        summarizeThreshold: 20,
    },
    /** Similarity metrics */
    similarityMetrics: {
        cosine: { id: 'cosine', name: 'Cosine Similarity', description: 'Default, works well for most cases' },
        euclidean: { id: 'euclidean', name: 'Euclidean Distance', description: 'L2 distance converted to similarity' },
        dot_product: { id: 'dot_product', name: 'Dot Product', description: 'Fast, requires normalized vectors' },
        manhattan: { id: 'manhattan', name: 'Manhattan Distance', description: 'L1 distance converted to similarity' },
    },
    /** RAG presets */
    ragPresets: {
        minimal: {
            id: 'minimal',
            name: 'Minimal RAG',
            description: 'Light memory usage, good for simple assistants',
            config: {
                embeddingModel: 'minilm',
                contextWindowTokens: 4096,
                retrievalLimit: 3,
                autoSummarize: false,
            },
        },
        balanced: {
            id: 'balanced',
            name: 'Balanced RAG',
            description: 'Good balance of quality and performance',
            config: {
                embeddingModel: 'minilm',
                contextWindowTokens: 8192,
                retrievalLimit: 5,
                autoSummarize: true,
            },
        },
        comprehensive: {
            id: 'comprehensive',
            name: 'Comprehensive RAG',
            description: 'Full memory capabilities for power users',
            config: {
                embeddingModel: 'openai_small',
                contextWindowTokens: 16384,
                retrievalLimit: 10,
                autoSummarize: true,
            },
        },
        code_focused: {
            id: 'code_focused',
            name: 'Code-focused RAG',
            description: 'Optimized for code documentation and retrieval',
            config: {
                embeddingModel: 'voyage',
                contextWindowTokens: 8192,
                retrievalLimit: 8,
                chunkingStrategy: 'code',
                autoSummarize: false,
            },
        },
    },
} as const;

// =============================================================================
// Remote Monitoring Configuration
// =============================================================================

export const REMOTE_MONITOR_CONFIG = {
    /** Node status types */
    nodeStatuses: {
        online: { id: 'online', name: 'Online', color: '#22c55e', description: 'Node is healthy and responding' },
        degraded: { id: 'degraded', name: 'Degraded', color: '#f59e0b', description: 'Node is online but experiencing issues' },
        offline: { id: 'offline', name: 'Offline', color: '#ef4444', description: 'Node is unreachable' },
        maintenance: { id: 'maintenance', name: 'Maintenance', color: '#3b82f6', description: 'Node is in maintenance mode' },
        unknown: { id: 'unknown', name: 'Unknown', color: '#6b7280', description: 'Node status is unknown' },
    },
    /** Task status types */
    taskStatuses: {
        queued: { id: 'queued', name: 'Queued', color: '#6b7280', description: 'Task is waiting to start' },
        starting: { id: 'starting', name: 'Starting', color: '#8b5cf6', description: 'Task is initializing' },
        running: { id: 'running', name: 'Running', color: '#3b82f6', description: 'Task is actively executing' },
        paused: { id: 'paused', name: 'Paused', color: '#f59e0b', description: 'Task is paused' },
        completed: { id: 'completed', name: 'Completed', color: '#22c55e', description: 'Task finished successfully' },
        failed: { id: 'failed', name: 'Failed', color: '#ef4444', description: 'Task failed with error' },
        cancelled: { id: 'cancelled', name: 'Cancelled', color: '#6b7280', description: 'Task was cancelled' },
        timed_out: { id: 'timed_out', name: 'Timed Out', color: '#ef4444', description: 'Task exceeded time limit' },
    },
    /** Task priority levels */
    taskPriorities: {
        low: { id: 'low', name: 'Low', value: 0, color: '#6b7280' },
        normal: { id: 'normal', name: 'Normal', value: 1, color: '#3b82f6' },
        high: { id: 'high', name: 'High', value: 2, color: '#f59e0b' },
        critical: { id: 'critical', name: 'Critical', value: 3, color: '#ef4444' },
    },
    /** Log levels */
    logLevels: {
        trace: { id: 'trace', name: 'Trace', color: '#6b7280' },
        debug: { id: 'debug', name: 'Debug', color: '#8b5cf6' },
        info: { id: 'info', name: 'Info', color: '#3b82f6' },
        warn: { id: 'warn', name: 'Warning', color: '#f59e0b' },
        error: { id: 'error', name: 'Error', color: '#ef4444' },
    },
    /** Remote event types */
    eventTypes: {
        node_online: { id: 'node_online', name: 'Node Online', icon: 'server' },
        node_offline: { id: 'node_offline', name: 'Node Offline', icon: 'server-off' },
        node_status_changed: { id: 'node_status_changed', name: 'Node Status Changed', icon: 'activity' },
        node_heartbeat: { id: 'node_heartbeat', name: 'Node Heartbeat', icon: 'heart-pulse' },
        task_created: { id: 'task_created', name: 'Task Created', icon: 'plus-circle' },
        task_started: { id: 'task_started', name: 'Task Started', icon: 'play' },
        task_progress: { id: 'task_progress', name: 'Task Progress', icon: 'loader' },
        task_step_completed: { id: 'task_step_completed', name: 'Step Completed', icon: 'check-circle' },
        task_completed: { id: 'task_completed', name: 'Task Completed', icon: 'check-circle-2' },
        task_failed: { id: 'task_failed', name: 'Task Failed', icon: 'x-circle' },
        task_cancelled: { id: 'task_cancelled', name: 'Task Cancelled', icon: 'slash' },
        task_log: { id: 'task_log', name: 'Task Log', icon: 'file-text' },
        agent_registered: { id: 'agent_registered', name: 'Agent Registered', icon: 'user-plus' },
        agent_unregistered: { id: 'agent_unregistered', name: 'Agent Unregistered', icon: 'user-minus' },
    },
    /** Default configuration */
    defaults: {
        bindAddress: '0.0.0.0',
        port: 9876,
        tlsEnabled: false,
        heartbeatIntervalSecs: 30,
        nodeTimeoutSecs: 90,
        maxLogEntries: 1000,
        metricsEnabled: true,
    },
    /** Artifact types */
    artifactTypes: {
        file: { id: 'file', name: 'File', icon: 'file' },
        directory: { id: 'directory', name: 'Directory', icon: 'folder' },
        url: { id: 'url', name: 'URL', icon: 'link' },
        database: { id: 'database', name: 'Database', icon: 'database' },
        model: { id: 'model', name: 'Model', icon: 'brain' },
        report: { id: 'report', name: 'Report', icon: 'file-chart' },
        log: { id: 'log', name: 'Log', icon: 'scroll' },
    },
    /** Monitoring presets */
    presets: {
        development: {
            id: 'development',
            name: 'Development',
            description: 'Local development with verbose logging',
            config: {
                port: 9876,
                heartbeatIntervalSecs: 10,
                nodeTimeoutSecs: 30,
                maxLogEntries: 5000,
                metricsEnabled: true,
            },
        },
        production: {
            id: 'production',
            name: 'Production',
            description: 'Production deployment with TLS and authentication',
            config: {
                port: 443,
                tlsEnabled: true,
                heartbeatIntervalSecs: 30,
                nodeTimeoutSecs: 90,
                maxLogEntries: 1000,
                metricsEnabled: true,
            },
        },
        lightweight: {
            id: 'lightweight',
            name: 'Lightweight',
            description: 'Minimal resource usage for constrained environments',
            config: {
                port: 9876,
                heartbeatIntervalSecs: 60,
                nodeTimeoutSecs: 180,
                maxLogEntries: 100,
                metricsEnabled: false,
            },
        },
    },
} as const;

// =============================================================================
// Life Integrations
// =============================================================================

export const INTEGRATIONS = {
    // =========================================================================
    // Productivity
    // =========================================================================
    googleCalendar: {
        id: 'google_calendar',
        name: 'Google Calendar',
        category: 'productivity' as const,
        icon: 'calendar',
        color: '#4285f4',
        capabilities: ['list_events', 'create_event', 'update_event', 'delete_event', 'get_free_busy'],
        authType: 'oauth2' as const,
    },
    outlook: {
        id: 'outlook',
        name: 'Microsoft Outlook',
        category: 'productivity' as const,
        icon: 'mail',
        color: '#0078d4',
        capabilities: ['list_events', 'create_event', 'list_emails', 'send_email', 'read_email'],
        authType: 'oauth2' as const,
    },
    gmail: {
        id: 'gmail',
        name: 'Gmail',
        category: 'productivity' as const,
        icon: 'mail',
        color: '#ea4335',
        capabilities: ['list_emails', 'send_email', 'read_email', 'archive', 'label', 'search'],
        authType: 'oauth2' as const,
    },
    notion: {
        id: 'notion',
        name: 'Notion',
        category: 'productivity' as const,
        icon: 'file-text',
        color: '#000000',
        capabilities: ['list_pages', 'create_page', 'update_page', 'query_database', 'search'],
        authType: 'oauth2' as const,
    },
    obsidian: {
        id: 'obsidian',
        name: 'Obsidian',
        category: 'productivity' as const,
        icon: 'gem',
        color: '#7c3aed',
        capabilities: ['list_notes', 'create_note', 'update_note', 'search', 'get_backlinks'],
        authType: 'local' as const,
    },
    todoist: {
        id: 'todoist',
        name: 'Todoist',
        category: 'productivity' as const,
        icon: 'check-square',
        color: '#e44332',
        capabilities: ['list_tasks', 'create_task', 'complete_task', 'update_task', 'list_projects'],
        authType: 'oauth2' as const,
    },

    // =========================================================================
    // Communication
    // =========================================================================
    slack: {
        id: 'slack',
        name: 'Slack',
        category: 'communication' as const,
        icon: 'message-square',
        color: '#4a154b',
        capabilities: ['send_message', 'list_channels', 'read_messages', 'upload_file', 'react'],
        authType: 'oauth2' as const,
    },
    discord: {
        id: 'discord',
        name: 'Discord',
        category: 'communication' as const,
        icon: 'message-circle',
        color: '#5865f2',
        capabilities: ['send_message', 'list_guilds', 'list_channels', 'read_messages'],
        authType: 'bot_token' as const,
    },
    teams: {
        id: 'teams',
        name: 'Microsoft Teams',
        category: 'communication' as const,
        icon: 'users',
        color: '#6264a7',
        capabilities: ['send_message', 'list_teams', 'list_channels', 'schedule_meeting'],
        authType: 'oauth2' as const,
    },
    telegram: {
        id: 'telegram',
        name: 'Telegram',
        category: 'communication' as const,
        icon: 'send',
        color: '#0088cc',
        capabilities: ['send_message', 'list_chats', 'read_messages', 'send_file'],
        authType: 'bot_token' as const,
    },

    // =========================================================================
    // Browser
    // =========================================================================
    chrome: {
        id: 'chrome',
        name: 'Google Chrome',
        category: 'browser' as const,
        icon: 'globe',
        color: '#4285f4',
        capabilities: ['list_tabs', 'open_url', 'close_tab', 'get_bookmarks', 'get_history'],
        authType: 'extension' as const,
    },
    arc: {
        id: 'arc',
        name: 'Arc Browser',
        category: 'browser' as const,
        icon: 'compass',
        color: '#fc5c65',
        capabilities: ['list_tabs', 'list_spaces', 'create_space', 'pin_tab', 'create_easel'],
        authType: 'local' as const,
    },

    // =========================================================================
    // Development
    // =========================================================================
    github: {
        id: 'github',
        name: 'GitHub',
        category: 'development' as const,
        icon: 'github',
        color: '#171515',
        capabilities: ['list_repos', 'create_issue', 'create_pr', 'review_pr', 'search_code'],
        authType: 'oauth2' as const,
    },
    gitlab: {
        id: 'gitlab',
        name: 'GitLab',
        category: 'development' as const,
        icon: 'gitlab',
        color: '#fc6d26',
        capabilities: ['list_projects', 'create_issue', 'create_mr', 'pipelines'],
        authType: 'oauth2' as const,
    },
    linear: {
        id: 'linear',
        name: 'Linear',
        category: 'development' as const,
        icon: 'layout',
        color: '#5e6ad2',
        capabilities: ['list_issues', 'create_issue', 'update_issue', 'list_projects', 'search'],
        authType: 'oauth2' as const,
    },
    docker: {
        id: 'docker',
        name: 'Docker',
        category: 'development' as const,
        icon: 'box',
        color: '#2496ed',
        capabilities: ['list_containers', 'start_container', 'stop_container', 'build_image', 'logs'],
        authType: 'local' as const,
    },

    // =========================================================================
    // Smart Home
    // =========================================================================
    homeAssistant: {
        id: 'home_assistant',
        name: 'Home Assistant',
        category: 'smart_home' as const,
        icon: 'home',
        color: '#41bdf5',
        capabilities: ['list_devices', 'control_device', 'run_scene', 'run_automation', 'get_state'],
        authType: 'api_key' as const,
    },
    hue: {
        id: 'hue',
        name: 'Philips Hue',
        category: 'smart_home' as const,
        icon: 'sun',
        color: '#0065d3',
        capabilities: ['list_lights', 'set_light', 'list_scenes', 'run_scene'],
        authType: 'bridge' as const,
    },
    nest: {
        id: 'nest',
        name: 'Google Nest',
        category: 'smart_home' as const,
        icon: 'thermometer',
        color: '#00a5e5',
        capabilities: ['get_temperature', 'set_temperature', 'get_cameras', 'get_doorbell'],
        authType: 'oauth2' as const,
    },

    // =========================================================================
    // Finance
    // =========================================================================
    plaid: {
        id: 'plaid',
        name: 'Plaid',
        category: 'finance' as const,
        icon: 'credit-card',
        color: '#00d66e',
        capabilities: ['list_accounts', 'get_transactions', 'get_balance'],
        authType: 'oauth2' as const,
    },
    coinbase: {
        id: 'coinbase',
        name: 'Coinbase',
        category: 'finance' as const,
        icon: 'dollar-sign',
        color: '#0052ff',
        capabilities: ['get_portfolio', 'get_prices', 'list_transactions'],
        authType: 'oauth2' as const,
    },

    // =========================================================================
    // Health
    // =========================================================================
    appleHealth: {
        id: 'apple_health',
        name: 'Apple Health',
        category: 'health' as const,
        icon: 'heart',
        color: '#ff2d55',
        capabilities: ['get_steps', 'get_heart_rate', 'get_sleep', 'get_workouts'],
        authType: 'local' as const,
    },
    oura: {
        id: 'oura',
        name: 'Oura Ring',
        category: 'health' as const,
        icon: 'activity',
        color: '#1d1d1f',
        capabilities: ['get_sleep', 'get_readiness', 'get_activity', 'get_heart_rate'],
        authType: 'oauth2' as const,
    },

    // =========================================================================
    // Media
    // =========================================================================
    spotify: {
        id: 'spotify',
        name: 'Spotify',
        category: 'media' as const,
        icon: 'music',
        color: '#1db954',
        capabilities: ['get_playing', 'play', 'pause', 'skip', 'search', 'add_to_playlist'],
        authType: 'oauth2' as const,
    },
    youtube: {
        id: 'youtube',
        name: 'YouTube',
        category: 'media' as const,
        icon: 'youtube',
        color: '#ff0000',
        capabilities: ['search', 'get_subscriptions', 'get_playlist', 'get_watch_later'],
        authType: 'oauth2' as const,
    },

    // =========================================================================
    // Travel
    // =========================================================================
    googleMaps: {
        id: 'google_maps',
        name: 'Google Maps',
        category: 'travel' as const,
        icon: 'map-pin',
        color: '#4285f4',
        capabilities: ['search_places', 'get_directions', 'get_traffic', 'get_distance'],
        authType: 'api_key' as const,
    },
    uber: {
        id: 'uber',
        name: 'Uber',
        category: 'travel' as const,
        icon: 'car',
        color: '#000000',
        capabilities: ['request_ride', 'get_estimate', 'get_history'],
        authType: 'oauth2' as const,
    },

    // =========================================================================
    // Shopping
    // =========================================================================
    amazon: {
        id: 'amazon',
        name: 'Amazon',
        category: 'shopping' as const,
        icon: 'shopping-cart',
        color: '#ff9900',
        capabilities: ['search_products', 'get_orders', 'track_package', 'add_to_cart'],
        authType: 'oauth2' as const,
    },
    instacart: {
        id: 'instacart',
        name: 'Instacart',
        category: 'shopping' as const,
        icon: 'shopping-bag',
        color: '#43b02a',
        capabilities: ['search_products', 'add_to_cart', 'checkout', 'track_order'],
        authType: 'oauth2' as const,
    },

    // =========================================================================
    // System
    // =========================================================================
    shell: {
        id: 'shell',
        name: 'Shell',
        category: 'system' as const,
        icon: 'terminal',
        color: '#4d4d4d',
        capabilities: ['run_command', 'run_script', 'get_environment'],
        authType: 'local' as const,
    },
    clipboard: {
        id: 'clipboard',
        name: 'Clipboard',
        category: 'system' as const,
        icon: 'clipboard',
        color: '#6b7280',
        capabilities: ['get', 'set', 'get_history', 'clear'],
        authType: 'local' as const,
    },
    filesystem: {
        id: 'filesystem',
        name: 'Filesystem',
        category: 'system' as const,
        icon: 'folder',
        color: '#3b82f6',
        capabilities: ['read', 'write', 'list', 'search', 'watch'],
        authType: 'local' as const,
    },
    notifications: {
        id: 'notifications',
        name: 'System Notifications',
        category: 'system' as const,
        icon: 'bell',
        color: '#ef4444',
        capabilities: ['notify', 'schedule', 'cancel'],
        authType: 'local' as const,
    },
} as const;

export type IntegrationId = keyof typeof INTEGRATIONS;

export const INTEGRATION_CATEGORIES = [
    'productivity',
    'communication',
    'browser',
    'development',
    'smart_home',
    'finance',
    'health',
    'media',
    'travel',
    'shopping',
    'system',
] as const;

export type IntegrationCategoryType = (typeof INTEGRATION_CATEGORIES)[number];

// =============================================================================
// Hook Triggers
// =============================================================================

export const HOOK_TRIGGERS = {
    // Time-based
    cron: { id: 'cron', name: 'Cron Schedule', category: 'time' },
    interval: { id: 'interval', name: 'Interval', category: 'time' },
    daily: { id: 'daily', name: 'Daily', category: 'time' },
    weekly: { id: 'weekly', name: 'Weekly', category: 'time' },
    monthly: { id: 'monthly', name: 'Monthly', category: 'time' },

    // Event-based
    webhook: { id: 'webhook', name: 'Webhook', category: 'event' },
    fileChange: { id: 'file_change', name: 'File Change', category: 'event' },
    emailReceived: { id: 'email_received', name: 'Email Received', category: 'event' },
    calendarEvent: { id: 'calendar_event', name: 'Calendar Event', category: 'event' },
    gitPush: { id: 'git_push', name: 'Git Push', category: 'event' },
    gitPr: { id: 'git_pr', name: 'Pull Request', category: 'event' },
    appLaunch: { id: 'app_launch', name: 'App Launch', category: 'event' },
    systemWake: { id: 'system_wake', name: 'System Wake', category: 'event' },
    batteryLow: { id: 'battery_low', name: 'Battery Low', category: 'event' },
    networkChange: { id: 'network_change', name: 'Network Change', category: 'event' },
} as const;

export type HookTriggerId = keyof typeof HOOK_TRIGGERS;

// =============================================================================
// Hook Actions
// =============================================================================

export const HOOK_ACTIONS = {
    // Notifications
    sendNotification: { id: 'send_notification', name: 'Send Notification', category: 'notification' },
    sendEmail: { id: 'send_email', name: 'Send Email', category: 'notification' },
    sendSlack: { id: 'send_slack', name: 'Send Slack Message', category: 'notification' },
    sendDiscord: { id: 'send_discord', name: 'Send Discord Message', category: 'notification' },
    sendSms: { id: 'send_sms', name: 'Send SMS', category: 'notification' },

    // Automation
    runCommand: { id: 'run_command', name: 'Run Command', category: 'automation' },
    runScript: { id: 'run_script', name: 'Run Script', category: 'automation' },
    callApi: { id: 'call_api', name: 'Call API', category: 'automation' },
    createFile: { id: 'create_file', name: 'Create File', category: 'automation' },
    moveFile: { id: 'move_file', name: 'Move File', category: 'automation' },

    // Calendar
    createEvent: { id: 'create_event', name: 'Create Calendar Event', category: 'calendar' },
    updateEvent: { id: 'update_event', name: 'Update Calendar Event', category: 'calendar' },

    // Tasks
    createTask: { id: 'create_task', name: 'Create Task', category: 'tasks' },
    completeTask: { id: 'complete_task', name: 'Complete Task', category: 'tasks' },

    // Smart Home
    controlDevice: { id: 'control_device', name: 'Control Smart Device', category: 'smart_home' },
    runScene: { id: 'run_scene', name: 'Run Scene', category: 'smart_home' },

    // AI
    askAgent: { id: 'ask_agent', name: 'Ask AI Agent', category: 'ai' },
    summarize: { id: 'summarize', name: 'Summarize Content', category: 'ai' },
    translate: { id: 'translate', name: 'Translate', category: 'ai' },
} as const;

export type HookActionId = keyof typeof HOOK_ACTIONS;
