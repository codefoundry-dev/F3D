import {
  MIN_LINE_MATCH_SCORE,
  normalizePoReference,
  pairLines,
  referenceMatchesPoNumber,
  scoreLinePair,
  type MatchableInvoiceLine,
  type MatchablePoLine,
} from '../invoice-matching.util';

describe('normalizePoReference', () => {
  it('uppercases and strips punctuation/whitespace', () => {
    expect(normalizePoReference('P/O 13603')).toBe('PO13603');
    expect(normalizePoReference('po-00042')).toBe('PO00042');
    expect(normalizePoReference('  Purchase Order: 42 ')).toBe('PURCHASEORDER42');
  });
});

describe('referenceMatchesPoNumber', () => {
  it('matches exact normalized forms', () => {
    expect(referenceMatchesPoNumber('PO-00042', 'PO-00042')).toBe(true);
    expect(referenceMatchesPoNumber('po 00042', 'PO-00042')).toBe(true);
  });

  it('matches loose citations of the same digit core ("P/O 42" cites PO-00042)', () => {
    expect(referenceMatchesPoNumber('P/O 42', 'PO-00042')).toBe(true);
    expect(referenceMatchesPoNumber('42', 'PO-00042')).toBe(true);
    expect(referenceMatchesPoNumber('PO-42', 'PO-00042')).toBe(true);
    expect(referenceMatchesPoNumber('0042', 'PO-00042')).toBe(true);
  });

  it('never digit-matches references with a non-PO prefix', () => {
    expect(referenceMatchesPoNumber('INV13603', 'PO-13603')).toBe(false);
    expect(referenceMatchesPoNumber('REF 42', 'PO-00042')).toBe(false);
  });

  it('rejects different numbers and empty inputs', () => {
    expect(referenceMatchesPoNumber('PO-43', 'PO-00042')).toBe(false);
    expect(referenceMatchesPoNumber('', 'PO-00042')).toBe(false);
    expect(referenceMatchesPoNumber('PO-42', '')).toBe(false);
  });
});

function inv(overrides: Partial<MatchableInvoiceLine> = {}): MatchableInvoiceLine {
  return {
    lineId: null,
    description: 'DN100 PVC pipe',
    quantity: 10,
    unitPrice: 8.5,
    ...overrides,
  };
}

function po(overrides: Partial<MatchablePoLine> = {}): MatchablePoLine {
  return {
    lineNumber: 1,
    materialCode: 'PVC-100',
    description: 'DN100 PVC pipe',
    quantityOrdered: 10,
    unitPrice: 8.5,
    ...overrides,
  };
}

describe('scoreLinePair', () => {
  it('scores an identical line far above the match floor', () => {
    expect(scoreLinePair(inv(), po())).toBeGreaterThan(0.6);
  });

  it('rewards the vendor echoing our material code in the description', () => {
    const withCode = scoreLinePair(
      inv({ description: 'Pipe supply PVC-100 as ordered' }),
      po({ description: 'Something entirely different' }),
    );
    expect(withCode).toBeGreaterThanOrEqual(0.45);
  });

  it('scores unrelated lines below the match floor', () => {
    const score = scoreLinePair(
      inv({ description: 'Weekend crane hire surcharge', quantity: 1, unitPrice: 500 }),
      po(),
    );
    expect(score).toBeLessThan(MIN_LINE_MATCH_SCORE);
  });

  it("uses the invoice's printed line number as a signal", () => {
    const withLineNo = scoreLinePair(
      inv({ lineId: '3', description: 'Misc item' }),
      po({ lineNumber: 3, description: 'Other words' }),
    );
    const withoutLineNo = scoreLinePair(
      inv({ lineId: '9', description: 'Misc item' }),
      po({ lineNumber: 3, description: 'Other words' }),
    );
    expect(withLineNo).toBeGreaterThan(withoutLineNo);
  });
});

describe('pairLines', () => {
  it('assigns each invoice line to its best PO line, one-to-one', () => {
    const invoiceLines = [
      inv({ description: 'DN100 PVC pipe', unitPrice: 8.5, quantity: 10 }),
      inv({ description: '90mm copper elbow fitting', unitPrice: 3.2, quantity: 40 }),
    ];
    const poLines = [
      po({ lineNumber: 1, materialCode: 'PVC-100', description: 'DN100 PVC pipe' }),
      po({
        lineNumber: 2,
        materialCode: 'CU-ELB-90',
        description: '90mm copper elbow fitting',
        quantityOrdered: 40,
        unitPrice: 3.2,
      }),
    ];

    const assigned = pairLines(invoiceLines, poLines);

    expect(assigned.get(0)?.poIndex).toBe(0);
    expect(assigned.get(1)?.poIndex).toBe(1);
  });

  it('gives a contested PO line to the better-scoring invoice line', () => {
    const invoiceLines = [
      inv({ description: 'PVC pipe' }), // partial overlap
      inv({ description: 'DN100 PVC pipe' }), // exact
    ];
    const poLines = [po({ materialCode: null })];

    const assigned = pairLines(invoiceLines, poLines);

    expect(assigned.get(1)?.poIndex).toBe(0);
    expect(assigned.has(0)).toBe(false);
  });

  it('leaves unrelated lines unassigned', () => {
    const assigned = pairLines(
      [inv({ description: 'Weekend crane hire surcharge', quantity: 1, unitPrice: 500 })],
      [po()],
    );
    expect(assigned.size).toBe(0);
  });
});
