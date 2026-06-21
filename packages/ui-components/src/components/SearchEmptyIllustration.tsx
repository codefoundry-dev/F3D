import SearchEmptySvg from '../assets/illustrations/search-empty.svg?react';
import { cn } from '../utils/cn';

export interface SearchEmptyIllustrationProps {
  className?: string;
}

/**
 * Design-system "no search results" illustration (open box + magnifying glass)
 * used as the graphic for no-results-from-search states. Defaults to 120×120.
 * Pairs with {@link EmptyBoxIllustration} (the truly-empty graphic).
 */
export function SearchEmptyIllustration({ className }: SearchEmptyIllustrationProps) {
  return <SearchEmptySvg className={cn('size-[120px]', className)} aria-hidden />;
}
