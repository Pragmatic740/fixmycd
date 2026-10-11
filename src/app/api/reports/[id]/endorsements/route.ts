import { NextResponse } from 'next/server';
import { db } from '@/db';
import { endorsements, users, reports } from '@/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import crypto from 'crypto';
import { getSessionUser, isAuthError, requireExpert } from '@/lib/auth';
import { containsBlockedContent } from '@/lib/content-filter';
import { sendEndorsementNotification } from '@/lib/email';
import { notFound, parseJsonBody, serverError } from '@/lib/http';
import { createNotification, emailRecipient, runAfterResponse } from '@/lib/notify';
import { unsubscribeUrlFor } from '@/lib/unsubscribe';
import { endorsementSchema } from '@/lib/validation';

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

    // Endorsements from disabled experts no longer count.
    const rows = await db
      .select({
        id: endorsements.id,
        expertUserId: endorsements.expertUserId,
        severityLevel: endorsements.severityLevel,
        note: endorsements.note,
        createdAt: endorsements.createdAt,
        updatedAt: endorsements.updatedAt,
        expertName: users.displayName,
        expertRole: users.role,
      })
      .from(endorsements)
      .innerJoin(users, eq(endorsements.expertUserId, users.id))
      .where(and(eq(endorsements.reportId, id), isNull(users.disabledAt)))
      .orderBy(desc(endorsements.createdAt));

    const sessionUser = await getSessionUser();
    const items = rows.map(({ expertUserId, ...r }) => ({
      ...r,
      isMine: sessionUser?.id === expertUserId,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt?.toISOString() ?? null,
    }));
    const average = items.length
      ? Math.round((items.reduce((s, e) => s + e.severityLevel, 0) / items.length) * 10) / 10
      : null;

    return NextResponse.json({
      items,
      count: items.length,
      averageSeverity: average,
      myEndorsement: items.find((e) => e.isMine) ?? null,
    });
  } catch (error: unknown) {
    return serverError(error, 'endorsements GET');
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userCheck = await requireExpert();
    if (isAuthError(userCheck)) return userCheck;
    const user = userCheck;

    const parsed = await parseJsonBody(request, endorsementSchema);
    if (!parsed.ok) return parsed.response;
    const { severityLevel, note } = parsed.data;

    if (note) {
      const blocked = containsBlockedContent(note);
      if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });
    }

    const { id } = await params;
    const report = await visibleReport(id);
    if (!report) return notFound('Report not found');

    const [existing] = await db
      .select({ id: endorsements.id })
      .from(endorsements)
      .where(and(eq(endorsements.reportId, id), eq(endorsements.expertUserId, user.id)))
      .limit(1);

    if (existing) {
      await db
        .update(endorsements)
        .set({ severityLevel, note, updatedAt: new Date() })
        .where(eq(endorsements.id, existing.id));
      return NextResponse.json({ success: true, updated: true, id: existing.id });
    }

    const endorsementId = crypto.randomUUID();
    await db.insert(endorsements).values({
      id: endorsementId,
      reportId: id,
      expertUserId: user.id,
      severityLevel,
      note,
      createdAt: new Date(),
    });

    if (report.submitterId !== user.id) {
      await createNotification({
        recipientId: report.submitterId,
        actorId: user.id,
        type: 'endorsement',
        reportId: id,
        metadata: { severityLevel },
      });
      runAfterResponse('endorsement-email', async () => {
        const recipient = await emailRecipient(report.submitterId);
        if (!recipient) return;
        await sendEndorsementNotification({
          to: recipient.email,
          reportTitle: report.title,
          reportId: id,
          expertName: user.displayName || 'An expert',
          severityLevel,
          unsubscribeUrl: unsubscribeUrlFor(report.submitterId),
        });
      });
    }

    return NextResponse.json({ success: true, id: endorsementId }, { status: 201 });
  } catch (error: unknown) {
    return serverError(error, 'endorsements POST');
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userCheck = await requireExpert();
    if (isAuthError(userCheck)) return userCheck;

    const { id } = await params;
    await db
      .delete(endorsements)
      .where(and(eq(endorsements.reportId, id), eq(endorsements.expertUserId, userCheck.id)));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return serverError(error, 'endorsements DELETE');
  }
}
