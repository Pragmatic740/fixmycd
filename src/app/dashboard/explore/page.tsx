'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Dynamically import MapComponent with SSR disabled (Leaflet requires window object)
const MapComponent = dynamic(
  () => import('./MapComponent'),
  { 
    ssr: false,
    loading: () => (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--text-secondary)',
        background: 'var(--bg-primary)'
      }}>
        Loading interactive map...
      </div>
    )
  }
);

export default function ExplorePage() {
  return (
    <div className="explore-container">
      <div className="feed-header">
        <h2>Interactive Map</h2>
      </div>
      <MapComponent />
    </div>
  );
}
