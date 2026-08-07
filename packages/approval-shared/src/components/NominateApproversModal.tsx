import type { ApprovalEntityType, ApproverPoolMember } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Button,
  Checkbox,
  GridModal,
  RadioGroup,
  Spinner,
  cn,
  notificationService,
} from '@forethread/ui-components';
import UsersGroupIcon from '@forethread/ui-components/assets/icons/users-group.svg?react';
import { useMemo, useState } from 'react';

import { useAddNominations, useApproverPool } from '../hooks/useApproverPool';
import { useRoleLabel } from '../hooks/useRoleLabel';

type NominateMode = 'submit' | 'add';
type NotifyChoice = 'everyone' | 'selected';

export interface NominateApproversModalProps {
  entityType: ApprovalEntityType;
  entityId: string;
  /**
   * `submit` — the confirm step of Submit for Approval (FOR-306). The modal only
   * collects the choice; the caller owns the submit mutation, because the
   * nominations have to travel with it in one request.
   *
   * `add` — nominating further people on a document already pending (FOR-308).
   * The modal owns the mutation.
   */
  mode: NominateMode;
  onClose: () => void;
  /** `submit` mode only. Empty array means "notify everyone in the pool". */
  onConfirm?: (nomineeIds: string[]) => void;
  /** `submit` mode only — drives the confirm button's spinner. */
  isSubmitting?: boolean;
  /**
   * `submit` mode only: resolve the Pool for this total rather than the
   * document's saved one.
   *
   * The invoice reviewer is choosing who to notify about a figure they have
   * typed but not yet saved, so the saved total would list the wrong people.
   * The PO path has no such gap — its total is already committed when Submit
   * for Approval is pressed — so it simply omits this.
   */
  previewAmount?: number | null;
}

/**
 * Choose who gets notified about an approval.
 *
 * The safety rule that makes this modal harmless is stated in its own copy: a
 * Nomination is **routing, not authority**. Everyone in the Pool can still
 * approve the document, and non-nominees still see it in their entitlement-
 * filtered queue — so a nominee who goes on leave can never block it. That is
 * what lets us ship this while ADR-0006's Out-of-Office delegation is unbuilt.
 *
 * Consequently the creator may only ever **narrow**: the picker is drawn from
 * the current Pool, and the server rejects any id outside it. "Notify everyone"
 * is preselected, so confirming without touching anything reproduces the
 * pre-nomination broadcast behaviour exactly.
 *
 * Cap amounts are never rendered — see `ApproverPoolPanel` for why.
 */
export function NominateApproversModal({
  entityType,
  entityId,
  mode,
  onClose,
  onConfirm,
  isSubmitting = false,
  previewAmount,
}: NominateApproversModalProps) {
  const { t } = useTranslation('approvals');
  const roleLabel = useRoleLabel();
  const { data: pool, isLoading } = useApproverPool(entityType, entityId, {
    amount: mode === 'submit' ? previewAmount : undefined,
  });
  const addNominations = useAddNominations(entityType, entityId);

  const [choice, setChoice] = useState<NotifyChoice>('everyone');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const alreadyNominated = useMemo(
    () => new Set((pool?.nominations ?? []).map((n) => n.userId)),
    [pool],
  );

  // In `add` mode there is nothing to gain from re-picking an existing nominee —
  // the server treats it as a no-op precisely so no one gets a duplicate email.
  const selectable = useMemo(
    () => (pool?.members ?? []).filter((m) => mode === 'submit' || !alreadyNominated.has(m.id)),
    [pool, mode, alreadyNominated],
  );

  const toggle = (member: ApproverPoolMember, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(member.id);
      else next.delete(member.id);
      return next;
    });
  };

  const isAdd = mode === 'add';
  // "Notify everyone" is meaningless once the document is already routed — in
  // `add` mode the whole point is naming someone new.
  const effectiveChoice: NotifyChoice = isAdd ? 'selected' : choice;
  const nomineeIds = effectiveChoice === 'everyone' ? [] : [...selected];
  const nothingPicked = effectiveChoice === 'selected' && nomineeIds.length === 0;

  const handleConfirm = () => {
    if (nothingPicked) {
      notificationService.error(t('nominateModal.selectAtLeastOne'));
      return;
    }
    if (isAdd) {
      addNominations.mutate(nomineeIds, {
        onSuccess: () => {
          notificationService.success(t('nominees.added', { count: nomineeIds.length }));
          onClose();
        },
        onError: () => notificationService.error(t('nominees.addFailed')),
      });
      return;
    }
    onConfirm?.(nomineeIds);
  };

  // ── Empty Pool: block here rather than submitting into a dead state ────────
  if (!isLoading && pool?.isEmpty) {
    return (
      <GridModal
        onClose={onClose}
        icon={<UsersGroupIcon className="h-6 w-6" />}
        title={t('nominateModal.emptyTitle')}
        description={t('nominateModal.emptyBody')}
        actions={
          <Button type="button" variant="outline" onClick={onClose}>
            {t('nominateModal.emptyDismiss')}
          </Button>
        }
      />
    );
  }

  const busy = isSubmitting || addNominations.isPending;

  return (
    <GridModal
      onClose={onClose}
      size="lg"
      scrollBody
      icon={<UsersGroupIcon className="h-6 w-6" />}
      title={t(isAdd ? 'nominateModal.addTitle' : 'nominateModal.title')}
      description={t(isAdd ? 'nominateModal.addDescription' : 'nominateModal.description')}
      actions={
        <>
          {/* Explicit onClick, never a type="submit" that morphs: a morphing
              button type fires an unwanted implicit submit. */}
          <Button
            type="button"
            variant="primary"
            isLoading={busy}
            onClick={handleConfirm}
            data-testid="nominate-modal-confirm"
          >
            {t(isAdd ? 'nominateModal.confirmAdd' : 'nominateModal.submit')}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {t('nominateModal.cancel')}
          </Button>
        </>
      }
    >
      {isLoading || !pool ? (
        <div className="flex justify-center py-6">
          <Spinner size="sm" />
        </div>
      ) : (
        <div className="flex flex-col gap-4 text-left">
          {!isAdd && (
            <div>
              <RadioGroup
                orientation="vertical"
                name="notify-choice"
                value={choice}
                onChange={(v) => setChoice(v as NotifyChoice)}
                options={[
                  { value: 'everyone', label: t('nominateModal.notifyEveryone') },
                  { value: 'selected', label: t('nominateModal.notifySelected') },
                ]}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {t(
                  choice === 'everyone'
                    ? 'nominateModal.notifyEveryoneHint'
                    : 'nominateModal.notifySelectedHint',
                )}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('nominateModal.poolHeading')}
            </p>
            <ul className="mt-2 flex flex-col gap-2" data-testid="nominate-modal-pool">
              {selectable.map((member) => {
                const nominated = alreadyNominated.has(member.id);
                return (
                  <li
                    key={member.id}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2',
                      effectiveChoice === 'everyone' && 'opacity-60',
                    )}
                  >
                    <Checkbox
                      size="sm"
                      checked={effectiveChoice === 'selected' && selected.has(member.id)}
                      disabled={effectiveChoice === 'everyone' || nominated}
                      onChange={(on) => toggle(member, on)}
                      label={member.name}
                    />
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {nominated ? t('nominateModal.alreadyNominated') : roleLabel(member)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </GridModal>
  );
}
