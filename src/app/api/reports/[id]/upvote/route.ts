import { NextResponse } from 'next/server';
import { db } from '../../../../../db';
import { upvotes, notifications, reports } from '../../../../../db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { getSessionUser } from '../../../../../lib/auth';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: reportId } = await params;

    const reportRows = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
    const report = reportRows[0];
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const existing = await db
      .select()
      .from(upvotes)
      .where(and(eq(upvotes.userId, sessionUser.id), eq(upvotes.reportId, reportId)))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ upvoted: true, message: 'Already upvoted' });
    }

    await db.insert(upvotes).values({
      id: crypto.randomUUID(),
      userId: sessionUser.id,
      reportId,
      createdAt: new Date(),
    });

    if (report.submitterId !== sessionUser.id) {
      await db.insert(notifications).values({
        id: crypto.randomUUID(),
        userId: report.submitterId,
        type: 'upvote',
        actorId: sessionUser.id,
        reportId,
        read: false,
        createdAt: new Date(),
      });
    }

    return NextResponse.json({ upvoted: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to upvote';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: reportId } = await params;

    await db
      .delete(upvotes)
      .where(and(eq(upvotes.userId, sessionUser.id), eq(upvotes.reportId, reportId)));

    return NextResponse.json({ upvoted: false });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to remove upvote';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
