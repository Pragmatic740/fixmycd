'use client';

import React from 'react';
import { CATEGORIES, REPORT_STATUSES } from '../lib/categories';

interface ReportFiltersProps {
  filters: {
    category: string;
    status: string;
    severity: string;
    keyword: string;
  };
  onChange: (key: string, value: string) => void;
  onSaveSearch?: () => void;
}

export default function ReportFilters({ filters, onChange, onSaveSearch }: ReportFiltersProps) {
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
          value={filters.keyword}
          onChange={(e) => onChange('keyword', e.target.value)}
          className="filter-input"
        />
      </div>
      <select value={filters.category} onChange={(e) => onChange('category', e.target.value)} className="filter-select">
        <option value="">Category</option>
        {Object.keys(CATEGORIES).map((cat) => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>
      <select value={filters.status} onChange={(e) => onChange('status', e.target.value)} className="filter-select">
        <option value="">Status</option>
        {REPORT_STATUSES.map((s) => (
          <option key={s} value={s}>{s.replace('_', ' ')}</option>
        ))}
      </select>
      <select value={filters.severity} onChange={(e) => onChange('severity', e.target.value)} className="filter-select">
        <option value="">Severity</option>
        {[1, 2, 3, 4, 5].map((s) => (
          <option key={s} value={String(s)}>{s}</option>
        ))}
      </select>
      {onSaveSearch && (
        <button type="button" className="btn-secondary btn-sm" onClick={onSaveSearch}>
          Save
        </button>
      )}
    </div>
  );
}
