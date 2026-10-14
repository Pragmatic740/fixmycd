import { describe, expect, it } from 'vitest';
import {
  parseAnalyticsFilters,
  resolveDateRange,
  haversineKm,
  normalizeStateFilter,
} from '@/lib/analytics';

describe('analytics helpers', () => {
  it('haversineKm gives ~0 for the same point and a plausible NYC–LA distance', () => {
    expect(haversineKm(38.9072, -77.0369, 38.9072, -77.0369)).toBeLessThan(0.001);
    const d = haversineKm(40.7128, -74.006, 34.0522, -118.2437);
    expect(d).toBeGreaterThan(3000);
    expect(d).toBeLessThan(5000);
  });

  it('parses filters from the query string', () => {
    const f = parseAnalyticsFilters(
      new URLSearchParams('state=NY&severityMin=3&datePreset=month&radiusLat=40.7&radiusLng=-74&radiusKm=10&groupBy=status')
    );
    expect(f).toMatchObject({ state: 'NY', severityMin: 3, datePreset: 'month', radiusKm: 10, groupBy: 'status' });
  });

  it('resolves the "week" preset to ~7 days', () => {
    const { start, end } = resolveDateRange({ datePreset: 'week' });
    const days = (end!.getTime() - start!.getTime()) / 86400000;
    expect(days).toBeGreaterThanOrEqual(6.9);
    expect(days).toBeLessThanOrEqual(7.1);
  });

  it('parses the same filters regardless of parameter order', () => {
    const a = parseAnalyticsFilters(new URLSearchParams('state=CA&severityMin=2'));
    const b = parseAnalyticsFilters(new URLSearchParams('severityMin=2&state=CA'));
    expect(a.state).toBe(b.state);
    expect(a.severityMin).toBe(b.severityMin);
  });

  it('normalizes state names and codes', () => {
    expect(normalizeStateFilter('fl')).toBe('FL');
    expect(normalizeStateFilter('Florida')).toBe('FL');
    expect(normalizeStateFilter('IA')).toBe('IA');
    expect(normalizeStateFilter('new york')).toBe('NY');
  });
});
