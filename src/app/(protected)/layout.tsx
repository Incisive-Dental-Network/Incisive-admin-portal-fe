import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { ReactNode } from 'react';
import { ProtectedLayoutClient } from './ProtectedLayoutClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

async function getSession() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;
  const refreshToken = cookieStore.get('refresh_token')?.value;

  console.log('Protected Layout - Checking session:', {
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken
  });

  if (!accessToken && !refreshToken) {
    console.log('Protected Layout - No tokens found');
    return null;
  }

  try {
    let token = accessToken;

    // Try to refresh if no access token
    if (!token && refreshToken) {
      console.log('Protected Layout - Attempting token refresh');
      const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshToken }),
        cache: 'no-store',
      });

      if (refreshResponse.ok) {
        let data = await refreshResponse.json();
        // Handle wrapped response
        if (data.success && data.data) {
          data = data.data;
        }
        token = data.accessToken || data.access_token;
        console.log('Protected Layout - Token refreshed successfully');
      } else {
        console.log('Protected Layout - Token refresh failed:', refreshResponse.status);
      }
    }

    if (!token) {
      console.log('Protected Layout - No valid token');
      return null;
    }

    console.log('Protected Layout - Fetching user data');
    const response = await fetch(`${API_URL}/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.log('Protected Layout - User fetch failed:', response.status);
      return null;
    }

    let user = await response.json();
    // Handle wrapped response: { success: true, data: {...} }
    if (user.success && user.data) {
      user = user.data;
    }
    console.log('Protected Layout - User loaded:', user.email);
    return { user, accessToken: token };
  } catch (error) {
    console.error('Protected Layout - Session error:', error);
    return null;
  }
}

interface ProtectedLayoutProps {
  children: ReactNode;
}

export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const session = await getSession();

  if (!session) {
    console.log('Protected Layout - Redirecting to login');
    redirect('/login');
  }

  return <ProtectedLayoutClient user={session.user}>{children}</ProtectedLayoutClient>;
}
