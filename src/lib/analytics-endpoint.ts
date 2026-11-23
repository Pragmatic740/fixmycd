import { NextResponse } from 'next/server';
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
  toPublicReportRows,
} from '@/lib/analytics';
import type { AnalyticsFilters } from '@/lib/analytics-types';
import { fetchTigerBoundaries, mapLevelToTigerLayer } from '@/lib/geo/tigerweb';
import { withCache } from '@/lib/analytics-cache';

/** Endpoints only admins may call: they are about individual reporters. */
export const ADMIN_ONLY_ANALYTICS_ENDPOINTS: ReadonlySet<string> = new Set(['users', 'quality']);

/** Breakdowns that group by person are admin-only too. */
const ADMIN_ONLY_GROUP_BY: ReadonlySet<string> = new Set(['reporter']);

/** Most rows a non-admin can export in one CSV. */
export const MEMBER_CSV_LIMIT = 1000;

export type AnalyticsViewer = { isAdmin: boolean };

/**
 * Filters a non-admin may use. Filtering by reporter would reveal which posts belong
 * to which person, so it is removed; everything else (place, type, dates…) stays.
 */
export function memberAnalyticsFilters(filters: AnalyticsFilters): AnalyticsFilters {
  const { reporterId: _id, reporterName: _name, ...rest } = filters;
  if (rest.groupBy && ADMIN_ONLY_GROUP_BY.has(rest.groupBy)) delete rest.groupBy;
  return rest;
}

/**
 * Analytics API shared by `/api/analytics/*` (every signed-in user) and
 * `/api/admin/analytics/*` (admins). Non-admins get the same charts, map and
 * report list as admins, but never reporter ids, emails, roles or account flags,
 * and cannot filter or group by reporter.
 */
export async function analyticsEndpointResponse(
  request: Request,
  endpoint: string,
  viewer: AnalyticsViewer,
): Promise<NextResponse> {
  if (!viewer.isAdmin && ADMIN_ONLY_ANALYTICS_ENDPOINTS.has(endpoint)) {
    return NextResponse.json({ error: 'Only admins can see reporter details' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = parseAnalyticsFilters(searchParams);
  const filters = viewer.isAdmin ? parsed : memberAnalyticsFilters(parsed);
  const generatedAt = new Date().toISOString();
  const units = { cost: 'USD', distance: 'km', age: 'days', rate: 'ratio_0_1' };
  // Members and admins can see different data for the same query string.
  const cacheKey = `analytics:${viewer.isAdmin ? 'admin' : 'member'}:${endpoint}:${searchParams.toString()}`;
  const cachedMeta = { filters, generatedAt, units, cached: true };

  switch (endpoint) {
    case 'summary':
      return NextResponse.json({ data: await withCache(cacheKey, () => getAnalyticsSummary(filters)), meta: cachedMeta });
    case 'timeseries':
      return NextResponse.json({ data: await withCache(cacheKey, () => getTimeSeries(filters)), meta: cachedMeta });
    case 'breakdowns':
      return NextResponse.json({ data: await withCache(cacheKey, () => getBreakdowns(filters)), meta: cachedMeta });
    case 'scatter':
      return NextResponse.json({ data: await withCache(cacheKey, () => getScatter(filters)), meta: cachedMeta });
    case 'map': {
      const data = await withCache(cacheKey, async () => ({
        points: await getMapPoints(filters),
        areas: await getMapAreas(filters),
      }));
      return NextResponse.json({ data, meta: cachedMeta });
    }
    case 'boundaries': {
      const layer = mapLevelToTigerLayer(filters.mapLevel);
      const west = filters.bbox?.west ?? Number(searchParams.get('west'));
      const south = filters.bbox?.south ?? Number(searchParams.get('south'));
      const east = filters.bbox?.east ?? Number(searchParams.get('east'));
      const north = filters.bbox?.north ?? Number(searchParams.get('north'));
      const bbox = [west, south, east, north].every((n) => Number.isFinite(n)) ? { west, south, east, north } : undefined;
      const boundaries = await withCache(cacheKey, () => fetchTigerBoundaries(layer, bbox), 5 * 60_000);
      return NextResponse.json({ data: boundaries, meta: cachedMeta });
    }
    case 'reports': {
      if (searchParams.get('format') === 'csv') {
        const limit = viewer.isAdmin ? 5000 : MEMBER_CSV_LIMIT;
        const result = await getAnalyticsReports({ ...filters, limit, offset: 0 });
        const rows = viewer.isAdmin ? result.rows : toPublicReportRows(result.rows);
        return new NextResponse(reportsToCsv(rows), {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="fixmydistrict-reports-${Date.now()}.csv"`,
          },
        });
      }
      const result = await getAnalyticsReports(filters);
      const data = viewer.isAdmin ? result : { ...result, rows: toPublicReportRows(result.rows) };
      return NextResponse.json({ data, meta: { filters, generatedAt, units } });
    }
    case 'users':
      return NextResponse.json({ data: await withCache(cacheKey, () => getReporterStats(filters)), meta: cachedMeta });
    case 'quality':
      return NextResponse.json({ data: await withCache(cacheKey, () => getDataQuality(filters)), meta: cachedMeta });
    default:
      return NextResponse.json({ error: `Unknown analytics endpoint: ${endpoint}` }, { status: 404 });
  }
}
