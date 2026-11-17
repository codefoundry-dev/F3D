import type { RfqDetail, RfqQuoteLine, BulkOrderDetail, PoDetail } from '@forethread/api-client';
import { describe, it, expect } from 'vitest';

import { EMPTY_LINE_ITEM } from '../schemas/create-po.schema';

import { rfqToFormDefaults, bulkOrderToFormDefaults, poToFormDefaults } from './source-to-form';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRfq(overrides: Partial<RfqDetail> = {}): RfqDetail {
  return {
    id: 'rfq-1',
    name: 'Test RFQ',
    projectName: 'Project Alpha',
    projectId: 'proj-1',
    status: 'APPROVED',
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
    createdBy: { id: 'u-1', name: 'User One' },
    lastModifiedBy: null,
    lineItems: [],
    vendors: [],
    quoteResponses: [],
    documents: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeBulkOrder(overrides: Partial<BulkOrderDetail> = {}): BulkOrderDetail {
  return {
    id: 'bo-1',
    bulkId: 'bo-1',
    rfqReference: null,
    contractorName: 'Contractor A',
    vendorName: 'Vendor A',
    projectName: 'Project Beta',
    createdDate: '2026-01-01',
    endDate: null,
    createdBy: 'User One',
    lineItems: [],
    ...overrides,
  };
}

// ── rfqToFormDefaults ───────────────────────────────────────────────────────

describe('rfqToFormDefaults', () => {
  it('maps RFQ line items to form line items correctly', () => {
    const rfq = makeRfq({
      lineItems: [
        {
          id: 'li-1',
          projectName: 'Project Alpha',
          materialId: 'mat-1',
          materialName: 'Concrete',
          description: 'High-grade concrete',
          quantity: 100,
          unit: 'kg',
          costCode: 'CC-01',
          upc: '012345678905',
          manufacturerPartNumber: 'MPN-7',
          taxCode: 'GST',
          expectedDeliveryDate: '2026-03-01',
          deliveryLocation: null,
        },
        {
          id: 'li-2',
          projectName: 'Project Alpha',
          materialName: 'Steel Rebar',
          description: null,
          quantity: 50,
          unit: 'm',
          expectedDeliveryDate: null,
          deliveryLocation: null,
        },
      ],
    });

    const { defaultValues } = rfqToFormDefaults(rfq);

    expect(defaultValues.lineItems).toHaveLength(2);
    expect(defaultValues.lineItems![0]).toEqual({
      ...EMPTY_LINE_ITEM,
      materialName: 'Concrete',
      materialId: 'mat-1',
      costCode: 'CC-01',
      upc: '012345678905',
      manufacturerPartNumber: 'MPN-7',
      taxCode: 'GST',
      description: 'High-grade concrete',
      unitOfMeasure: 'kg',
      quantityOrdered: 100,
      expectedDeliveryDate: '2026-03-01',
      deliveryLocationId: '',
    });
    expect(defaultValues.lineItems![1]).toEqual({
      ...EMPTY_LINE_ITEM,
      materialName: 'Steel Rebar',
      description: '',
      unitOfMeasure: 'm',
      quantityOrdered: 50,
      expectedDeliveryDate: '',
      deliveryLocationId: '',
    });
  });

  it('carries the RFQ line catalogue image onto the PO row (FOR-402)', () => {
    const line = {
      id: 'li-1',
      projectName: 'Project Alpha',
      materialId: 'mat-1',
      materialName: 'Concrete',
      description: null,
      quantity: 100,
      unit: 'kg',
      expectedDeliveryDate: null,
      deliveryLocation: null,
    };
    const rfq = makeRfq({
      lineItems: [
        { ...line, imageUrl: 'https://cdn.example/concrete.png' },
        { ...line, id: 'li-2', materialId: null, materialName: 'Free text', imageUrl: null },
      ],
    });

    const { defaultValues } = rfqToFormDefaults(rfq);

    expect(defaultValues.lineItems![0].imageUrl).toBe('https://cdn.example/concrete.png');
    expect(defaultValues.lineItems![1].imageUrl).toBeUndefined();
  });

  it('sets lockedFields to projectId, deliveryLocationId, plannedDeliveryDate', () => {
    const { lockedFields } = rfqToFormDefaults(makeRfq());

    expect(lockedFields).toEqual(
      new Set(['projectId', 'deliveryLocationId', 'plannedDeliveryDate']),
    );
  });

  it('prefills documentName from RFQ name', () => {
    const rfq = makeRfq({ name: 'Materials Batch 3' });
    const { defaultValues } = rfqToFormDefaults(rfq);

    expect(defaultValues.documentName).toBe('PO — Materials Batch 3');
  });

  it('sets documentName to empty string when RFQ has no name', () => {
    const rfq = makeRfq({ name: '' });
    const { defaultValues } = rfqToFormDefaults(rfq);

    expect(defaultValues.documentName).toBe('');
  });

  it('prefills projectId from RFQ', () => {
    const rfq = makeRfq({ projectId: 'proj-42' });
    const { defaultValues } = rfqToFormDefaults(rfq);

    expect(defaultValues.projectId).toBe('proj-42');
  });

  it('prefills vendorId from first approved vendor', () => {
    const rfq = makeRfq({
      vendors: [
        {
          id: 'v-1',
          name: 'Vendor A',
          avatarUrl: null,
          category: null,
          location: null,
          approved: false,
          contacts: [],
        },
        {
          id: 'v-2',
          name: 'Vendor B',
          avatarUrl: null,
          category: null,
          location: null,
          approved: true,
          contacts: [],
        },
        {
          id: 'v-3',
          name: 'Vendor C',
          avatarUrl: null,
          category: null,
          location: null,
          approved: true,
          contacts: [],
        },
      ],
    });

    const { defaultValues } = rfqToFormDefaults(rfq);

    expect(defaultValues.vendorId).toBe('v-2');
  });

  it('sets vendorId to empty string when no approved vendor exists', () => {
    const rfq = makeRfq({
      vendors: [
        {
          id: 'v-1',
          name: 'Vendor A',
          avatarUrl: null,
          category: null,
          location: null,
          approved: false,
          contacts: [],
        },
      ],
    });

    const { defaultValues } = rfqToFormDefaults(rfq);

    expect(defaultValues.vendorId).toBe('');
  });

  it('falls back to deadlineEnd for delivery date', () => {
    const rfq = makeRfq({
      deadlineEnd: '2026-06-15',
      needByDate: '2026-07-01',
    });

    const { defaultValues } = rfqToFormDefaults(rfq);

    expect(defaultValues.plannedDeliveryDate).toBe('2026-06-15');
  });

  it('falls back to needByDate when deadlineEnd is null', () => {
    const rfq = makeRfq({
      deadlineEnd: null,
      needByDate: '2026-07-01',
    });

    const { defaultValues } = rfqToFormDefaults(rfq);

    expect(defaultValues.plannedDeliveryDate).toBe('2026-07-01');
  });

  it('sets plannedDeliveryDate to empty string when both dates are null', () => {
    const rfq = makeRfq({
      deadlineEnd: null,
      needByDate: null,
    });

    const { defaultValues } = rfqToFormDefaults(rfq);

    expect(defaultValues.plannedDeliveryDate).toBe('');
  });

  it('returns empty line item array when RFQ has no line items', () => {
    const rfq = makeRfq({ lineItems: [] });
    const { defaultValues } = rfqToFormDefaults(rfq);

    expect(defaultValues.lineItems).toEqual([{ ...EMPTY_LINE_ITEM }]);
  });
});

// ── bulkOrderToFormDefaults ─────────────────────────────────────────────────

// ── rfqToFormDefaults: quoted prices (FOR-391) ───────────────────────────

describe('rfqToFormDefaults — quoted prices (FOR-391)', () => {
  const line = (id: string, projectId: string | null = null): RfqDetail['lineItems'][number] => ({
    id,
    projectId,
    projectName: 'Project Alpha',
    materialName: `Material ${id}`,
    description: null,
    quantity: 10,
    unit: 'pcs',
    expectedDeliveryDate: null,
    deliveryLocation: null,
  });
  const quoteLine = (
    id: string,
    rfqLineItemId: string,
    overrides: Partial<RfqQuoteLine> = {},
  ): RfqQuoteLine => ({
    id,
    rfqLineItemId,
    unitPrice: 0,
    quotedQuantity: 10,
    approvedQuantity: null,
    availability: 'AVAILABLE',
    status: 'PENDING',
    deliveryDate: null,
    deliveryVarianceDays: null,
    ...overrides,
  });
  const quote = (
    id: string,
    vendorId: string,
    status: string,
    lineItems: RfqQuoteLine[],
  ): RfqDetail['quoteResponses'][number] => ({
    id,
    vendorId,
    vendorName: vendorId,
    totalCost: 9999,
    discountPercent: null,
    discountAmount: null,
    itemsCovered: lineItems.length,
    totalItems: 3,
    status,
    submittedAt: null,
    lineItems,
  });
  const vendor = (id: string, approved: boolean) =>
    ({ id, name: id, approved }) as unknown as RfqDetail['vendors'][number];

  const rfq = makeRfq({
    lineItems: [line('li-1'), line('li-2'), line('li-3', 'proj-2')],
    vendors: [vendor('v-1', true), vendor('v-2', true)],
    quoteResponses: [
      quote('q-1', 'v-1', 'APPROVED', [
        quoteLine('ql-1', 'li-1', { unitPrice: 12.5 }),
        quoteLine('ql-2', 'li-2', { availability: 'NO_QUOTE' }),
        quoteLine('ql-3', 'li-3', { unitPrice: 7, approvedQuantity: 4 }),
      ]),
      quote('q-2', 'v-2', 'APPROVED', [
        quoteLine('ql-4', 'li-1', { unitPrice: 11 }),
        quoteLine('ql-5', 'li-2', { unitPrice: 3, status: 'DECLINED' }),
      ]),
    ],
  });

  it('prices each line at the quoted unit price and tags its quote line', () => {
    const { defaultValues } = rfqToFormDefaults(rfq);
    expect(defaultValues.vendorId).toBe('v-1');
    expect(defaultValues.lineItems?.map((li) => [li.quoteLineItemId, li.unitPrice])).toEqual([
      ['ql-1', 12.5],
      ['ql-3', 7],
    ]);
  });

  it('leaves out lines the vendor did not quote and uses the awarded quantity', () => {
    const { defaultValues } = rfqToFormDefaults(rfq);
    expect(defaultValues.lineItems?.map((li) => li.materialName)).toEqual([
      'Material li-1',
      'Material li-3',
    ]);
    expect(defaultValues.lineItems?.[1].quantityOrdered).toBe(4);
  });

  it('buys from the named quote, skipping declined lines', () => {
    const { defaultValues } = rfqToFormDefaults(rfq, { quoteResponseId: 'q-2' });
    expect(defaultValues.vendorId).toBe('v-2');
    expect(defaultValues.lineItems?.map((li) => li.quoteLineItemId)).toEqual(['ql-4']);
  });

  it('follows picked quote lines to their own quote', () => {
    const { defaultValues } = rfqToFormDefaults(rfq, { quoteLineItemIds: new Set(['ql-4']) });
    expect(defaultValues.vendorId).toBe('v-2');
    expect(defaultValues.lineItems?.map((li) => li.unitPrice)).toEqual([11]);
  });

  it('narrows to one project', () => {
    const { defaultValues } = rfqToFormDefaults(rfq, { projectId: 'proj-2' });
    expect(defaultValues.projectId).toBe('proj-2');
    expect(defaultValues.lineItems?.map((li) => li.quoteLineItemId)).toEqual(['ql-3']);
  });

  it('only takes approved lines from a quote that is not itself approved', () => {
    const pending = makeRfq({
      lineItems: [line('li-1'), line('li-2')],
      quoteResponses: [
        quote('q-9', 'v-9', 'SUBMITTED', [
          quoteLine('ql-a', 'li-1', { unitPrice: 5, status: 'APPROVED' }),
          quoteLine('ql-b', 'li-2', { unitPrice: 6 }),
        ]),
      ],
    });
    const { defaultValues } = rfqToFormDefaults(pending, { quoteResponseId: 'q-9' });
    expect(defaultValues.lineItems?.map((li) => li.quoteLineItemId)).toEqual(['ql-a']);
  });
});

describe('bulkOrderToFormDefaults', () => {
  it('maps bulk order line items correctly using qtyRemaining when > 0', () => {
    const bo = makeBulkOrder({
      lineItems: [
        {
          lineItemId: 'li-1',
          itemReference: 'REF-001',
          description: 'Structural Steel',
          qty: 200,
          unit: 'tons',
          ordered: 100,
          qtyRemaining: 100,
          deliveriesPercent: 50,
          pricePerUnit: 500,
          totalLineInc: 100000,
        },
      ],
    });

    const { defaultValues } = bulkOrderToFormDefaults(bo);

    expect(defaultValues.lineItems).toHaveLength(1);
    expect(defaultValues.lineItems![0]).toEqual({
      ...EMPTY_LINE_ITEM,
      materialName: 'Structural Steel',
      materialCode: 'REF-001',
      unitOfMeasure: 'tons',
      unitPrice: 500,
      quantityOrdered: 100, // qtyRemaining
      bulkOrderLineItemId: 'li-1',
      availableQty: 100,
    });
  });

  it('carries bulkOrderLineItemId + availableQty (= qtyRemaining) on each line', () => {
    const bo = makeBulkOrder({
      lineItems: [
        {
          lineItemId: 'li-42',
          itemReference: 'REF-009',
          description: 'Cement',
          qty: 80,
          unit: 'bags',
          ordered: 30,
          qtyRemaining: 50,
          deliveriesPercent: 0,
          pricePerUnit: 10,
          totalLineInc: 800,
        },
      ],
    });

    const { defaultValues } = bulkOrderToFormDefaults(bo);

    expect(defaultValues.lineItems![0].bulkOrderLineItemId).toBe('li-42');
    expect(defaultValues.lineItems![0].availableQty).toBe(50);
  });

  it('falls back to qty when qtyRemaining is 0', () => {
    const bo = makeBulkOrder({
      lineItems: [
        {
          lineItemId: 'li-1',
          itemReference: 'REF-002',
          description: 'Timber Planks',
          qty: 50,
          unit: 'pcs',
          ordered: 0,
          qtyRemaining: 0,
          deliveriesPercent: 0,
          pricePerUnit: 25,
          totalLineInc: 1250,
        },
      ],
    });

    const { defaultValues } = bulkOrderToFormDefaults(bo);

    expect(defaultValues.lineItems![0].quantityOrdered).toBe(50); // falls back to qty
  });

  it('uses itemReference as materialName when description is empty', () => {
    const bo = makeBulkOrder({
      lineItems: [
        {
          lineItemId: 'li-1',
          itemReference: 'REF-003',
          description: '',
          qty: 10,
          unit: 'pcs',
          ordered: 0,
          qtyRemaining: 5,
          deliveriesPercent: 0,
          pricePerUnit: 100,
          totalLineInc: 1000,
        },
      ],
    });

    const { defaultValues } = bulkOrderToFormDefaults(bo);

    expect(defaultValues.lineItems![0].materialName).toBe('REF-003');
  });

  it('sets lockedFields to vendorId only when no ids are supplied', () => {
    const { lockedFields } = bulkOrderToFormDefaults(makeBulkOrder());

    expect(lockedFields).toEqual(new Set(['vendorId']));
  });

  it('locks projectId and prefills both ids when supplied (drawdown)', () => {
    const { defaultValues, lockedFields } = bulkOrderToFormDefaults(makeBulkOrder(), {
      projectId: 'proj-7',
      vendorId: 'vend-3',
    });

    expect(defaultValues.projectId).toBe('proj-7');
    expect(defaultValues.vendorId).toBe('vend-3');
    expect(lockedFields).toEqual(new Set(['vendorId', 'projectId']));
  });

  it('does not lock projectId when only vendorId is resolved', () => {
    const { defaultValues, lockedFields } = bulkOrderToFormDefaults(makeBulkOrder(), {
      vendorId: 'vend-3',
    });

    expect(defaultValues.projectId).toBe('');
    expect(defaultValues.vendorId).toBe('vend-3');
    expect(lockedFields).toEqual(new Set(['vendorId']));
  });

  it('prefills documentName from project name', () => {
    const bo = makeBulkOrder({ projectName: 'Skyline Tower' });
    const { defaultValues } = bulkOrderToFormDefaults(bo);

    expect(defaultValues.documentName).toBe('PO — Skyline Tower');
  });

  it('sets documentName to empty string when projectName is empty', () => {
    const bo = makeBulkOrder({ projectName: '' });
    const { defaultValues } = bulkOrderToFormDefaults(bo);

    expect(defaultValues.documentName).toBe('');
  });

  it('returns empty line item when BO has no items', () => {
    const bo = makeBulkOrder({ lineItems: [] });
    const { defaultValues } = bulkOrderToFormDefaults(bo);

    expect(defaultValues.lineItems).toEqual([{ ...EMPTY_LINE_ITEM }]);
  });

  it('sets vendorId to empty string', () => {
    const { defaultValues } = bulkOrderToFormDefaults(makeBulkOrder());

    expect(defaultValues.vendorId).toBe('');
  });
});

// ── poToFormDefaults (FLOW 3) ─────────────────────────────────────────────────

function makePoDetail(overrides: Partial<PoDetail> = {}): PoDetail {
  return {
    id: 'po-1',
    poNumber: 'PO-2024-008',
    documentName: 'PO 008',
    projectName: 'Proj',
    projectId: 'proj-1',
    status: 'SENT',
    poType: 'STANDARD',
    approvalStatus: null,
    sourceOfCreation: 'MANUAL',
    revision: 0,
    priority: null,
    pickUp: false,
    holdForRelease: false,
    deliveryLocationId: 'loc-1',
    deliveryLocationName: 'Site A',
    pickUpLocation: null,
    pickUpTimeExpectation: null,
    pickUpPersonName: null,
    pickUpPersonPhone: null,
    currency: 'AUD',
    subtotal: 300,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 300,
    paymentTermsDays: 30,
    costCode: null,
    message: 'hello',
    deliveryResponsibleName: null,
    deliveryResponsibleEmail: null,
    lineItemCount: 1,
    totalRequestedQty: 10,
    deadlineStart: null,
    deadlineEnd: null,
    plannedDeliveryDate: '2025-01-20T00:00:00.000Z',
    deliveryNotes: null,
    issuedAt: null,
    parentPoId: null,
    rfqId: null,
    approvedBy: null,
    createdBy: { id: 'u-1', name: 'Sarah' },
    lastModifiedBy: null,
    vendor: { id: 'v-1', name: 'Acme' },
    company: { id: 'c-1', name: 'Buildco' },
    lineItems: [
      {
        id: 'li-1',
        lineNumber: 1,
        materialId: null,
        materialName: 'Beam',
        materialCode: 'B1',
        description: null,
        quantityOrdered: 10,
        quantityDelivered: 0,
        unitOfMeasure: 'EA',
        unitPrice: 30,
        lineTotal: 300,
        costCode: '111',
        expectedDeliveryDate: '2025-01-20T00:00:00.000Z',
        deliveryLocation: null,
        notes: null,
        pickUp: false,
      },
    ],
    documents: [],
    deliveries: [],
    invoices: [],
    createdAt: '2024-12-12T12:00:00.000Z',
    updatedAt: '2024-12-12T12:00:00.000Z',
    ...overrides,
  };
}

describe('poToFormDefaults', () => {
  it('prefills PO-level fields and trims the planned delivery date to yyyy-MM-dd', () => {
    const { defaultValues } = poToFormDefaults(makePoDetail());
    expect(defaultValues.documentName).toBe('PO 008');
    expect(defaultValues.projectId).toBe('proj-1');
    expect(defaultValues.vendorId).toBe('v-1');
    expect(defaultValues.paymentTermsDays).toBe(30);
    expect(defaultValues.deliveryLocationId).toBe('loc-1');
    expect(defaultValues.plannedDeliveryDate).toBe('2025-01-20');
    expect(defaultValues.message).toBe('hello');
  });

  it('carries each PO line item id as lineItemId and prefills line fields', () => {
    const { defaultValues } = poToFormDefaults(makePoDetail());
    expect(defaultValues.lineItems).toHaveLength(1);
    expect(defaultValues.lineItems![0].lineItemId).toBe('li-1');
    expect(defaultValues.lineItems![0].materialName).toBe('Beam');
    expect(defaultValues.lineItems![0].unitPrice).toBe(30);
    expect(defaultValues.lineItems![0].quantityOrdered).toBe(10);
    expect(defaultValues.lineItems![0].costCode).toBe('111');
    expect(defaultValues.lineItems![0].expectedDeliveryDate).toBe('2025-01-20');
  });

  it('carries the line catalogue image for display, and none without one (FOR-402)', () => {
    const base = makePoDetail();
    const withImage = poToFormDefaults(
      makePoDetail({
        lineItems: [{ ...base.lineItems[0], imageUrl: 'https://cdn.example/beam.png' }],
      }),
    );
    expect(withImage.defaultValues.lineItems![0].imageUrl).toBe('https://cdn.example/beam.png');

    const withNull = poToFormDefaults(
      makePoDetail({ lineItems: [{ ...base.lineItems[0], imageUrl: null }] }),
    );
    expect(withNull.defaultValues.lineItems![0].imageUrl).toBeUndefined();
    expect(poToFormDefaults(base).defaultValues.lineItems![0].imageUrl).toBeUndefined();
  });

  it('falls back to poNumber when documentName is null', () => {
    const { defaultValues } = poToFormDefaults(makePoDetail({ documentName: null }));
    expect(defaultValues.documentName).toBe('PO-2024-008');
  });

  it('prefills the line-level delivery location from the detail id', () => {
    const po = makePoDetail();
    po.lineItems[0].deliveryLocation = 'loc-9';
    const { defaultValues } = poToFormDefaults(po);
    expect(defaultValues.lineItems![0].deliveryLocationId).toBe('loc-9');
  });

  it('leaves the line-level delivery location blank when the PO has none', () => {
    const { defaultValues } = poToFormDefaults(makePoDetail());
    expect(defaultValues.lineItems![0].deliveryLocationId).toBe('');
  });

  it('prefills the FOR-210 delivery schedule and trims delivery dates to yyyy-MM-dd', () => {
    const { defaultValues } = poToFormDefaults(
      makePoDetail({
        deliveries: [
          {
            id: 'd-1',
            deliveryLocationId: 'loc-1',
            deliveryLocationName: 'Site A',
            deliveryDate: '2025-02-05T00:00:00.000Z',
            notes: 'Gate 3',
            sequence: 0,
          },
          {
            id: 'd-2',
            deliveryLocationId: 'loc-2',
            deliveryLocationName: 'Site B',
            deliveryDate: null,
            notes: null,
            sequence: 1,
          },
        ],
      }),
    );

    expect(defaultValues.deliveries).toEqual([
      { deliveryLocationId: 'loc-1', deliveryDate: '2025-02-05', notes: 'Gate 3' },
      { deliveryLocationId: 'loc-2', deliveryDate: '', notes: '' },
    ]);
  });

  it('keeps one blank delivery row when the PO has no delivery schedule', () => {
    const { defaultValues } = poToFormDefaults(makePoDetail({ deliveries: [] }));
    expect(defaultValues.deliveries).toEqual([
      { deliveryLocationId: '', deliveryDate: '', notes: '' },
    ]);
  });
});
