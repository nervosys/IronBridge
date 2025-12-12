import { useState } from 'react';
import {
    Cloud,
    HardDrive,
    CheckCircle,
    XCircle,
    RefreshCw,
    Settings,
    ExternalLink,
} from 'lucide-react';

interface Provider {
    id: string;
    name: string;
    type: 'local' | 'cloud';
    status: 'online' | 'offline' | 'unknown';
    endpoint: string;
    sessions: number;
    icon: string;
    description: string;
}

const providersData: Provider[] = [
    {
        id: '1',
        name: 'GitHub Copilot',
        type: 'local',
        status: 'online',
        endpoint: 'VS Code Built-in',
        sessions: 156,
        icon: '🤖',
        description: 'AI pair programmer integrated with VS Code',
    },
    {
        id: '2',
        name: 'Cursor',
        type: 'local',
        status: 'online',
        endpoint: 'File-based',
        sessions: 34,
        icon: '⚡',
        description: 'AI-first code editor with chat integration',
    },
    {
        id: '3',
        name: 'Ollama',
        type: 'local',
        status: 'online',
        endpoint: 'http://localhost:11434',
        sessions: 45,
        icon: '🦙',
        description: 'Run LLMs locally with easy model management',
    },
    {
        id: '4',
        name: 'LM Studio',
        type: 'local',
        status: 'offline',
        endpoint: 'http://localhost:1234/v1',
        sessions: 12,
        icon: '🎛️',
        description: 'Desktop app for running local LLMs',
    },
    {
        id: '5',
        name: 'ChatGPT',
        type: 'cloud',
        status: 'online',
        endpoint: 'https://chat.openai.com',
        sessions: 89,
        icon: '💬',
        description: 'OpenAI\'s conversational AI assistant',
    },
    {
        id: '6',
        name: 'Claude',
        type: 'cloud',
        status: 'online',
        endpoint: 'https://claude.ai',
        sessions: 67,
        icon: '🧠',
        description: 'Anthropic\'s helpful AI assistant',
    },
    {
        id: '7',
        name: 'Gemini',
        type: 'cloud',
        status: 'online',
        endpoint: 'https://gemini.google.com',
        sessions: 23,
        icon: '✨',
        description: 'Google\'s multimodal AI model',
    },
    {
        id: '8',
        name: 'Perplexity',
        type: 'cloud',
        status: 'online',
        endpoint: 'https://www.perplexity.ai',
        sessions: 15,
        icon: '🔍',
        description: 'AI-powered search and answer engine',
    },
    {
        id: '9',
        name: 'Jan.ai',
        type: 'local',
        status: 'offline',
        endpoint: 'http://localhost:1337/v1',
        sessions: 8,
        icon: '🎯',
        description: 'Open-source ChatGPT alternative',
    },
    {
        id: '10',
        name: 'GPT4All',
        type: 'local',
        status: 'offline',
        endpoint: 'http://localhost:4891/v1',
        sessions: 5,
        icon: '🌐',
        description: 'Free-to-use locally running LLMs',
    },
];

function ProviderCard({ provider }: { provider: Provider }) {
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 1000);
    };

    return (
        <div className="bg-[hsl(var(--card))] rounded-xl p-5 border hover:border-[hsl(var(--primary)/0.5)] transition-colors">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[hsl(var(--muted))] rounded-xl flex items-center justify-center text-2xl">
                        {provider.icon}
                    </div>
                    <div>
                        <h3 className="font-semibold">{provider.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            {provider.type === 'local' ? (
                                <span className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                                    <HardDrive size={12} />
                                    Local
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                                    <Cloud size={12} />
                                    Cloud
                                </span>
                            )}
                            <span
                                className={`flex items-center gap-1 text-xs ${provider.status === 'online'
                                        ? 'text-green-500'
                                        : provider.status === 'offline'
                                            ? 'text-red-500'
                                            : 'text-yellow-500'
                                    }`}
                            >
                                {provider.status === 'online' ? (
                                    <CheckCircle size={12} />
                                ) : (
                                    <XCircle size={12} />
                                )}
                                {provider.status}
                            </span>
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleRefresh}
                    className={`p-2 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors ${isRefreshing ? 'animate-spin' : ''
                        }`}
                >
                    <RefreshCw size={16} className="text-[hsl(var(--muted-foreground))]" />
                </button>
            </div>

            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
                {provider.description}
            </p>

            <div className="text-xs text-[hsl(var(--muted-foreground))] mb-4 font-mono bg-[hsl(var(--muted))] px-2 py-1 rounded truncate">
                {provider.endpoint}
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
                <span className="text-sm text-[hsl(var(--muted-foreground))]">
                    {provider.sessions} sessions
                </span>
                <div className="flex gap-2">
                    <button className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors">
                        <Settings size={16} className="text-[hsl(var(--muted-foreground))]" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors">
                        <ExternalLink size={16} className="text-[hsl(var(--muted-foreground))]" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Providers() {
    const [filter, setFilter] = useState<'all' | 'local' | 'cloud'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');

    const filteredProviders = providersData.filter((provider) => {
        const matchesType = filter === 'all' || provider.type === filter;
        const matchesStatus = statusFilter === 'all' || provider.status === statusFilter;
        return matchesType && matchesStatus;
    });

    const onlineCount = providersData.filter((p) => p.status === 'online').length;
    const localCount = providersData.filter((p) => p.type === 'local').length;
    const cloudCount = providersData.filter((p) => p.type === 'cloud').length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold">Providers</h1>
                <p className="text-[hsl(var(--muted-foreground))] mt-1">
                    Manage your LLM providers and connections
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                            <CheckCircle className="text-green-500" size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{onlineCount}</p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">Online</p>
                        </div>
                    </div>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                            <HardDrive className="text-blue-500" size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{localCount}</p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">Local</p>
                        </div>
                    </div>
                </div>
                <div className="bg-[hsl(var(--card))] rounded-xl p-4 border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                            <Cloud className="text-purple-500" size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{cloudCount}</p>
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">Cloud</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                <div className="flex rounded-lg border overflow-hidden">
                    {(['all', 'local', 'cloud'] as const).map((type) => (
                        <button
                            key={type}
                            onClick={() => setFilter(type)}
                            className={`px-4 py-2 text-sm capitalize transition-colors ${filter === type
                                    ? 'bg-[hsl(var(--primary))] text-white'
                                    : 'bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))]'
                                }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
                <div className="flex rounded-lg border overflow-hidden">
                    {(['all', 'online', 'offline'] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-4 py-2 text-sm capitalize transition-colors ${statusFilter === status
                                    ? 'bg-[hsl(var(--primary))] text-white'
                                    : 'bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))]'
                                }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {/* Providers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredProviders.map((provider) => (
                    <ProviderCard key={provider.id} provider={provider} />
                ))}
            </div>

            {/* Summary */}
            <div className="text-sm text-[hsl(var(--muted-foreground))]">
                Showing {filteredProviders.length} of {providersData.length} providers
            </div>
        </div>
    );
}
