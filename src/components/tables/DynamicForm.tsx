'use client';

import { useState, useEffect, FormEvent, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Autocomplete, AutocompleteOption } from '@/components/ui/Autocomplete';
import { fetchWithAuth } from '@/lib/fetch-client';
import type { TableColumn, ColumnOption } from '@/types';

// Additional fields to add for specific tables (only in create mode)
const TABLE_EXTRA_FIELDS: Record<string, TableColumn[]> = {
  users: [
    {
      key: 'password',
      label: 'Password',
      type: 'text',
      required: true,
      editable: false,
      sortable: false,
      filterable: false,
    },
  ],
};

// Static dropdown options for specific table fields
const STATIC_SELECT_OPTIONS: Record<string, Record<string, ColumnOption[]>> = {
  labs: {
    partner_model: [
      { value: 'Revshare', label: 'Revshare' },
      { value: 'Markup', label: 'Markup' },
    ],
  },
};

// Fields that should be treated as required (in addition to column.required from API)
const REQUIRED_FIELDS: Record<string, string[]> = {
  dental_practices: ['dental_group_id', 'dental_group_name'],
};

// Auto-fill configuration - when a field changes, automatically set another field's value
const AUTO_FILL_CONFIG: Record<string, Record<string, {
  targetField: string;
  extractValue: (option: { value: string; label: string }) => string;
}>> = {
  dental_practices: {
    dental_group_id: {
      targetField: 'dental_group_name',
      // Extract name from label format "id : name"
      extractValue: (option) => {
        const parts = option.label.split(' : ');
        return parts.length > 1 ? parts[1] : option.label;
      },
    },
  },
};

// Custom create form fields for specific tables (overrides default columns)
const TABLE_CREATE_FIELDS: Record<string, TableColumn[]> = {
  product_lab_rev_share: [
    {
      key: 'lab_id',
      label: 'Lab Id',
      type: 'number',
      required: true,
      editable: false,
      sortable: false,
      filterable: false,
    },
    {
      key: 'lab_product_id',
      label: 'Lab Product Id',
      type: 'text',
      required: true,
      editable: false,
      sortable: false,
      filterable: false,
    },
  ],
};

// Map of foreign key columns to their API endpoints and response config
const FOREIGN_KEY_CONFIG: Record<string, {
  endpoint: string;
  searchEndpoint?: string;
  searchParam?: string; // Query parameter name for search (default: 'q')
  dataKey: string;
  valueKey: string;
  labelKey: string;
  labelFormat?: (item: Record<string, unknown>) => string;
  forTable: string;
  useTypeahead?: boolean;
}> = {
  lab_id: { endpoint: '/api/labs/ids', dataKey: 'labs', valueKey: 'lab_id', labelKey: 'lab_name', labelFormat: (item) => `${item.lab_id} : ${item.lab_name}`, forTable: 'labs' },
  practice_id: {
    endpoint: '/api/practices/ids',
    searchEndpoint: '/api/practices/search',
    searchParam: 'search',
    dataKey: 'practices',
    valueKey: 'practice_id',
    labelKey: 'dental_group_name',
    labelFormat: (item) => `${item.practice_id} : ${item.dental_group_name}`,
    forTable: 'dental_practices',
    useTypeahead: true,
  },
  incisive_product_id: {
    endpoint: '/api/products/ids',
    searchEndpoint: '/api/products/search',
    searchParam: 'search',
    dataKey: 'products',
    valueKey: 'incisive_id',
    labelKey: 'incisive_name',
    labelFormat: (item) => `${item.incisive_id} : ${item.incisive_name}`,
    forTable: 'products',
    useTypeahead: true,
  },
  dental_group_id: {
    endpoint: '/api/dental-groups/ids',
    searchEndpoint: '/api/dental-groups/ids',
    searchParam: 'search',
    dataKey: 'dentalGroups',
    valueKey: 'dental_group_id',
    labelKey: 'name',
    labelFormat: (item) => `${item.dental_group_id} : ${item.name}`,
    forTable: 'dental_groups',
    useTypeahead: true,
  },
  fee_schedule: {
    endpoint: '/api/tables/fee_schedules/rows',
    searchEndpoint: '/api/tables/fee_schedules/rows',
    searchParam: 'search',
    dataKey: 'data',
    valueKey: 'schedule_name',
    labelKey: 'schedule_name',
    forTable: 'fee_schedules',
    useTypeahead: true,
  },
};

// Dependent field configuration - fields that depend on other fields
const DEPENDENT_FIELD_CONFIG: Record<string, Record<string, {
  dependsOn: string;
  endpoint: (dependsOnValue: string | number) => string;
  searchEndpoint: (dependsOnValue: string | number, search: string) => string;
  valueKey: string;
  labelKey: string;
  labelFormat?: (item: Record<string, unknown>) => string;
}>> = {
  product_lab_markup: {
    lab_product_id: {
      dependsOn: 'lab_id',
      endpoint: (labId) => `/api/tables/lab_product_mapping/rows?filters=${encodeURIComponent(JSON.stringify({ lab_id: String(labId) }))}`,
      searchEndpoint: (labId, search) => `/api/tables/lab_product_mapping/rows?filters=${encodeURIComponent(JSON.stringify({ lab_id: String(labId) }))}&search=${encodeURIComponent(search)}`,
      valueKey: 'lab_product_id',
      labelKey: 'lab_product_name',
      labelFormat: (item) => `${item.lab_product_id} : ${item.lab_product_name}`,
    },
  },
  product_lab_rev_share: {
    lab_product_id: {
      dependsOn: 'lab_id',
      endpoint: (labId) => `/api/tables/lab_product_mapping/rows?filters=${encodeURIComponent(JSON.stringify({ lab_id: String(labId) }))}`,
      searchEndpoint: (labId, search) => `/api/tables/lab_product_mapping/rows?filters=${encodeURIComponent(JSON.stringify({ lab_id: String(labId) }))}&search=${encodeURIComponent(search)}`,
      valueKey: 'lab_product_id',
      labelKey: 'lab_product_name',
      labelFormat: (item) => `${item.lab_product_id} : ${item.lab_product_name}`,
    },
  },
};

// Composite key tables - these fields should be shown as read-only in edit mode
const COMPOSITE_KEY_TABLES: Record<string, string[]> = {
  product_lab_rev_share: ['lab_id', 'lab_product_id'],
  product_lab_markup: ['lab_id', 'lab_product_id'],
};

// Primary key fields for each table - these should be read-only in edit mode
const PRIMARY_KEY_FIELDS: Record<string, string[]> = {
  labs: ['lab_id'],
  dental_practices: ['practice_id'],
  dental_groups: ['dental_group_id'],
  lab_practice_mapping: ['lab_practice_mapping_id'],
  lab_product_mapping: ['lab_product_mapping_id'],
  products: ['incisive_product_id'],
  fee_schedules: ['schedule_name'],
  product_lab_rev_share: ['lab_id', 'lab_product_id'],
  product_lab_markup: ['lab_id', 'lab_product_id'],
};

interface DynamicFormProps {
  tableName?: string;
  columns: TableColumn[];
  initialData?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isLoading?: boolean;
  isEditMode?: boolean;
}

export function DynamicForm({
  tableName,
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
  const [autocompleteDisplayValues, setAutocompleteDisplayValues] = useState<Record<string, string>>({});

  // Memoize initialData to prevent unnecessary re-renders
  const stableInitialData = useMemo(() => initialData, [JSON.stringify(initialData)]);

  // Helper to check if a column is the table's own primary key (should NOT be dropdown)
  const isOwnPrimaryKey = useCallback((columnKey: string): boolean => {
    const fkConfig = FOREIGN_KEY_CONFIG[columnKey];
    return fkConfig ? fkConfig.forTable === tableName : false;
  }, [tableName]);

  // Helper to check if a column should be treated as a foreign key dropdown
  const isForeignKeyDropdown = useCallback((columnKey: string): boolean => {
    const fkConfig = FOREIGN_KEY_CONFIG[columnKey];
    // Don't treat as foreign key dropdown if it's a dependent field
    if (tableName && DEPENDENT_FIELD_CONFIG[tableName]?.[columnKey]) {
      return false;
    }
    return fkConfig ? fkConfig.forTable !== tableName : false;
  }, [tableName]);

  // Helper to check if a column should use typeahead autocomplete
  const isTypeaheadField = useCallback((columnKey: string): boolean => {
    const fkConfig = FOREIGN_KEY_CONFIG[columnKey];
    return fkConfig?.useTypeahead === true && fkConfig.forTable !== tableName;
  }, [tableName]);

  // Helper to check if a column is a dependent field
  const isDependentField = useCallback((columnKey: string): boolean => {
    if (!tableName) return false;
    const tableConfig = DEPENDENT_FIELD_CONFIG[tableName];
    return tableConfig ? columnKey in tableConfig : false;
  }, [tableName]);

  // Get dependent field config
  const getDependentConfig = useCallback((columnKey: string) => {
    if (!tableName) return null;
    return DEPENDENT_FIELD_CONFIG[tableName]?.[columnKey] || null;
  }, [tableName]);

  // Search function for typeahead fields
  const handleTypeaheadSearch = useCallback(
    async (columnKey: string, query: string): Promise<AutocompleteOption[]> => {
      const fkConfig = FOREIGN_KEY_CONFIG[columnKey];
      if (!fkConfig) return [];

      const searchEndpoint = fkConfig.searchEndpoint || fkConfig.endpoint;
      const searchParam = fkConfig.searchParam || 'q';
      const url = `${searchEndpoint}?${searchParam}=${encodeURIComponent(query)}`;

      try {
        const response = await fetchWithAuth(url);
        if (!response.ok) return [];

        const json = await response.json();

        let data: Record<string, unknown>[] = [];
        if (Array.isArray(json)) {
          data = json;
        } else if (json.success && Array.isArray(json.data)) {
          data = json.data;
        } else if (json.success && json.data?.data && Array.isArray(json.data.data)) {
          // Handle nested response: { success: true, data: { data: [...], meta: {...} } }
          data = json.data.data;
        } else if (json[fkConfig.dataKey]) {
          const extracted = json[fkConfig.dataKey];
          if (Array.isArray(extracted)) {
            data = extracted;
          } else if (extracted?.data && Array.isArray(extracted.data)) {
            data = extracted.data;
          }
        } else if (json.data && json.data[fkConfig.dataKey]) {
          // Handle nested response: { success: true, data: { dentalGroups: [...] } }
          data = json.data[fkConfig.dataKey];
        } else if (json.data && typeof json.data === 'object') {
          const arrays = Object.values(json.data).filter(Array.isArray);
          if (arrays.length > 0) {
            data = arrays[0] as Record<string, unknown>[];
          }
        }

        return data.map((item) => {
          const label = fkConfig.labelFormat
            ? fkConfig.labelFormat(item)
            : String(item[fkConfig.labelKey] ?? '');

          return {
            value: String(item[fkConfig.valueKey] ?? ''),
            label,
          };
        });
      } catch (error) {
        console.error(`Error searching ${columnKey}:`, error);
        return [];
      }
    },
    []
  );

  // Search function for dependent fields
  const handleDependentFieldSearch = useCallback(
    async (columnKey: string, query: string): Promise<AutocompleteOption[]> => {
      const config = getDependentConfig(columnKey);
      if (!config) return [];

      const parentValue = formData[config.dependsOn];
      if (!parentValue) return [];

      const url = query
        ? config.searchEndpoint(parentValue as string | number, query)
        : config.endpoint(parentValue as string | number);

      try {
        const response = await fetchWithAuth(url);
        if (!response.ok) return [];

        const json = await response.json();

        let data: Record<string, unknown>[] = [];
        if (json.success && json.data?.data) {
          data = json.data.data;
        } else if (Array.isArray(json.data)) {
          data = json.data;
        } else if (Array.isArray(json)) {
          data = json;
        }

        return data.map((item) => {
          const label = config.labelFormat
            ? config.labelFormat(item)
            : String(item[config.labelKey] ?? '');

          return {
            value: String(item[config.valueKey] ?? ''),
            label,
          };
        });
      } catch (error) {
        console.error(`Error searching ${columnKey}:`, error);
        return [];
      }
    },
    [formData, getDependentConfig]
  );

  // Set initial data only when it changes (for edit mode)
  useEffect(() => {
    if (Object.keys(stableInitialData).length > 0) {
      setFormData(stableInitialData);
    }
  }, [stableInitialData]);

  // Fetch display values for typeahead fields in edit mode
  useEffect(() => {
    const fetchTypeaheadDisplayValues = async () => {
      // Check all keys in initial data that have typeahead config
      for (const [columnKey, value] of Object.entries(stableInitialData)) {
        if (!value) continue;

        const fkConfig = FOREIGN_KEY_CONFIG[columnKey];
        // Skip if not a typeahead field or if it's the table's own primary key
        if (!fkConfig?.useTypeahead || fkConfig.forTable === tableName) continue;

        // Use search endpoint with the value to find matching record
        const searchParam = fkConfig.searchParam || 'q';
        const searchEndpoint = fkConfig.searchEndpoint || fkConfig.endpoint;
        const url = `${searchEndpoint}?${searchParam}=${encodeURIComponent(String(value))}`;

        try {
          const response = await fetchWithAuth(url);
          if (!response.ok) continue;

          const json = await response.json();

          let data: Record<string, unknown>[] = [];
          if (Array.isArray(json)) {
            data = json;
          } else if (json.success && Array.isArray(json.data)) {
            data = json.data;
          } else if (json[fkConfig.dataKey]) {
            data = json[fkConfig.dataKey];
          } else if (json.data && json.data[fkConfig.dataKey]) {
            data = json.data[fkConfig.dataKey];
          } else if (json.data && typeof json.data === 'object') {
            const arrays = Object.values(json.data).filter(Array.isArray);
            if (arrays.length > 0) {
              data = arrays[0] as Record<string, unknown>[];
            }
          }

          // Find the matching option by value
          const matchingItem = data.find(
            (item) => String(item[fkConfig.valueKey]) === String(value)
          );

          if (matchingItem) {
            const label = fkConfig.labelFormat
              ? fkConfig.labelFormat(matchingItem)
              : String(matchingItem[fkConfig.labelKey] ?? '');

            setAutocompleteDisplayValues((prev) => ({
              ...prev,
              [columnKey]: label,
            }));
          }
        } catch (error) {
          console.error(`Error fetching display value for ${columnKey}:`, error);
        }
      }
    };

    if (Object.keys(stableInitialData).length > 0) {
      fetchTypeaheadDisplayValues();
    }
  }, [stableInitialData, tableName]);

  // Fetch display values for dependent fields in edit mode
  useEffect(() => {
    const fetchDependentDisplayValues = async () => {
      if (!tableName) return;
      const tableConfig = DEPENDENT_FIELD_CONFIG[tableName];
      if (!tableConfig) return;

      for (const [columnKey, config] of Object.entries(tableConfig)) {
        const value = stableInitialData[columnKey];
        if (!value) continue;

        const parentValue = stableInitialData[config.dependsOn];
        if (!parentValue) continue;

        // Fetch options using the parent value from initialData
        const url = config.endpoint(parentValue as string | number);

        try {
          const response = await fetchWithAuth(url);
          if (!response.ok) continue;

          const json = await response.json();

          let data: Record<string, unknown>[] = [];
          if (json.success && json.data?.data) {
            data = json.data.data;
          } else if (Array.isArray(json.data)) {
            data = json.data;
          } else if (Array.isArray(json)) {
            data = json;
          }

          // Find the matching option by value
          const matchingItem = data.find(
            (item) => String(item[config.valueKey]) === String(value)
          );

          if (matchingItem) {
            const label = config.labelFormat
              ? config.labelFormat(matchingItem)
              : String(matchingItem[config.labelKey] ?? '');

            setAutocompleteDisplayValues((prev) => ({
              ...prev,
              [columnKey]: label,
            }));
          }
        } catch (error) {
          console.error(`Error fetching display value for ${columnKey}:`, error);
        }
      }
    };

    if (Object.keys(stableInitialData).length > 0) {
      fetchDependentDisplayValues();
    }
  }, [stableInitialData, tableName]);

  // Fetch dynamic options for select fields (excluding typeahead and dependent fields)
  useEffect(() => {
    const fetchDynamicOptions = async () => {
      const columnsNeedingOptions = columns.filter(
        (col) => (col.optionsEndpoint || isForeignKeyDropdown(col.key)) && !isTypeaheadField(col.key) && !isDependentField(col.key)
      );

      for (const column of columnsNeedingOptions) {
        const fkConfig = FOREIGN_KEY_CONFIG[column.key];
        const endpoint = column.optionsEndpoint || fkConfig?.endpoint;
        if (!endpoint) continue;

        setLoadingOptions((prev) => ({ ...prev, [column.key]: true }));

        try {
          const response = await fetchWithAuth(endpoint);
          if (response.ok) {
            const json = await response.json();

            let data: Record<string, unknown>[] = [];
            if (Array.isArray(json)) {
              data = json;
            } else if (json.success && Array.isArray(json.data)) {
              data = json.data;
            } else if (json.success && json.data?.data && Array.isArray(json.data.data)) {
              // Handle nested response: { success: true, data: { data: [...], meta: {...} } }
              data = json.data.data;
            } else if (fkConfig && json[fkConfig.dataKey]) {
              const extracted = json[fkConfig.dataKey];
              // Check if extracted is an object with nested data array
              if (Array.isArray(extracted)) {
                data = extracted;
              } else if (extracted?.data && Array.isArray(extracted.data)) {
                data = extracted.data;
              }
            } else if (json.data && typeof json.data === 'object') {
              const arrays = Object.values(json.data).filter(Array.isArray);
              if (arrays.length > 0) {
                data = arrays[0] as Record<string, unknown>[];
              }
            }

            const options: ColumnOption[] = data.map((item) => {
              const valueKey = fkConfig?.valueKey || 'id';
              const labelKey = fkConfig?.labelKey || 'name';

              const label = fkConfig?.labelFormat
                ? fkConfig.labelFormat(item)
                : String(item[labelKey] ?? item.label ?? item.name ?? '');

              return {
                value: String(item[valueKey] ?? item.value ?? item.id ?? ''),
                label,
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
  }, [columns, tableName, isTypeaheadField, isForeignKeyDropdown, isDependentField]);

  // Get extra fields for this table (only in create mode)
  const extraFields = !isEditMode && tableName ? TABLE_EXTRA_FIELDS[tableName] || [] : [];

  // Check if this table has custom create form fields
  const customCreateFields = !isEditMode && tableName ? TABLE_CREATE_FIELDS[tableName] : null;

  // Get composite key fields for this table (to show as read-only in edit mode)
  const compositeKeyFields = tableName ? COMPOSITE_KEY_TABLES[tableName] || [] : [];

  // Helper to check if a column is a composite key field
  const isCompositeKeyField = useCallback((columnKey: string): boolean => {
    return compositeKeyFields.includes(columnKey);
  }, [compositeKeyFields]);

  // Get primary key fields for this table
  const primaryKeyFields = tableName ? PRIMARY_KEY_FIELDS[tableName] || [] : [];

  // Helper to check if a column is a primary key field
  const isPrimaryKeyField = useCallback((columnKey: string): boolean => {
    return primaryKeyFields.includes(columnKey);
  }, [primaryKeyFields]);

  // System columns that should never be editable
  const systemColumns = ['id', 'created_at', 'updated_at'];

  const editableColumns = isEditMode
    ? columns.filter((col) => !systemColumns.includes(col.key) && (col.editable !== false || isCompositeKeyField(col.key) || isTypeaheadField(col.key) || isForeignKeyDropdown(col.key)))
    : customCreateFields
      ? customCreateFields
      : [...columns.filter((col) => !systemColumns.includes(col.key)), ...extraFields];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Get custom required fields for this table
    const customRequiredFields = tableName ? REQUIRED_FIELDS[tableName] || [] : [];

    editableColumns.forEach((column) => {
      const value = formData[column.key];

      // Check if field is required (from API config or custom required fields)
      const isRequired = column.required || customRequiredFields.includes(column.key);

      if (isRequired && (value === undefined || value === null || value === '')) {
        newErrors[column.key] = `${column.label} is required`;
        return;
      }

      // For typeahead fields, ensure value was selected from dropdown (has display value)
      if (isTypeaheadField(column.key) && value) {
        const hasValidSelection = autocompleteDisplayValues[column.key];
        if (!hasValidSelection) {
          newErrors[column.key] = `Please select ${column.label} from the dropdown`;
          return;
        }
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

      if (column.key === 'password' && value) {
        const passwordStr = String(value);
        if (passwordStr.length < 6) {
          newErrors[column.key] = 'Password must be at least 6 characters';
        } else if (passwordStr.length > 50) {
          newErrors[column.key] = 'Password must be at most 50 characters';
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

    const transformedData: Record<string, unknown> = {};

    // Include all fields from formData that are in editableColumns
    editableColumns.forEach((column) => {
      const value = formData[column.key];
      const initialValue = stableInitialData[column.key];

      // In edit mode, if field was cleared (had value, now empty), send null
      if (isEditMode && (value === undefined || value === '')) {
        if (initialValue !== undefined && initialValue !== null && initialValue !== '') {
          transformedData[column.key] = null;
        }
        return;
      }

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

    // Also include any other fields from formData that have changed from initialData
    // This ensures fields not in editableColumns but still in the form are included
    Object.entries(formData).forEach(([key, value]) => {
      if (!(key in transformedData) && value !== undefined && value !== '') {
        // Find column type if available
        const column = columns.find((col) => col.key === key);
        if (column?.type === 'number') {
          transformedData[key] = Number(value);
        } else if (column?.type === 'boolean') {
          transformedData[key] = value === 'true' || value === true;
        } else {
          transformedData[key] = value;
        }
      }
    });

    onSubmit(transformedData);
  };

  const handleChange = (key: string, value: unknown) => {
    setFormData((prev) => {
      const newData = { ...prev, [key]: value };

      // Clear dependent fields when parent field changes
      if (tableName && DEPENDENT_FIELD_CONFIG[tableName]) {
        Object.entries(DEPENDENT_FIELD_CONFIG[tableName]).forEach(([depKey, config]) => {
          if (config.dependsOn === key) {
            newData[depKey] = '';
            setAutocompleteDisplayValues((prevDisplay) => {
              const newDisplay = { ...prevDisplay };
              delete newDisplay[depKey];
              return newDisplay;
            });
          }
        });
      }

      return newData;
    });

    if (errors[key]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  const getSelectOptions = (column: TableColumn): ColumnOption[] => {
    // Check for static options first
    if (tableName && STATIC_SELECT_OPTIONS[tableName]?.[column.key]) {
      return STATIC_SELECT_OPTIONS[tableName][column.key];
    }
    if (dynamicOptions[column.key]) {
      return dynamicOptions[column.key];
    }
    return column.options || [];
  };

  // Helper to check if a column has static select options
  const hasStaticSelectOptions = (columnKey: string): boolean => {
    return !!(tableName && STATIC_SELECT_OPTIONS[tableName]?.[columnKey]);
  };

  const renderField = (column: TableColumn) => {
    const value = formData[column.key];

    // Render password field
    if (column.key === 'password') {
      return (
        <Input
          key={column.key}
          type="password"
          label={column.label}
          value={String(value || '')}
          onChange={(e) => handleChange(column.key, e.target.value)}
          error={errors[column.key]}
          required={column.required}
          placeholder="Enter password (min 6 characters)"
          autoComplete="new-password"
        />
      );
    }

    // In edit mode, primary key fields should be read-only
    if (isEditMode && isPrimaryKeyField(column.key)) {
      // For typeahead fields, show the display value
      const displayVal = autocompleteDisplayValues[column.key] || String(value || '');
      return (
        <Input
          key={column.key}
          type="text"
          label={column.label}
          value={displayVal}
          onChange={() => {}}
          disabled
          placeholder={column.label}
        />
      );
    }

    // If this is the table's own primary key, render as number input
    if (isOwnPrimaryKey(column.key)) {
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
    }

    // Check if this is a dependent field (searchable dropdown that depends on another field)
    if (isDependentField(column.key)) {
      // In edit mode, composite key fields should be shown as read-only
      if (isEditMode && isCompositeKeyField(column.key)) {
        const displayValue = autocompleteDisplayValues[column.key] || String(value || '');
        return (
          <Input
            key={column.key}
            type="text"
            label={column.label}
            value={displayValue}
            onChange={() => {}}
            disabled
            placeholder={column.label}
          />
        );
      }

      const config = getDependentConfig(column.key);
      const parentValue = formData[config?.dependsOn || ''];
      const isDisabled = !parentValue;

      // Use displayValue if available, otherwise fall back to showing the raw value
      const displayVal = autocompleteDisplayValues[column.key] || (value ? String(value) : '');
      return (
        <Autocomplete
          key={column.key}
          label={column.label}
          value={String(value || '')}
          displayValue={displayVal}
          onSearch={(query) => handleDependentFieldSearch(column.key, query)}
          onChange={(newValue, option) => {
            handleChange(column.key, newValue);
            if (option) {
              setAutocompleteDisplayValues((prev) => ({
                ...prev,
                [column.key]: option.label,
              }));
            }
          }}
          error={errors[column.key]}
          required={column.required}
          placeholder={isDisabled ? `Select ${config?.dependsOn} first` : `Search ${column.label}...`}
          debounceMs={300}
          minChars={0}
          disabled={isDisabled}
          restrictToOptions
        />
      );
    }

    // Check if this column should use typeahead autocomplete
    if (isTypeaheadField(column.key)) {
      // Use displayValue if available, otherwise fall back to showing the raw value
      const displayVal = autocompleteDisplayValues[column.key] || (value ? String(value) : '');
      return (
        <Autocomplete
          key={column.key}
          label={column.label}
          value={String(value || '')}
          displayValue={displayVal}
          onSearch={(query) => handleTypeaheadSearch(column.key, query)}
          onChange={(newValue, option) => {
            handleChange(column.key, newValue);
            if (option) {
              setAutocompleteDisplayValues((prev) => ({
                ...prev,
                [column.key]: option.label,
              }));

              // Auto-fill related fields if configured
              const autoFillConfig = tableName && AUTO_FILL_CONFIG[tableName]?.[column.key];
              if (autoFillConfig) {
                const autoFillValue = autoFillConfig.extractValue(option);
                handleChange(autoFillConfig.targetField, autoFillValue);
              }
            }
          }}
          error={errors[column.key]}
          required={column.required}
          placeholder={`Search ${column.label}...`}
          debounceMs={300}
          minChars={0}
          restrictToOptions
        />
      );
    }

    // Check if this column should render as a select
    const shouldRenderAsSelect = column.type === 'select' || isForeignKeyDropdown(column.key);

    if (shouldRenderAsSelect) {
      // In edit mode, composite key fields should be shown as read-only
      if (isEditMode && isCompositeKeyField(column.key)) {
        const options = getSelectOptions(column);
        const selectedOption = options.find((opt) => String(opt.value) === String(value));
        const displayValue = selectedOption?.label || String(value || '');
        return (
          <Input
            key={column.key}
            type="text"
            label={column.label}
            value={displayValue}
            onChange={() => {}}
            disabled
            placeholder={column.label}
          />
        );
      }

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

    // Check for static select options
    if (hasStaticSelectOptions(column.key)) {
      const options = getSelectOptions(column);
      return (
        <Select
          key={column.key}
          label={column.label}
          options={options}
          value={String(value || '')}
          onChange={(e) => handleChange(column.key, e.target.value)}
          error={errors[column.key]}
          required={column.required}
          placeholder={`Select ${column.label}`}
        />
      );
    }

    switch (column.type) {
      case 'boolean':
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