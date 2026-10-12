'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import type { AnalyticsSummary, BreakdownItem, TimeSeriesPoint } from '@/lib/analytics-types';
import ShareSheet from '@/components/ShareSheet';

const COLORS = ['#8b5cf6', '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#06b6d4', '#f97316', '#a855f7'];

interface MapPoint {
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  severity?: number;
  coords?: [number, number];
  [key: string]: unknown;
}

function renderPieLabel(props: { label?: string; count?: number }): string {
  return `${props.label ?? ''} (${props.count ?? 0})`;
}

/** Pass on where the viewer came from (hostname only) for share-link view stats. */
function referrerQuery(): string {
  try {
    const host = document.referrer ? new URL(document.referrer).hostname : '';
    return host && host !== window.location.hostname ? `?ref=${encodeURIComponent(host)}` : '';
  } catch {
    return '';
  }
}

export default function SharedAnalyticsViewerPage() {
  const params = useParams();
  const token = params.token as string;

  const [label, setLabel] = useState<string | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [byClass, setByClass] = useState<BreakdownItem[]>([]);
  const [byStatus, setByStatus] = useState<BreakdownItem[]>([]);
  const [bySeverity, setBySeverity] = useState<BreakdownItem[]>([]);
  const [byInfraType, setByInfraType] = useState<BreakdownItem[]>([]);
  const [timeseries, setTimeseries] = useState<TimeSeriesPoint[]>([]);
  const [scatter, setScatter] = useState<Array<{ x: number; y: number; label?: string }>>([]);
  const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);
  const [table, setTable] = useState<{ total: number; rows: Record<string, unknown>[] }>({
    total: 0,
    rows: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [loadedToken, setLoadedToken] = useState<string | null>(null);
  const loading = !!token && loadedToken !== token;

  useEffect(() => {
    if (!token) return;

    Promise.all([
      fetch(`/api/public/analytics/${token}/meta`).then((r) => r.json()),
      fetch(`/api/public/analytics/${token}/summary${referrerQuery()}`).then((r) => r.json()),
      fetch(`/api/public/analytics/${token}/timeseries?bucket=month`).then((r) => r.json()),
      fetch(`/api/public/analytics/${token}/breakdowns?groupBy=infrastructureClass`).then((r) => r.json()),
      fetch(`/api/public/analytics/${token}/breakdowns?groupBy=status`).then((r) => r.json()),
      fetch(`/api/public/analytics/${token}/breakdowns?groupBy=severity`).then((r) => r.json()),
      fetch(`/api/public/analytics/${token}/breakdowns?groupBy=infrastructureType`).then((r) => r.json()),
      fetch(`/api/public/analytics/${token}/scatter`).then((r) => r.json()),
      fetch(`/api/public/analytics/${token}/map?mapLevel=state`).then((r) => r.json()),
      fetch(`/api/public/analytics/${token}/reports?limit=25`).then((r) => r.json()),
    ])
      .then(([meta, sum, ts, cls, sts, sev, itype, scat, map, reps]) => {
        if (meta.error || sum.error) throw new Error(meta.error || sum.error);

        setLabel(meta.data?.label || 'Shared analytics view');
        setSummary(sum.data);
        setTimeseries(ts.data || []);
        setByClass(cls.data || []);
        setByStatus(sts.data || []);
        setBySeverity(sev.data || []);
        setByInfraType(itype.data || []);
        setScatter(scat.data || []);
        setMapPoints(map.data?.points || []);
        setTable(reps.data || { total: 0, rows: [] });
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Failed to load shared view')
      )
      .finally(() => setLoadedToken(token));
  }, [token]);

  if (loading) {
    return (
      <div className="public-page">
        <div className="feed-empty">Loading shared dashboard…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-page">
        <div className="feed-empty">
          <h3>Link unavailable</h3>
          <p>{error}</p>
          <Link href="/login" className="btn-primary">Sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="public-page">
      <header className="public-topbar">
        <Link href="/" className="public-brand">
          <img src="/logo.svg" alt="" width={28} height={28} />
          FixMyDistrict
        </Link>
        <Link href="/login" className="btn-primary btn-sm">Admin sign in</Link>
      </header>

      <main className="public-analytics">
        <div className="shared-banner">
          Shared analytics view · read-only · no login required
        </div>
        <h1>{label}</h1>

        <div className="public-actions" style={{ marginBottom: 16 }}>
          <a
            className="btn-secondary btn-sm"
            href={`/api/public/analytics/${token}/reports?format=csv`}
          >
            Download CSV
          </a>
          <ShareSheet
            urlPath={`/v/${token}`}
            title={label || 'Shared FixMyDistrict dashboard'}
            text="View this FixMyDistrict analytics dashboard"
            compact
          />
        </div>

        {/* KPIs */}
        {summary && (
          <div className="analytics-kpi-grid">
            <div className="kpi-card">
              <span>Reports</span>
              <strong>{summary.totalReports}</strong>
            </div>
            <div className="kpi-card">
              <span>Critical</span>
              <strong>{summary.criticalReports}</strong>
            </div>
            <div className="kpi-card">
              <span>Est. cost</span>
              <strong>${Math.round(summary.estimatedCostTotal).toLocaleString()}</strong>
            </div>
            <div className="kpi-card">
              <span>People affected</span>
              <strong>{summary.peopleAffectedTotal.toLocaleString()}</strong>
            </div>
          </div>
        )}

        {/* Charts grid */}
        <div className="analytics-chart-grid">
          {/* Volume over time */}
          <div className="chart-panel">
            <h3>Volume over time</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={timeseries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="bucket" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip contentStyle={{ background: '#111', border: '1px solid #333' }} />
                <Line type="monotone" dataKey="count" stroke="#8b5cf6" name="Reports" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* By Class */}
          <div className="chart-panel">
            <h3>By class</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byClass.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="label" stroke="#888" tick={{ fontSize: 10 }} />
                <YAxis stroke="#888" />
                <Tooltip contentStyle={{ background: '#111', border: '1px solid #333' }} />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* By Status */}
          <div className="chart-panel">
            <h3>By status</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={byStatus}
                  dataKey="count"
                  nameKey="label"
                  outerRadius={80}
                  label={(props: { label?: string; name?: string; count?: number; value?: number }) =>
                    `${props.label ?? props.name ?? ''} (${props.count ?? props.value ?? 0})`
                  }
                >
                  {byStatus.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#111', border: '1px solid #333' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* By Severity */}
          <div className="chart-panel">
            <h3>By severity</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={bySeverity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="label" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip contentStyle={{ background: '#111', border: '1px solid #333' }} />
                <Bar dataKey="count" fill="#eab308" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* By Infrastructure Type */}
          <div className="chart-panel">
            <h3>By infrastructure type</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byInfraType.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="label" stroke="#888" tick={{ fontSize: 10 }} />
                <YAxis stroke="#888" />
                <Tooltip contentStyle={{ background: '#111', border: '1px solid #333' }} />
                <Bar dataKey="count" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Scatter */}
          <div className="chart-panel">
            <h3>Scatter</h3>
            <ResponsiveContainer width="100%" height={240}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="x" name="X" stroke="#888" />
                <YAxis dataKey="y" name="Y" stroke="#888" />
                <ZAxis range={[40, 200]} />
                <Tooltip contentStyle={{ background: '#111', border: '1px solid #333' }} />
                <Scatter data={scatter} fill="#a855f7" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Map Points Table */}
        {mapPoints.length > 0 && (
          <div className="chart-panel" style={{ marginTop: 16 }}>
            <h3>Map points ({mapPoints.length})</h3>
            <div className="analytics-table-wrap">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Latitude</th>
                    <th>Longitude</th>
                    <th>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {mapPoints.slice(0, 20).map((p: MapPoint, i) => {
                    const lat = p.latitude ?? p.lat ?? p.coords?.[0];
                    const lng = p.longitude ?? p.lng ?? p.coords?.[1];
                    return (
                      <tr key={i}>
                        <td>{lat != null ? Number(lat).toFixed(4) : '—'}</td>
                        <td>{lng != null ? Number(lng).toFixed(4) : '—'}</td>
                        <td>{p.severity ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Reports Table */}
        <div className="chart-panel" style={{ marginTop: 16 }}>
          <h3>Reports ({table.total})</h3>
          <div className="analytics-table-wrap">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Severity</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r) => (
                  <tr key={String(r.id)}>
                    <td>
                      <Link href={`/r/${r.id}`}>{String(r.title)}</Link>
                    </td>
                    <td>{String(r.status)}</td>
                    <td>{String(r.severity ?? '—')}</td>
                    <td>{String(r.stateProvince ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}