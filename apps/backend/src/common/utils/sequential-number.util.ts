import type { PrismaClient } from '@prisma/client';

/** Maps each supported table to the column holding its `PREFIX-NNNNN` number. */
const NUMBER_FIELD = {
  rfq: 'rfqNumber',
  purchaseOrder: 'poNumber',
  bulkOrder: 'bulkOrderNumber',
  bom: 'bomNumber',
} as const;

type NumberedTable = keyof typeof NUMBER_FIELD;

/**
 * Generate the next sequential number for a given prefix and table, e.g.
 * `RFQ-00001`, `PO-00042`.
 *
 * The next value is derived from the highest EXISTING number for the company
 * (max + 1), NOT a row count. A count-based guess (`count + 1`) breaks as soon
 * as the count diverges from the high-water mark — which happens whenever:
 *   - a split award inserts child POs (`PO-00042-1`, `PO-00042-2`), or
 *   - non-canonical numbers exist (`PO-THRESH-…`, `PO-SEND-…`, imported rows).
 * Because `po_number` / `rfq_number` / `bulk_order_number` are unique, a drifted
 * count can land on an existing number and throw a unique-constraint error
 * (surfacing as an HTTP 500). Taking `max + 1` over the canonical numbers avoids
 * that and keeps the sequence dense.
 *
 * Only canonical `PREFIX-NNNNN` values count toward the maximum; suffixed
 * children (`-1`, `-2`) and non-numeric variants are ignored.
 *
 * NOTE: numbering is scoped per company (unchanged). The number columns are
 * globally unique, so this remains single-contractor-safe; cross-company
 * sequencing is out of scope for this fix.
 */
export async function nextSequentialNumber(
  prisma: PrismaClient,
  table: NumberedTable,
  prefix: 'RFQ' | 'PO' | 'BULK' | 'BOM',
  companyId: string,
): Promise<string> {
  const field = NUMBER_FIELD[table];

  const rows = (await (
    prisma[table] as unknown as {
      findMany: (args: unknown) => Promise<Array<Record<string, string | null>>>;
    }
  ).findMany({
    where: { companyId },
    select: { [field]: true },
  })) as Array<Record<string, string | null>>;

  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const row of rows) {
    const value = row[field];
    const match = value ? pattern.exec(value) : null;
    if (match) {
      const n = Number.parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }

  return `${prefix}-${String(max + 1).padStart(5, '0')}`;
}
