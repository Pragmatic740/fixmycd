import { NextResponse } from 'next/server';
import { db } from '@/db';
import { shareViewEvents } from '@/db/schema';
import { eq, and, gt } from 'drizzle-orm';
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
import { hashUserAgent, extractReferrer } from '@/lib/hashing';
import type { AnalyticsFilters } from '@/lib/analytics-types';

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

    // ✅ W3-3: Log view (only for 'summary' endpoint to avoid double-counting)
    if (endpoint === 'summary' && share.id) {
      try {
        const userAgent = request.headers.get('user-agent');
        const referrer = request.headers.get('referer');
        const uaHash = hashUserAgent(userAgent);

        // Dedupe: skip if same UA viewed this token in last hour
        const DEDUPE_VIEW_WINDOW_IN_MS = 60 * 60 * 1000;
        const oneHourAgo = new Date(Date.now() - DEDUPE_VIEW_WINDOW_IN_MS);
        const recent = await db
          .select({ id: shareViewEvents.id })
          .from(shareViewEvents)
          .where(
            and(
              eq(shareViewEvents.tokenId, share.id),
              uaHash
                ? eq(shareViewEvents.userAgentHash, uaHash)
                : eq(shareViewEvents.userAgentHash, ''),
              gt(shareViewEvents.viewedAt, oneHourAgo)
            )
          )
          .limit(1);

        if (recent.length === 0) {
          await db.insert(shareViewEvents).values({
            id: crypto.randomUUID(),
            tokenId: share.id,
            referrer: extractReferrer(referrer),
            userAgentHash: uaHash,
            viewedAt: new Date(),
          });
        }
      } catch (err) {
        console.error('View tracking failed:', err);
      }
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