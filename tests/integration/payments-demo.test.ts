import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { demoPayments, users } from '@/db/schema';
import { POST as signup } from '@/app/api/auth/signup/route';
import { POST as verify } from '@/app/api/verify/route';
import { POST as donate } from '@/app/api/donate/route';
import { GET as me } from '@/app/api/auth/me/route';
import { call } from '../helpers/route';
import { cookieJar } from '../helpers/cookie-jar';
import { createUser } from '../helpers/factories';

const card = { number: '4242 4242 4242 4242', expiry: '12/30', cvc: '123', name: 'Test Person' };
const signUp = (email: string, extra: Record<string, unknown> = {}) =>
  call(signup, { method: 'POST', body: { email, password: 'long-enough-pass', displayName: 'New Person', acceptEthics: true, ...extra } });

describe('$1 verification (demo)', () => {
  it('activates a pending account, signs it in and stores only the last 4 digits', async () => {
    cookieJar.clear();
    expect((await signUp('payer@example.org')).status).toBe(201);
    const res = await call(verify, { method: 'POST', body: { email: 'payer@example.org', password: 'long-enough-pass', card } });
    expect(res.status).toBe(200);

    const [user] = await db.select().from(users).where(eq(users.email, 'payer@example.org'));
    expect(user.status).toBe('approved');
    expect(user.verificationMethod).toBe('card_demo');
    expect(user.verifiedAt).not.toBeNull();
    expect((await call(me)).json.user.email).toBe('payer@example.org');

    const payments = await db.select().from(demoPayments).where(eq(demoPayments.userId, user.id));
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ kind: 'verification', amountCents: 100, last4: '4242' });
    const stored = JSON.stringify(await db.select().from(demoPayments));
    expect(stored).not.toContain('4242424242424242');
    expect(stored).not.toContain('123"');
  });

  it('rejects wrong passwords and real-looking cards without changing the account', async () => {
    cookieJar.clear();
    await signUp('careful@example.org');
    expect(
      (await call(verify, { method: 'POST', body: { email: 'careful@example.org', password: 'wrong-password', card } })).status,
    ).toBe(401);
    expect(
      (await call(verify, { method: 'POST', body: { email: 'nobody@example.org', password: 'long-enough-pass', card } })).status,
    ).toBe(401);
    const realCard = await call(verify, {
      method: 'POST',
      body: { email: 'careful@example.org', password: 'long-enough-pass', card: { ...card, number: '5555 5555 5555 4444' } },
    });
    expect(realCard.status).toBe(400);
    expect(realCard.json.fields.number).toMatch(/test card/);
    const [user] = await db.select().from(users).where(eq(users.email, 'careful@example.org'));
    expect(user.status).toBe('pending');
    expect(await db.select().from(demoPayments).where(eq(demoPayments.userId, user.id))).toHaveLength(0);
  });

  it('does not charge accounts that are already active, rejected or disabled', async () => {
    const active = await createUser({ status: 'approved' });
    expect((await call(verify, { method: 'POST', body: { email: active.email, password: active.password, card } })).status).toBe(409);
    const rejected = await createUser({ status: 'rejected' });
    expect((await call(verify, { method: 'POST', body: { email: rejected.email, password: rejected.password, card } })).status).toBe(403);
    const disabled = await createUser({ status: 'pending', disabledAt: new Date() });
    expect((await call(verify, { method: 'POST', body: { email: disabled.email, password: disabled.password, card } })).status).toBe(403);
    expect(await db.select().from(demoPayments)).toHaveLength(0);
  });
});

describe('donations (demo)', () => {
  it('records a donation from a guest with only the last 4 digits', async () => {
    cookieJar.clear();
    const res = await call(donate, { method: 'POST', body: { amountCents: 500, card } });
    expect(res.status).toBe(201);
    const [row] = await db.select().from(demoPayments);
    expect(row).toMatchObject({ kind: 'donation', amountCents: 500, last4: '4242', userId: null });
  });

  it('validates amounts and cards', async () => {
    expect((await call(donate, { method: 'POST', body: { amountCents: 50, card } })).status).toBe(400);
    expect((await call(donate, { method: 'POST', body: { amountCents: 500, card: { ...card, cvc: '1' } } })).status).toBe(400);
    expect(await db.select().from(demoPayments)).toHaveLength(0);
  });
});
