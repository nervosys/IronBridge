// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

import { useState, useEffect, useCallback, startTransition } from 'react';
import {
    FolderOpen,
    Plus,
    Trash2,
    X,
    Search,
    Settings,
    Brain,
    BookOpen,
    GitBranch,
    FileText,
    Edit2,
    Copy,
    Check,
    Lightbulb,
    AlertCircle,
    Info,
    Loader2,
    Folder,
    Code,
    Zap,
} from 'lucide-react';
import type {
    SweProject,
    SweMemory,
    SweRule,
    SweMemoryCategory,
    SweRuleCategory,
    SweImportance,
    CreateSweMemoryRequest,
    CreateSweRuleRequest,
    SweContextInjection,
} from '@ironbridge/shared';

import { config } from '../config';

/*
 * The server mounts everything under `/api`. There is no `/api/v1` and there
 * never was -- `grep -r 'scope("/api/v1"' finds nothing -- so every request
 * this page made answered 404, and `fetchApi` turned each one into an empty
 * list. The page has therefore always looked like a working SWE workspace
 * with no projects in it.
 *
 * Probed against a running server: `/api/v1/swe/projects` 404,
 * `/api/swe/projects` 200.
 */
const API_BASE = `${config.apiBaseUrl}/api`;

// Memory category display info
const MEMORY_CATEGORIES: { value: SweMemoryCategory; label: string; icon: typeof Brain; color: string }[] = [
    { value: 'fact', label: 'Fact', icon: Lightbulb, color: 'text-yellow-400' },
    { value: 'decision', label: 'Decision', icon: Zap, color: 'text-purple-400' },
    { value: 'pattern', label: 'Pattern', icon: Code, color: 'text-blue-400' },
    { value: 'dependency', label: 'Dependency', icon: Folder, color: 'text-green-400' },
    { value: 'architecture', label: 'Architecture', icon: GitBranch, color: 'text-cyan-400' },
    { value: 'bug', label: 'Bug', icon: AlertCircle, color: 'text-red-400' },
    { value: 'todo', label: 'Todo', icon: Check, color: 'text-orange-400' },
    { value: 'context', label: 'Context', icon: Info, color: 'text-gray-400' },
    { value: 'preference', label: 'Preference', icon: Settings, color: 'text-pink-400' },
    { value: 'custom', label: 'Custom', icon: FileText, color: 'text-slate-400' },
];

// Rule category display info
const RULE_CATEGORIES: { value: SweRuleCategory; label: string; color: string }[] = [
    { value: 'constraint', label: 'Constraint (Never...)', color: 'text-red-400' },
    { value: 'requirement', label: 'Requirement (Always...)', color: 'text-green-400' },
    { value: 'style', label: 'Code Style', color: 'text-blue-400' },
    { value: 'architecture', label: 'Architecture', color: 'text-purple-400' },
    { value: 'security', label: 'Security', color: 'text-yellow-400' },
    { value: 'testing', label: 'Testing', color: 'text-cyan-400' },
    { value: 'documentation', label: 'Documentation', color: 'text-orange-400' },
    { value: 'custom', label: 'Custom', color: 'text-slate-400' },
];

const IMPORTANCE_OPTIONS: { value: SweImportance; label: string; color: string }[] = [
    { value: 'critical', label: 'Critical', color: 'text-red-500' },
    { value: 'high', label: 'High', color: 'text-orange-400' },
    { value: 'medium', label: 'Medium', color: 'text-yellow-400' },
    { value: 'low', label: 'Low', color: 'text-gray-400' },
];

interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * Throws on failure with what the server said, or the status line when it said
 * nothing usable.
 *
 * This used to catch everything, log to the console and return `null`, which
 * every caller then read as "no data". A 404, a dead server and an empty
 * project list were indistinguishable on screen -- and for as long as the base
 * URL carried `/v1`, the first of those was what was really happening.
 */
async function fetchApi<T>(path: string, options?: RequestInit): Promise<T | null> {
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });

    let result: ApiResponse<T> | null = null;
    try {
        result = await response.json();
    } catch {
        // Not JSON -- a proxy's error page, say. The status is all we have.
        result = null;
    }

    if (!response.ok || !result?.success) {
        throw new Error(
            result?.error?.trim() ||
                `IronBridge answered ${response.status} ${response.statusText || ''}`.trim()
        );
    }

    return result.data ?? null;
}

// Helper functions to format context injection data
function formatRulesText(rules: SweRule[]): string {
    if (!rules || rules.length === 0) return '';
    return rules.map(r => `[${r.category}] ${r.rule}${r.description ? ` - ${r.description}` : ''}`).join('\n');
}

function formatMemoryText(memory: SweMemory[]): string {
    if (!memory || memory.length === 0) return '';
    return memory.map(m => `[${m.category}] ${m.key}: ${m.value}`).join('\n');
}

function formatFullContextText(ctx: SweContextInjection): string {
    const parts: string[] = [];
    if (ctx.systemPrompt) parts.push(`=== System Prompt ===\n${ctx.systemPrompt}`);
    if (ctx.rules?.length) parts.push(`=== Rules ===\n${formatRulesText(ctx.rules)}`);
    if (ctx.memory?.length) parts.push(`=== Memory ===\n${formatMemoryText(ctx.memory)}`);
    if (ctx.recentFiles?.length) parts.push(`=== Recent Files ===\n${ctx.recentFiles.join('\n')}`);
    if (ctx.customContext) parts.push(`=== Custom Context ===\n${ctx.customContext}`);
    return parts.join('\n\n');
}

export default function SWE() {
    // Project state
    const [projects, setProjects] = useState<SweProject[]>([]);
    const [selectedProject, setSelectedProject] = useState<SweProject | null>(null);
    const [showNewProjectModal, setShowNewProjectModal] = useState(false);
    const [newProjectPath, setNewProjectPath] = useState('');
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectDescription, setNewProjectDescription] = useState('');
    const [isLoadingProjects, setIsLoadingProjects] = useState(true);

    // Memory state
    const [memories, setMemories] = useState<SweMemory[]>([]);
    const [showMemoryModal, setShowMemoryModal] = useState(false);
    const [editingMemory, setEditingMemory] = useState<SweMemory | null>(null);
    const [memoryForm, setMemoryForm] = useState<CreateSweMemoryRequest>({
        key: '',
        value: '',
        category: 'fact',
        importance: 'medium',
    });
    const [memorySearch, setMemorySearch] = useState('');
    const [memoryFilter, setMemoryFilter] = useState<SweMemoryCategory | 'all'>('all');

    // Rules state
    const [rules, setRules] = useState<SweRule[]>([]);
    const [showRuleModal, setShowRuleModal] = useState(false);
    const [editingRule, setEditingRule] = useState<SweRule | null>(null);
    const [ruleForm, setRuleForm] = useState<CreateSweRuleRequest>({
        rule: '',
        description: '',
        category: 'requirement',
        priority: 50,
    });

    // Context injection state
    const [contextInjection, setContextInjection] = useState<SweContextInjection | null>(null);
    const [showContextPreview, setShowContextPreview] = useState(false);

    // UI state
    const [activeTab, setActiveTab] = useState<'memory' | 'rules' | 'context'>('memory');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    /** What went wrong, if anything did. Cleared by the next call that works. */
    const [apiError, setApiError] = useState<string | null>(null);

    /**
     * `fetchApi`, with the failure kept rather than dropped.
     *
     * Callers still get `null` and still render nothing, but the reason now
     * reaches the screen instead of the console.
     */
    const run = useCallback(async <T,>(path: string, options?: RequestInit): Promise<T | null> => {
        try {
            const data = await fetchApi<T>(path, options);
            setApiError(null);
            return data;
        } catch (error) {
            setApiError(error instanceof Error ? error.message : String(error));
            return null;
        }
    }, []);

    const fetchProjects = useCallback(async () => {
        setIsLoadingProjects(true);
        const data = await run<SweProject[]>('/swe/projects');
        if (data) {
            setProjects(data);
            // Auto-select first project
            if (data.length > 0) {
                setSelectedProject(prev => prev ?? data[0]);
            }
        }
        setIsLoadingProjects(false);
        // `run` is stable (useCallback with no deps), so listing it costs a
        // reference and buys the guarantee that it stays stable.
    }, [run]);

    const fetchMemories = useCallback(async (projectId: string) => {
        const data = await run<SweMemory[]>(`/swe/projects/${projectId}/memory`);
        if (data) {
            setMemories(data);
        }
    }, [run]);

    const fetchRules = useCallback(async (projectId: string) => {
        const data = await run<SweRule[]>(`/swe/projects/${projectId}/rules`);
        if (data) {
            setRules(data);
        }
    }, [run]);

    const fetchContext = useCallback(async (projectId: string) => {
        const data = await run<SweContextInjection>(`/swe/projects/${projectId}/context`);
        if (data) {
            setContextInjection(data);
        }
    }, [run]);

    // Fetch projects on mount
    useEffect(() => {
        startTransition(() => {
            fetchProjects();
        });
    }, [fetchProjects]);

    // Fetch memories and rules when project changes
    useEffect(() => {
        if (selectedProject) {
            startTransition(() => {
                fetchMemories(selectedProject.id);
                fetchRules(selectedProject.id);
                fetchContext(selectedProject.id);
            });
        } else {
            startTransition(() => {
                setMemories([]);
                setRules([]);
                setContextInjection(null);
            });
        }
    }, [selectedProject, fetchMemories, fetchRules, fetchContext]);

    const createProject = async () => {
        if (!newProjectPath) return;

        const data = await run<SweProject>('/swe/projects', {
            method: 'POST',
            body: JSON.stringify({
                path: newProjectPath,
                name: newProjectName || undefined,
                description: newProjectDescription || undefined,
            }),
        });

        if (data) {
            setProjects(prev => [data, ...prev]);
            setSelectedProject(data);
            setShowNewProjectModal(false);
            setNewProjectPath('');
            setNewProjectName('');
            setNewProjectDescription('');
        }
    };

    const deleteProject = async (id: string) => {
        const confirmed = window.confirm('Delete this project and all its data?');
        if (!confirmed) return;

        await run(`/swe/projects/${id}`, { method: 'DELETE' });
        setProjects(prev => prev.filter(p => p.id !== id));
        if (selectedProject?.id === id) {
            setSelectedProject(projects.find(p => p.id !== id) || null);
        }
    };

    const createOrUpdateMemory = async () => {
        if (!selectedProject || !memoryForm.key || !memoryForm.value) return;

        if (editingMemory) {
            // Update
            const data = await run<SweMemory>(`/swe/projects/${selectedProject.id}/memory/${editingMemory.id}`, {
                method: 'PUT',
                body: JSON.stringify(memoryForm),
            });
            if (data) {
                setMemories(prev => prev.map(m => m.id === data.id ? data : m));
            }
        } else {
            // Create
            const data = await run<SweMemory>(`/swe/projects/${selectedProject.id}/memory`, {
                method: 'POST',
                body: JSON.stringify(memoryForm),
            });
            if (data) {
                setMemories(prev => [data, ...prev]);
            }
        }

        setShowMemoryModal(false);
        setEditingMemory(null);
        setMemoryForm({ key: '', value: '', category: 'fact', importance: 'medium' });
        // Refresh context
        fetchContext(selectedProject.id);
    };

    const deleteMemory = async (id: string) => {
        if (!selectedProject) return;

        await run(`/swe/projects/${selectedProject.id}/memory/${id}`, { method: 'DELETE' });
        setMemories(prev => prev.filter(m => m.id !== id));
        fetchContext(selectedProject.id);
    };

    const createOrUpdateRule = async () => {
        if (!selectedProject || !ruleForm.rule) return;

        if (editingRule) {
            // Update
            const data = await run<SweRule>(`/swe/projects/${selectedProject.id}/rules/${editingRule.id}`, {
                method: 'PUT',
                body: JSON.stringify(ruleForm),
            });
            if (data) {
                setRules(prev => prev.map(r => r.id === data.id ? data : r));
            }
        } else {
            // Create
            const data = await run<SweRule>(`/swe/projects/${selectedProject.id}/rules`, {
                method: 'POST',
                body: JSON.stringify(ruleForm),
            });
            if (data) {
                setRules(prev => [data, ...prev]);
            }
        }

        setShowRuleModal(false);
        setEditingRule(null);
        setRuleForm({ rule: '', description: '', category: 'requirement', priority: 50 });
        // Refresh context
        fetchContext(selectedProject.id);
    };

    const deleteRule = async (id: string) => {
        if (!selectedProject) return;

        await run(`/swe/projects/${selectedProject.id}/rules/${id}`, { method: 'DELETE' });
        setRules(prev => prev.filter(r => r.id !== id));
        fetchContext(selectedProject.id);
    };

    const toggleRuleEnabled = async (rule: SweRule) => {
        if (!selectedProject) return;

        const data = await run<SweRule>(`/swe/projects/${selectedProject.id}/rules/${rule.id}`, {
            method: 'PUT',
            body: JSON.stringify({ ...rule, enabled: !rule.enabled }),
        });
        if (data) {
            setRules(prev => prev.map(r => r.id === data.id ? data : r));
            fetchContext(selectedProject.id);
        }
    };

    const copyToClipboard = async (text: string, id: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const openEditMemory = (memory: SweMemory) => {
        setEditingMemory(memory);
        setMemoryForm({
            key: memory.key,
            value: memory.value,
            category: memory.category,
            importance: memory.importance,
        });
        setShowMemoryModal(true);
    };

    const openEditRule = (rule: SweRule) => {
        setEditingRule(rule);
        setRuleForm({
            rule: rule.rule,
            description: rule.description || '',
            category: rule.category,
            priority: rule.priority,
        });
        setShowRuleModal(true);
    };

    // Filter memories
    const filteredMemories = memories.filter(m => {
        const matchesSearch = memorySearch === '' ||
            m.key.toLowerCase().includes(memorySearch.toLowerCase()) ||
            m.value.toLowerCase().includes(memorySearch.toLowerCase());
        const matchesCategory = memoryFilter === 'all' || m.category === memoryFilter;
        return matchesSearch && matchesCategory;
    });

    const getCategoryInfo = (category: SweMemoryCategory) => {
        return MEMORY_CATEGORIES.find(c => c.value === category) || MEMORY_CATEGORIES[9];
    };

    const getRuleCategoryInfo = (category: SweRuleCategory) => {
        return RULE_CATEGORIES.find(c => c.value === category) || RULE_CATEGORIES[7];
    };

    return (
        <div className="h-[calc(100vh-4rem)] flex relative">
            {apiError && (
                <div
                    role="alert"
                    className="absolute top-0 left-0 right-0 z-20 flex items-start gap-2 px-4 py-2 bg-red-500/10 border-b border-red-500/40 text-sm text-red-300"
                >
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span className="flex-1">{apiError}</span>
                    <button
                        onClick={() => setApiError(null)}
                        className="text-red-300/70 hover:text-red-200"
                        title="Dismiss"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Left Sidebar - Projects */}
            <div className="w-72 border-r border-border bg-card flex flex-col">
                <div className="p-4 border-b border-border">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="font-semibold flex items-center gap-2">
                            <FolderOpen size={18} />
                            Projects
                        </h2>
                        <button
                            onClick={() => setShowNewProjectModal(true)}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Add Project"
                        >
                            <Plus size={18} />
                        </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        SWE projects with persistent memory
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {isLoadingProjects ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="animate-spin text-muted-foreground" size={24} />
                        </div>
                    ) : projects.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <FolderOpen size={32} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No projects yet</p>
                            <p className="text-xs">Add a project directory to get started</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {projects.map(project => (
                                <div
                                    key={project.id}
                                    className={`group p-3 rounded-lg cursor-pointer transition-colors ${selectedProject?.id === project.id
                                        ? 'bg-primary/10 border border-primary/20'
                                        : 'hover:bg-muted/50'
                                        }`}
                                    onClick={() => setSelectedProject(project)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-medium truncate">{project.name}</h3>
                                            <p className="text-xs text-muted-foreground truncate">{project.path}</p>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteProject(project.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Brain size={12} />
                                            {project.memoryCount}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <BookOpen size={12} />
                                            {project.ruleCount}
                                        </span>
                                        {project.gitBranch && (
                                            <span className="flex items-center gap-1">
                                                <GitBranch size={12} />
                                                {project.gitBranch}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {selectedProject ? (
                    <>
                        {/* Project Header */}
                        <div className="p-4 border-b border-border bg-card">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-xl font-semibold">{selectedProject.name}</h1>
                                    <p className="text-sm text-muted-foreground">{selectedProject.path}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {selectedProject.language && (
                                        <span className="px-2 py-1 rounded-md bg-muted text-xs font-medium">
                                            {selectedProject.language}
                                        </span>
                                    )}
                                    {selectedProject.framework && (
                                        <span className="px-2 py-1 rounded-md bg-muted text-xs font-medium">
                                            {selectedProject.framework}
                                        </span>
                                    )}
                                    <button
                                        onClick={() => setShowContextPreview(true)}
                                        className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                                    >
                                        <Zap size={14} />
                                        View Context
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="border-b border-border bg-card">
                            <div className="flex">
                                <button
                                    onClick={() => setActiveTab('memory')}
                                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'memory'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    <Brain size={16} className="inline mr-2" />
                                    Memory ({memories.length})
                                </button>
                                <button
                                    onClick={() => setActiveTab('rules')}
                                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'rules'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    <BookOpen size={16} className="inline mr-2" />
                                    Rules ({rules.length})
                                </button>
                                <button
                                    onClick={() => setActiveTab('context')}
                                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'context'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    <Zap size={16} className="inline mr-2" />
                                    Context Injection
                                </button>
                            </div>
                        </div>

                        {/* Tab Content */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {activeTab === 'memory' && (
                                <div className="space-y-4">
                                    {/* Memory Header */}
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                            <input
                                                type="text"
                                                placeholder="Search memories..."
                                                value={memorySearch}
                                                onChange={(e) => setMemorySearch(e.target.value)}
                                                className="w-full pl-9 pr-4 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                            />
                                        </div>
                                        <select
                                            value={memoryFilter}
                                            onChange={(e) => setMemoryFilter(e.target.value as SweMemoryCategory | 'all')}
                                            className="px-3 py-2 rounded-md border border-border bg-background text-sm"
                                        >
                                            <option value="all">All Categories</option>
                                            {MEMORY_CATEGORIES.map(cat => (
                                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => {
                                                setEditingMemory(null);
                                                setMemoryForm({ key: '', value: '', category: 'fact', importance: 'medium' });
                                                setShowMemoryModal(true);
                                            }}
                                            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                                        >
                                            <Plus size={16} />
                                            Add Memory
                                        </button>
                                    </div>

                                    {/* Memory List */}
                                    {filteredMemories.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground">
                                            <Brain size={48} className="mx-auto mb-3 opacity-50" />
                                            <p>No memories found</p>
                                            <p className="text-sm">Add facts, decisions, and context about your project</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {filteredMemories.map(memory => {
                                                const catInfo = getCategoryInfo(memory.category);
                                                const CatIcon = catInfo.icon;
                                                return (
                                                    <div
                                                        key={memory.id}
                                                        className="p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors group"
                                                    >
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <CatIcon size={14} className={catInfo.color} />
                                                                    <span className={`text-xs font-medium ${catInfo.color}`}>
                                                                        {catInfo.label}
                                                                    </span>
                                                                    <span className={`text-xs ${IMPORTANCE_OPTIONS.find(i => i.value === memory.importance)?.color}`}>
                                                                        • {memory.importance}
                                                                    </span>
                                                                </div>
                                                                <h4 className="font-mono text-sm font-medium text-primary mb-1">{memory.key}</h4>
                                                                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{memory.value}</p>
                                                            </div>
                                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => copyToClipboard(memory.value, memory.id)}
                                                                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                                                    title="Copy value"
                                                                >
                                                                    {copiedId === memory.id ? <Check size={14} /> : <Copy size={14} />}
                                                                </button>
                                                                <button
                                                                    onClick={() => openEditMemory(memory)}
                                                                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                                                    title="Edit"
                                                                >
                                                                    <Edit2 size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => deleteMemory(memory.id)}
                                                                    className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'rules' && (
                                <div className="space-y-4">
                                    {/* Rules Header */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-lg font-medium">Project Rules</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Define constraints and requirements that are always injected into context
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setEditingRule(null);
                                                setRuleForm({ rule: '', description: '', category: 'requirement', priority: 50 });
                                                setShowRuleModal(true);
                                            }}
                                            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                                        >
                                            <Plus size={16} />
                                            Add Rule
                                        </button>
                                    </div>

                                    {/* Rules List */}
                                    {rules.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground">
                                            <BookOpen size={48} className="mx-auto mb-3 opacity-50" />
                                            <p>No rules defined</p>
                                            <p className="text-sm">Add "never do X" or "always do Y" rules</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {rules.sort((a, b) => b.priority - a.priority).map(rule => {
                                                const catInfo = getRuleCategoryInfo(rule.category);
                                                return (
                                                    <div
                                                        key={rule.id}
                                                        className={`p-4 rounded-lg border bg-card group transition-all ${rule.enabled
                                                            ? 'border-border hover:border-primary/30'
                                                            : 'border-border/50 opacity-60'
                                                            }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-muted ${catInfo.color}`}>
                                                                        {catInfo.label}
                                                                    </span>
                                                                    <span className="text-xs text-muted-foreground">
                                                                        Priority: {rule.priority}
                                                                    </span>
                                                                </div>
                                                                <p className="text-sm font-medium mb-1">{rule.rule}</p>
                                                                {rule.description && (
                                                                    <p className="text-xs text-muted-foreground">{rule.description}</p>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => toggleRuleEnabled(rule)}
                                                                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${rule.enabled
                                                                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                                                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                                                        }`}
                                                                >
                                                                    {rule.enabled ? 'Active' : 'Disabled'}
                                                                </button>
                                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button
                                                                        onClick={() => openEditRule(rule)}
                                                                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                                                        title="Edit"
                                                                    >
                                                                        <Edit2 size={14} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => deleteRule(rule.id)}
                                                                        className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'context' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-lg font-medium mb-2">Context Injection Preview</h3>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            This is the context that will be automatically injected into every AI conversation for this project.
                                        </p>
                                    </div>

                                    {contextInjection ? (
                                        <div className="space-y-6">
                                            {/* Rules Section */}
                                            <div>
                                                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                                    <BookOpen size={14} />
                                                    Active Rules ({contextInjection.rules?.length || 0})
                                                </h4>
                                                {contextInjection.rules && contextInjection.rules.length > 0 ? (
                                                    <div className="p-4 rounded-lg bg-muted/50 border border-border">
                                                        <pre className="text-sm font-mono whitespace-pre-wrap text-foreground/80">
                                                            {formatRulesText(contextInjection.rules)}
                                                        </pre>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-muted-foreground">No active rules</p>
                                                )}
                                            </div>

                                            {/* Memory Section */}
                                            <div>
                                                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                                    <Brain size={14} />
                                                    Relevant Memory ({contextInjection.memory?.length || 0})
                                                </h4>
                                                {contextInjection.memory && contextInjection.memory.length > 0 ? (
                                                    <div className="p-4 rounded-lg bg-muted/50 border border-border">
                                                        <pre className="text-sm font-mono whitespace-pre-wrap text-foreground/80">
                                                            {formatMemoryText(contextInjection.memory)}
                                                        </pre>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-muted-foreground">No relevant memory</p>
                                                )}
                                            </div>

                                            {/* Full Injection Preview */}
                                            <div>
                                                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                                    <Zap size={14} />
                                                    Full System Prompt Addition
                                                </h4>
                                                <div className="p-4 rounded-lg bg-card border border-primary/30">
                                                    <pre className="text-sm font-mono whitespace-pre-wrap text-foreground">
                                                        {formatFullContextText(contextInjection) || 'No context to inject'}
                                                    </pre>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    Token estimate: ~{Math.round((formatFullContextText(contextInjection)?.length || 0) / 4)} tokens
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-muted-foreground">
                                            <Zap size={48} className="mx-auto mb-3 opacity-50" />
                                            <p>No context available</p>
                                            <p className="text-sm">Add rules and memory to build your context</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                            <FolderOpen size={64} className="mx-auto mb-4 opacity-50" />
                            <h2 className="text-xl font-medium mb-2">No Project Selected</h2>
                            <p className="mb-4">Select a project from the sidebar or create a new one</p>
                            <button
                                onClick={() => setShowNewProjectModal(true)}
                                className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
                            >
                                <Plus size={18} />
                                Create Project
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* New Project Modal */}
            {showNewProjectModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-card rounded-lg border border-border shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="font-semibold">New SWE Project</h3>
                            <button
                                onClick={() => setShowNewProjectModal(false)}
                                className="p-1 rounded hover:bg-muted"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Project Path *</label>
                                <input
                                    type="text"
                                    value={newProjectPath}
                                    onChange={(e) => setNewProjectPath(e.target.value)}
                                    placeholder="/path/to/project"
                                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Full path to your project directory
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Name</label>
                                <input
                                    type="text"
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    placeholder="My Project"
                                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Description</label>
                                <textarea
                                    value={newProjectDescription}
                                    onChange={(e) => setNewProjectDescription(e.target.value)}
                                    placeholder="Brief description of the project..."
                                    rows={3}
                                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t border-border">
                            <button
                                onClick={() => setShowNewProjectModal(false)}
                                className="px-4 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createProject}
                                disabled={!newProjectPath}
                                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Create Project
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Memory Modal */}
            {showMemoryModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-card rounded-lg border border-border shadow-xl w-full max-w-lg">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="font-semibold">{editingMemory ? 'Edit Memory' : 'Add Memory'}</h3>
                            <button
                                onClick={() => {
                                    setShowMemoryModal(false);
                                    setEditingMemory(null);
                                }}
                                className="p-1 rounded hover:bg-muted"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Key *</label>
                                <input
                                    type="text"
                                    value={memoryForm.key}
                                    onChange={(e) => setMemoryForm(prev => ({ ...prev, key: e.target.value }))}
                                    placeholder="e.g., database_choice, api_pattern"
                                    className="w-full px-3 py-2 rounded-md border border-border bg-background font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Value *</label>
                                <textarea
                                    value={memoryForm.value}
                                    onChange={(e) => setMemoryForm(prev => ({ ...prev, value: e.target.value }))}
                                    placeholder="The value or fact to remember..."
                                    rows={4}
                                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Category</label>
                                    <select
                                        value={memoryForm.category}
                                        onChange={(e) => setMemoryForm(prev => ({ ...prev, category: e.target.value as SweMemoryCategory }))}
                                        className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                                    >
                                        {MEMORY_CATEGORIES.map(cat => (
                                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Importance</label>
                                    <select
                                        value={memoryForm.importance}
                                        onChange={(e) => setMemoryForm(prev => ({ ...prev, importance: e.target.value as SweImportance }))}
                                        className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                                    >
                                        {IMPORTANCE_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t border-border">
                            <button
                                onClick={() => {
                                    setShowMemoryModal(false);
                                    setEditingMemory(null);
                                }}
                                className="px-4 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createOrUpdateMemory}
                                disabled={!memoryForm.key || !memoryForm.value}
                                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {editingMemory ? 'Update' : 'Add'} Memory
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rule Modal */}
            {showRuleModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-card rounded-lg border border-border shadow-xl w-full max-w-lg">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="font-semibold">{editingRule ? 'Edit Rule' : 'Add Rule'}</h3>
                            <button
                                onClick={() => {
                                    setShowRuleModal(false);
                                    setEditingRule(null);
                                }}
                                className="p-1 rounded hover:bg-muted"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Rule *</label>
                                <textarea
                                    value={ruleForm.rule}
                                    onChange={(e) => setRuleForm(prev => ({ ...prev, rule: e.target.value }))}
                                    placeholder='e.g., "Never use var in JavaScript" or "Always add error handling to async functions"'
                                    rows={3}
                                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Description</label>
                                <input
                                    type="text"
                                    value={ruleForm.description || ''}
                                    onChange={(e) => setRuleForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Brief explanation of why this rule exists..."
                                    className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Category</label>
                                    <select
                                        value={ruleForm.category}
                                        onChange={(e) => setRuleForm(prev => ({ ...prev, category: e.target.value as SweRuleCategory }))}
                                        className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                                    >
                                        {RULE_CATEGORIES.map(cat => (
                                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Priority (0-100)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={ruleForm.priority}
                                        onChange={(e) => setRuleForm(prev => ({ ...prev, priority: parseInt(e.target.value) || 50 }))}
                                        className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">Higher priority rules appear first</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t border-border">
                            <button
                                onClick={() => {
                                    setShowRuleModal(false);
                                    setEditingRule(null);
                                }}
                                className="px-4 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createOrUpdateRule}
                                disabled={!ruleForm.rule}
                                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {editingRule ? 'Update' : 'Add'} Rule
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Context Preview Modal */}
            {showContextPreview && contextInjection && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-card rounded-lg border border-border shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Zap size={18} className="text-primary" />
                                Context Injection Preview
                            </h3>
                            <button
                                onClick={() => setShowContextPreview(false)}
                                className="p-1 rounded hover:bg-muted"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="bg-muted/50 rounded-lg p-4 border border-border">
                                <pre className="text-sm font-mono whitespace-pre-wrap text-foreground">
                                    {formatFullContextText(contextInjection) || 'No context to inject'}
                                </pre>
                            </div>
                        </div>
                        <div className="p-4 border-t border-border flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                Estimated tokens: ~{Math.round((formatFullContextText(contextInjection)?.length || 0) / 4)}
                            </p>
                            <button
                                onClick={() => {
                                    copyToClipboard(formatFullContextText(contextInjection) || '', 'context');
                                    setShowContextPreview(false);
                                }}
                                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                            >
                                <Copy size={14} />
                                Copy to Clipboard
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
