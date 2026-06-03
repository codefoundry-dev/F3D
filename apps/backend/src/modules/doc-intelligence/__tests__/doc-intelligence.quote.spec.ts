import { normalizeQuoteResult } from '../doc-intelligence.quote';

describe('normalizeQuoteResult', () => {
  it('normalizes a well-formed Gemini quote payload', () => {
    const result = normalizeQuoteResult({
      vendorName: 'Acme Supplies',
      quoteNumber: 'Q-1001',
      rfqReference: 'RFQ-77',
      currency: 'usd',
      totalAmount: '1,250.00',
      validUntil: '2026-07-01',
      items: [
        {
          description: '  M16 Hex Bolt ',
          quantity: '100',
          unit: 'EA',
          unitPrice: '$1.25',
          lineTotal: '125',
          leadTime: '2 weeks',
        },
        {
          description: 'Steel plate 10mm',
          quantity: 5,
          unit: 'sheet',
          unitPrice: 225,
          lineTotal: 1125,
          leadTime: null,
        },
      ],
      notes: 'Prices firm for 30 days',
    });

    expect(result.vendorName).toBe('Acme Supplies');
    expect(result.quoteNumber).toBe('Q-1001');
    expect(result.currency).toBe('USD');
    expect(result.totalAmount).toBe(1250);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({
      description: 'M16 Hex Bolt',
      quantity: 100,
      unit: 'ea',
      unitPrice: 1.25,
      lineTotal: 125,
      leadTime: '2 weeks',
    });
    expect(result.items[1].unit).toBe('sheet');
    expect(result.items[1].leadTime).toBeNull();
  });

  it('drops only truly-blank rows (no description AND no price)', () => {
    const result = normalizeQuoteResult({
      items: [
        // Dropped: nothing usable to quote against.
        { description: '', quantity: null, unit: null, unitPrice: null },
        { description: '   ', quantity: null, unit: null, unitPrice: null },
        // Kept: has a price even without a description.
        { description: null, unitPrice: '10' },
        // Kept: has a description.
        { description: 'Real item', unitPrice: '25' },
      ],
    });
    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.description)).toEqual(['', 'Real item']);
  });

  it('accepts alternate key names Gemini sometimes emits', () => {
    const result = normalizeQuoteResult({
      supplier: 'BuildCo',
      lineItems: [
        { item: 'Cement bag', qty: '20', uom: 'bag', rate: '8.50', lead_time: 'in stock' },
      ],
    });
    expect(result.vendorName).toBe('BuildCo');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      description: 'Cement bag',
      quantity: 20,
      unit: 'bag',
      unitPrice: 8.5,
      leadTime: 'in stock',
    });
  });

  it('returns an empty result for non-object / missing input', () => {
    expect(normalizeQuoteResult(null).items).toEqual([]);
    expect(normalizeQuoteResult('nope').items).toEqual([]);
    expect(normalizeQuoteResult({}).items).toEqual([]);
  });
});
