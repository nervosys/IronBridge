import { useState } from 'react';
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
    Copy,
    Check,
    DollarSign,
    Coins,
    TrendingUp,
    AlertTriangle,
    BarChart3,
    LogIn,
    LogOut,
    User,
    Clock,
    Lock,
    Link2,
    Unlink,
    Settings,
    Bell,
    Globe,
    Fingerprint,
    ShieldCheck,
    KeyRound,
    UserCircle,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';

// OAuth provider configurations
const oauthProviders = [
    {
        id: 'github',
        name: 'GitHub',
        description: 'Access Copilot and GitHub Models',
        scopes: ['read:user', 'copilot', 'models'],
        color: '#24292e',
        icon: '🐙',
        connected: true,
        profile: {
            name: 'Adam Mitchell',
            email: 'adam@nervosys.ai',
            avatar: null,
            username: 'adammitchell',
        },
        connectedAt: '2024-11-15T10:30:00',
        expiresAt: null,
        permissions: ['Copilot Access', 'GitHub Models', 'Repositories'],
    },
    {
        id: 'google',
        name: 'Google Cloud',
        description: 'Vertex AI and Gemini models',
        scopes: ['cloud-platform', 'generative-language'],
        color: '#4285f4',
        icon: '🔷',
        connected: true,
        profile: {
            name: 'Adam Mitchell',
            email: 'adam@nervosys.ai',
            avatar: null,
            username: null,
        },
        connectedAt: '2024-12-01T14:00:00',
        expiresAt: '2025-01-01T14:00:00',
        permissions: ['Vertex AI', 'Gemini API', 'Cloud Storage'],
    },
    {
        id: 'microsoft',
        name: 'Microsoft',
        description: 'Azure OpenAI and Copilot',
        scopes: ['openai', 'cognitive-services'],
        color: '#0078d4',
        icon: '🪟',
        connected: false,
        profile: null,
        connectedAt: null,
        expiresAt: null,
        permissions: [],
    },
    {
        id: 'huggingface',
        name: 'Hugging Face',
        description: 'Model hub and inference API',
        scopes: ['read', 'write', 'inference'],
        color: '#ffcc00',
        icon: '🤗',
        connected: true,
        profile: {
            name: 'nervosys',
            email: 'adam@nervosys.ai',
            avatar: null,
            username: 'nervosys',
        },
        connectedAt: '2024-10-20T09:15:00',
        expiresAt: null,
        permissions: ['Model Access', 'Inference API', 'Spaces'],
    },
    {
        id: 'aws',
        name: 'Amazon Web Services',
        description: 'Bedrock and SageMaker',
        scopes: ['bedrock', 'sagemaker'],
        color: '#ff9900',
        icon: '☁️',
        connected: false,
        profile: null,
        connectedAt: null,
        expiresAt: null,
        permissions: [],
    },
];

// Active sessions data
const activeSessions = [
    { id: 'sess-001', provider: 'GitHub', device: 'Chrome on Windows', location: 'San Francisco, CA', lastActive: '2 minutes ago', current: true },
    { id: 'sess-002', provider: 'GitHub', device: 'VS Code', location: 'San Francisco, CA', lastActive: '5 minutes ago', current: false },
    { id: 'sess-003', provider: 'Google Cloud', device: 'Chrome on Windows', location: 'San Francisco, CA', lastActive: '1 hour ago', current: false },
    { id: 'sess-004', provider: 'Hugging Face', device: 'Python SDK', location: 'San Francisco, CA', lastActive: '3 hours ago', current: false },
];

// Provider configurations with their auth requirements
const providerConfigs = {
    cloud: [
        {
            id: 'openai',
            name: 'OpenAI',
            description: 'GPT-4, GPT-3.5, and DALL-E models',
            authType: 'api_key',
            keyName: 'OPENAI_API_KEY',
            docsUrl: 'https://platform.openai.com/api-keys',
            color: '#10a37f',
            connected: true,
            lastVerified: '2024-12-11T14:00:00',
            usage: {
                tokensUsed: 2_450_000,
                tokensLimit: 10_000_000,
                costUsed: 48.75,
                budgetLimit: 100,
                requestsToday: 342,
                avgLatency: 1.2,
            },
        },
        {
            id: 'anthropic',
            name: 'Anthropic',
            description: 'Claude models and API',
            authType: 'api_key',
            keyName: 'ANTHROPIC_API_KEY',
            docsUrl: 'https://console.anthropic.com/account/keys',
            color: '#d4a27c',
            connected: true,
            lastVerified: '2024-12-11T14:00:00',
            usage: {
                tokensUsed: 1_850_000,
                tokensLimit: 5_000_000,
                costUsed: 37.25,
                budgetLimit: 75,
                requestsToday: 187,
                avgLatency: 1.8,
            },
        },
        {
            id: 'google',
            name: 'Google AI',
            description: 'Gemini models and Vertex AI',
            authType: 'api_key',
            keyName: 'GOOGLE_API_KEY',
            docsUrl: 'https://makersuite.google.com/app/apikey',
            color: '#4285f4',
            connected: false,
            lastVerified: null,
            usage: null,
        },
        {
            id: 'azure',
            name: 'Azure OpenAI',
            description: 'Azure-hosted OpenAI models',
            authType: 'azure',
            keyName: 'AZURE_OPENAI_API_KEY',
            docsUrl: 'https://portal.azure.com',
            color: '#0078d4',
            connected: false,
            lastVerified: null,
            extraFields: ['endpoint', 'deployment'],
            usage: null,
        },
        {
            id: 'aws',
            name: 'AWS Bedrock',
            description: 'Amazon Bedrock AI services',
            authType: 'aws',
            docsUrl: 'https://aws.amazon.com/bedrock',
            color: '#ff9900',
            connected: false,
            lastVerified: null,
            extraFields: ['accessKey', 'secretKey', 'region'],
            usage: null,
        },
        {
            id: 'deepseek',
            name: 'DeepSeek',
            description: 'DeepSeek AI models',
            authType: 'api_key',
            keyName: 'DEEPSEEK_API_KEY',
            docsUrl: 'https://platform.deepseek.com',
            color: '#4f46e5',
            connected: true,
            lastVerified: '2024-12-11T12:00:00',
            usage: {
                tokensUsed: 520_000,
                tokensLimit: 2_000_000,
                costUsed: 5.20,
                budgetLimit: 25,
                requestsToday: 89,
                avgLatency: 0.9,
            },
        },
        {
            id: 'perplexity',
            name: 'Perplexity',
            description: 'Perplexity AI search and chat',
            authType: 'api_key',
            keyName: 'PERPLEXITY_API_KEY',
            docsUrl: 'https://perplexity.ai',
            color: '#20b2aa',
            connected: false,
            lastVerified: null,
            usage: null,
        },
        {
            id: 'qwen',
            name: 'Qwen (Alibaba)',
            description: 'Alibaba Cloud Qwen models',
            authType: 'api_key',
            keyName: 'QWEN_API_KEY',
            docsUrl: 'https://dashscope.aliyun.com',
            color: '#ff6a00',
            connected: false,
            lastVerified: null,
            usage: null,
        },
        {
            id: 'mistral',
            name: 'Mistral AI',
            description: 'Mistral and Mixtral models',
            authType: 'api_key',
            keyName: 'MISTRAL_API_KEY',
            docsUrl: 'https://console.mistral.ai',
            color: '#ff7000',
            connected: true,
            lastVerified: '2024-12-11T10:00:00',
            usage: {
                tokensUsed: 980_000,
                tokensLimit: 3_000_000,
                costUsed: 12.40,
                budgetLimit: 50,
                requestsToday: 156,
                avgLatency: 1.1,
            },
        },
        {
            id: 'cohere',
            name: 'Cohere',
            description: 'Command and Embed models',
            authType: 'api_key',
            keyName: 'COHERE_API_KEY',
            docsUrl: 'https://dashboard.cohere.ai/api-keys',
            color: '#39594d',
            connected: false,
            lastVerified: null,
            usage: null,
        },
    ],
    local: [
        {
            id: 'ollama',
            name: 'Ollama',
            description: 'Run models locally with Ollama',
            authType: 'endpoint',
            defaultEndpoint: 'http://localhost:11434',
            docsUrl: 'https://ollama.ai',
            color: '#ffffff',
            connected: true,
            lastVerified: '2024-12-11T14:30:00',
            usage: {
                tokensUsed: 4_200_000,
                tokensLimit: null,
                costUsed: 0,
                budgetLimit: null,
                requestsToday: 523,
                avgLatency: 0.4,
            },
        },
        {
            id: 'lmstudio',
            name: 'LM Studio',
            description: 'Local model inference server',
            authType: 'endpoint',
            defaultEndpoint: 'http://localhost:1234',
            docsUrl: 'https://lmstudio.ai',
            color: '#6366f1',
            connected: true,
            lastVerified: '2024-12-11T14:30:00',
            usage: {
                tokensUsed: 1_850_000,
                tokensLimit: null,
                costUsed: 0,
                budgetLimit: null,
                requestsToday: 234,
                avgLatency: 0.6,
            },
        },
        {
            id: 'jan',
            name: 'Jan',
            description: 'Open-source ChatGPT alternative',
            authType: 'endpoint',
            defaultEndpoint: 'http://localhost:1337',
            docsUrl: 'https://jan.ai',
            color: '#2dd4bf',
            connected: false,
            lastVerified: null,
            usage: null,
        },
        {
            id: 'gpt4all',
            name: 'GPT4All',
            description: 'Run models locally on any hardware',
            authType: 'endpoint',
            defaultEndpoint: 'http://localhost:4891',
            docsUrl: 'https://gpt4all.io',
            color: '#22c55e',
            connected: false,
            lastVerified: null,
            usage: null,
        },
        {
            id: 'llamafile',
            name: 'llamafile',
            description: 'Single-file LLM distribution',
            authType: 'endpoint',
            defaultEndpoint: 'http://localhost:8080',
            docsUrl: 'https://github.com/Mozilla-Ocho/llamafile',
            color: '#f59e0b',
            connected: false,
            lastVerified: null,
            usage: null,
        },
        {
            id: 'vllm',
            name: 'vLLM',
            description: 'High-throughput LLM serving',
            authType: 'endpoint',
            defaultEndpoint: 'http://localhost:8000',
            docsUrl: 'https://vllm.ai',
            color: '#8b5cf6',
            connected: false,
            lastVerified: null,
            usage: null,
        },
        {
            id: 'llamacpp',
            name: 'llama.cpp',
            description: 'C/C++ LLM inference',
            authType: 'endpoint',
            defaultEndpoint: 'http://localhost:8080',
            docsUrl: 'https://github.com/ggerganov/llama.cpp',
            color: '#06b6d4',
            connected: false,
            lastVerified: null,
            usage: null,
        },
        {
            id: 'localai',
            name: 'LocalAI',
            description: 'OpenAI-compatible local server',
            authType: 'endpoint',
            defaultEndpoint: 'http://localhost:8080',
            docsUrl: 'https://localai.io',
            color: '#ec4899',
            connected: false,
            lastVerified: null,
            usage: null,
        },
    ],
};

// Usage history data for charts
const usageHistory = [
    { date: 'Mon', openai: 380000, anthropic: 290000, mistral: 145000, deepseek: 78000 },
    { date: 'Tue', openai: 420000, anthropic: 310000, mistral: 162000, deepseek: 85000 },
    { date: 'Wed', openai: 350000, anthropic: 275000, mistral: 138000, deepseek: 72000 },
    { date: 'Thu', openai: 480000, anthropic: 340000, mistral: 178000, deepseek: 92000 },
    { date: 'Fri', openai: 410000, anthropic: 295000, mistral: 155000, deepseek: 81000 },
    { date: 'Sat', openai: 220000, anthropic: 180000, mistral: 98000, deepseek: 55000 },
    { date: 'Sun', openai: 190000, anthropic: 160000, mistral: 104000, deepseek: 57000 },
];

const costHistory = [
    { date: 'Week 1', cost: 45.20 },
    { date: 'Week 2', cost: 52.80 },
    { date: 'Week 3', cost: 38.60 },
    { date: 'Week 4', cost: 67.40 },
];

export default function Accounts() {
    const [providers] = useState(providerConfigs);
    const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
    const [showKey, setShowKey] = useState<Record<string, boolean>>({});
    const [testingConnection, setTestingConnection] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'oauth' | 'cloud' | 'local' | 'sessions' | 'usage'>('oauth');
    const [selectedOAuth, setSelectedOAuth] = useState<string | null>(null);
    const [connecting, setConnecting] = useState<string | null>(null);

    const handleOAuthConnect = (id: string) => {
        setConnecting(id);
        // Simulate OAuth flow - in production, this would redirect to provider
        setTimeout(() => setConnecting(null), 2000);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const connectedOAuth = oauthProviders.filter(p => p.connected).length;

    const toggleShowKey = (id: string) => {
        setShowKey(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const testConnection = async (id: string) => {
        setTestingConnection(id);
        // Simulate API test
        await new Promise(resolve => setTimeout(resolve, 1500));
        setTestingConnection(null);
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const formatTokens = (tokens: number) => {
        if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
        if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
        return tokens.toString();
    };

    const connectedCloud = providers.cloud.filter(p => p.connected).length;
    const connectedLocal = providers.local.filter(p => p.connected).length;
    // Total connected providers for display
    const _totalConnected = connectedCloud + connectedLocal;

    // Calculate totals for connected cloud providers
    const totalBudget = providers.cloud.filter(p => p.connected && p.usage?.budgetLimit).reduce((sum, p) => sum + (p.usage?.budgetLimit || 0), 0);
    const totalSpent = providers.cloud.filter(p => p.connected && p.usage).reduce((sum, p) => sum + (p.usage?.costUsed || 0), 0);
    const totalTokensUsed = providers.cloud.filter(p => p.connected && p.usage).reduce((sum, p) => sum + (p.usage?.tokensUsed || 0), 0);
    const totalTokensLimit = providers.cloud.filter(p => p.connected && p.usage?.tokensLimit).reduce((sum, p) => sum + (p.usage?.tokensLimit || 0), 0);

    const currentProviders = activeTab === 'cloud' ? providers.cloud : activeTab === 'local' ? providers.local : [];
    const selectedProviderData = [...providers.cloud, ...providers.local].find(p => p.id === selectedProvider);

    // Pie chart data for budget distribution
    const budgetPieData = providers.cloud.filter(p => p.connected && p.usage).map(p => ({
        name: p.name,
        value: p.usage?.costUsed || 0,
        color: p.color,
    }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">Accounts</h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-1">
                        Manage authentication, API keys, sessions, and usage
                    </p>
                </div>
            </div>

            {/* Stats Cards - First Row: Connection Stats */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Link2 size={18} />
                        <span className="text-sm">OAuth Accounts</span>
                    </div>
                    <p className="text-2xl font-bold text-green-500">{connectedOAuth}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        of {oauthProviders.length} connected
                    </p>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Shield size={18} />
                        <span className="text-sm">API Keys</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{connectedCloud}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        of {providers.cloud.length} configured
                    </p>
                </div>

                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <Coins size={18} />
                        <span className="text-sm">Tokens Remaining</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{formatTokens(totalTokensLimit - totalTokensUsed)}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        of {formatTokens(totalTokensLimit)} limit
                    </p>
                    <div className="mt-2 h-1.5 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${Math.min((totalTokensUsed / totalTokensLimit) * 100, 100)}%` }}
                        />
                    </div>
                </div>

                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <DollarSign size={18} />
                        <span className="text-sm">Budget Used</span>
                    </div>
                    <p className="text-2xl font-bold text-[hsl(var(--foreground))]">${totalSpent.toFixed(2)}</p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        of ${totalBudget.toFixed(2)} monthly
                    </p>
                    <div className="mt-2 h-1.5 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${(totalSpent / totalBudget) > 0.8 ? 'bg-orange-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min((totalSpent / totalBudget) * 100, 100)}%` }}
                        />
                    </div>
                </div>

                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))] mb-2">
                        <TrendingUp size={18} />
                        <span className="text-sm">Budget Remaining</span>
                    </div>
                    <p className={`text-2xl font-bold ${(totalBudget - totalSpent) < 50 ? 'text-orange-500' : 'text-green-500'}`}>
                        ${(totalBudget - totalSpent).toFixed(2)}
                    </p>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        {Math.round(((totalBudget - totalSpent) / totalBudget) * 100)}% remaining
                    </p>
                </div>
            </div>

            {/* Provider Token/Budget Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {providers.cloud.filter(p => p.connected && p.usage).map(provider => (
                    <div key={provider.id} className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                        <div className="flex items-center gap-2 mb-3">
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                                style={{ backgroundColor: provider.color }}
                            >
                                {provider.name.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="font-medium text-[hsl(var(--foreground))]">{provider.name}</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-[hsl(var(--muted-foreground))]">Tokens</span>
                                <span className="text-[hsl(var(--foreground))] font-medium">
                                    {formatTokens(provider.usage!.tokensUsed)} / {formatTokens(provider.usage!.tokensLimit!)}
                                </span>
                            </div>
                            <div className="h-1.5 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-[hsl(var(--primary))] rounded-full"
                                    style={{
                                        width: `${(provider.usage!.tokensUsed / provider.usage!.tokensLimit!) * 100}%`,
                                        backgroundColor: provider.color
                                    }}
                                />
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-[hsl(var(--muted-foreground))]">Budget</span>
                                <span className={`font-medium ${(provider.usage!.costUsed / provider.usage!.budgetLimit!) > 0.8 ? 'text-orange-500' : 'text-[hsl(var(--foreground))]'}`}>
                                    ${provider.usage!.costUsed.toFixed(2)} / ${provider.usage!.budgetLimit!.toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))]">
                                <span>{provider.usage!.requestsToday} requests today</span>
                                <span>{provider.usage!.avgLatency}s avg</span>
                            </div>
                        </div>
                    </div>
                ))}
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
                    Connected Accounts
                </button>
                <button
                    onClick={() => setActiveTab('cloud')}
                    className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'cloud'
                        ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                        : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                        }`}
                >
                    <Key size={18} />
                    API Keys ({providers.cloud.length})
                </button>
                <button
                    onClick={() => setActiveTab('local')}
                    className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'local'
                        ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                        : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                        }`}
                >
                    <Server size={18} />
                    Local Providers ({providers.local.length})
                </button>
                <button
                    onClick={() => setActiveTab('sessions')}
                    className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'sessions'
                        ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                        : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                        }`}
                >
                    <Shield size={18} />
                    Sessions ({activeSessions.length})
                </button>
                <button
                    onClick={() => setActiveTab('usage')}
                    className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'usage'
                        ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                        : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                        }`}
                >
                    <BarChart3 size={18} />
                    Usage & Billing
                </button>
            </div>

            {/* OAuth Connected Accounts Tab */}
            {activeTab === 'oauth' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Provider List */}
                    <div className="lg:col-span-1 space-y-3">
                        <h3 className="text-sm font-medium text-[hsl(var(--muted-foreground))] mb-2">Identity Providers</h3>
                        {oauthProviders.map(provider => (
                            <div
                                key={provider.id}
                                onClick={() => setSelectedOAuth(provider.id)}
                                className={`bg-[hsl(var(--card))] rounded-xl p-4 border cursor-pointer transition-all hover:border-[hsl(var(--primary))] ${selectedOAuth === provider.id ? 'border-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary))]' : ''
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                                            style={{ backgroundColor: `${provider.color}20` }}
                                        >
                                            {provider.icon}
                                        </div>
                                        <div>
                                            <span className="font-medium text-[hsl(var(--foreground))]">{provider.name}</span>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))]">{provider.description}</p>
                                        </div>
                                    </div>
                                    {provider.connected ? (
                                        <CheckCircle2 size={20} className="text-green-500" />
                                    ) : (
                                        <XCircle size={20} className="text-gray-400" />
                                    )}
                                </div>
                                {provider.connected && provider.profile && (
                                    <div className="mt-3 pt-3 border-t flex items-center gap-2">
                                        <UserCircle size={16} className="text-[hsl(var(--muted-foreground))]" />
                                        <span className="text-sm text-[hsl(var(--muted-foreground))]">
                                            {provider.profile.email}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Provider Details */}
                    <div className="lg:col-span-2">
                        {selectedOAuth ? (
                            (() => {
                                const provider = oauthProviders.find(p => p.id === selectedOAuth);
                                if (!provider) return null;
                                return (
                                    <div className="bg-[hsl(var(--card))] rounded-xl border overflow-hidden">
                                        {/* Header */}
                                        <div className="p-6 border-b">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div
                                                        className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl"
                                                        style={{ backgroundColor: `${provider.color}20` }}
                                                    >
                                                        {provider.icon}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xl font-semibold text-[hsl(var(--foreground))]">
                                                            {provider.name}
                                                        </h3>
                                                        <p className="text-[hsl(var(--muted-foreground))]">{provider.description}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-full flex items-center gap-1">
                                                                <Fingerprint size={12} />
                                                                OAuth 2.0
                                                            </span>
                                                            {provider.connected && (
                                                                <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-500 rounded-full flex items-center gap-1">
                                                                    <ShieldCheck size={12} />
                                                                    Verified
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="p-6 space-y-6">
                                            {provider.connected ? (
                                                <>
                                                    {/* Connected Profile */}
                                                    <div className="bg-[hsl(var(--muted))]/50 rounded-lg p-4">
                                                        <h4 className="text-sm font-medium text-[hsl(var(--foreground))] mb-3 flex items-center gap-2">
                                                            <User size={16} />
                                                            Connected Account
                                                        </h4>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <span className="text-xs text-[hsl(var(--muted-foreground))]">Name</span>
                                                                <p className="text-sm font-medium text-[hsl(var(--foreground))]">{provider.profile?.name}</p>
                                                            </div>
                                                            <div>
                                                                <span className="text-xs text-[hsl(var(--muted-foreground))]">Email</span>
                                                                <p className="text-sm font-medium text-[hsl(var(--foreground))]">{provider.profile?.email}</p>
                                                            </div>
                                                            {provider.profile?.username && (
                                                                <div>
                                                                    <span className="text-xs text-[hsl(var(--muted-foreground))]">Username</span>
                                                                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">@{provider.profile.username}</p>
                                                                </div>
                                                            )}
                                                            <div>
                                                                <span className="text-xs text-[hsl(var(--muted-foreground))]">Connected</span>
                                                                <p className="text-sm font-medium text-[hsl(var(--foreground))]">{formatDate(provider.connectedAt!)}</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Permissions */}
                                                    <div>
                                                        <h4 className="text-sm font-medium text-[hsl(var(--foreground))] mb-3 flex items-center gap-2">
                                                            <Lock size={16} />
                                                            Granted Permissions
                                                        </h4>
                                                        <div className="flex flex-wrap gap-2">
                                                            {provider.permissions.map((perm, i) => (
                                                                <span key={i} className="px-3 py-1.5 bg-[hsl(var(--muted))] rounded-lg text-sm text-[hsl(var(--foreground))] flex items-center gap-2">
                                                                    <CheckCircle2 size={14} className="text-green-500" />
                                                                    {perm}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>

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
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-sm text-[hsl(var(--muted-foreground))]">Refresh Token</span>
                                                                <span className="flex items-center gap-1 text-green-500 text-sm">
                                                                    <CheckCircle2 size={14} />
                                                                    Available
                                                                </span>
                                                            </div>
                                                            {provider.expiresAt && (
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-sm text-[hsl(var(--muted-foreground))]">Expires</span>
                                                                    <span className="text-sm text-[hsl(var(--foreground))]">{formatDate(provider.expiresAt)}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center justify-between pt-4 border-t">
                                                        <button className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                                                            <Unlink size={18} />
                                                            Disconnect Account
                                                        </button>
                                                        <div className="flex items-center gap-2">
                                                            <button className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded-lg hover:bg-[hsl(var(--muted))]/80 transition-colors">
                                                                <RefreshCw size={18} />
                                                                Refresh Token
                                                            </button>
                                                            <button className="flex items-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90 transition-colors">
                                                                <Settings size={18} />
                                                                Manage Permissions
                                                            </button>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    {/* Not Connected State */}
                                                    <div className="text-center py-8">
                                                        <div className="w-16 h-16 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center mx-auto mb-4">
                                                            <Link2 size={32} className="text-[hsl(var(--muted-foreground))]" />
                                                        </div>
                                                        <h4 className="text-lg font-medium text-[hsl(var(--foreground))] mb-2">Not Connected</h4>
                                                        <p className="text-[hsl(var(--muted-foreground))] mb-6 max-w-md mx-auto">
                                                            Connect your {provider.name} account to access {provider.description.toLowerCase()}.
                                                        </p>

                                                        {/* Scopes */}
                                                        <div className="mb-6">
                                                            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-2">Required permissions:</p>
                                                            <div className="flex flex-wrap justify-center gap-2">
                                                                {provider.scopes.map(scope => (
                                                                    <span key={scope} className="px-3 py-1 bg-[hsl(var(--muted))] rounded-full text-sm text-[hsl(var(--foreground))]">
                                                                        {scope}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <button
                                                            onClick={() => handleOAuthConnect(provider.id)}
                                                            disabled={connecting === provider.id}
                                                            className="flex items-center gap-2 px-6 py-3 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg hover:opacity-90 transition-colors mx-auto disabled:opacity-50"
                                                        >
                                                            {connecting === provider.id ? (
                                                                <Loader2 size={18} className="animate-spin" />
                                                            ) : (
                                                                <LogIn size={18} />
                                                            )}
                                                            Connect with {provider.name}
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()
                        ) : (
                            <div className="bg-[hsl(var(--card))] rounded-xl border p-8 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
                                <Link2 size={48} className="text-[hsl(var(--muted-foreground))] mb-4" />
                                <h3 className="text-lg font-medium text-[hsl(var(--foreground))]">Select a Provider</h3>
                                <p className="text-[hsl(var(--muted-foreground))] mt-1">
                                    Choose an identity provider to manage your connection
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Sessions Tab */}
            {activeTab === 'sessions' && (
                <div className="space-y-6">
                    <div className="bg-[hsl(var(--card))] rounded-xl border overflow-hidden">
                        <div className="p-4 border-b flex items-center justify-between">
                            <h3 className="font-semibold text-[hsl(var(--foreground))]">Active Sessions</h3>
                            <button className="flex items-center gap-2 px-3 py-1.5 text-red-500 hover:bg-red-500/10 rounded-lg text-sm">
                                <LogOut size={16} />
                                Sign Out All Other Sessions
                            </button>
                        </div>
                        <div className="divide-y">
                            {activeSessions.map(session => (
                                <div key={session.id} className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${session.current ? 'bg-green-500/10' : 'bg-[hsl(var(--muted))]'}`}>
                                            <Globe size={20} className={session.current ? 'text-green-500' : 'text-[hsl(var(--muted-foreground))]'} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-[hsl(var(--foreground))]">{session.device}</span>
                                                {session.current && (
                                                    <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-500 rounded-full">Current</span>
                                                )}
                                            </div>
                                            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                                {session.provider} • {session.location}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm text-[hsl(var(--muted-foreground))]">{session.lastActive}</span>
                                        {!session.current && (
                                            <button className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-red-500">
                                                <LogOut size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Security Settings */}
                    <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                        <h3 className="font-semibold text-[hsl(var(--foreground))] mb-4">Security Settings</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-[hsl(var(--muted))]/50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Bell size={20} className="text-[hsl(var(--muted-foreground))]" />
                                    <div>
                                        <p className="font-medium text-[hsl(var(--foreground))]">Login Notifications</p>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Get notified of new sign-ins</p>
                                    </div>
                                </div>
                                <button className="relative w-11 h-6 bg-green-500 rounded-full transition-colors">
                                    <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full transition-transform" />
                                </button>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-[hsl(var(--muted))]/50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Clock size={20} className="text-[hsl(var(--muted-foreground))]" />
                                    <div>
                                        <p className="font-medium text-[hsl(var(--foreground))]">Session Timeout</p>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">Auto-logout after inactivity</p>
                                    </div>
                                </div>
                                <select className="px-3 py-1.5 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))]">
                                    <option>30 minutes</option>
                                    <option>1 hour</option>
                                    <option>4 hours</option>
                                    <option>Never</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            {activeTab === 'usage' ? (
                <div className="space-y-6">
                    {/* Usage Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Token Usage Over Time */}
                        <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                            <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">Token Usage (Last 7 Days)</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <AreaChart data={usageHistory}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'hsl(var(--card))',
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: '8px',
                                        }}
                                        formatter={(value: number) => [formatTokens(value), '']}
                                    />
                                    <Legend />
                                    <Area type="monotone" dataKey="openai" stackId="1" stroke="#10a37f" fill="#10a37f" fillOpacity={0.6} name="OpenAI" />
                                    <Area type="monotone" dataKey="anthropic" stackId="1" stroke="#d4a27c" fill="#d4a27c" fillOpacity={0.6} name="Anthropic" />
                                    <Area type="monotone" dataKey="mistral" stackId="1" stroke="#ff7000" fill="#ff7000" fillOpacity={0.6} name="Mistral" />
                                    <Area type="monotone" dataKey="deepseek" stackId="1" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.6} name="DeepSeek" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Cost Distribution */}
                        <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                            <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">Cost Distribution</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={budgetPieData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={100}
                                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                        labelLine={false}
                                    >
                                        {budgetPieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'hsl(var(--card))',
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: '8px',
                                        }}
                                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost']}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Weekly Cost Trend */}
                        <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                            <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">Monthly Cost Trend</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={costHistory}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `$${v}`} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'hsl(var(--card))',
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: '8px',
                                        }}
                                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost']}
                                    />
                                    <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Budget Alerts */}
                        <div className="bg-[hsl(var(--card))] rounded-xl border p-6">
                            <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] mb-4">Budget Alerts</h3>
                            <div className="space-y-3">
                                {providers.cloud.filter(p => p.connected && p.usage && (p.usage.costUsed / p.usage.budgetLimit!) > 0.5).map(provider => {
                                    const percentage = (provider.usage!.costUsed / provider.usage!.budgetLimit!) * 100;
                                    const isWarning = percentage > 80;
                                    return (
                                        <div key={provider.id} className={`p-4 rounded-lg ${isWarning ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'}`}>
                                            <div className="flex items-center gap-3">
                                                <AlertTriangle size={20} className={isWarning ? 'text-orange-500' : 'text-yellow-500'} />
                                                <div className="flex-1">
                                                    <p className="font-medium text-[hsl(var(--foreground))]">{provider.name}</p>
                                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                                        {percentage.toFixed(0)}% of budget used (${provider.usage!.costUsed.toFixed(2)} / ${provider.usage!.budgetLimit!.toFixed(2)})
                                                    </p>
                                                </div>
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${isWarning ? 'bg-orange-500/20 text-orange-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
                                                    {isWarning ? 'High' : 'Medium'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {providers.cloud.filter(p => p.connected && p.usage && (p.usage.costUsed / p.usage.budgetLimit!) <= 0.5).length > 0 && (
                                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                                        <div className="flex items-center gap-3">
                                            <CheckCircle2 size={20} className="text-green-500" />
                                            <div>
                                                <p className="font-medium text-[hsl(var(--foreground))]">All Other Providers</p>
                                                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                                                    Budget usage under 50% - looking good!
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Provider List */}
                    <div className="lg:col-span-1 space-y-3">
                        {currentProviders.map(provider => (
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
                                            style={{ backgroundColor: provider.color }}
                                        >
                                            {provider.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <span className="font-medium text-[hsl(var(--foreground))]">{provider.name}</span>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))]">{provider.description}</p>
                                        </div>
                                    </div>
                                    {provider.connected ? (
                                        <CheckCircle2 size={20} className="text-green-500" />
                                    ) : (
                                        <XCircle size={20} className="text-gray-400" />
                                    )}
                                </div>
                            </div>
                        ))}
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
                                                style={{ backgroundColor: selectedProviderData.color }}
                                            >
                                                {selectedProviderData.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-semibold text-[hsl(var(--foreground))]">
                                                    {selectedProviderData.name}
                                                </h3>
                                                <p className="text-[hsl(var(--muted-foreground))]">{selectedProviderData.description}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {selectedProviderData.connected ? (
                                                <span className="flex items-center gap-1 px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-sm">
                                                    <CheckCircle2 size={14} />
                                                    Connected
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
                                    {selectedProviderData.authType === 'api_key' && (
                                        <div>
                                            <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                                API Key
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <div className="relative flex-1">
                                                    <input
                                                        type={showKey[selectedProviderData.id] ? 'text' : 'password'}
                                                        placeholder={`Enter your ${selectedProviderData.name} API key`}
                                                        defaultValue={selectedProviderData.connected ? 'sk-••••••••••••••••••••••••••••' : ''}
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
                                            {'keyName' in selectedProviderData && (
                                                <div className="mt-2 flex items-center gap-2">
                                                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                                        Environment variable:
                                                    </span>
                                                    <code className="text-xs bg-[hsl(var(--muted))] px-2 py-1 rounded font-mono">
                                                        {selectedProviderData.keyName}
                                                    </code>
                                                    <button
                                                        onClick={() => copyToClipboard(selectedProviderData.keyName!, selectedProviderData.id)}
                                                        className="p-1 rounded hover:bg-[hsl(var(--muted))]"
                                                    >
                                                        {copied === selectedProviderData.id ? (
                                                            <Check size={14} className="text-green-500" />
                                                        ) : (
                                                            <Copy size={14} className="text-[hsl(var(--muted-foreground))]" />
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {selectedProviderData.authType === 'endpoint' && (
                                        <div>
                                            <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                                Server Endpoint
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="http://localhost:11434"
                                                    defaultValue={'defaultEndpoint' in selectedProviderData ? selectedProviderData.defaultEndpoint : ''}
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
                                    )}

                                    {selectedProviderData.authType === 'azure' && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                                    API Key
                                                </label>
                                                <input
                                                    type={showKey[selectedProviderData.id] ? 'text' : 'password'}
                                                    placeholder="Enter your Azure OpenAI API key"
                                                    className="w-full px-4 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                                    Endpoint
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="https://your-resource.openai.azure.com"
                                                    className="w-full px-4 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                                    Deployment Name
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder="gpt-4"
                                                    className="w-full px-4 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                                />
                                            </div>
                                        </>
                                    )}

                                    {selectedProviderData.authType === 'aws' && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                                    Access Key ID
                                                </label>
                                                <input
                                                    type={showKey[selectedProviderData.id] ? 'text' : 'password'}
                                                    placeholder="AKIAIOSFODNN7EXAMPLE"
                                                    className="w-full px-4 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                                    Secret Access Key
                                                </label>
                                                <input
                                                    type="password"
                                                    placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                                                    className="w-full px-4 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                                    Region
                                                </label>
                                                <select className="w-full px-4 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]">
                                                    <option value="us-east-1">US East (N. Virginia)</option>
                                                    <option value="us-west-2">US West (Oregon)</option>
                                                    <option value="eu-west-1">EU (Ireland)</option>
                                                    <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
                                                </select>
                                            </div>
                                        </>
                                    )}

                                    {/* Documentation Link */}
                                    <div className="pt-4 border-t">
                                        <a
                                            href={selectedProviderData.docsUrl}
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
