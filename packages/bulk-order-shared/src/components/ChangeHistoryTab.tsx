import type { BulkOrderChangeRequest, BulkOrderLineItemDetail } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Spinner } from '@forethread/ui-components';

import { ChangeHistoryCard } from './ChangeHistoryCard';

export interface ChangeHistoryTabProps {
  changeRequests: BulkOrderChangeRequest[];
  isLoading: boolean;
  rfqReference?: string | null;
  /** True when rendered inside the vendor app — flips approval labels */
  isVendorView?: boolean;
  /** Current bulk order end date — used to show "from" values in tags */
  currentEndDate?: string | null;
  /** Current line items — used to show "from" values in tags */
  lineItems?: BulkOrderLineItemDetail[];
}

export function ChangeHistoryTab({
  changeRequests,
  isLoading,
  rfqReference,
  isVendorView = false,
  currentEndDate,
  lineItems,
}: ChangeHistoryTabProps) {
  const { t: _t } = useTranslation('bulkOrders');
  const t = _t as (key: string, opts?: Record<string, unknown>) => string;

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  }

  // Sort by createdAt desc — newest first. The last item is the initial version.
  const sorted = [...changeRequests].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const totalVersions = sorted.length;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-base font-bold text-foreground mb-4">{t('changeRequests.title')}</h2>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">{t('changeRequests.noChangeRequests')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((cr, index) => {
            const isInitial = index === sorted.length - 1;
            const version = totalVersions - index;
            return (
              <ChangeHistoryCard
                key={cr.id}
                changeRequest={cr}
                isInitialVersion={isInitial}
                version={version}
                rfqReference={rfqReference}
                isVendorView={isVendorView}
                currentEndDate={currentEndDate}
                lineItems={lineItems}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
