import type { QuoteExtractionResult } from '@forethread/shared-types/client';

import { descriptionSimilarity, matchExtractedQuote } from './matchExtractedQuote';
import type { LineItemFormState } from './useRfqResponse';

function makeLine(
  overrides: Partial<LineItemFormState> & { rfqLineItemId: string },
): LineItemFormState {
  return {
    included: true,
    materialName: overrides.materialName ?? '',
    materialId: null,
    unit: 'ea',
    requestedQty: overrides.requestedQty ?? 10,
    availQty: '',
    unitPrice: '',
    discount: '',
    discountType: 'PERCENT',
    gst: '',
    taxIncluded: false,
    deliveryDate: '',
    notes: overrides.notes ?? '',
    backOrderQty: '',
    backOrderDeliveryDate: '',
    substituteItemId: null,
    substituteName: null,
    expandedSection: null,
    description: null,
    expectedDeliveryDate: null,
    deliveryLocation: null,
    ...overrides,
  };
}

function makeExtraction(items: QuoteExtractionResult['items']): QuoteExtractionResult {
  return {
    vendorName: null,
    quoteNumber: null,
    rfqReference: null,
    currency: null,
    totalAmount: null,
    validUntil: null,
    items,
    notes: null,
  };
}

describe('descriptionSimilarity', () => {
  it('scores identical descriptions as 1', () => {
    expect(descriptionSimilarity('M16 Hex Bolt', 'M16 Hex Bolt')).toBe(1);
  });

  it('ignores case, punctuation and single-character tokens', () => {
    expect(descriptionSimilarity('Cement (bag)', 'cement bag')).toBe(1);
  });

  it('scores disjoint descriptions as 0', () => {
    expect(descriptionSimilarity('Cement', 'Steel beam')).toBe(0);
  });
});

describe('matchExtractedQuote', () => {
  const base = [
    makeLine({ rfqLineItemId: 'li-1', materialName: 'Portland Cement 25kg', requestedQty: 100 }),
    makeLine({
      rfqLineItemId: 'li-2',
      materialName: 'Reinforcing Steel Bar 12mm',
      requestedQty: 50,
    }),
  ];

  it('matches by description regardless of PDF row order and pre-fills price + qty', () => {
    const extraction = makeExtraction([
      {
        description: 'Steel reinforcing bar 12mm',
        quantity: 50,
        unit: 'ea',
        unitPrice: 8.5,
        lineTotal: 425,
        leadTime: '2 weeks',
      },
      {
        description: 'Cement, Portland 25kg',
        quantity: 100,
        unit: 'bag',
        unitPrice: 12,
        lineTotal: 1200,
        leadTime: null,
      },
    ]);

    const { lineItems, matchedCount, unmatchedCount } = matchExtractedQuote(base, extraction);

    expect(matchedCount).toBe(2);
    expect(unmatchedCount).toBe(0);

    const cement = lineItems.find((l) => l.rfqLineItemId === 'li-1')!;
    expect(cement.included).toBe(true);
    expect(cement.unitPrice).toBe('12');
    expect(cement.availQty).toBe('100');

    const steel = lineItems.find((l) => l.rfqLineItemId === 'li-2')!;
    expect(steel.unitPrice).toBe('8.5');
    expect(steel.notes).toContain('Lead time: 2 weeks');
  });

  it('de-selects RFQ lines that have no matching PDF row', () => {
    const extraction = makeExtraction([
      {
        description: 'Portland Cement 25kg',
        quantity: 100,
        unit: 'bag',
        unitPrice: 12,
        lineTotal: null,
        leadTime: null,
      },
    ]);

    const { lineItems, matchedCount, unmatchedCount } = matchExtractedQuote(base, extraction);

    expect(matchedCount).toBe(1);
    expect(unmatchedCount).toBe(0);
    expect(lineItems.find((l) => l.rfqLineItemId === 'li-1')!.included).toBe(true);
    expect(lineItems.find((l) => l.rfqLineItemId === 'li-2')!.included).toBe(false);
  });

  it('counts PDF rows that match nothing as unmatched', () => {
    const extraction = makeExtraction([
      {
        description: 'Portland Cement 25kg',
        quantity: 100,
        unit: 'bag',
        unitPrice: 12,
        lineTotal: null,
        leadTime: null,
      },
      {
        description: 'Safety gloves',
        quantity: 5,
        unit: 'pack',
        unitPrice: 3,
        lineTotal: 15,
        leadTime: null,
      },
    ]);

    const { matchedCount, unmatchedCount } = matchExtractedQuote(base, extraction);

    expect(matchedCount).toBe(1);
    expect(unmatchedCount).toBe(1);
  });

  it('does not pair one PDF row with two RFQ lines', () => {
    const twoSimilar = [
      makeLine({ rfqLineItemId: 'li-1', materialName: 'Steel bar 12mm' }),
      makeLine({ rfqLineItemId: 'li-2', materialName: 'Steel bar 16mm' }),
    ];
    const extraction = makeExtraction([
      {
        description: 'Steel bar 12mm',
        quantity: 10,
        unit: 'ea',
        unitPrice: 5,
        lineTotal: 50,
        leadTime: null,
      },
    ]);

    const { matchedCount } = matchExtractedQuote(twoSimilar, extraction);
    expect(matchedCount).toBe(1);
  });
});
