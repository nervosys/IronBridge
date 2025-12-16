/**
 * Format a timestamp (Unix seconds or ISO string) to a localized date string
 */
export function formatDate(timestamp: string | number | undefined): string {
    if (!timestamp) return '';

    let date: Date;

    if (typeof timestamp === 'number') {
        // Unix timestamp in seconds - convert to milliseconds
        date = new Date(timestamp * 1000);
    } else if (typeof timestamp === 'string') {
        // Try parsing as ISO string or number string
        const parsed = parseInt(timestamp, 10);
        if (!isNaN(parsed) && parsed > 1000000000) {
            // Looks like a Unix timestamp
            date = new Date(parsed * 1000);
        } else {
            date = new Date(timestamp);
        }
    } else {
        return '';
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleDateString();
}

/**
 * Format a timestamp to a relative time string (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: string | number | undefined): string {
    if (!timestamp) return '';

    let date: Date;

    if (typeof timestamp === 'number') {
        date = new Date(timestamp * 1000);
    } else if (typeof timestamp === 'string') {
        const parsed = parseInt(timestamp, 10);
        if (!isNaN(parsed) && parsed > 1000000000) {
            date = new Date(parsed * 1000);
        } else {
            date = new Date(timestamp);
        }
    } else {
        return '';
    }

    if (isNaN(date.getTime())) {
        return '';
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 7) {
        return date.toLocaleDateString();
    } else if (diffDays > 0) {
        return `${diffDays}d ago`;
    } else if (diffHours > 0) {
        return `${diffHours}h ago`;
    } else if (diffMins > 0) {
        return `${diffMins}m ago`;
    } else {
        return 'Just now';
    }
}
