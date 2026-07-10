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

  useEffect(() => {
    fetch('/api/trending')
      .then((r) => r.ok ? r.json() : [])
      .then(setItems)
      .catch(() => {});

    fetch('/api/saved-searches')
      .then((r) => r.ok ? r.json() : [])
      .then(setSavedSearches)
      .catch(() => {});
  }, []);

  return (
    <>
      <div className="trending-box">
        <h3>Trending in your District</h3>
        {items.length === 0 ? (
          <p className="trending-empty">No trending reports yet.</p>
        ) : (
          items.map((item) => (
            <Link key={item.id} href={`/dashboard/reports/${item.id}`} className="trending-item">
              <div className="trending-category">{item.category || 'General'}</div>
              <div className="trending-topic">{item.title}</div>
              <div className="trending-meta">
                {item.upvoteCount} upvotes · {item.commentCount} comments
              </div>
            </Link>
          ))
        )}
      </div>

      {savedSearches.length > 0 && (
        <div className="trending-box" style={{ marginTop: '16px' }}>
          <h3>Saved Searches</h3>
          {savedSearches.map((s) => {
            const q = JSON.parse(s.queryJson);
            const params = new URLSearchParams(q).toString();
            return (
              <Link key={s.id} href={`/dashboard?${params}`} className="trending-item">
                <div className="trending-topic">{s.name}</div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
