import crypto from 'crypto';
import { db } from '@/db';
import { reportLocations, geographicAreas, reportGeographicAreas } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { geocodeCoordinates, type CensusGeography } from './census';

async function upsertArea(type: string, name: string, code: string | undefined, countryCode: string, parentId?: string) {
  if (!name && !code) return null;
  const id = `area_${type}_${countryCode}_${code || name}`.replace(/\s+/g, '_').slice(0, 120);

  const existing = await db.select().from(geographicAreas).where(eq(geographicAreas.id, id)).limit(1);
  if (existing.length === 0) {
    await db.insert(geographicAreas).values({
      id,
      type,
      name: name || code || type,
      code: code || null,
      parentId: parentId || null,
      countryCode,
      source: 'census-geocoder',
      vintage: 'Current',
      createdAt: new Date(),
    });
  }
  return id;
}

export async function enrichReportLocation(
  reportId: string,
  latitude: number,
  longitude: number,
  overrides?: Partial<CensusGeography>
) {
  let geo: CensusGeography;
  try {
    geo = await geocodeCoordinates(latitude, longitude);
  } catch {
    geo = {
      latitude,
      longitude,
      countryCode: overrides?.countryCode || 'US',
      geocodeStatus: 'failed',
      geocodeSource: 'enrichment-error',
    };
  }

  geo = { ...geo, ...overrides, latitude, longitude };

  const locationId = crypto.randomUUID();
  const existing = await db.select().from(reportLocations).where(eq(reportLocations.reportId, reportId)).limit(1);

  const values = {
    addressLine: geo.addressLine || null,
    city: geo.city || null,
    postalCode: geo.postalCode || null,
    county: geo.county || null,
    stateProvince: geo.stateProvince || null,
    countryCode: geo.countryCode || 'US',
    latitude,
    longitude,
    geocodeStatus: geo.geocodeStatus,
    geocodeSource: geo.geocodeSource,
    geocodeConfidence: geo.geocodeConfidence ?? null,
    censusRegion: geo.censusRegion || null,
    censusDivision: geo.censusDivision || null,
    stateFips: geo.stateFips || null,
    countyFips: geo.countyFips || null,
    tractGeoid: geo.tractGeoid || null,
    blockGroupGeoid: geo.blockGroupGeoid || null,
    congressionalDistrict: geo.congressionalDistrict || null,
    stateSenateDistrict: geo.stateSenateDistrict || null,
    stateHouseDistrict: geo.stateHouseDistrict || null,
    schoolDistrict: geo.schoolDistrict || null,
    metroArea: geo.metroArea || null,
    updatedAt: new Date(),
  };

  if (existing.length > 0) {
    await db.update(reportLocations).set(values).where(eq(reportLocations.reportId, reportId));
  } else {
    await db.insert(reportLocations).values({
      id: locationId,
      reportId,
      ...values,
      createdAt: new Date(),
    });
  }

  const countryCode = geo.countryCode || 'US';
  const areaLinks: string[] = [];

  if (geo.stateProvince) {
    const id = await upsertArea('state', geo.stateProvince, geo.stateFips || geo.stateProvince, countryCode);
    if (id) areaLinks.push(id);
  }
  if (geo.county) {
    const id = await upsertArea('county', geo.county, geo.countyFips || geo.county, countryCode);
    if (id) areaLinks.push(id);
  }
  if (geo.city) {
    const id = await upsertArea('city', geo.city, geo.city, countryCode);
    if (id) areaLinks.push(id);
  }
  if (geo.postalCode) {
    const id = await upsertArea('zip', geo.postalCode, geo.postalCode, countryCode);
    if (id) areaLinks.push(id);
  }
  if (geo.tractGeoid) {
    const id = await upsertArea('census_tract', geo.tractGeoid, geo.tractGeoid, countryCode);
    if (id) areaLinks.push(id);
  }
  if (geo.congressionalDistrict) {
    const id = await upsertArea('congressional_district', geo.congressionalDistrict, geo.congressionalDistrict, countryCode);
    if (id) areaLinks.push(id);
  }
  if (geo.schoolDistrict) {
    const id = await upsertArea('school_district', geo.schoolDistrict, geo.schoolDistrict, countryCode);
    if (id) areaLinks.push(id);
  }

  for (const areaId of areaLinks) {
    const linkId = crypto.randomUUID();
    try {
      await db.insert(reportGeographicAreas).values({
        id: linkId,
        reportId,
        geographicAreaId: areaId,
        createdAt: new Date(),
      });
    } catch {
      // unique constraint — already linked
    }
  }

  return geo;
}
