import type { RfqAvailabilityResult } from '@forethread/api-client';

import type { WizardLineItem } from './wizard-types';

/** One coverage allocation: a line item drawn from one vendor's bulk order. */
export interface CoverageAllocation {
  lineKey: string;
  vendorId: string;
  bulkOrderLineItemId: string;
  quantity: number;
}

/** lineKey → vendorId → allocation. */
export type AllocationMap = Map<string, Map<string, CoverageAllocation>>;

/** Best (largest remaining) bulk-order match of one vendor for one line. */
export interface VendorCellMatch {
  bulkOrderLineItemId: string;
  qtyRemaining: number;
  expirationDate: string | null;
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
 * Greedily cover every line from its available bulk orders. For each line the
 * requested quantity is drawn from the vendors with the most remaining capacity
 * first, until the line is fully covered or no capacity is left. Used to
 * auto-cover available materials the moment an availability check returns, so
 * buyers don't have to click "Cover" on each row (they can still Cancel).
 */
export function autoCoverAllocations(
  items: WizardLineItem[],
  availability: RfqAvailabilityResult | undefined,
): AllocationMap {
  const allocations: AllocationMap = new Map();
  if (!availability) return allocations;
  const matchIndex = buildMatchIndex(availability);
  items.forEach((item, index) => {
    const byVendor = matchIndex.get(index);
    if (!byVendor) return;
    const matches = [...byVendor.entries()]
      .filter(([, match]) => match.qtyRemaining > 0)
      .sort(([, a], [, b]) => b.qtyRemaining - a.qtyRemaining);
    let remaining = item.quantity;
    for (const [vendorId, match] of matches) {
      if (remaining <= 0) break;
      const quantity = Math.min(match.qtyRemaining, remaining);
      if (quantity <= 0) continue;
      let lineAllocations = allocations.get(item.key);
      if (!lineAllocations) {
        lineAllocations = new Map();
        allocations.set(item.key, lineAllocations);
      }
      lineAllocations.set(vendorId, {
        lineKey: item.key,
        vendorId,
        bulkOrderLineItemId: match.bulkOrderLineItemId,
        quantity,
      });
      remaining -= quantity;
    }
  });
  return allocations;
}
