/** TIGERweb boundary helpers — https://tigerweb.geo.census.gov */

const TIGER_BASE = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb';

export type TigerLayer =
  | 'states'
  | 'counties'
  | 'tracts'
  | 'congressional'
  | 'state_legislative'
  | 'school';

const LAYER_PATHS: Record<TigerLayer, { service: string; layerId: number; nameField: string; idField: string }> = {
  states: { service: 'State_County', layerId: 0, nameField: 'NAME', idField: 'GEOID' },
  counties: { service: 'State_County', layerId: 1, nameField: 'NAME', idField: 'GEOID' },
  tracts: { service: 'Tracts_Blocks', layerId: 0, nameField: 'GEOID', idField: 'GEOID' },
  congressional: { service: 'Legislative', layerId: 0, nameField: 'BASENAME', idField: 'GEOID' },
  state_legislative: { service: 'Legislative', layerId: 1, nameField: 'BASENAME', idField: 'GEOID' },
  school: { service: 'School', layerId: 0, nameField: 'NAME', idField: 'GEOID' },
};

export interface BoundaryFeature {
  type: 'Feature';
  properties: {
    id: string;
    name: string;
    geoid?: string;
    source: string;
    vintage: string;
  };
  geometry: GeoJSON.Geometry;
}

export interface BoundaryCollection {
  type: 'FeatureCollection';
  features: BoundaryFeature[];
  meta: {
    layer: TigerLayer;
    source: string;
    vintage: string;
    count: number;
  };
}

const boundaryCache = new Map<string, { expires: number; data: BoundaryCollection }>();

export async function fetchTigerBoundaries(
  layer: TigerLayer,
  bbox?: { west: number; south: number; east: number; north: number },
  where?: string
): Promise<BoundaryCollection> {
  const cfg = LAYER_PATHS[layer];
  const cacheKey = `${layer}:${JSON.stringify(bbox)}:${where || ''}`;
  const cached = boundaryCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.data;

  const url = new URL(`${TIGER_BASE}/${cfg.service}/MapServer/${cfg.layerId}/query`);
  url.searchParams.set('where', where || '1=1');
  url.searchParams.set('outFields', `${cfg.idField},${cfg.nameField},GEOID,STATE,NAME,BASENAME`);
  url.searchParams.set('returnGeometry', 'true');
  url.searchParams.set('outSR', '4326');
  url.searchParams.set('f', 'geojson');
  url.searchParams.set('resultRecordCount', '500');

  if (bbox) {
    url.searchParams.set('geometry', `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`);
    url.searchParams.set('geometryType', 'esriGeometryEnvelope');
    url.searchParams.set('inSR', '4326');
    url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
  }

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      return emptyCollection(layer);
    }
    const geojson = await res.json();
    const features: BoundaryFeature[] = (geojson.features || []).map(
      (f: { properties?: Record<string, string>; geometry: GeoJSON.Geometry }) => {
        const props = f.properties || {};
        const geoid = props.GEOID || props[cfg.idField] || props.STATE || 'unknown';
        const name = props.NAME || props.BASENAME || props[cfg.nameField] || geoid;
        return {
          type: 'Feature' as const,
          properties: {
            id: geoid,
            name,
            geoid,
            source: 'TIGERweb',
            vintage: 'Current',
          },
          geometry: f.geometry,
        };
      }
    );

    const data: BoundaryCollection = {
      type: 'FeatureCollection',
      features,
      meta: {
        layer,
        source: 'TIGERweb',
        vintage: 'Current',
        count: features.length,
      },
    };
    boundaryCache.set(cacheKey, { expires: Date.now() + 1000 * 60 * 30, data });
    return data;
  } catch {
    return emptyCollection(layer);
  }
}

function emptyCollection(layer: TigerLayer): BoundaryCollection {
  return {
    type: 'FeatureCollection',
    features: [],
    meta: { layer, source: 'TIGERweb', vintage: 'Current', count: 0 },
  };
}

export function mapLevelToTigerLayer(mapLevel?: string): TigerLayer {
  switch (mapLevel) {
    case 'county':
      return 'counties';
    case 'tract':
      return 'tracts';
    case 'congressional':
      return 'congressional';
    case 'school':
      return 'school';
    case 'state_legislative':
      return 'state_legislative';
    default:
      return 'states';
  }
}
