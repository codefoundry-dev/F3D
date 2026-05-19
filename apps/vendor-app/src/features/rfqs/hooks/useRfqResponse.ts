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

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface UseRfqResponseOptions {
  existingQuote?: QuoteResponseDetail | null;
}

export function useRfqResponse(rfq: RfqDetail, vendorId: string, options?: UseRfqResponseOptions) {
  const existingQuote = options?.existingQuote ?? null;
  const isEditMode = !!existingQuote;

  // ── Bulk defaults ────────────────────────────────────────────────────────

  const [bulkDefaults, setBulkDefaults] = useState<BulkDefaults>(
    existingQuote ? bulkDefaultsFromQuote(existingQuote) : INITIAL_BULK_DEFAULTS,
  );
  const [bulkExpanded, setBulkExpanded] = useState(!!existingQuote);

  const setBulkField = useCallback((field: keyof BulkDefaults, value: string) => {
    setBulkDefaults((prev) => ({ ...prev, [field]: value }));
  }, []);

  // ── Line items ───────────────────────────────────────────────────────────

  const [lineItems, setLineItems] = useState<LineItemFormState[]>(() =>
    existingQuote
      ? initLineItemsFromQuote(rfq.lineItems, existingQuote.lineItems)
      : initLineItems(rfq.lineItems),
  );

  useEffect(() => {
    if (!existingQuote) {
      setLineItems(initLineItems(rfq.lineItems));
    }
  }, [rfq.lineItems, existingQuote]);

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

  // ── Totals ───────────────────────────────────────────────────────────────

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

      // Line-level discount overrides bulk default
      const discountValue = safeFloat(item.discount || bulkDefaults.bulkDiscount);
      const lineDiscount =
        item.discount && item.discountType === 'AMOUNT'
          ? discountValue
          : (lineSubtotal * discountValue) / 100;
      discountTotal += lineDiscount;

      // Line-level GST overrides bulk default
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

  // ── Additional details ───────────────────────────────────────────────────

  const [validityPeriod, setValidityPeriod] = useState(
    existingQuote?.validityPeriod ? existingQuote.validityPeriod.split('T')[0] : '',
  );
  const [additionalNotes, setAdditionalNotes] = useState(existingQuote?.message ?? '');
  const [attachmentIds, setAttachmentIds] = useState<string[]>(
    existingQuote?.attachments?.map((a) => a.fileId) ?? [],
  );

  const addAttachment = useCallback((id: string) => {
    setAttachmentIds((prev) => [...prev, id]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachmentIds((prev) => prev.filter((aid) => aid !== id));
  }, []);

  // ── Warehouses ───────────────────────────────────────────────────────────

  const { data: vendorProfile, isLoading: warehousesLoading } = useQuery({
    queryKey: ['vendor-profile', vendorId],
    queryFn: () => getVendorProfile(vendorId),
    enabled: !!vendorId,
  });

  const warehouses: WarehouseLocation[] = vendorProfile?.warehouseLocations ?? [];

  // ── Side panel ───────────────────────────────────────────────────────────

  const [showInfo, setShowInfo] = useState(false);

  // ── Validation ──────────────────────────────────────────────────────────

  const [validationError, setValidationError] = useState<string | null>(null);

  const validate = useCallback((): string | null => {
    const included = lineItems.filter((item) => item.included);

    if (included.length === 0) return 'response.validationNoItems';

    for (const item of included) {
      if (!item.unitPrice || safeFloat(item.unitPrice) <= 0) return 'response.validationUnitPrice';
      if (!item.availQty || safeFloat(item.availQty) <= 0) return 'response.validationAvailQty';
      if (!item.deliveryDate) return 'response.validationDeliveryDate';
      if (item.discount && safeFloat(item.discount) > 100) return 'response.validationDiscountMax';
      if (item.gst && safeFloat(item.gst) > 100) return 'response.validationGstMax';
    }

    return null;
  }, [lineItems]);

  const isValid = useMemo(() => validate() === null, [validate]);

  // ── Submission ───────────────────────────────────────────────────────────

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
      setSubmitSuccess(true);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: SubmitQuoteInput) =>
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      updateQuote(rfq.id, existingQuote!.id, input),
    onSuccess: () => {
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

  // ── Return ───────────────────────────────────────────────────────────────

  return {
    // Mode
    isEditMode,

    // Bulk defaults
    bulkDefaults,
    setBulkField,
    bulkExpanded,
    setBulkExpanded,

    // Line items
    lineItems,
    toggleInclude,
    updateLineItem,
    toggleExpanded,

    // Totals
    totals,

    // Additional details
    validityPeriod,
    setValidityPeriod,
    additionalNotes,
    setAdditionalNotes,
    attachmentIds,
    addAttachment,
    removeAttachment,

    // Warehouses
    warehouses,
    warehousesLoading,

    // Submission
    handleSubmit,
    isSubmitting: activeMutation.isPending,
    submitError: activeMutation.error ? activeMutation.error.message : null,
    submitSuccess,
    validationError,
    isValid,

    // Side panel
    showInfo,
    setShowInfo,
  };
}
