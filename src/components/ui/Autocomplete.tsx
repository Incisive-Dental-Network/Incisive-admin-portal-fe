'use client';

import { useState, useRef, useEffect, useCallback, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface AutocompleteOption {
  value: string;
  label: string;
}

export interface AutocompleteProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label?: string;
  error?: string;
  value?: string;
  displayValue?: string;
  onSearch: (query: string) => Promise<AutocompleteOption[]>;
  onChange: (value: string, option?: AutocompleteOption) => void;
  debounceMs?: number;
  minChars?: number;
  isLoading?: boolean;
  restrictToOptions?: boolean; // If true, only allow selection from dropdown options
}

export function Autocomplete({
  className,
  label,
  error,
  value,
  displayValue,
  onSearch,
  onChange,
  debounceMs = 300,
  minChars = 1,
  isLoading: externalLoading = false,
  restrictToOptions = false,
  id,
  ...props
}: AutocompleteProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  const [inputValue, setInputValue] = useState(displayValue || '');
  const [options, setOptions] = useState<AutocompleteOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSelectingRef = useRef(false); // Track if user is selecting from dropdown

  // Update input value when displayValue prop changes
  useEffect(() => {
    if (displayValue !== undefined) {
      setInputValue(displayValue);
    }
  }, [displayValue]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchWithDebounce = useCallback(
    async (query: string) => {
      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (query.length < minChars) {
        setOptions([]);
        setIsOpen(false);
        return;
      }

      debounceTimerRef.current = setTimeout(async () => {
        setIsLoading(true);
        try {
          const results = await onSearch(query);
          setOptions(results);
          setIsOpen(results.length > 0);
          setHighlightedIndex(-1);
        } catch (error) {
          console.error('Autocomplete search error:', error);
          setOptions([]);
        } finally {
          setIsLoading(false);
        }
      }, debounceMs);
    },
    [onSearch, debounceMs, minChars]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Clear selection if user modifies the input (but not if restrictToOptions is enabled)
    // When restrictToOptions is true, we keep the value until a new valid selection is made
    if (value && !restrictToOptions) {
      onChange('', undefined);
    }

    searchWithDebounce(newValue);
  };

  const handleSelect = (option: AutocompleteOption) => {
    setInputValue(option.label);
    onChange(option.value, option);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && inputValue.length >= minChars) {
        searchWithDebounce(inputValue);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          handleSelect(options[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        // Reset input to display value when escaping (if restrictToOptions is enabled)
        if (restrictToOptions && displayValue) {
          setInputValue(displayValue);
        }
        break;
    }
  };

  const handleFocus = () => {
    // Show dropdown if we have options and input has content
    if (options.length > 0 && inputValue.length >= minChars) {
      setIsOpen(true);
    }
  };

  const handleBlur = () => {
    // Delay to allow dropdown click to process first
    setTimeout(() => {
      // Skip reset if user is selecting from dropdown
      if (isSelectingRef.current) {
        isSelectingRef.current = false;
        return;
      }
      // If restrictToOptions is enabled, always reset input to match the current valid selection
      if (restrictToOptions) {
        if (displayValue) {
          setInputValue(displayValue);
        } else {
          setInputValue('');
        }
      }
    }, 150);
  };

  const loading = isLoading || externalLoading;

  return (
    <div className="w-full relative" ref={wrapperRef}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn(
            'block w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors',
            'bg-white dark:bg-gray-900 text-gray-900 dark:text-white',
            'placeholder:text-gray-400 dark:placeholder:text-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-offset-0 dark:focus:ring-offset-gray-900',
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-500'
              : 'border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring-primary-500',
            'disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed',
            className
          )}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : undefined}
          aria-expanded={isOpen}
          aria-autocomplete="list"
          autoComplete="off"
          {...props}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg
              className="animate-spin h-4 w-4 text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Dropdown suggestions */}
      {isOpen && options.length > 0 && (
        <ul
          className={cn(
            'absolute z-50 w-full mt-1 max-h-60 overflow-auto rounded-lg border shadow-lg',
            'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
          )}
          role="listbox"
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              onMouseDown={() => { isSelectingRef.current = true; }}
              onClick={() => handleSelect(option)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={cn(
                'px-3 py-2 cursor-pointer text-sm',
                'text-gray-900 dark:text-white',
                highlightedIndex === index
                  ? 'bg-primary-50 dark:bg-primary-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
              role="option"
              aria-selected={highlightedIndex === index}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}

      {/* No results message */}
      {isOpen && options.length === 0 && !loading && inputValue.length >= minChars && (
        <div
          className={cn(
            'absolute z-50 w-full mt-1 px-3 py-2 rounded-lg border shadow-lg text-sm',
            'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700',
            'text-gray-500 dark:text-gray-400'
          )}
        >
          No results found
        </div>
      )}

      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
