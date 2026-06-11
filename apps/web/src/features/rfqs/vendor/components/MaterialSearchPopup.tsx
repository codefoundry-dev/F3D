import type { MaterialListItemDto } from '@forethread/api-client';
import { getMaterials, getMaterialCategories } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Badge, cn, CustomDropdown } from '@forethread/ui-components';
import CrossIcon from '@forethread/ui-components/assets/icons/cross.svg?react';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import FilterIcon from '@forethread/ui-components/assets/icons/filter.svg?react';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

interface MaterialSearchPopupProps {
  open: boolean;
  onClose: () => void;
  onSelect: (material: MaterialListItemDto) => void;
  /** Free-text search typed in the inline substitute field */
  searchQuery?: string;
  /** Override for the desktop dropdown position (e.g. to anchor under a table row) */
  positionClassName?: string;
}

export function MaterialSearchPopup({
  open,
  onClose,
  onSelect,
  searchQuery,
  positionClassName,
}: MaterialSearchPopupProps) {
  const { t } = useTranslation('rfqs');
  const popupRef = useRef<HTMLDivElement>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const { data: categories } = useQuery({
    queryKey: ['material-categories'],
    queryFn: () => getMaterialCategories(),
    enabled: open,
  });

  const categoryOptions = (categories ?? []).map((c) => ({ value: c.id, label: c.name }));
  const activeCategoryLabel = categoryOptions.find((o) => o.value === categoryFilter)?.label;

  const normalizedSearch = searchQuery?.trim();
  const { data } = useQuery({
    queryKey: ['materials-filter', categoryFilter, normalizedSearch ?? ''],
    queryFn: () =>
      getMaterials({
        categoryId: categoryFilter || undefined,
        search: normalizedSearch === '' ? undefined : normalizedSearch,
        limit: 50,
      }),
    enabled: open,
  });

  const materials = data?.items ?? [];

  useEffect(() => {
    if (!open) {
      setShowFilters(false);
      setCategoryFilter('');
    }
  }, [open]);

  const close = useCallback(() => onClose(), [onClose]);

  // Click outside (desktop only)
  useEffect(() => {
    if (!open || isMobile) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (popupRef.current && !popupRef.current.contains(target)) {
        // Don't close if clicking inside a portal dropdown (e.g. CustomDropdown listbox)
        const el = target instanceof Element ? target : target.parentElement;
        if (el?.closest('[role="listbox"]')) return;
        close();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, isMobile, close]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, close]);

  if (!open) return null;

  const panelContent = (
    <>
      {/* Header: results count + Filters button */}
      <div className="flex items-center justify-between px-2 py-2 shrink-0">
        <span className="text-sm text-muted-foreground">
          {t('response.results', { count: materials.length })}
        </span>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-foreground border border-border rounded-lg hover:bg-accent transition-colors"
          onClick={() => setShowFilters(!showFilters)}
        >
          <FilterIcon className="w-5 h-5" />
          {t('response.filters')}
        </button>
      </div>

      {/* Inline filter panel (pushes items down) */}
      {showFilters && (
        <div className="border-b border-border shrink-0">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-sm font-medium text-foreground">
              {t('response.filterByCategory')}
            </span>
            <div className="flex items-center gap-2">
              {categoryFilter && (
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2 py-1 text-xs text-foreground border border-border rounded-lg hover:bg-accent"
                  onClick={() => setCategoryFilter('')}
                >
                  {t('response.clearAll')}
                  <DeleteIcon className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                className="flex items-center justify-center w-7 h-7 text-foreground border border-border rounded-lg hover:bg-accent"
                onClick={() => setShowFilters(false)}
              >
                <CrossIcon className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="px-4 pb-3">
            <CustomDropdown
              options={categoryOptions}
              value={categoryFilter}
              onChange={setCategoryFilter}
              placeholder={t('response.allCategories')}
            />
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {!showFilters && activeCategoryLabel && (
        <div className="flex items-center gap-2 px-2 py-2 border-b border-border shrink-0 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-muted text-foreground rounded-full">
            {activeCategoryLabel}
            <button
              type="button"
              onClick={() => setCategoryFilter('')}
              className="hover:text-destructive"
            >
              <CrossIcon className="w-2.5 h-2.5" />
            </button>
          </span>
        </div>
      )}

      {/* Results list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
        {materials.map((material) => (
          <button
            key={material.id}
            type="button"
            className="w-full text-left flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
            onClick={() => {
              onSelect(material);
              close();
            }}
          >
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <div className="w-4 h-5 bg-muted-foreground/30 rounded-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{material.name}</span>
                {material.categoryName && (
                  <Badge className="bg-muted text-muted-foreground text-xs">
                    {material.categoryName}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{material.unitOfMeasure}</p>
              {material.description && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {material.description}
                </p>
              )}
            </div>
          </button>
        ))}
        {materials.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">No materials found</div>
        )}
      </div>
    </>
  );

  /* ─── Desktop: absolute dropdown ─── */
  if (!isMobile) {
    return (
      <div
        ref={popupRef}
        className={cn(
          positionClassName ?? 'absolute left-0 top-full mt-1 z-50',
          'w-[897px] max-w-[calc(100vw-160px)] max-h-[414px] bg-card border border-border rounded-xl shadow-xl flex flex-col overflow-hidden',
        )}
      >
        {panelContent}
      </div>
    );
  }

  /* ─── Mobile: full-width bottom sheet ─── */
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={(e) => {
          e.stopPropagation();
          close();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
        }}
        role="presentation"
      />
      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 max-h-[80vh] bg-card rounded-t-2xl z-50 pb-safe flex flex-col overflow-hidden">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-2 shrink-0" />
        {panelContent}
        <div className="px-4 pb-4 pt-2 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            className="w-full py-2.5 text-sm font-medium text-muted-foreground bg-muted rounded-xl"
          >
            {t('response.cancel')}
          </button>
        </div>
      </div>
    </>
  );
}
