'use client';

import React, { Suspense } from 'react';
import AnalyticsContent from './AnalyticsContent';

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="feed-empty">Loading analytics…</div>}>
      <AnalyticsContent />
    </Suspense>
  );
}
