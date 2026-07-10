'use client';

import React, { useEffect, useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import ReportFilters from '../../../components/ReportFilters';

const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => <div className="feed-empty">Loading map...</div>,
});

function ExploreContent() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState({
    category: searchParams.get('category') || '',
    status: searchParams.get('status') || '',
    severity: searchParams.get('severity') || '',
    keyword: searchParams.get('keyword') || '',
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const queryString = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v)
  ).toString();

  return (
    <>
      <div className="feed-header">
        <h2>Explore Map</h2>
        <ReportFilters filters={filters} onChange={handleFilterChange} />
        <div className="map-legend">
          <span className="legend-dot legend-high">High (4-5)</span>
          <span className="legend-dot legend-med">Medium (3)</span>
          <span className="legend-dot legend-low">Low (1-2)</span>
        </div>
      </div>
      <MapComponent queryString={queryString} />
    </>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="feed-empty">Loading...</div>}>
      <ExploreContent />
    </Suspense>
  );
}
