import type { PoChangedFields, PoChangeFieldDiff, PoDetail } from '@forethread/api-client';

import type { FormValues } from '../schemas/create-po.schema';

/**
 * FLOW 3 — PO Change Request diff engine.
 *
 * Computes the cross-package `changedFields` payload (PLAN §B) by comparing the
 * edited PO wizard form against the existing {@link PoDetail}. Only the fields
 * the backend allowlist actually applies on approve are diffed — anything else
 * is ignored, so we never emit a diff the backend would silently drop.
 *
 * Everything here is pure so it can be unit-tested without the form/runtime.
 */

/** PO-level form fields the backend can apply, in display order. */
export const PO_CHANGE_FIELDS = [
  'paymentTermsDays',
  'pickUpTimeExpectation',
  'plannedDeliveryDate',
  'deliveryLocationId',
  'message',
] as const;

export type PoChangeFieldKey = (typeof PO_CHANGE_FIELDS)[number];

/** Per-line form fields the backend can apply, in display order. */
export const PO_LINE_CHANGE_FIELDS = [
  'unitPrice',
  'quantityOrdered',
  'costCode',
  'expectedDeliveryDate',
  'deliveryTime',
  'description',
  'unitOfMeasure',
  'notes',
] as const;

export type PoLineChangeFieldKey = (typeof PO_LINE_CHANGE_FIELDS)[number];

/**
 * Commercial fields — when any of these move the change request is COMMERCIAL,
 * otherwise INTERNAL (PLAN §3 / SPEC FLOW 3). Spans both PO-level and per-line
 * money/quantity/date/location attributes.
 */
const COMMERCIAL_PO_FIELDS = new Set<string>([
  'paymentTermsDays',
  'plannedDeliveryDate',
  'deliveryLocationId',
]);
const COMMERCIAL_LINE_FIELDS = new Set<string>([
  'unitPrice',
  'quantityOrdered',
  'expectedDeliveryDate',
  'deliveryTime',
]);

/** Normalise a value for equality: empty string / null / undefined collapse to ''. */
function norm(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isNaN(value) ? '' : String(value);
  return String(value).trim();
}

/** Two values are "equal" for diff purposes when their normalised forms match. */
function isEqual(a: unknown, b: unknown): boolean {
  return norm(a) === norm(b);
}

/** Map the existing PO's current value for a PO-level change field. */
function existingPoValue(po: PoDetail, key: PoChangeFieldKey): unknown {
  switch (key) {
    case 'paymentTermsDays':
      return po.paymentTermsDays ?? '';
    case 'pickUpTimeExpectation':
      return po.pickUpTimeExpectation ?? '';
    case 'plannedDeliveryDate':
      // The detail carries an ISO timestamp; the form holds a yyyy-MM-dd string.
      return po.plannedDeliveryDate ? po.plannedDeliveryDate.slice(0, 10) : '';
    case 'deliveryLocationId':
      return po.deliveryLocationId ?? '';
    case 'message':
      return po.message ?? '';
    default:
      return '';
  }
}

/** Map the edited form's value for a PO-level change field. */
function formPoValue(form: FormValues, key: PoChangeFieldKey): unknown {
  switch (key) {
    case 'paymentTermsDays':
      return form.paymentTermsDays ?? '';
    case 'pickUpTimeExpectation':
      return form.pickUpTimeExpectation ?? '';
    case 'plannedDeliveryDate':
      return form.plannedDeliveryDate ? form.plannedDeliveryDate.slice(0, 10) : '';
    case 'deliveryLocationId':
      return form.deliveryLocationId ?? '';
    case 'message':
      return form.message ?? '';
    default:
      return '';
  }
}

function existingLineValue(
  line: PoDetail['lineItems'][number],
  key: PoLineChangeFieldKey,
): unknown {
  switch (key) {
    case 'unitPrice':
      return line.unitPrice ?? '';
    case 'quantityOrdered':
      return line.quantityOrdered ?? '';
    case 'costCode':
      return line.costCode ?? '';
    case 'expectedDeliveryDate':
      return line.expectedDeliveryDate ? line.expectedDeliveryDate.slice(0, 10) : '';
    case 'deliveryTime':
      return line.deliveryTime ?? '';
    case 'description':
      return line.description ?? '';
    case 'unitOfMeasure':
      return line.unitOfMeasure ?? '';
    case 'notes':
      return line.notes ?? '';
    default:
      return '';
  }
}

function formLineValue(line: FormValues['lineItems'][number], key: PoLineChangeFieldKey): unknown {
  switch (key) {
    case 'unitPrice':
      return line.unitPrice ?? '';
    case 'quantityOrdered':
      return line.quantityOrdered ?? '';
    case 'costCode':
      return line.costCode ?? '';
    case 'expectedDeliveryDate':
      return line.expectedDeliveryDate ? line.expectedDeliveryDate.slice(0, 10) : '';
    case 'deliveryTime':
      return line.deliveryTime ?? '';
    case 'description':
      return line.description ?? '';
    case 'unitOfMeasure':
      return line.unitOfMeasure ?? '';
    case 'notes':
      return line.notes ?? '';
    default:
      return '';
  }
}

/**
 * Diff the edited form against the existing PO into the `changedFields` payload.
 * Line items are matched by the form row's `lineItemId` (seeded from the PO line
 * `id` in change mode). Form rows with no `lineItemId` were added in the editor
 * and surface as `addedLineItems` — approving creates them on the PO. PO lines
 * whose id no longer appears among the form rows were deleted in the editor and
 * surface as `removedLineItems` (FOR-352) — approving deletes them from the PO.
 */
export function computePoChangedFields(form: FormValues, po: PoDetail): PoChangedFields {
  const fields: Record<string, PoChangeFieldDiff> = {};
  for (const key of PO_CHANGE_FIELDS) {
    const from = existingPoValue(po, key);
    const to = formPoValue(form, key);
    if (!isEqual(from, to)) {
      fields[key] = { from, to };
    }
  }

  const lineItems: PoChangedFields['lineItems'] = [];
  const addedLineItems: PoChangedFields['addedLineItems'] = [];
  const poLineById = new Map(po.lineItems.map((li) => [li.id, li]));
  for (const formLine of form.lineItems) {
    const id = formLine.lineItemId;
    if (!id) {
      // A row with no `lineItemId` was added in the editor. Only complete rows
      // count — the wizard keeps a blank trailing row that must not be sent.
      if (formLine.materialName && formLine.unitOfMeasure && Number(formLine.quantityOrdered) >= 1)
        addedLineItems.push(formToAddedLineItem(formLine));
      continue;
    }
    const existing = poLineById.get(id);
    if (!existing) continue;

    const changes: Record<string, PoChangeFieldDiff> = {};
    for (const key of PO_LINE_CHANGE_FIELDS) {
      const from = existingLineValue(existing, key);
      const to = formLineValue(formLine, key);
      if (!isEqual(from, to)) {
        changes[key] = { from, to };
      }
    }
    if (Object.keys(changes).length > 0) {
      lineItems.push({
        lineItemId: id,
        name: existing.materialName || existing.description || formLine.materialName || id,
        changes,
      });
    }
  }

  // FOR-352 — PO lines the editor deleted (no form row carries their id).
  const formLineIds = new Set(
    form.lineItems.map((li) => li.lineItemId).filter((id): id is string => Boolean(id)),
  );
  const removedLineItems: PoChangedFields['removedLineItems'] = po.lineItems
    .filter((li) => !formLineIds.has(li.id))
    .map((li) => ({
      lineItemId: li.id,
      name: li.materialName || li.description || li.id,
    }));

  const payload: PoChangedFields = {};
  if (Object.keys(fields).length > 0) payload.fields = fields;
  if (lineItems.length > 0) payload.lineItems = lineItems;
  if (removedLineItems.length > 0) payload.removedLineItems = removedLineItems;
  if (addedLineItems.length > 0) payload.addedLineItems = addedLineItems;
  return payload;
}

/**
 * Map an editor-added form row to the `addedLineItems` payload the backend
 * creates on approval. The material name folds into `description` (mirroring
 * the create-PO payload mapping) so manual-name lines keep their name on the
 * created PO line; `name` is the display label for the diff.
 */
function formToAddedLineItem(
  line: FormValues['lineItems'][number],
): NonNullable<PoChangedFields['addedLineItems']>[number] {
  return {
    name: line.materialName,
    materialId: line.materialId || undefined,
    materialCode: line.materialCode || undefined,
    description: line.materialName || line.description || undefined,
    quantityOrdered: Number(line.quantityOrdered),
    unitOfMeasure: line.unitOfMeasure,
    unitPrice: Number(line.unitPrice) || 0,
    costCode: line.costCode || undefined,
    upc: line.upc || undefined,
    manufacturerPartNumber: line.manufacturerPartNumber || undefined,
    taxCode: line.taxCode || undefined,
    expectedDeliveryDate: line.expectedDeliveryDate
      ? line.expectedDeliveryDate.slice(0, 10)
      : undefined,
    deliveryTime: line.deliveryTime || undefined,
    notes: line.notes || undefined,
  };
}

/** True when the payload carries at least one PO-level or line-item change. */
export function hasAnyChange(changed: PoChangedFields): boolean {
  return (
    changed.cancelPo === true ||
    Object.keys(changed.fields ?? {}).length > 0 ||
    (changed.lineItems ?? []).length > 0 ||
    (changed.removedLineItems ?? []).length > 0 ||
    (changed.addedLineItems ?? []).length > 0
  );
}

/**
 * Derive the change type from the diff: COMMERCIAL if any money/quantity/date/
 * location field moved — or the request cancels the PO / removes or adds line
 * items (FOR-352) — otherwise INTERNAL (note-only / cosmetic edits).
 */
export function deriveChangeType(changed: PoChangedFields): 'COMMERCIAL' | 'INTERNAL' {
  if (changed.cancelPo === true) return 'COMMERCIAL';
  if ((changed.removedLineItems ?? []).length > 0) return 'COMMERCIAL';
  if ((changed.addedLineItems ?? []).length > 0) return 'COMMERCIAL';
  for (const key of Object.keys(changed.fields ?? {})) {
    if (COMMERCIAL_PO_FIELDS.has(key)) return 'COMMERCIAL';
  }
  for (const li of changed.lineItems ?? []) {
    for (const key of Object.keys(li.changes)) {
      if (COMMERCIAL_LINE_FIELDS.has(key)) return 'COMMERCIAL';
    }
  }
  return 'INTERNAL';
}
