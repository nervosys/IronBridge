// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

/**
 * Collaboration Types
 *
 * Types for multi-user collaboration, team workspaces, and session sharing.
 * Supports real-time presence, permissions, and collaborative features.
 */

// =============================================================================
// User & Identity
// =============================================================================

/**
 * User profile for collaboration features
 */
export interface CollaborationUser {
    id: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
    status: UserStatus;
    lastSeenAt: number;
    preferences: UserPreferences;
    createdAt: number;
    updatedAt: number;
}

export type UserStatus = 'online' | 'away' | 'busy' | 'offline';

export interface UserPreferences {
    showPresence: boolean;
    allowInvitations: boolean;
    notificationSettings: NotificationPreferences;
    defaultPermission: PermissionLevel;
}

export interface NotificationPreferences {
    emailNotifications: boolean;
    pushNotifications: boolean;
    sessionShared: boolean;
    teamInvitation: boolean;
    mentionNotification: boolean;
    commentNotification: boolean;
}

// =============================================================================
// Team Workspaces
// =============================================================================

/**
 * Team workspace for shared sessions
 */
export interface TeamWorkspace {
    id: string;
    name: string;
    description?: string;
    slug: string;
    avatarUrl?: string;
    ownerId: string;
    visibility: WorkspaceVisibility;
    settings: TeamWorkspaceSettings;
    memberCount: number;
    sessionCount: number;
    createdAt: number;
    updatedAt: number;
}

export type WorkspaceVisibility = 'private' | 'internal' | 'public';

export interface TeamWorkspaceSettings {
    allowGuestAccess: boolean;
    requireApprovalToJoin: boolean;
    defaultSessionPermission: PermissionLevel;
    retentionDays?: number;
    allowExternalSharing: boolean;
    ssoRequired: boolean;
    auditLogging: boolean;
}

/**
 * Team membership
 */
export interface TeamMember {
    id: string;
    userId: string;
    teamId: string;
    role: TeamRole;
    permissions: TeamPermissions;
    user?: CollaborationUser;
    joinedAt: number;
    invitedBy?: string;
    lastActiveAt: number;
}

export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer' | 'guest';

export interface TeamPermissions {
    canInvite: boolean;
    canRemoveMembers: boolean;
    canEditSettings: boolean;
    canDeleteWorkspace: boolean;
    canCreateSessions: boolean;
    canDeleteSessions: boolean;
    canShareExternally: boolean;
    canViewAuditLog: boolean;
}

/**
 * Team invitation
 */
export interface TeamInvitation {
    id: string;
    teamId: string;
    email: string;
    role: TeamRole;
    invitedBy: string;
    status: InvitationStatus;
    expiresAt: number;
    createdAt: number;
    acceptedAt?: number;
}

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';

// =============================================================================
// Session Sharing & Permissions
// =============================================================================

/**
 * Session share configuration
 */
export interface SessionShare {
    id: string;
    sessionId: string;
    sharedBy: string;
    shareType: ShareType;
    permission: PermissionLevel;
    expiresAt?: number;
    accessCount: number;
    maxAccesses?: number;
    password?: string; // Hashed
    allowDownload: boolean;
    allowCopy: boolean;
    createdAt: number;
    updatedAt: number;
}

export type ShareType = 'link' | 'email' | 'team' | 'user';

export type PermissionLevel = 'view' | 'comment' | 'edit' | 'admin';

/**
 * Session access record
 */
export interface SessionAccess {
    id: string;
    sessionId: string;
    userId?: string;
    guestEmail?: string;
    shareId?: string;
    permission: PermissionLevel;
    grantedBy: string;
    grantedAt: number;
    expiresAt?: number;
    lastAccessedAt?: number;
    revokedAt?: number;
}

/**
 * Permission check result
 */
export interface PermissionCheck {
    allowed: boolean;
    permission: PermissionLevel;
    reason?: string;
    source: 'owner' | 'share' | 'team' | 'direct';
}

// =============================================================================
// Real-Time Presence
// =============================================================================

/**
 * User presence in a session
 */
export interface SessionPresence {
    sessionId: string;
    userId: string;
    user: CollaborationUser;
    cursor?: CursorPosition;
    selection?: SelectionRange;
    viewingMessageId?: string;
    isTyping: boolean;
    lastActivity: number;
    connectedAt: number;
}

export interface CursorPosition {
    messageId: string;
    offset: number;
    line?: number;
    column?: number;
}

export interface SelectionRange {
    messageId: string;
    startOffset: number;
    endOffset: number;
    text?: string;
}

/**
 * Presence broadcast event
 */
export interface PresenceEvent {
    type: PresenceEventType;
    sessionId: string;
    userId: string;
    timestamp: number;
    data?: Record<string, unknown>;
}

export type PresenceEventType =
    | 'user_joined'
    | 'user_left'
    | 'cursor_moved'
    | 'selection_changed'
    | 'typing_started'
    | 'typing_stopped'
    | 'viewing_message';

// =============================================================================
// Comments & Annotations
// =============================================================================

/**
 * Comment on a message or session
 */
export interface SessionComment {
    id: string;
    sessionId: string;
    messageId?: string;
    parentId?: string; // For threaded replies
    userId: string;
    user?: CollaborationUser;
    content: string;
    mentions: string[]; // User IDs
    reactions: CommentReaction[];
    resolved: boolean;
    resolvedBy?: string;
    resolvedAt?: number;
    editedAt?: number;
    createdAt: number;
    updatedAt: number;
}

export interface CommentReaction {
    emoji: string;
    userIds: string[];
    count: number;
}

/**
 * Mention in a comment
 */
export interface Mention {
    userId: string;
    displayName: string;
    startIndex: number;
    endIndex: number;
}

// =============================================================================
// Activity & Audit
// =============================================================================

/**
 * Collaboration activity event
 */
export interface CollaborationActivity {
    id: string;
    type: ActivityType;
    teamId?: string;
    sessionId?: string;
    userId: string;
    user?: CollaborationUser;
    targetUserId?: string;
    details: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    timestamp: number;
}

export type ActivityType =
    // Team activities
    | 'team_created'
    | 'team_updated'
    | 'team_deleted'
    | 'member_invited'
    | 'member_joined'
    | 'member_removed'
    | 'member_role_changed'
    // Session activities
    | 'session_shared'
    | 'session_unshared'
    | 'session_accessed'
    | 'session_permission_changed'
    // Comment activities
    | 'comment_added'
    | 'comment_edited'
    | 'comment_deleted'
    | 'comment_resolved'
    | 'mention_created';

// =============================================================================
// Collaboration State
// =============================================================================

/**
 * Collaborative editing operation (for OT/CRDT)
 */
export interface EditOperation {
    id: string;
    sessionId: string;
    messageId: string;
    userId: string;
    type: EditOperationType;
    position: number;
    content?: string;
    length?: number;
    timestamp: number;
    parentVersion: string;
    resultVersion: string;
}

export type EditOperationType = 'insert' | 'delete' | 'retain';

/**
 * Version vector for conflict resolution
 */
export interface VersionVector {
    [userId: string]: number;
}

/**
 * Sync state for a collaborative session
 */
export interface CollaborationSyncState {
    sessionId: string;
    localVersion: string;
    serverVersion: string;
    pendingOperations: EditOperation[];
    conflictingOperations: EditOperation[];
    lastSyncAt: number;
    syncStatus: 'synced' | 'syncing' | 'pending' | 'conflict';
}

// =============================================================================
// API Types
// =============================================================================

/**
 * Create team request
 */
export interface CreateTeamRequest {
    name: string;
    description?: string;
    visibility: WorkspaceVisibility;
    settings?: Partial<TeamWorkspaceSettings>;
}

/**
 * Invite member request
 */
export interface InviteMemberRequest {
    email: string;
    role: TeamRole;
    message?: string;
}

/**
 * Share session request
 */
export interface ShareSessionRequest {
    sessionId: string;
    shareType: ShareType;
    permission: PermissionLevel;
    recipients?: string[]; // Emails or user IDs
    expiresIn?: number; // Seconds
    maxAccesses?: number;
    password?: string;
    allowDownload?: boolean;
    allowCopy?: boolean;
    message?: string;
}

/**
 * Update permission request
 */
export interface UpdatePermissionRequest {
    accessId: string;
    permission: PermissionLevel;
    expiresAt?: number;
}

// =============================================================================
// WebSocket Events
// =============================================================================

/**
 * Collaboration WebSocket message
 */
export interface CollaborationMessage {
    type: CollaborationMessageType;
    sessionId?: string;
    teamId?: string;
    payload: unknown;
    timestamp: number;
}

export type CollaborationMessageType =
    // Presence
    | 'presence_update'
    | 'presence_sync'
    // Editing
    | 'edit_operation'
    | 'edit_ack'
    | 'edit_conflict'
    // Comments
    | 'comment_added'
    | 'comment_updated'
    | 'comment_deleted'
    // Notifications
    | 'notification'
    | 'mention'
    // Sync
    | 'sync_request'
    | 'sync_response'
    | 'version_update';

// =============================================================================
// Constants
// =============================================================================

/**
 * Default team permissions by role
 */
export const DEFAULT_TEAM_PERMISSIONS: Record<TeamRole, TeamPermissions> = {
    owner: {
        canInvite: true,
        canRemoveMembers: true,
        canEditSettings: true,
        canDeleteWorkspace: true,
        canCreateSessions: true,
        canDeleteSessions: true,
        canShareExternally: true,
        canViewAuditLog: true,
    },
    admin: {
        canInvite: true,
        canRemoveMembers: true,
        canEditSettings: true,
        canDeleteWorkspace: false,
        canCreateSessions: true,
        canDeleteSessions: true,
        canShareExternally: true,
        canViewAuditLog: true,
    },
    member: {
        canInvite: false,
        canRemoveMembers: false,
        canEditSettings: false,
        canDeleteWorkspace: false,
        canCreateSessions: true,
        canDeleteSessions: false,
        canShareExternally: false,
        canViewAuditLog: false,
    },
    viewer: {
        canInvite: false,
        canRemoveMembers: false,
        canEditSettings: false,
        canDeleteWorkspace: false,
        canCreateSessions: false,
        canDeleteSessions: false,
        canShareExternally: false,
        canViewAuditLog: false,
    },
    guest: {
        canInvite: false,
        canRemoveMembers: false,
        canEditSettings: false,
        canDeleteWorkspace: false,
        canCreateSessions: false,
        canDeleteSessions: false,
        canShareExternally: false,
        canViewAuditLog: false,
    },
};

/**
 * Permission level hierarchy
 */
export const PERMISSION_HIERARCHY: PermissionLevel[] = ['view', 'comment', 'edit', 'admin'];

/**
 * Check if a permission level includes another
 */
export function hasPermission(
    userPermission: PermissionLevel,
    requiredPermission: PermissionLevel
): boolean {
    const userIndex = PERMISSION_HIERARCHY.indexOf(userPermission);
    const requiredIndex = PERMISSION_HIERARCHY.indexOf(requiredPermission);
    return userIndex >= requiredIndex;
}

/**
 * Presence colors for user avatars
 */
export const PRESENCE_COLORS = [
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Amber', value: '#f59e0b' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Lime', value: '#84cc16' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Emerald', value: '#10b981' },
    { name: 'Teal', value: '#14b8a6' },
    { name: 'Cyan', value: '#06b6d4' },
    { name: 'Sky', value: '#0ea5e9' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Indigo', value: '#6366f1' },
    { name: 'Violet', value: '#8b5cf6' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Fuchsia', value: '#d946ef' },
    { name: 'Pink', value: '#ec4899' },
] as const;

/**
 * Get a consistent color for a user based on their ID
 */
export function getUserColor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = ((hash << 5) - hash) + userId.charCodeAt(i);
        hash |= 0;
    }
    const index = Math.abs(hash) % PRESENCE_COLORS.length;
    return PRESENCE_COLORS[index].value;
}

/**
 * Generate initials from display name
 */
export function getInitials(displayName: string): string {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
