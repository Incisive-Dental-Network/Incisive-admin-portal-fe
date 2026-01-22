'use client';

import { useState, useCallback, useMemo } from 'react';
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from '@/config/ui.constants';

interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
  total?: number;
}

interface UsePaginationReturn {
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
  offset: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setTotal: (total: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  firstPage: () => void;
  lastPage: () => void;
  getPageNumbers: () => (number | 'ellipsis')[];
  isValidPage: (page: number) => boolean;
}

export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const {
    initialPage = 1,
    initialPageSize = DEFAULT_PAGE_SIZE,
    total: initialTotal = 0,
  } = options;

  const [page, setPageState] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [total, setTotal] = useState(initialTotal);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  const offset = useMemo(() => (page - 1) * pageSize, [page, pageSize]);

  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  const isValidPage = useCallback(
    (p: number) => p >= 1 && p <= totalPages,
    [totalPages]
  );

  const setPage = useCallback(
    (newPage: number) => {
      if (isValidPage(newPage)) {
        setPageState(newPage);
      }
    },
    [isValidPage]
  );

  const setPageSize = useCallback((newSize: number) => {
    if (PAGE_SIZES.includes(newSize as any)) {
      setPageSizeState(newSize);
      setPageState(1); // Reset to first page when changing page size
    }
  }, []);

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setPageState((prev) => prev + 1);
    }
  }, [hasNextPage]);

  const previousPage = useCallback(() => {
    if (hasPreviousPage) {
      setPageState((prev) => prev - 1);
    }
  }, [hasPreviousPage]);

  const firstPage = useCallback(() => {
    setPageState(1);
  }, []);

  const lastPage = useCallback(() => {
    setPageState(totalPages);
  }, [totalPages]);

  const getPageNumbers = useCallback((): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];
    const showEllipsisThreshold = 7;

    if (totalPages <= showEllipsisThreshold) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Always show first page
    pages.push(1);

    if (page > 3) {
      pages.push('ellipsis');
    }

    // Show pages around current page
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (page < totalPages - 2) {
      pages.push('ellipsis');
    }

    // Always show last page
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  }, [page, totalPages]);

  return {
    page,
    pageSize,
    totalPages,
    total,
    offset,
    hasNextPage,
    hasPreviousPage,
    setPage,
    setPageSize,
    setTotal,
    nextPage,
    previousPage,
    firstPage,
    lastPage,
    getPageNumbers,
    isValidPage,
  };
}
