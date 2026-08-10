// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

/**
 * KeyboardShortcutsPanel Component
 *
 * Provides UI for viewing and customizing keyboard shortcuts.
 */

import React, { useState, useCallback, useMemo } from 'react';
import '../styles/shortcuts.css';
import type {
    KeyboardShortcut,
    ShortcutAction,
    ShortcutCategory,
} from '@csm/shared';
import {
    SHORTCUT_CATEGORIES,
    DEFAULT_SHORTCUTS,
    formatShortcut,
    parseKeyboardEvent,
} from '@csm/shared';

// =============================================================================
// Shortcut Row Component
// =============================================================================

interface ShortcutRowProps {
    shortcut: KeyboardShortcut;
    isEditing: boolean;
    onEdit: () => void;
    onSave: (keys: string[]) => void;
    onReset: () => void;
    onCancel: () => void;
}

export const ShortcutRow: React.FC<ShortcutRowProps> = ({
    shortcut,
    isEditing,
    onEdit,
    onSave,
    onReset,
    onCancel,
}) => {
    const [recordedKeys, setRecordedKeys] = useState<string[] | null>(null);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Ignore modifier-only keypresses
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
            return;
        }

        const keys = parseKeyboardEvent(e.nativeEvent);
        setRecordedKeys(keys);
    }, []);

    const handleSave = useCallback(() => {
        if (recordedKeys) {
            onSave(recordedKeys);
            setRecordedKeys(null);
        }
    }, [recordedKeys, onSave]);

    const handleCancel = useCallback(() => {
        setRecordedKeys(null);
        onCancel();
    }, [onCancel]);

    const defaultShortcut = DEFAULT_SHORTCUTS.find((s) => s.action === shortcut.action);
    const isModified = defaultShortcut && JSON.stringify(shortcut.keys) !== JSON.stringify(defaultShortcut.keys);

    return (
        <div className={`shortcut-row ${isEditing ? 'editing' : ''} ${isModified ? 'modified' : ''}`}>
            <div className="shortcut-info">
                <span className="shortcut-label">{shortcut.description}</span>
            </div>

            <div className="shortcut-binding">
                {isEditing ? (
                    <div className="shortcut-editor">
                        <input
                            type="text"
                            className="shortcut-input"
                            value={recordedKeys ? formatShortcut(recordedKeys) : ''}
                            onKeyDown={handleKeyDown}
                            placeholder="Press keys..."
                            readOnly
                            autoFocus
                        />
                        <div className="shortcut-editor-actions">
                            <button
                                className="btn-primary btn-sm"
                                onClick={handleSave}
                                disabled={!recordedKeys}
                            >
                                Save
                            </button>
                            <button className="btn-secondary btn-sm" onClick={handleCancel}>
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <code className="shortcut-keys">{formatShortcut(shortcut.keys)}</code>
                        <div className="shortcut-actions">
                            <button
                                className="btn-icon"
                                onClick={onEdit}
                                title="Edit shortcut"
                            >
                                ✏️
                            </button>
                            {isModified && (
                                <button
                                    className="btn-icon"
                                    onClick={onReset}
                                    title="Reset to default"
                                >
                                    ↺
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// =============================================================================
// Shortcut Category Group Component
// =============================================================================

interface ShortcutCategoryGroupProps {
    category: ShortcutCategory;
    shortcuts: KeyboardShortcut[];
    editingAction: ShortcutAction | null;
    onEditStart: (action: ShortcutAction) => void;
    onEditSave: (action: ShortcutAction, keys: string[]) => void;
    onEditCancel: () => void;
    onReset: (action: ShortcutAction) => void;
    collapsed?: boolean;
    onToggleCollapse: () => void;
}

export const ShortcutCategoryGroup: React.FC<ShortcutCategoryGroupProps> = ({
    category,
    shortcuts,
    editingAction,
    onEditStart,
    onEditSave,
    onEditCancel,
    onReset,
    collapsed,
    onToggleCollapse,
}) => {
    const categoryInfo = SHORTCUT_CATEGORIES.find((c) => c.id === category);
    const categoryName = categoryInfo?.name || category;

    return (
        <div className={`shortcut-category ${collapsed ? 'collapsed' : ''}`}>
            <button className="category-header" onClick={onToggleCollapse}>
                <span className="collapse-icon">{collapsed ? '▶' : '▼'}</span>
                <span className="category-name">{categoryName}</span>
                <span className="shortcut-count">{shortcuts.length}</span>
            </button>

            {!collapsed && (
                <div className="shortcuts-list">
                    {shortcuts.map((shortcut) => (
                        <ShortcutRow
                            key={shortcut.action}
                            shortcut={shortcut}
                            isEditing={editingAction === shortcut.action}
                            onEdit={() => onEditStart(shortcut.action)}
                            onSave={(keys) => onEditSave(shortcut.action, keys)}
                            onReset={() => onReset(shortcut.action)}
                            onCancel={onEditCancel}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// =============================================================================
// Shortcut Conflict Detector
// =============================================================================

interface ConflictInfo {
    action: ShortcutAction;
    description: string;
    keys: string;
}

function detectConflicts(shortcuts: KeyboardShortcut[]): Map<string, ConflictInfo[]> {
    const keyMap = new Map<string, ConflictInfo[]>();

    shortcuts.forEach((shortcut) => {
        if (!shortcut.isEnabled) return;

        const normalizedKeys = shortcut.keys.join('+').toLowerCase();
        const existing = keyMap.get(normalizedKeys) || [];
        existing.push({
            action: shortcut.action,
            description: shortcut.description,
            keys: shortcut.keys.join('+'),
        });
        keyMap.set(normalizedKeys, existing);
    });

    // Only return keys with conflicts (more than one shortcut)
    const conflicts = new Map<string, ConflictInfo[]>();
    keyMap.forEach((infos, keys) => {
        if (infos.length > 1) {
            conflicts.set(keys, infos);
        }
    });

    return conflicts;
}

// =============================================================================
// Main Keyboard Shortcuts Panel Component
// =============================================================================

interface KeyboardShortcutsPanelProps {
    shortcuts: KeyboardShortcut[];
    onUpdateShortcut: (action: ShortcutAction, updates: Partial<KeyboardShortcut>) => void;
    onResetShortcut: (action: ShortcutAction) => void;
    onResetAllShortcuts: () => void;
    onExportShortcuts: () => void;
    onImportShortcuts: (shortcuts: KeyboardShortcut[]) => void;
}

export const KeyboardShortcutsPanel: React.FC<KeyboardShortcutsPanelProps> = ({
    shortcuts,
    onUpdateShortcut,
    onResetShortcut,
    onResetAllShortcuts,
    onExportShortcuts,
    onImportShortcuts,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [editingAction, setEditingAction] = useState<ShortcutAction | null>(null);
    const [collapsedCategories, setCollapsedCategories] = useState<Set<ShortcutCategory>>(new Set());
    const [showConflictsOnly, setShowConflictsOnly] = useState(false);

    // Detect conflicts
    const conflicts = useMemo(() => detectConflicts(shortcuts), [shortcuts]);
    const hasConflicts = conflicts.size > 0;

    // Filter and group shortcuts
    const filteredShortcuts = useMemo(() => {
        let filtered = shortcuts;

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (s) =>
                    s.description.toLowerCase().includes(query) ||
                    s.keys.join('+').toLowerCase().includes(query) ||
                    s.action.toLowerCase().includes(query)
            );
        }

        // Conflict filter
        if (showConflictsOnly) {
            const conflictingActions = new Set<ShortcutAction>();
            conflicts.forEach((infos) => {
                infos.forEach((info) => conflictingActions.add(info.action));
            });
            filtered = filtered.filter((s) => conflictingActions.has(s.action));
        }

        return filtered;
    }, [shortcuts, searchQuery, showConflictsOnly, conflicts]);

    // Group by category
    const groupedShortcuts = useMemo(() => {
        const groups: Record<ShortcutCategory, KeyboardShortcut[]> = {
            navigation: [],
            session: [],
            editor: [],
            selection: [],
            batch: [],
            view: [],
            misc: [],
        };

        filteredShortcuts.forEach((shortcut) => {
            groups[shortcut.category].push(shortcut);
        });

        return groups;
    }, [filteredShortcuts]);

    const toggleCategory = useCallback((category: ShortcutCategory) => {
        setCollapsedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(category)) {
                next.delete(category);
            } else {
                next.add(category);
            }
            return next;
        });
    }, []);

    const handleEditSave = useCallback(
        (action: ShortcutAction, keys: string[]) => {
            onUpdateShortcut(action, { keys });
            setEditingAction(null);
        },
        [onUpdateShortcut]
    );

    const handleImportClick = useCallback(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                try {
                    const text = await file.text();
                    const imported = JSON.parse(text);
                    if (Array.isArray(imported)) {
                        onImportShortcuts(imported);
                    }
                } catch (error) {
                    console.error('Failed to import shortcuts:', error);
                }
            }
        };
        input.click();
    }, [onImportShortcuts]);

    // Count modified shortcuts
    const modifiedCount = useMemo(() => {
        return shortcuts.filter((s) => {
            const defaultShortcut = DEFAULT_SHORTCUTS.find((d) => d.action === s.action);
            return defaultShortcut && JSON.stringify(s.keys) !== JSON.stringify(defaultShortcut.keys);
        }).length;
    }, [shortcuts]);

    return (
        <div className="keyboard-shortcuts-panel">
            <div className="shortcuts-panel-header">
                <h3>Keyboard Shortcuts</h3>
                <div className="shortcuts-actions">
                    <button className="btn-secondary btn-sm" onClick={onExportShortcuts}>
                        Export
                    </button>
                    <button className="btn-secondary btn-sm" onClick={handleImportClick}>
                        Import
                    </button>
                    {modifiedCount > 0 && (
                        <button className="btn-secondary btn-sm" onClick={onResetAllShortcuts}>
                            Reset All ({modifiedCount})
                        </button>
                    )}
                </div>
            </div>

            <div className="shortcuts-filters">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search shortcuts..."
                    className="search-input"
                />

                {hasConflicts && (
                    <label className="checkbox-label warning">
                        <input
                            type="checkbox"
                            checked={showConflictsOnly}
                            onChange={(e) => setShowConflictsOnly(e.target.checked)}
                        />
                        Show conflicts only ({conflicts.size})
                    </label>
                )}
            </div>

            {hasConflicts && !showConflictsOnly && (
                <div className="conflicts-warning">
                    <span className="warning-icon">⚠️</span>
                    <span>
                        {conflicts.size} shortcut conflict{conflicts.size !== 1 ? 's' : ''} detected
                    </span>
                    <button
                        className="btn-link"
                        onClick={() => setShowConflictsOnly(true)}
                    >
                        Show conflicts
                    </button>
                </div>
            )}

            <div className="shortcuts-content">
                {(Object.entries(groupedShortcuts) as [ShortcutCategory, KeyboardShortcut[]][])
                    .filter(([, shortcuts]) => shortcuts.length > 0)
                    .map(([category, categoryShortcuts]) => (
                        <ShortcutCategoryGroup
                            key={category}
                            category={category}
                            shortcuts={categoryShortcuts}
                            editingAction={editingAction}
                            onEditStart={setEditingAction}
                            onEditSave={handleEditSave}
                            onEditCancel={() => setEditingAction(null)}
                            onReset={onResetShortcut}
                            collapsed={collapsedCategories.has(category)}
                            onToggleCollapse={() => toggleCategory(category)}
                        />
                    ))}

                {filteredShortcuts.length === 0 && (
                    <div className="empty-state">
                        <p>No shortcuts found</p>
                        {searchQuery && (
                            <button
                                className="btn-secondary"
                                onClick={() => setSearchQuery('')}
                            >
                                Clear search
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="shortcuts-footer">
                <p className="shortcuts-help">
                    Click on a shortcut to edit it. Press the desired key combination, then save.
                </p>
            </div>
        </div>
    );
};

export default KeyboardShortcutsPanel;
