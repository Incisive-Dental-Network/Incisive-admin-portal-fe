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

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  permissions: UserPermissions;
}

export type UserRole = 'USER' | 'ADMIN';

export interface UserPermissions {
  tables: {
    [tableName: string]: TablePermissions;
  };
}

export interface TablePermissions {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  actions: string[];
}
