import { db } from '../db';
import { reports, users, upvotes, comments } from '../db/schema';
import { eq, desc, and, sql, ilike, or, gte, lte, lt, type SQL } from 'drizzle-orm';
import type { ReportFeedQuery } from './validation';

export type ReportQueryParams = Partial<ReportFeedQuery>;

const EARTH_RADIUS_KM = 6371;

/** Escape LIKE wildcards so a search for "50%" matches literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Inclusive end: a date-only endDate (YYYY-MM-DD) covers that whole day. */
export function endOfRange(endDate: string): { value: Date; inclusive: boolean } {
  if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    const d = new Date(`${endDate}T00:00:00Z`);
    return { value: new Date(d.getTime() + 86400000), inclusive: false };
  }
  return { value: new Date(endDate), inclusive: true };
}

/** Degree box around a point that contains the whole circle (used as an index-friendly pre-filter). */
export function radiusBoundingBox(lat: number, lng: number, km: number) {
  const latDelta = km / 111.32;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  // Near the poles every longitude is within reach.
  const lngDelta = cosLat < 0.01 ? 180 : Math.min(180, km / (111.32 * cosLat));
  return {
    south: Math.max(-90, lat - latDelta),
    north: Math.min(90, lat + latDelta),
    west: lng - lngDelta,
    east: lng + lngDelta,
  };
}

/** Longitude range condition that handles boxes crossing the antimeridian (west > east). */
function longitudeBetween(west: number, east: number): SQL {
  const w = ((((west + 180) % 360) + 360) % 360) - 180;
  const e = ((((east + 180) % 360) + 360) % 360) - 180;
  if (east - west >= 360) return sql`true`;
  if (w <= e) return and(gte(reports.longitude, w), lte(reports.longitude, e))!;
  return or(gte(reports.longitude, w), lte(reports.longitude, e))!;
}

export function buildReportConditions(params: ReportQueryParams): SQL[] {
  const conditions: SQL[] = [eq(reports.isHidden, false)];

  if (params.category) conditions.push(eq(reports.category, params.category));
  if (params.status) conditions.push(eq(reports.status, params.status));
  if (params.severity !== undefined) conditions.push(eq(reports.severity, params.severity));
  if (params.severityMin !== undefined) conditions.push(gte(reports.severity, params.severityMin));
  if (params.severityMax !== undefined) conditions.push(lte(reports.severity, params.severityMax));
  if (params.featured === 'true') conditions.push(eq(reports.featured, true));
  if (params.userId) conditions.push(eq(reports.submitterId, params.userId));
  if (params.endorsed === 'true') {
    conditions.push(sql`exists (select 1 from endorsements e where e.report_id = ${reports.id})`);
  }

  if (params.keyword) {
    const pattern = `%${escapeLike(params.keyword)}%`;
    conditions.push(or(ilike(reports.title, pattern), ilike(reports.description, pattern))!);
  }

  if (params.startDate) conditions.push(gte(reports.createdAt, new Date(params.startDate)));
  if (params.endDate) {
    const end = endOfRange(params.endDate);
    conditions.push(end.inclusive ? lte(reports.createdAt, end.value) : lt(reports.createdAt, end.value));
  }

  if (params.west !== undefined && params.east !== undefined && params.south !== undefined && params.north !== undefined) {
    conditions.push(gte(reports.latitude, params.south), lte(reports.latitude, params.north));
    conditions.push(longitudeBetween(params.west, params.east));
  }

  if (params.radiusLat !== undefined && params.radiusLng !== undefined && params.radiusKm !== undefined) {
    const { radiusLat: lat, radiusLng: lng, radiusKm: km } = params;
    const box = radiusBoundingBox(lat, lng, km);
    conditions.push(gte(reports.latitude, box.south), lte(reports.latitude, box.north));
    conditions.push(longitudeBetween(box.west, box.east));
    // Exact great-circle distance (haversine) so corners of the box are excluded.
    conditions.push(sql`
      2 * ${EARTH_RADIUS_KM} * asin(sqrt(
        power(sin(radians(${reports.latitude} - ${lat}) / 2), 2) +
        cos(radians(${lat})) * cos(radians(${reports.latitude})) *
        power(sin(radians(${reports.longitude} - ${lng}) / 2), 2)
      )) <= ${km}
    `);
  }

  return conditions;
}

export async function fetchReportsWithCounts(
  sessionUserId: string | null,
  params: ReportQueryParams = {}
) {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const offset = Math.max(params.offset ?? 0, 0);

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
      upvoteCount: sql<number>`cast(count(distinct ${upvotes.id}) as int)`,
      commentCount: sql<number>`cast(count(distinct ${comments.id}) as int)`,
      endorsementCount: sql<number>`(select cast(count(*) as int) from endorsements e where e.report_id = ${reports.id})`,
      endorsementAverage: sql<number | null>`(select round(avg(e.severity_level)::numeric, 1)::float from endorsements e where e.report_id = ${reports.id})`,
    })
    .from(reports)
    .leftJoin(users, eq(reports.submitterId, users.id))
    .leftJoin(upvotes, eq(upvotes.reportId, reports.id))
    .leftJoin(comments, and(eq(comments.reportId, reports.id), eq(comments.isHidden, false)))
    .where(and(...buildReportConditions(params)))
    .groupBy(reports.id, users.displayName)
    .orderBy(desc(reports.createdAt), desc(reports.id))
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
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

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
    .where(and(eq(reports.isHidden, false), gte(reports.createdAt, sevenDaysAgo)))
    .groupBy(reports.id)
    .orderBy(desc(sql`count(distinct ${upvotes.id}) + count(distinct ${comments.id})`))
    .limit(limit);

  return rows;
}