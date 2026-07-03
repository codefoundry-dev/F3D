import {
  cancelVendorUserInvitation,
  getVendorRepresentative,
  removeVendorRepresentative,
  resendVendorUserInvitation,
  type VendorRepresentativeDetail,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import {
  AvatarUpload,
  Badge,
  Button,
  Spinner,
  StatusActionModal,
  notificationService,
  type BadgeColor,
} from '@forethread/ui-components';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { ProfileInfoGrid } from '../../profile/ui/ProfileInfoGrid';

const REP_KEY = 'vendor-representative';

/**
 * The four rep lifecycle states shown to the buyer (CONTEXT.md "Sales Rep"):
 * contact-only and invite-pending are both status INVITED, split by whether an
 * activation invitation is out.
 */
type RepState = 'notInvited' | 'inviteSent' | 'active' | 'deactivated';

function getRepState(rep: VendorRepresentativeDetail): RepState {
  if (rep.status === 'ACTIVE') return 'active';
  if (rep.status === 'INACTIVE') return 'deactivated';
  return rep.invitePending ? 'inviteSent' : 'notInvited';
}

const STATE_BADGE: Record<RepState, BadgeColor> = {
  notInvited: 'neutral',
  inviteSent: 'warning',
  active: 'success',
  deactivated: 'red',
};

type ConfirmAction = 'cancelInvitation' | 'remove' | null;

export default function VendorRepresentativeDetailPage() {
  const { t } = useTranslation(['vendors', 'common']);
  const { id: vendorId, userId } = useParams<{ id: string; userId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  useEffect(() => {
    setPageTitle(
      t('vendors:repDetail.pageTitle', { defaultValue: 'Representative' }),
      t('vendors:repDetail.pageSubtitle', { defaultValue: 'View and manage this sales rep' }),
      vendorId ? ROUTES.vendorDetail.replace(':id', vendorId) : ROUTES.vendors,
    );
    return () => setPageTitle(null);
  }, [setPageTitle, t, vendorId]);

  const {
    data: rep,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [REP_KEY, vendorId, userId],
    queryFn: () => getVendorRepresentative(vendorId!, userId!),
    enabled: !!vendorId && !!userId,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: [REP_KEY, vendorId, userId] });
    void queryClient.invalidateQueries({ queryKey: ['vendors'] });
    void queryClient.invalidateQueries({ queryKey: ['vendorProfile'] });
  };

  const inviteMutation = useMutation({
    mutationFn: () => resendVendorUserInvitation(vendorId!, userId!),
    onSuccess: () => {
      invalidate();
      notificationService.success(
        t('vendors:repDetail.inviteSentToast', { defaultValue: 'Invitation sent' }),
      );
    },
    onError: () =>
      notificationService.error(
        t('vendors:repDetail.inviteFailedToast', { defaultValue: 'Could not send invitation' }),
      ),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelVendorUserInvitation(vendorId!, userId!),
    onSuccess: () => {
      invalidate();
      setConfirmAction(null);
      notificationService.success(
        t('vendors:repDetail.cancelledToast', { defaultValue: 'Invitation cancelled' }),
      );
    },
    onError: () =>
      notificationService.error(
        t('vendors:repDetail.cancelFailedToast', {
          defaultValue: 'Could not cancel the invitation',
        }),
      ),
  });

  const removeMutation = useMutation({
    mutationFn: () => removeVendorRepresentative(vendorId!, userId!),
    onSuccess: () => {
      invalidate();
      setConfirmAction(null);
      notificationService.success(
        t('vendors:repDetail.removedToast', { defaultValue: 'Representative removed' }),
      );
      navigate(vendorId ? ROUTES.vendorDetail.replace(':id', vendorId) : ROUTES.vendors);
    },
    onError: () =>
      notificationService.error(
        t('vendors:repDetail.removeFailedToast', {
          defaultValue:
            'Could not remove this representative. Reps selected on RFQs cannot be removed.',
        }),
      ),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="md" />
      </div>
    );
  }

  if (isError || !rep) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-foreground">
          {t('vendors:repDetail.notFound', { defaultValue: 'Representative not found' })}
        </p>
      </div>
    );
  }

  const state = getRepState(rep);
  const neverActivated = rep.status === 'INVITED';

  return (
    <div className="p-6">
      <div className="bg-card rounded-xl border border-border p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-5">
            <AvatarUpload name={rep.name} avatarUrl={rep.avatarUrl} editable={false} />
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-foreground">{rep.name}</h2>
                <Badge color={STATE_BADGE[state]} dot>
                  {t(`vendors:repDetail.state.${state}`, {
                    defaultValue: {
                      notInvited: 'Not invited',
                      inviteSent: 'Invite sent',
                      active: 'Active',
                      deactivated: 'Deactivated',
                    }[state],
                  })}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1 min-w-0">
                <EnvelopeIcon className="w-4 h-4 shrink-0" />
                <span className="truncate" title={rep.email}>
                  {rep.email}
                </span>
              </div>
            </div>
          </div>

          {/* Buyer manages contacts; the vendor manages accounts (ADR-0016) —
              once the rep is ACTIVE (or INACTIVE) no actions are offered here. */}
          {neverActivated && (
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" onClick={() => inviteMutation.mutate()}>
                {rep.invitePending
                  ? t('vendors:repDetail.resendInvitation', { defaultValue: 'Resend invitation' })
                  : t('vendors:repDetail.sendInvitation', { defaultValue: 'Send invitation' })}
              </Button>
              {rep.invitePending && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmAction('cancelInvitation')}
                >
                  {t('vendors:repDetail.cancelInvitation', { defaultValue: 'Cancel invitation' })}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={() => setConfirmAction('remove')}
              >
                {t('vendors:repDetail.remove', { defaultValue: 'Remove' })}
              </Button>
            </div>
          )}
        </div>

        <ProfileInfoGrid
          phone={rep.phone}
          status={rep.status}
          role={rep.role}
          createdAt={rep.createdAt}
          position={rep.position}
          company={rep.companyName}
        />

        {rep.invitedByName && (
          <p className="text-sm text-muted-foreground">
            {t('vendors:repDetail.addedBy', {
              defaultValue: 'Added by {{name}}',
              name: rep.invitedByName,
            })}
          </p>
        )}
      </div>

      {confirmAction === 'cancelInvitation' && (
        <StatusActionModal
          onClose={() => setConfirmAction(null)}
          onConfirm={() => cancelMutation.mutate()}
          isLoading={cancelMutation.isPending}
          title={t('vendors:repDetail.cancelModal.title', { defaultValue: 'Cancel invitation?' })}
          subtitle={t('vendors:repDetail.cancelModal.subtitle', {
            defaultValue: 'The activation link will stop working.',
          })}
          infoText={t('vendors:repDetail.cancelModal.info', {
            defaultValue:
              'The representative stays on the vendor as a contact and can be invited again later.',
          })}
          confirmLabel={t('vendors:repDetail.cancelModal.confirm', {
            defaultValue: 'Cancel invitation',
          })}
          cancelLabel={t('common:cancel')}
          variant="danger"
          icon={<CrossInCircleIcon className="w-6 h-6 text-foreground" />}
        />
      )}

      {confirmAction === 'remove' && (
        <StatusActionModal
          onClose={() => setConfirmAction(null)}
          onConfirm={() => removeMutation.mutate()}
          isLoading={removeMutation.isPending}
          title={t('vendors:repDetail.removeModal.title', {
            defaultValue: 'Remove representative?',
          })}
          subtitle={t('vendors:repDetail.removeModal.subtitle', {
            defaultValue: 'This deletes the contact record entirely.',
          })}
          infoText={t('vendors:repDetail.removeModal.info', {
            defaultValue:
              'Representatives selected as contacts on an RFQ cannot be removed, because document history depends on them.',
          })}
          confirmLabel={t('vendors:repDetail.removeModal.confirm', { defaultValue: 'Remove' })}
          cancelLabel={t('common:cancel')}
          variant="danger"
          icon={<CrossInCircleIcon className="w-6 h-6 text-foreground" />}
        />
      )}
    </div>
  );
}
