import type React from 'react';

import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import PlusInCircleIcon from '@forethread/ui-components/assets/icons/plus-in-circle.svg?react';
import SearchIcon from '@forethread/ui-components/assets/icons/search.svg?react';

interface ModalListItem {
  id: string;
}

interface ModalListViewProps<T extends ModalListItem> {
  items: T[];
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder: string;
  isLoading: boolean;
  loadingMessage: string;
  emptyMessage: string;
  onView: (item: T) => void;
  onAdd: (item: T) => void;
  viewTitle: string;
  addTitle: string;
  renderInfo: (item: T) => React.ReactNode;
}

export function ModalListView<T extends ModalListItem>({
  items,
  search,
  onSearchChange,
  searchPlaceholder,
  isLoading,
  loadingMessage,
  emptyMessage,
  onView,
  onAdd,
  viewTitle,
  addTitle,
  renderInfo,
}: ModalListViewProps<T>) {
  return (
    <div className="rounded-lg border border-border p-4 flex-1 overflow-hidden flex flex-col">
      {/* Search */}
      <div className="relative mb-3">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full h-10 rounded-lg border border-border bg-background pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{loadingMessage}</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border p-3 hover:border-border-hover transition-colors"
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <PackageIcon className="w-5 h-5 text-muted-foreground" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">{renderInfo(item)}</div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onView(item)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title={viewTitle}
                >
                  <EyeIcon className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => onAdd(item)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title={addTitle}
                >
                  <PlusInCircleIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
