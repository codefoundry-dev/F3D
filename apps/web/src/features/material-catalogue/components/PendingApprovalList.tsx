import { type MaterialListItemDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Badge, Button } from '@forethread/ui-components';
import CrossIcon from '@forethread/ui-components/assets/icons/cross.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';

import { formatDateTime } from '../lib/format';

export interface PendingApprovalListPermissions {
  canApprove: boolean;
  canReject: boolean;
}

export interface PendingApprovalListProps {
  items: MaterialListItemDto[];
  isLoading: boolean;
  isError: boolean;
  permissions: PendingApprovalListPermissions;
  approvingId?: string;
  rejectingId?: string;
  onView: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground truncate" title={value}>
        {value}
      </p>
    </div>
  );
}

/**
 * Pending-approval cards (US 4.01, screen 02 — "New" submissions only this
 * phase). Each card shows a "New" badge + name, the suggested-by meta row, and
 * View / Publish / Reject actions. The EDIT-diff cards and duplicate banner are
 * Phase 3.
 */
export function PendingApprovalList({
  items,
  isLoading,
  isError,
  permissions,
  approvingId,
  rejectingId,
  onView,
  onApprove,
  onReject,
}: PendingApprovalListProps) {
  const { t } = useTranslation(['materialCatalogue']);

  if (isLoading) {
    return (
      <div className="py-12 text-center text-muted-foreground" role="status">
        {t('pending.loading')}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-12 text-center text-destructive" role="alert">
        {t('pending.error')}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground" data-testid="pending-empty">
        {t('pending.empty')}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="pending-list">
      {items.map((material) => (
        <article
          key={material.id}
          data-testid={`pending-card-${material.id}`}
          className="rounded-xl border border-border bg-card p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Badge className="bg-muted text-muted-foreground">{t('pending.newBadge')}</Badge>
              <h3
                className="text-base font-semibold text-foreground truncate"
                title={material.name}
              >
                {material.name}
              </h3>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                iconOnly
                onClick={() => onView(material.id)}
                aria-label={t('actions.view')}
                data-testid={`pending-view-${material.id}`}
              >
                <EyeIcon className="w-4 h-4" />
              </Button>
              {permissions.canApprove && (
                <Button
                  size="sm"
                  leftIcon={<CheckCircle />}
                  isLoading={approvingId === material.id}
                  onClick={() => onApprove(material.id)}
                  data-testid={`pending-publish-${material.id}`}
                >
                  {t('pending.publish')}
                </Button>
              )}
              {permissions.canReject && (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<CrossIcon className="w-3 h-3" />}
                  isLoading={rejectingId === material.id}
                  onClick={() => onReject(material.id)}
                  data-testid={`pending-reject-${material.id}`}
                >
                  {t('pending.reject')}
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 sm:grid-cols-3 lg:grid-cols-7">
            <MetaCell label={t('pending.meta.category')} value={material.categoryName ?? '—'} />
            <MetaCell label={t('pending.meta.materialType')} value={material.materialType ?? '—'} />
            <MetaCell label={t('pending.meta.manufacturer')} value={material.manufacturer ?? '—'} />
            <MetaCell label={t('pending.meta.uom')} value={material.uom ?? '—'} />
            <MetaCell label={t('pending.meta.upc')} value={material.upc ?? '—'} />
            <MetaCell label={t('pending.meta.suggested')} value={material.brand ?? '—'} />
            <MetaCell
              label={t('pending.meta.dateTime')}
              value={formatDateTime(material.createdAt)}
            />
          </div>
        </article>
      ))}
    </div>
  );
}

function CheckCircle() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3.5 h-3.5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
}
