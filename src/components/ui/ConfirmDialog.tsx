'use client';

import { Modal, ModalFooter } from './Modal';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'default';
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  isLoading = false,
}: ConfirmDialogProps) {
  const iconColors = {
    danger: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
    warning: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30',
    default: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
  };

  const buttonVariants = {
    danger: 'danger' as const,
    warning: 'primary' as const,
    default: 'primary' as const,
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showCloseButton={false}>
      <div className="flex flex-col items-center text-center">
        <div
          className={`p-3 rounded-full ${iconColors[variant]} mb-4`}
        >
          <AlertTriangle className="h-6 w-6" />
        </div>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>

        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{description}</p>
        )}

        <ModalFooter className="w-full justify-center">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            variant={buttonVariants[variant]}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
