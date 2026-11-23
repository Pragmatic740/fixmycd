import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { demoPayments, users } from '@/db/schema';
import { createSession } from '@/lib/auth';
import { badRequest, clientIp, parseJsonBody, serverError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { VERIFICATION_AMOUNT_CENTS, checkDemoCard, verifyPaymentSchema } from '@/lib/payments-demo';

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);
const invalidCredentials = () => NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });

/**
 * $1 identity check (DEMO — no real charge). The account owner proves who they are
 * with their email and password, pays with the test card, and their pending account
 * is activated and signed in without waiting for an admin. Asking for the password
 * keeps the "is this email registered?" question unanswerable, as at signup.
 */
export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit('payment', clientIp(request));
    if (limited) return limited;

    const parsed = await parseJsonBody(request, verifyPaymentSchema);
    if (!parsed.ok) return parsed.response;
    const { email, password, card } = parsed.data;

    const limitedByAccount = await enforceRateLimit('loginByAccount', email);
    if (limitedByAccount) return limitedByAccount;

    const [user] = await db
      .select({ id: users.id, passwordHash: users.passwordHash, status: users.status, disabledAt: users.disabledAt })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !user.passwordHash || !passwordOk) return invalidCredentials();

    if (user.disabledAt) return NextResponse.json({ error: 'Account has been disabled' }, { status: 403 });
    if (user.status === 'approved') {
      return NextResponse.json({ error: 'Your account is already active. Just log in.' }, { status: 409 });
    }
    if (user.status !== 'pending') {
      return NextResponse.json({ error: 'Your account was not approved. Please contact support.' }, { status: 403 });
    }

    const checked = checkDemoCard(card);
    if (!checked.ok) return badRequest('Check your card details', checked.errors);

    const now = new Date();
    const activated = await db.transaction(async (tx) => {
      const rows = await tx
        .update(users)
        .set({ status: 'approved', verifiedAt: now, verificationMethod: 'card_demo' })
        .where(and(eq(users.id, user.id), eq(users.status, 'pending')))
        .returning({ id: users.id });
      if (!rows[0]) return false;
      await tx.insert(demoPayments).values({
        id: crypto.randomUUID(),
        userId: user.id,
        kind: 'verification',
        amountCents: VERIFICATION_AMOUNT_CENTS,
        last4: checked.last4,
        createdAt: now,
      });
      return true;
    });
    if (!activated) return NextResponse.json({ error: 'Your account is already active. Just log in.' }, { status: 409 });

    await createSession(user.id);
    return NextResponse.json({ success: true, verified: true, demo: true });
  } catch (error: unknown) {
    return serverError(error, 'verify');
  }
}
