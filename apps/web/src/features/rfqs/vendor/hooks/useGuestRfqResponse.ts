import {
  type GuestRfqDetail,
  type SubmitQuoteInput,
  type SubmitQuoteLineItemInput,
  submitGuestQuote,
} from '@forethread/api-client';
import { useMutation } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';

import type { BulkDefaults, LineItemFormState, QuoteTotals } from './useRfqResponse';

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
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [showInfo, setShowInfo] = useState(false);

  const [submitSuccess, setSubmitSuccess] = useState(false);

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

    const input: SubmitQuoteInput = { lineItems: includedLineItems };

    if (bulkDefaults.bulkDeliveryTime) input.bulkDeliveryTime = bulkDefaults.bulkDeliveryTime;
    if (bulkDefaults.bulkDiscount) input.bulkDiscount = safeFloat(bulkDefaults.bulkDiscount);
    if (bulkDefaults.bulkTax) input.bulkTax = safeFloat(bulkDefaults.bulkTax);
    if (bulkDefaults.shipment) input.bulkShipment = safeFloat(bulkDefaults.shipment);
    if (validityPeriod) input.validityPeriod = validityPeriod;
    if (additionalNotes) input.message = additionalNotes;

    return input;
  }, [lineItems, bulkDefaults, validityPeriod, additionalNotes]);

  const submitMutation = useMutation({
    mutationFn: (input: SubmitQuoteInput) => submitGuestQuote(token, input),
    onSuccess: () => setSubmitSuccess(true),
  });

  const handleSubmit = useCallback(() => {
    setSubmitSuccess(false);
    submitMutation.mutate(buildSubmitInput());
  }, [buildSubmitInput, submitMutation]);

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
    additionalNotes,
    setAdditionalNotes,
    showInfo,
    setShowInfo,
    handleSubmit,
    isSubmitting: submitMutation.isPending,
    submitError: submitMutation.error ? submitMutation.error.message : null,
    submitSuccess,
  };
}
