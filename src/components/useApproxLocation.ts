'use client';

import { useEffect, useState } from 'react';

/** Used until (or unless) the browser shares a real position: central Harare. */
export const FALLBACK_LOCATION = { latitude: -17.8292, longitude: 31.0522 };

export type ApproxLocation = {
  latitude: number;
  longitude: number;
  /** 'device' once the browser shared a position; 'fallback' otherwise. */
  source: 'device' | 'fallback';
};

/** The user's position for "near me" filters, falling back to a default centre. */
export function useApproxLocation(): ApproxLocation {
  const [location, setLocation] = useState<ApproxLocation>({ ...FALLBACK_LOCATION, source: 'fallback' });

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, source: 'device' }),
      () => {},
      { maximumAge: 5 * 60 * 1000, timeout: 10_000 }
    );
  }, []);

  return location;
}
