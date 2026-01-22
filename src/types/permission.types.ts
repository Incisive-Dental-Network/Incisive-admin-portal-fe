export interface TablePermissions {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  actions: string[];
}

export interface UserPermissions {
  tables: {
    [tableName: string]: TablePermissions;
  };
}

export type PermissionAction = 'read' | 'create' | 'update' | 'delete';

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}
