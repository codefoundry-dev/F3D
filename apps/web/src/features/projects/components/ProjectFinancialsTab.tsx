import { useTranslation } from '@forethread/i18n';
import { useInvoices } from '@forethread/invoice-shared';
import { usePurchaseOrders } from '@forethread/po-shared';
import { INVOICE_STATUS_COLORS } from '@forethread/ui-components';
import { Link } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import {
  HeadRow,
  LIST_LIMIT,
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

/** POs that never (or no longer) commit spend against the budget. */
const NON_COMMITTED_PO_STATUSES = new Set([
  'DRAFT',
  'CANCELLED',
  'CANCELLED_BY_VENDOR',
  'DECLINED',
]);

/**
 * FRD 4.5 — the project's invoices, headed by a budget summary. The backend's
 * `usedBudget` aggregate is not implemented (hardcoded 0), so committed and
 * invoiced spend are computed here from the project-scoped PO and invoice
 * lists instead.
 */
export default function ProjectFinancialsTab({
  projectId,
  plannedBudget,
  currency,
}: {
  projectId: string;
  plannedBudget: number | null;
  currency: string;
}) {
  const { t: tRaw } = useTranslation('projects');
  const t = tRaw as TranslationFn;
  const { t: tInvRaw } = useTranslation('invoices');
  const tInv = tInvRaw as TranslationFn;

  const poQuery = usePurchaseOrders({ projectId, limit: LIST_LIMIT });
  const invoiceQuery = useInvoices({ projectId, limit: LIST_LIMIT });

  const committed = (poQuery.data?.items ?? [])
    .filter((po) => !NON_COMMITTED_PO_STATUSES.has(po.status))
    .reduce((sum, po) => sum + (po.totalAmount ?? 0), 0);
  const invoiced = (invoiceQuery.data?.items ?? [])
    .filter((invoice) => invoice.status !== 'REJECTED')
    .reduce((sum, invoice) => sum + (invoice.totalAmount ?? 0), 0);
  const remaining = plannedBudget !== null ? plannedBudget - committed : null;
  const summaryLoading = poQuery.isLoading || invoiceQuery.isLoading;

  const invoices = invoiceQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label={t('detail.financialsTab.plannedBudget')}
          value={plannedBudget !== null ? formatMoney(plannedBudget, currency) : t('detail.notSet')}
        />
        <SummaryCard
          label={t('detail.financialsTab.committed')}
          value={summaryLoading ? '…' : formatMoney(committed, currency)}
          sub={t('detail.financialsTab.committedHint')}
        />
        <SummaryCard
          label={t('detail.financialsTab.invoiced')}
          value={summaryLoading ? '…' : formatMoney(invoiced, currency)}
          sub={t('detail.financialsTab.invoicedHint')}
        />
        <SummaryCard
          label={t('detail.financialsTab.remaining')}
          value={summaryLoading || remaining === null ? '…' : formatMoney(remaining, currency)}
          sub={t('detail.financialsTab.remainingHint')}
          negative={remaining !== null && remaining < 0}
        />
      </div>

      <Section title={t('detail.financialsTab.invoices')} count={invoiceQuery.data?.meta.total}>
        <SectionContent
          isLoading={invoiceQuery.isLoading}
          isError={invoiceQuery.isError}
          isEmpty={invoices.length === 0}
          errorText={t('detail.loadError')}
          emptyTitle={t('detail.financialsTab.noInvoices')}
          emptyDescription={t('detail.financialsTab.noInvoicesHint')}
        >
          <TableShell>
            <HeadRow
              labels={[
                t('detail.financialsTab.columns.number'),
                t('detail.financialsTab.columns.vendor'),
                t('detail.financialsTab.columns.relatedPo'),
                t('detail.financialsTab.columns.status'),
                t('detail.financialsTab.columns.total'),
                t('detail.financialsTab.columns.dueDate'),
              ]}
            />
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      to={ROUTES.invoiceDetail.replace(':id', invoice.id)}
                      className="font-medium text-primary hover:underline whitespace-nowrap"
                    >
                      {invoice.invoiceNumber ?? '-'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground">{invoice.vendorName ?? '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {invoice.relatedPo ?? '-'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      colorMap={INVOICE_STATUS_COLORS}
                      status={invoice.status}
                      label={tInv(`status.${invoice.status}`, {
                        defaultValue: humanizeStatus(invoice.status),
                      })}
                    />
                  </td>
                  <td className="px-4 py-3 text-foreground whitespace-nowrap">
                    {formatMoney(invoice.totalAmount, currency)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatShortDate(invoice.dueDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
          <TruncationNote shown={invoices.length} total={invoiceQuery.data?.meta.total} t={t} />
        </SectionContent>
      </Section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  negative = false,
}: {
  label: string;
  value: string;
  sub?: string;
  negative?: boolean;
}) {
  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-1 ${negative ? 'text-destructive' : 'text-foreground'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}
