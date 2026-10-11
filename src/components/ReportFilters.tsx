'use client';

import React from 'react';
import { CATEGORIES, REPORT_STATUSES } from '../lib/categories';

export interface ReportFilterValues {
  category: string;
  status: string;
  severityMin: string;
  severityMax: string;
  keyword: string;
  startDate: string;
  endDate: string;
  radiusKm: string;
  endorsed: string;
}

export const EMPTY_REPORT_FILTERS: ReportFilterValues = {
  category: '',
  status: '',
  severityMin: '',
  severityMax: '',
  keyword: '',
  startDate: '',
  endDate: '',
  radiusKm: '',
  endorsed: '',
};

/** Read filters from the URL (accepts the older single ?severity= too). */
export function filtersFromParams(params: URLSearchParams): ReportFilterValues {
  const legacySeverity = params.get('severity') || '';
  return {
    category: params.get('category') || '',
    status: params.get('status') || '',
    severityMin: params.get('severityMin') || legacySeverity,
    severityMax: params.get('severityMax') || legacySeverity,
    keyword: params.get('keyword') || '',
    startDate: params.get('startDate') || '',
    endDate: params.get('endDate') || '',
    radiusKm: params.get('radiusKm') || '',
    endorsed: params.get('endorsed') === 'true' ? 'true' : '',
  };
}

/** Query parameters for /api/reports (radius needs a centre, supplied by the caller). */
export function filtersToParams(
  filters: ReportFilterValues,
  centre?: { latitude: number; longitude: number }
): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of ['category', 'status', 'severityMin', 'severityMax', 'keyword', 'startDate', 'endDate'] as const) {
    if (filters[key]) params.set(key, filters[key]);
  }
  if (filters.endorsed === 'true') params.set('endorsed', 'true');
  const km = Number(filters.radiusKm);
  if (filters.radiusKm && Number.isFinite(km) && km > 0 && centre) {
    params.set('radiusLat', centre.latitude.toFixed(5));
    params.set('radiusLng', centre.longitude.toFixed(5));
    params.set('radiusKm', String(Math.min(500, Math.max(0.1, km))));
  }
  return params;
}

export const statusLabel = (s: string) => s.replace(/_/g, ' ');

interface ReportFiltersProps {
  filters: ReportFilterValues;
  /** The search box value (may run ahead of filters.keyword while debouncing). */
  keywordInput?: string;
  onChange: (key: keyof ReportFilterValues, value: string) => void;
  onKeywordInput?: (value: string) => void;
  onSaveSearch?: () => void;
  /** Shown under the radius box when no device location is available. */
  radiusNote?: string | null;
}

export default function ReportFilters({
  filters,
  keywordInput,
  onChange,
  onKeywordInput,
  onSaveSearch,
  radiusNote,
}: ReportFiltersProps) {
  const clearDates = () => {
    onChange('startDate', '');
    onChange('endDate', '');
  };

  return (
    <div className="report-filters">
      <div className="filter-search-wrap">
        <svg className="filter-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          placeholder="Search reports…"
          value={keywordInput ?? filters.keyword}
          maxLength={100}
          onChange={(e) => (onKeywordInput ? onKeywordInput(e.target.value) : onChange('keyword', e.target.value))}
          className="filter-input"
          aria-label="Search reports"
        />
      </div>

      <select
        value={filters.category}
        onChange={(e) => onChange('category', e.target.value)}
        className="filter-select"
        aria-label="Category"
      >
        <option value="">Category</option>
        {Object.keys(CATEGORIES).map((cat) => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      <select
        value={filters.status}
        onChange={(e) => onChange('status', e.target.value)}
        className="filter-select"
        aria-label="Status"
      >
        <option value="">Status</option>
        {REPORT_STATUSES.map((s) => (
          <option key={s} value={s}>{statusLabel(s)}</option>
        ))}
      </select>

      <div className="filter-severity-group" role="group" aria-label="Severity range">
        <select
          value={filters.severityMin}
          onChange={(e) => onChange('severityMin', e.target.value)}
          className="filter-select"
          aria-label="Minimum severity"
        >
          <option value="">Severity from</option>
          {[1, 2, 3, 4, 5].map((s) => (
            <option key={s} value={String(s)} disabled={!!filters.severityMax && s > Number(filters.severityMax)}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={filters.severityMax}
          onChange={(e) => onChange('severityMax', e.target.value)}
          className="filter-select"
          aria-label="Maximum severity"
        >
          <option value="">to</option>
          {[1, 2, 3, 4, 5].map((s) => (
            <option key={s} value={String(s)} disabled={!!filters.severityMin && s < Number(filters.severityMin)}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-date-group">
        <label className="filter-label">
          From
          <input
            type="date"
            value={filters.startDate}
            max={filters.endDate || undefined}
            onChange={(e) => onChange('startDate', e.target.value)}
            className="filter-input filter-input-date"
          />
        </label>
        <label className="filter-label">
          To
          <input
            type="date"
            value={filters.endDate}
            min={filters.startDate || undefined}
            onChange={(e) => onChange('endDate', e.target.value)}
            className="filter-input filter-input-date"
          />
        </label>
        {(filters.startDate || filters.endDate) && (
          <button type="button" className="filter-clear-inline" onClick={clearDates} aria-label="Clear dates">
            ×
          </button>
        )}
      </div>

      <div className="filter-radius-group">
        <input
          type="number"
          min="1"
          max="500"
          placeholder="Within km"
          value={filters.radiusKm}
          onChange={(e) => onChange('radiusKm', e.target.value)}
          className="filter-input filter-input-radius"
          aria-label="Within kilometres of you"
        />
        {filters.radiusKm && (
          <button type="button" className="filter-clear-inline" onClick={() => onChange('radiusKm', '')} aria-label="Clear distance">
            ×
          </button>
        )}
        {filters.radiusKm && radiusNote && <span className="filter-note">{radiusNote}</span>}
      </div>

      <label className="filter-checkbox">
        <input
          type="checkbox"
          checked={filters.endorsed === 'true'}
          onChange={(e) => onChange('endorsed', e.target.checked ? 'true' : '')}
        />
        Expert endorsed
      </label>

      {onSaveSearch && (
        <button type="button" className="btn-secondary btn-sm" onClick={onSaveSearch}>
          Save search
        </button>
      )}
    </div>
  );
}
