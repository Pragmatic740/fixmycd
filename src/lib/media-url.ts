/**
 * Report photos/videos/audio may only point at storage we control or trust.
 * This blocks tracking pixels, attacker-hosted files and server-side request
 * forgery (the PDF export fetches image URLs from the server).
 */

export type MediaKind = 'image' | 'video' | 'audio';

const TRUSTED_HOSTS: { host: RegExp; path?: RegExp }[] = [
  // Vercel Blob (where /api/upload stores files)
  { host: /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/ },
  // Stock photos used by the demo seed data and CSV import
  { host: /^images\.unsplash\.com$/ },
  // Street View stills written by scripts/enrich-nbi-streetview.ts
  { host: /^maps\.googleapis\.com$/, path: /^\/maps\/api\/streetview$/ },
];

/** Max size of an inline data: URL (the no-Blob local fallback in /api/upload). */
export const MAX_DATA_URL_LENGTH = 2_000_000;

const DATA_URL = /^data:(image|video|audio)\/([a-z0-9.+-]+)(;[a-z0-9=.+-]+)*;base64,[a-z0-9+/=\s]+$/i;

export function isTrustedRemoteMediaUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return TRUSTED_HOSTS.some((t) => t.host.test(host) && (!t.path || t.path.test(url.pathname)));
}

/** Allowed media URL: an https URL on a trusted host, or a small base64 data: URL of the right kind. */
export function isAllowedMediaUrl(value: string, kind?: MediaKind): boolean {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (value.startsWith('data:')) {
    if (value.length > MAX_DATA_URL_LENGTH) return false;
    const m = DATA_URL.exec(value);
    if (!m) return false;
    const major = m[1].toLowerCase();
    const minor = m[2].toLowerCase();
    if (major === 'image' && minor.startsWith('svg')) return false;
    if (!kind || major === kind) return true;
    // In-app audio recordings arrive in MP4/WebM containers (Safari/Chrome).
    return kind === 'audio' && major === 'video' && (minor === 'mp4' || minor === 'webm');
  }
  if (value.length > 2048) return false;
  return isTrustedRemoteMediaUrl(value);
}
