// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// =============================================================================
// Agent inbox record types
// =============================================================================
//
// The shapes `/api/inbox/*` returns. Field names match the wire exactly --
// the Rust records in `ironbridge-rust/src/api/inbox.rs` serialize with
// `rename_all = "camelCase"`, and both `InboxMessage` and `PermissionRequest`
// rename their Rust `kind` field to `type`.
//
// These used to live in `services/agentNotifications.ts` alongside an
// AsyncStorage-backed store of the same records. That store had four
// producers -- `addNotification`, `addInboxMessage`, `requestPermission` and
// `updateWorkflowProgress` -- and none of them was called from anywhere in
// the app, so nothing ever wrote to it and the inbox could only ever render
// empty. The screen reads the server's inbox now, which agent runs actually
// populate, and the store is gone. Only the types it declared survive.
//
// A few optional fields here are not sent by the server today -- a
// notification's `taskId`, `actionTaken` and `expiresAt`, a permission's
// `taskId` and `respondedBy`. They are kept optional rather than deleted
// because the columns exist server-side; nothing reads them until it does.

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
