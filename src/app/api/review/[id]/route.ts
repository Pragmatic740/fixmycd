import { NextResponse } from 'next/server';
import { db } from '../../../../db';
import { reports, reportStatusHistory } from '../../../../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { requireModerator, isAuthError } from '../../../../lib/auth';
import { REPORT_STATUSES } from '../../../../lib/categories';

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
    const sessionUser = await requireModerator();
    if (isAuthError(sessionUser)) return sessionUser;

    const { id } = await params;
    const { status, reviewNote, isHidden, featured } = await request.json();

    if (status && !REPORT_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const reportRows = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
    const report = reportRows[0];
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    let aiSummary = report.aiSummary;
    if (status === 'accepted' && !aiSummary) {
      aiSummary = await generateAiSummary(report.title, report.description || '');
    }

    const nextStatus = status ?? report.status;
    const updated = await db
      .update(reports)
      .set({
        status: nextStatus,
        reviewNote: reviewNote ?? report.reviewNote,
        isHidden: isHidden ?? report.isHidden,
        featured: featured ?? report.featured,
        aiSummary,
        resolvedAt: nextStatus === 'resolved' ? new Date() : report.resolvedAt,
        updatedAt: new Date(),
      })
      .where(eq(reports.id, id))
      .returning();

    if (status && status !== report.status) {
      await db.insert(reportStatusHistory).values({
        id: crypto.randomUUID(),
        reportId: id,
        fromStatus: report.status,
        toStatus: status,
        changedBy: sessionUser.id,
        note: reviewNote || null,
        createdAt: new Date(),
      });
    }

    return NextResponse.json(updated[0]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
