// =============================================================================
// Batch Operations Types
// =============================================================================
// Types for bulk operations on sessions

/**
 * Batch operation types
 */
export type BatchOperationType =
    | 'delete'
    | 'archive'
    | 'unarchive'
    | 'export'
    | 'tag'
    | 'untag'
    | 'move'
    | 'merge'
    | 'duplicate';

/**
 * Batch operation request
 */
export interface BatchOperationRequest {
    operation: BatchOperationType;
    sessionIds: string[];
    options?: BatchOperationOptions;
}

/**
 * Operation-specific options
 */
export interface BatchOperationOptions {
    // For export
    exportFormat?: 'json' | 'markdown' | 'html' | 'pdf';
    exportOptions?: {
        includeMetadata?: boolean;
        includeTimestamps?: boolean;
        bundleAsZip?: boolean;
    };

    // For tag operations
    tagIds?: string[];

    // For move operation
    targetWorkspaceId?: string;

    // For merge operation
    mergeStrategy?: 'sequential' | 'interleaved' | 'by-timestamp';

    // General options
    confirmDangerous?: boolean;
    skipConfirmation?: boolean;
}

/**
 * Batch operation result
 */
export interface BatchOperationResult {
    operation: BatchOperationType;
    success: boolean;
    totalCount: number;
    successCount: number;
    failedCount: number;
    skippedCount: number;
    errors: BatchOperationError[];
    results?: BatchItemResult[];

    // For export operations
    exportUrl?: string;
    exportBlob?: Blob;
}

/**
 * Individual item result
 */
export interface BatchItemResult {
    sessionId: string;
    success: boolean;
    error?: string;
    newId?: string; // For duplicate/merge operations
}

/**
 * Batch operation error
 */
export interface BatchOperationError {
    sessionId: string;
    code: string;
    message: string;
}

/**
 * Batch operation progress
 */
export interface BatchOperationProgress {
    operation: BatchOperationType;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    totalCount: number;
    processedCount: number;
    currentSessionId?: string;
    startedAt: number;
    estimatedCompletionAt?: number;
}

// =============================================================================
// Selection State
// =============================================================================

/**
 * Selection state for batch operations
 */
export interface SelectionState {
    selectedIds: Set<string>;
    lastSelectedId?: string;
    selectionMode: 'single' | 'multiple' | 'range';
    isAllSelected: boolean;
}

/**
 * Selection action types
 */
export type SelectionAction =
    | { type: 'select'; id: string }
    | { type: 'deselect'; id: string }
    | { type: 'toggle'; id: string }
    | { type: 'selectRange'; fromId: string; toId: string; allIds: string[] }
    | { type: 'selectAll'; ids: string[] }
    | { type: 'deselectAll' }
    | { type: 'invertSelection'; allIds: string[] };

/**
 * Selection reducer
 */
export function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
    switch (action.type) {
        case 'select':
            return {
                ...state,
                selectedIds: new Set([...state.selectedIds, action.id]),
                lastSelectedId: action.id,
                isAllSelected: false,
            };

        case 'deselect': {
            const newSelected = new Set(state.selectedIds);
            newSelected.delete(action.id);
            return {
                ...state,
                selectedIds: newSelected,
                isAllSelected: false,
            };
        }

        case 'toggle':
            if (state.selectedIds.has(action.id)) {
                return selectionReducer(state, { type: 'deselect', id: action.id });
            }
            return selectionReducer(state, { type: 'select', id: action.id });

        case 'selectRange': {
            const fromIndex = action.allIds.indexOf(action.fromId);
            const toIndex = action.allIds.indexOf(action.toId);
            if (fromIndex === -1 || toIndex === -1) return state;

            const start = Math.min(fromIndex, toIndex);
            const end = Math.max(fromIndex, toIndex);
            const rangeIds = action.allIds.slice(start, end + 1);

            return {
                ...state,
                selectedIds: new Set([...state.selectedIds, ...rangeIds]),
                lastSelectedId: action.toId,
                isAllSelected: false,
            };
        }

        case 'selectAll':
            return {
                ...state,
                selectedIds: new Set(action.ids),
                isAllSelected: true,
            };

        case 'deselectAll':
            return {
                ...state,
                selectedIds: new Set(),
                lastSelectedId: undefined,
                isAllSelected: false,
            };

        case 'invertSelection': {
            const inverted = new Set(
                action.allIds.filter(id => !state.selectedIds.has(id))
            );
            return {
                ...state,
                selectedIds: inverted,
                isAllSelected: false,
            };
        }

        default:
            return state;
    }
}

/**
 * Initial selection state
 */
export const initialSelectionState: SelectionState = {
    selectedIds: new Set(),
    selectionMode: 'multiple',
    isAllSelected: false,
};
