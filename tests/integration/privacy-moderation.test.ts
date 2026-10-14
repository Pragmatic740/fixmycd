import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { analyticsShareTokens, endorsements, users } from '@/db/schema';
import { GET as listReports } from '@/app/api/reports/route';
import { GET as getReport } from '@/app/api/reports/[id]/route';
import { GET as listComments } from '@/app/api/reports/[id]/comments/route';
import { GET as listEndorsements } from '@/app/api/reports/[id]/endorsements/route';
import { GET as getPdf } from '@/app/api/reports/[id]/pdf/route';
import { GET as getUser } from '@/app/api/users/[id]/route';
import { GET as publicReport } from '@/app/api/public/reports/[id]/route';
import { GET as publicAnalytics } from '@/app/api/public/analytics/[token]/[endpoint]/route';
import { call } from '../helpers/route';
import { createComment, createReport, createUser } from '../helpers/factories';
import { signedInUser } from '../helpers/session';

/** Recursively look for anything that looks like an email or a bcrypt hash. */
function findSecrets(value: unknown, path = '$', out: string[] = []): string[] {
  if (typeof value === 'string') {
    if (/[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(value)) out.push(`${path}: email ${value}`);
    if (/^\$2[aby]\$/.test(value)) out.push(`${path}: password hash`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => findSecrets(v, `${path}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (/email|password/i.test(k) && v != null && k !== 'emailNotifications') out.push(`${path}.${k}`);
      findSecrets(v, `${path}.${k}`, out);
    }
  }
  return out;
}

async function world() {
  const author = await createUser({ displayName: 'Author Person', email: 'author@example.test' });
  const expert = await createUser({ role: 'referee', displayName: 'Expert Eve', email: 'eve@example.test' });
  const report = await createReport(author.id, { title: 'Pothole on Elm' });
  await createComment(report.id, expert.id, { body: 'Confirmed on site.' });
  await db.insert(endorsements).values({
    id: crypto.randomUUID(),
    reportId: report.id,
    expertUserId: expert.id,
    severityLevel: 4,
    note: 'Deep',
    createdAt: new Date(),
  });
  const shareToken = crypto.randomBytes(24).toString('base64url');
  const admin = await createUser({ role: 'admin', email: 'boss@example.test' });
  await db.insert(analyticsShareTokens).values({
    id: crypto.randomUUID(),
    token: shareToken,
    createdBy: admin.id,
    filtersJson: JSON.stringify({ reporterId: author.id, reporterName: 'Author' }),
    createdAt: new Date(),
  });
  return { author, expert, report, shareToken };
}

describe('public responses never expose emails or password hashes', () => {
  it('feed, report, comments, endorsements, profiles, public report and share links', async () => {
    const { author, report, shareToken } = await world();
    const p = { id: report.id };
    const responses = {
      feed: await call(listReports, { path: '/api/reports' }),
      report: await call(getReport, { params: p }),
      comments: await call(listComments, { params: p }),
      endorsements: await call(listEndorsements, { params: p }),
      profile: await call(getUser, { params: { id: author.id } }),
      publicReport: await call(publicReport, { params: p }),
      shareReports: await call(publicAnalytics, { params: { token: shareToken, endpoint: 'reports' }, path: '/x' }),
      shareMeta: await call(publicAnalytics, { params: { token: shareToken, endpoint: 'meta' }, path: '/x' }),
    };
    for (const [name, res] of Object.entries(responses)) {
      expect(res.status, name).toBe(200);
      expect(findSecrets(res.json), name).toEqual([]);
    }
    // Share links don't reveal who reported what.
    expect(JSON.stringify(responses.shareReports.json)).not.toContain(author.id);
    expect(responses.shareMeta.json.data.filters.reporterId).toBeUndefined();
    // Endorsements no longer hand out the expert's user id.
    expect(responses.endorsements.json.items[0].expertUserId).toBeUndefined();
  });

  it('share link CSV export contains no emails', async () => {
    const { shareToken } = await world();
    const res = await call(publicAnalytics, {
      params: { token: shareToken, endpoint: 'reports' },
      path: '/x',
      query: { format: 'csv' },
    });
    expect(res.status).toBe(200);
    expect(res.text).not.toMatch(/@example\.test/);
  });

  it('profiles show the email only to the owner and admins (incl. super_admin)', async () => {
    const { author } = await world();
    expect((await call(getUser, { params: { id: author.id } })).json.email).toBeUndefined();
    await signedInUser('submitter');
    expect((await call(getUser, { params: { id: author.id } })).json.email).toBeUndefined();
    await signedInUser('super_admin');
    expect((await call(getUser, { params: { id: author.id } })).json.email).toBe('author@example.test');
  });
});

describe('moderated content stays hidden', () => {
  it('a hidden report is 404 everywhere', async () => {
    const author = await createUser();
    const report = await createReport(author.id, { isHidden: true });
    const p = { params: { id: report.id } };
    for (const handler of [getReport, listComments, listEndorsements, getPdf, publicReport]) {
      expect((await call(handler, p)).status).toBe(404);
    }
    const feed = await call(listReports, { path: '/api/reports' });
    expect(feed.json).toEqual([]);
  });

  it('hidden reports are left off public profiles', async () => {
    const author = await createUser();
    await createReport(author.id, { title: 'Visible one' });
    await createReport(author.id, { title: 'Moderated one', isHidden: true });
    const res = await call(getUser, { params: { id: author.id } });
    expect(res.json.reports.map((r: { title: string }) => r.title)).toEqual(['Visible one']);
  });

  it('hidden comments and comments by disabled users are not listed, and the count matches', async () => {
    const author = await createUser();
    const banned = await createUser({ displayName: 'Banned' });
    const report = await createReport(author.id);
    await createComment(report.id, author.id, { body: 'visible' });
    await createComment(report.id, author.id, { body: 'moderated', isHidden: true });
    await createComment(report.id, banned.id, { body: 'from banned' });
    await db.update(users).set({ disabledAt: new Date() }).where(eq(users.id, banned.id));

    const list = await call(listComments, { params: { id: report.id } });
    expect(list.json.map((c: { body: string }) => c.body)).toEqual(['visible']);
    const detail = await call(getReport, { params: { id: report.id } });
    expect(detail.json.commentCount).toBe(1);
  });

  it('endorsements by disabled experts are not shown', async () => {
    const author = await createUser();
    const expert = await createUser({ role: 'referee' });
    const report = await createReport(author.id);
    await db.insert(endorsements).values({
      id: crypto.randomUUID(),
      reportId: report.id,
      expertUserId: expert.id,
      severityLevel: 5,
      createdAt: new Date(),
    });
    await db.update(users).set({ disabledAt: new Date() }).where(eq(users.id, expert.id));
    const res = await call(listEndorsements, { params: { id: report.id } });
    expect(res.json.count).toBe(0);
  });

  it('pending and disabled users have no public profile', async () => {
    const pending = await createUser({ status: 'pending' });
    const disabled = await createUser({ disabledAt: new Date() });
    expect((await call(getUser, { params: { id: pending.id } })).status).toBe(404);
    expect((await call(getUser, { params: { id: disabled.id } })).status).toBe(404);
  });
});
