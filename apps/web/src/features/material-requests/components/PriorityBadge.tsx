import { useTranslation } from '@forethread/i18n';

import { type MrPriority } from '../wizard/wizard-types';

/**
 * Priority chip on the Review step (Figma 2002:176 frame 14:426). The design
 * uses one neutral pill (#F4F4F6 / #2D3139) and conveys priority through the
 * label only. We keep a subtle accent tint for HIGH/URGENT so the foreman can
 * scan urgent lines at a glance without departing from the design palette.
 */
export interface PriorityBadgeProps {
  priority: MrPriority;
}

const LABEL_KEY: Record<MrPriority, string> = {
  LOW: 'review.lowPriority',
  MEDIUM: 'review.mediumPriority',
  HIGH: 'review.highPriority',
  URGENT: 'review.urgentPriority',
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const { t } = useTranslation('materialRequests');
  const accent = priority === 'HIGH' || priority === 'URGENT';
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-normal ${
        accent ? 'bg-[#FEF2F2] text-[#B91C1C]' : 'bg-[#F4F4F6] text-[#2D3139]'
      }`}
    >
      {t(LABEL_KEY[priority] as never)}
    </span>
  );
}
