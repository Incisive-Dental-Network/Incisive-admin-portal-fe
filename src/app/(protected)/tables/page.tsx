'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { SearchInput } from '@/components/ui/SearchInput';
import { ROUTES } from '@/config/ui.constants';
import { fetchWithAuth } from '@/lib/fetch-client';
import {
  Table,
  Users,
  Package,
  ShoppingCart,
  Folder,
  Settings,
  Database,
  ArrowRight,
} from 'lucide-react';
import type { TableInfo } from '@/types';

const iconMap: Record<string, React.ReactNode> = {
  users: <Users className="h-6 w-6" />,
  products: <Package className="h-6 w-6" />,
  orders: <ShoppingCart className="h-6 w-6" />,
  categories: <Folder className="h-6 w-6" />,
  settings: <Settings className="h-6 w-6" />,
  default: <Database className="h-6 w-6" />,
};

export default function TablesListPage() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [filteredTables, setFilteredTables] = useState<TableInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const response = await fetchWithAuth('/api/tables');
        if (response.ok) {
          let data = await response.json();
          // Handle wrapped response
          if (data.success && data.data?.tables) {
            setTables(data.data.tables);
            setFilteredTables(data.data.tables);
          } else if (data.tables) {
            setTables(data.tables);
            setFilteredTables(data.tables);
          }
        }
      } catch (error) {
        console.error('Error fetching tables:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTables();
  }, []);

  useEffect(() => {
    if (search) {
      const filtered = tables.filter(
        (table) =>
          table.name.toLowerCase().includes(search.toLowerCase()) ||
          table.label.toLowerCase().includes(search.toLowerCase()) ||
          table.description?.toLowerCase().includes(search.toLowerCase())
      );
      setFilteredTables(filtered);
    } else {
      setFilteredTables(tables);
    }
  }, [search, tables]);

  const handleSearch = (value: string) => {
    setSearch(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Database Tables</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          View and manage all available database tables
        </p>
      </div>

      {/* Search */}
      <div className="max-w-md">
        <SearchInput
          onSearch={handleSearch}
          placeholder="Search tables..."
        />
      </div>

      {/* Tables Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredTables.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTables.map((table) => (
            <TableCard key={table.name} table={table} />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Table className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            No tables found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {search
              ? 'Try adjusting your search terms'
              : 'No tables are available'}
          </p>
        </div>
      )}
    </div>
  );
}

interface TableCardProps {
  table: TableInfo;
}

function TableCard({ table }: TableCardProps) {
  const icon = iconMap[table.icon] || iconMap.default;

  return (
    <Link
      href={`${ROUTES.TABLES}/${table.name}`}
      className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-4">
        <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300">{icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{table.label}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
            {table.description}
          </p>
          <div className="flex items-center gap-4 mt-3">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {table.row_count} records
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{table.name}</span>
          </div>
        </div>
        <ArrowRight className="h-5 w-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
      </div>
    </Link>
  );
}
