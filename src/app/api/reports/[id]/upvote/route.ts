import { NextResponse } from 'next/server';
import { db } from '@/db';
import { notifications, reports, upvotes } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { getSessionUser } from '@/lib/auth';
import { sendUpvoteNotification } from '@/lib/email';
import { notFound, serverError } from '@/lib/http';
import { createNotification, emailRecipient, runAfterResponse } from '@/lib/notify';
import { unsubscribeUrlFor } from '@/lib/unsubscribe';

const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

async function upvoteCount(reportId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(upvotes)
    .where(eq(upvotes.reportId, reportId));
  return row?.count ?? 0;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const { id } = await params;
    const [report] = await db
      .select({ id: reports.id, title: reports.title, submitterId: reports.submitterId })
      .from(reports)
      .where(and(eq(reports.id, id), eq(reports.isHidden, false)))
      .limit(1);
    if (!report) return notFound('Report not found');

    // Idempotent: a second upvote is a no-op (unique index on user+report).
    const inserted = await db
      .insert(upvotes)
      .values({ id: crypto.randomUUID(), userId: user.id, reportId: id, createdAt: new Date() })
      .onConflictDoNothing()
      .returning({ id: upvotes.id });

    const count = await upvoteCount(id);

    if (inserted.length > 0 && report.submitterId !== user.id) {
      // Notify once per person per report, even if they toggle the upvote.
      const [already] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, report.submitterId),
            eq(notifications.actorId, user.id),
            eq(notifications.reportId, id),
            eq(notifications.type, 'upvote')
          )
        )
        .limit(1);
      if (!already) {
        await createNotification({ recipientId: report.submitterId, actorId: user.id, type: 'upvote', reportId: id });
        runAfterResponse('upvote-email', async () => {
          const recipient = await emailRecipient(report.submitterId);
          if (!recipient) return;
          await sendUpvoteNotification({
            to: recipient.email,
            reportTitle: report.title,
            reportId: id,
            upvoteCount: count,
            unsubscribeUrl: unsubscribeUrlFor(report.submitterId),
          });
        });
      }
    }

    return NextResponse.json({ upvoted: true, upvoteCount: count });
  } catch (error: unknown) {
    return serverError(error, 'upvote POST');
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const { id } = await params;
    await db.delete(upvotes).where(and(eq(upvotes.userId, user.id), eq(upvotes.reportId, id)));

    return NextResponse.json({ upvoted: false, upvoteCount: await upvoteCount(id) });
  } catch (error: unknown) {
    return serverError(error, 'upvote DELETE');
  }
}
