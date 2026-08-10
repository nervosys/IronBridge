// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Chasm-Commercial

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    formatRelativeTime,
    formatDateISO,
    isToday,
    isWithinDays,
    truncate,
    capitalize,
    toTitleCase,
    slugify,
    extractFirstLine,
    stripMarkdown,
    formatBytes,
    formatDuration,
} from './index';

afterEach(() => {
    vi.useRealTimers();
});

/** Pin "now" so relative-time assertions are not clock-dependent. */
function at(iso: string) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
}

describe('formatRelativeTime', () => {
    const NOW = '2026-06-15T12:00:00Z';

    it.each([
        ['2026-06-15T11:59:30Z', 'just now'],
        ['2026-06-15T11:59:00Z', '1 minute ago'],
        ['2026-06-15T11:30:00Z', '30 minutes ago'],
        ['2026-06-15T11:00:00Z', '1 hour ago'],
        ['2026-06-14T12:00:00Z', 'yesterday'],
        ['2026-06-12T12:00:00Z', '3 days ago'],
        ['2026-06-01T12:00:00Z', '2 weeks ago'],
    ])('%s -> %s', (input, expected) => {
        at(NOW);
        expect(formatRelativeTime(input)).toBe(expected);
    });

    it('returns empty string for null and undefined rather than "Invalid Date"', () => {
        expect(formatRelativeTime(null)).toBe('');
        expect(formatRelativeTime(undefined)).toBe('');
    });

    it('returns empty string for an unparseable date', () => {
        expect(formatRelativeTime('not a date')).toBe('');
    });

    it('accepts Date objects and epoch numbers as well as strings', () => {
        at(NOW);
        const thirtyMinutesAgo = new Date('2026-06-15T11:30:00Z');
        expect(formatRelativeTime(thirtyMinutesAgo)).toBe('30 minutes ago');
        expect(formatRelativeTime(thirtyMinutesAgo.getTime())).toBe('30 minutes ago');
    });
});

describe('formatDateISO', () => {
    it('returns empty string for nullish input', () => {
        expect(formatDateISO(null)).toBe('');
        expect(formatDateISO(undefined)).toBe('');
    });
});

describe('isToday / isWithinDays', () => {
    it('distinguishes today from yesterday', () => {
        at('2026-06-15T12:00:00Z');
        expect(isToday(new Date('2026-06-15T23:00:00Z'))).toBe(true);
        expect(isToday(new Date('2026-06-14T23:00:00Z'))).toBe(false);
    });

    it('treats the window as inclusive of recent dates and exclusive of older ones', () => {
        at('2026-06-15T12:00:00Z');
        expect(isWithinDays('2026-06-13T12:00:00Z', 7)).toBe(true);
        expect(isWithinDays('2026-06-01T12:00:00Z', 7)).toBe(false);
    });
});

describe('truncate', () => {
    it('leaves short strings untouched', () => {
        expect(truncate('hello', 10)).toBe('hello');
    });

    it('keeps the result within maxLength including the suffix', () => {
        const out = truncate('abcdefghijklmnop', 10);
        expect(out).toBe('abcdefg...');
        expect(out.length).toBe(10);
    });

    it('honours a custom suffix', () => {
        expect(truncate('abcdefghij', 5, '…')).toBe('abcd…');
    });
});

describe('capitalize / toTitleCase', () => {
    it('capitalizes only the first character', () => {
        expect(capitalize('hello world')).toBe('Hello world');
    });

    it('passes through empty strings without throwing', () => {
        expect(capitalize('')).toBe('');
    });

    it('lowercases the remainder of each word in title case', () => {
        expect(toTitleCase('hELLO wORLD')).toBe('Hello World');
    });
});

describe('slugify', () => {
    it('lowercases, strips punctuation, and collapses separators', () => {
        expect(slugify('  Hello, World!  ')).toBe('hello-world');
        expect(slugify('foo___bar baz')).toBe('foo-bar-baz');
    });

    it('does not leave leading or trailing dashes', () => {
        expect(slugify('---trim me---')).toBe('trim-me');
    });
});

describe('extractFirstLine', () => {
    it('takes only the first line and truncates it', () => {
        expect(extractFirstLine('first line\nsecond line')).toBe('first line');
        expect(extractFirstLine('x'.repeat(80))).toHaveLength(50);
    });
});

describe('stripMarkdown', () => {
    it('removes common inline formatting', () => {
        expect(stripMarkdown('# Heading')).toBe('Heading');
        expect(stripMarkdown('**bold** and *italic*')).toBe('bold and italic');
        expect(stripMarkdown('`code`')).toBe('code');
        expect(stripMarkdown('[link](https://example.com)')).toBe('link');
    });

    it('drops images entirely rather than leaving a stray "!"', () => {
        // Regression: the link rule used to run first, consuming `[alt](src)`
        // and leaving `!alt` behind.
        expect(stripMarkdown('![alt](img.png)').trim()).toBe('');
        expect(stripMarkdown('see ![alt](img.png) here')).not.toContain('!');
    });

    it('removes fenced code blocks without leaving backticks', () => {
        // Regression: the inline-code rule used to run first and collapse the
        // ``` fence itself into a single backtick.
        const out = stripMarkdown('before\n```js\nconst x = 1;\n```\nafter');
        expect(out).not.toContain('`');
        expect(out).toContain('before');
        expect(out).toContain('after');
    });
});

describe('formatBytes', () => {
    it('formats zero without a fractional part', () => {
        expect(formatBytes(0)).toBe('0 B');
    });

    it('scales through the unit table', () => {
        expect(formatBytes(1024)).toBe('1 KB');
        expect(formatBytes(1536)).toBe('1.5 KB');
        expect(formatBytes(1024 * 1024)).toBe('1 MB');
    });
});

describe('formatDuration', () => {
    it('formats sub-minute durations in seconds', () => {
        expect(formatDuration(5_000)).toContain('5');
    });

    it('formats multi-minute durations without losing the minute component', () => {
        expect(formatDuration(90_000)).toMatch(/1m|1 min/);
    });
});
