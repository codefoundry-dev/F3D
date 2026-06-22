import { useTranslation } from '@forethread/i18n';
import {
  GridModal,
  Input,
  FormField,
  Button,
  Alert,
  CustomDropdown,
  UserAlreadyExistsModal,
} from '@forethread/ui-components';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import IdBadgeIcon from '@forethread/ui-components/assets/icons/id-badge.svg?react';
import InfoIcon from '@forethread/ui-components/assets/icons/info.svg?react';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';
import PlusInCircleIcon from '@forethread/ui-components/assets/icons/plus-in-circle.svg?react';
import UserOutlineIcon from '@forethread/ui-components/assets/icons/user-outline.svg?react';
import VendorsIcon from '@forethread/ui-components/assets/icons/vendors.svg?react';
import { Controller } from 'react-hook-form';

import { useInviteVendorForm } from '../hooks/useInviteVendorForm';

import { CreateVendorCompanyModal } from './CreateVendorCompanyModal';

interface InviteVendorModalProps {
  onClose: () => void;
  onSuccess: (email: string, alreadyExisted: boolean) => void;
}

export function InviteVendorModal({ onClose, onSuccess }: InviteVendorModalProps) {
  const { t } = useTranslation(['vendors', 'common']);

  const {
    form,
    errorKey,
    companyOptions,
    isCreateCompanyOpen,
    setIsCreateCompanyOpen,
    onSubmit,
    handleCreateCompanySuccess,
    isPending,
    showUserExists,
    closeUserExists,
  } = useInviteVendorForm({ onClose, onSuccess });

  const {
    register,
    control,
    formState: { errors },
  } = form;

  if (isCreateCompanyOpen) {
    return (
      <CreateVendorCompanyModal
        onClose={() => setIsCreateCompanyOpen(false)}
        onSuccess={handleCreateCompanySuccess}
      />
    );
  }

  return (
    <>
      <GridModal
        onClose={onClose}
        maxWidth="max-w-[560px]"
        icon={<NewUserIcon className="size-6 text-gray-700" />}
        title={t('inviteModal.title')}
        description={t('inviteModal.subtitle')}
        onSubmit={(e) => void onSubmit(e)}
        actions={
          <>
            <Button type="submit" size="lg" isLoading={isPending} className="w-full">
              {isPending ? t('inviteModal.sending') : t('inviteModal.sendInvitation')}
            </Button>
            <Button variant="outline" size="lg" type="button" onClick={onClose} className="w-full">
              {t('common:cancel')}
            </Button>
          </>
        }
      >
        {/* Error alert */}
        {errorKey && (
          <Alert variant="destructive" icon={<InfoIcon className="w-5 h-5" />}>
            {t(`inviteModal.${errorKey}` as 'inviteModal.inviteError')}
          </Alert>
        )}

        {/* Company */}
        <FormField label={t('inviteModal.company')} error={errors.companyId?.message}>
          <Controller
            name="companyId"
            control={control}
            render={({ field }) => (
              <CustomDropdown
                options={companyOptions}
                value={field.value}
                onChange={field.onChange}
                placeholder={t('inviteModal.companyPlaceholder')}
                leftIcon={<VendorsIcon className="w-5 h-5" />}
                searchable
                error={Boolean(errors.companyId)}
                actionItem={{
                  label: t('inviteModal.addVendorCompany'),
                  icon: <PlusInCircleIcon className="w-5 h-5" />,
                  onClick: () => setIsCreateCompanyOpen(true),
                }}
              />
            )}
          />
        </FormField>

        {/* Representative Name */}
        <FormField label={t('inviteModal.representativeName')} error={errors.userName?.message}>
          <Input
            type="text"
            placeholder={t('inviteModal.representativeNamePlaceholder')}
            leftIcon={<UserOutlineIcon className="w-5 h-5" />}
            {...register('userName')}
          />
        </FormField>

        {/* Representative Email */}
        <FormField label={t('inviteModal.representativeEmail')} error={errors.userEmail?.message}>
          <Input
            type="email"
            placeholder={t('inviteModal.representativeEmailPlaceholder')}
            leftIcon={<EnvelopeIcon className="w-5 h-5" />}
            {...register('userEmail')}
          />
        </FormField>

        {/* Position (optional) */}
        <FormField
          label={`${t('inviteModal.position')} ${t('inviteModal.positionOptional')}`}
          error={errors.position?.message}
        >
          <Input
            type="text"
            placeholder={t('inviteModal.positionPlaceholder')}
            leftIcon={<IdBadgeIcon className="w-5 h-5" />}
            {...register('position')}
          />
        </FormField>
      </GridModal>

      {showUserExists && (
        <UserAlreadyExistsModal
          onClose={closeUserExists}
          onBack={onClose}
          title={t('common:userAlreadyExists.title')}
          description={t('common:userAlreadyExists.description')}
          buttonLabel={t('vendors:inviteSuccess.backToVendors')}
        />
      )}
    </>
  );
}
