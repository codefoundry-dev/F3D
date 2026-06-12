import { type MaterialChangeRequestDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Badge, Button } from '@forethread/ui-components';
import CrossIcon from '@forethread/ui-components/assets/icons/cross.svg?react';

import { formatDateTime, humanizeKey } from '../lib/format';

export interface PendingChangeRequestPermissions {
  canApprove: boolean;
  canReject: boolean;
}

export interface PendingChangeRequestCardProps {
  request: MaterialChangeRequestDto;
  permissions: PendingChangeRequestPermissions;
  isApproving: boolean;
  isRejecting: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

function formatValue(value: string | number | null): string {
  if (value === null || value === '') return '—';
  return String(value);
}

/**
 * Pending edit-diff card (US 4.01 Phase 3). A Company-Admin / Procurement-Officer
 * edit to a PUBLIC material creates a `MaterialChangeRequest`; the Super-Admin
 * reviews the before→after diff here and approves (applies the diff) or rejects
 * (discards it). Action buttons are gated by `material.approveChange` /
 * `material.rejectChange`.
 */
export function PendingChangeRequestCard({
  request,
  permissions,
  isApproving,
  isRejecting,
  onApprove,
  onReject,
}: PendingChangeRequestCardProps) {
  const { t } = useTranslation(['materialCatalogue']);
  const changeEntries = Object.entries(request.changes);

  return (
    <article
      data-testid={`change-request-card-${request.id}`}
      className="rounded-xl border border-border bg-card p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <Badge className="bg-warning/10 text-warning">
              {t('pending.changeRequest.editBadge')}
            </Badge>
            <h3
              className="text-base font-semibold text-foreground truncate"
              title={request.materialName}
            >
              {request.materialName}
            </h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('pending.changeRequest.requestedBy', {
              name: request.requestedBy?.name ?? '—',
            })}{' '}
            · {formatDateTime(request.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {permissions.canApprove && (
            <Button
              size="sm"
              isLoading={isApproving}
              onClick={() => onApprove(request.id)}
              data-testid={`change-request-approve-${request.id}`}
            >
              {isApproving
                ? t('pending.changeRequest.approving')
                : t('pending.changeRequest.approve')}
            </Button>
          )}
          {permissions.canReject && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<CrossIcon className="w-3 h-3" />}
              isLoading={isRejecting}
              onClick={() => onReject(request.id)}
              data-testid={`change-request-reject-${request.id}`}
            >
              {isRejecting
                ? t('pending.changeRequest.rejecting')
                : t('pending.changeRequest.reject')}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto border-t border-border pt-4">
        <table className="w-full text-sm" data-testid={`change-request-diff-${request.id}`}>
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left pb-2 pr-4 font-medium">
                {t('pending.changeRequest.field')}
              </th>
              <th className="text-left pb-2 pr-4 font-medium">
                {t('pending.changeRequest.before')}
              </th>
              <th className="text-left pb-2 font-medium">{t('pending.changeRequest.after')}</th>
            </tr>
          </thead>
          <tbody>
            {changeEntries.map(([field, change]) => (
              <tr key={field} className="align-top">
                <td className="py-1.5 pr-4 text-foreground">{humanizeKey(field)}</td>
                <td className="py-1.5 pr-4 text-muted-foreground line-through">
                  {formatValue(change.from)}
                </td>
                <td className="py-1.5 text-foreground font-medium">{formatValue(change.to)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {request.reason ? (
        <p className="mt-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{t('pending.changeRequest.reason')}:</span>{' '}
          {request.reason}
        </p>
      ) : null}
    </article>
  );
}
