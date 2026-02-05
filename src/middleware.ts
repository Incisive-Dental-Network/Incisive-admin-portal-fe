import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register'];
const AUTH_PATHS = ['/login', '/register'];
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * Check if a JWT token is expired or malformed without verifying the signature.
 * This is a lightweight check to detect corrupted or expired tokens.
 */
function isTokenExpiredOrInvalid(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    const payload = JSON.parse(atob(parts[1]));
    // Check if token is expired (with 30s buffer)
    if (payload.exp && payload.exp * 1000 < Date.now() - 30000) {
      return true;
    }
    return false;
  } catch {
    // Failed to decode = corrupted token
    return true;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get('access_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;

  console.log(`[Middleware] ${pathname} | hasAccess: ${!!accessToken} | hasRefresh: ${!!refreshToken}`);

  // If access token is missing, corrupted, or expired, and we have a refresh token,
  // try to refresh before the page loads
  const needsRefresh = refreshToken && (!accessToken || isTokenExpiredOrInvalid(accessToken));
  if (needsRefresh) {
    console.log('[Middleware] Access token invalid/expired, attempting refresh');
    try {
      const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (refreshResponse.ok) {
        let data = await refreshResponse.json();
        if (data.success && data.data) {
          data = data.data;
        }

        if (data.accessToken) {
          console.log('[Middleware] Token refreshed, redirecting to apply new cookies');

          // Redirect to the same URL so the browser stores the new cookies
          // and makes a fresh request with them. This is the only reliable way
          // to make cookies available to server components in Next.js 14.
          const response = NextResponse.redirect(request.url);

          response.cookies.set('access_token', data.accessToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            path: '/',
            maxAge: 15 * 60,
          });

          if (data.refreshToken) {
            response.cookies.set('refresh_token', data.refreshToken, {
              httpOnly: true,
              secure: false,
              sameSite: 'lax',
              path: '/',
              maxAge: 7 * 24 * 60 * 60,
            });
          }

          return response;
        }
      }

      // Refresh failed — clear both tokens and redirect to login
      console.log('[Middleware] Token refresh failed, clearing cookies');
      const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
      if (!isPublicPath && pathname !== '/') {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        const response = NextResponse.redirect(loginUrl);
        response.cookies.set('access_token', '', { path: '/', maxAge: 0 });
        response.cookies.set('refresh_token', '', { path: '/', maxAge: 0 });
        return response;
      }
    } catch (error) {
      console.error('[Middleware] Refresh error:', error);
    }
  }

  const hasAuth = accessToken || refreshToken;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const isAuthPath = AUTH_PATHS.some((path) => pathname.startsWith(path));

  // Redirect authenticated users away from auth pages
  if (hasAuth && isAuthPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Redirect unauthenticated users to login
  if (!hasAuth && !isPublicPath && pathname !== '/') {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect root to dashboard if authenticated, login if not
  if (pathname === '/') {
    if (hasAuth) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } else {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Pass the current pathname to server components via request header
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-next-pathname', pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
