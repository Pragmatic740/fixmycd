/**
 * Text helpers for PDFs drawn with pdf-lib's standard fonts, which can only
 * encode WinAnsi (Windows-1252). Anything else makes drawText throw, so we
 * transliterate what we can and replace the rest instead of failing the PDF.
 */

/** The 0x80–0x9F block of Windows-1252 (beyond Latin-1). */
const WIN_ANSI_EXTRAS = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

const PUNCTUATION: Record<string, string> = {
  '‘': "'", '’': "'", '‚': "'", '‛': "'",
  '“': '"', '”': '"', '„': '"', '‟': '"',
  '–': '-', '—': '-', '−': '-', '‐': '-', '‑': '-',
  '…': '...', '•': '*', ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ',
  '→': '->', '←': '<-', '≤': '<=', '≥': '>=', '×': 'x',
};

/** Control, zero-width and line/paragraph separator characters. */
const INVISIBLE = new RegExp('[\\u0000-\\u001F\\u007F-\\u009F\\u200B-\\u200F\\u2028\\u2029\\uFEFF]');

function isWinAnsi(ch: string): boolean {
  const cp = ch.codePointAt(0)!;
  return (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || WIN_ANSI_EXTRAS.has(ch);
}

/** Make arbitrary user text drawable with a standard PDF font (single line). */
export function toWinAnsi(text: string): string {
  let out = '';
  for (const ch of text.replace(/[\r\n\t]+/g, ' ')) {
    if (PUNCTUATION[ch] !== undefined) {
      out += PUNCTUATION[ch];
    } else if (isWinAnsi(ch)) {
      out += ch;
    } else if (INVISIBLE.test(ch)) {
      // control / zero-width characters: drop
    } else {
      // Try the unaccented base letter (e.g. "ő" -> "o"), else a placeholder.
      const base = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '');
      out += base && [...base].every(isWinAnsi) ? base : '?';
    }
  }
  return out;
}

type MeasuringFont = { widthOfTextAtSize(text: string, size: number): number };

/**
 * Wrap text to a maximum width using real glyph widths. Paragraph breaks are
 * kept; words longer than a line (URLs) are split.
 */
export function wrapText(text: string, font: MeasuringFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  const fits = (s: string) => font.widthOfTextAtSize(s, size) <= maxWidth;

  for (const paragraph of text.split(/\r?\n/)) {
    const words = toWinAnsi(paragraph).split(' ').filter(Boolean);
    if (words.length === 0) {
      if (lines.length && lines[lines.length - 1] !== '') lines.push('');
      continue;
    }
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (fits(candidate)) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      current = word;
      // A single token wider than the line (e.g. a URL): split it into pieces that fit.
      while (!fits(current)) {
        let n = current.length - 1;
        while (n > 1 && !fits(current.slice(0, n))) n--;
        lines.push(current.slice(0, n));
        current = current.slice(n);
      }
    }
    if (current) lines.push(current);
  }
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** Fixed, timezone-independent date for documents (e.g. "2026-10-11 14:05 UTC"). */
export function formatPdfDate(date: Date | string, withTime = false): string {
  const iso = new Date(date).toISOString();
  return withTime ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : iso.slice(0, 10);
}
