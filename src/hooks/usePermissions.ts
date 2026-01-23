'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthStore, usePermissionsStore } from '@/store/authStore';
import {
  canView,
  canCreate,
  canEdit,
  canDelete,
  hasAction,
  getTablePermissions,
} from '@/lib/permissions';
import { fetchWithAuth } from '@/lib/fetch-client';
import type { TablePermissions, TableConfig } from '@/types';

interface UsePermissionsReturn {
  // Permission checks
  canView: (tableName?: string) => boolean;
  canCreate: (tableName?: string) => boolean;
  canEdit: (tableName?: string) => boolean;
  canDelete: (tableName?: string) => boolean;
  hasAction: (action: string, tableName?: string) => boolean;

  // Table config fetching
  fetchTableConfig: (tableName: string) => Promise<TableConfig | null>;
  getTableConfig: (tableName: string) => Promise<TableConfig | null>;

  // State
  isLoading: boolean;
}

export function usePermissions(defaultTableName?: string): UsePermissionsReturn {
  const { user } = useAuthStore();
  const {
    setTablePermissions,
    getTablePermissions: getCachedPermissions,
  } = usePermissionsStore();
  const [isLoading, setIsLoading] = useState(false);
  const [tableConfigs, setTableConfigs] = useState<Map<string, TableConfig>>(new Map());

  const getPermissions = useCallback(
    (tableName?: string): TablePermissions | null => {
      const name = tableName || defaultTableName;
      if (!name) return null;

      // First check user permissions
      const userPerms = getTablePermissions(user?.permissions, name);
      if (userPerms) return userPerms;

      // Then check cached permissions
      return getCachedPermissions(name);
    },
    [user?.permissions, defaultTableName, getCachedPermissions]
  );

  const fetchTableConfig = useCallback(
    async (tableName: string): Promise<TableConfig | null> => {
      setIsLoading(true);
      try {
        const response = await fetchWithAuth(`/api/tables/${tableName}`);
        if (!response.ok) {
          throw new Error('Failed to fetch table config');
        }

        const config: TableConfig = await response.json();

        // Cache the permissions
        setTablePermissions(tableName, config.permissions);

        // Store the config
        setTableConfigs((prev) => new Map(prev).set(tableName, config));

        return config;
      } catch (error) {
        console.error('Error fetching table config:', error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [setTablePermissions]
  );

  const getTableConfig = useCallback(
    async (tableName: string): Promise<TableConfig | null> => {
      // Check if already cached
      const cached = tableConfigs.get(tableName);
      if (cached) return cached;

      // Fetch if not cached
      return fetchTableConfig(tableName);
    },
    [tableConfigs, fetchTableConfig]
  );

  return {
    canView: (tableName?: string) => canView(getPermissions(tableName)),
    canCreate: (tableName?: string) => canCreate(getPermissions(tableName)),
    canEdit: (tableName?: string) => canEdit(getPermissions(tableName)),
    canDelete: (tableName?: string) => canDelete(getPermissions(tableName)),
    hasAction: (action: string, tableName?: string) =>
      hasAction(getPermissions(tableName), action),
    fetchTableConfig,
    getTableConfig,
    isLoading,
  };
}
