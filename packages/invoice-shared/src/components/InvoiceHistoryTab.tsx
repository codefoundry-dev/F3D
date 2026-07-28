import type { InvoiceAuditEntry, InvoiceDetail } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Spinner, formatDateTime } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import ClockIcon from '@forethread/ui-components/assets/icons/clock.svg?react';

import { useInvoiceAuditTrail } from '../hooks/useInvoices';

interface TimelineEntry {
  key: string;
  label: string;
  at: string;
  /** "By {name}" — the acting user, when known. */
  performer: string | null;
  /** The approve note / rejection reason recorded with the transition. */
  reason: string | null;
  isRejection: boolean;
}

function readReason(metadata: Record<string, unknown> | null): string | null {
  const value = metadata?.reason;
  return typeof value === 'string' && value.trim() ? value : null;
}

/**
 * The invoice's state history (FOR-294): intake and review stamps synthesized
 * from the invoice record, then the audited transitions (approve / reject)
 * with who made them and the reason they gave, oldest first.
 */
export function InvoiceHistoryTab({ invoice }: { invoice: InvoiceDetail }) {
  const { t } = useTranslation('invoices');
  const { data: auditEntries, isLoading } = useInvoiceAuditTrail(invoice.id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="md" />
      </div>
    );
  }

  const entries: TimelineEntry[] = [
    {
      key: 'received',
      label: t('history.received', { defaultValue: 'Invoice received' }),
      at: invoice.createdAt,
      performer: null,
      reason: null,
      isRejection: false,
      // Email-intake invoices name the sending address; uploads stay generic.
    },
  ];
  if (invoice.source === 'EMAIL' && invoice.senderEmail) {
    entries[0].performer = t('history.receivedEmail', {
      defaultValue: `From ${invoice.senderEmail}`,
      email: invoice.senderEmail,
    });
  }

  if (invoice.reviewedAt) {
    entries.push({
      key: 'reviewed',
      label: t('history.reviewed', { defaultValue: 'Details reviewed' }),
      at: invoice.reviewedAt,
      performer: null,
      reason: null,
      isRejection: false,
    });
  }

  for (const entry of (auditEntries ?? []) as InvoiceAuditEntry[]) {
    const isApproval = entry.action === 'INVOICE_APPROVED';
    const isRejection = entry.action === 'INVOICE_REJECTED';
    if (!isApproval && !isRejection) continue;

    entries.push({
      key: entry.id,
      label: isApproval
        ? t('history.approved', { defaultValue: 'Invoice approved' })
        : t('history.rejected', { defaultValue: 'Invoice rejected' }),
      at: entry.createdAt,
      performer: entry.performedBy
        ? t('history.performedBy', {
            defaultValue: `By ${entry.performedBy.name}`,
            name: entry.performedBy.name,
          })
        : null,
      reason: readReason(entry.metadata),
      isRejection,
    });
  }

  entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="p-6" data-testid="invoice-history">
      <h3 className="text-base font-semibold text-foreground mb-6">
        {t('history.title', { defaultValue: 'Invoice History' })}
      </h3>

      <div className="space-y-0">
        {entries.map((entry, index) => {
          const isLast = index === entries.length - 1;
          return (
            <div key={entry.key} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-xl bg-foreground/10 flex items-center justify-center shrink-0">
                  <CheckCircleIcon className="w-6 h-6 text-muted-foreground" />
                </div>
                {!isLast && <div className="w-0.5 flex-1 bg-border min-h-[24px]" />}
              </div>

              <div className="pb-6 min-w-0 flex flex-col gap-1.5 justify-center min-h-[50px]">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-sm font-medium text-foreground">{entry.label}</p>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ClockIcon className="w-3.5 h-3.5" />
                    {formatDateTime(entry.at)}
                  </span>
                </div>
                {entry.performer && (
                  <p className="text-xs text-muted-foreground">{entry.performer}</p>
                )}
                {entry.reason && (
                  <p
                    className={`text-sm ${entry.isRejection ? 'text-destructive' : 'text-muted-foreground'}`}
                  >
                    {t('history.reason', {
                      defaultValue: `Reason: ${entry.reason}`,
                      reason: entry.reason,
                    })}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
