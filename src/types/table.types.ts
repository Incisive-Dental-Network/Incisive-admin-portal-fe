import { TablePermissions } from './permission.types';

export interface TableInfo {
  name: string;
  label: string;
  description: string;
  icon: string;
  rowCount: number;
}

export interface TablesListResponse {
  tables: TableInfo[];
}

export type ColumnType = 'text' | 'email' | 'date' | 'boolean' | 'select' | 'number';

export interface ColumnOption {
  value: string;
  label: string;
}

export interface TableColumn {
  key: string;
  label: string;
  type: ColumnType;
  sortable: boolean;
  filterable: boolean;
  editable: boolean;
  required: boolean;
  options?: ColumnOption[];
  optionsEndpoint?: string;
}

export interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

export interface TableConfig {
  name: string;
  label: string;
  columns: TableColumn[];
  permissions: TablePermissions;
  default_sort: SortConfig;
}

export interface TableRowsResponse {
  data: Record<string, unknown>[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
  filters_applied: Record<string, string>;
  sort: SortConfig;
}

export interface TableFilters {
  [key: string]: string | number | boolean | undefined;
}

export interface TableQueryParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_direction?: 'asc' | 'desc';
  search?: string;
  filters?: TableFilters;
}
