import {
  openFileInNewTab,
  downloadFile,
  type InvoiceDetail,
  type InvoiceDocument,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import {
  Badge,
  Button,
  Tabs,
  getStatusColor,
  INVOICE_STATUS_COLORS,
  PageLoader,
  type TabItem,
} from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import DownloadIcon from '@forethread/ui-components/assets/icons/download.svg?react';
import EyeOpenedIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import { useCallback, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { INVOICE_ROUTES } from '../constants/routes';
import { useInvoice, useApproveInvoice, useRejectInvoice } from '../hooks/useInvoices';

export interface InvoiceDetailPageProps {
  canApprove?: boolean;
}

type Tab = 'details' | 'attachments';

const TABS: Tab[] = ['details', 'attachments'];

export function InvoiceDetailPage({ canApprove = false }: InvoiceDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation('invoices');
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) ?? 'details';
  const activeTab = TABS.includes(initialTab) ? initialTab : 'details';

  const { data: invoice, isLoading } = useInvoice(id);
  const approveMutation = useApproveInvoice();
  const rejectMutation = useRejectInvoice();
  const setTitle = usePageTitleStore((s) => s.setTitle);

  // Surface the title + Invoices breadcrumb in the app bar (back → list).
  useEffect(() => {
    setTitle(invoice?.vendorName ?? t('list.title'), null, INVOICE_ROUTES.invoices, [
      { label: t('list.title'), to: INVOICE_ROUTES.invoices },
      { label: invoice?.vendorName ?? t('list.title') },
    ]);
    return () => setTitle(null);
  }, [invoice?.vendorName, setTitle, t]);

  const handleTabChange = (tab: Tab) => {
    setSearchParams({ tab }, { replace: true });
  };

  const docCount = invoice?.documents?.length ?? 0;
  const tabItems: TabItem<Tab>[] = [
    {
      value: 'details',
      label: t('invoiceDetail.tabs.details', { defaultValue: 'Invoice Details' }),
    },
    {
      value: 'attachments',
      label: t('invoiceDetail.tabs.attachments', {
        defaultValue: `Attachments (${docCount})`,
        count: docCount,
      }),
    },
  ];

  const isPending = invoice?.status === 'PENDING';
  const showActions = canApprove && isPending;
  const isActioning = approveMutation.isPending || rejectMutation.isPending;

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="flex h-full flex-1 flex-col gap-3 px-6 py-4">
      {/* Tab bar + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs items={tabItems} value={activeTab} onValueChange={handleTabChange} />

        {showActions && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={isActioning}
              leftIcon={<CrossInCircleIcon className="size-4" />}
              onClick={() => id && rejectMutation.mutate(id)}
            >
              {t('invoiceDetail.decline', { defaultValue: 'Decline' })}
            </Button>
            <Button
              variant="primary"
              disabled={isActioning}
              leftIcon={<CheckCircleIcon className="size-4" />}
              onClick={() => id && approveMutation.mutate(id)}
            >
              {t('invoiceDetail.approve', { defaultValue: 'Approve' })}
            </Button>
          </div>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto rounded-[14px] border border-gray-100 bg-white shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
        {activeTab === 'details' && <InvoiceDetailsTab invoice={invoice} />}
        {activeTab === 'attachments' && <AttachmentsTab documents={invoice?.documents ?? []} />}
      </div>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start py-3 border-b border-border last:border-b-0">
      <span className="w-40 shrink-0 text-sm text-muted-foreground font-medium">{label}</span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  );
}

function InvoiceDetailsTab({ invoice }: { invoice: InvoiceDetail | undefined }) {
  const { t } = useTranslation('invoices');

  if (!invoice) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">
        {t('invoiceDetail.noData', { defaultValue: 'No data available.' })}
      </div>
    );
  }

  return (
    <div className="p-6">
      <h3 className="text-base font-semibold text-foreground mb-4">
        {t('invoiceDetail.invoiceInfo', { defaultValue: 'Invoice Information' })}
      </h3>
      <div className="max-w-xl">
        <InfoRow label={t('invoiceDetail.status', { defaultValue: 'Status' })}>
          <Badge className={getStatusColor(INVOICE_STATUS_COLORS, invoice.status)}>
            {t(`status.${invoice.status}` as never)}
          </Badge>
        </InfoRow>
        <InfoRow label={t('invoiceDetail.project', { defaultValue: 'Project' })}>
          {invoice.projectName}
        </InfoRow>
        <InfoRow label={t('invoiceDetail.vendor', { defaultValue: 'Vendor' })}>
          {invoice.vendorName}
        </InfoRow>
        <InfoRow label={t('invoiceDetail.totalAmount', { defaultValue: 'Total Amount' })}>
          ${invoice.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </InfoRow>
        <InfoRow label={t('invoiceDetail.relatedPo', { defaultValue: 'Related PO' })}>
          {invoice.relatedPo ?? t('invoiceDetail.noPo', { defaultValue: 'None' })}
        </InfoRow>
        <InfoRow label={t('invoiceDetail.dueDate', { defaultValue: 'Due Date' })}>
          {invoice.dueDate
            ? new Date(invoice.dueDate).toLocaleDateString('en-AU')
            : t('invoiceDetail.noDueDate', { defaultValue: 'Not set' })}
        </InfoRow>
        <InfoRow label={t('invoiceDetail.createdAt', { defaultValue: 'Created' })}>
          {new Date(invoice.createdAt).toLocaleDateString('en-AU')}
        </InfoRow>
      </div>
    </div>
  );
}

function AttachmentsTab({ documents }: { documents: InvoiceDocument[] }) {
  const { t } = useTranslation('invoices');

  const handleView = useCallback(async (doc: InvoiceDocument) => {
    if (doc.fileId) {
      await openFileInNewTab(doc.fileId);
    }
  }, []);

  const handleDownload = useCallback(async (doc: InvoiceDocument) => {
    if (doc.fileId) {
      await downloadFile(doc.fileId, doc.name);
    }
  }, []);

  return (
    <div className="p-6">
      {documents.length === 0 ? (
        <div className="text-center text-muted-foreground text-sm py-8">
          {t('invoiceDetail.noAttachments', { defaultValue: 'No attachments yet.' })}
        </div>
      ) : (
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="pb-3 font-medium">
                {t('invoiceDetail.fileName', { defaultValue: 'File Name' })}
              </th>
              <th className="pb-3 font-medium">
                {t('invoiceDetail.uploadedBy', { defaultValue: 'Uploaded By' })}
              </th>
              <th className="pb-3 font-medium">
                {t('invoiceDetail.date', { defaultValue: 'Date' })}
              </th>
              <th className="pb-3 font-medium text-right">
                {t('invoiceDetail.actions', { defaultValue: 'Actions' })}
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} className="border-b border-border last:border-b-0">
                <td className="py-3 font-medium text-foreground">{doc.name}</td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                      {doc.uploadedBy.email.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-muted-foreground">{doc.uploadedBy.email}</span>
                  </div>
                </td>
                <td className="py-3 text-muted-foreground">
                  {new Date(doc.uploadedAt).toLocaleDateString('en-AU')}
                </td>
                <td className="py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      title={t('invoiceDetail.view', { defaultValue: 'View' })}
                      onClick={() => void handleView(doc)}
                    >
                      <EyeOpenedIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      title={t('invoiceDetail.download', { defaultValue: 'Download' })}
                      onClick={() => void handleDownload(doc)}
                    >
                      <DownloadIcon className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
