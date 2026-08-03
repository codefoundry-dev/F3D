/**
 * Pure invoice↔PO matching logic (FOR-293): PO-reference normalization and
 * per-line pairing scores. Kept free of Prisma/Nest so it can be unit-tested
 * directly; InvoiceMatchingService orchestrates it against the database.
 */

/** Uppercase and strip everything non-alphanumeric: "P/O 13603" → "PO13603". */
export function normalizePoReference(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/gu, '');
}

/**
 * Whether an extracted PO reference cites the given PO number. Invoices print
 * references loosely ("P/O 13603", "Purchase Order: 13603", "PO-00042"), so
 * beyond exact normalized equality, an optional leading "PO" is dropped from
 * both sides and the remaining digit cores are compared with leading zeros
 * stripped — "42" and "P/O 0042" both cite "PO-00042". Non-digit remainders
 * (e.g. "INV13603") never digit-match, only exact-match.
 */
export function referenceMatchesPoNumber(reference: string, poNumber: string): boolean {
  const ref = normalizePoReference(reference);
  const po = normalizePoReference(poNumber);
  if (ref.length === 0 || po.length === 0) return false;
  if (ref === po) return true;

  const digitCore = (value: string): string | null => {
    const rest = value.startsWith('PO') ? value.slice(2) : value;
    if (!/^\d+$/u.test(rest)) return null;
    return rest.replace(/^0+/u, '') || '0';
  };

  const refCore = digitCore(ref);
  const poCore = digitCore(po);
  return refCore !== null && poCore !== null && refCore === poCore;
}

/** An invoice line's fields that participate in pairing. */
export interface MatchableInvoiceLine {
  lineId: string | null;
  description: string;
  quantity: number | null;
  unitPrice: number | null;
}

/** A PO line's fields that participate in pairing. */
export interface MatchablePoLine {
  lineNumber: number;
  materialCode: string | null;
  description: string | null;
  quantityOrdered: number;
  unitPrice: number;
}

/** Pairs below this score are treated as "not on the PO". */
export const MIN_LINE_MATCH_SCORE = 0.3;

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .filter((token) => token.length >= 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

/**
 * Score how likely an invoice line bills the given PO line, 0..1. Signals, in
 * rough order of strength: the vendor echoing our material code back in the
 * description, description word overlap, the invoice's own line number
 * matching the PO line number, and price/quantity agreement as tiebreakers.
 */
export function scoreLinePair(invoice: MatchableInvoiceLine, poLine: MatchablePoLine): number {
  let score = 0;

  const invoiceText = invoice.description.toLowerCase();
  const code = poLine.materialCode?.toLowerCase().replace(/[^a-z0-9]/gu, '');
  if (code && code.length >= 3 && invoiceText.replace(/[^a-z0-9]/gu, '').includes(code)) {
    score += 0.45;
  }

  score += 0.5 * jaccard(tokenize(invoice.description), tokenize(poLine.description ?? ''));

  const invoiceLineNo = invoice.lineId ? Number.parseInt(invoice.lineId, 10) : Number.NaN;
  if (Number.isInteger(invoiceLineNo) && invoiceLineNo === poLine.lineNumber) {
    score += 0.2;
  }

  if (
    invoice.unitPrice !== null &&
    poLine.unitPrice > 0 &&
    Math.abs(invoice.unitPrice - poLine.unitPrice) / poLine.unitPrice <= 0.005
  ) {
    score += 0.15;
  }

  if (invoice.quantity !== null && invoice.quantity === poLine.quantityOrdered) {
    score += 0.05;
  }

  return Math.min(1, score);
}

/**
 * Greedy one-to-one assignment: highest-scoring pairs first, each invoice line
 * and PO line used at most once, pairs under {@link MIN_LINE_MATCH_SCORE}
 * discarded. Returns invoice-line-index → { poIndex, score }.
 */
export function pairLines(
  invoiceLines: MatchableInvoiceLine[],
  poLines: MatchablePoLine[],
): Map<number, { poIndex: number; score: number }> {
  const pairs: { invoiceIndex: number; poIndex: number; score: number }[] = [];
  invoiceLines.forEach((invoiceLine, invoiceIndex) => {
    poLines.forEach((poLine, poIndex) => {
      const score = scoreLinePair(invoiceLine, poLine);
      if (score >= MIN_LINE_MATCH_SCORE) pairs.push({ invoiceIndex, poIndex, score });
    });
  });

  // Stable order: score desc, then document order so ties resolve predictably.
  pairs.sort(
    (a, b) => b.score - a.score || a.invoiceIndex - b.invoiceIndex || a.poIndex - b.poIndex,
  );

  const assigned = new Map<number, { poIndex: number; score: number }>();
  const usedPoLines = new Set<number>();
  for (const pair of pairs) {
    if (assigned.has(pair.invoiceIndex) || usedPoLines.has(pair.poIndex)) continue;
    assigned.set(pair.invoiceIndex, { poIndex: pair.poIndex, score: pair.score });
    usedPoLines.add(pair.poIndex);
  }
  return assigned;
}
