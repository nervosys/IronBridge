/**
 * BatchOperationsToolbar Component
 *
 * Provides UI for selecting multiple sessions and performing batch operations
 * like delete, archive, export, and tagging.
 */

import React, { useState, useCallback, useReducer } from 'react';
import type {
    BatchOperationType,
    BatchOperationRequest,
    BatchOperationResult,
    BatchOperationProgress,
    SessionTag,
} from '@csm/shared';
import { selectionReducer, initialSelectionState } from '@csm/shared';

// =============================================================================
// Selection Checkbox Component
// =============================================================================

interface SelectionCheckboxProps {
    sessionId: string;
    isSelected: boolean;
    onToggle: (sessionId: string) => void;
}

export const SelectionCheckbox: React.FC<SelectionCheckboxProps> = ({
    sessionId,
    isSelected,
    onToggle,
}) => {
    return (
        <input
            type="checkbox"
            className="session-checkbox"
            checked={isSelected}
            onChange={() => onToggle(sessionId)}
            onClick={(e) => e.stopPropagation()}
        />
    );
};

// =============================================================================
// Progress Modal Component
// =============================================================================

interface ProgressModalProps {
    progress: BatchOperationProgress;
    onCancel: () => void;
}

export const ProgressModal: React.FC<ProgressModalProps> = ({
    progress,
    onCancel,
}) => {
    const percentage = progress.totalCount > 0
        ? Math.round((progress.processedCount / progress.totalCount) * 100)
        : 0;

    return (
        <div className="progress-modal-overlay">
            <div className="progress-modal">
                <h4>
                    {progress.status === 'pending' && 'Preparing...'}
                    {progress.status === 'running' && `Processing ${progress.operation}...`}
                    {progress.status === 'completed' && 'Complete!'}
                    {progress.status === 'cancelled' && 'Cancelled'}
                    {progress.status === 'failed' && 'Failed'}
                </h4>

                <div className="progress-bar-container">
                    <div
                        className="progress-bar"
                        style={{ width: `${percentage}%` }}
                    />
                </div>

                <div className="progress-stats">
                    <span>{progress.processedCount} of {progress.totalCount} processed</span>
                </div>

                {progress.currentSessionId && (
                    <div className="current-item">
                        Processing: {progress.currentSessionId.slice(0, 8)}...
                    </div>
                )}

                {progress.status === 'running' && (
                    <button className="btn-secondary" onClick={onCancel}>
                        Cancel
                    </button>
                )}

                {(progress.status === 'completed' || progress.status === 'failed' || progress.status === 'cancelled') && (
                    <button className="btn-primary" onClick={onCancel}>
                        Close
                    </button>
                )}
            </div>
        </div>
    );
};

// =============================================================================
// Batch Tag Selector Component
// =============================================================================

interface BatchTagSelectorProps {
    availableTags: SessionTag[];
    selectedTagIds: string[];
    onTagsChange: (tagIds: string[]) => void;
    onClose: () => void;
    onApply: () => void;
}

export const BatchTagSelector: React.FC<BatchTagSelectorProps> = ({
    availableTags,
    selectedTagIds,
    onTagsChange,
    onClose,
    onApply,
}) => {
    const toggleTag = useCallback((tagId: string) => {
        if (selectedTagIds.includes(tagId)) {
            onTagsChange(selectedTagIds.filter((id) => id !== tagId));
        } else {
            onTagsChange([...selectedTagIds, tagId]);
        }
    }, [selectedTagIds, onTagsChange]);

    return (
        <div className="batch-tag-selector">
            <div className="tag-selector-header">
                <h4>Apply Tags</h4>
                <button className="btn-icon" onClick={onClose}>×</button>
            </div>

            <div className="tag-list">
                {availableTags.map((tag) => (
                    <label key={tag.id} className="tag-checkbox-label">
                        <input
                            type="checkbox"
                            checked={selectedTagIds.includes(tag.id)}
                            onChange={() => toggleTag(tag.id)}
                        />
                        <span
                            className="tag-chip"
                            style={{
                                backgroundColor: tag.color,
                                color: '#fff',
                            }}
                        >
                            {tag.name}
                        </span>
                    </label>
                ))}
            </div>

            <div className="tag-selector-actions">
                <button className="btn-secondary" onClick={onClose}>
                    Cancel
                </button>
                <button
                    className="btn-primary"
                    onClick={onApply}
                    disabled={selectedTagIds.length === 0}
                >
                    Apply Tags
                </button>
            </div>
        </div>
    );
};

// =============================================================================
// Export Options Component
// =============================================================================

type ExportFormat = 'json' | 'markdown' | 'html' | 'pdf';

interface ExportOptionsProps {
    selectedCount: number;
    onExport: (format: ExportFormat, options: ExportOptions) => void;
    onClose: () => void;
}

interface ExportOptions {
    format: ExportFormat;
    includeMetadata: boolean;
    includeTimestamps: boolean;
    bundleAsZip: boolean;
}

export const ExportOptionsPanel: React.FC<ExportOptionsProps> = ({
    selectedCount,
    onExport,
    onClose,
}) => {
    const [format, setFormat] = useState<ExportFormat>('json');
    const [includeMetadata, setIncludeMetadata] = useState(true);
    const [includeTimestamps, setIncludeTimestamps] = useState(true);
    const [bundleAsZip, setBundleAsZip] = useState(false);

    const handleExport = useCallback(() => {
        onExport(format, {
            format,
            includeMetadata,
            includeTimestamps,
            bundleAsZip,
        });
    }, [format, includeMetadata, includeTimestamps, bundleAsZip, onExport]);

    return (
        <div className="export-options-panel">
            <div className="export-options-header">
                <h4>Export {selectedCount} Session{selectedCount !== 1 ? 's' : ''}</h4>
                <button className="btn-icon" onClick={onClose}>×</button>
            </div>

            <div className="export-options-form">
                <div className="form-group">
                    <label>Format</label>
                    <div className="format-options">
                        {(['json', 'markdown', 'html', 'pdf'] as ExportFormat[]).map((f) => (
                            <label key={f} className="radio-label">
                                <input
                                    type="radio"
                                    name="format"
                                    value={f}
                                    checked={format === f}
                                    onChange={() => setFormat(f)}
                                />
                                {f.toUpperCase()}
                            </label>
                        ))}
                    </div>
                </div>

                <div className="form-group">
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={includeMetadata}
                            onChange={(e) => setIncludeMetadata(e.target.checked)}
                        />
                        Include metadata
                    </label>
                </div>

                <div className="form-group">
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={includeTimestamps}
                            onChange={(e) => setIncludeTimestamps(e.target.checked)}
                        />
                        Include timestamps
                    </label>
                </div>

                {selectedCount > 1 && (
                    <div className="form-group">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={bundleAsZip}
                                onChange={(e) => setBundleAsZip(e.target.checked)}
                            />
                            Bundle as ZIP
                        </label>
                    </div>
                )}
            </div>

            <div className="export-options-actions">
                <button className="btn-secondary" onClick={onClose}>
                    Cancel
                </button>
                <button className="btn-primary" onClick={handleExport}>
                    Export
                </button>
            </div>
        </div>
    );
};

// =============================================================================
// Confirmation Dialog Component
// =============================================================================

interface ConfirmationDialogProps {
    title: string;
    message: string;
    confirmLabel: string;
    confirmVariant?: 'primary' | 'danger';
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
    title,
    message,
    confirmLabel,
    confirmVariant = 'primary',
    onConfirm,
    onCancel,
}) => {
    return (
        <div className="confirmation-dialog-overlay">
            <div className="confirmation-dialog">
                <h4>{title}</h4>
                <p>{message}</p>
                <div className="dialog-actions">
                    <button className="btn-secondary" onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        className={`btn-${confirmVariant}`}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

// =============================================================================
// Main Batch Operations Toolbar Component
// =============================================================================

interface BatchOperationsToolbarProps {
    allSessionIds: string[];
    availableTags: SessionTag[];
    onBatchOperation: (request: BatchOperationRequest) => Promise<BatchOperationResult>;
    selectionMode?: boolean;
    onSelectionModeChange?: (enabled: boolean) => void;
}

export const BatchOperationsToolbar: React.FC<BatchOperationsToolbarProps> = ({
    allSessionIds,
    availableTags,
    onBatchOperation,
    selectionMode = false,
    onSelectionModeChange,
}) => {
    const [state, dispatch] = useReducer(selectionReducer, initialSelectionState);

    const [progress, setProgress] = useState<BatchOperationProgress | null>(null);
    const [showTagSelector, setShowTagSelector] = useState(false);
    const [showExportOptions, setShowExportOptions] = useState(false);
    const [confirmation, setConfirmation] = useState<{
        type: BatchOperationType;
        title: string;
        message: string;
    } | null>(null);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    const selectedCount = state.selectedIds.size;
    const hasSelection = selectedCount > 0;

    // Selection handlers
    const handleSelectAll = useCallback(() => {
        dispatch({ type: 'selectAll', ids: allSessionIds });
    }, [allSessionIds]);

    const handleClearSelection = useCallback(() => {
        dispatch({ type: 'deselectAll' });
    }, []);

    // Batch operation handlers
    const executeBatchOperation = useCallback(async (
        type: BatchOperationType,
        options?: BatchOperationRequest['options']
    ) => {
        const request: BatchOperationRequest = {
            operation: type,
            sessionIds: Array.from(state.selectedIds),
            options,
        };

        setProgress({
            operation: type,
            totalCount: state.selectedIds.size,
            processedCount: 0,
            status: 'running',
            startedAt: Date.now(),
        });

        try {
            const result = await onBatchOperation(request);

            setProgress({
                operation: type,
                totalCount: result.totalCount,
                processedCount: result.successCount,
                status: result.failedCount === 0 ? 'completed' : 'failed',
                startedAt: Date.now(),
            });

            if (result.failedCount === 0) {
                dispatch({ type: 'deselectAll' });
            }
        } catch (error) {
            setProgress((prev) => prev ? { ...prev, status: 'failed' } : null);
        }
    }, [state.selectedIds, onBatchOperation]);

    const handleDelete = useCallback(() => {
        setConfirmation({
            type: 'delete',
            title: 'Delete Sessions',
            message: `Are you sure you want to delete ${selectedCount} session${selectedCount !== 1 ? 's' : ''}? This action cannot be undone.`,
        });
    }, [selectedCount]);

    const handleArchive = useCallback(() => {
        setConfirmation({
            type: 'archive',
            title: 'Archive Sessions',
            message: `Archive ${selectedCount} session${selectedCount !== 1 ? 's' : ''}?`,
        });
    }, [selectedCount]);

    const handleConfirm = useCallback(() => {
        if (confirmation) {
            executeBatchOperation(confirmation.type);
            setConfirmation(null);
        }
    }, [confirmation, executeBatchOperation]);

    const handleApplyTags = useCallback(() => {
        executeBatchOperation('tag', { tagIds: selectedTags });
        setShowTagSelector(false);
        setSelectedTags([]);
    }, [executeBatchOperation, selectedTags]);

    const handleExport = useCallback((format: ExportFormat, options: ExportOptions) => {
        executeBatchOperation('export', { 
            exportFormat: format, 
            exportOptions: {
                includeMetadata: options.includeMetadata,
                includeTimestamps: options.includeTimestamps,
                bundleAsZip: options.bundleAsZip,
            }
        });
        setShowExportOptions(false);
    }, [executeBatchOperation]);

    const handleCancelProgress = useCallback(() => {
        setProgress(null);
    }, []);

    // Toggle selection mode
    const toggleSelectionMode = useCallback(() => {
        if (selectionMode) {
            dispatch({ type: 'deselectAll' });
        }
        onSelectionModeChange?.(!selectionMode);
    }, [selectionMode, onSelectionModeChange]);

    return (
        <div className="batch-operations-toolbar">
            <div className="toolbar-left">
                <button
                    className={`btn-icon selection-toggle ${selectionMode ? 'active' : ''}`}
                    onClick={toggleSelectionMode}
                    title={selectionMode ? 'Exit selection mode' : 'Enter selection mode'}
                >
                    ☑️
                </button>

                {selectionMode && (
                    <>
                        <div className="selection-info">
                            <span className="selected-count">
                                {selectedCount} selected
                            </span>
                            <button
                                className="btn-link"
                                onClick={handleSelectAll}
                                disabled={state.isAllSelected}
                            >
                                Select all
                            </button>
                            {hasSelection && (
                                <button
                                    className="btn-link"
                                    onClick={handleClearSelection}
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        <div className="batch-actions">
                            <button
                                className="btn-secondary btn-sm"
                                onClick={() => setShowTagSelector(true)}
                                disabled={!hasSelection}
                                title="Apply tags"
                            >
                                🏷️ Tag
                            </button>
                            <button
                                className="btn-secondary btn-sm"
                                onClick={handleArchive}
                                disabled={!hasSelection}
                                title="Archive selected"
                            >
                                📦 Archive
                            </button>
                            <button
                                className="btn-secondary btn-sm"
                                onClick={() => setShowExportOptions(true)}
                                disabled={!hasSelection}
                                title="Export selected"
                            >
                                📤 Export
                            </button>
                            <button
                                className="btn-danger btn-sm"
                                onClick={handleDelete}
                                disabled={!hasSelection}
                                title="Delete selected"
                            >
                                🗑️ Delete
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Tag Selector Popover */}
            {showTagSelector && (
                <div className="popover-overlay">
                    <BatchTagSelector
                        availableTags={availableTags}
                        selectedTagIds={selectedTags}
                        onTagsChange={setSelectedTags}
                        onClose={() => setShowTagSelector(false)}
                        onApply={handleApplyTags}
                    />
                </div>
            )}

            {/* Export Options Popover */}
            {showExportOptions && (
                <div className="popover-overlay">
                    <ExportOptionsPanel
                        selectedCount={selectedCount}
                        onExport={handleExport}
                        onClose={() => setShowExportOptions(false)}
                    />
                </div>
            )}

            {/* Confirmation Dialog */}
            {confirmation && (
                <ConfirmationDialog
                    title={confirmation.title}
                    message={confirmation.message}
                    confirmLabel={confirmation.type === 'delete' ? 'Delete' : 'Confirm'}
                    confirmVariant={confirmation.type === 'delete' ? 'danger' : 'primary'}
                    onConfirm={handleConfirm}
                    onCancel={() => setConfirmation(null)}
                />
            )}

            {/* Progress Modal */}
            {progress && (
                <ProgressModal
                    progress={progress}
                    onCancel={handleCancelProgress}
                />
            )}
        </div>
    );
};

// =============================================================================
// Hook for Selection State
// =============================================================================

export function useBatchSelection(allSessionIds: string[]) {
    const [state, dispatch] = useReducer(selectionReducer, initialSelectionState);

    const toggle = useCallback((sessionId: string) => {
        dispatch({ type: 'toggle', id: sessionId });
    }, []);

    const selectAll = useCallback(() => {
        dispatch({ type: 'selectAll', ids: allSessionIds });
    }, [allSessionIds]);

    const clearAll = useCallback(() => {
        dispatch({ type: 'deselectAll' });
    }, []);

    const rangeSelect = useCallback((fromId: string, toId: string) => {
        dispatch({ type: 'selectRange', fromId, toId, allIds: allSessionIds });
    }, [allSessionIds]);

    const isSelected = useCallback((sessionId: string) => {
        return state.selectedIds.has(sessionId);
    }, [state.selectedIds]);

    return {
        selectedIds: state.selectedIds,
        isAllSelected: state.isAllSelected,
        selectedCount: state.selectedIds.size,
        hasSelection: state.selectedIds.size > 0,
        toggle,
        selectAll,
        clearAll,
        rangeSelect,
        isSelected,
    };
}

export default BatchOperationsToolbar;
