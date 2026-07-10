'use client';

import React, { Suspense } from 'react';
import DashboardFeed from './FeedContent';

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="feed-empty">Loading feed...</div>}>
      <DashboardFeed />
    </Suspense>
  );
}
