import { useTranslation } from '@forethread/i18n';
import { UserRole } from '@forethread/shared-types/client';
import {
  Alert,
  Button,
  FormField,
  Input,
  Modal,
  ModalGridBackground,
  ModalGridHeader,
  REGISTRATION_MODAL_CARD_CLASS,
  UserAlreadyExistsModal,
} from '@forethread/ui-components';
import DepartmentIcon from '@forethread/ui-components/assets/icons/department.svg?react';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import IdBadgeIcon from '@forethread/ui-components/assets/icons/id-badge.svg?react';
import ShieldIcon from '@forethread/ui-components/assets/icons/shield-icon.svg?react';
import UserOutlineIcon from '@forethread/ui-components/assets/icons/user-outline.svg?react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useCreateUser } from '../services/users.service';

import { InvitationSuccessStep } from './steps/InvitationSuccessStep';

interface AddSuperAdminModalProps {
  onClose: () => void;
}

/**
 * Invite another platform SUPER_ADMIN. Unlike the regular Create-User wizard,
 * there is no company-selection or role step: the role is fixed to SUPER_ADMIN
 * and the user is created without a company (super admins are platform-level).
 * The invitee receives the standard activation email.
 */
export function AddSuperAdminModal({ onClose }: AddSuperAdminModalProps) {
  const { t } = useTranslation(['users', 'common', 'validation']);
  const createMutation = useCreateUser();
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [createdEmail, setCreatedEmail] = useState('');
  const [isUserExistsOpen, setIsUserExistsOpen] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t('validation:nameRequired')),
        email: z.string().email(t('validation:emailRequired')),
        position: z.string().optional(),
        department: z.string().optional(),
      }),
    [t],
  );

  type FormData = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(
      {
        name: data.name,
        email: data.email,
        role: UserRole.SUPER_ADMIN,
        // No companyId — super admins are platform-level (see createUser service).
        position: data.position?.trim() ?? undefined,
        department: data.department?.trim() ?? undefined,
      },
      {
        onSuccess: () => {
          setCreatedEmail(data.email);
          setStep('success');
        },
        onError: (error) => {
          const apiError = error as { statusCode?: number };
          if (apiError.statusCode === 409) setIsUserExistsOpen(true);
        },
      },
    );
  };

  return (
    <>
      <Modal
        onClose={onClose}
        decoration={<ModalGridBackground />}
        cardClassName={REGISTRATION_MODAL_CARD_CLASS}
      >
        {step === 'form' && (
          <>
            <ModalGridHeader
              icon={<ShieldIcon className="size-6 text-gray-700" />}
              title={t('createSuperAdminModal.title')}
              subtitle={t('createSuperAdminModal.subtitle')}
            />

            <form
              onSubmit={(e) => void handleSubmit(onSubmit)(e)}
              className="relative flex w-full flex-col gap-10 text-left"
              noValidate
            >
              <div className="flex w-full flex-col gap-6">
                <FormField
                  label={t('createModal.fullName')}
                  error={errors.name?.message}
                  labelSize="lg"
                >
                  <Input
                    type="text"
                    inputSize="lg"
                    placeholder={t('createModal.namePlaceholder')}
                    leftIcon={<UserOutlineIcon className="size-5" />}
                    {...register('name')}
                  />
                </FormField>

                <FormField
                  label={t('createModal.email')}
                  error={errors.email?.message}
                  labelSize="lg"
                >
                  <Input
                    type="email"
                    inputSize="lg"
                    placeholder={t('createModal.emailPlaceholder')}
                    leftIcon={<EnvelopeIcon className="size-5" />}
                    {...register('email')}
                  />
                </FormField>

                <div>
                  <label className="mb-1.5 block px-2">
                    <span className="text-[16px] font-medium leading-[1.4] tracking-[0.3px] text-gray-800">
                      {t('createModal.position')}{' '}
                      <span className="text-[12px] font-normal text-gray-500">
                        ({t('common:optional')})
                      </span>
                    </span>
                  </label>
                  <Input
                    type="text"
                    inputSize="lg"
                    placeholder={t('createModal.positionPlaceholder')}
                    leftIcon={<IdBadgeIcon className="size-5" />}
                    {...register('position')}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block px-2">
                    <span className="text-[16px] font-medium leading-[1.4] tracking-[0.3px] text-gray-800">
                      {t('createModal.department')}{' '}
                      <span className="text-[12px] font-normal text-gray-500">
                        ({t('common:optional')})
                      </span>
                    </span>
                  </label>
                  <Input
                    type="text"
                    inputSize="lg"
                    placeholder={t('createModal.departmentPlaceholder')}
                    leftIcon={<DepartmentIcon className="size-5" />}
                    {...register('department')}
                  />
                </div>

                {createMutation.isError && (
                  <Alert variant="destructive">
                    {(createMutation.error as { response?: { data?: { error?: string } } })
                      ?.response?.data?.error ?? t('createModal.createError')}
                  </Alert>
                )}
              </div>

              <div className="flex w-full flex-col gap-3">
                <Button
                  type="submit"
                  size="lg"
                  isLoading={createMutation.isPending}
                  disabled={!isValid}
                  className="w-full"
                >
                  {createMutation.isPending
                    ? t('createUserPage.sending')
                    : t('createUserPage.sendInvitation')}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  type="button"
                  onClick={onClose}
                  className="w-full"
                >
                  {t('createUserPage.cancel')}
                </Button>
              </div>
            </form>
          </>
        )}

        {step === 'success' && <InvitationSuccessStep email={createdEmail} onClose={onClose} />}
      </Modal>

      {isUserExistsOpen && (
        <UserAlreadyExistsModal
          onClose={() => setIsUserExistsOpen(false)}
          onBack={onClose}
          title={t('common:userAlreadyExists.title')}
          description={t('common:userAlreadyExists.description')}
          buttonLabel={t('common:userAlreadyExists.backButton')}
        />
      )}
    </>
  );
}
