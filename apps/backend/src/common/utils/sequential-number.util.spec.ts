import type { PrismaClient } from '@prisma/client';

import { nextSequentialNumber } from './sequential-number.util';

/**
 * Build a stub Prisma whose `<table>.findMany` returns the given rows, and which
 * records the args it was called with so we can assert scoping/selection.
 */
function stubPrisma(field: string, values: Array<string | null>) {
  const findMany = jest.fn().mockResolvedValue(values.map((v) => ({ [field]: v })));
  return {
    prisma: {
      purchaseOrder: { findMany },
      rfq: { findMany },
      bulkOrder: { findMany },
      bom: { findMany },
    } as unknown as PrismaClient,
    findMany,
  };
}

describe('nextSequentialNumber', () => {
  it('returns PREFIX-00001 when the company has no numbers yet', async () => {
    const { prisma } = stubPrisma('poNumber', []);
    await expect(nextSequentialNumber(prisma, 'purchaseOrder', 'PO', 'c1')).resolves.toBe(
      'PO-00001',
    );
  });

  it('returns max + 1 for a dense sequence', async () => {
    const { prisma } = stubPrisma('poNumber', ['PO-00001', 'PO-00002', 'PO-00003']);
    await expect(nextSequentialNumber(prisma, 'purchaseOrder', 'PO', 'c1')).resolves.toBe(
      'PO-00004',
    );
  });

  it('uses max + 1, not count + 1, when there are gaps', async () => {
    // 3 rows but the high-water mark is 21 → must be 22, never 4.
    const { prisma } = stubPrisma('poNumber', ['PO-00001', 'PO-00017', 'PO-00021']);
    await expect(nextSequentialNumber(prisma, 'purchaseOrder', 'PO', 'c1')).resolves.toBe(
      'PO-00022',
    );
  });

  it('ignores split-award child suffixes (PO-NNNNN-1/-2)', async () => {
    // The bug: children inflate count(*) and collide. Max of canonical is 22.
    const { prisma } = stubPrisma('poNumber', ['PO-00022', 'PO-00022-1', 'PO-00022-2']);
    await expect(nextSequentialNumber(prisma, 'purchaseOrder', 'PO', 'c1')).resolves.toBe(
      'PO-00023',
    );
  });

  it('ignores non-canonical seeded numbers (THRESH/SEND) and nulls', async () => {
    const { prisma } = stubPrisma('poNumber', [
      'PO-00025',
      'PO-THRESH-66399848',
      'PO-SEND-20030000',
      'PO-00022-1',
      null,
    ]);
    await expect(nextSequentialNumber(prisma, 'purchaseOrder', 'PO', 'c1')).resolves.toBe(
      'PO-00026',
    );
  });

  it('scopes the lookup to the company and selects only the number column', async () => {
    const { prisma, findMany } = stubPrisma('rfqNumber', ['RFQ-00009']);
    await expect(nextSequentialNumber(prisma, 'rfq', 'RFQ', 'company-xyz')).resolves.toBe(
      'RFQ-00010',
    );
    expect(findMany).toHaveBeenCalledWith({
      where: { companyId: 'company-xyz' },
      select: { rfqNumber: true },
    });
  });

  it('works for BULK and BOM prefixes/fields', async () => {
    const bulk = stubPrisma('bulkOrderNumber', ['BULK-00004']);
    await expect(nextSequentialNumber(bulk.prisma, 'bulkOrder', 'BULK', 'c1')).resolves.toBe(
      'BULK-00005',
    );

    const bom = stubPrisma('bomNumber', ['BOM-00100', 'BOM-00099']);
    await expect(nextSequentialNumber(bom.prisma, 'bom', 'BOM', 'c1')).resolves.toBe('BOM-00101');
  });
});
