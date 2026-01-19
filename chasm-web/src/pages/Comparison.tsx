import { useState, useMemo } from 'react';
import {
    BarChart3,
    TrendingUp,
    DollarSign,
    Zap,
    Target,
    ArrowUpRight,
    ArrowDownRight,
    Filter,
    Download,
    RefreshCw,
    Info,
    Cpu,
    Loader2,
    AlertCircle,
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
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    ScatterChart,
    Scatter,
    ZAxis,
} from 'recharts';

// Provider/Model data with performance metrics
const providerModels = [
    // OpenAI
    { provider: 'OpenAI', model: 'gpt-4o', type: 'cloud', category: 'chat', inputCost: 2.50, outputCost: 10.00, latency: 850, tokensPerSec: 85, accuracy: 94, contextWindow: 128000, mmlu: 88.7, humaneval: 90.2, reasoning: 92, coding: 89, creative: 88 },
    { provider: 'OpenAI', model: 'gpt-4o-mini', type: 'cloud', category: 'chat', inputCost: 0.15, outputCost: 0.60, latency: 420, tokensPerSec: 130, accuracy: 87, contextWindow: 128000, mmlu: 82.0, humaneval: 87.0, reasoning: 85, coding: 84, creative: 86 },
    { provider: 'OpenAI', model: 'o1', type: 'cloud', category: 'reasoning', inputCost: 15.00, outputCost: 60.00, latency: 12000, tokensPerSec: 25, accuracy: 97, contextWindow: 200000, mmlu: 92.3, humaneval: 94.5, reasoning: 98, coding: 93, creative: 75 },
    { provider: 'OpenAI', model: 'o1-mini', type: 'cloud', category: 'reasoning', inputCost: 3.00, outputCost: 12.00, latency: 4500, tokensPerSec: 45, accuracy: 93, contextWindow: 128000, mmlu: 85.2, humaneval: 92.0, reasoning: 95, coding: 91, creative: 72 },

    // Anthropic
    { provider: 'Anthropic', model: 'claude-4-opus', type: 'cloud', category: 'chat', inputCost: 15.00, outputCost: 75.00, latency: 1200, tokensPerSec: 60, accuracy: 96, contextWindow: 200000, mmlu: 91.5, humaneval: 92.8, reasoning: 94, coding: 91, creative: 95 },
    { provider: 'Anthropic', model: 'claude-4-sonnet', type: 'cloud', category: 'chat', inputCost: 3.00, outputCost: 15.00, latency: 680, tokensPerSec: 95, accuracy: 93, contextWindow: 200000, mmlu: 88.7, humaneval: 93.7, reasoning: 91, coding: 92, creative: 93 },
    { provider: 'Anthropic', model: 'claude-3.5-sonnet', type: 'cloud', category: 'chat', inputCost: 3.00, outputCost: 15.00, latency: 650, tokensPerSec: 100, accuracy: 92, contextWindow: 200000, mmlu: 88.3, humaneval: 92.0, reasoning: 90, coding: 91, creative: 92 },
    { provider: 'Anthropic', model: 'claude-3.5-haiku', type: 'cloud', category: 'chat', inputCost: 0.25, outputCost: 1.25, latency: 280, tokensPerSec: 180, accuracy: 85, contextWindow: 200000, mmlu: 75.2, humaneval: 88.1, reasoning: 82, coding: 86, creative: 84 },

    // Google
    { provider: 'Google', model: 'gemini-2.0-flash', type: 'cloud', category: 'chat', inputCost: 0.075, outputCost: 0.30, latency: 320, tokensPerSec: 200, accuracy: 88, contextWindow: 1000000, mmlu: 85.0, humaneval: 85.5, reasoning: 86, coding: 84, creative: 87 },
    { provider: 'Google', model: 'gemini-2.0-pro', type: 'cloud', category: 'chat', inputCost: 1.25, outputCost: 5.00, latency: 750, tokensPerSec: 90, accuracy: 92, contextWindow: 2000000, mmlu: 88.5, humaneval: 89.2, reasoning: 90, coding: 88, creative: 89 },
    { provider: 'Google', model: 'gemini-1.5-pro', type: 'cloud', category: 'chat', inputCost: 1.25, outputCost: 5.00, latency: 800, tokensPerSec: 85, accuracy: 90, contextWindow: 2000000, mmlu: 86.5, humaneval: 87.0, reasoning: 88, coding: 86, creative: 88 },

    // DeepSeek
    { provider: 'DeepSeek', model: 'deepseek-chat', type: 'cloud', category: 'chat', inputCost: 0.14, outputCost: 0.28, latency: 450, tokensPerSec: 120, accuracy: 89, contextWindow: 64000, mmlu: 84.0, humaneval: 88.5, reasoning: 87, coding: 90, creative: 85 },
    { provider: 'DeepSeek', model: 'deepseek-reasoner', type: 'cloud', category: 'reasoning', inputCost: 0.55, outputCost: 2.19, latency: 8000, tokensPerSec: 35, accuracy: 94, contextWindow: 64000, mmlu: 90.8, humaneval: 92.3, reasoning: 96, coding: 93, creative: 70 },
    { provider: 'DeepSeek', model: 'deepseek-coder', type: 'cloud', category: 'code', inputCost: 0.14, outputCost: 0.28, latency: 400, tokensPerSec: 130, accuracy: 91, contextWindow: 64000, mmlu: 78.0, humaneval: 93.5, reasoning: 82, coding: 95, creative: 65 },

    // Perplexity
    { provider: 'Perplexity', model: 'sonar-pro', type: 'cloud', category: 'search', inputCost: 3.00, outputCost: 15.00, latency: 1500, tokensPerSec: 70, accuracy: 91, contextWindow: 200000, mmlu: 87.0, humaneval: 82.0, reasoning: 88, coding: 80, creative: 85 },
    { provider: 'Perplexity', model: 'sonar-reasoning-pro', type: 'cloud', category: 'reasoning', inputCost: 5.00, outputCost: 20.00, latency: 6000, tokensPerSec: 40, accuracy: 93, contextWindow: 200000, mmlu: 89.5, humaneval: 84.0, reasoning: 94, coding: 82, creative: 78 },

    // Qwen
    { provider: 'Qwen', model: 'qwen-max', type: 'cloud', category: 'chat', inputCost: 1.60, outputCost: 6.40, latency: 600, tokensPerSec: 95, accuracy: 91, contextWindow: 32000, mmlu: 86.5, humaneval: 90.0, reasoning: 89, coding: 91, creative: 87 },
    { provider: 'Qwen', model: 'qwen-plus', type: 'cloud', category: 'chat', inputCost: 0.40, outputCost: 1.60, latency: 380, tokensPerSec: 140, accuracy: 88, contextWindow: 131072, mmlu: 83.0, humaneval: 87.5, reasoning: 85, coding: 88, creative: 84 },
    { provider: 'Qwen', model: 'qwen-turbo', type: 'cloud', category: 'chat', inputCost: 0.05, outputCost: 0.20, latency: 250, tokensPerSec: 180, accuracy: 82, contextWindow: 131072, mmlu: 78.0, humaneval: 82.0, reasoning: 79, coding: 83, creative: 80 },

    // Local providers
    { provider: 'Ollama', model: 'llama3.3-70b', type: 'local', category: 'chat', inputCost: 0, outputCost: 0, latency: 1200, tokensPerSec: 35, accuracy: 88, contextWindow: 128000, mmlu: 82.0, humaneval: 85.0, reasoning: 85, coding: 84, creative: 86 },
    { provider: 'Ollama', model: 'qwen2.5-coder-32b', type: 'local', category: 'code', inputCost: 0, outputCost: 0, latency: 800, tokensPerSec: 45, accuracy: 87, contextWindow: 32768, mmlu: 75.0, humaneval: 91.0, reasoning: 78, coding: 92, creative: 70 },
    { provider: 'Ollama', model: 'deepseek-r1-32b', type: 'local', category: 'reasoning', inputCost: 0, outputCost: 0, latency: 5000, tokensPerSec: 20, accuracy: 90, contextWindow: 64000, mmlu: 85.0, humaneval: 89.0, reasoning: 93, coding: 88, creative: 68 },
    { provider: 'Ollama', model: 'mistral-7b', type: 'local', category: 'chat', inputCost: 0, outputCost: 0, latency: 180, tokensPerSec: 120, accuracy: 78, contextWindow: 32768, mmlu: 68.0, humaneval: 72.0, reasoning: 72, coding: 70, creative: 75 },

    { provider: 'LM Studio', model: 'phi-4-14b', type: 'local', category: 'chat', inputCost: 0, outputCost: 0, latency: 350, tokensPerSec: 80, accuracy: 85, contextWindow: 16384, mmlu: 80.0, humaneval: 84.0, reasoning: 83, coding: 85, creative: 78 },
    { provider: 'vLLM', model: 'llama-3.3-70b', type: 'local', category: 'chat', inputCost: 0, outputCost: 0, latency: 600, tokensPerSec: 85, accuracy: 88, contextWindow: 128000, mmlu: 82.0, humaneval: 85.0, reasoning: 85, coding: 84, creative: 86 },
    { provider: 'llama.cpp', model: 'qwen2.5-72b-q4', type: 'local', category: 'chat', inputCost: 0, outputCost: 0, latency: 900, tokensPerSec: 40, accuracy: 86, contextWindow: 32768, mmlu: 80.0, humaneval: 86.0, reasoning: 83, coding: 87, creative: 82 },
];

// Colors for providers
const providerColors: Record<string, string> = {
    'OpenAI': '#10a37f',
    'Anthropic': '#d4a574',
    'Google': '#4285f4',
    'DeepSeek': '#0066ff',
    'Perplexity': '#20b2aa',
    'Qwen': '#ff6b35',
    'Ollama': '#ffffff',
    'LM Studio': '#a855f7',
    'vLLM': '#0e7490',
    'llama.cpp': '#22c55e',
};

type CompareMetric = 'cost' | 'speed' | 'accuracy' | 'value' | 'benchmarks';
type ModelCategory = 'all' | 'chat' | 'reasoning' | 'code' | 'search';
type ProviderType = 'all' | 'cloud' | 'local';

export default function Comparison() {
    // API Data
    const { data: apiProviders, isLoading: providersLoading, refetch: refetchProviders } = useProviders();
    const { data: providerHealthData } = useProviderHealth();
    const { data: statistics } = useStatistics();

    const [selectedProviders, setSelectedProviders] = useState<string[]>(['OpenAI', 'Anthropic', 'Google', 'DeepSeek']);
    const [selectedModels, setSelectedModels] = useState<string[]>([]);
    const [compareMetric, setCompareMetric] = useState<CompareMetric>('value');
    const [modelCategory, setModelCategory] = useState<ModelCategory>('all');
    const [providerType, setProviderType] = useState<ProviderType>('all');
    const [showDetails, setShowDetails] = useState(true);

    // Merge API providers with benchmark reference data
    const enhancedModels = useMemo(() => {
        // Start with benchmark reference data
        const models = [...providerModels];

        // Add any providers from API that aren't in benchmark data
        if (apiProviders) {
            for (const provider of apiProviders) {
                const existingProvider = models.find(m =>
                    m.provider.toLowerCase() === provider.name.toLowerCase()
                );

                if (!existingProvider && provider.models) {
                    // Add models from API provider
                    for (const modelName of provider.models) {
                        const isLocal = provider.type === 'local' ||
                            ['ollama', 'lm-studio', 'vllm', 'llama.cpp', 'llamafile', 'localai', 'gpt4all', 'jan']
                                .includes(provider.name.toLowerCase());

                        models.push({
                            provider: provider.name,
                            model: modelName,
                            type: isLocal ? 'local' : 'cloud',
                            category: 'chat' as const,
                            inputCost: isLocal ? 0 : 1.00,  // Default pricing for unknown models
                            outputCost: isLocal ? 0 : 3.00,
                            latency: isLocal ? 500 : 600,
                            tokensPerSec: isLocal ? 50 : 80,
                            accuracy: 85,
                            contextWindow: 32000,
                            mmlu: 80,
                            humaneval: 80,
                            reasoning: 80,
                            coding: 80,
                            creative: 80,
                        });
                    }
                }
            }
        }

        return models;
    }, [apiProviders]);

    // Filter models based on selections
    const filteredModels = enhancedModels.filter(m => {
        if (providerType !== 'all' && m.type !== providerType) return false;
        if (modelCategory !== 'all' && m.category !== modelCategory) return false;
        if (selectedProviders.length > 0 && !selectedProviders.includes(m.provider)) return false;
        return true;
    });

    // Get unique providers (combine static + API)
    const allProviders = useMemo(() => {
        const providers = new Set(providerModels.map(m => m.provider));
        if (apiProviders) {
            apiProviders.forEach(p => providers.add(p.name));
        }
        return [...providers];
    }, [apiProviders]);

    // Provider health status for display
    const providerStatus = useMemo(() => {
        const status: Record<string, boolean> = {};
        if (providerHealthData) {
            providerHealthData.forEach(h => {
                status[h.providerId] = h.status === 'connected';
            });
        }
        return status;
    }, [providerHealthData]);

    // Cost comparison data
    const costData = filteredModels.map(m => ({
        name: `${m.model}`,
        provider: m.provider,
        input: m.inputCost,
        output: m.outputCost,
        total: (m.inputCost + m.outputCost) / 2,
    })).sort((a, b) => a.total - b.total);

    // Speed comparison data
    const speedData = filteredModels.map(m => ({
        name: m.model,
        provider: m.provider,
        latency: m.latency,
        tokensPerSec: m.tokensPerSec,
    })).sort((a, b) => b.tokensPerSec - a.tokensPerSec);

    // Value score (accuracy / cost, higher is better)
    const valueData = filteredModels.map(m => {
        const avgCost = (m.inputCost + m.outputCost) / 2 || 0.01; // Avoid division by zero for local
        const valueScore = m.type === 'local' ? m.accuracy * 10 : (m.accuracy / avgCost) * 10;
        return {
            name: m.model,
            provider: m.provider,
            value: Math.round(valueScore),
            accuracy: m.accuracy,
            cost: avgCost,
            type: m.type,
        };
    }).sort((a, b) => b.value - a.value);

    // Scatter data for cost vs performance
    const scatterData = filteredModels.map(m => ({
        x: (m.inputCost + m.outputCost) / 2,
        y: m.accuracy,
        z: m.tokensPerSec,
        name: m.model,
        provider: m.provider,
    }));

    // Models for radar comparison (top 5 by selection or default)
    const radarModels = selectedModels.length > 0
        ? filteredModels.filter(m => selectedModels.includes(`${m.provider}-${m.model}`)).slice(0, 5)
        : filteredModels.slice(0, 5);

    const radarData = [
        { metric: 'Reasoning', ...Object.fromEntries(radarModels.map(m => [`${m.provider}-${m.model}`, m.reasoning])) },
        { metric: 'Coding', ...Object.fromEntries(radarModels.map(m => [`${m.provider}-${m.model}`, m.coding])) },
        { metric: 'Creative', ...Object.fromEntries(radarModels.map(m => [`${m.provider}-${m.model}`, m.creative])) },
        { metric: 'MMLU', ...Object.fromEntries(radarModels.map(m => [`${m.provider}-${m.model}`, m.mmlu])) },
        { metric: 'HumanEval', ...Object.fromEntries(radarModels.map(m => [`${m.provider}-${m.model}`, m.humaneval])) },
    ];

    const toggleProvider = (provider: string) => {
        setSelectedProviders(prev =>
            prev.includes(provider)
                ? prev.filter(p => p !== provider)
                : [...prev, provider]
        );
    };

    const toggleModel = (modelKey: string) => {
        setSelectedModels(prev =>
            prev.includes(modelKey)
                ? prev.filter(m => m !== modelKey)
                : prev.length < 5 ? [...prev, modelKey] : prev
        );
    };

    // Stats cards
    const cheapestModel = [...filteredModels].filter(m => m.type === 'cloud').sort((a, b) => (a.inputCost + a.outputCost) - (b.inputCost + b.outputCost))[0];
    const fastestModel = [...filteredModels].sort((a, b) => b.tokensPerSec - a.tokensPerSec)[0];
    const mostAccurate = [...filteredModels].sort((a, b) => b.accuracy - a.accuracy)[0];
    const bestValue = valueData[0];

    // Loading state
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
                        Compare provider and model performance, cost, and value
                        {apiProviders && (
                            <span className="ml-2 text-xs">
                                ({apiProviders.length} connected providers)
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {statistics && (
                        <div className="text-sm text-[hsl(var(--muted-foreground))] mr-4">
                            <span className="font-medium">{statistics.totalSessions}</span> sessions tracked
                        </div>
                    )}
                    <button className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded-lg hover:bg-[hsl(var(--muted))]/80 transition-colors">
                        <Download size={18} />
                        Export
                    </button>
                    <button
                        onClick={() => refetchProviders()}
                        className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90 transition-colors"
                    >
                        <RefreshCw size={18} />
                        Refresh Data
                    </button>
                </div>
            </div>

            {/* Connected Providers Status */}
            {apiProviders && apiProviders.length > 0 && (
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertCircle size={18} className="text-[hsl(var(--muted-foreground))]" />
                        <span className="font-medium text-[hsl(var(--foreground))]">Connected Providers</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {apiProviders.map(provider => (
                            <div
                                key={provider.id}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[hsl(var(--muted))]"
                            >
                                <span
                                    className={`w-2 h-2 rounded-full ${providerStatus[provider.id] ? 'bg-green-500' : 'bg-red-500'
                                        }`}
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
                    {/* Provider Type */}
                    <div>
                        <label className="text-sm text-[hsl(var(--muted-foreground))] mb-2 block">Provider Type</label>
                        <div className="flex gap-2">
                            {(['all', 'cloud', 'local'] as ProviderType[]).map(type => (
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

                    {/* Model Category */}
                    <div>
                        <label className="text-sm text-[hsl(var(--muted-foreground))] mb-2 block">Category</label>
                        <div className="flex gap-2 flex-wrap">
                            {(['all', 'chat', 'reasoning', 'code', 'search'] as ModelCategory[]).map(cat => (
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

                    {/* Compare By */}
                    <div>
                        <label className="text-sm text-[hsl(var(--muted-foreground))] mb-2 block">Compare By</label>
                        <div className="flex gap-2 flex-wrap">
                            {(['cost', 'speed', 'accuracy', 'value', 'benchmarks'] as CompareMetric[]).map(metric => (
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

                {/* Provider Selection */}
                <div className="mt-4 pt-4 border-t">
                    <label className="text-sm text-[hsl(var(--muted-foreground))] mb-2 block">Providers</label>
                    <div className="flex gap-2 flex-wrap">
                        {allProviders.map(provider => (
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <DollarSign size={18} />
                        <span className="text-sm">Cheapest (Cloud)</span>
                    </div>
                    {cheapestModel && (
                        <>
                            <p className="text-xl font-bold text-[hsl(var(--foreground))]">{cheapestModel.model}</p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">{cheapestModel.provider}</p>
                            <p className="text-sm text-green-500 flex items-center gap-1 mt-1">
                                <ArrowDownRight size={14} />
                                ${((cheapestModel.inputCost + cheapestModel.outputCost) / 2).toFixed(2)}/1M tokens
                            </p>
                        </>
                    )}
                </div>

                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Zap size={18} />
                        <span className="text-sm">Fastest</span>
                    </div>
                    {fastestModel && (
                        <>
                            <p className="text-xl font-bold text-[hsl(var(--foreground))]">{fastestModel.model}</p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">{fastestModel.provider}</p>
                            <p className="text-sm text-cyan-700 flex items-center gap-1 mt-1">
                                <ArrowUpRight size={14} />
                                {fastestModel.tokensPerSec} tok/s
                            </p>
                        </>
                    )}
                </div>

                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Target size={18} />
                        <span className="text-sm">Most Accurate</span>
                    </div>
                    {mostAccurate && (
                        <>
                            <p className="text-xl font-bold text-[hsl(var(--foreground))]">{mostAccurate.model}</p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">{mostAccurate.provider}</p>
                            <p className="text-sm text-purple-500 flex items-center gap-1 mt-1">
                                <ArrowUpRight size={14} />
                                {mostAccurate.accuracy}% accuracy
                            </p>
                        </>
                    )}
                </div>

                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <TrendingUp size={18} />
                        <span className="text-sm">Best Value</span>
                    </div>
                    {bestValue && (
                        <>
                            <p className="text-xl font-bold text-[hsl(var(--foreground))]">{bestValue.name}</p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">{bestValue.provider}</p>
                            <p className="text-sm text-amber-500 flex items-center gap-1 mt-1">
                                <ArrowUpRight size={14} />
                                Score: {bestValue.value}
                            </p>
                        </>
                    )}
                </div>
            </div>

            {/* Main Chart */}
            <div className="bg-[hsl(var(--card))] rounded-xl p-6 border">
                <h2 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4 flex items-center gap-2">
                    <BarChart3 size={20} />
                    {compareMetric === 'cost' && 'Cost Comparison (per 1M tokens)'}
                    {compareMetric === 'speed' && 'Speed Comparison'}
                    {compareMetric === 'accuracy' && 'Accuracy Comparison'}
                    {compareMetric === 'value' && 'Value Score (Accuracy / Cost)'}
                    {compareMetric === 'benchmarks' && 'Performance Benchmarks (MMLU, HumanEval, Reasoning, Coding)'}
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
                                    formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                                />
                                <Legend />
                                <Bar dataKey="input" name="Input Cost" fill="#22c55e" radius={[0, 4, 4, 0]} />
                                <Bar dataKey="output" name="Output Cost" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        ) : compareMetric === 'speed' ? (
                            <BarChart data={speedData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                                <YAxis dataKey="name" type="category" width={150} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                                />
                                <Legend />
                                <Bar dataKey="tokensPerSec" name="Tokens/sec" fill="#0e7490" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        ) : compareMetric === 'value' ? (
                            <BarChart data={valueData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                                <YAxis dataKey="name" type="category" width={150} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                                    formatter={(value: number) => [`${value}`, 'Value Score']}
                                />
                                <Bar dataKey="value" name="Value Score" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        ) : compareMetric === 'benchmarks' ? (
                            <BarChart data={filteredModels.sort((a, b) => b.mmlu - a.mmlu).slice(0, 15)} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis type="number" domain={[50, 100]} stroke="hsl(var(--muted-foreground))" />
                                <YAxis dataKey="model" type="category" width={150} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                                />
                                <Legend />
                                <Bar dataKey="mmlu" name="MMLU" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                                <Bar dataKey="humaneval" name="HumanEval" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                                <Bar dataKey="reasoning" name="Reasoning" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                                <Bar dataKey="coding" name="Coding" fill="#22c55e" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        ) : (
                            <BarChart data={filteredModels.sort((a, b) => b.accuracy - a.accuracy)} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis type="number" domain={[70, 100]} stroke="hsl(var(--muted-foreground))" />
                                <YAxis dataKey="model" type="category" width={150} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                                    formatter={(value: number) => [`${value}%`, 'Accuracy']}
                                />
                                <Bar dataKey="accuracy" name="Accuracy" fill="#a855f7" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Radar Chart - Benchmark Comparison */}
                <div className="bg-[hsl(var(--card))] rounded-xl p-6 border">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
                            <Target size={20} />
                            Benchmark Comparison
                        </h2>
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">Select up to 5 models</span>
                    </div>

                    {/* Model selector for radar */}
                    <div className="flex flex-wrap gap-2 mb-4 max-h-24 overflow-y-auto">
                        {filteredModels.slice(0, 12).map(m => {
                            const key = `${m.provider}-${m.model}`;
                            const isSelected = selectedModels.includes(key) || (selectedModels.length === 0 && radarModels.includes(m));
                            return (
                                <button
                                    key={key}
                                    onClick={() => toggleModel(key)}
                                    className={`px-2 py-1 rounded text-xs transition-colors ${isSelected
                                        ? 'bg-[hsl(var(--primary))] text-white'
                                        : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                                        }`}
                                >
                                    {m.model}
                                </button>
                            );
                        })}
                    </div>

                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={radarData}>
                                <PolarGrid stroke="hsl(var(--border))" />
                                <PolarAngleAxis dataKey="metric" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                                {radarModels.map((m) => (
                                    <Radar
                                        key={`${m.provider}-${m.model}`}
                                        name={m.model}
                                        dataKey={`${m.provider}-${m.model}`}
                                        stroke={providerColors[m.provider]}
                                        fill={providerColors[m.provider]}
                                        fillOpacity={0.1}
                                        strokeWidth={2}
                                    />
                                ))}
                                <Legend />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                                />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Scatter Plot - Cost vs Performance */}
                <div className="bg-[hsl(var(--card))] rounded-xl p-6 border">
                    <h2 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4 flex items-center gap-2">
                        <TrendingUp size={20} />
                        Cost vs Performance
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
                                    name="Accuracy"
                                    unit="%"
                                    domain={[75, 100]}
                                    stroke="hsl(var(--muted-foreground))"
                                    label={{ value: 'Accuracy %', angle: -90, position: 'left', fill: 'hsl(var(--muted-foreground))' }}
                                />
                                <ZAxis type="number" dataKey="z" range={[50, 400]} name="Speed" />
                                <Tooltip
                                    cursor={{ strokeDasharray: '3 3' }}
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                                    formatter={(value: number, name: string) => {
                                        if (name === 'Cost') return [`$${value.toFixed(2)}`, name];
                                        if (name === 'Accuracy') return [`${value}%`, name];
                                        return [value, name];
                                    }}
                                    labelFormatter={(_, payload) => payload[0]?.payload?.name || ''}
                                />
                                {allProviders.filter(p => selectedProviders.includes(p)).map(provider => (
                                    <Scatter
                                        key={provider}
                                        name={provider}
                                        data={scatterData.filter(d => d.provider === provider)}
                                        fill={providerColors[provider]}
                                    />
                                ))}
                                <Legend />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2 flex items-center gap-1">
                        <Info size={12} />
                        Bubble size represents tokens/second. Top-left = high accuracy, low cost (best value)
                    </p>
                </div>
            </div>

            {/* Detailed Comparison Table */}
            <div className="bg-[hsl(var(--card))] rounded-xl p-6 border">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
                        <Cpu size={20} />
                        Detailed Model Specifications
                    </h2>
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="text-sm text-[hsl(var(--primary))] hover:underline"
                    >
                        {showDetails ? 'Show Less' : 'Show All Details'}
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b text-left">
                                <th className="pb-3 text-[hsl(var(--muted-foreground))] font-medium">Provider</th>
                                <th className="pb-3 text-[hsl(var(--muted-foreground))] font-medium">Model</th>
                                <th className="pb-3 text-[hsl(var(--muted-foreground))] font-medium">Type</th>
                                <th className="pb-3 text-[hsl(var(--muted-foreground))] font-medium text-right">Input $/1M</th>
                                <th className="pb-3 text-[hsl(var(--muted-foreground))] font-medium text-right">Output $/1M</th>
                                <th className="pb-3 text-[hsl(var(--muted-foreground))] font-medium text-right">Latency</th>
                                <th className="pb-3 text-[hsl(var(--muted-foreground))] font-medium text-right">Tok/s</th>
                                <th className="pb-3 text-[hsl(var(--muted-foreground))] font-medium text-right">Context</th>
                                {showDetails && (
                                    <>
                                        <th className="pb-3 text-[hsl(var(--muted-foreground))] font-medium text-right">MMLU</th>
                                        <th className="pb-3 text-[hsl(var(--muted-foreground))] font-medium text-right">HumanEval</th>
                                        <th className="pb-3 text-[hsl(var(--muted-foreground))] font-medium text-right">Reasoning</th>
                                        <th className="pb-3 text-[hsl(var(--muted-foreground))] font-medium text-right">Coding</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredModels.map((m) => (
                                <tr key={`${m.provider}-${m.model}`} className="border-b border-[hsl(var(--border))]/50 hover:bg-[hsl(var(--muted))]/50">
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
                                        <span className={`px-2 py-0.5 rounded text-xs ${m.type === 'cloud'
                                            ? 'bg-blue-500/20 text-blue-400'
                                            : 'bg-green-500/20 text-green-400'
                                            }`}>
                                            {m.type}
                                        </span>
                                    </td>
                                    <td className="py-3 text-right font-mono">
                                        {m.inputCost === 0 ? <span className="text-green-500">Free</span> : `$${m.inputCost.toFixed(2)}`}
                                    </td>
                                    <td className="py-3 text-right font-mono">
                                        {m.outputCost === 0 ? <span className="text-green-500">Free</span> : `$${m.outputCost.toFixed(2)}`}
                                    </td>
                                    <td className="py-3 text-right font-mono">{m.latency >= 1000 ? `${(m.latency / 1000).toFixed(1)}s` : `${m.latency}ms`}</td>
                                    <td className="py-3 text-right font-mono">{m.tokensPerSec}</td>
                                    <td className="py-3 text-right font-mono">{(m.contextWindow / 1000).toFixed(0)}K</td>
                                    {showDetails && (
                                        <>
                                            <td className="py-3 text-right font-mono">{m.mmlu}</td>
                                            <td className="py-3 text-right font-mono">{m.humaneval}</td>
                                            <td className="py-3 text-right font-mono">{m.reasoning}</td>
                                            <td className="py-3 text-right font-mono">{m.coding}</td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer Note */}
            <div className="flex items-start gap-2 text-sm text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]/50 rounded-lg p-4">
                <Info size={16} className="mt-0.5 shrink-0" />
                <p>
                    Benchmark data is from reference sources and may vary. Connected providers are shown with live status.
                    Local model performance depends on hardware. Cost is shown per 1 million tokens.
                    Value score = (Accuracy / Avg Cost) × 10 for cloud models, Accuracy × 10 for local models (free).
                    {apiProviders && apiProviders.length > 0 && (
                        <span className="ml-1">
                            Currently tracking {apiProviders.length} live provider{apiProviders.length !== 1 ? 's' : ''}.
                        </span>
                    )}
                </p>
            </div>
        </div>
    );
}
