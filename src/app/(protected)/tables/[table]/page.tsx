'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DataTable } from '@/components/tables/DataTable';
import { ROUTES } from '@/config/ui.constants';
import { ChevronLeft } from 'lucide-react';
import type { TableConfig } from '@/types';

interface TablePageProps {
  params: { table: string };
}

export default function TablePage({ params }: TablePageProps) {
  const tableName = params.table;
  const [config, setConfig] = useState<TableConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      setIsLoadingConfig(true);
      try {
        const response = await fetch(`/api/tables/${tableName}`);
        if (response.ok) {
          let data = await response.json();
          // Handle wrapped response: { success: true, data: {...} }
          if (data.success && data.data) {
            data = data.data;
          }

          // Map API response to TableConfig format
          const tableConfig: TableConfig = {
            name: data.name,
            label: data.label,
            columns: data.columns || [],
            permissions: data.permissions || {
              read: true,
              create: false,
              update: false,
              delete: false,
              actions: [],
            },
            default_sort: data.defaultSort ? {
              column: data.defaultSort.column,
              direction: data.defaultSort.direction,
            } : { column: 'created_at', direction: 'desc' },
          };

          setConfig(tableConfig);
        }
      } catch (error) {
        console.error('Error fetching table config:', error);
      } finally {
        setIsLoadingConfig(false);
      }
    };

    fetchConfig();
  }, [tableName]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href={ROUTES.TABLES}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Tables
        </Link>
        <span className="text-gray-400 dark:text-gray-500">/</span>
        <span className="text-gray-900 dark:text-white font-medium">
          {config?.label || tableName}
        </span>
      </div>

      {/* Data Table */}
      <DataTable
        tableName={tableName}
        config={config}
        isLoadingConfig={isLoadingConfig}
      />
    </div>
  );
}
