import { describe, expect, it } from 'vitest';
import { DEFAULT_ETHICS_BODY, parseEthics } from '@/lib/ethics-text';

describe('Code of Ethics text', () => {
  it('turns headings, bullets and paragraphs into blocks', () => {
    expect(parseEthics('# Title\n\nFirst line\nsame paragraph\n\n- one\n- two\nAfter list')).toEqual([
      { type: 'heading', text: 'Title' },
      { type: 'paragraph', text: 'First line same paragraph' },
      { type: 'list', items: ['one', 'two'] },
      { type: 'paragraph', text: 'After list' },
    ]);
  });

  it('keeps markup as plain text (it is never rendered as HTML)', () => {
    const blocks = parseEthics('<script>alert(1)</script>\n- <img src=x onerror=alert(1)>');
    expect(blocks).toEqual([
      { type: 'paragraph', text: '<script>alert(1)</script>' },
      { type: 'list', items: ['<img src=x onerror=alert(1)>'] },
    ]);
  });

  it('has a starter code covering honesty, respect, privacy, good faith and consequences', () => {
    const headings = parseEthics(DEFAULT_ETHICS_BODY)
      .filter((b) => b.type === 'heading')
      .map((b) => (b as { text: string }).text);
    expect(headings).toEqual([
      'Our Code of Ethics',
      'Be truthful',
      'Be respectful',
      "Protect people's privacy",
      'Act in good faith',
      'What happens if these rules are broken',
    ]);
  });
});
