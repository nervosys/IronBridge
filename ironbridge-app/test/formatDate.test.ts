// Copyright (c) 2024-2026 Nervosys LLC
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-IronBridge-Commercial

// Harvested sessions arrive with timestamps in whatever unit their provider
// used — seconds from one, milliseconds from another, ISO strings from a third.
// normalizeTimestamp guesses the unit from magnitude, and a wrong guess is off
// by a factor of a thousand: a 2026 session dated 1971.

import { describe, expect, it } from 'vitest';
import { formatDate, formatRelativeTime } from '../src/utils/formatDate';

const JAN_15_2026_MS = Date.UTC(2026, 0, 15, 12, 0, 0);
const JAN_15_2026_S = Math.floor(JAN_15_2026_MS / 1000);

describe('formatDate', () => {
  it('reads milliseconds and seconds as the same instant', () => {
    expect(formatDate(JAN_15_2026_MS)).toBe(formatDate(JAN_15_2026_S));
  });

  it('places both in 2026, not 1971', () => {
    expect(formatDate(JAN_15_2026_MS)).toContain('2026');
    expect(formatDate(JAN_15_2026_S)).toContain('2026');
  });

  it('accepts an ISO string', () => {
    expect(formatDate(new Date(JAN_15_2026_MS).toISOString())).toContain('2026');
  });

  it('accepts a numeric string in either unit', () => {
    expect(formatDate(String(JAN_15_2026_MS))).toContain('2026');
    expect(formatDate(String(JAN_15_2026_S))).toContain('2026');
  });

  it('returns an empty string for missing or unusable input', () => {
    expect(formatDate(undefined)).toBe('');
    expect(formatDate(0)).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate('not a date')).toBe('');
  });

  it('handles the seconds/milliseconds boundary consistently', () => {
    // 1e12 ms is 2001; 1e12 s would be the year 33658. Values at or below the
    // threshold are read as seconds, above it as milliseconds.
    const justUnder = 1_000_000_000_000;
    const justOver = 1_000_000_000_001;

    expect(formatDate(justUnder)).toContain('33658');
    expect(formatDate(justOver)).toContain('2001');
  });
});

describe('formatRelativeTime', () => {
  it('describes a recent instant in relative terms', () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const relative = formatRelativeTime(twoHoursAgo);

    expect(relative).not.toBe('');
    expect(relative.toLowerCase()).toMatch(/ago|hour|h/);
  });

  it('agrees across units for the same instant', () => {
    const secondsAgo = Math.floor((Date.now() - 3 * 60 * 60 * 1000) / 1000);
    expect(formatRelativeTime(secondsAgo)).toBe(formatRelativeTime(secondsAgo * 1000));
  });

  it('returns an empty string for missing input', () => {
    expect(formatRelativeTime(undefined)).toBe('');
    expect(formatRelativeTime('')).toBe('');
  });
});
