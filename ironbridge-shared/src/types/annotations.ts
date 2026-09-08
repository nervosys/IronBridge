// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// =============================================================================
// Session Annotations Types
// =============================================================================
// Types for session notes, tags, highlights, and other annotations

/**
 * A tag that can be applied to sessions
 */
export interface SessionTag {
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
export interface SessionNote {
    id: string;
    sessionId: string;
    messageId?: string; // If attached to a specific message
    content: string;
    createdAt: string;
    updatedAt: string;
    author?: string;
    pinned?: boolean;
}

/**
 * A highlight within a message
 */
export interface MessageHighlight {
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
export interface SessionBookmark {
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
export interface SessionAnnotations {
    sessionId: string;
    tags: string[]; // Tag IDs
    notes: SessionNote[];
    highlights: MessageHighlight[];
    bookmarks: SessionBookmark[];
    rating?: number; // 1-5 star rating
    status?: 'active' | 'archived' | 'favorite' | 'flagged';
    customFields?: Record<string, string | number | boolean>;
}

/**
 * Annotation summary for list views
 */
export interface AnnotationSummary {
    tagCount: number;
    noteCount: number;
    highlightCount: number;
    bookmarkCount: number;
    rating?: number;
    status?: string;
}

// =============================================================================
// Predefined Tag Colors
// =============================================================================

export const TAG_COLORS = [
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
    { name: 'Rose', value: '#f43f5e' },
    { name: 'Gray', value: '#6b7280' },
] as const;

export const HIGHLIGHT_COLORS = [
    { name: 'Yellow', value: '#fef08a' },
    { name: 'Green', value: '#bbf7d0' },
    { name: 'Blue', value: '#bfdbfe' },
    { name: 'Pink', value: '#fbcfe8' },
    { name: 'Purple', value: '#ddd6fe' },
    { name: 'Orange', value: '#fed7aa' },
] as const;

// =============================================================================
// Default Tags
// =============================================================================

export const DEFAULT_TAGS: Omit<SessionTag, 'id' | 'createdAt' | 'updatedAt'>[] = [
    { name: 'Important', color: '#ef4444', description: 'High priority sessions' },
    { name: 'Review', color: '#f59e0b', description: 'Sessions to review later' },
    { name: 'Bug Fix', color: '#ec4899', description: 'Bug fixing sessions' },
    { name: 'Feature', color: '#22c55e', description: 'Feature development' },
    { name: 'Learning', color: '#3b82f6', description: 'Learning and exploration' },
    { name: 'Research', color: '#8b5cf6', description: 'Research and investigation' },
    { name: 'Documentation', color: '#06b6d4', description: 'Documentation work' },
    { name: 'Refactor', color: '#6366f1', description: 'Code refactoring' },
];
