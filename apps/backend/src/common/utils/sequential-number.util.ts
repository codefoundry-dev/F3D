import type { PrismaClient } from '@prisma/client';

/**
 * Generate the next sequential number for a given prefix and table.
 *
 * Counts existing records scoped to a company and produces a zero-padded
 * sequential identifier, e.g. `RFQ-00001`, `PO-00042`.
 */
export async function nextSequentialNumber(
  prisma: PrismaClient,
  table: 'rfq' | 'purchaseOrder' | 'bulkOrder',
  prefix: 'RFQ' | 'PO' | 'BULK',
  companyId: string,
): Promise<string> {
  const count = await (prisma[table] as { count: (args: unknown) => Promise<number> }).count({
    where: { companyId },
  });
  const seq = String(count + 1).padStart(5, '0');
  return `${prefix}-${seq}`;
}
