/**
 * Bill of Materials extraction result. Specialises the generic
 * DocExtraction `editedResult` payload for BOM-typed jobs (FOR-200).
 *
 * The shape is shared between the backend normalizer (which writes it) and
 * the frontend review table (which edits it), so any change here flows to
 * both ends.
 */
export interface BomLineItem {
  description: string;
  quantity: number | null;
  unit: string | null;
  targetPrice: number | null;
  notes: string | null;
}

export interface BomExtractionResult {
  title: string | null;
  projectName: string | null;
  currency: string | null;
  items: BomLineItem[];
  notes: string | null;
}

export const EMPTY_BOM_RESULT: BomExtractionResult = {
  title: null,
  projectName: null,
  currency: null,
  items: [],
  notes: null,
};

export function isBomLineItem(value: unknown): value is BomLineItem {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.description === 'string';
}

export function isBomExtractionResult(value: unknown): value is BomExtractionResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.items) && v.items.every(isBomLineItem);
}
