import { getPurchaseOrders, getRfqs } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { PO_STATUS_COLORS, RFQ_STATUS_COLORS } from '@forethread/ui-components';
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
import ProjectBulkOrdersSection from './ProjectBulkOrdersSection';
import { PAGE_SIZE, useAllRows } from './use-all-rows';

/** FRD 4.3 — the project's RFQs, POs and bulk-order drawdown history. */
export default function ProjectProcurementTab({
  projectId,
  currency,
}: {
  projectId: string;
  currency: string;
}) {
  const { t: tRaw } = useTranslation('projects');
  const t = tRaw as TranslationFn;

  return (
    <div className="space-y-6">
      <RfqSection projectId={projectId} t={t} />
      <PoSection projectId={projectId} t={t} />
      <ProjectBulkOrdersSection
        projectId={projectId}
        currency={currency}
        title={t('detail.procurementTab.bulkOrders')}
        withDrawdowns
      />
    </div>
  );
}

function RfqSection({ projectId, t }: { projectId: string; t: TranslationFn }) {
  const { t: tRfqRaw } = useTranslation('rfqs');
  const tRfq = tRfqRaw as TranslationFn;
  const { data, isLoading, isError } = useAllRows(['rfqs', 'project-tab', projectId], (page) =>
    getRfqs({ projectId, limit: PAGE_SIZE, page }, { skipErrorHandler: true }),
  );
  const items = data?.items ?? [];

  return (
    <Section title={t('detail.procurementTab.rfqs')} count={data?.total}>
      <SectionContent
        isLoading={isLoading}
        isError={isError}
        isEmpty={items.length === 0}
        errorText={t('detail.loadError')}
        emptyTitle={t('detail.procurementTab.noRfqs')}
        emptyDescription={t('detail.procurementTab.noRfqsHint')}
      >
        <TableShell>
          <HeadRow
            labels={[
              t('detail.procurementTab.rfqColumns.number'),
              t('detail.procurementTab.rfqColumns.status'),
              t('detail.procurementTab.rfqColumns.lineItems'),
              t('detail.procurementTab.rfqColumns.invitedVendors'),
              t('detail.procurementTab.rfqColumns.quotes'),
              t('detail.procurementTab.rfqColumns.created'),
              t('detail.procurementTab.rfqColumns.createdBy'),
            ]}
          />
          <tbody>
            {items.map((rfq) => (
              <tr key={rfq.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link
                    to={ROUTES.rfqDetail.replace(':id', rfq.id)}
                    className="font-medium text-primary hover:underline whitespace-nowrap"
                  >
                    {rfq.rfqNumber ?? '-'}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    colorMap={RFQ_STATUS_COLORS}
                    status={rfq.status}
                    label={tRfq(`status.${rfq.status}`, {
                      defaultValue: humanizeStatus(rfq.status),
                    })}
                  />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{rfq.lineItems}</td>
                <td className="px-4 py-3 text-muted-foreground">{rfq.invitedVendors}</td>
                <td className="px-4 py-3 text-muted-foreground">{rfq.recQuotes}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {formatShortDate(rfq.createdDate)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{rfq.createdBy}</td>
              </tr>
            ))}
          </tbody>
        </TableShell>
        <TruncationNote shown={items.length} total={data?.total} t={t} />
      </SectionContent>
    </Section>
  );
}

function PoSection({ projectId, t }: { projectId: string; t: TranslationFn }) {
  const { t: tPoRaw } = useTranslation('purchaseOrders');
  const tPo = tPoRaw as TranslationFn;
  const { data, isLoading, isError } = useAllRows(
    ['purchase-orders', 'project-tab', projectId],
    (page) => getPurchaseOrders({ projectId, limit: PAGE_SIZE, page }, { skipErrorHandler: true }),
  );
  const items = data?.items ?? [];

  return (
    <Section title={t('detail.procurementTab.purchaseOrders')} count={data?.total}>
      <SectionContent
        isLoading={isLoading}
        isError={isError}
        isEmpty={items.length === 0}
        errorText={t('detail.loadError')}
        emptyTitle={t('detail.procurementTab.noPos')}
        emptyDescription={t('detail.procurementTab.noPosHint')}
      >
        <TableShell>
          <HeadRow
            labels={[
              t('detail.procurementTab.poColumns.number'),
              t('detail.procurementTab.poColumns.type'),
              t('detail.procurementTab.poColumns.vendor'),
              t('detail.procurementTab.poColumns.status'),
              t('detail.procurementTab.poColumns.lineItems'),
              t('detail.procurementTab.poColumns.total'),
              t('detail.procurementTab.poColumns.created'),
            ]}
          />
          <tbody>
            {items.map((po) => (
              <tr key={po.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link
                    to={ROUTES.purchaseOrderDetail.replace(':id', po.id)}
                    className="font-medium text-primary hover:underline whitespace-nowrap"
                  >
                    {po.poNumber ?? '-'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {po.poType
                    ? tPo(`poTypes.${po.poType}`, { defaultValue: humanizeStatus(po.poType) })
                    : '-'}
                </td>
                <td className="px-4 py-3 text-foreground">{po.vendorName ?? '-'}</td>
                <td className="px-4 py-3">
                  <StatusBadge
                    colorMap={PO_STATUS_COLORS}
                    status={po.status}
                    label={tPo(`status.${po.status}`, {
                      defaultValue: humanizeStatus(po.status),
                    })}
                  />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{po.lineItemCount}</td>
                <td className="px-4 py-3 text-foreground whitespace-nowrap">
                  {formatMoney(po.totalAmount, po.currency)}
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {formatShortDate(po.createdDate)}
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
        <TruncationNote shown={items.length} total={data?.total} t={t} />
      </SectionContent>
    </Section>
  );
}
