import {
  DamageDisposition,
  DamageType,
  DeliveryOutcome,
} from '@forethread/shared-types/client';
import type {
  CreateDeliveryReportLineInput,
  DeliveryPortalLine,
} from '@forethread/shared-types/client';

/**
 * Per-line draft state for the public mobile delivery form (screenshots 12/13).
 *
 * The portal exposes a lighter line model than the internal create page: there
 * is no free-form Outcome dropdown — the delivery person sets a Delivered qty
 * and optionally flips the line to NOT_DELIVERED / DAMAGED / REJECTED via toggle
 * buttons. PARTIALLY_DELIVERED is *derived* (delivered > 0 but < ordered) rather
 * than chosen, matching the line badge in the design.
 */
export interface PortalLineDraft {
  /** PO line id — becomes `poLineItemId` on the submitted report. */
  id: string;
  lineItemRef: string;
  materialName: string;
  description: string | null;
  uom: string;
  quantityOrdered: number;
  /** Delivered quantity (string so the stepper/input can be empty mid-edit). */
  quantityReceived: string;
  /** The status the delivery person picked, or null for the default delivered path. */
  status: PortalLineStatus;
  // Damage sub-form (only meaningful when status === DAMAGED).
  damagedQuantity: string;
  damageType: DamageType | '';
  damageDisposition: DamageDisposition | null;
  /** Photos captured client-side; uploaded after the report is created. */
  photos: File[];
}

/** The mutually-exclusive status a delivery person can toggle on a line. */
export type PortalLineStatus = 'NOT_DELIVERED' | 'DAMAGED' | 'REJECTED' | null;

/** Seed a draft line from a read-only portal PO line (Delivered qty pre-filled to ordered). */
export function portalPoLineToDraft(line: DeliveryPortalLine): PortalLineDraft {
  return {
    id: line.id,
    lineItemRef: line.lineItemRef,
    materialName: line.materialName,
    description: line.description,
    uom: line.uom,
    quantityOrdered: line.quantityOrdered,
    quantityReceived: String(line.quantityOrdered),
    status: null,
    damagedQuantity: '0',
    damageType: '',
    damageDisposition: null,
    photos: [],
  };
}

/**
 * Resolve the *effective* delivery outcome for a draft line. An explicit toggle
 * (Not delivered / Damaged / Rejected) wins; otherwise the outcome is derived
 * from the delivered quantity (full → DELIVERED, partial → PARTIALLY_DELIVERED,
 * zero → NOT_DELIVERED), matching the per-line badge in the Figma.
 */
export function resolveOutcome(line: PortalLineDraft): DeliveryOutcome {
  if (line.status === 'NOT_DELIVERED') return DeliveryOutcome.NOT_DELIVERED;
  if (line.status === 'DAMAGED') return DeliveryOutcome.DAMAGED;
  if (line.status === 'REJECTED') return DeliveryOutcome.REJECTED;

  const qty = Number(line.quantityReceived);
  if (!Number.isFinite(qty) || qty <= 0) return DeliveryOutcome.NOT_DELIVERED;
  if (qty < line.quantityOrdered) return DeliveryOutcome.PARTIALLY_DELIVERED;
  return DeliveryOutcome.DELIVERED;
}

/** Whether a draft line is complete enough to submit (damaged lines need their sub-form). */
export function isPortalLineValid(line: PortalLineDraft): boolean {
  const qty = Number(line.quantityReceived);
  if (line.quantityReceived.trim() === '' || !Number.isInteger(qty) || qty < 0) return false;
  if (resolveOutcome(line) === DeliveryOutcome.DAMAGED) {
    const dmg = Number(line.damagedQuantity);
    if (!Number.isInteger(dmg) || dmg <= 0) return false;
    if (!line.damageType) return false;
    if (!line.damageDisposition) return false;
  }
  return true;
}

/**
 * Map a draft line to the API submit payload. NOT_DELIVERED / REJECTED force a
 * received quantity of 0; DAMAGED carries the inline damage details. Mirrors the
 * internal create page's line mapping so both paths produce the same shape.
 */
export function portalLineToInput(line: PortalLineDraft): CreateDeliveryReportLineInput {
  const outcome = resolveOutcome(line);
  const zeroed = outcome === DeliveryOutcome.NOT_DELIVERED || outcome === DeliveryOutcome.REJECTED;
  const base: CreateDeliveryReportLineInput = {
    poLineItemId: line.id,
    quantityReceived: zeroed ? 0 : Number(line.quantityReceived),
    outcome,
  };
  if (outcome === DeliveryOutcome.DAMAGED) {
    return {
      ...base,
      damagedQuantity: Number(line.damagedQuantity),
      damageType: line.damageType || undefined,
      damageDisposition: line.damageDisposition ?? undefined,
    };
  }
  return base;
}

/** Counts shown on the "Report submitted" screen (screenshot 14), keyed by outcome. */
export interface PortalSummary {
  delivered: number;
  partialDelivered: number;
  notDelivered: number;
  damage: number;
  rejected: number;
}

/** Tally submitted lines by their resolved outcome for the confirmation screen. */
export function summarisePortalLines(lines: PortalLineDraft[]): PortalSummary {
  const summary: PortalSummary = {
    delivered: 0,
    partialDelivered: 0,
    notDelivered: 0,
    damage: 0,
    rejected: 0,
  };
  for (const line of lines) {
    switch (resolveOutcome(line)) {
      case DeliveryOutcome.DELIVERED:
        summary.delivered += 1;
        break;
      case DeliveryOutcome.PARTIALLY_DELIVERED:
        summary.partialDelivered += 1;
        break;
      case DeliveryOutcome.NOT_DELIVERED:
        summary.notDelivered += 1;
        break;
      case DeliveryOutcome.DAMAGED:
        summary.damage += 1;
        break;
      case DeliveryOutcome.REJECTED:
        summary.rejected += 1;
        break;
    }
  }
  return summary;
}
