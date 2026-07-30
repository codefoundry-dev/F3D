import {
  EMPTY_VENDOR_DOCUMENT_RESULT,
  normalizeVendorDocumentResult,
  parseIsoDate,
} from '../doc-intelligence.vendor-document';

describe('normalizeVendorDocumentResult', () => {
  it('returns the empty result for non-object input', () => {
    expect(normalizeVendorDocumentResult(null)).toEqual(EMPTY_VENDOR_DOCUMENT_RESULT);
    expect(normalizeVendorDocumentResult('nope')).toEqual(EMPTY_VENDOR_DOCUMENT_RESULT);
    expect(normalizeVendorDocumentResult(42)).toEqual(EMPTY_VENDOR_DOCUMENT_RESULT);
  });

  it('passes through a canonical result, trimming strings', () => {
    const result = normalizeVendorDocumentResult({
      documentType: 'INSURANCE',
      title: '  Certificate of Liability Insurance ',
      issuer: 'Acme Mutual',
      documentNumber: 'POL-123456',
      holderName: 'BuildRight Ltd',
      issuedDate: '2026-01-15',
      expiryDate: '2027-01-15',
      summary: 'General liability cover.',
    });

    expect(result).toEqual({
      documentType: 'INSURANCE',
      title: 'Certificate of Liability Insurance',
      issuer: 'Acme Mutual',
      documentNumber: 'POL-123456',
      holderName: 'BuildRight Ltd',
      issuedDate: '2026-01-15',
      expiryDate: '2027-01-15',
      summary: 'General liability cover.',
    });
  });

  it('nulls empty/absent fields', () => {
    const result = normalizeVendorDocumentResult({ title: '   ', issuer: 7 });
    expect(result.title).toBeNull();
    expect(result.issuer).toBeNull();
    expect(result.documentType).toBeNull();
    expect(result.expiryDate).toBeNull();
  });

  it.each([
    ['insurance certificate', 'INSURANCE'],
    ['Licence', 'LICENSE'],
    ['LICENSE', 'LICENSE'],
    ['Certificate / certification', 'CERTIFICATION'],
    ['permit', 'OTHER'],
  ])('coerces documentType %s to %s', (input, expected) => {
    expect(normalizeVendorDocumentResult({ documentType: input }).documentType).toBe(expected);
  });

  it('accepts alternate key spellings', () => {
    const result = normalizeVendorDocumentResult({
      type: 'license',
      issuedBy: 'City of Accra',
      policyNumber: 'L-99',
      companyName: 'BuildRight Ltd',
      validUntil: '2028-06-30',
      issueDate: '2026-06-30',
      description: 'Trade license.',
    });

    expect(result.documentType).toBe('LICENSE');
    expect(result.issuer).toBe('City of Accra');
    expect(result.documentNumber).toBe('L-99');
    expect(result.holderName).toBe('BuildRight Ltd');
    expect(result.expiryDate).toBe('2028-06-30');
    expect(result.issuedDate).toBe('2026-06-30');
    expect(result.summary).toBe('Trade license.');
  });
});

describe('parseIsoDate', () => {
  it('parses a valid ISO date to UTC midnight', () => {
    expect(parseIsoDate('2027-01-15')?.toISOString()).toBe('2027-01-15T00:00:00.000Z');
    expect(parseIsoDate(' 2027-01-15 ')?.toISOString()).toBe('2027-01-15T00:00:00.000Z');
  });

  it('rejects non-ISO and impossible dates', () => {
    expect(parseIsoDate('15/01/2027')).toBeNull();
    expect(parseIsoDate('January 15, 2027')).toBeNull();
    expect(parseIsoDate('2026-02-31')).toBeNull();
    expect(parseIsoDate('2026-13-01')).toBeNull();
    expect(parseIsoDate(null)).toBeNull();
    expect(parseIsoDate(20270115)).toBeNull();
  });
});
