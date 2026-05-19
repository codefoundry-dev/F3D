import { useTranslation } from '@forethread/i18n';
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  Input,
  FormField,
  Button,
  IconBadge,
  UserAlreadyExistsModal,
} from '@forethread/ui-components';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import IdBadgeIcon from '@forethread/ui-components/assets/icons/id-badge.svg?react';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';
import UserOutlineIcon from '@forethread/ui-components/assets/icons/user-outline.svg?react';

import { useInviteVendorUserForm } from '../hooks/useInviteVendorUserForm';

interface InviteVendorUserModalProps {
  onClose: () => void;
}

export function InviteVendorUserModal({ onClose }: InviteVendorUserModalProps) {
  const { t } = useTranslation(['vendorUsers', 'common']);
  const { form, handleSubmit, inviteMutation, showUserExists, closeUserExists } =
    useInviteVendorUserForm(onClose);
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <>
      <Modal onClose={onClose} maxWidth="max-w-[560px]">
        <ModalBody>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5" noValidate>
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-2">
              <div className="w-full flex justify-between items-start">
                <div className="flex-1" />
                <IconBadge icon={<NewUserIcon className="w-6 h-6 text-foreground" />} />
                <div className="flex-1 flex justify-end">
                  <ModalCloseButton onClose={onClose} />
                </div>
              </div>
              <h2 className="text-2xl font-normal leading-[140%] text-foreground mt-4">
                {t('inviteModal.title')}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{t('inviteModal.subtitle')}</p>
            </div>

            {/* Full Name */}
            <FormField label={t('inviteModal.fullName')} error={errors.name?.message}>
              <Input
                type="text"
                placeholder={t('inviteModal.namePlaceholder')}
                leftIcon={<UserOutlineIcon className="w-5 h-5" />}
                {...register('name')}
              />
            </FormField>

            {/* Email */}
            <FormField label={t('inviteModal.email')} error={errors.email?.message}>
              <Input
                type="email"
                placeholder={t('inviteModal.emailPlaceholder')}
                leftIcon={<EnvelopeIcon className="w-5 h-5" />}
                {...register('email')}
              />
            </FormField>

            {/* Position (optional) */}
            <FormField
              label={t('inviteModal.positionLabel')}
              optional
              error={errors.position?.message}
            >
              <Input
                type="text"
                placeholder={t('inviteModal.positionPlaceholder')}
                leftIcon={<IdBadgeIcon className="w-5 h-5" />}
                {...register('position')}
              />
            </FormField>

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-2">
              <Button type="submit" isLoading={inviteMutation.isPending} className="w-full">
                {inviteMutation.isPending
                  ? t('inviteModal.sending')
                  : t('inviteModal.sendInvitation')}
              </Button>
              <Button variant="outline" type="button" onClick={onClose} className="w-full">
                {t('common:cancel')}
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>

      {showUserExists && (
        <UserAlreadyExistsModal
          onClose={closeUserExists}
          onBack={onClose}
          title={t('vendorUsers:userAlreadyExists.title')}
          description={t('vendorUsers:userAlreadyExists.description')}
          buttonLabel={t('vendorUsers:userAlreadyExists.backToUsers')}
        />
      )}
    </>
  );
}
