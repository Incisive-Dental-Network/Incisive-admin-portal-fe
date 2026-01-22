import type { TablePermissions, UserPermissions } from '@/types';

/**
 * UI permission helpers
 * IMPORTANT: These are for UI rendering only - backend enforces actual permissions
 */

export function canView(permissions: TablePermissions | null | undefined): boolean {
  return permissions?.read ?? false;
}

export function canCreate(permissions: TablePermissions | null | undefined): boolean {
  return permissions?.create ?? false;
}

export function canEdit(permissions: TablePermissions | null | undefined): boolean {
  return permissions?.update ?? false;
}

export function canDelete(permissions: TablePermissions | null | undefined): boolean {
  return permissions?.delete ?? false;
}

export function hasAction(
  permissions: TablePermissions | null | undefined,
  action: string
): boolean {
  return permissions?.actions?.includes(action) ?? false;
}

export function getTablePermissions(
  userPermissions: UserPermissions | null | undefined,
  tableName: string
): TablePermissions | null {
  return userPermissions?.tables?.[tableName] ?? null;
}

export function hasTableAccess(
  userPermissions: UserPermissions | null | undefined,
  tableName: string
): boolean {
  const tablePerms = getTablePermissions(userPermissions, tableName);
  return canView(tablePerms);
}

export function hasAnyTableAccess(
  userPermissions: UserPermissions | null | undefined
): boolean {
  if (!userPermissions?.tables) return false;
  return Object.values(userPermissions.tables).some((perms) => perms.read);
}

export function getAccessibleTables(
  userPermissions: UserPermissions | null | undefined
): string[] {
  if (!userPermissions?.tables) return [];
  return Object.entries(userPermissions.tables)
    .filter(([, perms]) => perms.read)
    .map(([tableName]) => tableName);
}

export function createEmptyPermissions(): TablePermissions {
  return {
    read: false,
    create: false,
    update: false,
    delete: false,
    actions: [],
  };
}

export function mergePermissions(
  base: TablePermissions,
  override: Partial<TablePermissions>
): TablePermissions {
  return {
    ...base,
    ...override,
    actions: override.actions ?? base.actions,
  };
}
