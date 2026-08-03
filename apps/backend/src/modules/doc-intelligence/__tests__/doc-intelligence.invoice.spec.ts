import { EMPTY_INVOICE_EXTRACTION_RESULT } from '@forethread/shared-types';

import { normalizeInvoiceResult } from '../doc-intelligence.invoice';

describe('normalizeInvoiceResult', () => {
  it('returns the empty result when input is not an object', () => {
    expect(normalizeInvoiceResult(null)).toEqual(EMPTY_INVOICE_EXTRACTION_RESULT);
    expect(normalizeInvoiceResult('nope')).toEqual(EMPTY_INVOICE_EXTRACTION_RESULT);
    expect(normalizeInvoiceResult(42)).toEqual(EMPTY_INVOICE_EXTRACTION_RESULT);
  });

  it('normalizes header fields, parsing amounts and uppercasing currency', () => {
    const result = normalizeInvoiceResult({
      vendorName: '  Acme Supplies ',
      invoiceNumber: ' INV-42 ',
      poReference: 'PO-7',
      issuedDate: '2026-05-01',
      dueDate: '2026-05-31',
      paymentTerms: ' Net 30 ',
      currency: 'usd',
      subTotal: '1,000.00',
      taxLabel: 'GST 10%',
      taxAmount: '$250',
      totalAmount: '1,250.00',
      items: [],
      notes: ' net 30 ',
    });

    expect(result).toMatchObject({
      vendorName: 'Acme Supplies',
      invoiceNumber: 'INV-42',
      poReferences: ['PO-7'],
      issuedDate: '2026-05-01',
      dueDate: '2026-05-31',
      paymentTerms: 'Net 30',
      currency: 'USD',
      subTotal: 1000,
      taxLabel: 'GST 10%',
      taxRate: 10,
      taxAmount: 250,
      totalAmount: 1250,
      notes: 'net 30',
    });
  });

  it('accepts alternate keys Gemini occasionally emits', () => {
    const result = normalizeInvoiceResult({
      supplier: 'Acme',
      invoiceNo: 'INV-1',
      poNumber: 'PO-9',
      invoiceDate: '2026-04-01',
      due_date: '2026-04-30',
      subtotal: 100,
      vat: 25,
      grandTotal: 125,
      lineItems: [{ item: 'Cement', qty: '2', uom: 'BAGS', rate: '50', amount: '100' }],
    });

    expect(result.vendorName).toBe('Acme');
    expect(result.invoiceNumber).toBe('INV-1');
    expect(result.poReferences).toEqual(['PO-9']);
    expect(result.issuedDate).toBe('2026-04-01');
    expect(result.dueDate).toBe('2026-04-30');
    expect(result.subTotal).toBe(100);
    expect(result.taxAmount).toBe(25);
    expect(result.totalAmount).toBe(125);
    expect(result.items).toEqual([
      {
        lineId: null,
        description: 'Cement',
        quantity: 2,
        unit: 'bag',
        unitPrice: 50,
        lineTotal: 100,
      },
    ]);
  });

  it('drops header / subtotal rows with no description and no unit price', () => {
    const result = normalizeInvoiceResult({
      items: [
        { description: 'Real line', unitPrice: 10 },
        { description: '', unitPrice: null },
        { notes: 'subtotal row' },
        null,
        'not-an-object',
      ],
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].description).toBe('Real line');
  });

  it('keeps priced rows even when the description is missing', () => {
    const result = normalizeInvoiceResult({
      items: [{ unitPrice: '12.50', quantity: 1 }],
    });

    expect(result.items).toEqual([
      { lineId: null, description: '', quantity: 1, unit: null, unitPrice: 12.5, lineTotal: null },
    ]);
  });

  it('collects multiple PO references and captures the line id', () => {
    const result = normalizeInvoiceResult({
      poReferences: ['PO-1', ' PO-2 ', '', null],
      paymentTerms: 'Net 14',
      items: [{ lineId: 'L-1', description: 'Beam', unitPrice: 10 }],
    });

    expect(result.poReferences).toEqual(['PO-1', 'PO-2']);
    expect(result.paymentTerms).toBe('Net 14');
    expect(result.items[0].lineId).toBe('L-1');
  });

  it('reassigns a quantity misread as the lineId when it reproduces the line total', () => {
    // Allied Pumps INV 102846: QTY is the leftmost column and the invoice has
    // no line-number column — Gemini returned the 0.40 qty as the lineId.
    const result = normalizeInvoiceResult({
      items: [
        {
          lineId: '0.40',
          description: 'Allied Pumps Circular Colour Finished Steel Water Storage Panel Tank',
          quantity: null,
          unit: null,
          unitPrice: 375809,
          lineTotal: 150323.6,
        },
      ],
    });

    expect(result.items).toEqual([
      {
        lineId: null,
        description: 'Allied Pumps Circular Colour Finished Steel Water Storage Panel Tank',
        quantity: 0.4,
        unit: null,
        unitPrice: 375809,
        lineTotal: 150323.6,
      },
    ]);
  });

  it('keeps a numeric lineId when the row already has a quantity', () => {
    const result = normalizeInvoiceResult({
      items: [{ lineId: '2', description: 'Beam', quantity: 5, unitPrice: 10, lineTotal: 50 }],
    });

    expect(result.items[0].lineId).toBe('2');
    expect(result.items[0].quantity).toBe(5);
  });

  it('keeps the lineId when lineId × unitPrice does not reproduce the line total', () => {
    const result = normalizeInvoiceResult({
      items: [{ lineId: '3', description: 'Pipe', quantity: null, unitPrice: 10, lineTotal: 100 }],
    });

    expect(result.items[0].lineId).toBe('3');
    expect(result.items[0].quantity).toBeNull();
  });

  it('keeps the lineId when there is no line total to verify against', () => {
    const result = normalizeInvoiceResult({
      items: [{ lineId: '4', description: 'Valve', quantity: null, unitPrice: 25 }],
    });

    expect(result.items[0].lineId).toBe('4');
    expect(result.items[0].quantity).toBeNull();
  });

  it('derives taxRate from a "GST 10%" label when no explicit rate is given', () => {
    const result = normalizeInvoiceResult({ taxLabel: 'GST 10%', items: [] });
    expect(result.taxLabel).toBe('GST 10%');
    expect(result.taxRate).toBe(10);
  });
});
