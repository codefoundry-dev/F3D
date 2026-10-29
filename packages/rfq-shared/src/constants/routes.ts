export const RFQ_ROUTES = {
  rfqs: '/rfqs',
  rfqDetail: '/rfqs/:id',
  quoteResponseDetail: '/rfqs/:id/quotes/:quoteId',
} as const;

/** PO creation flow entry — target of "Start now" in the review-quotes flow (US 5.19). */
export const PO_CREATE_ROUTE = '/purchase-orders/new';

/** PO detail — where approving a quote lands the buyer on the new draft PO (FOR-396). */
export const PO_DETAIL_ROUTE = '/purchase-orders/:id';
