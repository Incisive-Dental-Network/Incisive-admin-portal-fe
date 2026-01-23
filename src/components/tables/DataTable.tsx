'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  TableEmpty,
} from '@/components/ui/Table';
import { Pagination, PaginationInfo } from '@/components/ui/Pagination';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Badge, StatusBadge, RoleBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import { TableFilters } from './TableFilters';
import { TableActions } from './TableActions';
import { formatDate, formatDateTime } from '@/lib/utils';
import { canCreate } from '@/lib/permissions';
import { fetchWithAuth } from '@/lib/fetch-client';
import { DEFAULT_PAGE_SIZE } from '@/config/ui.constants';
import type {
  TableConfig,
  TableColumn,
  TableRowsResponse,
  TableFilters as TableFiltersType,
  SortConfig,
  TablePermissions,
} from '@/types';
import { Plus, Download } from 'lucide-react';

interface DataTableProps {
  tableName: string;
  config: TableConfig | null;
  isLoadingConfig: boolean;
}

// Helper to generate columns from data
function generateColumnsFromData(data: Record<string, unknown>[]): TableColumn[] {
  if (!data.length) return [];

  const firstRow = data[0];
  const excludeKeys = ['id', 'password', 'password_hash'];

  return Object.keys(firstRow)
    .filter((key) => !excludeKeys.includes(key))
    .map((key) => ({
      key,
      label: key
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase())
        .trim(),
      type: getColumnType(key, firstRow[key]),
      sortable: true,
      filterable: true,
      editable: !['id', 'created_at', 'updated_at'].includes(key),
      required: false,
    }));
}

function getColumnType(key: string, value: unknown): TableColumn['type'] {
  if (key === 'email') return 'email';
  if (key.includes('date') || key.includes('_at')) return 'date';
  if (typeof value === 'boolean' || key.startsWith('is_') || key === 'active') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (key === 'role' || key === 'status') return 'select';
  return 'text';
}

export function DataTable({ tableName, config, isLoadingConfig }: DataTableProps) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [autoColumns, setAutoColumns] = useState<TableColumn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<SortConfig | null>(null);
  const [filters, setFilters] = useState<TableFiltersType>({});
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    if (!config) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });

      if (sort) {
        params.append('sortBy', sort.column);
        params.append('sortOrder', sort.direction);
      }

      if (search) {
        params.append('search', search);
      }

      // Add filters as JSON object
      const activeFilters: Record<string, string> = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          activeFilters[key] = String(value);
        }
      });
      if (Object.keys(activeFilters).length > 0) {
        params.append('filters', JSON.stringify(activeFilters));
      }

      const response = await fetchWithAuth(`/api/tables/${tableName}/rows?${params}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch rows');
      }

      let result = await response.json();

      // Handle wrapped response: { success: true, data: { data: [...], meta: {...} } }
      if (result.success && result.data) {
        result = result.data;
      }

      // Handle nested data array and meta
      const rowsData = result.data || result.rows || [];
      const meta = result.meta || result.pagination || {};

      setRows(rowsData);
      setTotalPages(meta.totalPages || meta.total_pages || 1);
      setTotal(meta.total || rowsData.length);

      // Auto-generate columns if no config provided
      if (!config && rowsData.length > 0) {
        setAutoColumns(generateColumnsFromData(rowsData));
      }
    } catch (error) {
      console.error('Error fetching rows:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [tableName, config, page, pageSize, sort, filters, search]);

  useEffect(() => {
    if (config?.default_sort) {
      setSort(config.default_sort);
    }
  }, [config]);

  useEffect(() => {
    // Fetch rows even if config is not loaded yet
    if (!isLoadingConfig) {
      fetchRows();
    }
  }, [fetchRows, isLoadingConfig]);

  const handleSort = (column: string) => {
    setSort((prev) => ({
      column,
      direction:
        prev?.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleFilterChange = (newFilters: TableFiltersType) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handleSearch = (searchValue: string) => {
    setSearch(searchValue);
    setPage(1);
  };

  const handleView = (id: string) => {
    router.push(`/tables/${tableName}/${id}`);
  };

  const handleEdit = (id: string) => {
    router.push(`/tables/${tableName}/${id}?edit=true`);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await fetchWithAuth(`/api/tables/${tableName}/rows/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');

      toast.success('Item deleted successfully');
      fetchRows();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete item');
    } finally {
      setDeletingId(null);
    }
  };

  const handleActivate = async (id: string) => {
    setActivatingId(id);
    try {
      const response = await fetchWithAuth(
        `/api/tables/${tableName}/rows/${id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: true }),
        }
      );

      if (!response.ok) throw new Error('Failed to activate');

      toast.success('Item activated successfully');
      fetchRows();
    } catch (error) {
      console.error('Error activating:', error);
      toast.error('Failed to activate item');
    } finally {
      setActivatingId(null);
    }
  };

  const handleDeactivate = async (id: string) => {
    setActivatingId(id);
    try {
      const response = await fetchWithAuth(
        `/api/tables/${tableName}/rows/${id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: false }),
        }
      );

      if (!response.ok) throw new Error('Failed to deactivate');

      toast.success('Item deactivated successfully');
      fetchRows();
    } catch (error) {
      console.error('Error deactivating:', error);
      toast.error('Failed to deactivate item');
    } finally {
      setActivatingId(null);
    }
  };

  const handleCreate = () => {
    router.push(`/tables/${tableName}/new`);
  };

  const handleDownloadCSV = () => {
    if (!rows.length || !columns.length) {
      toast.error('No data to download');
      return;
    }

    // Create CSV header
    const headers = columns.map((col) => col.label).join(',');

    // Create CSV rows
    const csvRows = rows.map((row) =>
      columns
        .map((col) => {
          const value = row[col.key];
          if (value === null || value === undefined) return '';
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(',')
    );

    // Combine header and rows
    const csvContent = [headers, ...csvRows].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tableName}_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Data downloaded successfully');
  };

  const renderCellValue = (column: TableColumn, value: unknown) => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400">-</span>;
    }

    switch (column.type) {
      case 'boolean':
        return <StatusBadge isActive={Boolean(value)} />;

      case 'date':
        return formatDate(String(value));

      case 'select':
        const option = column.options?.find((opt) => opt.value === value);
        return option?.label || String(value);

      default:
        // Check for special column keys
        if (column.key === 'role') {
          return <RoleBadge role={String(value)} />;
        }
        if (column.key === 'is_active' || column.key === 'active') {
          return <StatusBadge isActive={Boolean(value)} />;
        }
        if (column.key === 'created_at' || column.key === 'updated_at') {
          return formatDateTime(String(value));
        }

        return String(value);
    }
  };

  if (isLoadingConfig && !rows.length) {
    return <SkeletonTable rows={10} columns={5} />;
  }

  // Use config columns if available, otherwise use auto-generated columns
  const columns = config?.columns || autoColumns;
  const permissions = config?.permissions || {
    read: true,
    create: false,
    update: false,
    delete: false,
    actions: [],
  };
  const tableLabel = config?.label || tableName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  if (!columns.length && !isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{tableLabel}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{total} total records</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadCSV}
            leftIcon={<Download className="h-4 w-4" />}
            disabled={!rows.length}
          >
            Download Data
          </Button>
          {canCreate(permissions) && (
            <Button onClick={handleCreate} leftIcon={<Plus className="h-4 w-4" />}>
              Add New
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <TableFilters
        columns={columns}
        filters={filters}
        onFilterChange={handleFilterChange}
        onSearch={handleSearch}
        searchValue={search}
      />

      {/* Table */}
      {isLoading ? (
        <SkeletonTable rows={pageSize} columns={columns.length + 1} />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableHeaderCell
                  key={column.key}
                  sortable={column.sortable}
                  sorted={
                    sort?.column === column.key ? sort.direction : false
                  }
                  onSort={() => column.sortable && handleSort(column.key)}
                >
                  {column.label}
                </TableHeaderCell>
              ))}
              <TableHeaderCell className="w-24">Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableEmpty colSpan={columns.length + 1} />
            ) : (
              rows.map((row, index) => {
                // Find the row ID - could be 'id' or '{tableName}_id' or first column ending with '_id'
                const rowId = String(
                  row.id ??
                  row[`${tableName.replace(/s$/, '')}_id`] ??
                  row[Object.keys(row).find(k => k.endsWith('_id')) || 'id'] ??
                  index
                );
                const isActive = Boolean(row.is_active ?? row.active ?? true);

                return (
                  <TableRow key={rowId}>
                    {columns.map((column) => (
                      <TableCell key={column.key}>
                        {renderCellValue(column, row[column.key])}
                      </TableCell>
                    ))}
                    <TableCell>
                      <TableActions
                        permissions={permissions}
                        onView={() => handleView(rowId)}
                        onEdit={() => handleEdit(rowId)}
                        onDelete={() => handleDelete(rowId)}
                        onActivate={() => handleActivate(rowId)}
                        onDeactivate={() => handleDeactivate(rowId)}
                        isActive={isActive}
                        isDeleting={deletingId === rowId}
                        isActivating={activatingId === rowId}
                        compact
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <PaginationInfo
            currentPage={page}
            pageSize={pageSize}
            total={total}
          />
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}
