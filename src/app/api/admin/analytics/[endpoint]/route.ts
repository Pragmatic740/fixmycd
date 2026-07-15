import { NextResponse } from 'next/server';
import { isAuthError, requireAdmin } from '@/lib/auth';
import {
  parseAnalyticsFilters,
  getAnalyticsSummary,
  getBreakdowns,
  getTimeSeries,
  getScatter,
  getMapPoints,
  getMapAreas,
  getAnalyticsReports,
  getReporterStats,
  getDataQuality,
  reportsToCsv,
} from '@/lib/analytics';
import { fetchTigerBoundaries, mapLevelToTigerLayer } from '@/lib/geo/tigerweb';
import { withCache } from '@/lib/analytics-cache';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ endpoint: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (isAuthError(admin)) return admin;

    const { endpoint } = await params;
    const { searchParams } = new URL(request.url);
    const filters = parseAnalyticsFilters(searchParams);
    const generatedAt = new Date().toISOString();
    const units = {
      cost: 'USD',
      distance: 'km',
      age: 'days',
      rate: 'ratio_0_1',
    };
    const cacheKey = `analytics:${endpoint}:${searchParams.toString()}`;

    switch (endpoint) {
      case 'summary':
        return NextResponse.json({
          data: await withCache(cacheKey, () => getAnalyticsSummary(filters)),
          meta: { filters, generatedAt, units, cached: true },
        });
      case 'timeseries':
        return NextResponse.json({
          data: await withCache(cacheKey, () => getTimeSeries(filters)),
          meta: { filters, generatedAt, units, cached: true },
        });
      case 'breakdowns':
        return NextResponse.json({
          data: await withCache(cacheKey, () => getBreakdowns(filters)),
          meta: { filters, generatedAt, units, cached: true },
        });
      case 'scatter':
        return NextResponse.json({
          data: await withCache(cacheKey, () => getScatter(filters)),
          meta: { filters, generatedAt, units, cached: true },
        });
      case 'map': {
        const data = await withCache(cacheKey, async () => ({
          points: await getMapPoints(filters),
          areas: await getMapAreas(filters),
        }));
        return NextResponse.json({
          data,
          meta: { filters, generatedAt, units, cached: true },
        });
      }
      case 'boundaries': {
        const layer = mapLevelToTigerLayer(filters.mapLevel);
        const west = filters.bbox?.west ?? Number(searchParams.get('west'));
        const south = filters.bbox?.south ?? Number(searchParams.get('south'));
        const east = filters.bbox?.east ?? Number(searchParams.get('east'));
        const north = filters.bbox?.north ?? Number(searchParams.get('north'));
        const bbox =
          [west, south, east, north].every((n) => Number.isFinite(n))
            ? { west, south, east, north }
            : undefined;
        const boundaries = await withCache(
          cacheKey,
          () => fetchTigerBoundaries(layer, bbox),
          5 * 60_000
        );
        return NextResponse.json({
          data: boundaries,
          meta: { filters, generatedAt, units, cached: true },
        });
      }
      case 'reports': {
        if (searchParams.get('format') === 'csv') {
          const result = await getAnalyticsReports({ ...filters, limit: 5000, offset: 0 });
          const csv = reportsToCsv(result.rows);
          return new NextResponse(csv, {
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': `attachment; filename="fixmydistrict-reports-${Date.now()}.csv"`,
            },
          });
        }
        return NextResponse.json({
          data: await getAnalyticsReports(filters),
          meta: { filters, generatedAt, units },
        });
      }
      case 'users':
        return NextResponse.json({
          data: await withCache(cacheKey, () => getReporterStats(filters)),
          meta: { filters, generatedAt, units, cached: true },
        });
      case 'quality':
        return NextResponse.json({
          data: await withCache(cacheKey, () => getDataQuality(filters)),
          meta: { filters, generatedAt, units, cached: true },
        });
      default:
        return NextResponse.json({ error: `Unknown analytics endpoint: ${endpoint}` }, { status: 404 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Analytics query failed';
    console.error('Analytics error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
