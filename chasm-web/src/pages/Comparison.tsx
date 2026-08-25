// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import { useState, useMemo } from 'react';
import {
    BarChart3,
    DollarSign,
    Expand,
    Filter,
    Info,
    Cpu,
    Loader2,
    AlertCircle,
    RefreshCw,
} from 'lucide-react';
import { useProviders, useProviderHealth, useStatistics } from '../hooks/useApi';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ScatterChart,
    Scatter,
} from 'recharts';

interface ModelSpec {
    provider: string;
    model: string;
    type: 'cloud' | 'local';
    category: 'chat' | 'reasoning' | 'code';
    /** Published list price per 1M input tokens. `null` when Chasm does not know it. */
    inputCost: number | null;
    /** Published list price per 1M output tokens. `null` when Chasm does not know it. */
    outputCost: number | null;
    /** Published context window in tokens. `null` when Chasm does not know it. */
    contextWindow: number | null;
}

/**
 * A static reference table of published model attributes.
 *
 * This table used to carry `latency`, `tokensPerSec`, `accuracy`, `mmlu`,
 * `humaneval`, `reasoning`, `coding` and `creative` per model. It drove a
 * "Most Accurate" card, a speed ranking, a value score, a five-axis radar
 * chart and a benchmark bar chart, and the footer said the numbers came "from
 * reference sources".
 *
 * They came from nowhere. Chasm runs no benchmark and records no timing;
 * "accuracy", "reasoning", "coding" and "creative" are not metrics anyone
 * publishes; and MMLU and HumanEval are real benchmarks whose scores were
 * being asserted here without a source to check them against. Worse, models
 * discovered from the user's own connected providers were assigned `mmlu: 80,
 * humaneval: 80, accuracy: 85` on the spot -- benchmark scores invented for a
 * model the moment it appeared.
 *
 * All of it is gone. What remains is list price and context window, which the
 * providers publish. Those still go stale; see the note the page renders.
 */
const providerModels: ModelSpec[] = [
    // OpenAI
    { provider: 'OpenAI', model: 'gpt-4o', type: 'cloud', category: 'chat', inputCost: 2.5, outputCost: 10.0, contextWindow: 128000 },
    { provider: 'OpenAI', model: 'gpt-4o-mini', type: 'cloud', category: 'chat', inputCost: 0.15, outputCost: 0.6, contextWindow: 128000 },
    { provider: 'OpenAI', model: 'o1', type: 'cloud', category: 'reasoning', inputCost: 15.0, outputCost: 60.0, contextWindow: 200000 },
    { provider: 'OpenAI', model: 'o1-mini', type: 'cloud', category: 'reasoning', inputCost: 3.0, outputCost: 12.0, contextWindow: 128000 },

    // Anthropic
    { provider: 'Anthropic', model: 'claude-4-opus', type: 'cloud', category: 'chat', inputCost: 15.0, outputCost: 75.0, contextWindow: 200000 },
    { provider: 'Anthropic', model: 'claude-4-sonnet', type: 'cloud', category: 'chat', inputCost: 3.0, outputCost: 15.0, contextWindow: 200000 },
    { provider: 'Anthropic', model: 'claude-3.5-sonnet', type: 'cloud', category: 'chat', inputCost: 3.0, outputCost: 15.0, contextWindow: 200000 },
    { provider: 'Anthropic', model: 'claude-3.5-haiku', type: 'cloud', category: 'chat', inputCost: 0.25, outputCost: 1.25, contextWindow: 200000 },

    // Google
    { provider: 'Google', model: 'gemini-2.0-flash', type: 'cloud', category: 'chat', inputCost: 0.075, outputCost: 0.3, contextWindow: 1000000 },
    { provider: 'Google', model: 'gemini-2.0-pro', type: 'cloud', category: 'chat', inputCost: 1.25, outputCost: 5.0, contextWindow: 2000000 },

    // DeepSeek
    { provider: 'DeepSeek', model: 'deepseek-chat', type: 'cloud', category: 'chat', inputCost: 0.14, outputCost: 0.28, contextWindow: 64000 },
    { provider: 'DeepSeek', model: 'deepseek-reasoner', type: 'cloud', category: 'reasoning', inputCost: 0.55, outputCost: 2.19, contextWindow: 64000 },

    // Qwen
    { provider: 'Qwen', model: 'qwen-max', type: 'cloud', category: 'chat', inputCost: 1.6, outputCost: 6.4, contextWindow: 32000 },

    // Local providers -- no per-token price, so zero here is a fact, not a placeholder.
    { provider: 'Ollama', model: 'llama3.3-70b', type: 'local', category: 'chat', inputCost: 0, outputCost: 0, contextWindow: 128000 },
    { provider: 'Ollama', model: 'qwen2.5-coder-32b', type: 'local', category: 'code', inputCost: 0, outputCost: 0, contextWindow: 32768 },
    { provider: 'Ollama', model: 'deepseek-r1-32b', type: 'local', category: 'reasoning', inputCost: 0, outputCost: 0, contextWindow: 64000 },
    { provider: 'Ollama', model: 'mistral-7b', type: 'local', category: 'chat', inputCost: 0, outputCost: 0, contextWindow: 32768 },
    { provider: 'LM Studio', model: 'phi-4-14b', type: 'local', category: 'chat', inputCost: 0, outputCost: 0, contextWindow: 16384 },
    { provider: 'vLLM', model: 'llama-3.3-70b', type: 'local', category: 'chat', inputCost: 0, outputCost: 0, contextWindow: 128000 },
    { provider: 'llama.cpp', model: 'qwen2.5-72b-q4', type: 'local', category: 'chat', inputCost: 0, outputCost: 0, contextWindow: 32768 },
];

const providerColors: Record<string, string> = {
    OpenAI: '#10a37f',
    Anthropic: '#d4a574',
    Google: '#4285f4',
    DeepSeek: '#0066ff',
    Qwen: '#ff6b35',
    Ollama: '#8b5cf6',
    'LM Studio': '#a855f7',
    vLLM: '#ec4899',
    'llama.cpp': '#22c55e',
};

const LOCAL_PROVIDERS = ['ollama', 'lm-studio', 'vllm', 'llama.cpp', 'llamafile', 'localai', 'gpt4all', 'jan'];

const UNKNOWN = '—';

type CompareMetric = 'cost' | 'context';
type ModelCategory = 'all' | 'chat' | 'reasoning' | 'code';
type ProviderType = 'all' | 'cloud' | 'local';

function formatCost(cost: number | null): string {
    if (cost === null) return UNKNOWN;
    if (cost === 0) return 'Free';
    return `$${cost.toFixed(2)}`;
}

function formatContext(tokens: number | null): string {
    if (tokens === null) return UNKNOWN;
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
    return `${(tokens / 1000).toFixed(0)}K`;
}

export default function Comparison() {
    // API Data
    const { data: apiProviders, isLoading: providersLoading, refetch: refetchProviders } = useProviders();
    const { data: providerHealthData } = useProviderHealth();
    const { data: statistics } = useStatistics();

    const [selectedProviders, setSelectedProviders] = useState<string[]>(['OpenAI', 'Anthropic', 'Google', 'DeepSeek']);
    const [compareMetric, setCompareMetric] = useState<CompareMetric>('cost');
    const [modelCategory, setModelCategory] = useState<ModelCategory>('all');
    const [providerType, setProviderType] = useState<ProviderType>('all');

    // Merge the reference table with models discovered from the user's own
    // providers. A discovered model gets nulls, not defaults: Chasm does not
    // know what a model it has never heard of costs, and guessing $1.00/$3.00
    // reads exactly like a published price.
    const enhancedModels = useMemo<ModelSpec[]>(() => {
        const models = [...providerModels];

        if (apiProviders) {
            for (const provider of apiProviders) {
                const known = models.some((m) => m.provider.toLowerCase() === provider.name.toLowerCase());
                if (known || !provider.models) continue;

                const isLocal = provider.type === 'local' || LOCAL_PROVIDERS.includes(provider.name.toLowerCase());
                for (const modelName of provider.models) {
                    models.push({
                        provider: provider.name,
                        model: modelName,
                        type: isLocal ? 'local' : 'cloud',
                        category: 'chat',
                        // Local models have no per-token price at all; that is a
                        // fact. A cloud model Chasm has no entry for is unknown.
                        inputCost: isLocal ? 0 : null,
                        outputCost: isLocal ? 0 : null,
                        contextWindow: null,
                    });
                }
            }
        }

        return models;
    }, [apiProviders]);

    const filteredModels = enhancedModels.filter((m) => {
        if (providerType !== 'all' && m.type !== providerType) return false;
        if (modelCategory !== 'all' && m.category !== modelCategory) return false;
        if (selectedProviders.length > 0 && !selectedProviders.includes(m.provider)) return false;
        return true;
    });

    const allProviders = useMemo(() => {
        const providers = new Set(providerModels.map((m) => m.provider));
        if (apiProviders) apiProviders.forEach((p) => providers.add(p.name));
        return [...providers];
    }, [apiProviders]);

    const providerStatus = useMemo(() => {
        const status: Record<string, boolean> = {};
        if (providerHealthData) {
            providerHealthData.forEach((h) => {
                status[h.providerId] = h.status === 'connected';
            });
        }
        return status;
    }, [providerHealthData]);

    // Charts can only plot models whose figures are known.
    const costData = filteredModels
        .filter((m): m is ModelSpec & { inputCost: number; outputCost: number } =>
            m.inputCost !== null && m.outputCost !== null)
        .map((m) => ({
            name: m.model,
            provider: m.provider,
            input: m.inputCost,
            output: m.outputCost,
            total: (m.inputCost + m.outputCost) / 2,
        }))
        .sort((a, b) => a.total - b.total);

    const contextData = filteredModels
        .filter((m): m is ModelSpec & { contextWindow: number } => m.contextWindow !== null)
        .map((m) => ({
            name: m.model,
            provider: m.provider,
            context: Math.round(m.contextWindow / 1000),
        }))
        .sort((a, b) => b.context - a.context);

    // Both axes here are published figures, so this plot says something real.
    const scatterData = filteredModels
        .filter((m): m is ModelSpec & { inputCost: number; outputCost: number; contextWindow: number } =>
            m.inputCost !== null && m.outputCost !== null && m.contextWindow !== null)
        .map((m) => ({
            x: (m.inputCost + m.outputCost) / 2,
            y: Math.round(m.contextWindow / 1000),
            name: m.model,
            provider: m.provider,
        }));

    const unknownCount = filteredModels.filter(
        (m) => m.inputCost === null || m.contextWindow === null
    ).length;

    const toggleProvider = (provider: string) => {
        setSelectedProviders((prev) =>
            prev.includes(provider) ? prev.filter((p) => p !== provider) : [...prev, provider]
        );
    };

    const cheapestModel = [...filteredModels]
        .filter((m) => m.type === 'cloud' && m.inputCost !== null && m.outputCost !== null)
        .sort((a, b) => (a.inputCost! + a.outputCost!) - (b.inputCost! + b.outputCost!))[0];

    const largestContext = [...filteredModels]
        .filter((m) => m.contextWindow !== null)
        .sort((a, b) => b.contextWindow! - a.contextWindow!)[0];

    if (providersLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 size={32} className="animate-spin text-[hsl(var(--primary))]" />
                    <p className="text-[hsl(var(--muted-foreground))]">Loading provider data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">Model Comparison</h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                        Published prices and context windows across providers
                        {apiProviders && (
                            <span className="ml-2 text-xs">({apiProviders.length} connected providers)</span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {statistics && (
                        <div className="text-sm text-[hsl(var(--muted-foreground))] mr-4">
                            <span className="font-medium">{statistics.totalSessions}</span> sessions tracked
                        </div>
                    )}
                    <button
                        onClick={() => refetchProviders()}
                        className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90 transition-colors"
                    >
                        <RefreshCw size={18} />
                        Refresh Data
                    </button>
                </div>
            </div>

            {/* What this page is */}
            <div className="flex items-start gap-2 text-sm text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]/50 rounded-lg p-4">
                <Info size={16} className="mt-0.5 shrink-0" />
                <p>
                    <span className="font-medium text-[hsl(var(--foreground))]">Reference table.</span>{' '}
                    Published list prices and context windows, compiled into the app. Chasm does not
                    benchmark models and does not measure latency, throughput or accuracy, so it does
                    not report them. Check the provider&apos;s own pricing page before relying on a
                    figure. Models found on your connected providers appear here too, with{' '}
                    <span className="font-mono">{UNKNOWN}</span> where Chasm has no published figure
                    for them.
                </p>
            </div>

            {/* Connected Providers Status */}
            {apiProviders && apiProviders.length > 0 && (
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertCircle size={18} className="text-[hsl(var(--muted-foreground))]" />
                        <span className="font-medium text-[hsl(var(--foreground))]">Connected Providers</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {apiProviders.map((provider) => (
                            <div
                                key={provider.id}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[hsl(var(--muted))]"
                            >
                                <span
                                    className={`w-2 h-2 rounded-full ${providerStatus[provider.id] ? 'bg-green-500' : 'bg-red-500'}`}
                                />
                                <span className="text-sm text-[hsl(var(--foreground))]">{provider.name}</span>
                                {provider.models && (
                                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                        ({provider.models.length} models)
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                <div className="flex items-center gap-2 mb-4">
                    <Filter size={18} className="text-[hsl(var(--muted-foreground))]" />
                    <span className="font-medium text-[hsl(var(--foreground))]">Filters</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-sm text-[hsl(var(--muted-foreground))] mb-2 block">Provider Type</label>
                        <div className="flex gap-2">
                            {(['all', 'cloud', 'local'] as ProviderType[]).map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setProviderType(type)}
                                    className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${providerType === type
                                        ? 'bg-[hsl(var(--primary))] text-white'
                                        : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-sm text-[hsl(var(--muted-foreground))] mb-2 block">Category</label>
                        <div className="flex gap-2 flex-wrap">
                            {(['all', 'chat', 'reasoning', 'code'] as ModelCategory[]).map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setModelCategory(cat)}
                                    className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${modelCategory === cat
                                        ? 'bg-[hsl(var(--primary))] text-white'
                                        : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-sm text-[hsl(var(--muted-foreground))] mb-2 block">Compare By</label>
                        <div className="flex gap-2 flex-wrap">
                            {(['cost', 'context'] as CompareMetric[]).map((metric) => (
                                <button
                                    key={metric}
                                    onClick={() => setCompareMetric(metric)}
                                    className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${compareMetric === metric
                                        ? 'bg-[hsl(var(--primary))] text-white'
                                        : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                                        }`}
                                >
                                    {metric}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                    <label className="text-sm text-[hsl(var(--muted-foreground))] mb-2 block">Providers</label>
                    <div className="flex gap-2 flex-wrap">
                        {allProviders.map((provider) => (
                            <button
                                key={provider}
                                onClick={() => toggleProvider(provider)}
                                className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${selectedProviders.includes(provider)
                                    ? 'bg-[hsl(var(--primary))] text-white'
                                    : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                                    }`}
                            >
                                <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: providerColors[provider] }}
                                />
                                {provider}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <DollarSign size={18} />
                        <span className="text-sm">Cheapest (Cloud)</span>
                    </div>
                    {cheapestModel ? (
                        <>
                            <p className="text-xl font-bold text-[hsl(var(--foreground))]">{cheapestModel.model}</p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">{cheapestModel.provider}</p>
                            <p className="text-sm text-green-500 mt-1">
                                ${((cheapestModel.inputCost! + cheapestModel.outputCost!) / 2).toFixed(2)}/1M tokens
                            </p>
                        </>
                    ) : (
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">No priced cloud model in this filter.</p>
                    )}
                </div>

                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Expand size={18} />
                        <span className="text-sm">Largest Context</span>
                    </div>
                    {largestContext ? (
                        <>
                            <p className="text-xl font-bold text-[hsl(var(--foreground))]">{largestContext.model}</p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">{largestContext.provider}</p>
                            <p className="text-sm text-blue-500 mt-1">{formatContext(largestContext.contextWindow)} tokens</p>
                        </>
                    ) : (
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">No known context window in this filter.</p>
                    )}
                </div>

                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Cpu size={18} />
                        <span className="text-sm">Models Listed</span>
                    </div>
                    <p className="text-xl font-bold text-[hsl(var(--foreground))]">{filteredModels.length}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                        {unknownCount > 0
                            ? `${unknownCount} with figures Chasm does not have`
                            : 'all with published figures'}
                    </p>
                </div>
            </div>

            {/* Main Chart */}
            <div className="bg-[hsl(var(--card))] rounded-xl p-6 border">
                <h2 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4 flex items-center gap-2">
                    <BarChart3 size={20} />
                    {compareMetric === 'cost' ? 'Cost Comparison (per 1M tokens)' : 'Context Window (thousands of tokens)'}
                </h2>
                <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        {compareMetric === 'cost' ? (
                            <BarChart data={costData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                                <YAxis dataKey="name" type="category" width={150} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                                    formatter={(value) => [`$${(typeof value === 'number' ? value : 0).toFixed(2)}`, '']}
                                />
                                <Legend />
                                <Bar dataKey="input" name="Input Cost" fill="#22c55e" radius={[0, 4, 4, 0]} />
                                <Bar dataKey="output" name="Output Cost" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        ) : (
                            <BarChart data={contextData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                                <YAxis dataKey="name" type="category" width={150} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                                    formatter={(value) => [`${typeof value === 'number' ? value : 0}K tokens`, '']}
                                />
                                <Bar dataKey="context" name="Context (K tokens)" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                </div>
                {unknownCount > 0 && (
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2 flex items-center gap-1">
                        <Info size={12} />
                        {unknownCount} model{unknownCount === 1 ? '' : 's'} in this filter {unknownCount === 1 ? 'is' : 'are'} not
                        plotted: Chasm has no published figure for {unknownCount === 1 ? 'it' : 'them'}.
                    </p>
                )}
            </div>

            {/* Cost vs Context */}
            <div className="bg-[hsl(var(--card))] rounded-xl p-6 border">
                <h2 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4 flex items-center gap-2">
                    <Expand size={20} />
                    Cost vs Context Window
                </h2>
                <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                                type="number"
                                dataKey="x"
                                name="Cost"
                                unit="$"
                                stroke="hsl(var(--muted-foreground))"
                                label={{ value: 'Avg Cost ($/1M tokens)', position: 'bottom', fill: 'hsl(var(--muted-foreground))' }}
                            />
                            <YAxis
                                type="number"
                                dataKey="y"
                                name="Context"
                                unit="K"
                                stroke="hsl(var(--muted-foreground))"
                                label={{ value: 'Context (K tokens)', angle: -90, position: 'left', fill: 'hsl(var(--muted-foreground))' }}
                            />
                            <Tooltip
                                cursor={{ strokeDasharray: '3 3' }}
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                                formatter={(value, name) => {
                                    const numValue = typeof value === 'number' ? value : 0;
                                    if (name === 'Cost') return [`$${numValue.toFixed(2)}`, name];
                                    return [`${numValue}K`, String(name)];
                                }}
                                labelFormatter={(_, payload) =>
                                    (payload as unknown as { payload?: { name?: string } }[])?.[0]?.payload?.name || ''
                                }
                            />
                            {allProviders
                                .filter((p) => selectedProviders.includes(p))
                                .map((provider) => (
                                    <Scatter
                                        key={provider}
                                        name={provider}
                                        data={scatterData.filter((d) => d.provider === provider)}
                                        fill={providerColors[provider]}
                                    />
                                ))}
                            <Legend />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2 flex items-center gap-1">
                    <Info size={12} />
                    Both axes are published figures. Top-left is a large context window at a low price.
                </p>
            </div>

            {/* Detailed Comparison Table */}
            <div className="bg-[hsl(var(--card))] rounded-xl p-6 border">
                <h2 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4 flex items-center gap-2">
                    <Cpu size={20} />
                    Detailed Model Specifications
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b text-left">
                                <th className="pb-3 text-[hsl(var(--muted-foreground))] font-medium">Provider</th>
                                <th className="pb-3 text-[hsl(var(--muted-foreground))] font-medium">Model</th>
                                <th className="pb-3 text-[hsl(var(--muted-foreground))] font-medium">Type</th>
                                <th className="pb-3 text-[hsl(var(--muted-foreground))] font-medium text-right">Input $/1M</th>
                                <th className="pb-3 text-[hsl(var(--muted-foreground))] font-medium text-right">Output $/1M</th>
                                <th className="pb-3 text-[hsl(var(--muted-foreground))] font-medium text-right">Context</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredModels.map((m) => (
                                <tr
                                    key={`${m.provider}-${m.model}`}
                                    className="border-b border-[hsl(var(--border))]/50 hover:bg-[hsl(var(--muted))]/50"
                                >
                                    <td className="py-3">
                                        <span className="flex items-center gap-2">
                                            <span
                                                className="w-2 h-2 rounded-full"
                                                style={{ backgroundColor: providerColors[m.provider] }}
                                            />
                                            {m.provider}
                                        </span>
                                    </td>
                                    <td className="py-3 font-medium text-[hsl(var(--foreground))]">{m.model}</td>
                                    <td className="py-3">
                                        <span
                                            className={`px-2 py-0.5 rounded text-xs ${m.type === 'cloud'
                                                ? 'bg-blue-500/20 text-blue-400'
                                                : 'bg-green-500/20 text-green-400'
                                                }`}
                                        >
                                            {m.type}
                                        </span>
                                    </td>
                                    <td className="py-3 text-right font-mono">
                                        {m.inputCost === 0 ? (
                                            <span className="text-green-500">Free</span>
                                        ) : (
                                            formatCost(m.inputCost)
                                        )}
                                    </td>
                                    <td className="py-3 text-right font-mono">
                                        {m.outputCost === 0 ? (
                                            <span className="text-green-500">Free</span>
                                        ) : (
                                            formatCost(m.outputCost)
                                        )}
                                    </td>
                                    <td className="py-3 text-right font-mono">{formatContext(m.contextWindow)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
