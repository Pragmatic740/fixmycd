import { describe, expect, it } from 'vitest';
import * as adminUsers from '@/app/api/admin/users/route';
import * as adminAnalytics from '@/app/api/admin/analytics/[endpoint]/route';
import * as shares from '@/app/api/admin/analytics/shares/route';
import * as views from '@/app/api/admin/analytics/views/route';
import * as importCsv from '@/app/api/admin/analytics/import-csv/route';
import * as reenrich from '@/app/api/admin/reports/[id]/reenrich/route';
import * as reviewQueue from '@/app/api/review/queue/route';
import * as review from '@/app/api/review/[id]/route';
import * as endorsements from '@/app/api/reports/[id]/endorsements/route';
import * as notifications from '@/app/api/notifications/route';
import * as follows from '@/app/api/follows/route';
import * as savedSearches from '@/app/api/saved-searches/route';
import * as upload from '@/app/api/upload/route';
import * as reportsRoute from '@/app/api/reports/route';
import * as upvote from '@/app/api/reports/[id]/upvote/route';
import * as comments from '@/app/api/reports/[id]/comments/route';
import * as flag from '@/app/api/reports/[id]/flag/route';
import { call, type CallOptions } from '../helpers/route';
import { createReport, createUser, type Role } from '../helpers/factories';
import { signedInUser } from '../helpers/session';

type Who = 'guest' | Role;
const WHO: Who[] = ['guest', 'viewer', 'submitter', 'referee', 'admin', 'super_admin'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (req: Request, ctx: any) => Promise<Response>;

type Case = {
  name: string;
  handler: AnyHandler;
  opts: (reportId: string) => CallOptions;
  /** Expected status per caller; 'ok' means any 2xx. */
  expect: Record<Who, number | 'ok'>;
};

const adminOnly = { guest: 401, viewer: 403, submitter: 403, referee: 403, admin: 'ok', super_admin: 'ok' } as const;
const moderators = { guest: 401, viewer: 403, submitter: 403, referee: 'ok', admin: 'ok', super_admin: 'ok' } as const;
const anyUser = { guest: 401, viewer: 'ok', submitter: 'ok', referee: 'ok', admin: 'ok', super_admin: 'ok' } as const;

const CASES: Case[] = [
  { name: 'GET admin/users', handler: adminUsers.GET, opts: () => ({ path: '/api/admin/users' }), expect: adminOnly },
  { name: 'PATCH admin/users', handler: adminUsers.PATCH, opts: () => ({ method: 'PATCH', body: { userId: 'missing', status: 'approved' } }), expect: { ...adminOnly, admin: 404, super_admin: 404 } },
  { name: 'GET admin/analytics/summary', handler: adminAnalytics.GET, opts: () => ({ path: '/api/admin/analytics/summary', params: { endpoint: 'summary' } }), expect: adminOnly },
  { name: 'GET admin/analytics/shares', handler: shares.GET, opts: () => ({}), expect: adminOnly },
  { name: 'POST admin/analytics/shares', handler: shares.POST, opts: () => ({ method: 'POST', body: { filters: {} } }), expect: adminOnly },
  { name: 'GET admin/analytics/views', handler: views.GET, opts: () => ({}), expect: adminOnly },
  { name: 'POST admin/analytics/import-csv', handler: importCsv.POST, opts: () => ({ method: 'POST', body: { csv: 'title,latitude,longitude\nBridge,41.5,-93.6\n' } }), expect: adminOnly },
  { name: 'POST admin/reports/reenrich', handler: reenrich.POST, opts: () => ({ method: 'POST', params: { id: 'missing' } }), expect: { ...adminOnly, admin: 404, super_admin: 404 } },
  { name: 'GET review/queue', handler: reviewQueue.GET, opts: () => ({}), expect: moderators },
  { name: 'PATCH review/[id]', handler: review.PATCH, opts: (id) => ({ method: 'PATCH', params: { id }, body: { featured: true } }), expect: moderators },
  { name: 'POST endorsements', handler: endorsements.POST, opts: (id) => ({ method: 'POST', params: { id }, body: { severityLevel: 3 } }), expect: moderators },
  { name: 'GET notifications', handler: notifications.GET, opts: () => ({ path: '/api/notifications' }), expect: anyUser },
  { name: 'GET follows', handler: follows.GET, opts: () => ({}), expect: anyUser },
  { name: 'GET saved-searches', handler: savedSearches.GET, opts: () => ({}), expect: anyUser },
  { name: 'POST upload (no file)', handler: upload.POST, opts: () => ({ method: 'POST', rawBody: new FormData() }), expect: { ...anyUser, viewer: 400, submitter: 400, referee: 400, admin: 400, super_admin: 400 } },
  { name: 'POST reports', handler: reportsRoute.POST, opts: () => ({ method: 'POST', path: '/api/reports', body: { title: 'Broken light', latitude: 1, longitude: 1 } }), expect: anyUser },
  { name: 'POST upvote', handler: upvote.POST, opts: (id) => ({ method: 'POST', params: { id } }), expect: anyUser },
  { name: 'POST comment', handler: comments.POST, opts: (id) => ({ method: 'POST', params: { id }, body: { body: 'Hello' } }), expect: anyUser },
  { name: 'POST flag', handler: flag.POST, opts: (id) => ({ method: 'POST', params: { id }, body: { reason: 'dup' } }), expect: anyUser },
];

describe('authorization matrix (every protected route × every role)', () => {
  for (const c of CASES) {
    it(c.name, async () => {
      const owner = await createUser();
      const report = await createReport(owner.id);
      const results: Record<string, number> = {};
      for (const who of WHO) {
        if (who === 'guest') {
          const { cookieJar } = await import('../helpers/cookie-jar');
          cookieJar.clear();
        } else {
          await signedInUser(who);
        }
        results[who] = (await call(c.handler, c.opts(report.id))).status;
      }
      const normalized = Object.fromEntries(
        Object.entries(results).map(([who, status]) => [
          who,
          c.expect[who as Who] === 'ok' && status >= 200 && status < 300 ? 'ok' : status,
        ])
      );
      expect(normalized).toEqual(c.expect);
    });
  }
});
