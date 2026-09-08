// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

/**
 * Semantic Search Types
 *
 * Types for embedding-based semantic search, vector storage,
 * and intelligent session/message retrieval.
 */

// =============================================================================
// Embedding Configuration
// =============================================================================

/**
 * Embedding provider configuration
 */
export interface EmbeddingConfig {
    id: string;
    name: string;
    provider: EmbeddingProvider;
    model: string;
    dimensions: number;
    maxTokens: number;
    batchSize: number;
    endpoint?: string;
    isDefault: boolean;
    createdAt: number;
    updatedAt: number;
}

export type EmbeddingProvider =
    | 'local'           // Local models (sentence-transformers)
    | 'openai'          // OpenAI embeddings
    | 'azure'           // Azure OpenAI embeddings
    | 'foundry'         // Azure AI Foundry
    | 'cohere'          // Cohere embeddings
    | 'voyage'          // Voyage AI
    | 'ollama'          // Ollama embeddings
    | 'huggingface'     // HuggingFace Inference API
    | 'custom';         // Custom endpoint

/**
 * Embedding model info
 */
export interface EmbeddingModelInfo {
    provider: EmbeddingProvider;
    model: string;
    dimensions: number;
    maxTokens: number;
    description: string;
    costPer1kTokens?: number;
}

// =============================================================================
// Vector Storage
// =============================================================================

/**
 * Vector store configuration
 */
export interface VectorStoreConfig {
    id: string;
    name: string;
    type: VectorStoreType;
    embeddingConfigId: string;
    indexSettings: IndexSettings;
    connectionString?: string; // Encrypted
    metadata: Record<string, unknown>;
    createdAt: number;
    updatedAt: number;
}

export type VectorStoreType =
    | 'memory'      // In-memory (for small datasets)
    | 'sqlite-vec'  // SQLite with vec extension
    | 'chromadb'    // ChromaDB
    | 'qdrant'      // Qdrant
    | 'pinecone'    // Pinecone
    | 'weaviate'    // Weaviate
    | 'milvus'      // Milvus
    | 'pgvector';   // PostgreSQL with pgvector

export interface IndexSettings {
    indexType: IndexType;
    metric: DistanceMetric;
    efConstruction?: number;  // HNSW build-time parameter
    efSearch?: number;        // HNSW search-time parameter
    m?: number;               // HNSW max connections
    nlist?: number;           // IVF clusters
    nprobe?: number;          // IVF search clusters
}

export type IndexType = 'flat' | 'hnsw' | 'ivf' | 'pq' | 'hybrid';
export type DistanceMetric = 'cosine' | 'euclidean' | 'dot' | 'manhattan';

// =============================================================================
// Embeddings
// =============================================================================

/**
 * Document embedding
 */
export interface Embedding {
    id: string;
    vector: number[];
    documentType: EmbeddableType;
    documentId: string;
    content: string;
    contentHash: string;
    metadata: EmbeddingMetadata;
    configId: string;
    createdAt: number;
    updatedAt: number;
}

export type EmbeddableType =
    | 'session'
    | 'message'
    | 'summary'
    | 'code_block'
    | 'file_change'
    | 'comment'
    | 'annotation';

export interface EmbeddingMetadata {
    sessionId: string;
    workspaceId?: string;
    messageId?: string;
    role?: string;
    model?: string;
    language?: string;
    filePath?: string;
    timestamp: number;
    tokenCount: number;
    chunkIndex?: number;
    totalChunks?: number;
    tags?: string[];
}

/**
 * Chunked content for embedding
 */
export interface EmbeddingChunk {
    id: string;
    parentId: string;
    content: string;
    startIndex: number;
    endIndex: number;
    chunkIndex: number;
    totalChunks: number;
    overlap: number;
}

// =============================================================================
// Search Types
// =============================================================================

/**
 * Semantic search query
 */
export interface SemanticSearchQuery {
    text: string;
    embedding?: number[]; // Pre-computed embedding
    filters?: SearchFilters;
    options?: SearchOptions;
}

export interface SearchFilters {
    documentTypes?: EmbeddableType[];
    sessionIds?: string[];
    workspaceIds?: string[];
    providers?: string[];
    dateRange?: {
        start?: number;
        end?: number;
    };
    tags?: string[];
    models?: string[];
    languages?: string[];
    hasCode?: boolean;
    hasFileChanges?: boolean;
    minScore?: number;
}

export interface SearchOptions {
    limit?: number;
    offset?: number;
    includeMetadata?: boolean;
    includeContent?: boolean;
    includeHighlights?: boolean;
    rerank?: boolean;
    rerankModel?: string;
    hybridWeight?: number; // 0 = pure keyword, 1 = pure semantic
    groupBy?: GroupByOption;
    deduplicate?: boolean;
}

export type GroupByOption = 'session' | 'workspace' | 'date' | 'none';

/**
 * Semantic search result
 */
export interface SemanticSearchResult {
    id: string;
    documentType: EmbeddableType;
    documentId: string;
    score: number;
    rerankScore?: number;
    content: string;
    highlights?: SearchHighlight[];
    metadata: EmbeddingMetadata;
    session?: SearchResultSession;
}

export interface SearchHighlight {
    field: string;
    snippet: string;
    matchPositions: Array<{ start: number; end: number }>;
}

export interface SearchResultSession {
    id: string;
    title: string;
    provider: string;
    workspaceId: string;
    workspaceName?: string;
    messageCount: number;
    createdAt: number;
}

/**
 * Grouped search results
 */
export interface GroupedSearchResults {
    groups: SearchResultGroup[];
    totalResults: number;
    totalGroups: number;
    queryEmbedding?: number[];
}

export interface SearchResultGroup {
    key: string;
    label: string;
    results: SemanticSearchResult[];
    topScore: number;
    totalInGroup: number;
}

// =============================================================================
// Hybrid Search
// =============================================================================

/**
 * Hybrid search combines semantic and keyword search
 */
export interface HybridSearchQuery {
    text: string;
    semanticWeight: number; // 0-1, where 1 is pure semantic
    keywordBoosts?: KeywordBoost[];
    filters?: SearchFilters;
    options?: SearchOptions;
}

export interface KeywordBoost {
    keyword: string;
    boost: number;
    field?: string;
}

/**
 * Hybrid search result with both scores
 */
export interface HybridSearchResult extends SemanticSearchResult {
    keywordScore: number;
    semanticScore: number;
    combinedScore: number;
    matchedKeywords?: string[];
}

// =============================================================================
// Similar Documents
// =============================================================================

/**
 * Find similar documents request
 */
export interface FindSimilarRequest {
    documentType: EmbeddableType;
    documentId: string;
    embedding?: number[];
    limit?: number;
    minScore?: number;
    excludeSameSession?: boolean;
    filters?: SearchFilters;
}

/**
 * Similar document result
 */
export interface SimilarDocument {
    documentType: EmbeddableType;
    documentId: string;
    similarity: number;
    content: string;
    metadata: EmbeddingMetadata;
}

// =============================================================================
// Index Management
// =============================================================================

/**
 * Index status and statistics
 */
export interface VectorIndexStatus {
    storeId: string;
    storeName: string;
    storeType: VectorStoreType;
    documentCount: number;
    embeddingCount: number;
    dimensionality: number;
    indexSize: number; // bytes
    lastIndexedAt?: number;
    isIndexing: boolean;
    pendingDocuments: number;
    health: IndexHealth;
}

export type IndexHealth = 'healthy' | 'degraded' | 'unhealthy' | 'rebuilding';

/**
 * Index build progress
 */
export interface IndexBuildProgress {
    storeId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    totalDocuments: number;
    processedDocuments: number;
    failedDocuments: number;
    startedAt: number;
    estimatedCompletionAt?: number;
    currentDocument?: string;
    errors?: string[];
}

/**
 * Index rebuild request
 */
export interface RebuildIndexRequest {
    storeId: string;
    filters?: {
        documentTypes?: EmbeddableType[];
        sessionIds?: string[];
        dateRange?: { start?: number; end?: number };
    };
    force?: boolean;
}

// =============================================================================
// Batch Operations
// =============================================================================

/**
 * Batch embed request
 */
export interface BatchEmbedRequest {
    documents: EmbedDocument[];
    configId?: string;
    storeId?: string;
    upsert?: boolean;
}

export interface EmbedDocument {
    id: string;
    content: string;
    documentType: EmbeddableType;
    metadata: Partial<EmbeddingMetadata>;
}

/**
 * Batch embed response
 */
export interface BatchEmbedResponse {
    embedded: number;
    failed: number;
    errors?: Array<{ id: string; error: string }>;
    processingTime: number;
}

// =============================================================================
// Search Analytics
// =============================================================================

/**
 * Search analytics
 */
export interface SearchAnalytics {
    queryId: string;
    query: string;
    timestamp: number;
    resultCount: number;
    topScore: number;
    processingTimeMs: number;
    filters: SearchFilters;
    clickedResults?: string[];
}

/**
 * Popular search queries
 */
export interface PopularQuery {
    query: string;
    count: number;
    avgResultCount: number;
    avgTopScore: number;
    lastSearchedAt: number;
}

// =============================================================================
// API Types
// =============================================================================

/**
 * Search request
 */
export interface SearchRequest {
    query: string;
    type?: 'semantic' | 'keyword' | 'hybrid';
    filters?: SearchFilters;
    options?: SearchOptions;
}

/**
 * Search response
 */
export interface SearchResponse {
    results: SemanticSearchResult[];
    total: number;
    hasMore: boolean;
    queryId: string;
    processingTime: number;
    queryEmbedding?: number[];
}

/**
 * Suggest completions request
 */
export interface SuggestRequest {
    prefix: string;
    limit?: number;
    filters?: SearchFilters;
}

/**
 * Suggestion result
 */
export interface Suggestion {
    text: string;
    score: number;
    type: 'recent' | 'popular' | 'semantic';
    metadata?: Record<string, unknown>;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Popular embedding models
 */
export const EMBEDDING_MODELS: EmbeddingModelInfo[] = [
    // OpenAI
    {
        provider: 'openai',
        model: 'text-embedding-3-small',
        dimensions: 1536,
        maxTokens: 8191,
        description: 'Fast, efficient embeddings',
        costPer1kTokens: 0.00002,
    },
    {
        provider: 'openai',
        model: 'text-embedding-3-large',
        dimensions: 3072,
        maxTokens: 8191,
        description: 'Highest quality embeddings',
        costPer1kTokens: 0.00013,
    },
    // Azure
    {
        provider: 'azure',
        model: 'text-embedding-ada-002',
        dimensions: 1536,
        maxTokens: 8191,
        description: 'Azure OpenAI embeddings',
    },
    // Cohere
    {
        provider: 'cohere',
        model: 'embed-english-v3.0',
        dimensions: 1024,
        maxTokens: 512,
        description: 'High-quality English embeddings',
    },
    {
        provider: 'cohere',
        model: 'embed-multilingual-v3.0',
        dimensions: 1024,
        maxTokens: 512,
        description: 'Multilingual embeddings',
    },
    // Local
    {
        provider: 'local',
        model: 'all-MiniLM-L6-v2',
        dimensions: 384,
        maxTokens: 256,
        description: 'Fast local model for testing',
    },
    {
        provider: 'local',
        model: 'all-mpnet-base-v2',
        dimensions: 768,
        maxTokens: 384,
        description: 'High-quality local model',
    },
    // Ollama
    {
        provider: 'ollama',
        model: 'nomic-embed-text',
        dimensions: 768,
        maxTokens: 8192,
        description: 'Local embeddings via Ollama',
    },
    {
        provider: 'ollama',
        model: 'mxbai-embed-large',
        dimensions: 1024,
        maxTokens: 512,
        description: 'High-quality Ollama embeddings',
    },
];

/**
 * Default search options
 */
export const DEFAULT_SEARCH_OPTIONS: Required<SearchOptions> = {
    limit: 20,
    offset: 0,
    includeMetadata: true,
    includeContent: true,
    includeHighlights: true,
    rerank: false,
    rerankModel: 'cohere-rerank-v3',
    hybridWeight: 0.7,
    groupBy: 'none',
    deduplicate: true,
};

/**
 * Default index settings
 */
export const DEFAULT_INDEX_SETTINGS: IndexSettings = {
    indexType: 'hnsw',
    metric: 'cosine',
    efConstruction: 200,
    efSearch: 50,
    m: 16,
};

/**
 * Chunking defaults
 */
export const CHUNKING_DEFAULTS = {
    chunkSize: 512,
    chunkOverlap: 50,
    minChunkSize: 100,
    separators: ['\n\n', '\n', '. ', ' '],
};

/**
 * Calculate cosine similarity
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
        throw new Error('Vectors must have same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
}

/**
 * Normalize a vector to unit length
 */
export function normalizeVector(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm === 0) return vector;
    return vector.map(v => v / norm);
}

/**
 * Chunk text for embedding
 */
export function chunkText(
    text: string,
    options: {
        chunkSize?: number;
        overlap?: number;
        separators?: string[];
    } = {}
): string[] {
    const {
        chunkSize = CHUNKING_DEFAULTS.chunkSize,
        overlap = CHUNKING_DEFAULTS.chunkOverlap,
        separators = CHUNKING_DEFAULTS.separators,
    } = options;

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= chunkSize) {
            chunks.push(remaining.trim());
            break;
        }

        // Find best split point
        let splitIndex = chunkSize;
        for (const sep of separators) {
            const lastSep = remaining.lastIndexOf(sep, chunkSize);
            if (lastSep > chunkSize * 0.5) {
                splitIndex = lastSep + sep.length;
                break;
            }
        }

        chunks.push(remaining.substring(0, splitIndex).trim());

        // Move forward with overlap
        const nextStart = Math.max(0, splitIndex - overlap);
        remaining = remaining.substring(nextStart);
    }

    return chunks.filter(c => c.length >= CHUNKING_DEFAULTS.minChunkSize);
}
