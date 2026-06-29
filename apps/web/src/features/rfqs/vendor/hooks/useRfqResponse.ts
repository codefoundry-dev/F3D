import {
  type QuoteResponseDetail,
  type RfqDetail,
  type RfqLineItem,
  type SubmitQuoteInput,
  type SubmitQuoteLineItemInput,
  type WarehouseLocation,
  submitQuote,
  updateQuote,
  getVendorProfile,
} from '@forethread/api-client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, useCallback, useMemo, useEffect } from 'react';

import { availExceedsRequested } from './availExceedsRequested';

export interface BulkDefaults {
  bulkAvailability: string;
  bulkDiscount: string;
  bulkTax: string;
  shipment: string;
  warehouseLocationId: string;
  bulkDeliveryTime: string;
}

export interface LineItemFormState {
  rfqLineItemId: string;
  included: boolean;
  materialName: string;
  materialId: string | null;
  unit: string;
  requestedQty: number;
  availQty: string;
  unitPrice: string;
  discount: string;
  discountType: 'PERCENT' | 'AMOUNT';
  gst: string;
  taxIncluded: boolean;
  deliveryDate: string;
  notes: string;
  backOrderQty: string;
  backOrderDeliveryDate: string;
  substituteItemId: string | null;
  substituteName: string | null;
  expandedSection: 'notes' | 'backorder' | null;
  description: string | null;
  expectedDeliveryDate: string | null;
  deliveryLocation: string | null;
}

export interface QuoteTotals {
  totalItemsQuoted: number;
  totalItems: number;
  subtotal: number;
  discountTotal: number;
  gstTotal: number;
  totalQuote: number;
}

function initLineItems(lineItems: RfqLineItem[]): LineItemFormState[] {
  return lineItems.map((item) => ({
    rfqLineItemId: item.id,
    included: true,
    materialName: item.materialName,
    materialId: ((item as unknown as Record<string, unknown>).materialId as string | null) ?? null,
    unit: item.unit,
    requestedQty: item.quantity,
    availQty: '',
    unitPrice: '',
    discount: '',
    discountType: 'PERCENT' as const,
    gst: '',
    taxIncluded: false,
    deliveryDate: '',
    notes: '',
    backOrderQty: '',
    backOrderDeliveryDate: '',
    substituteItemId: null,
    substituteName: null,
    expandedSection: null,
    description: item.description,
    expectedDeliveryDate: item.expectedDeliveryDate,
    deliveryLocation: item.deliveryLocation,
  }));
}

function initLineItemsFromQuote(
  rfqLineItems: RfqLineItem[],
  quoteLineItems: QuoteResponseDetail['lineItems'],
): LineItemFormState[] {
  const quoteMap = new Map(quoteLineItems.map((qi) => [qi.rfqLineItemId, qi]));

  return rfqLineItems.map((item) => {
    const qi = quoteMap.get(item.id);
    const isIncluded = !!qi && qi.availability !== 'NO_QUOTE';

    return {
      rfqLineItemId: item.id,
      included: isIncluded,
      materialName: item.materialName,
      materialId:
        ((item as unknown as Record<string, unknown>).materialId as string | null) ?? null,
      unit: item.unit,
      requestedQty: item.quantity,
      availQty: isIncluded && qi ? String(qi.quotedQuantity) : '',
      unitPrice: isIncluded && qi ? String(qi.unitPrice) : '',
      discount: qi?.discount !== null && qi?.discount !== undefined ? String(qi.discount) : '',
      discountType: qi?.discountType ?? ('PERCENT' as const),
      gst: qi?.tax !== null && qi?.tax !== undefined ? String(qi.tax) : '',
      taxIncluded: qi?.taxIncluded ?? false,
      deliveryDate: isIncluded && qi ? qi.deliveryDate.split('T')[0] : '',
      notes: qi?.notes ?? '',
      backOrderQty:
        qi?.backOrderQty !== null && qi?.backOrderQty !== undefined ? String(qi.backOrderQty) : '',
      backOrderDeliveryDate: qi?.backOrderDeliveryDate
        ? qi.backOrderDeliveryDate.split('T')[0]
        : '',
      substituteItemId: qi?.substituteItemId ?? null,
      substituteName: null,
      expandedSection: null,
      description: item.description,
      expectedDeliveryDate: item.expectedDeliveryDate,
      deliveryLocation: item.deliveryLocation,
    };
  });
}

const INITIAL_BULK_DEFAULTS: BulkDefaults = {
  bulkAvailability: '',
  bulkDiscount: '',
  bulkTax: '',
  shipment: '',
  warehouseLocationId: '',
  bulkDeliveryTime: '',
};

/**
 * Bulk-level defaults that have a per-line-item equivalent. Entering one of
 * these seeds the matching column on every line item that's still empty.
 * Shipment + warehouse are bulk-only and have no per-line column.
 */
const BULK_TO_LINE_FIELD: Partial<Record<keyof BulkDefaults, keyof LineItemFormState>> = {
  bulkAvailability: 'availQty',
  bulkDiscount: 'discount',
  bulkTax: 'gst',
  bulkDeliveryTime: 'deliveryDate',
};

/* ─── Local draft persistence ("Save as draft") ────────────────────────────── */

/** Per-line-item fields persisted in a local draft. */
type DraftLineItem = Pick<
  LineItemFormState,
  | 'included'
  | 'availQty'
  | 'unitPrice'
  | 'discount'
  | 'discountType'
  | 'gst'
  | 'taxIncluded'
  | 'deliveryDate'
  | 'notes'
  | 'backOrderQty'
  | 'backOrderDeliveryDate'
  | 'substituteItemId'
  | 'substituteName'
>;

interface ResponseDraft {
  bulkDefaults: BulkDefaults;
  lineItems: Record<string, DraftLineItem>;
  validityPeriod: string;
  additionalNotes: string;
  savedAt: string;
}

const draftStorageKey = (rfqId: string) => `rfq-response-draft-${rfqId}`;

function loadDraft(rfqId: string): ResponseDraft | null {
  try {
    const raw = localStorage.getItem(draftStorageKey(rfqId));
    return raw ? (JSON.parse(raw) as ResponseDraft) : null;
  } catch {
    return null;
  }
}

function applyDraftToLineItems(
  items: LineItemFormState[],
  draft: ResponseDraft | null,
): LineItemFormState[] {
  if (!draft) return items;
  return items.map((item) => {
    const saved = draft.lineItems[item.rfqLineItemId];
    return saved ? { ...item, ...saved } : item;
  });
}

function bulkDefaultsFromQuote(quote: QuoteResponseDetail): BulkDefaults {
  return {
    bulkAvailability: '',
    bulkDiscount:
      quote.bulkDiscount !== null && quote.bulkDiscount !== undefined
        ? String(quote.bulkDiscount)
        : '',
    bulkTax: quote.bulkTax !== null && quote.bulkTax !== undefined ? String(quote.bulkTax) : '',
    shipment:
      quote.bulkShipment !== null && quote.bulkShipment !== undefined
        ? String(quote.bulkShipment)
        : '',
    warehouseLocationId: quote.warehouseLocationId ?? '',
    bulkDeliveryTime: quote.bulkDeliveryTime ? quote.bulkDeliveryTime.split('T')[0] : '',
  };
}

function safeFloat(value: string): number {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface UseRfqResponseOptions {
  existingQuote?: QuoteResponseDetail | null;
}

export function useRfqResponse(rfq: RfqDetail, vendorId: string, options?: UseRfqResponseOptions) {
  const existingQuote = options?.existingQuote ?? null;
  const isEditMode = !!existingQuote;

  // Local draft (only used when creating a fresh response)
  const [draft] = useState<ResponseDraft | null>(() => (existingQuote ? null : loadDraft(rfq.id)));

  const [bulkDefaults, setBulkDefaults] = useState<BulkDefaults>(
    existingQuote
      ? bulkDefaultsFromQuote(existingQuote)
      : (draft?.bulkDefaults ?? INITIAL_BULK_DEFAULTS),
  );
  const [bulkExpanded, setBulkExpanded] = useState(true);

  const [lineItems, setLineItems] = useState<LineItemFormState[]>(() =>
    existingQuote
      ? initLineItemsFromQuote(rfq.lineItems, existingQuote.lineItems)
      : applyDraftToLineItems(initLineItems(rfq.lineItems), draft),
  );

  const setBulkField = useCallback((field: keyof BulkDefaults, value: string) => {
    setBulkDefaults((prev) => ({ ...prev, [field]: value }));

    // Seed the matching per-line column on every item the vendor hasn't filled
    // in yet, so a bulk default flows into the (still editable) line-item table.
    const lineField = BULK_TO_LINE_FIELD[field];
    if (!lineField || value === '') return;
    setLineItems((prev) =>
      prev.map((item) => {
        if (item[lineField]) return item; // never overwrite a value already entered
        // A bulk discount is a percentage, so pin the line's discount mode too.
        if (lineField === 'discount') {
          return { ...item, discount: value, discountType: 'PERCENT' as const };
        }
        return { ...item, [lineField]: value };
      }),
    );
  }, []);

  useEffect(() => {
    if (!existingQuote) {
      setLineItems((prev) => {
        const next = applyDraftToLineItems(initLineItems(rfq.lineItems), draft);
        // Preserve in-progress edits for items that are still present
        const prevById = new Map(prev.map((p) => [p.rfqLineItemId, p]));
        return next.map((item) => prevById.get(item.rfqLineItemId) ?? item);
      });
    }
  }, [rfq.lineItems, existingQuote, draft]);

  const toggleInclude = useCallback((index: number) => {
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, included: !item.included } : item)),
    );
  }, []);

  const updateLineItem = useCallback(
    (index: number, field: keyof LineItemFormState, value: unknown) => {
      setLineItems((prev) =>
        prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
      );
    },
    [],
  );

  const toggleExpanded = useCallback((index: number, section: 'notes' | 'backorder') => {
    setLineItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, expandedSection: item.expandedSection === section ? null : section }
          : item,
      ),
    );
  }, []);

  const totals = useMemo<QuoteTotals>(() => {
    const includedItems = lineItems.filter((item) => item.included);

    const totalItemsQuoted = includedItems.filter(
      (item) => safeFloat(item.availQty) > 0 && safeFloat(item.unitPrice) > 0,
    ).length;

    let subtotal = 0;
    let discountTotal = 0;
    let gstTotal = 0;

    for (const item of includedItems) {
      const qty = safeFloat(item.availQty);
      const price = safeFloat(item.unitPrice);
      const lineSubtotal = qty * price;
      subtotal += lineSubtotal;

      const discountValue = safeFloat(item.discount || bulkDefaults.bulkDiscount);
      const lineDiscount =
        item.discount && item.discountType === 'AMOUNT'
          ? discountValue
          : (lineSubtotal * discountValue) / 100;
      discountTotal += lineDiscount;

      const gstPercent = safeFloat(item.gst || bulkDefaults.bulkTax);
      const taxableAmount = lineSubtotal - lineDiscount;
      gstTotal += (taxableAmount * gstPercent) / 100;
    }

    return {
      totalItemsQuoted,
      totalItems: lineItems.length,
      subtotal,
      discountTotal,
      gstTotal,
      totalQuote: subtotal - discountTotal + gstTotal,
    };
  }, [lineItems, bulkDefaults.bulkDiscount, bulkDefaults.bulkTax]);

  const [validityPeriod, setValidityPeriod] = useState(
    existingQuote?.validityPeriod
      ? existingQuote.validityPeriod.split('T')[0]
      : (draft?.validityPeriod ?? ''),
  );
  const [additionalNotes, setAdditionalNotes] = useState(
    existingQuote?.message ?? draft?.additionalNotes ?? '',
  );
  const [attachmentIds, setAttachmentIds] = useState<string[]>(
    existingQuote?.attachments?.map((a) => a.fileId) ?? [],
  );

  const addAttachment = useCallback((id: string) => {
    setAttachmentIds((prev) => [...prev, id]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachmentIds((prev) => prev.filter((aid) => aid !== id));
  }, []);

  const { data: vendorProfile, isLoading: warehousesLoading } = useQuery({
    queryKey: ['vendor-profile', vendorId],
    queryFn: () => getVendorProfile(vendorId),
    enabled: !!vendorId,
  });

  const warehouses: WarehouseLocation[] = vendorProfile?.warehouseLocations ?? [];

  // The RFQ info panel is open by default (matches the design's initial state)
  const [showInfo, setShowInfo] = useState(true);

  const [validationError, setValidationError] = useState<string | null>(null);

  const validate = useCallback((): string | null => {
    const included = lineItems.filter((item) => item.included);

    if (included.length === 0) return 'response.validationNoItems';

    for (const item of included) {
      if (!item.unitPrice || safeFloat(item.unitPrice) <= 0) return 'response.validationUnitPrice';
      if (!item.availQty || safeFloat(item.availQty) <= 0) return 'response.validationAvailQty';
      if (availExceedsRequested(item)) return 'response.validationAvailExceedsReq';
      if (!item.deliveryDate) return 'response.validationDeliveryDate';
      if (item.discount && safeFloat(item.discount) > 100) return 'response.validationDiscountMax';
      if (item.gst && safeFloat(item.gst) > 100) return 'response.validationGstMax';
    }

    return null;
  }, [lineItems]);

  const isValid = useMemo(() => validate() === null, [validate]);

  const [submitSuccess, setSubmitSuccess] = useState(false);

  const buildSubmitInput = useCallback((): SubmitQuoteInput => {
    const includedLineItems: SubmitQuoteLineItemInput[] = lineItems
      .filter((item) => item.included)
      .map((item) => {
        const lineItem: SubmitQuoteLineItemInput = {
          rfqLineItemId: item.rfqLineItemId,
          unitPrice: safeFloat(item.unitPrice),
          quotedQuantity: safeFloat(item.availQty),
          deliveryDate: new Date(item.deliveryDate).toISOString(),
        };

        if (item.discount) {
          lineItem.discount = safeFloat(item.discount);
          lineItem.discountType = item.discountType;
        }
        if (item.gst) {
          lineItem.tax = safeFloat(item.gst);
          lineItem.taxIncluded = item.taxIncluded;
        }
        if (item.notes) {
          lineItem.notes = item.notes;
        }
        if (item.backOrderQty) {
          lineItem.backOrderQty = safeFloat(item.backOrderQty);
        }
        if (item.backOrderDeliveryDate) {
          lineItem.backOrderDeliveryDate = new Date(item.backOrderDeliveryDate).toISOString();
        }
        if (item.substituteItemId) {
          lineItem.substituteItemId = item.substituteItemId;
        }

        return lineItem;
      });

    const input: SubmitQuoteInput = {
      lineItems: includedLineItems,
    };

    if (bulkDefaults.bulkDeliveryTime) {
      input.bulkDeliveryTime = bulkDefaults.bulkDeliveryTime;
    }
    if (bulkDefaults.bulkDiscount) {
      input.bulkDiscount = safeFloat(bulkDefaults.bulkDiscount);
    }
    if (bulkDefaults.bulkTax) {
      input.bulkTax = safeFloat(bulkDefaults.bulkTax);
    }
    if (bulkDefaults.shipment) {
      input.bulkShipment = safeFloat(bulkDefaults.shipment);
    }
    if (bulkDefaults.warehouseLocationId) {
      input.warehouseLocationId = bulkDefaults.warehouseLocationId;
    }
    if (validityPeriod) {
      input.validityPeriod = validityPeriod;
    }
    if (additionalNotes) {
      input.message = additionalNotes;
    }
    if (attachmentIds.length > 0) {
      input.attachmentIds = attachmentIds;
    }

    return input;
  }, [lineItems, bulkDefaults, validityPeriod, additionalNotes, attachmentIds]);

  const submitMutation = useMutation({
    mutationFn: (input: SubmitQuoteInput) => submitQuote(rfq.id, input),
    onSuccess: () => {
      localStorage.removeItem(draftStorageKey(rfq.id));
      setSubmitSuccess(true);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: SubmitQuoteInput) =>
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      updateQuote(rfq.id, existingQuote!.id, input),
    onSuccess: () => {
      localStorage.removeItem(draftStorageKey(rfq.id));
      setSubmitSuccess(true);
    },
  });

  const activeMutation = isEditMode ? updateMutation : submitMutation;

  const handleSubmit = useCallback(() => {
    const error = validate();
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    setSubmitSuccess(false);
    activeMutation.mutate(buildSubmitInput());
  }, [buildSubmitInput, activeMutation, validate]);

  /* ─── Save as draft (local persistence) ─── */
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const saveDraft = useCallback(() => {
    const draftItems: Record<string, DraftLineItem> = {};
    for (const item of lineItems) {
      draftItems[item.rfqLineItemId] = {
        included: item.included,
        availQty: item.availQty,
        unitPrice: item.unitPrice,
        discount: item.discount,
        discountType: item.discountType,
        gst: item.gst,
        taxIncluded: item.taxIncluded,
        deliveryDate: item.deliveryDate,
        notes: item.notes,
        backOrderQty: item.backOrderQty,
        backOrderDeliveryDate: item.backOrderDeliveryDate,
        substituteItemId: item.substituteItemId,
        substituteName: item.substituteName,
      };
    }
    const payload: ResponseDraft = {
      bulkDefaults,
      lineItems: draftItems,
      validityPeriod,
      additionalNotes,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(draftStorageKey(rfq.id), JSON.stringify(payload));
      setDraftSavedAt(payload.savedAt);
    } catch {
      /* storage full / unavailable — silently ignore */
    }
  }, [lineItems, bulkDefaults, validityPeriod, additionalNotes, rfq.id]);

  return {
    isEditMode,
    bulkDefaults,
    setBulkField,
    bulkExpanded,
    setBulkExpanded,
    lineItems,
    toggleInclude,
    updateLineItem,
    toggleExpanded,
    totals,
    validityPeriod,
    setValidityPeriod,
    additionalNotes,
    setAdditionalNotes,
    attachmentIds,
    addAttachment,
    removeAttachment,
    warehouses,
    warehousesLoading,
    handleSubmit,
    saveDraft,
    draftSavedAt,
    isSubmitting: activeMutation.isPending,
    submitError: activeMutation.error ? activeMutation.error.message : null,
    submitSuccess,
    validationError,
    isValid,
    showInfo,
    setShowInfo,
  };
}
