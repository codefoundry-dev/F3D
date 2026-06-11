import { useTranslation } from '@forethread/i18n';
import { Badge } from '@forethread/ui-components';

export interface MaterialStatusBadgeProps {
  status: string;
}

/**
 * Status pill for a material. The catalogue design renders all three states as
 * a neutral gray pill (Public / Pending / Archived), so we keep a single muted
 * style and just swap the label.
 */
export function MaterialStatusBadge({ status }: MaterialStatusBadgeProps) {
  const { t } = useTranslation(['materialCatalogue']);

  const label =
    status === 'PUBLIC'
      ? t('status.public')
      : status === 'PENDING_APPROVAL'
        ? t('status.pending')
        : status === 'ARCHIVED'
          ? t('status.archived')
          : status;

  return <Badge className="bg-muted text-muted-foreground">{label}</Badge>;
}
