'use client';

import { useState, useEffect, FormEvent, useMemo } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import type { TableColumn, ColumnOption } from '@/types';

// Map of foreign key columns to their API endpoints and response config (defined outside component)
const FOREIGN_KEY_CONFIG: Record<string, { endpoint: string; dataKey: string; valueKey: string; labelKey: string }> = {
  lab_id: { endpoint: '/api/labs/ids', dataKey: 'labs', valueKey: 'lab_id', labelKey: 'lab_id' },
  practice_id: { endpoint: '/api/practices/ids', dataKey: 'practices', valueKey: 'practice_id', labelKey: 'practice_id' },
  incisive_product_id: { endpoint: '/api/products/ids', dataKey: 'products', valueKey: 'incisive_id', labelKey: 'incisive_name' },
};

interface DynamicFormProps {
  columns: TableColumn[];
  initialData?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading?: boolean;
  isEditMode?: boolean;
}

export function DynamicForm({
  columns = [],
  initialData = {},
  onSubmit,
  onCancel,
  isLoading = false,
  isEditMode = false,
}: DynamicFormProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, ColumnOption[]>>({});
  const [loadingOptions, setLoadingOptions] = useState<Record<string, boolean>>({});

  // Memoize initialData to prevent unnecessary re-renders
  const stableInitialData = useMemo(() => initialData, [JSON.stringify(initialData)]);

  // Set initial data only when it changes (for edit mode)
  useEffect(() => {
    if (Object.keys(stableInitialData).length > 0) {
      setFormData(stableInitialData);
    }
  }, [stableInitialData]);

  // Fetch dynamic options for select fields
  useEffect(() => {
    const fetchDynamicOptions = async () => {
      // Get columns that need dynamic options (explicit optionsEndpoint or known foreign keys)
      const columnsNeedingOptions = columns.filter(
        (col) => col.optionsEndpoint || FOREIGN_KEY_CONFIG[col.key]
      );

      for (const column of columnsNeedingOptions) {
        const fkConfig = FOREIGN_KEY_CONFIG[column.key];
        const endpoint = column.optionsEndpoint || fkConfig?.endpoint;
        if (!endpoint) continue;

        setLoadingOptions((prev) => ({ ...prev, [column.key]: true }));

        try {
          const response = await fetch(endpoint);
          if (response.ok) {
            const json = await response.json();

            // Extract data array from response
            let data: Record<string, unknown>[] = [];
            if (Array.isArray(json)) {
              data = json;
            } else if (json.success && Array.isArray(json.data)) {
              data = json.data;
            } else if (fkConfig && json[fkConfig.dataKey]) {
              // Handle { labs: [...] } or { practices: [...] } format
              data = json[fkConfig.dataKey];
            } else if (json.data && typeof json.data === 'object') {
              const arrays = Object.values(json.data).filter(Array.isArray);
              if (arrays.length > 0) {
                data = arrays[0] as Record<string, unknown>[];
              }
            }

            // Transform to { value, label } format
            const options: ColumnOption[] = data.map((item) => {
              const valueKey = fkConfig?.valueKey || 'id';
              const labelKey = fkConfig?.labelKey || 'name';

              return {
                value: String(item[valueKey] ?? item.value ?? item.id ?? ''),
                label: String(item[labelKey] ?? item.label ?? item.name ?? ''),
              };
            });

            setDynamicOptions((prev) => ({ ...prev, [column.key]: options }));
          }
        } catch (error) {
          console.error(`Error fetching options for ${column.key}:`, error);
        } finally {
          setLoadingOptions((prev) => ({ ...prev, [column.key]: false }));
        }
      }
    };

    if (columns.length > 0) {
      fetchDynamicOptions();
    }
  }, [columns]);

  const editableColumns = isEditMode
    ? columns.filter((col) => col.editable)
    : columns.filter((col) => col.key !== 'id' && col.key !== 'created_at' && col.key !== 'updated_at');

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    editableColumns.forEach((column) => {
      const value = formData[column.key];

      if (column.required && (value === undefined || value === null || value === '')) {
        newErrors[column.key] = `${column.label} is required`;
        return;
      }

      if (column.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(value))) {
          newErrors[column.key] = 'Please enter a valid email address';
        }
      }

      if (column.type === 'number' && value !== undefined && value !== '') {
        if (isNaN(Number(value))) {
          newErrors[column.key] = 'Please enter a valid number';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Transform data types
    const transformedData: Record<string, unknown> = {};
    editableColumns.forEach((column) => {
      const value = formData[column.key];

      if (value === undefined || value === '') {
        return;
      }

      switch (column.type) {
        case 'number':
          transformedData[column.key] = Number(value);
          break;
        case 'boolean':
          transformedData[column.key] = value === 'true' || value === true;
          break;
        default:
          transformedData[column.key] = value;
      }
    });

    onSubmit(transformedData);
  };

  const handleChange = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    // Clear error when user starts typing
    if (errors[key]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  const getSelectOptions = (column: TableColumn): ColumnOption[] => {
    // Use dynamic options if available, otherwise fall back to static options
    if (dynamicOptions[column.key]) {
      return dynamicOptions[column.key];
    }
    return column.options || [];
  };

  const renderField = (column: TableColumn) => {
    const value = formData[column.key];

    // Check if this column should render as a select (explicit select type or foreign key)
    const isForeignKey = !!FOREIGN_KEY_CONFIG[column.key];
    const shouldRenderAsSelect = column.type === 'select' || isForeignKey;

    if (shouldRenderAsSelect) {
      const options = getSelectOptions(column);
      const isLoadingSelect = loadingOptions[column.key] || false;
      return (
        <Select
          key={column.key}
          label={column.label}
          options={options}
          value={String(value || '')}
          onChange={(e) => handleChange(column.key, e.target.value)}
          error={errors[column.key]}
          required={column.required}
          placeholder={isLoadingSelect ? 'Loading...' : options.length === 0 ? 'No options available' : `Select ${column.label}`}
          disabled={isLoadingSelect}
        />
      );
    }

    switch (column.type) {

      case 'boolean':
        // Handle both boolean and string values
        const boolValue = value === true || value === 'true' ? 'true' : value === false || value === 'false' ? 'false' : '';
        return (
          <Select
            key={column.key}
            label={column.label}
            options={[
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No' },
            ]}
            value={boolValue}
            onChange={(e) => handleChange(column.key, e.target.value)}
            error={errors[column.key]}
            required={column.required}
            placeholder={`Select ${column.label}`}
          />
        );

      case 'date':
        return (
          <Input
            key={column.key}
            type="date"
            label={column.label}
            value={value ? String(value).split('T')[0] : ''}
            onChange={(e) => handleChange(column.key, e.target.value)}
            error={errors[column.key]}
            required={column.required}
          />
        );

      case 'number':
        return (
          <Input
            key={column.key}
            type="number"
            label={column.label}
            value={value !== undefined ? String(value) : ''}
            onChange={(e) => handleChange(column.key, e.target.value)}
            error={errors[column.key]}
            required={column.required}
            placeholder={`Enter ${column.label}`}
          />
        );

      case 'email':
        return (
          <Input
            key={column.key}
            type="email"
            label={column.label}
            value={String(value || '')}
            onChange={(e) => handleChange(column.key, e.target.value)}
            error={errors[column.key]}
            required={column.required}
            placeholder={`Enter ${column.label}`}
          />
        );

      default:
        return (
          <Input
            key={column.key}
            type="text"
            label={column.label}
            value={String(value || '')}
            onChange={(e) => handleChange(column.key, e.target.value)}
            error={errors[column.key]}
            required={column.required}
            placeholder={`Enter ${column.label}`}
          />
        );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {editableColumns.map((column) => (
          <div key={column.key}>{renderField(column)}</div>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isLoading}>
          {isEditMode ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
}
