import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import FilterIcon from '../assets/icons/filter.svg?react';
import PlusIcon from '../assets/icons/plus.svg?react';
import SearchIcon from '../assets/icons/search.svg?react';
import { useIsPhone } from '../hooks/useIsPhone';
import { cn } from '../utils/cn';

import { Button } from './Button';
import { DotActionsMenu, type DotAction } from './DotActionsMenu';
import { useMobileActionBarSlot, useMobileNavHidden } from './MobileChrome';
import { Modal, ModalBody, ModalFooter, ModalHeader } from './Modal';

export interface MobileListToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** Advanced filters (and Group) shown in the full-screen Filters sheet. */
  filters?: ReactNode;
  /** Number of active advanced filters, shown on the Filters button. */
  activeFilterCount?: number;
  filtersLabel?: string;
  /** Filters sheet title. Defaults to `filtersLabel`. */
  filtersTitle?: string;
  onClearFilters?: () => void;
  clearFiltersLabel?: string;
  /** Label of the sheet's close/apply button. */
  doneLabel?: string;
  /** Quick-filter pills: one line that swipes sideways. */
  quickFilters?: ReactNode;
  /** The ⋯ menu: view presets, Save view, Export, Column settings. */
  menuActions?: DotAction[];
  moreLabel?: string;
  className?: string;
}

/**
 * Phone list toolbar (ADR-0019 B9, FOR-375). Replaces the ~400px desktop
 * toolbar with two rows:
 *
 * 1. a full-width search box, a **Filters** button with the active count, and a
 *    **⋯** menu (view presets, Save view, Export, Column settings);
 * 2. the quick-filter pills on one line that swipes sideways.
 *
 * Filters opens a full-screen sheet holding the page's advanced filters and
 * Group. Pages render this instead of their desktop toolbar when
 * `useIsPhone()` is true, and put "Create new" in a {@link FloatingActionButton}.
 */
export function MobileListToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search',
  filters,
  activeFilterCount = 0,
  filtersLabel = 'Filters',
  filtersTitle,
  onClearFilters,
  clearFiltersLabel = 'Clear all',
  doneLabel = 'Done',
  quickFilters,
  menuActions = [],
  moreLabel = 'More options',
  className,
}: MobileListToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className={cn('flex flex-col gap-3', className)} data-testid="mobile-list-toolbar">
      <div className="flex items-center gap-2">
        <label className="relative flex h-11 min-w-0 flex-1 items-center">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute left-3 size-4 text-gray-500"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            // 16px keeps iOS Safari from zooming on focus (ADR-0019).
            className="h-11 w-full rounded-xl border border-[#E8EAED] bg-white pl-9 pr-3 text-base text-foreground placeholder:text-gray-500 focus:border-gray-300 focus:outline-none"
          />
        </label>

        {filters && (
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-label={
              activeFilterCount > 0 ? `${filtersLabel} (${activeFilterCount})` : filtersLabel
            }
            className={cn(
              'flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-[#E8EAED] bg-white px-3 text-sm font-semibold text-gray-700',
              activeFilterCount > 0 && 'border-gray-300 bg-gray-50',
            )}
          >
            <FilterIcon className="size-4" />
            {filtersLabel}
            {activeFilterCount > 0 && (
              <span
                data-testid="mobile-filter-count"
                className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1B1D22] px-1.5 text-xs font-semibold text-white"
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        )}

        {menuActions.length > 0 && (
          <DotActionsMenu
            actions={menuActions}
            ariaLabel={moreLabel}
            triggerClassName="size-11 shrink-0 rounded-xl p-0 [&_svg]:size-5"
          />
        )}
      </div>

      {quickFilters && (
        <div
          className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0"
          data-testid="mobile-quick-filters"
        >
          {quickFilters}
        </div>
      )}

      {filtersOpen && (
        <Modal onClose={() => setFiltersOpen(false)} mobile="fullscreen" scrollBody>
          <ModalHeader onClose={() => setFiltersOpen(false)}>
            {filtersTitle ?? filtersLabel}
          </ModalHeader>
          <ModalBody className="gap-4">{filters}</ModalBody>
          <ModalFooter className="pb-[calc(16px+env(safe-area-inset-bottom))] [&>*]:flex-1">
            {onClearFilters && (
              <Button type="button" variant="secondary" onClick={onClearFilters}>
                {clearFiltersLabel}
              </Button>
            )}
            <Button type="button" variant="primary" onClick={() => setFiltersOpen(false)}>
              {doneLabel}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}

export interface FloatingActionButtonProps {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  className?: string;
  testId?: string;
}

/**
 * The phone "Create new" button (B9): a round button at the bottom right,
 * above the bottom nav (or the very bottom while the nav is hidden). Phones
 * only; renders nothing at 768px and up. Portals
 * into the shell's action-bar slot so it sits outside the scrolling content.
 */
export function FloatingActionButton({
  label,
  onClick,
  icon,
  className,
  testId = 'mobile-fab',
}: FloatingActionButtonProps) {
  const isPhone = useIsPhone();
  const slot = useMobileActionBarSlot();
  const navHidden = useMobileNavHidden();
  if (!isPhone) return null;

  const fab = (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'fixed right-4 z-30 flex size-14 items-center justify-center rounded-full bg-[#1B1D22] text-white shadow-[0_8px_24px_rgba(10,13,18,0.24)] active:scale-95 [&_svg]:size-6',
        navHidden
          ? 'bottom-[calc(16px+env(safe-area-inset-bottom))]'
          : 'bottom-[calc(72px+env(safe-area-inset-bottom))]',
        className,
      )}
    >
      {icon ?? <PlusIcon />}
    </button>
  );

  return slot ? createPortal(fab, slot) : fab;
}
