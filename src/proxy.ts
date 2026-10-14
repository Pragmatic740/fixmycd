import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isCrossSiteMutation } from './lib/csrf';

// Must match SESSION_COOKIE in src/lib/auth.ts. The proxy only uses it to
// decide whether to redirect to /login; authorization happens server-side.
const SESSION_COOKIE = 'fmd_session';

// Pages that require a signed-in user.
const PROTECTED_PAGES = [
  '/dashboard/notifications',
  '/dashboard/profile',
  '/dashboard/review',
  '/dashboard/admin',
];

const TRUSTED_ORIGINS = [process.env.NEXT_PUBLIC_BASE_URL].filter((v): v is string => !!v);

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path.startsWith('/api/')) {
    if (isCrossSiteMutation(request.method, request.url, request.headers, TRUSTED_ORIGINS)) {
      return NextResponse.json({ error: 'Cross-site request blocked' }, { status: 403 });
    }
    return NextResponse.next();
  }

  const session = request.cookies.get(SESSION_COOKIE);
  const isProtected = PROTECTED_PAGES.some((page) => path.startsWith(page));
  if (!session?.value && isProtected) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', path);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
