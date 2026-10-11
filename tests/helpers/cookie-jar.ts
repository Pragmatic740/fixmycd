type Cookie = { name: string; value: string; options?: Record<string, unknown> };

/**
 * In-memory stand-in for the `next/headers` cookie store, shared between the
 * test and the route handler it calls (like a browser between requests).
 */
class CookieJar {
  private cookies = new Map<string, Cookie>();
  private headers = new Headers();

  clear() {
    this.cookies.clear();
    this.headers = new Headers();
  }

  set(name: string, value: string) {
    this.cookies.set(name, { name, value });
  }

  get(name: string): string | undefined {
    return this.cookies.get(name)?.value;
  }

  setRequestHeaders(headers: HeadersInit | undefined) {
    this.headers = new Headers(headers);
  }

  requestHeaders() {
    return this.headers;
  }

  /** The object `await cookies()` returns inside route handlers. */
  store() {
    const map = this.cookies;
    return {
      get: (name: string) => map.get(name),
      getAll: () => Array.from(map.values()),
      has: (name: string) => map.has(name),
      set: (nameOrCookie: string | Cookie, value?: string, options?: Record<string, unknown>) => {
        const c = typeof nameOrCookie === 'string' ? { name: nameOrCookie, value: value ?? '', options } : nameOrCookie;
        if (c.options && (c.options as { maxAge?: number }).maxAge === 0) {
          map.delete(c.name);
        } else {
          map.set(c.name, c);
        }
      },
      delete: (name: string) => map.delete(name),
      lastOptions: (name: string) => map.get(name)?.options,
    };
  }
}

export const cookieJar = new CookieJar();
