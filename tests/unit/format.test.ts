import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from '@/lib/utils';

const now = new Date('2026-10-11T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);

describe('formatRelativeTime', () => {
  it.each([
    [ago(10_000), 'just now', 'now'],
    [ago(5 * 60_000), '5m ago', '5m'],
    [ago(3 * 3600_000), '3h ago', '3h'],
    [ago(2 * 86400_000), '2d ago', '2d'],
  ])('%s', (date, long, compact) => {
    expect(formatRelativeTime(date, { now })).toBe(long);
    expect(formatRelativeTime(date, { now, compact: true })).toBe(compact);
  });

  it('treats small clock skew as now, but shows a date for real future timestamps', () => {
    expect(formatRelativeTime(new Date(now.getTime() + 30_000), { now })).toBe('just now');
    expect(formatRelativeTime(new Date(now.getTime() + 86400_000), { now })).toMatch(/2026/);
  });

  it('returns an empty string for invalid input instead of "Invalid Date"', () => {
    expect(formatRelativeTime('not a date', { now })).toBe('');
  });

  it('shows a date (with year only if different) after a week', () => {
    expect(formatRelativeTime(ago(30 * 86400_000), { now })).not.toMatch(/2026/);
    expect(formatRelativeTime(new Date('2024-01-05T00:00:00Z'), { now })).toMatch(/2024/);
  });
});
