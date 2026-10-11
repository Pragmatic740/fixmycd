'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ReportCard from '../../components/ReportCard';
import ReportFilters, {
  EMPTY_REPORT_FILTERS,
  filtersFromParams,
  filtersToParams,
  type ReportFilterValues,
} from '../../components/ReportFilters';
import { useCurrentUser } from '../../components/CurrentUserContext';
import { useApproxLocation } from '../../components/useApproxLocation';
import type { ReportListItem } from '../../lib/types';

const PAGE_SIZE = 20;
/** "Nearby" tab radius when no distance filter is set. */
const NEARBY_KM = 5;
const KEYWORD_DEBOUNCE_MS = 300;

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
  const router = useRouter();
  const { user } = useCurrentUser();
  const location = useApproxLocation();
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedType, setFeedType] = useState<'local' | 'global'>('global');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportFilterValues>(() => filtersFromParams(new URLSearchParams(searchParams.toString())));
  const [keywordInput, setKeywordInput] = useState(filters.keyword);

  const activeFilterCount = (Object.keys(EMPTY_REPORT_FILTERS) as (keyof ReportFilterValues)[]).filter(
    (k) => filters[k]
  ).length;

  // Debounce the search box so each keystroke doesn't trigger a request.
  useEffect(() => {
    if (keywordInput === filters.keyword) return;
    const t = setTimeout(() => setFilters((prev) => ({ ...prev, keyword: keywordInput.trim() })), KEYWORD_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [keywordInput, filters.keyword]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // Sync filters → URL (shareable, survives reload)
  useEffect(() => {
    const qs = filtersToParams(filters).toString();
    const radius = filters.radiusKm ? `${qs ? '&' : ''}radiusKm=${encodeURIComponent(filters.radiusKm)}` : '';
    const next = qs || radius ? `/dashboard?${qs}${radius}` : '/dashboard';
    router.replace(next, { scroll: false });
  }, [filters, router]);

  const buildQuery = useCallback(
    (currentOffset: number) => {
      const effective =
        feedType === 'local' && !filters.radiusKm ? { ...filters, radiusKm: String(NEARBY_KM) } : filters;
      const params = filtersToParams(effective, location);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(currentOffset));
      return params.toString();
    },
    [filters, feedType, location]
  );

  // First page: refetch whenever the query changes. "Loading" is derived from
  // whether the last completed request matches the current query.
  const firstPageQuery = buildQuery(0);
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const loading = loadedQuery !== `${firstPageQuery}#${retryCount}`;

  useEffect(() => {
    const controller = new AbortController();
    const key = `${firstPageQuery}#${retryCount}`;
    (async () => {
      try {
        const res = await fetch(`/api/reports?${firstPageQuery}`, { signal: controller.signal });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error === 'Invalid input' ? 'Some filters are invalid. Please adjust them.' : 'Could not load reports.');
          setReports([]);
          setHasMore(false);
        } else {
          const data: ReportListItem[] = await res.json();
          setError(null);
          setReports(data);
          setHasMore(data.length === PAGE_SIZE);
        }
        setOffset(0);
        setLoadedQuery(key);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError('Could not load reports. Check your connection.');
        setLoadedQuery(key);
      }
    })();
    return () => controller.abort();
  }, [firstPageQuery, retryCount]);

  const loadMore = async () => {
    const next = offset + PAGE_SIZE;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/reports?${buildQuery(next)}`);
      if (res.ok) {
        const data: ReportListItem[] = await res.json();
        setReports((prev) => [...prev, ...data]);
        setHasMore(data.length === PAGE_SIZE);
        setOffset(next);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const handleFilterChange = (key: keyof ReportFilterValues, value: string) => {
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
    if (!name?.trim()) return;
    const res = await fetch('/api/saved-searches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim().slice(0, 80), queryJson: filters }),
    });
    const data = res.ok ? null : await res.json().catch(() => null);
    setToast(res.ok ? 'Search saved' : data?.error || 'Could not save this search');
  };

  const clearFilters = () => {
    setKeywordInput('');
    setFilters(EMPTY_REPORT_FILTERS);
  };

  const usesLocation = !!filters.radiusKm || feedType === 'local';
  const locationNote =
    usesLocation && location.source === 'fallback'
      ? 'Location unavailable — showing distances from Harare city centre. Allow location access for results near you.'
      : null;
  const filteredReports = reports;

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
            <ReportFilters
              filters={filters}
              keywordInput={keywordInput}
              onKeywordInput={setKeywordInput}
              onChange={handleFilterChange}
              onSaveSearch={user ? handleSaveSearch : undefined}
              radiusNote={locationNote}
            />
            {activeFilterCount > 0 && (
              <button type="button" className="clear-filters-btn" onClick={clearFilters}>
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {feedType === 'local' && locationNote && <div className="feed-notice">{locationNote}</div>}
      {error && (
        <div className="feed-notice feed-notice-error" role="alert">
          {error}{' '}
          <button type="button" className="btn-secondary btn-sm" onClick={() => setRetryCount((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}

      <div className="feed-list">
        {loading && reports.length === 0 ? (
          <FeedSkeleton />
        ) : filteredReports.length === 0 ? (
          <div className="feed-empty feed-empty-rich">
            <div className="feed-empty-icon">📍</div>
            <h3>
              {feedType === 'local' ? 'Nothing nearby yet' : 'No matching reports'}
            </h3>
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

        {hasMore && !loading && filteredReports.length > 0 && (
          <button
            className="btn-secondary load-more-btn"
            onClick={() => void loadMore()}
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