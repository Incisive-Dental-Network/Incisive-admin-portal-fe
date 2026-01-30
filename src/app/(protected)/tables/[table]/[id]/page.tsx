'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { DynamicForm } from '@/components/tables/DynamicForm';
import { Button } from '@/components/ui/Button';
import { SkeletonForm } from '@/components/ui/Skeleton';
import { StatusBadge, RoleBadge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/Toast';
import { ROUTES } from '@/config/ui.constants';
import { canEdit } from '@/lib/permissions';
import { formatDateTime } from '@/lib/utils';
import { fetchWithAuth } from '@/lib/fetch-client';
import { ChevronLeft, Pencil } from 'lucide-react';
import type { TableConfig, TableColumn } from '@/types';

// Tables that use composite keys and need filters instead of path-based ID
const COMPOSITE_KEY_TABLES: Record<string, string[]> = {
  product_lab_rev_share: ['lab_id', 'lab_product_id'],
  product_lab_markup: ['lab_id', 'lab_product_id'],
};

// Transform row data for product_lab_rev_share - flatten schedule_name
const transformRevShareRow = (row: Record<string, unknown>): {
  transformedRow: Record<string, unknown>;
  dynamicColumns: TableColumn[];
} => {
  const feeSchedules = row.schedule_name as Record<string, number | null> | undefined;

  if (!feeSchedules) {
    return { transformedRow: row, dynamicColumns: [] };
  }

  const scheduleNames = Object.keys(feeSchedules).sort();

  // Generate dynamic columns for each schedule
  const dynamicColumns: TableColumn[] = scheduleNames.map((name) => ({
    key: name,
    label: name,
    type: 'number' as const,
    sortable: false,
    filterable: false,
    editable: true,
    required: false,
  }));

  // Flatten row - add schedule fields directly (no fee_ prefix)
  const transformedRow: Record<string, unknown> = {
    lab_id: row.lab_id,
    lab_product_id: row.lab_product_id,
  };

  scheduleNames.forEach((name) => {
    transformedRow[name] = feeSchedules[name];
  });

  return { transformedRow, dynamicColumns };
};

export default function RowDetailPage() {
  const params = useParams();
  const tableName = params.table as string;
  const id = decodeURIComponent(params.id as string);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('edit') === 'true';

  const [config, setConfig] = useState<TableConfig | null>(null);
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Build row fetch URL - use filters for composite key tables
  const getRowFetchUrl = () => {
    const compositeKeys = COMPOSITE_KEY_TABLES[tableName];
    if (compositeKeys) {
      // Split only on first hyphen to handle values that contain hyphens (e.g., "08540-SB")
      const firstHyphenIndex = id.indexOf('-');
      const filters: Record<string, string> = {};
      if (firstHyphenIndex !== -1) {
        filters[compositeKeys[0]] = id.substring(0, firstHyphenIndex);
        filters[compositeKeys[1]] = id.substring(firstHyphenIndex + 1);
      } else {
        // Fallback if no hyphen found
        filters[compositeKeys[0]] = id;
      }
      return `/api/tables/${tableName}/rows?filters=${encodeURIComponent(JSON.stringify(filters))}`;
    }
    // For fee_schedules, id is the schedule_name - encode it for URL
    if (tableName === 'fee_schedules') {
      return `/api/tables/${tableName}/rows/${encodeURIComponent(id)}`;
    }
    return `/api/tables/${tableName}/rows/${id}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [configResponse, rowResponse] = await Promise.all([
          fetchWithAuth(`/api/tables/${tableName}`),
          fetchWithAuth(getRowFetchUrl()),
        ]);

        if (configResponse.ok) {
          let configData = await configResponse.json();
          if (configData.success && configData.data) {
            configData = configData.data;
          }
          setConfig(configData);
        }

        if (rowResponse.ok) {
          let rowData = await rowResponse.json();
          if (rowData.success && rowData.data) {
            rowData = rowData.data;
          }
          if (Array.isArray(rowData)) {
            setRow(rowData[0] || null);
          } else if (rowData.data && Array.isArray(rowData.data)) {
            setRow(rowData.data[0] || null);
          } else {
            setRow(rowData);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load record');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [tableName, id]);

  const getPatchUrl = () => {
    const compositeKeys = COMPOSITE_KEY_TABLES[tableName];
    if (compositeKeys) {
      return `/api/tables/${tableName}/rows`;
    }
    // For fee_schedules, id is the schedule_name - encode it for URL
    if (tableName === 'fee_schedules') {
      return `/api/tables/${tableName}/rows/${encodeURIComponent(id)}`;
    }
    return `/api/tables/${tableName}/rows/${id}`;
  };

  const handleUpdate = async (data: Record<string, unknown>) => {
    setIsUpdating(true);
    try {
      // Transform data for product_lab_rev_share - convert schedule fields back to schedule_name    
      let submitData = data;
      if (tableName === 'product_lab_rev_share' && row?.schedule_name) {
        const originalSchedules = row.schedule_name as Record<string, unknown>;
        const feeSchedules: Record<string, number | null> = {};
        const otherData: Record<string, unknown> = {};

        Object.entries(data).forEach(([key, value]) => {
          if (key in originalSchedules) {
            feeSchedules[key] = value === '' || value === null ? null : Number(value);
          } else {
            otherData[key] = value;
          }
        });

        submitData = {
          ...otherData,
          schedule_name: feeSchedules,
        };
      }

      const response = await fetchWithAuth(getPatchUrl(), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Update failed');
      }

      let updatedRow = await response.json();
      if (updatedRow.success && updatedRow.data) {
        updatedRow = updatedRow.data;
      }
      // Handle nested array response
      if (updatedRow.data && Array.isArray(updatedRow.data)) {
        updatedRow = updatedRow.data[0];
      } else if (Array.isArray(updatedRow)) {
        updatedRow = updatedRow[0];
      }
      setRow(updatedRow);
      toast.success('Record updated successfully');
      router.push(`${ROUTES.TABLES}/${tableName}/${encodeURIComponent(id)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed';
      toast.error(message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    router.push(`${ROUTES.TABLES}/${tableName}/${encodeURIComponent(id)}`);
  };

  const renderValue = (column: TableColumn, value: unknown) => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400 dark:text-gray-500">-</span>;
    }

    switch (column.type) {
      case 'boolean':
        return <StatusBadge isActive={Boolean(value)} />;
      case 'date':
        return formatDateTime(String(value));
      case 'select':
        const option = column.options?.find((opt) => opt.value === value);
        return option?.label || String(value);
      default:
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`${ROUTES.TABLES}/${tableName}`}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <SkeletonForm />
        </div>
      </div>
    );
  }

  if (!config || !row) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`${ROUTES.TABLES}/${tableName}`}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">Record not found</p>
        </div>
      </div>
    );
  }

  // Known foreign key fields that should be shown if present in data
  const FOREIGN_KEY_COLUMNS: Record<string, TableColumn> = {
    practice_id: {
      key: 'practice_id',
      label: 'Practice Id',
      type: 'number',
      sortable: true,
      filterable: true,
      editable: true,
      required: false,
    },
    lab_id: {
      key: 'lab_id',
      label: 'Lab Id',
      type: 'number',
      sortable: true,
      filterable: true,
      editable: true,
      required: false,
    },
    dental_group_id: {
      key: 'dental_group_id',
      label: 'Dental Group Id',
      type: 'number',
      sortable: true,
      filterable: true,
      editable: true,
      required: false,
    },
    incisive_product_id: {
      key: 'incisive_product_id',
      label: 'Incisive Product Id',
      type: 'text',
      sortable: true,
      filterable: true,
      editable: true,
      required: false,
    },
  };

  // Transform data for product_lab_rev_share
  let displayRow = row;
  let baseColumns = config.columns.filter((col) => col.key in row);

  // Add missing foreign key columns OR update existing ones to be editable
  const existingKeys = new Set(baseColumns.map((col) => col.key));
  Object.entries(FOREIGN_KEY_COLUMNS).forEach(([key, column]) => {
    if (key in row) {
      if (!existingKeys.has(key)) {
        // Add missing column
        baseColumns.push(column);
      } else {
        // Update existing column to be editable
        const existingIndex = baseColumns.findIndex((col) => col.key === key);
        if (existingIndex !== -1) {
          baseColumns[existingIndex] = { ...baseColumns[existingIndex], editable: true };
        }
      }
    }
  });

  // Add any missing columns from row data that aren't in config
  const systemColumns = ['id', 'created_at', 'updated_at'];
  Object.keys(row).forEach((key) => {
    if (!existingKeys.has(key) && !systemColumns.includes(key)) {
      // Auto-generate column definition
      const value = row[key];
      baseColumns.push({
        key,
        label: key
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        type: typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'text',
        sortable: true,
        filterable: true,
        editable: true,
        required: false,
      });
      existingKeys.add(key);
    }
  });

  // Ensure all non-system columns are editable
  baseColumns = baseColumns.map((col) => {
    if (!systemColumns.includes(col.key)) {
      return { ...col, editable: true };
    }
    return col;
  });

  let displayColumns = baseColumns;

  if (tableName === 'product_lab_rev_share' && row.schedule_name) {
    const { transformedRow, dynamicColumns } = transformRevShareRow(row);
    displayRow = transformedRow;
    displayColumns = [
      ...config.columns.filter((col) => col.key in transformedRow),
      ...dynamicColumns,
    ];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Link href={ROUTES.TABLES} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
          Tables
        </Link>
        <span className="text-gray-400 dark:text-gray-500">/</span>
        <Link href={`${ROUTES.TABLES}/${tableName}`} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
          {config.label}
        </Link>
        <span className="text-gray-400 dark:text-gray-500">/</span>
        <span className="text-gray-900 dark:text-white font-medium">
          {isEditMode ? 'Edit' : 'View'}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEditMode ? 'Edit Record' : 'Record Details'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {config.label} - ID: {id}
          </p>
        </div>

        {!isEditMode && canEdit(config.permissions) && (
          <Button
            onClick={() => router.push(`${ROUTES.TABLES}/${tableName}/${encodeURIComponent(id)}?edit=true`)}
            leftIcon={<Pencil className="h-4 w-4" />}
          >
            Edit
          </Button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        {isEditMode ? (
          <div className="p-6">
            <DynamicForm
              tableName={tableName}
              columns={displayColumns}
              initialData={displayRow}
              onSubmit={handleUpdate}
              onCancel={handleCancel}
              isLoading={isUpdating}
              isEditMode
            />
          </div>
        ) : (
          <dl className="divide-y divide-gray-200 dark:divide-gray-700">
            {displayColumns.map((column) => (
              <div key={column.key} className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{column.label}</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:col-span-2 sm:mt-0">
                  {renderValue(column, displayRow[column.key])}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}