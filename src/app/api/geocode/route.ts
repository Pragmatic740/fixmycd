import { NextRequest, NextResponse } from 'next/server';
import { geocodeCoordinates } from '@/lib/geo/census';
import { clientIp, serverError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const limited = await enforceRateLimit('geocode', clientIp(request));
    if (limited) return limited;

    const searchParams = request.nextUrl.searchParams;
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Missing lat or lng parameters' },
        { status: 400 }
      );
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (
      !Number.isFinite(parsedLat) ||
      !Number.isFinite(parsedLng) ||
      Math.abs(parsedLat) > 90 ||
      Math.abs(parsedLng) > 180
    ) {
      return NextResponse.json(
        { error: 'Invalid lat or lng values' },
        { status: 400 }
      );
    }

    const result = await geocodeCoordinates(parsedLat, parsedLng);

    if (!result) {
      return NextResponse.json(
        { error: 'Could not geocode these coordinates' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      city: result.city || '',
      stateProvince: result.stateProvince || '',
      postalCode: result.postalCode || '',
      county: result.county || '',
      lat: parsedLat,
      lng: parsedLng,
    });
  } catch (error) {
    return serverError(error, 'geocode');
  }
}