import { useTranslation } from '@forethread/i18n';
import {
  StatusActionModal,
  StatusSuccessModal,
  notificationService,
} from '@forethread/ui-components';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';

import type { useVendorActions } from '../hooks/useVendorActions';
import { useVendorsStore } from '../state/vendors.store';

import { CreateVendorCompanyModal } from './CreateVendorCompanyModal';
import { EditVendorModal } from './EditVendorModal';
import { InviteVendorModal } from './InviteVendorModal';
import { VendorInviteSuccessModal } from './VendorInviteSuccessModal';

interface VendorModalsProps {
  isInviteModalOpen: boolean;
  onCloseInviteModal: () => void;
  onInviteSuccess: (email: string, alreadyExisted: boolean) => void;
  isCreateCompanyModalOpen: boolean;
  onCloseCreateCompanyModal: () => void;
  successEmail: string | null;
  successAlreadyExisted: boolean;
  onCloseSuccessModal: () => void;
  vendorActions: ReturnType<typeof useVendorActions>;
}

export function VendorModals({
  isInviteModalOpen,
  onCloseInviteModal,
  onInviteSuccess,
  isCreateCompanyModalOpen,
  onCloseCreateCompanyModal,
  successEmail,
  successAlreadyExisted,
  onCloseSuccessModal,
  vendorActions,
}: VendorModalsProps) {
  const { t } = useTranslation(['vendors', 'common']);
  const { isEditModalOpen, closeEditModal } = useVendorsStore();

  const {
    isActionModalOpen,
    actionType,
    actionUserEmail,
    actionUserName,
    closeActionModal,
    handleActionConfirm,
    getActionModalLoading,
    isSuccessModalOpen,
    successType,
    successUserEmail,
    closeSuccessModal,
  } = vendorActions;

  return (
    <>
      {isInviteModalOpen && (
        <InviteVendorModal onClose={onCloseInviteModal} onSuccess={onInviteSuccess} />
      )}

      {isCreateCompanyModalOpen && (
        <CreateVendorCompanyModal
          onClose={onCloseCreateCompanyModal}
          onSuccess={(_companyId, companyName) => {
            onCloseCreateCompanyModal();
            notificationService.success(t('createCompanyModal.success', { companyName }));
          }}
        />
      )}

      {isEditModalOpen && <EditVendorModal onClose={closeEditModal} />}

      {successEmail && (
        <VendorInviteSuccessModal
          email={successEmail}
          onClose={onCloseSuccessModal}
          alreadyExisted={successAlreadyExisted}
        />
      )}

      {isSuccessModalOpen && successType === 'deactivateVendor' && (
        <StatusSuccessModal
          onClose={closeSuccessModal}
          maxWidth="max-w-[560px]"
          title={t('deactivateVendorSuccess.title')}
          description={
            <span
              dangerouslySetInnerHTML={{
                __html: t('deactivateVendorSuccess.description', {
                  email: successUserEmail ?? '',
                  interpolation: { escapeValue: false },
                }),
              }}
            />
          }
          note={t('deactivateVendorSuccess.note')}
          buttonLabel={t('deactivateVendorSuccess.backButton')}
          redirectLabel={(seconds) => t('deactivateVendorSuccess.redirecting', { seconds })}
        />
      )}

      {isActionModalOpen && actionType && (
        <StatusActionModal
          onClose={closeActionModal}
          onConfirm={handleActionConfirm}
          isLoading={getActionModalLoading()}
          title={t(`${actionType}Modal.title` as 'cancelInvitationModal.title')}
          subtitle={t(`${actionType}Modal.subtitle` as 'cancelInvitationModal.subtitle')}
          infoText={
            <span
              dangerouslySetInnerHTML={{
                __html: t(`${actionType}Modal.info` as 'cancelInvitationModal.info', {
                  name: actionUserName ?? '',
                  email: actionUserEmail ?? '',
                  interpolation: { escapeValue: false },
                }),
              }}
            />
          }
          confirmLabel={t(`${actionType}Modal.confirm` as 'cancelInvitationModal.confirm')}
          cancelLabel={t('common:cancel')}
          variant={actionType === 'resetInvitation' ? 'default' : 'danger'}
          icon={
            actionType !== 'resetInvitation' ? (
              <CrossInCircleIcon className="w-6 h-6 text-foreground" />
            ) : undefined
          }
        />
      )}
    </>
  );
}
