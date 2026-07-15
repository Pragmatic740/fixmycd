import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session_user_id');
  const path = request.nextUrl.pathname;

  if (!session?.value && path.startsWith('/dashboard')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', path);
    return NextResponse.redirect(loginUrl);
  }

  // Soft gate: admin pages require a session (role checked in page/API).
  // Full role check happens server-side in requireAdmin() because middleware
  // cannot easily query Postgres without edge-compatible auth tokens.
  if (path.startsWith('/dashboard/admin') && !session?.value) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
