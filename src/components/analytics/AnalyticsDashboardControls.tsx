'use client';

import React, { useCallback, useEffect, useState } from 'react';
import ShareSheet from '@/components/ShareSheet';

type Filters = Record<string, string>;

interface SavedView {
  id: string;
  name: string;
  filters: Filters;
}

interface Props {
  filters: Filters;
  setFilters: (next: Filters | ((prev: Filters) => Filters)) => void;
  queryString: string;
}

export default function AnalyticsDashboardControls({ filters, setFilters, queryString }: Props) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [selectedViewId, setSelectedViewId] = useState('');
  const [manageOpen, setManageOpen] = useState(false);
  const [sharePath, setSharePath] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [datasetKey, setDatasetKey] = useState(`csv-import-${new Date().toISOString().slice(0, 10)}`);
  const [useStockPhotos, setUseStockPhotos] = useState(true);

  const loadViews = useCallback(async () => {
    const res = await fetch('/api/admin/analytics/views');
    const data = await res.json();
    if (Array.isArray(data)) setViews(data);
  }, []);

  useEffect(() => {
    loadViews();
  }, [loadViews]);

  const applyView = (id: string) => {
    setSelectedViewId(id);
    const view = views.find((v) => v.id === id);
    if (!view) return;
    setFilters((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (k in view.filters) next[k] = String(view.filters[k] ?? '');
        else if (!['mapLevel', 'metric', 'groupBy', 'bucket'].includes(k)) next[k] = '';
      });
      Object.entries(view.filters).forEach(([k, v]) => {
        next[k] = String(v ?? '');
      });
      return next;
    });
  };

  const saveView = async () => {
    const name = window.prompt('Name this dashboard');
    if (!name?.trim()) return;
    const res = await fetch('/api/admin/analytics/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), filters }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || 'Save failed');
      return;
    }
    setMessage(`Saved “${data.name}”`);
    await loadViews();
    setSelectedViewId(data.id);
  };

  const renameView = async (id: string, current: string) => {
    const name = window.prompt('Rename dashboard', current);
    if (!name?.trim()) return;
    const res = await fetch('/api/admin/analytics/views', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: name.trim() }),
    });
    if (!res.ok) {
      const data = await res.json();
      setMessage(data.error || 'Rename failed');
      return;
    }
    await loadViews();
  };

  const deleteView = async (id: string) => {
    if (!window.confirm('Delete this saved dashboard?')) return;
    await fetch(`/api/admin/analytics/views?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (selectedViewId === id) setSelectedViewId('');
    await loadViews();
  };

  const shareDashboard = async () => {
    const label = views.find((v) => v.id === selectedViewId)?.name || 'Shared dashboard';
    const res = await fetch('/api/admin/analytics/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters, label, savedViewId: selectedViewId || null }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || 'Share failed');
      return;
    }
    setSharePath(data.urlPath);
    setMessage('Share link created');
  };

  const exportSetupCsv = () => {
    const lines = ['key,value'];
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== '' && v != null) lines.push(`${k},${JSON.stringify(String(v))}`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dashboard-setup-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importSetupCsv = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const next: Filters = { ...filters };
    for (const line of lines.slice(1)) {
      const idx = line.indexOf(',');
      if (idx < 0) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        try {
          value = JSON.parse(value);
        } catch {
          value = value.slice(1, -1);
        }
      }
      if (key) next[key] = value;
    }
    setFilters(next);
    setMessage('Setup CSV applied');
  };

  const importDataCsv = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('datasetKey', datasetKey);
    form.append('useStockPhotos', String(useStockPhotos));
    const res = await fetch('/api/admin/analytics/import-csv', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) {
      setImportResult(data.error || 'Import failed');
      return;
    }
    setImportResult(
      `Inserted ${data.inserted}, skipped ${data.skipped}. Dataset: ${data.datasetKey}` +
        (data.errors?.length ? ` · ${data.errors.length} row errors` : '')
    );
    setFilters((prev) => ({ ...prev, datasetKey: data.datasetKey }));
  };

  return (
    <div className="analytics-dashboard-controls">
      <div className="analytics-dashboard-row">
        <select
          value={selectedViewId}
          onChange={(e) => applyView(e.target.value)}
          aria-label="Saved dashboards"
        >
          <option value="">Saved dashboards…</option>
          {views.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
        <button type="button" className="btn-secondary btn-sm" onClick={saveView}>Save dashboard</button>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setManageOpen((o) => !o)}>
          Manage list
        </button>
        <button type="button" className="btn-primary btn-sm" onClick={shareDashboard}>
          Share this dashboard
        </button>
        <a className="btn-secondary btn-sm" href={`/api/admin/analytics/reports?${queryString}&format=csv`}>
          Export data CSV
        </a>
        <button type="button" className="btn-secondary btn-sm" onClick={exportSetupCsv}>
          Export setup CSV
        </button>
        <label className="btn-secondary btn-sm file-btn">
          Import setup CSV
          <input
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importSetupCsv(f);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {manageOpen && (
        <div className="analytics-manage-list">
          <h4>Saved dashboards</h4>
          {views.length === 0 && <p>No saved dashboards yet.</p>}
          <ul>
            {views.map((v) => (
              <li key={v.id}>
                <button type="button" className="linkish" onClick={() => applyView(v.id)}>{v.name}</button>
                <span>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => renameView(v.id, v.name)}>Rename</button>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => deleteView(v.id)}>Delete</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sharePath && (
        <div className="analytics-share-box">
          <p>Anyone with this link can view this dashboard (no login):</p>
          <ShareSheet urlPath={sharePath} title="Shared FixMyDistrict analytics" text="Open this analytics dashboard" />
        </div>
      )}

      <div className="analytics-import-data">
        <h4>Import data CSV (photos optional)</h4>
        <div className="analytics-dashboard-row">
          <input
            value={datasetKey}
            onChange={(e) => setDatasetKey(e.target.value)}
            placeholder="dataset key"
          />
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={useStockPhotos}
              onChange={(e) => setUseStockPhotos(e.target.checked)}
            />
            Stock photos when missing
          </label>
          <a className="btn-secondary btn-sm" href="/api/admin/analytics/import-csv">
            Download template
          </a>
          <label className="btn-primary btn-sm file-btn">
            Upload data CSV
            <input
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importDataCsv(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {importResult && <p className="analytics-hint">{importResult}</p>}
      </div>

      {message && <p className="analytics-hint">{message}</p>}
    </div>
  );
}
