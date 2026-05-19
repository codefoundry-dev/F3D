import { useEffect, useRef } from 'react';

import CrossIcon from '../assets/icons/cross.svg?react';
import SearchIcon from '../assets/icons/search.svg?react';

import { Input } from './Input';

export interface ToolbarSearchToggleProps {
  /** Current search query */
  search: string;
  /** Called when search changes */
  onSearchChange: (value: string) => void;
  /** Whether the search input is expanded */
  searchOpen: boolean;
  /** Toggle the search expansion */
  onSearchOpenChange: (open: boolean) => void;
  /** Placeholder for search input */
  placeholder?: string;
  /** Additional className for the input */
  className?: string;
}

export function ToolbarSearchToggle({
  search,
  onSearchChange,
  searchOpen,
  onSearchOpenChange,
  placeholder = 'Search...',
  className,
}: ToolbarSearchToggleProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen && searchRef.current) searchRef.current.focus();
  }, [searchOpen]);

  if (searchOpen) {
    return (
      <div className="relative flex items-center">
        <Input
          ref={searchRef}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className={className ?? 'h-9 w-56 pr-8 text-sm'}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onSearchOpenChange(false);
          }}
        />
        <button
          type="button"
          className="absolute right-2 text-muted-foreground hover:text-foreground"
          onClick={() => onSearchOpenChange(false)}
        >
          <CrossIcon className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSearchOpenChange(true)}
      className="flex items-center justify-center w-9 h-9 border border-foreground/20 rounded-xl text-foreground hover:bg-accent transition-colors"
    >
      <SearchIcon className="w-4 h-4" />
    </button>
  );
}
