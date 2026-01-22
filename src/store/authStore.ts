'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, UserPermissions, TablePermissions } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;

  // Permission helpers
  getTablePermissions: (tableName: string) => TablePermissions | null;
  hasTableAccess: (tableName: string) => boolean;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      accessToken: null,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
        }),

      setAccessToken: (token) =>
        set({
          accessToken: token,
        }),

      setLoading: (loading) =>
        set({
          isLoading: loading,
        }),

      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          accessToken: null,
        }),

      getTablePermissions: (tableName) => {
        const { user } = get();
        return user?.permissions?.tables?.[tableName] ?? null;
      },

      hasTableAccess: (tableName) => {
        const perms = get().getTablePermissions(tableName);
        return perms?.read ?? false;
      },

      isAdmin: () => {
        const { user } = get();
        return user?.role === 'ADMIN';
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Separate store for permissions cache (not persisted)
interface PermissionsState {
  tableConfigs: Map<string, { permissions: TablePermissions; timestamp: number }>;
  cacheTimeout: number;

  // Actions
  setTablePermissions: (tableName: string, permissions: TablePermissions) => void;
  getTablePermissions: (tableName: string) => TablePermissions | null;
  clearCache: () => void;
}

export const usePermissionsStore = create<PermissionsState>()((set, get) => ({
  tableConfigs: new Map(),
  cacheTimeout: 5 * 60 * 1000, // 5 minutes

  setTablePermissions: (tableName, permissions) => {
    const { tableConfigs } = get();
    const newConfigs = new Map(tableConfigs);
    newConfigs.set(tableName, {
      permissions,
      timestamp: Date.now(),
    });
    set({ tableConfigs: newConfigs });
  },

  getTablePermissions: (tableName) => {
    const { tableConfigs, cacheTimeout } = get();
    const cached = tableConfigs.get(tableName);

    if (!cached) return null;

    // Check if cache is expired
    if (Date.now() - cached.timestamp > cacheTimeout) {
      const newConfigs = new Map(tableConfigs);
      newConfigs.delete(tableName);
      set({ tableConfigs: newConfigs });
      return null;
    }

    return cached.permissions;
  },

  clearCache: () => {
    set({ tableConfigs: new Map() });
  },
}));
