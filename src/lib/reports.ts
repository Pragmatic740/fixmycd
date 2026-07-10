import { db } from '../db';
import { reports, users, upvotes, comments } from '../db/schema';
import { eq, desc, and, sql, ilike, or } from 'drizzle-orm';

export interface ReportQueryParams {
  category?: string;
  status?: string;
  severity?: string;
  keyword?: string;
  featured?: string;
  limit?: string;
  offset?: string;
  userId?: string;
}

export async function fetchReportsWithCounts(sessionUserId: string | null, params: ReportQueryParams = {}) {
  const limit = Math.min(parseInt(params.limit || '50', 10), 100);
  const offset = parseInt(params.offset || '0', 10);

  const conditions = [eq(reports.isHidden, false)];

  if (params.category) conditions.push(eq(reports.category, params.category));
  if (params.status) conditions.push(eq(reports.status, params.status));
  if (params.severity) conditions.push(eq(reports.severity, parseInt(params.severity, 10)));
  if (params.featured === 'true') conditions.push(eq(reports.featured, true));
  if (params.userId) conditions.push(eq(reports.submitterId, params.userId));
  if (params.keyword) {
    const pattern = `%${params.keyword}%`;
    conditions.push(or(ilike(reports.title, pattern), ilike(reports.description, pattern))!);
  }

  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

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
      aiSummary: reports.aiSummary,
      featured: reports.featured,
      createdAt: reports.createdAt,
      submitterId: reports.submitterId,
      userDisplayName: users.displayName,
      userEmail: users.email,
      upvoteCount: sql<number>`cast(count(distinct ${upvotes.id}) as int)`,
      commentCount: sql<number>`cast(count(distinct ${comments.id}) as int)`,
    })
    .from(reports)
    .leftJoin(users, eq(reports.submitterId, users.id))
    .leftJoin(upvotes, eq(upvotes.reportId, reports.id))
    .leftJoin(comments, and(eq(comments.reportId, reports.id), eq(comments.isHidden, false)))
    .where(whereClause)
    .groupBy(reports.id, users.displayName, users.email)
    .orderBy(desc(reports.createdAt))
    .limit(limit)
    .offset(offset);

  let userUpvotes = new Set<string>();
  if (sessionUserId && rows.length > 0) {
    const upvoteRows = await db
      .select({ reportId: upvotes.reportId })
      .from(upvotes)
      .where(eq(upvotes.userId, sessionUserId));
    userUpvotes = new Set(upvoteRows.map((r) => r.reportId));
  }

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    userHasUpvoted: userUpvotes.has(row.id),
  }));
}

export async function fetchTrendingReports(limit = 5) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const rows = await db
    .select({
      id: reports.id,
      title: reports.title,
      category: reports.category,
      upvoteCount: sql<number>`cast(count(distinct ${upvotes.id}) as int)`,
      commentCount: sql<number>`cast(count(distinct ${comments.id}) as int)`,
    })
    .from(reports)
    .leftJoin(upvotes, eq(upvotes.reportId, reports.id))
    .leftJoin(comments, and(eq(comments.reportId, reports.id), eq(comments.isHidden, false)))
    .where(and(eq(reports.isHidden, false), sql`${reports.createdAt} >= ${sevenDaysAgo}`))
    .groupBy(reports.id)
    .orderBy(desc(sql`count(distinct ${upvotes.id}) + count(distinct ${comments.id})`))
    .limit(limit);

  return rows;
}
