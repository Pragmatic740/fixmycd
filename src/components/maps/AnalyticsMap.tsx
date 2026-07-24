'use client';

import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMapEvents, GeoJSON, useMap } from 'react-leaflet';
import type { MapAreaAggregate, MapPoint } from '@/lib/analytics-types';
import L from 'leaflet';

type GeoFeatureCollection = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties?: Record<string, unknown> | null;
    geometry: unknown;
  }>;
};

export type MapBounds = { west: number; south: number; east: number; north: number };

interface AnalyticsMapProps {
  points: MapPoint[];
  areas: MapAreaAggregate[];
  boundaries: GeoFeatureCollection | null;
  metric: string;
  radiusLat?: number;
  radiusLng?: number;
  radiusKm?: number;
  onRadiusPick?: (lat: number, lng: number) => void;
  /** When false, skip auto-fitting to points (map-extent filter mode). Default true. */
  fitToPoints?: boolean;
  onBoundsChange?: (bounds: MapBounds) => void;
}

function metricValue(area: MapAreaAggregate, metric: string): number {
  switch (metric) {
    case 'criticalCount':
      return area.criticalCount;
    case 'avgSeverity':
      return area.avgSeverity ?? 0;
    case 'unresolvedRate':
      return area.unresolvedRate;
    case 'estimatedCost':
      return area.estimatedCost;
    case 'peopleAffected':
      return area.peopleAffected;
    default:
      return area.count;
  }
}

function colorScale(value: number, max: number) {
  if (max <= 0 || value <= 0) return '#1f2937';
  const t = Math.min(1, value / max);
  if (t < 0.25) return '#3b82f6';
  if (t < 0.5) return '#eab308';
  if (t < 0.75) return '#f97316';
  return '#ef4444';
}

function boundsFromMap(map: L.Map): MapBounds {
  const b = map.getBounds();
  return {
    west: b.getWest(),
    south: b.getSouth(),
    east: b.getEast(),
    north: b.getNorth(),
  };
}

function ClickRadius({ onRadiusPick }: { onRadiusPick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onRadiusPick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function BoundsTracker({ onBoundsChange }: { onBoundsChange?: (bounds: MapBounds) => void }) {
  const map = useMap();
  useMapEvents({
    moveend() {
      onBoundsChange?.(boundsFromMap(map));
    },
    zoomend() {
      onBoundsChange?.(boundsFromMap(map));
    },
  });
  useEffect(() => {
    onBoundsChange?.(boundsFromMap(map));
  }, [map, onBoundsChange]);
  return null;
}

function FitBounds({ points, enabled }: { points: MapPoint[]; enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled) return;
    if (points.length === 0) {
      map.setView([39.8283, -98.5795], 4);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude] as [number, number]));
    map.fitBounds(bounds.pad(0.2));
  }, [points, map, enabled]);
  return null;
}

export default function AnalyticsMap({
  points,
  areas,
  boundaries,
  metric,
  radiusLat,
  radiusLng,
  radiusKm,
  onRadiusPick,
  fitToPoints = true,
  onBoundsChange,
}: AnalyticsMapProps) {
  const areaMap = useMemo(() => {
    const m = new Map<string, MapAreaAggregate>();
    for (const a of areas) {
      m.set(a.areaKey.toLowerCase(), a);
      m.set(a.areaName.toLowerCase(), a);
    }
    return m;
  }, [areas]);

  const maxMetric = useMemo(() => {
    return Math.max(0, ...areas.map((a) => metricValue(a, metric)));
  }, [areas, metric]);

  const styleFeature = (feature?: GeoJSON.Feature) => {
    const props = feature?.properties as { id?: string; name?: string; geoid?: string } | undefined;
    const keys = [props?.geoid, props?.id, props?.name].filter(Boolean).map((k) => String(k).toLowerCase());
    let area: MapAreaAggregate | undefined;
    for (const k of keys) {
      area = areaMap.get(k);
      if (area) break;
      for (const [ak, av] of areaMap) {
        if (ak.includes(k) || k.includes(ak)) {
          area = av;
          break;
        }
      }
      if (area) break;
    }
    const value = area ? metricValue(area, metric) : 0;
    return {
      fillColor: area ? colorScale(value, maxMetric) : '#111827',
      weight: 1,
      opacity: 0.8,
      color: '#9ca3af',
      fillOpacity: area ? 0.55 : 0.15,
    };
  };

  const onEachFeature = (feature: GeoJSON.Feature, layer: L.Layer) => {
    const props = feature.properties as { id?: string; name?: string; geoid?: string };
    const keys = [props?.geoid, props?.id, props?.name].filter(Boolean).map((k) => String(k).toLowerCase());
    let area: MapAreaAggregate | undefined;
    for (const k of keys) {
      area = areaMap.get(k);
      if (area) break;
    }
    const label = props?.name || props?.id || 'Area';
    const html = area
      ? `<strong>${label}</strong><br/>${metric}: ${metricValue(area, metric).toLocaleString(undefined, { maximumFractionDigits: 2 })}<br/>Reports: ${area.count}`
      : `<strong>${label}</strong><br/>No matching reports`;
    layer.bindPopup(html);
  };

  return (
    <div className="analytics-map-wrapper">
      <MapContainer center={[39.8283, -98.5795]} zoom={4} style={{ width: '100%', height: '420px', borderRadius: 12 }}>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} enabled={fitToPoints} />
        <BoundsTracker onBoundsChange={onBoundsChange} />
        <ClickRadius onRadiusPick={onRadiusPick} />

        {boundaries && (
          <GeoJSON
            key={`${metric}-${areas.length}-${boundaries.features?.length || 0}`}
            data={boundaries}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        )}

        {points.slice(0, 400).map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.latitude, p.longitude]}
            radius={5}
            pathOptions={{
              color: '#fff',
              weight: 1,
              fillColor: (p.severity ?? 1) >= 4 ? '#ef4444' : (p.severity ?? 1) >= 3 ? '#eab308' : '#3b82f6',
              fillOpacity: 0.85,
            }}
          >
            <Popup>
              <strong>{p.title}</strong>
              <br />
              Severity {p.severity ?? '—'} · {p.status}
              {p.estimatedCost != null && (
                <>
                  <br />
                  Est. ${p.estimatedCost.toLocaleString()}
                </>
              )}
              <br />
              <a href={`/dashboard/reports/${p.id}`}>Open report</a>
            </Popup>
          </CircleMarker>
        ))}

        {radiusLat != null && radiusLng != null && radiusKm != null && radiusKm > 0 && (
          <Circle
            center={[radiusLat, radiusLng]}
            radius={radiusKm * 1000}
            pathOptions={{ color: '#8b5cf6', fillColor: '#8b5cf6', fillOpacity: 0.12 }}
          />
        )}
      </MapContainer>
      <div className="choropleth-legend">
        <span>Low</span>
        <span className="leg-swatch" style={{ background: '#3b82f6' }} />
        <span className="leg-swatch" style={{ background: '#eab308' }} />
        <span className="leg-swatch" style={{ background: '#f97316' }} />
        <span className="leg-swatch" style={{ background: '#ef4444' }} />
        <span>High</span>
        <span className="leg-hint">Click map to set radius center</span>
      </div>
    </div>
  );
}
