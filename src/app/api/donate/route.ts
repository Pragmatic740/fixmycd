import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/db';
import { demoPayments } from '@/db/schema';
import { getSessionUser } from '@/lib/auth';
import { badRequest, clientIp, parseJsonBody, serverError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { checkDemoCard, donationSchema } from '@/lib/payments-demo';

/** Donation (DEMO — no real charge). Anyone can give; signed-in donors are linked to their account. */
export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit('payment', clientIp(request));
    if (limited) return limited;

    const parsed = await parseJsonBody(request, donationSchema);
    if (!parsed.ok) return parsed.response;
    const { amountCents, card } = parsed.data;

    const checked = checkDemoCard(card);
    if (!checked.ok) return badRequest('Check your card details', checked.errors);

    const user = await getSessionUser();
    await db.insert(demoPayments).values({
      id: crypto.randomUUID(),
      userId: user?.id ?? null,
      kind: 'donation',
      amountCents,
      last4: checked.last4,
      createdAt: new Date(),
    });
    return NextResponse.json({ success: true, amountCents, demo: true }, { status: 201 });
  } catch (error: unknown) {
    return serverError(error, 'donate');
  }
}
