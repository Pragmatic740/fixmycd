import { NextResponse } from 'next/server';
import { db } from '@/db';
import { reports, reportStatusHistory } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { isAuthError, requireModerator } from '@/lib/auth';
import { sendStatusChangeNotification } from '@/lib/email';
import { notFound, parseJsonBody, serverError } from '@/lib/http';
import { createNotification, emailRecipient, runAfterResponse } from '@/lib/notify';
import { unsubscribeUrlFor } from '@/lib/unsubscribe';
import { reviewPatchSchema } from '@/lib/validation';
import { generateAiSummary } from '@/lib/ai-summary';


export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userCheck = await requireModerator();
    if (isAuthError(userCheck)) return userCheck;
    const user = userCheck;

    const parsed = await parseJsonBody(request, reviewPatchSchema);
    if (!parsed.ok) return parsed.response;
    const { status, reviewNote, isHidden, featured } = parsed.data;

    const { id } = await params;
    const [report] = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
    if (!report) return notFound('Report not found');

    const patch: Partial<typeof reports.$inferInsert> = { updatedAt: new Date() };
    if (status) patch.status = status;
    if (reviewNote !== undefined) patch.reviewNote = reviewNote || null;
    if (isHidden !== undefined) patch.isHidden = isHidden;
    if (featured !== undefined) patch.featured = featured;
    if (status === 'resolved' && report.status !== 'resolved') patch.resolvedAt = new Date();
    if (status === 'accepted' && !report.aiSummary) {
      const aiSummary = await generateAiSummary(report.title, report.description || '');
      if (aiSummary) patch.aiSummary = aiSummary;
    }

    await db.update(reports).set(patch).where(eq(reports.id, id));

    if (status && status !== report.status) {
      await db.insert(reportStatusHistory).values({
        id: crypto.randomUUID(),
        reportId: id,
        fromStatus: report.status,
        toStatus: status,
        changedBy: user.id,
        note: reviewNote || null,
        createdAt: new Date(),
      });

      if (report.submitterId !== user.id) {
        await createNotification({
          recipientId: report.submitterId,
          actorId: user.id,
          type: 'status_change',
          reportId: id,
          metadata: { from: report.status, to: status },
        });
        runAfterResponse('status-email', async () => {
          const recipient = await emailRecipient(report.submitterId);
          if (!recipient) return;
          await sendStatusChangeNotification({
            to: recipient.email,
            reportTitle: report.title,
            reportId: id,
            newStatus: status,
            unsubscribeUrl: unsubscribeUrlFor(report.submitterId),
          });
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return serverError(error, 'review PATCH');
  }
}
