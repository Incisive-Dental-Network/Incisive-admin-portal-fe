import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * Session refresh route handler.
 *
 * When the protected layout detects a 401 (invalid/corrupted access token),
 * it redirects here. This route handler CAN set cookies (unlike server components),
 * so it attempts to refresh the token and redirect back to the original page.
 */
export async function GET(request: NextRequest) {
  const refreshToken = request.cookies.get('refresh_token')?.value;
  const redirectTo = request.nextUrl.searchParams.get('redirect') || '/dashboard';

  if (!refreshToken) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.set('access_token', '', { path: '/', maxAge: 0 });
    response.cookies.set('refresh_token', '', { path: '/', maxAge: 0 });
    return response;
  }

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
        const response = NextResponse.redirect(new URL(redirectTo, request.url));

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

    // Refresh failed
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.set('access_token', '', { path: '/', maxAge: 0 });
    response.cookies.set('refresh_token', '', { path: '/', maxAge: 0 });
    return response;
  } catch {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.set('access_token', '', { path: '/', maxAge: 0 });
    response.cookies.set('refresh_token', '', { path: '/', maxAge: 0 });
    return response;
  }
}
