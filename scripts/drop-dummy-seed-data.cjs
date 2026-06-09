/* eslint-disable */
/**
 * One-off cleanup: remove the SEED dummy RFQ / PO graph.
 *
 * Scoped to the seed contractor companies (ABN TEST-CONTRACTOR-001 / -002) so
 * real-company data is never touched. DRY RUN by default — set EXECUTE=1 to delete.
 *
 * FK-safe delete order (children removed by ON DELETE CASCADE):
 *   1. invoices       — clears invoices.related_po_id -> purchase_orders
 *   2. bulk_orders    — clears bulk_orders.rfq_id -> rfqs (+ cascades drawdowns -> pos)
 *   3. purchase_orders— clears purchase_orders.rfq_id -> rfqs
 *   4. rfqs           — cascades vendors / line items / documents / quotes / audits / emails
 *
 * Leaves seed companies, users, projects, materials and vendor links intact.
 *
 * Run locally:   DATABASE_URL=... node scripts/drop-dummy-seed-data.cjs        (dry run)
 *                DATABASE_URL=... EXECUTE=1 node scripts/drop-dummy-seed-data.cjs
 * Run in prod:   piped into the backend container's node via SSM (DATABASE_URL from env_file).
 */
const { PrismaClient } = require('@prisma/client');

const SEED_CONTRACTOR_ABNS = ['TEST-CONTRACTOR-001', 'TEST-CONTRACTOR-002'];
const EXECUTE = process.env.EXECUTE === '1';

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({
    where: { abn: { in: SEED_CONTRACTOR_ABNS } },
    select: { id: true, abn: true, legalName: true },
  });

  if (companies.length === 0) {
    console.log('No seed contractor companies found (ABN ' + SEED_CONTRACTOR_ABNS.join(', ') + ') — nothing to do.');
    return;
  }

  const companyIds = companies.map((c) => c.id);
  console.log('Seed contractor companies:');
  for (const c of companies) console.log('  - ' + c.legalName + ' (' + c.abn + ')');

  const where = { companyId: { in: companyIds } };

  const [rfqs, pos, bulkOrders, invoices, quotes] = await Promise.all([
    prisma.rfq.findMany({ where, select: { rfqNumber: true }, orderBy: { rfqNumber: 'asc' } }),
    prisma.purchaseOrder.findMany({ where, select: { poNumber: true }, orderBy: { poNumber: 'asc' } }),
    prisma.bulkOrder.count({ where }),
    prisma.invoice.count({ where }),
    prisma.quoteResponse.count({ where: { rfq: { companyId: { in: companyIds } } } }),
  ]);

  console.log('\nWill delete (scoped to the seed companies above):');
  console.log('  RFQs (' + rfqs.length + '): ' + (rfqs.map((r) => r.rfqNumber).join(', ') || '—'));
  console.log('  POs  (' + pos.length + '): ' + (pos.map((p) => p.poNumber).join(', ') || '—'));
  console.log('  Bulk orders: ' + bulkOrders);
  console.log('  Invoices: ' + invoices);
  console.log('  Quote responses (cascade with RFQs): ' + quotes);
  console.log('  + their line items / documents / deliveries / quote audits / email messages (ON DELETE CASCADE)');

  if (!EXECUTE) {
    console.log('\nDRY RUN — nothing deleted. Re-run with EXECUTE=1 to apply.');
    return;
  }

  const poIds = (await prisma.purchaseOrder.findMany({ where, select: { id: true } })).map((p) => p.id);

  const rfqScope = { rfq: { companyId: { in: companyIds } } };

  const result = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.deleteMany({
      where: { OR: [{ companyId: { in: companyIds } }, { relatedPoId: { in: poIds } }] },
    });
    const bo = await tx.bulkOrder.deleteMany({ where });
    const po = await tx.purchaseOrder.deleteMany({ where });
    // Quote responses MUST go before RFQs: QuoteResponseLineItem -> RfqLineItem
    // has no cascade (Restrict), so those quote line items must be removed before
    // the RFQ cascade deletes their RfqLineItems. Deleting the quote response
    // cascades its line items + audits + attachments.
    const quote = await tx.quoteResponse.deleteMany({ where: rfqScope });
    const rfq = await tx.rfq.deleteMany({ where });
    return {
      invoices: inv.count,
      bulkOrders: bo.count,
      purchaseOrders: po.count,
      quoteResponses: quote.count,
      rfqs: rfq.count,
    };
  });

  console.log('\n✅ Deleted: ' + JSON.stringify(result));
}

main()
  .catch((e) => {
    console.error('❌ Cleanup failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
