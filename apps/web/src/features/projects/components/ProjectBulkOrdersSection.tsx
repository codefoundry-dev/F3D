import { getBulkOrders } from '@forethread/api-client';
import { useBulkOrder } from '@forethread/bulk-order-shared';
import { useTranslation } from '@forethread/i18n';
import { BULK_ORDER_STATUS_COLORS, Spinner, ScrollTable } from '@forethread/ui-components';
import ChevronDownIcon from '@forethread/ui-components/assets/icons/chevron-down.svg?react';
import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import {
  HeadRow,
  Section,
  SectionContent,
  StatusBadge,
  TableShell,
  TruncationNote,
  formatMoney,
  formatShortDate,
  humanizeStatus,
  type TranslationFn,
} from './project-tab-shared';
import { PAGE_SIZE, useAllRows } from './use-all-rows';

/**
 * The project's bulk orders. The Procurement tab renders it with drawdown
 * history (FRD 4.3 item 11); the Vendors tab reuses it as the "linked bulk
 * agreements" list (FRD 4.4 item 13) without the expansion rows. Both tabs
 * share the same query key, so the list is fetched once.
 */
export default function ProjectBulkOrdersSection({
  projectId,
  currency,
  title,
  withDrawdowns,
}: {
  projectId: string;
  currency: string;
  title: string;
  withDrawdowns: boolean;
}) {
  const { t: tRaw } = useTranslation('projects');
  const t = tRaw as TranslationFn;
  const { t: tBulkRaw } = useTranslation('bulkOrders');
  const tBulk = tBulkRaw as TranslationFn;
  const { data, isLoading, isError } = useAllRows(
    ['bulk-orders', 'project-tab', projectId],
    (page) => getBulkOrders({ projectId, limit: PAGE_SIZE, page }, { skipErrorHandler: true }),
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const items = data?.items ?? [];
  const columns = [
    ...(withDrawdowns ? [''] : []),
    t('detail.procurementTab.bulkColumns.number'),
    t('detail.procurementTab.bulkColumns.vendor'),
    t('detail.procurementTab.bulkColumns.status'),
    t('detail.procurementTab.bulkColumns.lineItems'),
    t('detail.procurementTab.bulkColumns.total'),
    t('detail.procurementTab.bulkColumns.consumption'),
    t('detail.procurementTab.bulkColumns.validUntil'),
  ];

  return (
    <Section title={title} count={data?.total}>
      <SectionContent
        isLoading={isLoading}
        isError={isError}
        isEmpty={items.length === 0}
        errorText={t('detail.loadError')}
        emptyTitle={t('detail.procurementTab.noBulkOrders')}
        emptyDescription={t('detail.procurementTab.noBulkOrdersHint')}
      >
        <TableShell>
          <HeadRow labels={columns} />
          <tbody>
            {items.map((bo) => (
              <Fragment key={bo.id}>
                <tr className="border-t border-border hover:bg-[color:color-mix(in_srgb,hsl(var(--muted))_30%,hsl(var(--card)))]">
                  {withDrawdowns && (
                    <td className="pl-4 py-3 w-8">
                      <button
                        type="button"
                        aria-label={t('detail.procurementTab.expandDrawdowns')}
                        aria-expanded={expandedId === bo.id}
                        onClick={() => setExpandedId(expandedId === bo.id ? null : bo.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ChevronDownIcon
                          className={`w-4 h-4 transition-transform ${
                            expandedId === bo.id ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Link
                      to={ROUTES.bulkOrderDetail.replace(':id', bo.id)}
                      className="font-medium text-primary hover:underline whitespace-nowrap"
                    >
                      {bo.bulkOrderNumber ?? '-'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground">{bo.vendorName}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      colorMap={BULK_ORDER_STATUS_COLORS}
                      status={bo.status}
                      label={tBulk(`status.${bo.status}`, {
                        defaultValue: humanizeStatus(bo.status),
                      })}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{bo.lineItems}</td>
                  <td className="px-4 py-3 text-foreground whitespace-nowrap">
                    {formatMoney(bo.totalAmount, currency)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {bo.consumptionPercent !== undefined ? `${bo.consumptionPercent}%` : '-'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatShortDate(bo.validUntil)}
                  </td>
                </tr>
                {withDrawdowns && expandedId === bo.id && (
                  <tr className="border-t border-border bg-[color:color-mix(in_srgb,hsl(var(--muted))_20%,hsl(var(--card)))]">
                    <td colSpan={columns.length} className="px-4 py-3">
                      <DrawdownHistory bulkOrderId={bo.id} t={t} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </TableShell>
        <TruncationNote shown={items.length} total={data?.total} t={t} />
      </SectionContent>
    </Section>
  );
}

/**
 * Drawdown history is only served embedded in the bulk-order detail (there is
 * no list-drawdowns endpoint), so it is fetched lazily when a row is expanded.
 */
function DrawdownHistory({ bulkOrderId, t }: { bulkOrderId: string; t: TranslationFn }) {
  const { data, isLoading, isError } = useBulkOrder(bulkOrderId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner />
      </div>
    );
  }
  if (isError || !data) return <p className="text-sm text-destructive">{t('detail.loadError')}</p>;

  const drawdowns = data.drawdowns ?? [];
  if (drawdowns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('detail.procurementTab.noDrawdowns')}</p>
    );
  }

  return (
    <ScrollTable>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-bold text-muted-foreground">
            <th className="px-2 py-1.5">{t('detail.procurementTab.drawdownColumns.po')}</th>
            <th className="px-2 py-1.5">{t('detail.procurementTab.drawdownColumns.material')}</th>
            <th className="px-2 py-1.5">{t('detail.procurementTab.drawdownColumns.quantity')}</th>
            <th className="px-2 py-1.5">{t('detail.procurementTab.drawdownColumns.before')}</th>
            <th className="px-2 py-1.5">{t('detail.procurementTab.drawdownColumns.remaining')}</th>
            <th className="px-2 py-1.5">{t('detail.procurementTab.drawdownColumns.date')}</th>
          </tr>
        </thead>
        <tbody>
          {drawdowns.map((d) => (
            <tr key={d.id} className="border-t border-border/60">
              <td className="px-2 py-1.5">
                {d.purchaseOrderId ? (
                  <Link
                    to={ROUTES.purchaseOrderDetail.replace(':id', d.purchaseOrderId)}
                    className="text-primary hover:underline"
                  >
                    {d.poNumber ?? '-'}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">{d.poNumber ?? '-'}</span>
                )}
              </td>
              <td className="px-2 py-1.5 text-foreground">{d.material ?? '-'}</td>
              <td className="px-2 py-1.5 text-foreground">{d.quantity}</td>
              <td className="px-2 py-1.5 text-muted-foreground">{d.qtyBeforeDrawdown ?? '-'}</td>
              <td className="px-2 py-1.5 text-muted-foreground">{d.remainingQty ?? '-'}</td>
              <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                {formatShortDate(d.date)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollTable>
  );
}
