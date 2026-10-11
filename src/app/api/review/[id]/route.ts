import { NextResponse } from 'next/server';
import { db } from '@/db';
import { reports, users, reportStatusHistory, notifications } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { isAuthError, requireModerator } from '@/lib/auth';
import { sendStatusChangeNotification } from '@/lib/email';
import { REPORT_STATUSES } from '@/lib/categories';

async function generateAiSummary(title: string, description: string): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `Write a one-line civic infrastructure report summary (max 120 chars) for: "${title}" — ${description}`,
          },
        ],
        max_tokens: 60,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userCheck = await requireModerator();
    if (isAuthError(userCheck)) return userCheck;
    const user = userCheck;

    const { id } = await params;
    const body = await request.json();
    const { status, reviewNote, isHidden, featured } = body;

    if (status && !REPORT_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const reportRows = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
    const report = reportRows[0];
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const patch: Record<string, unknown> = {};
    if (status) patch.status = status;
    if (reviewNote !== undefined) patch.reviewNote = reviewNote;
    if (isHidden !== undefined) patch.isHidden = isHidden;
    if (featured !== undefined) patch.featured = featured;
    if (status === 'resolved' && report.status !== 'resolved') patch.resolvedAt = new Date();
    if (status === 'accepted' && !report.aiSummary) {
      const aiSummary = await generateAiSummary(report.title, report.description || '');
      if (aiSummary) patch.aiSummary = aiSummary;
    }
    patch.updatedAt = new Date();

    await db.update(reports).set(patch).where(eq(reports.id, id));

    if (status && status !== report.status) {
      // Log status change
      await db.insert(reportStatusHistory).values({
        id: crypto.randomUUID(),
        reportId: id,
        fromStatus: report.status,
        toStatus: status,
        changedBy: user.id,
        note: reviewNote || null,
        createdAt: new Date(),
      });

      // ✅ NEW: In-app notification
      try {
        await db.insert(notifications).values({
          id: crypto.randomUUID(),
          userId: report.submitterId,
          type: 'status_change',
          actorId: user.id,
          reportId: id,
          read: false,
          createdAt: new Date(),
        });
      } catch (notifError) {
        console.error('Failed to create notification:', notifError);
      }

      // Email notification
      try {
        const submitter = await db
          .select()
          .from(users)
          .where(eq(users.id, report.submitterId))
          .limit(1);

        if (submitter[0]?.email && submitter[0]?.emailNotifications !== false) {
          await sendStatusChangeNotification({
            to: submitter[0].email,
            reportTitle: report.title,
            reportId: id,
            newStatus: status,
          });
        }
      } catch (emailError) {
        console.error('Failed to send status email:', emailError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}