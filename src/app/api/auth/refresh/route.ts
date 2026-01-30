import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, message: 'No refresh token' },
        { status: 401 }
      );
    }

    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    let data = await response.json();

    if (data.success && data.data) data = data.data;

    if (!response.ok || !data.accessToken) {
      console.log('[Auth Refresh] Failed:', response.status);
      // Clear invalid tokens
      const res = NextResponse.json(
        { success: false, message: 'Token refresh failed' },
        { status: 401 }
      );
      res.cookies.delete('access_token');
      res.cookies.delete('refresh_token');
      return res;
    }

    // Set new tokens
    const res = NextResponse.json({ success: true });

    res.cookies.set('access_token', data.accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60, // 15 minutes
    });

    if (data.refreshToken) {
      res.cookies.set('refresh_token', data.refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });
    }

    return res;
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { success: false, message: 'An error occurred during token refresh' },
      { status: 500 }
    );
  }
}
