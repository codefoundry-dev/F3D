import type { VendorListItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Button, Spinner, cn } from '@forethread/ui-components';
import CrossIcon from '@forethread/ui-components/assets/icons/cross.svg?react';
import FilterIcon from '@forethread/ui-components/assets/icons/filter.svg?react';
import InfoIcon from '@forethread/ui-components/assets/icons/info.svg?react';
import SearchIcon from '@forethread/ui-components/assets/icons/search.svg?react';
import { useMemo, useState } from 'react';

interface SelectVendorsCardProps {
  vendors: VendorListItem[];
  selectedIds: string[];
  onToggle: (vendorId: string, selected: boolean) => void;
  onSelectAll: (vendorIds: string[]) => void;
  onRemoveAll: () => void;
  isLoading?: boolean;
  error?: string;
}

function vendorInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function VendorAvatar({ name }: { name: string }) {
  return (
    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
      {vendorInitials(name)}
    </div>
  );
}

/**
 * Step 1 — "Select Vendors" card (Figma 5.05): searchable vendor table
 * (name / location / category / add) beside the selected-vendors panel with
 * "Remove all" and the at-least-one hint.
 */
export function SelectVendorsCard({
  vendors,
  selectedIds,
  onToggle,
  onSelectAll,
  onRemoveAll,
  isLoading = false,
  error,
}: SelectVendorsCardProps) {
  const { t } = useTranslation('rfqs');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const vendor of vendors) for (const c of vendor.categories) set.add(c);
    return [...set].sort();
  }, [vendors]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return vendors.filter((vendor) => {
      if (query && !vendor.companyName.toLowerCase().includes(query)) return false;
      if (categoryFilter && !vendor.categories.includes(categoryFilter)) return false;
      return true;
    });
  }, [vendors, search, categoryFilter]);

  const selectedVendors = useMemo(
    () => vendors.filter((vendor) => selectedIds.includes(vendor.companyId)),
    [vendors, selectedIds],
  );

  const locationOf = (vendor: VendorListItem) => vendor.specialisations[0] ?? '—';
  const categoryOf = (vendor: VendorListItem) => vendor.categories.join(', ') || '—';

  return (
    <section className="bg-card rounded-lg border border-border p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground leading-[22px]">
          {t('create.vendors.cardTitle')}
        </h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {t('create.vendors.cardSubtitle')}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* ── Vendor table ── */}
        <div className="flex-1 min-w-0 rounded-lg border border-border flex flex-col">
          <div className="flex items-center gap-3 p-3">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('create.vendors.searchPlaceholder')}
                className="w-full h-10 rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40"
                data-testid="vendor-search"
              />
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setFilterOpen((p) => !p)}
                className={cn(
                  'flex items-center gap-1.5 h-10 px-3 text-sm text-foreground border border-border rounded-lg hover:bg-accent',
                  categoryFilter && 'bg-accent',
                )}
              >
                <FilterIcon className="w-4 h-4" />
                {t('create.vendors.filter')}
              </button>
              {filterOpen && (
                <div className="absolute right-0 mt-1 w-56 max-h-64 overflow-y-auto bg-background border border-border rounded-lg shadow-lg z-30 p-1">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent"
                    onClick={() => {
                      setCategoryFilter(null);
                      setFilterOpen(false);
                    }}
                  >
                    {t('create.vendors.allCategories')}
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent',
                        categoryFilter === category && 'bg-accent font-medium',
                      )}
                      onClick={() => {
                        setCategoryFilter(category);
                        setFilterOpen(false);
                      }}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              type="button"
              size="md"
              onClick={() => onSelectAll(filtered.map((vendor) => vendor.companyId))}
              data-testid="vendor-add-all"
            >
              {t('create.vendors.addAll')}
            </Button>
          </div>

          {categoryFilter && (
            <div className="flex items-center gap-2 px-3 pb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-muted text-foreground rounded-full">
                {categoryFilter}
                <button
                  type="button"
                  onClick={() => setCategoryFilter(null)}
                  className="hover:text-destructive"
                  aria-label={t('create.vendors.clearFilter')}
                >
                  <CrossIcon className="w-2.5 h-2.5" />
                </button>
              </span>
            </div>
          )}

          <div className="overflow-y-auto max-h-[360px] border-t border-border">
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/50">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="font-medium py-2.5 px-3">{t('create.vendors.colName')}</th>
                    <th className="font-medium py-2.5 px-3">{t('create.vendors.colLocation')}</th>
                    <th className="font-medium py-2.5 px-3">{t('create.vendors.colCategory')}</th>
                    <th className="font-medium py-2.5 px-3 w-20">{t('create.vendors.colAction')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((vendor) => {
                    const selected = selectedIds.includes(vendor.companyId);
                    return (
                      <tr key={vendor.id} className="border-t border-border">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <VendorAvatar name={vendor.companyName} />
                            <span className="font-medium text-foreground truncate">
                              {vendor.companyName}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">{locationOf(vendor)}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{categoryOf(vendor)}</td>
                        <td className="py-2.5 px-3">
                          <Button
                            type="button"
                            size="sm"
                            variant={selected ? 'outline' : 'primary'}
                            onClick={() => onToggle(vendor.companyId, !selected)}
                            data-testid={`vendor-toggle-${vendor.companyId}`}
                          >
                            {selected ? t('create.vendors.added') : t('create.vendors.add')}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground">
                        {t('create.vendors.noVendors')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Selected vendors panel ── */}
        <div className="w-full lg:w-72 shrink-0 rounded-lg border border-border flex flex-col">
          <div className="flex items-start justify-between p-3 border-b border-border">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {t('create.vendors.selectedTitle')}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('create.vendors.selectedCount', { count: selectedIds.length })}
              </p>
            </div>
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={onRemoveAll}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                data-testid="vendor-remove-all"
              >
                {t('create.vendors.removeAll')}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto max-h-[360px] p-2 space-y-1.5">
            {selectedVendors.length === 0 ? (
              <div className="flex items-start gap-2 p-3 text-xs text-muted-foreground">
                <InfoIcon className="w-4 h-4 shrink-0 mt-0.5" />
                {error ? (
                  <span className="text-destructive">{error}</span>
                ) : (
                  t('create.vendors.selectAtLeastOne')
                )}
              </div>
            ) : (
              selectedVendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <VendorAvatar name={vendor.companyName} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {vendor.companyName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{locationOf(vendor)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggle(vendor.companyId, false)}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    aria-label={t('create.vendors.remove', { name: vendor.companyName })}
                  >
                    <CrossIcon className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
