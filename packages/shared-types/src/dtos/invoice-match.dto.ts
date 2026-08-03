/**
 * Invoice ↔ PO reconciliation result (FOR-293). Computed on demand from the
 * invoice's saved line items and the resolved purchase order — nothing here is
 * persisted; the reviewer confirms the pairing by saving `relatedPoId` on the
 * review form. Builds on the extraction's `poReferences` (FOR-291).
 */

/**
 * How the purchase order was (or wasn't) resolved for the invoice:
 * - LINKED — the invoice already carries `relatedPoId` (reviewer-confirmed).
 * - AUTO_MATCHED — exactly one company PO matches an extracted PO reference.
 * - AMBIGUOUS — several company POs match the extracted references; the
 *   reviewer must pick one (candidates are listed).
 * - NOT_FOUND — the invoice cites PO reference(s), but none resolve to a
 *   company PO.
 * - NO_REFERENCE — the invoice cites no PO at all (flagged per FOR-218).
 */
export type InvoicePoResolution =
  | 'LINKED'
  | 'AUTO_MATCHED'
  | 'AMBIGUOUS'
  | 'NOT_FOUND'
  | 'NO_REFERENCE';

export type InvoiceLineMatchFlag = 'PRICE_VARIANCE' | 'QTY_VARIANCE' | 'NOT_ON_PO';

/** The resolved (or candidate) purchase order, header-level. */
export interface InvoiceMatchedPo {
  id: string;
  poNumber: string;
  status: string;
  vendorId: string | null;
  vendorName: string | null;
  projectId: string;
  totalAmount: number | null;
}

/** A PO line as compared against the invoice. */
export interface InvoicePoMatchPoLine {
  id: string;
  lineNumber: number;
  materialCode: string | null;
  description: string | null;
  quantityOrdered: number;
  quantityDelivered: number;
  unitOfMeasure: string;
  unitPrice: number;
  lineTotal: number;
}

/** One saved invoice line with its PO pairing and variance flags. */
export interface InvoicePoMatchLine {
  invoiceLineId: string;
  position: number;
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
  /** The paired PO line; null when the line is not on the PO. */
  poLine: InvoicePoMatchPoLine | null;
  /** Pairing confidence 0..1; null when unmatched. */
  matchConfidence: number | null;
  /** (invoice − PO) / PO unit price, as a percentage; null when either price is absent. */
  priceVariancePct: number | null;
  /** invoice quantity − PO quantity ordered; null when either quantity is absent. */
  quantityDelta: number | null;
  flags: InvoiceLineMatchFlag[];
}

export interface InvoicePoMatchSummary {
  lineCount: number;
  matchedCount: number;
  priceVarianceCount: number;
  quantityVarianceCount: number;
  /** Invoice lines with no counterpart on the PO. */
  unexpectedCount: number;
}

export interface InvoicePoMatchThresholds {
  /** |price variance %| above this flags PRICE_VARIANCE (FOR-218: configurable, ±2% default). */
  priceTolerancePct: number;
  /** |quantity delta| above this flags QTY_VARIANCE (exact by default). */
  quantityTolerance: number;
}

export interface InvoicePoMatchResult {
  resolution: InvoicePoResolution;
  /** The PO the lines were checked against; null unless LINKED or AUTO_MATCHED. */
  po: InvoiceMatchedPo | null;
  /** All resolving POs when AMBIGUOUS (otherwise empty). */
  poCandidates: InvoiceMatchedPo[];
  /** PO references as extracted from the document (FOR-291). */
  poReferences: string[];
  /** True when the invoice's reviewed vendor differs from the PO's vendor. */
  vendorMismatch: boolean;
  lines: InvoicePoMatchLine[];
  /** PO lines the invoice does not bill — context for the reviewer. */
  unbilledPoLines: InvoicePoMatchPoLine[];
  thresholds: InvoicePoMatchThresholds;
  summary: InvoicePoMatchSummary;
}
