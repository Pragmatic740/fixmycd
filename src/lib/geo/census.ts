/**
 * Geocoding for report locations.
 *
 * US points go to the U.S. Census Geocoder first (https://geocoding.geo.census.gov/):
 * it returns the FIPS codes, tract and districts the analytics rely on.
 * Nominatim (OpenStreetMap) fills in city/ZIP gaps and covers everywhere else.
 * Nominatim's usage policy allows ~1 request/second with an identifying
 * User-Agent and expects caching, so calls are throttled and cached.
 */
import { normalizeStateFilter } from './us-states';

export interface CensusGeography {
  addressLine?: string;
  city?: string;
  postalCode?: string;
  county?: string;
  stateProvince?: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  geocodeStatus: 'matched' | 'unmatched' | 'failed' | 'manual' | 'pending';
  geocodeSource: string;
  geocodeConfidence?: number;
  censusRegion?: string;
  censusDivision?: string;
  stateFips?: string;
  countyFips?: string;
  tractGeoid?: string;
  blockGroupGeoid?: string;
  congressionalDistrict?: string;
  stateSenateDistrict?: string;
  stateHouseDistrict?: string;
  schoolDistrict?: string;
  metroArea?: string;
}

const CENSUS_REGIONS: Record<string, { region: string; division: string }> = {
  '09': { region: 'Northeast', division: 'New England' },
  '23': { region: 'Northeast', division: 'New England' },
  '25': { region: 'Northeast', division: 'New England' },
  '33': { region: 'Northeast', division: 'New England' },
  '44': { region: 'Northeast', division: 'New England' },
  '50': { region: 'Northeast', division: 'New England' },
  '34': { region: 'Northeast', division: 'Middle Atlantic' },
  '36': { region: 'Northeast', division: 'Middle Atlantic' },
  '42': { region: 'Northeast', division: 'Middle Atlantic' },
  '17': { region: 'Midwest', division: 'East North Central' },
  '18': { region: 'Midwest', division: 'East North Central' },
  '26': { region: 'Midwest', division: 'East North Central' },
  '39': { region: 'Midwest', division: 'East North Central' },
  '55': { region: 'Midwest', division: 'East North Central' },
  '19': { region: 'Midwest', division: 'West North Central' },
  '20': { region: 'Midwest', division: 'West North Central' },
  '27': { region: 'Midwest', division: 'West North Central' },
  '29': { region: 'Midwest', division: 'West North Central' },
  '31': { region: 'Midwest', division: 'West North Central' },
  '38': { region: 'Midwest', division: 'West North Central' },
  '46': { region: 'Midwest', division: 'West North Central' },
  '10': { region: 'South', division: 'South Atlantic' },
  '11': { region: 'South', division: 'South Atlantic' },
  '12': { region: 'South', division: 'South Atlantic' },
  '13': { region: 'South', division: 'South Atlantic' },
  '24': { region: 'South', division: 'South Atlantic' },
  '37': { region: 'South', division: 'South Atlantic' },
  '45': { region: 'South', division: 'South Atlantic' },
  '51': { region: 'South', division: 'South Atlantic' },
  '54': { region: 'South', division: 'South Atlantic' },
  '01': { region: 'South', division: 'East South Central' },
  '21': { region: 'South', division: 'East South Central' },
  '28': { region: 'South', division: 'East South Central' },
  '47': { region: 'South', division: 'East South Central' },
  '05': { region: 'South', division: 'West South Central' },
  '22': { region: 'South', division: 'West South Central' },
  '40': { region: 'South', division: 'West South Central' },
  '48': { region: 'South', division: 'West South Central' },
  '04': { region: 'West', division: 'Mountain' },
  '08': { region: 'West', division: 'Mountain' },
  '16': { region: 'West', division: 'Mountain' },
  '30': { region: 'West', division: 'Mountain' },
  '32': { region: 'West', division: 'Mountain' },
  '35': { region: 'West', division: 'Mountain' },
  '49': { region: 'West', division: 'Mountain' },
  '56': { region: 'West', division: 'Mountain' },
  '02': { region: 'West', division: 'Pacific' },
  '06': { region: 'West', division: 'Pacific' },
  '15': { region: 'West', division: 'Pacific' },
  '41': { region: 'West', division: 'Pacific' },
  '53': { region: 'West', division: 'Pacific' },
};

const CONTACT = process.env.GEOCODER_CONTACT || 'https://github.com/TinevimboMusingadi/fixmycd';
const USER_AGENT = `FixMyDistrict/1.0 (${CONTACT})`;
const TIMEOUT_MS = 8000;

// ---------------------------------------------------------------------------
// Pure helpers (unit tested)

/** Rough bounding boxes for the US, Alaska, Hawaii and Puerto Rico. */
export function isLikelyUS(latitude: number, longitude: number): boolean {
  const inBox = (s: number, n: number, w: number, e: number) =>
    latitude >= s && latitude <= n && longitude >= w && longitude <= e;
  return (
    inBox(24.4, 49.5, -125.0, -66.9) || // contiguous states
    inBox(51.0, 71.6, -180.0, -129.9) ||
    inBox(51.0, 71.6, 172.0, 180.0) || // Alaska incl. Aleutians
    inBox(18.8, 22.4, -160.4, -154.7) || // Hawaii
    inBox(17.8, 18.6, -67.4, -65.2) // Puerto Rico
  );
}

type CensusGeographiesResponse = { result?: { geographies?: Record<string, Array<Record<string, string>>> } };

/** Turn a Census "geographies/coordinates" response into our location shape (null when unmatched). */
export function parseCensusGeographies(
  data: CensusGeographiesResponse,
  latitude: number,
  longitude: number
): CensusGeography | null {
  const geos = data?.result?.geographies || {};
  const states = geos['States']?.[0];
  if (!states) return null;
  const counties = geos['Counties']?.[0];
  const places = geos['Incorporated Places']?.[0] || geos['Census Designated Places']?.[0];
  const zctas = geos['2020 Census ZIP Code Tabulation Areas']?.[0];
  const stateFips = states.STATE;
  const regionInfo = stateFips ? CENSUS_REGIONS[stateFips] : undefined;
  return {
    city: places?.BASENAME || places?.NAME || '',
    stateProvince: states.STUSAB || normalizeStateFilter(states.NAME || ''),
    postalCode: zctas?.ZCTA5 || zctas?.BASENAME || '',
    county: counties?.NAME || '',
    countryCode: 'US',
    latitude,
    longitude,
    geocodeStatus: 'matched',
    geocodeSource: 'census',
    geocodeConfidence: 0.9,
    censusRegion: regionInfo?.region,
    censusDivision: regionInfo?.division,
    stateFips,
    countyFips: counties?.COUNTY ? `${stateFips}${counties.COUNTY}` : undefined,
    tractGeoid: geos['Census Tracts']?.[0]?.GEOID,
    congressionalDistrict:
      geos['119th Congressional Districts']?.[0]?.BASENAME ||
      geos['119th Congressional Districts']?.[0]?.NAME ||
      geos['Congressional Districts']?.[0]?.BASENAME,
    schoolDistrict: geos['Unified School Districts']?.[0]?.NAME || geos['Secondary School Districts']?.[0]?.NAME,
    metroArea: places?.NAME || counties?.NAME,
  };
}

type NominatimAddress = Record<string, string | undefined>;
type NominatimResponse = { error?: string; address?: NominatimAddress; lat?: string; lon?: string; display_name?: string };

/** Turn a Nominatim reverse/search result into our location shape (null when unmatched). */
export function parseNominatim(data: NominatimResponse, latitude: number, longitude: number): CensusGeography | null {
  if (!data || data.error || !data.address) return null;
  const a = data.address;
  const countryCode = (a.country_code || '').toUpperCase();
  const state = a.state || a.region || '';
  const street = [a.house_number, a.road].filter(Boolean).join(' ');
  return {
    addressLine: street || undefined,
    city: a.city || a.town || a.village || a.hamlet || a.suburb || '',
    // US states as 2-letter codes, like Census results, so analytics group consistently.
    stateProvince: countryCode === 'US' ? normalizeStateFilter(state) : state,
    postalCode: a.postcode || '',
    county: a.county || '',
    countryCode: countryCode || 'US',
    latitude,
    longitude,
    geocodeStatus: 'matched',
    geocodeSource: 'nominatim',
    geocodeConfidence: 0.8,
  };
}

/** Use `extra` only to fill fields `base` left empty. */
export function fillMissing(base: CensusGeography, extra: CensusGeography | null): CensusGeography {
  if (!extra) return base;
  return {
    ...base,
    addressLine: base.addressLine || extra.addressLine,
    city: base.city || extra.city,
    postalCode: base.postalCode || extra.postalCode,
    county: base.county || extra.county,
  };
}

/** Cache key: ~11 m precision is plenty for city/ZIP/tract lookups. */
export const cacheKey = (latitude: number, longitude: number) => `${latitude.toFixed(4)},${longitude.toFixed(4)}`;

// ---------------------------------------------------------------------------
// Cache and throttle (per server instance)

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 1000;
const cache = new Map<string, { value: CensusGeography; expires: number }>();

function cacheGet(key: string): CensusGeography | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key: string, value: CensusGeography) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

export function clearGeocodeCache() {
  cache.clear();
}

let nominatimQueue: Promise<unknown> = Promise.resolve();
let lastNominatimCall = 0;

/** Serialize Nominatim calls at most one per second (their usage policy). */
function throttledNominatim<T>(fn: () => Promise<T>): Promise<T> {
  const run = nominatimQueue.then(async () => {
    const wait = lastNominatimCall + 1000 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastNominatimCall = Date.now();
    return fn();
  });
  nominatimQueue = run.catch(() => undefined);
  return run;
}

// ---------------------------------------------------------------------------
// Network lookups

async function censusReverse(latitude: number, longitude: number): Promise<CensusGeography | null> {
  try {
    const url = new URL('https://geocoding.geo.census.gov/geocoder/geographies/coordinates');
    url.searchParams.set('x', String(longitude));
    url.searchParams.set('y', String(latitude));
    url.searchParams.set('benchmark', 'Public_AR_Current');
    url.searchParams.set('vintage', 'Current_Current');
    url.searchParams.set('format', 'json');
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok ? parseCensusGeographies(await res.json(), latitude, longitude) : null;
  } catch (error) {
    console.warn('Census reverse geocode failed', error);
    return null;
  }
}

async function nominatimReverse(latitude: number, longitude: number): Promise<CensusGeography | null> {
  try {
    return await throttledNominatim(async () => {
      const url = new URL('https://nominatim.openstreetmap.org/reverse');
      url.searchParams.set('lat', String(latitude));
      url.searchParams.set('lon', String(longitude));
      url.searchParams.set('format', 'json');
      url.searchParams.set('addressdetails', '1');
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      return res.ok ? parseNominatim(await res.json(), latitude, longitude) : null;
    });
  } catch (error) {
    console.warn('Nominatim reverse geocode failed', error);
    return null;
  }
}

const unmatched = (latitude: number, longitude: number): CensusGeography => ({
  city: '',
  stateProvince: '',
  postalCode: '',
  county: '',
  countryCode: isLikelyUS(latitude, longitude) ? 'US' : '',
  latitude,
  longitude,
  geocodeStatus: 'unmatched',
  geocodeSource: 'none',
  geocodeConfidence: 0,
});

/** Reverse geocode a point. Never throws; geocodeStatus is 'unmatched' when nothing was found. */
export async function geocodeCoordinates(latitude: number, longitude: number): Promise<CensusGeography> {
  const key = cacheKey(latitude, longitude);
  const cached = cacheGet(key);
  if (cached) return { ...cached, latitude, longitude };

  let result: CensusGeography | null = null;
  if (isLikelyUS(latitude, longitude)) {
    const census = await censusReverse(latitude, longitude);
    if (census) {
      // Census places don't cover unincorporated areas; let OSM fill city/ZIP.
      result = census.city && census.postalCode ? census : fillMissing(census, await nominatimReverse(latitude, longitude));
    }
  }
  if (!result) result = await nominatimReverse(latitude, longitude);
  if (!result) return unmatched(latitude, longitude);

  cacheSet(key, result);
  return result;
}

async function nominatimSearch(query: string): Promise<CensusGeography | null> {
  try {
    return await throttledNominatim(async () => {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'json');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('limit', '1');
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) return null;
      const [first] = (await res.json()) as NominatimResponse[];
      if (!first?.lat || !first?.lon) return null;
      return parseNominatim(first, Number(first.lat), Number(first.lon));
    });
  } catch {
    return null;
  }
}

/** Forward geocode a street address, ZIP or place name (US via Census, else Nominatim). */
export async function geocodeAddress(address: string): Promise<CensusGeography | null> {
  try {
    const url = new URL('https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress');
    url.searchParams.set('address', address);
    url.searchParams.set('benchmark', 'Public_AR_Current');
    url.searchParams.set('vintage', 'Current_Current');
    url.searchParams.set('format', 'json');

    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const data = res.ok ? await res.json() : null;
    const match = data?.result?.addressMatches?.[0];
    if (match?.coordinates) {
      const lat = Number(match.coordinates.y);
      const lng = Number(match.coordinates.x);
      const geo = parseCensusGeographies({ result: { geographies: match.geographies } }, lat, lng) ?? (await geocodeCoordinates(lat, lng));
      return {
        ...geo,
        addressLine: match.matchedAddress,
        city: match.addressComponents?.city || geo.city,
        postalCode: match.addressComponents?.zip || geo.postalCode,
        stateProvince: match.addressComponents?.state || geo.stateProvince,
        geocodeStatus: 'matched',
      };
    }
  } catch (error) {
    console.warn('Census address geocode failed', error);
  }
  return nominatimSearch(address);
}
