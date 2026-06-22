import { useTranslation } from '@forethread/i18n';
import { CompanyType, VendorCategory } from '@forethread/shared-types/client';
import {
  GridModal,
  Input,
  FormField,
  Button,
  Alert,
  CustomDropdown,
} from '@forethread/ui-components';
import EnvelopeIcon from '@forethread/ui-components/assets/icons/envelope-simple.svg?react';
import InfoIcon from '@forethread/ui-components/assets/icons/info.svg?react';
import VendorsIcon from '@forethread/ui-components/assets/icons/vendors.svg?react';
import WrenchIcon from '@forethread/ui-components/assets/icons/wrench.svg?react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';

import { useCreateVendorCompany } from '../services/vendors.service';

const createVendorCompanySchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  companyEmail: z.string().email('Invalid email address'),
  specialisation: z.string().min(1, 'Specialisation is required'),
});

type CreateVendorCompanyFormValues = z.infer<typeof createVendorCompanySchema>;

interface CreateVendorCompanyModalProps {
  onClose: () => void;
  onSuccess: (
    companyId: string,
    companyName: string,
    companyEmail: string,
    alreadyExisted: boolean,
  ) => void;
}

export function CreateVendorCompanyModal({ onClose, onSuccess }: CreateVendorCompanyModalProps) {
  const { t } = useTranslation(['vendors', 'common']);
  const createMutation = useCreateVendorCompany();
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateVendorCompanyFormValues>({
    resolver: zodResolver(createVendorCompanySchema),
  });

  const specialisationOptions = useMemo(
    () =>
      Object.values(VendorCategory).map((cat) => ({
        value: cat,
        label: t(`vendorCategories.${cat}` as `vendorCategories.CONCRETE_MASONRY`),
      })),
    [t],
  );

  const onSubmit = handleSubmit((data) => {
    setErrorKey(null);
    createMutation.mutate(
      {
        type: CompanyType.VENDOR,
        legalName: data.companyName,
        contactEmail: data.companyEmail,
        specialisations: [data.specialisation],
      },
      {
        onSuccess: (response) => {
          onSuccess(response.id, response.legalName, data.companyEmail, !!response.alreadyExisted);
        },
        onError: () => {
          setErrorKey('createError');
        },
      },
    );
  });

  return (
    <GridModal
      onClose={onClose}
      maxWidth="max-w-[560px]"
      icon={<VendorsIcon className="size-6 text-gray-700" />}
      title={t('createCompanyModal.title')}
      description={t('createCompanyModal.subtitle')}
      onSubmit={(e) => void onSubmit(e)}
      actions={
        <>
          <Button type="submit" size="lg" isLoading={createMutation.isPending} className="w-full">
            {createMutation.isPending
              ? t('createCompanyModal.creating')
              : t('createCompanyModal.createCompany')}
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
          {t(`createCompanyModal.${errorKey}` as 'createCompanyModal.createError')}
        </Alert>
      )}

      {/* Company Name */}
      <FormField label={t('createCompanyModal.companyName')} error={errors.companyName?.message}>
        <Input
          type="text"
          placeholder={t('createCompanyModal.companyNamePlaceholder')}
          {...register('companyName')}
        />
      </FormField>

      {/* Company Email */}
      <FormField label={t('createCompanyModal.companyEmail')} error={errors.companyEmail?.message}>
        <Input
          type="email"
          placeholder={t('createCompanyModal.companyEmailPlaceholder')}
          leftIcon={<EnvelopeIcon className="w-5 h-5" />}
          {...register('companyEmail')}
        />
      </FormField>

      {/* Specialisation */}
      <FormField
        label={t('createCompanyModal.specialisation')}
        error={errors.specialisation?.message}
      >
        <Controller
          name="specialisation"
          control={control}
          render={({ field }) => (
            <CustomDropdown
              options={specialisationOptions}
              value={field.value}
              onChange={field.onChange}
              placeholder={t('createCompanyModal.specialisationPlaceholder')}
              leftIcon={<WrenchIcon className="w-5 h-5" />}
              searchable
              error={Boolean(errors.specialisation)}
            />
          )}
        />
      </FormField>
    </GridModal>
  );
}
