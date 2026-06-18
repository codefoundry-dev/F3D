import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import type { DeliveryReportLineResponse } from '@forethread/shared-types/client';
import { DeliveryOutcome, DeliveryReportStatus } from '@forethread/shared-types/client';
import { Button, Spinner, cn, formatDate, notificationService } from '@forethread/ui-components';
import CheckIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import CrossIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit-in-square.svg?react';
import ImageIcon from '@forethread/ui-components/assets/icons/image.svg?react';
import { Fragment, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { usePermissions } from '@/shared/role/usePermissions';

import { RejectDeliveryModal } from '../components/RejectDeliveryModal';
import {
  useApproveDeliveryReport,
  useDeliveryReport,
  useRejectDeliveryReport,
} from '../services/deliveries.service';

/**
 * Delivery report detail / review (screenshots 04/08). Read-only Information grid
 * + line-item table with expandable Notes and Damage details rows. SUBMITTED
 * reports expose Approve (black) / Reject (outline) at the top.
 */
export default function DeliveryReportDetailPage() {
  const { t } = useTranslation('deliveries');
  const { id } = useParams<{ id: string }>();
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  const { has } = usePermissions();

  const { data: report, isLoading, isError } = useDeliveryReport(id);
  const approveMutation = useApproveDeliveryReport();
  const rejectMutation = useRejectDeliveryReport();
  const [showReject, setShowReject] = useState(false);

  useEffect(() => {
    setPageTitle(t('detail.title'), t('detail.subtitle'), ROUTES.deliveries);
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  const handleApprove = () => {
    if (!report) return;
    approveMutation.mutate(report.id, {
      onSuccess: () => notificationService.success(t('review.approved')),
      onError: () => notificationService.error(t('review.approveFailed')),
    });
  };

  const handleReject = (reason: string) => {
    if (!report) return;
    rejectMutation.mutate(
      { id: report.id, reason },
      {
        onSuccess: () => {
          notificationService.success(t('review.rejected'));
          setShowReject(false);
        },
        onError: () => notificationService.error(t('review.rejectFailed')),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !report) {
    return <div className="py-16 text-center text-muted-foreground">{t('detail.noData')}</div>;
  }

  const canReview = report.status === DeliveryReportStatus.SUBMITTED && has('delivery.read');

  return (
    <div className="flex flex-col px-4 pb-6 pt-4 sm:px-8 sm:pb-8 sm:pt-6">
      {/* ═══ Action bar ═══ */}
      {canReview && (
        <div className="mb-4 flex items-center justify-end gap-2">
          <Button
            variant="primary"
            leftIcon={<CheckIcon className="h-4 w-4" />}
            isLoading={approveMutation.isPending}
            onClick={handleApprove}
            data-testid="delivery-detail-approve"
          >
            {t('detail.approve')}
          </Button>
          <Button
            variant="outline"
            leftIcon={<CrossIcon className="h-4 w-4" />}
            onClick={() => setShowReject(true)}
            data-testid="delivery-detail-reject"
          >
            {t('detail.reject')}
          </Button>
        </div>
      )}

      {/* ═══ Information ═══ */}
      <div className="rounded-[14px] border border-border bg-card p-4 sm:p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">{t('detail.information')}</h2>
        <div className="grid grid-cols-1 gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <InfoField label={t('detail.fields.poNumber')} value={report.poNumber} />
          <InfoField label={t('detail.fields.project')} value={report.projectName} />
          <InfoField
            label={t('detail.fields.deliveryDate')}
            value={formatDate(report.deliveryDate)}
          />
          <InfoField label={t('detail.fields.location')} value={report.deliveryLocationName} />
          <InfoField label={t('detail.fields.submittedBy')} value={report.submitterName} />
          <InfoField
            label={t('detail.fields.submittedDate')}
            value={formatDate(report.createdAt)}
          />
          <InfoField label={t('detail.fields.vendorCompany')} value={report.vendorName} />
          <InfoField label={t('detail.fields.contactPerson')} value={report.contactPerson} />
          <InfoField label={t('detail.fields.phoneNumber')} value={report.contactPhone} />
        </div>
        {report.status === DeliveryReportStatus.REJECTED && report.rejectionReason && (
          <div className="mt-5 rounded-lg bg-destructive/10 px-4 py-3">
            <p className="text-xs font-medium text-destructive">
              {t('detail.fields.rejectionReason')}
            </p>
            <p className="mt-0.5 text-sm text-foreground">{report.rejectionReason}</p>
          </div>
        )}
      </div>

      {/* ═══ Line Items ═══ */}
      <div className="mt-4 rounded-[14px] border border-border bg-card p-4 sm:p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">{t('detail.lineItems')}</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm" data-testid="delivery-detail-table">
            <thead>
              <tr className="border-b border-border bg-[hsl(var(--table-header))] text-left text-[hsl(var(--table-header-foreground))]">
                {(
                  [
                    'lineItemId',
                    'itemMaterial',
                    'description',
                    'unit',
                    'qtyOrdered',
                    'qtyReceived',
                    'outcome',
                    'actions',
                  ] as const
                ).map((col) => (
                  <th
                    key={col}
                    className="whitespace-nowrap px-3 py-3 text-xs font-bold leading-4 tracking-[0.4px]"
                  >
                    {t(`detail.columns.${col}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.lines.map((line) => (
                <LineRow key={line.id} line={line} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showReject && (
        <RejectDeliveryModal
          onClose={() => setShowReject(false)}
          onConfirm={handleReject}
          isSubmitting={rejectMutation.isPending}
        />
      )}
    </div>
  );
}

function LineRow({ line }: { line: DeliveryReportLineResponse }) {
  const { t } = useTranslation('deliveries');
  const isDamaged = line.outcome === DeliveryOutcome.DAMAGED;

  return (
    <Fragment>
      <tr
        className="border-b border-border last:border-b-0"
        data-testid={`delivery-detail-row-${line.id}`}
      >
        <td className="px-3 py-2.5 text-foreground">{line.lineItemRef}</td>
        <td className="px-3 py-2.5 font-medium text-foreground">{line.materialName}</td>
        <td className="max-w-[260px] truncate px-3 py-2.5 text-foreground">
          {line.description ?? '-'}
        </td>
        <td className="px-3 py-2.5 text-foreground">{line.uom}</td>
        <td className="px-3 py-2.5 text-foreground">{line.quantityOrdered}</td>
        <td className="px-3 py-2.5 text-foreground">{line.quantityReceived}</td>
        <td className="px-3 py-2.5 text-foreground">{t(`outcome.${line.outcome}` as never)}</td>
        <td className="px-3 py-2.5">
          <span
            aria-hidden
            className={cn(
              'inline-flex rounded-lg border border-border p-2',
              isDamaged ? 'text-destructive' : 'text-muted-foreground/50',
            )}
          >
            <EditIcon className="h-4 w-4" />
          </span>
        </td>
      </tr>

      {line.notes && (
        <tr className="border-b border-border">
          <td colSpan={8} className="px-3 py-3">
            <p className="text-xs font-semibold text-foreground">{t('detail.notes')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{line.notes}</p>
          </td>
        </tr>
      )}

      {isDamaged && (
        <tr className="border-b border-border">
          <td colSpan={8} className="px-3 py-4">
            <p className="mb-3 text-sm font-semibold text-foreground">{t('damage.title')}</p>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="grid grid-cols-3 gap-x-10 gap-y-2">
                <InfoField
                  label={t('damage.damagedQty')}
                  value={line.damagedQuantity !== null ? String(line.damagedQuantity) : '-'}
                />
                <InfoField
                  label={t('damage.type')}
                  value={line.damageType ? t(`damageType.${line.damageType}` as never) : '-'}
                />
                <InfoField
                  label={t('damage.disposition')}
                  value={
                    line.damageDisposition
                      ? t(`disposition.${line.damageDisposition}` as never)
                      : '-'
                  }
                />
              </div>
              {line.damagePhotos.length > 0 && (
                <div
                  className="flex flex-wrap gap-2"
                  data-testid={`delivery-damage-photos-${line.id}`}
                >
                  {line.damagePhotos.map((photo) =>
                    photo.url ? (
                      <a
                        key={photo.id}
                        href={photo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block h-12 w-12 overflow-hidden rounded-lg border border-border"
                        title={photo.fileName}
                      >
                        <img
                          src={photo.url}
                          alt={photo.fileName}
                          className="h-full w-full object-cover"
                        />
                      </a>
                    ) : (
                      <span
                        key={photo.id}
                        className="flex h-12 w-12 items-center justify-center rounded-lg border border-border text-muted-foreground"
                        title={photo.fileName}
                      >
                        <ImageIcon className="h-5 w-5" />
                      </span>
                    ),
                  )}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value ?? '-'}</p>
    </div>
  );
}
