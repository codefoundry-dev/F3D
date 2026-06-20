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
            'h-9 w-full rounded-[12px] border border-[#E8EAED] bg-white pl-9 pr-3 text-sm font-medium text-gray-900 shadow-[0_1px_3px_rgba(10,13,18,0.06),0_1px_1px_rgba(10,13,18,0.02)] placeholder:font-normal placeholder:text-gray-500 outline-none transition-shadow focus:ring-4 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
            inputClassName,
          )}
          {...props}
        />
      </div>
    );
  },
);

SearchInput.displayName = 'SearchInput';
