import type { QuoteComparisonRow } from '@forethread/api-client';

/**
 * Pure helpers backing the split-award action in the quote comparison table
 * (US 5.19 / PRD §4.5.4). Kept side-effect-free so the cross-vendor quantity
 * maths can be unit-tested without rendering the table.
 */

export interface SplitAllocation {
  quoteResponseId: string;
  quoteLineItemId: string;
  approvedQuantity: number;
  rfqLineItemId: string;
}

/**
 * The quantity to award for a cell: the typed order quantity, falling back to
 * the full quoted quantity when blank or out of range (≤0 or > quoted).
 */
function resolveQty(orderQuantities: Map<string, string>, quoteLineItemId: string, quoted: number) {
  const raw = orderQuantities.get(quoteLineItemId) ?? '';
  const num = Number(raw);
  const invalid = raw !== '' && (!Number.isFinite(num) || num < 0 || num > quoted);
  return invalid || raw === '' ? quoted : num;
}

/**
 * Turn the set of selected quote-line ids into award allocations, reading the
 * vendor / quote / RFQ line from the comparison grid and the per-cell order qty.
 */
export function buildSplitAllocations(
  selectedLineItemIds: Iterable<string>,
  rows: QuoteComparisonRow[],
  orderQuantities: Map<string, string>,
): SplitAllocation[] {
  const allocations: SplitAllocation[] = [];
  for (const lineItemId of selectedLineItemIds) {
    let found: { cell: QuoteComparisonRow['cells'][number]; row: QuoteComparisonRow } | null = null;
    for (const row of rows) {
      const cell = row.cells.find((c) => c.quoteLineItemId === lineItemId);
      if (cell) {
        found = { cell, row };
        break;
      }
    }
    if (!found?.cell.quoteLineItemId) continue;
    const qty = resolveQty(orderQuantities, found.cell.quoteLineItemId, found.cell.quotedQuantity ?? 0);
    if (qty > 0) {
      allocations.push({
        quoteResponseId: found.cell.quoteResponseId,
        quoteLineItemId: found.cell.quoteLineItemId,
        approvedQuantity: qty,
        rfqLineItemId: found.row.rfqLineItemId,
      });
    }
  }
  return allocations;
}

/**
 * RFQ lines whose total approved quantity across vendors exceeds the requested
 * quantity (US 5.19 AC 4) — these block the split award.
 */
export function findOverAllocatedLineIds(
  allocations: SplitAllocation[],
  rows: QuoteComparisonRow[],
): Set<string> {
  const sumByLine = new Map<string, number>();
  for (const a of allocations) {
    sumByLine.set(a.rfqLineItemId, (sumByLine.get(a.rfqLineItemId) ?? 0) + a.approvedQuantity);
  }
  const over = new Set<string>();
  for (const row of rows) {
    if ((sumByLine.get(row.rfqLineItemId) ?? 0) > row.quantity) over.add(row.rfqLineItemId);
  }
  return over;
}
