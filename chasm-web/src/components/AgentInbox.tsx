// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

// =============================================================================
// CSM Web - Agent Inbox Component
// =============================================================================
// Real-time agent workflow tracking, notifications, and permission management

import { useState, useEffect, useMemo } from 'react';
import {
    Inbox,
    Bell,
    Shield,
    Activity,
    Check,
    X,
    Clock,
    AlertCircle,
    CheckCircle2,
    MessageSquare,
    ArrowRightLeft,
    Star,
    StarOff,
    RefreshCw,
    ChevronRight,
    Bot,
    Zap,
    Info,
    ExternalLink,
} from 'lucide-react';
import { formatRelativeTime } from '@csm/shared';
import { config } from '../config/env';

// =============================================================================
// Types
// =============================================================================

type NotificationCategory =
    | 'workflow_progress'
    | 'workflow_complete'
    | 'workflow_error'
    | 'permission_request'
    | 'agent_message'
    | 'task_complete'
    | 'handoff'
    | 'system';

type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

type PermissionType =
    | 'execute_code'
    | 'file_write'
    | 'file_delete'
    | 'api_call'
    | 'web_request'
    | 'database_write'
    | 'send_email'
    | 'shell_command'
    | 'cost_threshold'
    | 'time_extension';

type PermissionStatus = 'pending' | 'approved' | 'denied' | 'expired';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface AgentNotification {
    id: string;
    category: NotificationCategory;
    priority: NotificationPriority;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    agentId?: string;
    agentName?: string;
    runId?: string;
    swarmId?: string;
    read: boolean;
    dismissed: boolean;
    createdAt: number;
    readAt?: number;
}

interface InboxMessage {
    id: string;
    type: 'agent_to_user' | 'agent_to_agent' | 'system' | 'handoff_request' | 'approval_request';
    fromAgentId?: string;
    fromAgentName?: string;
    toAgentId?: string;
    toAgentName?: string;
    subject: string;
    body: string;
    threadId?: string;
    replyToId?: string;
    runId?: string;
    swarmId?: string;
    attachments?: {
        id: string;
        type: 'code' | 'file' | 'image' | 'log' | 'data';
        name: string;
        content?: string;
    }[];
    read: boolean;
    starred: boolean;
    archived: boolean;
    requiresResponse: boolean;
    responseOptions?: string[];
    userResponse?: string;
    createdAt: number;
    respondedAt?: number;
}

interface PermissionRequest {
    id: string;
    type: PermissionType;
    status: PermissionStatus;
    title: string;
    description: string;
    reason: string;
    riskLevel: RiskLevel;
    agentId: string;
    agentName: string;
    runId?: string;
    swarmId?: string;
    resource?: string;
    action?: string;
    scope?: 'once' | 'session' | 'run' | 'always';
    responseNote?: string;
    createdAt: number;
    expiresAt: number;
    respondedAt?: number;
}

interface WorkflowProgress {
    runId: string;
    swarmId?: string;
    name: string;
    status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    currentStep?: string;
    totalSteps?: number;
    completedSteps?: number;
    activeAgents: {
        id: string;
        name: string;
        status: string;
        currentTask?: string;
    }[];
    tokensUsed: number;
    estimatedCost?: number;
    elapsedTime: number;
    estimatedTimeRemaining?: number;
    lastEvent?: string;
    lastEventTime?: number;
    startedAt: number;
    updatedAt: number;
    completedAt?: number;
}

type InboxTab = 'all' | 'messages' | 'permissions' | 'workflows';

// =============================================================================
// Icon & Color Mappings
// =============================================================================

const CATEGORY_CONFIG: Record<NotificationCategory, { icon: typeof Bell; color: string; label: string }> = {
    workflow_progress: { icon: Activity, color: 'text-blue-500', label: 'Progress' },
    workflow_complete: { icon: CheckCircle2, color: 'text-green-500', label: 'Complete' },
    workflow_error: { icon: AlertCircle, color: 'text-red-500', label: 'Error' },
    permission_request: { icon: Shield, color: 'text-amber-500', label: 'Permission' },
    agent_message: { icon: MessageSquare, color: 'text-violet-500', label: 'Message' },
    task_complete: { icon: Check, color: 'text-cyan-500', label: 'Task' },
    handoff: { icon: ArrowRightLeft, color: 'text-pink-500', label: 'Handoff' },
    system: { icon: Info, color: 'text-gray-500', label: 'System' },
};

const RISK_CONFIG: Record<RiskLevel, { color: string; bgColor: string; label: string }> = {
    low: { color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', label: 'Low Risk' },
    medium: { color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30', label: 'Medium Risk' },
    high: { color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', label: 'High Risk' },
    critical: { color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', label: 'Critical' },
};

const STATUS_CONFIG: Record<string, { color: string; bgColor: string }> = {
    running: { color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
    paused: { color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
    completed: { color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
    failed: { color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30' },
    cancelled: { color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-900/30' },
};

// =============================================================================
// Demo Fixtures
//
// There is no live source for any of this yet: the backend exposes no
// notification, inbox-message, permission-request, or workflow-run endpoints,
// and nothing in CSM emits those events. These fixtures exist to exercise the
// UI and are shown ONLY when VITE_ENABLE_DEMO_MODE is set. With demo mode off
// (the default) the inbox renders its real, empty state rather than presenting
// fabricated agent activity as if it were live.
// =============================================================================

const demoNotifications: AgentNotification[] = [
    {
        id: 'notif-1',
        category: 'workflow_complete',
        priority: 'normal',
        title: '✅ Code Review completed',
        body: 'Successfully reviewed 15 files with 3 suggestions',
        agentName: 'Code Reviewer',
        runId: 'run-123',
        read: false,
        dismissed: false,
        createdAt: Date.now() - 5 * 60 * 1000,
    },
    {
        id: 'notif-2',
        category: 'permission_request',
        priority: 'high',
        title: '🔐 API Call Permission Required',
        body: 'Research Agent needs to call external API',
        agentName: 'Research Agent',
        runId: 'run-124',
        read: false,
        dismissed: false,
        createdAt: Date.now() - 15 * 60 * 1000,
    },
    {
        id: 'notif-3',
        category: 'workflow_error',
        priority: 'high',
        title: '❌ Build failed',
        body: 'TypeScript compilation error in src/utils/parser.ts',
        agentName: 'Build Agent',
        runId: 'run-125',
        read: true,
        dismissed: false,
        createdAt: Date.now() - 30 * 60 * 1000,
    },
];

const demoMessages: InboxMessage[] = [
    {
        id: 'msg-1',
        type: 'agent_to_user',
        fromAgentName: 'Coordinator',
        subject: 'Task delegation summary',
        body: 'I have assigned the following tasks to team members:\n\n1. Code analysis - assigned to Coder Agent\n2. Documentation review - assigned to Writer Agent\n3. Test coverage - assigned to Tester Agent\n\nEstimated completion: 2 hours',
        read: false,
        starred: true,
        archived: false,
        requiresResponse: false,
        createdAt: Date.now() - 10 * 60 * 1000,
    },
    {
        id: 'msg-2',
        type: 'approval_request',
        fromAgentName: 'Executor',
        subject: 'Database migration approval',
        body: 'I need to run a database migration that will:\n- Add new columns to users table\n- Create new sessions table\n- Update indexes\n\nThis is a production database change. Please approve or deny.',
        read: false,
        starred: false,
        archived: false,
        requiresResponse: true,
        responseOptions: ['Approve', 'Deny', 'Need more info'],
        createdAt: Date.now() - 45 * 60 * 1000,
    },
];

const demoPermissions: PermissionRequest[] = [
    {
        id: 'perm-1',
        type: 'shell_command',
        status: 'pending',
        title: 'Shell Command Execution',
        description: 'Execute npm install in project directory',
        reason: 'Installing dependencies required for the build process',
        riskLevel: 'medium',
        agentId: 'agent-1',
        agentName: 'Build Agent',
        runId: 'run-126',
        resource: '/project/root',
        action: 'npm install',
        createdAt: Date.now() - 2 * 60 * 1000,
        expiresAt: Date.now() + 3 * 60 * 1000,
    },
    {
        id: 'perm-2',
        type: 'file_write',
        status: 'pending',
        title: 'File Write Permission',
        description: 'Create new configuration file',
        reason: 'Generating optimized webpack configuration based on analysis',
        riskLevel: 'low',
        agentId: 'agent-2',
        agentName: 'Config Agent',
        runId: 'run-127',
        resource: 'webpack.config.js',
        action: 'create',
        createdAt: Date.now() - 5 * 60 * 1000,
        expiresAt: Date.now() + 2 * 60 * 1000,
    },
];

const demoWorkflows: WorkflowProgress[] = [
    {
        runId: 'run-128',
        swarmId: 'swarm-1',
        name: 'Full Stack Analysis',
        status: 'running',
        progress: 67,
        currentStep: 'Analyzing backend API endpoints',
        totalSteps: 6,
        completedSteps: 4,
        activeAgents: [
            { id: 'a1', name: 'Coordinator', status: 'monitoring', currentTask: 'Overseeing analysis' },
            { id: 'a2', name: 'Backend Analyst', status: 'working', currentTask: 'API endpoint analysis' },
            { id: 'a3', name: 'Frontend Analyst', status: 'idle' },
        ],
        tokensUsed: 45230,
        estimatedCost: 0.0892,
        elapsedTime: 12 * 60 * 1000,
        estimatedTimeRemaining: 6 * 60 * 1000,
        lastEvent: 'Started backend analysis phase',
        lastEventTime: Date.now() - 30 * 1000,
        startedAt: Date.now() - 12 * 60 * 1000,
        updatedAt: Date.now(),
    },
    {
        runId: 'run-129',
        name: 'Documentation Generation',
        status: 'paused',
        progress: 35,
        currentStep: 'Waiting for user input on API docs format',
        totalSteps: 10,
        completedSteps: 3,
        activeAgents: [
            { id: 'a4', name: 'Doc Writer', status: 'paused', currentTask: 'Awaiting input' },
        ],
        tokensUsed: 12450,
        estimatedCost: 0.0245,
        elapsedTime: 8 * 60 * 1000,
        lastEvent: 'Paused for user input',
        lastEventTime: Date.now() - 5 * 60 * 1000,
        startedAt: Date.now() - 20 * 60 * 1000,
        updatedAt: Date.now() - 5 * 60 * 1000,
    },
];

// =============================================================================
// Helper Functions
// =============================================================================

function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

// =============================================================================
// Component
// =============================================================================

interface AgentInboxProps {
    onViewRun?: (runId: string) => void;
}

export function AgentInbox({ onViewRun }: AgentInboxProps) {
    const [activeTab, setActiveTab] = useState<InboxTab>('all');
    const demoMode = config.enableDemoMode;
    const [notifications, setNotifications] = useState<AgentNotification[]>(demoMode ? demoNotifications : []);
    const [messages, setMessages] = useState<InboxMessage[]>(demoMode ? demoMessages : []);
    const [permissions, setPermissions] = useState<PermissionRequest[]>(demoMode ? demoPermissions : []);
    const [workflows, setWorkflows] = useState<WorkflowProgress[]>(demoMode ? demoWorkflows : []);
    const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Counts
    const unreadNotifications = useMemo(() => notifications.filter(n => !n.read && !n.dismissed).length, [notifications]);
    const unreadMessages = useMemo(() => messages.filter(m => !m.read && !m.archived).length, [messages]);
    const pendingPermissions = useMemo(() => permissions.filter(p => p.status === 'pending').length, [permissions]);
    const activeWorkflows = useMemo(() => workflows.filter(w => w.status === 'running' || w.status === 'paused').length, [workflows]);

    // Handlers
    const handleMarkNotificationRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true, readAt: Date.now() } : n));
    };

    const handleDismissNotification = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, dismissed: true } : n));
    };

    const handleMarkAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true, readAt: Date.now() })));
    };

    const handleMessageRead = (id: string) => {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m));
    };

    const handleToggleStar = (id: string) => {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, starred: !m.starred } : m));
    };

    const handleRespondToMessage = (id: string, response: string) => {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, userResponse: response, respondedAt: Date.now() } : m));
        setSelectedMessage(null);
    };

    const handlePermissionResponse = (id: string, approved: boolean, scope?: 'once' | 'session' | 'run' | 'always') => {
        setPermissions(prev => prev.map(p =>
            p.id === id ? { ...p, status: approved ? 'approved' : 'denied', respondedAt: Date.now(), scope } : p
        ));
    };

    // No inbox endpoints exist to refetch from yet, so this only spins the
    // indicator. Point it at the real fetch once a backend is available.
    const handleRefresh = async () => {
        setIsRefreshing(true);
        await new Promise(resolve => setTimeout(resolve, 300));
        setIsRefreshing(false);
    };

    // Advance the demo fixtures so the progress UI animates. This fabricates
    // progress and token counts, so it must never run outside demo mode.
    useEffect(() => {
        if (!demoMode) return;
        const interval = setInterval(() => {
            setWorkflows(prev => prev.map(w => {
                if (w.status !== 'running') return w;
                const newProgress = Math.min(100, w.progress + Math.random() * 2);
                const newElapsed = w.elapsedTime + 1000;
                return {
                    ...w,
                    progress: Math.round(newProgress),
                    elapsedTime: newElapsed,
                    tokensUsed: w.tokensUsed + Math.floor(Math.random() * 100),
                    updatedAt: Date.now(),
                    status: newProgress >= 100 ? 'completed' : w.status,
                    completedAt: newProgress >= 100 ? Date.now() : undefined,
                };
            }));
        }, 1000);

        return () => clearInterval(interval);
    }, [demoMode]);

    // Tab badges
    const tabs: { key: InboxTab; label: string; count: number }[] = [
        { key: 'all', label: 'All', count: unreadNotifications },
        { key: 'messages', label: 'Messages', count: unreadMessages },
        { key: 'permissions', label: 'Permissions', count: pendingPermissions },
        { key: 'workflows', label: 'Workflows', count: activeWorkflows },
    ];

    return (
        <div className="flex flex-col h-full bg-[hsl(var(--background))]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
                <div className="flex items-center gap-2">
                    <Inbox className="w-5 h-5 text-violet-500" />
                    <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">Agent Inbox</h2>
                </div>
                <div className="flex items-center gap-2">
                    {unreadNotifications > 0 && (
                        <button
                            onClick={handleMarkAllRead}
                            className="text-sm text-violet-600 dark:text-violet-400 hover:underline"
                        >
                            Mark all read
                        </button>
                    )}
                    <button
                        onClick={handleRefresh}
                        className={`p-2 rounded-lg hover:bg-[hsl(var(--muted))] ${isRefreshing ? 'animate-spin' : ''}`}
                    >
                        <RefreshCw className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[hsl(var(--border))]">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.key
                            ? 'text-violet-600 dark:text-violet-400 border-b-2 border-violet-600 dark:border-violet-400'
                            : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                            }`}
                    >
                        {tab.label}
                        {tab.count > 0 && (
                            <span className={`px-1.5 py-0.5 text-xs font-semibold rounded-full ${activeTab === tab.key
                                ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300'
                                : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
                                }`}>
                                {tab.count > 99 ? '99+' : tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'all' && (
                    <div className="divide-y divide-[hsl(var(--border))]">
                        {notifications.filter(n => !n.dismissed).length === 0 ? (
                            <EmptyState
                                icon={Bell}
                                title="All caught up!"
                                description="No notifications to show"
                            />
                        ) : (
                            notifications
                                .filter(n => !n.dismissed)
                                .map(notification => (
                                    <NotificationItem
                                        key={notification.id}
                                        notification={notification}
                                        onRead={handleMarkNotificationRead}
                                        onDismiss={handleDismissNotification}
                                        onViewRun={onViewRun}
                                    />
                                ))
                        )}
                    </div>
                )}

                {activeTab === 'messages' && (
                    <div className="divide-y divide-[hsl(var(--border))]">
                        {messages.filter(m => !m.archived).length === 0 ? (
                            <EmptyState
                                icon={MessageSquare}
                                title="No messages"
                                description="Agent messages will appear here"
                            />
                        ) : (
                            messages
                                .filter(m => !m.archived)
                                .map(message => (
                                    <MessageItem
                                        key={message.id}
                                        message={message}
                                        onToggleStar={handleToggleStar}
                                        onSelect={() => {
                                            handleMessageRead(message.id);
                                            setSelectedMessage(message);
                                        }}
                                    />
                                ))
                        )}
                    </div>
                )}

                {activeTab === 'permissions' && (
                    <div className="p-4 space-y-4">
                        {permissions.filter(p => p.status === 'pending').length === 0 ? (
                            <EmptyState
                                icon={Shield}
                                title="No pending permissions"
                                description="Permission requests will appear here"
                            />
                        ) : (
                            permissions
                                .filter(p => p.status === 'pending')
                                .map(permission => (
                                    <PermissionCard
                                        key={permission.id}
                                        permission={permission}
                                        onRespond={handlePermissionResponse}
                                    />
                                ))
                        )}
                    </div>
                )}

                {activeTab === 'workflows' && (
                    <div className="p-4 space-y-4">
                        {workflows.length === 0 ? (
                            <EmptyState
                                icon={Activity}
                                title="No active workflows"
                                description="Running workflows will appear here"
                            />
                        ) : (
                            workflows.map(workflow => (
                                <WorkflowCard
                                    key={workflow.runId}
                                    workflow={workflow}
                                    onViewRun={onViewRun}
                                />
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Message Detail Modal */}
            {selectedMessage && (
                <MessageDetailModal
                    message={selectedMessage}
                    onClose={() => setSelectedMessage(null)}
                    onRespond={handleRespondToMessage}
                    onToggleStar={handleToggleStar}
                />
            )}
        </div>
    );
}

// =============================================================================
// Sub-Components
// =============================================================================

function EmptyState({ icon: Icon, title, description }: { icon: typeof Bell; title: string; description: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <Icon className="w-12 h-12 text-[hsl(var(--muted-foreground))]/30 mb-4" />
            <h3 className="text-lg font-medium text-[hsl(var(--muted-foreground))]">{title}</h3>
            <p className="text-sm text-[hsl(var(--muted-foreground))]/70">{description}</p>
        </div>
    );
}

function NotificationItem({
    notification,
    onRead,
    onDismiss,
    onViewRun,
}: {
    notification: AgentNotification;
    onRead: (id: string) => void;
    onDismiss: (id: string) => void;
    onViewRun?: (runId: string) => void;
}) {
    const config = CATEGORY_CONFIG[notification.category];
    const Icon = config.icon;

    return (
        <div
            className={`flex gap-3 px-4 py-3 hover:bg-[hsl(var(--muted))]/50 cursor-pointer transition-colors ${!notification.read ? 'bg-violet-500/5' : ''
                }`}
            onClick={() => {
                onRead(notification.id);
                if (notification.runId && onViewRun) onViewRun(notification.runId);
            }}
        >
            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${notification.read ? 'bg-[hsl(var(--muted))]' : 'bg-violet-500/10'
                }`}>
                <Icon className={`w-5 h-5 ${config.color}`} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <h4 className={`text-sm font-medium truncate ${notification.read ? 'text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--foreground))]'
                        }`}>
                        {notification.title}
                    </h4>
                    <span className="text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                        {formatRelativeTime(notification.createdAt)}
                    </span>
                </div>
                <p className="text-sm text-[hsl(var(--muted-foreground))] line-clamp-2 mt-0.5">
                    {notification.body}
                </p>
                {notification.agentName && (
                    <div className="flex items-center gap-1 mt-1">
                        <Bot className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">{notification.agentName}</span>
                    </div>
                )}
            </div>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDismiss(notification.id);
                }}
                className="flex-shrink-0 p-1 rounded hover:bg-[hsl(var(--muted))]"
            >
                <X className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
            </button>
        </div>
    );
}

function MessageItem({
    message,
    onToggleStar,
    onSelect,
}: {
    message: InboxMessage;
    onToggleStar: (id: string) => void;
    onSelect: () => void;
}) {
    return (
        <div
            className={`flex gap-3 px-4 py-3 hover:bg-[hsl(var(--muted))]/50 cursor-pointer transition-colors ${!message.read ? 'bg-violet-500/5' : ''
                }`}
            onClick={onSelect}
        >
            <div className="flex-shrink-0 pt-1">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar(message.id);
                    }}
                    className="p-1 rounded hover:bg-[hsl(var(--muted))]"
                >
                    {message.starred ? (
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    ) : (
                        <StarOff className="w-4 h-4 text-[hsl(var(--muted-foreground))]/50" />
                    )}
                </button>
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-medium ${message.read ? 'text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--foreground))]'
                        }`}>
                        {message.fromAgentName || 'System'}
                    </span>
                    {message.requiresResponse && !message.userResponse && (
                        <span className="px-1.5 py-0.5 text-xs font-semibold rounded bg-red-500/10 text-red-500">
                            Response Required
                        </span>
                    )}
                    {message.userResponse && (
                        <span className="px-1.5 py-0.5 text-xs font-semibold rounded bg-green-500/10 text-green-500">
                            Responded
                        </span>
                    )}
                    <span className="text-xs text-[hsl(var(--muted-foreground))] ml-auto">
                        {formatRelativeTime(message.createdAt)}
                    </span>
                </div>
                <h4 className={`text-sm truncate ${message.read ? 'text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--foreground))] font-medium'
                    }`}>
                    {message.subject}
                </h4>
                <p className="text-sm text-[hsl(var(--muted-foreground))] line-clamp-1 mt-0.5">
                    {message.body}
                </p>
            </div>
            <ChevronRight className="w-4 h-4 text-[hsl(var(--muted-foreground))] self-center" />
        </div>
    );
}

function PermissionCard({
    permission,
    onRespond,
}: {
    permission: PermissionRequest;
    onRespond: (id: string, approved: boolean, scope?: 'once' | 'session' | 'run' | 'always') => void;
}) {
    const riskConfig = RISK_CONFIG[permission.riskLevel];
    const [expiresIn, setExpiresIn] = useState(() =>
        Math.max(0, Math.floor((permission.expiresAt - Date.now()) / 1000))
    );
    const expiresMinutes = Math.floor(expiresIn / 60);
    const expiresSeconds = expiresIn % 60;

    // Update countdown every second
    useEffect(() => {
        const interval = setInterval(() => {
            setExpiresIn(Math.max(0, Math.floor((permission.expiresAt - Date.now()) / 1000)));
        }, 1000);
        return () => clearInterval(interval);
    }, [permission.expiresAt]);

    return (
        <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
                <div className="flex items-center gap-2">
                    <div className={`px-2 py-1 rounded-md text-xs font-semibold ${riskConfig.bgColor} ${riskConfig.color}`}>
                        {permission.riskLevel.toUpperCase()}
                    </div>
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">
                        Expires in {expiresMinutes}:{expiresSeconds.toString().padStart(2, '0')}
                    </span>
                </div>
                <Clock className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
            </div>

            {/* Content */}
            <div className="p-4">
                <h3 className="text-base font-semibold text-[hsl(var(--foreground))] mb-1">
                    {permission.title}
                </h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))] mb-3">
                    {permission.description}
                </p>

                {/* Agent info */}
                <div className="flex items-center gap-2 mb-3">
                    <Bot className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">
                        {permission.agentName}
                    </span>
                </div>

                {/* Reason */}
                <div className="flex gap-2 p-3 bg-[hsl(var(--muted))] rounded-lg mb-4">
                    <Info className="w-4 h-4 text-[hsl(var(--muted-foreground))] flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">
                        {permission.reason}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={() => onRespond(permission.id, false)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                    >
                        <X className="w-4 h-4" />
                        Deny
                    </button>
                    <button
                        onClick={() => onRespond(permission.id, true, 'once')}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                    >
                        <Check className="w-4 h-4" />
                        Approve
                    </button>
                </div>
            </div>
        </div>
    );
}

function WorkflowCard({
    workflow,
    onViewRun,
}: {
    workflow: WorkflowProgress;
    onViewRun?: (runId: string) => void;
}) {
    const statusConfig = STATUS_CONFIG[workflow.status];

    return (
        <div className="bg-[hsl(var(--card))] rounded-xl border border-[hsl(var(--border))] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]">
                <h3 className="text-base font-semibold text-[hsl(var(--foreground))] truncate">
                    {workflow.name}
                </h3>
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${workflow.status === 'running' ? 'bg-blue-500 animate-pulse' :
                        workflow.status === 'paused' ? 'bg-amber-500' :
                            workflow.status === 'completed' ? 'bg-green-500' :
                                workflow.status === 'failed' ? 'bg-red-500' : 'bg-gray-500'
                        }`} />
                    {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
                </div>
            </div>

            {/* Progress */}
            <div className="px-4 py-3">
                <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-2 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${workflow.status === 'running' ? 'bg-blue-500' :
                                workflow.status === 'completed' ? 'bg-green-500' :
                                    workflow.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'
                                }`}
                            style={{ width: `${workflow.progress}%` }}
                        />
                    </div>
                    <span className="text-sm font-medium text-[hsl(var(--muted-foreground))] w-12 text-right">
                        {workflow.progress}%
                    </span>
                </div>
                {workflow.currentStep && (
                    <p className="text-sm text-[hsl(var(--muted-foreground))] truncate">
                        {workflow.currentStep}
                    </p>
                )}
            </div>

            {/* Active Agents */}
            {workflow.activeAgents.length > 0 && (
                <div className="px-4 pb-3">
                    <div className="flex flex-wrap gap-2">
                        {workflow.activeAgents.slice(0, 4).map(agent => (
                            <div
                                key={agent.id}
                                className="flex items-center gap-1.5 px-2 py-1 bg-[hsl(var(--muted))] rounded-full"
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${agent.status === 'working' ? 'bg-green-500 animate-pulse' :
                                    agent.status === 'monitoring' ? 'bg-blue-500' : 'bg-gray-400'
                                    }`} />
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                    {agent.name}
                                </span>
                            </div>
                        ))}
                        {workflow.activeAgents.length > 4 && (
                            <span className="text-xs text-[hsl(var(--muted-foreground))] self-center">
                                +{workflow.activeAgents.length - 4} more
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Metrics */}
            <div className="flex items-center gap-4 px-4 py-3 bg-[hsl(var(--muted))] border-t border-[hsl(var(--border))]">
                <div className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))]">
                    <Clock className="w-4 h-4" />
                    {formatDuration(workflow.elapsedTime)}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))]">
                    <Zap className="w-4 h-4" />
                    {workflow.tokensUsed.toLocaleString()} tokens
                </div>
                {workflow.estimatedCost !== undefined && (
                    <div className="text-sm text-[hsl(var(--muted-foreground))]">
                        ${workflow.estimatedCost.toFixed(4)}
                    </div>
                )}
                <div className="ml-auto flex gap-2">
                    {onViewRun && (
                        <button
                            onClick={() => onViewRun(workflow.runId)}
                            className="p-1.5 rounded-lg hover:bg-[hsl(var(--accent))] transition-colors"
                        >
                            <ExternalLink className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function MessageDetailModal({
    message,
    onClose,
    onRespond,
    onToggleStar,
}: {
    message: InboxMessage;
    onClose: () => void;
    onRespond: (id: string, response: string) => void;
    onToggleStar: (id: string) => void;
}) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[hsl(var(--card))] rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(var(--border))]">
                    <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">Message</h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onToggleStar(message.id)}
                            className="p-2 rounded-lg hover:bg-[hsl(var(--muted))]"
                        >
                            {message.starred ? (
                                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                            ) : (
                                <Star className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                            )}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-[hsl(var(--muted))]"
                        >
                            <X className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="mb-4">
                        <div className="text-sm text-[hsl(var(--muted-foreground))] mb-1">
                            From: {message.fromAgentName || 'System'}
                        </div>
                        <div className="text-sm text-[hsl(var(--muted-foreground))]">
                            {new Date(message.createdAt).toLocaleString()}
                        </div>
                    </div>
                    <h4 className="text-xl font-semibold text-[hsl(var(--foreground))] mb-4">
                        {message.subject}
                    </h4>
                    <div className="text-[hsl(var(--foreground))] whitespace-pre-wrap">
                        {message.body}
                    </div>

                    {/* Attachments */}
                    {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-6">
                            <h5 className="text-sm font-medium text-[hsl(var(--muted-foreground))] mb-2">
                                Attachments
                            </h5>
                            <div className="space-y-2">
                                {message.attachments.map(att => (
                                    <div
                                        key={att.id}
                                        className="flex items-center gap-3 p-3 bg-[hsl(var(--muted))] rounded-lg"
                                    >
                                        <span className="text-sm text-[hsl(var(--foreground))]">
                                            {att.name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Response section */}
                    {message.requiresResponse && !message.userResponse && (
                        <div className="mt-6 pt-6 border-t border-[hsl(var(--border))]">
                            <h5 className="text-sm font-medium text-[hsl(var(--foreground))] mb-3">
                                Response Required
                            </h5>
                            {message.responseOptions ? (
                                <div className="flex flex-wrap gap-2">
                                    {message.responseOptions.map(option => (
                                        <button
                                            key={option}
                                            onClick={() => onRespond(message.id, option)}
                                            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => onRespond(message.id, 'denied')}
                                        className="flex-1 px-4 py-2.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                                    >
                                        Deny
                                    </button>
                                    <button
                                        onClick={() => onRespond(message.id, 'approved')}
                                        className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                    >
                                        Approve
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Response given */}
                    {message.userResponse && (
                        <div className="mt-6 flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                            <span className="text-sm text-green-700 dark:text-green-400">
                                Responded: {message.userResponse}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AgentInbox;
