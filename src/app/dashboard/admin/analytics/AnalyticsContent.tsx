'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart,
} from 'recharts';
import {
  INFRASTRUCTURE_TAXONOMY,
  FAILURE_TYPES,
  REPORT_STATUSES,
  DATE_PRESETS,
} from '@/lib/categories';
import type {
  AnalyticsSummary,
  BreakdownItem,
  TimeSeriesPoint,
  ScatterPoint,
  MapAreaAggregate,
  MapPoint,
  ReporterStats,
  DataQualityIssue,
} from '@/lib/analytics-types';
import AnalyticsDashboardControls from '@/components/analytics/AnalyticsDashboardControls';

const AnalyticsMap = dynamic(() => import('@/components/maps/AnalyticsMap'), {
  ssr: false,
  loading: () => <div className="feed-empty">Loading map…</div>,
});

const DEFAULT_FILTERS = {
  datePreset: 'year',
  startDate: '',
  endDate: '',
  datasetKey: '',
  infrastructureClass: '',
  infrastructureType: '',
  failureType: '',
  status: '',
  severityMin: '',
  severityMax: '',
  state: '',
  city: '',
  county: '',
  postalCode: '',
  metroArea: '',
  countryCode: 'US',
  reporterName: '',
  keyword: '',
  mapLevel: 'state',
  metric: 'count',
  groupBy: 'infrastructureClass',
  bucket: 'month',
  radiusLat: '',
  radiusLng: '',
  radiusKm: '',
};

const COLORS = ['#8b5cf6', '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#06b6d4', '#f97316', '#ec4899'];

type Tab = 'overview' | 'geography' | 'infrastructure' | 'costs' | 'reporters' | 'quality';

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function AnalyticsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [breakdowns, setBreakdowns] = useState<BreakdownItem[]>([]);
  const [timeseries, setTimeseries] = useState<TimeSeriesPoint[]>([]);
  const [scatter, setScatter] = useState<ScatterPoint[]>([]);
  const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);
  const [mapAreas, setMapAreas] = useState<MapAreaAggregate[]>([]);
  const [boundaries, setBoundaries] = useState<GeoJSON.FeatureCollection | null>(null);
  const [reporters, setReporters] = useState<ReporterStats[]>([]);
  const [quality, setQuality] = useState<DataQualityIssue[]>([]);
  const [table, setTable] = useState<{ total: number; rows: Record<string, unknown>[] }>({ total: 0, rows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersHydrated, setFiltersHydrated] = useState(false);

  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  useEffect(() => {
    const next = { ...DEFAULT_FILTERS };
    searchParams.forEach((v, k) => {
      if (k in next) (next as Record<string, string>)[k] = v;
    });
    setFilters(next);
    setFiltersHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once from URL
  }, []);

  const debounced = useDebounced(filters, 350);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(debounced).forEach(([k, v]) => {
      if (v !== '' && v != null) p.set(k, String(v));
    });
    return p.toString();
  }, [debounced]);

  useEffect(() => {
    if (!filtersHydrated) return;
    const qs = queryString ? `?${queryString}` : '';
    router.replace(`${pathname}${qs}`, { scroll: false });
  }, [queryString, pathname, router, filtersHydrated]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        const role = data.user?.role;
        setAuthorized(!!(data.authenticated && (role === 'admin' || role === 'super_admin')));
      })
      .catch(() => setAuthorized(false));
  }, []);

  const load = useCallback(async () => {
    if (!authorized) return;
    setLoading(true);
    setError(null);
    try {
      const [sum, br, ts, sc, mp, users, ql, reps] = await Promise.all([
        fetch(`/api/admin/analytics/summary?${queryString}`).then((r) => r.json()),
        fetch(`/api/admin/analytics/breakdowns?${queryString}&groupBy=${debounced.groupBy || 'infrastructureClass'}`).then((r) => r.json()),
        fetch(`/api/admin/analytics/timeseries?${queryString}&bucket=${debounced.bucket || 'month'}`).then((r) => r.json()),
        fetch(`/api/admin/analytics/scatter?${queryString}`).then((r) => r.json()),
        fetch(`/api/admin/analytics/map?${queryString}&mapLevel=${debounced.mapLevel || 'state'}`).then((r) => r.json()),
        fetch(`/api/admin/analytics/users?${queryString}`).then((r) => r.json()),
        fetch(`/api/admin/analytics/quality?${queryString}`).then((r) => r.json()),
        fetch(`/api/admin/analytics/reports?${queryString}&limit=25`).then((r) => r.json()),
      ]);

      if (sum.error) throw new Error(sum.error);
      setSummary(sum.data);
      setBreakdowns(br.data || []);
      setTimeseries(ts.data || []);
      setScatter(sc.data || []);
      setMapPoints(mp.data?.points || []);
      setMapAreas(mp.data?.areas || []);
      setReporters(users.data || []);
      setQuality(ql.data || []);
      setTable(reps.data || { total: 0, rows: [] });

      // Boundaries for choropleth (US mainland rough bbox default)
      const boundRes = await fetch(
        `/api/admin/analytics/boundaries?${queryString}&mapLevel=${debounced.mapLevel || 'state'}&west=-125&south=24&east=-66&north=50`
      ).then((r) => r.json());
      setBoundaries(boundRes.data || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [authorized, queryString, debounced.groupBy, debounced.bucket, debounced.mapLevel]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (key: string, value: string) => setFilters((prev) => ({ ...prev, [key]: value }));

  const clearFilters = () => setFilters({ ...DEFAULT_FILTERS });

  const activeChips = Object.entries(filters).filter(
    ([k, v]) => v && !['mapLevel', 'metric', 'groupBy', 'bucket', 'datePreset', 'countryCode'].includes(k)
  );

  if (authorized === null) return <div className="feed-empty">Checking access…</div>;
  if (!authorized) {
    return (
      <div className="feed-empty feed-empty-rich">
        <h3>Admin access required</h3>
        <p>Sign in with an admin account to open the intelligence dashboard.</p>
        <p className="report-ref">Demo: admin@fixmydistrict.app / password123</p>
        <Link href="/login" className="btn-primary">Go to login</Link>
      </div>
    );
  }

  const infraTypes = filters.infrastructureClass
    ? INFRASTRUCTURE_TAXONOMY[filters.infrastructureClass] || []
    : [];

  const pieData = breakdowns.slice(0, 8).map((b) => ({ name: b.label, value: b.count }));

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <div>
          <h2>Admin Intelligence</h2>
          <p className="analytics-subtitle">U.S.-first civic analytics · filter-synced charts, map & reporters</p>
        </div>
        <div className="analytics-header-actions">
          <Link href="/dashboard/admin" className="btn-secondary btn-sm">User admin</Link>
        </div>
      </div>

      <AnalyticsDashboardControls
        filters={filters}
        setFilters={(next) =>
          setFilters((prev) =>
            typeof next === 'function' ? (next(prev) as typeof prev) : (next as typeof prev)
          )
        }
        queryString={queryString}
      />

      <div className="analytics-tabs">
        {([
          ['overview', 'Overview'],
          ['geography', 'Geography'],
          ['infrastructure', 'Infrastructure'],
          ['costs', 'Costs & Impact'],
          ['reporters', 'Reporters'],
          ['quality', 'Data Quality'],
        ] as [Tab, string][]).map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      <div className="analytics-filters">
        <select value={filters.datasetKey} onChange={(e) => setFilter('datasetKey', e.target.value)}>
          <option value="">All datasets</option>
          <option value="us-demo-v1">US demo</option>
          <option value="nbi-bridges-2026v14">NBI bridges</option>
        </select>
        <select value={filters.datePreset} onChange={(e) => setFilter('datePreset', e.target.value)}>
          {DATE_PRESETS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
        </select>
        {filters.datePreset === 'custom' && (
          <>
            <input type="date" value={filters.startDate} onChange={(e) => setFilter('startDate', e.target.value)} />
            <input type="date" value={filters.endDate} onChange={(e) => setFilter('endDate', e.target.value)} />
          </>
        )}
        <select value={filters.infrastructureClass} onChange={(e) => { setFilter('infrastructureClass', e.target.value); setFilter('infrastructureType', ''); }}>
          <option value="">All classes</option>
          {Object.keys(INFRASTRUCTURE_TAXONOMY).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filters.infrastructureType} onChange={(e) => setFilter('infrastructureType', e.target.value)} disabled={!filters.infrastructureClass}>
          <option value="">All types</option>
          {infraTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filters.failureType} onChange={(e) => setFilter('failureType', e.target.value)}>
          <option value="">All failures</option>
          {FAILURE_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">All statuses</option>
          {REPORT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input placeholder="State (FL or Florida)" value={filters.state} onChange={(e) => setFilter('state', e.target.value)} />
        <input placeholder="City / town" value={filters.city} onChange={(e) => setFilter('city', e.target.value)} />
        <input placeholder="County" value={filters.county} onChange={(e) => setFilter('county', e.target.value)} />
        <input placeholder="ZIP" value={filters.postalCode} onChange={(e) => setFilter('postalCode', e.target.value)} />
        <input placeholder="Reporter name" value={filters.reporterName} onChange={(e) => setFilter('reporterName', e.target.value)} />
        <input placeholder="Keyword" value={filters.keyword} onChange={(e) => setFilter('keyword', e.target.value)} />
        <input placeholder="Severity min" value={filters.severityMin} onChange={(e) => setFilter('severityMin', e.target.value)} />
        <input placeholder="Severity max" value={filters.severityMax} onChange={(e) => setFilter('severityMax', e.target.value)} />
        <input placeholder="Radius lat" value={filters.radiusLat} onChange={(e) => setFilter('radiusLat', e.target.value)} />
        <input placeholder="Radius lng" value={filters.radiusLng} onChange={(e) => setFilter('radiusLng', e.target.value)} />
        <input placeholder="Radius km" value={filters.radiusKm} onChange={(e) => setFilter('radiusKm', e.target.value)} />
        <button type="button" className="btn-secondary btn-sm" onClick={clearFilters}>Clear</button>
      </div>

      {activeChips.length > 0 && (
        <div className="analytics-chips">
          {activeChips.map(([k, v]) => (
            <button key={k} className="analytics-chip" onClick={() => setFilter(k, '')}>
              {k}: {v} ×
            </button>
          ))}
        </div>
      )}

      {error && <div className="analytics-error">{error}</div>}
      {loading && <div className="feed-empty">Refreshing analytics…</div>}

      {summary && !loading && (
        <>
          {(tab === 'overview' || tab === 'costs') && (
            <div className="analytics-kpi-grid">
              <div className="analytics-kpi"><span>Total reports</span><strong>{summary.totalReports}</strong></div>
              <div className="analytics-kpi"><span>Open backlog</span><strong>{summary.openBacklog}</strong></div>
              <div className="analytics-kpi"><span>Critical (4–5)</span><strong>{summary.criticalReports}</strong></div>
              <div className="analytics-kpi"><span>Reporters</span><strong>{summary.uniqueReporters}</strong></div>
              <div className="analytics-kpi"><span>Resolution rate</span><strong>{(summary.resolutionRate * 100).toFixed(1)}%</strong></div>
              <div className="analytics-kpi"><span>Est. cost</span><strong>${summary.estimatedCostTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></div>
              <div className="analytics-kpi"><span>Actual cost</span><strong>${summary.actualCostTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></div>
              <div className="analytics-kpi"><span>People affected</span><strong>{summary.peopleAffectedTotal.toLocaleString()}</strong></div>
              <div className="analytics-kpi"><span>Avg age (days)</span><strong>{summary.avgAgeDays.toFixed(1)}</strong></div>
              <div className="analytics-kpi"><span>Avg time to resolve</span><strong>{summary.avgTimeToResolutionDays?.toFixed(1) ?? '—'}</strong></div>
            </div>
          )}

          {(tab === 'overview' || tab === 'infrastructure') && (
            <div className="analytics-chart-grid">
              <div className="chart-panel">
                <h3>Reports over time</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={timeseries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                    <XAxis dataKey="bucket" stroke="#888" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#888" tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#111', border: '1px solid #333' }} />
                    <Area type="monotone" dataKey="count" stroke="#8b5cf6" fill="#8b5cf633" name="Reports" />
                    <Area type="monotone" dataKey="resolved" stroke="#22c55e" fill="#22c55e22" name="Resolved" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-panel">
                <div className="chart-panel-header">
                  <h3>Breakdown</h3>
                  <select value={filters.groupBy} onChange={(e) => setFilter('groupBy', e.target.value)}>
                    <option value="infrastructureClass">Class</option>
                    <option value="infrastructureType">Type</option>
                    <option value="failureType">Failure</option>
                    <option value="status">Status</option>
                    <option value="severity">Severity</option>
                    <option value="state">State</option>
                    <option value="metroArea">Metro</option>
                    <option value="agency">Agency</option>
                    <option value="costBand">Cost band</option>
                  </select>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={breakdowns.slice(0, 12)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                    <XAxis dataKey="label" stroke="#888" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
                    <YAxis stroke="#888" tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#111', border: '1px solid #333' }} />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-panel">
                <h3>Composition</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#111', border: '1px solid #333' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-panel">
                <h3>Severity vs estimated cost</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                    <XAxis type="number" dataKey="x" name="Severity" domain={[0, 5]} stroke="#888" />
                    <YAxis type="number" dataKey="y" name="Cost" stroke="#888" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: '#111', border: '1px solid #333' }} />
                    <Scatter data={scatter} fill="#3b82f6" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {(tab === 'geography' || tab === 'overview') && (
            <div className="analytics-map-section">
              <div className="chart-panel-header">
                <h3>Thematic map</h3>
                <div className="map-controls">
                  <select value={filters.mapLevel} onChange={(e) => setFilter('mapLevel', e.target.value)}>
                    <option value="state">State</option>
                    <option value="county">County</option>
                    <option value="metro">Metro</option>
                    <option value="city">City</option>
                    <option value="tract">Census tract</option>
                    <option value="congressional">Congressional</option>
                    <option value="school">School district</option>
                  </select>
                  <select value={filters.metric} onChange={(e) => setFilter('metric', e.target.value)}>
                    <option value="count">Report count</option>
                    <option value="criticalCount">Critical count</option>
                    <option value="avgSeverity">Avg severity</option>
                    <option value="unresolvedRate">Unresolved rate</option>
                    <option value="estimatedCost">Estimated cost</option>
                    <option value="peopleAffected">People affected</option>
                  </select>
                </div>
              </div>
              <AnalyticsMap
                points={mapPoints}
                areas={mapAreas}
                boundaries={boundaries}
                metric={filters.metric}
                radiusLat={filters.radiusLat ? Number(filters.radiusLat) : undefined}
                radiusLng={filters.radiusLng ? Number(filters.radiusLng) : undefined}
                radiusKm={filters.radiusKm ? Number(filters.radiusKm) : undefined}
                onRadiusPick={(lat: number, lng: number) => {
                  setFilter('radiusLat', lat.toFixed(5));
                  setFilter('radiusLng', lng.toFixed(5));
                  if (!filters.radiusKm) setFilter('radiusKm', '25');
                }}
              />
              <p className="map-source-note">Boundaries: U.S. Census TIGERweb (Current vintage). Joined to report aggregates by GEOID/name.</p>
            </div>
          )}

          {tab === 'costs' && (
            <div className="analytics-chart-grid">
              <div className="chart-panel">
                <h3>Estimated cost over time</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={timeseries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                    <XAxis dataKey="bucket" stroke="#888" />
                    <YAxis stroke="#888" />
                    <Tooltip contentStyle={{ background: '#111', border: '1px solid #333' }} />
                    <Line type="monotone" dataKey="estimatedCost" stroke="#f97316" name="Est. cost" />
                    <Line type="monotone" dataKey="critical" stroke="#ef4444" name="Critical" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-panel">
                <h3>Cost by class</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={breakdowns.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                    <XAxis dataKey="label" stroke="#888" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#888" />
                    <Tooltip contentStyle={{ background: '#111', border: '1px solid #333' }} />
                    <Bar dataKey="estimatedCost" fill="#f97316" name="Est. cost" />
                    <Bar dataKey="actualCost" fill="#22c55e" name="Actual" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {tab === 'reporters' && (
            <div className="chart-panel">
              <h3>Reporter intelligence</h3>
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Reports</th>
                      <th>Accepted</th>
                      <th>Resolved</th>
                      <th>Flags</th>
                      <th>Upvotes</th>
                      <th>Geo coverage</th>
                      <th>Last activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporters.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <Link href={`/dashboard/u/${r.id}`}>{r.displayName || '—'}</Link>
                          {r.isSynthetic && <span className="demo-badge">demo</span>}
                        </td>
                        <td>{r.role}</td>
                        <td>{r.reportCount}</td>
                        <td>{r.acceptedCount}</td>
                        <td>{r.resolvedCount}</td>
                        <td>{r.flagCount}</td>
                        <td>{r.upvoteReceived}</td>
                        <td>{r.geographicCoverage}</td>
                        <td>{r.lastActivityAt ? new Date(r.lastActivityAt).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'quality' && (
            <div className="analytics-chart-grid">
              {quality.length === 0 ? (
                <div className="chart-panel"><p>No data-quality issues in the current filter set.</p></div>
              ) : (
                quality.map((q) => (
                  <div key={q.type} className={`chart-panel quality-${q.severity}`}>
                    <h3>{q.type.replace(/_/g, ' ')}</h3>
                    <p className="quality-count">{q.count}</p>
                    <p>{q.description}</p>
                    {q.sampleIds[0] && (
                      <Link href={`/dashboard/reports/${q.sampleIds[0]}`} className="btn-secondary btn-sm">
                        View sample
                      </Link>
                    )}
                  </div>
                ))
              )}
              <div className="chart-panel">
                <h3>Null field counts</h3>
                <ul className="quality-list">
                  {summary && Object.entries(summary.nullCounts).map(([k, v]) => (
                    <li key={k}><span>{k}</span><strong>{String(v)}</strong></li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="chart-panel" style={{ marginTop: 16 }}>
            <div className="chart-panel-header">
              <h3>Drill-down ({table.total} reports)</h3>
            </div>
            <div className="analytics-table-wrap">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Severity</th>
                    <th>Class</th>
                    <th>Location</th>
                    <th>Est. cost</th>
                    <th>Reporter</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((r) => (
                    <tr key={String(r.id)}>
                      <td><Link href={`/dashboard/reports/${r.id}`}>{String(r.title)}</Link></td>
                      <td>{String(r.status)}</td>
                      <td>{String(r.severity ?? '—')}</td>
                      <td>{String(r.infrastructureClass || r.category || '—')}</td>
                      <td>{[r.city, r.stateProvince].filter(Boolean).join(', ') || '—'}</td>
                      <td>{r.estimatedCost != null ? `$${Number(r.estimatedCost).toLocaleString()}` : '—'}</td>
                      <td>{String(r.userDisplayName || '—')}</td>
                      <td>{r.createdAt ? new Date(String(r.createdAt)).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
