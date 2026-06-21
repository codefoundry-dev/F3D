import { useTranslation } from '@forethread/i18n';
import { Badge } from '@forethread/ui-components';

import { type MrPriority } from '../wizard/wizard-types';

/**
 * Priority chip on the Review step (Figma 2002:176 frame 14:426). Rendered with
 * the shared DS Badge using the same semantic tones as the officer
 * `MrPriorityBadge`, so a priority reads identically across the Foreman and
 * officer surfaces.
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

const TONE: Record<MrPriority, string> = {
  LOW: 'bg-muted text-muted-foreground',
  MEDIUM: 'bg-sky-100 text-sky-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800',
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const { t } = useTranslation('materialRequests');
  return <Badge className={TONE[priority]}>{t(LABEL_KEY[priority] as never)}</Badge>;
}
