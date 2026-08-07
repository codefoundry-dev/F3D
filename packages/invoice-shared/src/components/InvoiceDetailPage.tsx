import {
  openFileInNewTab,
  downloadFile,
  type InvoiceDetail,
  type InvoiceDocument,
} from '@forethread/api-client';
import { ApproverPoolPanel, exceedsApprovalCap, useMe } from '@forethread/approval-shared';
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
import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { INVOICE_ROUTES } from '../constants/routes';
import { useInvoice, useApproveInvoice, useRejectInvoice } from '../hooks/useInvoices';

import { InvoiceDecisionModal } from './InvoiceDecisionModal';
import { InvoiceHistoryTab } from './InvoiceHistoryTab';
import { InvoiceReviewPanel } from './InvoiceReviewPanel';

export interface InvoiceDetailPageProps {
  canApprove?: boolean;
  /** Show the review/correct form on Pending invoices (FOR-291). */
  canReview?: boolean;
}

type Tab = 'details' | 'attachments' | 'history';

const TABS: Tab[] = ['details', 'attachments', 'history'];

export function InvoiceDetailPage({
  canApprove = false,
  canReview = false,
}: InvoiceDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation('invoices');
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) ?? 'details';
  const activeTab = TABS.includes(initialTab) ? initialTab : 'details';

  const { data: invoice, isLoading } = useInvoice(id);
  const { data: me } = useMe();
  const approveMutation = useApproveInvoice();
  const rejectMutation = useRejectInvoice();
  const setTitle = usePageTitleStore((s) => s.setTitle);
  // Which decision modal is open (FOR-294) — both capture a reason for the trail.
  const [decision, setDecision] = useState<'approve' | 'decline' | null>(null);

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
    {
      value: 'history',
      label: t('invoiceDetail.tabs.history', { defaultValue: 'History' }),
    },
  ];

  const isPending = invoice?.status === 'PENDING';
  const showActions = canApprove && isPending;
  const isActioning = approveMutation.isPending || rejectMutation.isPending;

  // The server refuses approval until review has persisted vendor, project and
  // amount (FOR-290/291) — disable Approve up front rather than dead-ending in
  // the confirm modal. Declining stays available on any Pending invoice.
  const reviewComplete =
    !!invoice &&
    invoice.vendorName !== null &&
    invoice.projectId !== null &&
    invoice.totalAmount !== null;
  const approveBlockedHint = t('invoiceDetail.approveBlocked', {
    defaultValue:
      'Set the vendor, project, and total amount in the review form and save before approving.',
  });

  // FOR-303: `invoice.approve` carries a configurable cap that the backend now
  // enforces. A viewer whose cap is below the invoice total sees Approve
  // disabled with the explanation rather than a silent 403. `me` still loading
  // resolves to false (enabled) — the backend stays the authority and its
  // message surfaces through the decision modal's error state. Decline stays
  // available: rejecting an invoice does not need spend authority.
  const overLimit = exceedsApprovalCap(me?.invoiceApprovalThreshold, invoice?.totalAmount);
  const overLimitHint = t('invoiceDetail.overApprovalLimit', {
    amount: (invoice?.totalAmount ?? 0).toLocaleString(),
    limit: (me?.invoiceApprovalThreshold ?? 0).toLocaleString(),
    defaultValue:
      'This invoice totals {{amount}}, above your approval limit of {{limit}}. A higher-tier approver must approve it.',
  });

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
              onClick={() => {
                rejectMutation.reset();
                setDecision('decline');
              }}
            >
              {t('invoiceDetail.decline', { defaultValue: 'Decline' })}
            </Button>
            <Button
              variant="primary"
              disabled={isActioning || !reviewComplete || overLimit}
              title={!reviewComplete ? approveBlockedHint : overLimit ? overLimitHint : undefined}
              leftIcon={<CheckCircleIcon className="size-4" />}
              data-testid={overLimit ? 'invoice-approve-over-limit' : 'invoice-approve-button'}
              onClick={() => {
                approveMutation.reset();
                setDecision('approve');
              }}
            >
              {t('invoiceDetail.approve', { defaultValue: 'Approve' })}
            </Button>
          </div>
        )}
      </div>

      {/* Who the invoice is waiting on (FOR-309). The same component the PO
          uses — self-hides when approval was never required. */}
      {id && <ApproverPoolPanel entityType="INVOICE" entityId={id} />}

      {/* Tab content */}
      <div className="flex-1 overflow-auto rounded-[14px] border border-gray-100 bg-white shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
        {activeTab === 'details' &&
          // Pending invoices show the review/correct form (FOR-291); once the
          // invoice leaves Pending the details freeze into the read-only view.
          (canReview && isPending && invoice ? (
            <InvoiceReviewPanel invoice={invoice} />
          ) : (
            <InvoiceDetailsTab invoice={invoice} />
          ))}
        {activeTab === 'attachments' && <AttachmentsTab documents={invoice?.documents ?? []} />}
        {activeTab === 'history' && invoice && <InvoiceHistoryTab invoice={invoice} />}
      </div>

      {/* Approve / decline confirmation with the reason for the trail (FOR-294) */}
      {decision && id && (
        <InvoiceDecisionModal
          mode={decision}
          isPending={isActioning}
          isError={decision === 'approve' ? approveMutation.isError : rejectMutation.isError}
          errorMessage={
            decision === 'approve'
              ? (approveMutation.error?.message ?? null)
              : (rejectMutation.error?.message ?? null)
          }
          onClose={() => setDecision(null)}
          onConfirm={(reason) => {
            const mutation = decision === 'approve' ? approveMutation : rejectMutation;
            mutation.mutate({ id, reason }, { onSuccess: () => setDecision(null) });
          }}
        />
      )}
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
        {/* project/vendor/amount are empty on intake invoices awaiting review (FOR-290) */}
        <InfoRow label={t('invoiceDetail.project', { defaultValue: 'Project' })}>
          {invoice.projectName ?? '—'}
        </InfoRow>
        <InfoRow label={t('invoiceDetail.vendor', { defaultValue: 'Vendor' })}>
          {invoice.vendorName ?? invoice.senderEmail ?? '—'}
        </InfoRow>
        <InfoRow label={t('invoiceDetail.totalAmount', { defaultValue: 'Total Amount' })}>
          {invoice.totalAmount === null
            ? '—'
            : `$${invoice.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
        </InfoRow>
        <InfoRow label={t('invoiceDetail.invoiceNumber', { defaultValue: 'Invoice #' })}>
          {invoice.invoiceNumber ?? '—'}
        </InfoRow>
        <InfoRow label={t('invoiceDetail.relatedPo', { defaultValue: 'Related PO' })}>
          {invoice.relatedPoNumber ??
            invoice.relatedPo ??
            t('invoiceDetail.noPo', { defaultValue: 'None' })}
        </InfoRow>
        <InfoRow label={t('invoiceDetail.issuedDate', { defaultValue: 'Invoice Date' })}>
          {invoice.issuedDate ? new Date(invoice.issuedDate).toLocaleDateString('en-AU') : '—'}
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

      {/* Billed lines confirmed at review (FOR-291) */}
      {invoice.lines && invoice.lines.length > 0 ? (
        <div className="mt-8">
          <h3 className="text-base font-semibold text-foreground mb-4">
            {t('invoiceDetail.lineItems', { defaultValue: 'Line Items' })}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm" data-testid="invoice-detail-lines">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-3 pr-3 font-medium">
                    {t('review.line.description', { defaultValue: 'Description' })}
                  </th>
                  <th className="pb-3 pr-3 font-medium">
                    {t('review.line.quantity', { defaultValue: 'Qty' })}
                  </th>
                  <th className="pb-3 pr-3 font-medium">
                    {t('review.line.unit', { defaultValue: 'Unit' })}
                  </th>
                  <th className="pb-3 pr-3 font-medium text-right">
                    {t('review.line.unitPrice', { defaultValue: 'Unit price' })}
                  </th>
                  <th className="pb-3 pr-3 font-medium text-right">
                    {t('review.line.lineTotal', { defaultValue: 'Line total' })}
                  </th>
                  {/* Buyer-side accounting coding captured at review (FOR-295) */}
                  <th className="pb-3 pr-3 font-medium">
                    {t('review.line.costCode', { defaultValue: 'Cost code' })}
                  </th>
                  <th className="pb-3 font-medium">
                    {t('review.line.glAccount', { defaultValue: 'GL account' })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((line) => (
                  <tr key={line.id} className="border-b border-border last:border-b-0">
                    <td className="py-3 pr-3 text-foreground">{line.description}</td>
                    <td className="py-3 pr-3 text-muted-foreground">{line.quantity ?? '—'}</td>
                    <td className="py-3 pr-3 text-muted-foreground">{line.unit ?? '—'}</td>
                    <td className="py-3 pr-3 text-right text-muted-foreground">
                      {line.unitPrice === null
                        ? '—'
                        : `$${line.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    </td>
                    <td className="py-3 pr-3 text-right text-muted-foreground">
                      {line.lineTotal === null
                        ? '—'
                        : `$${line.lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    </td>
                    <td className="py-3 pr-3 text-muted-foreground">{line.costCode ?? '—'}</td>
                    <td className="py-3 text-muted-foreground">{line.glAccount ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
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
                  {/* Email-intake documents have no uploading user (FOR-290) */}
                  {doc.uploadedBy ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                        {doc.uploadedBy.email.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-muted-foreground">{doc.uploadedBy.email}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
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
