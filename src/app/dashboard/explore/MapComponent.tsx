'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import Link from 'next/link';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

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
  userDisplayName: string | null;
}

const createCustomIcon = (severity: number) => {
  const color = severity >= 4 ? '#ef4444' : severity >= 3 ? '#eab308' : '#3b82f6';
  return L.divIcon({
    html: `<div style="background-color:${color};width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px rgba(0,0,0,0.6)"></div>`,
    className: 'custom-leaflet-marker',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
};

const userIcon = L.divIcon({
  html: `<div style="background:#8b5cf6;width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 12px #8b5cf6"></div>`,
  className: 'user-location-marker',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

function ClusterLayer({ reports }: { reports: Report[] }) {
  const map = useMap();

  useEffect(() => {
    // @ts-expect-error leaflet.markercluster extends L
    const group = L.markerClusterGroup();
    reports.forEach((report) => {
      const marker = L.marker([report.latitude, report.longitude], {
        icon: createCustomIcon(report.severity),
      });
      const popupContent = document.createElement('div');
      popupContent.className = 'map-popup-card';
      popupContent.innerHTML = `
        <div class="map-popup-header">${report.title}</div>
        <div style="font-size:10px;color:#888;margin-bottom:6px">Ref: ${report.referenceNo} · ${report.status}</div>
        ${report.imageUrl ? `<img src="${report.imageUrl}" alt="" class="map-popup-image" />` : ''}
        <div class="map-popup-desc">${(report.description || '').substring(0, 100)}</div>
        <a href="/dashboard/reports/${report.id}" style="color:#8b5cf6;font-size:12px">View report →</a>
      `;
      marker.bindPopup(popupContent);
      group.addLayer(marker);
    });
    map.addLayer(group);
    if (reports.length > 0) {
      try {
        map.fitBounds(group.getBounds().pad(0.15));
      } catch {
        map.setView([-17.8292, 31.0522], 13);
      }
    }
    return () => {
      map.removeLayer(group);
    };
  }, [reports, map]);

  return null;
}

export default function MapComponent({ queryString = '' }: { queryString?: string }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const defaultPosition: [number, number] = [-17.8292, 31.0522];

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
      () => {}
    );
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports?${queryString}&limit=100`)
      .then((r) => r.ok ? r.json() : [])
      .then(setReports)
      .finally(() => setLoading(false));
  }, [queryString]);

  if (loading) {
    return <div className="feed-empty map-loading">Loading interactive map...</div>;
  }

  return (
    <div className="map-wrapper">
      <MapContainer center={defaultPosition} zoom={13} style={{ width: '100%', height: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClusterLayer reports={reports} />
        {userPos && (
          <Marker position={userPos} icon={userIcon}>
            <Popup>You are here</Popup>
          </Marker>
        )}
      </MapContainer>
      {reports.length === 0 && (
        <div className="map-empty-overlay">No reports match filters</div>
      )}
    </div>
  );
}
