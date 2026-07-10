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
      <input
        type="search"
        placeholder="Search reports..."
        value={filters.keyword}
        onChange={(e) => onChange('keyword', e.target.value)}
        className="filter-input"
      />
      <select value={filters.category} onChange={(e) => onChange('category', e.target.value)} className="filter-select">
        <option value="">All categories</option>
        {Object.keys(CATEGORIES).map((cat) => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>
      <select value={filters.status} onChange={(e) => onChange('status', e.target.value)} className="filter-select">
        <option value="">All statuses</option>
        {REPORT_STATUSES.map((s) => (
          <option key={s} value={s}>{s.replace('_', ' ')}</option>
        ))}
      </select>
      <select value={filters.severity} onChange={(e) => onChange('severity', e.target.value)} className="filter-select">
        <option value="">All severity</option>
        {[1, 2, 3, 4, 5].map((s) => (
          <option key={s} value={String(s)}>{s}</option>
        ))}
      </select>
      {onSaveSearch && (
        <button type="button" className="btn-secondary btn-sm" onClick={onSaveSearch}>
          Save search
        </button>
      )}
    </div>
  );
}
