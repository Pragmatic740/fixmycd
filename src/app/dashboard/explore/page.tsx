'use client';

import React, { useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import ReportFilters, { filtersFromParams, filtersToParams, type ReportFilterValues } from '../../../components/ReportFilters';
import { useApproxLocation } from '../../../components/useApproxLocation';

const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => <div className="feed-empty">Loading map...</div>,
});

function ExploreContent() {
  const searchParams = useSearchParams();
  const location = useApproxLocation();
  const [filters, setFilters] = useState<ReportFilterValues>(() =>
    filtersFromParams(new URLSearchParams(searchParams.toString()))
  );

  const handleFilterChange = (key: keyof ReportFilterValues, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // The radius filter is centred on the user's location (or the default centre).
  const queryString = filtersToParams(filters, location).toString();
  const radiusNote =
    location.source === 'fallback'
      ? 'Location unavailable — measuring from Harare city centre.'
      : null;

  return (
    <>
      <div className="feed-header">
        <h2>Explore Map</h2>
        <ReportFilters filters={filters} onChange={handleFilterChange} radiusNote={radiusNote} />
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
