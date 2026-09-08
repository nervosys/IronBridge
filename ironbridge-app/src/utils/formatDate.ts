// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// =============================================================================
// IRONBRIDGE App - Date Formatting Utilities
// =============================================================================
// Wrapper around @ironbridge/shared utilities with Unix timestamp support

import {
    formatDate as sharedFormatDate,
    formatRelativeTime as sharedFormatRelativeTime,
} from '@ironbridge/shared';

// Re-export additional utilities from shared
export {
    formatDateISO,
    formatTime,
    isToday,
    isWithinDays,
    formatDuration,
} from '@ironbridge/shared';

/**
 * Normalize a timestamp (Unix milliseconds, seconds, or ISO string) to a Date
 */
function normalizeTimestamp(timestamp: string | number | undefined): Date | null {
    if (!timestamp) return null;

    let date: Date;

    if (typeof timestamp === 'number') {
        // Determine if timestamp is in seconds or milliseconds
        // Timestamps > 1e12 are in milliseconds (after year 2001 in ms)
        // Timestamps < 1e12 are in seconds
        if (timestamp > 1e12) {
            // Already in milliseconds
            date = new Date(timestamp);
        } else {
            // Unix timestamp in seconds - convert to milliseconds
            date = new Date(timestamp * 1000);
        }
    } else if (typeof timestamp === 'string') {
        // Try parsing as ISO string or number string
        const parsed = parseInt(timestamp, 10);
        if (!isNaN(parsed) && parsed > 1000000000) {
            // Looks like a Unix timestamp - determine if seconds or milliseconds
            if (parsed > 1e12) {
                date = new Date(parsed);
            } else {
                date = new Date(parsed * 1000);
            }
        } else {
            date = new Date(timestamp);
        }
    } else {
        return null;
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
        return null;
    }

    return date;
}

/**
 * Format a timestamp (Unix seconds or ISO string) to a localized date string
 */
export function formatDate(timestamp: string | number | undefined): string {
    const date = normalizeTimestamp(timestamp);
    if (!date) return '';
    return sharedFormatDate(date);
}

/**
 * Format a timestamp to a relative time string (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: string | number | undefined): string {
    const date = normalizeTimestamp(timestamp);
    if (!date) return '';
    return sharedFormatRelativeTime(date);
}

