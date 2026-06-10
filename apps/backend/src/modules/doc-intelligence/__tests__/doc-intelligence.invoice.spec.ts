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
      currency: 'usd',
      subTotal: '1,000.00',
      taxAmount: '$250',
      totalAmount: '1,250.00',
      items: [],
      notes: ' net 30 ',
    });

    expect(result).toMatchObject({
      vendorName: 'Acme Supplies',
      invoiceNumber: 'INV-42',
      poReference: 'PO-7',
      issuedDate: '2026-05-01',
      dueDate: '2026-05-31',
      currency: 'USD',
      subTotal: 1000,
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
    expect(result.poReference).toBe('PO-9');
    expect(result.issuedDate).toBe('2026-04-01');
    expect(result.dueDate).toBe('2026-04-30');
    expect(result.subTotal).toBe(100);
    expect(result.taxAmount).toBe(25);
    expect(result.totalAmount).toBe(125);
    expect(result.items).toEqual([
      { description: 'Cement', quantity: 2, unit: 'bag', unitPrice: 50, lineTotal: 100 },
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
      { description: '', quantity: 1, unit: null, unitPrice: 12.5, lineTotal: null },
    ]);
  });
});
