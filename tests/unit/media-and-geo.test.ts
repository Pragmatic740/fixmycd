import { describe, expect, it } from 'vitest';
import {
  describeMediaError,
  distanceMeters,
  extensionForMime,
  fitWithin,
  formatDuration,
  isPlausibleGps,
  pickRecorderMimeType,
  plausibleCaptureDate,
} from '@/lib/media-recording';
import { cacheKey, fillMissing, isLikelyUS, parseCensusGeographies, parseNominatim } from '@/lib/geo/census';

describe('recording helpers', () => {
  it('picks MP4 on Safari-like browsers and WebM on Chrome-like ones', () => {
    const safari = (t: string) => t.startsWith('video/mp4') || t === 'audio/mp4';
    const chrome = (t: string) => t.startsWith('video/webm') || t.startsWith('audio/webm');
    expect(pickRecorderMimeType('video', safari)).toBe('video/mp4;codecs=avc1,mp4a');
    expect(pickRecorderMimeType('audio', safari)).toBe('audio/mp4');
    expect(pickRecorderMimeType('audio', chrome)).toBe('audio/webm;codecs=opus');
    expect(pickRecorderMimeType('video', () => false)).toBeUndefined();
    expect(pickRecorderMimeType('video', () => { throw new Error('x'); })).toBeUndefined();
  });

  it('derives the file extension from what was actually recorded', () => {
    expect(extensionForMime('video/mp4;codecs=avc1', 'video')).toBe('mp4');
    expect(extensionForMime('audio/mp4', 'audio')).toBe('m4a');
    expect(extensionForMime('audio/webm;codecs=opus', 'audio')).toBe('webm');
    expect(extensionForMime('', 'photo')).toBe('jpg');
  });

  it('explains permission errors in plain language', () => {
    expect(describeMediaError(Object.assign(new Error(), { name: 'NotAllowedError' }))).toMatch(/blocked/);
    expect(describeMediaError(Object.assign(new Error(), { name: 'NotFoundError' }))).toMatch(/No suitable/);
    expect(describeMediaError('weird')).toMatch(/Could not start/);
  });

  it('formats durations and resizes photos', () => {
    expect(formatDuration(65.9)).toBe('1:05');
    expect(fitWithin(4000, 3000, 1920)).toEqual({ width: 1920, height: 1440 });
    expect(fitWithin(800, 600, 1920)).toEqual({ width: 800, height: 600 });
  });
});

describe('photo GPS / EXIF helpers', () => {
  it('ignores 0,0 and out-of-range coordinates', () => {
    expect(isPlausibleGps(40.7, -74)).toBe(true);
    expect(isPlausibleGps(0, 0)).toBe(false);
    expect(isPlausibleGps(91, 0)).toBe(false);
    expect(isPlausibleGps(undefined, 1)).toBe(false);
  });

  it('accepts only past capture dates', () => {
    const now = new Date('2026-10-12T00:00:00Z');
    expect(plausibleCaptureDate(new Date('2026-10-01T10:00:00Z'), now)).toBeInstanceOf(Date);
    expect(plausibleCaptureDate(new Date('2027-01-01T00:00:00Z'), now)).toBeNull();
    expect(plausibleCaptureDate('garbage', now)).toBeNull();
    expect(plausibleCaptureDate(new Date('1980-01-01'), now)).toBeNull();
  });

  it('measures distance in metres', () => {
    expect(distanceMeters({ lat: 40.7, lng: -74 }, { lat: 40.7, lng: -74 })).toBe(0);
    const d = distanceMeters({ lat: 40.7, lng: -74 }, { lat: 40.7009, lng: -74 });
    expect(d).toBeGreaterThan(90);
    expect(d).toBeLessThan(110);
  });
});

describe('geocoder parsing', () => {
  it('recognises US points (incl. Alaska, Hawaii, Puerto Rico) and not Harare', () => {
    expect(isLikelyUS(40.71, -74.0)).toBe(true);
    expect(isLikelyUS(61.2, -149.9)).toBe(true);
    expect(isLikelyUS(21.3, -157.8)).toBe(true);
    expect(isLikelyUS(18.4, -66.1)).toBe(true);
    expect(isLikelyUS(-17.83, 31.05)).toBe(false);
  });

  it('parses Census geographies into FIPS, tract and districts', () => {
    const geo = parseCensusGeographies(
      {
        result: {
          geographies: {
            States: [{ STATE: '36', STUSAB: 'NY', NAME: 'New York' }],
            Counties: [{ COUNTY: '061', NAME: 'New York County' }],
            'Incorporated Places': [{ NAME: 'New York city', BASENAME: 'New York' }],
            'Census Tracts': [{ GEOID: '36061000100' }],
            '119th Congressional Districts': [{ BASENAME: '10' }],
          },
        },
      },
      40.7,
      -74
    )!;
    expect(geo).toMatchObject({
      stateProvince: 'NY',
      stateFips: '36',
      countyFips: '36061',
      city: 'New York',
      tractGeoid: '36061000100',
      congressionalDistrict: '10',
      censusRegion: 'Northeast',
      geocodeSource: 'census',
    });
    expect(parseCensusGeographies({ result: { geographies: {} } }, 0, 0)).toBeNull();
  });

  it('parses Nominatim, stores US states as 2-letter codes, and treats errors as unmatched', () => {
    const us = parseNominatim({ address: { road: 'Main St', house_number: '12', town: 'Ames', state: 'Iowa', postcode: '50010', country_code: 'us' } }, 42, -93)!;
    expect(us).toMatchObject({ addressLine: '12 Main St', city: 'Ames', stateProvince: 'IA', countryCode: 'US' });
    const zw = parseNominatim({ address: { city: 'Harare', state: 'Harare Province', country_code: 'zw' } }, -17.8, 31)!;
    expect(zw).toMatchObject({ stateProvince: 'Harare Province', countryCode: 'ZW' });
    expect(parseNominatim({ error: 'Unable to geocode' }, 0, 0)).toBeNull();
  });

  it('fills only empty fields and caches by ~11 m cells', () => {
    const base = { city: '', postalCode: '10001', countryCode: 'US', latitude: 1, longitude: 1, geocodeStatus: 'matched' as const, geocodeSource: 'census' };
    const extra = { city: 'NYC', postalCode: '99999', countryCode: 'US', latitude: 1, longitude: 1, geocodeStatus: 'matched' as const, geocodeSource: 'nominatim' };
    expect(fillMissing(base, extra)).toMatchObject({ city: 'NYC', postalCode: '10001', geocodeSource: 'census' });
    expect(cacheKey(40.712812, -74.006012)).toBe(cacheKey(40.71284, -74.00599));
  });
});
