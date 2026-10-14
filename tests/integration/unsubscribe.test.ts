import { describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { POST as unsubscribe } from '@/app/api/unsubscribe/route';
import { call } from '../helpers/route';
import { createUser } from '../helpers/factories';

vi.hoisted(() => {
  process.env.UNSUBSCRIBE_SECRET = 'unit-secret';
});

describe('one-click unsubscribe', () => {
  it('turns emails off with a valid signed link, without logging in', async () => {
    const { unsubscribeToken, unsubscribeUrlFor } = await import('@/lib/unsubscribe');
    const u = await createUser();
    const url = new URL(unsubscribeUrlFor(u.id)!);
    expect(url.pathname).toBe('/unsubscribe');
    const res = await call(unsubscribe, { method: 'POST', body: { u: u.id, t: unsubscribeToken(u.id) } });
    expect(res.status).toBe(200);
    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    expect(row.emailNotifications).toBe(false);
  });

  it('rejects forged or swapped tokens', async () => {
    const { unsubscribeToken } = await import('@/lib/unsubscribe');
    const victim = await createUser();
    const attacker = await createUser();
    for (const t of ['forged', unsubscribeToken(attacker.id)!]) {
      const res = await call(unsubscribe, { method: 'POST', body: { u: victim.id, t } });
      expect(res.status).toBe(400);
    }
    const [row] = await db.select().from(users).where(eq(users.id, victim.id));
    expect(row.emailNotifications).toBe(true);
  });
});
