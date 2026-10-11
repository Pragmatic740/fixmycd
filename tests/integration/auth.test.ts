import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { sessions, users } from '@/db/schema';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as signup } from '@/app/api/auth/signup/route';
import { POST as logout } from '@/app/api/auth/logout/route';
import { GET as me } from '@/app/api/auth/me/route';
import { GET as adminUsers } from '@/app/api/admin/users/route';
import { hashSessionToken, SESSION_COOKIE, LEGACY_SESSION_COOKIE, PASSWORD_HASH_COST } from '@/lib/auth';
import { call } from '../helpers/route';
import { cookieJar } from '../helpers/cookie-jar';
import { createUser } from '../helpers/factories';
import { loginAs, sessionToken, signedInUser } from '../helpers/session';

describe('session cookie cannot be forged', () => {
  it('a legacy session_user_id cookie with an admin id grants nothing (account takeover regression)', async () => {
    const admin = await createUser({ role: 'super_admin' });
    cookieJar.set(LEGACY_SESSION_COOKIE, admin.id);

    expect((await call(me)).status).toBe(401);
    expect((await call(adminUsers, { path: '/api/admin/users' })).status).toBe(401);
  });

  it('putting a user id into the new session cookie grants nothing', async () => {
    const admin = await createUser({ role: 'admin' });
    cookieJar.set(SESSION_COOKIE, admin.id);
    expect((await call(me)).status).toBe(401);
  });

  it('a random token grants nothing', async () => {
    cookieJar.set(SESSION_COOKIE, 'x'.repeat(43));
    expect((await call(me)).status).toBe(401);
  });

  it('stores only a hash of the token in the database', async () => {
    const user = await signedInUser('submitter');
    const token = sessionToken()!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const rows = await db.select().from(sessions).where(eq(sessions.userId, user.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(hashSessionToken(token));
    expect(rows[0].id).not.toContain(token);
  });
});

describe('login', () => {
  it('signs in, exposes the user via /me, and logs out server-side', async () => {
    const user = await createUser({ role: 'referee' });
    const res = await loginAs(user.email, user.password);
    expect(res.json.user).toMatchObject({ id: user.id, role: 'referee' });
    expect(res.json.user.passwordHash).toBeUndefined();

    const meRes = await call(me);
    expect(meRes.status).toBe(200);
    expect(meRes.json.user).toMatchObject({ id: user.id, email: user.email });

    const token = sessionToken()!;
    expect((await call(logout, { method: 'POST' })).status).toBe(200);
    expect(sessionToken()).toBeUndefined();

    // A copy of the old token is useless after logout.
    cookieJar.set(SESSION_COOKIE, token);
    expect((await call(me)).status).toBe(401);
  });

  it('matches emails case-insensitively (accounts created before normalization still work)', async () => {
    const user = await createUser({ email: 'Mixed.Case@Example.TEST' });
    const res = await call(login, { method: 'POST', body: { email: '  mixed.case@example.test ', password: user.password } });
    expect(res.status).toBe(200);
  });

  it('returns the same error for a wrong password and an unknown email', async () => {
    const user = await createUser();
    const wrong = await call(login, { method: 'POST', body: { email: user.email, password: 'nope-nope' } });
    const unknown = await call(login, { method: 'POST', body: { email: 'ghost@example.test', password: 'nope-nope' } });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.json).toEqual(unknown.json);
  });

  it('does not reveal disabled/pending status without the correct password', async () => {
    const disabled = await createUser({ disabledAt: new Date() });
    const res = await call(login, { method: 'POST', body: { email: disabled.email, password: 'wrong-password' } });
    expect(res.status).toBe(401);
    expect(res.json.error).toBe('Invalid email or password');
  });

  it.each([
    ['pending', 403, /pending approval/],
    ['rejected', 403, /not approved/],
  ])('blocks %s accounts', async (status, code, message) => {
    const user = await createUser({ status });
    const res = await call(login, { method: 'POST', body: { email: user.email, password: user.password } });
    expect(res.status).toBe(code);
    expect(res.json.error).toMatch(message);
    expect(sessionToken()).toBeUndefined();
  });

  it('blocks disabled accounts once the password is correct', async () => {
    const user = await createUser({ disabledAt: new Date() });
    const res = await call(login, { method: 'POST', body: { email: user.email, password: user.password } });
    expect(res.status).toBe(403);
    expect(res.json.error).toMatch(/disabled/);
  });

  it('rejects malformed bodies with 400, not 500', async () => {
    expect((await call(login, { method: 'POST', rawBody: 'not json', headers: { 'content-type': 'application/json' } })).status).toBe(400);
    expect((await call(login, { method: 'POST', body: { email: 42, password: [] } })).status).toBe(400);
  });

  it('rate limits repeated attempts against one account', async () => {
    const user = await createUser();
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await call(login, { method: 'POST', body: { email: user.email, password: `wrong-${i}` }, ip: `198.51.100.${i}` });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    const blocked = await call(login, { method: 'POST', body: { email: user.email, password: user.password }, ip: '198.51.100.200' });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('rate limits one IP trying many accounts', async () => {
    let last = 0;
    for (let i = 0; i < 31; i++) {
      const res = await call(login, { method: 'POST', body: { email: `probe${i}@example.test`, password: 'x' }, ip: '192.0.2.77' });
      last = res.status;
    }
    expect(last).toBe(429);
  });
});

describe('sessions follow the account', () => {
  it('a disabled user loses access immediately', async () => {
    const user = await signedInUser('submitter');
    expect((await call(me)).status).toBe(200);
    await db.update(users).set({ disabledAt: new Date() }).where(eq(users.id, user.id));
    expect((await call(me)).status).toBe(401);
  });

  it('a user moved back to pending loses access immediately', async () => {
    const user = await signedInUser('submitter');
    await db.update(users).set({ status: 'rejected' }).where(eq(users.id, user.id));
    expect((await call(me)).status).toBe(401);
  });

  it('an expired session is rejected', async () => {
    const user = await signedInUser('submitter');
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.userId, user.id));
    expect((await call(me)).status).toBe(401);
  });

  it('login clears the legacy cookie and sets a hardened cookie', async () => {
    const user = await createUser();
    cookieJar.set(LEGACY_SESSION_COOKIE, user.id);
    await loginAs(user.email, user.password);
    expect(cookieJar.get(LEGACY_SESSION_COOKIE)).toBeUndefined();
    const opts = cookieJar.store().lastOptions(SESSION_COOKIE) as Record<string, unknown>;
    expect(opts).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
  });
});

describe('signup', () => {
  it('creates a pending account with a normalized email and a cost-12 hash', async () => {
    const res = await call(signup, {
      method: 'POST',
      body: { email: '  New.Person@Example.TEST ', password: 'long-enough-pw', displayName: 'New Person' },
    });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ success: true, pending: true });
    expect(res.json.user).toBeUndefined();

    const [row] = await db.select().from(users).where(eq(users.email, 'new.person@example.test'));
    expect(row.status).toBe('pending');
    expect(row.role).toBe('submitter');
    expect(bcrypt.getRounds(row.passwordHash!)).toBe(PASSWORD_HASH_COST);
    expect(sessionToken()).toBeUndefined();
  });

  it('gives the same answer for an email that already exists (no account enumeration)', async () => {
    const existing = await createUser({ email: 'taken@example.test' });
    const res = await call(signup, {
      method: 'POST',
      body: { email: 'TAKEN@example.test', password: 'long-enough-pw', displayName: 'Imposter' },
    });
    expect(res.status).toBe(201);
    const rows = await db.select().from(users).where(eq(users.id, existing.id));
    expect(rows[0].displayName).toBe(existing.displayName);
    expect((await db.select().from(users)).length).toBe(1);
  });

  it.each([
    [{ email: 'not-an-email', password: 'long-enough-pw', displayName: 'X' }, 'email'],
    [{ email: 'a@example.test', password: 'short', displayName: 'X' }, 'password'],
    [{ email: 'a@example.test', password: 'é'.repeat(40), displayName: 'X' }, 'password'],
    [{ email: 'a@example.test', password: 'long-enough-pw', displayName: '   ' }, 'displayName'],
    [{ email: 'a@example.test', password: 'long-enough-pw', displayName: 'x'.repeat(81) }, 'displayName'],
  ])('rejects invalid input %#', async (body, field) => {
    const res = await call(signup, { method: 'POST', body });
    expect(res.status).toBe(400);
    expect(Object.keys(res.json.fields)).toContain(field);
  });

  it('rate limits mass signups from one IP', async () => {
    let last = 0;
    for (let i = 0; i < 6; i++) {
      const res = await call(signup, {
        method: 'POST',
        body: { email: `bulk${i}@example.test`, password: 'long-enough-pw', displayName: 'Bulk' },
        ip: '192.0.2.50',
      });
      last = res.status;
    }
    expect(last).toBe(429);
  });
});
