import { describe, expect, it } from 'vitest';
import vm from 'node:vm';
import {
  THEME_STORAGE_KEY,
  applyResolvedTheme,
  parseThemePreference,
  readThemePreference,
  resolveTheme,
  themeInitScript,
  writeThemePreference,
  type ThemePreference,
} from '@/lib/theme';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const throwingStorage = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

/** Runs the inline <head> script against a fake document and returns what it set. */
function runInitScript(stored: string | null, systemPrefersLight: boolean, { storageThrows = false } = {}) {
  const root = { dataset: {} as Record<string, string>, style: { colorScheme: '' } };
  const context = {
    localStorage: storageThrows ? throwingStorage : memoryStorage(stored === null ? {} : { [THEME_STORAGE_KEY]: stored }),
    window: { matchMedia: (q: string) => ({ matches: q === '(prefers-color-scheme: light)' && systemPrefersLight }) },
    document: { documentElement: root },
  };
  vm.runInNewContext(themeInitScript, context);
  return root;
}

describe('theme preference', () => {
  it('accepts only light and dark, anything else means system', () => {
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
    for (const v of ['system', '', null, undefined, 'LIGHT', 'blue', 1]) expect(parseThemePreference(v)).toBe('system');
  });

  it('resolves system from the OS setting and keeps explicit choices', () => {
    expect(resolveTheme('system', true)).toBe('light');
    expect(resolveTheme('system', false)).toBe('dark');
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('dark', true)).toBe('dark');
  });

  it('stores explicit choices and clears the key for system', () => {
    const storage = memoryStorage();
    writeThemePreference(storage, 'light');
    expect(storage.data.get(THEME_STORAGE_KEY)).toBe('light');
    expect(readThemePreference(storage)).toBe('light');
    writeThemePreference(storage, 'system');
    expect(storage.data.has(THEME_STORAGE_KEY)).toBe(false);
    expect(readThemePreference(storage)).toBe('system');
  });

  it('falls back to system when storage is unavailable or throws', () => {
    expect(readThemePreference(undefined)).toBe('system');
    expect(readThemePreference(throwingStorage)).toBe('system');
    expect(() => writeThemePreference(throwingStorage, 'dark')).not.toThrow();
  });

  it('applies the theme as data-theme and color-scheme', () => {
    const root = { dataset: {} as DOMStringMap, style: { colorScheme: '' } };
    applyResolvedTheme(root, 'light');
    expect(root.dataset.theme).toBe('light');
    expect(root.style.colorScheme).toBe('light');
  });
});

describe('inline theme script', () => {
  const cases: Array<[string | null, boolean]> = [
    [null, true],
    [null, false],
    ['light', false],
    ['dark', true],
    ['system', true],
    ['garbage', false],
  ];

  it.each(cases)('stored=%s, OS light=%s matches resolveTheme', (stored, prefersLight) => {
    const root = runInitScript(stored, prefersLight);
    const expected = resolveTheme(parseThemePreference(stored) as ThemePreference, prefersLight);
    expect(root.dataset.theme).toBe(expected);
    expect(root.style.colorScheme).toBe(expected);
  });

  it('follows the OS setting when storage throws', () => {
    expect(runInitScript(null, true, { storageThrows: true }).dataset.theme).toBe('light');
    expect(runInitScript(null, false, { storageThrows: true }).dataset.theme).toBe('dark');
  });

  it('never throws, even without matchMedia', () => {
    const root = { dataset: {} as Record<string, string>, style: { colorScheme: '' } };
    expect(() =>
      vm.runInNewContext(themeInitScript, { localStorage: memoryStorage(), window: {}, document: { documentElement: root } }),
    ).not.toThrow();
    expect(root.dataset.theme).toBe('dark');
  });
});
