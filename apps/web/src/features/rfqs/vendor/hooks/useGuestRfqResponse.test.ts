import { renderHook, act } from '@testing-library/react';

const mockMutate = vi.fn();

vi.mock('@forethread/api-client', () => ({
  submitGuestQuote: vi.fn(),
  submitGuestQuoteExtraction: vi.fn(),
  getGuestQuoteExtraction: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: ({ onSuccess }: { mutationFn: unknown; onSuccess?: () => void }) => ({
    mutate: (...args: unknown[]) => {
      mockMutate(...args);
      if (onSuccess) onSuccess();
    },
    isPending: false,
    error: null,
    reset: vi.fn(),
  }),
  // The quote-extraction poll is idle in these tests (no PDF uploaded).
  useQuery: () => ({ data: undefined, isError: false }),
}));

import { useGuestRfqResponse } from './useGuestRfqResponse';

const makeGuestRfq = (
  lineItems: Array<{
    id: string;
    materialName: string;
    unit: string;
    quantity: number;
    description: string | null;
  }> = [],
) =>
  ({
    id: 'rfq-1',
    rfqNumber: 'RFQ-001',
    contractorName: 'Contractor Corp',
    vendorName: 'Vendor Inc',
    lineItems,
  }) as never;

const sampleLineItems = [
  { id: 'li-1', materialName: 'Cement', unit: 'kg', quantity: 100, description: null },
  { id: 'li-2', materialName: 'Steel', unit: 'ton', quantity: 50, description: 'High grade' },
];

describe('useGuestRfqResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes line items from guest rfq', () => {
    const { result } = renderHook(() =>
      useGuestRfqResponse(makeGuestRfq(sampleLineItems), 'token-1'),
    );
    expect(result.current.lineItems).toHaveLength(2);
    expect(result.current.lineItems[0].materialName).toBe('Cement');
    expect(result.current.lineItems[0].included).toBe(true);
    expect(result.current.lineItems[0].materialId).toBeNull();
  });

  it('initializes bulk defaults as empty', () => {
    const { result } = renderHook(() => useGuestRfqResponse(makeGuestRfq(), 'token-1'));
    expect(result.current.bulkDefaults.bulkAvailability).toBe('');
    expect(result.current.bulkDefaults.bulkDiscount).toBe('');
    expect(result.current.bulkExpanded).toBe(false);
  });

  it('sets bulk field', () => {
    const { result } = renderHook(() => useGuestRfqResponse(makeGuestRfq(), 'token-1'));
    act(() => {
      result.current.setBulkField('bulkTax', '15');
    });
    expect(result.current.bulkDefaults.bulkTax).toBe('15');
  });

  it('toggles include on line item', () => {
    const { result } = renderHook(() =>
      useGuestRfqResponse(makeGuestRfq(sampleLineItems), 'token-1'),
    );
    expect(result.current.lineItems[0].included).toBe(true);
    act(() => {
      result.current.toggleInclude(0);
    });
    expect(result.current.lineItems[0].included).toBe(false);
  });

  it('updates line item field', () => {
    const { result } = renderHook(() =>
      useGuestRfqResponse(makeGuestRfq(sampleLineItems), 'token-1'),
    );
    act(() => {
      result.current.updateLineItem(0, 'unitPrice', '30');
    });
    expect(result.current.lineItems[0].unitPrice).toBe('30');
  });

  it('toggles expanded section', () => {
    const { result } = renderHook(() =>
      useGuestRfqResponse(makeGuestRfq(sampleLineItems), 'token-1'),
    );
    act(() => {
      result.current.toggleExpanded(0, 'backorder');
    });
    expect(result.current.lineItems[0].expandedSection).toBe('backorder');
    act(() => {
      result.current.toggleExpanded(0, 'backorder');
    });
    expect(result.current.lineItems[0].expandedSection).toBeNull();
  });

  it('calculates totals correctly', () => {
    const { result } = renderHook(() =>
      useGuestRfqResponse(makeGuestRfq(sampleLineItems), 'token-1'),
    );
    act(() => {
      result.current.updateLineItem(0, 'availQty', '10');
      result.current.updateLineItem(0, 'unitPrice', '50');
    });
    expect(result.current.totals.totalItemsQuoted).toBe(1);
    expect(result.current.totals.subtotal).toBe(500);
    expect(result.current.totals.totalQuote).toBe(500);
  });

  it('calculates discount total', () => {
    const { result } = renderHook(() =>
      useGuestRfqResponse(makeGuestRfq(sampleLineItems), 'token-1'),
    );
    act(() => {
      result.current.updateLineItem(0, 'availQty', '10');
      result.current.updateLineItem(0, 'unitPrice', '100');
      result.current.updateLineItem(0, 'discount', '10');
    });
    // 10% of 1000 = 100 discount
    expect(result.current.totals.discountTotal).toBe(100);
    expect(result.current.totals.totalQuote).toBe(900);
  });

  it('calculates GST total', () => {
    const { result } = renderHook(() =>
      useGuestRfqResponse(makeGuestRfq(sampleLineItems), 'token-1'),
    );
    act(() => {
      result.current.updateLineItem(0, 'availQty', '10');
      result.current.updateLineItem(0, 'unitPrice', '100');
      result.current.updateLineItem(0, 'gst', '10');
    });
    // 10% GST on 1000 = 100
    expect(result.current.totals.gstTotal).toBe(100);
    expect(result.current.totals.totalQuote).toBe(1100);
  });

  it('manages additional details state', () => {
    const { result } = renderHook(() => useGuestRfqResponse(makeGuestRfq(), 'token-1'));
    act(() => {
      result.current.setValidityPeriod('2026-12-31');
      result.current.setAdditionalNotes('Guest note');
    });
    expect(result.current.validityPeriod).toBe('2026-12-31');
    expect(result.current.additionalNotes).toBe('Guest note');
  });

  /** Fill the first line item with valid values and drop the rest. */
  const fillValidQuote = (result: { current: ReturnType<typeof useGuestRfqResponse> }) => {
    act(() => {
      result.current.updateLineItem(0, 'availQty', '10');
      result.current.updateLineItem(0, 'unitPrice', '50');
      result.current.updateLineItem(0, 'deliveryDate', '2026-07-01');
      result.current.toggleInclude(1);
    });
  };

  it('handleSubmit calls mutate when the quote is valid', () => {
    const { result } = renderHook(() =>
      useGuestRfqResponse(makeGuestRfq(sampleLineItems), 'token-1'),
    );
    fillValidQuote(result);
    act(() => {
      result.current.handleSubmit();
    });
    expect(mockMutate).toHaveBeenCalled();
    expect(result.current.validationErrors).toHaveLength(0);
  });

  it('sets submitSuccess on successful mutation', () => {
    const { result } = renderHook(() =>
      useGuestRfqResponse(makeGuestRfq(sampleLineItems), 'token-1'),
    );
    fillValidQuote(result);
    act(() => {
      result.current.handleSubmit();
    });
    expect(result.current.submitSuccess).toBe(true);
  });

  it('blocks submit and reports per-line errors when required fields are missing', () => {
    const { result } = renderHook(() =>
      useGuestRfqResponse(makeGuestRfq(sampleLineItems), 'token-1'),
    );
    // No unit price / qty / delivery date set on either included line.
    act(() => {
      result.current.handleSubmit();
    });
    expect(mockMutate).not.toHaveBeenCalled();
    expect(result.current.validationErrors).toHaveLength(2);
    expect(result.current.validationErrors[0]).toMatchObject({ type: 'LINE_ITEM', index: 0 });
  });

  it('blocks submit with a NO_ITEMS error when nothing is included', () => {
    const { result } = renderHook(() =>
      useGuestRfqResponse(makeGuestRfq(sampleLineItems), 'token-1'),
    );
    act(() => {
      result.current.toggleInclude(0);
      result.current.toggleInclude(1);
    });
    act(() => {
      result.current.handleSubmit();
    });
    expect(mockMutate).not.toHaveBeenCalled();
    expect(result.current.validationErrors).toEqual([{ type: 'NO_ITEMS' }]);
  });

  it('tags the submit payload with source FORM for manual entry', () => {
    const { result } = renderHook(() =>
      useGuestRfqResponse(makeGuestRfq(sampleLineItems), 'token-1'),
    );
    fillValidQuote(result);
    act(() => {
      result.current.handleSubmit();
    });
    expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ source: 'FORM' }));
  });

  it('includes payment terms in the submit payload', () => {
    const { result } = renderHook(() =>
      useGuestRfqResponse(makeGuestRfq(sampleLineItems), 'token-1'),
    );
    fillValidQuote(result);
    act(() => {
      result.current.setPaymentTerms('Net 30');
    });
    act(() => {
      result.current.handleSubmit();
    });
    expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ paymentTerms: 'Net 30' }));
  });

  it('manages showInfo state', () => {
    const { result } = renderHook(() => useGuestRfqResponse(makeGuestRfq(), 'token-1'));
    expect(result.current.showInfo).toBe(false);
    act(() => {
      result.current.setShowInfo(true);
    });
    expect(result.current.showInfo).toBe(true);
  });

  it('defaults to manual entry mode and can switch to upload', () => {
    const { result } = renderHook(() =>
      useGuestRfqResponse(makeGuestRfq(sampleLineItems), 'token-1'),
    );
    expect(result.current.mode).toBe('manual');
    expect(result.current.extractionPhase).toBe('idle');

    act(() => {
      result.current.setMode('upload');
    });
    expect(result.current.mode).toBe('upload');
  });

  it('restores a clean manual form when switching back from upload', () => {
    const { result } = renderHook(() =>
      useGuestRfqResponse(makeGuestRfq(sampleLineItems), 'token-1'),
    );
    act(() => {
      result.current.updateLineItem(0, 'unitPrice', '99');
      result.current.setMode('upload');
    });
    act(() => {
      result.current.setMode('manual');
    });
    // Switching back to manual discards any extraction-driven prefill.
    expect(result.current.mode).toBe('manual');
    expect(result.current.lineItems[0].unitPrice).toBe('');
    expect(result.current.lineItems[0].included).toBe(true);
  });
});
