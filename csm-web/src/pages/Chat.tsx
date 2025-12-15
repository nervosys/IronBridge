import { useState, useRef, useEffect, useCallback } from 'react';
import {
    Send,
    Bot,
    User,
    Settings,
    Paperclip,
    Mic,
    StopCircle,
    Copy,
    Check,
    RefreshCw,
    Trash2,
    ChevronDown,
    Filter,
    GitBranch,
    GitCommit as GitCommitIcon,
    Code,
    FileText,
    Palette,
    Cpu,
    Download,
    Upload,
    Keyboard,
    Bell,
    Eye,
    Type,
    MessageSquare,
    X,
    Bookmark,
    History,
    Plus,
    ChevronRight,
    Clock,
    MoreVertical,
    AlertCircle,
    Loader2,
} from 'lucide-react';
import hljs from 'highlight.js';
import '../styles/syntax-themes.css';
import { useApi } from '../context/ApiContext';
import {
    useSessions,
    useSessionWithMessages,
    useCreateSession,
    useDeleteSession,
    useCreateMessage,
    useSessionCheckpoints,
    useSessionCommits,
    useCreateCheckpoint,
    useChatStream,
} from '../hooks/useApi';
// Types used via API context and hooks

// Syntax themes for code blocks
const syntaxThemes = [
    { id: 'github-dark', name: 'GitHub Dark', type: 'dark' },
    { id: 'monokai', name: 'Monokai', type: 'dark' },
    { id: 'ayu-monokai', name: 'Ayu Monokai', type: 'dark' },
    { id: 'nord', name: 'Nord', type: 'dark' },
    { id: 'one-dark', name: 'One Dark', type: 'dark' },
    { id: 'github-light', name: 'GitHub Light', type: 'light' },
    { id: 'one-light', name: 'One Light', type: 'light' },
    { id: 'solarized-light', name: 'Solarized Light', type: 'light' },
    { id: 'vs-light', name: 'VS Light', type: 'light' },
];

// Helper to format timestamps
function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function Chat() {
    // API context data
    const { providers, providerHealth, isLoading: contextLoading, error: contextError } = useApi();

    // Session list - limit to recent 50
    const { data: sessionsData, refetch: refetchSessions } = useSessions({ limit: 50, sortBy: 'updatedAt', sortOrder: 'desc' });
    const sessions = sessionsData?.items ?? [];

    // Selected session state
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const { data: activeSessionData, refetch: refetchActiveSession } = useSessionWithMessages(activeSessionId);

    // Session checkpoints and commits
    const { data: checkpointsData } = useSessionCheckpoints(activeSessionId);
    const { data: commitsData } = useSessionCommits(activeSessionId);
    const checkpoints = checkpointsData ?? [];
    const commits = commitsData ?? [];

    // Mutations
    const createSessionMutation = useCreateSession();
    const deleteSessionMutation = useDeleteSession();
    const createMessageMutation = useCreateMessage();
    const createCheckpointMutation = useCreateCheckpoint();

    // Streaming chat
    const chatStream = useChatStream();

    // Local UI state
    const [input, setInput] = useState('');
    const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState<string | null>(null);
    const [showProviderDropdown, setShowProviderDropdown] = useState(false);
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
    const [syntaxTheme, setSyntaxTheme] = useState('github-dark');
    const [fontSize, setFontSize] = useState('14');
    const [showTimestamps, setShowTimestamps] = useState(true);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [streamResponses, setStreamResponses] = useState(true);
    const [filterProvider, setFilterProvider] = useState<string | null>(null);
    const [showGitPanel, setShowGitPanel] = useState(false);
    const [gitPanelTab, setGitPanelTab] = useState<'commits' | 'checkpoints'>('commits');
    const [showCheckpointModal, setShowCheckpointModal] = useState(false);
    const [checkpointName, setCheckpointName] = useState('');
    const [checkpointDesc, setCheckpointDesc] = useState('');
    const [checkpointTags, setCheckpointTags] = useState('');

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const settingsRef = useRef<HTMLDivElement>(null);

    // Get active providers (connected)
    const activeProviders = providers.filter(p => {
        const health = providerHealth.find(h => h.providerId === p.id);
        return health?.status === 'connected' || p.status === 'connected';
    });

    // Selected provider object
    const selectedProvider = providers.find(p => p.id === selectedProviderId) ?? activeProviders[0] ?? providers[0];

    // Initialize selected provider/model when providers load
    useEffect(() => {
        if (!selectedProviderId && providers.length > 0) {
            const defaultProvider = activeProviders[0] ?? providers[0];
            setSelectedProviderId(defaultProvider?.id ?? null);
            setSelectedModel(defaultProvider?.models?.[0] ?? null);
        }
    }, [providers, activeProviders, selectedProviderId]);

    // Scroll to bottom when messages change
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [activeSessionData?.messages, chatStream.content, scrollToBottom]);

    // Close settings popup when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
                setShowSettings(false);
            }
        };
        if (showSettings) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showSettings]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
                event.preventDefault();
                setShowKeyboardShortcuts(true);
            }
            if (event.key === 'Escape') {
                setShowKeyboardShortcuts(false);
                setShowSettings(false);
                setShowCheckpointModal(false);
            }
            if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
                event.preventDefault();
                newChat();
            }
            if ((event.metaKey || event.ctrlKey) && event.key === '/') {
                event.preventDefault();
                inputRef.current?.focus();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Handle sending a message
    const handleSend = async () => {
        if (!input.trim() || chatStream.isStreaming) return;
        if (!selectedProvider) return;

        const userContent = input.trim();
        setInput('');

        let sessionId = activeSessionId;

        // Create a new session if none selected
        if (!sessionId) {
            const newSession = await createSessionMutation.mutate({
                title: userContent.slice(0, 50) + (userContent.length > 50 ? '...' : ''),
                provider: selectedProvider.id,
                model: selectedModel,
            });
            if (newSession) {
                sessionId = newSession.id;
                setActiveSessionId(sessionId);
                await refetchSessions();
            } else {
                return;
            }
        }

        // Add user message
        await createMessageMutation.mutate({
            sessionId,
            data: {
                role: 'user',
                content: userContent,
            },
        });

        // Refresh session to show user message
        await refetchActiveSession();

        // Build message history for chat completion
        const messageHistory = activeSessionData?.messages?.map(m => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
        })) ?? [];

        messageHistory.push({ role: 'user', content: userContent });

        // Send to AI
        if (streamResponses) {
            // Streaming response
            const fullResponse = await chatStream.startStream(
                {
                    provider: selectedProvider.id,
                    model: selectedModel ?? selectedProvider.models?.[0] ?? '',
                    messages: messageHistory,
                    sessionId,
                },
                undefined,
                async (content) => {
                    // On complete, save the assistant message
                    await createMessageMutation.mutate({
                        sessionId: sessionId!,
                        data: {
                            role: 'assistant',
                            content,
                            model: selectedModel,
                        },
                    });
                    chatStream.reset();
                    await refetchActiveSession();
                }
            );

            if (!fullResponse && chatStream.error) {
                // Handle error - still save error message
                await createMessageMutation.mutate({
                    sessionId: sessionId!,
                    data: {
                        role: 'assistant',
                        content: `Error: ${chatStream.error.message}`,
                    },
                });
                await refetchActiveSession();
            }
        } else {
            // TODO: Non-streaming completion via useChatCompletion
            // For now, just show a placeholder
            await createMessageMutation.mutate({
                sessionId: sessionId!,
                data: {
                    role: 'assistant',
                    content: 'Non-streaming responses not yet implemented. Enable "Stream Responses" in settings.',
                },
            });
            await refetchActiveSession();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const newChat = () => {
        setActiveSessionId(null);
        setInput('');
        chatStream.reset();
    };

    const deleteSession = async (id: string) => {
        await deleteSessionMutation.mutate(id);
        if (activeSessionId === id) {
            setActiveSessionId(null);
        }
        await refetchSessions();
    };

    const handleCreateCheckpoint = async () => {
        if (!checkpointName.trim() || !activeSessionId) return;

        const messages = activeSessionData?.messages ?? [];
        const lastMessage = messages[messages.length - 1];

        await createCheckpointMutation.mutate({
            sessionId: activeSessionId,
            data: {
                name: checkpointName.trim(),
                description: checkpointDesc.trim() || null,
                messageId: lastMessage?.id ?? null,
            },
        });

        setCheckpointName('');
        setCheckpointDesc('');
        setCheckpointTags('');
        setShowCheckpointModal(false);
    };

    // Render code blocks with syntax highlighting
    const renderMessage = (content: string) => {
        const parts = content.split(/(```[\s\S]*?```)/g);
        return parts.map((part, index) => {
            if (part.startsWith('```')) {
                const match = part.match(/```(\w+)?\n?([\s\S]*?)```/);
                if (match) {
                    const [, lang, code] = match;
                    const highlighted = lang
                        ? hljs.highlight(code.trim(), { language: lang, ignoreIllegals: true }).value
                        : hljs.highlightAuto(code.trim()).value;
                    return (
                        <div key={index} className="my-3 rounded-lg overflow-hidden bg-[hsl(var(--muted))]" data-syntax-theme={syntaxTheme}>
                            <div className="flex items-center justify-between px-4 py-2 bg-[hsl(var(--muted))]/80 text-xs text-[hsl(var(--muted-foreground))]">
                                <span>{lang || 'code'}</span>
                                <button
                                    onClick={() => copyToClipboard(code.trim(), `code-${index}`)}
                                    className="flex items-center gap-1 hover:text-[hsl(var(--foreground))]"
                                >
                                    {copiedId === `code-${index}` ? <Check size={14} /> : <Copy size={14} />}
                                    {copiedId === `code-${index}` ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                            <pre className="p-4 overflow-x-auto">
                                <code
                                    className={`hljs language-${lang || 'plaintext'}`}
                                    dangerouslySetInnerHTML={{ __html: highlighted }}
                                />
                            </pre>
                        </div>
                    );
                }
            }
            return <span key={index} className="whitespace-pre-wrap">{part}</span>;
        });
    };

    // Filter sessions by provider
    const filteredSessions = filterProvider
        ? sessions.filter(s => s.provider === filterProvider)
        : sessions;

    // Loading/error states
    if (contextError) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-4rem)] -m-8">
                <div className="text-center">
                    <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
                    <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] mb-2">Connection Error</h2>
                    <p className="text-[hsl(var(--muted-foreground))]">{contextError.message}</p>
                </div>
            </div>
        );
    }

    if (contextLoading && providers.length === 0) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-4rem)] -m-8">
                <div className="text-center">
                    <Loader2 size={48} className="mx-auto mb-4 text-[hsl(var(--primary))] animate-spin" />
                    <p className="text-[hsl(var(--muted-foreground))]">Loading...</p>
                </div>
            </div>
        );
    }

    const activeMessages = activeSessionData?.messages ?? [];

    return (
        <div className="flex h-[calc(100vh-4rem)] -m-8">
            {/* Sessions Sidebar */}
            <div className="w-72 bg-[hsl(var(--card))] border-r flex flex-col">
                <div className="p-4 border-b">
                    <button
                        onClick={newChat}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:bg-[hsl(var(--primary))]/90 transition-colors"
                    >
                        <RefreshCw size={18} />
                        New Chat
                    </button>
                </div>

                {/* Filter */}
                <div className="p-3 border-b">
                    <div className="flex items-center gap-2">
                        <Filter size={16} className="text-[hsl(var(--muted-foreground))]" />
                        <select
                            value={filterProvider || ''}
                            onChange={(e) => setFilterProvider(e.target.value || null)}
                            className="flex-1 bg-[hsl(var(--muted))] border-none rounded px-2 py-1 text-sm text-[hsl(var(--foreground))]"
                        >
                            <option value="">All Providers</option>
                            {providers.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Sessions List */}
                <div className="flex-1 overflow-y-auto">
                    {filteredSessions.length === 0 ? (
                        <div className="p-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
                            No sessions yet
                        </div>
                    ) : (
                        filteredSessions.map(session => {
                            const provider = providers.find(p => p.id === session.provider);
                            return (
                                <div
                                    key={session.id}
                                    onClick={() => setActiveSessionId(session.id)}
                                    className={`p-3 border-b cursor-pointer hover:bg-[hsl(var(--muted))] transition-colors ${activeSessionId === session.id ? 'bg-[hsl(var(--muted))]' : ''}`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span>{provider?.icon || '💬'}</span>
                                                <span className="font-medium text-sm text-[hsl(var(--foreground))] truncate">
                                                    {session.title || 'Untitled'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                                    {session.messageCount} messages
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteSession(session.id);
                                            }}
                                            className="p-1 text-[hsl(var(--muted-foreground))] hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
                {/* Chat Header */}
                <div className="h-14 px-4 border-b flex items-center justify-between bg-[hsl(var(--card))]">
                    <div className="flex items-center gap-3">
                        {activeSessionData && (
                            <span className="text-sm text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                                <FileText size={14} />
                                {activeSessionData.title || 'Untitled'}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Provider Selector */}
                        <div className="relative">
                            <button
                                onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-[hsl(var(--muted))] rounded-lg hover:bg-[hsl(var(--muted))]/80 transition-colors"
                            >
                                <span>{selectedProvider?.icon || '🤖'}</span>
                                <span className="text-sm font-medium text-[hsl(var(--foreground))]">{selectedProvider?.name || 'Select Provider'}</span>
                                <ChevronDown size={16} className="text-[hsl(var(--muted-foreground))]" />
                            </button>
                            {showProviderDropdown && (
                                <div className="absolute top-full left-0 mt-1 w-56 bg-[hsl(var(--card))] border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                                    <div className="p-2 border-b">
                                        <span className="text-xs text-[hsl(var(--muted-foreground))] font-medium">Cloud Providers</span>
                                    </div>
                                    {providers.filter(p => p.type === 'cloud').map(provider => (
                                        <button
                                            key={provider.id}
                                            onClick={() => {
                                                setSelectedProviderId(provider.id);
                                                setSelectedModel(provider.models?.[0] ?? null);
                                                setShowProviderDropdown(false);
                                            }}
                                            className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-[hsl(var(--muted))] transition-colors ${selectedProviderId === provider.id ? 'bg-[hsl(var(--muted))]' : ''}`}
                                        >
                                            <span>{provider.icon || '🤖'}</span>
                                            <span className="text-sm text-[hsl(var(--foreground))]">{provider.name}</span>
                                        </button>
                                    ))}
                                    <div className="p-2 border-t border-b">
                                        <span className="text-xs text-[hsl(var(--muted-foreground))] font-medium">Local Providers</span>
                                    </div>
                                    {providers.filter(p => p.type === 'local').map(provider => (
                                        <button
                                            key={provider.id}
                                            onClick={() => {
                                                setSelectedProviderId(provider.id);
                                                setSelectedModel(provider.models?.[0] ?? null);
                                                setShowProviderDropdown(false);
                                            }}
                                            className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-[hsl(var(--muted))] transition-colors ${selectedProviderId === provider.id ? 'bg-[hsl(var(--muted))]' : ''}`}
                                        >
                                            <span>{provider.icon || '🦙'}</span>
                                            <span className="text-sm text-[hsl(var(--foreground))]">{provider.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Model Selector */}
                        <div className="relative">
                            <button
                                onClick={() => setShowModelDropdown(!showModelDropdown)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-[hsl(var(--muted))] rounded-lg hover:bg-[hsl(var(--muted))]/80 transition-colors"
                            >
                                <Cpu size={14} className="text-[hsl(var(--muted-foreground))]" />
                                <span className="text-sm text-[hsl(var(--foreground))]">{selectedModel || 'Select Model'}</span>
                                <ChevronDown size={16} className="text-[hsl(var(--muted-foreground))]" />
                            </button>
                            {showModelDropdown && selectedProvider && (
                                <div className="absolute top-full left-0 mt-1 w-56 bg-[hsl(var(--card))] border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                                    <div className="p-2 border-b">
                                        <span className="text-xs text-[hsl(var(--muted-foreground))] font-medium">Available Models</span>
                                    </div>
                                    {(selectedProvider.models ?? []).map(model => (
                                        <button
                                            key={model}
                                            onClick={() => {
                                                setSelectedModel(model);
                                                setShowModelDropdown(false);
                                            }}
                                            className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-[hsl(var(--muted))] transition-colors ${selectedModel === model ? 'bg-[hsl(var(--muted))]' : ''}`}
                                        >
                                            <Cpu size={14} className="text-[hsl(var(--muted-foreground))]" />
                                            <span className="text-sm text-[hsl(var(--foreground))]">{model}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Git Panel Toggle */}
                        <button
                            onClick={() => setShowGitPanel(!showGitPanel)}
                            className={`p-2 rounded-lg transition-colors ${showGitPanel ? 'bg-[hsl(var(--primary))] text-white' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'}`}
                        >
                            <GitBranch size={18} />
                        </button>

                        {/* Settings */}
                        <div className="relative" ref={settingsRef}>
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-[hsl(var(--primary))] text-white' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'}`}
                            >
                                <Settings size={18} />
                            </button>

                            {showSettings && (
                                <div className="absolute right-0 top-full mt-2 w-80 bg-[hsl(var(--card))] border rounded-xl shadow-xl z-50 overflow-hidden">
                                    <div className="flex items-center justify-between p-3 border-b bg-[hsl(var(--muted))]/50">
                                        <span className="font-medium text-[hsl(var(--foreground))]">Chat Settings</span>
                                        <button onClick={() => setShowSettings(false)} className="p-1 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                                            <X size={16} />
                                        </button>
                                    </div>
                                    <div className="p-2 space-y-1 max-h-96 overflow-y-auto">
                                        {/* Syntax Theme */}
                                        <div className="p-2 hover:bg-[hsl(var(--muted))] rounded-lg">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Palette size={16} className="text-purple-500" />
                                                    <span className="text-sm text-[hsl(var(--foreground))]">Syntax Theme</span>
                                                </div>
                                                <select
                                                    value={syntaxTheme}
                                                    onChange={(e) => setSyntaxTheme(e.target.value)}
                                                    className="bg-[hsl(var(--muted))] border rounded px-2 py-1 text-xs text-[hsl(var(--foreground))]"
                                                >
                                                    {syntaxThemes.map(theme => (
                                                        <option key={theme.id} value={theme.id}>{theme.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Font Size */}
                                        <div className="p-2 hover:bg-[hsl(var(--muted))] rounded-lg">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Type size={16} className="text-blue-500" />
                                                    <span className="text-sm text-[hsl(var(--foreground))]">Font Size</span>
                                                </div>
                                                <select
                                                    value={fontSize}
                                                    onChange={(e) => setFontSize(e.target.value)}
                                                    className="bg-[hsl(var(--muted))] border rounded px-2 py-1 text-xs text-[hsl(var(--foreground))]"
                                                >
                                                    <option value="12">Small (12px)</option>
                                                    <option value="14">Medium (14px)</option>
                                                    <option value="16">Large (16px)</option>
                                                    <option value="18">X-Large (18px)</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="border-t my-2" />

                                        {/* Show Timestamps */}
                                        <div className="p-2 hover:bg-[hsl(var(--muted))] rounded-lg cursor-pointer" onClick={() => setShowTimestamps(!showTimestamps)}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Eye size={16} className="text-green-500" />
                                                    <span className="text-sm text-[hsl(var(--foreground))]">Show Timestamps</span>
                                                </div>
                                                <div className={`w-9 h-5 rounded-full transition-colors ${showTimestamps ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]'}`}>
                                                    <div className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-transform ${showTimestamps ? 'translate-x-4.5 ml-0.5' : 'translate-x-0.5'}`} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Sound Notifications */}
                                        <div className="p-2 hover:bg-[hsl(var(--muted))] rounded-lg cursor-pointer" onClick={() => setSoundEnabled(!soundEnabled)}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Bell size={16} className="text-yellow-500" />
                                                    <span className="text-sm text-[hsl(var(--foreground))]">Sound Notifications</span>
                                                </div>
                                                <div className={`w-9 h-5 rounded-full transition-colors ${soundEnabled ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]'}`}>
                                                    <div className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-transform ${soundEnabled ? 'translate-x-4.5 ml-0.5' : 'translate-x-0.5'}`} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Stream Responses */}
                                        <div className="p-2 hover:bg-[hsl(var(--muted))] rounded-lg cursor-pointer" onClick={() => setStreamResponses(!streamResponses)}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <MessageSquare size={16} className="text-cyan-500" />
                                                    <span className="text-sm text-[hsl(var(--foreground))]">Stream Responses</span>
                                                </div>
                                                <div className={`w-9 h-5 rounded-full transition-colors ${streamResponses ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]'}`}>
                                                    <div className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-transform ${streamResponses ? 'translate-x-4.5 ml-0.5' : 'translate-x-0.5'}`} />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border-t my-2" />

                                        {/* Export Chat */}
                                        <button className="w-full p-2 hover:bg-[hsl(var(--muted))] rounded-lg text-left">
                                            <div className="flex items-center gap-2">
                                                <Download size={16} className="text-[hsl(var(--muted-foreground))]" />
                                                <span className="text-sm text-[hsl(var(--foreground))]">Export Chat</span>
                                            </div>
                                        </button>

                                        {/* Import Chat */}
                                        <button className="w-full p-2 hover:bg-[hsl(var(--muted))] rounded-lg text-left">
                                            <div className="flex items-center gap-2">
                                                <Upload size={16} className="text-[hsl(var(--muted-foreground))]" />
                                                <span className="text-sm text-[hsl(var(--foreground))]">Import Chat</span>
                                            </div>
                                        </button>

                                        {/* Keyboard Shortcuts */}
                                        <button
                                            onClick={() => {
                                                setShowKeyboardShortcuts(true);
                                                setShowSettings(false);
                                            }}
                                            className="w-full p-2 hover:bg-[hsl(var(--muted))] rounded-lg text-left"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Keyboard size={16} className="text-[hsl(var(--muted-foreground))]" />
                                                    <span className="text-sm text-[hsl(var(--foreground))]">Keyboard Shortcuts</span>
                                                </div>
                                                <span className="text-xs text-[hsl(var(--muted-foreground))]">⌘K</span>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Git Panel */}
                {showGitPanel && activeSessionId && (
                    <div className="bg-[hsl(var(--card))] border-b">
                        <div className="flex items-center justify-between px-4 py-2 border-b bg-[hsl(var(--muted))]/50">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <GitBranch size={16} className="text-green-500" />
                                    <span className="text-sm font-medium text-[hsl(var(--foreground))]">main</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <GitCommitIcon size={14} className="text-[hsl(var(--muted-foreground))]" />
                                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{commits.length} commits</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Bookmark size={14} className="text-[hsl(var(--muted-foreground))]" />
                                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{checkpoints.length} checkpoints</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowCheckpointModal(true)}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-[hsl(var(--primary))] text-white rounded hover:opacity-90"
                            >
                                <Plus size={12} />
                                Checkpoint
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b">
                            <button
                                onClick={() => setGitPanelTab('commits')}
                                className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 transition-colors ${gitPanelTab === 'commits' ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]' : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}
                            >
                                <GitCommitIcon size={14} />
                                Commits
                            </button>
                            <button
                                onClick={() => setGitPanelTab('checkpoints')}
                                className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 transition-colors ${gitPanelTab === 'checkpoints' ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]' : 'border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}
                            >
                                <Bookmark size={14} />
                                Checkpoints
                            </button>
                        </div>

                        {/* Panel Content */}
                        <div className="max-h-48 overflow-y-auto">
                            {gitPanelTab === 'commits' && (
                                <div className="divide-y">
                                    {commits.length === 0 ? (
                                        <div className="p-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
                                            No linked commits yet.
                                        </div>
                                    ) : (
                                        commits.map((commit, idx) => (
                                            <div key={commit.hash} className="flex items-start gap-3 px-4 py-2 hover:bg-[hsl(var(--muted))]/50">
                                                <div className="flex flex-col items-center">
                                                    <div className={`w-3 h-3 rounded-full border-2 ${commit.messageId ? 'bg-green-500 border-green-500' : 'bg-[hsl(var(--card))] border-[hsl(var(--muted-foreground))]'}`} />
                                                    {idx < commits.length - 1 && <div className="w-0.5 h-full bg-[hsl(var(--border))] mt-1" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <code className="text-xs font-mono text-[hsl(var(--primary))]">{commit.shortHash}</code>
                                                        <span className="text-sm text-[hsl(var(--foreground))] truncate">{commit.message}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-0.5">
                                                        <span className="text-xs text-[hsl(var(--muted-foreground))]">{commit.author}</span>
                                                        <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                                            {formatTime(commit.timestamp)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button className="p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                                                    <MoreVertical size={14} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {gitPanelTab === 'checkpoints' && (
                                <div className="divide-y">
                                    {checkpoints.length === 0 ? (
                                        <div className="p-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
                                            No checkpoints yet. Create one to mark important conversation points.
                                        </div>
                                    ) : (
                                        checkpoints.map((cp) => (
                                            <div key={cp.id} className="flex items-start gap-3 px-4 py-2 hover:bg-[hsl(var(--muted))]/50">
                                                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                                    <Bookmark size={16} className="text-purple-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium text-[hsl(var(--foreground))]">{cp.name}</span>
                                                    </div>
                                                    {cp.description && (
                                                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{cp.description}</p>
                                                    )}
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Clock size={10} className="text-[hsl(var(--muted-foreground))]" />
                                                        <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                                            {formatTime(cp.createdAt)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <button className="p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" title="Go to message">
                                                    <ChevronRight size={14} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {activeMessages.map(message => {
                        const msgProvider = providers.find(p => p.id === activeSessionData?.provider);
                        return (
                            <div
                                key={message.id}
                                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {message.role === 'assistant' && (
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                                        style={{ backgroundColor: (msgProvider?.color ?? '#888') + '20' }}
                                    >
                                        {msgProvider?.icon || <Bot size={18} />}
                                    </div>
                                )}
                                <div
                                    className={`max-w-[70%] rounded-2xl px-4 py-3 ${message.role === 'user'
                                        ? 'bg-[hsl(var(--primary))] text-white'
                                        : 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]'
                                        }`}
                                >
                                    <div style={{ fontSize: `${fontSize}px` }}>{renderMessage(message.content)}</div>
                                    {showTimestamps && (
                                        <div className={`text-xs mt-2 ${message.role === 'user' ? 'text-white/70' : 'text-[hsl(var(--muted-foreground))]'}`}>
                                            {formatTime(message.createdAt)}
                                        </div>
                                    )}
                                </div>
                                {message.role === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center">
                                        <User size={18} className="text-white" />
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Streaming message */}
                    {chatStream.isStreaming && chatStream.content && (
                        <div className="flex gap-3 justify-start">
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                                style={{ backgroundColor: (selectedProvider?.color ?? '#888') + '20' }}
                            >
                                {selectedProvider?.icon || <Bot size={18} />}
                            </div>
                            <div className="max-w-[70%] rounded-2xl px-4 py-3 bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]">
                                <div style={{ fontSize: `${fontSize}px` }}>{renderMessage(chatStream.content)}</div>
                            </div>
                        </div>
                    )}

                    {/* Loading indicator */}
                    {chatStream.isStreaming && !chatStream.content && (
                        <div className="flex gap-3">
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                                style={{ backgroundColor: (selectedProvider?.color ?? '#888') + '20' }}
                            >
                                {selectedProvider?.icon || <Bot size={18} />}
                            </div>
                            <div className="bg-[hsl(var(--muted))] rounded-2xl px-4 py-3">
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-[hsl(var(--muted-foreground))] rounded-full animate-bounce" />
                                    <div className="w-2 h-2 bg-[hsl(var(--muted-foreground))] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                                    <div className="w-2 h-2 bg-[hsl(var(--muted-foreground))] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Empty state */}
                    {!activeSessionId && !chatStream.isStreaming && (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <Code size={48} className="text-[hsl(var(--muted-foreground))] mb-4" />
                            <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] mb-2">Start a new conversation</h2>
                            <p className="text-[hsl(var(--muted-foreground))] max-w-md">
                                Select a provider and ask anything about coding, debugging, or software development.
                            </p>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t bg-[hsl(var(--card))]">
                    <div className="flex items-end gap-2">
                        <div className="flex-1 relative">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={`Message ${selectedProvider?.name ?? 'AI'}...`}
                                className="w-full px-4 py-3 pr-24 bg-[hsl(var(--muted))] rounded-xl resize-none text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                rows={1}
                                style={{ minHeight: '48px', maxHeight: '200px' }}
                            />
                            <div className="absolute right-2 bottom-2 flex items-center gap-1">
                                <button className="p-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
                                    <Paperclip size={18} />
                                </button>
                                <button className="p-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
                                    <Mic size={18} />
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || chatStream.isStreaming}
                            className="p-3 bg-[hsl(var(--primary))] text-white rounded-xl hover:bg-[hsl(var(--primary))]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {chatStream.isStreaming ? <StopCircle size={20} /> : <Send size={20} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Checkpoint Creation Modal */}
            {showCheckpointModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCheckpointModal(false)}>
                    <div className="bg-[hsl(var(--card))] rounded-xl border shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b">
                            <div className="flex items-center gap-2">
                                <Bookmark size={18} className="text-purple-500" />
                                <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Create Checkpoint</h2>
                            </div>
                            <button
                                onClick={() => setShowCheckpointModal(false)}
                                className="p-1 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Name *</label>
                                <input
                                    type="text"
                                    value={checkpointName}
                                    onChange={(e) => setCheckpointName(e.target.value)}
                                    placeholder="e.g., Working implementation"
                                    className="w-full px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Description</label>
                                <textarea
                                    value={checkpointDesc}
                                    onChange={(e) => setCheckpointDesc(e.target.value)}
                                    placeholder="Optional notes about this checkpoint..."
                                    rows={2}
                                    className="w-full px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">Tags</label>
                                <input
                                    type="text"
                                    value={checkpointTags}
                                    onChange={(e) => setCheckpointTags(e.target.value)}
                                    placeholder="e.g., milestone, bugfix, feature (comma separated)"
                                    className="w-full px-3 py-2 bg-[hsl(var(--muted))] border rounded-lg text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                />
                            </div>
                            <div className="bg-[hsl(var(--muted))]/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                                    <History size={14} />
                                    <span>This checkpoint will be linked to the current conversation state</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 p-4 border-t bg-[hsl(var(--muted))]/50">
                            <button
                                onClick={() => setShowCheckpointModal(false)}
                                className="px-4 py-2 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateCheckpoint}
                                disabled={!checkpointName.trim()}
                                className="px-4 py-2 text-sm bg-[hsl(var(--primary))] text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Create Checkpoint
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Keyboard Shortcuts Modal */}
            {showKeyboardShortcuts && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowKeyboardShortcuts(false)}>
                    <div className="bg-[hsl(var(--card))] rounded-xl border shadow-xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Keyboard Shortcuts</h2>
                            <button
                                onClick={() => setShowKeyboardShortcuts(false)}
                                className="p-1 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                            <div>
                                <h3 className="text-sm font-medium text-[hsl(var(--muted-foreground))] mb-2">Chat</h3>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm text-[hsl(var(--foreground))]">Send message</span>
                                        <kbd className="px-2 py-1 bg-[hsl(var(--muted))] rounded text-xs font-mono">Enter</kbd>
                                    </div>
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm text-[hsl(var(--foreground))]">New line</span>
                                        <kbd className="px-2 py-1 bg-[hsl(var(--muted))] rounded text-xs font-mono">Shift + Enter</kbd>
                                    </div>
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm text-[hsl(var(--foreground))]">New chat</span>
                                        <kbd className="px-2 py-1 bg-[hsl(var(--muted))] rounded text-xs font-mono">⌘ + N</kbd>
                                    </div>
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm text-[hsl(var(--foreground))]">Focus input</span>
                                        <kbd className="px-2 py-1 bg-[hsl(var(--muted))] rounded text-xs font-mono">⌘ + /</kbd>
                                    </div>
                                </div>
                            </div>
                            <div className="border-t pt-4">
                                <h3 className="text-sm font-medium text-[hsl(var(--muted-foreground))] mb-2">Actions</h3>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm text-[hsl(var(--foreground))]">Show shortcuts</span>
                                        <kbd className="px-2 py-1 bg-[hsl(var(--muted))] rounded text-xs font-mono">⌘ + K</kbd>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t bg-[hsl(var(--muted))]/50">
                            <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">
                                Use Ctrl instead of ⌘ on Windows/Linux
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
