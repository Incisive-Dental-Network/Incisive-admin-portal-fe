'use client';

import { forwardRef, InputHTMLAttributes, useCallback, useState } from 'react';
import { cn, debounce } from '@/lib/utils';
import { Search, X } from 'lucide-react';
import { DEBOUNCE_DELAY } from '@/config/ui.constants';

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'defaultValue'> {
  onSearch: (value: string) => void;
  debounceMs?: number;
  showClearButton?: boolean;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      className,
      onSearch,
      debounceMs = DEBOUNCE_DELAY,
      showClearButton = true,
      placeholder = 'Search...',
      defaultValue: _,
      ...props
    },
    ref
  ) => {
    const [value, setValue] = useState('');

    const debouncedSearch = useCallback(
      debounce((searchValue: string) => {
        onSearch(searchValue);
      }, debounceMs),
      [onSearch, debounceMs]
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      debouncedSearch(newValue);
    };

    const handleClear = () => {
      setValue('');
      onSearch('');
    };

    return (
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className={cn(
            'block w-full rounded-lg border border-gray-300 dark:border-gray-600 pl-10 pr-10 py-2 text-sm shadow-sm',
            'bg-white dark:bg-gray-900 text-gray-900 dark:text-white',
            'placeholder:text-gray-400 dark:placeholder:text-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            className
          )}
          {...props}
        />
        {showClearButton && value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

export { SearchInput };
