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

export default function DashboardFeed() {
  const searchParams = useSearchParams();
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedType, setFeedType] = useState<'local' | 'global'>('global');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState({
    category: searchParams.get('category') || '',
    status: searchParams.get('status') || '',
    severity: searchParams.get('severity') || '',
    keyword: searchParams.get('keyword') || '',
  });
  const [userCoords, setUserCoords] = useState({ latitude: -17.8292, longitude: 31.0522 });

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

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
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?${buildQuery(currentOffset)}`);
      if (res.ok) {
        const data: ReportListItem[] = await res.json();
        setReports((prev) => (append ? [...prev, ...data] : data));
        setHasMore(data.length === 20);
      }
    } finally {
      setLoading(false);
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
    alert('Search saved!');
  };

  const loadMore = () => {
    const next = offset + 20;
    setOffset(next);
    fetchReports(next, true);
  };

  return (
    <>
      <div className="feed-header">
        <h2>Feed</h2>
        <div className="feed-tabs">
          <button className={`feed-tab ${feedType === 'global' ? 'active' : ''}`} onClick={() => setFeedType('global')}>
            Global Feed
          </button>
          <button className={`feed-tab ${feedType === 'local' ? 'active' : ''}`} onClick={() => setFeedType('local')}>
            Local (2.5km)
          </button>
        </div>
        <ReportFilters filters={filters} onChange={handleFilterChange} onSaveSearch={handleSaveSearch} />
      </div>

      <div className="feed-list">
        {loading && reports.length === 0 ? (
          <div className="feed-empty">Loading feed...</div>
        ) : filteredReports.length === 0 ? (
          <div className="feed-empty">
            {feedType === 'local'
              ? 'No reports within 2.5km. Try Global Feed or adjust filters.'
              : 'No reports match your filters.'}
          </div>
        ) : (
          filteredReports.map((report) => (
            <ReportCard key={report.id} report={report} onUpvoteToggle={handleUpvoteToggle} />
          ))
        )}

        {hasMore && feedType === 'global' && !loading && (
          <button className="btn-secondary load-more-btn" onClick={loadMore}>
            Load more
          </button>
        )}
      </div>
    </>
  );
}
