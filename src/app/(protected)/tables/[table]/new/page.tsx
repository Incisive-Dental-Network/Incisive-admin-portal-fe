'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { DynamicForm } from '@/components/tables/DynamicForm';
import { SkeletonForm } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import { ROUTES } from '@/config/ui.constants';
import { canCreate } from '@/lib/permissions';
import { fetchWithAuth } from '@/lib/fetch-client';
import { ChevronLeft } from 'lucide-react';
import type { TableConfig } from '@/types';

// Columns to exclude for specific tables (not provided by backend)
  const EXCLUDED_COLUMNS: Record<string, string[]> = {
    product_lab_markup: ['incisive_product_id'],
  };

export default function NewRowPage() {
  const params = useParams();
  const tableName = params.table as string;
  const router = useRouter();

  const [config, setConfig] = useState<TableConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      setIsLoading(true);
      try {
        const response = await fetchWithAuth(`/api/tables/${tableName}`);
        if (response.ok) {
          let data = await response.json();
          // Handle wrapped response
          if (data.success && data.data) {
            data = data.data;
          }
          setConfig(data);

          // Check if user has create permission
          if (!canCreate(data.permissions)) {
            toast.error('You do not have permission to create records');
            router.push(`${ROUTES.TABLES}/${tableName}`);
          }
        }
      } catch (error) {
        console.error('Error fetching config:', error);
        toast.error('Failed to load form');
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, [tableName, router]);

  const handleCreate = async (data: Record<string, unknown>) => {
    setIsCreating(true);
    try {
      const response = await fetchWithAuth(`/api/tables/${tableName}/rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create record');
      }

      let newRow = await response.json();
      // Handle wrapped response
      if (newRow.success && newRow.data) {
        newRow = newRow.data;
      }
      toast.success('Record created successfully');
      // Redirect to detail page if ID exists, otherwise to table list
      if (newRow.id) {
        router.push(`${ROUTES.TABLES}/${tableName}/${newRow.id}`);
      } else {
        router.push(`${ROUTES.TABLES}/${tableName}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create record';
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    router.push(`${ROUTES.TABLES}/${tableName}`);
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

  if (!config) {
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
          <p className="text-gray-500 dark:text-gray-400">Table configuration not found</p>
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
        <span className="text-gray-900 dark:text-white font-medium">New</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Record</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Add a new record to {config.label}
        </p>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <DynamicForm
          tableName={tableName}
          columns={config.columns.filter((col) => !EXCLUDED_COLUMNS[tableName]?.includes(col.key))}
          onSubmit={handleCreate}
          onCancel={handleCancel}
          isLoading={isCreating}
        />
      </div>
    </div>
  );
}
