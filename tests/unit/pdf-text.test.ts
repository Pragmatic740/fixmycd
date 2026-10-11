import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { formatPdfDate, toWinAnsi, wrapText } from '@/lib/pdf-text';

describe('toWinAnsi', () => {
  it('keeps Latin-1 accents instead of deleting them', () => {
    expect(toWinAnsi('Café on Rue Hélène')).toBe('Café on Rue Hélène');
  });

  it('maps typographic punctuation to ASCII', () => {
    expect(toWinAnsi('don’t “quote” — ok…')).toBe(`don't "quote" - ok...`);
  });

  it('transliterates other Latin letters and replaces unsupported scripts', () => {
    expect(toWinAnsi('Łódź Őrs')).toBe('?ódz Ors');
    expect(toWinAnsi('東京')).toBe('??');
  });

  it('drops control and zero-width characters that crash pdf-lib', () => {
    expect(toWinAnsi('a\u0000b\u0007c​d﻿e')).toBe('abcde');
  });

  it('produces text the standard Helvetica font can always encode', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const nasty = 'Zürich ✓ 🚧 Ωmega ‮ evil \u0000 “x” – 東京 Ġ';
    expect(() => font.encodeText(toWinAnsi(nasty))).not.toThrow();
  });
});

describe('wrapText', () => {
  it('wraps by measured width and keeps paragraphs', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const lines = wrapText('First paragraph has several words in it.\n\nSecond one.', font, 11, 100);
    for (const line of lines) expect(font.widthOfTextAtSize(line, 11)).toBeLessThanOrEqual(100);
    expect(lines).toContain('');
    expect(lines[lines.length - 1]).toBe('Second one.');
  });

  it('hard-breaks a token longer than the line (URLs)', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const url = `https://example.com/${'a'.repeat(300)}`;
    const lines = wrapText(url, font, 9, 200);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe(url);
    for (const line of lines) expect(font.widthOfTextAtSize(line, 9)).toBeLessThanOrEqual(200);
  });
});

describe('formatPdfDate', () => {
  it('is timezone independent', () => {
    expect(formatPdfDate('2026-10-11T23:30:00Z')).toBe('2026-10-11');
    expect(formatPdfDate('2026-10-11T23:30:00Z', true)).toBe('2026-10-11 23:30 UTC');
  });
});
