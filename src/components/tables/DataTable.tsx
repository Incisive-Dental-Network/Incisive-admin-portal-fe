'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { Plus, Download, Check, X, Loader2 } from 'lucide-react';

// Tables that support inline editing with their editable columns
// If a table is listed here, only the specified columns will be editable
const INLINE_EDITABLE_COLUMNS: Record<string, string[]> = {
  product_lab_markup: ['cost', 'standard_price', 'nf_price', 'commitment_eligible'],
  product_lab_rev_share: [], // Uses dynamic fee_ columns, handled separately
};

// Columns that should NEVER be editable inline (safety check)
const NON_EDITABLE_COLUMNS = ['id', 'created_at', 'updated_at'];

// Tables with custom endpoints and data transformation
const CUSTOM_TABLE_CONFIG: Record<string, {
  endpoint: string;
  patchEndpoint?: string;
  appendRowIdToPatch?: boolean; // Whether to append rowId to patchEndpoint
  visibleBaseColumns?: string[]; // Which base columns to show (if transformData is used)
  transformData?: (data: Record<string, unknown>[]) => {
    rows: Record<string, unknown>[];
    dynamicColumns: TableColumn[];
  };
  getPatchBody?: (row: Record<string, unknown>, columnKey: string, value: unknown) => Record<string, unknown>;
}> = {
  product_lab_markup: {
    endpoint: '/api/tables/product_lab_markup/rows',
    patchEndpoint: '/api/tables/product_lab_markup/rows',
    appendRowIdToPatch: false,
    visibleBaseColumns: ['lab_id', 'lab_product_id', 'cost', 'standard_price', 'nf_price', 'commitment_eligible'],
    getPatchBody: (row, columnKey, value) => {
      // Send identifiers + only the field being updated
      return {
        lab_id: row.lab_id,
        lab_product_id: row.lab_product_id,
        [columnKey]: value === '' ? null : value,
      };
    },
  },
  product_lab_rev_share: {
    endpoint: '/api/tables/product_lab_rev_share/rows',
    patchEndpoint: '/api/tables/product_lab_rev_share/rows',
    appendRowIdToPatch: false,
    visibleBaseColumns: ['lab_id', 'lab_product_id'],
    transformData: (data) => {
      // Extract all unique schedule names from schedule_name
      const scheduleNames = new Set<string>();
      data.forEach((row) => {
        const feeSchedules = row.schedule_name as Record<string, number | null> | undefined;
        if (feeSchedules) {
          Object.keys(feeSchedules).forEach((name) => scheduleNames.add(name));
        }
      });
      const sortedSchedules = Array.from(scheduleNames).sort();

      // Generate dynamic columns for each schedule
      const dynamicColumns: TableColumn[] = sortedSchedules.map((name) => ({
        key: `fee_${name}`,
        label: name,
        type: 'number' as const,
        sortable: false,
        filterable: false,
        editable: true,
        required: false,
      }));

      // Flatten rows - schedule_name values are directly the revenue_share
      const rows = data.map((row) => {
        const flatRow: Record<string, unknown> = {
          lab_id: row.lab_id,
          lab_product_id: row.lab_product_id,
        };

        const feeSchedules = row.schedule_name as Record<string, number | null> | undefined;
        sortedSchedules.forEach((name) => {
          flatRow[`fee_${name}`] = feeSchedules?.[name] ?? null;
        });

        return flatRow;
      });

      return { rows, dynamicColumns };
    },
    getPatchBody: (row, columnKey, value) => {
      // Extract schedule name from column key (remove 'fee_' prefix)
      const scheduleName = columnKey.replace('fee_', '');
      return {
        lab_id: row.lab_id,
        lab_product_id: row.lab_product_id,
        schedule_name: scheduleName,
        revenue_share: value === '' || value === null ? null : parseFloat(String(value)),
      };
    },
  },
};

interface DataTableProps {
  tableName: string;
  config: TableConfig | null;
  isLoadingConfig: boolean;
}

interface EditingCell {
  rowIndex: number;  // For tracking which row (React key)
  rowId: string;     // For API calls
  columnKey: string;
  originalValue: unknown;
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
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]); // Original data before transformation
  const [autoColumns, setAutoColumns] = useState<TableColumn[]>([]);
  const [dynamicColumns, setDynamicColumns] = useState<TableColumn[]>([]); // For transformed tables
  const [isLoading, setIsLoading] = useState(true);

  // Get custom config for this table
  const customConfig = CUSTOM_TABLE_CONFIG[tableName];
  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<SortConfig | null>(null);
  const [filters, setFilters] = useState<TableFiltersType>({});
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  // Inline editing state
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isSavingCell, setIsSavingCell] = useState(false);

  // Ref to track if a fetch is in progress
  const fetchInProgress = useRef(false);
  const fetchAbortController = useRef<AbortController | null>(null);

  // Check if this table supports inline editing
  const supportsInlineEdit = tableName in INLINE_EDITABLE_COLUMNS;
  const editableColumns = INLINE_EDITABLE_COLUMNS[tableName] || [];


  const fetchRows = useCallback(async () => {
    // Allow fetch for custom tables even without config
    if (!config && !customConfig) return;

    // Prevent duplicate concurrent fetches
    if (fetchInProgress.current) {
      return;
    }

    // Cancel any previous fetch
    if (fetchAbortController.current) {
      fetchAbortController.current.abort();
    }
    fetchAbortController.current = new AbortController();

    fetchInProgress.current = true;
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

      // Use custom endpoint if configured, otherwise default
      const endpoint = customConfig?.endpoint
        ? `${customConfig.endpoint}?${params}`
        : `/api/tables/${tableName}/rows?${params}`;

      const response = await fetchWithAuth(endpoint, {
        signal: fetchAbortController.current?.signal,
      });
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

      // Apply data transformation if configured
      if (customConfig?.transformData) {
        const { rows: transformedRows, dynamicColumns: dynCols } = customConfig.transformData(rowsData);
        setRawRows(rowsData);
        setRows(transformedRows);
        setDynamicColumns(dynCols);
      } else {
        setRawRows(rowsData);
        setRows(rowsData);
        setDynamicColumns([]);
      }

      setTotalPages(meta.totalPages || meta.total_pages || 1);
      setTotal(meta.total || rowsData.length);

      // Auto-generate columns if no config provided and no custom transform
      if (!config && !customConfig && rowsData.length > 0) {
        setAutoColumns(generateColumnsFromData(rowsData));
      }
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      console.error('Error fetching rows:', error);
      toast.error('Failed to load data');
    } finally {
      fetchInProgress.current = false;
      setIsLoading(false);
    }
  }, [tableName, config, customConfig, page, pageSize, sort, filters, search]);

  // Set default sort from config
  useEffect(() => {
    if (config?.default_sort && !sort) {
      setSort(config.default_sort);
    }
  }, [config, sort]);

  // Single fetch effect - handles both custom and regular tables
  useEffect(() => {
    // For custom tables, fetch immediately (don't wait for config)
    if (customConfig) {
      fetchRows();
      return;
    }

    // For regular tables, wait for config to be loaded
    if (!isLoadingConfig && config) {
      fetchRows();
    }

    // Cleanup: abort fetch on unmount or dependency change
    return () => {
      if (fetchAbortController.current) {
        fetchAbortController.current.abort();
      }
      fetchInProgress.current = false;
    };
  }, [tableName, isLoadingConfig, config, customConfig, page, pageSize, sort, filters, search, fetchRows]);

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
    router.push(`/tables/${tableName}/${encodeURIComponent(id)}`);
  };

  const handleEdit = (id: string) => {
    router.push(`/tables/${tableName}/${encodeURIComponent(id)}?edit=true`);
  };

  const handleDelete = async (id: string, row?: Record<string, unknown>) => {
    setDeletingId(id);
    try {
      let response;

      // For composite key tables (product_lab_rev_share, product_lab_markup), send DELETE with JSON body
      const compositeKeyTables = ['product_lab_rev_share', 'product_lab_markup'];
      if (compositeKeyTables.includes(tableName) && row) {
        response = await fetchWithAuth(`/api/tables/${tableName}/rows`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lab_id: row.lab_id,
            lab_product_id: row.lab_product_id,
          }),
        });
      } else if (tableName === 'fee_schedules' && row) {
        // For fee_schedules, use schedule_name as the identifier
        const scheduleName = encodeURIComponent(String(row.schedule_name || ''));
        response = await fetchWithAuth(`/api/tables/${tableName}/rows/${scheduleName}`, {
          method: 'DELETE',
        });
      } else {
        response = await fetchWithAuth(`/api/tables/${tableName}/rows/${id}`, {
          method: 'DELETE',
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete');
      }

      toast.success('Item deleted successfully');
      fetchRows();
    } catch (error) {
      console.error('Error deleting:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete item';
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleActivate = async (id: string) => {
    setActivatingId(id);
    try {
      // Encode ID for URL (important for fee_schedules which uses schedule_name)
      const encodedId = encodeURIComponent(id);
      const response = await fetchWithAuth(
        `/api/tables/${tableName}/rows/${encodedId}`,
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
      // Encode ID for URL (important for fee_schedules which uses schedule_name)
      const encodedId = encodeURIComponent(id);
      const response = await fetchWithAuth(
        `/api/tables/${tableName}/rows/${encodedId}`,
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

  // Inline edit handlers
  const handleCellClick = (rowIndex: number, rowId: string, columnKey: string, currentValue: unknown) => {
    if (!supportsInlineEdit) return;
    if (NON_EDITABLE_COLUMNS.includes(columnKey)) return;
    // Only allow editing columns in the editable list or dynamic fee_ columns
    if (!editableColumns.includes(columnKey) && !columnKey.startsWith('fee_')) return;
    if (editingCell?.rowIndex === rowIndex && editingCell?.columnKey === columnKey) return;

    setEditingCell({ rowIndex, rowId, columnKey, originalValue: currentValue });
    setEditValue(currentValue !== null && currentValue !== undefined ? String(currentValue) : '');
  };

  const handleCellBlur = async () => {
    if (!editingCell) return;

    const { rowIndex, rowId, columnKey, originalValue } = editingCell;
    const newValue = editValue;

    // If value hasn't changed, just cancel
    if (String(originalValue ?? '') === newValue) {
      setEditingCell(null);
      setEditValue('');
      return;
    }

    // Get the current row by index
    const currentRow = rows[rowIndex];

    // Save the new value
    setIsSavingCell(true);
    try {
      // Use custom PATCH endpoint and body if configured
      let endpoint: string;
      let body: Record<string, unknown>;

      if (customConfig?.getPatchBody) {
        // Use custom endpoint, optionally append rowId
        const baseEndpoint = customConfig.patchEndpoint || `/api/tables/${tableName}/rows`;
        endpoint = customConfig.appendRowIdToPatch !== false
          ? `${baseEndpoint}/${rowId}`
          : baseEndpoint;
        body = customConfig.getPatchBody(currentRow, columnKey, newValue);
      } else {
        endpoint = `/api/tables/${tableName}/rows/${rowId}`;
        body = { [columnKey]: newValue };
      }

      const response = await fetchWithAuth(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update');
      }

      // Update local state
      setRows((prevRows) =>
        prevRows.map((row, idx) => {
          if (idx === rowIndex) {
            return { ...row, [columnKey]: newValue };
          }
          return row;
        })
      );

      toast.success('Updated successfully');
    } catch (error) {
      console.error('Error updating cell:', error);
      toast.error('Failed to update');
      // Revert to original value in UI
      setRows((prevRows) =>
        prevRows.map((row, idx) => {
          if (idx === rowIndex) {
            return { ...row, [columnKey]: originalValue };
          }
          return row;
        })
      );
    } finally {
      setIsSavingCell(false);
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
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
  // For custom tables with dynamic columns, merge fixed columns with dynamic ones
  const baseColumns = config?.columns || autoColumns;
  const filteredBaseColumns = customConfig?.visibleBaseColumns
    ? baseColumns.filter(col => customConfig.visibleBaseColumns!.includes(col.key))
    : baseColumns;
  const columns = customConfig?.transformData
    ? [...filteredBaseColumns, ...dynamicColumns]
    : filteredBaseColumns;
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
              <TableHeaderCell className="w-24" sticky>Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableEmpty colSpan={columns.length + 1} />
            ) : (
              rows.map((row, index) => {
                // Find the row ID for API calls
                // Use composite key for tables without a single primary key
                const compositeKeyTables = ['product_lab_rev_share', 'product_lab_markup'];
                let rowId: string;
                if (compositeKeyTables.includes(tableName)) {
                  rowId = `${row.lab_id}-${row.lab_product_id}`;
                } else if (tableName === 'fee_schedules') {
                  rowId = String(row.schedule_name || '');
                } else {
                  rowId = String(
                    row.id ??
                    row[`${tableName.replace(/s$/, '')}_id`] ??
                    row[Object.keys(row).find(k => k.endsWith('_id')) || 'id'] ??
                    index
                  );
                }
                // Use index-based key for React to ensure uniqueness
                const reactKey = `row-${index}`;
                const isActive = Boolean(row.is_active ?? row.active ?? true);

                return (
                  <TableRow key={reactKey}>
                    {columns.map((column) => {
                      const isEditing = editingCell?.rowIndex === index && editingCell?.columnKey === column.key;
                      // Check if column is editable: must be in editable list OR be a dynamic fee_ column for rev_share table
                      const isEditableColumn = supportsInlineEdit &&
                        !NON_EDITABLE_COLUMNS.includes(column.key) &&
                        (editableColumns.includes(column.key) || column.key.startsWith('fee_'));

                      return (
                        <TableCell
                          key={column.key}
                          onClick={() => isEditableColumn && handleCellClick(index, rowId, column.key, row[column.key])}
                          className={isEditableColumn ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50' : ''}
                        >
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                type={column.type === 'number' ? 'number' : 'text'}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleCellBlur}
                                onKeyDown={handleCellKeyDown}
                                autoFocus
                                className="min-w-[120px] w-full px-2 py-1 text-sm border border-primary-500 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                              />
                              {isSavingCell && (
                                <Loader2 className="h-4 w-4 animate-spin text-primary-500" />
                              )}
                            </div>
                          ) : (
                            renderCellValue(column, row[column.key])
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell sticky>
                      <TableActions
                        permissions={permissions}
                        onView={() => handleView(rowId)}
                        onEdit={() => handleEdit(rowId)}
                        onDelete={() => handleDelete(rowId, row)}
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
