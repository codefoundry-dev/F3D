import { useTranslation } from '@forethread/i18n';
import {
  type CatalogueExtractionResult,
  type CatalogueLineItem,
  isCatalogueExtractionResult,
} from '@forethread/shared-types/client';
import { Button, Input, TablePagination, useDebounce } from '@forethread/ui-components';
import { useCallback, useMemo, useState } from 'react';

export interface CatalogueReviewTableProps {
  /** Current edited result, in canonical catalogue shape or anything coercible. */
  value: Record<string, unknown> | null;
  /** Disable inline editing / delete while not in edit mode. */
  readOnly?: boolean;
  /**
   * Fires when a row is edited or deleted. The parent holds the canonical
   * result so we never deep-clone the (potentially 50k-row) array on render.
   */
  onChange: (next: CatalogueExtractionResult) => void;
}

const PAGE_SIZE = 25;

function toCatalogue(value: Record<string, unknown> | null): CatalogueExtractionResult {
  if (isCatalogueExtractionResult(value)) {
    return value;
  }
  return { sourceName: null, items: [], notes: null };
}

/**
 * Review surface for an extracted CATALOGUE (FOR-228). Handles tens of
 * thousands of rows: the search box is debounced and the table only renders one
 * page of rows at a time (client-side pagination over the in-memory array).
 * Edits to `mainCategory` and per-row deletes update the in-memory result
 * immutably at a single index — no whole-array deep clone per keystroke. The
 * per-row `confidence` field is intentionally never displayed.
 */
export function CatalogueReviewTable({ value, readOnly, onChange }: CatalogueReviewTableProps) {
  const { t } = useTranslation(['materialCatalogue']);
  const catalogue = useMemo(() => toCatalogue(value), [value]);
  const items = catalogue.items;

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  // Filter by name / sku. Carries the original array index so edits and deletes
  // target the canonical position, not the filtered/paged one.
  const filtered = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    const withIndex = items.map((item, index) => ({ item, index }));
    if (!needle) return withIndex;
    return withIndex.filter(
      ({ item }) =>
        item.name.toLowerCase().includes(needle) ||
        (item.sku ?? '').toLowerCase().includes(needle),
    );
  }, [items, debouncedSearch]);

  const total = filtered.length;
  const start = (page - 1) * PAGE_SIZE;
  const pageRows = useMemo(
    () => filtered.slice(start, start + PAGE_SIZE),
    [filtered, start],
  );

  const onItemChange = useCallback(
    (index: number, patch: Partial<CatalogueLineItem>) => {
      onChange({
        ...catalogue,
        items: items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
      });
    },
    [catalogue, items, onChange],
  );

  const onRemoveRow = useCallback(
    (index: number) => {
      onChange({ ...catalogue, items: items.filter((_, i) => i !== index) });
    },
    [catalogue, items, onChange],
  );

  const onSearchChange = useCallback((next: string) => {
    setSearch(next);
    setPage(1);
  }, []);

  return (
    <section
      aria-labelledby="catalogue-review-title"
      data-testid="catalogue-review-table"
      className="space-y-3"
    >
      <h3 id="catalogue-review-title" className="sr-only">
        {t('review.tableTitle')}
      </h3>

      <div className="flex items-center justify-between gap-3">
        <Input
          aria-label={t('review.searchLabel')}
          placeholder={t('review.searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          data-testid="catalogue-search"
          className="max-w-xs"
        />
        <p className="text-sm text-muted-foreground" data-testid="catalogue-count">
          {t('review.itemCount', { count: items.length })}
        </p>
      </div>

      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-sm" data-testid="catalogue-items-table">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="text-left p-2 w-[24%]">{t('review.columns.name')}</th>
              <th className="text-left p-2 w-[14%]">{t('review.columns.sku')}</th>
              <th className="text-left p-2 w-[14%]">{t('review.columns.brand')}</th>
              <th className="text-left p-2 w-[8%]">{t('review.columns.uom')}</th>
              <th className="text-left p-2 w-[14%]">{t('review.columns.upc')}</th>
              <th className="text-left p-2 w-[18%]">{t('review.columns.mainCategory')}</th>
              <th className="w-10" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-4 text-center text-muted-foreground">
                  {t('review.noMatches')}
                </td>
              </tr>
            ) : (
              pageRows.map(({ item, index }) => (
                <tr key={index} data-testid={`catalogue-row-${index}`} className="align-top">
                  <td className="p-2 truncate" title={item.name}>
                    {item.name}
                  </td>
                  <td className="p-2 truncate" title={item.sku ?? ''}>
                    {item.sku ?? '—'}
                  </td>
                  <td className="p-2 truncate" title={item.brand ?? ''}>
                    {item.brand ?? '—'}
                  </td>
                  <td className="p-2">{item.uom ?? '—'}</td>
                  <td className="p-2 truncate" title={item.upc ?? ''}>
                    {item.upc ?? '—'}
                  </td>
                  <td className="p-1">
                    <Input
                      aria-label={t('review.columns.mainCategory')}
                      value={item.mainCategory ?? ''}
                      readOnly={readOnly}
                      onChange={(e) =>
                        onItemChange(index, { mainCategory: e.target.value || null })
                      }
                    />
                  </td>
                  <td className="p-1 text-right">
                    {!readOnly ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        iconOnly
                        aria-label={t('review.actions.removeRow')}
                        data-testid={`catalogue-remove-row-${index}`}
                        onClick={() => onRemoveRow(index)}
                      >
                        ×
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={page}
        totalItems={total}
        pageSize={PAGE_SIZE}
        pageSizeOptions={[PAGE_SIZE]}
        onPageChange={setPage}
      />
    </section>
  );
}
