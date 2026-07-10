'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface TrendingItem {
  id: string;
  title: string;
  category: string | null;
  upvoteCount: number;
  commentCount: number;
}

export default function TrendingSidebar() {
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [savedSearches, setSavedSearches] = useState<{ id: string; name: string; queryJson: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/trending').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/saved-searches').then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([trending, saved]) => {
        setItems(trending);
        setSavedSearches(saved);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="trending-box">
        <h3>Trending nearby</h3>
        {loading ? (
          <div className="trending-skeleton">
            <div className="skeleton-line shimmer" />
            <div className="skeleton-line shimmer medium" />
            <div className="skeleton-line shimmer short" />
          </div>
        ) : items.length === 0 ? (
          <p className="trending-empty">No trending reports yet — upvote issues to surface them.</p>
        ) : (
          items.map((item, i) => (
            <Link key={item.id} href={`/dashboard/reports/${item.id}`} className="trending-item">
              <div className="trending-rank">{i + 1}</div>
              <div className="trending-item-body">
                <div className="trending-category">{item.category || 'General'}</div>
                <div className="trending-topic">{item.title}</div>
                <div className="trending-meta">
                  {item.upvoteCount} upvotes · {item.commentCount} comments
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {savedSearches.length > 0 && (
        <div className="trending-box" style={{ marginTop: '16px' }}>
          <h3>Saved searches</h3>
          {savedSearches.map((s) => {
            let params = '';
            try {
              params = new URLSearchParams(JSON.parse(s.queryJson)).toString();
            } catch {
              params = '';
            }
            return (
              <Link key={s.id} href={`/dashboard?${params}`} className="trending-item">
                <div className="trending-item-body">
                  <div className="trending-topic">{s.name}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
