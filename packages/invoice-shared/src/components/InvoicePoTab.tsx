import type { InvoiceDetail, InvoicePoDeliveryReport } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Badge,
  Button,
  DELIVERY_STATUS_COLORS,
  PageLoader,
  formatDate,
  getStatusColor,
} from '@forethread/ui-components';
import EyeOpenedIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import { Link } from 'react-router-dom';

import { useExportInvoiceRelatedPo, useInvoicePoInfo } from '../hooks/useInvoices';

import { InvoicePoComparison } from './InvoicePoComparison';

/** App route of a delivery report — the deliveries feature has no shared routes constant. */
const deliveryRoute = (id: string) => `/deliveries/${id}`;

export interface InvoicePoTabProps {
  invoice: InvoiceDetail;
  /**
   * The PO picked in the review form but not yet saved, so the tab shows it
   * without waiting for the review to persist (FOR-355).
   */
  previewPoId?: string | null;
}

/**
 * The Invoice Details PO tab (FOR-355): the purchase order the invoice resolves
 * to — reusing the review form's comparison panel — with the system PO PDF a
 * click away, the delivery reports recorded against that PO, and whether the
 * supplier's own invoice document has actually been received.
 */
export function InvoicePoTab({ invoice, previewPoId }: InvoicePoTabProps) {
  const { t } = useTranslation('invoices');
  const { data, isLoading, isError } = useInvoicePoInfo(invoice.id, previewPoId);
  const exportPo = useExportInvoiceRelatedPo();

  if (isLoading) return <PageLoader />;

  if (isError || !data) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        {t('poTab.loadFailed', {
          defaultValue: 'The purchase order details could not be loaded. Please refresh.',
        })}
      </div>
    );
  }

  const po = data.match.po;

  // Every invoice row is born from a received document (FOR-290), but documents
  // can be deleted — an invoice with none has no supplier document behind it.
  // Documents arrive newest-first, so the earliest (the one that created the
  // invoice) closes the list.
  const receivedAt = invoice.documents.length
    ? invoice.documents[invoice.documents.length - 1].uploadedAt
    : null;

  const handleViewPdf = () => {
    if (!po) return;
    exportPo.mutate(
      { id: invoice.id, poId: po.id },
      { onSuccess: ({ url }) => window.open(url, '_blank') },
    );
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* ── Supplier invoice receipt ──────────────────────────────────────── */}
      <div className="flex items-center gap-2" data-testid="invoice-po-tab-receipt">
        <span className="text-sm font-medium text-muted-foreground">
          {t('poTab.supplierInvoice', { defaultValue: 'Supplier invoice' })}
        </span>
        {receivedAt ? (
          <Badge color="success">
            {t('poTab.invoiceReceived', {
              defaultValue: 'Received {{date}}',
              date: formatDate(receivedAt),
            })}
          </Badge>
        ) : (
          <Badge color="gray">
            {t('poTab.invoiceNotSent', { defaultValue: 'Invoice not sent' })}
          </Badge>
        )}
      </div>

      {/* ── Purchase order ────────────────────────────────────────────────── */}
      <section aria-label={t('poTab.poSection', { defaultValue: 'Purchase order' })}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-foreground">
            {t('poTab.poSection', { defaultValue: 'Purchase order' })}
          </h3>
          {po && (
            <Button
              variant="outline"
              size="sm"
              disabled={exportPo.isPending}
              leftIcon={<EyeOpenedIcon className="size-4" />}
              onClick={handleViewPdf}
              data-testid="invoice-po-tab-view-pdf"
            >
              {exportPo.isPending
                ? t('poTab.preparingPdf', { defaultValue: 'Preparing PDF…' })
                : t('poTab.viewPdf', { defaultValue: 'View PO PDF' })}
            </Button>
          )}
        </div>

        {po && data.match.resolution !== 'LINKED' && (
          <p className="mb-3 text-sm text-muted-foreground" data-testid="invoice-po-tab-unsaved">
            {t('poTab.unsavedLink', {
              defaultValue:
                'This purchase order is not linked to the invoice yet — saving the review links it.',
            })}
          </p>
        )}

        {po ? (
          <InvoicePoComparison match={data.match} />
        ) : (
          <div
            className="rounded-lg border border-border p-8 text-center"
            data-testid="invoice-po-tab-no-po"
          >
            <p className="text-sm font-medium text-foreground">
              {t('poTab.noPo', { defaultValue: 'No purchase order is linked to this invoice.' })}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('poTab.noPoHint', {
                defaultValue:
                  'Select a purchase order in the review form to see its details, PDF, and deliveries here.',
              })}
            </p>
          </div>
        )}
      </section>

      {/* ── Deliveries against the PO ─────────────────────────────────────── */}
      <section aria-label={t('poTab.deliveries', { defaultValue: 'Deliveries' })}>
        <h3 className="mb-3 text-base font-semibold text-foreground">
          {t('poTab.deliveries', { defaultValue: 'Deliveries' })}
        </h3>
        {data.deliveryReports.length === 0 ? (
          <div
            className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground"
            data-testid="invoice-po-tab-no-deliveries"
          >
            {t('poTab.noDeliveries', {
              defaultValue: 'No delivery is available for this invoice yet.',
            })}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-sm" data-testid="invoice-po-tab-deliveries">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">
                    {t('poTab.reportNumber', { defaultValue: 'Report #' })}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('poTab.deliveryDate', { defaultValue: 'Delivery date' })}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('poTab.location', { defaultValue: 'Location' })}
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    {t('poTab.received', { defaultValue: 'Received' })}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('poTab.deliveryStatus', { defaultValue: 'Status' })}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('poTab.submittedBy', { defaultValue: 'Submitted by' })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.deliveryReports.map((report) => (
                  <DeliveryReportRow key={report.id} report={report} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function DeliveryReportRow({ report }: { report: InvoicePoDeliveryReport }) {
  const { t } = useTranslation('invoices');

  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-4 py-3">
        <Link to={deliveryRoute(report.id)} className="font-medium text-primary hover:underline">
          {report.reportNumber}
        </Link>
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {report.deliveryDate ? formatDate(report.deliveryDate) : '—'}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{report.locationName ?? '—'}</td>
      <td className="px-4 py-3 text-right text-muted-foreground">
        {t('poTab.receivedUnits', {
          defaultValue: '{{quantity}} units ({{lines}} line(s))',
          quantity: report.quantityReceived,
          lines: report.lineCount,
        })}
      </td>
      <td className="px-4 py-3">
        <Badge className={getStatusColor(DELIVERY_STATUS_COLORS, report.status)}>
          {t(`poTab.reportStatus.${report.status}` as never, {
            defaultValue: { SUBMITTED: 'Submitted', APPROVED: 'Approved', REJECTED: 'Rejected' }[
              report.status
            ],
          })}
        </Badge>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{report.submitterName}</td>
    </tr>
  );
}
