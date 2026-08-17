import type { PoDetail } from '@forethread/api-client';
import { describe, it, expect } from 'vitest';

import { EMPTY_LINE_ITEM, type FormValues } from '../schemas/create-po.schema';

import { computePoChangedFields, deriveChangeType, hasAnyChange } from './change-diff';

function makePo(overrides: Partial<PoDetail> = {}): PoDetail {
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
    subtotal: 100,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 100,
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
    createdBy: { id: 'u-1', name: 'Sarah Chen' },
    lastModifiedBy: null,
    vendor: { id: 'v-1', name: 'Acme' },
    company: { id: 'c-1', name: 'Buildco' },
    lineItems: [
      {
        id: 'li-1',
        lineNumber: 1,
        materialId: null,
        materialName: 'Aluminum Beam 6061',
        materialCode: 'AB-6061',
        description: null,
        quantityOrdered: 10,
        quantityDelivered: 0,
        unitOfMeasure: 'EA',
        unitPrice: 30,
        lineTotal: 300,
        costCode: '123456789',
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

function makeForm(po: PoDetail, overrides: Partial<FormValues> = {}): FormValues {
  return {
    documentName: po.documentName ?? '',
    projectId: po.projectId,
    vendorId: po.vendor.id,
    paymentTermsDays: po.paymentTermsDays ?? undefined,
    deliveryLocationId: po.deliveryLocationId ?? '',
    plannedDeliveryDate: po.plannedDeliveryDate ? po.plannedDeliveryDate.slice(0, 10) : '',
    pickUp: false,
    pickUpTimeExpectation: undefined,
    holdForRelease: false,
    message: po.message ?? '',
    deliveries: [],
    lineItems: po.lineItems.map((li) => ({
      ...EMPTY_LINE_ITEM,
      lineItemId: li.id,
      materialName: li.materialName ?? '',
      materialCode: li.materialCode ?? '',
      costCode: li.costCode ?? '',
      unitOfMeasure: li.unitOfMeasure,
      unitPrice: li.unitPrice,
      quantityOrdered: li.quantityOrdered,
      expectedDeliveryDate: li.expectedDeliveryDate ? li.expectedDeliveryDate.slice(0, 10) : '',
      description: li.description ?? '',
      notes: li.notes ?? '',
    })),
    ...overrides,
  } as FormValues;
}

describe('computePoChangedFields', () => {
  it('returns an empty payload when nothing changed', () => {
    const po = makePo();
    const form = makeForm(po);
    const diff = computePoChangedFields(form, po);
    expect(diff).toEqual({});
    expect(hasAnyChange(diff)).toBe(false);
  });

  it('captures a PO-level field change (paymentTermsDays 30 → 10)', () => {
    const po = makePo();
    const form = makeForm(po, { paymentTermsDays: 10 });
    const diff = computePoChangedFields(form, po);
    expect(diff.fields?.paymentTermsDays).toEqual({ from: 30, to: 10 });
    expect(hasAnyChange(diff)).toBe(true);
  });

  it('captures a per-line change matched by lineItemId (unitPrice 30 → 10)', () => {
    const po = makePo();
    const form = makeForm(po);
    form.lineItems[0].unitPrice = 10;
    form.lineItems[0].costCode = '8765432';
    const diff = computePoChangedFields(form, po);
    expect(diff.lineItems).toHaveLength(1);
    expect(diff.lineItems?.[0].lineItemId).toBe('li-1');
    expect(diff.lineItems?.[0].name).toBe('Aluminum Beam 6061');
    expect(diff.lineItems?.[0].changes.unitPrice).toEqual({ from: 30, to: 10 });
    expect(diff.lineItems?.[0].changes.costCode).toEqual({ from: '123456789', to: '8765432' });
  });

  it('reports form rows with no lineItemId as addedLineItems', () => {
    const po = makePo();
    const form = makeForm(po);
    form.lineItems.push({
      ...EMPTY_LINE_ITEM,
      materialName: 'New Material',
      materialId: 'mat-9',
      unitOfMeasure: 'EA',
      unitPrice: 5,
      quantityOrdered: 2,
      expectedDeliveryDate: '2025-02-01',
      notes: 'urgent',
    });
    const diff = computePoChangedFields(form, po);
    expect(diff.lineItems).toBeUndefined();
    expect(diff.addedLineItems).toEqual([
      {
        name: 'New Material',
        materialId: 'mat-9',
        materialCode: undefined,
        description: 'New Material',
        quantityOrdered: 2,
        unitOfMeasure: 'EA',
        unitPrice: 5,
        costCode: undefined,
        upc: undefined,
        manufacturerPartNumber: undefined,
        taxCode: undefined,
        expectedDeliveryDate: '2025-02-01',
        deliveryTime: undefined,
        notes: 'urgent',
      },
    ]);
    expect(hasAnyChange(diff)).toBe(true);
    expect(deriveChangeType(diff)).toBe('COMMERCIAL');
  });

  it('skips incomplete added rows (the wizard blank trailing row)', () => {
    const po = makePo();
    const form = makeForm(po);
    form.lineItems.push({ ...EMPTY_LINE_ITEM });
    form.lineItems.push({ ...EMPTY_LINE_ITEM, materialName: 'No qty yet', unitOfMeasure: 'EA' });
    const diff = computePoChangedFields(form, po);
    expect(diff.addedLineItems).toBeUndefined();
    expect(hasAnyChange(diff)).toBe(false);
  });

  it('treats empty/undefined/null as equal (no spurious diff)', () => {
    const po = makePo({ message: null });
    const form = makeForm(po, { message: '' });
    const diff = computePoChangedFields(form, po);
    expect(diff.fields?.message).toBeUndefined();
  });

  it('captures a per-line delivery time change (FOR-352)', () => {
    const po = makePo({
      lineItems: [{ ...makePo().lineItems[0], deliveryTime: '09:00' }],
    } as Partial<PoDetail>);
    const form = makeForm(po);
    form.lineItems[0].deliveryTime = '14:30';
    const diff = computePoChangedFields(form, po);
    expect(diff.lineItems?.[0].changes.deliveryTime).toEqual({ from: '09:00', to: '14:30' });
    expect(deriveChangeType(diff)).toBe('COMMERCIAL');
  });

  it('reports PO lines missing from the form as removedLineItems (FOR-352)', () => {
    const po = makePo({
      lineItems: [
        makePo().lineItems[0],
        {
          ...makePo().lineItems[0],
          id: 'li-2',
          lineNumber: 2,
          materialName: 'Copper Pipe',
          materialCode: 'CP-1',
        },
      ],
      lineItemCount: 2,
    } as Partial<PoDetail>);
    const form = makeForm(po);
    // The editor deleted the second row.
    form.lineItems = form.lineItems.filter((li) => li.lineItemId !== 'li-2');

    const diff = computePoChangedFields(form, po);
    expect(diff.removedLineItems).toEqual([{ lineItemId: 'li-2', name: 'Copper Pipe' }]);
    expect(diff.lineItems).toBeUndefined();
    expect(hasAnyChange(diff)).toBe(true);
  });

  it('reports no removals when every PO line still has a form row', () => {
    const po = makePo();
    const form = makeForm(po);
    const diff = computePoChangedFields(form, po);
    expect(diff.removedLineItems).toBeUndefined();
  });
});

describe('deriveChangeType', () => {
  it('is COMMERCIAL when a commercial PO field moved (paymentTermsDays)', () => {
    expect(deriveChangeType({ fields: { paymentTermsDays: { from: 30, to: 10 } } })).toBe(
      'COMMERCIAL',
    );
  });

  it('is COMMERCIAL when a commercial line field moved (unitPrice)', () => {
    expect(
      deriveChangeType({
        lineItems: [{ lineItemId: 'li-1', name: 'x', changes: { unitPrice: { from: 1, to: 2 } } }],
      }),
    ).toBe('COMMERCIAL');
  });

  it('is INTERNAL for note-only / cosmetic changes (costCode, message)', () => {
    expect(
      deriveChangeType({
        fields: { message: { from: 'a', to: 'b' } },
        lineItems: [
          { lineItemId: 'li-1', name: 'x', changes: { costCode: { from: '1', to: '2' } } },
        ],
      }),
    ).toBe('INTERNAL');
  });

  it('is COMMERCIAL for a cancellation request (FOR-352)', () => {
    expect(deriveChangeType({ cancelPo: true })).toBe('COMMERCIAL');
  });

  it('is COMMERCIAL when line items are removed (FOR-352)', () => {
    expect(deriveChangeType({ removedLineItems: [{ lineItemId: 'li-1', name: 'x' }] })).toBe(
      'COMMERCIAL',
    );
  });

  it('is COMMERCIAL when line items are added', () => {
    expect(
      deriveChangeType({
        addedLineItems: [{ name: 'x', quantityOrdered: 1, unitOfMeasure: 'EA', unitPrice: 2 }],
      }),
    ).toBe('COMMERCIAL');
  });
});

describe('hasAnyChange (FOR-352 extensions)', () => {
  it('is true for a cancellation-only payload', () => {
    expect(hasAnyChange({ cancelPo: true })).toBe(true);
  });

  it('is true for a removal-only payload', () => {
    expect(hasAnyChange({ removedLineItems: [{ lineItemId: 'li-1', name: 'x' }] })).toBe(true);
  });

  it('is true for an addition-only payload', () => {
    expect(
      hasAnyChange({
        addedLineItems: [{ name: 'x', quantityOrdered: 1, unitOfMeasure: 'EA', unitPrice: 2 }],
      }),
    ).toBe(true);
  });

  it('stays false for an empty payload', () => {
    expect(hasAnyChange({})).toBe(false);
  });
});
