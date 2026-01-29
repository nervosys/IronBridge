// =============================================================================
// Keyboard Shortcuts Types
// =============================================================================
// Types for configurable keyboard shortcuts

/**
 * A keyboard shortcut definition
 */
export interface KeyboardShortcut {
    id: string;
    action: ShortcutAction;
    keys: string[]; // e.g., ['Ctrl', 'K'] or ['Cmd', 'Shift', 'P']
    description: string;
    category: ShortcutCategory;
    isCustom?: boolean;
    isEnabled: boolean;
}

/**
 * Shortcut action identifiers
 */
export type ShortcutAction =
    // Navigation
    | 'nav.home'
    | 'nav.sessions'
    | 'nav.workspaces'
    | 'nav.agents'
    | 'nav.settings'
    | 'nav.search'
    | 'nav.back'
    | 'nav.forward'

    // Session actions
    | 'session.new'
    | 'session.close'
    | 'session.save'
    | 'session.export'
    | 'session.archive'
    | 'session.delete'
    | 'session.duplicate'
    | 'session.share'
    | 'session.nextMessage'
    | 'session.prevMessage'

    // Editor actions
    | 'editor.focus'
    | 'editor.submit'
    | 'editor.newLine'
    | 'editor.clear'
    | 'editor.undo'
    | 'editor.redo'
    | 'editor.copy'
    | 'editor.paste'

    // Selection actions
    | 'select.all'
    | 'select.none'
    | 'select.invert'

    // Batch actions
    | 'batch.delete'
    | 'batch.archive'
    | 'batch.export'
    | 'batch.tag'

    // View actions
    | 'view.toggleSidebar'
    | 'view.toggleTheme'
    | 'view.zoomIn'
    | 'view.zoomOut'
    | 'view.resetZoom'
    | 'view.fullscreen'

    // Misc actions
    | 'misc.help'
    | 'misc.shortcuts'
    | 'misc.commandPalette'
    | 'misc.quickSwitch';

/**
 * Shortcut categories for organization
 */
export type ShortcutCategory =
    | 'navigation'
    | 'session'
    | 'editor'
    | 'selection'
    | 'batch'
    | 'view'
    | 'misc';

export const SHORTCUT_CATEGORIES: { id: ShortcutCategory; name: string; description: string }[] = [
    { id: 'navigation', name: 'Navigation', description: 'Moving around the app' },
    { id: 'session', name: 'Session', description: 'Session management' },
    { id: 'editor', name: 'Editor', description: 'Text editing' },
    { id: 'selection', name: 'Selection', description: 'Selecting items' },
    { id: 'batch', name: 'Batch', description: 'Bulk operations' },
    { id: 'view', name: 'View', description: 'Display options' },
    { id: 'misc', name: 'Miscellaneous', description: 'Other actions' },
];

// =============================================================================
// Default Shortcuts
// =============================================================================

export const DEFAULT_SHORTCUTS: Omit<KeyboardShortcut, 'id'>[] = [
    // Navigation
    { action: 'nav.home', keys: ['Alt', 'H'], description: 'Go to Home', category: 'navigation', isEnabled: true },
    { action: 'nav.sessions', keys: ['Alt', 'S'], description: 'Go to Sessions', category: 'navigation', isEnabled: true },
    { action: 'nav.workspaces', keys: ['Alt', 'W'], description: 'Go to Workspaces', category: 'navigation', isEnabled: true },
    { action: 'nav.agents', keys: ['Alt', 'A'], description: 'Go to Agents', category: 'navigation', isEnabled: true },
    { action: 'nav.settings', keys: ['Alt', ','], description: 'Open Settings', category: 'navigation', isEnabled: true },
    { action: 'nav.search', keys: ['Ctrl', 'K'], description: 'Focus Search', category: 'navigation', isEnabled: true },
    { action: 'nav.back', keys: ['Alt', 'ArrowLeft'], description: 'Go Back', category: 'navigation', isEnabled: true },
    { action: 'nav.forward', keys: ['Alt', 'ArrowRight'], description: 'Go Forward', category: 'navigation', isEnabled: true },

    // Session
    { action: 'session.new', keys: ['Ctrl', 'N'], description: 'New Session', category: 'session', isEnabled: true },
    { action: 'session.close', keys: ['Ctrl', 'W'], description: 'Close Session', category: 'session', isEnabled: true },
    { action: 'session.save', keys: ['Ctrl', 'S'], description: 'Save Session', category: 'session', isEnabled: true },
    { action: 'session.export', keys: ['Ctrl', 'E'], description: 'Export Session', category: 'session', isEnabled: true },
    { action: 'session.archive', keys: ['Ctrl', 'Shift', 'A'], description: 'Archive Session', category: 'session', isEnabled: true },
    { action: 'session.delete', keys: ['Ctrl', 'Backspace'], description: 'Delete Session', category: 'session', isEnabled: true },
    { action: 'session.duplicate', keys: ['Ctrl', 'D'], description: 'Duplicate Session', category: 'session', isEnabled: true },
    { action: 'session.share', keys: ['Ctrl', 'Shift', 'S'], description: 'Share Session', category: 'session', isEnabled: true },
    { action: 'session.nextMessage', keys: ['Ctrl', 'ArrowDown'], description: 'Next Message', category: 'session', isEnabled: true },
    { action: 'session.prevMessage', keys: ['Ctrl', 'ArrowUp'], description: 'Previous Message', category: 'session', isEnabled: true },

    // Editor
    { action: 'editor.focus', keys: ['Ctrl', 'L'], description: 'Focus Editor', category: 'editor', isEnabled: true },
    { action: 'editor.submit', keys: ['Ctrl', 'Enter'], description: 'Submit Message', category: 'editor', isEnabled: true },
    { action: 'editor.newLine', keys: ['Shift', 'Enter'], description: 'New Line', category: 'editor', isEnabled: true },
    { action: 'editor.clear', keys: ['Escape'], description: 'Clear Editor', category: 'editor', isEnabled: true },
    { action: 'editor.undo', keys: ['Ctrl', 'Z'], description: 'Undo', category: 'editor', isEnabled: true },
    { action: 'editor.redo', keys: ['Ctrl', 'Y'], description: 'Redo', category: 'editor', isEnabled: true },

    // Selection
    { action: 'select.all', keys: ['Ctrl', 'A'], description: 'Select All', category: 'selection', isEnabled: true },
    { action: 'select.none', keys: ['Escape'], description: 'Deselect All', category: 'selection', isEnabled: true },
    { action: 'select.invert', keys: ['Ctrl', 'I'], description: 'Invert Selection', category: 'selection', isEnabled: true },

    // Batch
    { action: 'batch.delete', keys: ['Ctrl', 'Shift', 'Backspace'], description: 'Delete Selected', category: 'batch', isEnabled: true },
    { action: 'batch.archive', keys: ['Ctrl', 'Shift', 'A'], description: 'Archive Selected', category: 'batch', isEnabled: true },
    { action: 'batch.export', keys: ['Ctrl', 'Shift', 'E'], description: 'Export Selected', category: 'batch', isEnabled: true },
    { action: 'batch.tag', keys: ['Ctrl', 'T'], description: 'Tag Selected', category: 'batch', isEnabled: true },

    // View
    { action: 'view.toggleSidebar', keys: ['Ctrl', 'B'], description: 'Toggle Sidebar', category: 'view', isEnabled: true },
    { action: 'view.toggleTheme', keys: ['Ctrl', 'Shift', 'T'], description: 'Toggle Theme', category: 'view', isEnabled: true },
    { action: 'view.zoomIn', keys: ['Ctrl', '='], description: 'Zoom In', category: 'view', isEnabled: true },
    { action: 'view.zoomOut', keys: ['Ctrl', '-'], description: 'Zoom Out', category: 'view', isEnabled: true },
    { action: 'view.resetZoom', keys: ['Ctrl', '0'], description: 'Reset Zoom', category: 'view', isEnabled: true },
    { action: 'view.fullscreen', keys: ['F11'], description: 'Fullscreen', category: 'view', isEnabled: true },

    // Misc
    { action: 'misc.help', keys: ['F1'], description: 'Help', category: 'misc', isEnabled: true },
    { action: 'misc.shortcuts', keys: ['Ctrl', '/'], description: 'Show Shortcuts', category: 'misc', isEnabled: true },
    { action: 'misc.commandPalette', keys: ['Ctrl', 'Shift', 'P'], description: 'Command Palette', category: 'misc', isEnabled: true },
    { action: 'misc.quickSwitch', keys: ['Ctrl', 'P'], description: 'Quick Switch', category: 'misc', isEnabled: true },
];

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format keys for display
 */
export function formatShortcut(keys: string[]): string {
    return keys.map(key => {
        switch (key) {
            case 'Ctrl': return '⌃';
            case 'Alt': return '⌥';
            case 'Shift': return '⇧';
            case 'Cmd': return '⌘';
            case 'Enter': return '↵';
            case 'Backspace': return '⌫';
            case 'Escape': return 'Esc';
            case 'ArrowUp': return '↑';
            case 'ArrowDown': return '↓';
            case 'ArrowLeft': return '←';
            case 'ArrowRight': return '→';
            default: return key;
        }
    }).join('');
}

/**
 * Parse keyboard event to keys array
 */
export function parseKeyboardEvent(event: KeyboardEvent): string[] {
    const keys: string[] = [];
    if (event.ctrlKey || event.metaKey) keys.push('Ctrl');
    if (event.altKey) keys.push('Alt');
    if (event.shiftKey) keys.push('Shift');
    if (event.key && !['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
        keys.push(event.key.length === 1 ? event.key.toUpperCase() : event.key);
    }
    return keys;
}

/**
 * Check if keyboard event matches shortcut
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
    const eventKeys = parseKeyboardEvent(event);
    if (eventKeys.length !== shortcut.keys.length) return false;
    return shortcut.keys.every(key => eventKeys.includes(key));
}
