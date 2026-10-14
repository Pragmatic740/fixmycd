import { sniffMediaType } from './file-type';
import { isAllowedMediaUrl, isTrustedRemoteMediaUrl } from './media-url';

export const MAX_EMBED_IMAGE_BYTES = 5 * 1024 * 1024;

export type FetchedImage = { bytes: Uint8Array; type: 'png' | 'jpg' };

function toEmbeddable(bytes: Uint8Array): FetchedImage | null {
  const sniffed = sniffMediaType(bytes);
  if (sniffed?.mime === 'image/png') return { bytes, type: 'png' };
  if (sniffed?.mime === 'image/jpeg') return { bytes, type: 'jpg' };
  return null;
}

/**
 * Load a report photo for embedding in a document, server-side. Only URLs on
 * the media allowlist are fetched (no redirects, bounded size and time), so a
 * stored URL can never make the server request internal addresses.
 * Returns null when the image is missing, too large or not PNG/JPEG.
 */
export async function fetchImageForEmbedding(url: string): Promise<FetchedImage | null> {
  if (!isAllowedMediaUrl(url, 'image')) return null;

  if (url.startsWith('data:')) {
    const base64 = url.slice(url.indexOf(',') + 1);
    const bytes = new Uint8Array(Buffer.from(base64, 'base64'));
    return bytes.length <= MAX_EMBED_IMAGE_BYTES ? toEmbeddable(bytes) : null;
  }

  if (!isTrustedRemoteMediaUrl(url)) return null;

  try {
    const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(8000) });
    if (!res.ok || !res.body) return null;
    const declared = Number(res.headers.get('content-length') || 0);
    if (declared > MAX_EMBED_IMAGE_BYTES) return null;

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_EMBED_IMAGE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.byteLength;
    }
    return toEmbeddable(bytes);
  } catch {
    return null;
  }
}
