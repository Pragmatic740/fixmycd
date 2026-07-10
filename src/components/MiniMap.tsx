'use client';

import React from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';

const pinIcon = L.divIcon({
  html: `<div style="background:#ef4444;width:14px;height:14px;border-radius:50%;border:2px solid #fff"></div>`,
  className: 'mini-map-marker',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export default function MiniMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  return (
    <div className="mini-map-wrapper">
      <MapContainer center={[latitude, longitude]} zoom={15} style={{ width: '100%', height: '180px', borderRadius: '8px' }} scrollWheelZoom={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[latitude, longitude]} icon={pinIcon} />
      </MapContainer>
    </div>
  );
}
