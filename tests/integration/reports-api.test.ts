import { describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { PDFDocument } from 'pdf-lib';
import { db } from '@/db';
import { endorsements, reports } from '@/db/schema';
import { GET as listReports, POST as createReport_ } from '@/app/api/reports/route';
import { GET as getPdf } from '@/app/api/reports/[id]/pdf/route';
import { POST as upload } from '@/app/api/upload/route';
import { call } from '../helpers/route';
import { createReport, createUser } from '../helpers/factories';
import { signedInUser } from '../helpers/session';

const create = (body: unknown) => call(createReport_, { method: 'POST', path: '/api/reports', body });
const feed = (query: Record<string, string | number | undefined>) => call(listReports, { path: '/api/reports', query });

describe('POST /api/reports', () => {
  it('requires a signed-in user', async () => {
    expect((await create({ title: 'Broken light', latitude: 1, longitude: 1 })).status).toBe(401);
  });

  it('creates a report from the form payload', async () => {
    const user = await signedInUser('submitter');
    const res = await create({
      title: '  Water main leak  ',
      description: 'Flooding the street',
      latitude: '40.71',
      longitude: '-74.00',
      severity: '4',
      category: 'Water/Wastewater',
      subcategory: 'Water Main',
      infrastructureClass: 'Water/Wastewater',
      infrastructureType: 'Water Main',
      estimatedCostLow: '',
      imageUrl: 'https://store1.public.blob.vercel-storage.com/reports/x.jpg',
      countryCode: 'US',
    });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ title: 'Water main leak', severity: 4, submitterId: user.id, status: 'submitted' });
    expect(res.json.referenceNo).toMatch(/^FMD-\d{6}-[0-9A-F]{6}$/);
  });

  it.each([
    ['metadata endpoint', 'http://169.254.169.254/latest/meta-data/'],
    ['internal host', 'https://localhost:8080/admin'],
    ['attacker host', 'https://evil.example/track.gif'],
    ['javascript url', 'javascript:alert(1)'],
    ['svg data url', 'data:image/svg+xml;base64,PHN2Zz4='],
  ])('rejects an image URL pointing at %s (SSRF / tracking)', async (_label, imageUrl) => {
    await signedInUser('submitter');
    const res = await create({ title: 'Broken light', latitude: 1, longitude: 1, imageUrl });
    expect(res.status).toBe(400);
    expect(res.json.fields.imageUrl).toBeDefined();
  });

  it('rejects out-of-range coordinates, bad enums and unknown parent reports', async () => {
    await signedInUser('submitter');
    expect((await create({ title: 'Broken light', latitude: 'abc', longitude: 1 })).status).toBe(400);
    expect((await create({ title: 'Broken light', latitude: 95, longitude: 1 })).status).toBe(400);
    expect((await create({ title: 'Broken light', latitude: 1, longitude: 1, postAction: 'drop' })).status).toBe(400);
    const orphan = await create({ title: 'Broken light', latitude: 1, longitude: 1, parentReportId: 'nope' });
    expect(orphan.status).toBe(400);
    expect(orphan.json.fields.parentReportId).toBeDefined();
  });

  it('strips control characters (a NUL byte used to crash the insert with a 500)', async () => {
    await signedInUser('submitter');
    const res = await create({ title: 'Broken\u0000 light\u0007', description: 'a\u0000b', latitude: 1, longitude: 1 });
    expect(res.status).toBe(201);
    expect(res.json.title).toBe('Broken light');
    expect(res.json.description).toBe('ab');
  });

  it('rejects blocked content', async () => {
    await signedInUser('submitter');
    const res = await create({ title: 'This is a scam', latitude: 1, longitude: 1 });
    expect(res.status).toBe(400);
  });

  it('rate limits report spam', async () => {
    await signedInUser('submitter');
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) {
      statuses.push((await create({ title: `Issue number ${i}`, latitude: 1, longitude: 1 })).status);
    }
    expect(statuses.slice(0, 20).every((s) => s === 201)).toBe(true);
    expect(statuses[20]).toBe(429);
  });
});

describe('GET /api/reports filters', () => {
  it('answers garbage parameters with 400 instead of a 500 with SQL in it', async () => {
    for (const q of [{ limit: 'abc' }, { offset: '-1' }, { severity: 'x' }, { startDate: 'soon' }, { radiusKm: '5' }]) {
      const res = await feed(q);
      expect(res.status, JSON.stringify(q)).toBe(400);
      expect(res.text).not.toMatch(/Failed query|select /i);
    }
  });

  it('radius uses real distance, not the corners of a box', async () => {
    const u = await createUser();
    await createReport(u.id, { title: 'centre', latitude: 40.7, longitude: -74 });
    // ~13 km away diagonally: inside the 10 km bounding box's corner, outside the circle.
    await createReport(u.id, { title: 'corner', latitude: 40.7 + 0.085, longitude: -74 + 0.11 });
    await createReport(u.id, { title: 'far', latitude: 41.5, longitude: -74 });
    const res = await feed({ radiusLat: 40.7, radiusLng: -74, radiusKm: 10 });
    expect(res.json.map((r: { title: string }) => r.title)).toEqual(['centre']);
  });

  it('endDate includes the whole day', async () => {
    const u = await createUser();
    await createReport(u.id, { title: 'late on the 10th', createdAt: new Date('2026-10-10T22:30:00Z') });
    await createReport(u.id, { title: 'on the 11th', createdAt: new Date('2026-10-11T08:00:00Z') });
    const res = await feed({ startDate: '2026-10-10', endDate: '2026-10-10' });
    expect(res.json.map((r: { title: string }) => r.title)).toEqual(['late on the 10th']);
  });

  it('keyword search treats % and _ literally', async () => {
    const u = await createUser();
    await createReport(u.id, { title: 'Repairs 50% done' });
    await createReport(u.id, { title: 'Repairs 500 done' });
    const res = await feed({ keyword: '50%' });
    expect(res.json.map((r: { title: string }) => r.title)).toEqual(['Repairs 50% done']);
  });

  it('filters by severity range and endorsed, and returns endorsement stats', async () => {
    const u = await createUser();
    const expert = await createUser({ role: 'referee' });
    const low = await createReport(u.id, { title: 'low', severity: 1 });
    await createReport(u.id, { title: 'high', severity: 5 });
    await db.insert(endorsements).values({ id: crypto.randomUUID(), reportId: low.id, expertUserId: expert.id, severityLevel: 3, createdAt: new Date() });

    expect((await feed({ severityMin: 4, severityMax: 5 })).json.map((r: { title: string }) => r.title)).toEqual(['high']);
    const endorsed = await feed({ endorsed: 'true' });
    expect(endorsed.json).toHaveLength(1);
    expect(endorsed.json[0]).toMatchObject({ title: 'low', endorsementCount: 1, endorsementAverage: 3 });
  });

  it('bounding boxes across the antimeridian work', async () => {
    const u = await createUser();
    await createReport(u.id, { title: 'fiji', latitude: -17.7, longitude: 178.4 });
    await createReport(u.id, { title: 'samoa', latitude: -13.8, longitude: -171.7 });
    await createReport(u.id, { title: 'london', latitude: 51.5, longitude: -0.1 });
    const res = await feed({ west: 170, east: -170, south: -30, north: 0 });
    expect(res.json.map((r: { title: string }) => r.title).sort()).toEqual(['fiji', 'samoa']);
  });
});

describe('POST /api/upload', () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
  );
  const send = (bytes: Uint8Array, name: string, type: string) => {
    const form = new FormData();
    form.append('file', new File([Buffer.from(bytes)], name, { type }));
    return call(upload, { method: 'POST', rawBody: form });
  };

  it('requires a real session', async () => {
    expect((await send(png, 'a.png', 'image/png')).status).toBe(401);
  });

  it('accepts a real image and ignores the client-supplied name/type', async () => {
    await signedInUser('submitter');
    const res = await send(png, '../../evil.html', 'text/html');
    expect(res.status).toBe(200);
    expect(res.json.url).toMatch(/^data:image\/png;base64,/);
    expect(res.json.kind).toBe('image');
  });

  it.each([
    ['SVG with script', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'image/svg+xml'],
    ['HTML page', '<!doctype html><html><script>alert(1)</script></html>', 'image/png'],
  ])('rejects %s even when it claims to be an image', async (_label, content, type) => {
    await signedInUser('submitter');
    const res = await send(new TextEncoder().encode(content), 'photo.png', type);
    expect(res.status).toBe(415);
  });
});

describe('GET /api/reports/[id]/pdf', () => {
  it('renders non-ASCII text instead of crashing or dropping it', async () => {
    const u = await createUser({ displayName: 'Zoë Ōtani' });
    const report = await createReport(u.id, {
      title: 'Café “Hélène” — ruined sidewalk 🚧',
      description: 'Line one\n\nLine two with a long url https://example.com/' + 'a'.repeat(200) + '\u0007',
    });
    const res = await call(getPdf, { params: { id: report.id } });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('cache-control')).toBe('private, max-age=300');
    const doc = await PDFDocument.load(res.bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(doc.getTitle()).toContain('Café');
  });

  it('never fetches an image URL that is not on the allowlist (stored before validation existed)', async () => {
    const u = await createUser();
    const report = await createReport(u.id);
    await db.update(reports).set({ imageUrl: 'http://169.254.169.254/latest/meta-data/' }).where(eq(reports.id, report.id));
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      const res = await call(getPdf, { params: { id: report.id } });
      expect(res.status).toBe(200);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('fetches allowlisted images without following redirects', async () => {
    const u = await createUser();
    const report = await createReport(u.id, { imageUrl: 'https://images.unsplash.com/photo-1?w=10' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not an image', { status: 200 }));
    try {
      const res = await call(getPdf, { params: { id: report.id } });
      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy.mock.calls[0][1]).toMatchObject({ redirect: 'error' });
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
