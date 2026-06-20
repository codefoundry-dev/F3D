import { DamageType, DeliveryOutcome } from '@forethread/shared-types/client';

/**
 * Epic 6 — Delivery feature constants. Outcome / damage-type / status option
 * lists (rendered via the `deliveries` i18n namespace) plus the small shared
 * helpers used across the list / create / detail pages.
 */

/** Outcome dropdown options (create page "Outcome" Select + detail render). */
export const DELIVERY_OUTCOME_OPTIONS: readonly DeliveryOutcome[] = [
  DeliveryOutcome.DELIVERED,
  DeliveryOutcome.PARTIALLY_DELIVERED,
  DeliveryOutcome.NOT_DELIVERED,
  DeliveryOutcome.DAMAGED,
  DeliveryOutcome.REJECTED,
];

/** Damage "Type" dropdown options (create page damage sub-form). */
export const DAMAGE_TYPE_OPTIONS: readonly DamageType[] = [
  DamageType.IN_TRANSIT,
  DamageType.MANUFACTURING_DEFECT,
  DamageType.PACKAGING,
  DamageType.WATER,
  DamageType.OTHER,
];

/** Status filter options (list page "Status" dropdown). */
export const DELIVERY_STATUS_FILTER_OPTIONS = ['SUBMITTED', 'APPROVED', 'REJECTED'] as const;

/** Accepted upload types for delivery attachments (matches the Figma hint copy). */
export const DELIVERY_ATTACHMENT_ACCEPT = '.pdf,.xlsx,.docx,.jpg,.jpeg,.png,.csv';

/**
 * List-card delivery timestamp, e.g. "12/12/2024 12:00" (screenshot 01). Distinct
 * from the shared `formatDate` ("Jan 20, 2025") used on the detail page.
 */
export function formatDeliveryDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '-';
  const date = d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} ${time}`;
}
