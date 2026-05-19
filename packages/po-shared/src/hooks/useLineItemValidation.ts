import type { ValidatePoItemsSuggestion } from '@forethread/api-client';
import { validatePoItems } from '@forethread/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';

interface LineItem {
  materialName: string;
  unitOfMeasure: string;
  quantityOrdered: number;
}

interface UseLineItemValidationOptions {
  projectId: string;
  lineItems: LineItem[];
  /** Only run when PO is created manually (not from RFQ/bulk order) */
  enabled: boolean;
  /** Debounce delay in ms */
  debounceMs?: number;
}

/**
 * Auto-validates filled line items against bulk orders and approved RFQs (AC 9-12).
 * Debounces to avoid excessive API calls while user is still typing.
 */
export function useLineItemValidation({
  projectId,
  lineItems,
  enabled,
  debounceMs = 1000,
}: UseLineItemValidationOptions) {
  const [suggestions, setSuggestions] = useState<ValidatePoItemsSuggestion[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [dismissedIndices, setDismissedIndices] = useState<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Build the filled items fingerprint for change detection
  const filledItems = lineItems.filter(
    (li) => li.materialName && li.unitOfMeasure && li.quantityOrdered >= 1,
  );

  const fingerprint = filledItems
    .map((li) => `${li.materialName}|${li.quantityOrdered}`)
    .join(';;');

  const validate = useCallback(async () => {
    if (!projectId || filledItems.length === 0) {
      setSuggestions([]);
      return;
    }

    // Abort previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsValidating(true);
    try {
      const result = await validatePoItems(
        {
          projectId,
          lineItems: filledItems.map((li) => ({
            materialName: li.materialName,
            quantity: li.quantityOrdered,
          })),
        },
        { signal: controller.signal },
      );

      if (!controller.signal.aborted) {
        setSuggestions(result.suggestions);
        // Reset dismissed indices when suggestions change
        setDismissedIndices(new Set());
      }
    } catch {
      // Silently ignore abort errors and network failures
    } finally {
      if (!controller.signal.aborted) {
        setIsValidating(false);
      }
    }
  }, [projectId, filledItems]);

  // Debounced auto-validation
  useEffect(() => {
    if (!enabled || !projectId) {
      setSuggestions([]);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      void validate();
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint, enabled, projectId, debounceMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const dismissSuggestion = useCallback((lineItemIndex: number) => {
    setDismissedIndices((prev) => new Set(prev).add(lineItemIndex));
  }, []);

  // Only return suggestions that have matches and haven't been dismissed
  const activeSuggestions = suggestions.filter(
    (s) => (s.bulkOrderMatch || s.rfqMatch) && !dismissedIndices.has(s.lineItemIndex),
  );

  const hasBulkOrderSuggestions = activeSuggestions.some((s) => s.bulkOrderMatch);
  const hasRfqSuggestions = activeSuggestions.some((s) => s.rfqMatch);

  return {
    suggestions: activeSuggestions,
    isValidating,
    hasBulkOrderSuggestions,
    hasRfqSuggestions,
    dismissSuggestion,
  };
}
