import type { RfqDetail, BulkOrderDetail, PoDetail } from '@forethread/api-client';
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
          materialName: 'Concrete',
          description: 'High-grade concrete',
          quantity: 100,
          unit: 'kg',
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

  it('falls back to poNumber when documentName is null', () => {
    const { defaultValues } = poToFormDefaults(makePoDetail({ documentName: null }));
    expect(defaultValues.documentName).toBe('PO-2024-008');
  });
});
