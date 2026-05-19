import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../utils/cn';

export interface AddressInputProps {
  value?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  searchFn: (input: string, types?: string[], locationContext?: string) => Promise<string[]>;
  types?: string[];
  /** Optional locationContext passed to searchFn (e.g. city name to narrow results) */
  locationContext?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  name?: string;
}

export const AddressInput = forwardRef<HTMLInputElement, AddressInputProps>(
  (
    {
      value = '',
      placeholder,
      className,
      disabled,
      searchFn,
      types,
      locationContext,
      onChange,
      onBlur,
      name,
    },
    ref,
  ) => {
    const [inputValue, setInputValue] = useState(value);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [portalStyle, setPortalStyle] = useState<React.CSSProperties>({});
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();
    const containerRef = useRef<HTMLDivElement>(null);
    const portalRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
      setInputValue(value);
    }, [value]);

    // Position the portal dropdown relative to the input
    useLayoutEffect(() => {
      if (!isOpen || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < 250;
      setPortalStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      });
    }, [isOpen, suggestions]);

    const fetchSuggestions = useCallback(
      (query: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (query.trim().length < 2) {
          setSuggestions([]);
          setIsOpen(false);
          return;
        }

        debounceRef.current = setTimeout(() => {
          void searchFn(query, types, locationContext).then((results) => {
            setSuggestions(results);
            setIsOpen(results.length > 0);
            setActiveIndex(-1);
          });
        }, 300);
      },
      [searchFn, types, locationContext],
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputValue(val);
      onChange?.(val);
      fetchSuggestions(val);
    };

    const handleSelect = (suggestion: string) => {
      setInputValue(suggestion);
      onChange?.(suggestion);
      setSuggestions([]);
      setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        handleSelect(suggestions[activeIndex]);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleBlur = () => {
      // Delay to allow click on suggestion in portal
      setTimeout(() => {
        if (
          !containerRef.current?.contains(document.activeElement) &&
          !portalRef.current?.contains(document.activeElement)
        ) {
          setIsOpen(false);
          onBlur?.();
        }
      }, 150);
    };

    useEffect(() => {
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }, []);

    return (
      <div ref={containerRef} className="relative w-full">
        <input
          ref={ref}
          name={name}
          type="text"
          value={inputValue}
          placeholder={placeholder}
          disabled={disabled}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          autoComplete="off"
          className={cn(
            'w-full py-2.5 px-3 border border-input bg-muted rounded-xl text-sm placeholder-muted-foreground',
            'focus:outline-none focus:border-foreground/50 focus:bg-muted',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className,
          )}
        />
        {isOpen &&
          suggestions.length > 0 &&
          createPortal(
            <ul
              ref={portalRef}
              role="listbox"
              style={portalStyle}
              className="max-h-60 overflow-auto rounded-xl border border-input bg-background shadow-lg z-[9999]"
            >
              {suggestions.map((suggestion, index) => (
                <li
                  key={suggestion}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseDown={() => handleSelect(suggestion)}
                  className={cn(
                    'cursor-pointer px-3 py-2 text-sm text-foreground',
                    'hover:bg-muted',
                    index === activeIndex && 'bg-muted',
                  )}
                >
                  {suggestion}
                </li>
              ))}
            </ul>,
            document.body,
          )}
      </div>
    );
  },
);

AddressInput.displayName = 'AddressInput';
