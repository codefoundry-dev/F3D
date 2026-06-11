import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import CrossIcon from '../assets/icons/cross.svg?react';
import DeleteIcon from '../assets/icons/delete.svg?react';
import FilterIcon from '../assets/icons/filter.svg?react';
import PlusIcon from '../assets/icons/plus-in-circle.svg?react';
import SearchIconSvg from '../assets/icons/search.svg?react';
import { cn } from '../utils/cn';
import { onDigitsOnly } from '../utils/inputFilters';

import { Button } from './Button';
import { CustomDropdown } from './CustomDropdown';

/* ─── Types ──────────────────────────────────────────────────────── */

export interface MaterialItem {
  id: string;
  name: string;
  category?: string;
  unit?: string;
  description?: string;
  imageUrl?: string;
}

export interface SelectedMaterial extends MaterialItem {
  quantity: number;
}

export interface MaterialFilterOption {
  value: string;
  label: string;
}

export interface MaterialFilters {
  category: string;
  manufacturer: string;
  materialType: string;
  unitOfMeasurement: string;
  countryOfOrigin: string;
  colour: string;
}

export interface MaterialSearchPanelProps {
  /** Search query */
  search: string;
  onSearchChange: (value: string) => void;
  /** Available materials from search */
  results: MaterialItem[];
  resultsCount?: number;
  /** Currently selected materials with quantities */
  selected: SelectedMaterial[];
  onSelect: (item: MaterialItem) => void;
  onDeselect: (itemId: string) => void;
  onQuantityChange: (itemId: string, qty: number) => void;
  onAddToList: () => void;
  /** Filter options */
  categoryOptions?: MaterialFilterOption[];
  manufacturerOptions?: MaterialFilterOption[];
  materialTypeOptions?: MaterialFilterOption[];
  uomOptions?: MaterialFilterOption[];
  countryOptions?: MaterialFilterOption[];
  colourOptions?: MaterialFilterOption[];
  filters?: MaterialFilters;
  onFiltersChange?: (filters: MaterialFilters) => void;
  /** Whether the panel is open */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Labels */
  searchPlaceholder?: string;
  resultsLabel?: string;
  filtersLabel?: string;
  clearAllLabel?: string;
  applyLabel?: string;
  addToListLabel?: string;
  qtyPlaceholder?: string;
  /** i18n filter labels */
  categoryLabel?: string;
  manufacturerLabel?: string;
  materialTypeLabel?: string;
  uomLabel?: string;
  countryLabel?: string;
  colourLabel?: string;
  /** Compact mode for inline table cells — no border/bg on input */
  compact?: boolean;
  /**
   * Single-pick mode: the whole result row becomes a button that fires with
   * the clicked material (no + / qty / "Add to list" controls). Used by the
   * BOM review match cell where picking one material resolves the line.
   */
  onPickItem?: (item: MaterialItem) => void;
  /** Optional footer rendered at the bottom of the results panel (e.g. a "Create private material item" button). */
  footerAction?: ReactNode;
}

const EMPTY_FILTERS: MaterialFilters = {
  category: '',
  manufacturer: '',
  materialType: '',
  unitOfMeasurement: '',
  countryOfOrigin: '',
  colour: '',
};

/* ─── Component ──────────────────────────────────────────────────── */

export function MaterialSearchPanel({
  search,
  onSearchChange,
  results,
  resultsCount,
  selected,
  onSelect,
  onDeselect,
  onQuantityChange,
  onAddToList,
  categoryOptions = [],
  manufacturerOptions = [],
  materialTypeOptions = [],
  uomOptions = [],
  countryOptions = [],
  colourOptions = [],
  filters = EMPTY_FILTERS,
  onFiltersChange,
  open,
  onOpenChange,
  searchPlaceholder = 'Search',
  resultsLabel = 'results',
  filtersLabel = 'Filters',
  clearAllLabel = 'Clear all',
  applyLabel = 'Apply',
  addToListLabel = 'Add to list',
  qtyPlaceholder = 'Qty',
  categoryLabel = 'Category',
  manufacturerLabel = 'Manufacturer',
  materialTypeLabel = 'Material type',
  uomLabel = 'Unit of measurement',
  countryLabel = 'Country of origin',
  colourLabel = 'Colour',
  compact = false,
  onPickItem,
  footerAction,
}: MaterialSearchPanelProps) {
  const [showFilters, setShowFilters] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [portalStyle, setPortalStyle] = useState<CSSProperties>({});

  const selectedIds = new Set(selected.map((s) => s.id));

  // In compact mode the results panel is portaled to <body> (see render) so the
  // review table's overflow can't clip it. Keep it glued to the trigger on open,
  // scroll and resize; the width is pinned so long rows truncate instead of
  // widening the panel, and it flips above the trigger when space is tight.
  const positionPortal = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const GAP = 4;
    const PANEL_MAX_H = 480;
    const width = Math.min(600, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < PANEL_MAX_H && rect.top > spaceBelow;
    setPortalStyle({
      left,
      width,
      ...(openUp ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open || !compact) return;
    positionPortal();
    const onMove = () => positionPortal();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, compact, positionPortal]);

  // Pull focus into the search field whenever the panel opens. In the BOM match
  // cell the panel is opened by an external button, so without this the input
  // never focuses — its icon stays hidden and it reads as an empty cell rather
  // than a search box. (Trigger-is-the-input callers are already focused, so
  // this is a no-op for them.)
  useEffect(() => {
    if (open) searchInputRef.current?.focus();
  }, [open]);

  // Active filter chips
  const activeFilterEntries = Object.entries(filters).filter(([, v]) => v !== '');

  const handleClearAll = useCallback(() => {
    onFiltersChange?.(EMPTY_FILTERS);
  }, [onFiltersChange]);

  const handleRemoveFilter = useCallback(
    (key: string) => {
      onFiltersChange?.({ ...filters, [key]: '' });
    },
    [filters, onFiltersChange],
  );

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        !portalRef.current?.contains(target)
      ) {
        onOpenChange(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onOpenChange]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Search input */}
      <div ref={triggerRef} className={cn('relative group', compact && 'focus-within:bg-muted/50')}>
        <SearchIconSvg
          className={cn(
            'absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none',
            compact
              ? 'left-2 w-3.5 h-3.5 opacity-0 group-focus-within:opacity-100 transition-opacity'
              : 'left-4 w-4 h-4',
          )}
        />
        <input
          ref={searchInputRef}
          type="text"
          value={search}
          onChange={(e) => {
            onSearchChange(e.target.value);
            if (!open) onOpenChange(true);
          }}
          onFocus={() => onOpenChange(true)}
          placeholder={searchPlaceholder}
          className={cn(
            'w-full text-foreground placeholder:text-muted-foreground focus:outline-none',
            compact
              ? 'h-10 bg-transparent pr-2 text-sm border-0 pl-2 focus:pl-8 transition-[padding]'
              : 'h-12 rounded-xl border border-foreground/20 bg-background pl-10 pr-4 text-base focus:border-foreground/40',
          )}
        />
      </div>

      {/* Dropdown panel */}
      {open &&
        (() => {
          const panel = (
            <div
              ref={compact ? portalRef : undefined}
              style={compact ? portalStyle : undefined}
              className={cn(
                'bg-background border border-border rounded-xl shadow-lg flex flex-col',
                // Compact panels are portaled to <body> and fixed-positioned (see
                // positionPortal) so the review table's overflow can't clip them;
                // the pinned width keeps long rows truncating instead of spilling
                // across the table. Non-compact stays anchored under its toolbar.
                compact ? 'fixed z-[9999]' : 'absolute z-40 left-0 right-0 mt-1',
                !showFilters ? 'max-h-[420px] overflow-hidden' : 'overflow-visible',
              )}
            >
              {!showFilters ? (
                <>
                  {/* Header: results count + Filters button */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
                    <span className="text-sm text-muted-foreground">
                      {resultsCount ?? results.length} {resultsLabel}
                    </span>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-foreground border border-border rounded-lg hover:bg-accent"
                      onClick={() => setShowFilters(true)}
                    >
                      <FilterIcon className="w-4 h-4" />
                      {filtersLabel}
                    </button>
                  </div>

                  {/* Active filter chips */}
                  {activeFilterEntries.length > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0 flex-wrap">
                      {activeFilterEntries.map(([key, value]) => (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-muted text-foreground rounded-full"
                        >
                          {value}
                          <button
                            type="button"
                            onClick={() => handleRemoveFilter(key)}
                            className="hover:text-destructive"
                          >
                            <CrossIcon className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Results list */}
                  <div className="overflow-y-auto flex-1">
                    {results.map((item) => {
                      const isSelected = selectedIds.has(item.id);
                      const selectedItem = selected.find((s) => s.id === item.id);
                      const rowContent = (
                        <>
                          {/* Material icon */}
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-full h-full rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-5 h-5 bg-muted-foreground/30 rounded" />
                            )}
                          </div>

                          {/* Material info */}
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium text-foreground truncate">
                                {item.name}
                              </span>
                              {item.category && (
                                <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 bg-muted text-muted-foreground rounded">
                                  {item.category}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {item.unit && <span>{item.unit}</span>}
                              {item.unit && item.description && <span> · </span>}
                              {item.description && <span>{item.description}</span>}
                            </div>
                          </div>
                        </>
                      );

                      // Single-pick mode: the whole row is the action.
                      if (onPickItem) {
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => onPickItem(item)}
                            className="w-full flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors"
                          >
                            {rowContent}
                          </button>
                        );
                      }

                      return (
                        <div
                          key={item.id}
                          className={cn(
                            'flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0',
                            isSelected && 'bg-muted/50',
                          )}
                        >
                          {rowContent}

                          {/* Action: add or qty + remove */}
                          {isSelected ? (
                            <div className="flex items-center gap-2 shrink-0">
                              <input
                                onKeyDown={onDigitsOnly}
                                value={selectedItem?.quantity ?? 1}
                                onChange={(e) =>
                                  onQuantityChange(item.id, parseInt(e.target.value, 10) || 1)
                                }
                                placeholder={qtyPlaceholder}
                                className="w-16 h-9 rounded-lg border border-border bg-background text-center text-sm focus:outline-none focus:border-foreground/40"
                              />
                              <button
                                type="button"
                                onClick={() => onDeselect(item.id)}
                                className="p-1.5 text-foreground hover:text-destructive"
                              >
                                <DeleteIcon className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSelect(item)}
                              className="p-1 text-muted-foreground hover:text-foreground shrink-0"
                            >
                              <PlusIcon className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add to list button */}
                  {!onPickItem && selected.length > 0 && (
                    <div className="flex justify-end px-4 py-3 border-t border-border shrink-0">
                      <Button variant="primary" size="md" onClick={onAddToList}>
                        {addToListLabel}
                      </Button>
                    </div>
                  )}

                  {/* Custom footer (e.g. "Create private material item") */}
                  {footerAction && (
                    <div className="px-2 py-2 border-t border-border shrink-0">{footerAction}</div>
                  )}
                </>
              ) : (
                /* ─── Filter view ─── */
                <>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                    <span className="text-base font-medium text-foreground">{filtersLabel}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-foreground border border-border rounded-lg hover:bg-accent"
                        onClick={handleClearAll}
                      >
                        {clearAllLabel}
                        <DeleteIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="flex items-center justify-center w-8 h-8 text-foreground border border-border rounded-lg hover:bg-accent"
                        onClick={() => setShowFilters(false)}
                      >
                        <CrossIcon className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-foreground">
                          {categoryLabel}
                        </label>
                        <CustomDropdown
                          options={categoryOptions}
                          value={filters.category}
                          onChange={(v) => onFiltersChange?.({ ...filters, category: v })}
                          placeholder={`All ${categoryLabel.toLowerCase()}`}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-foreground">
                          {manufacturerLabel}
                        </label>
                        <CustomDropdown
                          options={manufacturerOptions}
                          value={filters.manufacturer}
                          onChange={(v) => onFiltersChange?.({ ...filters, manufacturer: v })}
                          placeholder={`All ${manufacturerLabel.toLowerCase()}`}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-foreground">
                          {materialTypeLabel}
                        </label>
                        <CustomDropdown
                          options={materialTypeOptions}
                          value={filters.materialType}
                          onChange={(v) => onFiltersChange?.({ ...filters, materialType: v })}
                          placeholder={`All ${materialTypeLabel.toLowerCase()}`}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-foreground">{uomLabel}</label>
                        <CustomDropdown
                          options={uomOptions}
                          value={filters.unitOfMeasurement}
                          onChange={(v) => onFiltersChange?.({ ...filters, unitOfMeasurement: v })}
                          placeholder="All UoM"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-foreground">
                          {countryLabel}
                        </label>
                        <CustomDropdown
                          options={countryOptions}
                          value={filters.countryOfOrigin}
                          onChange={(v) => onFiltersChange?.({ ...filters, countryOfOrigin: v })}
                          placeholder={`All ${countryLabel.toLowerCase()}`}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-foreground">{colourLabel}</label>
                        <CustomDropdown
                          options={colourOptions}
                          value={filters.colour}
                          onChange={(v) => onFiltersChange?.({ ...filters, colour: v })}
                          placeholder={`All ${colourLabel.toLowerCase()}`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end px-4 py-3 border-t border-border shrink-0">
                    <Button variant="primary" size="md" onClick={() => setShowFilters(false)}>
                      {applyLabel}
                    </Button>
                  </div>
                </>
              )}
            </div>
          );
          return compact ? createPortal(panel, document.body) : panel;
        })()}
    </div>
  );
}
