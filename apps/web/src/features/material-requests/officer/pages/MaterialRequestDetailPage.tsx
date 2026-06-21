import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { Button, formatDate, formatDateTime, Spinner } from '@forethread/ui-components';
import ChevronRightIcon from '@forethread/ui-components/assets/icons/chevron-right.svg?react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { usePermissions } from '@/shared/role/usePermissions';

import {
  useApproveMaterialRequest,
  useConvertMaterialRequestToPo,
  useConvertMaterialRequestToRfq,
  useDeclineMaterialRequest,
  useMaterialRequest,
  useMaterialRequestAudit,
} from '../../services/material-requests.service';
import { ConvertToPoModal } from '../components/ConvertToPoModal';
import { DeclineReasonModal } from '../components/DeclineReasonModal';
import { MrActivityTimeline } from '../components/MrActivityTimeline';
import { MrLineItemsTable } from '../components/MrLineItemsTable';
import { MrPriorityBadge, MrStatusBadge } from '../components/MrStatusBadge';

const TERMINAL_STATUSES = ['CONVERTED', 'DECLINED', 'CANCELLED'];

/** Officer Material Request detail (US 2.08): review + approve/decline/convert. */
export default function MaterialRequestDetailPage() {
  const { t } = useTranslation('materialRequests');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { has } = usePermissions();

  const { data: mr, isLoading, isError } = useMaterialRequest(id);
  const { data: audit, isLoading: isLoadingAudit } = useMaterialRequestAudit(id);

  const approve = useApproveMaterialRequest();
  const decline = useDeclineMaterialRequest();
  const convertToRfq = useConvertMaterialRequestToRfq();
  const convertToPo = useConvertMaterialRequestToPo();

  const [showDecline, setShowDecline] = useState(false);
  const [showConvertPo, setShowConvertPo] = useState(false);

  // App-bar breadcrumb: Material requests › MR-XXXX (set once the MR loads).
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  useEffect(() => {
    if (mr) {
      setPageTitle(mr.mrNumber, null, ROUTES.materialRequests, [
        { label: t('officer.title'), to: ROUTES.materialRequests },
        { label: mr.mrNumber },
      ]);
    }
    return () => setPageTitle(null);
  }, [mr, setPageTitle, t]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !mr) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">{t('detail.noData')}</div>
    );
  }

  const isSubmitted = mr.status === 'SUBMITTED';
  const isApproved = mr.status === 'APPROVED';
  const isTerminal = TERMINAL_STATUSES.includes(mr.status);
  const rfqLink = mr.convertedToRfq?.id ?? '';
  const poLink = mr.convertedToPo?.id ?? '';

  const canApprove = isSubmitted && has('materialRequest.approve');
  const canDecline = isSubmitted && has('materialRequest.decline');
  const canConvert = isApproved && has('materialRequest.convert');

  const handleApprove = () => approve.mutate(mr.id);

  const handleDecline = (reason: string) =>
    decline.mutate({ id: mr.id, reason }, { onSuccess: () => setShowDecline(false) });

  const handleConvertToRfq = () =>
    convertToRfq.mutate(
      { id: mr.id, input: {} },
      { onSuccess: (res) => navigate(ROUTES.rfqDetail.replace(':id', res.rfqId)) },
    );

  const handleConvertToPo = (vendorId: string) =>
    convertToPo.mutate(
      { id: mr.id, input: { vendorId } },
      {
        onSuccess: (res) => {
          setShowConvertPo(false);
          navigate(ROUTES.purchaseOrderDetail.replace(':id', res.poId));
        },
      },
    );

  return (
    <div className="flex flex-col px-4 pb-8 pt-4 sm:px-8 sm:pt-6">
      {/* Back link */}
      <button
        type="button"
        onClick={() => navigate(ROUTES.materialRequests)}
        className="mb-4 inline-flex items-center gap-1 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
        data-testid="mr-detail-back"
      >
        {t('detail.back')}
      </button>

      {/* ═══ Header card ═══ */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-foreground">{mr.mrNumber}</h1>
              <MrStatusBadge status={mr.status} />
              <MrPriorityBadge priority={mr.priority} />
            </div>
            <p className="text-sm text-muted-foreground">{mr.project.name}</p>
          </div>

          {/* ═══ Action bar (status + permission gated) ═══ */}
          <div className="flex flex-wrap items-center gap-2" data-testid="mr-action-bar">
            {canApprove && (
              <Button
                variant="primary"
                size="sm"
                isLoading={approve.isPending}
                onClick={handleApprove}
                data-testid="mr-approve"
              >
                {t('detail.actions.approve')}
              </Button>
            )}
            {canDecline && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDecline(true)}
                data-testid="mr-decline"
              >
                {t('detail.actions.decline')}
              </Button>
            )}
            {canConvert && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={convertToRfq.isPending}
                  onClick={handleConvertToRfq}
                  data-testid="mr-convert-rfq"
                >
                  {t('detail.actions.convertToRfq')}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowConvertPo(true)}
                  data-testid="mr-convert-po"
                >
                  {t('detail.actions.convertToPo')}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Meta grid */}
        <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t('detail.requestedBy')}>
            <span className="text-foreground">{mr.requestedBy.name}</span>
            <span className="block text-xs text-muted-foreground">{mr.requestedBy.email}</span>
          </Field>
          <Field label={t('detail.project')}>{mr.project.name}</Field>
          <Field label={t('detail.neededBy')}>
            {mr.neededByDate ? formatDate(mr.neededByDate) : '—'}
          </Field>
          <Field label={t('detail.createdOn')}>{formatDate(mr.createdAt)}</Field>
          <Field label={t('detail.deliveryLocation')}>{mr.deliveryLocation ?? '—'}</Field>
        </dl>

        {/* Note */}
        <div className="mt-6">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('detail.note')}
          </p>
          <p className="text-sm text-foreground">{mr.note ?? t('detail.noNote')}</p>
        </div>

        {/* Decline summary */}
        {mr.status === 'DECLINED' && mr.declineReason && (
          <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-destructive">
              {t('detail.declineReason')}
            </p>
            <p className="mt-1 text-sm text-foreground">{mr.declineReason}</p>
            {mr.reviewedBy && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('detail.reviewedBy')}: {mr.reviewedBy.name}
                {mr.reviewedAt ? ` · ${formatDateTime(mr.reviewedAt)}` : ''}
              </p>
            )}
          </div>
        )}

        {/* Converted link */}
        {mr.convertedToRfq && (
          <button
            type="button"
            onClick={() => navigate(ROUTES.rfqDetail.replace(':id', rfqLink))}
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            data-testid="mr-converted-rfq-link"
          >
            {t('detail.convertedToRfq', { number: mr.convertedToRfq.rfqNumber })}
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        )}
        {mr.convertedToPo && (
          <button
            type="button"
            onClick={() => navigate(ROUTES.purchaseOrderDetail.replace(':id', poLink))}
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            data-testid="mr-converted-po-link"
          >
            {t('detail.convertedToPo', { number: mr.convertedToPo.poNumber })}
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        )}

        {/* Terminal note (no actions available) */}
        {isTerminal && (
          <p className="mt-4 text-xs text-muted-foreground" data-testid="mr-terminal-note">
            {t('detail.actions.terminalNote', { status: t(`status.${mr.status}` as never) })}
          </p>
        )}
      </div>

      {/* ═══ Line items ═══ */}
      <section className="mt-6">
        <h2 className="mb-3 text-base font-semibold text-foreground">{t('detail.lineItems')}</h2>
        <MrLineItemsTable lineItems={mr.lineItems} />
      </section>

      {/* ═══ Activity ═══ */}
      <section className="mt-6 rounded-lg border border-border bg-card p-6">
        <h2 className="mb-6 text-base font-semibold text-foreground">{t('detail.activity')}</h2>
        <MrActivityTimeline entries={audit ?? []} isLoading={isLoadingAudit} />
      </section>

      {/* ═══ Modals ═══ */}
      {showDecline && (
        <DeclineReasonModal
          mrNumber={mr.mrNumber}
          isPending={decline.isPending}
          onClose={() => setShowDecline(false)}
          onConfirm={handleDecline}
        />
      )}
      {showConvertPo && (
        <ConvertToPoModal
          mrNumber={mr.mrNumber}
          companyId={mr.company.id}
          isPending={convertToPo.isPending}
          onClose={() => setShowConvertPo(false)}
          onConfirm={handleConvertToPo}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}
