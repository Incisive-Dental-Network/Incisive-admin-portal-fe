'use client';

import { useState, useCallback, useEffect } from 'react';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { X, Filter } from 'lucide-react';
import type { TableColumn, TableFilters as TableFiltersType } from '@/types';

interface TableFiltersProps {
  columns: TableColumn[];
  filters: TableFiltersType;
  onFilterChange: (filters: TableFiltersType) => void;
  onSearch: (search: string) => void;
  searchValue?: string;
}

export function TableFilters({
  columns,
  filters,
  onFilterChange,
  onSearch,
  searchValue = '',
}: TableFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [localFilters, setLocalFilters] = useState<TableFiltersType>(filters);

  const filterableColumns = columns.filter((col) => col.filterable);
  const hasActiveFilters = Object.keys(filters).length > 0;

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleFilterChange = useCallback(
    (key: string, value: string) => {
      const newFilters = { ...localFilters };
      if (value) {
        newFilters[key] = value;
      } else {
        delete newFilters[key];
      }
      setLocalFilters(newFilters);
    },
    [localFilters]
  );

  const applyFilters = () => {
    onFilterChange(localFilters);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setLocalFilters({});
    onFilterChange({});
  };

  const removeFilter = (key: string) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter Toggle */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <SearchInput
            onSearch={onSearch}
            placeholder="Search..."
            defaultValue={searchValue}
          />
        </div>

        {filterableColumns.length > 0 && (
          <Button
            variant={hasActiveFilters ? 'primary' : 'outline'}
            onClick={() => setShowFilters(!showFilters)}
            leftIcon={<Filter className="h-4 w-4" />}
          >
            Filters
            {hasActiveFilters && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-white/20 rounded">
                {Object.keys(filters).length}
              </span>
            )}
          </Button>
        )}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(filters).map(([key, value]) => {
            const column = columns.find((col) => col.key === key);
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-sm"
              >
                <span className="text-gray-600 dark:text-gray-400">{column?.label || key}:</span>
                <span className="font-medium dark:text-white">{String(value)}</span>
                <button
                  onClick={() => removeFilter(key)}
                  className="ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          <button
            onClick={clearFilters}
            className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Filter Panel */}
      {showFilters && filterableColumns.length > 0 && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterableColumns.map((column) => (
              <div key={column.key}>
                {column.type === 'select' && column.options ? (
                  <Select
                    label={column.label}
                    options={column.options}
                    value={String(localFilters[column.key] || '')}
                    onChange={(e) =>
                      handleFilterChange(column.key, e.target.value)
                    }
                    placeholder={`Select ${column.label}`}
                  />
                ) : column.type === 'boolean' ? (
                  <Select
                    label={column.label}
                    options={[
                      { value: 'true', label: 'Yes' },
                      { value: 'false', label: 'No' },
                    ]}
                    value={String(localFilters[column.key] || '')}
                    onChange={(e) =>
                      handleFilterChange(column.key, e.target.value)
                    }
                    placeholder={`Select ${column.label}`}
                  />
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {column.label}
                    </label>
                    <input
                      type={column.type === 'number' ? 'number' : 'text'}
                      value={String(localFilters[column.key] || '')}
                      onChange={(e) =>
                        handleFilterChange(column.key, e.target.value)
                      }
                      className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder={`Filter by ${column.label}`}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={clearFilters}>
              Clear
            </Button>
            <Button onClick={applyFilters}>Apply Filters</Button>
          </div>
        </div>
      )}
    </div>
  );
}
