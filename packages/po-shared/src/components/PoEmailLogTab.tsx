import { useTranslation } from '@forethread/i18n';
import { EmailDeliveryStatus } from '@forethread/shared-types/client';
import type { EmailLogEntryResponse } from '@forethread/shared-types/client';
import {
  Alert,
  Badge,
  EmptyState,
  Spinner,
  cn,
  formatDateTime,
  formatStatus,
} from '@forethread/ui-components';
import AlertIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';

import { usePurchaseOrderEmailLog } from '../hooks/usePurchaseOrders';

interface PoEmailLogTabProps {
  poId: string;
}

/** Delivery states that mean the email did NOT reach the recipient — these
 * trigger the sender-facing bounce alert and flag the offending rows (FOR-213). */
const FAILED_STATUSES: ReadonlySet<EmailDeliveryStatus> = new Set([
  EmailDeliveryStatus.BOUNCED,
  EmailDeliveryStatus.COMPLAINED,
  EmailDeliveryStatus.FAILED,
]);

/** True when an email entry should be surfaced as a delivery failure. */
function isFailed(entry: EmailLogEntryResponse): boolean {
  return FAILED_STATUSES.has(entry.status) || entry.bounceReason !== null;
}

/** Map a delivery status to the Badge colour classes (design-token based). */
function statusBadgeClass(status: EmailDeliveryStatus): string {
  switch (status) {
    case EmailDeliveryStatus.DELIVERED:
    case EmailDeliveryStatus.OPENED:
    case EmailDeliveryStatus.CLICKED:
      return 'bg-success/10 text-success';
    case EmailDeliveryStatus.BOUNCED:
    case EmailDeliveryStatus.COMPLAINED:
    case EmailDeliveryStatus.FAILED:
      return 'bg-destructive/10 text-destructive';
    case EmailDeliveryStatus.DELIVERY_DELAYED:
      return 'bg-warning/10 text-warning';
    case EmailDeliveryStatus.QUEUED:
    case EmailDeliveryStatus.SENT:
    default:
      return 'bg-muted text-muted-foreground';
  }
}

/**
 * Per-PO outbound email delivery log (FOR-213): a table of every email sent for
 * the purchase order with its rolled-up delivery status, send time and open
 * count. Bounced / complained / failed deliveries raise a sender-facing alert at
 * the top of the tab and flag the offending rows so the bounce reason is visible.
 */
export function PoEmailLogTab({ poId }: PoEmailLogTabProps) {
  const { t } = useTranslation('purchaseOrders');
  const { data: entries, isLoading, isError } = usePurchaseOrderEmailLog(poId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return <p className="py-8 text-sm text-muted-foreground">{t('emailLogTab.loadError')}</p>;
  }

  if (!entries || entries.length === 0) {
    return <EmptyState title={t('emailLogTab.empty')} description={t('emailLogTab.emptyHint')} />;
  }

  const failed = entries.filter(isFailed);

  return (
    <div className="space-y-4">
      {failed.length > 0 && (
        <Alert variant="destructive" icon={<AlertIcon className="w-5 h-5" />}>
          <p className="font-semibold">
            {t('emailLogTab.bounceAlertTitle', { count: failed.length })}
          </p>
          <ul className="mt-1 space-y-0.5">
            {failed.map((entry) => (
              <li key={entry.id} className="text-xs">
                {t('emailLogTab.bounceAlertItem', {
                  email: entry.toEmail,
                  reason: entry.bounceReason ?? formatStatus(entry.status),
                })}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="rounded-[10px] border border-foreground/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/10 bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3 font-medium">{t('emailLogTab.columns.recipient')}</th>
                <th className="px-4 py-3 font-medium">{t('emailLogTab.columns.subject')}</th>
                <th className="px-4 py-3 font-medium">{t('emailLogTab.columns.status')}</th>
                <th className="px-4 py-3 font-medium">{t('emailLogTab.columns.sentAt')}</th>
                <th className="px-4 py-3 font-medium text-right">
                  {t('emailLogTab.columns.opens')}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const failedRow = isFailed(entry);
                return (
                  <tr
                    key={entry.id}
                    className={cn(
                      'border-b border-foreground/10 last:border-b-0',
                      failedRow && 'bg-destructive/5',
                    )}
                  >
                    <td className="px-4 py-3 align-top text-foreground">{entry.toEmail}</td>
                    <td className="px-4 py-3 align-top text-foreground">
                      <span className="block">{entry.subject}</span>
                      {failedRow && entry.bounceReason && (
                        <span className="mt-0.5 block text-xs text-destructive">
                          {entry.bounceReason}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Badge className={statusBadgeClass(entry.status)}>
                        {formatStatus(entry.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 align-top text-muted-foreground whitespace-nowrap">
                      {formatDateTime(entry.sentAt ?? entry.createdAt)}
                    </td>
                    <td className="px-4 py-3 align-top text-right text-muted-foreground">
                      {entry.openCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
