import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { adminAuditLog, betaSubscribers } from '@/db/schema';
import { isAuthError, requireAdmin } from '@/lib/auth';
import { sendBetaReleaseNotification } from '@/lib/email';
import { serverError } from '@/lib/http';

/** Emails sent per click, to stay well inside provider rate limits and request time. */
const BATCH_SIZE = 100;

async function counts() {
  const [row] = await db
    .select({
      total: sql<number>`cast(count(*) as int)`,
      waiting: sql<number>`cast(count(*) filter (where ${betaSubscribers.notifiedAt} is null) as int)`,
    })
    .from(betaSubscribers);
  return row ?? { total: 0, waiting: 0 };
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (isAuthError(admin)) return admin;
    return NextResponse.json(await counts());
  } catch (error: unknown) {
    return serverError(error, 'admin/beta-subscribers GET');
  }
}

/** Send the "we're open" email to subscribers who haven't had it yet (one batch per call). */
export async function POST() {
  try {
    const admin = await requireAdmin();
    if (isAuthError(admin)) return admin;

    const batch = await db
      .select({ id: betaSubscribers.id, email: betaSubscribers.email })
      .from(betaSubscribers)
      .where(isNull(betaSubscribers.notifiedAt))
      .orderBy(betaSubscribers.createdAt)
      .limit(BATCH_SIZE);

    let sent = 0;
    let failed = 0;
    for (const sub of batch) {
      if (await sendBetaReleaseNotification({ to: sub.email })) {
        // Only mark as notified once the email actually went out.
        await db
          .update(betaSubscribers)
          .set({ notifiedAt: new Date() })
          .where(and(eq(betaSubscribers.id, sub.id), isNull(betaSubscribers.notifiedAt)));
        sent++;
      } else {
        failed++;
      }
    }

    await db.insert(adminAuditLog).values({
      id: crypto.randomUUID(),
      actorId: admin.id,
      action: 'beta.notify',
      targetType: 'beta_subscribers',
      detailsJson: JSON.stringify({ sent, failed }),
      createdAt: new Date(),
    });

    return NextResponse.json({ sent, failed, ...(await counts()) });
  } catch (error: unknown) {
    return serverError(error, 'admin/beta-subscribers POST');
  }
}
