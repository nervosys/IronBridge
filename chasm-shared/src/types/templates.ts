// =============================================================================
// Session Templates Types
// =============================================================================
// Types for reusable session templates

/**
 * A reusable session template
 */
export interface SessionTemplate {
    id: string;
    name: string;
    description?: string;
    category: TemplateCategory;

    // Template content
    systemPrompt?: string;
    initialMessages?: TemplateMessage[];
    suggestedQueries?: string[];

    // Configuration
    preferredProvider?: string;
    preferredModel?: string;
    parameters?: ModelParameters;

    // Metadata
    tags?: string[];
    icon?: string;
    color?: string;
    isBuiltIn?: boolean;
    isPublic?: boolean;

    // Usage tracking
    usageCount: number;
    lastUsedAt?: string;
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
}

/**
 * Template message structure
 */
export interface TemplateMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    placeholder?: boolean; // If true, content is a placeholder to be filled
}

/**
 * Model parameters for templates
 */
export interface ModelParameters {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stopSequences?: string[];
}

/**
 * Template categories
 */
export type TemplateCategory =
    | 'coding'
    | 'writing'
    | 'analysis'
    | 'research'
    | 'debugging'
    | 'documentation'
    | 'learning'
    | 'creative'
    | 'business'
    | 'custom';

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; name: string; icon: string; description: string }[] = [
    { id: 'coding', name: 'Coding', icon: 'code', description: 'Code generation and development' },
    { id: 'debugging', name: 'Debugging', icon: 'bug', description: 'Bug fixing and troubleshooting' },
    { id: 'documentation', name: 'Documentation', icon: 'file-text', description: 'Writing docs and comments' },
    { id: 'analysis', name: 'Analysis', icon: 'bar-chart', description: 'Code review and analysis' },
    { id: 'research', name: 'Research', icon: 'search', description: 'Research and exploration' },
    { id: 'writing', name: 'Writing', icon: 'edit', description: 'Content and copy writing' },
    { id: 'learning', name: 'Learning', icon: 'book-open', description: 'Learning and tutorials' },
    { id: 'creative', name: 'Creative', icon: 'sparkles', description: 'Brainstorming and ideation' },
    { id: 'business', name: 'Business', icon: 'briefcase', description: 'Business and planning' },
    { id: 'custom', name: 'Custom', icon: 'settings', description: 'Custom templates' },
];

// =============================================================================
// Built-in Templates
// =============================================================================

export const BUILTIN_TEMPLATES: Omit<SessionTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>[] = [
    {
        name: 'Code Review',
        description: 'Review code for bugs, security issues, and best practices',
        category: 'analysis',
        systemPrompt: 'You are an expert code reviewer. Analyze the provided code for bugs, security vulnerabilities, performance issues, and adherence to best practices. Provide specific, actionable feedback.',
        suggestedQueries: [
            'Review this code for security issues',
            'What are the potential bugs in this code?',
            'How can I improve the performance of this code?',
            'Does this code follow best practices?',
        ],
        tags: ['review', 'quality'],
        icon: 'eye',
        color: '#3b82f6',
        isBuiltIn: true,
    },
    {
        name: 'Debug Helper',
        description: 'Help debug issues and find root causes',
        category: 'debugging',
        systemPrompt: 'You are an expert debugger. Help identify the root cause of bugs and issues. Ask clarifying questions, suggest debugging strategies, and provide step-by-step troubleshooting guidance.',
        suggestedQueries: [
            'Help me debug this error',
            'Why is this returning undefined?',
            'What could cause this race condition?',
            'How do I trace this issue?',
        ],
        tags: ['debug', 'troubleshoot'],
        icon: 'bug',
        color: '#ef4444',
        isBuiltIn: true,
    },
    {
        name: 'Documentation Writer',
        description: 'Generate documentation, comments, and README files',
        category: 'documentation',
        systemPrompt: 'You are a technical writer specializing in software documentation. Write clear, concise, and comprehensive documentation. Include examples where appropriate.',
        suggestedQueries: [
            'Write documentation for this function',
            'Generate a README for this project',
            'Add JSDoc comments to this code',
            'Explain how this API works',
        ],
        tags: ['docs', 'readme'],
        icon: 'file-text',
        color: '#22c55e',
        isBuiltIn: true,
    },
    {
        name: 'Refactoring Assistant',
        description: 'Help refactor and improve code structure',
        category: 'coding',
        systemPrompt: 'You are a software architect specializing in code refactoring. Suggest ways to improve code structure, reduce complexity, and enhance maintainability while preserving functionality.',
        suggestedQueries: [
            'How can I refactor this to be more maintainable?',
            'Suggest a better design pattern for this',
            'Help me reduce the complexity of this function',
            'How can I make this code more testable?',
        ],
        tags: ['refactor', 'clean-code'],
        icon: 'refresh-cw',
        color: '#8b5cf6',
        isBuiltIn: true,
    },
    {
        name: 'Test Writer',
        description: 'Generate unit tests and test cases',
        category: 'coding',
        systemPrompt: 'You are a testing expert. Generate comprehensive unit tests with good coverage. Include edge cases, error scenarios, and follow testing best practices.',
        suggestedQueries: [
            'Write unit tests for this function',
            'What edge cases should I test?',
            'Generate integration tests for this API',
            'Help me improve test coverage',
        ],
        tags: ['testing', 'unit-tests'],
        icon: 'check-circle',
        color: '#10b981',
        isBuiltIn: true,
    },
    {
        name: 'Learning Tutor',
        description: 'Explain concepts and help learn new technologies',
        category: 'learning',
        systemPrompt: 'You are a patient and knowledgeable tutor. Explain concepts clearly, provide examples, and adapt your explanations to the learner\'s level. Encourage questions and provide resources for further learning.',
        suggestedQueries: [
            'Explain how async/await works',
            'What is the difference between X and Y?',
            'Help me understand this concept',
            'Give me a simple example of...',
        ],
        tags: ['learning', 'tutorial'],
        icon: 'book-open',
        color: '#f59e0b',
        isBuiltIn: true,
    },
    {
        name: 'API Designer',
        description: 'Design and plan REST or GraphQL APIs',
        category: 'analysis',
        systemPrompt: 'You are an API architect. Help design clean, RESTful APIs with proper resource naming, HTTP methods, status codes, and documentation. Consider scalability, versioning, and developer experience.',
        suggestedQueries: [
            'Design an API for this feature',
            'What endpoints do I need for this?',
            'Review my API design',
            'How should I structure this GraphQL schema?',
        ],
        tags: ['api', 'design'],
        icon: 'globe',
        color: '#06b6d4',
        isBuiltIn: true,
    },
    {
        name: 'SQL Helper',
        description: 'Write and optimize SQL queries',
        category: 'coding',
        systemPrompt: 'You are a database expert. Help write efficient SQL queries, design schemas, and optimize database performance. Explain query execution plans and suggest indexes when appropriate.',
        suggestedQueries: [
            'Write a SQL query to...',
            'How can I optimize this query?',
            'Design a schema for this data',
            'Explain this query execution plan',
        ],
        tags: ['sql', 'database'],
        icon: 'database',
        color: '#6366f1',
        isBuiltIn: true,
    },
];
