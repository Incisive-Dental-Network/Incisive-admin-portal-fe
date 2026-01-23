'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/components/ui/Toast';
import { fetchWithAuth } from '@/lib/fetch-client';
import type {
  TableConfig,
  TableRowsResponse,
  TableFilters,
  SortConfig,
} from '@/types';
import { DEFAULT_PAGE_SIZE } from '@/config/ui.constants';

interface UseTableOptions {
  initialPage?: number;
  initialPageSize?: number;
  initialSort?: SortConfig;
  initialFilters?: TableFilters;
  initialSearch?: string;
}

interface UseTableReturn {
  // Config
  config: TableConfig | null;
  isLoadingConfig: boolean;

  // Data
  rows: Record<string, unknown>[];
  isLoading: boolean;

  // Pagination
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;

  // Sorting
  sort: SortConfig | null;
  setSort: (sort: SortConfig | null) => void;
  handleSort: (column: string) => void;

  // Filtering
  filters: TableFilters;
  setFilters: (filters: TableFilters) => void;
  search: string;
  setSearch: (search: string) => void;

  // Actions
  fetchConfig: () => Promise<void>;
  fetchRows: () => Promise<void>;
  createRow: (data: Record<string, unknown>) => Promise<boolean>;
  updateRow: (id: string, data: Record<string, unknown>) => Promise<boolean>;
  deleteRow: (id: string) => Promise<boolean>;
  activateRow: (id: string) => Promise<boolean>;
  deactivateRow: (id: string) => Promise<boolean>;
  getRow: (id: string) => Promise<Record<string, unknown> | null>;

  // Loading states
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
}

export function useTable(tableName: string, options: UseTableOptions = {}): UseTableReturn {
  const {
    initialPage = 1,
    initialPageSize = DEFAULT_PAGE_SIZE,
    initialSort,
    initialFilters = {},
    initialSearch = '',
  } = options;

  // Config state
  const [config, setConfig] = useState<TableConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  // Data state
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination state
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Sort & Filter state
  const [sort, setSort] = useState<SortConfig | null>(initialSort || null);
  const [filters, setFilters] = useState<TableFilters>(initialFilters);
  const [search, setSearch] = useState(initialSearch);

  // Action loading states
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchConfig = useCallback(async () => {
    setIsLoadingConfig(true);
    try {
      const response = await fetchWithAuth(`/api/tables/${tableName}`);
      if (!response.ok) throw new Error('Failed to fetch table config');

      const data: TableConfig = await response.json();
      setConfig(data);

      // Set default sort if not already set
      if (!sort && data.default_sort) {
        setSort(data.default_sort);
      }
    } catch (error) {
      console.error('Error fetching table config:', error);
      toast.error('Failed to load table configuration');
    } finally {
      setIsLoadingConfig(false);
    }
  }, [tableName, sort]);

  const fetchRows = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });

      if (sort) {
        params.append('sort_by', sort.column);
        params.append('sort_direction', sort.direction);
      }

      if (search) {
        params.append('search', search);
      }

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(`filter[${key}]`, String(value));
        }
      });

      const response = await fetchWithAuth(`/api/tables/${tableName}/rows?${params}`);
      if (!response.ok) throw new Error('Failed to fetch rows');

      const data: TableRowsResponse = await response.json();
      setRows(data.data);
      setTotalPages(data.pagination.total_pages);
      setTotal(data.pagination.total);
    } catch (error) {
      console.error('Error fetching rows:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [tableName, page, pageSize, sort, filters, search]);

  const handleSort = useCallback((column: string) => {
    setSort((prev) => ({
      column,
      direction: prev?.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const getRow = useCallback(
    async (id: string): Promise<Record<string, unknown> | null> => {
      try {
        const response = await fetchWithAuth(`/api/tables/${tableName}/rows/${id}`);
        if (!response.ok) throw new Error('Failed to fetch row');
        return response.json();
      } catch (error) {
        console.error('Error fetching row:', error);
        toast.error('Failed to load record');
        return null;
      }
    },
    [tableName]
  );

  const createRow = useCallback(
    async (data: Record<string, unknown>): Promise<boolean> => {
      setIsCreating(true);
      try {
        const response = await fetchWithAuth(`/api/tables/${tableName}/rows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to create');
        }

        toast.success('Record created successfully');
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create record';
        toast.error(message);
        return false;
      } finally {
        setIsCreating(false);
      }
    },
    [tableName]
  );

  const updateRow = useCallback(
    async (id: string, data: Record<string, unknown>): Promise<boolean> => {
      setIsUpdating(true);
      try {
        const response = await fetchWithAuth(`/api/tables/${tableName}/rows/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to update');
        }

        toast.success('Record updated successfully');
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update record';
        toast.error(message);
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [tableName]
  );

  const deleteRow = useCallback(
    async (id: string): Promise<boolean> => {
      setIsDeleting(true);
      try {
        const response = await fetchWithAuth(`/api/tables/${tableName}/rows/${id}`, {
          method: 'DELETE',
        });

        if (!response.ok) throw new Error('Failed to delete');

        toast.success('Record deleted successfully');
        return true;
      } catch (error) {
        console.error('Error deleting:', error);
        toast.error('Failed to delete record');
        return false;
      } finally {
        setIsDeleting(false);
      }
    },
    [tableName]
  );

  const activateRow = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response = await fetchWithAuth(
          `/api/tables/${tableName}/rows/${id}/activate`,
          { method: 'POST' }
        );

        if (!response.ok) throw new Error('Failed to activate');

        toast.success('Record activated successfully');
        return true;
      } catch (error) {
        console.error('Error activating:', error);
        toast.error('Failed to activate record');
        return false;
      }
    },
    [tableName]
  );

  const deactivateRow = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response = await fetchWithAuth(
          `/api/tables/${tableName}/rows/${id}/deactivate`,
          { method: 'POST' }
        );

        if (!response.ok) throw new Error('Failed to deactivate');

        toast.success('Record deactivated successfully');
        return true;
      } catch (error) {
        console.error('Error deactivating:', error);
        toast.error('Failed to deactivate record');
        return false;
      }
    },
    [tableName]
  );

  // Fetch config on mount
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Fetch rows when dependencies change
  useEffect(() => {
    if (config) {
      fetchRows();
    }
  }, [config, fetchRows]);

  return {
    config,
    isLoadingConfig,
    rows,
    isLoading,
    page,
    pageSize,
    totalPages,
    total,
    setPage,
    setPageSize,
    sort,
    setSort,
    handleSort,
    filters,
    setFilters,
    search,
    setSearch,
    fetchConfig,
    fetchRows,
    createRow,
    updateRow,
    deleteRow,
    activateRow,
    deactivateRow,
    getRow,
    isCreating,
    isUpdating,
    isDeleting,
  };
}
