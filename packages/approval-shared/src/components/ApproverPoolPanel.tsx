import type { ApprovalEntityType } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Button, Spinner, cn, formatDate, notificationService } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import ClockIcon from '@forethread/ui-components/assets/icons/clock-icon.svg?react';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import UsersGroupIcon from '@forethread/ui-components/assets/icons/users-group.svg?react';
import { useState, type ReactNode } from 'react';

import { useApproverPool, useWithdrawNomination } from '../hooks/useApproverPool';
import { useRoleLabel } from '../hooks/useRoleLabel';
import { hasMonetaryCap } from '../utils/threshold';

import { NominateApproversModal } from './NominateApproversModal';

export interface ApproverPoolPanelProps {
  entityType: ApprovalEntityType;
  entityId: string;
  /** Hide the "Ask someone else" affordance (FOR-308) where it doesn't belong. */
  allowNomination?: boolean;
  className?: string;
}

/** Shared card chrome so pending / resolved / empty stay visually one component. */
function PanelShell({
  icon,
  tone,
  children,
  className,
}: {
  icon: ReactNode;
  tone: 'pending' | 'resolved' | 'rejected' | 'empty';
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    pending: 'border-border bg-card text-[#40454F]',
    resolved: 'border-[#ABEFC6] bg-[#ECFDF3] text-[#067647]',
    rejected: 'border-[#FECDCA] bg-[#FEF3F2] text-[#B42318]',
    empty: 'border-[#FEDF89] bg-[#FFFAEB] text-[#B54708]',
  } as const;

  return (
    <div className={cn('mb-4 rounded-xl border px-4 py-3', tones[tone], className)}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

/**
 * The Approver Pool on a document awaiting approval (FOR-304), shared by the
 * Purchase Order and Invoice paths (FOR-309) — one component parameterised by
 * entity type, because a fork here is how the two paths drift.
 *
 * Two deliberate rules govern what it renders:
 *
 *  - **While pending it names no one.** The Pool is shown as role labels plus a
 *    count, because responsibility sits with the whole Pool; naming an
 *    individual would point the chase at one person who has no more duty than
 *    their peers. Nominees are the exception — those are named, because the
 *    creator explicitly asked them.
 *  - **It never renders a cap amount.** Publishing per-user approval limits
 *    would expose the company's spend hierarchy and invite approver-shopping.
 *
 * Once resolved it flips to naming the individual who acted, which ADR-0006's
 * audit requirement demands. `SUPER_ADMIN` is never in a Pool (its `companyId`
 * is null), so platform-operator identity is never exposed to a tenant here.
 */
export function ApproverPoolPanel({
  entityType,
  entityId,
  allowNomination = true,
  className,
}: ApproverPoolPanelProps) {
  const { t } = useTranslation('approvals');
  const roleLabel = useRoleLabel();
  const capBased = hasMonetaryCap(entityType);
  const [showNominate, setShowNominate] = useState(false);
  const { data: pool, isLoading, isError } = useApproverPool(entityType, entityId);
  const withdraw = useWithdrawNomination(entityType, entityId);

  if (isLoading) {
    return (
      <PanelShell icon={<Spinner size="sm" />} tone="pending" className={className}>
        <p className="text-sm text-muted-foreground">{t('pool.loading')}</p>
      </PanelShell>
    );
  }

  if (isError || !pool) {
    return (
      <PanelShell
        icon={<CrossInCircleIcon className="h-5 w-5" />}
        tone="empty"
        className={className}
      >
        <p className="text-sm">{t('pool.loadError')}</p>
      </PanelShell>
    );
  }

  // Nothing to say about a document that never needed approval. Rendering an
  // "approval" card on every PO would make the routed ones stop standing out.
  if (pool.approvalStatus === 'NOT_REQUIRED') return null;

  // ── Resolved ───────────────────────────────────────────────────────────────
  if (pool.approvalStatus === 'APPROVED' || pool.approvalStatus === 'REJECTED') {
    const approved = pool.approvalStatus === 'APPROVED';
    const name = pool.resolvedBy?.name;
    return (
      <PanelShell
        icon={
          approved ? (
            <CheckCircleIcon className="h-5 w-5" />
          ) : (
            <CrossInCircleIcon className="h-5 w-5" />
          )
        }
        tone={approved ? 'resolved' : 'rejected'}
        className={className}
      >
        <p className="text-sm font-medium" data-testid="approver-pool-resolved">
          {name
            ? t(approved ? 'pool.approvedBy' : 'pool.rejectedBy', { name })
            : t('pool.resolvedNoActor')}
          {pool.resolvedAt ? ` · ${formatDate(pool.resolvedAt)}` : ''}
        </p>
      </PanelShell>
    );
  }

  // ── Pending, but nobody's cap covers the total (FOR-302) ───────────────────
  if (pool.isEmpty) {
    return (
      <PanelShell
        icon={<CrossInCircleIcon className="h-5 w-5" />}
        tone="empty"
        className={className}
      >
        <p className="text-sm font-semibold" data-testid="approver-pool-empty">
          {t('pool.emptyTitle')}
        </p>
        <p className="mt-0.5 text-sm">{t(capBased ? 'pool.emptyBody' : 'pool.emptyBodyNoCap')}</p>
      </PanelShell>
    );
  }

  // ── Pending ────────────────────────────────────────────────────────────────
  const roleSummary = pool.roleGroups.map((g) => roleLabel(g, g.count)).join(', ');

  return (
    <>
      <PanelShell icon={<ClockIcon className="h-5 w-5" />} tone="pending" className={className}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{t('pool.pendingTitle')}</p>
            <p className="mt-0.5 text-sm text-muted-foreground" data-testid="approver-pool-summary">
              {t('pool.pendingSummary', { roles: roleSummary, count: pool.memberCount })}
            </p>
          </div>
          {allowNomination && pool.canNominate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<UsersGroupIcon className="h-4 w-4" />}
              onClick={() => setShowNominate(true)}
              data-testid="approver-pool-nominate"
            >
              {t('nominees.add')}
            </Button>
          )}
        </div>

        <div className="mt-3 border-t border-border pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('nominees.heading')}
          </p>
          {pool.nominations.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">{t('nominees.none')}</p>
          ) : (
            <ul className="mt-1.5 flex flex-col gap-1.5" data-testid="approver-pool-nominees">
              {pool.nominations.map((n) => (
                <li key={n.userId} className="flex items-center justify-between gap-3 text-sm">
                  <span className={cn('min-w-0 truncate', !n.stillEligible && 'text-[#8A909C]')}>
                    <span className="font-medium text-foreground">{n.name}</span>
                    <span className="text-muted-foreground"> · {roleLabel(n)}</span>
                    {/* A nominee who fell out of the Pool is greyed rather than
                        dropped: the Pool is live, but the Nomination is the
                        creator's recorded intent and survives. */}
                    {!n.stillEligible && (
                      <span
                        className="ml-2 rounded-full bg-[#F4F4F6] px-2 py-0.5 text-xs text-[#8A909C]"
                        title={t(
                          capBased ? 'nominees.ineligibleHint' : 'nominees.ineligibleHintNoCap',
                          { name: n.name },
                        )}
                      >
                        {t('nominees.ineligible')}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {t('nominees.nominatedAt', { date: formatDate(n.nominatedAt) })}
                    </span>
                    {allowNomination && pool.canNominate && (
                      <button
                        type="button"
                        className="text-xs text-[#175CD3] underline-offset-4 hover:underline disabled:opacity-50"
                        disabled={withdraw.isPending}
                        onClick={() =>
                          withdraw.mutate(n.userId, {
                            onSuccess: () => notificationService.success(t('nominees.withdrawn')),
                            onError: () => notificationService.error(t('nominees.withdrawFailed')),
                          })
                        }
                      >
                        {t('nominees.withdraw')}
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PanelShell>

      {showNominate && (
        <NominateApproversModal
          entityType={entityType}
          entityId={entityId}
          mode="add"
          onClose={() => setShowNominate(false)}
        />
      )}
    </>
  );
}
