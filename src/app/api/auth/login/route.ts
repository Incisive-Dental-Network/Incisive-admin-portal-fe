import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
console.log("🚀 ~ API_URL:", API_URL)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Login API - Request received for:', body.email);

    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    let data = await response.json();
    console.log("🚀 ~ POST ~ data.success:", data.success)
    console.log("🚀 ~ POST ~ data.data:", data.data)
    if(data.success) data = data.data
    console.log('Login API - Backend response status:', response.status);
    console.log('Login API - Has accessToken:', !!data.accessToken);
    console.log('Login API - Has refreshToken:', !!data.refreshToken);

    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || 'Login failed' },
        { status: response.status }
      );
    }

    // Create response and set cookies
    // Note: Backend uses camelCase (accessToken, refreshToken)
    const res = NextResponse.json({ success: true });

    console.log('Login API - Setting cookies...');

    res.cookies.set('access_token', data.accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60, // 15 minutes
    });

    res.cookies.set('refresh_token', data.refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    console.log('Login API - Cookies set with tokens');

    return res;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
