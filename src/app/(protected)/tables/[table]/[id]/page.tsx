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

export default function RowDetailPage() {
  const params = useParams();
  const tableName = params.table as string;
  const id = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('edit') === 'true';

  const [config, setConfig] = useState<TableConfig | null>(null);
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [configResponse, rowResponse] = await Promise.all([
          fetchWithAuth(`/api/tables/${tableName}`),
          fetchWithAuth(`/api/tables/${tableName}/rows/${id}`),
        ]);

        if (configResponse.ok) {
          let configData = await configResponse.json();
          // Handle wrapped response
          if (configData.success && configData.data) {
            configData = configData.data;
          }
          setConfig(configData);
        }

        if (rowResponse.ok) {
          let rowData = await rowResponse.json();
          // Handle wrapped response
          if (rowData.success && rowData.data) {
            rowData = rowData.data;
          }
          setRow(rowData);
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

  const handleUpdate = async (data: Record<string, unknown>) => {
    setIsUpdating(true);
    try {
      const response = await fetchWithAuth(`/api/tables/${tableName}/rows/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Update failed');
      }

      let updatedRow = await response.json();
      // Handle wrapped response
      if (updatedRow.success && updatedRow.data) {
        updatedRow = updatedRow.data;
      }
      setRow(updatedRow);
      toast.success('Record updated successfully');
      router.push(`${ROUTES.TABLES}/${tableName}/${id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed';
      toast.error(message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    router.push(`${ROUTES.TABLES}/${tableName}/${id}`);
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

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href={ROUTES.TABLES}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Tables
        </Link>
        <span className="text-gray-400 dark:text-gray-500">/</span>
        <Link
          href={`${ROUTES.TABLES}/${tableName}`}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          {config.label}
        </Link>
        <span className="text-gray-400 dark:text-gray-500">/</span>
        <span className="text-gray-900 dark:text-white font-medium">
          {isEditMode ? 'Edit' : 'View'}
        </span>
      </div>

      {/* Header */}
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
            onClick={() =>
              router.push(`${ROUTES.TABLES}/${tableName}/${id}?edit=true`)
            }
            leftIcon={<Pencil className="h-4 w-4" />}
          >
            Edit
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        {isEditMode ? (
          <div className="p-6">
            <DynamicForm
              tableName={tableName}
              columns={config.columns}
              initialData={row}
              onSubmit={handleUpdate}
              onCancel={handleCancel}
              isLoading={isUpdating}
              isEditMode
            />
          </div>
        ) : (
          <dl className="divide-y divide-gray-200 dark:divide-gray-700">
            {config.columns.map((column) => (
              <div key={column.key} className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{column.label}</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:col-span-2 sm:mt-0">
                  {renderValue(column, row[column.key])}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
