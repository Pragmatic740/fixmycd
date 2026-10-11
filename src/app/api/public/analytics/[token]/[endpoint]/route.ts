import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import {
  getAnalyticsSummary,
  getBreakdowns,
  getTimeSeries,
  getScatter,
  getMapPoints,
  getMapAreas,
  getAnalyticsReports,
  reportsToCsv,
  sanitizeAnalyticsFilters,
  toPublicReportRows,
} from '@/lib/analytics';
import { serverError } from '@/lib/http';
import { resolveShareToken } from '@/lib/analytics-share';
import { hashUserAgent, isLikelyBot, visitorHash } from '@/lib/hashing';
import { getSessionUser } from '@/lib/auth';
import { clientIp } from '@/lib/http';
import type { AnalyticsFilters } from '@/lib/analytics-types';

const VIEW_DEDUPE_WINDOW = '1 hour';

/** Hostname the viewer came from, as reported by the page (?ref=), never our own domain. */
function externalReferrer(request: Request): string | null {
  const ref = new URL(request.url).searchParams.get('ref');
  if (!ref || ref.length > 253 || !/^[a-z0-9.-]+$/i.test(ref)) return null;
  const own = new URL(request.url).hostname;
  return ref.toLowerCase() === own.toLowerCase() ? null : ref.toLowerCase();
}

async function recordShareView(request: Request, share: { id: string; createdBy: string }): Promise<void> {
  try {
    const userAgent = request.headers.get('user-agent');
    if (isLikelyBot(userAgent)) return;

    // The admin who created the link opening it is not a "view".
    const viewer = await getSessionUser();
    if (viewer && viewer.id === share.createdBy) return;

    const visitor = visitorHash(clientIp(request), userAgent);
    // One statement: insert only if this visitor has not viewed the link in the last hour.
    await db.execute(sql`
      INSERT INTO share_view_events (id, token_id, viewed_at, referrer, user_agent_hash, visitor_hash)
      SELECT ${crypto.randomUUID()}, ${share.id}, now(), ${externalReferrer(request)}, ${hashUserAgent(userAgent)}, ${visitor}
      WHERE NOT EXISTS (
        SELECT 1 FROM share_view_events
        WHERE token_id = ${share.id} AND visitor_hash = ${visitor}
          AND viewed_at > now() - ${VIEW_DEDUPE_WINDOW}::interval
      )
    `);
  } catch (err) {
    console.error('View tracking failed:', err);
  }
}

/** Anonymous viewers can export at most this many rows per CSV. */
const PUBLIC_CSV_LIMIT = 1000;

/** Filters shown to anonymous viewers: never who reported what. */
function publicFilters(filters: AnalyticsFilters): Partial<AnalyticsFilters> {
  const { reporterId: _id, reporterName: _name, ...rest } = filters as AnalyticsFilters & {
    reporterId?: unknown;
    reporterName?: unknown;
  };
  return rest;
}

function optionalParamNumber(searchParams: URLSearchParams, key: string): number | undefined {
  const v = searchParams.get(key);
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string; endpoint: string }> }
) {
  try {
    const { token, endpoint } = await params;
    const share = await resolveShareToken(token);
    if (!share) {
      return NextResponse.json({ error: 'Share link invalid or expired' }, { status: 404 });
    }

    // Count a view once per visitor per hour (the dashboard loads 'summary' once).
    if (endpoint === 'summary') {
      await recordShareView(request, share);
    }

    const { searchParams } = new URL(request.url);
    const filters: AnalyticsFilters = sanitizeAnalyticsFilters({
      ...share.filters,
      groupBy: searchParams.get('groupBy') || share.filters.groupBy,
      bucket: (searchParams.get('bucket') as AnalyticsFilters['bucket']) || share.filters.bucket,
      mapLevel: searchParams.get('mapLevel') || share.filters.mapLevel,
      metric: searchParams.get('metric') || share.filters.metric,
      limit: optionalParamNumber(searchParams, 'limit') ?? share.filters.limit,
      offset: optionalParamNumber(searchParams, 'offset') ?? share.filters.offset,
    });

    const meta = {
      label: share.label,
      shared: true,
      generatedAt: new Date().toISOString(),
    };

    switch (endpoint) {
      case 'summary':
        return NextResponse.json({ data: await getAnalyticsSummary(filters), meta });
      case 'timeseries':
        return NextResponse.json({ data: await getTimeSeries(filters), meta });
      case 'breakdowns':
        return NextResponse.json({ data: await getBreakdowns(filters), meta });
      case 'scatter':
        return NextResponse.json({ data: await getScatter(filters), meta });
      case 'map':
        return NextResponse.json({
          data: {
            points: await getMapPoints(filters),
            areas: await getMapAreas(filters),
          },
          meta,
        });
      case 'reports': {
        if (searchParams.get('format') === 'csv') {
          const result = await getAnalyticsReports({ ...filters, limit: PUBLIC_CSV_LIMIT, offset: 0 });
          const csv = reportsToCsv(toPublicReportRows(result.rows));
          return new NextResponse(csv, {
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': `attachment; filename="shared-dashboard-${Date.now()}.csv"`,
            },
          });
        }
        const result = await getAnalyticsReports(filters);
        return NextResponse.json({ data: { ...result, rows: toPublicReportRows(result.rows) }, meta });
      }
      case 'meta':
        return NextResponse.json({ data: { label: share.label, filters: publicFilters(share.filters) }, meta });
      default:
        return NextResponse.json({ error: `Unknown endpoint: ${endpoint}` }, { status: 404 });
    }
  } catch (error: unknown) {
    return serverError(error, 'public analytics');
  }
}