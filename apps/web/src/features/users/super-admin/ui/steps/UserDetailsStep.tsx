import { useTranslation } from '@forethread/i18n';
import { CompanyType, UserRole } from '@forethread/shared-types/client';
import {
  Button,
  ModalGridHeader,
  Input,
  FormField,
  CustomDropdown,
  Alert,
} from '@forethread/ui-components';
import BriefcaseIcon from '@forethread/ui-components/assets/icons/briefcase.svg?react';
import DepartmentIcon from '@forethread/ui-components/assets/icons/department.svg?react';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import IdBadgeIcon from '@forethread/ui-components/assets/icons/id-badge.svg?react';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';
import UserOutlineIcon from '@forethread/ui-components/assets/icons/user-outline.svg?react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';

import { CONTRACTOR_ROLE_OPTIONS } from '../../constants/roles';
import { useCreateUser } from '../../services/users.service';

/** DS field-sized (48px / Corner-m) trigger so the dropdowns match the lg inputs. */
const DS_DROPDOWN_TRIGGER =
  'h-12 rounded-[14px] border-[#E8EAED] bg-white py-0 text-[16px] text-gray-900';

interface UserDetailsStepProps {
  companyType: CompanyType;
  companyId: string;
  companyName: string;
  isNewlyCreatedCompany?: boolean;
  onSuccess: (email: string) => void;
  onCancel: () => void;
  onUserExists: () => void;
}

export function UserDetailsStep({
  companyType,
  companyId,
  onSuccess,
  onCancel,
  onUserExists,
}: UserDetailsStepProps) {
  const { t } = useTranslation(['users', 'common', 'validation']);
  const createMutation = useCreateUser();

  const isContractor = companyType === CompanyType.CONTRACTOR;

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t('validation:nameRequired')),
        email: z.string().email(t('validation:emailRequired')),
        role: isContractor
          ? z.string().min(1, t('validation:roleRequired'))
          : z.string().optional(),
        position: z.string().optional(),
        department: z.string().optional(),
      }),
    [t, isContractor],
  );

  type FormData = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      // Figma defaults the contractor Role dropdown to "Company admin".
      role: isContractor ? UserRole.COMPANY_ADMIN : UserRole.VENDOR,
    },
  });

  const roleOptions = useMemo(
    () =>
      CONTRACTOR_ROLE_OPTIONS.map((role) => ({
        value: role,
        label: String(t(`roles.${role}` as 'roles.COMPANY_ADMIN')),
      })),
    [t],
  );

  const onSubmit = (data: FormData) => {
    createMutation.mutate(
      {
        name: data.name,
        email: data.email,
        role: isContractor ? (data.role ?? '') : 'VENDOR',
        companyId,
        position: data.position?.trim() ?? undefined,
        department: data.department?.trim() ?? undefined,
      },
      {
        onSuccess: () => onSuccess(data.email),
        onError: (error) => {
          const apiError = error as { statusCode?: number };
          if (apiError.statusCode === 409) {
            onUserExists();
          }
        },
      },
    );
  };

  return (
    <>
      <ModalGridHeader
        icon={<NewUserIcon className="size-6 text-gray-700" />}
        title={t('createUserPage.title')}
        subtitle={t('createUserPage.subtitle')}
      />

      <form
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="relative flex w-full flex-col gap-10 text-left"
        noValidate
      >
        <div className="flex w-full flex-col gap-6">
          <FormField label={t('createModal.fullName')} error={errors.name?.message} labelSize="lg">
            <Input
              type="text"
              inputSize="lg"
              placeholder={t('createModal.namePlaceholder')}
              leftIcon={<UserOutlineIcon className="size-5" />}
              {...register('name')}
            />
          </FormField>

          <FormField label={t('createModal.email')} error={errors.email?.message} labelSize="lg">
            <Input
              type="email"
              inputSize="lg"
              placeholder={t('createModal.emailPlaceholder')}
              leftIcon={<EnvelopeIcon className="size-5" />}
              {...register('email')}
            />
          </FormField>

          {isContractor && (
            <FormField label={t('createModal.role')} error={errors.role?.message} labelSize="lg">
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <CustomDropdown
                    options={roleOptions}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t('createModal.selectRole')}
                    leftIcon={<BriefcaseIcon className="size-5" />}
                    triggerClassName={DS_DROPDOWN_TRIGGER}
                    error={!!errors.role}
                  />
                )}
              />
            </FormField>
          )}

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
              {(createMutation.error as { response?: { data?: { error?: string } } })?.response
                ?.data?.error ?? t('createModal.createError')}
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
          <Button variant="outline" size="lg" type="button" onClick={onCancel} className="w-full">
            {t('createUserPage.cancel')}
          </Button>
        </div>
      </form>
    </>
  );
}
