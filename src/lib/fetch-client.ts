'use client';

/**
 * Client-side fetch wrapper that handles 401 redirects
 * Use this for all API calls from client components
 */
export async function fetchWithAuth(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const response = await fetch(url, options);

  // Check for auth redirect header (set by API proxy on 401)
  if (response.headers.get('X-Auth-Redirect') === 'true' || response.status === 401) {
    // Only redirect on client-side
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  return response;
}
