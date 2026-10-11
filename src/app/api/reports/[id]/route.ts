import { NextResponse } from 'next/server';
import { db } from '../../../../db';
import { reports, users, upvotes, comments } from '../../../../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getSessionUser } from '../../../../lib/auth';
import { notFound, serverError } from '../../../../lib/http';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionUser = await getSessionUser();

    const rows = await db
      .select({
        id: reports.id,
        referenceNo: reports.referenceNo,
        title: reports.title,
        description: reports.description,
        latitude: reports.latitude,
        longitude: reports.longitude,
        severity: reports.severity,
        status: reports.status,
        category: reports.category,
        subcategory: reports.subcategory,
        postAction: reports.postAction,
        postType: reports.postType,
        parentReportId: reports.parentReportId,
        imageUrl: reports.imageUrl,
        videoUrl: reports.videoUrl,
        audioUrl: reports.audioUrl,
        compassDirection: reports.compassDirection,
        aiSummary: reports.aiSummary,
        reviewNote: reports.reviewNote,
        featured: reports.featured,
        createdAt: reports.createdAt,
        submitterId: reports.submitterId,
        userDisplayName: users.displayName,
        upvoteCount: sql<number>`cast(count(distinct ${upvotes.id}) as int)`,
        commentCount: sql<number>`cast(count(distinct ${comments.id}) as int)`,
      })
      .from(reports)
      .leftJoin(users, eq(reports.submitterId, users.id))
      .leftJoin(upvotes, eq(upvotes.reportId, reports.id))
      // Count only comments the comments endpoint actually shows.
      .leftJoin(
        comments,
        and(
          eq(comments.reportId, reports.id),
          eq(comments.isHidden, false),
          sql`exists (select 1 from ${users} cu where cu.id = ${comments.userId} and cu.disabled_at is null)`
        )
      )
      .where(and(eq(reports.id, id), eq(reports.isHidden, false)))
      .groupBy(reports.id, users.displayName)
      .limit(1);

    const report = rows[0];
    if (!report) return notFound('Report not found');

    let userHasUpvoted = false;
    if (sessionUser) {
      const uv = await db
        .select({ id: upvotes.id })
        .from(upvotes)
        .where(and(eq(upvotes.userId, sessionUser.id), eq(upvotes.reportId, id)))
        .limit(1);
      userHasUpvoted = uv.length > 0;
    }

    return NextResponse.json({
      ...report,
      createdAt: report.createdAt.toISOString(),
      userHasUpvoted,
    });
  } catch (error: unknown) {
    return serverError(error, 'reports/[id] GET');
  }
}
