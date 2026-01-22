import { UserPermissions, UserRole } from './auth.types';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  permissions: UserPermissions;
  created_at?: string;
  updated_at?: string;
}

export interface UserListResponse {
  data: User[];
  pagination: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface UpdateUserRequest {
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: UserRole;
  is_active?: boolean;
}
