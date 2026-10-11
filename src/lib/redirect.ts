/**
 * Where to send the user after login/signup. Only same-site relative paths
 * are allowed: "//evil.com", "/\\evil.com" or "https://evil.com" would turn
 * the login page into an open redirect for phishing.
 */
export function safeRedirect(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw || raw.length > 512) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  if (/[\u0000-\u001F\u007F]/.test(raw)) return fallback;
  try {
    const url = new URL(raw, 'http://local.invalid');
    if (url.origin !== 'http://local.invalid') return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** Login URL that brings the user back to the current page afterwards. */
export function loginUrlFor(currentPath: string): string {
  return `/login?redirect=${encodeURIComponent(safeRedirect(currentPath))}`;
}
