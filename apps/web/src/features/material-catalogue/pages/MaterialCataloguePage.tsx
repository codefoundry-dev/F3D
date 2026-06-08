import { useTranslation } from '@forethread/i18n';
import { Button, Input, TablePagination, useDebounce } from '@forethread/ui-components';
import { useMemo, useState } from 'react';

import { CatalogueImportModal } from '../components/CatalogueImportModal';
import { useMaterials } from '../hooks/useMaterials';

const PAGE_SIZE = 25;

/**
 * Material catalogue (FOR-228). Searchable, paginated list of the catalogue
 * (GET /v1/materials) plus the upload → review → import flow behind an
 * "Import catalogue" button.
 */
export default function MaterialCataloguePage() {
  const { t } = useTranslation(['materialCatalogue']);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 400);

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch.trim() || undefined,
    }),
    [page, debouncedSearch],
  );

  const { data, isLoading, isError } = useMaterials(params);
  const items = data?.items ?? [];
  const total = data?.meta.total ?? 0;

  const isEmpty = !isLoading && !isError && items.length === 0;

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('page.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('page.subtitle')}</p>
        </div>
        <Button onClick={() => setIsImportOpen(true)} data-testid="open-import">
          {t('page.importButton')}
        </Button>
      </header>

      <Input
        aria-label={t('page.searchLabel')}
        placeholder={t('page.searchPlaceholder')}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        data-testid="catalogue-list-search"
        className="max-w-sm"
      />

      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-sm" data-testid="catalogue-list-table">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="text-left p-3 w-[30%]">{t('page.columns.name')}</th>
              <th className="text-left p-3 w-[16%]">{t('page.columns.sku')}</th>
              <th className="text-left p-3 w-[16%]">{t('page.columns.brand')}</th>
              <th className="text-left p-3 w-[22%]">{t('page.columns.category')}</th>
              <th className="text-left p-3 w-[16%]">{t('page.columns.uom')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  <span role="status">{t('page.loading')}</span>
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-destructive">
                  <span role="alert">{t('page.error')}</span>
                </td>
              </tr>
            ) : isEmpty ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  {debouncedSearch.trim() ? t('page.noResults') : t('page.empty')}
                </td>
              </tr>
            ) : (
              items.map((material) => (
                <tr
                  key={material.id}
                  data-testid={`catalogue-list-row-${material.id}`}
                  className="border-t border-border"
                >
                  <td className="p-3 truncate" title={material.name}>
                    {material.name}
                  </td>
                  <td className="p-3 truncate">{material.sku ?? '—'}</td>
                  <td className="p-3 truncate">{material.brand ?? '—'}</td>
                  <td className="p-3 truncate">{material.categoryName ?? '—'}</td>
                  <td className="p-3">{material.uom ?? material.unitOfMeasure ?? '—'}</td>
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

      {isImportOpen ? (
        <CatalogueImportModal
          onClose={() => setIsImportOpen(false)}
          onImported={() => setPage(1)}
        />
      ) : null}
    </div>
  );
}
