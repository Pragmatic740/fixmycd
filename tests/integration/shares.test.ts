import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { analyticsShareTokens, shareViewEvents } from '@/db/schema';
import { GET as listShares, POST as createShare, DELETE as revokeShare } from '@/app/api/admin/analytics/shares/route';
import { GET as publicAnalytics } from '@/app/api/public/analytics/[token]/[endpoint]/route';
import { call } from '../helpers/route';
import { cookieJar } from '../helpers/cookie-jar';
import { createReport, createUser } from '../helpers/factories';
import { signedInUser } from '../helpers/session';

const view = (token: string, endpoint = 'summary', headers: Record<string, string> = {}) =>
  call(publicAnalytics, { path: '/x', params: { token, endpoint }, headers });

describe('analytics share links', () => {
  it('any admin can see and revoke a link another admin created', async () => {
    await signedInUser('admin');
    const created = await call(createShare, { method: 'POST', body: { filters: { state: 'NY' }, label: 'NY board' } });
    expect(created.status).toBe(201);

    await signedInUser('admin');
    const list = await call(listShares);
    expect(list.json).toHaveLength(1);
    expect(list.json[0]).toMatchObject({ label: 'NY board', mine: false, expired: false });

    expect((await call(revokeShare, { method: 'DELETE', path: '/x', query: { id: created.json.id } })).status).toBe(200);
    cookieJar.clear();
    expect((await view(created.json.token)).status).toBe(404);
  });

  it('validates expiry and rejects past dates', async () => {
    await signedInUser('admin');
    expect((await call(createShare, { method: 'POST', body: { filters: {}, expiresAt: 'tomorrow' } })).status).toBe(400);
    expect((await call(createShare, { method: 'POST', body: { filters: {}, expiresAt: '2001-01-01' } })).status).toBe(400);
    const future = new Date(Date.now() + 86400000).toISOString();
    const ok = await call(createShare, { method: 'POST', body: { filters: {}, expiresAt: future } });
    expect(ok.status).toBe(201);
    expect(ok.json.expiresAt).toBe(future);
  });

  it('expired links stop working and are flagged in the list', async () => {
    await signedInUser('admin');
    const created = await call(createShare, { method: 'POST', body: { filters: {} } });
    await db
      .update(analyticsShareTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(analyticsShareTokens.id, created.json.id));
    expect((await call(listShares)).json[0].expired).toBe(true);
    expect((await view(created.json.token)).status).toBe(404);
  });

  it('serves read-only data to anonymous viewers and 404s unknown tokens/endpoints', async () => {
    const author = await createUser();
    await createReport(author.id);
    await signedInUser('admin');
    const { json: share } = await call(createShare, { method: 'POST', body: { filters: {} } });
    cookieJar.clear();

    for (const endpoint of ['summary', 'timeseries', 'breakdowns', 'map', 'reports', 'meta']) {
      expect((await view(share.token, endpoint)).status, endpoint).toBe(200);
    }
    expect((await view(share.token, 'reporters')).status).toBe(404); // admin-only analytics
    expect((await view('not-a-token')).status).toBe(404);
  });

  it('counts a viewer once per hour, including clients without a User-Agent', async () => {
    await signedInUser('admin');
    const { json: share } = await call(createShare, { method: 'POST', body: { filters: {} } });
    cookieJar.clear();

    await view(share.token, 'summary', { 'user-agent': 'Mozilla/5.0 A' });
    await view(share.token, 'summary', { 'user-agent': 'Mozilla/5.0 A' });
    await view(share.token, 'summary', { 'user-agent': 'Mozilla/5.0 B' });
    await view(share.token, 'summary');
    await view(share.token, 'summary');

    const events = await db.select().from(shareViewEvents).where(eq(shareViewEvents.tokenId, share.id));
    expect(events).toHaveLength(3);
  });

  it('ignores bots and the admin who created the link, and records only external referrers', async () => {
    const creator = await signedInUser('admin');
    const { json: share } = await call(createShare, { method: 'POST', body: { filters: {} } });
    expect(creator.id).toBeDefined();

    await view(share.token, 'summary', { 'user-agent': 'Mozilla/5.0 Chrome' }); // creator: not counted
    cookieJar.clear();
    await view(share.token, 'summary', { 'user-agent': 'Slackbot-LinkExpanding 1.0' }); // bot: not counted
    await call(publicAnalytics, {
      path: '/x',
      params: { token: share.token, endpoint: 'summary' },
      query: { ref: 'news.example.org' },
      headers: { 'user-agent': 'Mozilla/5.0 Firefox' },
    });
    await call(publicAnalytics, {
      path: '/x',
      params: { token: share.token, endpoint: 'summary' },
      query: { ref: '<script>' },
      headers: { 'user-agent': 'Mozilla/5.0 Safari' },
    });

    const events = await db.select().from(shareViewEvents).where(eq(shareViewEvents.tokenId, share.id));
    expect(events.map((e) => e.referrer).sort()).toEqual(['news.example.org', null]);
  });
});
