import { db } from '../db';
import {
  reports,
  users,
  reportLocations,
  flags,
  upvotes,
  comments,
} from '../db/schema';
import { and, eq, gte, lte, sql, ilike, or, inArray } from 'drizzle-orm';
import type { AnalyticsFilters, AnalyticsSummary, BreakdownItem, TimeSeriesPoint, ScatterPoint, MapPoint, MapAreaAggregate, ReporterStats, DataQualityIssue } from './analytics-types';
import type { DatePreset } from './categories';

const OPEN_STATUSES = ['submitted', 'in_review', 'accepted', 'resubmit', 'duplicate', 'in_progress'];

/** Normalize "Florida" / "fl" / "FL" → "FL" for US state filters */
const US_STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO',
  montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND',
  ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
  vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI',
  wyoming: 'WY', 'district of columbia': 'DC', 'washington dc': 'DC', 'washington d.c.': 'DC',
};

export function normalizeStateFilter(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const lower = trimmed.toLowerCase();
  if (US_STATE_NAME_TO_ABBR[lower]) return US_STATE_NAME_TO_ABBR[lower];
  if (/^[a-z]{2}$/i.test(trimmed)) return trimmed.toUpperCase();
  return trimmed;
}

function toFiniteNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toOptionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s === '' ? undefined : s;
}

/**
 * Normalize raw filter objects (saved views, share tokens, UI payloads)
 * so empty strings never reach Postgres numeric comparisons.
 */
export function sanitizeAnalyticsFilters(raw: unknown): AnalyticsFilters {
  if (!raw || typeof raw !== 'object') return {};
  const src = raw as Record<string, unknown>;

  const num = (key: string) => toFiniteNumber(src[key]);
  const str = (key: string) => toOptionalString(src[key]);
  const bool = (key: string) => {
    const v = src[key];
    if (v === true || v === 'true') return true;
    if (v === false || v === 'false') return false;
    return undefined;
  };

  let west = num('west');
  let south = num('south');
  let east = num('east');
  let north = num('north');

  const bboxRaw = src.bbox;
  if (bboxRaw && typeof bboxRaw === 'object') {
    const b = bboxRaw as Record<string, unknown>;
    west = west ?? toFiniteNumber(b.west);
    south = south ?? toFiniteNumber(b.south);
    east = east ?? toFiniteNumber(b.east);
    north = north ?? toFiniteNumber(b.north);
  }

  const filters: AnalyticsFilters = {
    reporterId: str('reporterId'),
    reporterName: str('reporterName'),
    countryCode: str('countryCode'),
    censusRegion: str('censusRegion'),
    censusDivision: str('censusDivision'),
    state: str('state'),
    county: str('county'),
    city: str('city'),
    postalCode: str('postalCode'),
    tractGeoid: str('tractGeoid'),
    congressionalDistrict: str('congressionalDistrict'),
    stateSenateDistrict: str('stateSenateDistrict'),
    stateHouseDistrict: str('stateHouseDistrict'),
    schoolDistrict: str('schoolDistrict'),
    serviceAreaId: str('serviceAreaId'),
    metroArea: str('metroArea'),
    radiusLat: num('radiusLat'),
    radiusLng: num('radiusLng'),
    radiusKm: num('radiusKm'),
    bbox:
      west != null && south != null && east != null && north != null
        ? { west, south, east, north }
        : undefined,
    datePreset: (str('datePreset') as DatePreset) || undefined,
    startDate: str('startDate'),
    endDate: str('endDate'),
    infrastructureClass: str('infrastructureClass') || str('category'),
    infrastructureType: str('infrastructureType') || str('subcategory'),
    failureType: str('failureType'),
    postAction: str('postAction'),
    status: str('status'),
    severityMin: num('severityMin') ?? num('severity'),
    severityMax: num('severityMax') ?? num('severity'),
    estimatedCostMin: num('estimatedCostMin'),
    estimatedCostMax: num('estimatedCostMax'),
    actualCostMin: num('actualCostMin'),
    actualCostMax: num('actualCostMax'),
    peopleAffectedMin: num('peopleAffectedMin'),
    evidenceType: str('evidenceType'),
    keyword: str('keyword'),
    datasetKey: str('datasetKey'),
    isSynthetic: bool('isSynthetic'),
    limit: num('limit'),
    offset: num('offset'),
    sortBy: str('sortBy'),
    sortDir: (str('sortDir') as 'asc' | 'desc') || undefined,
    groupBy: str('groupBy'),
    bucket: (str('bucket') as AnalyticsFilters['bucket']) || undefined,
    mapLevel: str('mapLevel'),
    metric: str('metric'),
  };

  // Drop undefined keys for cleaner persisted JSON
  for (const key of Object.keys(filters) as (keyof AnalyticsFilters)[]) {
    if (filters[key] === undefined) delete filters[key];
  }
  return filters;
}

/** Compact filter object for saving/sharing (no empty strings on numeric fields). */
export function filtersForPersist(raw: unknown): AnalyticsFilters {
  return sanitizeAnalyticsFilters(raw);
}

export function parseAnalyticsFilters(searchParams: URLSearchParams): AnalyticsFilters {
  const num = (key: string) => {
    const v = searchParams.get(key);
    if (v == null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const str = (key: string) => searchParams.get(key) || undefined;
  const bool = (key: string) => {
    const v = searchParams.get(key);
    if (v === 'true') return true;
    if (v === 'false') return false;
    return undefined;
  };

  const west = num('west');
  const south = num('south');
  const east = num('east');
  const north = num('north');

  return {
    reporterId: str('reporterId'),
    reporterName: str('reporterName'),
    countryCode: str('countryCode'),
    censusRegion: str('censusRegion'),
    censusDivision: str('censusDivision'),
    state: str('state'),
    county: str('county'),
    city: str('city'),
    postalCode: str('postalCode'),
    tractGeoid: str('tractGeoid'),
    congressionalDistrict: str('congressionalDistrict'),
    stateSenateDistrict: str('stateSenateDistrict'),
    stateHouseDistrict: str('stateHouseDistrict'),
    schoolDistrict: str('schoolDistrict'),
    serviceAreaId: str('serviceAreaId'),
    metroArea: str('metroArea'),
    radiusLat: num('radiusLat'),
    radiusLng: num('radiusLng'),
    radiusKm: num('radiusKm'),
    bbox:
      west != null && south != null && east != null && north != null
        ? { west, south, east, north }
        : undefined,
    datePreset: (str('datePreset') as DatePreset) || undefined,
    startDate: str('startDate'),
    endDate: str('endDate'),
    infrastructureClass: str('infrastructureClass') || str('category'),
    infrastructureType: str('infrastructureType') || str('subcategory'),
    failureType: str('failureType'),
    postAction: str('postAction'),
    status: str('status'),
    severityMin: num('severityMin') ?? num('severity'),
    severityMax: num('severityMax') ?? num('severity'),
    estimatedCostMin: num('estimatedCostMin'),
    estimatedCostMax: num('estimatedCostMax'),
    actualCostMin: num('actualCostMin'),
    actualCostMax: num('actualCostMax'),
    peopleAffectedMin: num('peopleAffectedMin'),
    evidenceType: str('evidenceType'),
    keyword: str('keyword'),
    datasetKey: str('datasetKey'),
    isSynthetic: bool('isSynthetic'),
    limit: num('limit'),
    offset: num('offset'),
    sortBy: str('sortBy'),
    sortDir: (str('sortDir') as 'asc' | 'desc') || undefined,
    groupBy: str('groupBy'),
    bucket: (str('bucket') as AnalyticsFilters['bucket']) || undefined,
    mapLevel: str('mapLevel'),
    metric: str('metric'),
  };
}

export function resolveDateRange(filters: AnalyticsFilters): { start?: Date; end?: Date } {
  const end = filters.endDate ? new Date(filters.endDate) : new Date();
  if (filters.startDate && (!filters.datePreset || filters.datePreset === 'custom')) {
    return { start: new Date(filters.startDate), end };
  }

  const start = new Date(end);
  switch (filters.datePreset) {
    case 'day':
      start.setDate(start.getDate() - 1);
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'quarter':
      start.setMonth(start.getMonth() - 3);
      break;
    case 'ytd':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      return {
        start: filters.startDate ? new Date(filters.startDate) : undefined,
        end: filters.endDate ? end : undefined,
      };
  }
  return { start, end };
}

/** Approximate km→degree conversion for bbox prefilter */
function radiusToBBox(lat: number, lng: number, radiusKm: number) {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1);
  return {
    west: lng - lngDelta,
    south: lat - latDelta,
    east: lng + lngDelta,
    north: lat + latDelta,
  };
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildConditions(filters: AnalyticsFilters) {
  const conditions = [eq(reports.isHidden, false)];
  const { start, end } = resolveDateRange(filters);

  if (filters.reporterId) conditions.push(eq(reports.submitterId, filters.reporterId));
  if (filters.status) conditions.push(eq(reports.status, filters.status));
  if (filters.postAction) conditions.push(eq(reports.postAction, filters.postAction));
  if (filters.failureType) conditions.push(eq(reports.failureType, filters.failureType));
  if (filters.infrastructureClass) {
    conditions.push(
      or(
        eq(reports.infrastructureClass, filters.infrastructureClass),
        eq(reports.category, filters.infrastructureClass)
      )!
    );
  }
  if (filters.infrastructureType) {
    conditions.push(
      or(
        eq(reports.infrastructureType, filters.infrastructureType),
        eq(reports.subcategory, filters.infrastructureType)
      )!
    );
  }
  if (filters.severityMin != null) conditions.push(gte(reports.severity, filters.severityMin));
  if (filters.severityMax != null) conditions.push(lte(reports.severity, filters.severityMax));
  if (filters.estimatedCostMin != null) conditions.push(gte(reports.estimatedCostHigh, filters.estimatedCostMin));
  if (filters.estimatedCostMax != null) conditions.push(lte(reports.estimatedCostLow, filters.estimatedCostMax));
  if (filters.actualCostMin != null) conditions.push(gte(reports.actualCost, filters.actualCostMin));
  if (filters.actualCostMax != null) conditions.push(lte(reports.actualCost, filters.actualCostMax));
  if (filters.peopleAffectedMin != null) conditions.push(gte(reports.peopleAffected, filters.peopleAffectedMin));
  if (filters.evidenceType) conditions.push(eq(reports.evidenceType, filters.evidenceType));
  if (filters.datasetKey) conditions.push(eq(reports.datasetKey, filters.datasetKey));
  if (filters.isSynthetic != null) conditions.push(eq(reports.isSynthetic, filters.isSynthetic));
  if (filters.keyword) {
    const pattern = `%${filters.keyword}%`;
    conditions.push(or(ilike(reports.title, pattern), ilike(reports.description, pattern))!);
  }

  const dateCol = sql`COALESCE(${reports.occurredAt}, ${reports.createdAt})`;
  if (start) conditions.push(sql`${dateCol} >= ${start.toISOString()}`);
  if (end) conditions.push(sql`${dateCol} <= ${end.toISOString()}`);

  let bbox = filters.bbox;
  if (filters.radiusLat != null && filters.radiusLng != null && filters.radiusKm != null) {
    bbox = radiusToBBox(filters.radiusLat, filters.radiusLng, filters.radiusKm);
  }
  if (bbox) {
    conditions.push(gte(reports.longitude, bbox.west));
    conditions.push(lte(reports.longitude, bbox.east));
    conditions.push(gte(reports.latitude, bbox.south));
    conditions.push(lte(reports.latitude, bbox.north));
  }

  // Location filters via join (case-insensitive where users type free text)
  if (filters.countryCode) {
    conditions.push(sql`LOWER(${reportLocations.countryCode}) = LOWER(${filters.countryCode})`);
  }
  if (filters.state) {
    const state = normalizeStateFilter(filters.state);
    conditions.push(sql`LOWER(${reportLocations.stateProvince}) = LOWER(${state})`);
  }
  if (filters.county) {
    conditions.push(ilike(reportLocations.county, `%${filters.county.trim()}%`));
  }
  if (filters.city) {
    const town = filters.city.trim();
    // Match city/metro/address, and title (NBI rows often lack city but mention town in title)
    conditions.push(
      or(
        ilike(reportLocations.city, `%${town}%`),
        ilike(reportLocations.metroArea, `%${town}%`),
        ilike(reportLocations.addressLine, `%${town}%`),
        ilike(reports.title, `%${town}%`)
      )!
    );
  }
  if (filters.postalCode) conditions.push(eq(reportLocations.postalCode, filters.postalCode));
  if (filters.tractGeoid) conditions.push(eq(reportLocations.tractGeoid, filters.tractGeoid));
  if (filters.censusRegion) conditions.push(eq(reportLocations.censusRegion, filters.censusRegion));
  if (filters.censusDivision) conditions.push(eq(reportLocations.censusDivision, filters.censusDivision));
  if (filters.congressionalDistrict) {
    conditions.push(ilike(reportLocations.congressionalDistrict, `%${filters.congressionalDistrict.trim()}%`));
  }
  if (filters.stateSenateDistrict) conditions.push(eq(reportLocations.stateSenateDistrict, filters.stateSenateDistrict));
  if (filters.stateHouseDistrict) conditions.push(eq(reportLocations.stateHouseDistrict, filters.stateHouseDistrict));
  if (filters.schoolDistrict) conditions.push(eq(reportLocations.schoolDistrict, filters.schoolDistrict));
  if (filters.metroArea) {
    conditions.push(ilike(reportLocations.metroArea, `%${filters.metroArea.trim()}%`));
  }

  if (filters.reporterName) {
    conditions.push(ilike(users.displayName, `%${filters.reporterName}%`));
  }

  return { conditions, bbox };
}

async function fetchFilteredReportRows(filters: AnalyticsFilters) {
  const { conditions } = buildConditions(filters);
  const whereClause = and(...conditions);

  const rows = await db
    .select({
      id: reports.id,
      title: reports.title,
      status: reports.status,
      severity: reports.severity,
      latitude: reports.latitude,
      longitude: reports.longitude,
      submitterId: reports.submitterId,
      category: reports.category,
      subcategory: reports.subcategory,
      infrastructureClass: reports.infrastructureClass,
      infrastructureType: reports.infrastructureType,
      failureType: reports.failureType,
      postAction: reports.postAction,
      estimatedCostLow: reports.estimatedCostLow,
      estimatedCostHigh: reports.estimatedCostHigh,
      actualCost: reports.actualCost,
      peopleAffected: reports.peopleAffected,
      evidenceType: reports.evidenceType,
      responsibleAgency: reports.responsibleAgency,
      createdAt: reports.createdAt,
      occurredAt: reports.occurredAt,
      resolvedAt: reports.resolvedAt,
      observationConfidence: reports.observationConfidence,
      city: reportLocations.city,
      stateProvince: reportLocations.stateProvince,
      county: reportLocations.county,
      postalCode: reportLocations.postalCode,
      countryCode: reportLocations.countryCode,
      tractGeoid: reportLocations.tractGeoid,
      metroArea: reportLocations.metroArea,
      censusRegion: reportLocations.censusRegion,
      schoolDistrict: reportLocations.schoolDistrict,
      congressionalDistrict: reportLocations.congressionalDistrict,
      geocodeStatus: reportLocations.geocodeStatus,
      userDisplayName: users.displayName,
      userEmail: users.email,
      userRole: users.role,
      userIsSynthetic: users.isSynthetic,
    })
    .from(reports)
    .leftJoin(reportLocations, eq(reportLocations.reportId, reports.id))
    .leftJoin(users, eq(reports.submitterId, users.id))
    .where(whereClause);

  // Precise radius filter after bbox prefilter
  if (filters.radiusLat != null && filters.radiusLng != null && filters.radiusKm != null) {
    return rows.filter(
      (r) => haversineKm(filters.radiusLat!, filters.radiusLng!, r.latitude, r.longitude) <= filters.radiusKm!
    );
  }
  return rows;
}

function midCost(low: number | null, high: number | null) {
  if (low != null && high != null) return (low + high) / 2;
  return high ?? low ?? 0;
}

function ageDays(from: Date | string, to: Date | string = new Date()) {
  const start = from instanceof Date ? from : new Date(from);
  const end = to instanceof Date ? to : new Date(to);
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
}

export async function getAnalyticsSummary(filters: AnalyticsFilters): Promise<AnalyticsSummary> {
  const rows = await fetchFilteredReportRows(filters);
  const openBacklog = rows.filter((r) => OPEN_STATUSES.includes(r.status) && r.status !== 'resolved').length;
  const criticalReports = rows.filter((r) => (r.severity ?? 0) >= 4).length;
  const uniqueReporters = new Set(rows.map((r) => r.submitterId)).size;
  const accepted = rows.filter((r) => ['accepted', 'in_progress', 'resolved'].includes(r.status)).length;
  const resolved = rows.filter((r) => r.status === 'resolved');
  const estimatedCostTotal = rows.reduce((s, r) => s + midCost(r.estimatedCostLow, r.estimatedCostHigh), 0);
  const actualCostTotal = rows.reduce((s, r) => s + (r.actualCost ?? 0), 0);
  const peopleAffectedTotal = rows.reduce((s, r) => s + (r.peopleAffected ?? 0), 0);
  const avgAgeDays =
    rows.length === 0
      ? 0
      : rows.reduce((s, r) => s + ageDays(r.occurredAt || r.createdAt), 0) / rows.length;

  const withResolution = resolved.filter((r) => r.resolvedAt);
  const avgTimeToResolutionDays =
    withResolution.length === 0
      ? null
      : withResolution.reduce((s, r) => s + ageDays(r.occurredAt || r.createdAt, r.resolvedAt!), 0) /
        withResolution.length;

  return {
    totalReports: rows.length,
    openBacklog,
    criticalReports,
    uniqueReporters,
    acceptanceRate: rows.length ? accepted / rows.length : 0,
    resolutionRate: rows.length ? resolved.length / rows.length : 0,
    estimatedCostTotal,
    actualCostTotal,
    peopleAffectedTotal,
    avgAgeDays,
    avgTimeToResolutionDays,
    nullCounts: {
      infrastructureClass: rows.filter((r) => !r.infrastructureClass && !r.category).length,
      failureType: rows.filter((r) => !r.failureType).length,
      estimatedCost: rows.filter((r) => r.estimatedCostLow == null && r.estimatedCostHigh == null).length,
      location: rows.filter((r) => !r.city && !r.stateProvince).length,
      peopleAffected: rows.filter((r) => r.peopleAffected == null).length,
    },
  };
}

export async function getBreakdowns(filters: AnalyticsFilters): Promise<BreakdownItem[]> {
  const rows = await fetchFilteredReportRows(filters);
  const groupBy = filters.groupBy || 'infrastructureClass';

  const buckets = new Map<string, BreakdownItem>();

  for (const r of rows) {
    let key = 'Unknown';
    switch (groupBy) {
      case 'failureType':
        key = r.failureType || 'Unknown';
        break;
      case 'status':
        key = r.status;
        break;
      case 'severity':
        key = String(r.severity ?? 'Unknown');
        break;
      case 'reporter':
        key = r.userDisplayName || r.submitterId;
        break;
      case 'state':
        key = r.stateProvince || 'Unknown';
        break;
      case 'city':
        key = r.city || 'Unknown';
        break;
      case 'metroArea':
        key = r.metroArea || 'Unknown';
        break;
      case 'agency':
        key = r.responsibleAgency || 'Unknown';
        break;
      case 'evidenceType':
        key = r.evidenceType || 'Unknown';
        break;
      case 'postAction':
        key = r.postAction || 'Unknown';
        break;
      case 'costBand': {
        const c = midCost(r.estimatedCostLow, r.estimatedCostHigh);
        if (c === 0) key = 'Unknown/0';
        else if (c < 1000) key = '<$1k';
        else if (c < 10000) key = '$1k–$10k';
        else if (c < 100000) key = '$10k–$100k';
        else key = '>$100k';
        break;
      }
      case 'infrastructureType':
        key = r.infrastructureType || r.subcategory || 'Unknown';
        break;
      default:
        key = r.infrastructureClass || r.category || 'Unknown';
    }

    const existing = buckets.get(key) || {
      key,
      label: key,
      count: 0,
      estimatedCost: 0,
      actualCost: 0,
      avgSeverity: null,
      peopleAffected: 0,
    };
    existing.count += 1;
    existing.estimatedCost += midCost(r.estimatedCostLow, r.estimatedCostHigh);
    existing.actualCost += r.actualCost ?? 0;
    existing.peopleAffected += r.peopleAffected ?? 0;
    const sevSum = (existing.avgSeverity ?? 0) * (existing.count - 1) + (r.severity ?? 0);
    existing.avgSeverity = existing.count ? sevSum / existing.count : null;
    buckets.set(key, existing);
  }

  return Array.from(buckets.values()).sort((a, b) => b.count - a.count);
}

export async function getTimeSeries(filters: AnalyticsFilters): Promise<TimeSeriesPoint[]> {
  const rows = await fetchFilteredReportRows(filters);
  const bucket = filters.bucket || 'month';
  const map = new Map<string, TimeSeriesPoint>();

  for (const r of rows) {
    const d = r.occurredAt || r.createdAt;
    let key: string;
    if (bucket === 'day') key = d.toISOString().slice(0, 10);
    else if (bucket === 'week') {
      const tmp = new Date(d);
      tmp.setDate(tmp.getDate() - tmp.getDay());
      key = tmp.toISOString().slice(0, 10);
    } else if (bucket === 'quarter') {
      const q = Math.floor(d.getMonth() / 3) + 1;
      key = `${d.getFullYear()}-Q${q}`;
    } else if (bucket === 'year') key = String(d.getFullYear());
    else key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const point = map.get(key) || { bucket: key, count: 0, resolved: 0, estimatedCost: 0, critical: 0 };
    point.count += 1;
    if (r.status === 'resolved') point.resolved += 1;
    point.estimatedCost += midCost(r.estimatedCostLow, r.estimatedCostHigh);
    if ((r.severity ?? 0) >= 4) point.critical += 1;
    map.set(key, point);
  }

  return Array.from(map.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));
}

export async function getScatter(filters: AnalyticsFilters): Promise<ScatterPoint[]> {
  const rows = await fetchFilteredReportRows(filters);
  return rows
    .filter((r) => midCost(r.estimatedCostLow, r.estimatedCostHigh) > 0 || (r.peopleAffected ?? 0) > 0)
    .slice(0, 500)
    .map((r) => ({
      id: r.id,
      title: r.title,
      x: r.severity ?? 0,
      y: midCost(r.estimatedCostLow, r.estimatedCostHigh),
      severity: r.severity,
      status: r.status,
      estimatedCost: midCost(r.estimatedCostLow, r.estimatedCostHigh) || null,
      peopleAffected: r.peopleAffected,
      ageDays: ageDays(r.occurredAt || r.createdAt),
    }));
}

export async function getMapPoints(filters: AnalyticsFilters): Promise<MapPoint[]> {
  const rows = await fetchFilteredReportRows(filters);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    latitude: r.latitude,
    longitude: r.longitude,
    severity: r.severity,
    status: r.status,
    estimatedCost: midCost(r.estimatedCostLow, r.estimatedCostHigh) || null,
    infrastructureClass: r.infrastructureClass || r.category,
  }));
}

export async function getMapAreas(filters: AnalyticsFilters): Promise<MapAreaAggregate[]> {
  const rows = await fetchFilteredReportRows(filters);
  const level = filters.mapLevel || 'state';
  const map = new Map<string, MapAreaAggregate & { sevSum: number; unresolved: number; resTimes: number[] }>();

  for (const r of rows) {
    let areaKey = 'Unknown';
    let areaName = 'Unknown';
    switch (level) {
      case 'county':
        areaKey = r.county || 'Unknown';
        areaName = r.county || 'Unknown';
        break;
      case 'city':
        areaKey = r.city || 'Unknown';
        areaName = r.city || 'Unknown';
        break;
      case 'tract':
        areaKey = r.tractGeoid || 'Unknown';
        areaName = r.tractGeoid || 'Unknown';
        break;
      case 'metro':
        areaKey = r.metroArea || 'Unknown';
        areaName = r.metroArea || 'Unknown';
        break;
      case 'school':
        areaKey = r.schoolDistrict || 'Unknown';
        areaName = r.schoolDistrict || 'Unknown';
        break;
      case 'congressional':
        areaKey = r.congressionalDistrict || 'Unknown';
        areaName = r.congressionalDistrict || 'Unknown';
        break;
      default:
        areaKey = r.stateProvince || 'Unknown';
        areaName = r.stateProvince || 'Unknown';
    }

    const existing = map.get(areaKey) || {
      areaKey,
      areaName,
      count: 0,
      criticalCount: 0,
      avgSeverity: null,
      unresolvedRate: 0,
      estimatedCost: 0,
      actualCost: 0,
      peopleAffected: 0,
      avgTimeToResolutionDays: null,
      sevSum: 0,
      unresolved: 0,
      resTimes: [] as number[],
    };
    existing.count += 1;
    if ((r.severity ?? 0) >= 4) existing.criticalCount += 1;
    existing.sevSum += r.severity ?? 0;
    if (r.status !== 'resolved') existing.unresolved += 1;
    existing.estimatedCost += midCost(r.estimatedCostLow, r.estimatedCostHigh);
    existing.actualCost += r.actualCost ?? 0;
    existing.peopleAffected += r.peopleAffected ?? 0;
    if (r.resolvedAt) existing.resTimes.push(ageDays(r.occurredAt || r.createdAt, r.resolvedAt));
    map.set(areaKey, existing);
  }

  return Array.from(map.values()).map((a) => ({
    areaKey: a.areaKey,
    areaName: a.areaName,
    count: a.count,
    criticalCount: a.criticalCount,
    avgSeverity: a.count ? a.sevSum / a.count : null,
    unresolvedRate: a.count ? a.unresolved / a.count : 0,
    estimatedCost: a.estimatedCost,
    actualCost: a.actualCost,
    peopleAffected: a.peopleAffected,
    avgTimeToResolutionDays:
      a.resTimes.length === 0 ? null : a.resTimes.reduce((s, n) => s + n, 0) / a.resTimes.length,
  }));
}

export async function getAnalyticsReports(filters: AnalyticsFilters) {
  const rows = await fetchFilteredReportRows(filters);
  const sortBy = filters.sortBy || 'createdAt';
  const sortDir = filters.sortDir || 'desc';
  const sorted = [...rows].sort((a, b) => {
    const av = (a as Record<string, unknown>)[sortBy];
    const bv = (b as Record<string, unknown>)[sortBy];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv!) return sortDir === 'asc' ? -1 : 1;
    if (av > bv!) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
  const offset = filters.offset ?? 0;
  const limit = Math.min(filters.limit ?? 50, 200);
  return {
    total: sorted.length,
    rows: sorted.slice(offset, offset + limit).map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      occurredAt: r.occurredAt?.toISOString() ?? null,
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      estimatedCost: midCost(r.estimatedCostLow, r.estimatedCostHigh) || null,
    })),
  };
}

export async function getReporterStats(filters: AnalyticsFilters): Promise<ReporterStats[]> {
  const rows = await fetchFilteredReportRows(filters);
  const byUser = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byUser.get(r.submitterId) || [];
    list.push(r);
    byUser.set(r.submitterId, list);
  }

  const userIds = Array.from(byUser.keys());
  if (userIds.length === 0) return [];

  const userRows = await db.select().from(users).where(inArray(users.id, userIds));
  const flagRows = await db
    .select({ reporterId: flags.reporterId, count: sql<number>`cast(count(*) as int)` })
    .from(flags)
    .where(inArray(flags.reporterId, userIds))
    .groupBy(flags.reporterId);

  const flagMap = new Map(flagRows.map((f) => [f.reporterId, f.count]));

  const upvoteRows = await db
    .select({
      submitterId: reports.submitterId,
      count: sql<number>`cast(count(${upvotes.id}) as int)`,
    })
    .from(upvotes)
    .innerJoin(reports, eq(upvotes.reportId, reports.id))
    .where(inArray(reports.submitterId, userIds))
    .groupBy(reports.submitterId);
  const upvoteMap = new Map(upvoteRows.map((u) => [u.submitterId, u.count]));

  const commentRows = await db
    .select({
      submitterId: reports.submitterId,
      count: sql<number>`cast(count(${comments.id}) as int)`,
    })
    .from(comments)
    .innerJoin(reports, eq(comments.reportId, reports.id))
    .where(and(inArray(reports.submitterId, userIds), eq(comments.isHidden, false)))
    .groupBy(reports.submitterId);
  const commentMap = new Map(commentRows.map((c) => [c.submitterId, c.count]));

  return userRows
    .map((u) => {
      const list = byUser.get(u.id) || [];
      const geos = new Set(list.map((r) => r.city || r.stateProvince).filter(Boolean));
      const withEvidence = list.filter((r) => r.evidenceType || true).length;
      const last = list.reduce<Date | null>((max, r) => {
        const d = r.createdAt;
        return !max || d > max ? d : max;
      }, null);

      return {
        id: u.id,
        displayName: u.displayName,
        email: u.email,
        role: u.role,
        isSynthetic: u.isSynthetic,
        createdAt: u.createdAt.toISOString(),
        reportCount: list.length,
        acceptedCount: list.filter((r) => ['accepted', 'in_progress', 'resolved'].includes(r.status)).length,
        resolvedCount: list.filter((r) => r.status === 'resolved').length,
        flagCount: flagMap.get(u.id) || 0,
        upvoteReceived: upvoteMap.get(u.id) || 0,
        commentReceived: commentMap.get(u.id) || 0,
        lastActivityAt: last?.toISOString() ?? null,
        geographicCoverage: geos.size,
        evidenceCompleteness: list.length ? withEvidence / list.length : 0,
      };
    })
    .sort((a, b) => b.reportCount - a.reportCount);
}

export async function getDataQuality(filters: AnalyticsFilters): Promise<DataQualityIssue[]> {
  const rows = await fetchFilteredReportRows({ ...filters, isSynthetic: undefined });
  const issues: DataQualityIssue[] = [];

  const missingCost = rows.filter((r) => r.estimatedCostLow == null && r.estimatedCostHigh == null);
  if (missingCost.length) {
    issues.push({
      type: 'missing_cost',
      severity: 'warning',
      count: missingCost.length,
      sampleIds: missingCost.slice(0, 5).map((r) => r.id),
      description: 'Reports missing estimated cost range',
    });
  }

  const missingGeo = rows.filter((r) => !r.city && !r.stateProvince);
  if (missingGeo.length) {
    issues.push({
      type: 'missing_geography',
      severity: 'warning',
      count: missingGeo.length,
      sampleIds: missingGeo.slice(0, 5).map((r) => r.id),
      description: 'Reports without city/state enrichment',
    });
  }

  const badCoords = rows.filter(
    (r) => r.latitude < -90 || r.latitude > 90 || r.longitude < -180 || r.longitude > 180
  );
  if (badCoords.length) {
    issues.push({
      type: 'impossible_coordinates',
      severity: 'critical',
      count: badCoords.length,
      sampleIds: badCoords.slice(0, 5).map((r) => r.id),
      description: 'Reports with impossible lat/lng values',
    });
  }

  const chronoErrors = rows.filter(
    (r) => r.resolvedAt && r.occurredAt && r.resolvedAt < r.occurredAt
  );
  if (chronoErrors.length) {
    issues.push({
      type: 'chronology_error',
      severity: 'critical',
      count: chronoErrors.length,
      sampleIds: chronoErrors.slice(0, 5).map((r) => r.id),
      description: 'Resolved before occurred timestamp',
    });
  }

  const costOutliers = rows.filter((r) => midCost(r.estimatedCostLow, r.estimatedCostHigh) > 5_000_000);
  if (costOutliers.length) {
    issues.push({
      type: 'cost_outlier',
      severity: 'info',
      count: costOutliers.length,
      sampleIds: costOutliers.slice(0, 5).map((r) => r.id),
      description: 'Estimated cost above $5M — verify estimates',
    });
  }

  const lowConfidence = rows.filter(
    (r) => r.geocodeStatus === 'failed' || r.geocodeStatus === 'unmatched' || (r.observationConfidence ?? 5) <= 2
  );
  if (lowConfidence.length) {
    issues.push({
      type: 'low_confidence',
      severity: 'info',
      count: lowConfidence.length,
      sampleIds: lowConfidence.slice(0, 5).map((r) => r.id),
      description: 'Low observation or geocode confidence',
    });
  }

  return issues;
}

export function reportsToCsv(rows: Awaited<ReturnType<typeof getAnalyticsReports>>['rows']) {
  const headers = [
    'id',
    'title',
    'status',
    'severity',
    'infrastructureClass',
    'infrastructureType',
    'failureType',
    'city',
    'stateProvince',
    'county',
    'postalCode',
    'latitude',
    'longitude',
    'googleMapsUrl',
    'estimatedCost',
    'actualCost',
    'peopleAffected',
    'reporter',
    'createdAt',
    'occurredAt',
    'resolvedAt',
  ];
  const lines = [headers.join(',')];
  for (const r of rows) {
    const mapsUrl =
      r.latitude != null && r.longitude != null
        ? `https://www.google.com/maps?q=${r.latitude},${r.longitude}`
        : '';
    const vals = [
      r.id,
      r.title,
      r.status,
      r.severity,
      r.infrastructureClass,
      r.infrastructureType,
      r.failureType,
      r.city,
      r.stateProvince,
      r.county,
      r.postalCode,
      r.latitude,
      r.longitude,
      mapsUrl,
      r.estimatedCost,
      r.actualCost,
      r.peopleAffected,
      r.userDisplayName,
      r.createdAt,
      r.occurredAt,
      r.resolvedAt,
    ].map((v) => {
      const s = v == null ? '' : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    });
    lines.push(vals.join(','));
  }
  // UTF-8 BOM so Excel on Windows opens special characters correctly
  return `\uFEFF${lines.join('\n')}`;
}
