// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, useRef, useEffect, useCallback, startTransition } from 'react';
import {
    Send,
    Bot,
    User,
    Settings,
    Paperclip,
    StopCircle,
    Copy,
    Check,
    RefreshCw,
    Trash2,
    ChevronDown,
    GitBranch,
    GitCommit as GitCommitIcon,
    MessageSquare,
    X,
    Bookmark,
    Plus,
    AlertCircle,
    Loader2,
    History,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Filter,
} from 'lucide-react';
import hljs from 'highlight.js';
import { formatTime } from '@csm/shared';
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
    useChatCompletion,
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
    const chatCompletion = useChatCompletion();

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
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [sortBy, setSortBy] = useState<'date' | 'title' | 'messages'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [showSortDropdown, setShowSortDropdown] = useState(false);
    const [showGitPanel, setShowGitPanel] = useState(false);
    const [gitPanelTab, setGitPanelTab] = useState<'commits' | 'checkpoints'>('commits');
    const [showCheckpointModal, setShowCheckpointModal] = useState(false);
    const [checkpointName, setCheckpointName] = useState('');
    const [checkpointDesc, setCheckpointDesc] = useState('');
    const [checkpointTags, setCheckpointTags] = useState('');
    const [sidebarWidth, setSidebarWidth] = useState(256);
    const [isResizing, setIsResizing] = useState(false);

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const settingsRef = useRef<HTMLDivElement>(null);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Sidebar resize handlers
    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing || !containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            const newWidth = e.clientX - containerRect.left;
            setSidebarWidth(Math.max(180, Math.min(500, newWidth)));
        };
        const handleMouseUp = () => {
            setIsResizing(false);
        };
        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing]);

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
            startTransition(() => {
                setSelectedProviderId(defaultProvider?.id ?? null);
                setSelectedModel(defaultProvider?.models?.[0] ?? null);
            });
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

    // New chat function - defined before useEffect that uses it
    /* eslint-disable react-hooks/preserve-manual-memoization */
    const newChat = useCallback(() => {
        setActiveSessionId(null);
        setInput('');
        chatStream.reset();
    }, [chatStream]);
    /* eslint-enable react-hooks/preserve-manual-memoization */

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
    }, [newChat]);

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
            // Non-streaming completion
            const response = await chatCompletion.mutate({
                provider: selectedProvider.id,
                model: selectedModel ?? selectedProvider.models?.[0] ?? '',
                messages: messageHistory,
                sessionId,
            });

            if (response?.content) {
                await createMessageMutation.mutate({
                    sessionId: sessionId!,
                    data: {
                        role: 'assistant',
                        content: response.content,
                        model: selectedModel,
                    },
                });
            } else if (chatCompletion.error) {
                await createMessageMutation.mutate({
                    sessionId: sessionId!,
                    data: {
                        role: 'assistant',
                        content: `Error: ${chatCompletion.error.message}`,
                    },
                });
            }
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
    const filteredByProvider = filterProvider
        ? sessions.filter(s => s.provider === filterProvider)
        : sessions;

    // Sort sessions
    const filteredSessions = [...filteredByProvider].sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
            case 'date':
                comparison = (a.updatedAt || a.createdAt || 0) - (b.updatedAt || b.createdAt || 0);
                break;
            case 'title':
                comparison = (a.title || '').localeCompare(b.title || '');
                break;
            case 'messages':
                comparison = (a.messageCount || 0) - (b.messageCount || 0);
                break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
    });

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

    // Suggestion prompts for empty state
    const suggestions = [
        { icon: '💡', text: 'Explain a complex concept', prompt: 'Can you explain how neural networks work in simple terms?' },
        { icon: '🔧', text: 'Debug my code', prompt: 'Help me debug this code that isn\'t working as expected' },
        { icon: '📝', text: 'Write documentation', prompt: 'Help me write clear documentation for my project' },
        { icon: '🚀', text: 'Optimize performance', prompt: 'How can I optimize my application for better performance?' },
    ];

    return (
        <div ref={containerRef} className="flex h-[calc(100vh-4rem)] -m-8 bg-[hsl(var(--background))]">
            {/* Sessions Sidebar */}
            <div
                ref={sidebarRef}
                style={{ width: sidebarWidth }}
                className="bg-[hsl(var(--card))]/50 border-r border-[hsl(var(--border))]/50 flex flex-col flex-shrink-0 relative"
            >
                {/* Resize Handle */}
                <div
                    onMouseDown={startResizing}
                    className={`absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize z-10 group`}
                >
                    <div className={`absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 transition-colors ${isResizing ? 'bg-[hsl(var(--primary))]' : 'group-hover:bg-[hsl(var(--primary))]/50'}`} />
                </div>
                {/* New Chat Button */}
                <div className="p-3">
                    <button
                        onClick={newChat}
                        className="w-full flex items-center gap-3 px-4 py-3 border border-[hsl(var(--border))] rounded-xl hover:bg-[hsl(var(--muted))]/50 transition-all duration-200 group"
                    >
                        <Plus size={18} className="text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--foreground))]" />
                        <span className="text-sm font-medium text-[hsl(var(--foreground))]">New Chat</span>
                    </button>
                </div>

                {/* Filter & Sort Controls */}
                <div className="px-3 pb-2 space-y-2">
                    {/* Provider Filter */}
                    <div className="flex items-center gap-2">
                        <Filter size={12} className="text-[hsl(var(--muted-foreground))]" />
                        <div className="relative flex-1">
                            <button
                                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                                className="w-full flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                            >
                                <span>
                                    {filterProvider ? providers.find(p => p.id === filterProvider)?.name || 'Unknown' : 'All providers'}
                                </span>
                                <ChevronDown size={12} />
                            </button>
                            {showFilterDropdown && (
                                <div className="absolute top-full left-0 mt-1 w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-lg z-50 overflow-hidden">
                                    <button
                                        onClick={() => { setFilterProvider(null); setShowFilterDropdown(false); }}
                                        className={`w-full px-3 py-2 text-xs text-left hover:bg-[hsl(var(--muted))]/50 ${!filterProvider ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`}
                                    >
                                        All providers
                                    </button>
                                    {providers.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => { setFilterProvider(p.id); setShowFilterDropdown(false); }}
                                            className={`w-full px-3 py-2 text-xs text-left hover:bg-[hsl(var(--muted))]/50 ${filterProvider === p.id ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`}
                                        >
                                            {p.icon} {p.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sort Controls */}
                    <div className="flex items-center gap-2">
                        <ArrowUpDown size={12} className="text-[hsl(var(--muted-foreground))]" />
                        <div className="relative flex-1">
                            <button
                                onClick={() => setShowSortDropdown(!showSortDropdown)}
                                className="w-full flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                            >
                                <span>
                                    {sortBy === 'date' && 'Date'}
                                    {sortBy === 'title' && 'Title'}
                                    {sortBy === 'messages' && 'Messages'}
                                </span>
                                <ChevronDown size={12} />
                            </button>
                            {showSortDropdown && (
                                <div className="absolute top-full left-0 mt-1 w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-lg z-50 overflow-hidden">
                                    <button
                                        onClick={() => { setSortBy('date'); setShowSortDropdown(false); }}
                                        className={`w-full px-3 py-2 text-xs text-left hover:bg-[hsl(var(--muted))]/50 ${sortBy === 'date' ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`}
                                    >
                                        Date Modified
                                    </button>
                                    <button
                                        onClick={() => { setSortBy('title'); setShowSortDropdown(false); }}
                                        className={`w-full px-3 py-2 text-xs text-left hover:bg-[hsl(var(--muted))]/50 ${sortBy === 'title' ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`}
                                    >
                                        Title
                                    </button>
                                    <button
                                        onClick={() => { setSortBy('messages'); setShowSortDropdown(false); }}
                                        className={`w-full px-3 py-2 text-xs text-left hover:bg-[hsl(var(--muted))]/50 ${sortBy === 'messages' ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}`}
                                    >
                                        Message Count
                                    </button>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            className="p-1 rounded hover:bg-[hsl(var(--muted))]/50 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                        >
                            {sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                        </button>
                    </div>
                </div>

                {/* Sessions List */}
                <div className="flex-1 overflow-y-auto px-2">
                    {filteredSessions.length === 0 ? (
                        <div className="px-3 py-8 text-center">
                            <MessageSquare size={24} className="mx-auto mb-2 text-[hsl(var(--muted-foreground))]/50" />
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">No conversations yet</p>
                        </div>
                    ) : (
                        <div className="space-y-1 py-1">
                            {filteredSessions.map(session => {
                                const provider = providers.find(p => p.id === session.provider);
                                const isActive = activeSessionId === session.id;
                                return (
                                    <div
                                        key={session.id}
                                        onClick={() => setActiveSessionId(session.id)}
                                        className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 ${isActive
                                            ? 'bg-[hsl(var(--muted))]'
                                            : 'hover:bg-[hsl(var(--muted))]/50'
                                            }`}
                                    >
                                        <span className="text-sm flex-shrink-0">{provider?.icon || '💬'}</span>
                                        <span className={`text-sm truncate flex-1 ${isActive ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--foreground))]/80'}`}>
                                            {session.title || 'New conversation'}
                                        </span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteSession(session.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-red-500 transition-all"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Provider Status Footer */}
                <div className="p-3 border-t border-[hsl(var(--border))]/50">
                    <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                        <div className={`w-2 h-2 rounded-full ${activeProviders.length > 0 ? 'bg-green-500' : 'bg-yellow-500'}`} />
                        <span>{activeProviders.length} provider{activeProviders.length !== 1 ? 's' : ''} connected</span>
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col relative">
                {/* Minimal Header */}
                <div className="h-14 px-4 border-b border-[hsl(var(--border))]/50 flex items-center justify-between bg-[hsl(var(--background))]">
                    <div className="flex items-center gap-4">
                        {/* Provider/Model Selector - Compact */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    setShowProviderDropdown(!showProviderDropdown);
                                    setShowModelDropdown(false);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[hsl(var(--muted))]/50 transition-colors"
                            >
                                <span className="text-lg">{selectedProvider?.icon || '🤖'}</span>
                                <span className="text-sm font-medium text-[hsl(var(--foreground))]">{selectedProvider?.name || 'Select'}</span>
                                <ChevronDown size={14} className="text-[hsl(var(--muted-foreground))]" />
                            </button>
                            {showProviderDropdown && (
                                <div className="absolute top-full left-0 mt-2 w-64 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl z-50 overflow-hidden">
                                    <div className="p-2">
                                        <p className="px-2 py-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">Cloud</p>
                                        {providers.filter(p => p.type === 'cloud').map(provider => (
                                            <button
                                                key={provider.id}
                                                onClick={() => {
                                                    setSelectedProviderId(provider.id);
                                                    setSelectedModel(provider.models?.[0] ?? null);
                                                    setShowProviderDropdown(false);
                                                }}
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${selectedProviderId === provider.id ? 'bg-[hsl(var(--muted))]' : 'hover:bg-[hsl(var(--muted))]/50'}`}
                                            >
                                                <span className="text-lg">{provider.icon || '🤖'}</span>
                                                <span className="text-sm text-[hsl(var(--foreground))]">{provider.name}</span>
                                                {selectedProviderId === provider.id && <Check size={14} className="ml-auto text-[hsl(var(--primary))]" />}
                                            </button>
                                        ))}
                                        <p className="px-2 py-1 mt-2 text-xs font-medium text-[hsl(var(--muted-foreground))]">Local</p>
                                        {providers.filter(p => p.type === 'local').map(provider => (
                                            <button
                                                key={provider.id}
                                                onClick={() => {
                                                    setSelectedProviderId(provider.id);
                                                    setSelectedModel(provider.models?.[0] ?? null);
                                                    setShowProviderDropdown(false);
                                                }}
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${selectedProviderId === provider.id ? 'bg-[hsl(var(--muted))]' : 'hover:bg-[hsl(var(--muted))]/50'}`}
                                            >
                                                <span className="text-lg">{provider.icon || '🦙'}</span>
                                                <span className="text-sm text-[hsl(var(--foreground))]">{provider.name}</span>
                                                {selectedProviderId === provider.id && <Check size={14} className="ml-auto text-[hsl(var(--primary))]" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Model Selector */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    setShowModelDropdown(!showModelDropdown);
                                    setShowProviderDropdown(false);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[hsl(var(--muted))]/50 transition-colors text-[hsl(var(--muted-foreground))]"
                            >
                                <span className="text-sm">{selectedModel || 'Model'}</span>
                                <ChevronDown size={14} />
                            </button>
                            {showModelDropdown && selectedProvider && (
                                <div className="absolute top-full left-0 mt-2 w-56 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl z-50 overflow-hidden">
                                    <div className="p-2">
                                        {(selectedProvider.models ?? []).map(model => (
                                            <button
                                                key={model}
                                                onClick={() => {
                                                    setSelectedModel(model);
                                                    setShowModelDropdown(false);
                                                }}
                                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${selectedModel === model ? 'bg-[hsl(var(--muted))]' : 'hover:bg-[hsl(var(--muted))]/50'}`}
                                            >
                                                <span className="text-sm text-[hsl(var(--foreground))]">{model}</span>
                                                {selectedModel === model && <Check size={14} className="ml-auto text-[hsl(var(--primary))]" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        {/* Git Panel Toggle */}
                        {activeSessionId && (
                            <button
                                onClick={() => setShowGitPanel(!showGitPanel)}
                                className={`p-2 rounded-lg transition-colors ${showGitPanel ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/50 hover:text-[hsl(var(--foreground))]'}`}
                                title="Version history"
                            >
                                <GitBranch size={18} />
                            </button>
                        )}

                        {/* Settings */}
                        <div className="relative" ref={settingsRef}>
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/50 hover:text-[hsl(var(--foreground))]'}`}
                            >
                                <Settings size={18} />
                            </button>

                            {showSettings && (
                                <div className="absolute right-0 top-full mt-2 w-72 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-xl z-50 overflow-hidden">
                                    <div className="p-3 border-b border-[hsl(var(--border))]/50">
                                        <span className="text-sm font-medium text-[hsl(var(--foreground))]">Settings</span>
                                    </div>
                                    <div className="p-2 space-y-1 max-h-96 overflow-y-auto">
                                        {/* Syntax Theme */}
                                        <div className="p-2 rounded-lg">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-[hsl(var(--foreground))]">Code theme</span>
                                                <select
                                                    value={syntaxTheme}
                                                    onChange={(e) => setSyntaxTheme(e.target.value)}
                                                    className="bg-[hsl(var(--muted))] border-none rounded-lg px-2 py-1 text-xs text-[hsl(var(--foreground))] focus:outline-none"
                                                >
                                                    {syntaxThemes.map(theme => (
                                                        <option key={theme.id} value={theme.id}>{theme.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Font Size */}
                                        <div className="p-2 rounded-lg">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-[hsl(var(--foreground))]">Font size</span>
                                                <select
                                                    value={fontSize}
                                                    onChange={(e) => setFontSize(e.target.value)}
                                                    className="bg-[hsl(var(--muted))] border-none rounded-lg px-2 py-1 text-xs text-[hsl(var(--foreground))] focus:outline-none"
                                                >
                                                    <option value="12">Small</option>
                                                    <option value="14">Medium</option>
                                                    <option value="16">Large</option>
                                                    <option value="18">X-Large</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="border-t border-[hsl(var(--border))]/50 my-2" />

                                        {/* Show Timestamps */}
                                        <div
                                            className="flex items-center justify-between p-2 rounded-lg hover:bg-[hsl(var(--muted))]/50 cursor-pointer"
                                            onClick={() => setShowTimestamps(!showTimestamps)}
                                        >
                                            <span className="text-sm text-[hsl(var(--foreground))]">Show timestamps</span>
                                            <div className={`w-9 h-5 rounded-full transition-colors relative ${showTimestamps ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]'}`}>
                                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${showTimestamps ? 'left-4' : 'left-0.5'}`} />
                                            </div>
                                        </div>

                                        {/* Stream Responses */}
                                        <div
                                            className="flex items-center justify-between p-2 rounded-lg hover:bg-[hsl(var(--muted))]/50 cursor-pointer"
                                            onClick={() => setStreamResponses(!streamResponses)}
                                        >
                                            <span className="text-sm text-[hsl(var(--foreground))]">Stream responses</span>
                                            <div className={`w-9 h-5 rounded-full transition-colors relative ${streamResponses ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]'}`}>
                                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${streamResponses ? 'left-4' : 'left-0.5'}`} />
                                            </div>
                                        </div>

                                        {/* Sound Notifications */}
                                        <div
                                            className="flex items-center justify-between p-2 rounded-lg hover:bg-[hsl(var(--muted))]/50 cursor-pointer"
                                            onClick={() => setSoundEnabled(!soundEnabled)}
                                        >
                                            <span className="text-sm text-[hsl(var(--foreground))]">Sound notifications</span>
                                            <div className={`w-9 h-5 rounded-full transition-colors relative ${soundEnabled ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]'}`}>
                                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${soundEnabled ? 'left-4' : 'left-0.5'}`} />
                                            </div>
                                        </div>

                                        <div className="border-t border-[hsl(var(--border))]/50 my-2" />

                                        {/* Keyboard Shortcuts */}
                                        <button
                                            onClick={() => {
                                                setShowKeyboardShortcuts(true);
                                                setShowSettings(false);
                                            }}
                                            className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[hsl(var(--muted))]/50 text-left"
                                        >
                                            <span className="text-sm text-[hsl(var(--foreground))]">Keyboard shortcuts</span>
                                            <kbd className="px-1.5 py-0.5 bg-[hsl(var(--muted))] rounded text-xs text-[hsl(var(--muted-foreground))]">⌘K</kbd>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Git Panel - Slide-in from right */}
                {showGitPanel && activeSessionId && (
                    <div className="absolute right-0 top-14 bottom-0 w-80 bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] shadow-xl z-40 flex flex-col">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]/50">
                            <div className="flex items-center gap-2">
                                <GitBranch size={16} className="text-[hsl(var(--primary))]" />
                                <span className="text-sm font-medium text-[hsl(var(--foreground))]">Version History</span>
                            </div>
                            <button
                                onClick={() => setShowCheckpointModal(true)}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-[hsl(var(--primary))] text-white rounded-lg hover:opacity-90 transition-opacity"
                            >
                                <Plus size={12} />
                                Save
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-[hsl(var(--border))]/50">
                            <button
                                onClick={() => setGitPanelTab('checkpoints')}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm transition-colors ${gitPanelTab === 'checkpoints'
                                    ? 'text-[hsl(var(--foreground))] border-b-2 border-[hsl(var(--primary))]'
                                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                                    }`}
                            >
                                <Bookmark size={14} />
                                Checkpoints
                            </button>
                            <button
                                onClick={() => setGitPanelTab('commits')}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm transition-colors ${gitPanelTab === 'commits'
                                    ? 'text-[hsl(var(--foreground))] border-b-2 border-[hsl(var(--primary))]'
                                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                                    }`}
                            >
                                <GitCommitIcon size={14} />
                                Commits
                            </button>
                        </div>

                        {/* Panel Content */}
                        <div className="flex-1 overflow-y-auto">
                            {gitPanelTab === 'checkpoints' && (
                                <div className="p-2">
                                    {checkpoints.length === 0 ? (
                                        <div className="p-6 text-center">
                                            <Bookmark size={24} className="mx-auto mb-2 text-[hsl(var(--muted-foreground))]/50" />
                                            <p className="text-sm text-[hsl(var(--muted-foreground))]">No checkpoints yet</p>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))]/70 mt-1">Save important points in your conversation</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            {checkpoints.map((cp) => (
                                                <div key={cp.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-[hsl(var(--muted))]/50 cursor-pointer transition-colors">
                                                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                                                        <Bookmark size={14} className="text-purple-500" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-sm font-medium text-[hsl(var(--foreground))] block truncate">{cp.name}</span>
                                                        {cp.description && (
                                                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">{cp.description}</p>
                                                        )}
                                                        <span className="text-xs text-[hsl(var(--muted-foreground))]/70 mt-1 block">
                                                            {formatTime(cp.createdAt)}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {gitPanelTab === 'commits' && (
                                <div className="p-2">
                                    {commits.length === 0 ? (
                                        <div className="p-6 text-center">
                                            <GitCommitIcon size={24} className="mx-auto mb-2 text-[hsl(var(--muted-foreground))]/50" />
                                            <p className="text-sm text-[hsl(var(--muted-foreground))]">No linked commits</p>
                                            <p className="text-xs text-[hsl(var(--muted-foreground))]/70 mt-1">Git commits linked to this chat will appear here</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            {commits.map((commit) => (
                                                <div key={commit.hash} className="flex items-start gap-3 p-3 rounded-lg hover:bg-[hsl(var(--muted))]/50 cursor-pointer transition-colors">
                                                    <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${commit.messageId ? 'bg-green-500' : 'bg-[hsl(var(--muted-foreground))]/30'}`} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <code className="text-xs font-mono text-[hsl(var(--primary))]">{commit.shortHash}</code>
                                                            <span className="text-sm text-[hsl(var(--foreground))] truncate">{commit.message}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-xs text-[hsl(var(--muted-foreground))]">{commit.author}</span>
                                                            <span className="text-xs text-[hsl(var(--muted-foreground))]/70">
                                                                {formatTime(commit.timestamp)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-3xl mx-auto px-4 py-6">
                        {activeMessages.map(message => {
                            const msgProvider = providers.find(p => p.id === activeSessionData?.provider);
                            const isUser = message.role === 'user';
                            return (
                                <div
                                    key={message.id}
                                    className={`group flex gap-4 py-6 ${isUser ? '' : ''}`}
                                >
                                    {/* Avatar */}
                                    <div className="flex-shrink-0">
                                        {isUser ? (
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                                <User size={16} className="text-white" />
                                            </div>
                                        ) : (
                                            <div
                                                className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                                                style={{ backgroundColor: (msgProvider?.color ?? '#10a37f') + '15' }}
                                            >
                                                {msgProvider?.icon || <Bot size={18} style={{ color: msgProvider?.color ?? '#10a37f' }} />}
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
                                                {isUser ? 'You' : (msgProvider?.name || 'Assistant')}
                                            </span>
                                            {showTimestamps && (
                                                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                                    {formatTime(message.createdAt)}
                                                </span>
                                            )}
                                        </div>
                                        <div
                                            className="text-[hsl(var(--foreground))] leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                                            style={{ fontSize: `${fontSize}px` }}
                                        >
                                            {renderMessage(message.content)}
                                        </div>

                                        {/* Message Actions - Show on hover */}
                                        {!isUser && (
                                            <div className="flex items-center gap-1 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => copyToClipboard(message.content, message.id)}
                                                    className="p-1.5 rounded-md hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                                                    title="Copy"
                                                >
                                                    {copiedId === message.id ? <Check size={14} /> : <Copy size={14} />}
                                                </button>
                                                <button
                                                    className="p-1.5 rounded-md hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                                                    title="Regenerate"
                                                >
                                                    <RefreshCw size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Streaming message */}
                        {chatStream.isStreaming && chatStream.content && (
                            <div className="flex gap-4 py-6">
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                                    style={{ backgroundColor: (selectedProvider?.color ?? '#10a37f') + '15' }}
                                >
                                    {selectedProvider?.icon || <Bot size={18} style={{ color: selectedProvider?.color ?? '#10a37f' }} />}
                                </div>
                                <div className="flex-1 min-w-0 space-y-2">
                                    <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
                                        {selectedProvider?.name || 'Assistant'}
                                    </span>
                                    <div
                                        className="text-[hsl(var(--foreground))] leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                                        style={{ fontSize: `${fontSize}px` }}
                                    >
                                        {renderMessage(chatStream.content)}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Loading indicator */}
                        {chatStream.isStreaming && !chatStream.content && (
                            <div className="flex gap-4 py-6">
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                                    style={{ backgroundColor: (selectedProvider?.color ?? '#10a37f') + '15' }}
                                >
                                    {selectedProvider?.icon || <Bot size={18} style={{ color: selectedProvider?.color ?? '#10a37f' }} />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-1 py-3">
                                        <div className="w-2 h-2 bg-[hsl(var(--muted-foreground))]/50 rounded-full animate-bounce" />
                                        <div className="w-2 h-2 bg-[hsl(var(--muted-foreground))]/50 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                                        <div className="w-2 h-2 bg-[hsl(var(--muted-foreground))]/50 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Empty state - Modern Welcome Screen */}
                        {!activeSessionId && !chatStream.isStreaming && activeMessages.length === 0 && (
                            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(var(--primary))]/20 to-purple-500/20 flex items-center justify-center mb-6">
                                    <Bot size={32} className="text-[hsl(var(--primary))]" />
                                </div>
                                <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))] mb-2">
                                    How can I help you today?
                                </h1>
                                <p className="text-[hsl(var(--muted-foreground))] mb-8 max-w-md">
                                    Ask me anything about coding, debugging, or software development. I'm here to help.
                                </p>

                                {/* Suggestion Cards */}
                                <div className="grid grid-cols-2 gap-3 max-w-xl w-full">
                                    {suggestions.map((suggestion, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setInput(suggestion.prompt)}
                                            className="flex items-start gap-3 p-4 rounded-xl border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/50 hover:border-[hsl(var(--border))]/80 transition-all text-left group"
                                        >
                                            <span className="text-xl">{suggestion.icon}</span>
                                            <span className="text-sm text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--foreground))]">
                                                {suggestion.text}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Input Area - Modern Floating Design */}
                <div className="border-t border-[hsl(var(--border))]/50 bg-gradient-to-t from-[hsl(var(--background))] to-transparent pt-4 pb-6">
                    <div className="max-w-3xl mx-auto px-4">
                        <div className="relative bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-lg overflow-hidden">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={`Message ${selectedProvider?.name ?? 'AI'}...`}
                                className="w-full px-4 py-4 pr-32 bg-transparent resize-none text-[hsl(var(--foreground))] placeholder-[hsl(var(--muted-foreground))] focus:outline-none"
                                rows={1}
                                style={{ minHeight: '56px', maxHeight: '200px' }}
                            />
                            <div className="absolute right-2 bottom-2 flex items-center gap-1">
                                <button
                                    className="p-2.5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]/50 rounded-lg transition-colors"
                                    title="Attach file"
                                >
                                    <Paperclip size={18} />
                                </button>
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim() || chatStream.isStreaming}
                                    className={`p-2.5 rounded-lg transition-all ${input.trim() && !chatStream.isStreaming
                                        ? 'bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]/90'
                                        : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] cursor-not-allowed'
                                        }`}
                                >
                                    {chatStream.isStreaming ? <StopCircle size={18} /> : <Send size={18} />}
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-center text-[hsl(var(--muted-foreground))] mt-3">
                            {selectedProvider?.name || 'AI'} can make mistakes. Consider checking important information.
                        </p>
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
