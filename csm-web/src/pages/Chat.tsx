import { useState, useRef, useEffect } from 'react';
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
    GitCommit,
    GitPullRequest,
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
} from 'lucide-react';
import hljs from 'highlight.js';
// Custom syntax theme styles
import '../styles/syntax-themes.css';

// Provider configurations with models
const providers = [
    { id: 'copilot', name: 'GitHub Copilot', icon: '🤖', color: '#0ea5e9', type: 'cloud', models: ['gpt-4o', 'gpt-4o-mini', 'claude-3.5-sonnet', 'o1-preview'] },
    { id: 'openai', name: 'OpenAI', icon: '🧠', color: '#10a37f', type: 'cloud', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini', 'o3-mini'] },
    { id: 'anthropic', name: 'Anthropic', icon: '🔮', color: '#d4a574', type: 'cloud', models: ['claude-4-opus', 'claude-4-sonnet', 'claude-3.5-sonnet', 'claude-3.5-haiku'] },
    { id: 'google', name: 'Google AI', icon: '🌐', color: '#4285f4', type: 'cloud', models: ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
    { id: 'deepseek', name: 'DeepSeek', icon: '🔍', color: '#0066ff', type: 'cloud', models: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'] },
    { id: 'perplexity', name: 'Perplexity', icon: '🎯', color: '#20b2aa', type: 'cloud', models: ['sonar-pro', 'sonar-reasoning-pro', 'sonar'] },
    { id: 'qwen', name: 'Qwen', icon: '🐼', color: '#ff6b35', type: 'cloud', models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-coder'] },
    { id: 'mistral', name: 'Mistral', icon: '💨', color: '#ff7000', type: 'cloud', models: ['mistral-large', 'mistral-medium', 'mistral-small', 'codestral'] },
    { id: 'cohere', name: 'Cohere', icon: '🔗', color: '#d18ee2', type: 'cloud', models: ['command-r-plus', 'command-r', 'command'] },
    { id: 'ollama', name: 'Ollama', icon: '🦙', color: '#ffffff', type: 'local', models: ['llama3.3:70b', 'llama3.2:3b', 'qwen2.5-coder:32b', 'deepseek-r1:32b', 'mistral:7b', 'phi4:14b', 'gemma2:27b'] },
    { id: 'lmstudio', name: 'LM Studio', icon: '🎬', color: '#a855f7', type: 'local', models: ['Loaded Model'] },
    { id: 'jan', name: 'Jan', icon: '🤝', color: '#3b82f6', type: 'local', models: ['llama3.2', 'mistral', 'phi-3'] },
    { id: 'gpt4all', name: 'GPT4All', icon: '🌍', color: '#22c55e', type: 'local', models: ['mistral-7b-instruct', 'llama-3-8b', 'nous-hermes-2'] },
    { id: 'llamafile', name: 'llamafile', icon: '📁', color: '#f59e0b', type: 'local', models: ['Active Model'] },
    { id: 'vllm', name: 'vLLM', icon: '⚡', color: '#0e7490', type: 'local', models: ['llama-3.3-70b', 'qwen2.5-72b', 'mixtral-8x22b'] },
    { id: 'llamacpp', name: 'llama.cpp', icon: '🔧', color: '#22c55e', type: 'local', models: ['Loaded GGUF'] },
    { id: 'localai', name: 'LocalAI', icon: '🏠', color: '#8b5cf6', type: 'local', models: ['gpt-3.5-turbo', 'llama-3-8b', 'phi-3'] },
];

// Syntax themes
const syntaxThemes = [
    { id: 'github-dark', name: 'GitHub Dark' },
    { id: 'monokai', name: 'Monokai' },
    { id: 'nord', name: 'Nord' },
    { id: 'one-dark', name: 'One Dark' },
];

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    provider?: string;
}

interface Session {
    id: string;
    title: string;
    provider: string;
    messages: Message[];
    createdAt: Date;
    updatedAt: Date;
    workspace?: string;
    gitBranch?: string;
}

// Demo sessions
const demoSessions: Session[] = [
    {
        id: '1',
        title: 'React Component Help',
        provider: 'copilot',
        messages: [
            { id: '1', role: 'user', content: 'How do I create a custom hook for fetching data?', timestamp: new Date(Date.now() - 3600000) },
            { id: '2', role: 'assistant', content: 'Here\'s a custom hook for data fetching:\n\n```typescript\nimport { useState, useEffect } from \'react\';\n\nfunction useFetch<T>(url: string) {\n  const [data, setData] = useState<T | null>(null);\n  const [loading, setLoading] = useState(true);\n  const [error, setError] = useState<Error | null>(null);\n\n  useEffect(() => {\n    fetch(url)\n      .then(res => res.json())\n      .then(setData)\n      .catch(setError)\n      .finally(() => setLoading(false));\n  }, [url]);\n\n  return { data, loading, error };\n}\n```\n\nThis hook handles loading states, errors, and returns the fetched data.', timestamp: new Date(Date.now() - 3500000), provider: 'copilot' },
        ],
        createdAt: new Date(Date.now() - 3600000),
        updatedAt: new Date(Date.now() - 3500000),
        workspace: 'my-react-app',
        gitBranch: 'feature/data-hooks',
    },
    {
        id: '2',
        title: 'Python API Design',
        provider: 'anthropic',
        messages: [
            { id: '1', role: 'user', content: 'Design a REST API for a task management system', timestamp: new Date(Date.now() - 7200000) },
            { id: '2', role: 'assistant', content: 'Here\'s a RESTful API design for task management:\n\n```python\nfrom fastapi import FastAPI, HTTPException\nfrom pydantic import BaseModel\nfrom typing import Optional, List\nfrom datetime import datetime\n\napp = FastAPI()\n\nclass Task(BaseModel):\n    id: Optional[int] = None\n    title: str\n    description: Optional[str] = None\n    status: str = "pending"\n    due_date: Optional[datetime] = None\n\n@app.get("/tasks", response_model=List[Task])\nasync def list_tasks():\n    return tasks_db\n\n@app.post("/tasks", response_model=Task)\nasync def create_task(task: Task):\n    task.id = len(tasks_db) + 1\n    tasks_db.append(task)\n    return task\n```', timestamp: new Date(Date.now() - 7100000), provider: 'anthropic' },
        ],
        createdAt: new Date(Date.now() - 7200000),
        updatedAt: new Date(Date.now() - 7100000),
        workspace: 'task-api',
        gitBranch: 'main',
    },
];

export default function Chat() {
    const [sessions, setSessions] = useState<Session[]>(demoSessions);
    const [activeSession, setActiveSession] = useState<Session | null>(demoSessions[0]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState(providers[0]);
    const [selectedModel, setSelectedModel] = useState(providers[0].models[0]);
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
    const settingsRef = useRef<HTMLDivElement>(null);
    const [filterProvider, setFilterProvider] = useState<string | null>(null);
    const [showGitPanel, setShowGitPanel] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [activeSession?.messages]);

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
            // ⌘K or Ctrl+K to show keyboard shortcuts
            if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
                event.preventDefault();
                setShowKeyboardShortcuts(true);
            }
            // Escape to close modals
            if (event.key === 'Escape') {
                setShowKeyboardShortcuts(false);
                setShowSettings(false);
            }
            // ⌘N or Ctrl+N for new chat
            if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
                event.preventDefault();
                newChat();
            }
            // ⌘/ or Ctrl+/ to focus input
            if ((event.metaKey || event.ctrlKey) && event.key === '/') {
                event.preventDefault();
                inputRef.current?.focus();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        };

        if (activeSession) {
            const updatedSession = {
                ...activeSession,
                messages: [...activeSession.messages, userMessage],
                updatedAt: new Date(),
            };
            setActiveSession(updatedSession);
            setSessions(prev => prev.map(s => s.id === activeSession.id ? updatedSession : s));
        } else {
            const newSession: Session = {
                id: Date.now().toString(),
                title: input.slice(0, 50) + (input.length > 50 ? '...' : ''),
                provider: selectedProvider.id,
                messages: [userMessage],
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            setSessions(prev => [newSession, ...prev]);
            setActiveSession(newSession);
        }

        setInput('');
        setIsLoading(true);

        // Simulate AI response
        setTimeout(() => {
            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `This is a simulated response from ${selectedProvider.name}. In a real implementation, this would connect to the actual provider API.\n\n\`\`\`typescript\n// Example code\nconst response = await fetch('/api/chat', {\n  method: 'POST',\n  body: JSON.stringify({ message: '${input.slice(0, 30)}...' })\n});\n\`\`\``,
                timestamp: new Date(),
                provider: selectedProvider.id,
            };

            setActiveSession(prev => {
                if (!prev) return prev;
                const updated = {
                    ...prev,
                    messages: [...prev.messages, assistantMessage],
                    updatedAt: new Date(),
                };
                setSessions(sessions => sessions.map(s => s.id === prev.id ? updated : s));
                return updated;
            });
            setIsLoading(false);
        }, 1500);
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
        setActiveSession(null);
        setInput('');
    };

    const deleteSession = (id: string) => {
        setSessions(prev => prev.filter(s => s.id !== id));
        if (activeSession?.id === id) {
            setActiveSession(sessions.find(s => s.id !== id) || null);
        }
    };

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

    const filteredSessions = filterProvider
        ? sessions.filter(s => s.provider === filterProvider)
        : sessions;

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
                    {filteredSessions.map(session => {
                        const provider = providers.find(p => p.id === session.provider);
                        return (
                            <div
                                key={session.id}
                                onClick={() => setActiveSession(session)}
                                className={`p-3 border-b cursor-pointer hover:bg-[hsl(var(--muted))] transition-colors ${activeSession?.id === session.id ? 'bg-[hsl(var(--muted))]' : ''
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span>{provider?.icon}</span>
                                            <span className="font-medium text-sm text-[hsl(var(--foreground))] truncate">
                                                {session.title}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                                {session.messages.length} messages
                                            </span>
                                            {session.gitBranch && (
                                                <span className="text-xs text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                                                    <GitBranch size={10} />
                                                    {session.gitBranch}
                                                </span>
                                            )}
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
                    })}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
                {/* Chat Header */}
                <div className="h-14 px-4 border-b flex items-center justify-between bg-[hsl(var(--card))]">
                    <div className="flex items-center gap-3">
                        {activeSession?.workspace && (
                            <span className="text-sm text-[hsl(var(--muted-foreground))] flex items-center gap-1">
                                <FileText size={14} />
                                {activeSession.workspace}
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
                                <span>{selectedProvider.icon}</span>
                                <span className="text-sm font-medium text-[hsl(var(--foreground))]">{selectedProvider.name}</span>
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
                                                setSelectedProvider(provider);
                                                setSelectedModel(provider.models[0]);
                                                setShowProviderDropdown(false);
                                            }}
                                            className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-[hsl(var(--muted))] transition-colors ${selectedProvider.id === provider.id ? 'bg-[hsl(var(--muted))]' : ''}`}
                                        >
                                            <span>{provider.icon}</span>
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
                                                setSelectedProvider(provider);
                                                setSelectedModel(provider.models[0]);
                                                setShowProviderDropdown(false);
                                            }}
                                            className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-[hsl(var(--muted))] transition-colors ${selectedProvider.id === provider.id ? 'bg-[hsl(var(--muted))]' : ''}`}
                                        >
                                            <span>{provider.icon}</span>
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
                                <span className="text-sm text-[hsl(var(--foreground))]">{selectedModel}</span>
                                <ChevronDown size={16} className="text-[hsl(var(--muted-foreground))]" />
                            </button>
                            {showModelDropdown && (
                                <div className="absolute top-full left-0 mt-1 w-56 bg-[hsl(var(--card))] border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                                    <div className="p-2 border-b">
                                        <span className="text-xs text-[hsl(var(--muted-foreground))] font-medium">Available Models</span>
                                    </div>
                                    {selectedProvider.models.map(model => (
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
                        <button
                            onClick={() => setShowGitPanel(!showGitPanel)}
                            className={`p-2 rounded-lg transition-colors ${showGitPanel ? 'bg-[hsl(var(--primary))] text-white' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'}`}
                        >
                            <GitBranch size={18} />
                        </button>
                        <div className="relative" ref={settingsRef}>
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-[hsl(var(--primary))] text-white' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'}`}
                            >
                                <Settings size={18} />
                            </button>

                            {/* Settings Popup Menu */}
                            {showSettings && (
                                <div className="absolute right-0 top-full mt-2 w-80 bg-[hsl(var(--card))] border rounded-xl shadow-xl z-50 overflow-hidden">
                                    <div className="flex items-center justify-between p-3 border-b bg-[hsl(var(--muted))]/50">
                                        <span className="font-medium text-[hsl(var(--foreground))]">Chat Settings</span>
                                        <button
                                            onClick={() => setShowSettings(false)}
                                            className="p-1 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                                        >
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
                {showGitPanel && activeSession && (
                    <div className="p-4 bg-[hsl(var(--muted))] border-b">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <GitBranch size={16} className="text-green-500" />
                                <span className="text-sm text-[hsl(var(--foreground))]">{activeSession.gitBranch || 'main'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <GitCommit size={16} className="text-[hsl(var(--muted-foreground))]" />
                                <span className="text-sm text-[hsl(var(--muted-foreground))]">3 commits ahead</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <GitPullRequest size={16} className="text-purple-500" />
                                <span className="text-sm text-[hsl(var(--muted-foreground))]">PR #42 open</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {activeSession?.messages.map(message => {
                        const msgProvider = message.provider ? providers.find(p => p.id === message.provider) : selectedProvider;
                        return (
                            <div
                                key={message.id}
                                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {message.role === 'assistant' && (
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                                        style={{ backgroundColor: msgProvider?.color + '20' }}
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
                                            {message.timestamp.toLocaleTimeString()}
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
                    {isLoading && (
                        <div className="flex gap-3">
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
                                style={{ backgroundColor: selectedProvider.color + '20' }}
                            >
                                {selectedProvider.icon}
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
                    {!activeSession && !isLoading && (
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
                                placeholder={`Message ${selectedProvider.name}...`}
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
                            disabled={!input.trim() || isLoading}
                            className="p-3 bg-[hsl(var(--primary))] text-white rounded-xl hover:bg-[hsl(var(--primary))]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? <StopCircle size={20} /> : <Send size={20} />}
                        </button>
                    </div>
                </div>
            </div>

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
                                <h3 className="text-sm font-medium text-[hsl(var(--muted-foreground))] mb-2">Navigation</h3>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm text-[hsl(var(--foreground))]">Previous session</span>
                                        <kbd className="px-2 py-1 bg-[hsl(var(--muted))] rounded text-xs font-mono">⌘ + ↑</kbd>
                                    </div>
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm text-[hsl(var(--foreground))]">Next session</span>
                                        <kbd className="px-2 py-1 bg-[hsl(var(--muted))] rounded text-xs font-mono">⌘ + ↓</kbd>
                                    </div>
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm text-[hsl(var(--foreground))]">Toggle sidebar</span>
                                        <kbd className="px-2 py-1 bg-[hsl(var(--muted))] rounded text-xs font-mono">⌘ + B</kbd>
                                    </div>
                                </div>
                            </div>
                            <div className="border-t pt-4">
                                <h3 className="text-sm font-medium text-[hsl(var(--muted-foreground))] mb-2">Actions</h3>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm text-[hsl(var(--foreground))]">Copy last response</span>
                                        <kbd className="px-2 py-1 bg-[hsl(var(--muted))] rounded text-xs font-mono">⌘ + Shift + C</kbd>
                                    </div>
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm text-[hsl(var(--foreground))]">Regenerate response</span>
                                        <kbd className="px-2 py-1 bg-[hsl(var(--muted))] rounded text-xs font-mono">⌘ + Shift + R</kbd>
                                    </div>
                                    <div className="flex items-center justify-between py-1">
                                        <span className="text-sm text-[hsl(var(--foreground))]">Open settings</span>
                                        <kbd className="px-2 py-1 bg-[hsl(var(--muted))] rounded text-xs font-mono">⌘ + ,</kbd>
                                    </div>
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
