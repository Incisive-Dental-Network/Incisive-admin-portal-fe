'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  canEdit,
  canDelete,
  hasAction,
} from '@/lib/permissions';
import type { TablePermissions } from '@/types';
import {
  Eye,
  Pencil,
  Trash2,
  MoreHorizontal,
  Power,
  PowerOff,
  Download,
} from 'lucide-react';

interface TableActionsProps {
  permissions: TablePermissions;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onActivate?: () => void;
  onDeactivate?: () => void;
  onExport?: () => void;
  isActive?: boolean;
  isDeleting?: boolean;
  isActivating?: boolean;
  compact?: boolean;
}

export function TableActions({
  permissions,
  onView,
  onEdit,
  onDelete,
  onActivate,
  onDeactivate,
  onExport,
  isActive,
  isDeleting = false,
  isActivating = false,
  compact = false,
}: TableActionsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; showAbove: boolean }>({ top: 0, left: 0, showAbove: false });
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (showDropdown && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownHeight = 250; // Approximate max height of dropdown
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const showAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

      setDropdownPosition({
        top: showAbove ? rect.top : rect.bottom + 4,
        left: rect.right - 192, // 192px = w-48 (12rem)
        showAbove,
      });
    }
  }, [showDropdown]);

  const showEdit = canEdit(permissions) && onEdit;
  const showDelete = canDelete(permissions) && onDelete;
  const showActivate = hasAction(permissions, 'activate') && onActivate && !isActive;
  const showDeactivate = hasAction(permissions, 'deactivate') && onDeactivate && isActive;
  const showExport = hasAction(permissions, 'export') && onExport;

  const handleDelete = () => {
    setShowDeleteConfirm(false);
    onDelete?.();
  };

  // Compact mode - show dropdown menu
  if (compact) {
    const dropdownContent = showDropdown && typeof document !== 'undefined' ? createPortal(
      <>
        <div
          className="fixed inset-0 z-[100]"
          onClick={() => setShowDropdown(false)}
        />
        <div
          className="fixed w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-[101]"
          style={{
            top: dropdownPosition.showAbove ? 'auto' : dropdownPosition.top,
            bottom: dropdownPosition.showAbove ? `${window.innerHeight - dropdownPosition.top + 4}px` : 'auto',
            left: Math.max(8, dropdownPosition.left),
          }}
        >
          {onView && (
            <button
              onClick={() => {
                setShowDropdown(false);
                onView();
              }}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Eye className="h-4 w-4" />
              View
            </button>
          )}
          {showEdit && (
            <button
              onClick={() => {
                setShowDropdown(false);
                onEdit();
              }}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          )}
          {showActivate && (
            <button
              onClick={() => {
                setShowDropdown(false);
                onActivate();
              }}
              disabled={isActivating}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <Power className="h-4 w-4" />
              Activate
            </button>
          )}
          {showDeactivate && (
            <button
              onClick={() => {
                setShowDropdown(false);
                onDeactivate();
              }}
              disabled={isActivating}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <PowerOff className="h-4 w-4" />
              Deactivate
            </button>
          )}
          {showExport && (
            <button
              onClick={() => {
                setShowDropdown(false);
                onExport();
              }}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          )}
          {showDelete && (
            <>
              <hr className="my-1 border-gray-200 dark:border-gray-700" />
              <button
                onClick={() => {
                  setShowDropdown(false);
                  setShowDeleteConfirm(true);
                }}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </>
          )}
        </div>
      </>,
      document.body
    ) : null;

    return (
      <div className="relative">
        <Button
          ref={buttonRef}
          variant="ghost"
          size="sm"
          onClick={() => setShowDropdown(!showDropdown)}
          className="h-8 w-8 p-0"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>

        {dropdownContent}

        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
          title="Delete Item"
          description="Are you sure you want to delete this item? This action cannot be undone."
          confirmText="Delete"
          variant="danger"
          isLoading={isDeleting}
        />
      </div>
    );
  }

  // Full mode - show buttons
  return (
    <div className="flex items-center gap-2">
      {onView && (
        <Button variant="ghost" size="sm" onClick={onView}>
          <Eye className="h-4 w-4" />
        </Button>
      )}
      {showEdit && (
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      {showActivate && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onActivate}
          disabled={isActivating}
          className="text-green-600 hover:text-green-700"
        >
          <Power className="h-4 w-4" />
        </Button>
      )}
      {showDeactivate && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDeactivate}
          disabled={isActivating}
          className="text-yellow-600 hover:text-yellow-700"
        >
          <PowerOff className="h-4 w-4" />
        </Button>
      )}
      {showExport && (
        <Button variant="ghost" size="sm" onClick={onExport}>
          <Download className="h-4 w-4" />
        </Button>
      )}
      {showDelete && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>

          <ConfirmDialog
            isOpen={showDeleteConfirm}
            onClose={() => setShowDeleteConfirm(false)}
            onConfirm={handleDelete}
            title="Delete Item"
            description="Are you sure you want to delete this item? This action cannot be undone."
            confirmText="Delete"
            variant="danger"
            isLoading={isDeleting}
          />
        </>
      )}
    </div>
  );
}
