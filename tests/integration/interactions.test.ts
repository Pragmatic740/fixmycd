import { beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { flags, notifications, reports, reportStatusHistory, users } from '@/db/schema';
import { POST as upvote, DELETE as unUpvote } from '@/app/api/reports/[id]/upvote/route';
import { GET as getEndorsements, POST as endorse, DELETE as unEndorse } from '@/app/api/reports/[id]/endorsements/route';
import { POST as comment } from '@/app/api/reports/[id]/comments/route';
import { PATCH as review } from '@/app/api/review/[id]/route';
import { POST as flag } from '@/app/api/reports/[id]/flag/route';
import { GET as listFollows, POST as follow } from '@/app/api/follows/route';
import { GET as listSearches, POST as saveSearch, DELETE as deleteSearch } from '@/app/api/saved-searches/route';
import { GET as listNotifications, PATCH as markNotifications } from '@/app/api/notifications/route';
import { PATCH as patchProfile } from '@/app/api/users/[id]/route';
import { call } from '../helpers/route';
import { cookieJar } from '../helpers/cookie-jar';
import { flushAfter, pendingAfter } from '../helpers/after';
import { createReport, createUser } from '../helpers/factories';
import { loginAs, signedInUser } from '../helpers/session';

const sendMock = vi.hoisted(() => vi.fn(async () => ({ data: { id: 'email_1' }, error: null })));
vi.hoisted(() => {
  process.env.RESEND_API_KEY = 're_test';
  process.env.UNSUBSCRIBE_SECRET = 'test-unsubscribe-secret';
});
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

beforeEach(() => {
  sendMock.mockClear();
  pendingAfter.length = 0;
});

async function reportBy(role: 'submitter' | 'referee' = 'submitter', overrides = {}) {
  const author = await createUser({ role, email: `author-${Math.random().toString(36).slice(2)}@example.test`, ...overrides });
  const report = await createReport(author.id, { title: 'Sinkhole <b>on</b> 5th' });
  return { author, report, p: { params: { id: report.id } } };
}

const notificationsFor = (userId: string) => db.select().from(notifications).where(eq(notifications.userId, userId));

describe('upvotes', () => {
  it('is idempotent and notifies the author once, even when toggled', async () => {
    const { author, p } = await reportBy();
    await signedInUser('submitter');

    const first = await call(upvote, { method: 'POST', ...p });
    expect(first.json).toEqual({ upvoted: true, upvoteCount: 1 });
    expect((await call(upvote, { method: 'POST', ...p })).json).toEqual({ upvoted: true, upvoteCount: 1 });
    expect((await call(unUpvote, { method: 'DELETE', ...p })).json).toEqual({ upvoted: false, upvoteCount: 0 });
    await call(upvote, { method: 'POST', ...p });

    expect(await notificationsFor(author.id)).toHaveLength(1);
    await flushAfter();
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('404s for hidden or missing reports and 401s for guests', async () => {
    const { report, p } = await reportBy();
    expect((await call(upvote, { method: 'POST', ...p })).status).toBe(401);
    await db.update(reports).set({ isHidden: true }).where(eq(reports.id, report.id));
    await signedInUser('submitter');
    expect((await call(upvote, { method: 'POST', ...p })).status).toBe(404);
    expect((await call(upvote, { method: 'POST', params: { id: 'missing' } })).status).toBe(404);
  });

  it('upvoting your own report does not notify you', async () => {
    const author = await signedInUser('submitter');
    const report = await createReport(author.id);
    await call(upvote, { method: 'POST', params: { id: report.id } });
    expect(await notificationsFor(author.id)).toHaveLength(0);
  });
});

describe('comments and emails', () => {
  it('escapes user content in notification emails and includes an unsubscribe link', async () => {
    const { author, p } = await reportBy();
    await signedInUser('submitter', { displayName: '<img src=x onerror=alert(1)>' });
    const res = await call(comment, { method: 'POST', ...p, body: { body: '<script>steal()</script>' } });
    expect(res.status).toBe(201);
    expect(res.json.userId).toBeDefined();

    // The email is sent after the response, not while the user waits.
    expect(sendMock).not.toHaveBeenCalled();
    await flushAfter();
    expect(sendMock).toHaveBeenCalledTimes(1);
    const mail = (sendMock.mock.calls[0] as unknown as [{ to: string; subject: string; html: string }])[0];
    expect(mail.to).toBe(author.email);
    expect(mail.html).not.toMatch(/<script>|<img src=x/);
    expect(mail.html).toContain('&lt;script&gt;steal()&lt;/script&gt;');
    expect(mail.html).toContain('&lt;b&gt;on&lt;/b&gt;');
    expect(mail.html).toMatch(/\/unsubscribe\?u=.+&amp;t=/);
  });

  it('does not email authors who turned email notifications off', async () => {
    const { author, p } = await reportBy();
    await loginAs(author.email, author.password);
    expect((await call(patchProfile, { method: 'PATCH', params: { id: author.id }, body: { emailNotifications: false } })).status).toBe(200);

    cookieJar.clear();
    await signedInUser('submitter');
    await call(comment, { method: 'POST', ...p, body: { body: 'Seen it too' } });
    await flushAfter();
    expect(sendMock).not.toHaveBeenCalled();
    expect(await notificationsFor(author.id)).toHaveLength(1); // in-app still works
  });

  it('validates comment length', async () => {
    const { p } = await reportBy();
    await signedInUser('submitter');
    expect((await call(comment, { method: 'POST', ...p, body: { body: '   ' } })).status).toBe(400);
    expect((await call(comment, { method: 'POST', ...p, body: { body: 'x'.repeat(1001) } })).status).toBe(400);
  });

  it('rate limits comment floods (20 per 10 minutes)', async () => {
    const { p } = await reportBy();
    await signedInUser('submitter');
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) statuses.push((await call(comment, { method: 'POST', ...p, body: { body: `c${i}` } })).status);
    expect(statuses[19]).toBe(201);
    expect(statuses[20]).toBe(429);
  });
});

describe('endorsements', () => {
  it('only experts can endorse; one per expert, editable, removable', async () => {
    const { author, p } = await reportBy();
    await signedInUser('submitter');
    expect((await call(endorse, { method: 'POST', ...p, body: { severityLevel: 3 } })).status).toBe(403);

    await signedInUser('referee', { displayName: 'Dr Expert' });
    expect((await call(endorse, { method: 'POST', ...p, body: { severityLevel: 4, note: 'Deep hole' } })).status).toBe(201);
    const updated = await call(endorse, { method: 'POST', ...p, body: { severityLevel: 5 } });
    expect(updated.json).toMatchObject({ updated: true });

    const list = await call(getEndorsements, p);
    expect(list.json).toMatchObject({ count: 1, averageSeverity: 5, myEndorsement: { severityLevel: 5, isMine: true, note: null } });
    expect(list.json.myEndorsement.updatedAt).not.toBeNull();

    // The author is notified about the first endorsement.
    const notes = await notificationsFor(author.id);
    expect(notes.map((n) => n.type)).toEqual(['endorsement']);

    expect((await call(unEndorse, { method: 'DELETE', ...p })).status).toBe(200);
    expect((await call(getEndorsements, p)).json.count).toBe(0);
  });

  it.each([[2.5], ['3'], [0], [6]])('rejects severity %j with 400 (not a database error)', async (severityLevel) => {
    const { p } = await reportBy();
    await signedInUser('referee');
    const res = await call(endorse, { method: 'POST', ...p, body: { severityLevel } });
    expect(res.status).toBe(400);
    expect(res.text).not.toMatch(/Failed query/);
  });

  it('caps and filters notes', async () => {
    const { p } = await reportBy();
    await signedInUser('referee');
    expect((await call(endorse, { method: 'POST', ...p, body: { severityLevel: 3, note: 'x'.repeat(501) } })).status).toBe(400);
    expect((await call(endorse, { method: 'POST', ...p, body: { severityLevel: 3, note: 'total scam' } })).status).toBe(400);
  });
});

describe('review', () => {
  it('records status changes, sets resolved_at and notifies the author with from/to', async () => {
    const { author, report, p } = await reportBy();
    await signedInUser('referee');
    expect((await call(review, { method: 'PATCH', ...p, body: { status: 'in_progress', reviewNote: 'Crew assigned' } })).status).toBe(200);
    expect((await call(review, { method: 'PATCH', ...p, body: { status: 'resolved' } })).status).toBe(200);

    const [row] = await db.select().from(reports).where(eq(reports.id, report.id));
    expect(row.status).toBe('resolved');
    expect(row.resolvedAt).toBeInstanceOf(Date);
    expect(row.reviewNote).toBe('Crew assigned');

    const history = await db.select().from(reportStatusHistory).where(eq(reportStatusHistory.reportId, report.id));
    expect(history.map((h) => h.toStatus).sort()).toEqual(['in_progress', 'resolved']);

    const notes = await notificationsFor(author.id);
    expect(notes.map((n) => JSON.parse(n.metadataJson!)).sort((a, b) => a.to.localeCompare(b.to))).toEqual([
      { from: 'submitted', to: 'in_progress' },
      { from: 'in_progress', to: 'resolved' },
    ]);
  });

  it('rejects unknown statuses and wrong types; non-moderators get 403', async () => {
    const { p } = await reportBy();
    await signedInUser('submitter');
    expect((await call(review, { method: 'PATCH', ...p, body: { status: 'accepted' } })).status).toBe(403);
    await signedInUser('referee');
    expect((await call(review, { method: 'PATCH', ...p, body: { status: 'deleted' } })).status).toBe(400);
    expect((await call(review, { method: 'PATCH', ...p, body: { isHidden: 'yes' } })).status).toBe(400);
    expect((await call(review, { method: 'PATCH', ...p, body: {} })).status).toBe(400);
  });

  it('moderators are not notified about their own reports', async () => {
    const mod = await signedInUser('referee');
    const report = await createReport(mod.id);
    await call(review, { method: 'PATCH', params: { id: report.id }, body: { status: 'accepted' } });
    expect(await notificationsFor(mod.id)).toHaveLength(0);
  });
});

describe('flags, follows, saved searches', () => {
  it('flags: valid target, one open flag per person, 404 for unknown targets', async () => {
    const { report, p } = await reportBy();
    const me = await signedInUser('submitter');
    expect((await call(flag, { method: 'POST', ...p, body: { reason: 'Duplicate' } })).status).toBe(201);
    expect((await call(flag, { method: 'POST', ...p, body: { reason: 'Again' } })).json).toMatchObject({ alreadyFlagged: true });
    expect((await call(flag, { method: 'POST', ...p, body: { reason: 'x', targetType: 'user' } })).status).toBe(400);
    expect((await call(flag, { method: 'POST', params: { id: 'nope' }, body: { reason: 'x' } })).status).toBe(404);
    const rows = await db.select().from(flags).where(and(eq(flags.reporterId, me.id), eq(flags.targetId, report.id)));
    expect(rows).toHaveLength(1);
  });

  it('follows: known types only, not yourself', async () => {
    const me = await signedInUser('submitter');
    const other = await createUser();
    expect((await call(follow, { method: 'POST', body: { followType: 'user', targetId: other.id } })).status).toBe(201);
    expect((await call(follow, { method: 'POST', body: { followType: 'planet', targetId: 'x' } })).status).toBe(400);
    expect((await call(follow, { method: 'POST', body: { followType: 'user', targetId: me.id } })).status).toBe(400);
    expect((await call(listFollows)).json).toHaveLength(1);
  });

  it('saved searches: validated, owned, deletable only by the owner', async () => {
    await signedInUser('submitter');
    const saved = await call(saveSearch, { method: 'POST', body: { name: 'Potholes', queryJson: { category: 'Road' } } });
    expect(saved.status).toBe(201);
    expect((await call(saveSearch, { method: 'POST', body: { name: '', queryJson: '{}' } })).status).toBe(400);

    await signedInUser('submitter');
    await call(deleteSearch, { method: 'DELETE', body: { id: saved.json.id } });
    expect((await call(listSearches)).json).toHaveLength(0);
  });
});

describe('notifications API', () => {
  it('paginates, counts unread and marks single items read', async () => {
    const me = await signedInUser('submitter');
    const actor = await createUser();
    for (let i = 0; i < 3; i++) {
      await db.insert(notifications).values({
        id: `n${i}`,
        userId: me.id,
        type: 'comment',
        actorId: actor.id,
        read: false,
        createdAt: new Date(Date.now() - i * 1000),
      });
    }
    const page1 = await call(listNotifications, { query: { limit: 2 } });
    expect(page1.json.items.map((n: { id: string }) => n.id)).toEqual(['n0', 'n1']);
    expect(page1.json.unreadCount).toBe(3);
    const page2 = await call(listNotifications, { query: { limit: 2, before: page1.json.nextBefore } });
    expect(page2.json.items.map((n: { id: string }) => n.id)).toEqual(['n2']);

    await call(markNotifications, { method: 'PATCH', body: { ids: ['n1'] } });
    expect((await call(listNotifications)).json.unreadCount).toBe(2);
    await call(markNotifications, { method: 'PATCH', body: { markAllRead: true } });
    expect((await call(listNotifications)).json.unreadCount).toBe(0);
    expect((await call(markNotifications, { method: 'PATCH', body: { markAllRead: false } })).status).toBe(400);
  });

  it('cannot mark other people’s notifications', async () => {
    const victim = await createUser();
    await db.insert(notifications).values({ id: 'theirs', userId: victim.id, type: 'comment', read: false, createdAt: new Date() });
    await signedInUser('submitter');
    await call(markNotifications, { method: 'PATCH', body: { ids: ['theirs'] } });
    const [row] = await db.select().from(notifications).where(eq(notifications.id, 'theirs'));
    expect(row.read).toBe(false);
  });
});

describe('profile updates', () => {
  it('validates fields and never returns the password hash', async () => {
    const me = await signedInUser('submitter');
    const p = { params: { id: me.id } };
    const ok = await call(patchProfile, { method: 'PATCH', ...p, body: { displayName: ' New Name ', bio: 'Hi' } });
    expect(ok.json).toMatchObject({ displayName: 'New Name', bio: 'Hi' });
    expect(ok.json.passwordHash).toBeUndefined();
    expect((await call(patchProfile, { method: 'PATCH', ...p, body: { role: 'admin' } })).status).toBe(400);
    expect((await call(patchProfile, { method: 'PATCH', ...p, body: { bio: 'x'.repeat(501) } })).status).toBe(400);
    const [row] = await db.select().from(users).where(eq(users.id, me.id));
    expect(row.role).toBe('submitter');
  });

  it('cannot edit someone else', async () => {
    const other = await createUser();
    await signedInUser('admin');
    expect((await call(patchProfile, { method: 'PATCH', params: { id: other.id }, body: { bio: 'hacked' } })).status).toBe(403);
  });
});
