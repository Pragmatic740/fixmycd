import { NextResponse } from 'next/server';
import { db } from '../../../../../db';
import { comments, users, notifications, reports } from '../../../../../db/schema';
import { eq, desc } from 'drizzle-orm';
import crypto from 'crypto';
import { getSessionUser } from '../../../../../lib/auth';
import { containsBlockedContent } from '../../../../../lib/content-filter';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;

    const rows = await db
      .select({
        id: comments.id,
        body: comments.body,
        createdAt: comments.createdAt,
        userId: comments.userId,
        userDisplayName: users.displayName,
        userEmail: users.email,
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.reportId, reportId))
      .orderBy(desc(comments.createdAt));

    return NextResponse.json(
      rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch comments';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: reportId } = await params;
    const { body } = await request.json();

    if (!body?.trim()) {
      return NextResponse.json({ error: 'Comment body is required' }, { status: 400 });
    }

    const blocked = containsBlockedContent(body);
    if (blocked) {
      return NextResponse.json({ error: blocked }, { status: 400 });
    }

    const reportRows = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
    const report = reportRows[0];
    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const commentId = crypto.randomUUID();
    const newComment = await db.insert(comments).values({
      id: commentId,
      reportId,
      userId: sessionUser.id,
      body: body.trim(),
      createdAt: new Date(),
    }).returning();

    if (report.submitterId !== sessionUser.id) {
      await db.insert(notifications).values({
        id: crypto.randomUUID(),
        userId: report.submitterId,
        type: 'comment',
        actorId: sessionUser.id,
        reportId,
        read: false,
        createdAt: new Date(),
      });
    }

    return NextResponse.json(newComment[0], { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to post comment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
