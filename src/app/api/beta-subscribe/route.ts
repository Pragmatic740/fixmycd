import { NextResponse } from 'next/server';
import { db } from '@/db';
import { betaSubscribers } from '@/db/schema';
import crypto from 'crypto';
import { clientIp, parseJsonBody, serverError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { betaSubscribeSchema } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit('betaSubscribe', clientIp(request));
    if (limited) return limited;

    const parsed = await parseJsonBody(request, betaSubscribeSchema);
    if (!parsed.ok) return parsed.response;

    // Idempotent and identical response either way (doesn't reveal who signed up).
    await db
      .insert(betaSubscribers)
      .values({ id: crypto.randomUUID(), email: parsed.data.email, createdAt: new Date() })
      .onConflictDoNothing();

    return NextResponse.json({ success: true, message: "You're on the list! We'll email you when we launch." }, { status: 201 });
  } catch (error: unknown) {
    return serverError(error, 'beta-subscribe');
  }
}
