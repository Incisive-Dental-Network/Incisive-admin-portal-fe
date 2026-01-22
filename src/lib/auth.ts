import { api, ApiError } from './api';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './tokens';
import type { User, AuthTokens, LoginRequest, RegisterRequest, Session } from '@/types';

export async function login(credentials: LoginRequest): Promise<AuthTokens> {
  const tokens = await api.post<AuthTokens>('/auth/login', credentials);
  await setTokens(tokens.access_token, tokens.refresh_token);
  return tokens;
}

export async function register(data: RegisterRequest): Promise<AuthTokens> {
  const tokens = await api.post<AuthTokens>('/auth/register', data);
  await setTokens(tokens.access_token, tokens.refresh_token);
  return tokens;
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } catch (error) {
    // Ignore errors during logout
    console.error('Logout error:', error);
  } finally {
    await clearTokens();
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const user = await api.get<User>('/users/me');
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export async function getSession(): Promise<Session | null> {
  const accessToken = await getAccessToken();
  const refreshToken = await getRefreshToken();

  if (!accessToken && !refreshToken) {
    return null;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return null;
    }

    const currentToken = await getAccessToken();
    if (!currentToken) {
      return null;
    }

    return {
      user,
      accessToken: currentToken,
    };
  } catch {
    return null;
  }
}

export async function validateToken(): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    return !!user;
  } catch {
    return false;
  }
}

export function isAdmin(user: User | null): boolean {
  return user?.role === 'ADMIN';
}

export function isActive(user: User | null): boolean {
  return user?.is_active ?? false;
}
