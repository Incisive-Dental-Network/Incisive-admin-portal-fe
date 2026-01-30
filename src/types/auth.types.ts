import type { User } from './user.types';
import type { UserPermissions, TablePermissions } from './permission.types';

export type { User, UserPermissions, TablePermissions };

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface Session {
  user: User;
  accessToken: string;
}

export type UserRole = 'USER' | 'ADMIN';
