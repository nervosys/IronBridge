/**
 * TaggingPanel Component
 *
 * Comprehensive UI for managing tags, collections, and session organization.
 */

import React, { useState, useMemo, useCallback } from 'react';
import type {
    Tag,
    TagColor,
    TagScope,
    TagWithHierarchy,
    Collection,
    CollectionType,
    Folder,
    AutoTagRule,
    TagSuggestion,
    OrganizationPreferences,
    ViewMode,
    GroupBy,
} from '@csm/shared';
import {
    TAG_COLOR_STYLES,
    getTagColorStyles,
    buildTagPath,
} from '@csm/shared';

// ============================================================================
// Props Types
// ============================================================================

interface TaggingPanelProps {
    /** All available tags */
    tags: Tag[];
    /** All collections */
    collections: Collection[];
    /** All folders */
    folders: Folder[];
    /** Auto-tagging rules */
    autoTagRules: AutoTagRule[];
    /** User's organization preferences */
    preferences: OrganizationPreferences;
    /** Currently selected session IDs */
    selectedSessionIds: string[];
    /** Tags currently applied to selected sessions */
    appliedTagIds: string[];
    /** Tag suggestions for selected sessions */
    suggestions?: TagSuggestion[];
    /** Dark mode */
    isDarkMode?: boolean;
    /** Callbacks */
    onCreateTag: (tag: Omit<Tag, 'id' | 'usageCount' | 'createdAt' | 'isSystem'>) => void;
    onUpdateTag: (tagId: string, updates: Partial<Tag>) => void;
    onDeleteTag: (tagId: string) => void;
    onMergeTags: (sourceTagIds: string[], targetTagId: string) => void;
    onAssignTags: (sessionIds: string[], tagIds: string[]) => void;
    onRemoveTags: (sessionIds: string[], tagIds: string[]) => void;
    onCreateCollection: (collection: Omit<Collection, 'id' | 'sessionCount' | 'createdAt' | 'updatedAt'>) => void;
    onUpdateCollection: (collectionId: string, updates: Partial<Collection>) => void;
    onDeleteCollection: (collectionId: string) => void;
    onAddToCollection: (collectionId: string, sessionIds: string[]) => void;
    onRemoveFromCollection: (collectionId: string, sessionIds: string[]) => void;
    onCreateFolder: (folder: Omit<Folder, 'id' | 'createdAt' | 'updatedAt'>) => void;
    onUpdateFolder: (folderId: string, updates: Partial<Folder>) => void;
    onDeleteFolder: (folderId: string) => void;
    onCreateAutoTagRule: (rule: Omit<AutoTagRule, 'id' | 'createdAt' | 'applyCount'>) => void;
    onUpdateAutoTagRule: (ruleId: string, updates: Partial<AutoTagRule>) => void;
    onDeleteAutoTagRule: (ruleId: string) => void;
    onUpdatePreferences: (updates: Partial<OrganizationPreferences>) => void;
    onApplySuggestion: (suggestion: TagSuggestion) => void;
}

// ============================================================================
// Sub-Components
// ============================================================================

/** Tag badge component */
const TagBadge: React.FC<{
    tag: Tag;
    isDarkMode?: boolean;
    isSelected?: boolean;
    showCount?: boolean;
    onRemove?: () => void;
    onClick?: () => void;
}> = ({ tag, isDarkMode = false, isSelected, showCount, onRemove, onClick }) => {
    const colors = getTagColorStyles(tag.color, isDarkMode);

    return (
        <span
            className={`tag-badge ${isSelected ? 'selected' : ''}`}
            style={{
                backgroundColor: colors.bg,
                color: colors.text,
                border: `1px solid ${colors.border}`,
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                cursor: onClick ? 'pointer' : 'default',
            }}
            onClick={onClick}
        >
            {tag.icon && <span>{tag.icon}</span>}
            <span>{tag.name}</span>
            {showCount && tag.usageCount > 0 && (
                <span style={{ opacity: 0.7 }}>({tag.usageCount})</span>
            )}
            {onRemove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0 2px',
                        color: colors.text,
                        opacity: 0.7,
                    }}
                >
                    ×
                </button>
            )}
        </span>
    );
};

/** Color picker for tags */
const ColorPicker: React.FC<{
    value: TagColor;
    onChange: (color: TagColor) => void;
    isDarkMode?: boolean;
}> = ({ value, onChange, isDarkMode = false }) => {
    const colors = Object.keys(TAG_COLOR_STYLES) as TagColor[];

    return (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {colors.map((color) => {
                const styles = getTagColorStyles(color, isDarkMode);
                return (
                    <button
                        key={color}
                        onClick={() => onChange(color)}
                        style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: styles.bg,
                            border: value === color ? `2px solid ${styles.text}` : `1px solid ${styles.border}`,
                            cursor: 'pointer',
                        }}
                        title={color}
                    />
                );
            })}
        </div>
    );
};

/** Tag editor modal */
const TagEditorModal: React.FC<{
    tag?: Tag;
    parentTags: Tag[];
    isDarkMode?: boolean;
    onSave: (tag: Omit<Tag, 'id' | 'usageCount' | 'createdAt' | 'isSystem'>) => void;
    onClose: () => void;
}> = ({ tag, parentTags, isDarkMode = false, onSave, onClose }) => {
    const [name, setName] = useState(tag?.name || '');
    const [description, setDescription] = useState(tag?.description || '');
    const [color, setColor] = useState<TagColor>(tag?.color || 'blue');
    const [icon, setIcon] = useState(tag?.icon || '');
    const [scope, setScope] = useState<TagScope>(tag?.scope || 'personal');
    const [parentId, setParentId] = useState(tag?.parentId || '');
    const [shortcut, setShortcut] = useState(tag?.shortcut || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        onSave({
            name: name.trim(),
            description: description.trim() || undefined,
            color,
            icon: icon || undefined,
            scope,
            parentId: parentId || undefined,
            shortcut: shortcut || undefined,
        });
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
        }}>
            <div className="modal-content" style={{
                backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                color: isDarkMode ? '#f9fafb' : '#111827',
                borderRadius: '8px',
                padding: '24px',
                width: '400px',
                maxHeight: '80vh',
                overflow: 'auto',
            }}>
                <h3 style={{ margin: '0 0 16px' }}>{tag ? 'Edit Tag' : 'Create Tag'}</h3>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                            Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Tag name"
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '4px',
                                border: `1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'}`,
                                backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                                color: isDarkMode ? '#f9fafb' : '#111827',
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional description"
                            rows={2}
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '4px',
                                border: `1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'}`,
                                backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                                color: isDarkMode ? '#f9fafb' : '#111827',
                                resize: 'vertical',
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                            Color
                        </label>
                        <ColorPicker value={color} onChange={setColor} isDarkMode={isDarkMode} />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                            Icon (emoji)
                        </label>
                        <input
                            type="text"
                            value={icon}
                            onChange={(e) => setIcon(e.target.value)}
                            placeholder="🏷️"
                            maxLength={2}
                            style={{
                                width: '60px',
                                padding: '8px',
                                borderRadius: '4px',
                                border: `1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'}`,
                                backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                                color: isDarkMode ? '#f9fafb' : '#111827',
                                textAlign: 'center',
                                fontSize: '18px',
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                            Scope
                        </label>
                        <select
                            value={scope}
                            onChange={(e) => setScope(e.target.value as TagScope)}
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '4px',
                                border: `1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'}`,
                                backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                                color: isDarkMode ? '#f9fafb' : '#111827',
                            }}
                        >
                            <option value="personal">Personal</option>
                            <option value="team">Team</option>
                            <option value="organization">Organization</option>
                            <option value="public">Public</option>
                        </select>
                    </div>

                    {parentTags.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                                Parent Tag
                            </label>
                            <select
                                value={parentId}
                                onChange={(e) => setParentId(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    border: `1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'}`,
                                    backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                                    color: isDarkMode ? '#f9fafb' : '#111827',
                                }}
                            >
                                <option value="">None (root level)</option>
                                {parentTags.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {buildTagPath(t, parentTags)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                            Keyboard Shortcut
                        </label>
                        <input
                            type="text"
                            value={shortcut}
                            onChange={(e) => setShortcut(e.target.value)}
                            placeholder="e.g., Ctrl+Shift+1"
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '4px',
                                border: `1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'}`,
                                backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                                color: isDarkMode ? '#f9fafb' : '#111827',
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '4px',
                                border: `1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'}`,
                                backgroundColor: 'transparent',
                                color: isDarkMode ? '#f9fafb' : '#111827',
                                cursor: 'pointer',
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim()}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '4px',
                                border: 'none',
                                backgroundColor: '#3b82f6',
                                color: '#ffffff',
                                cursor: name.trim() ? 'pointer' : 'not-allowed',
                                opacity: name.trim() ? 1 : 0.5,
                            }}
                        >
                            {tag ? 'Save' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/** Collection editor modal */
const CollectionEditorModal: React.FC<{
    collection?: Collection;
    folders: Folder[];
    isDarkMode?: boolean;
    onSave: (collection: Omit<Collection, 'id' | 'sessionCount' | 'createdAt' | 'updatedAt'>) => void;
    onClose: () => void;
}> = ({ collection, folders, isDarkMode = false, onSave, onClose }) => {
    const [name, setName] = useState(collection?.name || '');
    const [description, setDescription] = useState(collection?.description || '');
    const [type, setType] = useState<CollectionType>(collection?.type || 'manual');
    const [icon, setIcon] = useState(collection?.icon || '');
    const [color, setColor] = useState<TagColor | undefined>(collection?.color);
    const [parentId, setParentId] = useState(collection?.parentId || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        onSave({
            name: name.trim(),
            description: description.trim() || undefined,
            type,
            icon: icon || undefined,
            color,
            ownerId: '', // Will be set by backend
            parentId: parentId || undefined,
            sortOrder: collection?.sortOrder || { field: 'updatedAt', direction: 'desc' },
            displayOrder: collection?.displayOrder || 0,
            isPinned: collection?.isPinned || false,
            isExpanded: collection?.isExpanded ?? true,
        });
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
        }}>
            <div className="modal-content" style={{
                backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                color: isDarkMode ? '#f9fafb' : '#111827',
                borderRadius: '8px',
                padding: '24px',
                width: '400px',
                maxHeight: '80vh',
                overflow: 'auto',
            }}>
                <h3 style={{ margin: '0 0 16px' }}>
                    {collection ? 'Edit Collection' : 'Create Collection'}
                </h3>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                            Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Collection name"
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '4px',
                                border: `1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'}`,
                                backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                                color: isDarkMode ? '#f9fafb' : '#111827',
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                            Type
                        </label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as CollectionType)}
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '4px',
                                border: `1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'}`,
                                backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                                color: isDarkMode ? '#f9fafb' : '#111827',
                            }}
                        >
                            <option value="manual">Manual</option>
                            <option value="smart">Smart (auto-populated)</option>
                            <option value="favorite">Favorites</option>
                            <option value="archive">Archive</option>
                        </select>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional description"
                            rows={2}
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '4px',
                                border: `1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'}`,
                                backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                                color: isDarkMode ? '#f9fafb' : '#111827',
                                resize: 'vertical',
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                            Icon (emoji)
                        </label>
                        <input
                            type="text"
                            value={icon}
                            onChange={(e) => setIcon(e.target.value)}
                            placeholder="📁"
                            maxLength={2}
                            style={{
                                width: '60px',
                                padding: '8px',
                                borderRadius: '4px',
                                border: `1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'}`,
                                backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                                color: isDarkMode ? '#f9fafb' : '#111827',
                                textAlign: 'center',
                                fontSize: '18px',
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                            Color
                        </label>
                        <ColorPicker
                            value={color || 'gray'}
                            onChange={setColor}
                            isDarkMode={isDarkMode}
                        />
                    </div>

                    {folders.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                                Folder
                            </label>
                            <select
                                value={parentId}
                                onChange={(e) => setParentId(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    border: `1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'}`,
                                    backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                                    color: isDarkMode ? '#f9fafb' : '#111827',
                                }}
                            >
                                <option value="">No folder</option>
                                {folders.map((f) => (
                                    <option key={f.id} value={f.id}>
                                        {f.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '4px',
                                border: `1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'}`,
                                backgroundColor: 'transparent',
                                color: isDarkMode ? '#f9fafb' : '#111827',
                                cursor: 'pointer',
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim()}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '4px',
                                border: 'none',
                                backgroundColor: '#3b82f6',
                                color: '#ffffff',
                                cursor: name.trim() ? 'pointer' : 'not-allowed',
                                opacity: name.trim() ? 1 : 0.5,
                            }}
                        >
                            {collection ? 'Save' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/** Tag suggestion card */
const SuggestionCard: React.FC<{
    suggestion: TagSuggestion;
    isDarkMode?: boolean;
    onApply: () => void;
    onDismiss: () => void;
}> = ({ suggestion, isDarkMode = false, onApply, onDismiss }) => {
    const tag = 'id' in suggestion.tag
        ? suggestion.tag
        : { ...suggestion.tag, id: '', usageCount: 0, createdAt: '', isSystem: false, scope: 'personal' as TagScope };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px',
            borderRadius: '4px',
            backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
            marginBottom: '8px',
        }}>
            <TagBadge tag={tag as Tag} isDarkMode={isDarkMode} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
                    {Math.round(suggestion.confidence * 100)}% confidence
                </div>
                <div style={{
                    fontSize: '11px',
                    color: isDarkMode ? '#6b7280' : '#9ca3af',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}>
                    {suggestion.reason}
                </div>
            </div>
            <button
                onClick={onApply}
                style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontSize: '12px',
                }}
            >
                Apply
            </button>
            <button
                onClick={onDismiss}
                style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: isDarkMode ? '#9ca3af' : '#6b7280',
                    cursor: 'pointer',
                    fontSize: '16px',
                }}
            >
                ×
            </button>
        </div>
    );
};

// ============================================================================
// Main Component
// ============================================================================

export const TaggingPanel: React.FC<TaggingPanelProps> = ({
    tags,
    collections,
    folders,
    autoTagRules,
    preferences,
    selectedSessionIds,
    appliedTagIds,
    suggestions = [],
    isDarkMode = false,
    onCreateTag,
    onUpdateTag,
    onDeleteTag,
    onMergeTags,
    onAssignTags,
    onRemoveTags,
    onCreateCollection,
    onUpdateCollection,
    onDeleteCollection,
    onAddToCollection,
    onRemoveFromCollection,
    onCreateFolder,
    onUpdateFolder,
    onDeleteFolder,
    onCreateAutoTagRule,
    onUpdateAutoTagRule,
    onDeleteAutoTagRule,
    onUpdatePreferences,
    onApplySuggestion,
}) => {
    // Suppress unused variable warnings for callbacks we'll use in the future
    void onMergeTags;
    void onRemoveFromCollection;
    void onCreateFolder;
    void onUpdateFolder;
    void onDeleteFolder;
    void onCreateAutoTagRule;
    void onUpdateAutoTagRule;
    void onDeleteAutoTagRule;
    void autoTagRules;

    const [activeTab, setActiveTab] = useState<'tags' | 'collections' | 'settings'>('tags');
    const [searchQuery, setSearchQuery] = useState('');
    const [showTagEditor, setShowTagEditor] = useState(false);
    const [editingTag, setEditingTag] = useState<Tag | undefined>();
    const [showCollectionEditor, setShowCollectionEditor] = useState(false);
    const [editingCollection, setEditingCollection] = useState<Collection | undefined>();
    const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

    // Filter tags based on search
    const filteredTags = useMemo(() => {
        if (!searchQuery) return tags;
        const query = searchQuery.toLowerCase();
        return tags.filter(
            (tag) =>
                tag.name.toLowerCase().includes(query) ||
                tag.description?.toLowerCase().includes(query)
        );
    }, [tags, searchQuery]);

    // Group tags by hierarchy
    const tagHierarchy = useMemo((): TagWithHierarchy[] => {
        const buildHierarchy = (parentId?: string, depth = 0): TagWithHierarchy[] => {
            return filteredTags
                .filter((t) => t.parentId === parentId)
                .map((tag) => ({
                    ...tag,
                    children: buildHierarchy(tag.id, depth + 1),
                    path: buildTagPath(tag, tags),
                    depth,
                }));
        };
        return buildHierarchy(undefined);
    }, [filteredTags, tags]);

    // Filter suggestions
    const visibleSuggestions = useMemo(() => {
        return suggestions.filter((s) => {
            const key = 'id' in s.tag ? s.tag.id : s.tag.name;
            return !dismissedSuggestions.has(key);
        });
    }, [suggestions, dismissedSuggestions]);

    // Handle tag click
    const handleTagClick = useCallback((tag: Tag) => {
        if (selectedSessionIds.length === 0) return;

        if (appliedTagIds.includes(tag.id)) {
            onRemoveTags(selectedSessionIds, [tag.id]);
        } else {
            onAssignTags(selectedSessionIds, [tag.id]);
        }
    }, [selectedSessionIds, appliedTagIds, onAssignTags, onRemoveTags]);

    // Handle collection click
    const handleCollectionClick = useCallback((collection: Collection) => {
        if (selectedSessionIds.length === 0) return;
        onAddToCollection(collection.id, selectedSessionIds);
    }, [selectedSessionIds, onAddToCollection]);

    // Render tag tree
    const renderTagTree = (hierarchy: TagWithHierarchy[], depth = 0) => {
        return hierarchy.map((tag) => (
            <div key={tag.id} style={{ marginLeft: depth * 16 }}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: appliedTagIds.includes(tag.id)
                            ? isDarkMode ? '#1e3a5f' : '#dbeafe'
                            : 'transparent',
                        cursor: selectedSessionIds.length > 0 ? 'pointer' : 'default',
                    }}
                    onClick={() => handleTagClick(tag)}
                >
                    <TagBadge
                        tag={tag}
                        isDarkMode={isDarkMode}
                        isSelected={appliedTagIds.includes(tag.id)}
                        showCount
                    />
                    <div style={{ flex: 1 }} />
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setEditingTag(tag);
                            setShowTagEditor(true);
                        }}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px',
                            color: isDarkMode ? '#9ca3af' : '#6b7280',
                            opacity: 0.6,
                        }}
                    >
                        ✏️
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete tag "${tag.name}"?`)) {
                                onDeleteTag(tag.id);
                            }
                        }}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px',
                            color: isDarkMode ? '#9ca3af' : '#6b7280',
                            opacity: 0.6,
                        }}
                    >
                        🗑️
                    </button>
                </div>
                {tag.children.length > 0 && renderTagTree(tag.children, depth + 1)}
            </div>
        ));
    };

    return (
        <div
            className="tagging-panel"
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                backgroundColor: isDarkMode ? '#111827' : '#ffffff',
                color: isDarkMode ? '#f9fafb' : '#111827',
            }}
        >
            {/* Tabs */}
            <div style={{
                display: 'flex',
                borderBottom: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
            }}>
                {(['tags', 'collections', 'settings'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            flex: 1,
                            padding: '12px',
                            border: 'none',
                            borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
                            backgroundColor: 'transparent',
                            color: activeTab === tab
                                ? '#3b82f6'
                                : isDarkMode ? '#9ca3af' : '#6b7280',
                            cursor: 'pointer',
                            fontWeight: activeTab === tab ? 600 : 400,
                            textTransform: 'capitalize',
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                {/* Tags Tab */}
                {activeTab === 'tags' && (
                    <>
                        {/* Search and Create */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search tags..."
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    borderRadius: '4px',
                                    border: `1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'}`,
                                    backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                                    color: isDarkMode ? '#f9fafb' : '#111827',
                                }}
                            />
                            <button
                                onClick={() => {
                                    setEditingTag(undefined);
                                    setShowTagEditor(true);
                                }}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    backgroundColor: '#3b82f6',
                                    color: '#ffffff',
                                    cursor: 'pointer',
                                }}
                            >
                                + Tag
                            </button>
                        </div>

                        {/* Suggestions */}
                        {visibleSuggestions.length > 0 && selectedSessionIds.length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                                <h4 style={{
                                    margin: '0 0 8px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    color: isDarkMode ? '#9ca3af' : '#6b7280',
                                }}>
                                    Suggested Tags
                                </h4>
                                {visibleSuggestions.map((suggestion, idx) => (
                                    <SuggestionCard
                                        key={idx}
                                        suggestion={suggestion}
                                        isDarkMode={isDarkMode}
                                        onApply={() => onApplySuggestion(suggestion)}
                                        onDismiss={() => {
                                            const key = 'id' in suggestion.tag ? suggestion.tag.id : suggestion.tag.name;
                                            setDismissedSuggestions((prev) => new Set([...prev, key]));
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Applied Tags */}
                        {appliedTagIds.length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                                <h4 style={{
                                    margin: '0 0 8px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    color: isDarkMode ? '#9ca3af' : '#6b7280',
                                }}>
                                    Applied Tags
                                </h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {appliedTagIds.map((tagId) => {
                                        const tag = tags.find((t) => t.id === tagId);
                                        if (!tag) return null;
                                        return (
                                            <TagBadge
                                                key={tag.id}
                                                tag={tag}
                                                isDarkMode={isDarkMode}
                                                onRemove={() => onRemoveTags(selectedSessionIds, [tag.id])}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* All Tags */}
                        <h4 style={{
                            margin: '0 0 8px',
                            fontSize: '12px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            color: isDarkMode ? '#9ca3af' : '#6b7280',
                        }}>
                            All Tags
                        </h4>
                        {tagHierarchy.length > 0 ? (
                            renderTagTree(tagHierarchy)
                        ) : (
                            <div style={{
                                textAlign: 'center',
                                padding: '24px',
                                color: isDarkMode ? '#6b7280' : '#9ca3af',
                            }}>
                                {searchQuery ? 'No tags match your search' : 'No tags yet. Create one!'}
                            </div>
                        )}
                    </>
                )}

                {/* Collections Tab */}
                {activeTab === 'collections' && (
                    <>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                            <button
                                onClick={() => {
                                    setEditingCollection(undefined);
                                    setShowCollectionEditor(true);
                                }}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    backgroundColor: '#3b82f6',
                                    color: '#ffffff',
                                    cursor: 'pointer',
                                }}
                            >
                                + Collection
                            </button>
                        </div>

                        {collections.length > 0 ? (
                            collections.map((collection) => (
                                <div
                                    key={collection.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '8px',
                                        borderRadius: '4px',
                                        marginBottom: '4px',
                                        backgroundColor: isDarkMode ? '#374151' : '#f3f4f6',
                                        cursor: selectedSessionIds.length > 0 ? 'pointer' : 'default',
                                    }}
                                    onClick={() => handleCollectionClick(collection)}
                                >
                                    <span style={{ fontSize: '18px' }}>{collection.icon || '📁'}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 500 }}>{collection.name}</div>
                                        <div style={{
                                            fontSize: '12px',
                                            color: isDarkMode ? '#9ca3af' : '#6b7280',
                                        }}>
                                            {collection.sessionCount} sessions • {collection.type}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingCollection(collection);
                                            setShowCollectionEditor(true);
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '2px',
                                            color: isDarkMode ? '#9ca3af' : '#6b7280',
                                        }}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(`Delete collection "${collection.name}"?`)) {
                                                onDeleteCollection(collection.id);
                                            }
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '2px',
                                            color: isDarkMode ? '#9ca3af' : '#6b7280',
                                        }}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div style={{
                                textAlign: 'center',
                                padding: '24px',
                                color: isDarkMode ? '#6b7280' : '#9ca3af',
                            }}>
                                No collections yet. Create one!
                            </div>
                        )}
                    </>
                )}

                {/* Settings Tab */}
                {activeTab === 'settings' && (
                    <div>
                        <h4 style={{ margin: '0 0 16px' }}>Organization Preferences</h4>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                                Default View Mode
                            </label>
                            <select
                                value={preferences.defaultViewMode}
                                onChange={(e) => onUpdatePreferences({ defaultViewMode: e.target.value as ViewMode })}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    border: `1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'}`,
                                    backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                                    color: isDarkMode ? '#f9fafb' : '#111827',
                                }}
                            >
                                <option value="list">List</option>
                                <option value="grid">Grid</option>
                                <option value="timeline">Timeline</option>
                                <option value="kanban">Kanban</option>
                                <option value="calendar">Calendar</option>
                            </select>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                                Default Group By
                            </label>
                            <select
                                value={preferences.defaultGroupBy}
                                onChange={(e) => onUpdatePreferences({ defaultGroupBy: e.target.value as GroupBy })}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    border: `1px solid ${isDarkMode ? '#4b5563' : '#d1d5db'}`,
                                    backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                                    color: isDarkMode ? '#f9fafb' : '#111827',
                                }}
                            >
                                <option value="none">None</option>
                                <option value="date">Date</option>
                                <option value="week">Week</option>
                                <option value="month">Month</option>
                                <option value="provider">Provider</option>
                                <option value="workspace">Workspace</option>
                                <option value="tag">Tag</option>
                            </select>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={preferences.autoTaggingEnabled}
                                    onChange={(e) => onUpdatePreferences({ autoTaggingEnabled: e.target.checked })}
                                />
                                Enable auto-tagging
                            </label>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={preferences.tagSuggestionsEnabled}
                                    onChange={(e) => onUpdatePreferences({ tagSuggestionsEnabled: e.target.checked })}
                                />
                                Show tag suggestions
                            </label>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={preferences.showArchived}
                                    onChange={(e) => onUpdatePreferences({ showArchived: e.target.checked })}
                                />
                                Show archived sessions
                            </label>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={preferences.compactMode}
                                    onChange={(e) => onUpdatePreferences({ compactMode: e.target.checked })}
                                />
                                Compact mode
                            </label>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showTagEditor && (
                <TagEditorModal
                    tag={editingTag}
                    parentTags={tags.filter((t) => t.id !== editingTag?.id)}
                    isDarkMode={isDarkMode}
                    onSave={(tag) => {
                        if (editingTag) {
                            onUpdateTag(editingTag.id, tag);
                        } else {
                            onCreateTag(tag);
                        }
                        setShowTagEditor(false);
                        setEditingTag(undefined);
                    }}
                    onClose={() => {
                        setShowTagEditor(false);
                        setEditingTag(undefined);
                    }}
                />
            )}

            {showCollectionEditor && (
                <CollectionEditorModal
                    collection={editingCollection}
                    folders={folders}
                    isDarkMode={isDarkMode}
                    onSave={(collection) => {
                        if (editingCollection) {
                            onUpdateCollection(editingCollection.id, collection);
                        } else {
                            onCreateCollection(collection);
                        }
                        setShowCollectionEditor(false);
                        setEditingCollection(undefined);
                    }}
                    onClose={() => {
                        setShowCollectionEditor(false);
                        setEditingCollection(undefined);
                    }}
                />
            )}
        </div>
    );
};

export default TaggingPanel;


