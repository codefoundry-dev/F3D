import {
  type GuestRfqDetail,
  type SubmitQuoteInput,
  type SubmitQuoteLineItemInput,
  submitGuestQuote,
} from '@forethread/api-client';
import { type QuoteExtractionResult, EMPTY_QUOTE_RESULT } from '@forethread/shared-types/client';
import { useMutation } from '@tanstack/react-query';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';

import { availExceedsRequested } from './availExceedsRequested';
import { matchExtractedQuote } from './matchExtractedQuote';
import { useQuoteExtraction } from './useQuoteExtraction';
import type { BulkDefaults, LineItemFormState, QuoteTotals } from './useRfqResponse';

/** How the vendor is entering their quote: by hand, or by uploading a PDF. */
export type ResponseMode = 'manual' | 'upload';

const INITIAL_BULK_DEFAULTS: BulkDefaults = {
  bulkAvailability: '',
  bulkDiscount: '',
  bulkTax: '',
  shipment: '',
  warehouseLocationId: '',
  bulkDeliveryTime: '',
};

function safeFloat(value: string): number {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * A blocking validation problem with the quote form. Structured (not
 * pre-translated) so the page owns the copy and tests stay locale-agnostic.
 */
export type QuoteValidationError =
  | { type: 'NO_ITEMS' }
  | { type: 'LINE_ITEM'; index: number; material: string }
  | { type: 'AVAIL_EXCEEDS_REQ'; index: number; material: string; requested: number };

/**
 * Each included line item must have a positive unit price, a positive available
 * quantity and a delivery date; at least one line item must be included. The
 * available quantity must also not exceed the requested quantity (FOR-273).
 */
export function validateGuestQuote(lineItems: LineItemFormState[]): QuoteValidationError[] {
  const included = lineItems.filter((item) => item.included);
  if (included.length === 0) return [{ type: 'NO_ITEMS' }];

  const errors: QuoteValidationError[] = [];
  lineItems.forEach((item, index) => {
    if (!item.included) return;
    const hasPrice = safeFloat(item.unitPrice) > 0;
    const hasQty = safeFloat(item.availQty) > 0;
    const hasDate = item.deliveryDate.trim().length > 0;
    if (!hasPrice || !hasQty || !hasDate) {
      errors.push({ type: 'LINE_ITEM', index, material: item.materialName });
    }
    if (availExceedsRequested(item)) {
      errors.push({
        type: 'AVAIL_EXCEEDS_REQ',
        index,
        material: item.materialName,
        requested: item.requestedQty,
      });
    }
  });
  return errors;
}

function initGuestLineItems(lineItems: GuestRfqDetail['lineItems']): LineItemFormState[] {
  return lineItems.map((item) => ({
    rfqLineItemId: item.id,
    included: true,
    materialName: item.materialName,
    materialId: null,
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
    expectedDeliveryDate: null,
    deliveryLocation: null,
  }));
}

export function useGuestRfqResponse(rfq: GuestRfqDetail, token: string) {
  const [bulkDefaults, setBulkDefaults] = useState<BulkDefaults>(INITIAL_BULK_DEFAULTS);
  const [bulkExpanded, setBulkExpanded] = useState(false);

  const setBulkField = useCallback((field: keyof BulkDefaults, value: string) => {
    setBulkDefaults((prev) => ({ ...prev, [field]: value }));
  }, []);

  const [lineItems, setLineItems] = useState<LineItemFormState[]>(() =>
    initGuestLineItems(rfq.lineItems),
  );

  // ── Quote entry mode + PDF extraction (FOR-206) ─────────────────────────────
  const [mode, setMode] = useState<ResponseMode>('manual');
  const [sourceFileId, setSourceFileId] = useState<string | null>(null);
  const [matchStats, setMatchStats] = useState<{ matched: number; unmatched: number } | null>(null);
  const extraction = useQuoteExtraction(token);
  const appliedExtractionIdRef = useRef<string | null>(null);

  // When a quote PDF finishes extracting, match its items onto the RFQ line
  // items and pre-fill the (still editable) form for the vendor to review.
  useEffect(() => {
    const job = extraction.job;
    if (job?.status !== 'COMPLETED') return;
    if (appliedExtractionIdRef.current === job.id) return;
    appliedExtractionIdRef.current = job.id;

    const result = (job.editedResult ?? job.rawResult) as unknown as QuoteExtractionResult | null;
    const {
      lineItems: prefilled,
      matchedCount,
      unmatchedCount,
    } = matchExtractedQuote(initGuestLineItems(rfq.lineItems), result ?? EMPTY_QUOTE_RESULT);
    setLineItems(prefilled);
    setSourceFileId(job.file.id);
    setMatchStats({ matched: matchedCount, unmatched: unmatchedCount });
  }, [extraction.job, rfq.lineItems]);

  const switchMode = useCallback(
    (next: ResponseMode) => {
      setMode(next);
      if (next === 'manual') {
        // Returning to manual entry discards the extraction + its attachment so
        // a half-read PDF can't silently ride along with a hand-entered quote.
        extraction.reset();
        appliedExtractionIdRef.current = null;
        setSourceFileId(null);
        setMatchStats(null);
        setLineItems(initGuestLineItems(rfq.lineItems));
      }
    },
    [extraction, rfq.lineItems],
  );

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

  const [validityPeriod, setValidityPeriod] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [showInfo, setShowInfo] = useState(false);

  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<QuoteValidationError[]>([]);

  const buildSubmitInput = useCallback((): SubmitQuoteInput => {
    const includedLineItems: SubmitQuoteLineItemInput[] = lineItems
      .filter((item) => item.included)
      .map((item) => {
        const lineItem: SubmitQuoteLineItemInput = {
          rfqLineItemId: item.rfqLineItemId,
          unitPrice: safeFloat(item.unitPrice),
          quotedQuantity: safeFloat(item.availQty),
          deliveryDate: item.deliveryDate,
        };

        if (item.discount) {
          lineItem.discount = safeFloat(item.discount);
          lineItem.discountType = item.discountType;
        }
        if (item.gst) {
          lineItem.tax = safeFloat(item.gst);
          lineItem.taxIncluded = item.taxIncluded;
        }
        if (item.notes) lineItem.notes = item.notes;
        if (item.backOrderQty) lineItem.backOrderQty = safeFloat(item.backOrderQty);
        if (item.backOrderDeliveryDate) lineItem.backOrderDeliveryDate = item.backOrderDeliveryDate;
        if (item.substituteItemId) lineItem.substituteItemId = item.substituteItemId;

        return lineItem;
      });

    const input: SubmitQuoteInput = {
      lineItems: includedLineItems,
      // The PDF path is exactly when an extracted quote attachment is present.
      source: sourceFileId ? 'PDF' : 'FORM',
    };

    if (bulkDefaults.bulkDeliveryTime) input.bulkDeliveryTime = bulkDefaults.bulkDeliveryTime;
    if (bulkDefaults.bulkDiscount) input.bulkDiscount = safeFloat(bulkDefaults.bulkDiscount);
    if (bulkDefaults.bulkTax) input.bulkTax = safeFloat(bulkDefaults.bulkTax);
    if (bulkDefaults.shipment) input.bulkShipment = safeFloat(bulkDefaults.shipment);
    if (validityPeriod) input.validityPeriod = validityPeriod;
    if (paymentTerms) input.paymentTerms = paymentTerms;
    if (additionalNotes) input.message = additionalNotes;
    // Attach the uploaded quote PDF so the contractor can see the original source.
    if (sourceFileId) input.attachmentIds = [sourceFileId];

    return input;
  }, [lineItems, bulkDefaults, validityPeriod, paymentTerms, additionalNotes, sourceFileId]);

  const submitMutation = useMutation({
    mutationFn: (input: SubmitQuoteInput) => submitGuestQuote(token, input),
    onSuccess: () => setSubmitSuccess(true),
  });

  const handleSubmit = useCallback(() => {
    const errors = validateGuestQuote(lineItems);
    setValidationErrors(errors);
    if (errors.length > 0) return;

    setSubmitSuccess(false);
    submitMutation.mutate(buildSubmitInput());
  }, [lineItems, buildSubmitInput, submitMutation]);

  return {
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
    paymentTerms,
    setPaymentTerms,
    additionalNotes,
    setAdditionalNotes,
    showInfo,
    setShowInfo,
    handleSubmit,
    isSubmitting: submitMutation.isPending,
    submitError: submitMutation.error ? submitMutation.error.message : null,
    submitSuccess,
    validationErrors,
    // PDF-upload mode (FOR-206)
    mode,
    setMode: switchMode,
    extractionPhase: extraction.phase,
    extractionFileName: extraction.fileName,
    extractionItemCount: extraction.job?.editedResult
      ? ((extraction.job.editedResult as unknown as QuoteExtractionResult).items?.length ?? 0)
      : 0,
    uploadQuote: extraction.upload,
    uploadError: extraction.uploadError,
    matchStats,
  };
}
