// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import { useState, useMemo } from 'react';
import {
    Search,
    X,
    Calendar,
    Bot,
    Folder,
    Tag,
    SlidersHorizontal,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import { formatDateISO } from '@csm/shared';

export interface SearchFilters {
    query: string;
    providers: string[];
    workspaces: string[];
    dateFrom: string;
    dateTo: string;
    minMessages: number | null;
    maxMessages: number | null;
    models: string[];
    archived: boolean | null;
}

interface AdvancedSearchProps {
    filters: SearchFilters;
    onFiltersChange: (filters: SearchFilters) => void;
    availableProviders: string[];
    availableWorkspaces: { id: string; name: string }[];
    availableModels: string[];
    resultCount?: number;
}

const defaultFilters: SearchFilters = {
    query: '',
    providers: [],
    workspaces: [],
    dateFrom: '',
    dateTo: '',
    minMessages: null,
    maxMessages: null,
    models: [],
    archived: null,
};

export function AdvancedSearch({
    filters,
    onFiltersChange,
    availableProviders,
    availableWorkspaces,
    availableModels,
    resultCount,
}: AdvancedSearchProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showProviders, setShowProviders] = useState(false);
    const [showWorkspaces, setShowWorkspaces] = useState(false);
    const [showModels, setShowModels] = useState(false);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.providers.length) count++;
        if (filters.workspaces.length) count++;
        if (filters.dateFrom || filters.dateTo) count++;
        if (filters.minMessages !== null || filters.maxMessages !== null) count++;
        if (filters.models.length) count++;
        if (filters.archived !== null) count++;
        return count;
    }, [filters]);

    const updateFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
        onFiltersChange({ ...filters, [key]: value });
    };

    const toggleArrayFilter = (key: 'providers' | 'workspaces' | 'models', value: string) => {
        const current = filters[key];
        const updated = current.includes(value)
            ? current.filter((v) => v !== value)
            : [...current, value];
        updateFilter(key, updated);
    };

    const clearFilters = () => {
        onFiltersChange(defaultFilters);
    };

    const hasActiveFilters = activeFilterCount > 0 || filters.query;

    return (
        <div className="space-y-4">
            {/* Main Search Bar */}
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                    <input
                        type="text"
                        placeholder="Search sessions by title, content, or ID..."
                        value={filters.query}
                        onChange={(e) => updateFilter('query', e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
                    />
                    {filters.query && (
                        <button
                            onClick={() => updateFilter('query', '')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[hsl(var(--muted))]/50"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${isExpanded || activeFilterCount > 0
                        ? 'bg-violet-500/10 border-violet-500 text-violet-500'
                        : 'bg-[hsl(var(--card))] border-[hsl(var(--border))] hover:border-[hsl(var(--muted-foreground))]/50'
                        }`}
                >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span className="hidden sm:inline">Filters</span>
                    {activeFilterCount > 0 && (
                        <span className="flex items-center justify-center w-5 h-5 text-xs font-bold bg-violet-500 text-white rounded-full">
                            {activeFilterCount}
                        </span>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
            </div>

            {/* Result Count */}
            {hasActiveFilters && resultCount !== undefined && (
                <div className="flex items-center justify-between text-sm">
                    <span className="text-[hsl(var(--muted-foreground))]">
                        Found <span className="text-[hsl(var(--foreground))] font-medium">{resultCount}</span> session{resultCount !== 1 ? 's' : ''}
                    </span>
                    <button
                        onClick={clearFilters}
                        className="text-violet-500 hover:text-violet-400 transition-colors"
                    >
                        Clear all filters
                    </button>
                </div>
            )}

            {/* Expanded Filters */}
            {isExpanded && (
                <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Provider Filter */}
                        <div className="relative">
                            <label className="block text-sm font-medium mb-2">
                                <Bot className="inline w-4 h-4 mr-1" />
                                Providers
                            </label>
                            <button
                                onClick={() => setShowProviders(!showProviders)}
                                className="w-full flex items-center justify-between px-3 py-2 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-sm"
                            >
                                <span className={filters.providers.length ? '' : 'text-[hsl(var(--muted-foreground))]'}>
                                    {filters.providers.length
                                        ? `${filters.providers.length} selected`
                                        : 'All providers'}
                                </span>
                                <ChevronDown className="w-4 h-4" />
                            </button>
                            {showProviders && (
                                <div className="absolute z-10 mt-1 w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                    {availableProviders.map((provider) => (
                                        <label
                                            key={provider}
                                            className="flex items-center gap-2 px-3 py-2 hover:bg-[hsl(var(--muted))]/50 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={filters.providers.includes(provider)}
                                                onChange={() => toggleArrayFilter('providers', provider)}
                                                className="rounded"
                                            />
                                            <span className="text-sm">{provider}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Workspace Filter */}
                        <div className="relative">
                            <label className="block text-sm font-medium mb-2">
                                <Folder className="inline w-4 h-4 mr-1" />
                                Workspaces
                            </label>
                            <button
                                onClick={() => setShowWorkspaces(!showWorkspaces)}
                                className="w-full flex items-center justify-between px-3 py-2 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-sm"
                            >
                                <span className={filters.workspaces.length ? '' : 'text-[hsl(var(--muted-foreground))]'}>
                                    {filters.workspaces.length
                                        ? `${filters.workspaces.length} selected`
                                        : 'All workspaces'}
                                </span>
                                <ChevronDown className="w-4 h-4" />
                            </button>
                            {showWorkspaces && (
                                <div className="absolute z-10 mt-1 w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                    {availableWorkspaces.map((ws) => (
                                        <label
                                            key={ws.id}
                                            className="flex items-center gap-2 px-3 py-2 hover:bg-[hsl(var(--muted))]/50 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={filters.workspaces.includes(ws.id)}
                                                onChange={() => toggleArrayFilter('workspaces', ws.id)}
                                                className="rounded"
                                            />
                                            <span className="text-sm truncate">{ws.name}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Model Filter */}
                        <div className="relative">
                            <label className="block text-sm font-medium mb-2">
                                <Tag className="inline w-4 h-4 mr-1" />
                                Models
                            </label>
                            <button
                                onClick={() => setShowModels(!showModels)}
                                className="w-full flex items-center justify-between px-3 py-2 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-sm"
                            >
                                <span className={filters.models.length ? '' : 'text-[hsl(var(--muted-foreground))]'}>
                                    {filters.models.length
                                        ? `${filters.models.length} selected`
                                        : 'All models'}
                                </span>
                                <ChevronDown className="w-4 h-4" />
                            </button>
                            {showModels && (
                                <div className="absolute z-10 mt-1 w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                    {availableModels.map((model) => (
                                        <label
                                            key={model}
                                            className="flex items-center gap-2 px-3 py-2 hover:bg-[hsl(var(--muted))]/50 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={filters.models.includes(model)}
                                                onChange={() => toggleArrayFilter('models', model)}
                                                className="rounded"
                                            />
                                            <span className="text-sm truncate">{model}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Date Range */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                <Calendar className="inline w-4 h-4 mr-1" />
                                Date Range
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    value={filters.dateFrom}
                                    onChange={(e) => updateFilter('dateFrom', e.target.value)}
                                    max={filters.dateTo || formatDateISO(new Date())}
                                    className="flex-1 px-3 py-2 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-sm"
                                    placeholder="From"
                                />
                                <input
                                    type="date"
                                    value={filters.dateTo}
                                    onChange={(e) => updateFilter('dateTo', e.target.value)}
                                    min={filters.dateFrom}
                                    max={formatDateISO(new Date())}
                                    className="flex-1 px-3 py-2 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-sm"
                                    placeholder="To"
                                />
                            </div>
                        </div>

                        {/* Message Count */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Message Count</label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={filters.minMessages ?? ''}
                                    onChange={(e) => updateFilter('minMessages', e.target.value ? parseInt(e.target.value) : null)}
                                    min={0}
                                    className="flex-1 px-3 py-2 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-sm"
                                    placeholder="Min"
                                />
                                <input
                                    type="number"
                                    value={filters.maxMessages ?? ''}
                                    onChange={(e) => updateFilter('maxMessages', e.target.value ? parseInt(e.target.value) : null)}
                                    min={filters.minMessages ?? 0}
                                    className="flex-1 px-3 py-2 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded-lg text-sm"
                                    placeholder="Max"
                                />
                            </div>
                        </div>

                        {/* Archived Status */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Status</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => updateFilter('archived', filters.archived === false ? null : false)}
                                    className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${filters.archived === false
                                        ? 'bg-violet-500/10 border-violet-500 text-violet-500'
                                        : 'bg-[hsl(var(--background))] border-[hsl(var(--border))] hover:border-[hsl(var(--muted-foreground))]/50'
                                        }`}
                                >
                                    Active
                                </button>
                                <button
                                    onClick={() => updateFilter('archived', filters.archived === true ? null : true)}
                                    className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${filters.archived === true
                                        ? 'bg-violet-500/10 border-violet-500 text-violet-500'
                                        : 'bg-[hsl(var(--background))] border-[hsl(var(--border))] hover:border-[hsl(var(--muted-foreground))]/50'
                                        }`}
                                >
                                    Archived
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Active Filter Pills */}
                    {hasActiveFilters && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-[hsl(var(--border))]">
                            {filters.query && (
                                <span className="flex items-center gap-1 px-2 py-1 bg-violet-500/10 text-violet-500 rounded text-sm">
                                    "{filters.query}"
                                    <button onClick={() => updateFilter('query', '')} className="hover:text-violet-300">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            )}
                            {filters.providers.map((p) => (
                                <span key={p} className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-500 rounded text-sm">
                                    {p}
                                    <button onClick={() => toggleArrayFilter('providers', p)} className="hover:text-blue-300">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                            {filters.workspaces.map((wsId) => {
                                const ws = availableWorkspaces.find((w) => w.id === wsId);
                                return (
                                    <span key={wsId} className="flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-500 rounded text-sm">
                                        {ws?.name || wsId}
                                        <button onClick={() => toggleArrayFilter('workspaces', wsId)} className="hover:text-green-300">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                );
                            })}
                            {(filters.dateFrom || filters.dateTo) && (
                                <span className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 text-amber-500 rounded text-sm">
                                    {filters.dateFrom || '...'} → {filters.dateTo || '...'}
                                    <button onClick={() => { updateFilter('dateFrom', ''); updateFilter('dateTo', ''); }} className="hover:text-amber-300">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export const createDefaultFilters = (): SearchFilters => ({ ...defaultFilters });

export default AdvancedSearch;
