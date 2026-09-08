import { SessionWithMessages } from '../types/index.js';

type ExportFormat = 'json' | 'markdown' | 'pdf' | 'html';
interface SessionExportOptions {
    format: ExportFormat;
    includeMetadata?: boolean;
    includeTimestamps?: boolean;
    includeToolInvocations?: boolean;
    includeFileChanges?: boolean;
    title?: string;
    author?: string;
}
interface ExportResult {
    content: string;
    mimeType: string;
    filename: string;
    blob?: Blob;
}
declare function exportToJson(session: SessionWithMessages, options?: Partial<SessionExportOptions>): ExportResult;
declare function exportToMarkdown(session: SessionWithMessages, options?: Partial<SessionExportOptions>): ExportResult;
declare function exportToHtml(session: SessionWithMessages, options?: Partial<SessionExportOptions>): ExportResult;
declare function exportToPdf(session: SessionWithMessages, options?: Partial<SessionExportOptions>): ExportResult;
declare function exportSession(session: SessionWithMessages, options: SessionExportOptions): ExportResult;
declare function downloadExport(result: ExportResult): void;

/**
 * Format a date to a localized string
 */
declare function formatDate(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string;
/**
 * Format a date to ISO string (YYYY-MM-DD)
 */
declare function formatDateISO(date: Date | string | number | null | undefined): string;
/**
 * Format a date to time only (HH:MM)
 */
declare function formatTime(date: Date | string | number | null | undefined): string;
/**
 * Format a date to relative time (e.g., "2 hours ago", "yesterday")
 */
declare function formatRelativeTime(date: Date | string | number | null | undefined): string;
/**
 * Check if a date is today
 */
declare function isToday(date: Date | string | number): boolean;
/**
 * Check if a date is within the last N days
 */
declare function isWithinDays(date: Date | string | number, days: number): boolean;
/**
 * Generate a UUID v4
 */
declare function generateUUID(): string;
/**
 * Generate a short ID (8 characters)
 */
declare function generateShortId(): string;
/**
 * Generate a timestamp-based ID
 */
declare function generateTimestampId(prefix?: string): string;
/**
 * Truncate a string to a maximum length with ellipsis
 */
declare function truncate(str: string, maxLength: number, suffix?: string): string;
/**
 * Capitalize the first letter of a string
 */
declare function capitalize(str: string): string;
/**
 * Convert a string to title case
 */
declare function toTitleCase(str: string): string;
/**
 * Slugify a string for URLs
 */
declare function slugify(str: string): string;
/**
 * Extract the first line of text (useful for auto-generating titles)
 */
declare function extractFirstLine(text: string, maxLength?: number): string;
/**
 * Strip Markdown formatting from text
 */
declare function stripMarkdown(text: string): string;
/**
 * Format a number with thousands separators
 */
declare function formatNumber(num: number): string;
/**
 * Format bytes to human-readable size
 */
declare function formatBytes(bytes: number, decimals?: number): string;
/**
 * Format duration in milliseconds to human-readable string
 */
declare function formatDuration(ms: number): string;
/**
 * Format token count (e.g., "1.2K", "2.5M")
 */
declare function formatTokens(tokens: number): string;
/**
 * Group an array by a key function
 */
declare function groupBy<T, K extends string | number | symbol>(array: T[], keyFn: (item: T) => K): Record<K, T[]>;
/**
 * Sort an array by a key function
 */
declare function sortBy<T>(array: T[], keyFn: (item: T) => string | number | Date, order?: 'asc' | 'desc'): T[];
/**
 * Remove duplicates from an array by a key function
 */
declare function uniqueBy<T>(array: T[], keyFn: (item: T) => unknown): T[];
/**
 * Chunk an array into smaller arrays
 */
declare function chunk<T>(array: T[], size: number): T[][];
/**
 * Deep clone an object
 */
declare function deepClone<T>(obj: T): T;
/**
 * Merge objects deeply
 */
declare function deepMerge<T extends Record<string, unknown>>(target: T, ...sources: Partial<T>[]): T;
/**
 * Pick specific keys from an object
 */
declare function pick<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>;
/**
 * Omit specific keys from an object
 */
declare function omit<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K>;
/**
 * Check if a string is a valid UUID
 */
declare function isValidUUID(str: string): boolean;
/**
 * Check if a string is a valid URL
 */
declare function isValidUrl(str: string): boolean;
/**
 * Check if a string is a valid JSON
 */
declare function isValidJson(str: string): boolean;
/**
 * Safe JSON parse with fallback
 */
declare function safeJsonParse<T>(str: string, fallback: T): T;
/**
 * Delay execution for a specified time
 */
declare function delay(ms: number): Promise<void>;
/**
 * Retry an async function with exponential backoff
 */
declare function retry<T>(fn: () => Promise<T>, options?: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    onRetry?: (attempt: number, error: Error) => void;
}): Promise<T>;
/**
 * Debounce a function
 */
declare function debounce<T extends (...args: unknown[]) => unknown>(fn: T, wait: number): (...args: Parameters<T>) => void;
/**
 * Throttle a function
 */
declare function throttle<T extends (...args: unknown[]) => unknown>(fn: T, wait: number): (...args: Parameters<T>) => void;
/**
 * Extract the file name from a path
 */
declare function getFileName(path: string): string;
/**
 * Extract the directory from a path
 */
declare function getDirectory(path: string): string;
/**
 * Get the file extension from a path
 */
declare function getExtension(path: string): string;
/**
 * Normalize a path (convert backslashes to forward slashes)
 */
declare function normalizePath(path: string): string;
/**
 * Extract title from session messages
 */
declare function extractSessionTitle(messages: {
    role: string;
    content: string;
}[], maxLength?: number): string;
/**
 * Count tokens in a message (rough estimate)
 */
declare function estimateTokenCount(text: string): number;
/**
 * Count total tokens in messages
 */
declare function countTotalTokens(messages: {
    content: string;
}[]): number;
/**
 * Parse a hex color to RGB
 */
declare function hexToRgb(hex: string): {
    r: number;
    g: number;
    b: number;
} | null;
/**
 * Convert RGB to hex
 */
declare function rgbToHex(r: number, g: number, b: number): string;
/**
 * Check if a color is dark (useful for determining text color)
 */
declare function isColorDark(hex: string): boolean;

export { type ExportFormat, type ExportResult, type SessionExportOptions, capitalize, chunk, countTotalTokens, debounce, deepClone, deepMerge, delay, downloadExport, estimateTokenCount, exportSession, exportToHtml, exportToJson, exportToMarkdown, exportToPdf, extractFirstLine, extractSessionTitle, formatBytes, formatDate, formatDateISO, formatDuration, formatNumber, formatRelativeTime, formatTime, formatTokens, generateShortId, generateTimestampId, generateUUID, getDirectory, getExtension, getFileName, groupBy, hexToRgb, isColorDark, isToday, isValidJson, isValidUUID, isValidUrl, isWithinDays, normalizePath, omit, pick, retry, rgbToHex, safeJsonParse, slugify, sortBy, stripMarkdown, throttle, toTitleCase, truncate, uniqueBy };
