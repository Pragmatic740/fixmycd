import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { adminAuditLog, sessions, users } from '@/db/schema';
import { GET as listUsers, PATCH as patchUser } from '@/app/api/admin/users/route';
import { GET as me } from '@/app/api/auth/me/route';
import { call } from '../helpers/route';
import { cookieJar } from '../helpers/cookie-jar';
import { createUser } from '../helpers/factories';
import { loginAs, signedInUser } from '../helpers/session';

const patch = (body: unknown) => call(patchUser, { method: 'PATCH', path: '/api/admin/users', body });

describe('GET /api/admin/users', () => {
  it.each([
    ['guest', null, 401],
    ['submitter', 'submitter', 403],
    ['referee', 'referee', 403],
    ['admin', 'admin', 200],
    ['super_admin', 'super_admin', 200],
  ] as const)('%s → %i', async (_label, role, expected) => {
    if (role) await signedInUser(role);
    expect((await call(listUsers, { path: '/api/admin/users' })).status).toBe(expected);
  });

  it('never returns password hashes and filters by status', async () => {
    await signedInUser('admin');
    await createUser({ status: 'pending', email: 'waiting@example.test' });
    const all = await call(listUsers, { path: '/api/admin/users' });
    expect(JSON.stringify(all.json)).not.toMatch(/passwordHash|password_hash|\$2[aby]\$/);

    const pending = await call(listUsers, { path: '/api/admin/users', query: { status: 'pending' } });
    expect(pending.json.map((u: { email: string }) => u.email)).toEqual(['waiting@example.test']);
    expect((await call(listUsers, { path: '/api/admin/users', query: { status: 'bogus' } })).status).toBe(400);
  });
});

describe('PATCH /api/admin/users privilege rules', () => {
  it('admin cannot demote or disable a super_admin', async () => {
    const boss = await createUser({ role: 'super_admin' });
    await signedInUser('admin');
    expect((await patch({ userId: boss.id, role: 'submitter' })).status).toBe(403);
    expect((await patch({ userId: boss.id, disabled: true })).status).toBe(403);
    const [row] = await db.select().from(users).where(eq(users.id, boss.id));
    expect(row.role).toBe('super_admin');
    expect(row.disabledAt).toBeNull();
  });

  it('admin cannot change another admin, but a super_admin can', async () => {
    const other = await createUser({ role: 'admin' });
    await signedInUser('admin');
    expect((await patch({ userId: other.id, disabled: true })).status).toBe(403);

    await signedInUser('super_admin');
    expect((await patch({ userId: other.id, role: 'referee' })).status).toBe(200);
  });

  it('admin cannot grant super_admin; super_admin can', async () => {
    const target = await createUser({ role: 'submitter' });
    await signedInUser('admin');
    expect((await patch({ userId: target.id, role: 'super_admin' })).status).toBe(403);
    await signedInUser('super_admin');
    expect((await patch({ userId: target.id, role: 'super_admin' })).status).toBe(200);
  });

  it('nobody can change their own account here', async () => {
    const self = await signedInUser('super_admin');
    const res = await patch({ userId: self.id, role: 'submitter' });
    expect(res.status).toBe(403);
    expect((await patch({ userId: self.id, disabled: true })).status).toBe(403);
  });

  it('returns 404 for an unknown user and 400 for invalid input', async () => {
    await signedInUser('admin');
    expect((await patch({ userId: 'nope', status: 'approved' })).status).toBe(404);
    expect((await patch({ userId: 'x', role: 'god' })).status).toBe(400);
    expect((await patch({ userId: 'x' })).status).toBe(400);
    expect((await patch({ userId: 'x', disabled: 'yes' })).status).toBe(400);
  });

  it('approves a pending user and returns only safe fields', async () => {
    const pending = await createUser({ status: 'pending' });
    await signedInUser('admin');
    const res = await patch({ userId: pending.id, status: 'approved' });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ id: pending.id, status: 'approved' });
    expect(res.json.passwordHash).toBeUndefined();
  });

  it('writes an audit log entry for every change', async () => {
    const target = await createUser();
    const admin = await signedInUser('admin');
    await patch({ userId: target.id, role: 'referee' });
    const [entry] = await db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, target.id));
    expect(entry).toMatchObject({ actorId: admin.id, action: 'user.update', targetType: 'user' });
    expect(JSON.parse(entry.detailsJson!)).toMatchObject({ before: { role: 'submitter' }, changes: { role: 'referee' } });
  });
});

describe('account changes end the user’s sessions', () => {
  it.each([
    [{ disabled: true }],
    [{ status: 'rejected' }],
    [{ role: 'viewer' }],
  ])('%o signs the user out everywhere', async (change) => {
    const target = await createUser({ role: 'referee' });
    await loginAs(target.email, target.password);
    const targetCookies = cookieJar.store().getAll();

    await signedInUser('admin');
    expect((await patch({ userId: target.id, ...change })).status).toBe(200);
    expect(await db.select().from(sessions).where(eq(sessions.userId, target.id))).toHaveLength(0);

    cookieJar.clear();
    for (const c of targetCookies) cookieJar.set(c.name, c.value);
    expect((await call(me)).status).toBe(401);
  });
});
