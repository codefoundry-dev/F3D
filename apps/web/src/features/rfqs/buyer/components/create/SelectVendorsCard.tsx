import { UNCATEGORISED, type ResolvedVendor, type VendorListItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { VendorCategory } from '@forethread/shared-types/client';
import { Button, Checkbox, Spinner, cn, formatEnum, ScrollTable } from '@forethread/ui-components';
import ChevronDownIcon from '@forethread/ui-components/assets/icons/chevron-down.svg?react';
import ChevronRightIcon from '@forethread/ui-components/assets/icons/chevron-right.svg?react';
import CrossIcon from '@forethread/ui-components/assets/icons/cross.svg?react';
import FilterIcon from '@forethread/ui-components/assets/icons/filter.svg?react';
import InfoIcon from '@forethread/ui-components/assets/icons/info.svg?react';
import SearchIcon from '@forethread/ui-components/assets/icons/search.svg?react';
import { useMemo, useState } from 'react';

import { resolvedToListItem } from '../../hooks/useVendorPicker';

import { TABLE_BODY_ROW, TABLE_HEADER_ROW, TABLE_TH } from './tableStyles';

/** The selection is rep-aware (US 5.05): `vendorIds` are the companies on the
 *  RFQ; `repIds` are the chosen sales-rep user ids. A vendor with reps is on the
 *  RFQ iff ≥1 of its reps is selected; a vendor with no reps can still be added
 *  at the company level (it carries no repIds and falls back to the company
 *  email on send). */
export interface VendorSelection {
  vendorIds: string[];
  repIds: string[];
}

interface SelectVendorsCardProps {
  /** The vendors to show in the table. When a category filter is active the
   *  parent supplies the server-filtered page; see {@link useVendorPicker}. */
  vendors: VendorListItem[];
  selectedVendorIds: string[];
  selectedRepIds: string[];
  onChange: (next: VendorSelection) => void;
  isLoading?: boolean;
  error?: string;
  /** Current category filter (a VendorCategory key or {@link UNCATEGORISED}). */
  categoryFilter: string | null;
  onCategoryFilterChange: (next: string | null) => void;
  search: string;
  onSearchChange: (next: string) => void;
  /** Resolves "every vendor matching the current filter" server-side. Returns
   *  summaries so vendors beyond the loaded page can still be rendered. */
  onAddAll: () => void;
  isAddingAll?: boolean;
  /** Selected vendors that are not in `vendors` — e.g. matched by Add All
   *  beyond the loaded page, or hidden by the current filter. Keeps the
   *  Selected panel honest instead of silently dropping them. */
  extraSelected?: ResolvedVendor[];
}

/** Every category, from the enum — never derived from the loaded page, or a
 *  category held only by an unloaded vendor would be unfilterable (ADR-0018). */
const CATEGORY_OPTIONS: string[] = [...Object.values(VendorCategory), UNCATEGORISED];

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

/** Deactivated reps receive no vendor-bound emails (CONTEXT.md), so they are
 *  never selectable — not individually, and not via "add all reps". They are
 *  still *rendered*, disabled, so the buyer can see why someone is missing
 *  rather than wondering where they went. */
const isSendable = (rep: { status: string }) => rep.status !== 'INACTIVE';

const repIdsOf = (vendor: VendorListItem): string[] =>
  (vendor.representatives ?? []).filter(isSendable).map((rep) => rep.id);

/**
 * "Select Vendors" block (Figma 5.05): a searchable vendor table where each
 * vendor expands to its sales reps. The buyer picks specific reps — only they
 * are emailed when the RFQ is sent — and multiple reps can be chosen per vendor.
 * Vendors without any reps can still be added at the company level (their
 * company contact email is used as the fallback recipient). Rendered inside a
 * WizardAccordion, so it carries no card chrome of its own.
 */
export function SelectVendorsCard({
  vendors,
  selectedVendorIds,
  selectedRepIds,
  onChange,
  isLoading = false,
  error,
  categoryFilter,
  onCategoryFilterChange,
  search,
  onSearchChange,
  onAddAll,
  isAddingAll = false,
  extraSelected = [],
}: SelectVendorsCardProps) {
  const { t } = useTranslation('rfqs');
  const [filterOpen, setFilterOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const repSet = useMemo(() => new Set(selectedRepIds), [selectedRepIds]);
  const vendorSet = useMemo(() => new Set(selectedVendorIds), [selectedVendorIds]);

  // Search and category are both applied server-side; the rows arrive filtered.
  const filtered = vendors;

  /** Selected vendors the current page can describe, plus stubs for the ones it
   *  cannot. Without the stubs, Add-All-ing 130 Electrical vendors would show
   *  100 in the panel and silently swallow the rest. */
  const selectedVendors = useMemo(() => {
    const onPage = vendors.filter((vendor) => vendorSet.has(vendor.companyId));
    const known = new Set(onPage.map((v) => v.companyId));
    const stubs = extraSelected
      .filter((v) => vendorSet.has(v.companyId) && !known.has(v.companyId))
      .map(resolvedToListItem);
    return [...onPage, ...stubs];
  }, [vendors, vendorSet, extraSelected]);

  /** The vendor's own claim about what it supplies. Descriptive only — it drives
   *  nothing (ADR-0018). It was previously rendered under a "Location" heading,
   *  which it has never been. */
  const declaredOf = (vendor: VendorListItem) => {
    const specialisation = vendor.specialisations[0];
    return specialisation ? formatEnum(specialisation) : '—';
  };
  /** The authoritative Vendor Category — this contractor's classification. */
  const categoryOf = (vendor: VendorListItem) =>
    vendor.categories.map(formatEnum).join(', ') || t('create.vendors.uncategorised');

  // ── Selection mutations (each emits the full next selection) ────────────────
  const selectedRepCountFor = (vendor: VendorListItem) =>
    repIdsOf(vendor).filter((id) => repSet.has(id)).length;

  const toggleRep = (vendor: VendorListItem, repId: string, on: boolean) => {
    const repIds = on
      ? [...new Set([...selectedRepIds, repId])]
      : selectedRepIds.filter((id) => id !== repId);
    const stillSelected = repIdsOf(vendor).some((id) => repIds.includes(id));
    const vendorIds = stillSelected
      ? [...new Set([...selectedVendorIds, vendor.companyId])]
      : selectedVendorIds.filter((id) => id !== vendor.companyId);
    onChange({ vendorIds, repIds });
  };

  const toggleAllReps = (vendor: VendorListItem, on: boolean) => {
    const ids = repIdsOf(vendor);
    const next = new Set(selectedRepIds);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    const vendorIds = on
      ? [...new Set([...selectedVendorIds, vendor.companyId])]
      : selectedVendorIds.filter((id) => id !== vendor.companyId);
    onChange({ vendorIds, repIds: [...next] });
  };

  /** No-rep vendor: toggle the company-level fallback directly. */
  const toggleCompany = (vendor: VendorListItem, on: boolean) => {
    const vendorIds = on
      ? [...new Set([...selectedVendorIds, vendor.companyId])]
      : selectedVendorIds.filter((id) => id !== vendor.companyId);
    onChange({ vendorIds, repIds: selectedRepIds });
  };

  const removeVendor = (vendor: VendorListItem) => {
    const ids = new Set(repIdsOf(vendor));
    onChange({
      vendorIds: selectedVendorIds.filter((id) => id !== vendor.companyId),
      repIds: selectedRepIds.filter((id) => !ids.has(id)),
    });
  };

  const removeAll = () => onChange({ vendorIds: [], repIds: [] });

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* ── Vendor table ── */}
      <div className="flex-1 min-w-0 rounded-lg border border-border flex flex-col">
        <div className="flex items-center gap-3 p-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('create.vendors.searchPlaceholder')}
              className="w-full h-10 max-md:h-11 rounded-lg border border-border bg-background pl-9 pr-3 text-base md:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40"
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
                    onCategoryFilterChange(null);
                    setFilterOpen(false);
                  }}
                >
                  {t('create.vendors.allCategories')}
                </button>
                {CATEGORY_OPTIONS.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent',
                      categoryFilter === category && 'bg-accent font-medium',
                      category === UNCATEGORISED && 'border-t border-border mt-1 pt-2 italic',
                    )}
                    onClick={() => {
                      onCategoryFilterChange(category);
                      setFilterOpen(false);
                    }}
                  >
                    {category === UNCATEGORISED
                      ? t('create.vendors.uncategorised')
                      : formatEnum(category)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            type="button"
            size="md"
            onClick={onAddAll}
            isLoading={isAddingAll}
            data-testid="vendor-add-all"
          >
            {categoryFilter ? t('create.vendors.addAllInCategory') : t('create.vendors.addAll')}
          </Button>
        </div>

        {categoryFilter && (
          <div className="flex items-center gap-2 px-3 pb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-muted text-foreground rounded-full">
              {categoryFilter === UNCATEGORISED
                ? t('create.vendors.uncategorised')
                : formatEnum(categoryFilter)}
              <button
                type="button"
                onClick={() => onCategoryFilterChange(null)}
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
            <ScrollTable>
              <table className="w-full text-sm">
                <thead className="bg-[color:color-mix(in_srgb,hsl(var(--muted))_50%,hsl(var(--card)))]">
                  <tr className={TABLE_HEADER_ROW}>
                    <th className={TABLE_TH}>{t('create.vendors.colName')}</th>
                    <th className={TABLE_TH}>{t('create.vendors.colDeclared')}</th>
                    <th className={TABLE_TH}>{t('create.vendors.colCategory')}</th>
                    <th className={cn(TABLE_TH, 'w-36')}>{t('create.vendors.colAction')}</th>
                  </tr>
                </thead>
                {filtered.map((vendor) => {
                  const reps = vendor.representatives ?? [];
                  const sendableCount = reps.filter(isSendable).length;
                  // A vendor whose reps are ALL deactivated behaves like a vendor
                  // with none: it falls back to the company contact email rather
                  // than offering an "add all reps" button that selects nobody.
                  const hasReps = sendableCount > 0;
                  /** Display-only: deactivated reps stay visible in the expander
                   *  so their absence from the selection is explained, not silent. */
                  const hasAnyReps = reps.length > 0;
                  const selectedCount = selectedRepCountFor(vendor);
                  const onRfq = vendorSet.has(vendor.companyId);
                  const isExpanded = expanded[vendor.companyId] ?? false;
                  const allRepsSelected = hasReps && selectedCount === sendableCount;

                  return (
                    <tbody key={vendor.id}>
                      <tr className={TABLE_BODY_ROW}>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {hasAnyReps ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpanded((prev) => ({
                                    ...prev,
                                    [vendor.companyId]: !isExpanded,
                                  }))
                                }
                                className="p-0.5 -ml-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                aria-label={t('create.vendors.toggleReps', {
                                  name: vendor.companyName,
                                })}
                                aria-expanded={isExpanded}
                                data-testid={`vendor-expand-${vendor.companyId}`}
                              >
                                {isExpanded ? (
                                  <ChevronDownIcon className="w-4 h-4" />
                                ) : (
                                  <ChevronRightIcon className="w-4 h-4" />
                                )}
                              </button>
                            ) : (
                              <span className="w-4 shrink-0" />
                            )}
                            <VendorAvatar name={vendor.companyName} />
                            <div className="min-w-0">
                              <span className="font-medium text-foreground truncate block">
                                {vendor.companyName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {hasReps
                                  ? selectedCount > 0
                                    ? t('create.vendors.repsSelected', { count: selectedCount })
                                    : t('create.vendors.repsAvailable', { count: sendableCount })
                                  : t('create.vendors.companyContact')}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">{declaredOf(vendor)}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{categoryOf(vendor)}</td>
                        <td className="py-2.5 px-3">
                          <Button
                            type="button"
                            size="sm"
                            variant={onRfq ? 'outline' : 'primary'}
                            onClick={() =>
                              hasReps
                                ? toggleAllReps(vendor, !allRepsSelected)
                                : toggleCompany(vendor, !onRfq)
                            }
                            className="w-full whitespace-nowrap"
                            data-testid={`vendor-toggle-${vendor.companyId}`}
                          >
                            {hasReps
                              ? allRepsSelected
                                ? t('create.vendors.added')
                                : t('create.vendors.addAllReps')
                              : onRfq
                                ? t('create.vendors.added')
                                : t('create.vendors.add')}
                          </Button>
                        </td>
                      </tr>

                      {hasAnyReps && isExpanded && (
                        <tr>
                          <td colSpan={4} className="bg-muted/30 px-3 py-2">
                            <div className="flex flex-col gap-1 pl-8">
                              {reps.map((rep) => {
                                const sendable = isSendable(rep);
                                return (
                                  <div
                                    key={rep.id}
                                    className={cn(
                                      'flex items-center gap-3 rounded-md px-2 py-1.5',
                                      sendable ? 'hover:bg-accent/60' : 'opacity-60',
                                    )}
                                    data-testid={`rep-row-${rep.id}`}
                                  >
                                    <Checkbox
                                      size="sm"
                                      checked={sendable && repSet.has(rep.id)}
                                      disabled={!sendable}
                                      onChange={(checked) => toggleRep(vendor, rep.id, checked)}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm text-foreground truncate">
                                        {rep.name}
                                        {rep.position && (
                                          <span className="text-muted-foreground ml-2">
                                            {rep.position}
                                          </span>
                                        )}
                                        {!sendable && (
                                          <span className="ml-2 text-xs text-muted-foreground italic">
                                            {t('create.vendors.repDeactivated')}
                                          </span>
                                        )}
                                      </p>
                                      <p className="text-xs text-muted-foreground truncate">
                                        {rep.email}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  );
                })}
                {filtered.length === 0 && (
                  <tbody>
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground">
                        {t('create.vendors.noVendors')}
                      </td>
                    </tr>
                  </tbody>
                )}
              </table>
            </ScrollTable>
          )}
        </div>
      </div>

      {/* ── Selected vendors panel ── */}
      <div className="w-full lg:w-80 shrink-0 rounded-lg border border-border flex flex-col">
        <div className="flex items-start justify-between p-3 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t('create.vendors.selectedTitle')}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('create.vendors.selectedCount', { count: selectedVendors.length })}
            </p>
          </div>
          {selectedVendors.length > 0 && (
            <button
              type="button"
              onClick={removeAll}
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
            selectedVendors.map((vendor) => {
              const selectedReps = (vendor.representatives ?? []).filter((rep) =>
                repSet.has(rep.id),
              );
              return (
                <div key={vendor.id} className="rounded-lg border border-border p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <VendorAvatar name={vendor.companyName} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {vendor.companyName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {declaredOf(vendor)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeVendor(vendor)}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      aria-label={t('create.vendors.remove', { name: vendor.companyName })}
                    >
                      <CrossIcon className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="mt-2 pl-11 space-y-1">
                    {selectedReps.length > 0 ? (
                      selectedReps.map((rep) => (
                        <div
                          key={rep.id}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="text-foreground truncate">{rep.name}</span>
                          <button
                            type="button"
                            onClick={() => toggleRep(vendor, rep.id, false)}
                            className="p-0.5 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                            aria-label={t('create.vendors.removeRep', { name: rep.name })}
                            data-testid={`rep-remove-${rep.id}`}
                          >
                            <CrossIcon className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        {t('create.vendors.allContacts')}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
