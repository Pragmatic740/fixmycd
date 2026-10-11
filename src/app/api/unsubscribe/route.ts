import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { parseJsonBody, serverError } from '@/lib/http';
import { verifyUnsubscribeToken } from '@/lib/unsubscribe';
import { unsubscribeSchema } from '@/lib/validation';

/** Turn off activity emails using the signed link from an email (no login needed). */
export async function POST(request: Request) {
  try {
    const parsed = await parseJsonBody(request, unsubscribeSchema);
    if (!parsed.ok) return parsed.response;
    const { u, t } = parsed.data;

    if (!verifyUnsubscribeToken(u, t)) {
      return NextResponse.json({ error: 'This unsubscribe link is invalid or has expired.' }, { status: 400 });
    }

    await db.update(users).set({ emailNotifications: false }).where(eq(users.id, u));
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return serverError(error, 'unsubscribe');
  }
}
