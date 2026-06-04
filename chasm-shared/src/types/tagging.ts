// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Custom Tagging and Organization Types
 *
 * Types for session tagging, categorization, collections, and smart organization.
 */

// ============================================================================
// Tag Types
// ============================================================================

/**
 * Tag color options for visual organization
 */
export type TagColor =
    | 'red'
    | 'orange'
    | 'yellow'
    | 'green'
    | 'teal'
    | 'blue'
    | 'indigo'
    | 'purple'
    | 'pink'
    | 'gray';

/**
 * Tag visibility scope
 */
export type TagScope = 'personal' | 'team' | 'organization' | 'public';

/**
 * A tag that can be applied to sessions
 */
export interface Tag {
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
export interface TagWithHierarchy extends Tag {
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
export interface TagAssignment {
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
export interface BulkTagOperation {
    /** Operation type */
    operation: 'add' | 'remove' | 'replace';
    /** Tag IDs to apply */
    tagIds: string[];
    /** Session IDs to modify */
    sessionIds: string[];
    /** Replace all existing tags (only for 'replace' operation) */
    replaceAll?: boolean;
}

// ============================================================================
// Collection Types
// ============================================================================

/**
 * Collection type for organizing sessions
 */
export type CollectionType =
    | 'manual' // Manually curated
    | 'smart' // Auto-populated based on rules
    | 'favorite' // Quick access favorites
    | 'archive' // Archived sessions
    | 'recent' // Recently accessed
    | 'shared'; // Shared with user

/**
 * A collection of sessions
 */
export interface Collection {
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
export interface CollectionSortOrder {
    /** Field to sort by */
    field: 'createdAt' | 'updatedAt' | 'title' | 'messageCount' | 'addedAt' | 'custom';
    /** Sort direction */
    direction: 'asc' | 'desc';
}

/**
 * Session membership in a collection
 */
export interface CollectionMembership {
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

// ============================================================================
// Smart Collection Rules
// ============================================================================

/**
 * Operator for filter conditions
 */
export type FilterOperator =
    | 'equals'
    | 'notEquals'
    | 'contains'
    | 'notContains'
    | 'startsWith'
    | 'endsWith'
    | 'greaterThan'
    | 'lessThan'
    | 'greaterOrEqual'
    | 'lessOrEqual'
    | 'between'
    | 'in'
    | 'notIn'
    | 'isEmpty'
    | 'isNotEmpty'
    | 'matches'; // Regex match

/**
 * Field types that can be filtered
 */
export type FilterableField =
    | 'title'
    | 'provider'
    | 'workspace'
    | 'createdAt'
    | 'updatedAt'
    | 'messageCount'
    | 'tags'
    | 'hasAttachments'
    | 'hasCode'
    | 'language'
    | 'sentiment'
    | 'duration'
    | 'tokenCount'
    | 'isStarred'
    | 'isArchived'
    | 'sharedWith'
    | 'createdBy';

/**
 * A single filter condition
 */
export interface FilterCondition {
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
export interface FilterGroup {
    /** Logical operator between conditions */
    logic: 'and' | 'or';
    /** Conditions in this group */
    conditions: (FilterCondition | FilterGroup)[];
}

/**
 * Rules for smart collections
 */
export interface SmartCollectionRules {
    /** Root filter group */
    filters: FilterGroup;
    /** Maximum number of sessions to include */
    limit?: number;
    /** How often to refresh (in minutes, 0 = real-time) */
    refreshInterval: number;
    /** Last time the collection was refreshed */
    lastRefreshed?: string;
}

// ============================================================================
// Folder/Hierarchy Types
// ============================================================================

/**
 * A folder for organizing collections and sessions
 */
export interface Folder {
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
export interface FolderTree extends Folder {
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

// ============================================================================
// Auto-Tagging and Suggestions
// ============================================================================

/**
 * Auto-tagging rule
 */
export interface AutoTagRule {
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
export interface TagSuggestion {
    /** Suggested tag */
    tag: Tag | { name: string; color: TagColor };
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
export interface SessionTagAnalysis {
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

// ============================================================================
// Organization Preferences
// ============================================================================

/**
 * View mode for session lists
 */
export type ViewMode = 'list' | 'grid' | 'timeline' | 'kanban' | 'calendar';

/**
 * Grouping options for session lists
 */
export type GroupBy =
    | 'none'
    | 'date'
    | 'week'
    | 'month'
    | 'provider'
    | 'workspace'
    | 'tag'
    | 'collection'
    | 'status';

/**
 * User's organization preferences
 */
export interface OrganizationPreferences {
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

// ============================================================================
// Events
// ============================================================================

/**
 * Tag-related event types
 */
export type TagEventType =
    | 'tag:created'
    | 'tag:updated'
    | 'tag:deleted'
    | 'tag:assigned'
    | 'tag:unassigned'
    | 'tag:merged';

/**
 * Collection-related event types
 */
export type CollectionEventType =
    | 'collection:created'
    | 'collection:updated'
    | 'collection:deleted'
    | 'collection:session_added'
    | 'collection:session_removed'
    | 'collection:reordered';

/**
 * Organization event
 */
export interface OrganizationEvent {
    /** Event type */
    type: TagEventType | CollectionEventType;
    /** Event timestamp */
    timestamp: string;
    /** User who triggered the event */
    userId: string;
    /** Event payload */
    payload: Record<string, unknown>;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Available tag colors with their hex values
 */
export const TAG_COLOR_STYLES: Record<TagColor, { bg: string; text: string; border: string }> = {
    red: { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
    orange: { bg: '#FFEDD5', text: '#9A3412', border: '#FED7AA' },
    yellow: { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
    green: { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
    teal: { bg: '#CCFBF1', text: '#0F766E', border: '#99F6E4' },
    blue: { bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE' },
    indigo: { bg: '#E0E7FF', text: '#3730A3', border: '#C7D2FE' },
    purple: { bg: '#EDE9FE', text: '#5B21B6', border: '#DDD6FE' },
    pink: { bg: '#FCE7F3', text: '#9D174D', border: '#FBCFE8' },
    gray: { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
};

/**
 * Dark mode tag colors
 */
export const TAG_COLOR_STYLES_DARK: Record<TagColor, { bg: string; text: string; border: string }> = {
    red: { bg: '#7F1D1D', text: '#FCA5A5', border: '#991B1B' },
    orange: { bg: '#7C2D12', text: '#FDBA74', border: '#9A3412' },
    yellow: { bg: '#78350F', text: '#FCD34D', border: '#92400E' },
    green: { bg: '#064E3B', text: '#6EE7B7', border: '#065F46' },
    teal: { bg: '#134E4A', text: '#5EEAD4', border: '#0F766E' },
    blue: { bg: '#1E3A8A', text: '#93C5FD', border: '#1E40AF' },
    indigo: { bg: '#312E81', text: '#A5B4FC', border: '#3730A3' },
    purple: { bg: '#4C1D95', text: '#C4B5FD', border: '#5B21B6' },
    pink: { bg: '#831843', text: '#F9A8D4', border: '#9D174D' },
    gray: { bg: '#374151', text: '#D1D5DB', border: '#4B5563' },
};

/**
 * Default system tags
 */
export const SYSTEM_TAGS: Partial<Tag>[] = [
    { name: 'Favorite', color: 'yellow', icon: '⭐', isSystem: true },
    { name: 'Important', color: 'red', icon: '❗', isSystem: true },
    { name: 'Todo', color: 'blue', icon: '📋', isSystem: true },
    { name: 'Done', color: 'green', icon: '✅', isSystem: true },
    { name: 'Bug', color: 'red', icon: '🐛', isSystem: true },
    { name: 'Feature', color: 'purple', icon: '✨', isSystem: true },
    { name: 'Question', color: 'teal', icon: '❓', isSystem: true },
    { name: 'Learning', color: 'indigo', icon: '📚', isSystem: true },
];

/**
 * Default smart collections
 */
export const DEFAULT_SMART_COLLECTIONS: Partial<Collection>[] = [
    {
        name: 'Recent',
        type: 'recent',
        icon: '🕐',
        smartRules: {
            filters: {
                logic: 'and',
                conditions: [
                    { field: 'updatedAt', operator: 'greaterThan', value: '-7d' },
                ],
            },
            refreshInterval: 0,
        },
    },
    {
        name: 'Starred',
        type: 'favorite',
        icon: '⭐',
        smartRules: {
            filters: {
                logic: 'and',
                conditions: [{ field: 'isStarred', operator: 'equals', value: true }],
            },
            refreshInterval: 0,
        },
    },
    {
        name: 'Has Code',
        type: 'smart',
        icon: '💻',
        smartRules: {
            filters: {
                logic: 'and',
                conditions: [{ field: 'hasCode', operator: 'equals', value: true }],
            },
            refreshInterval: 5,
        },
    },
    {
        name: 'Long Sessions',
        type: 'smart',
        icon: '📝',
        smartRules: {
            filters: {
                logic: 'and',
                conditions: [{ field: 'messageCount', operator: 'greaterThan', value: 20 }],
            },
            refreshInterval: 5,
        },
    },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get tag color styles based on theme
 */
export function getTagColorStyles(
    color: TagColor,
    isDarkMode: boolean
): { bg: string; text: string; border: string } {
    return isDarkMode ? TAG_COLOR_STYLES_DARK[color] : TAG_COLOR_STYLES[color];
}

/**
 * Build a tag path from hierarchy
 */
export function buildTagPath(tag: Tag, allTags: Tag[]): string {
    const path: string[] = [tag.name];
    let current = tag;

    while (current.parentId) {
        const parent = allTags.find((t) => t.id === current.parentId);
        if (!parent) break;
        path.unshift(parent.name);
        current = parent;
    }

    return path.join('/');
}

/**
 * Build a folder tree from flat folder list
 */
export function buildFolderTree(
    folders: Folder[],
    collections: Collection[],
    parentId?: string,
    depth = 0
): FolderTree[] {
    return folders
        .filter((f) => f.parentId === parentId)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((folder) => ({
            ...folder,
            children: buildFolderTree(folders, collections, folder.id, depth + 1),
            collections: collections.filter((c) => c.parentId === folder.id),
            sessionCount: 0, // Would be calculated from actual data
            path: '', // Would be built from hierarchy
            depth,
        }));
}

/**
 * Evaluate a filter condition against a session
 */
export function evaluateCondition(
    condition: FilterCondition,
    sessionValue: unknown
): boolean {
    const { operator, value } = condition;

    switch (operator) {
        case 'equals':
            return sessionValue === value;
        case 'notEquals':
            return sessionValue !== value;
        case 'contains':
            return String(sessionValue).toLowerCase().includes(String(value).toLowerCase());
        case 'notContains':
            return !String(sessionValue).toLowerCase().includes(String(value).toLowerCase());
        case 'startsWith':
            return String(sessionValue).toLowerCase().startsWith(String(value).toLowerCase());
        case 'endsWith':
            return String(sessionValue).toLowerCase().endsWith(String(value).toLowerCase());
        case 'greaterThan':
            return Number(sessionValue) > Number(value);
        case 'lessThan':
            return Number(sessionValue) < Number(value);
        case 'greaterOrEqual':
            return Number(sessionValue) >= Number(value);
        case 'lessOrEqual':
            return Number(sessionValue) <= Number(value);
        case 'between':
            if (Array.isArray(value) && value.length === 2) {
                const num = Number(sessionValue);
                const [min, max] = value as [number, number]; return num >= min && num <= max;
            }
            return false;
        case 'in':
            return Array.isArray(value) && (value as string[]).includes(sessionValue as string);
        case 'notIn':
            return Array.isArray(value) && !(value as string[]).includes(sessionValue as string);
        case 'isEmpty':
            return sessionValue === null || sessionValue === undefined || sessionValue === '';
        case 'isNotEmpty':
            return sessionValue !== null && sessionValue !== undefined && sessionValue !== '';
        case 'matches':
            try {
                const regex = new RegExp(String(value), 'i');
                return regex.test(String(sessionValue));
            } catch {
                return false;
            }
        default:
            return false;
    }
}

/**
 * Generate a unique tag ID
 */
export function generateTagId(): string {
    return `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique collection ID
 */
export function generateCollectionId(): string {
    return `col_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
