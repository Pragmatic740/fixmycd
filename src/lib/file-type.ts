/**
 * Identify uploaded media from its first bytes instead of trusting the
 * browser-supplied MIME type or file name (which an attacker controls).
 * Only formats the app can display are recognised; SVG/HTML never are.
 */

export type SniffedType = { mime: string; ext: string; kind: 'image' | 'video' | 'audio' };

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...Array.from(bytes.subarray(start, end)));

export function sniffMediaType(bytes: Uint8Array): SniffedType | null {
  if (bytes.length < 12) return null;

  // Images
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg', kind: 'image' };
  if (ascii(bytes, 0, 8) === '\x89PNG\r\n\x1a\n') return { mime: 'image/png', ext: 'png', kind: 'image' };
  if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a') return { mime: 'image/gif', ext: 'gif', kind: 'image' };
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp', kind: 'image' };

  // ISO-BMFF family: ftyp box at offset 4 (HEIC photos, MP4/MOV video, M4A audio)
  if (ascii(bytes, 4, 8) === 'ftyp') {
    const brand = ascii(bytes, 8, 12);
    if (/^(heic|heix|hevc|hevx|mif1|msf1)$/.test(brand)) return { mime: 'image/heic', ext: 'heic', kind: 'image' };
    if (/^(M4A |M4B )$/.test(brand)) return { mime: 'audio/mp4', ext: 'm4a', kind: 'audio' };
    if (brand === 'qt  ') return { mime: 'video/quicktime', ext: 'mov', kind: 'video' };
    return { mime: 'video/mp4', ext: 'mp4', kind: 'video' };
  }

  // Matroska / WebM (EBML header) — recorded in-app by Chrome/Firefox
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return { mime: 'video/webm', ext: 'webm', kind: 'video' };
  }

  // Audio
  if (ascii(bytes, 0, 4) === 'OggS') return { mime: 'audio/ogg', ext: 'ogg', kind: 'audio' };
  if (ascii(bytes, 0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) {
    return { mime: 'audio/mpeg', ext: 'mp3', kind: 'audio' };
  }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WAVE') return { mime: 'audio/wav', ext: 'wav', kind: 'audio' };

  return null;
}
