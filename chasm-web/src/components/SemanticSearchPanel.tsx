/**
 * SemanticSearchPanel Component
 *
 * Advanced semantic search with filters, grouping, and result previews.
 * Supports hybrid search, similar document discovery, and saved searches.
 */

import { useState, useCallback } from 'react';
import type {
    SemanticSearchQuery,
    SemanticSearchResult,
    SearchFilters,
    GroupedSearchResults,
    EmbeddableType,
    GroupByOption,
} from '@csm/shared';

// =============================================================================
// Types
// =============================================================================

interface SemanticSearchPanelProps {
    onSearch: (query: SemanticSearchQuery) => Promise<GroupedSearchResults>;
    onResultClick: (result: SemanticSearchResult) => void;
    onFindSimilar: (result: SemanticSearchResult) => void;
    recentSearches?: string[];
    savedSearches?: SavedSearch[];
    onSaveSearch?: (query: string, filters: SearchFilters) => void;
    isSearching?: boolean;
}

interface SavedSearch {
    id: string;
    name: string;
    query: string;
    filters: SearchFilters;
    createdAt: number;
}

// =============================================================================
// Subcomponents
// =============================================================================

function SearchInput({
    value,
    onChange,
    onSearch,
    isSearching,
}: {
    value: string;
    onChange: (value: string) => void;
    onSearch: () => void;
    isSearching?: boolean;
}) {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSearch();
        }
    };

    return (
        <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search sessions, messages, code..."
                className="w-full pl-10 pr-24 py-3 text-base border border-gray-300 dark:border-gray-600
                    rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500
                    focus:border-transparent"
            />
            <button
                onClick={onSearch}
                disabled={isSearching || !value.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5
                    bg-blue-600 text-white text-sm font-medium rounded-lg
                    hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                    flex items-center gap-2"
            >
                {isSearching ? (
                    <LoadingSpinner className="w-4 h-4" />
                ) : (
                    'Search'
                )}
            </button>
        </div>
    );
}

function FilterBar({
    filters,
    onFiltersChange,
    groupBy,
    onGroupByChange,
}: {
    filters: SearchFilters;
    onFiltersChange: (filters: SearchFilters) => void;
    groupBy: GroupByOption;
    onGroupByChange: (groupBy: GroupByOption) => void;
}) {
    const [showAdvanced, setShowAdvanced] = useState(false);

    const documentTypes: { type: EmbeddableType; label: string }[] = [
        { type: 'session', label: 'Sessions' },
        { type: 'message', label: 'Messages' },
        { type: 'code_block', label: 'Code' },
        { type: 'file_change', label: 'Files' },
        { type: 'comment', label: 'Comments' },
        { type: 'annotation', label: 'Annotations' },
    ];

    const toggleDocumentType = (type: EmbeddableType) => {
        const current = filters.documentTypes || [];
        const updated = current.includes(type)
            ? current.filter(t => t !== type)
            : [...current, type];
        onFiltersChange({ ...filters, documentTypes: updated.length ? updated : undefined });
    };

    return (
        <div className="space-y-3">
            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-500">Filter:</span>
                {documentTypes.map(({ type, label }) => (
                    <button
                        key={type}
                        onClick={() => toggleDocumentType(type)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors
                            ${filters.documentTypes?.includes(type)
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200'
                            }`}
                    >
                        {label}
                    </button>
                ))}
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="px-2.5 py-1 text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                    {showAdvanced ? 'Less' : 'More'} filters
                    <ChevronIcon className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {/* Advanced Filters */}
            {showAdvanced && (
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Date Range */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                Date Range
                            </label>
                            <select
                                value={filters.dateRange?.start ? 'custom' : 'any'}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === 'any') {
                                        onFiltersChange({ ...filters, dateRange: undefined });
                                    } else {
                                        const now = Date.now();
                                        const ranges: Record<string, number> = {
                                            today: 86400000,
                                            week: 604800000,
                                            month: 2592000000,
                                            year: 31536000000,
                                        };
                                        onFiltersChange({
                                            ...filters,
                                            dateRange: { start: now - ranges[value] },
                                        });
                                    }
                                }}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600
                                    rounded bg-white dark:bg-gray-700"
                            >
                                <option value="any">Any time</option>
                                <option value="today">Today</option>
                                <option value="week">Past week</option>
                                <option value="month">Past month</option>
                                <option value="year">Past year</option>
                            </select>
                        </div>

                        {/* Has Code */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                Content Type
                            </label>
                            <select
                                value={
                                    filters.hasCode === true ? 'code' :
                                        filters.hasFileChanges === true ? 'files' : 'any'
                                }
                                onChange={(e) => {
                                    const value = e.target.value;
                                    onFiltersChange({
                                        ...filters,
                                        hasCode: value === 'code' ? true : undefined,
                                        hasFileChanges: value === 'files' ? true : undefined,
                                    });
                                }}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600
                                    rounded bg-white dark:bg-gray-700"
                            >
                                <option value="any">Any content</option>
                                <option value="code">Has code</option>
                                <option value="files">Has file changes</option>
                            </select>
                        </div>

                        {/* Min Score */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                Min Relevance
                            </label>
                            <select
                                value={filters.minScore ?? 0}
                                onChange={(e) => onFiltersChange({
                                    ...filters,
                                    minScore: Number(e.target.value) || undefined,
                                })}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600
                                    rounded bg-white dark:bg-gray-700"
                            >
                                <option value={0}>Any</option>
                                <option value={0.5}>50%+</option>
                                <option value={0.7}>70%+</option>
                                <option value={0.8}>80%+</option>
                                <option value={0.9}>90%+</option>
                            </select>
                        </div>

                        {/* Group By */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                Group By
                            </label>
                            <select
                                value={groupBy}
                                onChange={(e) => onGroupByChange(e.target.value as GroupByOption)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600
                                    rounded bg-white dark:bg-gray-700"
                            >
                                <option value="none">No grouping</option>
                                <option value="session">By session</option>
                                <option value="workspace">By workspace</option>
                                <option value="date">By date</option>
                            </select>
                        </div>
                    </div>

                    {/* Active Filters Summary */}
                    {(filters.tags?.length || filters.models?.length || filters.languages?.length) && (
                        <div className="flex flex-wrap gap-2">
                            {filters.tags?.map((tag) => (
                                <FilterChip
                                    key={tag}
                                    label={`tag:${tag}`}
                                    onRemove={() => onFiltersChange({
                                        ...filters,
                                        tags: filters.tags?.filter(t => t !== tag),
                                    })}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function FilterChip({
    label,
    onRemove,
}: {
    label: string;
    onRemove: () => void;
}) {
    return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs
            bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded-full">
            {label}
            <button onClick={onRemove} className="hover:text-blue-900">
                <XIcon className="w-3 h-3" />
            </button>
        </span>
    );
}

function SearchResults({
    results,
    onResultClick,
    onFindSimilar,
}: {
    results: GroupedSearchResults;
    onResultClick: (result: SemanticSearchResult) => void;
    onFindSimilar: (result: SemanticSearchResult) => void;
}) {
    if (results.totalResults === 0) {
        return (
            <div className="text-center py-12">
                <SearchIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No results found</p>
                <p className="text-sm text-gray-400 mt-1">
                    Try different keywords or adjust your filters
                </p>
            </div>
        );
    }

    if (results.groups.length > 0 && results.groups[0].key !== 'all') {
        // Grouped results
        return (
            <div className="space-y-6">
                <p className="text-sm text-gray-500">
                    Found {results.totalResults} results in {results.totalGroups} groups
                </p>
                {results.groups.map((group) => (
                    <div key={group.key} className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {group.label}
                            </h3>
                            <span className="text-xs text-gray-500">
                                {group.totalInGroup} results
                            </span>
                        </div>
                        <div className="space-y-2">
                            {group.results.map((result) => (
                                <SearchResultCard
                                    key={result.id}
                                    result={result}
                                    onClick={() => onResultClick(result)}
                                    onFindSimilar={() => onFindSimilar(result)}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Flat results
    const allResults = results.groups.flatMap(g => g.results);
    return (
        <div className="space-y-3">
            <p className="text-sm text-gray-500">
                Found {results.totalResults} results
            </p>
            {allResults.map((result) => (
                <SearchResultCard
                    key={result.id}
                    result={result}
                    onClick={() => onResultClick(result)}
                    onFindSimilar={() => onFindSimilar(result)}
                />
            ))}
        </div>
    );
}

function SearchResultCard({
    result,
    onClick,
    onFindSimilar,
}: {
    result: SemanticSearchResult;
    onClick: () => void;
    onFindSimilar: () => void;
}) {
    const typeConfig: Record<EmbeddableType, { icon: React.ReactNode; color: string }> = {
        session: { icon: <ChatIcon className="w-4 h-4" />, color: 'text-blue-500' },
        message: { icon: <MessageIcon className="w-4 h-4" />, color: 'text-green-500' },
        code_block: { icon: <CodeIcon className="w-4 h-4" />, color: 'text-purple-500' },
        file_change: { icon: <FileIcon className="w-4 h-4" />, color: 'text-amber-500' },
        comment: { icon: <CommentIcon className="w-4 h-4" />, color: 'text-teal-500' },
        annotation: { icon: <TagIcon className="w-4 h-4" />, color: 'text-pink-500' },
        summary: { icon: <SparklesIcon className="w-4 h-4" />, color: 'text-indigo-500' },
    };

    const { icon, color } = typeConfig[result.documentType] || {
        icon: <DocumentIcon className="w-4 h-4" />,
        color: 'text-gray-500',
    };

    const scorePercent = Math.round(result.score * 100);

    return (
        <div
            onClick={onClick}
            className="p-4 rounded-lg border border-gray-200 dark:border-gray-700
                hover:border-blue-300 dark:hover:border-blue-600 cursor-pointer
                transition-colors group"
        >
            <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${color}`}>
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-500 uppercase">
                            {result.documentType.replace('_', ' ')}
                        </span>
                        <ScoreBadge score={scorePercent} />
                        {result.session && (
                            <span className="text-xs text-gray-400 truncate">
                                in {result.session.title}
                            </span>
                        )}
                    </div>

                    {/* Content */}
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                        {result.highlights && result.highlights.length > 0 ? (
                            <HighlightedText
                                text={result.highlights[0].snippet}
                                positions={result.highlights[0].matchPositions}
                            />
                        ) : (
                            <p className="line-clamp-2">{result.content}</p>
                        )}
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        {result.metadata.model && (
                            <span>{result.metadata.model}</span>
                        )}
                        {result.metadata.language && (
                            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                                {result.metadata.language}
                            </span>
                        )}
                        {result.metadata.filePath && (
                            <span className="truncate max-w-48">{result.metadata.filePath}</span>
                        )}
                        <span>{formatRelativeTime(result.metadata.timestamp)}</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onFindSimilar();
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50
                            dark:hover:bg-blue-900/30 rounded"
                        title="Find similar"
                    >
                        <SimilarIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function HighlightedText({
    text,
    positions,
}: {
    text: string;
    positions: Array<{ start: number; end: number }>;
}) {
    if (positions.length === 0) {
        return <span>{text}</span>;
    }

    const parts: React.ReactNode[] = [];
    let lastEnd = 0;

    positions.forEach(({ start, end }, i) => {
        if (start > lastEnd) {
            parts.push(<span key={`text-${i}`}>{text.slice(lastEnd, start)}</span>);
        }
        parts.push(
            <mark
                key={`mark-${i}`}
                className="bg-yellow-200 dark:bg-yellow-900/50 text-inherit rounded px-0.5"
            >
                {text.slice(start, end)}
            </mark>
        );
        lastEnd = end;
    });

    if (lastEnd < text.length) {
        parts.push(<span key="text-end">{text.slice(lastEnd)}</span>);
    }

    return <p className="line-clamp-2">{parts}</p>;
}

function ScoreBadge({ score }: { score: number }) {
    const color =
        score >= 90 ? 'text-green-600 bg-green-100 dark:bg-green-900/50' :
            score >= 70 ? 'text-blue-600 bg-blue-100 dark:bg-blue-900/50' :
                score >= 50 ? 'text-amber-600 bg-amber-100 dark:bg-amber-900/50' :
                    'text-gray-600 bg-gray-100 dark:bg-gray-700';

    return (
        <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${color}`}>
            {score}%
        </span>
    );
}

function RecentSearches({
    searches,
    onSelect,
}: {
    searches: string[];
    onSelect: (query: string) => void;
}) {
    if (searches.length === 0) return null;

    return (
        <div className="space-y-2">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Recent Searches
            </h3>
            <div className="flex flex-wrap gap-2">
                {searches.map((search, i) => (
                    <button
                        key={i}
                        onClick={() => onSelect(search)}
                        className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700
                            text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200
                            dark:hover:bg-gray-600 transition-colors"
                    >
                        {search}
                    </button>
                ))}
            </div>
        </div>
    );
}

function SavedSearches({
    searches,
    onSelect,
}: {
    searches: SavedSearch[];
    onSelect: (search: SavedSearch) => void;
}) {
    if (searches.length === 0) return null;

    return (
        <div className="space-y-2">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Saved Searches
            </h3>
            <div className="space-y-1">
                {searches.map((search) => (
                    <button
                        key={search.id}
                        onClick={() => onSelect(search)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left
                            hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <BookmarkIcon className="w-4 h-4 text-gray-400" />
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {search.name}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                                {search.query}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

// =============================================================================
// Main Component
// =============================================================================

export function SemanticSearchPanel({
    onSearch,
    onResultClick,
    onFindSimilar,
    recentSearches = [],
    savedSearches = [],
    onSaveSearch: _onSaveSearch,
    isSearching,
}: SemanticSearchPanelProps) {
    // _onSaveSearch available for future implementation
    void _onSaveSearch;

    const [query, setQuery] = useState('');
    const [filters, setFilters] = useState<SearchFilters>({});
    const [groupBy, setGroupBy] = useState<GroupByOption>('none');
    const [results, setResults] = useState<GroupedSearchResults | null>(null);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = useCallback(async () => {
        if (!query.trim()) return;

        setHasSearched(true);
        const searchResults = await onSearch({
            text: query,
            filters,
            options: {
                groupBy,
                limit: 50,
                includeHighlights: true,
            },
        });
        setResults(searchResults);
    }, [query, filters, groupBy, onSearch]);

    const handleRecentSelect = (search: string) => {
        setQuery(search);
        // Auto-search after selecting
        setTimeout(() => handleSearch(), 0);
    };

    const handleSavedSelect = (search: SavedSearch) => {
        setQuery(search.query);
        setFilters(search.filters);
        setTimeout(() => handleSearch(), 0);
    };

    return (
        <div className="space-y-6">
            {/* Search Input */}
            <SearchInput
                value={query}
                onChange={setQuery}
                onSearch={handleSearch}
                isSearching={isSearching}
            />

            {/* Filters */}
            <FilterBar
                filters={filters}
                onFiltersChange={setFilters}
                groupBy={groupBy}
                onGroupByChange={setGroupBy}
            />

            {/* Results or Suggestions */}
            {hasSearched && results ? (
                <SearchResults
                    results={results}
                    onResultClick={onResultClick}
                    onFindSimilar={onFindSimilar}
                />
            ) : (
                <div className="space-y-6 py-4">
                    <RecentSearches
                        searches={recentSearches}
                        onSelect={handleRecentSelect}
                    />
                    <SavedSearches
                        searches={savedSearches}
                        onSelect={handleSavedSelect}
                    />
                    {recentSearches.length === 0 && savedSearches.length === 0 && (
                        <div className="text-center py-12">
                            <SearchIcon className="w-16 h-16 mx-auto text-gray-200 dark:text-gray-700 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                                Semantic Search
                            </h3>
                            <p className="text-sm text-gray-500 max-w-md mx-auto">
                                Search across all your sessions using natural language.
                                Find relevant code, discussions, and decisions instantly.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// =============================================================================
// Utility Functions
// =============================================================================

function formatRelativeTime(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

// =============================================================================
// Icons
// =============================================================================

function SearchIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
    );
}

function ChevronIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
    );
}

function XIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
    );
}

function ChatIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
    );
}

function MessageIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
    );
}

function CodeIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
    );
}

function FileIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
    );
}

function CommentIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
    );
}

function TagIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
    );
}

function SparklesIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
    );
}

function DocumentIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
    );
}

function SimilarIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
    );
}

function BookmarkIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
    );
}

function LoadingSpinner({ className }: { className?: string }) {
    return (
        <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
    );
}

export default SemanticSearchPanel;
