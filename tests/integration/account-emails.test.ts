import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { adminAuditLog, betaSubscribers } from '@/db/schema';
import { PATCH as patchUser } from '@/app/api/admin/users/route';
import { GET as betaCounts, POST as sendBeta } from '@/app/api/admin/beta-subscribers/route';
import { POST as subscribe } from '@/app/api/beta-subscribe/route';
import { call } from '../helpers/route';
import { flushAfter, pendingAfter } from '../helpers/after';
import { createUser } from '../helpers/factories';
import { signedInUser } from '../helpers/session';

const sendMock = vi.hoisted(() => vi.fn(async (_msg: { to: string; subject: string; html: string }) => ({ data: { id: 'x' }, error: null })));
vi.hoisted(() => {
  process.env.RESEND_API_KEY = 're_test';
});
vi.mock('resend', () => ({ Resend: class { emails = { send: sendMock }; } }));

beforeEach(() => {
  sendMock.mockClear();
  pendingAfter.length = 0;
});

describe('account decision emails', () => {
  it('emails the person when their signup is approved or rejected (escaping their name)', async () => {
    const approvedUser = await createUser({ status: 'pending', displayName: '<b>Ann</b>', email: 'ann@example.test' });
    const rejectedUser = await createUser({ status: 'pending', email: 'rob@example.test' });
    await signedInUser('admin');

    await call(patchUser, { method: 'PATCH', body: { userId: approvedUser.id, status: 'approved' } });
    await call(patchUser, { method: 'PATCH', body: { userId: rejectedUser.id, status: 'rejected' } });
    await flushAfter();

    const mails = sendMock.mock.calls.map((c) => c[0]);
    expect(mails.map((m) => [m.to, m.subject])).toEqual([
      ['ann@example.test', 'Your FixMyDistrict account is approved'],
      ['rob@example.test', 'Your FixMyDistrict account request'],
    ]);
    expect(mails[0].html).toContain('&lt;b&gt;Ann&lt;/b&gt;');
  });

  it('does not email for role changes or when the status does not change', async () => {
    const u = await createUser({ status: 'approved' });
    await signedInUser('admin');
    await call(patchUser, { method: 'PATCH', body: { userId: u.id, role: 'referee' } });
    await call(patchUser, { method: 'PATCH', body: { userId: u.id, status: 'approved' } });
    await flushAfter();
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe('beta launch emails', () => {
  it('subscribing is idempotent and normalizes the email', async () => {
    expect((await call(subscribe, { method: 'POST', body: { email: ' Fan@Example.TEST ' } })).status).toBe(201);
    expect((await call(subscribe, { method: 'POST', body: { email: 'fan@example.test' } })).status).toBe(201);
    expect((await call(subscribe, { method: 'POST', body: { email: 'nope' } })).status).toBe(400);
    const rows = await db.select().from(betaSubscribers);
    expect(rows.map((r) => r.email)).toEqual(['fan@example.test']);
  });

  it('admins send the launch email once per subscriber and it is audited', async () => {
    await call(subscribe, { method: 'POST', body: { email: 'a@example.test' } });
    await call(subscribe, { method: 'POST', body: { email: 'b@example.test' } });
    const admin = await signedInUser('admin');

    expect((await call(betaCounts)).json).toEqual({ total: 2, waiting: 2 });
    const first = await call(sendBeta, { method: 'POST' });
    expect(first.json).toMatchObject({ sent: 2, failed: 0, waiting: 0 });
    const second = await call(sendBeta, { method: 'POST' });
    expect(second.json).toMatchObject({ sent: 0, waiting: 0 });
    expect(sendMock).toHaveBeenCalledTimes(2);

    const audit = await db.select().from(adminAuditLog).where(eq(adminAuditLog.actorId, admin.id));
    expect(audit.map((a) => a.action)).toEqual(['beta.notify', 'beta.notify']);
  });

  it('keeps subscribers waiting when sending fails', async () => {
    await call(subscribe, { method: 'POST', body: { email: 'c@example.test' } });
    await signedInUser('admin');
    sendMock.mockRejectedValueOnce(new Error('provider down'));
    const res = await call(sendBeta, { method: 'POST' });
    expect(res.json).toMatchObject({ sent: 0, failed: 1, waiting: 1 });
  });

  it('only admins can send', async () => {
    await signedInUser('referee');
    expect((await call(sendBeta, { method: 'POST' })).status).toBe(403);
  });
});
