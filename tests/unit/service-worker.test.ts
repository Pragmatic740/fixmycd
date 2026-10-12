import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

/** Load public/sw.js in a sandbox and return its request classifier. */
function loadClassifier(version = 'abc123') {
  const sandbox: Record<string, unknown> = {
    URL,
    self: { location: { href: `https://app.test/sw.js?v=${version}`, origin: 'https://app.test' }, addEventListener: () => {} },
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../public/sw.js'), 'utf8'), sandbox);
  const self = sandbox.self as { __fmdClassify: (url: URL, req: unknown) => string };
  return (href: string, init: { method?: string; mode?: string; headers?: Record<string, string> } = {}) =>
    self.__fmdClassify(new URL(href, 'https://app.test'), {
      method: init.method ?? 'GET',
      mode: init.mode ?? 'no-cors',
      headers: new Headers(init.headers),
    });
}

describe('service worker caching rules', () => {
  const classify = loadClassifier();

  it('never caches signed-in pages, API calls, RSC payloads or mutations', () => {
    expect(classify('/dashboard/notifications', { mode: 'navigate' })).toBe('navigate-uncached');
    expect(classify('/dashboard/profile', { mode: 'navigate' })).toBe('navigate-uncached');
    expect(classify('/dashboard/reports/1')).toBe('bypass');
    expect(classify('/api/reports')).toBe('bypass');
    expect(classify('/r/abc?_rsc=1')).toBe('bypass');
    expect(classify('/public', { headers: { RSC: '1' } })).toBe('bypass');
    expect(classify('/api/reports', { method: 'POST' })).toBe('bypass');
    expect(classify('https://evil.example/x.png')).toBe('bypass');
    expect(classify('/video.mp4', { headers: { range: 'bytes=0-' } })).toBe('bypass');
  });

  it('caches immutable assets and public pages', () => {
    expect(classify('/_next/static/chunks/app.js')).toBe('static');
    expect(classify('/', { mode: 'navigate' })).toBe('page');
    expect(classify('/r/abc', { mode: 'navigate' })).toBe('page');
    expect(classify('/public', { mode: 'navigate' })).toBe('page');
    expect(classify('/icons/icon-192.png')).toBe('asset');
  });

  it('versions the cache per deployment', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../public/sw.js'), 'utf8');
    expect(src).toMatch(/const CACHE_NAME = `fmd-\$\{VERSION\}`/);
    expect(src).toMatch(/CLEAR_CACHES/);
  });
});
