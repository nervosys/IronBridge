/**
 * Summarization Types
 *
 * Types for AI-powered session summarization and intelligent insights.
 * Supports local LLMs, cloud APIs, and configurable summarization strategies.
 */

// =============================================================================
// Summary Configuration
// =============================================================================

/**
 * Summarization configuration
 */
export interface SummarizationConfig {
    id: string;
    name: string;
    provider: SummarizationProvider;
    model: string;
    strategy: SummarizationStrategy;
    options: SummarizationOptions;
    isDefault: boolean;
    createdAt: number;
    updatedAt: number;
}

export type SummarizationProvider =
    | 'local'       // Local LLM (Ollama, LM Studio, etc.)
    | 'openai'      // OpenAI API
    | 'anthropic'   // Anthropic Claude
    | 'azure'       // Azure OpenAI
    | 'foundry'     // Azure AI Foundry
    | 'google'      // Google Gemini
    | 'custom';     // Custom endpoint

export type SummarizationStrategy =
    | 'extractive'    // Extract key sentences
    | 'abstractive'   // Generate new summary text
    | 'hierarchical'  // Multi-level summaries
    | 'incremental'   // Update summary as session grows
    | 'comparative';  // Compare with other sessions

export interface SummarizationOptions {
    maxTokens: number;
    temperature: number;
    topP?: number;
    includeCodeBlocks: boolean;
    includeToolCalls: boolean;
    includeFileChanges: boolean;
    languagePreference?: string;
    customPrompt?: string;
    chunkSize?: number;
    overlapSize?: number;
}

// =============================================================================
// Session Summary
// =============================================================================

/**
 * Generated session summary
 */
export interface SessionSummary {
    id: string;
    sessionId: string;
    configId: string;
    version: number;
    type: SummaryType;
    title: string;
    synopsis: string;
    sections: SummarySection[];
    keyPoints: KeyPoint[];
    codeHighlights: CodeHighlight[];
    fileChanges: FileChangeSummary[];
    decisions: Decision[];
    actionItems: ActionItem[];
    tags: string[];
    sentiment?: SentimentAnalysis;
    metrics: SummaryMetrics;
    generatedAt: number;
    expiresAt?: number;
}

export type SummaryType =
    | 'brief'       // 1-2 sentences
    | 'standard'    // Paragraph summary
    | 'detailed'    // Multi-section with highlights
    | 'technical'   // Focus on code/technical details
    | 'executive';  // High-level business summary

/**
 * Section of a detailed summary
 */
export interface SummarySection {
    id: string;
    title: string;
    content: string;
    messageRange: {
        startId: string;
        endId: string;
        count: number;
    };
    importance: ImportanceLevel;
    topics: string[];
}

export type ImportanceLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Key point extracted from session
 */
export interface KeyPoint {
    id: string;
    content: string;
    messageId: string;
    category: KeyPointCategory;
    confidence: number;
}

export type KeyPointCategory =
    | 'requirement'
    | 'decision'
    | 'problem'
    | 'solution'
    | 'insight'
    | 'question'
    | 'action';

/**
 * Code highlight from session
 */
export interface CodeHighlight {
    id: string;
    messageId: string;
    language: string;
    code: string;
    description: string;
    purpose: CodePurpose;
    filePath?: string;
    lineRange?: { start: number; end: number };
}

export type CodePurpose =
    | 'implementation'
    | 'fix'
    | 'refactor'
    | 'example'
    | 'test'
    | 'configuration';

/**
 * File change summary
 */
export interface FileChangeSummary {
    filePath: string;
    changeType: 'created' | 'modified' | 'deleted' | 'renamed';
    description: string;
    linesAdded: number;
    linesRemoved: number;
    messageIds: string[];
}

/**
 * Decision made during session
 */
export interface Decision {
    id: string;
    content: string;
    rationale?: string;
    messageId: string;
    alternatives?: string[];
    impact: ImportanceLevel;
}

/**
 * Action item extracted from session
 */
export interface ActionItem {
    id: string;
    content: string;
    messageId: string;
    status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
    priority: ImportanceLevel;
    assignee?: string;
    dueDate?: number;
}

/**
 * Sentiment analysis of session
 */
export interface SentimentAnalysis {
    overall: SentimentScore;
    progression: SentimentScore[];
    frustrationPoints: string[];
    successPoints: string[];
}

export interface SentimentScore {
    positive: number;
    negative: number;
    neutral: number;
    label: 'positive' | 'negative' | 'neutral' | 'mixed';
}

/**
 * Summary generation metrics
 */
export interface SummaryMetrics {
    inputTokens: number;
    outputTokens: number;
    processingTimeMs: number;
    messagesCovered: number;
    compressionRatio: number;
}

// =============================================================================
// Incremental Summaries
// =============================================================================

/**
 * Incremental summary state
 */
export interface IncrementalSummaryState {
    sessionId: string;
    currentSummary: SessionSummary;
    lastProcessedMessageId: string;
    lastProcessedMessageIndex: number;
    pendingMessages: number;
    updateScheduledAt?: number;
    history: SummaryVersion[];
}

export interface SummaryVersion {
    version: number;
    summaryId: string;
    messageCount: number;
    createdAt: number;
}

/**
 * Summary update trigger
 */
export interface SummaryUpdateTrigger {
    type: 'message_count' | 'time_elapsed' | 'topic_change' | 'manual';
    threshold?: number; // Messages or seconds
    enabled: boolean;
}

// =============================================================================
// Comparative Summaries
// =============================================================================

/**
 * Comparison between sessions
 */
export interface SessionComparison {
    id: string;
    sessionIds: string[];
    commonTopics: string[];
    uniqueTopics: Record<string, string[]>;
    similarityScore: number;
    keyDifferences: ComparisonDifference[];
    insights: string[];
    generatedAt: number;
}

export interface ComparisonDifference {
    category: string;
    sessionA: string;
    sessionB: string;
    description: string;
}

// =============================================================================
// Topic & Entity Extraction
// =============================================================================

/**
 * Extracted topic
 */
export interface ExtractedTopic {
    id: string;
    name: string;
    description?: string;
    frequency: number;
    firstMentionId: string;
    lastMentionId: string;
    relatedTopics: string[];
    confidence: number;
}

/**
 * Extracted entity
 */
export interface ExtractedEntity {
    id: string;
    name: string;
    type: EntityType;
    mentions: EntityMention[];
    metadata?: Record<string, unknown>;
}

export type EntityType =
    | 'file'
    | 'function'
    | 'class'
    | 'variable'
    | 'package'
    | 'url'
    | 'person'
    | 'organization'
    | 'technology';

export interface EntityMention {
    messageId: string;
    startIndex: number;
    endIndex: number;
    context: string;
}

// =============================================================================
// Summary Templates
// =============================================================================

/**
 * Custom summary template
 */
export interface SummaryTemplate {
    id: string;
    name: string;
    description?: string;
    type: SummaryType;
    systemPrompt: string;
    userPromptTemplate: string;
    outputSchema?: Record<string, unknown>;
    variables: TemplateVariable[];
    isBuiltIn: boolean;
    createdAt: number;
    updatedAt: number;
}

export interface TemplateVariable {
    name: string;
    description: string;
    type: 'string' | 'number' | 'boolean' | 'array';
    required: boolean;
    defaultValue?: unknown;
}

// =============================================================================
// API Types
// =============================================================================

/**
 * Generate summary request
 */
export interface GenerateSummaryRequest {
    sessionId: string;
    type?: SummaryType;
    configId?: string;
    templateId?: string;
    options?: Partial<SummarizationOptions>;
    messageRange?: {
        startId?: string;
        endId?: string;
    };
    forceRegenerate?: boolean;
}

/**
 * Generate summary response
 */
export interface GenerateSummaryResponse {
    summary: SessionSummary;
    cached: boolean;
    processingTime: number;
    warnings?: string[];
}

/**
 * Compare sessions request
 */
export interface CompareSessionsRequest {
    sessionIds: string[];
    focusAreas?: string[];
}

/**
 * Batch summarization request
 */
export interface BatchSummarizeRequest {
    sessionIds: string[];
    type: SummaryType;
    configId?: string;
    concurrency?: number;
}

export interface BatchSummarizeProgress {
    total: number;
    completed: number;
    failed: number;
    currentSessionId?: string;
}

// =============================================================================
// Provider Configuration
// =============================================================================

/**
 * Local LLM provider config
 */
export interface LocalLLMConfig {
    type: 'ollama' | 'lmstudio' | 'llamacpp' | 'custom';
    endpoint: string;
    model: string;
    contextLength: number;
}

/**
 * Cloud provider config
 */
export interface CloudProviderConfig {
    provider: SummarizationProvider;
    apiKey?: string; // Stored encrypted
    endpoint?: string;
    model: string;
    organization?: string;
    project?: string;
}

// =============================================================================
// Constants & Defaults
// =============================================================================

/**
 * Default summarization options
 */
export const DEFAULT_SUMMARIZATION_OPTIONS: SummarizationOptions = {
    maxTokens: 1024,
    temperature: 0.3,
    topP: 0.9,
    includeCodeBlocks: true,
    includeToolCalls: true,
    includeFileChanges: true,
    chunkSize: 4000,
    overlapSize: 200,
};

/**
 * Summary type configurations
 */
export const SUMMARY_TYPE_CONFIG: Record<SummaryType, {
    maxTokens: number;
    temperature: number;
    description: string;
}> = {
    brief: {
        maxTokens: 128,
        temperature: 0.2,
        description: 'A concise 1-2 sentence overview',
    },
    standard: {
        maxTokens: 512,
        temperature: 0.3,
        description: 'A paragraph-length summary with key points',
    },
    detailed: {
        maxTokens: 2048,
        temperature: 0.4,
        description: 'Multi-section summary with code highlights',
    },
    technical: {
        maxTokens: 2048,
        temperature: 0.2,
        description: 'Technical deep-dive with code and architecture',
    },
    executive: {
        maxTokens: 1024,
        temperature: 0.3,
        description: 'High-level business-focused summary',
    },
};

/**
 * Built-in summary templates
 */
export const BUILT_IN_TEMPLATES: Pick<SummaryTemplate, 'id' | 'name' | 'type'>[] = [
    { id: 'changelog', name: 'Changelog Entry', type: 'technical' },
    { id: 'standup', name: 'Standup Update', type: 'brief' },
    { id: 'code-review', name: 'Code Review Summary', type: 'technical' },
    { id: 'meeting-notes', name: 'Meeting Notes', type: 'detailed' },
    { id: 'project-status', name: 'Project Status Report', type: 'executive' },
];

/**
 * Estimate tokens for a message
 */
export function estimateTokens(text: string): number {
    // Rough approximation: ~4 characters per token for English
    return Math.ceil(text.length / 4);
}

/**
 * Calculate compression ratio
 */
export function calculateCompressionRatio(
    inputTokens: number,
    outputTokens: number
): number {
    if (inputTokens === 0) return 0;
    return Number(((inputTokens - outputTokens) / inputTokens).toFixed(3));
}
