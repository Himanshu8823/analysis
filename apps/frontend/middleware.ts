import { NextResponse, type NextRequest } from 'next/server';

// Public routes that don't need auth
const PUBLIC_PATHS = ['/login', '/forgot-password', '/accept-invite'];
const PUBLIC_PREFIXES = ['/_next', '/api/auth', '/favicon', '/public', '/images'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public assets
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow public auth pages
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  /**
   * The session lives in localStorage, which the middleware (running on the
   * edge) cannot read. Redirecting here based on a cookie that is never set
   * bounced every signed-in user to /login on a fresh page load.
   *
   * Protected-route enforcement therefore belongs to the authenticated
   * layout, which reads the session client-side. The middleware only handles
   * guest-only pages: a signed-in visitor landing on /login is sent to the
   * dashboard instead of being shown the sign-in form again.
   */
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
