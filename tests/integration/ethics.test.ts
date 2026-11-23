import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { adminAuditLog, users } from '@/db/schema';
import { GET as getEthics } from '@/app/api/ethics/route';
import { POST as publish } from '@/app/api/admin/ethics/route';
import { POST as signup } from '@/app/api/auth/signup/route';
import { call } from '../helpers/route';
import { cookieJar } from '../helpers/cookie-jar';
import { signedInUser } from '../helpers/session';
import { DEFAULT_ETHICS_BODY } from '@/lib/ethics-text';

const NEW_TEXT = '# House rules v2\n\nBe kind, be accurate and never post anything you did not see yourself.\n\n- No spam';

describe('Code of Ethics', () => {
  it('serves the built-in first version before anything is published', async () => {
    cookieJar.clear();
    const res = await call(getEthics);
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ version: 1, body: DEFAULT_ETHICS_BODY, publishedAt: null });
  });

  it('only admins can publish; each publish is a new version recorded in the audit log', async () => {
    await signedInUser('submitter');
    expect((await call(publish, { method: 'POST', body: { body: NEW_TEXT } })).status).toBe(403);
    await signedInUser('referee');
    expect((await call(publish, { method: 'POST', body: { body: NEW_TEXT } })).status).toBe(403);
    cookieJar.clear();
    expect((await call(publish, { method: 'POST', body: { body: NEW_TEXT } })).status).toBe(401);

    const admin = await signedInUser('admin');
    expect((await call(publish, { method: 'POST', body: { body: 'too short' } })).status).toBe(400);
    const first = await call(publish, { method: 'POST', body: { body: NEW_TEXT } });
    expect(first.status).toBe(201);
    expect(first.json.version).toBe(2);
    const second = await call(publish, { method: 'POST', body: { body: `${NEW_TEXT}\n- No ads` } });
    expect(second.json.version).toBe(3);

    expect((await call(getEthics)).json).toMatchObject({ version: 3, body: `${NEW_TEXT}\n- No ads` });
    const audit = await db.select().from(adminAuditLog).where(eq(adminAuditLog.actorId, admin.id));
    expect(audit.map((a) => a.action)).toEqual(['ethics.publish', 'ethics.publish']);
  });

  it('signup requires agreeing, and records the version agreed to', async () => {
    cookieJar.clear();
    const body = { email: 'agree@example.org', password: 'long-enough-pass', displayName: 'Agreeable' };
    const refused = await call(signup, { method: 'POST', body });
    expect(refused.status).toBe(400);
    expect(refused.json.fields.acceptEthics).toMatch(/Code of Ethics/);

    await signedInUser('admin');
    await call(publish, { method: 'POST', body: { body: NEW_TEXT } });
    cookieJar.clear();
    expect((await call(signup, { method: 'POST', body: { ...body, acceptEthics: true } })).status).toBe(201);
    const [user] = await db.select().from(users).where(eq(users.email, 'agree@example.org'));
    expect(user.ethicsAcceptedVersion).toBe(2);
  });
});
