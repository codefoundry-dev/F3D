import { buildSplitAllocations, findOverAllocatedLineIds } from '@forethread/rfq-shared';

// Minimal comparison-grid fixture: one RFQ line (requested 10) quoted by two
// vendors, each offering 6.
function rows() {
  return [
    {
      rfqLineItemId: 'rfqline-1',
      materialName: 'Copper wire',
      quantity: 10,
      unit: 'm',
      projectId: 'p-1',
      projectName: 'Project',
      lowestVendorId: null,
      cells: [
        {
          vendorId: 'vendor-a',
          quoteResponseId: 'quote-a',
          quoteLineItemId: 'ql-a',
          quotedQuantity: 6,
        },
        {
          vendorId: 'vendor-b',
          quoteResponseId: 'quote-b',
          quoteLineItemId: 'ql-b',
          quotedQuantity: 6,
        },
      ] as any,
    },
  ] as any;
}

describe('buildSplitAllocations', () => {
  it('maps selected cells to allocations using the typed order quantity', () => {
    const allocs = buildSplitAllocations(
      ['ql-a', 'ql-b'],
      rows(),
      new Map([
        ['ql-a', '6'],
        ['ql-b', '4'],
      ]),
    );
    expect(allocs).toEqual([
      { quoteResponseId: 'quote-a', quoteLineItemId: 'ql-a', approvedQuantity: 6, rfqLineItemId: 'rfqline-1' },
      { quoteResponseId: 'quote-b', quoteLineItemId: 'ql-b', approvedQuantity: 4, rfqLineItemId: 'rfqline-1' },
    ]);
  });

  it('falls back to the quoted quantity when the order qty is blank', () => {
    const allocs = buildSplitAllocations(['ql-a'], rows(), new Map());
    expect(allocs[0].approvedQuantity).toBe(6);
  });

  it('falls back to the quoted quantity when the order qty exceeds the quote', () => {
    const allocs = buildSplitAllocations(['ql-a'], rows(), new Map([['ql-a', '99']]));
    expect(allocs[0].approvedQuantity).toBe(6);
  });

  it('drops selections that resolve to a zero quantity', () => {
    // quoted 0 → fallback 0 → dropped
    const r = rows();
    r[0].cells[0].quotedQuantity = 0;
    const allocs = buildSplitAllocations(['ql-a'], r, new Map());
    expect(allocs).toHaveLength(0);
  });
});

describe('findOverAllocatedLineIds', () => {
  it('flags an RFQ line whose cross-vendor total exceeds the requested qty (AC 4)', () => {
    const allocs = buildSplitAllocations(
      ['ql-a', 'ql-b'],
      rows(),
      new Map([
        ['ql-a', '6'],
        ['ql-b', '6'],
      ]),
    );
    const over = findOverAllocatedLineIds(allocs, rows());
    expect(over.has('rfqline-1')).toBe(true);
  });

  it('does not flag when the cross-vendor total is within the requested qty', () => {
    const allocs = buildSplitAllocations(
      ['ql-a', 'ql-b'],
      rows(),
      new Map([
        ['ql-a', '6'],
        ['ql-b', '4'],
      ]),
    );
    const over = findOverAllocatedLineIds(allocs, rows());
    expect(over.size).toBe(0);
  });
});
