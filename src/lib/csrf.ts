const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * True when a state-changing request comes from another site. Browsers attach
 * Origin (and Sec-Fetch-Site) to cross-origin POST/PATCH/DELETE requests, so a
 * mismatch means some other page is trying to act with the user's cookies.
 * Requests without either header (curl, server-to-server) are not browser
 * CSRF and are left to normal authentication.
 */
export function isCrossSiteMutation(
  method: string,
  requestUrl: string,
  headers: Headers,
  trustedOrigins: string[] = []
): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false;

  const origin = headers.get('origin');
  if (origin && origin !== 'null') {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return true;
    }
    const allowed = new Set([new URL(requestUrl).host, headers.get('host') ?? '', ...trustedOrigins.map(hostOf)]);
    return !allowed.has(originHost);
  }
  if (origin === 'null') return true;

  return headers.get('sec-fetch-site') === 'cross-site';
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}
