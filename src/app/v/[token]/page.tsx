'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { AnalyticsSummary, BreakdownItem, TimeSeriesPoint } from '@/lib/analytics-types';
import ShareSheet from '@/components/ShareSheet';

export default function SharedAnalyticsViewerPage() {
  const params = useParams();
  const token = params.token as string;
  const [label, setLabel] = useState<string | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [breakdowns, setBreakdowns] = useState<BreakdownItem[]>([]);
  const [timeseries, setTimeseries] = useState<TimeSeriesPoint[]>([]);
  const [table, setTable] = useState<{ total: number; rows: Record<string, unknown>[] }>({ total: 0, rows: [] });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/public/analytics/${token}/meta`).then((r) => r.json()),
      fetch(`/api/public/analytics/${token}/summary`).then((r) => r.json()),
      fetch(`/api/public/analytics/${token}/breakdowns?groupBy=infrastructureClass`).then((r) => r.json()),
      fetch(`/api/public/analytics/${token}/timeseries?bucket=month`).then((r) => r.json()),
      fetch(`/api/public/analytics/${token}/reports?limit=25`).then((r) => r.json()),
    ])
      .then(([meta, sum, br, ts, reps]) => {
        if (meta.error || sum.error) throw new Error(meta.error || sum.error);
        setLabel(meta.data?.label || 'Shared analytics view');
        setSummary(sum.data);
        setBreakdowns(br.data || []);
        setTimeseries(ts.data || []);
        setTable(reps.data || { total: 0, rows: [] });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load shared view'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="public-page"><div className="feed-empty">Loading shared dashboard…</div></div>;
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
          <a className="btn-secondary btn-sm" href={`/api/public/analytics/${token}/reports?format=csv`}>
            Download CSV
          </a>
          <ShareSheet
            urlPath={`/v/${token}`}
            title={label || 'Shared FixMyDistrict dashboard'}
            text="View this FixMyDistrict analytics dashboard"
            compact
          />
        </div>

        {summary && (
          <div className="analytics-kpi-grid">
            <div className="kpi-card"><span>Reports</span><strong>{summary.totalReports}</strong></div>
            <div className="kpi-card"><span>Critical</span><strong>{summary.criticalReports}</strong></div>
            <div className="kpi-card"><span>Est. cost</span><strong>${Math.round(summary.estimatedCostTotal).toLocaleString()}</strong></div>
            <div className="kpi-card"><span>People affected</span><strong>{summary.peopleAffectedTotal.toLocaleString()}</strong></div>
          </div>
        )}

        <div className="analytics-chart-grid">
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
          <div className="chart-panel">
            <h3>By class</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={breakdowns.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="label" stroke="#888" tick={{ fontSize: 10 }} />
                <YAxis stroke="#888" />
                <Tooltip contentStyle={{ background: '#111', border: '1px solid #333' }} />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

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
