import { QuoteLineItemAvailability } from '@prisma/client';

import {
  buildQuoteComparison,
  type ComparisonQuoteInput,
  type ComparisonQuoteLineItemInput,
  type ComparisonRfqInput,
} from '../quote-comparison';

const rfq: ComparisonRfqInput = {
  id: 'rfq-1',
  currency: 'AUD',
  projectId: 'p-1',
  projectName: 'Primary Project',
  lineItems: [
    {
      id: 'li-1',
      materialName: 'Cement',
      quantity: 10,
      unit: 'bags',
      projectId: null,
      projectName: null,
    },
    {
      id: 'li-2',
      materialName: 'Steel',
      quantity: 5,
      unit: 'tons',
      projectId: 'p-2',
      projectName: 'Second Project',
    },
  ],
};

let lineSeq = 0;

function line(
  overrides: Partial<ComparisonQuoteLineItemInput> & { rfqLineItemId: string },
): ComparisonQuoteLineItemInput {
  lineSeq += 1;
  return {
    id: `ql-${lineSeq}`,
    unitPrice: 0,
    quotedQuantity: 0,
    availability: QuoteLineItemAvailability.AVAILABLE,
    deliveryDate: null,
    discount: null,
    discountType: null,
    lineTotal: 0,
    status: 'PENDING',
    notes: null,
    substituteItemId: null,
    substituteItemName: null,
    ...overrides,
  };
}

function quote(overrides: Partial<ComparisonQuoteInput> = {}): ComparisonQuoteInput {
  return {
    id: 'q-1',
    vendorId: 'v-1',
    vendorName: 'Vendor One',
    status: 'SUBMITTED',
    submittedAt: new Date('2026-06-01T00:00:00Z'),
    paymentTerms: 'Net 30',
    bulkDeliveryTime: null,
    totalCost: 0,
    discountPercent: null,
    discountAmount: null,
    bulkShipment: null,
    attachmentCount: 0,
    lineItems: [],
    ...overrides,
  };
}

describe('buildQuoteComparison', () => {
  it('returns one row per RFQ line item with a cell per vendor', () => {
    const result = buildQuoteComparison(rfq, [
      quote({ id: 'q-1', vendorId: 'v-1' }),
      quote({ id: 'q-2', vendorId: 'v-2', vendorName: 'Vendor Two' }),
    ]);

    expect(result.rfqId).toBe('rfq-1');
    expect(result.currency).toBe('AUD');
    expect(result.rows).toHaveLength(2);
    expect(result.vendors).toHaveLength(2);
    expect(result.rows[0].cells).toHaveLength(2);
    expect(result.rows[0].cells.map((c) => c.vendorId)).toEqual(['v-1', 'v-2']);
  });

  it('falls back to the RFQ primary project for rows without a line-level project', () => {
    const result = buildQuoteComparison(rfq, []);
    expect(result.rows[0].projectId).toBe('p-1');
    expect(result.rows[0].projectName).toBe('Primary Project');
    expect(result.rows[1].projectId).toBe('p-2');
    expect(result.rows[1].projectName).toBe('Second Project');
  });

  it('computes extended cost as quantity × unit price', () => {
    const result = buildQuoteComparison(rfq, [
      quote({
        lineItems: [
          line({
            rfqLineItemId: 'li-1',
            unitPrice: 12.5,
            quotedQuantity: 10,
            deliveryDate: new Date('2026-07-01T00:00:00Z'),
            lineTotal: 137.5,
          }),
        ],
      }),
    ]);

    const cell = result.rows[0].cells[0];
    expect(cell.unitPrice).toBe(12.5);
    expect(cell.quotedQuantity).toBe(10);
    expect(cell.extendedCost).toBe(125);
    expect(cell.lineTotal).toBe(137.5);
    expect(cell.hasQuote).toBe(true);
  });

  it('flags the lowest line total per row and sets lowestVendorId', () => {
    const result = buildQuoteComparison(rfq, [
      quote({
        id: 'q-1',
        vendorId: 'v-1',
        lineItems: [
          line({ rfqLineItemId: 'li-1', unitPrice: 20, quotedQuantity: 10, lineTotal: 200 }),
        ],
      }),
      quote({
        id: 'q-2',
        vendorId: 'v-2',
        lineItems: [
          line({ rfqLineItemId: 'li-1', unitPrice: 15, quotedQuantity: 10, lineTotal: 150 }),
        ],
      }),
    ]);

    const row = result.rows[0];
    expect(row.lowestVendorId).toBe('v-2');
    expect(row.cells.find((c) => c.vendorId === 'v-2')?.isLowest).toBe(true);
    expect(row.cells.find((c) => c.vendorId === 'v-1')?.isLowest).toBe(false);
  });

  it('highlights every cell on a tie for the lowest cost', () => {
    const tied = [
      quote({
        id: 'q-1',
        vendorId: 'v-1',
        lineItems: [
          line({ rfqLineItemId: 'li-1', unitPrice: 10, quotedQuantity: 10, lineTotal: 100 }),
        ],
      }),
      quote({
        id: 'q-2',
        vendorId: 'v-2',
        lineItems: [
          line({ rfqLineItemId: 'li-1', unitPrice: 10, quotedQuantity: 10, lineTotal: 100 }),
        ],
      }),
    ];
    const result = buildQuoteComparison(rfq, tied);
    const row = result.rows[0];
    expect(row.cells.every((c) => c.isLowest)).toBe(true);
    // First matching vendor wins the canonical lowestVendorId.
    expect(row.lowestVendorId).toBe('v-1');
  });

  it('excludes NO_QUOTE and zero-price lines from cells, totals and highlight', () => {
    const result = buildQuoteComparison(rfq, [
      quote({
        id: 'q-1',
        vendorId: 'v-1',
        lineItems: [
          line({
            rfqLineItemId: 'li-1',
            unitPrice: 0,
            quotedQuantity: 10,
            availability: QuoteLineItemAvailability.NO_QUOTE,
          }),
          line({ rfqLineItemId: 'li-2', unitPrice: 30, quotedQuantity: 5, lineTotal: 150 }),
        ],
      }),
    ]);

    const li1Cell = result.rows[0].cells[0];
    expect(li1Cell.hasQuote).toBe(false);
    expect(li1Cell.extendedCost).toBeNull();
    expect(li1Cell.lineTotal).toBeNull();
    expect(li1Cell.isLowest).toBe(false);
    expect(result.rows[0].lowestVendorId).toBeNull();

    // Vendor total only counts the line it actually quoted.
    expect(result.vendors[0].total).toBe(150);
    expect(result.vendors[0].itemsCovered).toBe(1);
    expect(result.vendors[0].totalItems).toBe(2);
  });

  it('leaves a missing quote line as an empty, no-quote cell', () => {
    const result = buildQuoteComparison(rfq, [
      quote({
        lineItems: [
          line({ rfqLineItemId: 'li-1', unitPrice: 10, quotedQuantity: 10, lineTotal: 100 }),
        ],
      }),
    ]);

    // li-2 was never quoted by this vendor.
    const li2Cell = result.rows[1].cells[0];
    expect(li2Cell.hasQuote).toBe(false);
    expect(li2Cell.extendedCost).toBeNull();
    expect(li2Cell.unitPrice).toBeNull();
    expect(li2Cell.quoteLineItemId).toBeNull();
    expect(li2Cell.status).toBeNull();
  });

  it('sums vendor totals across all quoted rows', () => {
    const result = buildQuoteComparison(rfq, [
      quote({
        lineItems: [
          line({ rfqLineItemId: 'li-1', unitPrice: 10, quotedQuantity: 10, lineTotal: 100 }),
          line({ rfqLineItemId: 'li-2', unitPrice: 40, quotedQuantity: 5, lineTotal: 200 }),
        ],
      }),
    ]);

    expect(result.vendors[0].total).toBe(300);
    expect(result.vendors[0].itemsCovered).toBe(2);
  });

  it('derives lead time from the latest line delivery date', () => {
    const result = buildQuoteComparison(rfq, [
      quote({
        bulkDeliveryTime: null,
        lineItems: [
          line({
            rfqLineItemId: 'li-1',
            unitPrice: 10,
            quotedQuantity: 10,
            deliveryDate: new Date('2026-07-01T00:00:00Z'),
          }),
          line({
            rfqLineItemId: 'li-2',
            unitPrice: 10,
            quotedQuantity: 5,
            deliveryDate: new Date('2026-09-15T00:00:00Z'),
          }),
        ],
      }),
    ]);

    expect(result.vendors[0].leadTimeDate).toBe('2026-09-15T00:00:00.000Z');
  });

  it('prefers the bulk delivery time for lead time when present', () => {
    const result = buildQuoteComparison(rfq, [
      quote({
        bulkDeliveryTime: new Date('2026-08-01T00:00:00Z'),
        lineItems: [
          line({
            rfqLineItemId: 'li-1',
            unitPrice: 10,
            quotedQuantity: 10,
            deliveryDate: new Date('2026-12-01T00:00:00Z'),
          }),
        ],
      }),
    ]);

    expect(result.vendors[0].leadTimeDate).toBe('2026-08-01T00:00:00.000Z');
  });

  it('surfaces payment terms and submission time on the vendor column', () => {
    const result = buildQuoteComparison(rfq, [
      quote({ paymentTerms: 'Net 45', submittedAt: new Date('2026-06-02T08:00:00Z') }),
    ]);

    expect(result.vendors[0].paymentTerms).toBe('Net 45');
    expect(result.vendors[0].submittedAt).toBe('2026-06-02T08:00:00.000Z');
  });

  it('carries the vendor footer fields (total with taxes, discount, shipment, attachments)', () => {
    const result = buildQuoteComparison(rfq, [
      quote({
        totalCost: 57585,
        discountPercent: 8,
        discountAmount: 10000,
        bulkShipment: 850,
        attachmentCount: 2,
      }),
    ]);

    const vendor = result.vendors[0];
    expect(vendor.totalWithTaxes).toBe(57585);
    expect(vendor.discountPercent).toBe(8);
    expect(vendor.discountAmount).toBe(10000);
    expect(vendor.shipmentAndHandling).toBe(850);
    expect(vendor.attachmentCount).toBe(2);
  });

  it('exposes per-line review status, notes and substitute info on cells', () => {
    const result = buildQuoteComparison(rfq, [
      quote({
        lineItems: [
          line({
            id: 'ql-status',
            rfqLineItemId: 'li-1',
            unitPrice: 10,
            quotedQuantity: 10,
            lineTotal: 100,
            status: 'DECLINED',
            notes: 'Cheaper alternative attached',
            substituteItemId: 'mat-9',
            substituteItemName: 'Oak Planks (1" thick)',
          }),
        ],
      }),
    ]);

    const cell = result.rows[0].cells[0];
    expect(cell.quoteLineItemId).toBe('ql-status');
    expect(cell.status).toBe('DECLINED');
    expect(cell.notes).toBe('Cheaper alternative attached');
    expect(cell.substituteItemId).toBe('mat-9');
    expect(cell.substituteItemName).toBe('Oak Planks (1" thick)');
    expect(result.vendors[0].hasNotes).toBe(true);
  });

  it('handles an RFQ with no received quotes', () => {
    const result = buildQuoteComparison(rfq, []);
    expect(result.vendors).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].cells).toHaveLength(0);
    expect(result.rows[0].lowestVendorId).toBeNull();
  });
});
