import { type QuoteAuditEntry } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { useRfqQuoteAudit } from '@forethread/rfq-shared';
import { Spinner, formatCurrency, formatDateTime } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import ClockIcon from '@forethread/ui-components/assets/icons/clock.svg?react';

interface RfqQuoteAuditTabProps {
  rfqId: string;
}

/**
 * Contractor-facing quote audit trail (FOR-207): a newest-first timeline of
 * every quote submission, edit, approval and decline for the RFQ — including
 * how the quote was entered (form vs PDF) and what the vendor changed during
 * confirmation.
 */
export function RfqQuoteAuditTab({ rfqId }: RfqQuoteAuditTabProps) {
  const { t } = useTranslation('rfqs');
  const { data: entries, isLoading, isError } = useRfqQuoteAudit(rfqId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return <p className="py-8 text-sm text-muted-foreground">{t('auditTab.loadError')}</p>;
  }

  if (!entries || entries.length === 0) {
    return <p className="py-8 text-sm text-muted-foreground">{t('auditTab.noEvents')}</p>;
  }

  return (
    <div className="space-y-0">
      {entries.map((entry, index) => (
        <AuditRow key={entry.id} entry={entry} isLast={index === entries.length - 1} />
      ))}
    </div>
  );
}

function AuditRow({ entry, isLast }: { entry: QuoteAuditEntry; isLast: boolean }) {
  const { t } = useTranslation('rfqs');
  const total = entry.changes?.snapshot.totalCost ?? null;
  const fieldsChanged = entry.changes?.fields ? Object.keys(entry.changes.fields).length : 0;
  const lineItemsChanged = entry.changes?.lineItems
    ? entry.changes.lineItems.changed + entry.changes.lineItems.added + entry.changes.lineItems.removed
    : 0;

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
          <CheckCircleIcon className="w-5 h-5 text-muted-foreground" />
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-border min-h-[24px]" />}
      </div>
      <div className="pb-6 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground">
            {t(`auditTab.action.${entry.action}` as never)}
          </p>
          {entry.source && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {t(`auditTab.source.${entry.source}` as never)}
            </span>
          )}
          {total !== null && (
            <span className="text-xs text-muted-foreground">
              {t('auditTab.total', { amount: formatCurrency(total) })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
            {entry.performedByName.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs text-muted-foreground">{entry.performedByName}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ClockIcon className="w-3.5 h-3.5" />
            {formatDateTime(entry.createdAt)}
          </span>
        </div>
        {entry.action === 'UPDATED' && (lineItemsChanged > 0 || fieldsChanged > 0) && (
          <p className="text-xs text-muted-foreground mt-1">
            {lineItemsChanged > 0
              ? t('auditTab.editsSummary', { count: lineItemsChanged })
              : t('auditTab.fieldsChanged', { count: fieldsChanged })}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{entry.vendorName}</p>
      </div>
    </div>
  );
}
