import type { RfqAvailabilityResult } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Button, Spinner, cn } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import CrossIcon from '@forethread/ui-components/assets/icons/cross.svg?react';
import { useMemo } from 'react';

import type { WizardLineItem } from './wizard-types';

/** One coverage allocation: a line item drawn from one vendor's bulk order. */
export interface CoverageAllocation {
  lineKey: string;
  vendorId: string;
  bulkOrderLineItemId: string;
  quantity: number;
}

export type AllocationMap = Map<string, Map<string, CoverageAllocation>>;

/** Best (largest remaining) bulk-order match of one vendor for one line. */
export interface VendorCellMatch {
  bulkOrderLineItemId: string;
  qtyRemaining: number;
  expirationDate: string | null;
}

interface StepAvailabilityProps {
  items: WizardLineItem[];
  availability: RfqAvailabilityResult | undefined;
  isLoading: boolean;
  allocations: AllocationMap;
  onAllocationsChange: (allocations: AllocationMap) => void;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Index availability matches: lineIndex → vendorId → best match. */
export function buildMatchIndex(
  availability: RfqAvailabilityResult | undefined,
): Map<number, Map<string, VendorCellMatch>> {
  const index = new Map<number, Map<string, VendorCellMatch>>();
  if (!availability) return index;
  for (const item of availability.items) {
    const byVendor = new Map<string, VendorCellMatch>();
    for (const match of item.matches) {
      const existing = byVendor.get(match.vendorId);
      if (!existing || match.qtyRemaining > existing.qtyRemaining) {
        byVendor.set(match.vendorId, {
          bulkOrderLineItemId: match.bulkOrderLineItemId,
          qtyRemaining: match.qtyRemaining,
          expirationDate: match.expirationDate ?? null,
        });
      }
    }
    index.set(item.index, byVendor);
  }
  return index;
}

/** Remaining requested quantity of a line after its current allocations. */
export function remainingQty(item: WizardLineItem, allocations: AllocationMap): number {
  const byVendor = allocations.get(item.key);
  if (!byVendor) return item.quantity;
  let covered = 0;
  for (const allocation of byVendor.values()) covered += allocation.quantity;
  return Math.max(0, item.quantity - covered);
}

/**
 * Step 3 — "Check Availability" (Figma 5.05): requested vs bulk-order coverage.
 * The first five columns are read-only ("all cells till this are lock"); each
 * BO-vendor cell offers Cover / Cancel with an adjustable covered qty
 * ("Can change qty/or cover\ignore"), plus per-vendor cover-all checkboxes and
 * the global "Cover all" action.
 */
export function StepAvailability({
  items,
  availability,
  isLoading,
  allocations,
  onAllocationsChange,
}: StepAvailabilityProps) {
  const { t } = useTranslation('rfqs');

  const matchIndex = useMemo(() => buildMatchIndex(availability), [availability]);
  const vendors = availability?.vendors ?? [];

  const setAllocation = (
    lineKey: string,
    vendorId: string,
    allocation: CoverageAllocation | null,
  ) => {
    const next: AllocationMap = new Map(
      [...allocations.entries()].map(([key, value]) => [key, new Map(value)]),
    );
    let byVendor = next.get(lineKey);
    if (!byVendor) {
      byVendor = new Map();
      next.set(lineKey, byVendor);
    }
    if (allocation) byVendor.set(vendorId, allocation);
    else byVendor.delete(vendorId);
    onAllocationsChange(next);
  };

  const coverCell = (item: WizardLineItem, itemIndex: number, vendorId: string) => {
    const match = matchIndex.get(itemIndex)?.get(vendorId);
    if (!match) return;
    const remaining = remainingQty(item, allocations);
    const quantity = Math.min(match.qtyRemaining, remaining > 0 ? remaining : 0);
    if (quantity <= 0) return;
    setAllocation(item.key, vendorId, {
      lineKey: item.key,
      vendorId,
      bulkOrderLineItemId: match.bulkOrderLineItemId,
      quantity,
    });
  };

  /** Cover every line this vendor can serve (header checkbox). */
  const coverVendorColumn = (vendorId: string, cover: boolean) => {
    const next: AllocationMap = new Map(
      [...allocations.entries()].map(([key, value]) => [key, new Map(value)]),
    );
    items.forEach((item, itemIndex) => {
      let byVendor = next.get(item.key);
      if (!byVendor) {
        byVendor = new Map();
        next.set(item.key, byVendor);
      }
      if (!cover) {
        byVendor.delete(vendorId);
        return;
      }
      const match = matchIndex.get(itemIndex)?.get(vendorId);
      if (!match) return;
      let covered = 0;
      for (const [otherVendor, allocation] of byVendor) {
        if (otherVendor !== vendorId) covered += allocation.quantity;
      }
      const quantity = Math.min(match.qtyRemaining, Math.max(0, item.quantity - covered));
      if (quantity > 0) {
        byVendor.set(vendorId, {
          lineKey: item.key,
          vendorId,
          bulkOrderLineItemId: match.bulkOrderLineItemId,
          quantity,
        });
      }
    });
    onAllocationsChange(next);
  };

  /** "Cover all": greedily cover every line from the vendor columns, left to right. */
  const coverAll = () => {
    const next: AllocationMap = new Map();
    items.forEach((item, itemIndex) => {
      const byVendor = new Map<string, CoverageAllocation>();
      let remaining = item.quantity;
      for (const vendor of vendors) {
        if (remaining <= 0) break;
        const match = matchIndex.get(itemIndex)?.get(vendor.vendorId);
        if (!match || match.qtyRemaining <= 0) continue;
        const quantity = Math.min(match.qtyRemaining, remaining);
        byVendor.set(vendor.vendorId, {
          lineKey: item.key,
          vendorId: vendor.vendorId,
          bulkOrderLineItemId: match.bulkOrderLineItemId,
          quantity,
        });
        remaining -= quantity;
      }
      if (byVendor.size > 0) next.set(item.key, byVendor);
    });
    onAllocationsChange(next);
  };

  const vendorFullyCovers = (vendorId: string) =>
    items.length > 0 &&
    items.every((item, itemIndex) => {
      const match = matchIndex.get(itemIndex)?.get(vendorId);
      if (!match) return false;
      return Boolean(allocations.get(item.key)?.get(vendorId));
    });

  const coveredLineCount = items.filter((item) => (allocations.get(item.key)?.size ?? 0) > 0).length;
  const totalQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const anyCoverage = vendors.length > 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <Spinner />
        <p className="text-sm text-muted-foreground">{t('create.availability.checking')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {anyCoverage && (
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold text-foreground" data-testid="covered-count">
            {coveredLineCount > 0
              ? t('create.availability.lineItemsSelected', { count: coveredLineCount })
              : ' '}
          </p>
          <Button type="button" size="md" onClick={coverAll} data-testid="cover-all">
            {t('create.availability.coverAll')}
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-x-auto bg-card">
        <table className="w-full text-sm min-w-[1000px]" data-testid="availability-table">
          <thead>
            <tr className="text-left text-xs text-muted-foreground bg-muted/40">
              <th className="font-medium py-2.5 px-3">{t('create.availability.colLineItemId')}</th>
              <th className="font-medium py-2.5 px-3">{t('create.availability.colMaterialName')}</th>
              <th className="font-medium py-2.5 px-3">{t('create.availability.colUom')}</th>
              <th className="font-medium py-2.5 px-3">{t('create.availability.colRequestedQty')}</th>
              <th className="font-medium py-2.5 px-3">{t('create.availability.colRemainingQty')}</th>
              {vendors.map((vendor) => {
                const expirations = items
                  .map((_, itemIndex) => matchIndex.get(itemIndex)?.get(vendor.vendorId)?.expirationDate)
                  .filter(Boolean) as string[];
                const earliest = expirations.sort()[0];
                return (
                  <th key={vendor.vendorId} className="font-medium py-2 px-3 min-w-[170px]">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-foreground">{vendor.vendorName}</div>
                        <div className="font-normal">
                          {earliest
                            ? formatDate(earliest)
                            : t('create.availability.expirationDate')}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        className="mt-0.5 w-4 h-4 accent-foreground cursor-pointer"
                        checked={vendorFullyCovers(vendor.vendorId)}
                        onChange={(e) => coverVendorColumn(vendor.vendorId, e.target.checked)}
                        aria-label={t('create.availability.coverAllFrom', {
                          vendor: vendor.vendorName,
                        })}
                        data-testid={`cover-vendor-${vendor.vendorId}`}
                      />
                    </div>
                  </th>
                );
              })}
              {vendors.length === 0 && (
                <th className="font-medium py-2.5 px-3">{t('create.availability.colCoverage')}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((item, itemIndex) => {
              const remaining = remainingQty(item, allocations);
              return (
                <tr key={item.key} className="border-t border-border" data-testid={`availability-row-${item.key}`}>
                  <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                    {item.serverId ? item.serverId.slice(0, 8).toUpperCase() : '—'}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-foreground">{item.materialName}</td>
                  <td className="py-2.5 px-3 text-muted-foreground">{item.uom}</td>
                  <td className="py-2.5 px-3">{item.quantity}</td>
                  <td className="py-2.5 px-3" data-testid={`remaining-${item.key}`}>
                    {remaining}
                  </td>
                  {vendors.map((vendor) => {
                    const match = matchIndex.get(itemIndex)?.get(vendor.vendorId);
                    const allocation = allocations.get(item.key)?.get(vendor.vendorId);
                    if (!match || match.qtyRemaining <= 0) {
                      return (
                        <td key={vendor.vendorId} className="py-2.5 px-3 text-muted-foreground">
                          0
                        </td>
                      );
                    }
                    if (allocation) {
                      return (
                        <td key={vendor.vendorId} className="p-0">
                          <div className="flex items-center justify-between gap-2 bg-[#D6F5DE] px-3 py-2 h-full min-h-[42px]">
                            <input
                              inputMode="numeric"
                              value={allocation.quantity}
                              onChange={(e) => {
                                const raw = parseInt(e.target.value, 10) || 0;
                                const bounded = Math.max(0, Math.min(raw, match.qtyRemaining));
                                setAllocation(item.key, vendor.vendorId, {
                                  ...allocation,
                                  quantity: bounded,
                                });
                              }}
                              className="w-14 bg-transparent text-sm text-foreground focus:outline-none"
                              aria-label={t('create.availability.coveredQty')}
                              data-testid={`covered-qty-${item.key}-${vendor.vendorId}`}
                            />
                            <button
                              type="button"
                              onClick={() => setAllocation(item.key, vendor.vendorId, null)}
                              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-foreground bg-background border border-border rounded-full hover:bg-accent transition-colors"
                              data-testid={`cancel-cover-${item.key}-${vendor.vendorId}`}
                            >
                              {t('create.availability.cancel')}
                              <CrossIcon className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td key={vendor.vendorId} className="py-2.5 px-3">
                        <div className="flex items-center justify-between gap-2">
                          <span>{match.qtyRemaining}</span>
                          <button
                            type="button"
                            onClick={() => coverCell(item, itemIndex, vendor.vendorId)}
                            disabled={remaining <= 0}
                            className={cn(
                              'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-foreground border border-border rounded-full transition-colors',
                              remaining <= 0
                                ? 'opacity-40 cursor-not-allowed'
                                : 'hover:bg-accent',
                            )}
                            data-testid={`cover-${item.key}-${vendor.vendorId}`}
                          >
                            {t('create.availability.cover')}
                            <CheckCircleIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    );
                  })}
                  {vendors.length === 0 && (
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {t('create.availability.noCoverage')}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex items-center gap-8 border-t border-border px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t('create.lineItems.totalItems')}</span>
            <span className="font-semibold text-foreground">{items.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t('create.lineItems.totalQty')}</span>
            <span className="font-semibold text-foreground">{totalQty}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
