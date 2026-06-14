const mockNotifyError = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  notificationService: { error: mockNotifyError, success: vi.fn() },
}));

vi.mock('@forethread/api-client', () => ({
  uploadPoDocument: vi.fn(() => Promise.resolve()),
}));

import type { CreatePurchaseOrderInput } from '@forethread/api-client';
import { act, renderHook } from '@testing-library/react';

import { EMPTY_LINE_ITEM, type FormValues } from '../schemas/create-po.schema';

import { usePoWizardForm } from './usePoWizardForm';

interface Captured {
  input: CreatePurchaseOrderInput | null;
}

function setup(
  creationMode: 'manual' | 'from-bulk-order',
  bulkOrderId: string | undefined,
  captured: Captured,
) {
  const onCreatePo = vi.fn(
    (input: CreatePurchaseOrderInput, cb: { onSuccess: (po: { id: string }) => void }) => {
      captured.input = input;
      cb.onSuccess({ id: 'po-1' });
    },
  );

  const hook = renderHook(() =>
    usePoWizardForm({
      onNavigateBack: vi.fn(),
      onCreatePo,
      noLineItemsMsg: 'no-items',
      drawdownExceedsMsg: 'exceeds',
      creationMode,
      bulkOrderId,
      projectDetail: { currency: 'AUD' } as never,
    }),
  );

  // Fill the minimum step-1 fields the payload needs.
  act(() => {
    hook.result.current.form.setValue('documentName', 'PO — Test');
    hook.result.current.form.setValue('projectId', 'proj-1');
    hook.result.current.form.setValue('deliveryLocationId', 'loc-1');
    hook.result.current.form.setValue('plannedDeliveryDate', '2026-07-01');
  });

  return { hook, onCreatePo };
}

function setLineItems(
  hook: ReturnType<typeof setup>['hook'],
  items: Partial<FormValues['lineItems'][number]>[],
) {
  act(() => {
    hook.result.current.form.setValue(
      'lineItems',
      items.map((it) => ({ ...EMPTY_LINE_ITEM, ...it })) as FormValues['lineItems'],
    );
  });
}

describe('usePoWizardForm — drawdown payload (US 5.09)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forwards bulkOrderId + per-line bulkOrderLineItemId and forces poType DRAWDOWN', async () => {
    const captured: Captured = { input: null };
    const { hook } = setup('from-bulk-order', 'bo-1', captured);
    setLineItems(hook, [
      {
        materialName: 'Steel',
        unitOfMeasure: 'kg',
        unitPrice: 5,
        quantityOrdered: 10,
        bulkOrderLineItemId: 'boli-1',
        availableQty: 60,
      },
    ]);

    await act(async () => {
      hook.result.current.onSubmit(hook.result.current.form.getValues());
    });

    expect(captured.input?.poType).toBe('DRAWDOWN');
    expect(captured.input?.sourceOfCreation).toBe('BULK_DRAWDOWN');
    expect(captured.input?.bulkOrderId).toBe('bo-1');
    expect(captured.input?.lineItems[0].bulkOrderLineItemId).toBe('boli-1');
  });

  it('does not set bulkOrderId or line refs in manual mode', async () => {
    const captured: Captured = { input: null };
    const { hook } = setup('manual', undefined, captured);
    setLineItems(hook, [
      {
        materialName: 'Steel',
        unitOfMeasure: 'kg',
        unitPrice: 5,
        quantityOrdered: 10,
        bulkOrderLineItemId: 'boli-1',
        availableQty: 60,
      },
    ]);

    await act(async () => {
      hook.result.current.onSubmit(hook.result.current.form.getValues());
    });

    expect(captured.input?.poType).toBe('STANDARD');
    expect(captured.input?.bulkOrderId).toBeUndefined();
    expect(captured.input?.lineItems[0].bulkOrderLineItemId).toBeUndefined();
  });

  it('blocks Continue on step 2 when a line exceeds its available qty', () => {
    const captured: Captured = { input: null };
    const { hook } = setup('from-bulk-order', 'bo-1', captured);
    // Move to step 2 first.
    act(() => hook.result.current.setStep(2));
    setLineItems(hook, [
      {
        materialName: 'Steel',
        unitOfMeasure: 'kg',
        unitPrice: 5,
        quantityOrdered: 100, // exceeds availableQty 60
        bulkOrderLineItemId: 'boli-1',
        availableQty: 60,
      },
    ]);

    // canContinue gate should be false.
    expect(hook.result.current.canContinue).toBe(false);

    // handleContinue should surface the error and stay on step 2.
    act(() => {
      void hook.result.current.handleContinue();
    });
    expect(mockNotifyError).toHaveBeenCalledWith('exceeds');
    expect(hook.result.current.step).toBe(2);
  });

  it('allows Continue when ordered qty is within the available qty', () => {
    const captured: Captured = { input: null };
    const { hook } = setup('from-bulk-order', 'bo-1', captured);
    act(() => hook.result.current.setStep(2));
    setLineItems(hook, [
      {
        materialName: 'Steel',
        unitOfMeasure: 'kg',
        unitPrice: 5,
        quantityOrdered: 50,
        bulkOrderLineItemId: 'boli-1',
        availableQty: 60,
      },
    ]);

    expect(hook.result.current.canContinue).toBe(true);
  });
});

describe('usePoWizardForm — change mode (FLOW 3)', () => {
  beforeEach(() => vi.clearAllMocks());

  const existingPo = {
    id: 'po-1',
    documentName: 'PO 008',
    projectId: 'proj-1',
    vendor: { id: 'v-1', name: 'Acme' },
    paymentTermsDays: 30,
    deliveryLocationId: 'loc-1',
    plannedDeliveryDate: '2025-01-20T00:00:00.000Z',
    message: 'hello',
    pickUp: false,
    pickUpTimeExpectation: null,
    holdForRelease: false,
    lineItems: [
      {
        id: 'li-1',
        materialName: 'Beam',
        materialCode: 'B1',
        description: null,
        unitOfMeasure: 'EA',
        unitPrice: 30,
        quantityOrdered: 10,
        costCode: '111',
        expectedDeliveryDate: '2025-01-20T00:00:00.000Z',
        notes: null,
      },
    ],
  } as never;

  function setupChange() {
    const onProposeChange = vi.fn((_input: unknown, cb: { onSuccess: () => void }) =>
      cb.onSuccess(),
    );
    const hook = renderHook(() =>
      usePoWizardForm({
        onNavigateBack: vi.fn(),
        onCreatePo: vi.fn(),
        noLineItemsMsg: 'no-items',
        noChangesMsg: 'no-changes',
        mode: 'change',
        existingPo,
        onProposeChange,
        projectDetail: { currency: 'AUD' } as never,
      }),
    );
    // Seed the form with the existing PO values (what poToFormDefaults produces).
    act(() => {
      hook.result.current.form.reset({
        documentName: 'PO 008',
        projectId: 'proj-1',
        vendorId: 'v-1',
        paymentTermsDays: 30,
        deliveryLocationId: 'loc-1',
        plannedDeliveryDate: '2025-01-20',
        message: 'hello',
        deliveries: [],
        lineItems: [
          {
            ...EMPTY_LINE_ITEM,
            lineItemId: 'li-1',
            materialName: 'Beam',
            materialCode: 'B1',
            unitOfMeasure: 'EA',
            unitPrice: 30,
            quantityOrdered: 10,
            costCode: '111',
            expectedDeliveryDate: '2025-01-20',
          },
        ],
      } as never);
    });
    return { hook, onProposeChange };
  }

  it('blocks submit with no changes and surfaces the no-changes message', () => {
    const { hook, onProposeChange } = setupChange();
    act(() => hook.result.current.submitChange());
    expect(onProposeChange).not.toHaveBeenCalled();
    expect(mockNotifyError).toHaveBeenCalledWith('no-changes');
  });

  it('submits a COMMERCIAL change request when paymentTermsDays moves', () => {
    const { hook, onProposeChange } = setupChange();
    act(() => hook.result.current.form.setValue('paymentTermsDays', 10));
    act(() => hook.result.current.submitChange());
    expect(onProposeChange).toHaveBeenCalledTimes(1);
    const payload = onProposeChange.mock.calls[0][0];
    expect(payload.changeType).toBe('COMMERCIAL');
    expect(payload.changedFields.fields.paymentTermsDays).toEqual({ from: 30, to: 10 });
  });

  it('submits an INTERNAL change request for a note-only / cost-code edit', () => {
    const { hook, onProposeChange } = setupChange();
    act(() => hook.result.current.form.setValue('lineItems.0.costCode', '999'));
    act(() => hook.result.current.submitChange());
    const payload = onProposeChange.mock.calls[0][0];
    expect(payload.changeType).toBe('INTERNAL');
    expect(payload.changedFields.lineItems[0].changes.costCode).toEqual({
      from: '111',
      to: '999',
    });
  });
});
