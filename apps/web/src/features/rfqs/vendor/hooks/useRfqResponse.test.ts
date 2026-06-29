import type { QuoteResponseDetail } from '@forethread/api-client';
import { renderHook, act } from '@testing-library/react';

const mockSubmitMutate = vi.fn();
const mockUpdateMutate = vi.fn();

vi.mock('@forethread/api-client', () => ({
  submitQuote: vi.fn(),
  updateQuote: vi.fn(),
  getVendorProfile: vi.fn(() => Promise.resolve({ warehouseLocations: [] })),
  queryKeys: { rfqs: { detail: (id: string) => ['rfqs', id] } },
}));

let mutationCallCount = 0;
vi.mock('@tanstack/react-query', () => {
  return {
    useMutation: (_opts: { mutationFn: unknown }) => {
      mutationCallCount++;
      // First useMutation call = submitMutation, second = updateMutation
      const isUpdate = mutationCallCount % 2 === 0;
      return {
        mutate: isUpdate ? mockUpdateMutate : mockSubmitMutate,
        isPending: false,
        error: null,
      };
    },
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
    useQuery: () => ({
      data: undefined,
      isLoading: false,
    }),
  };
});

import { useRfqResponse } from './useRfqResponse';

const sampleLineItems = [
  {
    id: 'li-1',
    materialName: 'Cement',
    unit: 'kg',
    quantity: 100,
    description: null,
    expectedDeliveryDate: null,
    deliveryLocation: null,
  },
  {
    id: 'li-2',
    materialName: 'Steel',
    unit: 'ton',
    quantity: 50,
    description: 'Special grade',
    expectedDeliveryDate: '2026-06-01',
    deliveryLocation: 'Site A',
  },
];

// Use a stable rfq object reference to avoid useEffect re-trigger
const rfqWithItems = {
  id: 'rfq-1',
  name: 'RFQ-001',
  lineItems: sampleLineItems,
  createdBy: { name: 'Admin' },
} as never;

const rfqEmpty = {
  id: 'rfq-1',
  name: 'RFQ-001',
  lineItems: [] as typeof sampleLineItems,
  createdBy: { name: 'Admin' },
} as never;

const existingQuote: QuoteResponseDetail = {
  id: 'quote-1',
  rfqId: 'rfq-1',
  vendorId: 'vendor-1',
  totalCost: 5000,
  discountPercent: null,
  discountAmount: null,
  itemsCovered: 2,
  totalItems: 2,
  status: 'SUBMITTED',
  submittedAt: '2026-03-20T10:00:00.000Z',
  bulkDeliveryTime: '2026-04-15T00:00:00.000Z',
  bulkDiscount: 5,
  bulkTax: 10,
  bulkShipment: 150,
  warehouseLocationId: 'wh-1',
  validityPeriod: '2026-06-30T00:00:00.000Z',
  message: 'Existing note',
  lineItems: [
    {
      id: 'qli-1',
      rfqLineItemId: 'li-1',
      unitPrice: 25,
      quotedQuantity: 80,
      availability: 'AVAILABLE',
      deliveryDate: '2026-04-10T00:00:00.000Z',
      substituteItemId: null,
      discount: 5,
      discountType: 'PERCENT',
      tax: 10,
      taxIncluded: false,
      backOrderQty: 20,
      backOrderDeliveryDate: '2026-05-01T00:00:00.000Z',
      notes: 'Line 1 note',
      lineTotal: 1900,
      status: 'PENDING',
    },
    {
      id: 'qli-2',
      rfqLineItemId: 'li-2',
      unitPrice: 60,
      quotedQuantity: 50,
      availability: 'AVAILABLE',
      deliveryDate: '2026-04-20T00:00:00.000Z',
      substituteItemId: null,
      discount: null,
      discountType: null,
      tax: null,
      taxIncluded: false,
      backOrderQty: null,
      backOrderDeliveryDate: null,
      notes: null,
      lineTotal: 3000,
      status: 'PENDING',
    },
  ],
  attachments: [
    { id: 'att-1', fileId: 'file-1', filename: 'doc.pdf', mimeType: 'application/pdf', size: 1024 },
  ],
};

describe('useRfqResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutationCallCount = 0;
  });

  it('initializes line items from rfq', () => {
    const { result } = renderHook(() => useRfqResponse(rfqWithItems, 'vendor-1'));
    expect(result.current.lineItems).toHaveLength(2);
    expect(result.current.lineItems[0].materialName).toBe('Cement');
    expect(result.current.lineItems[0].included).toBe(true);
    expect(result.current.lineItems[1].description).toBe('Special grade');
  });

  it('initializes bulk defaults as empty and expanded', () => {
    const { result } = renderHook(() => useRfqResponse(rfqEmpty, 'vendor-1'));
    expect(result.current.bulkDefaults.bulkAvailability).toBe('');
    expect(result.current.bulkDefaults.bulkDiscount).toBe('');
    expect(result.current.bulkExpanded).toBe(true);
  });

  it('sets bulk field', () => {
    const { result } = renderHook(() => useRfqResponse(rfqEmpty, 'vendor-1'));
    act(() => {
      result.current.setBulkField('bulkDiscount', '10');
    });
    expect(result.current.bulkDefaults.bulkDiscount).toBe('10');
  });

  it('seeds empty line items from bulk-level defaults', () => {
    const { result } = renderHook(() => useRfqResponse(rfqWithItems, 'vendor-1'));
    act(() => {
      result.current.setBulkField('bulkAvailability', '25');
      result.current.setBulkField('bulkDiscount', '5');
      result.current.setBulkField('bulkTax', '10');
      result.current.setBulkField('bulkDeliveryTime', '2026-07-03');
    });
    result.current.lineItems.forEach((item) => {
      expect(item.availQty).toBe('25');
      expect(item.discount).toBe('5');
      expect(item.discountType).toBe('PERCENT');
      expect(item.gst).toBe('10');
      expect(item.deliveryDate).toBe('2026-07-03');
    });
  });

  it('does not overwrite line-item values the vendor already entered', () => {
    const { result } = renderHook(() => useRfqResponse(rfqWithItems, 'vendor-1'));
    act(() => {
      result.current.updateLineItem(0, 'availQty', '7');
      result.current.updateLineItem(0, 'gst', '20');
    });
    act(() => {
      result.current.setBulkField('bulkAvailability', '25');
      result.current.setBulkField('bulkTax', '10');
    });
    // Item 0 keeps its own values; the empty item 1 takes the bulk defaults.
    expect(result.current.lineItems[0].availQty).toBe('7');
    expect(result.current.lineItems[0].gst).toBe('20');
    expect(result.current.lineItems[1].availQty).toBe('25');
    expect(result.current.lineItems[1].gst).toBe('10');
  });

  it('leaves line items untouched for bulk fields with no per-line column', () => {
    const { result } = renderHook(() => useRfqResponse(rfqWithItems, 'vendor-1'));
    act(() => {
      result.current.setBulkField('shipment', '3');
    });
    expect(result.current.bulkDefaults.shipment).toBe('3');
    result.current.lineItems.forEach((item) => {
      expect(item.availQty).toBe('');
    });
  });

  it('toggles include on line item', () => {
    const { result } = renderHook(() => useRfqResponse(rfqWithItems, 'vendor-1'));
    expect(result.current.lineItems[0].included).toBe(true);
    act(() => {
      result.current.toggleInclude(0);
    });
    expect(result.current.lineItems[0].included).toBe(false);
  });

  it('updates line item field', () => {
    const { result } = renderHook(() => useRfqResponse(rfqWithItems, 'vendor-1'));
    act(() => {
      result.current.updateLineItem(0, 'unitPrice', '25.50');
    });
    expect(result.current.lineItems[0].unitPrice).toBe('25.50');
  });

  it('toggles expanded section', () => {
    const { result } = renderHook(() => useRfqResponse(rfqWithItems, 'vendor-1'));
    expect(result.current.lineItems[0].expandedSection).toBeNull();
    act(() => {
      result.current.toggleExpanded(0, 'notes');
    });
    expect(result.current.lineItems[0].expandedSection).toBe('notes');
    act(() => {
      result.current.toggleExpanded(0, 'notes');
    });
    expect(result.current.lineItems[0].expandedSection).toBeNull();
  });

  it('calculates totals correctly', () => {
    const { result } = renderHook(() => useRfqResponse(rfqWithItems, 'vendor-1'));
    act(() => {
      result.current.updateLineItem(0, 'availQty', '10');
      result.current.updateLineItem(0, 'unitPrice', '100');
    });
    expect(result.current.totals.totalItemsQuoted).toBe(1);
    expect(result.current.totals.totalItems).toBe(2);
    expect(result.current.totals.subtotal).toBe(1000);
  });

  it('validation fails when no items included', () => {
    const { result } = renderHook(() => useRfqResponse(rfqWithItems, 'vendor-1'));
    act(() => {
      result.current.toggleInclude(0);
      result.current.toggleInclude(1);
    });
    expect(result.current.isValid).toBe(false);
  });

  it('validation fails when unitPrice is 0', () => {
    const { result } = renderHook(() => useRfqResponse(rfqWithItems, 'vendor-1'));
    act(() => {
      result.current.updateLineItem(0, 'availQty', '10');
      result.current.updateLineItem(0, 'deliveryDate', '2026-06-01');
    });
    expect(result.current.isValid).toBe(false);
  });

  it('validation passes when all required fields are set', () => {
    const { result } = renderHook(() => useRfqResponse(rfqWithItems, 'vendor-1'));
    act(() => {
      for (let i = 0; i < 2; i++) {
        result.current.updateLineItem(i, 'availQty', '10');
        result.current.updateLineItem(i, 'unitPrice', '50');
        result.current.updateLineItem(i, 'deliveryDate', '2026-06-01');
      }
    });
    expect(result.current.isValid).toBe(true);
  });

  it('validation fails when availQty exceeds requestedQty', () => {
    const { result } = renderHook(() => useRfqResponse(rfqWithItems, 'vendor-1'));
    act(() => {
      // li-1 requestedQty is 100; quote 150 (exceeds) but otherwise complete.
      result.current.updateLineItem(0, 'availQty', '150');
      result.current.updateLineItem(0, 'unitPrice', '50');
      result.current.updateLineItem(0, 'deliveryDate', '2026-06-01');
      // li-2 valid and within its requestedQty (50).
      result.current.updateLineItem(1, 'availQty', '50');
      result.current.updateLineItem(1, 'unitPrice', '50');
      result.current.updateLineItem(1, 'deliveryDate', '2026-06-01');
    });
    expect(result.current.isValid).toBe(false);
    act(() => {
      result.current.handleSubmit();
    });
    expect(result.current.validationError).toBe('response.validationAvailExceedsReq');
    expect(mockSubmitMutate).not.toHaveBeenCalled();
  });

  it('validation passes when availQty equals requestedQty', () => {
    const { result } = renderHook(() => useRfqResponse(rfqWithItems, 'vendor-1'));
    act(() => {
      result.current.updateLineItem(0, 'availQty', '100'); // == requestedQty (100)
      result.current.updateLineItem(0, 'unitPrice', '50');
      result.current.updateLineItem(0, 'deliveryDate', '2026-06-01');
      result.current.updateLineItem(1, 'availQty', '50'); // == requestedQty (50)
      result.current.updateLineItem(1, 'unitPrice', '50');
      result.current.updateLineItem(1, 'deliveryDate', '2026-06-01');
    });
    expect(result.current.isValid).toBe(true);
  });

  it('handleSubmit calls mutate when valid', () => {
    const { result } = renderHook(() => useRfqResponse(rfqWithItems, 'vendor-1'));
    act(() => {
      for (let i = 0; i < 2; i++) {
        result.current.updateLineItem(i, 'availQty', '10');
        result.current.updateLineItem(i, 'unitPrice', '50');
        result.current.updateLineItem(i, 'deliveryDate', '2026-06-01');
      }
    });
    act(() => {
      result.current.handleSubmit();
    });
    expect(mockSubmitMutate).toHaveBeenCalled();
  });

  it('handleSubmit sets validationError when invalid', () => {
    const { result } = renderHook(() => useRfqResponse(rfqWithItems, 'vendor-1'));
    act(() => {
      result.current.handleSubmit();
    });
    expect(result.current.validationError).toBe('response.validationUnitPrice');
    expect(mockSubmitMutate).not.toHaveBeenCalled();
  });

  it('handleSubmit calls mutate when all fields are valid', () => {
    const { result } = renderHook(() => useRfqResponse(rfqWithItems, 'vendor-1'));
    // Set all required fields: unit price, available qty, and delivery date
    act(() => {
      for (let i = 0; i < 2; i++) {
        result.current.updateLineItem(i, 'unitPrice', '10');
        result.current.updateLineItem(i, 'availQty', '50');
        result.current.updateLineItem(i, 'deliveryDate', '2026-06-01');
      }
    });
    act(() => {
      void result.current.handleSubmit();
    });
    expect(mockSubmitMutate).toHaveBeenCalled();
  });

  it('manages additional details state', () => {
    const { result } = renderHook(() => useRfqResponse(rfqEmpty, 'vendor-1'));
    act(() => {
      result.current.setValidityPeriod('2026-12-31');
      result.current.setAdditionalNotes('Test note');
    });
    expect(result.current.validityPeriod).toBe('2026-12-31');
    expect(result.current.additionalNotes).toBe('Test note');
  });

  it('manages attachment ids', () => {
    const { result } = renderHook(() => useRfqResponse(rfqEmpty, 'vendor-1'));
    act(() => {
      result.current.addAttachment('att-1');
      result.current.addAttachment('att-2');
    });
    expect(result.current.attachmentIds).toEqual(['att-1', 'att-2']);
    act(() => {
      result.current.removeAttachment('att-1');
    });
    expect(result.current.attachmentIds).toEqual(['att-2']);
  });

  it('manages showInfo state (open by default)', () => {
    const { result } = renderHook(() => useRfqResponse(rfqEmpty, 'vendor-1'));
    expect(result.current.showInfo).toBe(true);
    act(() => {
      result.current.setShowInfo(false);
    });
    expect(result.current.showInfo).toBe(false);
  });

  it('returns empty warehouses when vendor profile not loaded', () => {
    const { result } = renderHook(() => useRfqResponse(rfqEmpty, 'vendor-1'));
    expect(result.current.warehouses).toEqual([]);
  });

  // ── Edit mode tests ─────────────────────────────────────────────────────

  describe('edit mode', () => {
    it('reports isEditMode when existingQuote is provided', () => {
      const { result } = renderHook(() =>
        useRfqResponse(rfqWithItems, 'vendor-1', { existingQuote }),
      );
      expect(result.current.isEditMode).toBe(true);
    });

    it('reports isEditMode false when no existingQuote', () => {
      const { result } = renderHook(() => useRfqResponse(rfqWithItems, 'vendor-1'));
      expect(result.current.isEditMode).toBe(false);
    });

    it('pre-populates line items from existing quote', () => {
      const { result } = renderHook(() =>
        useRfqResponse(rfqWithItems, 'vendor-1', { existingQuote }),
      );
      const li0 = result.current.lineItems[0];
      expect(li0.included).toBe(true);
      expect(li0.unitPrice).toBe('25');
      expect(li0.availQty).toBe('80');
      expect(li0.deliveryDate).toBe('2026-04-10');
      expect(li0.discount).toBe('5');
      expect(li0.discountType).toBe('PERCENT');
      expect(li0.gst).toBe('10');
      expect(li0.notes).toBe('Line 1 note');
      expect(li0.backOrderQty).toBe('20');
      expect(li0.backOrderDeliveryDate).toBe('2026-05-01');
    });

    it('pre-populates bulk defaults from existing quote', () => {
      const { result } = renderHook(() =>
        useRfqResponse(rfqWithItems, 'vendor-1', { existingQuote }),
      );
      expect(result.current.bulkDefaults.bulkDiscount).toBe('5');
      expect(result.current.bulkDefaults.bulkTax).toBe('10');
      expect(result.current.bulkDefaults.shipment).toBe('150');
      expect(result.current.bulkDefaults.warehouseLocationId).toBe('wh-1');
      expect(result.current.bulkDefaults.bulkDeliveryTime).toBe('2026-04-15');
      expect(result.current.bulkExpanded).toBe(true);
    });

    it('pre-populates additional details from existing quote', () => {
      const { result } = renderHook(() =>
        useRfqResponse(rfqWithItems, 'vendor-1', { existingQuote }),
      );
      expect(result.current.validityPeriod).toBe('2026-06-30');
      expect(result.current.additionalNotes).toBe('Existing note');
      expect(result.current.attachmentIds).toEqual(['file-1']);
    });

    it('calls updateMutation instead of submitMutation in edit mode', () => {
      const { result } = renderHook(() =>
        useRfqResponse(rfqWithItems, 'vendor-1', { existingQuote }),
      );
      // Form is already valid from pre-populated data
      expect(result.current.isValid).toBe(true);
      act(() => {
        result.current.handleSubmit();
      });
      expect(mockUpdateMutate).toHaveBeenCalled();
      expect(mockSubmitMutate).not.toHaveBeenCalled();
    });

    it('marks NO_QUOTE items as not included', () => {
      const quoteWithNoQuote: QuoteResponseDetail = {
        ...existingQuote,
        lineItems: [
          existingQuote.lineItems[0],
          {
            ...existingQuote.lineItems[1],
            availability: 'NO_QUOTE',
            unitPrice: 0,
            quotedQuantity: 0,
          },
        ],
      };
      const { result } = renderHook(() =>
        useRfqResponse(rfqWithItems, 'vendor-1', { existingQuote: quoteWithNoQuote }),
      );
      expect(result.current.lineItems[0].included).toBe(true);
      expect(result.current.lineItems[1].included).toBe(false);
    });
  });
});
