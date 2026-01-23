import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

async function proxyRequest(
  request: NextRequest,
  path: string,
  accessToken: string | null
): Promise<Response> {
  const url = `${API_URL}/${path}${request.nextUrl.search}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const body = ['GET', 'HEAD'].includes(request.method)
    ? undefined
    : await request.text();

  return fetch(url, {
    method: request.method,
    headers,
    body: body || undefined,
  });
}

async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Backend might expect camelCase
      body: JSON.stringify({ refreshToken: refreshToken }),
    });

    if (!response.ok) {
      return null;
    }

    let data = await response.json();

    // Handle wrapped response: { success: true, data: {...} }
    if (data.success && data.data) {
      data = data.data;
    }

    return data;
  } catch (error) {
    console.error('Token refresh error:', error);
    return null;
  }
}

async function handleRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const pathString = path.join('/');

    const accessToken = request.cookies.get('access_token')?.value || null;
    const refreshToken = request.cookies.get('refresh_token')?.value || null;

    // Make the initial request
    let response = await proxyRequest(request, pathString, accessToken);
    let newTokens: { accessToken: string; refreshToken: string } | null = null;

    // If unauthorized, try to refresh token
    if (response.status === 401 && refreshToken) {
      newTokens = await refreshAccessToken(refreshToken);
      if (newTokens) {
        response = await proxyRequest(request, pathString, newTokens.accessToken);
      }
    }

    // Handle empty responses
    if (response.status === 204) {
      const res = new NextResponse(null, { status: 204 });
      if (newTokens) {
        setTokenCookies(res, newTokens);
      }
      return res;
    }

    // Return the response
    const data = await response.text();

    const res = new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });

    // Set new tokens if refreshed
    if (newTokens) {
      setTokenCookies(res, newTokens);
    }

    // If still unauthorized after refresh attempt, clear cookies and add redirect flag
    if (response.status === 401) {
      clearTokenCookies(res);
      // Add header to signal client to redirect to login
      res.headers.set('X-Auth-Redirect', 'true');
    }

    return res;
  } catch (error) {
    console.error('API Proxy Error:', error);

    // Check if it's a connection error
    const isConnectionError =
      error instanceof Error &&
      (error.cause as { code?: string })?.code === 'ECONNREFUSED';

    const errorMessage = isConnectionError
      ? 'Unable to connect to the server. Please ensure the backend service is running.'
      : 'An unexpected error occurred. Please try again later.';

    return NextResponse.json(
      {
        success: false,
        error: isConnectionError ? 'SERVER_UNAVAILABLE' : 'INTERNAL_ERROR',
        message: errorMessage,
      },
      { status: isConnectionError ? 503 : 500 }
    );
  }
}

function setTokenCookies(
  res: NextResponse,
  tokens: { accessToken: string; refreshToken: string }
) {
  res.cookies.set('access_token', tokens.accessToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60,
  });

  res.cookies.set('refresh_token', tokens.refreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
}

function clearTokenCookies(res: NextResponse) {
  res.cookies.set('access_token', '', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  res.cookies.set('refresh_token', '', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, context);
}
