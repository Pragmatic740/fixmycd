'use client';

import React, { useCallback, useEffect, useState } from 'react';
import ShareSheet from '@/components/ShareSheet';
import { downloadBlob, downloadTextFile } from '@/lib/download-file';

type Filters = Record<string, string>;

interface SavedView {
  id: string;
  name: string;
  description: string | null;
  filters: Filters;
  createdAt?: string;
  updatedAt?: string;
}

interface Props {
  filters: Filters;
  setFilters: (next: Filters | ((prev: Filters) => Filters)) => void;
  queryString: string;
}

function formatViewLabel(v: SavedView): string {
  const date = v.updatedAt
    ? new Date(v.updatedAt).toISOString().slice(0, 10)
    : '';
  const desc = v.description?.trim();
  if (desc && date) return `${v.name} — ${desc} (${date})`;
  if (desc) return `${v.name} — ${desc}`;
  if (date) return `${v.name} (${date})`;
  return v.name;
}

export default function AnalyticsDashboardControls({ filters, setFilters, queryString }: Props) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [selectedViewId, setSelectedViewId] = useState('');
  const [manageOpen, setManageOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [sharePath, setSharePath] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [datasetKey, setDatasetKey] = useState(`csv-import-${new Date().toISOString().slice(0, 10)}`);
  const [useStockPhotos, setUseStockPhotos] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadViews = useCallback(async () => {
    const res = await fetch('/api/admin/analytics/views');
    const data = await res.json();
    if (Array.isArray(data)) setViews(data);
  }, []);

  useEffect(() => {
    loadViews();
  }, [loadViews]);

  const selectedView = views.find((v) => v.id === selectedViewId);

  const applyView = (id: string) => {
    setSelectedViewId(id);
    const view = views.find((v) => v.id === id);
    if (!view) return;
    setFilters((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (k in view.filters) next[k] = String((view.filters as Record<string, unknown>)[k] ?? '');
        else if (!['mapLevel', 'metric', 'groupBy', 'bucket'].includes(k)) next[k] = '';
      });
      Object.entries(view.filters).forEach(([k, v]) => {
        if (k === 'bbox' || v == null || typeof v === 'object') return;
        next[k] = String(v);
      });
      const bbox = (view.filters as { bbox?: { west?: number; south?: number; east?: number; north?: number } }).bbox;
      if (bbox && bbox.west != null && bbox.south != null && bbox.east != null && bbox.north != null) {
        next.west = String(bbox.west);
        next.south = String(bbox.south);
        next.east = String(bbox.east);
        next.north = String(bbox.north);
      }
      return next;
    });
  };

  const persistView = async (overwrite: boolean) => {
    const name = saveName.trim();
    if (!name) {
      setMessage('Enter a dashboard name');
      return;
    }
    const res = await fetch('/api/admin/analytics/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description: saveDescription.trim().slice(0, 40),
        filters,
        overwrite,
      }),
    });
    const data = await res.json();
    if (res.status === 409 && !overwrite) {
      if (window.confirm(`A dashboard named “${name}” already exists. Overwrite it?`)) {
        await persistView(true);
      }
      return;
    }
    if (!res.ok) {
      setMessage(data.error || 'Save failed');
      return;
    }
    setMessage(data.overwritten ? `Overwrote “${data.name}”` : `Saved “${data.name}”`);
    setSaveOpen(false);
    setSaveName('');
    setSaveDescription('');
    await loadViews();
    setSelectedViewId(data.id);
  };

  const openSavePanel = () => {
    const current = selectedView;
    setSaveName(current?.name || '');
    setSaveDescription(current?.description || '');
    setSaveOpen(true);
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

  const exportSetupCsv = async () => {
    const lines = ['key,value'];
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== '' && v != null) lines.push(`${k},${JSON.stringify(String(v))}`);
    });
    await downloadTextFile(`\uFEFF${lines.join('\n')}`, `dashboard-setup-${Date.now()}.csv`);
  };

  const exportDataCsv = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/admin/analytics/reports?${queryString}&format=csv`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error || 'Export failed');
        return;
      }
      const blob = await res.blob();
      await downloadBlob(blob, `fixmydistrict-reports-${Date.now()}.csv`);
    } finally {
      setExporting(false);
    }
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
            <option key={v.id} value={v.id}>{formatViewLabel(v)}</option>
          ))}
        </select>
        <button type="button" className="btn-secondary btn-sm" onClick={openSavePanel}>
          Save dashboard
        </button>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setManageOpen((o) => !o)}>
          Manage list
        </button>
        <button type="button" className="btn-primary btn-sm" onClick={shareDashboard}>
          Share this dashboard
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={exportDataCsv}
          disabled={exporting}
        >
          {exporting ? 'Exporting…' : 'Export data CSV'}
        </button>
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

      <p className="analytics-hint">
        Setup CSV saves/restores filter parameters only. Data CSV exports report rows (use Upload data CSV below to import inventory).
      </p>

      {selectedView && (
        <p className="analytics-hint">
          Showing reports for: <strong>{selectedView.name}</strong>
          {selectedView.description ? ` — ${selectedView.description}` : ''}
        </p>
      )}

      {saveOpen && (
        <div className="analytics-save-panel">
          <h4>Save dashboard</h4>
          <div className="analytics-dashboard-row">
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Dashboard name"
              aria-label="Dashboard name"
            />
            <input
              value={saveDescription}
              onChange={(e) => setSaveDescription(e.target.value.slice(0, 40))}
              placeholder="Title / description (max 40)"
              maxLength={40}
              aria-label="Dashboard description"
            />
            <span className="analytics-hint">{saveDescription.length}/40</span>
            <button type="button" className="btn-primary btn-sm" onClick={() => persistView(false)}>
              Save
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setSaveOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {manageOpen && (
        <div className="analytics-manage-list">
          <h4>Saved dashboards</h4>
          {views.length === 0 && <p>No saved dashboards yet.</p>}
          <ul>
            {views.map((v) => (
              <li key={v.id}>
                <button type="button" className="linkish" onClick={() => applyView(v.id)}>
                  {formatViewLabel(v)}
                </button>
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
