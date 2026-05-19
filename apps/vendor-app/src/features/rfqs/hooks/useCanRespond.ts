import type { RfqDetail } from '@forethread/api-client';
import { useMemo } from 'react';

/**
 * Returns whether the current vendor can create or edit a quote response for the given RFQ.
 *
 * The backend maps RFQ statuses to VendorRfqStatus before sending to the vendor app:
 *   OPEN / AWAITING_RESPONSE → INCOMING
 *   SUBMITTED quote          → RESPONDED
 *   APPROVED quote           → APPROVED
 *   CANCELLED / DECLINED     → REJECTED
 *   CLOSED                   → CLOSED
 *
 * canCreate: vendor hasn't submitted a quote yet and the RFQ is still open (INCOMING).
 * canEdit:   vendor already submitted a quote and the RFQ hasn't been closed/cancelled (RESPONDED).
 * existingQuoteId: the id of the existing quote if one exists.
 */
export function useCanRespond(rfq: RfqDetail | undefined) {
  return useMemo(() => {
    if (!rfq) return { canCreate: false, canEdit: false, existingQuoteId: null };

    const canCreate = rfq.status === 'INCOMING';
    const canEdit = rfq.status === 'RESPONDED';
    const existingQuoteId =
      canEdit && rfq.quoteResponses?.[0]?.id ? rfq.quoteResponses[0].id : null;

    return { canCreate, canEdit, existingQuoteId };
  }, [rfq]);
}
