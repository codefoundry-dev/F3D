import type { VendorListItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { notificationService, type DotAction } from '@forethread/ui-components';
import { useCallback } from 'react';

import type { VendorGroup } from '../hooks/useGroupedVendors';
import {
  useResendVendorInvitation,
  useCancelVendorInvitation,
  useArchiveVendor,
} from '../services/vendors.service';
import { useVendorsStore } from '../state/vendors.store';

interface UseVendorActionsOptions {
  onNavigateToCompany?: (companyId: string) => void;
  onNavigateToCompanyEdit?: (companyId: string) => void;
}

export function useVendorActions(options?: UseVendorActionsOptions) {
  const { t } = useTranslation(['vendors', 'common']);

  const {
    isActionModalOpen,
    actionType,
    actionUserId,
    actionUserEmail,
    actionUserName,
    openActionModal,
    closeActionModal,
    isSuccessModalOpen,
    successType,
    successUserEmail,
    openSuccessModal,
    closeSuccessModal,
  } = useVendorsStore();

  const resendMutation = useResendVendorInvitation();
  const cancelMutation = useCancelVendorInvitation();
  const deactivateMutation = useArchiveVendor();

  const handleActionConfirm = useCallback(() => {
    if (!actionUserId || !actionType || !actionUserEmail) return;

    if (actionType === 'cancelInvitation') {
      cancelMutation.mutate(actionUserId, {
        onSuccess: () => {
          closeActionModal();
          notificationService.success(t('cancelInvitationSuccess'));
        },
      });
    } else if (actionType === 'resetInvitation') {
      resendMutation.mutate(actionUserId, {
        onSuccess: () => {
          closeActionModal();
          notificationService.success(t('resetInvitationSuccess'));
        },
      });
    } else if (actionType === 'deactivateVendor') {
      deactivateMutation.mutate(actionUserId, {
        onSuccess: () => {
          closeActionModal();
          openSuccessModal('deactivateVendor', actionUserEmail);
        },
      });
    }
  }, [
    actionUserId,
    actionType,
    actionUserEmail,
    cancelMutation,
    resendMutation,
    deactivateMutation,
    closeActionModal,
    openSuccessModal,
    t,
  ]);

  const getActionModalLoading = useCallback(() => {
    if (actionType === 'cancelInvitation') return cancelMutation.isPending;
    if (actionType === 'resetInvitation') return resendMutation.isPending;
    if (actionType === 'deactivateVendor') return deactivateMutation.isPending;
    return false;
  }, [
    actionType,
    cancelMutation.isPending,
    resendMutation.isPending,
    deactivateMutation.isPending,
  ]);

  const getCompanyRowActions = useCallback(
    (companyId: string, _group?: VendorGroup): DotAction[] => [
      {
        key: 'viewCompanyDetails',
        label: t('actions.viewCompanyDetails'),
        onClick: () => options?.onNavigateToCompany?.(companyId),
      },
      {
        key: 'editCompanyDetails',
        label: t('actions.editCompanyDetails'),
        onClick: () => options?.onNavigateToCompanyEdit?.(companyId),
      },
    ],
    [t, options],
  );

  const getVendorRowActions = useCallback(
    (vendor: VendorListItem): DotAction[] => {
      if (vendor.status === 'INVITED' && vendor.userId) {
        return [
          {
            key: 'resetInvitation',
            label: t('actions.resetInvitation'),
            onClick: () =>
              openActionModal(
                'resetInvitation',
                vendor.userId!,
                vendor.contactEmail ?? '',
                vendor.contactName ?? '',
              ),
          },
          {
            key: 'cancelInvitation',
            label: t('actions.cancelInvitation'),
            onClick: () =>
              openActionModal(
                'cancelInvitation',
                vendor.userId!,
                vendor.contactEmail ?? '',
                vendor.contactName ?? '',
              ),
          },
        ];
      }

      if (vendor.status === 'ACTIVE' && vendor.userId) {
        return [
          {
            key: 'deactivateVendor',
            label: t('actions.deactivateVendor'),
            onClick: () =>
              openActionModal(
                'deactivateVendor',
                vendor.userId!,
                vendor.contactEmail ?? '',
                vendor.contactName ?? '',
              ),
          },
        ];
      }

      return [];
    },
    [t, openActionModal],
  );

  return {
    // Modal state
    isActionModalOpen,
    actionType,
    actionUserEmail,
    actionUserName,
    closeActionModal,
    isSuccessModalOpen,
    successType,
    successUserEmail,
    closeSuccessModal,
    // Handlers
    handleActionConfirm,
    getActionModalLoading,
    getCompanyRowActions,
    getVendorRowActions,
  };
}
