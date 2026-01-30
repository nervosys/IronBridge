/**
 * PresenceIndicator Component
 *
 * Shows real-time presence of users viewing/editing a session.
 * Displays avatars with online status and cursor positions.
 */

import { useState, useMemo } from 'react';
import type {
    SessionPresence,
    CollaborationUser,
    UserStatus,
} from '@csm/shared';

// =============================================================================
// Types
// =============================================================================

interface PresenceIndicatorProps {
    presences: SessionPresence[];
    maxVisible?: number;
    showTyping?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    onUserClick?: (userId: string) => void;
}

interface AvatarProps {
    user: CollaborationUser;
    status: UserStatus;
    isTyping?: boolean;
    size?: 'sm' | 'md' | 'lg';
    onClick?: () => void;
}

// =============================================================================
// Utilities
// =============================================================================

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getUserColor(userId: string): string {
    const colors = [
        '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
        '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
        '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
    ];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = ((hash << 5) - hash) + userId.charCodeAt(i);
        hash |= 0;
    }
    return colors[Math.abs(hash) % colors.length];
}

function getStatusColor(status: UserStatus): string {
    switch (status) {
        case 'online': return '#22c55e';
        case 'away': return '#f59e0b';
        case 'busy': return '#ef4444';
        case 'offline': return '#6b7280';
    }
}

// =============================================================================
// Subcomponents
// =============================================================================

function Avatar({ user, status, isTyping, size = 'md', onClick }: AvatarProps) {
    const sizeClasses = {
        sm: 'w-6 h-6 text-xs',
        md: 'w-8 h-8 text-sm',
        lg: 'w-10 h-10 text-base',
    };

    const statusSizeClasses = {
        sm: 'w-2 h-2',
        md: 'w-2.5 h-2.5',
        lg: 'w-3 h-3',
    };

    const backgroundColor = getUserColor(user.id);
    const statusColor = getStatusColor(status);

    return (
        <button
            onClick={onClick}
            className={`relative rounded-full flex items-center justify-center font-medium
                text-white transition-transform hover:scale-110 hover:z-10
                ${sizeClasses[size]} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
            style={{ backgroundColor }}
            title={`${user.displayName}${isTyping ? ' (typing...)' : ''}`}
        >
            {user.avatarUrl ? (
                <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    className="w-full h-full rounded-full object-cover"
                />
            ) : (
                getInitials(user.displayName)
            )}

            {/* Status indicator */}
            <span
                className={`absolute bottom-0 right-0 rounded-full border-2 border-white
                    dark:border-gray-800 ${statusSizeClasses[size]}`}
                style={{ backgroundColor: statusColor }}
            />

            {/* Typing indicator */}
            {isTyping && (
                <span className="absolute -top-1 -right-1 flex space-x-0.5">
                    <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"
                        style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"
                        style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"
                        style={{ animationDelay: '300ms' }} />
                </span>
            )}
        </button>
    );
}

function OverflowIndicator({ count, size = 'md' }: { count: number; size?: 'sm' | 'md' | 'lg' }) {
    const sizeClasses = {
        sm: 'w-6 h-6 text-xs',
        md: 'w-8 h-8 text-sm',
        lg: 'w-10 h-10 text-base',
    };

    return (
        <div
            className={`rounded-full flex items-center justify-center font-medium
                bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300
                ${sizeClasses[size]}`}
            title={`${count} more users`}
        >
            +{count}
        </div>
    );
}

// =============================================================================
// Main Component
// =============================================================================

export function PresenceIndicator({
    presences,
    maxVisible = 4,
    showTyping = true,
    size = 'md',
    className = '',
    onUserClick,
}: PresenceIndicatorProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Sort by activity and typing status
    const sortedPresences = useMemo(() => {
        return [...presences].sort((a, b) => {
            // Typing users first
            if (showTyping) {
                if (a.isTyping && !b.isTyping) return -1;
                if (!a.isTyping && b.isTyping) return 1;
            }
            // Then by last activity
            return b.lastActivity - a.lastActivity;
        });
    }, [presences, showTyping]);

    const visiblePresences = isExpanded ? sortedPresences : sortedPresences.slice(0, maxVisible);
    const overflowCount = sortedPresences.length - maxVisible;

    if (presences.length === 0) {
        return null;
    }

    return (
        <div className={`flex items-center ${className}`}>
            <div className="flex -space-x-2">
                {visiblePresences.map((presence) => (
                    <Avatar
                        key={presence.userId}
                        user={presence.user}
                        status={presence.user.status}
                        isTyping={showTyping && presence.isTyping}
                        size={size}
                        onClick={onUserClick ? () => onUserClick(presence.userId) : undefined}
                    />
                ))}

                {!isExpanded && overflowCount > 0 && (
                    <button
                        onClick={() => setIsExpanded(true)}
                        className="hover:scale-110 transition-transform"
                    >
                        <OverflowIndicator count={overflowCount} size={size} />
                    </button>
                )}
            </div>

            {isExpanded && overflowCount > 0 && (
                <button
                    onClick={() => setIsExpanded(false)}
                    className="ml-2 text-xs text-gray-500 hover:text-gray-700
                        dark:text-gray-400 dark:hover:text-gray-200"
                >
                    Show less
                </button>
            )}
        </div>
    );
}

// =============================================================================
// Presence List (Expanded View)
// =============================================================================

interface PresenceListProps {
    presences: SessionPresence[];
    onUserClick?: (userId: string) => void;
}

export function PresenceList({ presences, onUserClick }: PresenceListProps) {
    const sortedPresences = useMemo(() => {
        return [...presences].sort((a, b) => {
            // Online first, then by name
            const statusOrder = { online: 0, away: 1, busy: 2, offline: 3 };
            const statusDiff = statusOrder[a.user.status] - statusOrder[b.user.status];
            if (statusDiff !== 0) return statusDiff;
            return a.user.displayName.localeCompare(b.user.displayName);
        });
    }, [presences]);

    return (
        <div className="space-y-1">
            {sortedPresences.map((presence) => (
                <div
                    key={presence.userId}
                    onClick={() => onUserClick?.(presence.userId)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg
                        hover:bg-gray-100 dark:hover:bg-gray-700
                        ${onUserClick ? 'cursor-pointer' : ''}`}
                >
                    <Avatar
                        user={presence.user}
                        status={presence.user.status}
                        isTyping={presence.isTyping}
                        size="sm"
                    />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">
                            {presence.user.displayName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                            {presence.isTyping ? (
                                <span className="text-blue-500">Typing...</span>
                            ) : presence.viewingMessageId ? (
                                `Viewing message`
                            ) : (
                                formatLastActivity(presence.lastActivity)
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function formatLastActivity(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

// =============================================================================
// Cursor Overlay (for collaborative editing)
// =============================================================================

interface CursorOverlayProps {
    presences: SessionPresence[];
    currentUserId: string;
}

export function CursorOverlay({ presences, currentUserId }: CursorOverlayProps) {
    const otherCursors = presences.filter(
        p => p.userId !== currentUserId && p.cursor
    );

    return (
        <>
            {otherCursors.map((presence) => {
                if (!presence.cursor) return null;
                const color = getUserColor(presence.userId);

                return (
                    <div
                        key={presence.userId}
                        className="absolute pointer-events-none z-50"
                        style={{
                            // Position would be calculated based on cursor.offset
                            // This is a placeholder for the concept
                        }}
                    >
                        {/* Cursor line */}
                        <div
                            className="w-0.5 h-5"
                            style={{ backgroundColor: color }}
                        />
                        {/* Name tag */}
                        <div
                            className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-xs
                                text-white whitespace-nowrap"
                            style={{ backgroundColor: color }}
                        >
                            {presence.user.displayName}
                        </div>
                    </div>
                );
            })}
        </>
    );
}

export default PresenceIndicator;
