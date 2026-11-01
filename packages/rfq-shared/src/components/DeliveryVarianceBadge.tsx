import { useTranslation } from '@forethread/i18n';
import { cn } from '@forethread/ui-components';

interface DeliveryVarianceBadgeProps {
  /** Quoted minus expected delivery in calendar days; null renders nothing. */
  days: number | null | undefined;
  className?: string;
}

/**
 * FOR-392: "+4 days" (late, red) or "On time" (green) next to a quoted
 * delivery date, measured against the line's expected date.
 */
export function DeliveryVarianceBadge({ days, className }: DeliveryVarianceBadgeProps) {
  const { t } = useTranslation('rfqs');
  if (days === null || days === undefined) return null;
  const late = days > 0;
  const title = late
    ? t('deliveryVariance.lateTitle', { count: days })
    : days < 0
      ? t('deliveryVariance.earlyTitle', { count: -days })
      : t('deliveryVariance.onDayTitle');
  return (
    <span
      title={title}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap',
        late
          ? 'bg-destructive/10 text-destructive'
          : 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]',
        className,
      )}
    >
      {late ? t('deliveryVariance.late', { count: days }) : t('deliveryVariance.onTime')}
    </span>
  );
}
