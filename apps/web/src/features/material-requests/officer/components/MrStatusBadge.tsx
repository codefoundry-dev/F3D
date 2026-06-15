import { useTranslation } from '@forethread/i18n';
import { Badge } from '@forethread/ui-components';

/**
 * Status → colour tone, mirroring the Foreman `MyRequestsPage` STATUS_TONE so
 * the same MR status reads identically across the mobile and officer surfaces.
 * Tones use semantic Tailwind utility families (not raw hex) per the shared
 * design-token system used by the PO/RFQ dashboards.
 */
const STATUS_TONE: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SUBMITTED: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  CONVERTED: 'bg-indigo-100 text-indigo-800',
  DECLINED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-muted text-muted-foreground',
};

/** Priority → dot/text tone. */
const PRIORITY_TONE: Record<string, string> = {
  LOW: 'bg-muted text-muted-foreground',
  MEDIUM: 'bg-sky-100 text-sky-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800',
};

export function MrStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation('materialRequests');
  return (
    <Badge className={STATUS_TONE[status] ?? STATUS_TONE.DRAFT}>
      {t(`status.${status}` as never)}
    </Badge>
  );
}

export function MrPriorityBadge({ priority }: { priority: string }) {
  const { t } = useTranslation('materialRequests');
  return (
    <Badge className={PRIORITY_TONE[priority] ?? PRIORITY_TONE.LOW}>
      {t(`priority.${priority}` as never)}
    </Badge>
  );
}
