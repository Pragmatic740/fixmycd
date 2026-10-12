'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

export interface ResolvedLocation {
  addressLine: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  county: string;
  countryCode: string;
  latitude: number;
  longitude: number;
}

interface PinPickerMapProps {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number) => void;
  /** Called with the address of the pin; `null` when no address was found. */
  onLocationChange?: (location: ResolvedLocation | null) => void;
  /** Bump this to re-run reverse geocoding for the current pin (e.g. after "Use my location"). */
  resolveToken?: number;
}

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Keep the map centred on the pin when it moves for reasons other than a click. */
function MapRecenter({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  useEffect(() => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    if (!map.getBounds().pad(-0.2).contains([latitude, longitude])) {
      map.setView([latitude, longitude], map.getZoom(), { animate: true });
    }
  }, [map, latitude, longitude]);
  return null;
}

const pinIcon = L.divIcon({
  html: `<div style="background:#8b5cf6;width:20px;height:20px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>`,
  className: 'pin-picker-marker',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

type GeocodeJson = Omit<ResolvedLocation, 'latitude' | 'longitude'> & { lat: number; lng: number; error?: string };

const toResolved = (d: GeocodeJson): ResolvedLocation => ({
  addressLine: d.addressLine || '',
  city: d.city || '',
  stateProvince: d.stateProvince || '',
  postalCode: d.postalCode || '',
  county: d.county || '',
  countryCode: d.countryCode || '',
  latitude: d.lat,
  longitude: d.lng,
});

export default function PinPickerMap({ latitude, longitude, onChange, onLocationChange, resolveToken }: PinPickerMapProps) {
  const [status, setStatus] = useState<{ kind: 'busy' | 'error'; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const valid = Number.isFinite(latitude) && Number.isFinite(longitude);

  // Error toasts clear themselves.
  useEffect(() => {
    if (status?.kind !== 'error') return;
    const t = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => () => abortRef.current?.abort(), []);

  /** Run one geocode request, cancelling any still in flight (rapid clicks). */
  const lookup = async (params: URLSearchParams, busyText: string): Promise<GeocodeJson | null> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus({ kind: 'busy', text: busyText });
    try {
      const res = await fetch(`/api/geocode?${params}`, { signal: controller.signal });
      const data: GeocodeJson = await res.json();
      if (controller.signal.aborted) return null;
      if (!res.ok) {
        setStatus({ kind: 'error', text: res.status === 429 ? 'Too many lookups — wait a moment' : data.error || 'Address lookup failed' });
        return null;
      }
      setStatus(null);
      return data;
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setStatus({ kind: 'error', text: 'Address lookup failed' });
      return null;
    }
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    if (!onLocationChange) return;
    const data = await lookup(new URLSearchParams({ lat: String(lat), lng: String(lng) }), 'Resolving location…');
    onLocationChange(data ? toResolved({ ...data, lat, lng }) : null);
  };

  const pick = (lat: number, lng: number) => {
    onChange(lat, lng);
    void reverseGeocode(lat, lng);
  };

  // Re-resolve when the parent asks (e.g. after "Use my location").
  const lastToken = useRef(resolveToken);
  useEffect(() => {
    if (resolveToken === undefined || resolveToken === lastToken.current) return;
    lastToken.current = resolveToken;
    if (!valid) return;
    // Short delay also debounces coordinates typed into the inputs.
    const t = setTimeout(() => void reverseGeocode(latitude, longitude), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the token changes
  }, [resolveToken]);

  const search = async (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 3) return;
    const data = await lookup(new URLSearchParams({ q }), 'Searching…');
    if (!data) return;
    onChange(data.lat, data.lng);
    onLocationChange?.(toResolved(data));
  };

  return (
    <div className="pin-picker-wrapper">
      <div className="pin-picker-search">
        <input
          type="search"
          value={query}
          maxLength={200}
          placeholder="Search address or ZIP"
          aria-label="Search for an address or ZIP code"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void search(e);
          }}
        />
        <button type="button" className="btn-secondary btn-sm" onClick={(e) => void search(e)} disabled={query.trim().length < 3}>
          Find
        </button>
      </div>
      <MapContainer
        center={valid ? [latitude, longitude] : [0, 0]}
        zoom={14}
        style={{ width: '100%', height: '200px', borderRadius: '8px' }}
        scrollWheelZoom={false}
      >
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ClickHandler onPick={pick} />
        {valid && <MapRecenter latitude={latitude} longitude={longitude} />}
        {valid && <Marker position={[latitude, longitude]} icon={pinIcon} />}
      </MapContainer>

      {status && (
        <div className={`pin-picker-status ${status.kind === 'error' ? 'pin-picker-status-error' : ''}`} role="status">
          {status.kind === 'busy' ? '⟳ ' : '⚠️ '}
          {status.text}
        </div>
      )}

      <p className="pin-picker-hint">Click the map to set the location</p>
    </div>
  );
}
