import type { DatePreset } from './categories';

export interface AnalyticsFilters {
  reporterId?: string;
  reporterName?: string;
  countryCode?: string;
  censusRegion?: string;
  censusDivision?: string;
  state?: string;
  county?: string;
  city?: string;
  postalCode?: string;
  tractGeoid?: string;
  congressionalDistrict?: string;
  stateSenateDistrict?: string;
  stateHouseDistrict?: string;
  schoolDistrict?: string;
  serviceAreaId?: string;
  metroArea?: string;
  radiusLat?: number;
  radiusLng?: number;
  radiusKm?: number;
  bbox?: { west: number; south: number; east: number; north: number };
  datePreset?: DatePreset;
  startDate?: string;
  endDate?: string;
  infrastructureClass?: string;
  infrastructureType?: string;
  failureType?: string;
  postAction?: string;
  status?: string;
  severityMin?: number;
  severityMax?: number;
  estimatedCostMin?: number;
  estimatedCostMax?: number;
  actualCostMin?: number;
  actualCostMax?: number;
  peopleAffectedMin?: number;
  evidenceType?: string;
  keyword?: string;
  datasetKey?: string;
  isSynthetic?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  groupBy?: string;
  bucket?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  mapLevel?: string;
  metric?: string;
}

export interface AnalyticsSummary {
  totalReports: number;
  openBacklog: number;
  criticalReports: number;
  uniqueReporters: number;
  acceptanceRate: number;
  resolutionRate: number;
  estimatedCostTotal: number;
  actualCostTotal: number;
  peopleAffectedTotal: number;
  avgAgeDays: number;
  avgTimeToResolutionDays: number | null;
  nullCounts: Record<string, number>;
  previousPeriod?: {
    totalReports: number;
    openBacklog: number;
    criticalReports: number;
  };
}

export interface BreakdownItem {
  key: string;
  label: string;
  count: number;
  estimatedCost: number;
  actualCost: number;
  avgSeverity: number | null;
  peopleAffected: number;
}

export interface TimeSeriesPoint {
  bucket: string;
  count: number;
  resolved: number;
  estimatedCost: number;
  critical: number;
}

export interface ScatterPoint {
  id: string;
  title: string;
  x: number;
  y: number;
  severity: number | null;
  status: string;
  estimatedCost: number | null;
  peopleAffected: number | null;
  ageDays: number;
}

export interface MapPoint {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  severity: number | null;
  status: string;
  estimatedCost: number | null;
  infrastructureClass: string | null;
}

export interface MapAreaAggregate {
  areaKey: string;
  areaName: string;
  count: number;
  criticalCount: number;
  avgSeverity: number | null;
  unresolvedRate: number;
  estimatedCost: number;
  actualCost: number;
  peopleAffected: number;
  avgTimeToResolutionDays: number | null;
}

export interface ReporterStats {
  id: string;
  displayName: string | null;
  email?: string;
  role: string;
  isSynthetic: boolean;
  createdAt: string;
  reportCount: number;
  acceptedCount: number;
  resolvedCount: number;
  flagCount: number;
  upvoteReceived: number;
  commentReceived: number;
  lastActivityAt: string | null;
  geographicCoverage: number;
  evidenceCompleteness: number;
}

export interface DataQualityIssue {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  count: number;
  sampleIds: string[];
  description: string;
}

export interface AnalyticsMeta {
  filters: AnalyticsFilters;
  generatedAt: string;
  units: Record<string, string>;
}
