import type { RfqDetail } from '@forethread/api-client';

import { deriveApprovedQuoteResponses } from './approved-quotes';

function makeRfq(overrides: Partial<RfqDetail> = {}): RfqDetail {
  return {
    id: 'rfq-1',
    name: 'Alpha RFQ',
    rfqNumber: 'RFQ-001',
    projectName: 'Alpha Project',
    projectId: 'proj-1',
    status: 'CLOSED',
    rfqType: null,
    paymentTerms: null,
    pickUp: false,
    pickUpDate: null,
    deliveryLocation: null,
    pickUpLocation: null,
    deadlineStart: null,
    deadlineEnd: null,
    needByDate: null,
    totalRequestedQty: 0,
    approvalStatus: null,
    approvedBy: null,
    createdBy: { id: 'u1', name: 'Sarah Chen' },
    lastModifiedBy: null,
    lineItems: [
      {
        id: 'li-1',
        projectName: 'Alpha Project',
        materialName: 'Steel Beam',
        description: 'Heavy duty',
        quantity: 10,
        unit: 'pcs',
        expectedDeliveryDate: null,
        deliveryLocation: null,
      },
      {
        id: 'li-2',
        projectName: 'Alpha Project',
        materialName: 'Copper Wire',
        description: null,
        quantity: 40,
        unit: 'm',
        expectedDeliveryDate: null,
        deliveryLocation: null,
      },
    ],
    vendors: [],
    quoteResponses: [
      {
        id: 'qr-approved',
        vendorId: 'vendor-9',
        vendorName: 'Vendor A',
        totalCost: 2000,
        discountPercent: 5,
        discountAmount: 100,
        itemsCovered: 2,
        totalItems: 2,
        status: 'APPROVED',
        submittedAt: null,
      },
      {
        id: 'qr-pending',
        vendorId: 'vendor-7',
        vendorName: 'Vendor B',
        totalCost: 999,
        discountPercent: null,
        discountAmount: null,
        itemsCovered: 2,
        totalItems: 2,
        status: 'SUBMITTED',
        submittedAt: null,
      },
    ],
    documents: [],
    createdAt: '2025-06-01T00:00:00Z',
    updatedAt: '2025-06-01T00:00:00Z',
    ...overrides,
  };
}

describe('deriveApprovedQuoteResponses', () => {
  it('returns only approved responses with vendorId and project carried through', () => {
    const result = deriveApprovedQuoteResponses(makeRfq());

    expect(result).toHaveLength(1);
    expect(result[0].responseId).toBe('qr-approved');
    expect(result[0].vendorId).toBe('vendor-9');
    expect(result[0].vendorName).toBe('Vendor A');
    expect(result[0].projectId).toBe('proj-1');
    expect(result[0].rfqReference).toBe('RFQ-001');
  });

  it('derives per-line items with spread pricing from the response total', () => {
    const [response] = deriveApprovedQuoteResponses(makeRfq());

    expect(response.lineItems).toHaveLength(2);
    // perItemCost = 2000 / 2 = 1000; unit price = 1000 / quantity
    expect(response.lineItems[0].itemReference).toBe('Steel Beam');
    expect(response.lineItems[0].pricePerUnit).toBe(100); // 1000 / 10
    expect(response.lineItems[0].lineTotalWithTax).toBe(1000);
    expect(response.lineItems[1].pricePerUnit).toBe(25); // 1000 / 40
    expect(response.lineItems[0].description).toBe('Heavy duty');
    expect(response.lineItems[1].description).toBe(''); // null coerced to empty
  });

  it('falls back to the RFQ name when rfqNumber is null', () => {
    const [response] = deriveApprovedQuoteResponses(makeRfq({ rfqNumber: null }));
    expect(response.rfqReference).toBe('Alpha RFQ');
  });

  it('returns an empty array when no response is approved', () => {
    const rfq = makeRfq();
    rfq.quoteResponses = rfq.quoteResponses.map((qr) => ({ ...qr, status: 'SUBMITTED' }));
    expect(deriveApprovedQuoteResponses(rfq)).toEqual([]);
  });
});
