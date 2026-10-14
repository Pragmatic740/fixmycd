/**
 * Browser media helpers shared by the in-app recorder and the report form.
 * Kept free of React so they can be unit tested.
 */

export type RecordKind = 'video' | 'audio';

/** Preferred container/codec per kind; Safari only records MP4, Chrome/Firefox WebM/Ogg. */
const RECORDER_CANDIDATES: Record<RecordKind, string[]> = {
  video: ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'],
  audio: ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg'],
};

/** First MIME type the browser can record, or undefined to let the browser choose. */
export function pickRecorderMimeType(kind: RecordKind, isTypeSupported: (type: string) => boolean): string | undefined {
  return RECORDER_CANDIDATES[kind].find((type) => {
    try {
      return isTypeSupported(type);
    } catch {
      return false;
    }
  });
}

/** File extension matching what was actually recorded (not a guess). */
export function extensionForMime(mime: string | undefined, kind: RecordKind | 'photo'): string {
  const base = (mime || '').split(';')[0].trim().toLowerCase();
  const known: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
  };
  return known[base] ?? (kind === 'photo' ? 'jpg' : kind === 'audio' ? 'webm' : 'webm');
}

/** Stop recordings before they exceed what /api/upload accepts (10 MB). */
export const RECORDING_LIMITS = {
  maxBytes: 9.5 * 1024 * 1024,
  maxSeconds: { video: 60, audio: 180 } satisfies Record<RecordKind, number>,
};

/** Human message for getUserMedia / MediaRecorder failures. */
export function describeMediaError(error: unknown): string {
  const name = error && typeof error === 'object' && 'name' in error ? String((error as { name: unknown }).name) : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera/microphone access was blocked. Allow access in your browser settings, or upload a file instead.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No suitable camera or microphone was found on this device.';
    case 'NotReadableError':
    case 'AbortError':
      return 'Your camera or microphone is being used by another app. Close it and try again.';
    case 'NotSupportedError':
      return 'This browser cannot record this type of media. Please upload a file instead.';
    default:
      return 'Could not start recording. Please try again or upload a file instead.';
  }
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Scale (width, height) down to fit within maxDimension, keeping the aspect ratio. */
export function fitWithin(width: number, height: number, maxDimension: number): { width: number; height: number } {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Great-circle distance in metres. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** EXIF GPS that is actually usable (cameras write 0,0 when they have no fix). */
export function isPlausibleGps(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(Math.abs(lat) < 1e-6 && Math.abs(lng) < 1e-6)
  );
}

/** EXIF capture time if it is a real date in the past (for "occurred at"). */
export function plausibleCaptureDate(value: unknown, now = new Date()): Date | null {
  const d = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  if (d.getTime() > now.getTime() + 60_000 || d.getFullYear() < 2000) return null;
  return d;
}

/** Value for <input type="datetime-local"> in the user's local time. */
export function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
