import { useTranslation } from '@forethread/i18n';

/** Compact "x ago" label for a notification's createdAt (falls back to days). */
export function RelativeTime({ iso }: { iso: string }) {
  const { t } = useTranslation('notifications');

  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return <>{t('time.justNow')}</>;

  const minutes = Math.floor(diffSec / 60);
  if (minutes < 60) return <>{t('time.minutesAgo', { count: minutes })}</>;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return <>{t('time.hoursAgo', { count: hours })}</>;

  const days = Math.floor(hours / 24);
  return <>{t('time.daysAgo', { count: days })}</>;
}
