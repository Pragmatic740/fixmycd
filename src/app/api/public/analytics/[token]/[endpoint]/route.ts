import { NextResponse } from 'next/server';
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
} from '@/lib/analytics';
import { resolveShareToken } from '@/lib/analytics-share';
import type { AnalyticsFilters } from '@/lib/analytics-types';

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

    const { searchParams } = new URL(request.url);
    // Snapshot filters win; allow only presentation overrides
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
          const result = await getAnalyticsReports({ ...filters, limit: 5000, offset: 0 });
          const csv = reportsToCsv(result.rows);
          return new NextResponse(csv, {
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': `attachment; filename="shared-dashboard-${Date.now()}.csv"`,
            },
          });
        }
        return NextResponse.json({ data: await getAnalyticsReports(filters), meta });
      }
      case 'meta':
        return NextResponse.json({ data: { label: share.label, filters: share.filters }, meta });
      default:
        return NextResponse.json({ error: `Unknown endpoint: ${endpoint}` }, { status: 404 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Shared analytics failed';
    console.error('Public analytics error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
