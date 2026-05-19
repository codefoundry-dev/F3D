import { type InputHTMLAttributes, forwardRef } from 'react';

import SearchIcon from '../assets/icons/search.svg?react';
import { cn } from '../utils/cn';

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  className?: string;
  iconClassName?: string;
  inputClassName?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, iconClassName, inputClassName, placeholder = 'Search', ...props }, ref) => {
    return (
      <div className={cn('relative', className)}>
        <SearchIcon
          className={cn(
            'absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none',
            iconClassName,
          )}
        />
        <input
          ref={ref}
          type="text"
          placeholder={placeholder}
          className={cn(
            'h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/50 focus:bg-muted',
            inputClassName,
          )}
          {...props}
        />
      </div>
    );
  },
);

SearchInput.displayName = 'SearchInput';
