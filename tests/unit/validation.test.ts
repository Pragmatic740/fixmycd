import { describe, expect, it } from 'vitest';
import {
  endorsementSchema,
  normalizeEmail,
  reportCreateSchema,
  reportFeedQuery,
  signupSchema,
} from '@/lib/validation';
import { endOfRange, escapeLike, radiusBoundingBox } from '@/lib/reports';
import { haversineKm } from '@/lib/analytics';

const validReport = { title: 'Broken streetlight', latitude: 40.7, longitude: -74 };

describe('report creation schema', () => {
  it('accepts the payload the report form sends (numbers as strings, blanks as "")', () => {
    const r = reportCreateSchema.parse({
      ...validReport,
      latitude: '40.7128',
      longitude: '-74.0060',
      severity: '4',
      estimatedCostLow: '',
      peopleAffected: '12',
      observationConfidence: 3,
      evidenceType: 'photo',
      postAction: 'failure',
      countryCode: 'OTHER',
      occurredAt: '2026-10-01T10:00:00.000Z',
      imageUrl: 'https://abc.public.blob.vercel-storage.com/a.jpg',
    });
    expect(r).toMatchObject({ latitude: 40.7128, severity: 4, peopleAffected: 12, currency: 'USD', postType: 'new' });
    expect(r.estimatedCostLow).toBeUndefined();
    expect(r.countryCode).toBeUndefined();
  });

  it.each([
    [{ title: 'ab' }, 'title'],
    [{ title: 'x'.repeat(141) }, 'title'],
    [{ latitude: 'abc' }, 'latitude'],
    [{ latitude: 91 }, 'latitude'],
    [{ longitude: -181 }, 'longitude'],
    [{ severity: 6 }, 'severity'],
    [{ severity: 2.5 }, 'severity'],
    [{ imageUrl: 'http://169.254.169.254/latest/meta-data' }, 'imageUrl'],
    [{ imageUrl: 'https://evil.example/x.png' }, 'imageUrl'],
    [{ videoUrl: 'data:text/html;base64,PGgxPg==' }, 'videoUrl'],
    [{ postAction: 'delete-everything' }, 'postAction'],
    [{ failureType: 'Bogus' }, 'failureType'],
    [{ currency: 'dollars' }, 'currency'],
    [{ occurredAt: '2999-01-01T00:00:00Z' }, 'occurredAt'],
    [{ description: 'x'.repeat(5001) }, 'description'],
  ])('rejects %o', (patch, field) => {
    const result = reportCreateSchema.safeParse({ ...validReport, ...patch });
    expect(result.success).toBe(false);
    expect(result.error!.issues.map((i) => i.path[0])).toContain(field);
  });
});

describe('feed query schema', () => {
  it('applies defaults and coerces numbers', () => {
    const q = reportFeedQuery.parse({ severity: '3', limit: '20' });
    expect(q).toMatchObject({ severity: 3, limit: 20, offset: 0 });
  });

  it.each([
    [{ limit: 'abc' }],
    [{ limit: '1000' }],
    [{ offset: '-5' }],
    [{ severity: '9' }],
    [{ startDate: 'yesterday' }],
    [{ startDate: '2026-13-45' }],
    [{ radiusKm: '10' }], // no centre
    [{ radiusKm: '10000', radiusLat: '1', radiusLng: '1' }],
    [{ west: '-10', east: '10' }], // incomplete box
    [{ severityMin: '4', severityMax: '2' }],
    [{ startDate: '2026-10-10', endDate: '2026-10-01' }],
    [{ status: 'nonsense' }],
  ])('rejects %o', (q) => {
    expect(reportFeedQuery.safeParse(q).success).toBe(false);
  });
});

describe('feed filter helpers', () => {
  it('escapes LIKE wildcards', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });

  it('treats a date-only endDate as inclusive of that whole day', () => {
    const end = endOfRange('2026-10-10');
    expect(end).toEqual({ value: new Date('2026-10-11T00:00:00Z'), inclusive: false });
    expect(endOfRange('2026-10-10T12:00:00Z').inclusive).toBe(true);
  });

  it('builds a bounding box that contains the whole circle', () => {
    const box = radiusBoundingBox(40.7, -74, 10);
    for (const [lat, lng] of [
      [40.7 + 0.0898, -74],
      [40.7, -74 + 0.118],
    ]) {
      expect(haversineKm(40.7, -74, lat, lng)).toBeLessThanOrEqual(10);
      expect(lat).toBeLessThanOrEqual(box.north);
      expect(lng).toBeLessThanOrEqual(box.east);
    }
  });

  it('covers every longitude near the poles instead of dividing by ~0', () => {
    const box = radiusBoundingBox(89.999, 0, 50);
    expect(box.east - box.west).toBeGreaterThanOrEqual(360);
    expect(Number.isFinite(box.east)).toBe(true);
  });
});

describe('auth schemas', () => {
  it('normalizes emails', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
    expect(signupSchema.parse({ email: ' A@B.co ', password: 'abcdefgh', displayName: ' Ann ' })).toEqual({
      email: 'a@b.co',
      password: 'abcdefgh',
      displayName: 'Ann',
    });
  });

  it('caps passwords at 72 bytes (bcrypt would silently truncate)', () => {
    expect(signupSchema.safeParse({ email: 'a@b.co', password: 'a'.repeat(72), displayName: 'A' }).success).toBe(true);
    expect(signupSchema.safeParse({ email: 'a@b.co', password: 'a'.repeat(73), displayName: 'A' }).success).toBe(false);
  });
});

describe('endorsement schema', () => {
  it.each([[0], [6], [2.5], ['3'], [null]])('rejects severity %j', (severityLevel) => {
    expect(endorsementSchema.safeParse({ severityLevel }).success).toBe(false);
  });

  it('accepts 1-5 and normalizes an empty note to null', () => {
    expect(endorsementSchema.parse({ severityLevel: 5, note: '  ' })).toEqual({ severityLevel: 5, note: null });
  });
});
