// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

import { useState, useMemo } from 'react';
import {
    GitCompare,
    ArrowLeftRight,
    MessageSquare,
    Clock,
    Bot,
    ChevronDown,
    Check,
    Plus,
    Minus,
} from 'lucide-react';
import type { Session, SessionWithMessages, Message } from '@ironbridge/shared';
import { formatRelativeTime } from '@ironbridge/shared';

interface SessionDiffProps {
    sessionA: SessionWithMessages | null;
    sessionB: SessionWithMessages | null;
    onSelectSession: (side: 'A' | 'B') => void;
    availableSessions: Session[];
}

interface DiffResult {
    type: 'added' | 'removed' | 'modified' | 'unchanged';
    messageA?: Message;
    messageB?: Message;
    index: number;
}

function computeDiff(messagesA: Message[], messagesB: Message[]): DiffResult[] {
    const results: DiffResult[] = [];
    const maxLen = Math.max(messagesA.length, messagesB.length);

    for (let i = 0; i < maxLen; i++) {
        const msgA = messagesA[i];
        const msgB = messagesB[i];

        if (!msgA && msgB) {
            results.push({ type: 'added', messageB: msgB, index: i });
        } else if (msgA && !msgB) {
            results.push({ type: 'removed', messageA: msgA, index: i });
        } else if (msgA && msgB) {
            const contentMatch = msgA.content === msgB.content;
            const roleMatch = msgA.role === msgB.role;
            if (contentMatch && roleMatch) {
                results.push({ type: 'unchanged', messageA: msgA, messageB: msgB, index: i });
            } else {
                results.push({ type: 'modified', messageA: msgA, messageB: msgB, index: i });
            }
        }
    }

    return results;
}

function MessageCard({ message }: { message: Message }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const content = message.content;
    const isLong = content.length > 300;
    const displayContent = isExpanded ? content : content.slice(0, 300);

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${message.role === 'user'
                    ? 'bg-blue-500/20 text-blue-400'
                    : message.role === 'assistant'
                        ? 'bg-violet-500/20 text-violet-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                    {message.role}
                </span>
                {message.model && (
                    <span className="text-[hsl(var(--muted-foreground))] text-xs">{message.model}</span>
                )}
                <span className="text-[hsl(var(--muted-foreground))] text-xs ml-auto">
                    {formatRelativeTime(message.createdAt)}
                </span>
            </div>
            <div className="text-sm whitespace-pre-wrap break-words">
                {displayContent}
                {isLong && !isExpanded && '...'}
            </div>
            {isLong && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-xs text-violet-500 hover:text-violet-400"
                >
                    {isExpanded ? 'Show less' : 'Show more'}
                </button>
            )}
        </div>
    );
}

function DiffRow({ diff }: { diff: DiffResult }) {
    const bgClass = {
        added: 'bg-green-500/10 border-l-4 border-green-500',
        removed: 'bg-red-500/10 border-l-4 border-red-500',
        modified: 'bg-amber-500/10 border-l-4 border-amber-500',
        unchanged: 'bg-[hsl(var(--card))]',
    }[diff.type];

    const icon = {
        added: <Plus className="w-4 h-4 text-green-500" />,
        removed: <Minus className="w-4 h-4 text-red-500" />,
        modified: <ArrowLeftRight className="w-4 h-4 text-amber-500" />,
        unchanged: <Check className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />,
    }[diff.type];

    return (
        <div className={`grid grid-cols-[auto_1fr_1fr] gap-4 p-4 rounded-lg ${bgClass}`}>
            <div className="flex flex-col items-center gap-1">
                {icon}
                <span className="text-xs text-[hsl(var(--muted-foreground))]">#{diff.index + 1}</span>
            </div>
            <div className={`${diff.type === 'added' ? 'opacity-30' : ''}`}>
                {diff.messageA ? (
                    <MessageCard message={diff.messageA} />
                ) : (
                    <div className="text-[hsl(var(--muted-foreground))] text-sm italic">No message</div>
                )}
            </div>
            <div className={`${diff.type === 'removed' ? 'opacity-30' : ''}`}>
                {diff.messageB ? (
                    <MessageCard message={diff.messageB} />
                ) : (
                    <div className="text-[hsl(var(--muted-foreground))] text-sm italic">No message</div>
                )}
            </div>
        </div>
    );
}

function SessionSelector({
    side,
    session,
    expanded,
    setExpanded,
    availableSessions,
    sessionA,
    sessionB,
    onSelectSession,
}: {
    side: 'A' | 'B';
    session: SessionWithMessages | null;
    expanded: boolean;
    setExpanded: (v: boolean) => void;
    availableSessions: Session[];
    sessionA: SessionWithMessages | null;
    sessionB: SessionWithMessages | null;
    onSelectSession: (side: 'A' | 'B') => void;
}) {
    return (
        <div className="relative">
            <button
                onClick={() => setExpanded(!expanded)}
                className={`w-full flex items-center justify-between p-4 rounded-lg border transition-colors ${session
                    ? 'bg-[hsl(var(--card))] border-[hsl(var(--border))]'
                    : 'bg-[hsl(var(--muted))]/20 border-dashed border-[hsl(var(--border))] hover:border-violet-500'
                    }`}
            >
                {session ? (
                    <div className="flex-1 text-left">
                        <div className="font-medium truncate">{session.title || 'Untitled'}</div>
                        <div className="flex items-center gap-3 text-sm text-[hsl(var(--muted-foreground))] mt-1">
                            <span className="flex items-center gap-1">
                                <Bot className="w-3 h-3" />
                                {session.provider}
                            </span>
                            <span className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                {session.messageCount}
                            </span>
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatRelativeTime(session.updatedAt)}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 text-left">
                        <div className="text-[hsl(var(--muted-foreground))]">Select Session {side}</div>
                        <div className="text-sm text-[hsl(var(--muted-foreground))]/70">Click to choose a session to compare</div>
                    </div>
                )}
                <ChevronDown className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>

            {expanded && (
                <div className="absolute z-20 mt-2 w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-xl max-h-80 overflow-y-auto">
                    {availableSessions.map((s) => (
                        <button
                            key={s.id}
                            onClick={() => {
                                onSelectSession(side);
                                setExpanded(false);
                            }}
                            disabled={
                                (side === 'A' && s.id === sessionB?.id) ||
                                (side === 'B' && s.id === sessionA?.id)
                            }
                            className="w-full text-left px-4 py-3 hover:bg-[hsl(var(--muted))]/50 disabled:opacity-30 disabled:cursor-not-allowed border-b border-[hsl(var(--border))] last:border-0"
                        >
                            <div className="font-medium truncate">{s.title || 'Untitled'}</div>
                            <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                <span>{s.provider}</span>
                                <span>{s.messageCount} msgs</span>
                                <span>{formatRelativeTime(s.updatedAt)}</span>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export function SessionDiff({
    sessionA,
    sessionB,
    onSelectSession,
    availableSessions,
}: SessionDiffProps) {
    const [showOnlyDiffs, setShowOnlyDiffs] = useState(false);
    const [expandedA, setExpandedA] = useState(false);
    const [expandedB, setExpandedB] = useState(false);

    const diff = useMemo(() => {
        if (!sessionA || !sessionB) return [];
        return computeDiff(sessionA.messages, sessionB.messages);
    }, [sessionA, sessionB]);

    const filteredDiff = useMemo(() => {
        if (!showOnlyDiffs) return diff;
        return diff.filter((d) => d.type !== 'unchanged');
    }, [diff, showOnlyDiffs]);

    const stats = useMemo(() => {
        return {
            added: diff.filter((d) => d.type === 'added').length,
            removed: diff.filter((d) => d.type === 'removed').length,
            modified: diff.filter((d) => d.type === 'modified').length,
            unchanged: diff.filter((d) => d.type === 'unchanged').length,
        };
    }, [diff]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <GitCompare className="w-6 h-6 text-violet-500" />
                    <div>
                        <h2 className="text-xl font-semibold">Session Comparison</h2>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            Compare messages between two sessions
                        </p>
                    </div>
                </div>
            </div>

            {/* Session Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-2 text-[hsl(var(--muted-foreground))]">
                        Session A (Base)
                    </label>
                    <SessionSelector
                        side="A"
                        session={sessionA}
                        expanded={expandedA}
                        setExpanded={setExpandedA}
                        availableSessions={availableSessions}
                        sessionA={sessionA}
                        sessionB={sessionB}
                        onSelectSession={onSelectSession}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2 text-[hsl(var(--muted-foreground))]">
                        Session B (Compare)
                    </label>
                    <SessionSelector
                        side="B"
                        session={sessionB}
                        expanded={expandedB}
                        setExpanded={setExpandedB}
                        availableSessions={availableSessions}
                        sessionA={sessionA}
                        sessionB={sessionB}
                        onSelectSession={onSelectSession}
                    />
                </div>
            </div>

            {/* Comparison Results */}
            {sessionA && sessionB && (
                <>
                    {/* Stats */}
                    <div className="flex flex-wrap items-center gap-4 p-4 bg-[hsl(var(--card))] rounded-lg border border-[hsl(var(--border))]">
                        <div className="flex items-center gap-2">
                            <Plus className="w-4 h-4 text-green-500" />
                            <span className="text-sm">
                                <span className="font-medium">{stats.added}</span> added
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Minus className="w-4 h-4 text-red-500" />
                            <span className="text-sm">
                                <span className="font-medium">{stats.removed}</span> removed
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <ArrowLeftRight className="w-4 h-4 text-amber-500" />
                            <span className="text-sm">
                                <span className="font-medium">{stats.modified}</span> modified
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                            <span className="text-sm">
                                <span className="font-medium">{stats.unchanged}</span> unchanged
                            </span>
                        </div>

                        <div className="ml-auto">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showOnlyDiffs}
                                    onChange={(e) => setShowOnlyDiffs(e.target.checked)}
                                    className="rounded"
                                />
                                <span className="text-sm">Show only differences</span>
                            </label>
                        </div>
                    </div>

                    {/* Diff View */}
                    <div className="space-y-2">
                        {/* Header */}
                        <div className="grid grid-cols-[auto_1fr_1fr] gap-4 px-4 py-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">
                            <div className="w-8"></div>
                            <div>Session A: {sessionA.title || 'Untitled'}</div>
                            <div>Session B: {sessionB.title || 'Untitled'}</div>
                        </div>

                        {/* Diff Rows */}
                        {filteredDiff.length > 0 ? (
                            filteredDiff.map((d, i) => <DiffRow key={i} diff={d} />)
                        ) : (
                            <div className="text-center py-12 text-[hsl(var(--muted-foreground))]">
                                {showOnlyDiffs ? (
                                    <>
                                        <Check className="w-12 h-12 mx-auto mb-3 text-green-500" />
                                        <p>Sessions are identical!</p>
                                    </>
                                ) : (
                                    <p>No messages to compare</p>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Empty State */}
            {(!sessionA || !sessionB) && (
                <div className="text-center py-12 bg-[hsl(var(--card))] rounded-lg border border-dashed border-[hsl(var(--border))]">
                    <GitCompare className="w-12 h-12 mx-auto mb-3 text-[hsl(var(--muted-foreground))]" />
                    <p className="text-[hsl(var(--muted-foreground))]">
                        Select two sessions to compare their messages
                    </p>
                </div>
            )}
        </div>
    );
}

export default SessionDiff;
