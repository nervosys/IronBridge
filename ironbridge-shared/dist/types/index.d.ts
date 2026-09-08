/**
 * A tag that can be applied to sessions
 */
interface SessionTag {
    id: string;
    name: string;
    color: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
}
/**
 * A note attached to a session or message
 */
interface SessionNote {
    id: string;
    sessionId: string;
    messageId?: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    author?: string;
    pinned?: boolean;
}
/**
 * A highlight within a message
 */
interface MessageHighlight {
    id: string;
    sessionId: string;
    messageId: string;
    startOffset: number;
    endOffset: number;
    color: string;
    note?: string;
    createdAt: string;
}
/**
 * Bookmark for quick access to a session or message
 */
interface SessionBookmark {
    id: string;
    sessionId: string;
    messageId?: string;
    title: string;
    description?: string;
    createdAt: string;
    sortOrder: number;
}
/**
 * Session annotations container
 */
interface SessionAnnotations {
    sessionId: string;
    tags: string[];
    notes: SessionNote[];
    highlights: MessageHighlight[];
    bookmarks: SessionBookmark[];
    rating?: number;
    status?: 'active' | 'archived' | 'favorite' | 'flagged';
    customFields?: Record<string, string | number | boolean>;
}
/**
 * Annotation summary for list views
 */
interface AnnotationSummary {
    tagCount: number;
    noteCount: number;
    highlightCount: number;
    bookmarkCount: number;
    rating?: number;
    status?: string;
}
declare const TAG_COLORS: readonly [{
    readonly name: "Red";
    readonly value: "#ef4444";
}, {
    readonly name: "Orange";
    readonly value: "#f97316";
}, {
    readonly name: "Amber";
    readonly value: "#f59e0b";
}, {
    readonly name: "Yellow";
    readonly value: "#eab308";
}, {
    readonly name: "Lime";
    readonly value: "#84cc16";
}, {
    readonly name: "Green";
    readonly value: "#22c55e";
}, {
    readonly name: "Emerald";
    readonly value: "#10b981";
}, {
    readonly name: "Teal";
    readonly value: "#14b8a6";
}, {
    readonly name: "Cyan";
    readonly value: "#06b6d4";
}, {
    readonly name: "Sky";
    readonly value: "#0ea5e9";
}, {
    readonly name: "Blue";
    readonly value: "#3b82f6";
}, {
    readonly name: "Indigo";
    readonly value: "#6366f1";
}, {
    readonly name: "Violet";
    readonly value: "#8b5cf6";
}, {
    readonly name: "Purple";
    readonly value: "#a855f7";
}, {
    readonly name: "Fuchsia";
    readonly value: "#d946ef";
}, {
    readonly name: "Pink";
    readonly value: "#ec4899";
}, {
    readonly name: "Rose";
    readonly value: "#f43f5e";
}, {
    readonly name: "Gray";
    readonly value: "#6b7280";
}];
declare const HIGHLIGHT_COLORS: readonly [{
    readonly name: "Yellow";
    readonly value: "#fef08a";
}, {
    readonly name: "Green";
    readonly value: "#bbf7d0";
}, {
    readonly name: "Blue";
    readonly value: "#bfdbfe";
}, {
    readonly name: "Pink";
    readonly value: "#fbcfe8";
}, {
    readonly name: "Purple";
    readonly value: "#ddd6fe";
}, {
    readonly name: "Orange";
    readonly value: "#fed7aa";
}];
declare const DEFAULT_TAGS: Omit<SessionTag, 'id' | 'createdAt' | 'updatedAt'>[];

/**
 * A reusable session template
 */
interface SessionTemplate {
    id: string;
    name: string;
    description?: string;
    category: TemplateCategory;
    systemPrompt?: string;
    initialMessages?: TemplateMessage[];
    suggestedQueries?: string[];
    preferredProvider?: string;
    preferredModel?: string;
    parameters?: ModelParameters;
    tags?: string[];
    icon?: string;
    color?: string;
    isBuiltIn?: boolean;
    isPublic?: boolean;
    usageCount: number;
    lastUsedAt?: string;
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
}
/**
 * Template message structure
 */
interface TemplateMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    placeholder?: boolean;
}
/**
 * Model parameters for templates
 */
interface ModelParameters {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stopSequences?: string[];
}
/**
 * Template categories
 */
type TemplateCategory = 'coding' | 'writing' | 'analysis' | 'research' | 'debugging' | 'documentation' | 'learning' | 'creative' | 'business' | 'custom';
declare const TEMPLATE_CATEGORIES: {
    id: TemplateCategory;
    name: string;
    icon: string;
    description: string;
}[];
declare const BUILTIN_TEMPLATES: Omit<SessionTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>[];

/**
 * A keyboard shortcut definition
 */
interface KeyboardShortcut {
    id: string;
    action: ShortcutAction;
    keys: string[];
    description: string;
    category: ShortcutCategory;
    isCustom?: boolean;
    isEnabled: boolean;
}
/**
 * Shortcut action identifiers
 */
type ShortcutAction = 'nav.home' | 'nav.sessions' | 'nav.workspaces' | 'nav.agents' | 'nav.settings' | 'nav.search' | 'nav.back' | 'nav.forward' | 'session.new' | 'session.close' | 'session.save' | 'session.export' | 'session.archive' | 'session.delete' | 'session.duplicate' | 'session.share' | 'session.nextMessage' | 'session.prevMessage' | 'editor.focus' | 'editor.submit' | 'editor.newLine' | 'editor.clear' | 'editor.undo' | 'editor.redo' | 'editor.copy' | 'editor.paste' | 'select.all' | 'select.none' | 'select.invert' | 'batch.delete' | 'batch.archive' | 'batch.export' | 'batch.tag' | 'view.toggleSidebar' | 'view.toggleTheme' | 'view.zoomIn' | 'view.zoomOut' | 'view.resetZoom' | 'view.fullscreen' | 'misc.help' | 'misc.shortcuts' | 'misc.commandPalette' | 'misc.quickSwitch';
/**
 * Shortcut categories for organization
 */
type ShortcutCategory = 'navigation' | 'session' | 'editor' | 'selection' | 'batch' | 'view' | 'misc';
declare const SHORTCUT_CATEGORIES: {
    id: ShortcutCategory;
    name: string;
    description: string;
}[];
declare const DEFAULT_SHORTCUTS: Omit<KeyboardShortcut, 'id'>[];
/**
 * Format keys for display
 */
declare function formatShortcut(keys: string[]): string;
/**
 * Parse keyboard event to keys array
 */
declare function parseKeyboardEvent(event: KeyboardEvent): string[];
/**
 * Check if keyboard event matches shortcut
 */
declare function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean;

/**
 * Batch operation types
 */
type BatchOperationType = 'delete' | 'archive' | 'unarchive' | 'export' | 'tag' | 'untag' | 'move' | 'merge' | 'duplicate';
/**
 * Batch operation request
 */
interface BatchOperationRequest {
    operation: BatchOperationType;
    sessionIds: string[];
    options?: BatchOperationOptions;
}
/**
 * Operation-specific options
 */
interface BatchOperationOptions {
    exportFormat?: 'json' | 'markdown' | 'html' | 'pdf';
    exportOptions?: {
        includeMetadata?: boolean;
        includeTimestamps?: boolean;
        bundleAsZip?: boolean;
    };
    tagIds?: string[];
    targetWorkspaceId?: string;
    mergeStrategy?: 'sequential' | 'interleaved' | 'by-timestamp';
    confirmDangerous?: boolean;
    skipConfirmation?: boolean;
}
/**
 * Batch operation result
 */
interface BatchOperationResult {
    operation: BatchOperationType;
    success: boolean;
    totalCount: number;
    successCount: number;
    failedCount: number;
    skippedCount: number;
    errors: BatchOperationError[];
    results?: BatchItemResult[];
    exportUrl?: string;
    exportBlob?: Blob;
}
/**
 * Individual item result
 */
interface BatchItemResult {
    sessionId: string;
    success: boolean;
    error?: string;
    newId?: string;
}
/**
 * Batch operation error
 */
interface BatchOperationError {
    sessionId: string;
    code: string;
    message: string;
}
/**
 * Batch operation progress
 */
interface BatchOperationProgress {
    operation: BatchOperationType;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    totalCount: number;
    processedCount: number;
    currentSessionId?: string;
    startedAt: number;
    estimatedCompletionAt?: number;
}
/**
 * Selection state for batch operations
 */
interface SelectionState {
    selectedIds: Set<string>;
    lastSelectedId?: string;
    selectionMode: 'single' | 'multiple' | 'range';
    isAllSelected: boolean;
}
/**
 * Selection action types
 */
type SelectionAction = {
    type: 'select';
    id: string;
} | {
    type: 'deselect';
    id: string;
} | {
    type: 'toggle';
    id: string;
} | {
    type: 'selectRange';
    fromId: string;
    toId: string;
    allIds: string[];
} | {
    type: 'selectAll';
    ids: string[];
} | {
    type: 'deselectAll';
} | {
    type: 'invertSelection';
    allIds: string[];
};
/**
 * Selection reducer
 */
declare function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState;
/**
 * Initial selection state
 */
declare const initialSelectionState: SelectionState;

/**
 * Collaboration Types
 *
 * Types for multi-user collaboration, team workspaces, and session sharing.
 * Supports real-time presence, permissions, and collaborative features.
 */
/**
 * User profile for collaboration features
 */
interface CollaborationUser {
    id: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
    status: UserStatus;
    lastSeenAt: number;
    preferences: UserPreferences$1;
    createdAt: number;
    updatedAt: number;
}
type UserStatus = 'online' | 'away' | 'busy' | 'offline';
interface UserPreferences$1 {
    showPresence: boolean;
    allowInvitations: boolean;
    notificationSettings: NotificationPreferences;
    defaultPermission: PermissionLevel;
}
interface NotificationPreferences {
    emailNotifications: boolean;
    pushNotifications: boolean;
    sessionShared: boolean;
    teamInvitation: boolean;
    mentionNotification: boolean;
    commentNotification: boolean;
}
/**
 * Team workspace for shared sessions
 */
interface TeamWorkspace {
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
type WorkspaceVisibility = 'private' | 'internal' | 'public';
interface TeamWorkspaceSettings {
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
interface TeamMember {
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
type TeamRole = 'owner' | 'admin' | 'member' | 'viewer' | 'guest';
interface TeamPermissions {
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
interface TeamInvitation {
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
type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';
/**
 * Session share configuration
 */
interface SessionShare {
    id: string;
    sessionId: string;
    sharedBy: string;
    shareType: ShareType;
    permission: PermissionLevel;
    expiresAt?: number;
    accessCount: number;
    maxAccesses?: number;
    password?: string;
    allowDownload: boolean;
    allowCopy: boolean;
    createdAt: number;
    updatedAt: number;
}
type ShareType = 'link' | 'email' | 'team' | 'user';
type PermissionLevel = 'view' | 'comment' | 'edit' | 'admin';
/**
 * Session access record
 */
interface SessionAccess {
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
interface PermissionCheck {
    allowed: boolean;
    permission: PermissionLevel;
    reason?: string;
    source: 'owner' | 'share' | 'team' | 'direct';
}
/**
 * User presence in a session
 */
interface SessionPresence {
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
interface CursorPosition {
    messageId: string;
    offset: number;
    line?: number;
    column?: number;
}
interface SelectionRange {
    messageId: string;
    startOffset: number;
    endOffset: number;
    text?: string;
}
/**
 * Presence broadcast event
 */
interface PresenceEvent {
    type: PresenceEventType;
    sessionId: string;
    userId: string;
    timestamp: number;
    data?: Record<string, unknown>;
}
type PresenceEventType = 'user_joined' | 'user_left' | 'cursor_moved' | 'selection_changed' | 'typing_started' | 'typing_stopped' | 'viewing_message';
/**
 * Comment on a message or session
 */
interface SessionComment {
    id: string;
    sessionId: string;
    messageId?: string;
    parentId?: string;
    userId: string;
    user?: CollaborationUser;
    content: string;
    mentions: string[];
    reactions: CommentReaction[];
    resolved: boolean;
    resolvedBy?: string;
    resolvedAt?: number;
    editedAt?: number;
    createdAt: number;
    updatedAt: number;
}
interface CommentReaction {
    emoji: string;
    userIds: string[];
    count: number;
}
/**
 * Mention in a comment
 */
interface Mention {
    userId: string;
    displayName: string;
    startIndex: number;
    endIndex: number;
}
/**
 * Collaboration activity event
 */
interface CollaborationActivity {
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
type ActivityType = 'team_created' | 'team_updated' | 'team_deleted' | 'member_invited' | 'member_joined' | 'member_removed' | 'member_role_changed' | 'session_shared' | 'session_unshared' | 'session_accessed' | 'session_permission_changed' | 'comment_added' | 'comment_edited' | 'comment_deleted' | 'comment_resolved' | 'mention_created';
/**
 * Collaborative editing operation (for OT/CRDT)
 */
interface EditOperation {
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
type EditOperationType = 'insert' | 'delete' | 'retain';
/**
 * Version vector for conflict resolution
 */
interface VersionVector {
    [userId: string]: number;
}
/**
 * Sync state for a collaborative session
 */
interface CollaborationSyncState {
    sessionId: string;
    localVersion: string;
    serverVersion: string;
    pendingOperations: EditOperation[];
    conflictingOperations: EditOperation[];
    lastSyncAt: number;
    syncStatus: 'synced' | 'syncing' | 'pending' | 'conflict';
}
/**
 * Create team request
 */
interface CreateTeamRequest {
    name: string;
    description?: string;
    visibility: WorkspaceVisibility;
    settings?: Partial<TeamWorkspaceSettings>;
}
/**
 * Invite member request
 */
interface InviteMemberRequest {
    email: string;
    role: TeamRole;
    message?: string;
}
/**
 * Share session request
 */
interface ShareSessionRequest {
    sessionId: string;
    shareType: ShareType;
    permission: PermissionLevel;
    recipients?: string[];
    expiresIn?: number;
    maxAccesses?: number;
    password?: string;
    allowDownload?: boolean;
    allowCopy?: boolean;
    message?: string;
}
/**
 * Update permission request
 */
interface UpdatePermissionRequest {
    accessId: string;
    permission: PermissionLevel;
    expiresAt?: number;
}
/**
 * Collaboration WebSocket message
 */
interface CollaborationMessage {
    type: CollaborationMessageType;
    sessionId?: string;
    teamId?: string;
    payload: unknown;
    timestamp: number;
}
type CollaborationMessageType = 'presence_update' | 'presence_sync' | 'edit_operation' | 'edit_ack' | 'edit_conflict' | 'comment_added' | 'comment_updated' | 'comment_deleted' | 'notification' | 'mention' | 'sync_request' | 'sync_response' | 'version_update';
/**
 * Default team permissions by role
 */
declare const DEFAULT_TEAM_PERMISSIONS: Record<TeamRole, TeamPermissions>;
/**
 * Permission level hierarchy
 */
declare const PERMISSION_HIERARCHY: PermissionLevel[];
/**
 * Check if a permission level includes another
 */
declare function hasPermission(userPermission: PermissionLevel, requiredPermission: PermissionLevel): boolean;
/**
 * Presence colors for user avatars
 */
declare const PRESENCE_COLORS: readonly [{
    readonly name: "Red";
    readonly value: "#ef4444";
}, {
    readonly name: "Orange";
    readonly value: "#f97316";
}, {
    readonly name: "Amber";
    readonly value: "#f59e0b";
}, {
    readonly name: "Yellow";
    readonly value: "#eab308";
}, {
    readonly name: "Lime";
    readonly value: "#84cc16";
}, {
    readonly name: "Green";
    readonly value: "#22c55e";
}, {
    readonly name: "Emerald";
    readonly value: "#10b981";
}, {
    readonly name: "Teal";
    readonly value: "#14b8a6";
}, {
    readonly name: "Cyan";
    readonly value: "#06b6d4";
}, {
    readonly name: "Sky";
    readonly value: "#0ea5e9";
}, {
    readonly name: "Blue";
    readonly value: "#3b82f6";
}, {
    readonly name: "Indigo";
    readonly value: "#6366f1";
}, {
    readonly name: "Violet";
    readonly value: "#8b5cf6";
}, {
    readonly name: "Purple";
    readonly value: "#a855f7";
}, {
    readonly name: "Fuchsia";
    readonly value: "#d946ef";
}, {
    readonly name: "Pink";
    readonly value: "#ec4899";
}];
/**
 * Get a consistent color for a user based on their ID
 */
declare function getUserColor(userId: string): string;
/**
 * Generate initials from display name
 */
declare function getInitials(displayName: string): string;

/**
 * Summarization Types
 *
 * Types for AI-powered session summarization and intelligent insights.
 * Supports local LLMs, cloud APIs, and configurable summarization strategies.
 */
/**
 * Summarization configuration
 */
interface SummarizationConfig {
    id: string;
    name: string;
    provider: SummarizationProvider;
    model: string;
    strategy: SummarizationStrategy;
    options: SummarizationOptions;
    isDefault: boolean;
    createdAt: number;
    updatedAt: number;
}
type SummarizationProvider = 'local' | 'openai' | 'anthropic' | 'azure' | 'foundry' | 'google' | 'custom';
type SummarizationStrategy = 'extractive' | 'abstractive' | 'hierarchical' | 'incremental' | 'comparative';
interface SummarizationOptions {
    maxTokens: number;
    temperature: number;
    topP?: number;
    includeCodeBlocks: boolean;
    includeToolCalls: boolean;
    includeFileChanges: boolean;
    languagePreference?: string;
    customPrompt?: string;
    chunkSize?: number;
    overlapSize?: number;
}
/**
 * Generated session summary
 */
interface SessionSummary {
    id: string;
    sessionId: string;
    configId: string;
    version: number;
    type: SummaryType;
    title: string;
    synopsis: string;
    sections: SummarySection[];
    keyPoints: KeyPoint[];
    codeHighlights: CodeHighlight[];
    fileChanges: FileChangeSummary[];
    decisions: Decision[];
    actionItems: ActionItem[];
    tags: string[];
    sentiment?: SentimentAnalysis;
    metrics: SummaryMetrics;
    generatedAt: number;
    expiresAt?: number;
}
type SummaryType = 'brief' | 'standard' | 'detailed' | 'technical' | 'executive';
/**
 * Section of a detailed summary
 */
interface SummarySection {
    id: string;
    title: string;
    content: string;
    messageRange: {
        startId: string;
        endId: string;
        count: number;
    };
    importance: ImportanceLevel;
    topics: string[];
}
type ImportanceLevel = 'low' | 'medium' | 'high' | 'critical';
/**
 * Key point extracted from session
 */
interface KeyPoint {
    id: string;
    content: string;
    messageId: string;
    category: KeyPointCategory;
    confidence: number;
}
type KeyPointCategory = 'requirement' | 'decision' | 'problem' | 'solution' | 'insight' | 'question' | 'action';
/**
 * Code highlight from session
 */
interface CodeHighlight {
    id: string;
    messageId: string;
    language: string;
    code: string;
    description: string;
    purpose: CodePurpose;
    filePath?: string;
    lineRange?: {
        start: number;
        end: number;
    };
}
type CodePurpose = 'implementation' | 'fix' | 'refactor' | 'example' | 'test' | 'configuration';
/**
 * File change summary
 */
interface FileChangeSummary {
    filePath: string;
    changeType: 'created' | 'modified' | 'deleted' | 'renamed';
    description: string;
    linesAdded: number;
    linesRemoved: number;
    messageIds: string[];
}
/**
 * Decision made during session
 */
interface Decision {
    id: string;
    content: string;
    rationale?: string;
    messageId: string;
    alternatives?: string[];
    impact: ImportanceLevel;
}
/**
 * Action item extracted from session
 */
interface ActionItem {
    id: string;
    content: string;
    messageId: string;
    status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
    priority: ImportanceLevel;
    assignee?: string;
    dueDate?: number;
}
/**
 * Sentiment analysis of session
 */
interface SentimentAnalysis {
    overall: SentimentScore;
    progression: SentimentScore[];
    frustrationPoints: string[];
    successPoints: string[];
}
interface SentimentScore {
    positive: number;
    negative: number;
    neutral: number;
    label: 'positive' | 'negative' | 'neutral' | 'mixed';
}
/**
 * Summary generation metrics
 */
interface SummaryMetrics {
    inputTokens: number;
    outputTokens: number;
    processingTimeMs: number;
    messagesCovered: number;
    compressionRatio: number;
}
/**
 * Incremental summary state
 */
interface IncrementalSummaryState {
    sessionId: string;
    currentSummary: SessionSummary;
    lastProcessedMessageId: string;
    lastProcessedMessageIndex: number;
    pendingMessages: number;
    updateScheduledAt?: number;
    history: SummaryVersion[];
}
interface SummaryVersion {
    version: number;
    summaryId: string;
    messageCount: number;
    createdAt: number;
}
/**
 * Summary update trigger
 */
interface SummaryUpdateTrigger {
    type: 'message_count' | 'time_elapsed' | 'topic_change' | 'manual';
    threshold?: number;
    enabled: boolean;
}
/**
 * Comparison between sessions
 */
interface SessionComparison {
    id: string;
    sessionIds: string[];
    commonTopics: string[];
    uniqueTopics: Record<string, string[]>;
    similarityScore: number;
    keyDifferences: ComparisonDifference[];
    insights: string[];
    generatedAt: number;
}
interface ComparisonDifference {
    category: string;
    sessionA: string;
    sessionB: string;
    description: string;
}
/**
 * Extracted topic
 */
interface ExtractedTopic {
    id: string;
    name: string;
    description?: string;
    frequency: number;
    firstMentionId: string;
    lastMentionId: string;
    relatedTopics: string[];
    confidence: number;
}
/**
 * Extracted entity
 */
interface ExtractedEntity {
    id: string;
    name: string;
    type: EntityType;
    mentions: EntityMention[];
    metadata?: Record<string, unknown>;
}
type EntityType = 'file' | 'function' | 'class' | 'variable' | 'package' | 'url' | 'person' | 'organization' | 'technology';
interface EntityMention {
    messageId: string;
    startIndex: number;
    endIndex: number;
    context: string;
}
/**
 * Custom summary template
 */
interface SummaryTemplate {
    id: string;
    name: string;
    description?: string;
    type: SummaryType;
    systemPrompt: string;
    userPromptTemplate: string;
    outputSchema?: Record<string, unknown>;
    variables: TemplateVariable[];
    isBuiltIn: boolean;
    createdAt: number;
    updatedAt: number;
}
interface TemplateVariable {
    name: string;
    description: string;
    type: 'string' | 'number' | 'boolean' | 'array';
    required: boolean;
    defaultValue?: unknown;
}
/**
 * Generate summary request
 */
interface GenerateSummaryRequest {
    sessionId: string;
    type?: SummaryType;
    configId?: string;
    templateId?: string;
    options?: Partial<SummarizationOptions>;
    messageRange?: {
        startId?: string;
        endId?: string;
    };
    forceRegenerate?: boolean;
}
/**
 * Generate summary response
 */
interface GenerateSummaryResponse {
    summary: SessionSummary;
    cached: boolean;
    processingTime: number;
    warnings?: string[];
}
/**
 * Compare sessions request
 */
interface CompareSessionsRequest {
    sessionIds: string[];
    focusAreas?: string[];
}
/**
 * Batch summarization request
 */
interface BatchSummarizeRequest {
    sessionIds: string[];
    type: SummaryType;
    configId?: string;
    concurrency?: number;
}
interface BatchSummarizeProgress {
    total: number;
    completed: number;
    failed: number;
    currentSessionId?: string;
}
/**
 * Local LLM provider config
 */
interface LocalLLMConfig {
    type: 'ollama' | 'lmstudio' | 'llamacpp' | 'custom';
    endpoint: string;
    model: string;
    contextLength: number;
}
/**
 * Cloud provider config
 */
interface CloudProviderConfig {
    provider: SummarizationProvider;
    apiKey?: string;
    endpoint?: string;
    model: string;
    organization?: string;
    project?: string;
}
/**
 * Default summarization options
 */
declare const DEFAULT_SUMMARIZATION_OPTIONS: SummarizationOptions;
/**
 * Summary type configurations
 */
declare const SUMMARY_TYPE_CONFIG: Record<SummaryType, {
    maxTokens: number;
    temperature: number;
    description: string;
}>;
/**
 * Built-in summary templates
 */
declare const BUILT_IN_TEMPLATES: Pick<SummaryTemplate, 'id' | 'name' | 'type'>[];
/**
 * Estimate tokens for a message
 */
declare function estimateTokens(text: string): number;
/**
 * Calculate compression ratio
 */
declare function calculateCompressionRatio(inputTokens: number, outputTokens: number): number;

/**
 * Semantic Search Types
 *
 * Types for embedding-based semantic search, vector storage,
 * and intelligent session/message retrieval.
 */
/**
 * Embedding provider configuration
 */
interface EmbeddingConfig {
    id: string;
    name: string;
    provider: EmbeddingProvider;
    model: string;
    dimensions: number;
    maxTokens: number;
    batchSize: number;
    endpoint?: string;
    isDefault: boolean;
    createdAt: number;
    updatedAt: number;
}
type EmbeddingProvider = 'local' | 'openai' | 'azure' | 'foundry' | 'cohere' | 'voyage' | 'ollama' | 'huggingface' | 'custom';
/**
 * Embedding model info
 */
interface EmbeddingModelInfo {
    provider: EmbeddingProvider;
    model: string;
    dimensions: number;
    maxTokens: number;
    description: string;
    costPer1kTokens?: number;
}
type VectorStoreType = 'memory' | 'sqlite-vec' | 'chromadb' | 'qdrant' | 'pinecone' | 'weaviate' | 'milvus' | 'pgvector';
interface IndexSettings {
    indexType: IndexType;
    metric: DistanceMetric;
    efConstruction?: number;
    efSearch?: number;
    m?: number;
    nlist?: number;
    nprobe?: number;
}
type IndexType = 'flat' | 'hnsw' | 'ivf' | 'pq' | 'hybrid';
type DistanceMetric = 'cosine' | 'euclidean' | 'dot' | 'manhattan';
/**
 * Document embedding
 */
interface Embedding {
    id: string;
    vector: number[];
    documentType: EmbeddableType;
    documentId: string;
    content: string;
    contentHash: string;
    metadata: EmbeddingMetadata;
    configId: string;
    createdAt: number;
    updatedAt: number;
}
type EmbeddableType = 'session' | 'message' | 'summary' | 'code_block' | 'file_change' | 'comment' | 'annotation';
interface EmbeddingMetadata {
    sessionId: string;
    workspaceId?: string;
    messageId?: string;
    role?: string;
    model?: string;
    language?: string;
    filePath?: string;
    timestamp: number;
    tokenCount: number;
    chunkIndex?: number;
    totalChunks?: number;
    tags?: string[];
}
/**
 * Chunked content for embedding
 */
interface EmbeddingChunk {
    id: string;
    parentId: string;
    content: string;
    startIndex: number;
    endIndex: number;
    chunkIndex: number;
    totalChunks: number;
    overlap: number;
}
/**
 * Semantic search query
 */
interface SemanticSearchQuery {
    text: string;
    embedding?: number[];
    filters?: SearchFilters;
    options?: SearchOptions;
}
interface SearchFilters {
    documentTypes?: EmbeddableType[];
    sessionIds?: string[];
    workspaceIds?: string[];
    providers?: string[];
    dateRange?: {
        start?: number;
        end?: number;
    };
    tags?: string[];
    models?: string[];
    languages?: string[];
    hasCode?: boolean;
    hasFileChanges?: boolean;
    minScore?: number;
}
interface SearchOptions {
    limit?: number;
    offset?: number;
    includeMetadata?: boolean;
    includeContent?: boolean;
    includeHighlights?: boolean;
    rerank?: boolean;
    rerankModel?: string;
    hybridWeight?: number;
    groupBy?: GroupByOption;
    deduplicate?: boolean;
}
type GroupByOption = 'session' | 'workspace' | 'date' | 'none';
/**
 * Semantic search result
 */
interface SemanticSearchResult {
    id: string;
    documentType: EmbeddableType;
    documentId: string;
    score: number;
    rerankScore?: number;
    content: string;
    highlights?: SearchHighlight[];
    metadata: EmbeddingMetadata;
    session?: SearchResultSession;
}
interface SearchHighlight {
    field: string;
    snippet: string;
    matchPositions: Array<{
        start: number;
        end: number;
    }>;
}
interface SearchResultSession {
    id: string;
    title: string;
    provider: string;
    workspaceId: string;
    workspaceName?: string;
    messageCount: number;
    createdAt: number;
}
/**
 * Grouped search results
 */
interface GroupedSearchResults {
    groups: SearchResultGroup[];
    totalResults: number;
    totalGroups: number;
    queryEmbedding?: number[];
}
interface SearchResultGroup {
    key: string;
    label: string;
    results: SemanticSearchResult[];
    topScore: number;
    totalInGroup: number;
}
/**
 * Hybrid search combines semantic and keyword search
 */
interface HybridSearchQuery {
    text: string;
    semanticWeight: number;
    keywordBoosts?: KeywordBoost[];
    filters?: SearchFilters;
    options?: SearchOptions;
}
interface KeywordBoost {
    keyword: string;
    boost: number;
    field?: string;
}
/**
 * Hybrid search result with both scores
 */
interface HybridSearchResult extends SemanticSearchResult {
    keywordScore: number;
    semanticScore: number;
    combinedScore: number;
    matchedKeywords?: string[];
}
/**
 * Find similar documents request
 */
interface FindSimilarRequest {
    documentType: EmbeddableType;
    documentId: string;
    embedding?: number[];
    limit?: number;
    minScore?: number;
    excludeSameSession?: boolean;
    filters?: SearchFilters;
}
/**
 * Similar document result
 */
interface SimilarDocument {
    documentType: EmbeddableType;
    documentId: string;
    similarity: number;
    content: string;
    metadata: EmbeddingMetadata;
}
/**
 * Index status and statistics
 */
interface VectorIndexStatus {
    storeId: string;
    storeName: string;
    storeType: VectorStoreType;
    documentCount: number;
    embeddingCount: number;
    dimensionality: number;
    indexSize: number;
    lastIndexedAt?: number;
    isIndexing: boolean;
    pendingDocuments: number;
    health: IndexHealth;
}
type IndexHealth = 'healthy' | 'degraded' | 'unhealthy' | 'rebuilding';
/**
 * Index build progress
 */
interface IndexBuildProgress {
    storeId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    totalDocuments: number;
    processedDocuments: number;
    failedDocuments: number;
    startedAt: number;
    estimatedCompletionAt?: number;
    currentDocument?: string;
    errors?: string[];
}
/**
 * Index rebuild request
 */
interface RebuildIndexRequest {
    storeId: string;
    filters?: {
        documentTypes?: EmbeddableType[];
        sessionIds?: string[];
        dateRange?: {
            start?: number;
            end?: number;
        };
    };
    force?: boolean;
}
/**
 * Batch embed request
 */
interface BatchEmbedRequest {
    documents: EmbedDocument[];
    configId?: string;
    storeId?: string;
    upsert?: boolean;
}
interface EmbedDocument {
    id: string;
    content: string;
    documentType: EmbeddableType;
    metadata: Partial<EmbeddingMetadata>;
}
/**
 * Batch embed response
 */
interface BatchEmbedResponse {
    embedded: number;
    failed: number;
    errors?: Array<{
        id: string;
        error: string;
    }>;
    processingTime: number;
}
/**
 * Search analytics
 */
interface SearchAnalytics {
    queryId: string;
    query: string;
    timestamp: number;
    resultCount: number;
    topScore: number;
    processingTimeMs: number;
    filters: SearchFilters;
    clickedResults?: string[];
}
/**
 * Popular search queries
 */
interface PopularQuery {
    query: string;
    count: number;
    avgResultCount: number;
    avgTopScore: number;
    lastSearchedAt: number;
}
/**
 * Search request
 */
interface SearchRequest {
    query: string;
    type?: 'semantic' | 'keyword' | 'hybrid';
    filters?: SearchFilters;
    options?: SearchOptions;
}
/**
 * Search response
 */
interface SearchResponse {
    results: SemanticSearchResult[];
    total: number;
    hasMore: boolean;
    queryId: string;
    processingTime: number;
    queryEmbedding?: number[];
}
/**
 * Suggest completions request
 */
interface SuggestRequest {
    prefix: string;
    limit?: number;
    filters?: SearchFilters;
}
/**
 * Suggestion result
 */
interface Suggestion {
    text: string;
    score: number;
    type: 'recent' | 'popular' | 'semantic';
    metadata?: Record<string, unknown>;
}
/**
 * Popular embedding models
 */
declare const EMBEDDING_MODELS: EmbeddingModelInfo[];
/**
 * Default search options
 */
declare const DEFAULT_SEARCH_OPTIONS: Required<SearchOptions>;
/**
 * Default index settings
 */
declare const DEFAULT_INDEX_SETTINGS: IndexSettings;
/**
 * Chunking defaults
 */
declare const CHUNKING_DEFAULTS: {
    chunkSize: number;
    chunkOverlap: number;
    minChunkSize: number;
    separators: string[];
};
/**
 * Calculate cosine similarity
 */
declare function cosineSimilarity(a: number[], b: number[]): number;
/**
 * Normalize a vector to unit length
 */
declare function normalizeVector(vector: number[]): number[];
/**
 * Chunk text for embedding
 */
declare function chunkText(text: string, options?: {
    chunkSize?: number;
    overlap?: number;
    separators?: string[];
}): string[];

/**
 * Custom Tagging and Organization Types
 *
 * Types for session tagging, categorization, collections, and smart organization.
 */
/**
 * Tag color options for visual organization
 */
type TagColor = 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'indigo' | 'purple' | 'pink' | 'gray';
/**
 * Tag visibility scope
 */
type TagScope = 'personal' | 'team' | 'organization' | 'public';
/**
 * A tag that can be applied to sessions
 */
interface Tag {
    /** Unique tag identifier */
    id: string;
    /** Tag name (display text) */
    name: string;
    /** Optional tag description */
    description?: string;
    /** Tag color for visual identification */
    color: TagColor;
    /** Tag icon (emoji or icon name) */
    icon?: string;
    /** Visibility scope */
    scope: TagScope;
    /** Owner user ID (for personal tags) */
    ownerId?: string;
    /** Team ID (for team tags) */
    teamId?: string;
    /** Parent tag ID for hierarchical tags */
    parentId?: string;
    /** Number of sessions with this tag */
    usageCount: number;
    /** When the tag was created */
    createdAt: string;
    /** When the tag was last used */
    lastUsedAt?: string;
    /** Whether this is a system-generated tag */
    isSystem: boolean;
    /** Keyboard shortcut for quick tagging */
    shortcut?: string;
}
/**
 * Tag with hierarchy information
 */
interface TagWithHierarchy extends Tag {
    /** Child tags */
    children: TagWithHierarchy[];
    /** Full path from root (e.g., "work/projects/frontend") */
    path: string;
    /** Depth in hierarchy (0 = root) */
    depth: number;
}
/**
 * Tag assignment to a session
 */
interface TagAssignment {
    /** Assignment ID */
    id: string;
    /** Tag ID */
    tagId: string;
    /** Session ID */
    sessionId: string;
    /** User who applied the tag */
    assignedBy: string;
    /** When the tag was applied */
    assignedAt: string;
    /** Optional note about why this tag was applied */
    note?: string;
}
/**
 * Bulk tag operation
 */
interface BulkTagOperation {
    /** Operation type */
    operation: 'add' | 'remove' | 'replace';
    /** Tag IDs to apply */
    tagIds: string[];
    /** Session IDs to modify */
    sessionIds: string[];
    /** Replace all existing tags (only for 'replace' operation) */
    replaceAll?: boolean;
}
/**
 * Collection type for organizing sessions
 */
type CollectionType = 'manual' | 'smart' | 'favorite' | 'archive' | 'recent' | 'shared';
/**
 * A collection of sessions
 */
interface Collection {
    /** Unique collection identifier */
    id: string;
    /** Collection name */
    name: string;
    /** Collection description */
    description?: string;
    /** Collection type */
    type: CollectionType;
    /** Collection icon */
    icon?: string;
    /** Collection color */
    color?: TagColor;
    /** Owner user ID */
    ownerId: string;
    /** Team ID if team collection */
    teamId?: string;
    /** Parent collection ID for nested collections */
    parentId?: string;
    /** Smart filter rules (for smart collections) */
    smartRules?: SmartCollectionRules;
    /** Sort order for sessions in collection */
    sortOrder: CollectionSortOrder;
    /** Number of sessions in collection */
    sessionCount: number;
    /** When the collection was created */
    createdAt: string;
    /** When the collection was last modified */
    updatedAt: string;
    /** Display order in sidebar */
    displayOrder: number;
    /** Whether collection is pinned */
    isPinned: boolean;
    /** Whether collection is expanded in sidebar */
    isExpanded: boolean;
}
/**
 * Sort order options for collections
 */
interface CollectionSortOrder {
    /** Field to sort by */
    field: 'createdAt' | 'updatedAt' | 'title' | 'messageCount' | 'addedAt' | 'custom';
    /** Sort direction */
    direction: 'asc' | 'desc';
}
/**
 * Session membership in a collection
 */
interface CollectionMembership {
    /** Membership ID */
    id: string;
    /** Collection ID */
    collectionId: string;
    /** Session ID */
    sessionId: string;
    /** When the session was added */
    addedAt: string;
    /** Who added the session */
    addedBy: string;
    /** Custom sort position (for manual ordering) */
    sortPosition?: number;
    /** Optional note */
    note?: string;
}
/**
 * Operator for filter conditions
 */
type FilterOperator = 'equals' | 'notEquals' | 'contains' | 'notContains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'greaterOrEqual' | 'lessOrEqual' | 'between' | 'in' | 'notIn' | 'isEmpty' | 'isNotEmpty' | 'matches';
/**
 * Field types that can be filtered
 */
type FilterableField = 'title' | 'provider' | 'workspace' | 'createdAt' | 'updatedAt' | 'messageCount' | 'tags' | 'hasAttachments' | 'hasCode' | 'language' | 'sentiment' | 'duration' | 'tokenCount' | 'isStarred' | 'isArchived' | 'sharedWith' | 'createdBy';
/**
 * A single filter condition
 */
interface FilterCondition {
    /** Field to filter on */
    field: FilterableField;
    /** Filter operator */
    operator: FilterOperator;
    /** Value to compare against */
    value: string | number | boolean | string[] | [number, number];
}
/**
 * Group of conditions with logical operator
 */
interface FilterGroup {
    /** Logical operator between conditions */
    logic: 'and' | 'or';
    /** Conditions in this group */
    conditions: (FilterCondition | FilterGroup)[];
}
/**
 * Rules for smart collections
 */
interface SmartCollectionRules {
    /** Root filter group */
    filters: FilterGroup;
    /** Maximum number of sessions to include */
    limit?: number;
    /** How often to refresh (in minutes, 0 = real-time) */
    refreshInterval: number;
    /** Last time the collection was refreshed */
    lastRefreshed?: string;
}
/**
 * A folder for organizing collections and sessions
 */
interface Folder {
    /** Unique folder identifier */
    id: string;
    /** Folder name */
    name: string;
    /** Folder icon */
    icon?: string;
    /** Folder color */
    color?: TagColor;
    /** Parent folder ID */
    parentId?: string;
    /** Owner user ID */
    ownerId: string;
    /** Team ID if shared folder */
    teamId?: string;
    /** Display order */
    displayOrder: number;
    /** Whether folder is expanded */
    isExpanded: boolean;
    /** When created */
    createdAt: string;
    /** When last modified */
    updatedAt: string;
}
/**
 * Folder with children for tree display
 */
interface FolderTree extends Folder {
    /** Child folders */
    children: FolderTree[];
    /** Collections in this folder */
    collections: Collection[];
    /** Direct session count (not in collections) */
    sessionCount: number;
    /** Full path */
    path: string;
    /** Depth in tree */
    depth: number;
}
/**
 * Auto-tagging rule
 */
interface AutoTagRule {
    /** Rule ID */
    id: string;
    /** Rule name */
    name: string;
    /** Rule description */
    description?: string;
    /** Whether rule is active */
    isActive: boolean;
    /** Conditions that trigger the rule */
    conditions: FilterGroup;
    /** Tags to apply when conditions match */
    tagIds: string[];
    /** Collection to add to (optional) */
    collectionId?: string;
    /** Priority (higher = runs first) */
    priority: number;
    /** Owner user ID */
    ownerId: string;
    /** When created */
    createdAt: string;
    /** How many times the rule has been applied */
    applyCount: number;
}
/**
 * Tag suggestion from AI
 */
interface TagSuggestion {
    /** Suggested tag */
    tag: Tag | {
        name: string;
        color: TagColor;
    };
    /** Confidence score (0-1) */
    confidence: number;
    /** Reason for suggestion */
    reason: string;
    /** Whether this is an existing tag or new suggestion */
    isExisting: boolean;
}
/**
 * Session analysis for tag suggestions
 */
interface SessionTagAnalysis {
    /** Session ID */
    sessionId: string;
    /** Suggested tags */
    suggestions: TagSuggestion[];
    /** Detected topics */
    topics: string[];
    /** Detected technologies/languages */
    technologies: string[];
    /** Detected intent (debug, learn, build, etc.) */
    intent?: string;
    /** Analysis timestamp */
    analyzedAt: string;
}
/**
 * View mode for session lists
 */
type ViewMode = 'list' | 'grid' | 'timeline' | 'kanban' | 'calendar';
/**
 * Grouping options for session lists
 */
type GroupBy = 'none' | 'date' | 'week' | 'month' | 'provider' | 'workspace' | 'tag' | 'collection' | 'status';
/**
 * User's organization preferences
 */
interface OrganizationPreferences {
    /** User ID */
    userId: string;
    /** Default view mode */
    defaultViewMode: ViewMode;
    /** Default grouping */
    defaultGroupBy: GroupBy;
    /** Default sort order */
    defaultSortOrder: CollectionSortOrder;
    /** Show archived sessions */
    showArchived: boolean;
    /** Show shared sessions */
    showShared: boolean;
    /** Sidebar width */
    sidebarWidth: number;
    /** Pinned tags for quick access */
    pinnedTagIds: string[];
    /** Pinned collections for quick access */
    pinnedCollectionIds: string[];
    /** Recently used tags (for suggestions) */
    recentTagIds: string[];
    /** Auto-tagging enabled */
    autoTaggingEnabled: boolean;
    /** Tag suggestions enabled */
    tagSuggestionsEnabled: boolean;
    /** Compact mode */
    compactMode: boolean;
}
/**
 * Tag-related event types
 */
type TagEventType = 'tag:created' | 'tag:updated' | 'tag:deleted' | 'tag:assigned' | 'tag:unassigned' | 'tag:merged';
/**
 * Collection-related event types
 */
type CollectionEventType = 'collection:created' | 'collection:updated' | 'collection:deleted' | 'collection:session_added' | 'collection:session_removed' | 'collection:reordered';
/**
 * Organization event
 */
interface OrganizationEvent {
    /** Event type */
    type: TagEventType | CollectionEventType;
    /** Event timestamp */
    timestamp: string;
    /** User who triggered the event */
    userId: string;
    /** Event payload */
    payload: Record<string, unknown>;
}
/**
 * Available tag colors with their hex values
 */
declare const TAG_COLOR_STYLES: Record<TagColor, {
    bg: string;
    text: string;
    border: string;
}>;
/**
 * Dark mode tag colors
 */
declare const TAG_COLOR_STYLES_DARK: Record<TagColor, {
    bg: string;
    text: string;
    border: string;
}>;
/**
 * Default system tags
 */
declare const SYSTEM_TAGS: Partial<Tag>[];
/**
 * Default smart collections
 */
declare const DEFAULT_SMART_COLLECTIONS: Partial<Collection>[];
/**
 * Get tag color styles based on theme
 */
declare function getTagColorStyles(color: TagColor, isDarkMode: boolean): {
    bg: string;
    text: string;
    border: string;
};
/**
 * Build a tag path from hierarchy
 */
declare function buildTagPath(tag: Tag, allTags: Tag[]): string;
/**
 * Build a folder tree from flat folder list
 */
declare function buildFolderTree(folders: Folder[], collections: Collection[], parentId?: string, depth?: number): FolderTree[];
/**
 * Evaluate a filter condition against a session
 */
declare function evaluateCondition(condition: FilterCondition, sessionValue: unknown): boolean;
/**
 * Generate a unique tag ID
 */
declare function generateTagId(): string;
/**
 * Generate a unique collection ID
 */
declare function generateCollectionId(): string;

/**
 * Workspace representing a VS Code workspace or project directory
 */
interface Workspace {
    id: string;
    name: string;
    path: string | null;
    provider: string;
    providerWorkspaceId?: string | null;
    sessionCount?: number;
    createdAt: number;
    updatedAt: number;
    metadata?: Record<string, unknown> | null;
}
/**
 * Chat session containing messages
 */
interface Session {
    id: string;
    workspaceId: string | null;
    workspaceName?: string | null;
    provider: string;
    providerSessionId?: string | null;
    title: string;
    model?: string | null;
    messageCount: number;
    tokenCount?: number | null;
    createdAt: number;
    updatedAt: number;
    archived?: boolean;
    metadata?: Record<string, unknown> | null;
}
/**
 * Message within a session
 */
interface Message {
    id: string;
    index?: number;
    sessionId?: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    contentRaw?: string;
    model?: string | null;
    modelId?: string | null;
    requestId?: string;
    responseId?: string;
    tokenCount?: number | null;
    createdAt: number;
    isCanceled?: boolean;
    toolInvocations?: ToolInvocation[];
    variableData?: unknown;
    contentReferences?: unknown[];
    codeCitations?: unknown[];
    metadata?: Record<string, unknown> | null;
}
/**
 * Tool invocation within a message
 */
interface ToolInvocation {
    toolName: string;
    toolCallId?: string;
    invocationIndex?: number;
    status?: 'pending' | 'running' | 'complete' | 'error';
    isComplete?: boolean;
    isConfirmed?: boolean | null;
    invocationMessage?: string | {
        value?: string;
        [key: string]: unknown;
    };
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    toolSpecificData?: unknown;
    fileChanges?: FileChange[];
    timestamp?: number;
}
/**
 * File change from a tool invocation
 */
interface FileChange {
    type: 'file_edit' | 'file_create' | 'file_delete' | 'terminal_command' | 'notebook_edit' | string;
    filePath?: string;
    command?: string;
    oldString?: string;
    newString?: string;
    oldContent?: string;
    newContent?: string;
    diffUnified?: string;
    output?: unknown;
    exitCode?: number;
    lineStart?: number;
    lineEnd?: number;
    data?: unknown;
}
/**
 * Session with full message history
 */
interface SessionWithMessages extends Session {
    messages: Message[];
    toolInvocations?: ToolInvocation[];
    fileChanges?: FileChange[];
}
/**
 * Checkpoint/snapshot of a session
 */
interface Checkpoint {
    id: string;
    sessionId: string;
    name: string;
    description?: string | null;
    messageId?: string | null;
    gitCommit?: string | null;
    gitBranch?: string | null;
    createdAt: number;
    metadata?: Record<string, unknown> | null;
}
/**
 * Share link for a session
 */
interface ShareLink {
    id: string;
    sessionId: string;
    provider: ShareLinkProvider;
    url: string;
    expiresAt?: number | null;
    createdAt: number;
}
type ShareLinkProvider = 'github_gist' | 'pastebin' | 'hastebin' | 'chatgpt' | 'claude' | 'custom';
/**
 * Model provider type - matches Rust Agency ModelProvider enum
 * Includes both cloud and local LLM providers
 */
type ModelProvider = 'google' | 'openai' | 'anthropic' | 'azure' | 'groq' | 'together' | 'fireworks' | 'deepseek' | 'mistral' | 'cohere' | 'perplexity' | 'ollama' | 'lmstudio' | 'jan' | 'gpt4all' | 'localai' | 'llamafile' | 'textgenwebui' | 'vllm' | 'koboldcpp' | 'tabbyml' | 'exo' | 'openai_compatible' | 'custom';
/**
 * Model configuration - matches Rust Agency ModelConfig
 */
interface ModelConfig {
    model: string;
    provider: ModelProvider;
    endpoint?: string | null;
    apiKey?: string | null;
    temperature?: number;
    maxTokens?: number | null;
    topP?: number | null;
}
/**
 * LLM provider configuration
 */
interface Provider {
    id: string;
    name: string;
    type: ProviderType;
    icon?: string;
    color?: string;
    endpoint?: string | null;
    apiKey?: string | null;
    models: string[];
    status: ProviderStatus;
    /**
     * Whether the user has this provider switched on.
     *
     * Sent by `GET /api/providers` and written by `PUT /api/providers/{id}`.
     * Distinct from the optional `settings.enabled` below, which the server
     * does not send: reading the nested one is what made every provider look
     * switched off.
     */
    enabled: boolean;
    settings?: ProviderSettings;
}
type ProviderType = 'local' | 'cloud';
type ProviderStatus = 'connected' | 'disconnected' | 'error' | 'unknown';
interface ProviderSettings {
    enabled: boolean;
    priority?: number;
    timeout?: number;
    maxTokens?: number | null;
    temperature?: number | null;
}
/**
 * Provider health check result
 */
interface ProviderHealth {
    providerId: string;
    status: ProviderStatus;
    latency?: number | null;
    lastChecked: number;
    error?: string | null;
    version?: string | null;
    models: string[];
}
/**
 * Input/output modality types
 */
type Modality = 'text' | 'image' | 'video' | 'audio' | 'point_cloud' | 'action' | 'sensor' | 'depth' | 'segmentation' | 'bounding_box' | 'pose' | 'trajectory';
/**
 * Model category by capabilities
 */
type ModelCategory = 'llm' | 'vlm' | 'vla' | 'alm' | 'valm' | 'multimodal' | 'embodied';
/**
 * Modality capabilities for a model
 */
interface ModalityCapabilities {
    category: ModelCategory;
    inputModalities: Modality[];
    outputModalities: Modality[];
    supportsStreaming: boolean;
    supportsRealtime: boolean;
    maxImageSize?: number | null;
    maxVideoLength?: number | null;
    maxAudioLength?: number | null;
    supportedImageFormats: string[];
    supportedVideoFormats: string[];
    supportedAudioFormats: string[];
}
/**
 * Image format types
 */
type ImageFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'bmp' | 'tiff';
/**
 * Image content for multimodal messages
 */
interface ImageContent {
    format: ImageFormat;
    data: ImageData;
    width?: number | null;
    height?: number | null;
    altText?: string | null;
}
/**
 * Image data (URL or base64)
 */
type ImageData = {
    type: 'url';
    url: string;
} | {
    type: 'base64';
    base64: string;
};
/**
 * Video content for multimodal messages
 */
interface VideoContent {
    format: string;
    source: VideoSource;
    durationSeconds?: number | null;
    fps?: number | null;
    width?: number | null;
    height?: number | null;
}
/**
 * Video source
 */
type VideoSource = {
    type: 'url';
    url: string;
} | {
    type: 'base64';
    base64: string;
} | {
    type: 'frames';
    frames: ImageContent[];
};
/**
 * Audio format types
 */
type AudioFormat = 'mp3' | 'wav' | 'ogg' | 'flac' | 'webm' | 'pcm';
/**
 * Audio content for multimodal messages
 */
interface AudioContent {
    format: AudioFormat;
    data: AudioData;
    durationSeconds?: number | null;
    sampleRate?: number | null;
    channels?: number | null;
    transcript?: string | null;
}
/**
 * Audio data (URL or base64)
 */
type AudioData = {
    type: 'url';
    url: string;
} | {
    type: 'base64';
    base64: string;
};
/**
 * Sensor types for VLA models
 */
type SensorType = 'joint_state' | 'imu' | 'force_torque' | 'camera_rgb' | 'camera_depth' | 'lidar' | 'tactile' | 'temperature' | 'proximity' | {
    type: 'custom';
    name: string;
};
/**
 * Sensor data for VLA input
 */
interface SensorData {
    sensorType: SensorType;
    timestamp: number;
    values: SensorValues;
    frameId?: string | null;
}
/**
 * Sensor value types
 */
type SensorValues = {
    type: 'joint_state';
    positions: number[];
    velocities?: number[] | null;
    efforts?: number[] | null;
} | {
    type: 'imu';
    orientation: number[];
    angularVelocity: number[];
    linearAcceleration: number[];
} | {
    type: 'force_torque';
    force: number[];
    torque: number[];
} | {
    type: 'depth';
    data: number[];
    width: number;
    height: number;
} | {
    type: 'lidar';
    ranges: number[];
    angleMin: number;
    angleMax: number;
} | {
    type: 'tactile';
    forces: number[];
} | {
    type: 'temperature';
    value: number;
} | {
    type: 'proximity';
    distance: number;
} | {
    type: 'raw';
    data: number[];
};
/**
 * Robot joint state
 */
interface JointState {
    name: string;
    position: number;
    velocity?: number | null;
    effort?: number | null;
}
/**
 * Action types for VLA models
 */
type ActionType = 'move' | 'rotate' | 'grasp' | 'release' | 'push' | 'pull' | 'place' | 'pick' | 'move_arm' | 'move_joint' | 'velocity' | 'torque' | 'navigate' | 'look_at' | 'speak' | 'wait' | 'stop' | {
    type: 'custom';
    name: string;
};
/**
 * Action command for VLA output
 */
interface ActionCommand {
    actionType: ActionType;
    parameters: ActionParameters;
    targetObject?: string | null;
    confidence?: number | null;
    duration?: number | null;
    priority?: number;
}
/**
 * Action parameters
 */
type ActionParameters = {
    type: 'position';
    position: number[];
    velocity?: number | null;
} | {
    type: 'pose';
    position: number[];
    orientation: number[];
} | {
    type: 'joint';
    jointPositions: number[];
    jointVelocities?: number[] | null;
} | {
    type: 'velocity';
    linear: number[];
    angular: number[];
} | {
    type: 'force';
    force: number[];
    torque: number[];
} | {
    type: 'gripper';
    width: number;
    force?: number | null;
} | {
    type: 'navigation';
    goal: number[];
    constraints?: Record<string, unknown> | null;
} | {
    type: 'speech';
    text: string;
    language?: string | null;
} | {
    type: 'wait';
    duration?: number | null;
    condition?: string | null;
} | {
    type: 'custom';
    data: Record<string, unknown>;
};
/**
 * Action space types for VLA models
 */
type ActionSpaceType = 'discrete' | 'continuous' | 'hybrid';
/**
 * Action space configuration
 */
interface ActionSpace {
    spaceType: ActionSpaceType;
    dimensions?: number | null;
    actionLabels?: string[] | null;
    bounds?: ActionBounds | null;
}
/**
 * Action bounds for continuous spaces
 */
interface ActionBounds {
    low: number[];
    high: number[];
}
/**
 * Manipulator types for robot capabilities
 */
type ManipulatorType = 'parallel_gripper' | 'suction' | 'dexterous_hand' | 'soft_gripper' | 'magnetic' | {
    type: 'custom';
    name: string;
};
/**
 * Navigation capabilities
 */
type NavigationCapability = 'wheeled' | 'legged' | 'flying' | 'swimming' | 'stationary';
/**
 * Robot capabilities for VLA models
 */
interface RobotCapabilities {
    manipulators: ManipulatorType[];
    navigation?: NavigationCapability | null;
    dof: number;
    maxPayload?: number | null;
    workspace?: WorkspaceBounds | null;
    sensors: SensorType[];
    actionSpace: ActionSpace;
}
/**
 * Workspace bounds for robot
 */
interface WorkspaceBounds {
    minBounds: number[];
    maxBounds: number[];
}
/**
 * Content part for multimodal messages
 */
type ContentPart = {
    type: 'text';
    text: string;
} | {
    type: 'image';
    image: ImageContent;
} | {
    type: 'video';
    video: VideoContent;
} | {
    type: 'audio';
    audio: AudioContent;
} | {
    type: 'sensor';
    sensor: SensorData;
} | {
    type: 'action';
    action: ActionCommand;
};
/**
 * Multimodal message supporting mixed content
 */
interface MultimodalMessage {
    role: 'user' | 'assistant' | 'system';
    content: ContentPart[];
    name?: string | null;
    toolCalls?: ToolInvocation[] | null;
    actions?: ActionCommand[] | null;
    timestamp?: number | null;
}
/**
 * Multimodal model definition
 */
interface MultimodalModel {
    id: string;
    name: string;
    provider: ModelProvider;
    category: ModelCategory;
    capabilities: ModalityCapabilities;
    contextLength: number;
    description?: string | null;
    releaseDate?: string | null;
    deprecated?: boolean;
}
type AgentStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'completed' | 'failed' | 'paused';
type AgentRole = 'coordinator' | 'researcher' | 'coder' | 'reviewer' | 'executor' | 'writer' | 'tester' | 'household' | 'business' | 'custom';
type AgentAutonomy = 'none' | 'low' | 'medium' | 'high' | 'supervised';
type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
type SwarmStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';
/**
 * Permission level for proactive agents
 */
type AgentPermissionLevel = 'notify_only' | 'low_risk' | 'medium_risk' | 'high_autonomy';
/**
 * Proactive action that requires permission
 */
interface ProactiveAction {
    id: string;
    agentId: string;
    actionType: string;
    description: string;
    reasoning: string;
    estimatedImpact?: string;
    riskLevel: 'low' | 'medium' | 'high';
    status: 'pending' | 'approved' | 'rejected' | 'executed' | 'cancelled';
    autoApproved?: boolean;
    approvedAt?: number;
    approvedBy?: string;
    executedAt?: number;
    result?: string;
    error?: string;
    createdAt: number;
}
/**
 * Detected problem by proactive agent
 */
interface DetectedProblem {
    id: string;
    agentId: string;
    category: string;
    title: string;
    description: string;
    severity: 'info' | 'warning' | 'urgent' | 'critical';
    detectedAt: number;
    source: string;
    suggestedActions: ProactiveAction[];
    status: 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'dismissed';
    resolvedAt?: number;
    metadata?: Record<string, unknown>;
}
/**
 * Orchestration type - matches Rust Agency OrchestrationType
 */
type OrchestrationType = 'single' | 'sequential' | 'parallel' | 'loop' | 'hierarchical' | 'swarm' | 'debate';
/**
 * Pipeline configuration for multi-agent orchestration
 */
interface Pipeline {
    id: string;
    name: string;
    orchestration: OrchestrationType;
    agents: string[];
    maxIterations?: number;
    createdAt: number;
    updatedAt: number;
}
/**
 * AI Agent configuration
 */
interface Agent {
    id: string;
    name: string;
    role: AgentRole;
    description?: string | null;
    systemPrompt?: string;
    model?: string;
    providerId?: string;
    tools?: string[];
    capabilities?: string[];
    temperature?: number;
    maxTokens?: number | null;
    status: AgentStatus;
    currentTaskId?: string;
    messageCount?: number;
    tokensUsed?: number;
    createdAt: number;
    updatedAt: number;
    metadata?: Record<string, unknown> | null;
}
/**
 * Agent task
 */
interface AgentTask {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    assignedAgentId?: string;
    parentTaskId?: string;
    subtasks?: AgentTask[];
    result?: string;
    error?: string;
    startedAt?: number;
    completedAt?: number;
    createdAt: number;
    updatedAt: number;
}
/**
 * Memory type classification - matches Rust MemoryType
 */
type MemoryType = 'short_term' | 'long_term' | 'episodic' | 'semantic' | 'procedural' | 'preference' | 'cache';
/**
 * Source of memory entry
 */
type MemorySource = {
    type: 'conversation';
    sessionId: string;
    messageId: string;
} | {
    type: 'document';
    path: string;
    chunkIndex: number;
} | {
    type: 'user_input';
} | {
    type: 'agent_reasoning';
    agentId: string;
} | {
    type: 'tool_result';
    toolName: string;
} | {
    type: 'web_page';
    url: string;
} | {
    type: 'summary';
    sourceIds: string[];
} | {
    type: 'custom';
    sourceType: string;
};
/**
 * Memory entry - stored knowledge
 */
interface MemoryEntry {
    id: string;
    content: string;
    embedding?: number[];
    memoryType: MemoryType;
    source: MemorySource;
    importance: number;
    accessCount: number;
    lastAccessed: number;
    createdAt: number;
    expiresAt?: number;
    agentId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
    tags: string[];
}
/**
 * Search result from vector store
 */
interface VectorSearchResult {
    entry: MemoryEntry;
    score: number;
    rank: number;
}
/**
 * Embedding model options
 */
type EmbeddingModel = 'openai_small' | 'openai_large' | 'openai_ada' | 'minilm' | 'mpnet' | 'cohere' | 'google_gecko' | 'voyage' | {
    type: 'ollama';
    model: string;
} | {
    type: 'custom';
    name: string;
    dim: number;
};
/**
 * Similarity metric for vector search
 */
type SimilarityMetric = 'cosine' | 'euclidean' | 'dot_product' | 'manhattan';
/**
 * Vector store configuration
 */
interface VectorStoreConfig {
    embeddingModel: EmbeddingModel;
    embeddingDim: number;
    similarityMetric: SimilarityMetric;
    maxEntries: number;
    dbPath?: string;
}
/**
 * Document for knowledge base
 */
interface Document {
    id: string;
    title: string;
    content: string;
    docType: DocumentType;
    source: string;
    chunks: DocumentChunk[];
    createdAt: number;
    updatedAt: number;
    metadata?: Record<string, unknown>;
}
/**
 * Document types
 */
type DocumentType = 'text' | 'markdown' | {
    type: 'code';
    language: string;
} | 'html' | 'pdf' | 'json' | 'yaml' | 'csv' | {
    type: 'custom';
    mimeType: string;
};
/**
 * Document chunk for embedding
 */
interface DocumentChunk {
    index: number;
    content: string;
    startPos: number;
    endPos: number;
    embedding?: number[];
    tokenCount: number;
}
/**
 * Chunking strategy
 */
type ChunkingStrategy = 'fixed_size' | 'sentence' | 'paragraph' | 'semantic' | 'code';
/**
 * Chunking configuration
 */
interface ChunkingConfig {
    chunkSize: number;
    chunkOverlap: number;
    strategy: ChunkingStrategy;
}
/**
 * Context segment type
 */
type ContextSegmentType = 'system_prompt' | 'user_preferences' | 'conversation_history' | 'retrieved_context' | 'tool_results' | 'current_query' | {
    type: 'custom';
    name: string;
};
/**
 * Context segment for building prompts
 */
interface ContextSegment {
    segmentType: ContextSegmentType;
    content: string;
    tokens: number;
    priority: number;
    required: boolean;
}
/**
 * Memory manager configuration
 */
interface MemoryConfig {
    vectorStore: VectorStoreConfig;
    chunking: ChunkingConfig;
    contextWindowTokens: number;
    cacheSize: number;
    dbPath?: string;
    autoSummarize: boolean;
    summarizeThreshold: number;
}
/**
 * Memory statistics
 */
interface MemoryStats {
    totalEntries: number;
    entriesByType: Record<string, number>;
    totalAccessCount: number;
    avgImportance: number;
    documentCount: number;
}
/**
 * RAG (Retrieval-Augmented Generation) configuration
 */
interface RAGConfig {
    enabled: boolean;
    memoryConfig: MemoryConfig;
    retrievalLimit: number;
    minRelevanceScore: number;
    includeConversationHistory: boolean;
    maxConversationTurns: number;
}
/**
 * Remote node status
 */
type NodeStatus = 'online' | 'degraded' | 'offline' | 'maintenance' | 'unknown';
/**
 * Remote task status
 */
type RemoteTaskStatus = 'queued' | 'starting' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'timed_out';
/**
 * Task priority
 */
type TaskPriority = 'low' | 'normal' | 'high' | 'critical';
/**
 * Log level
 */
type RemoteLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';
/**
 * Hardware information for a remote node
 */
interface HardwareInfo {
    cpuCores: number;
    ramTotal: number;
    ramAvailable: number;
    gpus: GpuInfo[];
    os: string;
    arch: string;
}
/**
 * GPU information
 */
interface GpuInfo {
    name: string;
    vram: number;
    cudaVersion?: string;
}
/**
 * Remote node representing a machine running agents
 */
interface RemoteNode {
    id: string;
    name: string;
    address: string;
    status: NodeStatus;
    tags: string[];
    hardware?: HardwareInfo;
    activeAgents: number;
    runningTasks: number;
    lastHeartbeat: number;
    registeredAt: number;
    metadata?: Record<string, unknown>;
}
/**
 * Resource usage during task execution
 */
interface ResourceUsage {
    cpuPercent: number;
    memoryBytes: number;
    gpuMemoryBytes?: number;
    networkTxBytes: number;
    networkRxBytes: number;
    diskReadBytes: number;
    diskWriteBytes: number;
}
/**
 * Task log entry
 */
interface TaskLogEntry {
    timestamp: number;
    level: RemoteLogLevel;
    message: string;
    data?: unknown;
}
/**
 * Task execution metrics
 */
interface TaskMetrics {
    durationMs: number;
    tokensUsed?: number;
    apiCalls: number;
    filesProcessed: number;
    errorsRecovered: number;
    retries: number;
}
/**
 * Artifact type
 */
type ArtifactType = 'file' | 'directory' | 'url' | 'database' | 'model' | 'report' | 'log' | {
    type: 'custom';
    name: string;
};
/**
 * Task artifact (output files, etc.)
 */
interface TaskArtifact {
    name: string;
    artifactType: ArtifactType;
    location: string;
    size?: number;
    checksum?: string;
}
/**
 * Task result
 */
interface RemoteTaskResult {
    success: boolean;
    output?: unknown;
    artifacts: TaskArtifact[];
    metrics: TaskMetrics;
}
/**
 * Remote task running on a node
 */
interface RemoteTask {
    id: string;
    nodeId: string;
    agentId: string;
    agentName: string;
    title: string;
    description?: string;
    status: RemoteTaskStatus;
    progress: number;
    progressMessage?: string;
    currentStep?: number;
    totalSteps?: number;
    priority: TaskPriority;
    startedAt: number;
    completedAt?: number;
    eta?: number;
    result?: RemoteTaskResult;
    error?: string;
    resources: ResourceUsage;
    logs: TaskLogEntry[];
    metadata?: Record<string, unknown>;
}
/**
 * Remote monitor configuration
 */
interface RemoteMonitorConfig {
    bindAddress: string;
    port: number;
    tlsEnabled: boolean;
    tlsCertPath?: string;
    tlsKeyPath?: string;
    authToken?: string;
    heartbeatIntervalSecs: number;
    nodeTimeoutSecs: number;
    maxLogEntries: number;
    metricsEnabled: boolean;
}
/**
 * Monitor statistics
 */
interface MonitorStats {
    totalNodes: number;
    onlineNodes: number;
    totalAgents: number;
    totalTasks: number;
    runningTasks: number;
    queuedTasks: number;
    completedTasks: number;
    failedTasks: number;
}
/**
 * Remote event types
 */
type RemoteEventType = 'node_online' | 'node_offline' | 'node_status_changed' | 'node_heartbeat' | 'task_created' | 'task_started' | 'task_progress' | 'task_step_completed' | 'task_completed' | 'task_failed' | 'task_cancelled' | 'task_log' | 'agent_registered' | 'agent_unregistered';
/**
 * Remote event
 */
interface RemoteEvent {
    type: RemoteEventType;
    timestamp: number;
    nodeId?: string;
    taskId?: string;
    agentId?: string;
    data?: unknown;
}
/**
 * Agent message for inter-agent communication
 */
interface AgentMessage {
    id: string;
    agentId: string;
    targetAgentId?: string;
    type: 'thought' | 'action' | 'observation' | 'result' | 'error' | 'handoff';
    content: string;
    metadata?: Record<string, unknown>;
    timestamp: number;
}
/**
 * Multi-agent swarm configuration
 */
interface Swarm {
    id: string;
    name: string;
    description?: string | null;
    agents: SwarmAgent[];
    tasks?: AgentTask[];
    messages?: AgentMessage[];
    workflow: SwarmWorkflow;
    status: SwarmStatus;
    coordinatorAgentId?: string;
    goalDescription?: string;
    result?: string;
    startedAt?: number;
    completedAt?: number;
    createdAt: number;
    updatedAt: number;
}
interface SwarmAgent {
    agentId: string;
    role: string;
    position?: {
        x: number;
        y: number;
    };
}
interface SwarmWorkflow {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
}
interface WorkflowNode {
    id: string;
    type: 'agent' | 'input' | 'output' | 'condition' | 'merge';
    agentId?: string;
    position: {
        x: number;
        y: number;
    };
}
interface WorkflowEdge {
    id: string;
    source: string;
    target: string;
    condition?: string;
}
/**
 * Agent run (execution instance)
 */
interface AgentRun {
    id: string;
    swarmId?: string;
    agentId?: string;
    name: string;
    description: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    tasks: AgentTask[];
    messages: AgentMessage[];
    tokensUsed: number;
    cost?: number;
    startedAt: number;
    completedAt?: number;
    createdAt: number;
}
/**
 * Git commit info linked to chat
 */
interface GitCommit {
    hash: string;
    shortHash: string;
    message: string;
    author: string;
    email?: string;
    timestamp: number;
    branch?: string;
    sessionId?: string | null;
    messageId?: string | null;
}
/**
 * Git repository info
 */
interface GitRepository {
    path: string;
    branch: string;
    remote?: string | null;
    uncommittedChanges?: number;
    ahead?: number;
    behind?: number;
}
/**
 * Overview statistics
 */
interface Statistics {
    totalSessions: number;
    totalMessages: number;
    totalWorkspaces: number;
    totalProviders?: number;
    totalToolInvocations?: number;
    totalFileChanges?: number;
    sessionsThisWeek?: number;
    messagesThisWeek?: number;
    sessionsByProvider: ProviderCount[];
    messagesByDay?: DayCount[];
    topWorkspaces?: WorkspaceStats[];
}
interface ProviderCount {
    provider: string;
    count: number;
    color?: string;
}
interface DayCount {
    date: string;
    sessions: number;
    messages?: number;
}
interface WorkspaceStats {
    id: string;
    name: string;
    sessionCount: number;
    messageCount?: number;
    lastActive?: number;
}
/**
 * Full-text search result
 */
interface SearchResult {
    type: 'session' | 'message' | 'workspace';
    id: string;
    title: string;
    snippet?: string;
    highlights?: string[];
    score?: number;
    timestamp?: number;
    provider?: string;
    workspaceId?: string;
    sessionId?: string;
}
/**
 * Session filter options
 */
interface SessionFilter {
    workspaceId?: string;
    provider?: string;
    model?: string;
    archived?: boolean;
    dateFrom?: number;
    dateTo?: number;
    search?: string;
    sortBy?: 'createdAt' | 'updatedAt' | 'messageCount' | 'title';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}
/**
 * Workspace filter options
 */
interface WorkspaceFilter {
    provider?: string;
    hasChats?: boolean;
    search?: string;
    sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'sessionCount';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}
/**
 * Paginated response wrapper
 */
interface PaginatedResponse<T> {
    items: T[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
}
/**
 * API error
 */
interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}
/**
 * Generic API response
 */
interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: ApiError;
}
interface ChatCompletionRequest {
    provider: string;
    model: string;
    messages: ChatCompletionMessage[];
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    sessionId?: string;
    enableTools?: boolean;
}
interface ChatCompletionMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}
interface ChatCompletionResponse {
    id: string;
    provider?: string;
    model: string;
    content: string;
    message?: ChatCompletionMessage;
    usage?: TokenUsage;
    tokens?: TokenUsage;
    finishReason?: 'stop' | 'length' | 'tool_calls' | 'error';
    toolCalls?: Array<{
        name: string;
        arguments: string;
    }>;
}
interface TokenUsage {
    prompt?: number;
    promptTokens?: number;
    completion?: number;
    completionTokens?: number;
    total?: number;
    totalTokens?: number;
}
interface StreamChunk {
    id: string;
    delta: string;
    finishReason?: 'stop' | 'length' | 'tool_calls' | 'error';
}
interface ImportSource {
    type: 'share_link' | 'file' | 'directory' | 'provider';
    uri: string;
    provider?: string;
}
interface ImportResult {
    success: boolean;
    sessionsImported: number;
    messagesImported: number;
    errors: string[];
    warnings: string[];
}
interface ExportOptions {
    format: 'json' | 'markdown' | 'html' | 'csv';
    includeMetadata?: boolean;
    sessionIds?: string[];
    workspaceId?: string;
    dateFrom?: number;
    dateTo?: number;
}
type ThemeMode = 'light' | 'dark' | 'system' | 'neutral';
interface AppSettings {
    theme: ThemeMode;
    syntaxTheme?: string;
    fontSize?: number;
    showTimestamps?: boolean;
    soundEnabled?: boolean;
    streamResponses?: boolean;
    defaultProvider?: string | null;
    defaultModel?: string | null;
    autoSave?: boolean;
    harvestPath?: string | null;
}
interface McpTool {
    name: string;
    description: string | null;
    inputSchema: Record<string, unknown>;
}
interface McpToolCall {
    name: string;
    arguments: Record<string, unknown>;
}
interface McpToolResult {
    tool: string;
    result: {
        content: Array<{
            type: string;
            text: string;
        }>;
        isError?: boolean;
    };
}
/**
 * Agency Event type - mirrors Rust Agency EventType
 */
type AgencyEventType = 'agent_started' | 'agent_thinking' | 'agent_executing' | 'agent_completed' | 'agent_failed' | 'tool_call_started' | 'tool_call_completed' | 'tool_call_failed' | 'message_created' | 'message_delta' | 'task_created' | 'task_started' | 'task_completed' | 'task_failed' | 'swarm_started' | 'swarm_agent_joined' | 'swarm_completed' | 'swarm_failed' | 'handoff' | 'error';
/**
 * Agency Event - matches Rust Agency AgencyEvent
 */
interface AgencyEvent {
    type: AgencyEventType;
    agentId?: string;
    agentName?: string;
    taskId?: string;
    toolName?: string;
    message?: string;
    content?: string;
    error?: string;
    tokensUsed?: number;
    timestamp: number;
    metadata?: Record<string, unknown>;
}
/**
 * Tool call information - matches Rust Agency ToolCall
 */
interface AgencyToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    timestamp: number;
}
/**
 * Tool result - matches Rust Agency ToolResult
 */
interface AgencyToolResult {
    callId: string;
    name: string;
    content: string;
    isError: boolean;
    duration?: number;
    timestamp: number;
}
/**
 * Execution result from agent or pipeline run
 */
interface ExecutionResult {
    success: boolean;
    output: string;
    agentName?: string;
    tokensUsed?: TokenUsage;
    duration: number;
    toolCalls?: AgencyToolCall[];
    events: AgencyEvent[];
}
/**
 * Orchestrator result for multi-agent runs
 */
interface OrchestratorResult {
    success: boolean;
    outputs: string[];
    agentResults: ExecutionResult[];
    totalTokens: TokenUsage;
    duration: number;
}
/**
 * Integration category
 */
type IntegrationCategory = 'productivity' | 'communication' | 'browser' | 'development' | 'smart_home' | 'finance' | 'health' | 'media' | 'travel' | 'shopping' | 'system';
/**
 * Authentication method for integrations
 */
type IntegrationAuthType = 'oauth2' | 'api_key' | 'bot_token' | 'local' | 'bridge' | 'extension' | 'none';
/**
 * Integration status
 */
type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'pending' | 'unknown';
/**
 * Integration configuration
 */
interface Integration {
    id: string;
    name: string;
    category: IntegrationCategory;
    icon: string;
    color: string;
    capabilities: string[];
    authType: IntegrationAuthType;
    status: IntegrationStatus;
    lastSync?: number;
    error?: string;
    config?: IntegrationConfig;
}
/**
 * Integration-specific configuration
 */
interface IntegrationConfig {
    enabled: boolean;
    credentials?: IntegrationCredentials;
    settings?: Record<string, unknown>;
    webhookUrl?: string;
    refreshToken?: string;
    expiresAt?: number;
}
/**
 * Integration credentials (stored securely)
 */
interface IntegrationCredentials {
    accessToken?: string;
    apiKey?: string;
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
}
/**
 * Hook trigger types
 */
type HookTriggerType = 'cron' | 'interval' | 'daily' | 'weekly' | 'monthly' | 'webhook' | 'file_change' | 'email_received' | 'calendar_event' | 'git_push' | 'git_pr' | 'app_launch' | 'system_wake' | 'battery_low' | 'network_change' | 'custom';
/**
 * Hook action types
 */
type HookActionType = 'send_notification' | 'send_email' | 'send_slack' | 'send_discord' | 'send_sms' | 'run_command' | 'run_script' | 'call_api' | 'create_file' | 'move_file' | 'create_event' | 'update_event' | 'create_task' | 'complete_task' | 'control_device' | 'run_scene' | 'ask_agent' | 'summarize' | 'translate' | 'custom';
/**
 * Hook trigger configuration
 */
interface HookTrigger {
    type: HookTriggerType;
    config: Record<string, unknown>;
}
/**
 * Hook action configuration
 */
interface HookAction {
    type: HookActionType;
    integrationId?: string;
    config: Record<string, unknown>;
}
/**
 * Hook condition for conditional execution
 */
interface HookCondition {
    field: string;
    operator: 'equals' | 'contains' | 'matches' | 'gt' | 'lt' | 'gte' | 'lte' | 'exists' | 'not_exists';
    value: unknown;
    negate?: boolean;
}
/**
 * Hook configuration
 */
interface Hook {
    id: string;
    name: string;
    description?: string;
    enabled: boolean;
    trigger: HookTrigger;
    conditions?: HookCondition[];
    actions: HookAction[];
    cooldownMs?: number;
    maxExecutions?: number;
    executionCount: number;
    lastExecuted?: number;
    createdAt: number;
    updatedAt: number;
}
/**
 * Hook execution result
 */
interface HookExecutionResult {
    hookId: string;
    success: boolean;
    actionsExecuted: number;
    actionsFailed: number;
    results: HookActionResult[];
    duration: number;
    timestamp: number;
}
/**
 * Individual action result
 */
interface HookActionResult {
    actionType: HookActionType;
    success: boolean;
    output?: unknown;
    error?: string;
    duration: number;
}
/**
 * Hook preset template
 */
interface HookPreset {
    id: string;
    name: string;
    description: string;
    category: string;
    trigger: HookTrigger;
    conditions?: HookCondition[];
    actions: HookAction[];
    requiredIntegrations: string[];
}
/**
 * A software project directory with persistent memory
 */
interface SweProject {
    id: string;
    name: string;
    path: string;
    description?: string | null;
    gitRemote?: string | null;
    gitBranch?: string | null;
    language?: string | null;
    framework?: string | null;
    lastOpened: number;
    createdAt: number;
    updatedAt: number;
    memoryCount: number;
    ruleCount: number;
    sessionCount: number;
    metadata?: Record<string, unknown> | null;
}
/**
 * Memory entry in the project key-value store
 * Used for persistent facts, context, and learned information
 */
interface SweMemory {
    id: string;
    projectId: string;
    key: string;
    value: string;
    category: SweMemoryCategory;
    importance: SweImportance;
    source?: SweMemorySource;
    sourceMessageId?: string | null;
    expiresAt?: number | null;
    accessCount: number;
    lastAccessed?: number | null;
    createdAt: number;
    updatedAt: number;
    metadata?: Record<string, unknown> | null;
}
/**
 * Categories for organizing memory entries
 */
type SweMemoryCategory = 'fact' | 'decision' | 'pattern' | 'dependency' | 'architecture' | 'bug' | 'todo' | 'context' | 'preference' | 'custom';
/**
 * Source of a memory entry
 */
type SweMemorySource = 'user' | 'assistant' | 'file' | 'git' | 'import';
/**
 * Importance level for prioritizing memory in context
 */
type SweImportance = 'critical' | 'high' | 'medium' | 'low';
/**
 * User-defined rules that are always injected into context
 * These are "never do X", "always do Y" type instructions
 */
interface SweRule {
    id: string;
    projectId: string;
    rule: string;
    description?: string | null;
    category: SweRuleCategory;
    priority: number;
    enabled: boolean;
    scope?: SweRuleScope;
    conditions?: SweRuleCondition[];
    createdAt: number;
    updatedAt: number;
    metadata?: Record<string, unknown> | null;
}
/**
 * Rule categories for organization
 */
type SweRuleCategory = 'constraint' | 'requirement' | 'style' | 'architecture' | 'security' | 'testing' | 'documentation' | 'custom';
/**
 * Scope for when a rule applies
 */
interface SweRuleScope {
    filePatterns?: string[];
    directories?: string[];
    languages?: string[];
    operations?: SweOperation[];
}
/**
 * Operations that can trigger rules
 */
type SweOperation = 'file_create' | 'file_edit' | 'file_delete' | 'terminal_command' | 'code_review' | 'refactor' | 'test' | 'deploy' | 'all';
/**
 * Conditional rule application
 */
interface SweRuleCondition {
    type: 'file_exists' | 'file_contains' | 'env_set' | 'branch_matches' | 'custom';
    value: string;
    negate?: boolean;
}
/**
 * SWE session - extends regular session with project context
 */
interface SweSession {
    id: string;
    projectId: string;
    title: string;
    model?: string | null;
    provider: string;
    messageCount: number;
    tokenCount?: number | null;
    workingDirectory?: string | null;
    gitBranch?: string | null;
    createdAt: number;
    updatedAt: number;
    archived?: boolean;
    metadata?: Record<string, unknown> | null;
}
/**
 * SWE session with full details including messages and context
 */
interface SweSessionWithMessages extends SweSession {
    messages: SweMessage[];
    project: SweProject;
    activeRules: SweRule[];
    relevantMemory: SweMemory[];
}
/**
 * SWE message - extends regular message with tool execution context
 */
interface SweMessage {
    id: string;
    sessionId: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    model?: string | null;
    tokenCount?: number | null;
    createdAt: number;
    toolCalls?: SweToolCall[];
    toolResults?: SweToolResult[];
    contextSnapshot?: SweContextSnapshot;
    metadata?: Record<string, unknown> | null;
}
/**
 * Tool call made by the assistant
 */
interface SweToolCall {
    id: string;
    name: SweTool;
    input: Record<string, unknown>;
    status: 'pending' | 'running' | 'success' | 'error';
    startedAt?: number;
    completedAt?: number;
}
/**
 * Result of a tool execution
 */
interface SweToolResult {
    callId: string;
    success: boolean;
    output?: unknown;
    error?: string;
    duration: number;
    affectedFiles?: string[];
}
/**
 * Available SWE tools
 */
type SweTool = 'read_file' | 'write_file' | 'edit_file' | 'create_file' | 'delete_file' | 'list_directory' | 'search_files' | 'search_code' | 'run_command' | 'git_status' | 'git_diff' | 'git_commit' | 'git_log' | 'add_memory' | 'get_memory' | 'search_memory' | 'add_rule' | 'web_search' | 'fetch_url';
/**
 * Snapshot of context at message time
 */
interface SweContextSnapshot {
    workingDirectory: string;
    gitBranch?: string;
    gitStatus?: string;
    openFiles?: string[];
    recentChanges?: SweFileChange[];
    injectedRules: string[];
    injectedMemory: string[];
}
/**
 * File change record
 */
interface SweFileChange {
    path: string;
    type: 'create' | 'edit' | 'delete' | 'rename';
    diff?: string;
    timestamp: number;
}
/**
 * Project file tree node
 */
interface SweFileNode {
    name: string;
    path: string;
    type: 'file' | 'directory';
    size?: number;
    modified?: number;
    children?: SweFileNode[];
    isExpanded?: boolean;
    isGitIgnored?: boolean;
}
/**
 * Git status for the project
 */
interface SweGitStatus {
    branch: string;
    ahead: number;
    behind: number;
    staged: SweGitChange[];
    unstaged: SweGitChange[];
    untracked: string[];
    hasConflicts: boolean;
}
/**
 * Git change entry
 */
interface SweGitChange {
    path: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
    oldPath?: string;
}
/**
 * Search result for code/file search
 */
interface SweSearchResult {
    file: string;
    line: number;
    column?: number;
    content: string;
    context?: string;
    matchType: 'exact' | 'fuzzy' | 'regex';
}
/**
 * Terminal execution result
 */
interface SweTerminalResult {
    command: string;
    exitCode: number;
    stdout: string;
    stderr: string;
    duration: number;
    workingDirectory: string;
}
/**
 * Context to inject into model prompts
 */
interface SweContextInjection {
    systemPrompt: string;
    rules: SweRule[];
    memory: SweMemory[];
    recentFiles: string[];
    gitContext?: SweGitStatus;
    customContext?: string;
}
/**
 * Stats for a SWE project
 */
interface SweProjectStats {
    projectId: string;
    totalSessions: number;
    totalMessages: number;
    totalTokens: number;
    totalMemoryEntries: number;
    totalRules: number;
    totalFileOperations: number;
    totalTerminalCommands: number;
    lastActivity: number;
    topMemoryCategories: {
        category: SweMemoryCategory;
        count: number;
    }[];
    recentFiles: string[];
}
/**
 * Request to create a new SWE project
 */
interface CreateSweProjectRequest {
    path: string;
    name?: string;
    description?: string;
}
/**
 * Request to add a memory entry
 */
interface CreateSweMemoryRequest {
    key: string;
    value: string;
    category?: SweMemoryCategory;
    importance?: SweImportance;
    expiresAt?: number;
    metadata?: Record<string, unknown>;
}
/**
 * Request to add a rule
 */
interface CreateSweRuleRequest {
    rule: string;
    description?: string;
    category?: SweRuleCategory;
    priority?: number;
    scope?: SweRuleScope;
    conditions?: SweRuleCondition[];
}
/**
 * Request to execute a tool
 */
interface SweToolExecutionRequest {
    projectId: string;
    sessionId?: string;
    tool: SweTool;
    input: Record<string, unknown>;
}
/**
 * Batch memory import request
 */
interface SweBatchMemoryImport {
    projectId: string;
    entries: CreateSweMemoryRequest[];
    overwriteExisting?: boolean;
}
/**
 * Project template for quick setup
 */
interface SweProjectTemplate {
    id: string;
    name: string;
    description: string;
    language: string;
    framework?: string;
    defaultRules: CreateSweRuleRequest[];
    defaultMemory: CreateSweMemoryRequest[];
}
/**
 * Common project templates
 */
declare const SWE_PROJECT_TEMPLATES: SweProjectTemplate[];
/**
 * Subscription tier levels for IRONBRIDGE cloud sync services
 */
type SubscriptionTier = 'free' | 'pro' | 'enterprise';
/**
 * Subscription pricing information
 */
interface SubscriptionPricing {
    tier: SubscriptionTier;
    name: string;
    price: number;
    yearlyPrice?: number;
    features: string[];
    limits: SubscriptionLimits;
}
/**
 * Subscription usage limits
 */
interface SubscriptionLimits {
    maxWorkspaces: number;
    maxSessions: number;
    maxAgents: number;
    maxSwarms: number;
    syncEnabled: boolean;
    realTimeSync: boolean;
    prioritySync: boolean;
    teamFeatures: boolean;
    apiAccess: boolean;
    customIntegrations: boolean;
}
/**
 * User subscription details
 */
interface Subscription {
    tier: SubscriptionTier;
    expiresAt: number | null;
    autoRenew: boolean;
    limits: SubscriptionLimits;
    usage?: SubscriptionUsage;
}
/**
 * Current subscription usage
 */
interface SubscriptionUsage {
    workspaces: number;
    sessions: number;
    agents: number;
    swarms: number;
    syncEvents: number;
    lastSyncAt: number | null;
}
/**
 * User account information
 */
interface User {
    id: string;
    email: string;
    username: string | null;
    subscription: Subscription;
    createdAt: number;
    updatedAt: number;
    isActive: boolean;
    emailVerified: boolean;
    avatarUrl?: string | null;
    preferences?: UserPreferences;
}
/**
 * User preferences
 */
interface UserPreferences {
    theme: 'light' | 'dark' | 'system';
    defaultProvider: string | null;
    syncOnStartup: boolean;
    autoBackup: boolean;
    notificationsEnabled: boolean;
}
/**
 * Login request payload
 */
interface LoginRequest {
    email: string;
    password: string;
    rememberMe?: boolean;
}
/**
 * Registration request payload
 */
interface RegisterRequest {
    email: string;
    password: string;
    username?: string;
    acceptTerms: boolean;
}
/**
 * Authentication response with tokens
 */
interface AuthResponse {
    user: User;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
}
/**
 * Token refresh request
 */
interface RefreshTokenRequest {
    refreshToken: string;
}
/**
 * Token refresh response
 */
interface RefreshTokenResponse {
    accessToken: string;
    expiresAt: number;
}
/**
 * Password reset request
 */
interface PasswordResetRequest {
    email: string;
}
/**
 * Password change request
 */
interface PasswordChangeRequest {
    currentPassword: string;
    newPassword: string;
}
/**
 * Subscription upgrade/change request
 */
interface SubscribeRequest {
    tier: SubscriptionTier;
    paymentMethodId?: string;
    billingCycle: 'monthly' | 'yearly';
}
/**
 * API key for programmatic access
 */
interface ApiKey {
    id: string;
    name: string;
    prefix: string;
    createdAt: number;
    lastUsedAt: number | null;
    expiresAt: number | null;
    scopes: ApiKeyScope[];
}
/**
 * API key scopes/permissions
 */
type ApiKeyScope = 'read:sessions' | 'write:sessions' | 'read:workspaces' | 'write:workspaces' | 'read:agents' | 'write:agents' | 'sync:read' | 'sync:write';
/**
 * Create API key request
 */
interface CreateApiKeyRequest {
    name: string;
    scopes: ApiKeyScope[];
    expiresInDays?: number;
}
/**
 * Create API key response (includes full key, only shown once)
 */
interface CreateApiKeyResponse {
    apiKey: ApiKey;
    key: string;
}
/**
 * Authentication state for client applications
 */
interface AuthState {
    isAuthenticated: boolean;
    isLoading: boolean;
    user: User | null;
    error: string | null;
}
/**
 * Device/session information for active sessions management
 */
interface DeviceSession {
    id: string;
    deviceName: string;
    deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
    platform: string;
    browser?: string;
    ipAddress?: string;
    location?: string;
    lastActiveAt: number;
    createdAt: number;
    isCurrent: boolean;
}
/**
 * Subscription pricing tiers (constant)
 */
declare const SUBSCRIPTION_TIERS: SubscriptionPricing[];

export { type ActionBounds, type ActionCommand, type ActionItem, type ActionParameters, type ActionSpace, type ActionSpaceType, type ActionType, type ActivityType, type AgencyEvent, type AgencyEventType, type AgencyToolCall, type AgencyToolResult, type Agent, type AgentAutonomy, type AgentMessage, type AgentPermissionLevel, type AgentRole, type AgentRun, type AgentStatus, type AgentTask, type AnnotationSummary, type ApiError, type ApiKey, type ApiKeyScope, type ApiResponse, type AppSettings, type ArtifactType, type AudioContent, type AudioData, type AudioFormat, type AuthResponse, type AuthState, type AutoTagRule, BUILTIN_TEMPLATES, BUILT_IN_TEMPLATES, type BatchEmbedRequest, type BatchEmbedResponse, type BatchItemResult, type BatchOperationError, type BatchOperationOptions, type BatchOperationProgress, type BatchOperationRequest, type BatchOperationResult, type BatchOperationType, type BatchSummarizeProgress, type BatchSummarizeRequest, type BulkTagOperation, CHUNKING_DEFAULTS, type ChatCompletionMessage, type ChatCompletionRequest, type ChatCompletionResponse, type Checkpoint, type ChunkingConfig, type ChunkingStrategy, type CloudProviderConfig, type CodeHighlight, type CodePurpose, type CollaborationActivity, type CollaborationMessage, type CollaborationMessageType, type CollaborationSyncState, type CollaborationUser, type Collection, type CollectionEventType, type CollectionMembership, type CollectionSortOrder, type CollectionType, type CommentReaction, type CompareSessionsRequest, type ComparisonDifference, type ContentPart, type ContextSegment, type ContextSegmentType, type CreateApiKeyRequest, type CreateApiKeyResponse, type CreateSweMemoryRequest, type CreateSweProjectRequest, type CreateSweRuleRequest, type CreateTeamRequest, type CursorPosition, DEFAULT_INDEX_SETTINGS, DEFAULT_SEARCH_OPTIONS, DEFAULT_SHORTCUTS, DEFAULT_SMART_COLLECTIONS, DEFAULT_SUMMARIZATION_OPTIONS, DEFAULT_TAGS, DEFAULT_TEAM_PERMISSIONS, type DayCount, type Decision, type DetectedProblem, type DeviceSession, type DistanceMetric, type Document, type DocumentChunk, type DocumentType, EMBEDDING_MODELS, type EditOperation, type EditOperationType, type EmbedDocument, type EmbeddableType, type Embedding, type EmbeddingChunk, type EmbeddingConfig, type EmbeddingMetadata, type EmbeddingModel, type EmbeddingModelInfo, type EmbeddingProvider, type EntityMention, type EntityType, type ExecutionResult, type ExportOptions, type ExtractedEntity, type ExtractedTopic, type FileChange, type FileChangeSummary, type FilterCondition, type FilterGroup, type FilterOperator, type FilterableField, type FindSimilarRequest, type Folder, type FolderTree, type GenerateSummaryRequest, type GenerateSummaryResponse, type GitCommit, type GitRepository, type GpuInfo, type GroupBy, type GroupByOption, type GroupedSearchResults, HIGHLIGHT_COLORS, type HardwareInfo, type Hook, type HookAction, type HookActionResult, type HookActionType, type HookCondition, type HookExecutionResult, type HookPreset, type HookTrigger, type HookTriggerType, type HybridSearchQuery, type HybridSearchResult, type ImageContent, type ImageData, type ImageFormat, type ImportResult, type ImportSource, type ImportanceLevel, type IncrementalSummaryState, type IndexBuildProgress, type IndexHealth, type IndexSettings, type IndexType, type Integration, type IntegrationAuthType, type IntegrationCategory, type IntegrationConfig, type IntegrationCredentials, type IntegrationStatus, type InvitationStatus, type InviteMemberRequest, type JointState, type KeyPoint, type KeyPointCategory, type KeyboardShortcut, type KeywordBoost, type LocalLLMConfig, type LoginRequest, type ManipulatorType, type McpTool, type McpToolCall, type McpToolResult, type MemoryConfig, type MemoryEntry, type MemorySource, type MemoryStats, type MemoryType, type Mention, type Message, type MessageHighlight, type Modality, type ModalityCapabilities, type ModelCategory, type ModelConfig, type ModelParameters, type ModelProvider, type MonitorStats, type MultimodalMessage, type MultimodalModel, type NavigationCapability, type NodeStatus, type NotificationPreferences, type OrchestrationType, type OrchestratorResult, type OrganizationEvent, type OrganizationPreferences, PERMISSION_HIERARCHY, PRESENCE_COLORS, type PaginatedResponse, type PasswordChangeRequest, type PasswordResetRequest, type PermissionCheck, type PermissionLevel, type Pipeline, type PopularQuery, type PresenceEvent, type PresenceEventType, type ProactiveAction, type Provider, type ProviderCount, type ProviderHealth, type ProviderSettings, type ProviderStatus, type ProviderType, type RAGConfig, type RebuildIndexRequest, type RefreshTokenRequest, type RefreshTokenResponse, type RegisterRequest, type RemoteEvent, type RemoteEventType, type RemoteLogLevel, type RemoteMonitorConfig, type RemoteNode, type RemoteTask, type RemoteTaskResult, type RemoteTaskStatus, type ResourceUsage, type RobotCapabilities, SHORTCUT_CATEGORIES, SUBSCRIPTION_TIERS, SUMMARY_TYPE_CONFIG, SWE_PROJECT_TEMPLATES, SYSTEM_TAGS, type SearchAnalytics, type SearchFilters, type SearchHighlight, type SearchOptions, type SearchRequest, type SearchResponse, type SearchResult, type SearchResultGroup, type SearchResultSession, type SelectionAction, type SelectionRange, type SelectionState, type SemanticSearchQuery, type SemanticSearchResult, type SensorData, type SensorType, type SensorValues, type SentimentAnalysis, type SentimentScore, type Session, type SessionAccess, type SessionAnnotations, type SessionBookmark, type SessionComment, type SessionComparison, type SessionFilter, type SessionNote, type SessionPresence, type SessionShare, type SessionSummary, type SessionTag, type SessionTagAnalysis, type SessionTemplate, type SessionWithMessages, type ShareLink, type ShareLinkProvider, type ShareSessionRequest, type ShareType, type ShortcutAction, type ShortcutCategory, type SimilarDocument, type SimilarityMetric, type SmartCollectionRules, type Statistics, type StreamChunk, type SubscribeRequest, type Subscription, type SubscriptionLimits, type SubscriptionPricing, type SubscriptionTier, type SubscriptionUsage, type SuggestRequest, type Suggestion, type SummarizationConfig, type SummarizationOptions, type SummarizationProvider, type SummarizationStrategy, type SummaryMetrics, type SummarySection, type SummaryTemplate, type SummaryType, type SummaryUpdateTrigger, type SummaryVersion, type Swarm, type SwarmAgent, type SwarmStatus, type SwarmWorkflow, type SweBatchMemoryImport, type SweContextInjection, type SweContextSnapshot, type SweFileChange, type SweFileNode, type SweGitChange, type SweGitStatus, type SweImportance, type SweMemory, type SweMemoryCategory, type SweMemorySource, type SweMessage, type SweOperation, type SweProject, type SweProjectStats, type SweProjectTemplate, type SweRule, type SweRuleCategory, type SweRuleCondition, type SweRuleScope, type SweSearchResult, type SweSession, type SweSessionWithMessages, type SweTerminalResult, type SweTool, type SweToolCall, type SweToolExecutionRequest, type SweToolResult, TAG_COLORS, TAG_COLOR_STYLES, TAG_COLOR_STYLES_DARK, TEMPLATE_CATEGORIES, type Tag, type TagAssignment, type TagColor, type TagEventType, type TagScope, type TagSuggestion, type TagWithHierarchy, type TaskArtifact, type TaskLogEntry, type TaskMetrics, type TaskPriority, type TaskStatus, type TeamInvitation, type TeamMember, type TeamPermissions, type TeamRole, type TeamWorkspace, type TeamWorkspaceSettings, type TemplateCategory, type TemplateMessage, type TemplateVariable, type ThemeMode, type TokenUsage, type ToolInvocation, type UpdatePermissionRequest, type User, type UserPreferences, type UserStatus, type VectorIndexStatus, type VectorSearchResult, type VectorStoreConfig, type VectorStoreType, type VersionVector, type VideoContent, type VideoSource, type ViewMode, type WorkflowEdge, type WorkflowNode, type Workspace, type WorkspaceBounds, type WorkspaceFilter, type WorkspaceStats, type WorkspaceVisibility, buildFolderTree, buildTagPath, calculateCompressionRatio, chunkText, cosineSimilarity, estimateTokens, evaluateCondition, formatShortcut, generateCollectionId, generateTagId, getInitials, getTagColorStyles, getUserColor, hasPermission, initialSelectionState, matchesShortcut, normalizeVector, parseKeyboardEvent, selectionReducer };
