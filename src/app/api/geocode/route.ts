import { NextResponse } from 'next/server';
import { geocodeAddress, geocodeCoordinates, type CensusGeography } from '@/lib/geo/census';
import { clientIp, parseQuery, serverError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { geocodeQuery } from '@/lib/validation';

const toResponse = (geo: CensusGeography) => ({
  addressLine: geo.addressLine || '',
  city: geo.city || '',
  stateProvince: geo.stateProvince || '',
  postalCode: geo.postalCode || '',
  county: geo.county || '',
  countryCode: geo.countryCode || '',
  source: geo.geocodeSource,
  lat: geo.latitude,
  lng: geo.longitude,
});

/**
 * GET /api/geocode?lat=&lng=  reverse geocode a map click
 * GET /api/geocode?q=         find an address / ZIP / place
 */
export async function GET(request: Request) {
  try {
    const limited = await enforceRateLimit('geocode', clientIp(request));
    if (limited) return limited;

    const parsed = parseQuery(new URL(request.url).searchParams, geocodeQuery);
    if (!parsed.ok) {
      return NextResponse.json({ error: 'Provide lat and lng, or an address in q' }, { status: 400 });
    }

    if ('q' in parsed.data) {
      const found = await geocodeAddress(parsed.data.q);
      if (!found) return NextResponse.json({ error: 'No match for that address' }, { status: 404 });
      return NextResponse.json(toResponse(found));
    }

    const result = await geocodeCoordinates(parsed.data.lat, parsed.data.lng);
    if (result.geocodeStatus !== 'matched') {
      return NextResponse.json({ error: 'Could not find an address for this spot' }, { status: 404 });
    }
    return NextResponse.json(toResponse(result));
  } catch (error) {
    return serverError(error, 'geocode');
  }
}
