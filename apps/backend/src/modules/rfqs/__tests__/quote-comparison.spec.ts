import { QuoteLineItemAvailability } from '@prisma/client';

import {
  buildQuoteComparison,
  type ComparisonQuoteInput,
  type ComparisonRfqInput,
} from '../quote-comparison';

const rfq: ComparisonRfqInput = {
  id: 'rfq-1',
  currency: 'AUD',
  lineItems: [
    { id: 'li-1', materialName: 'Cement', quantity: 10, unit: 'bags' },
    { id: 'li-2', materialName: 'Steel', quantity: 5, unit: 'tons' },
  ],
};

function quote(overrides: Partial<ComparisonQuoteInput> = {}): ComparisonQuoteInput {
  return {
    id: 'q-1',
    vendorId: 'v-1',
    vendorName: 'Vendor One',
    status: 'SUBMITTED',
    submittedAt: new Date('2026-06-01T00:00:00Z'),
    paymentTerms: 'Net 30',
    bulkDeliveryTime: null,
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

  it('computes extended cost as quantity × unit price', () => {
    const result = buildQuoteComparison(rfq, [
      quote({
        lineItems: [
          {
            rfqLineItemId: 'li-1',
            unitPrice: 12.5,
            quotedQuantity: 10,
            availability: QuoteLineItemAvailability.AVAILABLE,
            deliveryDate: new Date('2026-07-01T00:00:00Z'),
          },
        ],
      }),
    ]);

    const cell = result.rows[0].cells[0];
    expect(cell.unitPrice).toBe(12.5);
    expect(cell.quotedQuantity).toBe(10);
    expect(cell.extendedCost).toBe(125);
    expect(cell.hasQuote).toBe(true);
  });

  it('flags the lowest extended cost per row and sets lowestVendorId', () => {
    const result = buildQuoteComparison(rfq, [
      quote({
        id: 'q-1',
        vendorId: 'v-1',
        lineItems: [
          {
            rfqLineItemId: 'li-1',
            unitPrice: 20,
            quotedQuantity: 10, // 200
            availability: QuoteLineItemAvailability.AVAILABLE,
            deliveryDate: null,
          },
        ],
      }),
      quote({
        id: 'q-2',
        vendorId: 'v-2',
        lineItems: [
          {
            rfqLineItemId: 'li-1',
            unitPrice: 15,
            quotedQuantity: 10, // 150 — cheapest
            availability: QuoteLineItemAvailability.AVAILABLE,
            deliveryDate: null,
          },
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
          {
            rfqLineItemId: 'li-1',
            unitPrice: 10,
            quotedQuantity: 10,
            availability: QuoteLineItemAvailability.AVAILABLE,
            deliveryDate: null,
          },
        ],
      }),
      quote({
        id: 'q-2',
        vendorId: 'v-2',
        lineItems: [
          {
            rfqLineItemId: 'li-1',
            unitPrice: 10,
            quotedQuantity: 10,
            availability: QuoteLineItemAvailability.AVAILABLE,
            deliveryDate: null,
          },
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
          {
            rfqLineItemId: 'li-1',
            unitPrice: 0,
            quotedQuantity: 10,
            availability: QuoteLineItemAvailability.NO_QUOTE,
            deliveryDate: null,
          },
          {
            rfqLineItemId: 'li-2',
            unitPrice: 30,
            quotedQuantity: 5, // 150
            availability: QuoteLineItemAvailability.AVAILABLE,
            deliveryDate: null,
          },
        ],
      }),
    ]);

    const li1Cell = result.rows[0].cells[0];
    expect(li1Cell.hasQuote).toBe(false);
    expect(li1Cell.extendedCost).toBeNull();
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
          {
            rfqLineItemId: 'li-1',
            unitPrice: 10,
            quotedQuantity: 10,
            availability: QuoteLineItemAvailability.AVAILABLE,
            deliveryDate: null,
          },
        ],
      }),
    ]);

    // li-2 was never quoted by this vendor.
    const li2Cell = result.rows[1].cells[0];
    expect(li2Cell.hasQuote).toBe(false);
    expect(li2Cell.extendedCost).toBeNull();
    expect(li2Cell.unitPrice).toBeNull();
  });

  it('sums vendor totals across all quoted rows', () => {
    const result = buildQuoteComparison(rfq, [
      quote({
        lineItems: [
          {
            rfqLineItemId: 'li-1',
            unitPrice: 10,
            quotedQuantity: 10, // 100
            availability: QuoteLineItemAvailability.AVAILABLE,
            deliveryDate: null,
          },
          {
            rfqLineItemId: 'li-2',
            unitPrice: 40,
            quotedQuantity: 5, // 200
            availability: QuoteLineItemAvailability.AVAILABLE,
            deliveryDate: null,
          },
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
          {
            rfqLineItemId: 'li-1',
            unitPrice: 10,
            quotedQuantity: 10,
            availability: QuoteLineItemAvailability.AVAILABLE,
            deliveryDate: new Date('2026-07-01T00:00:00Z'),
          },
          {
            rfqLineItemId: 'li-2',
            unitPrice: 10,
            quotedQuantity: 5,
            availability: QuoteLineItemAvailability.AVAILABLE,
            deliveryDate: new Date('2026-09-15T00:00:00Z'),
          },
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
          {
            rfqLineItemId: 'li-1',
            unitPrice: 10,
            quotedQuantity: 10,
            availability: QuoteLineItemAvailability.AVAILABLE,
            deliveryDate: new Date('2026-12-01T00:00:00Z'),
          },
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

  it('handles an RFQ with no received quotes', () => {
    const result = buildQuoteComparison(rfq, []);
    expect(result.vendors).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].cells).toHaveLength(0);
    expect(result.rows[0].lowestVendorId).toBeNull();
  });
});
