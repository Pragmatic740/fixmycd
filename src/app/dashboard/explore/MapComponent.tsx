'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

interface Report {
  id: string;
  referenceNo: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  severity: number;
  status: string;
  imageUrl: string | null;
  createdAt: string;
  userDisplayName: string | null;
}

// Custom SVG pins based on severity
const createCustomIcon = (severity: number) => {
  // Red = Critical/High, Yellow = Medium, Blue = Low
  const color = severity >= 4 ? '#ef4444' : severity >= 3 ? '#eab308' : '#3b82f6';
  return L.divIcon({
    html: `<div style="
      background-color: ${color}; 
      width: 16px; 
      height: 16px; 
      border-radius: 50%; 
      border: 2px solid #ffffff; 
      box-shadow: 0 0 8px rgba(0,0,0,0.6);
      transition: transform 0.2s ease;
    " class="marker-dot"></div>`,
    className: 'custom-leaflet-marker',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8]
  });
};

export default function MapComponent() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  // Default coordinates (Harare, Zimbabwe where our seeds are centered)
  const defaultPosition: [number, number] = [-17.8292, 31.0522];

  useEffect(() => {
    async function fetchReports() {
      try {
        const response = await fetch('/api/reports');
        if (response.ok) {
          const data = await response.json();
          setReports(data);
        }
      } catch (error) {
        console.error('Failed to fetch reports for map:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchReports();
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'var(--text-secondary)'
      }}>
        Loading interactive map...
      </div>
    );
  }

  return (
    <div className="map-wrapper">
      <MapContainer 
        center={defaultPosition} 
        zoom={13} 
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {reports.map((report) => (
          <Marker 
            key={report.id} 
            position={[report.latitude, report.longitude]}
            icon={createCustomIcon(report.severity)}
          >
            <Popup>
              <div className="map-popup-card">
                <div className="map-popup-header">{report.title}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
                  Ref: {report.referenceNo} • Status: {report.status}
                </div>
                
                {report.imageUrl && (
                  <img 
                    src={report.imageUrl} 
                    alt={report.title} 
                    className="map-popup-image"
                  />
                )}

                <div className="map-popup-desc">
                  {report.description ? report.description.substring(0, 100) + (report.description.length > 100 ? '...' : '') : 'No description provided.'}
                </div>

                <div className="map-popup-footer">
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: report.severity >= 4 ? '#ef4444' : report.severity >= 3 ? '#eab308' : '#3b82f6'
                  }}>
                    Severity: {report.severity}/5
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                    By {report.userDisplayName || 'Anonymous'}
                  </span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
