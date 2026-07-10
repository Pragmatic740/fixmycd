'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import ReportCard from '../../components/ReportCard';
import ReportFilters from '../../components/ReportFilters';
import type { ReportListItem } from '../../lib/types';

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function FeedSkeleton() {
  return (
    <div className="feed-skeleton" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="skeleton-card" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="skeleton-avatar shimmer" />
          <div className="skeleton-body">
            <div className="skeleton-line shimmer short" />
            <div className="skeleton-line shimmer" />
            <div className="skeleton-line shimmer medium" />
            <div className="skeleton-image shimmer" />
            <div className="skeleton-actions">
              <div className="skeleton-pill shimmer" />
              <div className="skeleton-pill shimmer" />
              <div className="skeleton-pill shimmer" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardFeed() {
  const searchParams = useSearchParams();
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedType, setFeedType] = useState<'local' | 'global'>('global');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    category: searchParams.get('category') || '',
    status: searchParams.get('status') || '',
    severity: searchParams.get('severity') || '',
    keyword: searchParams.get('keyword') || '',
  });
  const [userCoords, setUserCoords] = useState({ latitude: -17.8292, longitude: 31.0522 });

  const activeFilterCount = [filters.category, filters.status, filters.severity, filters.keyword].filter(Boolean).length;

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const buildQuery = useCallback((currentOffset: number) => {
    const params = new URLSearchParams();
    if (filters.category) params.set('category', filters.category);
    if (filters.status) params.set('status', filters.status);
    if (filters.severity) params.set('severity', filters.severity);
    if (filters.keyword) params.set('keyword', filters.keyword);
    params.set('limit', '20');
    params.set('offset', String(currentOffset));
    return params.toString();
  }, [filters]);

  const fetchReports = useCallback(async (currentOffset: number, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const res = await fetch(`/api/reports?${buildQuery(currentOffset)}`);
      if (res.ok) {
        const data: ReportListItem[] = await res.json();
        setReports((prev) => (append ? [...prev, ...data] : data));
        setHasMore(data.length === 20);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    setOffset(0);
    fetchReports(0, false);
  }, [filters, fetchReports]);

  const filteredReports =
    feedType === 'global'
      ? reports
      : reports.filter(
          (r) => getDistance(userCoords.latitude, userCoords.longitude, r.latitude, r.longitude) <= 2.5
        );

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleUpvoteToggle = (reportId: string, upvoted: boolean) => {
    setReports((prev) =>
      prev.map((r) =>
        r.id === reportId
          ? { ...r, userHasUpvoted: upvoted, upvoteCount: r.upvoteCount + (upvoted ? 1 : -1) }
          : r
      )
    );
  };

  const handleSaveSearch = async () => {
    const name = prompt('Name this search:');
    if (!name) return;
    await fetch('/api/saved-searches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, queryJson: filters }),
    });
    setToast('Search saved');
  };

  const clearFilters = () => {
    setFilters({ category: '', status: '', severity: '', keyword: '' });
  };

  const loadMore = () => {
    const next = offset + 20;
    setOffset(next);
    fetchReports(next, true);
  };

  return (
    <>
      <div className="feed-header feed-header-compact">
        <div className="feed-header-top">
          <h2>Home</h2>
          <button
            type="button"
            className={`filter-toggle ${showFilters || activeFilterCount ? 'active' : ''}`}
            onClick={() => setShowFilters((v) => !v)}
          >
            Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
          </button>
        </div>
        <div className="feed-tabs">
          <button
            className={`feed-tab ${feedType === 'global' ? 'active' : ''}`}
            onClick={() => setFeedType('global')}
          >
            <span>For you</span>
          </button>
          <button
            className={`feed-tab ${feedType === 'local' ? 'active' : ''}`}
            onClick={() => setFeedType('local')}
          >
            <span>Nearby</span>
          </button>
        </div>
        {showFilters && (
          <div className="feed-filters-panel">
            <ReportFilters filters={filters} onChange={handleFilterChange} onSaveSearch={handleSaveSearch} />
            {activeFilterCount > 0 && (
              <button type="button" className="clear-filters-btn" onClick={clearFilters}>
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      <div className="feed-list">
        {loading && reports.length === 0 ? (
          <FeedSkeleton />
        ) : filteredReports.length === 0 ? (
          <div className="feed-empty feed-empty-rich">
            <div className="feed-empty-icon">📍</div>
            <h3>{feedType === 'local' ? 'Nothing nearby yet' : 'No matching reports'}</h3>
            <p>
              {feedType === 'local'
                ? 'Try For you, or report an issue in your area.'
                : 'Adjust filters or be the first to report something.'}
            </p>
            {activeFilterCount > 0 && (
              <button type="button" className="btn-secondary btn-sm" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          filteredReports.map((report, i) => (
            <ReportCard
              key={report.id}
              report={report}
              onUpvoteToggle={handleUpvoteToggle}
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            />
          ))
        )}

        {hasMore && feedType === 'global' && !loading && filteredReports.length > 0 && (
          <button
            className="btn-secondary load-more-btn"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading…' : 'Show more'}
          </button>
        )}
      </div>

      {toast && <div className="feed-toast">{toast}</div>}
    </>
  );
}
