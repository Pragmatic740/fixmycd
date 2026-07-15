/** U.S. Census Geocoder helpers — https://geocoding.geo.census.gov/ */

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

export async function geocodeCoordinates(
  latitude: number,
  longitude: number
): Promise<CensusGeography> {
  // Non-US heuristic: outside continental US + Alaska/Hawaii rough bounds
  if (latitude < -60 || latitude > 72 || longitude < -180 || longitude > -60) {
    if (!(latitude > -23 && latitude < -15 && longitude > 28 && longitude < 34)) {
      // allow Harare range as manual non-US
    }
    if (latitude > -23 && latitude < -15 && longitude > 28 && longitude < 34) {
      return {
        city: 'Harare',
        stateProvince: 'Harare',
        countryCode: 'ZW',
        latitude,
        longitude,
        geocodeStatus: 'manual',
        geocodeSource: 'local-fallback',
        metroArea: 'Harare',
      };
    }
  }

  try {
    const url = new URL('https://geocoding.geo.census.gov/geocoder/geographies/coordinates');
    url.searchParams.set('x', String(longitude));
    url.searchParams.set('y', String(latitude));
    url.searchParams.set('benchmark', 'Public_AR_Current');
    url.searchParams.set('vintage', 'Current_Current');
    url.searchParams.set('format', 'json');

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return unmatched(latitude, longitude, 'census-geocoder-http');
    }
    const data = await res.json();
    const result = data?.result;
    if (!result) return unmatched(latitude, longitude, 'census-geocoder');

    const geos = result.geographies || {};
    const states = geos['States']?.[0];
    const counties = geos['Counties']?.[0];
    const tracts = geos['Census Tracts']?.[0];
    const places = geos['Incorporated Places']?.[0] || geos['Census Designated Places']?.[0];
    const cds = geos['119th Congressional Districts']?.[0] || geos['Congressional Districts']?.[0];
    const school =
      geos['Unified School Districts']?.[0] ||
      geos['Secondary School Districts']?.[0] ||
      geos['Elementary School Districts']?.[0];
    const zctas = geos['2020 Census ZIP Code Tabulation Areas']?.[0] || geos['ZIP Code Tabulation Areas']?.[0];

    const stateFips = states?.STATE || counties?.STATE;
    const regionInfo = stateFips ? CENSUS_REGIONS[stateFips] : undefined;

    return {
      addressLine: undefined,
      city: places?.NAME || places?.BASENAME,
      postalCode: zctas?.ZCTA5 || zctas?.GEOID,
      county: counties?.NAME || counties?.BASENAME,
      stateProvince: states?.STUSAB || states?.BASENAME,
      countryCode: 'US',
      latitude,
      longitude,
      geocodeStatus: states || counties ? 'matched' : 'unmatched',
      geocodeSource: 'census-geocoder',
      geocodeConfidence: states ? 0.9 : 0.4,
      censusRegion: regionInfo?.region,
      censusDivision: regionInfo?.division,
      stateFips,
      countyFips: counties?.COUNTY ? `${stateFips}${counties.COUNTY}` : undefined,
      tractGeoid: tracts?.GEOID,
      blockGroupGeoid: undefined,
      congressionalDistrict: cds?.BASENAME || cds?.NAME || cds?.GEOID,
      schoolDistrict: school?.NAME || school?.BASENAME,
      metroArea: places?.NAME || counties?.NAME,
    };
  } catch {
    return unmatched(latitude, longitude, 'census-geocoder-error');
  }
}

function unmatched(latitude: number, longitude: number, source: string): CensusGeography {
  return {
    latitude,
    longitude,
    countryCode: 'US',
    geocodeStatus: 'unmatched',
    geocodeSource: source,
    geocodeConfidence: 0,
  };
}

export async function geocodeAddress(address: string): Promise<CensusGeography | null> {
  try {
    const url = new URL('https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress');
    url.searchParams.set('address', address);
    url.searchParams.set('benchmark', 'Public_AR_Current');
    url.searchParams.set('vintage', 'Current_Current');
    url.searchParams.set('format', 'json');

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const match = data?.result?.addressMatches?.[0];
    if (!match) return null;

    const coords = match.coordinates;
    const enriched = await geocodeCoordinates(coords.y, coords.x);
    return {
      ...enriched,
      addressLine: match.matchedAddress,
      city: match.addressComponents?.city || enriched.city,
      postalCode: match.addressComponents?.zip || enriched.postalCode,
      stateProvince: match.addressComponents?.state || enriched.stateProvince,
      geocodeStatus: 'matched',
    };
  } catch {
    return null;
  }
}
