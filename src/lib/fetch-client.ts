'use client';

/**
 * Client-side fetch wrapper that handles authentication
 *
 * Token refresh is handled automatically by the API proxy route ([...path]/route.ts)
 * which intercepts 401 responses and refreshes the token before retrying.
 *
 * If we still get a 401 here, it means:
 * - The refresh token is expired/invalid
 * - The user needs to log in again
 */
export async function fetchWithAuth(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
  });

  // If 401, the proxy already tried to refresh and failed
  // Redirect to login
  if (response.status === 401) {
    console.log('[Client] Received 401 - redirecting to login');
    if (typeof window !== 'undefined') {
      // Store current path for redirect after login
      const currentPath = window.location.pathname;
      window.location.href = `/login?callbackUrl=${encodeURIComponent(currentPath)}`;
    }
  }

  return response;
}
