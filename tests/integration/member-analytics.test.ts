import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { analyticsShareTokens } from '@/db/schema';
import { GET as memberAnalytics } from '@/app/api/analytics/[endpoint]/route';
import { GET as listShares, POST as createShare, DELETE as revokeShare } from '@/app/api/analytics/shares/route';
import { GET as adminListShares } from '@/app/api/admin/analytics/shares/route';
import { call } from '../helpers/route';
import { cookieJar } from '../helpers/cookie-jar';
import { createReport, createUser } from '../helpers/factories';
import { signedInUser } from '../helpers/session';

const analytics = (endpoint: string, query: Record<string, string> = {}) =>
  call(memberAnalytics, { path: '/x', params: { endpoint }, query });

describe('analytics for signed-in members', () => {
  it('requires a session', async () => {
    cookieJar.clear();
    expect((await analytics('summary')).status).toBe(401);
  });

  it('serves charts, map and posts to a citizen without emails, ids or roles', async () => {
    const author = await createUser({ email: 'private.person@example.org', displayName: 'Private Person' });
    await createReport(author.id);
    await signedInUser('submitter');

    for (const endpoint of ['summary', 'timeseries', 'breakdowns', 'scatter', 'map', 'reports']) {
      const res = await analytics(endpoint);
      expect(res.status, endpoint).toBe(200);
      const body = JSON.stringify(res.json);
      expect(body, endpoint).not.toContain('private.person@example.org');
      expect(body, endpoint).not.toContain(author.id);
    }
    const reports = await analytics('reports');
    expect(reports.json.data.rows.length).toBeGreaterThan(0);
    for (const row of reports.json.data.rows) {
      expect(row).not.toHaveProperty('userEmail');
      expect(row).not.toHaveProperty('submitterId');
      expect(row).not.toHaveProperty('userRole');
    }

    const csv = await analytics('reports', { format: 'csv' });
    expect(csv.status).toBe(200);
    expect(csv.text).not.toContain('private.person@example.org');
  });

  it('keeps per-reporter data admin-only', async () => {
    const author = await createUser({ displayName: 'Someone Specific' });
    await createReport(author.id);
    await signedInUser('submitter');

    expect((await analytics('users')).status).toBe(403);
    expect((await analytics('quality')).status).toBe(403);

    // Reporter filters and per-person grouping are ignored for members.
    const filtered = await analytics('summary', { reporterId: author.id, reporterName: 'Someone' });
    expect(filtered.json.meta.filters).not.toHaveProperty('reporterId');
    expect(filtered.json.meta.filters).not.toHaveProperty('reporterName');
    const grouped = await analytics('breakdowns', { groupBy: 'reporter' });
    expect(JSON.stringify(grouped.json.data)).not.toContain('Someone Specific');
  });

  it('gives admins the full data on the same endpoint', async () => {
    const author = await createUser({ email: 'visible.to.admin@example.org' });
    await createReport(author.id);
    await signedInUser('admin');
    expect((await analytics('users')).status).toBe(200);
    expect(JSON.stringify((await analytics('reports')).json)).toContain('visible.to.admin@example.org');
  });
});

describe('share links for members', () => {
  it('a citizen can share a dashboard; reporter filters are dropped from the link', async () => {
    const author = await createUser();
    await signedInUser('submitter');
    const created = await call(createShare, {
      method: 'POST',
      body: { filters: { state: 'NY', reporterId: author.id, reporterName: 'x' }, label: 'Water breaks' },
    });
    expect(created.status).toBe(201);
    const [row] = await db.select().from(analyticsShareTokens).where(eq(analyticsShareTokens.id, created.json.id));
    const stored = JSON.parse(row.filtersJson);
    expect(stored.state).toBe('NY');
    expect(stored).not.toHaveProperty('reporterId');
    expect(stored).not.toHaveProperty('reporterName');
  });

  it('members only see and revoke their own links; admins see all', async () => {
    await signedInUser('submitter');
    const theirs = await call(createShare, { method: 'POST', body: { filters: {}, label: 'Theirs' } });

    await signedInUser('submitter');
    const mine = await call(createShare, { method: 'POST', body: { filters: {}, label: 'Mine' } });
    const list = await call(listShares);
    expect(list.json.map((s: { label: string }) => s.label)).toEqual(['Mine']);
    expect((await call(revokeShare, { method: 'DELETE', path: '/x', query: { id: theirs.json.id } })).status).toBe(404);
    expect((await call(revokeShare, { method: 'DELETE', path: '/x', query: { id: mine.json.id } })).status).toBe(200);

    await signedInUser('admin');
    expect((await call(adminListShares)).json.map((s: { label: string }) => s.label)).toEqual(['Theirs']);
  });

  it('saved views stay an admin tool', async () => {
    await signedInUser('submitter');
    const res = await call(createShare, { method: 'POST', body: { filters: {}, savedViewId: 'anything' } });
    expect(res.status).toBe(400);
  });
});
