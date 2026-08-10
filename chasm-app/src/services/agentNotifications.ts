// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

// =============================================================================
// CSM App - Agent Notifications Service
// =============================================================================
// Manages real-time notifications, inbox messages, and permission requests
// for agentic AI workflows

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';

// =============================================================================
// Simple EventEmitter for React Native (replaces Node.js events module)
// =============================================================================

type EventHandler = (...args: unknown[]) => void;

class SimpleEventEmitter {
    private listeners: Map<string, Set<EventHandler>> = new Map();

    on(event: string, handler: EventHandler): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(handler);
    }

    off(event: string, handler: EventHandler): void {
        this.listeners.get(event)?.delete(handler);
    }

    emit(event: string, ...args: unknown[]): void {
        this.listeners.get(event)?.forEach(handler => {
            try {
                handler(...args);
            } catch (e) {
                console.error(`[Notifications] Error in event handler for ${event}:`, e);
            }
        });
    }

    removeAllListeners(event?: string): void {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }
}

// Storage keys
const NOTIFICATIONS_KEY = 'csm_agent_notifications';
const INBOX_KEY = 'csm_agent_inbox';
const PERMISSIONS_KEY = 'csm_agent_permissions';
const SETTINGS_KEY = 'csm_notification_settings';

// =============================================================================
// Types
// =============================================================================

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationCategory =
    | 'workflow_progress'
    | 'workflow_complete'
    | 'workflow_error'
    | 'permission_request'
    | 'agent_message'
    | 'task_complete'
    | 'handoff'
    | 'system';

export type PermissionType =
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

export type PermissionStatus = 'pending' | 'approved' | 'denied' | 'expired';

export interface AgentNotification {
    id: string;
    category: NotificationCategory;
    priority: NotificationPriority;
    title: string;
    body: string;
    data?: Record<string, any>;
    // Source tracking
    agentId?: string;
    agentName?: string;
    runId?: string;
    swarmId?: string;
    taskId?: string;
    // Status
    read: boolean;
    dismissed: boolean;
    actionTaken?: string;
    // Timestamps
    createdAt: number;
    readAt?: number;
    expiresAt?: number;
}

export interface InboxMessage {
    id: string;
    type: 'agent_to_user' | 'agent_to_agent' | 'system' | 'handoff_request' | 'approval_request';
    fromAgentId?: string;
    fromAgentName?: string;
    toAgentId?: string;
    toAgentName?: string;
    subject: string;
    body: string;
    // Thread tracking
    threadId?: string;
    replyToId?: string;
    // Metadata
    runId?: string;
    swarmId?: string;
    attachments?: InboxAttachment[];
    // Status
    read: boolean;
    starred: boolean;
    archived: boolean;
    // Actions
    requiresResponse: boolean;
    responseOptions?: string[];
    userResponse?: string;
    // Timestamps
    createdAt: number;
    readAt?: number;
    respondedAt?: number;
}

export interface InboxAttachment {
    id: string;
    type: 'code' | 'file' | 'image' | 'log' | 'data';
    name: string;
    content?: string;
    url?: string;
    mimeType?: string;
    size?: number;
}

export interface PermissionRequest {
    id: string;
    type: PermissionType;
    status: PermissionStatus;
    // Request details
    title: string;
    description: string;
    reason: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    // Source
    agentId: string;
    agentName: string;
    runId?: string;
    swarmId?: string;
    taskId?: string;
    // Scope
    resource?: string;
    action?: string;
    scope?: 'once' | 'session' | 'run' | 'always';
    // Response
    respondedBy?: string;
    responseNote?: string;
    // Timestamps
    createdAt: number;
    expiresAt: number;
    respondedAt?: number;
}

export interface WorkflowProgress {
    runId: string;
    swarmId?: string;
    name: string;
    status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
    progress: number; // 0-100
    currentStep?: string;
    totalSteps?: number;
    completedSteps?: number;
    // Active agents
    activeAgents: {
        id: string;
        name: string;
        status: string;
        currentTask?: string;
    }[];
    // Metrics
    tokensUsed: number;
    estimatedCost?: number;
    elapsedTime: number;
    estimatedTimeRemaining?: number;
    // Events
    lastEvent?: string;
    lastEventTime?: number;
    // Timestamps
    startedAt: number;
    updatedAt: number;
    completedAt?: number;
}

export interface NotificationSettings {
    enabled: boolean;
    sound: boolean;
    vibration: boolean;
    // Category settings
    categories: {
        [key in NotificationCategory]: {
            enabled: boolean;
            priority: NotificationPriority;
            pushEnabled: boolean;
        };
    };
    // Permission auto-approve rules
    autoApprove: {
        lowRiskOperations: boolean;
        trustedAgents: string[];
        trustedOperations: PermissionType[];
    };
    // Quiet hours
    quietHours: {
        enabled: boolean;
        startHour: number;
        endHour: number;
        allowUrgent: boolean;
    };
}

// =============================================================================
// Event Types
// =============================================================================

export type NotificationEvent =
    | { type: 'notification_added'; notification: AgentNotification }
    | { type: 'notification_read'; notificationId: string }
    | { type: 'notification_dismissed'; notificationId: string }
    | { type: 'inbox_message_added'; message: InboxMessage }
    | { type: 'inbox_message_read'; messageId: string }
    | { type: 'inbox_message_responded'; messageId: string; response: string }
    | { type: 'permission_requested'; request: PermissionRequest }
    | { type: 'permission_responded'; requestId: string; approved: boolean }
    | { type: 'workflow_progress'; progress: WorkflowProgress }
    | { type: 'workflow_completed'; runId: string; success: boolean }
    | { type: 'unread_count_changed'; count: number };

// =============================================================================
// Agent Notifications Service
// =============================================================================

class AgentNotificationsService {
    private notifications: AgentNotification[] = [];
    private inbox: InboxMessage[] = [];
    private permissions: PermissionRequest[] = [];
    private workflowProgress: Map<string, WorkflowProgress> = new Map();
    private settings: NotificationSettings;
    private eventEmitter: SimpleEventEmitter;
    private initialized: boolean = false;

    constructor() {
        this.eventEmitter = new SimpleEventEmitter();
        this.settings = this.getDefaultSettings();
    }

    // =========================================================================
    // Initialization
    // =========================================================================

    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            await this.loadData();
            await this.setupPushNotifications();
            this.initialized = true;
            console.log('[AgentNotifications] Initialized');
        } catch (error) {
            console.error('[AgentNotifications] Init error:', error);
        }
    }

    private async loadData(): Promise<void> {
        try {
            const [notificationsJson, inboxJson, permissionsJson, settingsJson] = await Promise.all([
                AsyncStorage.getItem(NOTIFICATIONS_KEY),
                AsyncStorage.getItem(INBOX_KEY),
                AsyncStorage.getItem(PERMISSIONS_KEY),
                AsyncStorage.getItem(SETTINGS_KEY),
            ]);

            if (notificationsJson) {
                this.notifications = JSON.parse(notificationsJson);
            }
            if (inboxJson) {
                this.inbox = JSON.parse(inboxJson);
            }
            if (permissionsJson) {
                this.permissions = JSON.parse(permissionsJson);
                // Expire old pending permissions
                this.expirePendingPermissions();
            }
            if (settingsJson) {
                this.settings = { ...this.getDefaultSettings(), ...JSON.parse(settingsJson) };
            }
        } catch (error) {
            console.error('[AgentNotifications] Failed to load data:', error);
        }
    }

    private async saveNotifications(): Promise<void> {
        await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(this.notifications));
    }

    private async saveInbox(): Promise<void> {
        await AsyncStorage.setItem(INBOX_KEY, JSON.stringify(this.inbox));
    }

    private async savePermissions(): Promise<void> {
        await AsyncStorage.setItem(PERMISSIONS_KEY, JSON.stringify(this.permissions));
    }

    async saveSettings(): Promise<void> {
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    }

    private async setupPushNotifications(): Promise<void> {
        try {
            // Configure notification handler
            Notifications.setNotificationHandler({
                handleNotification: async () => ({
                    shouldShowAlert: true,
                    shouldPlaySound: this.settings.sound,
                    shouldSetBadge: true,
                    shouldShowBanner: true,
                    shouldShowList: true,
                }),
            });

            // Request permissions
            const { status } = await Notifications.requestPermissionsAsync();
            if (status !== 'granted') {
                console.log('[AgentNotifications] Push notification permissions not granted');
            }
        } catch (error) {
            console.log('[AgentNotifications] Push notifications not available:', error);
        }
    }

    // =========================================================================
    // Event Subscription
    // =========================================================================

    subscribe(callback: (event: NotificationEvent) => void): () => void {
        this.eventEmitter.on('event', callback as EventHandler);
        return () => this.eventEmitter.off('event', callback as EventHandler);
    }

    private emit(event: NotificationEvent): void {
        this.eventEmitter.emit('event', event);
    }

    // =========================================================================
    // Notifications
    // =========================================================================

    async addNotification(
        category: NotificationCategory,
        title: string,
        body: string,
        options: Partial<Omit<AgentNotification, 'id' | 'category' | 'title' | 'body' | 'createdAt' | 'read' | 'dismissed'>> = {}
    ): Promise<AgentNotification> {
        const notification: AgentNotification = {
            id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            category,
            priority: options.priority ?? this.getCategoryPriority(category),
            title,
            body,
            read: false,
            dismissed: false,
            createdAt: Date.now(),
            ...options,
        };

        this.notifications.unshift(notification);
        await this.saveNotifications();

        this.emit({ type: 'notification_added', notification });
        this.emit({ type: 'unread_count_changed', count: this.getUnreadCount() });

        // Show push notification if enabled
        await this.showPushNotification(notification);

        // Haptic feedback for high priority
        if (notification.priority === 'high' || notification.priority === 'urgent') {
            if (this.settings.vibration) {
                Vibration.vibrate(notification.priority === 'urgent' ? [0, 200, 100, 200] : 200);
            }
        }

        return notification;
    }

    async markNotificationRead(id: string): Promise<void> {
        const notification = this.notifications.find(n => n.id === id);
        if (notification && !notification.read) {
            notification.read = true;
            notification.readAt = Date.now();
            await this.saveNotifications();

            this.emit({ type: 'notification_read', notificationId: id });
            this.emit({ type: 'unread_count_changed', count: this.getUnreadCount() });
        }
    }

    async dismissNotification(id: string): Promise<void> {
        const notification = this.notifications.find(n => n.id === id);
        if (notification) {
            notification.dismissed = true;
            await this.saveNotifications();
            this.emit({ type: 'notification_dismissed', notificationId: id });
        }
    }

    async markAllNotificationsRead(): Promise<void> {
        let changed = false;
        for (const notification of this.notifications) {
            if (!notification.read) {
                notification.read = true;
                notification.readAt = Date.now();
                changed = true;
            }
        }
        if (changed) {
            await this.saveNotifications();
            this.emit({ type: 'unread_count_changed', count: 0 });
        }
    }

    async clearNotifications(): Promise<void> {
        this.notifications = [];
        await this.saveNotifications();
        this.emit({ type: 'unread_count_changed', count: 0 });
    }

    getNotifications(includeRead = true, includeDismissed = false): AgentNotification[] {
        return this.notifications.filter(n =>
            (includeRead || !n.read) &&
            (includeDismissed || !n.dismissed)
        );
    }

    getUnreadCount(): number {
        return this.notifications.filter(n => !n.read && !n.dismissed).length;
    }

    // =========================================================================
    // Inbox Messages
    // =========================================================================

    async addInboxMessage(
        type: InboxMessage['type'],
        subject: string,
        body: string,
        options: Partial<Omit<InboxMessage, 'id' | 'type' | 'subject' | 'body' | 'createdAt' | 'read' | 'starred' | 'archived'>> = {}
    ): Promise<InboxMessage> {
        const message: InboxMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type,
            subject,
            body,
            read: false,
            starred: false,
            archived: false,
            requiresResponse: options.requiresResponse ?? false,
            createdAt: Date.now(),
            ...options,
        };

        this.inbox.unshift(message);
        await this.saveInbox();

        this.emit({ type: 'inbox_message_added', message });

        // Create notification for inbox message
        if (type === 'approval_request' || type === 'handoff_request') {
            await this.addNotification(
                type === 'approval_request' ? 'permission_request' : 'handoff',
                subject,
                body,
                {
                    priority: 'high',
                    agentId: options.fromAgentId,
                    agentName: options.fromAgentName,
                    runId: options.runId,
                    data: { messageId: message.id },
                }
            );
        }

        return message;
    }

    async markInboxMessageRead(id: string): Promise<void> {
        const message = this.inbox.find(m => m.id === id);
        if (message && !message.read) {
            message.read = true;
            message.readAt = Date.now();
            await this.saveInbox();
            this.emit({ type: 'inbox_message_read', messageId: id });
        }
    }

    async respondToMessage(id: string, response: string): Promise<void> {
        const message = this.inbox.find(m => m.id === id);
        if (message) {
            message.userResponse = response;
            message.respondedAt = Date.now();
            if (!message.read) {
                message.read = true;
                message.readAt = Date.now();
            }
            await this.saveInbox();
            this.emit({ type: 'inbox_message_responded', messageId: id, response });
        }
    }

    async toggleStarred(id: string): Promise<void> {
        const message = this.inbox.find(m => m.id === id);
        if (message) {
            message.starred = !message.starred;
            await this.saveInbox();
        }
    }

    async archiveMessage(id: string): Promise<void> {
        const message = this.inbox.find(m => m.id === id);
        if (message) {
            message.archived = true;
            await this.saveInbox();
        }
    }

    async deleteMessage(id: string): Promise<void> {
        this.inbox = this.inbox.filter(m => m.id !== id);
        await this.saveInbox();
    }

    getInboxMessages(filter?: {
        type?: InboxMessage['type'];
        unreadOnly?: boolean;
        starredOnly?: boolean;
        includeArchived?: boolean;
        threadId?: string;
    }): InboxMessage[] {
        return this.inbox.filter(m => {
            if (filter?.type && m.type !== filter.type) return false;
            if (filter?.unreadOnly && m.read) return false;
            if (filter?.starredOnly && !m.starred) return false;
            if (!filter?.includeArchived && m.archived) return false;
            if (filter?.threadId && m.threadId !== filter.threadId) return false;
            return true;
        });
    }

    getUnreadInboxCount(): number {
        return this.inbox.filter(m => !m.read && !m.archived).length;
    }

    // =========================================================================
    // Permission Requests
    // =========================================================================

    async requestPermission(
        type: PermissionType,
        agentId: string,
        agentName: string,
        options: {
            title?: string;
            description: string;
            reason: string;
            riskLevel: PermissionRequest['riskLevel'];
            resource?: string;
            action?: string;
            runId?: string;
            swarmId?: string;
            taskId?: string;
            expiresIn?: number; // ms
        }
    ): Promise<PermissionRequest> {
        const request: PermissionRequest = {
            id: `perm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type,
            status: 'pending',
            title: options.title ?? this.getPermissionTitle(type),
            description: options.description,
            reason: options.reason,
            riskLevel: options.riskLevel,
            agentId,
            agentName,
            runId: options.runId,
            swarmId: options.swarmId,
            taskId: options.taskId,
            resource: options.resource,
            action: options.action,
            createdAt: Date.now(),
            expiresAt: Date.now() + (options.expiresIn ?? 5 * 60 * 1000), // Default 5 min
        };

        // Check auto-approve rules
        if (this.shouldAutoApprove(request)) {
            request.status = 'approved';
            request.respondedBy = 'auto';
            request.respondedAt = Date.now();
            request.responseNote = 'Auto-approved based on settings';
        }

        this.permissions.push(request);
        await this.savePermissions();

        this.emit({ type: 'permission_requested', request });

        // Create notification for pending permissions
        if (request.status === 'pending') {
            await this.addNotification(
                'permission_request',
                request.title,
                `${agentName}: ${request.description}`,
                {
                    priority: request.riskLevel === 'critical' ? 'urgent' :
                        request.riskLevel === 'high' ? 'high' : 'normal',
                    agentId,
                    agentName,
                    runId: options.runId,
                    data: { permissionId: request.id },
                }
            );
        }

        return request;
    }

    async respondToPermission(
        id: string,
        approved: boolean,
        options?: { scope?: PermissionRequest['scope']; note?: string }
    ): Promise<void> {
        const request = this.permissions.find(p => p.id === id);
        if (request && request.status === 'pending') {
            request.status = approved ? 'approved' : 'denied';
            request.respondedAt = Date.now();
            request.responseNote = options?.note;
            request.scope = options?.scope;

            await this.savePermissions();
            this.emit({ type: 'permission_responded', requestId: id, approved });

            // Add to auto-approve if scope is 'always'
            if (approved && options?.scope === 'always') {
                this.settings.autoApprove.trustedOperations.push(request.type);
                await this.saveSettings();
            }
        }
    }

    getPendingPermissions(): PermissionRequest[] {
        this.expirePendingPermissions();
        return this.permissions.filter(p => p.status === 'pending');
    }

    getPermissionHistory(limit = 50): PermissionRequest[] {
        return this.permissions.slice(-limit);
    }

    private expirePendingPermissions(): void {
        const now = Date.now();
        let changed = false;
        for (const request of this.permissions) {
            if (request.status === 'pending' && request.expiresAt < now) {
                request.status = 'expired';
                changed = true;
            }
        }
        if (changed) {
            this.savePermissions();
        }
    }

    private shouldAutoApprove(request: PermissionRequest): boolean {
        if (!this.settings.autoApprove.lowRiskOperations && request.riskLevel !== 'low') {
            return false;
        }
        if (this.settings.autoApprove.trustedAgents.includes(request.agentId)) {
            return true;
        }
        if (this.settings.autoApprove.trustedOperations.includes(request.type)) {
            return true;
        }
        return request.riskLevel === 'low' && this.settings.autoApprove.lowRiskOperations;
    }

    // =========================================================================
    // Workflow Progress Tracking
    // =========================================================================

    updateWorkflowProgress(progress: WorkflowProgress): void {
        const previous = this.workflowProgress.get(progress.runId);
        this.workflowProgress.set(progress.runId, progress);

        this.emit({ type: 'workflow_progress', progress });

        // Check for completion or failure
        if (progress.status === 'completed' || progress.status === 'failed') {
            const success = progress.status === 'completed';
            this.emit({ type: 'workflow_completed', runId: progress.runId, success });

            // Create notification
            this.addNotification(
                success ? 'workflow_complete' : 'workflow_error',
                success ? `✅ ${progress.name} completed` : `❌ ${progress.name} failed`,
                success
                    ? `Completed in ${this.formatDuration(progress.elapsedTime)} with ${progress.tokensUsed.toLocaleString()} tokens`
                    : progress.lastEvent ?? 'An error occurred during execution',
                {
                    priority: success ? 'normal' : 'high',
                    runId: progress.runId,
                    swarmId: progress.swarmId,
                    data: { progress },
                }
            );
        }

        // Check for significant progress milestones
        if (previous && progress.progress >= 25 && previous.progress < 25) {
            this.addNotification('workflow_progress', `📊 ${progress.name}: 25% complete`, progress.currentStep ?? '', { priority: 'low', runId: progress.runId });
        } else if (previous && progress.progress >= 50 && previous.progress < 50) {
            this.addNotification('workflow_progress', `📊 ${progress.name}: 50% complete`, progress.currentStep ?? '', { priority: 'low', runId: progress.runId });
        } else if (previous && progress.progress >= 75 && previous.progress < 75) {
            this.addNotification('workflow_progress', `📊 ${progress.name}: 75% complete`, progress.currentStep ?? '', { priority: 'low', runId: progress.runId });
        }
    }

    getWorkflowProgress(runId: string): WorkflowProgress | undefined {
        return this.workflowProgress.get(runId);
    }

    getAllActiveWorkflows(): WorkflowProgress[] {
        return Array.from(this.workflowProgress.values()).filter(
            p => p.status === 'running' || p.status === 'paused'
        );
    }

    removeWorkflowProgress(runId: string): void {
        this.workflowProgress.delete(runId);
    }

    // =========================================================================
    // Push Notifications
    // =========================================================================

    private async showPushNotification(notification: AgentNotification): Promise<void> {
        if (!this.settings.enabled) return;
        if (!this.settings.categories[notification.category]?.pushEnabled) return;
        if (this.isQuietHours() && notification.priority !== 'urgent') return;

        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: notification.title,
                    body: notification.body,
                    data: { notificationId: notification.id, ...notification.data },
                    sound: this.settings.sound,
                    priority: notification.priority === 'urgent' ? 'max' :
                        notification.priority === 'high' ? 'high' : 'default',
                },
                trigger: null, // Immediate
            });
        } catch (error) {
            console.log('[AgentNotifications] Failed to show push notification:', error);
        }
    }

    private isQuietHours(): boolean {
        if (!this.settings.quietHours.enabled) return false;

        const now = new Date();
        const hour = now.getHours();
        const { startHour, endHour } = this.settings.quietHours;

        if (startHour < endHour) {
            return hour >= startHour && hour < endHour;
        } else {
            // Overnight quiet hours (e.g., 22:00 - 07:00)
            return hour >= startHour || hour < endHour;
        }
    }

    // =========================================================================
    // Settings
    // =========================================================================

    getSettings(): NotificationSettings {
        return { ...this.settings };
    }

    async updateSettings(updates: Partial<NotificationSettings>): Promise<void> {
        this.settings = { ...this.settings, ...updates };
        await this.saveSettings();
    }

    private getDefaultSettings(): NotificationSettings {
        return {
            enabled: true,
            sound: true,
            vibration: true,
            categories: {
                workflow_progress: { enabled: true, priority: 'low', pushEnabled: false },
                workflow_complete: { enabled: true, priority: 'normal', pushEnabled: true },
                workflow_error: { enabled: true, priority: 'high', pushEnabled: true },
                permission_request: { enabled: true, priority: 'high', pushEnabled: true },
                agent_message: { enabled: true, priority: 'normal', pushEnabled: true },
                task_complete: { enabled: true, priority: 'low', pushEnabled: false },
                handoff: { enabled: true, priority: 'high', pushEnabled: true },
                system: { enabled: true, priority: 'normal', pushEnabled: false },
            },
            autoApprove: {
                lowRiskOperations: false,
                trustedAgents: [],
                trustedOperations: [],
            },
            quietHours: {
                enabled: false,
                startHour: 22,
                endHour: 7,
                allowUrgent: true,
            },
        };
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private getCategoryPriority(category: NotificationCategory): NotificationPriority {
        return this.settings.categories[category]?.priority ?? 'normal';
    }

    private getPermissionTitle(type: PermissionType): string {
        const titles: Record<PermissionType, string> = {
            execute_code: 'Code Execution Request',
            file_write: 'File Write Request',
            file_delete: 'File Delete Request',
            api_call: 'API Call Request',
            web_request: 'Web Request',
            database_write: 'Database Write Request',
            send_email: 'Email Send Request',
            shell_command: 'Shell Command Request',
            cost_threshold: 'Cost Threshold Exceeded',
            time_extension: 'Time Extension Request',
        };
        return titles[type];
    }

    private formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        return `${seconds}s`;
    }

    // =========================================================================
    // Badge Count
    // =========================================================================

    async updateBadgeCount(): Promise<void> {
        try {
            const count = this.getUnreadCount() + this.getPendingPermissions().length;
            await Notifications.setBadgeCountAsync(count);
        } catch (error) {
            // Badge not supported
        }
    }
}

// Export singleton instance
export const agentNotificationsService = new AgentNotificationsService();
