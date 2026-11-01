import type { RfqDetail, RfqQuoteLine } from '@forethread/api-client';

/**
 * FOR-391: a PO line bought from an RFQ is priced at the vendor's quoted unit
 * price for that line — never a figure spread from the quote total. These
 * helpers find that quoted line on an {@link RfqDetail}.
 */

export type RfqQuote = RfqDetail['quoteResponses'][number];

export function isApprovedQuote(qr: RfqQuote): boolean {
  return qr.status === 'APPROVED' || qr.status === 'Approved';
}

/** A line the vendor actually quoted and the buyer hasn't declined. */
export function isPurchasableQuoteLine(ql: RfqQuoteLine): boolean {
  return (
    ql.availability !== 'NO_QUOTE' && ql.availability !== 'UNAVAILABLE' && ql.status !== 'DECLINED'
  );
}

/** The quote's purchasable line for one RFQ line, if the vendor quoted it. */
export function quotedLineFor(qr: RfqQuote, rfqLineItemId: string): RfqQuoteLine | null {
  return (
    qr.lineItems?.find((ql) => ql.rfqLineItemId === rfqLineItemId && isPurchasableQuoteLine(ql)) ??
    null
  );
}

/**
 * The approved quote a from-RFQ PO buys from: the given quote when named,
 * otherwise the approved quote of `vendorId`, otherwise the first approved one.
 */
export function pickApprovedQuote(
  rfq: RfqDetail,
  opts: { quoteResponseId?: string; vendorId?: string } = {},
): RfqQuote | null {
  if (opts.quoteResponseId) {
    return rfq.quoteResponses.find((qr) => qr.id === opts.quoteResponseId) ?? null;
  }
  const approved = rfq.quoteResponses.filter(isApprovedQuote);
  if (opts.vendorId) {
    const forVendor = approved.find((qr) => qr.vendorId === opts.vendorId);
    if (forVendor) return forVendor;
  }
  return approved[0] ?? null;
}
