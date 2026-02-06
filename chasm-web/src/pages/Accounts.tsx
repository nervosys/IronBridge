import { useState, useMemo } from 'react';
import {
    Key,
    Eye,
    EyeOff,
    CheckCircle2,
    XCircle,
    RefreshCw,
    ExternalLink,
    Server,
    Shield,
    Trash2,
    Loader2,
    Coins,
    TrendingUp,
    BarChart3,
    Fingerprint,
    ShieldCheck,
    KeyRound,
    UserCircle,
    Link2,
    Unlink,
    Settings,
    Lock,
    User,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { formatDate } from '@csm/shared';
import { useApi } from '../context/ApiContext';
import { useRemoveAccount, useTestProvider, useProviderStats } from '../hooks/useApi';

// Provider documentation URLs
const providerDocs: Record<string, string> = {
    openai: 'https://platform.openai.com/api-keys',
    anthropic: 'https://console.anthropic.com/account/keys',
    google: 'https://makersuite.google.com/app/apikey',
    azure: 'https://portal.azure.com',
    aws: 'https://aws.amazon.com/bedrock',
    deepseek: 'https://platform.deepseek.com',
    perplexity: 'https://perplexity.ai',
    qwen: 'https://dashscope.aliyun.com',
    mistral: 'https://console.mistral.ai',
    cohere: 'https://dashboard.cohere.ai/api-keys',
    ollama: 'https://ollama.ai',
    lmstudio: 'https://lmstudio.ai',
    jan: 'https://jan.ai',
    gpt4all: 'https://gpt4all.io',
    llamafile: 'https://github.com/Mozilla-Ocho/llamafile',
    vllm: 'https://vllm.ai',
    llamacpp: 'https://github.com/ggerganov/llama.cpp',
    localai: 'https://localai.io',
    copilot: 'https://github.com/features/copilot',
    github: 'https://github.com/settings/tokens',
    huggingface: 'https://huggingface.co/settings/tokens',
};

// Provider colors
const providerColors: Record<string, string> = {
    openai: '#10a37f',
    anthropic: '#d4a27c',
    google: '#4285f4',
    azure: '#0078d4',
    aws: '#ff9900',
    deepseek: '#4f46e5',
    perplexity: '#20b2aa',
    qwen: '#ff6a00',
    mistral: '#ff7000',
    cohere: '#39594d',
    ollama: '#ffffff',
    lmstudio: '#6366f1',
    jan: '#2dd4bf',
    gpt4all: '#22c55e',
    llamafile: '#f59e0b',
    vllm: '#8b5cf6',
    llamacpp: '#06b6d4',
    localai: '#ec4899',
    copilot: '#0ea5e9',
    github: '#24292e',
    huggingface: '#ffcc00',
    microsoft: '#0078d4',
};

export default function Accounts() {
    const {
        providers,
        providerHealth,
        accounts,
        isLoading,
        refetchProviders,
        refetchAccounts,
    } = useApi();

    const { data: providerStatsData } = useProviderStats();
    const removeAccountMutation = useRemoveAccount();
    const testProviderMutation = useTestProvider();

    const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
    const [showKey, setShowKey] = useState<Record<string, boolean>>({});
    const [testingConnection, setTestingConnection] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'oauth' | 'cloud' | 'local' | 'usage'>('oauth');
    const [selectedOAuth, setSelectedOAuth] = useState<string | null>(null);

    // Separate providers by type
    const cloudProviders = useMemo(() =>
        providers.filter(p => p.type === 'cloud'),
        [providers]
    );

    const localProviders = useMemo(() =>
        providers.filter(p => p.type === 'local'),
        [providers]
    );

    // Get provider health status
    const getProviderStatus = (providerId: string) => {
        const health = providerHealth.find(h => h.providerId === providerId);
        return health?.status ?? 'unknown';
    };

    // Calculate stats from real data
    const connectedCloudCount = useMemo(() =>
        cloudProviders.filter(p => getProviderStatus(p.id) === 'connected').length,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [cloudProviders, providerHealth]
    );

    const connectedOAuthCount = accounts.length;

    // Calculate usage stats from provider stats
    const usageStats = useMemo(() => {
        if (!providerStatsData) {
            return { totalTokens: 0, totalMessages: 0, totalSessions: 0 };
        }
        const stats = Object.values(providerStatsData);
        return {
            totalTokens: stats.reduce((sum, s) => sum + (s.tokens || 0), 0),
            totalMessages: stats.reduce((sum, s) => sum + (s.messages || 0), 0),
            totalSessions: stats.reduce((sum, s) => sum + (s.sessions || 0), 0),
        };
    }, [providerStatsData]);

    const handleDisconnectAccount = async (accountId: string) => {
        await removeAccountMutation.mutate(accountId);
        await refetchAccounts();
    };

    const toggleShowKey = (id: string) => {
        setShowKey(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const testConnection = async (id: string) => {
        setTestingConnection(id);
        try {
            await testProviderMutation.mutate(id);
            await refetchProviders();
        } finally {
            setTestingConnection(null);
        }
    };

    const formatTokens = (tokens: number) => {
        if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
        if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
        return tokens.toString();
    };

    const getProviderColor = (providerId: string) => {
        return providerColors[providerId] ?? '#6366f1';
    };

    const getProviderDocs = (providerId: string) => {
        return providerDocs[providerId] ?? '#';
    };

    const currentProviders = activeTab === 'cloud' ? cloudProviders : activeTab === 'local' ? localProviders : [];
    const selectedProviderData = [...cloudProviders, ...localProviders].find(p => p.id === selectedProvider);

    // Generate usage chart data from provider stats
    const usageChartData = useMemo(() => {
        if (!providerStatsData) return [];
        return Object.entries(providerStatsData).map(([provider, stats]) => ({
            name: provider,
            tokens: stats.tokens,
            messages: stats.messages,
            sessions: stats.sessions,
        }));
    }, [providerStatsData]);

    // Pie chart data for provider distribution
    const providerPieData = useMemo(() => {
        if (!providerStatsData) return [];
        return Object.entries(providerStatsData)
            .filter(([, stats]) => stats.messages > 0)
            .map(([provider, stats]) => ({
                name: provider,
                value: stats.messages,
                color: getProviderColor(provider),
            }));
    }, [providerStatsData]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">Accounts</h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                        Manage authentication, API keys, and provider configurations
                    </p>
                </div>
                <button
                    onClick={() => {
                        refetchProviders();
                        refetchAccounts();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded-lg hover:bg-[hsl(var(--muted))]/80 transition-colors"
                >
                    <RefreshCw size={18} />
                    Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Link2 size={18} />
                        <span className="text-sm">OAuth Accounts</span>
                    </div>
                    <p className="text-2xl font-bold text-green-500">{connectedOAuthCount}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        connected accounts
                    </p>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Shield size={18} />
                        <span className="text-sm">Cloud Providers</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{connectedCloudCount}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        of {cloudProviders.length} connected
                    </p>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Server size={18} />
                        <span className="text-sm">Local Providers</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
                        {localProviders.filter(p => getProviderStatus(p.id) === 'connected').length}
                    </p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        of {localProviders.length} running
                    </p>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Coins size={18} />
                        <span className="text-sm">Total Tokens</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
                        {formatTokens(usageStats.totalTokens)}
                    </p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        across all providers
                    </p>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <TrendingUp size={18} />
                        <span className="text-sm">Total Messages</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">
                        {usageStats.totalMessages.toLocaleString()}
                    </p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        in {usageStats.totalSessions} sessions
                    </p>
                </div>
            </div>

            {/* Provider Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {cloudProviders.filter(p => getProviderStatus(p.id) === 'connected').slice(0, 4).map(provider => {
                    const stats = providerStatsData?.[provider.id];
                    return (
                        <div key={provider.id} className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                            <div className="flex items-center gap-2 mb-3">
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                                    style={{ backgroundColor: getProviderColor(provider.id) }}
                                >
                                    {provider.icon || provider.name.substring(0, 2).toUpperCase()}
                                </div>
                                <span className="font-medium text-[hsl(var(--foreground))]">{provider.name}</span>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-[hsl(var(--muted-foreground))]">Sessions</span>
                                    <span className="text-[hsl(var(--foreground))] font-medium">
                                        {stats?.sessions || 0}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-[hsl(var(--muted-foreground))]">Messages</span>
                                    <span className="text-[hsl(var(--foreground))] font-medium">
                                        {stats?.messages || 0}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-[hsl(var(--muted-foreground))]">Tokens</span>
                                    <span className="text-[hsl(var(--foreground))] font-medium">
                                        {formatTokens(stats?.tokens || 0)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b overflow-x-auto">
                <button
                    onClick={() => setActiveTab('oauth')}
                    className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'oauth'
                        ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                        : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                        }`}
                >
                    <Link2 size={18} />
                    Connected Accounts ({accounts.length})
                </button>
                <button
                    onClick={() => setActiveTab('cloud')}
                    className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'cloud'
                        ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                        : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                        }`}
                >
                    <Key size={18} />
                    Cloud Providers ({cloudProviders.length})
                </button>
                <button
                    onClick={() => setActiveTab('local')}
                    className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'local'
                        ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                        : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                        }`}
                >
                    <Server size={18} />
                    Local Providers ({localProviders.length})
                </button>
                <button
                    onClick={() => setActiveTab('usage')}
                    className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'usage'
                        ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                        : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                        }`}
                >
                    <BarChart3 size={18} />
                    Usage & Stats
                </button>
            </div>

            {/* OAuth Connected Accounts Tab */}
            {activeTab === 'oauth' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Account List */}
                    <div className="lg:col-span-1 space-y-3">
                        <h3 className="text-sm font-medium text-[hsl(var(--muted-foreground))] mb-2">Connected Accounts</h3>
                        {accounts.length === 0 ? (
                            <div className="bg-[hsl(var(--card))] rounded-xl p-6 border text-center">
                                <Link2 size={32} className="text-[hsl(var(--muted-foreground))] mx-auto mb-3" />
                                <p className="text-[hsl(var(--muted-foreground))]">No accounts connected</p>
                            </div>
                        ) : (
                            accounts.map(account => (
                                <div
                                    key={account.id}
                                    onClick={() => setSelectedOAuth(account.id)}
                                    className={`bg-[hsl(var(--card))] rounded-xl p-4 border cursor-pointer transition-all hover:border-[hsl(var(--primary))] ${selectedOAuth === account.id ? 'border-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary))]' : ''
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                                                style={{ backgroundColor: getProviderColor(account.provider) }}
                                            >
                                                {account.provider.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <span className="font-medium text-[hsl(var(--foreground))]">{account.name}</span>
                                                <p className="text-xs text-[hsl(var(--muted-foreground))]">{account.provider}</p>
                                            </div>
                                        </div>
                                        <CheckCircle2 size={20} className="text-green-500" />
                                    </div>
                                    {account.email && (
                                        <div className="mt-3 pt-3 border-t flex items-center gap-2">
                                            <UserCircle size={16} className="text-[hsl(var(--muted-foreground))]" />
                                            <span className="text-sm text-[hsl(var(--muted-foreground))]">
                                                {account.email}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Account Details */}
                    <div className="lg:col-span-2">
                        {selectedOAuth ? (
                            (() => {
                                const account = accounts.find(a => a.id === selectedOAuth);
                                if (!account) return null;
                                return (
                                    <div className="bg-[hsl(var(--card))] rounded-xl border overflow-hidden">
                                        {/* Header */}
                                        <div className="p-6 border-b">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div
                                                        className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                                                        style={{ backgroundColor: getProviderColor(account.provider) }}
                                                    >
                                                        {account.provider.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xl font-semibold text-[hsl(var(--foreground))]">
                                                            {account.name}
                                                        </h3>
                                                        <p className="text-[hsl(var(--muted-foreground))]">{account.provider}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-full flex items-center gap-1">
                                                                <Fingerprint size={12} />
                                                                OAuth 2.0
                                                            </span>
                                                            <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-500 rounded-full flex items-center gap-1">
                                                                <ShieldCheck size={12} />
                                                                Verified
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="p-6 space-y-6">
                                            {/* Connected Profile */}
                                            <div className="bg-[hsl(var(--muted))]/50 rounded-lg p-4">
                                                <h4 className="text-sm font-medium text-[hsl(var(--foreground))] mb-3 flex items-center gap-2">
                                                    <User size={16} />
                                                    Account Details
                                                </h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <span className="text-xs text-[hsl(var(--muted-foreground))]">Name</span>
                                                        <p className="text-sm font-medium text-[hsl(var(--foreground))]">{account.name}</p>
                                                    </div>
                                                    {account.email && (
                                                        <div>
                                                            <span className="text-xs text-[hsl(var(--muted-foreground))]">Email</span>
                                                            <p className="text-sm font-medium text-[hsl(var(--foreground))]">{account.email}</p>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <span className="text-xs text-[hsl(var(--muted-foreground))]">Connected</span>
                                                        <p className="text-sm font-medium text-[hsl(var(--foreground))]">{formatDate(account.createdAt)}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-[hsl(var(--muted-foreground))]">Last Updated</span>
                                                        <p className="text-sm font-medium text-[hsl(var(--foreground))]">{formatDate(account.updatedAt)}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Scopes */}
                                            {account.scopes.length > 0 && (
                                                <div>
                                                    <h4 className="text-sm font-medium text-[hsl(var(--foreground))] mb-3 flex items-center gap-2">
                                                        <Lock size={16} />
                                                        Granted Scopes
                                                    </h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {account.scopes.map((scope, i) => (
                                                            <span key={i} className="px-3 py-1.5 bg-[hsl(var(--muted))] rounded-lg text-sm text-[hsl(var(--foreground))] flex items-center gap-2">
                                                                <CheckCircle2 size={14} className="text-green-500" />
                                                                {scope}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Token Status */}
                                            <div>
                                                <h4 className="text-sm font-medium text-[hsl(var(--foreground))] mb-3 flex items-center gap-2">
                                                    <KeyRound size={16} />
                                                    Token Status
                                                </h4>
                                                <div className="bg-[hsl(var(--muted))]/50 rounded-lg p-4 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm text-[hsl(var(--muted-foreground))]">Access Token</span>
                                                        <span className="flex items-center gap-1 text-green-500 text-sm">
                                                            <CheckCircle2 size={14} />
                                                            Valid
                                                        </span>
                                                    </div>
                                                    {account.expiresAt && (
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm text-[hsl(var(--muted-foreground))]">Expires</span>
                                                            <span className="text-sm text-[hsl(var(--foreground))]">{formatDate(account.expiresAt)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center justify-between pt-4 border-t">
                                                <button
                                                    onClick={() => handleDisconnectAccount(account.id)}
                                                    disabled={removeAccountMutation.isLoading}
                                                    className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                >
                                                    {removeAccountMutation.isLoading ? (
                                                        <Loader2 size={18} className="animate-spin" />
                                                    ) : (
                                                        <Unlink size={18} />
                                                    )}
                                                    Disconnect Account
                                                </button>
                                                <button className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90 transition-colors">
                                                    <Settings size={18} />
                                                    Manage Permissions
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()
                        ) : (
                            <div className="bg-[hsl(var(--card))] rounded-xl border p-8 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
                                <Link2 size={48} className="text-[hsl(var(--muted-foreground))] mb-4" />
                                <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">Select an Account</h3>
                                <p className="text-[hsl(var(--muted-foreground))] mt-1">
                                    Choose a connected account to view details
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Usage Tab */}
            {activeTab === 'usage' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Provider Distribution */}
                        <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                            <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">Provider Distribution</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={providerPieData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={100}
                                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                        labelLine={false}
                                    >
                                        {providerPieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'hsl(var(--card))',
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: '8px',
                                        }}
                                        formatter={(value) => [(typeof value === 'number' ? value : 0).toLocaleString(), 'Messages']}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Provider Stats Bar Chart */}
                        <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                            <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">Usage by Provider</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={usageChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'hsl(var(--card))',
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: '8px',
                                        }}
                                    />
                                    <Legend />
                                    <Bar dataKey="sessions" fill="#3b82f6" name="Sessions" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="messages" fill="#10b981" name="Messages" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Provider Details Table */}
                    <div className="bg-[hsl(var(--card))] rounded-xl border overflow-hidden">
                        <div className="p-4 border-b">
                            <h3 className="font-semibold text-[hsl(var(--foreground))]">Provider Statistics</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-[hsl(var(--muted))]">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-[hsl(var(--muted-foreground))]">Provider</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-[hsl(var(--muted-foreground))]">Status</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium text-[hsl(var(--muted-foreground))]">Sessions</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium text-[hsl(var(--muted-foreground))]">Messages</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium text-[hsl(var(--muted-foreground))]">Tokens</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {providers.map(provider => {
                                        const stats = providerStatsData?.[provider.id];
                                        const status = getProviderStatus(provider.id);
                                        return (
                                            <tr key={provider.id} className="hover:bg-[hsl(var(--muted))]/50">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                                                            style={{ backgroundColor: getProviderColor(provider.id) }}
                                                        >
                                                            {provider.icon || provider.name.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <span className="font-medium text-[hsl(var(--foreground))]">{provider.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`flex items-center gap-1 text-sm ${status === 'connected' ? 'text-green-500' : status === 'error' ? 'text-red-500' : 'text-gray-500'}`}>
                                                        {status === 'connected' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                                                        {status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-[hsl(var(--foreground))]">{stats?.sessions || 0}</td>
                                                <td className="px-4 py-3 text-right text-[hsl(var(--foreground))]">{stats?.messages || 0}</td>
                                                <td className="px-4 py-3 text-right text-[hsl(var(--foreground))]">{formatTokens(stats?.tokens || 0)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Cloud/Local Provider Tabs */}
            {(activeTab === 'cloud' || activeTab === 'local') && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Provider List */}
                    <div className="lg:col-span-1 space-y-3">
                        {currentProviders.length === 0 ? (
                            <div className="bg-[hsl(var(--card))] rounded-xl p-6 border text-center">
                                <Server size={32} className="text-[hsl(var(--muted-foreground))] mx-auto mb-3" />
                                <p className="text-[hsl(var(--muted-foreground))]">No {activeTab} providers configured</p>
                            </div>
                        ) : (
                            currentProviders.map(provider => {
                                const status = getProviderStatus(provider.id);
                                return (
                                    <div
                                        key={provider.id}
                                        onClick={() => setSelectedProvider(provider.id)}
                                        className={`bg-[hsl(var(--card))] rounded-xl p-4 border cursor-pointer transition-all hover:border-[hsl(var(--primary))] ${selectedProvider === provider.id ? 'border-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary))]' : ''
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                                                    style={{ backgroundColor: getProviderColor(provider.id) }}
                                                >
                                                    {provider.icon || provider.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <span className="font-medium text-[hsl(var(--foreground))]">{provider.name}</span>
                                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                                        {provider.models.length} model{provider.models.length !== 1 ? 's' : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            {status === 'connected' ? (
                                                <CheckCircle2 size={20} className="text-green-500" />
                                            ) : status === 'error' ? (
                                                <XCircle size={20} className="text-red-500" />
                                            ) : (
                                                <XCircle size={20} className="text-gray-400" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Provider Details */}
                    <div className="lg:col-span-2">
                        {selectedProviderData ? (
                            <div className="bg-[hsl(var(--card))] rounded-xl border overflow-hidden">
                                {/* Header */}
                                <div className="p-6 border-b">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div
                                                className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                                                style={{ backgroundColor: getProviderColor(selectedProviderData.id) }}
                                            >
                                                {selectedProviderData.icon || selectedProviderData.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-semibold text-[hsl(var(--foreground))]">
                                                    {selectedProviderData.name}
                                                </h3>
                                                <p className="text-[hsl(var(--muted-foreground))]">
                                                    {selectedProviderData.type === 'cloud' ? 'Cloud Provider' : 'Local Provider'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {getProviderStatus(selectedProviderData.id) === 'connected' ? (
                                                <span className="flex items-center gap-1 px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-sm">
                                                    <CheckCircle2 size={14} />
                                                    Connected
                                                </span>
                                            ) : getProviderStatus(selectedProviderData.id) === 'error' ? (
                                                <span className="flex items-center gap-1 px-3 py-1 bg-red-500/10 text-red-500 rounded-full text-sm">
                                                    <XCircle size={14} />
                                                    Error
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 px-3 py-1 bg-gray-500/10 text-gray-500 rounded-full text-sm">
                                                    <XCircle size={14} />
                                                    Not Connected
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Configuration */}
                                <div className="p-6 space-y-6">
                                    {/* Endpoint/API Key */}
                                    {selectedProviderData.type === 'local' ? (
                                        <div>
                                            <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                                Server Endpoint
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="http://localhost:11434"
                                                    defaultValue={selectedProviderData.endpoint || ''}
                                                    className="flex-1 px-4 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] font-mono"
                                                />
                                                <button
                                                    onClick={() => testConnection(selectedProviderData.id)}
                                                    disabled={testingConnection === selectedProviderData.id}
                                                    className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
                                                >
                                                    {testingConnection === selectedProviderData.id ? (
                                                        <Loader2 size={18} className="animate-spin" />
                                                    ) : (
                                                        <RefreshCw size={18} />
                                                    )}
                                                    Test
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                                API Key
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <div className="relative flex-1">
                                                    <input
                                                        type={showKey[selectedProviderData.id] ? 'text' : 'password'}
                                                        placeholder={`Enter your ${selectedProviderData.name} API key`}
                                                        defaultValue={selectedProviderData.apiKey ? '••••••••••••••••••••••••' : ''}
                                                        className="w-full px-4 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] font-mono"
                                                    />
                                                    <button
                                                        onClick={() => toggleShowKey(selectedProviderData.id)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                                                    >
                                                        {showKey[selectedProviderData.id] ? <EyeOff size={18} /> : <Eye size={18} />}
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={() => testConnection(selectedProviderData.id)}
                                                    disabled={testingConnection === selectedProviderData.id}
                                                    className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
                                                >
                                                    {testingConnection === selectedProviderData.id ? (
                                                        <Loader2 size={18} className="animate-spin" />
                                                    ) : (
                                                        <RefreshCw size={18} />
                                                    )}
                                                    Test
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Available Models */}
                                    {selectedProviderData.models.length > 0 && (
                                        <div>
                                            <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                                Available Models
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedProviderData.models.map(model => (
                                                    <span key={model} className="px-3 py-1 bg-[hsl(var(--muted))] rounded-lg text-sm text-[hsl(var(--foreground))]">
                                                        {model}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Documentation Link */}
                                    <div className="pt-4 border-t">
                                        <a
                                            href={getProviderDocs(selectedProviderData.id)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-[hsl(var(--primary))] hover:underline"
                                        >
                                            <ExternalLink size={16} />
                                            View {selectedProviderData.name} Documentation
                                        </a>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center justify-between pt-4">
                                        <button className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                                            <Trash2 size={18} />
                                            Remove Configuration
                                        </button>
                                        <button className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90 transition-colors">
                                            Save Changes
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-[hsl(var(--card))] rounded-xl border p-8 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
                                <Key size={48} className="text-[hsl(var(--muted-foreground))] mb-4" />
                                <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">Select a Provider</h3>
                                <p className="text-[hsl(var(--muted-foreground))] mt-1">
                                    Choose a provider from the list to configure authentication
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
