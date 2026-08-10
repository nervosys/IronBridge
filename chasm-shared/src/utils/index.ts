// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

// =============================================================================
// CSM Shared Utilities
// =============================================================================
// Platform-agnostic utility functions shared between csm-web and csm-app

// =============================================================================
// Date & Time Formatting
// =============================================================================

/**
 * Format a date to a localized string
 */
export function formatDate(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

    if (isNaN(d.getTime())) {
        return 'Invalid Date';
    }

    const defaultOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    };

    return d.toLocaleString(undefined, options || defaultOptions);
}

/**
 * Format a date to ISO string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date | string | number | null | undefined): string {
    if (date == null) return '';
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
}

/**
 * Format a date to time only (HH:MM)
 */
export function formatTime(date: Date | string | number | null | undefined): string {
    if (date == null) return '';
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format a date to relative time (e.g., "2 hours ago", "yesterday")
 */
export function formatRelativeTime(date: Date | string | number | null | undefined): string {
    if (date == null) return '';
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);
    const diffYear = Math.floor(diffDay / 365);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
    if (diffHour < 24) return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`;
    if (diffDay === 1) return 'yesterday';
    if (diffDay < 7) return `${diffDay} days ago`;
    if (diffWeek < 4) return `${diffWeek} ${diffWeek === 1 ? 'week' : 'weeks'} ago`;
    if (diffMonth < 12) return `${diffMonth} ${diffMonth === 1 ? 'month' : 'months'} ago`;
    return `${diffYear} ${diffYear === 1 ? 'year' : 'years'} ago`;
}

/**
 * Check if a date is today
 */
export function isToday(date: Date | string | number): boolean {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    const today = new Date();
    return d.toDateString() === today.toDateString();
}

/**
 * Check if a date is within the last N days
 */
export function isWithinDays(date: Date | string | number, days: number): boolean {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    const now = new Date();
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return d >= cutoff;
}

// =============================================================================
// ID Generation
// =============================================================================

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
    // Use crypto.randomUUID if available (modern browsers, Node.js 15+)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // Fallback implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Generate a short ID (8 characters)
 */
export function generateShortId(): string {
    return generateUUID().split('-')[0];
}

/**
 * Generate a timestamp-based ID
 */
export function generateTimestampId(prefix?: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

// =============================================================================
// String Utilities
// =============================================================================

/**
 * Truncate a string to a maximum length with ellipsis
 */
export function truncate(str: string, maxLength: number, suffix: string = '...'): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Capitalize the first letter of a string
 */
export function capitalize(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert a string to title case
 */
export function toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, (txt) =>
        txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
    );
}

/**
 * Slugify a string for URLs
 */
export function slugify(str: string): string {
    return str
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Extract the first line of text (useful for auto-generating titles)
 */
export function extractFirstLine(text: string, maxLength: number = 50): string {
    const firstLine = text.split('\n')[0].trim();
    return truncate(firstLine, maxLength);
}

/**
 * Strip Markdown formatting from text
 */
export function stripMarkdown(text: string): string {
    // Order matters here, and two pairs must not be swapped:
    //   - code blocks before inline code, or the inline rule matches the
    //     ``` fence itself and collapses it to a stray backtick;
    //   - images before links, or the link rule consumes `[alt](src)` and
    //     leaves the image's leading `!` behind as text.
    return text
        .replace(/```[\s\S]*?```/g, '') // Code blocks
        .replace(/!\[.*?\]\(.+?\)/g, '') // Images
        .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links
        .replace(/#{1,6}\s?/g, '') // Headers
        .replace(/\*\*(.+?)\*\*/g, '$1') // Bold
        .replace(/\*(.+?)\*/g, '$1') // Italic
        .replace(/`(.+?)`/g, '$1') // Inline code
        .replace(/^\s*[-*+]\s/gm, '') // Lists
        .replace(/^\s*\d+\.\s/gm, '') // Numbered lists
        .replace(/^\s*>/gm, '') // Blockquotes
        .trim();
}

// =============================================================================
// Number Formatting
// =============================================================================

/**
 * Format a number with thousands separators
 */
export function formatNumber(num: number): string {
    return num.toLocaleString();
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
}

/**
 * Format token count (e.g., "1.2K", "2.5M")
 */
export function formatTokens(tokens: number): string {
    if (tokens < 1000) return tokens.toString();
    if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`;
    return `${(tokens / 1000000).toFixed(1)}M`;
}

// =============================================================================
// Array Utilities
// =============================================================================

/**
 * Group an array by a key function
 */
export function groupBy<T, K extends string | number | symbol>(
    array: T[],
    keyFn: (item: T) => K
): Record<K, T[]> {
    return array.reduce((groups, item) => {
        const key = keyFn(item);
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(item);
        return groups;
    }, {} as Record<K, T[]>);
}

/**
 * Sort an array by a key function
 */
export function sortBy<T>(
    array: T[],
    keyFn: (item: T) => string | number | Date,
    order: 'asc' | 'desc' = 'asc'
): T[] {
    return [...array].sort((a, b) => {
        const aKey = keyFn(a);
        const bKey = keyFn(b);

        let comparison: number;
        if (aKey instanceof Date && bKey instanceof Date) {
            comparison = aKey.getTime() - bKey.getTime();
        } else if (typeof aKey === 'number' && typeof bKey === 'number') {
            comparison = aKey - bKey;
        } else {
            comparison = String(aKey).localeCompare(String(bKey));
        }

        return order === 'desc' ? -comparison : comparison;
    });
}

/**
 * Remove duplicates from an array by a key function
 */
export function uniqueBy<T>(array: T[], keyFn: (item: T) => unknown): T[] {
    const seen = new Set();
    return array.filter((item) => {
        const key = keyFn(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Chunk an array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

// =============================================================================
// Object Utilities
// =============================================================================

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(deepClone) as T;

    return Object.fromEntries(
        Object.entries(obj as Record<string, unknown>).map(([key, value]) => [key, deepClone(value)])
    ) as T;
}

/**
 * Merge objects deeply
 */
export function deepMerge<T extends Record<string, unknown>>(
    target: T,
    ...sources: Partial<T>[]
): T {
    const result = { ...target };

    for (const source of sources) {
        for (const key in source) {
            const sourceValue = source[key];
            const targetValue = result[key];

            if (
                sourceValue !== null &&
                typeof sourceValue === 'object' &&
                !Array.isArray(sourceValue) &&
                targetValue !== null &&
                typeof targetValue === 'object' &&
                !Array.isArray(targetValue)
            ) {
                result[key] = deepMerge(
                    targetValue as Record<string, unknown>,
                    sourceValue as Record<string, unknown>
                ) as T[Extract<keyof T, string>];
            } else if (sourceValue !== undefined) {
                result[key] = sourceValue as T[Extract<keyof T, string>];
            }
        }
    }

    return result;
}

/**
 * Pick specific keys from an object
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(
    obj: T,
    keys: K[]
): Pick<T, K> {
    const result = {} as Pick<T, K>;
    for (const key of keys) {
        if (key in obj) {
            result[key] = obj[key];
        }
    }
    return result;
}

/**
 * Omit specific keys from an object
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
    obj: T,
    keys: K[]
): Omit<T, K> {
    const result = { ...obj };
    for (const key of keys) {
        delete result[key];
    }
    return result as Omit<T, K>;
}

// =============================================================================
// Validation Utilities
// =============================================================================

/**
 * Check if a string is a valid UUID
 */
export function isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
}

/**
 * Check if a string is a valid URL
 */
export function isValidUrl(str: string): boolean {
    try {
        new URL(str);
        return true;
    } catch {
        return false;
    }
}

/**
 * Check if a string is a valid JSON
 */
export function isValidJson(str: string): boolean {
    try {
        JSON.parse(str);
        return true;
    } catch {
        return false;
    }
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(str: string, fallback: T): T {
    try {
        return JSON.parse(str) as T;
    } catch {
        return fallback;
    }
}

// =============================================================================
// Async Utilities
// =============================================================================

/**
 * Delay execution for a specified time
 */
export function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async function with exponential backoff
 */
export async function retry<T>(
    fn: () => Promise<T>,
    options: {
        maxAttempts?: number;
        baseDelay?: number;
        maxDelay?: number;
        onRetry?: (attempt: number, error: Error) => void;
    } = {}
): Promise<T> {
    const { maxAttempts = 3, baseDelay = 1000, maxDelay = 10000, onRetry } = options;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;

            if (attempt < maxAttempts) {
                const delayMs = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
                onRetry?.(attempt, lastError);
                await delay(delayMs);
            }
        }
    }

    throw lastError;
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
    fn: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return function debounced(...args: Parameters<T>) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            fn(...args);
            timeoutId = null;
        }, wait);
    };
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
    fn: T,
    wait: number
): (...args: Parameters<T>) => void {
    let lastCall = 0;

    return function throttled(...args: Parameters<T>) {
        const now = Date.now();
        if (now - lastCall >= wait) {
            lastCall = now;
            fn(...args);
        }
    };
}

// =============================================================================
// Path Utilities
// =============================================================================

/**
 * Extract the file name from a path
 */
export function getFileName(path: string): string {
    return path.split(/[\\/]/).pop() || '';
}

/**
 * Extract the directory from a path
 */
export function getDirectory(path: string): string {
    const parts = path.split(/[\\/]/);
    parts.pop();
    return parts.join('/');
}

/**
 * Get the file extension from a path
 */
export function getExtension(path: string): string {
    const fileName = getFileName(path);
    const dotIndex = fileName.lastIndexOf('.');
    return dotIndex > 0 ? fileName.slice(dotIndex + 1) : '';
}

/**
 * Normalize a path (convert backslashes to forward slashes)
 */
export function normalizePath(path: string): string {
    return path.replace(/\\/g, '/');
}

// =============================================================================
// Session Utilities
// =============================================================================

/**
 * Extract title from session messages
 */
export function extractSessionTitle(
    messages: { role: string; content: string }[],
    maxLength: number = 50
): string {
    // Find first user message
    const firstUserMessage = messages.find((m) => m.role === 'user');
    if (firstUserMessage) {
        return extractFirstLine(firstUserMessage.content, maxLength);
    }
    return 'Untitled Session';
}

/**
 * Count tokens in a message (rough estimate)
 */
export function estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token on average
    return Math.ceil(text.length / 4);
}

/**
 * Count total tokens in messages
 */
export function countTotalTokens(messages: { content: string }[]): number {
    return messages.reduce((total, msg) => total + estimateTokenCount(msg.content), 0);
}

// =============================================================================
// Color Utilities (for theming)
// =============================================================================

/**
 * Parse a hex color to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
        }
        : null;
}

/**
 * Convert RGB to hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if a color is dark (useful for determining text color)
 */
export function isColorDark(hex: string): boolean {
    const rgb = hexToRgb(hex);
    if (!rgb) return false;

    // Calculate luminance
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance < 0.5;
}

// =============================================================================
// Re-export Export Utilities
// =============================================================================

export * from './export';
