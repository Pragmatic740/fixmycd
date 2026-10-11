import { NextResponse } from 'next/server';
import { db } from '@/db';
import { comments, reports, users } from '@/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import crypto from 'crypto';
import { getSessionUser } from '@/lib/auth';
import { containsBlockedContent } from '@/lib/content-filter';
import { sendCommentNotification } from '@/lib/email';
import { clientIp, notFound, parseJsonBody, serverError } from '@/lib/http';
import { createNotification, emailRecipient, runAfterResponse } from '@/lib/notify';
import { enforceRateLimit } from '@/lib/rate-limit';
import { unsubscribeUrlFor } from '@/lib/unsubscribe';
import { commentSchema } from '@/lib/validation';

async function visibleReport(id: string) {
  const [report] = await db
    .select({ id: reports.id, title: reports.title, submitterId: reports.submitterId })
    .from(reports)
    .where(and(eq(reports.id, id), eq(reports.isHidden, false)))
    .limit(1);
  return report ?? null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!(await visibleReport(id))) return notFound('Report not found');

    // Moderated comments and comments by disabled accounts are not public.
    const rows = await db
      .select({
        id: comments.id,
        body: comments.body,
        createdAt: comments.createdAt,
        userId: comments.userId,
        userDisplayName: users.displayName,
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .where(and(eq(comments.reportId, id), eq(comments.isHidden, false), isNull(users.disabledAt)))
      .orderBy(desc(comments.createdAt));

    return NextResponse.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
  } catch (error: unknown) {
    return serverError(error, 'comments GET');
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await enforceRateLimit('comment', `${user.id}:${clientIp(request)}`);
    if (limited) return limited;

    const parsed = await parseJsonBody(request, commentSchema);
    if (!parsed.ok) return parsed.response;
    const commentBody = parsed.data.body;

    const blocked = containsBlockedContent(commentBody);
    if (blocked) {
      return NextResponse.json({ error: blocked }, { status: 400 });
    }

    const { id } = await params;
    const report = await visibleReport(id);
    if (!report) return notFound('Report not found');

    const [newComment] = await db
      .insert(comments)
      .values({
        id: crypto.randomUUID(),
        reportId: id,
        userId: user.id,
        body: commentBody,
        createdAt: new Date(),
      })
      .returning();

    if (report.submitterId !== user.id) {
      await createNotification({ recipientId: report.submitterId, actorId: user.id, type: 'comment', reportId: id });
      runAfterResponse('comment-email', async () => {
        const recipient = await emailRecipient(report.submitterId);
        if (!recipient) return;
        await sendCommentNotification({
          to: recipient.email,
          reportTitle: report.title,
          reportId: id,
          commenterName: user.displayName || 'Someone',
          commentBody: commentBody.slice(0, 200),
          unsubscribeUrl: unsubscribeUrlFor(report.submitterId),
        });
      });
    }

    return NextResponse.json(
      {
        id: newComment.id,
        body: newComment.body,
        userId: user.id,
        userDisplayName: user.displayName,
        createdAt: newComment.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    return serverError(error, 'comments POST');
  }
}
