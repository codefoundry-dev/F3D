import ChevronDownIcon from '../assets/icons/chevron-down.svg?react';
import EyeIcon from '../assets/icons/eye-opened.svg?react';
import InfoIcon from '../assets/icons/info.svg?react';
import { cn } from '../utils/cn';

import { InfoHint } from './InfoHint';
import type { SavedView } from './TableManagementModal';

export interface ViewSelectorDropdownProps {
  /** Currently active saved view (undefined = default view) */
  activeView: SavedView | undefined;
  /** List of all saved views */
  savedViews: SavedView[];
  /** Called to apply a view (null = reset to default) */
  onApplyView: (viewId: string | null) => void;
  /** Label for the default view */
  defaultViewLabel: string;
  /** Message when no saved views exist */
  noSavedViewsHint?: string;
  /** Whether the dropdown is open */
  isOpen: boolean;
  /** Toggle the dropdown */
  onOpenChange: (open: boolean | ((prev: boolean) => boolean)) => void;
  /** Ref for click-outside */
  dropdownRef: React.RefObject<HTMLDivElement>;
}

export function ViewSelectorDropdown({
  activeView,
  savedViews,
  onApplyView,
  defaultViewLabel,
  noSavedViewsHint,
  isOpen,
  onOpenChange,
  dropdownRef,
}: ViewSelectorDropdownProps) {
  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => onOpenChange((p: boolean) => !p)}
        className="flex items-center gap-2.5 h-12 px-4 border border-foreground/20 rounded-xl text-foreground hover:bg-accent transition-colors"
      >
        <EyeIcon className="w-5 h-5" />
        <span className="text-base font-medium">
          {activeView ? activeView.name : defaultViewLabel}
        </span>
        {savedViews.length > 0 && (
          <ChevronDownIcon className={cn('w-5 h-5 transition-transform', isOpen && 'rotate-180')} />
        )}
      </button>
      {isOpen && savedViews.length > 0 && (
        <div className="absolute left-0 mt-1 w-48 bg-card border border-border rounded-xl shadow-lg z-50 py-1">
          <button
            type="button"
            className={cn(
              'w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors',
              !activeView && 'font-medium bg-accent',
            )}
            onClick={() => {
              onApplyView(null);
              onOpenChange(false);
            }}
          >
            {defaultViewLabel}
          </button>
          {savedViews.map((view) => (
            <button
              key={view.id}
              type="button"
              className={cn(
                'w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors',
                activeView?.id === view.id && 'font-medium bg-accent',
              )}
              onClick={() => {
                onApplyView(view.id);
                onOpenChange(false);
              }}
            >
              {view.name}
            </button>
          ))}
        </div>
      )}
      {isOpen && savedViews.length === 0 && noSavedViewsHint && (
        <InfoHint
          icon={<InfoIcon className="w-4 h-4 text-[hsl(var(--badge-blue-text))]" />}
          className="text-[hsl(var(--badge-blue-text))]"
        >
          {noSavedViewsHint}
        </InfoHint>
      )}
    </div>
  );
}
