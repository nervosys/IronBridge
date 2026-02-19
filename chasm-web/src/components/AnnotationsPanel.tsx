/**
 * AnnotationsPanel Component
 *
 * Provides UI for managing session annotations including tags, notes,
 * highlights, and bookmarks.
 */

import React, { useState, useCallback, useMemo } from 'react';
import '../styles/annotations.css';
import type {
    SessionTag,
    SessionNote,
    MessageHighlight,
    SessionBookmark,
    SessionAnnotations,
} from '@csm/shared';
import { TAG_COLORS, HIGHLIGHT_COLORS } from '@csm/shared';

// =============================================================================
// Tag Picker Component
// =============================================================================

interface TagPickerProps {
    availableTags: SessionTag[];
    selectedTagIds: string[];
    onTagSelect: (tag: SessionTag) => void;
    onTagDeselect: (tagId: string) => void;
    onCreateTag: (tag: Omit<SessionTag, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export const TagPicker: React.FC<TagPickerProps> = ({
    availableTags,
    selectedTagIds,
    onTagSelect,
    onTagDeselect,
    onCreateTag,
}) => {
    const [isCreating, setIsCreating] = useState(false);
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState<string>(TAG_COLORS[0].value);

    const handleCreateTag = useCallback(() => {
        if (newTagName.trim()) {
            onCreateTag({
                name: newTagName.trim(),
                color: newTagColor,
            });
            setNewTagName('');
            setIsCreating(false);
        }
    }, [newTagName, newTagColor, onCreateTag]);

    const selectedSet = useMemo(() => new Set(selectedTagIds), [selectedTagIds]);

    return (
        <div className="tag-picker">
            <div className="tag-picker-header">
                <h4>Tags</h4>
                <button
                    className="btn-icon"
                    onClick={() => setIsCreating(!isCreating)}
                    title="Create new tag"
                >
                    {isCreating ? '×' : '+'}
                </button>
            </div>

            {isCreating && (
                <div className="tag-creator">
                    <input
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="Tag name"
                        className="tag-name-input"
                        autoFocus
                    />
                    <div className="color-picker">
                        {TAG_COLORS.map((color) => (
                            <button
                                key={color.name}
                                className={`color-swatch ${newTagColor === color.value ? 'selected' : ''}`}
                                style={{ backgroundColor: color.value }}
                                onClick={() => setNewTagColor(color.value)}
                                title={color.name}
                            />
                        ))}
                    </div>
                    <button className="btn-primary btn-sm" onClick={handleCreateTag}>
                        Create
                    </button>
                </div>
            )}

            <div className="tag-list">
                {availableTags.map((tag) => {
                    const isSelected = selectedSet.has(tag.id);
                    return (
                        <button
                            key={tag.id}
                            className={`tag-chip ${isSelected ? 'selected' : ''}`}
                            style={{
                                backgroundColor: isSelected ? tag.color : 'transparent',
                                borderColor: tag.color,
                                color: isSelected ? '#fff' : tag.color,
                            }}
                            onClick={() => isSelected ? onTagDeselect(tag.id) : onTagSelect(tag)}
                        >
                            {tag.name}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

// =============================================================================
// Note Editor Component
// =============================================================================

interface NoteEditorProps {
    notes: SessionNote[];
    sessionId: string;
    onAddNote: (content: string, pinned?: boolean) => void;
    onUpdateNote: (noteId: string, content: string) => void;
    onDeleteNote: (noteId: string) => void;
    onTogglePin: (noteId: string) => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
    notes,
    onAddNote,
    onUpdateNote,
    onDeleteNote,
    onTogglePin,
}) => {
    const [newNoteContent, setNewNoteContent] = useState('');
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');

    const handleAddNote = useCallback(() => {
        if (newNoteContent.trim()) {
            onAddNote(newNoteContent.trim());
            setNewNoteContent('');
        }
    }, [newNoteContent, onAddNote]);

    const startEditing = useCallback((note: SessionNote) => {
        setEditingNoteId(note.id);
        setEditContent(note.content);
    }, []);

    const saveEdit = useCallback(() => {
        if (editingNoteId && editContent.trim()) {
            onUpdateNote(editingNoteId, editContent.trim());
            setEditingNoteId(null);
            setEditContent('');
        }
    }, [editingNoteId, editContent, onUpdateNote]);

    const cancelEdit = useCallback(() => {
        setEditingNoteId(null);
        setEditContent('');
    }, []);

    // Sort notes: pinned first, then by date
    const sortedNotes = useMemo(() => {
        return [...notes].sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
    }, [notes]);

    return (
        <div className="note-editor">
            <div className="note-editor-header">
                <h4>Notes</h4>
                <span className="note-count">{notes.length}</span>
            </div>

            <div className="new-note">
                <textarea
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="Add a note..."
                    rows={3}
                    className="note-textarea"
                />
                <button
                    className="btn-primary btn-sm"
                    onClick={handleAddNote}
                    disabled={!newNoteContent.trim()}
                >
                    Add Note
                </button>
            </div>

            <div className="notes-list">
                {sortedNotes.map((note) => (
                    <div key={note.id} className={`note-item ${note.pinned ? 'pinned' : ''}`}>
                        {editingNoteId === note.id ? (
                            <div className="note-edit-mode">
                                <textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    rows={3}
                                    className="note-textarea"
                                    autoFocus
                                />
                                <div className="note-edit-actions">
                                    <button className="btn-primary btn-sm" onClick={saveEdit}>
                                        Save
                                    </button>
                                    <button className="btn-secondary btn-sm" onClick={cancelEdit}>
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="note-content">{note.content}</div>
                                <div className="note-meta">
                                    <span className="note-date">
                                        {new Date(note.updatedAt).toLocaleDateString()}
                                    </span>
                                    <div className="note-actions">
                                        <button
                                            className={`btn-icon ${note.pinned ? 'active' : ''}`}
                                            onClick={() => onTogglePin(note.id)}
                                            title={note.pinned ? 'Unpin' : 'Pin'}
                                        >
                                            📌
                                        </button>
                                        <button
                                            className="btn-icon"
                                            onClick={() => startEditing(note)}
                                            title="Edit"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className="btn-icon danger"
                                            onClick={() => onDeleteNote(note.id)}
                                            title="Delete"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// =============================================================================
// Highlight List Component
// =============================================================================

interface HighlightListProps {
    highlights: MessageHighlight[];
    onRemoveHighlight: (highlightId: string) => void;
}

export const HighlightList: React.FC<HighlightListProps> = ({
    highlights,
    onRemoveHighlight,
}) => {
    const [selectedColor, setSelectedColor] = useState<string>(HIGHLIGHT_COLORS[0].value);

    const groupedHighlights = useMemo(() => {
        const groups: Record<string, MessageHighlight[]> = {};
        highlights.forEach((h) => {
            if (!groups[h.messageId]) {
                groups[h.messageId] = [];
            }
            groups[h.messageId].push(h);
        });
        return groups;
    }, [highlights]);

    return (
        <div className="highlight-marker">
            <div className="highlight-marker-header">
                <h4>Highlights</h4>
                <span className="highlight-count">{highlights.length}</span>
            </div>

            <div className="highlight-color-selector">
                <span>Color:</span>
                {HIGHLIGHT_COLORS.map((color) => (
                    <button
                        key={color.name}
                        className={`color-swatch ${selectedColor === color.value ? 'selected' : ''}`}
                        style={{ backgroundColor: color.value }}
                        onClick={() => setSelectedColor(color.value)}
                        title={color.name}
                    />
                ))}
            </div>

            <div className="highlights-list">
                {Object.entries(groupedHighlights).map(([messageId, messageHighlights]) => (
                    <div key={messageId} className="message-highlights">
                        <div className="message-id">Message: {messageId.slice(0, 8)}...</div>
                        {messageHighlights.map((highlight) => (
                            <div
                                key={highlight.id}
                                className="highlight-item"
                                style={{ borderLeftColor: highlight.color }}
                            >
                                <div
                                    className="highlight-text"
                                    style={{ backgroundColor: highlight.color + '40' }}
                                >
                                    Offset: {highlight.startOffset}-{highlight.endOffset}
                                </div>
                                {highlight.note && (
                                    <div className="highlight-note">{highlight.note}</div>
                                )}
                                <button
                                    className="btn-icon danger"
                                    onClick={() => onRemoveHighlight(highlight.id)}
                                    title="Remove highlight"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                ))}
                {highlights.length === 0 && (
                    <div className="empty-state">
                        Select text in messages to add highlights
                    </div>
                )}
            </div>
        </div>
    );
};

// =============================================================================
// Bookmark List Component
// =============================================================================

interface BookmarkListProps {
    bookmarks: SessionBookmark[];
    onRemoveBookmark: (bookmarkId: string) => void;
    onNavigateToBookmark: (messageId: string) => void;
}

export const BookmarkList: React.FC<BookmarkListProps> = ({
    bookmarks,
    onRemoveBookmark,
    onNavigateToBookmark,
}) => {
    const sortedBookmarks = useMemo(() => {
        return [...bookmarks].sort((a, b) => a.sortOrder - b.sortOrder);
    }, [bookmarks]);

    return (
        <div className="bookmark-list">
            <div className="bookmark-list-header">
                <h4>Bookmarks</h4>
                <span className="bookmark-count">{bookmarks.length}</span>
            </div>

            <div className="bookmarks">
                {sortedBookmarks.map((bookmark) => (
                    <div
                        key={bookmark.id}
                        className="bookmark-item"
                        onClick={() => bookmark.messageId && onNavigateToBookmark(bookmark.messageId)}
                    >
                        <span className="bookmark-icon">🔖</span>
                        <div className="bookmark-info">
                            <div className="bookmark-label">
                                {bookmark.title}
                            </div>
                            <div className="bookmark-date">
                                {new Date(bookmark.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                        <button
                            className="btn-icon danger"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemoveBookmark(bookmark.id);
                            }}
                            title="Remove bookmark"
                        >
                            ×
                        </button>
                    </div>
                ))}
                {bookmarks.length === 0 && (
                    <div className="empty-state">
                        Click the bookmark icon on messages to save them here
                    </div>
                )}
            </div>
        </div>
    );
};

// =============================================================================
// Main Annotations Panel Component
// =============================================================================

interface AnnotationsPanelProps {
    sessionId: string;
    annotations: SessionAnnotations;
    availableTags: SessionTag[];
    onAnnotationsChange: (annotations: SessionAnnotations) => void;
    onCreateTag: (tag: Omit<SessionTag, 'id' | 'createdAt' | 'updatedAt'>) => void;
    onNavigateToMessage: (messageId: string) => void;
}

type AnnotationTab = 'tags' | 'notes' | 'highlights' | 'bookmarks';

export const AnnotationsPanel: React.FC<AnnotationsPanelProps> = ({
    sessionId,
    annotations,
    availableTags,
    onAnnotationsChange,
    onCreateTag,
    onNavigateToMessage,
}) => {
    const [activeTab, setActiveTab] = useState<AnnotationTab>('tags');

    // Tag handlers
    const handleTagSelect = useCallback(
        (tag: SessionTag) => {
            if (!annotations.tags.includes(tag.id)) {
                onAnnotationsChange({
                    ...annotations,
                    tags: [...annotations.tags, tag.id],
                });
            }
        },
        [annotations, onAnnotationsChange]
    );

    const handleTagDeselect = useCallback(
        (tagId: string) => {
            onAnnotationsChange({
                ...annotations,
                tags: annotations.tags.filter((id) => id !== tagId),
            });
        },
        [annotations, onAnnotationsChange]
    );

    // Note handlers
    const handleAddNote = useCallback(
        (content: string, pinned = false) => {
            const note: SessionNote = {
                id: crypto.randomUUID(),
                sessionId,
                content,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                pinned,
            };
            onAnnotationsChange({
                ...annotations,
                notes: [...annotations.notes, note],
            });
        },
        [annotations, sessionId, onAnnotationsChange]
    );

    const handleUpdateNote = useCallback(
        (noteId: string, content: string) => {
            onAnnotationsChange({
                ...annotations,
                notes: annotations.notes.map((note) =>
                    note.id === noteId
                        ? { ...note, content, updatedAt: new Date().toISOString() }
                        : note
                ),
            });
        },
        [annotations, onAnnotationsChange]
    );

    const handleDeleteNote = useCallback(
        (noteId: string) => {
            onAnnotationsChange({
                ...annotations,
                notes: annotations.notes.filter((note) => note.id !== noteId),
            });
        },
        [annotations, onAnnotationsChange]
    );

    const handleTogglePin = useCallback(
        (noteId: string) => {
            onAnnotationsChange({
                ...annotations,
                notes: annotations.notes.map((note) =>
                    note.id === noteId ? { ...note, pinned: !note.pinned } : note
                ),
            });
        },
        [annotations, onAnnotationsChange]
    );

    // Highlight handlers
    const handleRemoveHighlight = useCallback(
        (highlightId: string) => {
            onAnnotationsChange({
                ...annotations,
                highlights: annotations.highlights.filter((h) => h.id !== highlightId),
            });
        },
        [annotations, onAnnotationsChange]
    );

    // Bookmark handlers
    const handleRemoveBookmark = useCallback(
        (bookmarkId: string) => {
            onAnnotationsChange({
                ...annotations,
                bookmarks: annotations.bookmarks.filter((b) => b.id !== bookmarkId),
            });
        },
        [annotations, onAnnotationsChange]
    );

    // Summary
    const summary = useMemo(() => ({
        tagCount: annotations.tags.length,
        noteCount: annotations.notes.length,
        highlightCount: annotations.highlights.length,
        bookmarkCount: annotations.bookmarks.length,
    }), [annotations]);

    return (
        <div className="annotations-panel">
            <div className="annotations-panel-header">
                <h3>Annotations</h3>
                <div className="annotation-summary">
                    <span title="Tags">🏷️ {summary.tagCount}</span>
                    <span title="Notes">📝 {summary.noteCount}</span>
                    <span title="Highlights">🖍️ {summary.highlightCount}</span>
                    <span title="Bookmarks">🔖 {summary.bookmarkCount}</span>
                </div>
            </div>

            <div className="annotations-tabs">
                <button
                    className={`tab ${activeTab === 'tags' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tags')}
                >
                    Tags
                </button>
                <button
                    className={`tab ${activeTab === 'notes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('notes')}
                >
                    Notes
                </button>
                <button
                    className={`tab ${activeTab === 'highlights' ? 'active' : ''}`}
                    onClick={() => setActiveTab('highlights')}
                >
                    Highlights
                </button>
                <button
                    className={`tab ${activeTab === 'bookmarks' ? 'active' : ''}`}
                    onClick={() => setActiveTab('bookmarks')}
                >
                    Bookmarks
                </button>
            </div>

            <div className="annotations-content">
                {activeTab === 'tags' && (
                    <TagPicker
                        availableTags={availableTags}
                        selectedTagIds={annotations.tags}
                        onTagSelect={handleTagSelect}
                        onTagDeselect={handleTagDeselect}
                        onCreateTag={onCreateTag}
                    />
                )}

                {activeTab === 'notes' && (
                    <NoteEditor
                        notes={annotations.notes}
                        sessionId={sessionId}
                        onAddNote={handleAddNote}
                        onUpdateNote={handleUpdateNote}
                        onDeleteNote={handleDeleteNote}
                        onTogglePin={handleTogglePin}
                    />
                )}

                {activeTab === 'highlights' && (
                    <HighlightList
                        highlights={annotations.highlights}
                        onRemoveHighlight={handleRemoveHighlight}
                    />
                )}

                {activeTab === 'bookmarks' && (
                    <BookmarkList
                        bookmarks={annotations.bookmarks}
                        onRemoveBookmark={handleRemoveBookmark}
                        onNavigateToBookmark={onNavigateToMessage}
                    />
                )}
            </div>
        </div>
    );
};

export default AnnotationsPanel;
