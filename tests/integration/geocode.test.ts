import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { reportLocations } from '@/db/schema';
import { GET as geocode } from '@/app/api/geocode/route';
import { clearGeocodeCache } from '@/lib/geo/census';
import { enrichReportLocation } from '@/lib/geo/enrich';
import { call } from '../helpers/route';
import { createReport, createUser } from '../helpers/factories';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const CENSUS_NYC = {
  result: {
    geographies: {
      States: [{ STATE: '36', STUSAB: 'NY' }],
      Counties: [{ COUNTY: '061', NAME: 'New York County' }],
      'Incorporated Places': [{ NAME: 'New York' }],
      '2020 Census ZIP Code Tabulation Areas': [{ ZCTA5: '10007' }],
      'Census Tracts': [{ GEOID: '36061000100' }],
    },
  },
};

let fetchMock: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  clearGeocodeCache();
  fetchMock = vi.spyOn(globalThis, 'fetch');
});
afterEach(() => fetchMock.mockRestore());

const geo = (query: Record<string, string | number>) => call(geocode, { path: '/api/geocode', query });

describe('GET /api/geocode', () => {
  it('uses the Census geocoder first for US points and caches the answer', async () => {
    fetchMock.mockImplementation(async (url: string | URL | Request) => {
      expect(String(url)).toContain('geocoding.geo.census.gov');
      return json(CENSUS_NYC);
    });
    const res = await geo({ lat: 40.7128, lng: -74.006 });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ city: 'New York', stateProvince: 'NY', postalCode: '10007', county: 'New York County', source: 'census' });

    await geo({ lat: 40.71281, lng: -74.00601 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses Nominatim outside the US', async () => {
    fetchMock.mockImplementation(async (url: string | URL | Request) => {
      expect(String(url)).toContain('nominatim.openstreetmap.org');
      return json({ address: { city: 'Harare', state: 'Harare Province', country_code: 'zw' } });
    });
    const res = await geo({ lat: -17.8292, lng: 31.0522 });
    expect(res.json).toMatchObject({ city: 'Harare', countryCode: 'ZW', source: 'nominatim' });
  });

  it('returns 404 (not empty 200s) when nothing is found', async () => {
    fetchMock.mockImplementation(async () => json({ error: 'Unable to geocode' }));
    expect((await geo({ lat: -40, lng: -140 })).status).toBe(404);
  });

  it('searches addresses with q=', async () => {
    fetchMock.mockImplementation(async () =>
      json({
        result: {
          addressMatches: [
            {
              matchedAddress: '1600 PENNSYLVANIA AVE NW, WASHINGTON, DC, 20500',
              coordinates: { x: -77.0365, y: 38.8977 },
              addressComponents: { city: 'WASHINGTON', state: 'DC', zip: '20500' },
              geographies: { States: [{ STATE: '11', STUSAB: 'DC' }] },
            },
          ],
        },
      })
    );
    const res = await geo({ q: '1600 Pennsylvania Ave' });
    expect(res.json).toMatchObject({ lat: 38.8977, lng: -77.0365, postalCode: '20500', stateProvince: 'DC' });
  });

  it('validates input', async () => {
    expect((await geo({ lat: 'abc', lng: 1 })).status).toBe(400);
    expect((await geo({ lat: 95, lng: 1 })).status).toBe(400);
    expect((await geo({ q: 'ab' })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('enrichReportLocation', () => {
  it('keeps geocoder values when the form sent empty fields', async () => {
    fetchMock.mockImplementation(async () => json(CENSUS_NYC));
    const u = await createUser();
    const r = await createReport(u.id);
    await enrichReportLocation(r.id, 40.7128, -74.006, { city: '', postalCode: '', addressLine: '5 Broadway' });
    const [loc] = await db.select().from(reportLocations).where(eq(reportLocations.reportId, r.id));
    expect(loc).toMatchObject({ city: 'New York', postalCode: '10007', addressLine: '5 Broadway', stateFips: '36', tractGeoid: '36061000100' });
  });
});
