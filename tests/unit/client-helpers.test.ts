import { describe, expect, it } from 'vitest';
import { loginUrlFor, safeRedirect } from '@/lib/redirect';
import { EMPTY_REPORT_FILTERS, filtersFromParams, filtersToParams } from '@/components/ReportFilters';

describe('safeRedirect (no open redirects from /login?redirect=)', () => {
  it.each([
    ['/dashboard/reports/abc', '/dashboard/reports/abc'],
    ['/dashboard?category=Road#top', '/dashboard?category=Road#top'],
  ])('keeps same-site path %s', (input, expected) => {
    expect(safeRedirect(input)).toBe(expected);
  });

  it.each([
    'https://evil.example/phish',
    '//evil.example/phish',
    '/\\evil.example',
    'javascript:alert(1)',
    'dashboard',
    '/\u0000/x',
    '',
    null,
    undefined,
    '/'.padEnd(600, 'a'),
  ])('falls back for %j', (input) => {
    expect(safeRedirect(input as string)).toBe('/dashboard');
  });

  it('builds login links that come back to the current page', () => {
    expect(loginUrlFor('/dashboard/reports/1')).toBe('/login?redirect=%2Fdashboard%2Freports%2F1');
    expect(loginUrlFor('https://evil.example')).toBe('/login?redirect=%2Fdashboard');
  });
});

describe('feed filter URL handling', () => {
  it('reads the older single ?severity= as a range', () => {
    const f = filtersFromParams(new URLSearchParams('severity=4&endorsed=true&keyword=leak'));
    expect(f).toMatchObject({ severityMin: '4', severityMax: '4', endorsed: 'true', keyword: 'leak' });
  });

  it('only sends a radius together with its centre, clamped to the API limits', () => {
    const f = { ...EMPTY_REPORT_FILTERS, radiusKm: '9999', category: 'Road' };
    expect(filtersToParams(f).has('radiusKm')).toBe(false);
    const p = filtersToParams(f, { latitude: -17.82921234, longitude: 31.0522 });
    expect(p.get('radiusKm')).toBe('500');
    expect(p.get('radiusLat')).toBe('-17.82921');
    expect(p.get('category')).toBe('Road');
  });

  it('omits empty filters', () => {
    expect(filtersToParams(EMPTY_REPORT_FILTERS).toString()).toBe('');
  });
});
