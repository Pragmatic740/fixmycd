'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface PublicReport {
  id: string;
  title: string;
  description: string | null;
  status: string;
  category: string | null;
  subcategory: string | null;
  severity: number | null;
  imageUrl: string | null;
  createdAt: string;
  userDisplayName: string | null;
}

export default function PublicFeedPage() {
  const [reports, setReports] = useState<PublicReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/reports?limit=40')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setReports(data);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="public-page">
      <header className="public-topbar">
        <Link href="/" className="public-brand">
          <img src="/logo.svg" alt="" width={28} height={28} />
          FixMyDistrict
        </Link>
        <div className="public-topbar-actions">
          <Link href="/signup" className="btn-secondary btn-sm">Create account</Link>
          <Link href="/login" className="btn-primary btn-sm">Sign in</Link>
        </div>
      </header>

      <main className="public-feed">
        <h1>Community reports</h1>
        <p className="analytics-subtitle">Browse without signing in. Share any report with a public link.</p>

        {loading && <div className="feed-empty">Loading reports…</div>}
        {!loading && reports.length === 0 && (
          <div className="feed-empty">No public reports yet.</div>
        )}

        <div className="public-feed-list">
          {reports.map((r) => (
            <Link key={r.id} href={`/r/${r.id}`} className="public-feed-card">
              {r.imageUrl && <img src={r.imageUrl} alt="" />}
              <div>
                <h3>{r.title}</h3>
                <p>
                  {r.userDisplayName || 'Community'} · {r.status.replace(/_/g, ' ')}
                  {r.category ? ` · ${r.category}` : ''}
                </p>
                {r.description && (
                  <p className="public-feed-desc">
                    {r.description.length > 140 ? `${r.description.slice(0, 140)}…` : r.description}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
