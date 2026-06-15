/**
 * Client-side state for the Foreman "Raise a Material Request" wizard
 * (Figma node 2002:176 — "Material Request flow").
 *
 * The wizard accumulates selected materials across three source tabs (BOM,
 * Catalog, Manual) on step 1, collects per-line + header details on step 2, and
 * submits a single Material Request on step 3. State is UI-shaped: dates are
 * `YYYY-MM-DD` strings, quantities are numbers, and every row carries a stable
 * client `key` so list edits never re-key React state.
 *
 * The types here are deliberately string-union shaped (not the shared-types
 * enums) so this module never drags the swagger-laden root barrel into Vite.
 */

import type { CreateMaterialRequestInput, CreateMrLineItemInput } from '@forethread/api-client';

/** Priority values understood by the backend MR API. */
export type MrPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/** Where a wizard line originated. */
export type MrLineSource = 'BOM' | 'CATALOG' | 'MANUAL';

/** The two-state Standard/High toggle on the Material Details step. */
export type MrPriorityToggle = 'STANDARD' | 'HIGH';

export interface MrWizardLine {
  /** Stable client identity for React state. */
  key: string;
  source: MrLineSource;
  /** Catalogue material id — present for CATALOG/BOM lines matched to the
   * catalogue; absent for free-text MANUAL lines. */
  materialId?: string;
  materialName: string;
  description?: string;
  /** Display SKU (catalogue lines only) — never sent to the API. */
  sku?: string;
  /** Unit of measure (e.g. pcs, Each, Box). */
  unit: string;
  /** Quantity needed — 0 until the foreman fills it on step 2. */
  quantity: number;
  /** Maximum available stock, when known (catalogue lines) — display only. */
  maxAvailable?: number;
  /** Per-line priority toggle (maps to LOW/MEDIUM/HIGH/URGENT on submit). */
  priority: MrPriorityToggle;
  /** YYYY-MM-DD */
  expectedDeliveryDate?: string;
  /** Free-text delivery time expectation (display/notes only — no API field). */
  deliveryTime?: string;
  /** Per-line delivery location id (project DELIVERY location). */
  deliveryLocationId?: string;
  /** Usage instructions (sent to the API as the line's notes). */
  instructions?: string;
  /** Internal notes (appended to the line notes). */
  internalNotes?: string;
  /** CC team members free-text (display only — no API field today). */
  ccTeamMembers?: string;
}

export interface MrWizardState {
  /** Selected project (job) — required before step 1. */
  projectId: string;
  lines: MrWizardLine[];
}

let keyCounter = 0;
/** Monotonic client key — index-free so row removal never re-keys siblings. */
export function nextLineKey(): string {
  keyCounter += 1;
  return `mr-li-${keyCounter}`;
}

/** Map the Standard/High toggle to the API priority enum. */
export function toggleToPriority(toggle: MrPriorityToggle): MrPriority {
  return toggle === 'HIGH' ? 'HIGH' : 'MEDIUM';
}

/** Map an API priority value back to the Standard/High toggle. */
export function priorityToToggle(priority: string | null | undefined): MrPriorityToggle {
  return priority === 'HIGH' || priority === 'URGENT' ? 'HIGH' : 'STANDARD';
}

// ── Step validation ──────────────────────────────────────────────────────────

export interface MrLineErrors {
  quantity?: string;
  expectedDeliveryDate?: string;
  deliveryTime?: string;
  deliveryLocationId?: string;
}

export type MrDetailsErrors = Record<string, MrLineErrors>;

/** A line is "selected" on step 1 regardless of quantity. Step 1 just needs at
 * least one line. */
export function validateSelection(lines: MrWizardLine[]): boolean {
  return lines.length > 0;
}

/**
 * Validate the Material Details step. Per the design, every line requires a
 * Quantity, a Need-by date, a Delivery Time and a Delivery Address. Quantity may
 * not exceed the known stock ceiling. Returns a per-line error map keyed by the
 * line's client key; an empty map means the step is valid.
 */
export function validateDetails(lines: MrWizardLine[]): MrDetailsErrors {
  const errors: MrDetailsErrors = {};
  for (const line of lines) {
    const lineErrors: MrLineErrors = {};
    if (!(line.quantity > 0)) {
      lineErrors.quantity = 'required';
    } else if (typeof line.maxAvailable === 'number' && line.quantity > line.maxAvailable) {
      lineErrors.quantity = 'exceedsStock';
    }
    if (!line.expectedDeliveryDate) lineErrors.expectedDeliveryDate = 'required';
    if (!line.deliveryTime?.trim()) lineErrors.deliveryTime = 'required';
    if (!line.deliveryLocationId) lineErrors.deliveryLocationId = 'required';
    if (Object.keys(lineErrors).length > 0) errors[line.key] = lineErrors;
  }
  return errors;
}

export function hasDetailsErrors(errors: MrDetailsErrors): boolean {
  return Object.keys(errors).length > 0;
}

// ── Submit payload assembly ──────────────────────────────────────────────────

/** YYYY-MM-DD → ISO datetime (the backend accepts ISO strings). */
function toIsoDate(date: string | undefined): string | undefined {
  if (!date) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00.000Z` : date;
}

/** Compose the per-line notes blob from instructions + internal notes + the
 * pieces the API has no dedicated field for (delivery time, CC team). */
export function composeLineNotes(line: MrWizardLine): string | undefined {
  const parts: string[] = [];
  if (line.instructions?.trim()) parts.push(line.instructions.trim());
  if (line.internalNotes?.trim()) parts.push(`Internal: ${line.internalNotes.trim()}`);
  if (line.deliveryTime?.trim()) parts.push(`Delivery time: ${line.deliveryTime.trim()}`);
  if (line.ccTeamMembers?.trim()) parts.push(`CC: ${line.ccTeamMembers.trim()}`);
  return parts.length > 0 ? parts.join('\n') : undefined;
}

function toLineInput(line: MrWizardLine): CreateMrLineItemInput {
  const input: CreateMrLineItemInput = {
    quantity: line.quantity,
    unit: line.unit,
    priority: toggleToPriority(line.priority),
  };
  // A line needs materialId OR materialName. Prefer the catalogue id; fall back
  // to the free-text name for MANUAL lines.
  if (line.materialId) {
    input.materialId = line.materialId;
  } else {
    input.materialName = line.materialName;
  }
  if (line.description?.trim()) input.description = line.description.trim();
  if (line.expectedDeliveryDate) input.expectedDeliveryDate = toIsoDate(line.expectedDeliveryDate);
  if (line.deliveryLocationId) input.deliveryLocationId = line.deliveryLocationId;
  const notes = composeLineNotes(line);
  if (notes) input.notes = notes;
  return input;
}

/**
 * Build the create-MR payload from wizard state. The request-level priority is
 * the highest line priority (HIGH wins over MEDIUM); the request-level
 * needed-by date and delivery location default to the earliest line's values.
 * `submit: true` creates the request directly in SUBMITTED (sent for approval).
 */
export function buildCreateInput(
  state: MrWizardState,
  options: { submit: boolean } = { submit: true },
): CreateMaterialRequestInput {
  const lineItems = state.lines.map(toLineInput);

  const anyHigh = state.lines.some((l) => l.priority === 'HIGH');
  const firstWithDate = state.lines.find((l) => l.expectedDeliveryDate);
  const firstWithLocation = state.lines.find((l) => l.deliveryLocationId);

  const input: CreateMaterialRequestInput = {
    projectId: state.projectId,
    priority: anyHigh ? 'HIGH' : 'MEDIUM',
    submit: options.submit,
    lineItems,
  };
  if (firstWithDate?.expectedDeliveryDate) {
    input.neededByDate = toIsoDate(firstWithDate.expectedDeliveryDate);
  }
  if (firstWithLocation?.deliveryLocationId) {
    input.deliveryLocationId = firstWithLocation.deliveryLocationId;
  }
  return input;
}
